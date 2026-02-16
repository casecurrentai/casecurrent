import type { Express } from 'express';
import type { Server } from 'http';
import * as crypto from 'crypto';
import swaggerUi from 'swagger-ui-express';
import cookieParser from 'cookie-parser';
import { WebSocketServer, WebSocket } from 'ws';
import { prisma } from './db';
import { swaggerSpec } from './openapi';
import {
  generateToken,
  hashPassword,
  comparePassword,
  authMiddleware,
  flexAuthMiddleware,
  AUTH_COOKIE_NAME,
  requireMinRole,
  requirePlatformAdmin,
  createAuditLog,
  createPlatformAdminAuditLog,
  generateInviteToken,
  generateImpersonationToken,
  isPlatformAdmin,
  verifyToken,
  type AuthenticatedRequest,
} from './auth';
import { handleOpenAIWebhook, getLastAcceptCallStatus } from './openai/webhook';
import { getOpenAIProjectId, isOpenAIConfigured } from './openai/client';
import { recordEvent, getRecentEvents, getEventCount } from './flightRecorder';
import {
  getTelephonyStatus,
  getActiveProvider,
  mapDbStatusToCanonical,
  mapPlivoWebhookToDbStatus,
  calculateDurationSeconds,
  normalizeOutcome,
  isTerminalStatus,
  outcomeRequiresFollowup,
  type CanonicalCallStatus,
} from './telephony/status';
import { generateStreamToken, handleTwilioMediaStream } from './telephony/twilio/streamHandler';
import { DATABASE_URL } from './env';
import { sendIncomingCallPush, sendIncomingCallPushToUser } from './notifications/push';
import { logAnalyticsEvent, countAnalyticsEvents, getEventCountsByType, type AnalyticsEventType } from './analytics/events';
import {
  getExperimentAssignment,
  logExperimentConversion,
  getExperimentStats,
  listExperiments,
} from './analytics/experiments';
import { getPIDashboardData, resolveMissedCall } from './analytics/piDashboard';
import { createElevenLabsWebhookRouter } from './webhooks/elevenlabs';
import { createVapiWebhookRouter } from './webhooks/vapi';
import aiRouter from './routes/ai';
import summaryRouter from './routes/summary';
import transcriptRouter from './routes/transcript';
import analyticsTrendsRouter from './routes/analytics-trends';
import callDebugRouter from './routes/call-debug';
import ingestionOutcomesRouter from './routes/ingestion-outcomes';
import { recordIngestionOutcome } from './webhooks/ingestion-outcome';

// ============================================
// REALTIME WEBSOCKET CONNECTIONS
// ============================================
interface WSClient {
  ws: WebSocket;
  userId: string;
  orgId: string;
  lastPing: number;
}

const wsClients = new Map<string, WSClient>();

// Emit realtime event to all clients in an org
export function emitRealtimeEvent(
  orgId: string,
  event: {
    type: string;
    leadId?: string;
    timestamp: string;
    data: Record<string, unknown>;
  }
) {
  const message = JSON.stringify(event);
  for (const [clientId, client] of wsClients) {
    if (client.orgId === orgId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(message);
      } catch (err) {
        console.error(`[WS] Error sending to client ${clientId}:`, err);
      }
    }
  }
}

// Emit realtime event to a specific user only
export function emitToUser(
  userId: string,
  event: {
    type: string;
    leadId?: string;
    timestamp: string;
    data: Record<string, unknown>;
  }
) {
  const message = JSON.stringify(event);
  let sentCount = 0;
  for (const [clientId, client] of wsClients) {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(message);
        sentCount++;
      } catch (err) {
        console.error(`[WS] Error sending to user ${userId} client ${clientId}:`, err);
      }
    }
  }
  return sentCount;
}

// GATE 5: In-memory log buffer for diagnostics
const LOG_BUFFER_SIZE = 400;
const logBuffer: string[] = [];
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const startTime = Date.now();
const BUILD_VERSION = 'v4-' + new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
const BOOT_TIME = new Date().toISOString();

// ============================================
// BUILD FINGERPRINTING (robust deployment verification)
// ============================================

// Discover and log all build-related env vars at startup
function discoverBuildEnvVars(): Record<string, string> {
  const buildEnvPatterns = /(COMMIT|SHA|GIT|DEPLOY|REPL|RAILWAY|VERCEL|BUILD)/i;
  const discovered: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(process.env)) {
    if (buildEnvPatterns.test(key) && value) {
      // Mask long values (potential secrets), keep short IDs visible
      const safeValue = value.length > 64 ? value.slice(0, 8) + '...' + value.slice(-4) : value;
      discovered[key] = safeValue;
    }
  }
  
  return discovered;
}

// Try env vars in priority order, then generate fallback fingerprint
function getBuildFingerprint(): { sha: string; source: string; deploymentId: string | null } {
  const envPriority = [
    'REPL_DEPLOYMENT_ID',
    'REPLIT_DEPLOYMENT_ID', 
    'REPL_SLUG_COMMIT',
    'RAILWAY_GIT_COMMIT_SHA',
    'VERCEL_GIT_COMMIT_SHA',
    'GITHUB_SHA',
    'COMMIT_SHA',
    'BUILD_SHA',
    'DEPLOY_FINGERPRINT',
  ];
  
  for (const envKey of envPriority) {
    const value = process.env[envKey];
    if (value && value.trim()) {
      return {
        sha: value.trim().slice(0, 12), // Truncate for display
        source: envKey,
        deploymentId: process.env.REPL_DEPLOYMENT_ID || process.env.REPLIT_DEPLOYMENT_ID || null,
      };
    }
  }
  
  // No env var found - check if we're in production
  // On Replit:
  //   - REPLIT_ENVIRONMENT=production is set in BOTH dev workflow and published deployments
  //   - REPLIT_MODE=workflow indicates running in the development workflow (not published)
  //   - Published deployments do NOT have REPLIT_MODE=workflow
  const isReplitWorkflow = process.env.REPLIT_MODE === 'workflow';
  const isReplitProduction = process.env.REPLIT_ENVIRONMENT === 'production' && !isReplitWorkflow;
  const isNodeProduction = process.env.NODE_ENV === 'production';
  
  // Local dev: running in workflow mode OR NODE_ENV=development with no Replit production flag
  const isLocalDev = isReplitWorkflow || (
    process.env.NODE_ENV === 'development' &&
    !process.env.REPLIT_ENVIRONMENT
  );
  
  const isProduction = isReplitProduction || isNodeProduction;
  
  if (isProduction && !isLocalDev) {
    // Generate a stable runtime fingerprint for this deployment
    const runtimeFingerprint = `RT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    return {
      sha: runtimeFingerprint,
      source: 'runtime-generated',
      deploymentId: null,
    };
  }
  
  return {
    sha: 'local',
    source: 'default',
    deploymentId: null,
  };
}

// Log build environment discovery
const discoveredEnvVars = discoverBuildEnvVars();
console.log(`[BUILD_ENV] Discovered ${Object.keys(discoveredEnvVars).length} build-related env vars:`);
for (const [key, value] of Object.entries(discoveredEnvVars)) {
  console.log(`[BUILD_ENV]   ${key}=${value}`);
}

// Get build fingerprint
const BUILD_FINGERPRINT = getBuildFingerprint();
const GIT_SHA = BUILD_FINGERPRINT.sha;

console.log(`[BUILD_INFO] nodeEnv=${process.env.NODE_ENV || 'undefined'} buildTime=${BOOT_TIME} selectedSha=${BUILD_FINGERPRINT.sha} source=${BUILD_FINGERPRINT.source} deploymentId=${BUILD_FINGERPRINT.deploymentId || 'N/A'}`);

// Export for use in UI footer
export const buildInfo = {
  sha: BUILD_FINGERPRINT.sha,
  buildTime: BOOT_TIME,
  nodeEnv: process.env.NODE_ENV || 'development',
  deploymentId: BUILD_FINGERPRINT.deploymentId,
  source: BUILD_FINGERPRINT.source,
  host: process.env.HOSTNAME || process.env.HOST || 'unknown',
};

// Intercept console.log/error to buffer logs
console.log = (...args: any[]) => {
  const line = `[${new Date().toISOString()}] LOG: ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`;
  logBuffer.push(line);
  if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();
  originalConsoleLog.apply(console, args);
};
console.error = (...args: any[]) => {
  const line = `[${new Date().toISOString()}] ERR: ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`;
  logBuffer.push(line);
  if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();
  originalConsoleError.apply(console, args);
};
import { maskPhone, maskCallSid, maskSipUri, maskProjectId } from './utils/logMasking';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Cookie parser for flexible auth
  app.use(cookieParser());
  
  // Swagger UI
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // ============================================
  // UNIFIED WEBSOCKET SERVER WITH MANUAL DISPATCHER
  // ============================================
  // Use noServer mode to manually route upgrades by path
  const realtimeWss = new WebSocketServer({ noServer: true });
  const twilioWss = new WebSocketServer({ noServer: true });

  // Mobile realtime WebSocket handler
  realtimeWss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Missing token');
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      ws.close(4002, 'Invalid token');
      return;
    }

    const clientId = crypto.randomUUID();
    wsClients.set(clientId, {
      ws,
      userId: payload.userId,
      orgId: payload.orgId,
      lastPing: Date.now(),
    });

    console.log(`[WS] Client connected: ${clientId} (org: ${payload.orgId})`);

    ws.send(
      JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
        data: { clientId },
      })
    );

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          const client = wsClients.get(clientId);
          if (client) {
            client.lastPing = Date.now();
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          }
        }
      } catch (err) {
        // Ignore parse errors
      }
    });

    ws.on('close', () => {
      wsClients.delete(clientId);
      console.log(`[WS] Client disconnected: ${clientId}`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Client error ${clientId}:`, err);
      wsClients.delete(clientId);
    });
  });

  // Twilio Media Streams WebSocket handler
  twilioWss.on('connection', (ws, req) => {
    handleTwilioMediaStream(ws, req);
  });

  // Register unified upgrade dispatcher on HTTP server
  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = request.url?.split('?')[0] || '';

    if (pathname === '/v1/realtime') {
      realtimeWss.handleUpgrade(request, socket, head, (ws) => {
        realtimeWss.emit('connection', ws, request);
      });
    } else if (pathname.startsWith('/v1/telephony/twilio/stream')) {
      console.log(JSON.stringify({ event: 'ws_upgrade', path: pathname }));
      twilioWss.handleUpgrade(request, socket, head, (ws) => {
        twilioWss.emit('connection', ws, request);
      });
    }
    // Don't destroy socket for other paths - let Vite/other handlers process them
  });

  // Explicit HTTP handler to prevent SPA fallback from returning index.html
  app.get('/v1/telephony/twilio/stream', (_req, res) => {
    res.status(426).json({ error: 'Upgrade Required', message: 'WebSocket upgrade required' });
  });

  // Cleanup stale connections every 60 seconds
  setInterval(() => {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    for (const [clientId, client] of wsClients) {
      const ageMs = now - client.lastPing;
      if (ageMs > staleThreshold) {
        console.log(JSON.stringify({
          event: 'ws_stale_client_removed',
          clientId,
          ageMs,
          thresholdMs: staleThreshold,
        }));
        client.ws.close(4003, 'Connection stale');
        wsClients.delete(clientId);
      }
    }
  }, 60000);

  /**
   * @openapi
   * /api/health:
   *   get:
   *     summary: Health check endpoint
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Health status
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthResponse'
   */
  app.get('/api/health', async (_req, res) => {
    let dbStatus = 'unknown';
    let orgCount = 0;

    try {
      await prisma.$queryRaw`SELECT 1`;
      const count = await prisma.organization.count();
      dbStatus = 'connected';
      orgCount = count;
    } catch (error) {
      console.error('Database health check failed:', error);
      dbStatus = 'disconnected';
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      orgCount,
    });
  });

  // ============================================
  // GATE 5: DIAGNOSTIC ENDPOINTS (token-gated)
  // ============================================

  app.get('/v1/diag/logs', (req, res) => {
    const diagToken = process.env.DIAG_TOKEN;
    if (!diagToken) {
      return res.status(404).json({ error: 'Not found' });
    }
    const token = req.query.token as string;
    if (token !== diagToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Mask secrets in logs
    const maskedLogs = logBuffer.map((line) => {
      return line
        .replace(/whsec_[A-Za-z0-9+/=]+/g, 'whsec_[REDACTED]')
        .replace(/sk-[A-Za-z0-9]+/g, 'sk-[REDACTED]')
        .replace(/Bearer [A-Za-z0-9._-]+/g, 'Bearer [REDACTED]');
    });

    res.setHeader('Content-Type', 'text/plain');
    res.send(maskedLogs.join('\n'));
  });

  app.get('/v1/diag/status', async (req, res) => {
    const diagToken = process.env.DIAG_TOKEN;
    if (!diagToken) {
      return res.status(404).json({ error: 'Not found' });
    }
    const token = req.query.token as string;
    if (token !== diagToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let dbOk = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {}

    let openaiOk = false;
    try {
      openaiOk = isOpenAIConfigured();
    } catch {}

    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    res.json({
      dbOk,
      openaiOk,
      uptime: `${uptimeSeconds}s`,
      buildVersion: BUILD_VERSION,
      lastAcceptCallStatus: getLastAcceptCallStatus(),
      logBufferSize: logBuffer.length,
      flightRecorderSize: getEventCount(),
    });
  });

  app.get('/v1/diag/timeline', (req, res) => {
    const diagToken = process.env.DIAG_TOKEN;
    if (!diagToken) {
      if (process.env.NODE_ENV === 'production') {
        console.warn('[DIAG] DIAG_TOKEN not set in production - timeline endpoint disabled');
        return res.status(404).json({ error: 'Not found' });
      }
      console.warn('[DIAG] DIAG_TOKEN not set - using dev default');
    }
    const token = req.query.token as string;
    const expectedToken = diagToken || 'dev-diag-token';
    if (token !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const events = getRecentEvents(limit);

    res.json({
      count: events.length,
      totalRecorded: getEventCount(),
      events,
    });
  });

  // Public build info endpoint (no secrets, no auth required)
  app.get('/v1/diag/build', async (_req, res) => {
    // Extract sanitized DB info from DATABASE_URL
    let dbHost = 'unknown';
    let dbName = 'unknown';
    try {
      const dbUrl = process.env.DATABASE_URL || '';
      const match = dbUrl.match(/@([^:\/]+)[:\d]*\/([^?]+)/);
      if (match) {
        dbHost = match[1];
        dbName = match[2];
      }
    } catch {}

    res.json({
      ok: true,
      sha: GIT_SHA,
      env: process.env.NODE_ENV || 'undefined',
      bootTime: BOOT_TIME,
      now: new Date().toISOString(),
      buildVersion: BUILD_VERSION,
      dbHost,
      dbName,
    });
  });

  // Deployment verification endpoint — public, no auth, no cache
  // Aliases: /api/version and /version (for quick curl checks)
  const versionHandler = (_req: any, res: any) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

    res.json({
      sha: buildInfo.sha,
      buildTime: buildInfo.buildTime,
      nodeEnv: buildInfo.nodeEnv,
      deploymentId: buildInfo.deploymentId,
      host: buildInfo.host,
      source: buildInfo.source,
    });
  };
  app.get('/api/version', versionHandler);
  app.get('/version', versionHandler);

  // Token-gated production phone number seeding endpoint
  // TODO: Remove or disable this endpoint after initial production seeding is verified
  app.post('/v1/diag/seed-phone-number', async (req, res) => {
    const diagToken = process.env.DIAG_TOKEN;
    if (!diagToken) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const token = req.query.token as string;
    if (token !== diagToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const targetOrgId = 'e552396a-e129-4a16-aa24-a016f9dcaba3';
      const e164 = '+18443214257';

      // Step 1: Ensure organization exists
      let org = await prisma.organization.findUnique({
        where: { id: targetOrgId },
      });

      if (!org) {
        // Create the organization
        org = await prisma.organization.create({
          data: {
            id: targetOrgId,
            name: 'CaseCurrent Demo',
            slug: 'casecurrent-demo',
          },
        });
        console.log('[DIAG] Created organization:', org.id);
      }

      // Step 2: Upsert phone number
      const upserted = await prisma.phoneNumber.upsert({
        where: { e164 },
        update: {
          orgId: org.id,
          label: 'Twilio Main Line',
          provider: 'twilio',
          inboundEnabled: true,
        },
        create: {
          orgId: org.id,
          e164,
          label: 'Twilio Main Line',
          provider: 'twilio',
          inboundEnabled: true,
        },
      });

      const phoneNumbersCount = await prisma.phoneNumber.count();
      const orgCount = await prisma.organization.count();

      res.json({
        ok: true,
        orgId: org.id,
        orgCreated: !org.createdAt || org.createdAt.getTime() > Date.now() - 5000,
        upserted: { id: upserted.id, e164: upserted.e164 },
        phoneNumbersCount,
        orgCount,
      });
    } catch (error: any) {
      console.error('[DIAG] seed-phone-number error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Protected diagnostic endpoint for telephony status
  // GET /v1/diag/telephony-status?to=+1XXXXXXXXXX&token=DIAG_TOKEN
  app.get('/v1/diag/telephony-status', async (req, res) => {
    const diagToken = process.env.DIAG_TOKEN;
    
    // Return 404 in production if DIAG_TOKEN not set (security)
    if (!diagToken) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const token = req.query.token as string;
    if (token !== diagToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const toNumber = (req.query.to as string) || '';
      
      // === ENV identifiers ===
      const nodeEnv = process.env.NODE_ENV || 'undefined';
      const replSlug = process.env.REPL_SLUG || process.env.REPL_ID || null;
      const railwaySha = process.env.RAILWAY_GIT_COMMIT_SHA || null;
      
      // === DB identity (no password) ===
      let dbHost = 'unknown';
      let dbName = 'unknown';
      const urlMatch = DATABASE_URL.match(/@([^:/]+)(?::(\d+))?\/([^?]+)/);
      if (urlMatch) {
        dbHost = urlMatch[1];
        dbName = urlMatch[3];
      }
      
      // === Phone number lookup ===
      let phoneNumberRecord = null;
      let orgId: string | null = null;
      
      if (toNumber) {
        // Normalize and search
        const digitsOnly = toNumber.replace(/\D/g, '');
        const candidates: string[] = [toNumber];
        if (digitsOnly) candidates.push('+' + digitsOnly);
        if (digitsOnly.length === 10) candidates.push('+1' + digitsOnly);
        
        const phoneNumber = await prisma.phoneNumber.findFirst({
          where: { e164: { in: candidates } },
          include: { organization: { select: { id: true, name: true, slug: true } } },
        });
        
        if (phoneNumber) {
          // Mask e164 in response for security (show only last 4 digits)
          const maskedE164 = '****' + phoneNumber.e164.slice(-4);
          phoneNumberRecord = {
            id: phoneNumber.id,
            e164Masked: maskedE164,
            inboundEnabled: phoneNumber.inboundEnabled,
            orgId: phoneNumber.orgId,
            orgName: phoneNumber.organization?.name,
            orgSlug: phoneNumber.organization?.slug,
          };
          orgId = phoneNumber.orgId;
        }
      }
      
      // === Leads count for org in last 24h ===
      let leadsCount24h = 0;
      let mostRecentLead = null;
      
      if (orgId) {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        leadsCount24h = await prisma.lead.count({
          where: { orgId, createdAt: { gte: since24h } },
        });
        
        const recentLead = await prisma.lead.findFirst({
          where: { orgId },
          orderBy: { createdAt: 'desc' },
          include: {
            contact: { select: { name: true } },
          },
        });
        
        if (recentLead) {
          // Check if there's a call associated with this lead
          const leadCall = await prisma.call.findFirst({
            where: { leadId: recentLead.id },
            orderBy: { createdAt: 'desc' },
          });
          
          mostRecentLead = {
            id: recentLead.id,
            callSid: leadCall?.twilioCallSid || null,
            createdAt: recentLead.createdAt.toISOString(),
            status: recentLead.status,
            contactName: recentLead.contact?.name,
          };
        }
      }
      
      res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        env: {
          nodeEnv,
          replSlug,
          railwaySha: railwaySha ? railwaySha.slice(0, 7) : null,
        },
        db: {
          host: dbHost,
          name: dbName,
        },
        phoneNumberQuery: toNumber || null,
        phoneNumberFound: !!phoneNumberRecord,
        phoneNumber: phoneNumberRecord,
        leadsCount24h: orgId ? leadsCount24h : null,
        mostRecentLead,
      });
    } catch (error: any) {
      console.error('[DIAG] telephony-status error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // GET /v1/diag/voices?token=DIAG_TOKEN
  // Diagnostic endpoint to list available ElevenLabs voices
  app.get('/v1/diag/voices', async (req, res) => {
    const diagToken = process.env.DIAG_TOKEN;
    
    if (!diagToken) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const token = req.query.token as string;
    if (token !== diagToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { listVoices } = await import('./tts/elevenlabs');
      const result = await listVoices();
      
      // Check if Hope is in the list
      const hopeVoice = result.voices.find((v: { voice_id: string; name: string }) => 
        v.name.toLowerCase().includes('hope')
      );
      
      const configuredVoiceId = process.env.ELEVENLABS_VOICE_ID_AVERY || process.env.ELEVENLABS_VOICE_ID;
      const configuredVoiceFound = configuredVoiceId 
        ? result.voices.some((v: { voice_id: string; name: string }) => v.voice_id === configuredVoiceId)
        : false;
      
      res.json({
        ok: true,
        apiKeyPresent: !!process.env.ELEVENLABS_API_KEY,
        apiKeyLength: process.env.ELEVENLABS_API_KEY?.length || 0,
        configuredVoiceId,
        configuredVoiceFound,
        hopeFound: !!hopeVoice,
        hopeVoiceId: hopeVoice?.voice_id || null,
        voiceCount: result.voices.length,
        voices: result.voices.slice(0, 30), // First 30 voices
        error: result.error,
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // GET /v1/diag/enrichment?callSid=...&token=DIAG_TOKEN
  // Diagnostic endpoint to verify enrichment data exists for a given call
  app.get('/v1/diag/enrichment', async (req, res) => {
    const diagToken = process.env.DIAG_TOKEN;
    
    // Return 404 in production if DIAG_TOKEN not set (security)
    if (!diagToken) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const token = req.query.token as string;
    if (token !== diagToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const callSid = (req.query.callSid as string) || '';
      
      if (!callSid) {
        return res.status(400).json({ ok: false, error: 'callSid required' });
      }
      
      // Find call by callSid
      const call = await prisma.call.findUnique({
        where: { twilioCallSid: callSid },
        include: {
          lead: {
            include: {
              contact: { select: { name: true, primaryPhone: true } },
              intake: { select: { id: true, answers: true, completionStatus: true } },
              qualification: { select: { score: true, disposition: true, reasons: true } },
            },
          },
        },
      });
      
      if (!call) {
        return res.json({
          ok: true,
          callSid: callSid.slice(-8),
          found: false,
          message: 'Call not found',
        });
      }
      
      const lead = call.lead;
      const intakeData = lead?.intakeData as Record<string, unknown> | null;
      const intakeAnswers = lead?.intake?.answers as Record<string, unknown> | null;
      const transcript = call.transcriptJson as unknown[] | null;
      
      // Extract populated fields from intake data
      const extractedKeys = intakeData ? Object.keys(intakeData).filter(k => {
        const v = intakeData[k];
        return v !== null && v !== undefined && v !== '' && typeof v !== 'object';
      }) : [];
      
      // Check intake record populated fields
      const intakePopulatedFields = intakeAnswers ? Object.keys(intakeAnswers).filter(k => {
        const v = intakeAnswers[k];
        return v !== null && v !== undefined && v !== '' && typeof v !== 'object';
      }) : [];
      
      res.json({
        ok: true,
        callSid: `****${callSid.slice(-8)}`,
        found: true,
        leadId: lead?.id || null,
        orgId: call.orgId,
        displayName: lead?.displayName || lead?.contact?.name || null,
        practiceArea: lead?.practiceAreaId || (intakeData as any)?.practiceArea || (intakeData as any)?.practiceAreaGuess || null,
        transcriptExists: !!call.transcriptText,
        msgCount: Array.isArray(transcript) ? transcript.length : 0,
        transcriptLength: call.transcriptText?.length || 0,
        extractedKeys,
        intakeExists: !!lead?.intake,
        intakeStatus: lead?.intake?.completionStatus || null,
        populatedFields: intakePopulatedFields,
        score: lead?.score || lead?.qualification?.score || null,
        tier: lead?.scoreLabel || lead?.qualification?.disposition || null,
        scoreReasons: lead?.scoreReasons || lead?.qualification?.reasons || null,
      });
    } catch (error: any) {
      console.error('[DIAG] enrichment error:', error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // GET /api/diag/last-call - AUTHENTICATED mobile-friendly enrichment diagnostic
  // Returns the most recent call for the user's org with full enrichment status
  // Restricted to admin/owner roles for security
  app.get('/api/diag/last-call', flexAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      
      // Require admin or owner role
      if (user.role !== 'admin' && user.role !== 'owner') {
        return res.status(403).json({ error: 'Admin or owner role required' });
      }
      
      const orgId = user.orgId;
      
      // Find the most recent call for this org
      const call = await prisma.call.findFirst({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        include: {
          lead: {
            include: {
              contact: { select: { id: true, name: true, firstName: true, lastName: true, primaryPhone: true, primaryEmail: true } },
              intake: { select: { id: true, answers: true, completionStatus: true, completedAt: true } },
              qualification: { select: { id: true, score: true, disposition: true, reasons: true, confidence: true } },
            },
          },
        },
      });
      
      if (!call) {
        return res.json({
          orgId,
          leadId: null,
          callId: null,
          callSid: null,
          callCreatedAt: null,
          message: 'No calls found for this organization',
          transcript: { exists: false, messageCount: 0, hasUser: false, hasAssistant: false, first200: null },
          extraction: { ran: false, extractedFields: [], callerName: null, incidentDate: null, practiceAreaGuess: null },
          lead: { currentDisplayName: null, contactName: null, phone: null, intakeExists: false },
          scoring: { exists: false, score: null, tier: null },
          pipeline: { finalizeCalled: false, finalizeAt: null, lastError: null },
        });
      }
      
      const lead = call.lead;
      const intakeData = lead?.intakeData as Record<string, unknown> | null;
      const intakeAnswers = lead?.intake?.answers as Record<string, unknown> | null;
      const transcriptJson = call.transcriptJson as { role: string; text: string; timestamp: string }[] | { segments: string[] } | null;
      
      // Parse transcript to check for user/assistant messages
      let hasUser = false;
      let hasAssistant = false;
      let messageCount = 0;
      let first200 = '';
      
      if (call.transcriptText) {
        first200 = call.transcriptText.substring(0, 200);
        const lines = call.transcriptText.split('\n');
        messageCount = lines.length;
        for (const line of lines) {
          if (line.startsWith('Caller:') || line.startsWith('[Caller]:') || line.startsWith('[user]:')) {
            hasUser = true;
          }
          if (line.startsWith('Avery:') || line.startsWith('[AI]:') || line.startsWith('[assistant]:')) {
            hasAssistant = true;
          }
        }
      } else if (Array.isArray(transcriptJson)) {
        messageCount = transcriptJson.length;
        for (const msg of transcriptJson) {
          if (msg.role === 'user') hasUser = true;
          if (msg.role === 'ai' || msg.role === 'assistant') hasAssistant = true;
        }
        first200 = transcriptJson.slice(0, 3).map(m => `${m.role}: ${m.text?.substring(0, 50)}`).join(' | ');
      } else if (transcriptJson && 'segments' in transcriptJson && Array.isArray(transcriptJson.segments)) {
        messageCount = transcriptJson.segments.length;
        first200 = transcriptJson.segments.slice(0, 3).join(' | ').substring(0, 200);
        for (const seg of transcriptJson.segments) {
          if (seg.includes('[Caller]') || seg.includes('Caller:')) hasUser = true;
          if (seg.includes('[AI]') || seg.includes('Avery:')) hasAssistant = true;
        }
      }
      
      // Extract fields from intake data
      const extractedFields = intakeData ? Object.keys(intakeData).filter(k => {
        const v = intakeData[k];
        return v !== null && v !== undefined && v !== '' && !['caller', 'score', 'conflicts', 'keyFacts'].includes(k);
      }) : [];
      
      const callerName = (intakeData as any)?.callerName || 
                         (intakeData as any)?.caller?.fullName || 
                         lead?.displayName || 
                         null;
      const incidentDate = (intakeData as any)?.incidentDate || null;
      const practiceAreaGuess = (intakeData as any)?.practiceAreaGuess || 
                                (intakeData as any)?.practiceArea || 
                                lead?.practiceAreaId || 
                                null;
      
      // Check if enrichment ran (indicated by having extraction data)
      const extractionRan = extractedFields.length > 0 || !!callerName || !!practiceAreaGuess;
      
      // Check pipeline status - if transcript exists but no extraction, pipeline may have failed
      const finalizeCalled = !!call.transcriptText && call.transcriptText.length > 20;
      const finalizeAt = lead?.intake?.completedAt?.toISOString() || null;
      
      // Detect potential errors
      let lastError: string | null = null;
      if (call.transcriptText && call.transcriptText.length > 50 && !extractionRan) {
        lastError = 'Transcript exists but extraction did not run or failed';
      } else if (extractionRan && !lead?.displayName && callerName && callerName !== 'Unknown') {
        lastError = 'Extraction ran but displayName not updated on lead';
      } else if (messageCount > 0 && !hasUser) {
        lastError = 'Transcript has no user messages - caller audio may not have been transcribed';
      } else if (messageCount > 0 && !hasAssistant) {
        lastError = 'Transcript has no assistant messages - AI responses may not have been captured';
      }
      
      // Compute transcriptStats for diagnostic response
      const transcriptStats = {
        msgCount: messageCount,
        userCount: hasUser ? Math.max(1, messageCount > 0 ? Math.floor(messageCount / 2) : 0) : 0,
        assistantCount: hasAssistant ? Math.max(1, messageCount > 0 ? Math.ceil(messageCount / 2) : 0) : 0,
        fullTextLen: call.transcriptText?.length || 0,
      };
      
      // If we have transcriptJson array, calculate exact counts
      if (Array.isArray(transcriptJson)) {
        transcriptStats.userCount = transcriptJson.filter(m => m.role === 'user').length;
        transcriptStats.assistantCount = transcriptJson.filter(m => m.role === 'ai' || m.role === 'assistant').length;
        transcriptStats.msgCount = transcriptJson.length;
      }
      
      res.json({
        orgId,
        leadId: lead?.id || null,
        callId: call.id,
        callSid: call.twilioCallSid ? `****${call.twilioCallSid.slice(-8)}` : null,
        callCreatedAt: call.createdAt?.toISOString() || null,
        transcriptStats,
        transcript: {
          exists: !!call.transcriptText,
          messageCount,
          hasUser,
          hasAssistant,
          first200,
        },
        extraction: {
          ran: extractionRan,
          extractedFields,
          callerName,
          incidentDate,
          practiceAreaGuess,
        },
        lead: {
          currentDisplayName: lead?.displayName || null,
          contactName: lead?.contact?.name || null,
          phone: lead?.contact?.primaryPhone || null,
          intakeExists: !!lead?.intake,
        },
        scoring: {
          exists: !!lead?.qualification || !!lead?.score,
          score: lead?.score || lead?.qualification?.score || null,
          tier: lead?.scoreLabel || lead?.qualification?.disposition || null,
        },
        pipeline: {
          finalizeCalled,
          finalizeAt,
          lastError,
        },
      });
    } catch (error: any) {
      console.error('[DIAG] last-call error:', error);
      res.status(500).json({ error: error.message || 'Failed to get diagnostic data' });
    }
  });

  /**
   * @openapi
   * /v1/auth/register:
   *   post:
   *     summary: Register a new organization and owner
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/RegisterRequest'
   *     responses:
   *       201:
   *         description: Registration successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.post('/v1/auth/register', async (req, res) => {
    try {
      const { email, password, name, orgName } = req.body;

      if (!email || !password || !name || !orgName) {
        return res
          .status(400)
          .json({ error: 'All fields required: email, password, name, orgName' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const slug = slugify(orgName);

      const existingOrg = await prisma.organization.findUnique({
        where: { slug },
      });

      if (existingOrg) {
        return res.status(400).json({ error: 'Organization name already taken' });
      }

      const org = await prisma.organization.create({
        data: {
          name: orgName,
          slug,
          status: 'active',
          timezone: 'America/New_York',
        },
      });

      const passwordHash = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          orgId: org.id,
          email,
          name,
          role: 'owner',
          status: 'active',
          passwordHash,
        },
      });

      const token = generateToken({
        userId: user.id,
        orgId: org.id,
        email: user.email,
        role: user.role,
      });

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  /**
   * @openapi
   * /v1/auth/login:
   *   post:
   *     summary: Login with email and password
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/LoginRequest'
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       401:
   *         description: Invalid credentials
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.post('/v1/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log('[LOGIN] Attempt for email:', email, 'password length:', password?.length);

      if (!email || !password) {
        console.log('[LOGIN] Missing email or password');
        return res.status(400).json({ error: 'Email and password required' });
      }

      const user = await prisma.user.findFirst({
        where: { email },
        include: { organization: true },
      });
      console.log('[LOGIN] User found:', !!user, user?.email);

      if (!user) {
        console.log('[LOGIN] User not found for email:', email);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPassword = await comparePassword(password, user.passwordHash);
      console.log('[LOGIN] Password validation result:', validPassword);
      if (!validPassword) {
        console.log('[LOGIN] Invalid password for user:', email);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken({
        userId: user.id,
        orgId: user.orgId,
        email: user.email,
        role: user.role,
      });

      await createAuditLog(user.orgId, user.id, 'system', 'login', 'user', user.id, {
        email: user.email,
        timestamp: new Date().toISOString(),
      });

      console.log('[LOGIN] Success! Sending response for:', email);
      
      // Set auth cookie for browser-based access (7 day expiry)
      res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });
      
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
          onboardingStatus: user.organization.onboardingStatus,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  /**
   * @openapi
   * /v1/me:
   *   get:
   *     summary: Get current user profile
   *     tags: [User]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User profile
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user:
   *                   $ref: '#/components/schemas/User'
   *                 organization:
   *                   $ref: '#/components/schemas/Organization'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.get('/v1/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: { organization: true },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
        },
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
          status: user.organization.status,
          timezone: user.organization.timezone,
          createdAt: user.organization.createdAt,
          updatedAt: user.organization.updatedAt,
        },
      });
    } catch (error) {
      console.error('Get me error:', error);
      res.status(500).json({ error: 'Failed to get user profile' });
    }
  });

  /**
   * @openapi
   * /v1/org:
   *   get:
   *     summary: Get current organization
   *     tags: [Organization]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Organization details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Organization'
   *       401:
   *         description: Unauthorized
   */
  app.get('/v1/org', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: req.user!.orgId },
      });

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      res.json({
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        timezone: org.timezone,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      });
    } catch (error) {
      console.error('Get org error:', error);
      res.status(500).json({ error: 'Failed to get organization' });
    }
  });

  /**
   * @openapi
   * /v1/org:
   *   patch:
   *     summary: Update organization (owner/admin only)
   *     tags: [Organization]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateOrgRequest'
   *     responses:
   *       200:
   *         description: Organization updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Organization'
   *       403:
   *         description: Insufficient permissions
   */
  app.patch(
    '/v1/org',
    authMiddleware,
    requireMinRole('admin'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { name, timezone } = req.body;
        const orgId = req.user!.orgId;

        const updateData: { name?: string; timezone?: string } = {};
        if (name) updateData.name = name;
        if (timezone) updateData.timezone = timezone;

        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }

        const org = await prisma.organization.update({
          where: { id: orgId },
          data: updateData,
        });

        await createAuditLog(orgId, req.user!.userId, 'user', 'update', 'organization', orgId, {
          changes: updateData,
          timestamp: new Date().toISOString(),
        });

        res.json({
          id: org.id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          timezone: org.timezone,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
        });
      } catch (error) {
        console.error('Update org error:', error);
        res.status(500).json({ error: 'Failed to update organization' });
      }
    }
  );

  // ============================================
  // ON-CALL ROUTING
  // ============================================

  /**
   * @openapi
   * /v1/oncall:
   *   get:
   *     summary: Get the current on-call user for the organization
   *     tags: [Organization]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: On-call user details (or null if not set)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 userId:
   *                   type: string
   *                   nullable: true
   *                 name:
   *                   type: string
   *                   nullable: true
   *                 email:
   *                   type: string
   *                   nullable: true
   */
  app.get('/v1/oncall', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: req.user!.orgId },
        select: { onCallUserId: true },
      });

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      if (!org.onCallUserId) {
        return res.json({ userId: null, name: null, email: null });
      }

      // Check if user exists AND is active
      const onCallUser = await prisma.user.findFirst({
        where: { id: org.onCallUserId, status: 'active' },
        select: { id: true, name: true, email: true },
      });

      if (!onCallUser) {
        // User was deleted/deactivated but reference remains - auto-clear it
        await prisma.organization.update({
          where: { id: req.user!.orgId },
          data: { onCallUserId: null },
        });
        console.log(`[On-Call] Auto-cleared stale on-call reference for org ${req.user!.orgId}`);
        return res.json({ userId: null, name: null, email: null });
      }

      res.json({
        userId: onCallUser.id,
        name: onCallUser.name,
        email: onCallUser.email,
      });
    } catch (error) {
      console.error('Get on-call error:', error);
      res.status(500).json({ error: 'Failed to get on-call user' });
    }
  });

  /**
   * @openapi
   * /v1/oncall:
   *   post:
   *     summary: Set the on-call user for the organization (admin only)
   *     tags: [Organization]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - userId
   *             properties:
   *               userId:
   *                 type: string
   *                 nullable: true
   *                 description: User ID to set as on-call, or null to clear
   *     responses:
   *       200:
   *         description: On-call user updated
   *       400:
   *         description: Invalid user ID
   *       403:
   *         description: Admin access required
   */
  app.post(
    '/v1/oncall',
    authMiddleware,
    requireMinRole('admin'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { userId } = req.body;
        const orgId = req.user!.orgId;

        // Allow null to clear on-call
        if (userId !== null && userId !== undefined) {
          // Validate that user exists and belongs to this org
          const targetUser = await prisma.user.findFirst({
            where: { id: userId, orgId, status: 'active' },
            select: { id: true, name: true, email: true },
          });

          if (!targetUser) {
            return res.status(400).json({ error: 'User not found in organization' });
          }
        }

        await prisma.organization.update({
          where: { id: orgId },
          data: { onCallUserId: userId || null },
        });

        await createAuditLog(orgId, req.user!.userId, 'user', 'update', 'organization', orgId, {
          action: 'set_oncall_user',
          newOnCallUserId: userId || null,
          timestamp: new Date().toISOString(),
        });

        // Fetch the updated on-call user details
        if (!userId) {
          return res.json({ userId: null, name: null, email: null });
        }

        const onCallUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true },
        });

        res.json({
          userId: onCallUser?.id || null,
          name: onCallUser?.name || null,
          email: onCallUser?.email || null,
        });
      } catch (error) {
        console.error('Set on-call error:', error);
        res.status(500).json({ error: 'Failed to set on-call user' });
      }
    }
  );

  /**
   * @openapi
   * /v1/org/users:
   *   get:
   *     summary: Get all users in the organization (for on-call picker)
   *     tags: [Organization]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of org users
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                   name:
   *                     type: string
   *                   email:
   *                     type: string
   *                   role:
   *                     type: string
   */
  app.get('/v1/org/users', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const users = await prisma.user.findMany({
        where: { orgId: req.user!.orgId, status: 'active' },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' },
      });

      res.json(users);
    } catch (error) {
      console.error('Get org users error:', error);
      res.status(500).json({ error: 'Failed to get organization users' });
    }
  });

  // ============================================
  // WEBHOOK SYSTEM (Checkpoint 8)
  // ============================================

  // Generate HMAC SHA256 signature for webhook payloads
  function signWebhookPayload(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  // Attempt to deliver a webhook with retry logic
  async function attemptWebhookDelivery(deliveryId: string): Promise<void> {
    const delivery = await prisma.outgoingWebhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: true },
    });

    if (!delivery || !delivery.endpoint || !delivery.endpoint.active) {
      console.log(`[WEBHOOK] Skipping delivery ${deliveryId} - not found or endpoint inactive`);
      return;
    }

    const MAX_ATTEMPTS = 3;
    const BACKOFF_MS = [1000, 5000, 15000]; // 1s, 5s, 15s

    if (delivery.attemptCount >= MAX_ATTEMPTS) {
      await prisma.outgoingWebhookDelivery.update({
        where: { id: deliveryId },
        data: { status: 'failed' },
      });
      console.log(`[WEBHOOK] Delivery ${deliveryId} failed after ${MAX_ATTEMPTS} attempts`);
      return;
    }

    const payloadStr = JSON.stringify(delivery.payload);
    const signature = signWebhookPayload(payloadStr, delivery.endpoint.secret);

    try {
      const response = await fetch(delivery.endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CT-Signature': signature,
          'X-CT-Event': delivery.eventType,
          'X-CT-Delivery-ID': deliveryId,
        },
        body: payloadStr,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const responseBody = await response.text().catch(() => '');

      await prisma.outgoingWebhookDelivery.update({
        where: { id: deliveryId },
        data: {
          attemptCount: delivery.attemptCount + 1,
          lastAttemptAt: new Date(),
          responseCode: response.status,
          responseBody: responseBody.slice(0, 1000),
          status: response.ok ? 'delivered' : 'pending',
        },
      });

      if (response.ok) {
        console.log(`[WEBHOOK] Delivery ${deliveryId} succeeded (status ${response.status})`);
      } else {
        console.log(
          `[WEBHOOK] Delivery ${deliveryId} failed with status ${response.status}, will retry`
        );
        // Schedule retry with backoff
        const backoffDelay = BACKOFF_MS[delivery.attemptCount] || 15000;
        setTimeout(() => attemptWebhookDelivery(deliveryId), backoffDelay);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await prisma.outgoingWebhookDelivery.update({
        where: { id: deliveryId },
        data: {
          attemptCount: delivery.attemptCount + 1,
          lastAttemptAt: new Date(),
          responseBody: `Error: ${errorMessage}`,
          status: 'pending',
        },
      });
      console.log(`[WEBHOOK] Delivery ${deliveryId} error: ${errorMessage}, will retry`);
      // Schedule retry with backoff
      const backoffDelay = BACKOFF_MS[delivery.attemptCount] || 15000;
      setTimeout(() => attemptWebhookDelivery(deliveryId), backoffDelay);
    }
  }

  // Emit webhook event to all matching endpoints
  async function emitWebhookEvent(
    orgId: string,
    eventType: string,
    payload: Record<string, unknown>
  ) {
    try {
      // Find all active endpoints that subscribe to this event
      const endpoints = await prisma.outgoingWebhookEndpoint.findMany({
        where: {
          orgId,
          active: true,
          events: { has: eventType },
        },
      });

      if (endpoints.length === 0) {
        console.log(`[WEBHOOK] No endpoints for org=${orgId} event=${eventType}`);
        return;
      }

      // Create delivery records for each endpoint
      for (const endpoint of endpoints) {
        const delivery = await prisma.outgoingWebhookDelivery.create({
          data: {
            orgId,
            endpointId: endpoint.id,
            eventType,
            payload: JSON.parse(JSON.stringify({
              event: eventType,
              timestamp: new Date().toISOString(),
              data: payload,
            })) as any,
            status: 'pending',
            attemptCount: 0,
          },
        });

        console.log(`[WEBHOOK] Created delivery ${delivery.id} for event ${eventType}`);

        // Attempt delivery immediately (async, non-blocking)
        setImmediate(() => attemptWebhookDelivery(delivery.id));
      }
    } catch (error) {
      console.error('[WEBHOOK] Error emitting event:', error);
    }
  }

  // ============================================
  // WEBHOOK ENDPOINTS CRUD
  // ============================================

  /**
   * @openapi
   * /v1/webhooks:
   *   get:
   *     summary: List webhook endpoints
   *     tags: [Webhooks]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of webhook endpoints
   *   post:
   *     summary: Create webhook endpoint
   *     tags: [Webhooks]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               url:
   *                 type: string
   *               events:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       201:
   *         description: Created webhook endpoint with secret
   * /v1/webhook-deliveries:
   *   get:
   *     summary: Get webhook delivery history
   *     tags: [Webhooks]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of webhook deliveries
   */
  // GET /v1/webhooks - List webhook endpoints
  app.get('/v1/webhooks', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const endpoints = await prisma.outgoingWebhookEndpoint.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          url: true,
          events: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          // Exclude secret from response for security
        },
      });
      res.json(endpoints);
    } catch (error) {
      console.error('List webhooks error:', error);
      res.status(500).json({ error: 'Failed to list webhooks' });
    }
  });

  // POST /v1/webhooks - Create webhook endpoint
  app.post('/v1/webhooks', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { url, events } = req.body;

      if (!url || !events || !Array.isArray(events)) {
        return res.status(400).json({ error: 'url and events array required' });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      // Generate secure random secret
      const secret = crypto.randomBytes(32).toString('hex');

      const endpoint = await prisma.outgoingWebhookEndpoint.create({
        data: {
          orgId,
          url,
          secret,
          events,
          active: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          orgId,
          actorUserId: req.user!.userId,
          actorType: 'user',
          action: 'webhook.create',
          entityType: 'webhook_endpoint',
          entityId: endpoint.id,
          details: { url, events },
        },
      });

      // Return endpoint with secret (only on creation)
      res.status(201).json({
        id: endpoint.id,
        url: endpoint.url,
        secret: endpoint.secret, // Only expose secret on creation
        events: endpoint.events,
        active: endpoint.active,
        createdAt: endpoint.createdAt,
      });
    } catch (error) {
      console.error('Create webhook error:', error);
      res.status(500).json({ error: 'Failed to create webhook' });
    }
  });

  // GET /v1/webhooks/:id - Get webhook endpoint (without secret)
  app.get('/v1/webhooks/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const endpoint = await prisma.outgoingWebhookEndpoint.findFirst({
        where: { id, orgId },
        select: {
          id: true,
          url: true,
          events: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!endpoint) {
        return res.status(404).json({ error: 'Webhook endpoint not found' });
      }

      res.json(endpoint);
    } catch (error) {
      console.error('Get webhook error:', error);
      res.status(500).json({ error: 'Failed to get webhook' });
    }
  });

  // PATCH /v1/webhooks/:id - Update webhook endpoint
  app.patch('/v1/webhooks/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;
      const { url, events, active } = req.body;

      const existing = await prisma.outgoingWebhookEndpoint.findFirst({
        where: { id, orgId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Webhook endpoint not found' });
      }

      const updateData: { url?: string; events?: string[]; active?: boolean } = {};
      if (url !== undefined) {
        try {
          new URL(url);
          updateData.url = url;
        } catch {
          return res.status(400).json({ error: 'Invalid URL format' });
        }
      }
      if (events !== undefined && Array.isArray(events)) updateData.events = events;
      if (active !== undefined) updateData.active = active;

      const endpoint = await prisma.outgoingWebhookEndpoint.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          url: true,
          events: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          orgId,
          actorUserId: req.user!.userId,
          actorType: 'user',
          action: 'webhook.update',
          entityType: 'webhook_endpoint',
          entityId: id,
          details: { changes: updateData },
        },
      });

      res.json(endpoint);
    } catch (error) {
      console.error('Update webhook error:', error);
      res.status(500).json({ error: 'Failed to update webhook' });
    }
  });

  // DELETE /v1/webhooks/:id - Delete webhook endpoint
  app.delete('/v1/webhooks/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const existing = await prisma.outgoingWebhookEndpoint.findFirst({
        where: { id, orgId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Webhook endpoint not found' });
      }

      await prisma.outgoingWebhookEndpoint.delete({ where: { id } });

      await prisma.auditLog.create({
        data: {
          orgId,
          actorUserId: req.user!.userId,
          actorType: 'user',
          action: 'webhook.delete',
          entityType: 'webhook_endpoint',
          entityId: id,
          details: { url: existing.url },
        },
      });

      res.status(204).send();
    } catch (error) {
      console.error('Delete webhook error:', error);
      res.status(500).json({ error: 'Failed to delete webhook' });
    }
  });

  // POST /v1/webhooks/:id/rotate-secret - Rotate webhook secret
  app.post(
    '/v1/webhooks/:id/rotate-secret',
    authMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const orgId = req.user!.orgId;
        const { id } = req.params;

        const existing = await prisma.outgoingWebhookEndpoint.findFirst({
          where: { id, orgId },
        });

        if (!existing) {
          return res.status(404).json({ error: 'Webhook endpoint not found' });
        }

        const newSecret = crypto.randomBytes(32).toString('hex');

        await prisma.outgoingWebhookEndpoint.update({
          where: { id },
          data: { secret: newSecret },
        });

        await prisma.auditLog.create({
          data: {
            orgId,
            actorUserId: req.user!.userId,
            actorType: 'user',
            action: 'webhook.rotate_secret',
            entityType: 'webhook_endpoint',
            entityId: id,
            details: { rotatedAt: new Date().toISOString() },
          },
        });

        res.json({ secret: newSecret });
      } catch (error) {
        console.error('Rotate webhook secret error:', error);
        res.status(500).json({ error: 'Failed to rotate secret' });
      }
    }
  );

  // GET /v1/webhooks/:id/deliveries - Get recent deliveries for an endpoint
  app.get('/v1/webhooks/:id/deliveries', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const endpoint = await prisma.outgoingWebhookEndpoint.findFirst({
        where: { id, orgId },
      });

      if (!endpoint) {
        return res.status(404).json({ error: 'Webhook endpoint not found' });
      }

      const deliveries = await prisma.outgoingWebhookDelivery.findMany({
        where: { endpointId: id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          eventType: true,
          status: true,
          attemptCount: true,
          lastAttemptAt: true,
          responseCode: true,
          createdAt: true,
        },
      });

      res.json(deliveries);
    } catch (error) {
      console.error('Get webhook deliveries error:', error);
      res.status(500).json({ error: 'Failed to get deliveries' });
    }
  });

  // GET /v1/webhook-deliveries - Get all recent deliveries for the org
  app.get('/v1/webhook-deliveries', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const deliveries = await prisma.outgoingWebhookDelivery.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          endpoint: {
            select: { url: true },
          },
        },
      });

      res.json(
        deliveries.map((d) => ({
          id: d.id,
          endpointId: d.endpointId,
          endpointUrl: d.endpoint.url,
          eventType: d.eventType,
          status: d.status,
          attemptCount: d.attemptCount,
          lastAttemptAt: d.lastAttemptAt,
          responseCode: d.responseCode,
          createdAt: d.createdAt,
        }))
      );
    } catch (error) {
      console.error('Get all deliveries error:', error);
      res.status(500).json({ error: 'Failed to get deliveries' });
    }
  });

  // POST /v1/webhooks/:id/test - Send a test webhook
  app.post('/v1/webhooks/:id/test', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const endpoint = await prisma.outgoingWebhookEndpoint.findFirst({
        where: { id, orgId },
      });

      if (!endpoint) {
        return res.status(404).json({ error: 'Webhook endpoint not found' });
      }

      // Create a test delivery
      const delivery = await prisma.outgoingWebhookDelivery.create({
        data: {
          orgId,
          endpointId: id,
          eventType: 'test.ping',
          payload: {
            event: 'test.ping',
            timestamp: new Date().toISOString(),
            data: { message: 'Test webhook from CaseCurrent' },
          },
          status: 'pending',
          attemptCount: 0,
        },
      });

      // Attempt delivery immediately
      await attemptWebhookDelivery(delivery.id);

      // Fetch updated delivery
      const result = await prisma.outgoingWebhookDelivery.findUnique({
        where: { id: delivery.id },
      });

      res.json({
        deliveryId: delivery.id,
        status: result?.status,
        responseCode: result?.responseCode,
        responseBody: result?.responseBody?.slice(0, 500),
      });
    } catch (error) {
      console.error('Test webhook error:', error);
      res.status(500).json({ error: 'Failed to test webhook' });
    }
  });

  // ============================================
  // CONTACTS ENDPOINTS
  // ============================================

  /**
   * @openapi
   * /v1/contacts:
   *   get:
   *     summary: List contacts with optional search
   *     tags: [Contacts]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: q
   *         in: query
   *         description: Search query (name, phone, email)
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of contacts
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ContactList'
   */
  app.get('/v1/contacts', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const q = req.query.q as string | undefined;

      const where: { orgId: string; OR?: Array<Record<string, unknown>> } = { orgId };
      if (q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { primaryPhone: { contains: q } },
          { primaryEmail: { contains: q, mode: 'insensitive' } },
        ];
      }

      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
        prisma.contact.count({ where }),
      ]);

      res.json({ contacts, total });
    } catch (error) {
      console.error('List contacts error:', error);
      res.status(500).json({ error: 'Failed to list contacts' });
    }
  });

  /**
   * @openapi
   * /v1/contacts:
   *   post:
   *     summary: Create a new contact (staff+ only)
   *     tags: [Contacts]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateContactRequest'
   *     responses:
   *       201:
   *         description: Contact created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Contact'
   *       403:
   *         description: Insufficient permissions
   */
  app.post(
    '/v1/contacts',
    authMiddleware,
    requireMinRole('staff'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const orgId = req.user!.orgId;
        const { name, primaryPhone, primaryEmail } = req.body;

        if (!name) {
          return res.status(400).json({ error: 'Name is required' });
        }

        const contact = await prisma.contact.create({
          data: {
            orgId,
            name,
            primaryPhone: primaryPhone || null,
            primaryEmail: primaryEmail || null,
          },
        });

        await createAuditLog(orgId, req.user!.userId, 'user', 'create', 'contact', contact.id, {
          name,
          timestamp: new Date().toISOString(),
        });

        await emitWebhookEvent(orgId, 'contact.created', { contactId: contact.id, name });

        res.status(201).json(contact);
      } catch (error) {
        console.error('Create contact error:', error);
        res.status(500).json({ error: 'Failed to create contact' });
      }
    }
  );

  /**
   * @openapi
   * /v1/contacts/{id}:
   *   get:
   *     summary: Get contact by ID
   *     tags: [Contacts]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Contact details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Contact'
   *       404:
   *         description: Contact not found
   */
  app.get('/v1/contacts/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const contact = await prisma.contact.findFirst({
        where: { id, orgId },
      });

      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      res.json(contact);
    } catch (error) {
      console.error('Get contact error:', error);
      res.status(500).json({ error: 'Failed to get contact' });
    }
  });

  /**
   * @openapi
   * /v1/contacts/{id}/leads:
   *   get:
   *     summary: Get leads for a contact
   *     tags: [Contacts]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Leads for the contact
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/LeadList'
   *       404:
   *         description: Contact not found
   */
  app.get('/v1/contacts/:id/leads', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const contact = await prisma.contact.findFirst({ where: { id, orgId } });
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const leads = await prisma.lead.findMany({
        where: { contactId: id, orgId },
        include: { contact: true, practiceArea: true },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ leads, total: leads.length });
    } catch (error) {
      console.error('Get contact leads error:', error);
      res.status(500).json({ error: 'Failed to get contact leads' });
    }
  });

  // ============================================
  // PRACTICE AREAS ENDPOINTS
  // ============================================

  /**
   * @openapi
   * /v1/practice-areas:
   *   get:
   *     summary: List practice areas
   *     tags: [Practice Areas]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of practice areas
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 practiceAreas:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       name:
   *                         type: string
   *                       active:
   *                         type: boolean
   */
  app.get('/v1/practice-areas', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;

      const practiceAreas = await prisma.practiceArea.findMany({
        where: { orgId, active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, active: true },
      });

      res.json({ practiceAreas });
    } catch (error) {
      console.error('List practice areas error:', error);
      res.status(500).json({ error: 'Failed to list practice areas' });
    }
  });

  // ============================================
  // LEADS ENDPOINTS
  // ============================================

  /**
   * @openapi
   * /v1/leads:
   *   get:
   *     summary: List leads with filters
   *     tags: [Leads]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: status
   *         in: query
   *         schema:
   *           type: string
   *       - name: priority
   *         in: query
   *         schema:
   *           type: string
   *       - name: practice_area_id
   *         in: query
   *         schema:
   *           type: string
   *       - name: q
   *         in: query
   *         description: Search query
   *         schema:
   *           type: string
   *       - name: from
   *         in: query
   *         description: From date (ISO)
   *         schema:
   *           type: string
   *           format: date-time
   *       - name: to
   *         in: query
   *         description: To date (ISO)
   *         schema:
   *           type: string
   *           format: date-time
   *     responses:
   *       200:
   *         description: List of leads
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/LeadList'
   */
  app.get('/v1/leads', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;

      // Defensive check: ensure orgId is present to prevent cross-tenant data leakage
      if (!orgId) {
        console.error('[LEADS_QUERY] CRITICAL: Missing orgId in authenticated request');
        return res.status(403).json({ error: 'Organization context required' });
      }

      const { status, priority, practice_area_id, q, from, to, limit, offset } = req.query;
      const take = Math.min(parseInt(limit as string) || 100, 100);
      const skip = parseInt(offset as string) || 0;

      const where: Record<string, unknown> = { orgId };

      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (practice_area_id) where.practiceAreaId = practice_area_id;

      if (from || to) {
        where.createdAt = {};
        if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from as string);
        if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to as string);
      }

      if (q) {
        where.OR = [
          { displayName: { contains: q, mode: 'insensitive' } },
          { summary: { contains: q, mode: 'insensitive' } },
          { incidentLocation: { contains: q, mode: 'insensitive' } },
          { contact: { is: { name: { contains: q, mode: 'insensitive' } } } },
        ];
      }

      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where,
          include: { contact: true, practiceArea: true },
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        prisma.lead.count({ where }),
      ]);

      // === [LEADS_QUERY] - Dashboard leads fetch logging ===
      console.log(JSON.stringify({
        event: 'api_fetch',
        endpoint: '/v1/leads',
        orgId,
        filters: { status: status || null, priority: priority || null, practiceAreaId: practice_area_id || null, q: q || null, from: from || null, to: to || null },
        limit: take,
        offset: skip,
        returnedCount: leads.length,
        total,
        newestLeadId: leads[0]?.id || null,
        newestLeadCreatedAt: leads[0]?.createdAt || null,
      }));

      res.json({ leads, total });
    } catch (error) {
      console.error('List leads error:', error);
      res.status(500).json({ error: 'Failed to list leads' });
    }
  });

  /**
   * @openapi
   * /v1/leads:
   *   post:
   *     summary: Create a new lead (staff+ only)
   *     tags: [Leads]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateLeadRequest'
   *     responses:
   *       201:
   *         description: Lead created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Lead'
   *       400:
   *         description: Validation error
   *       403:
   *         description: Insufficient permissions
   */
  app.post(
    '/v1/leads',
    authMiddleware,
    requireMinRole('staff'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const orgId = req.user!.orgId;

        // Defensive check: ensure orgId is present to prevent orphaned leads
        if (!orgId) {
          console.error('[LEAD_CREATE] CRITICAL: Missing orgId in authenticated request');
          return res.status(403).json({ error: 'Organization context required' });
        }

        const {
          contactId,
          contactName,
          contactPhone,
          contactEmail,
          source,
          status,
          priority,
          practiceAreaId,
          incidentDate,
          incidentLocation,
          summary,
        } = req.body;

        if (!source) {
          return res.status(400).json({ error: 'Source is required' });
        }

        let finalContactId = contactId;

        if (!contactId && contactName) {
          const newContact = await prisma.contact.create({
            data: {
              orgId,
              name: contactName,
              primaryPhone: contactPhone || null,
              primaryEmail: contactEmail || null,
            },
          });
          finalContactId = newContact.id;

          await createAuditLog(
            orgId,
            req.user!.userId,
            'user',
            'create',
            'contact',
            newContact.id,
            {
              name: contactName,
              createdViaLead: true,
              timestamp: new Date().toISOString(),
            }
          );
        }

        if (!finalContactId) {
          return res.status(400).json({ error: 'Either contactId or contactName is required' });
        }

        const existingContact = await prisma.contact.findFirst({
          where: { id: finalContactId, orgId },
        });

        if (!existingContact) {
          return res.status(400).json({ error: 'Contact not found in your organization' });
        }

        const lead = await prisma.lead.create({
          data: {
            orgId,
            contactId: finalContactId,
            source,
            status: status || 'new',
            priority: priority || 'medium',
            practiceAreaId: practiceAreaId || null,
            incidentDate: incidentDate ? new Date(incidentDate) : null,
            incidentLocation: incidentLocation || null,
            summary: summary || null,
          },
          include: { contact: true, practiceArea: true },
        });

        await createAuditLog(orgId, req.user!.userId, 'user', 'create', 'lead', lead.id, {
          source,
          contactId: finalContactId,
          timestamp: new Date().toISOString(),
        });

        await emitWebhookEvent(orgId, 'lead.created', {
          leadId: lead.id,
          contactId: finalContactId,
          source,
          status: lead.status,
        });

        // Auto-assign to running experiments
        await autoAssignExperiments(orgId, lead.id);

        res.status(201).json(lead);
      } catch (error) {
        console.error('Create lead error:', error);
        res.status(500).json({ error: 'Failed to create lead' });
      }
    }
  );

  /**
   * @openapi
   * /v1/leads/{id}:
   *   get:
   *     summary: Get lead by ID
   *     tags: [Leads]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Lead details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Lead'
   *       404:
   *         description: Lead not found
   */
  app.get('/v1/leads/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const lead = await prisma.lead.findFirst({
        where: { id, orgId },
        include: { contact: true, practiceArea: true },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      res.json(lead);
    } catch (error) {
      console.error('Get lead error:', error);
      res.status(500).json({ error: 'Failed to get lead' });
    }
  });

  // GET /v1/leads/:id/calls — all calls for a lead with full artifacts
  app.get('/v1/leads/:id/calls', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const lead = await prisma.lead.findFirst({
        where: { id, orgId },
        select: { id: true },
      });
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const calls = await prisma.call.findMany({
        where: { leadId: id, orgId },
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          direction: true,
          provider: true,
          callOutcome: true,
          endReason: true,
          startedAt: true,
          endedAt: true,
          durationSeconds: true,
          recordingUrl: true,
          transcriptText: true,
          transcriptJson: true,
          aiSummary: true,
          structuredData: true,
          successEvaluation: true,
          messagesJson: true,
          aiFlags: true,
          fromE164: true,
          toE164: true,
        },
      });

      res.json({ calls });
    } catch (error) {
      console.error('Get lead calls error:', error);
      res.status(500).json({ error: 'Failed to get lead calls' });
    }
  });

  /**
   * @openapi
   * /v1/leads/{id}:
   *   patch:
   *     summary: Update lead (staff+ only)
   *     tags: [Leads]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateLeadRequest'
   *     responses:
   *       200:
   *         description: Lead updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Lead'
   *       403:
   *         description: Insufficient permissions
   *       404:
   *         description: Lead not found
   */
  app.patch(
    '/v1/leads/:id',
    authMiddleware,
    requireMinRole('staff'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const orgId = req.user!.orgId;
        const { id } = req.params;
        const { status, priority, practiceAreaId, incidentDate, incidentLocation, summary } =
          req.body;

        const existingLead = await prisma.lead.findFirst({ where: { id, orgId } });
        if (!existingLead) {
          return res.status(404).json({ error: 'Lead not found' });
        }

        const updateData: Record<string, unknown> = {};
        if (status !== undefined) updateData.status = status;
        if (priority !== undefined) updateData.priority = priority;
        if (practiceAreaId !== undefined) updateData.practiceAreaId = practiceAreaId || null;
        if (incidentDate !== undefined)
          updateData.incidentDate = incidentDate ? new Date(incidentDate) : null;
        if (incidentLocation !== undefined) updateData.incidentLocation = incidentLocation || null;
        if (summary !== undefined) updateData.summary = summary || null;

        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }

        const lead = await prisma.lead.update({
          where: { id },
          data: updateData,
          include: { contact: true, practiceArea: true },
        });

        await createAuditLog(orgId, req.user!.userId, 'user', 'update', 'lead', id, {
          changes: updateData,
          timestamp: new Date().toISOString(),
        });

        await emitWebhookEvent(orgId, 'lead.updated', {
          leadId: id,
          changes: updateData,
        });

        res.json(lead);
      } catch (error) {
        console.error('Update lead error:', error);
        res.status(500).json({ error: 'Failed to update lead' });
      }
    }
  );

  // =============================================
  // MARKETING ENDPOINTS (PUBLIC)
  // =============================================

  // Simple rate limiting for contact form
  const contactSubmissions = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_MAX = 5;
  const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

  function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = contactSubmissions.get(ip);

    if (!record || record.resetAt < now) {
      contactSubmissions.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return true;
    }

    if (record.count >= RATE_LIMIT_MAX) {
      return false;
    }

    record.count++;
    return true;
  }

  /**
   * @openapi
   * /v1/marketing/contact:
   *   post:
   *     summary: Submit marketing contact form
   *     tags: [Marketing]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, email, message]
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *               firm:
   *                 type: string
   *               message:
   *                 type: string
   *     responses:
   *       201:
   *         description: Submission created
   *       429:
   *         description: Rate limited
   */
  app.post('/v1/marketing/contact', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      const { name, email, firm, message } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Name is required (min 2 characters)' });
      }
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required' });
      }
      if (!message || typeof message !== 'string' || message.trim().length < 10) {
        return res.status(400).json({ error: 'Message is required (min 10 characters)' });
      }

      const submission = await prisma.marketingContactSubmission.create({
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          firm: firm?.trim() || null,
          message: message.trim(),
          metadata: {
            ip: clientIp,
            userAgent: req.headers['user-agent'] || null,
            submittedAt: new Date().toISOString(),
          },
        },
      });

      // Note: Audit log skipped for public submissions since there's no org context
      // Submission metadata includes IP and timestamp for tracking purposes

      res.status(201).json({ success: true, id: submission.id });
    } catch (error) {
      console.error('Marketing contact submission error:', error);
      res.status(500).json({ error: 'Failed to submit contact form' });
    }
  });

  /**
   * @openapi
   * /v1/marketing/contact-submissions:
   *   get:
   *     summary: List marketing contact submissions (admin only)
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of submissions
   */
  app.get(
    '/v1/marketing/contact-submissions',
    authMiddleware,
    requireMinRole('admin'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const submissions = await prisma.marketingContactSubmission.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
        res.json({ submissions, total: submissions.length });
      } catch (error) {
        console.error('Fetch contact submissions error:', error);
        res.status(500).json({ error: 'Failed to fetch submissions' });
      }
    }
  );

  /**
   * @openapi
   * /v1/marketing/demo-request:
   *   post:
   *     summary: Submit demo request form
   *     tags: [Marketing]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, email]
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *               firm_name:
   *                 type: string
   *               phone:
   *                 type: string
   *               practice_area:
   *                 type: string
   *               current_intake_method:
   *                 type: string
   *               monthly_lead_volume:
   *                 type: string
   *               message:
   *                 type: string
   *     responses:
   *       201:
   *         description: Demo request created
   *       429:
   *         description: Rate limited
   */
  app.post('/v1/marketing/demo-request', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      const {
        name,
        email,
        firm_name,
        phone,
        practice_area,
        current_intake_method,
        monthly_lead_volume,
        message,
        website,
      } = req.body;

      // Honeypot check - reject if filled (bots fill this hidden field)
      if (website && typeof website === 'string' && website.trim().length > 0) {
        // Silently succeed to not reveal the honeypot
        return res.status(201).json({ success: true, id: 'honeypot' });
      }

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Name is required (min 2 characters)' });
      }
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required' });
      }

      const submission = await prisma.marketingSubmission.create({
        data: {
          type: 'demo',
          name: name.trim(),
          email: email.trim().toLowerCase(),
          firm: firm_name?.trim() || null,
          phone: phone?.trim() || null,
          practiceArea: practice_area || null,
          currentIntakeMethod: current_intake_method || null,
          monthlyLeadVolume: monthly_lead_volume || null,
          message: message?.trim() || null,
          metadata: {
            ip: clientIp,
            userAgent: req.headers['user-agent'] || null,
            submittedAt: new Date().toISOString(),
          },
        },
      });

      res.status(201).json({ success: true, id: submission.id });
    } catch (error) {
      console.error('Demo request submission error:', error);
      res.status(500).json({ error: 'Failed to submit demo request' });
    }
  });

  /**
   * @openapi
   * /v1/marketing/submissions:
   *   get:
   *     summary: List all marketing submissions (admin only)
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [contact, demo]
   *     responses:
   *       200:
   *         description: List of submissions
   */
  app.get(
    '/v1/marketing/submissions',
    authMiddleware,
    requireMinRole('admin'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { type } = req.query;

        const submissions = await prisma.marketingSubmission.findMany({
          where: type ? { type: type as string } : undefined,
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
        res.json({ submissions, total: submissions.length });
      } catch (error) {
        console.error('Fetch marketing submissions error:', error);
        res.status(500).json({ error: 'Failed to fetch submissions' });
      }
    }
  );

  // Root API info endpoint
  /**
   * @openapi
   * /api:
   *   get:
   *     summary: API info
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: API info
   */
  app.get('/api', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'CaseCurrent API',
      version: '1.0.0',
    });
  });

  // ============================================
  // PLATFORM ADMIN ROUTES
  // ============================================

  /**
   * @openapi
   * /v1/admin/orgs:
   *   get:
   *     summary: List all organizations (platform admin only)
   *     tags: [Platform Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of organizations
   */
  app.get(
    '/v1/admin/orgs',
    authMiddleware,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { search } = req.query;

        const orgs = await prisma.organization.findMany({
          where: search
            ? {
                OR: [
                  { name: { contains: search as string, mode: 'insensitive' } },
                  { slug: { contains: search as string, mode: 'insensitive' } },
                ],
              }
            : undefined,
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            _count: { select: { users: true, leads: true } },
          },
        });

        res.json({ organizations: orgs });
      } catch (error) {
        console.error('Admin list orgs error:', error);
        res.status(500).json({ error: 'Failed to list organizations' });
      }
    }
  );

  /**
   * @openapi
   * /v1/admin/orgs:
   *   post:
   *     summary: Create a new organization with owner (platform admin only)
   *     tags: [Platform Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       201:
   *         description: Organization created
   */
  app.post(
    '/v1/admin/orgs',
    authMiddleware,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const {
          orgName,
          slug: customSlug,
          timezone,
          planTier,
          subscriptionStatus,
          ownerName,
          ownerEmail,
          createInvite,
        } = req.body;

        if (!orgName || !ownerName || !ownerEmail) {
          return res.status(400).json({
            error: 'Required fields: orgName, ownerName, ownerEmail',
          });
        }

        const slug = customSlug || slugify(orgName);

        const existingOrg = await prisma.organization.findUnique({
          where: { slug },
        });
        if (existingOrg) {
          return res.status(400).json({ error: 'Organization slug already exists' });
        }

        const org = await prisma.organization.create({
          data: {
            name: orgName,
            slug,
            timezone: timezone || 'America/New_York',
            planTier: planTier || 'core',
            subscriptionStatus: subscriptionStatus || 'manual',
            onboardingStatus: 'not_started',
          },
        });

        await prisma.aiConfig.create({
          data: {
            orgId: org.id,
            voiceGreeting: 'Hello, thank you for calling. How may I assist you today?',
            disclaimerText: 'This call may be recorded for quality assurance purposes.',
            toneProfile: { style: 'professional' },
            handoffRules: { businessHours: { start: '09:00', end: '17:00' } },
          },
        });

        const defaultPracticeAreas = [
          'Personal Injury',
          'Criminal Defense',
          'Family Law',
          'Immigration',
        ];
        for (const paName of defaultPracticeAreas) {
          await prisma.practiceArea.create({
            data: { orgId: org.id, name: paName, active: false },
          });
        }

        let user = null;
        let invite = null;

        if (createInvite) {
          const token = generateInviteToken();
          invite = await prisma.userInvite.create({
            data: {
              orgId: org.id,
              email: ownerEmail.toLowerCase().trim(),
              role: 'owner',
              token,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
        } else {
          const tempPassword = generateInviteToken().substring(0, 16);
          const passwordHash = await hashPassword(tempPassword);
          user = await prisma.user.create({
            data: {
              orgId: org.id,
              email: ownerEmail.toLowerCase().trim(),
              name: ownerName,
              role: 'owner',
              passwordHash,
            },
          });
        }

        await createPlatformAdminAuditLog(
          org.id,
          req.user!.userId,
          'create_organization',
          'organization',
          org.id,
          { orgName, ownerEmail, createdInvite: !!createInvite }
        );

        res.status(201).json({
          organization: org,
          user: user ? { id: user.id, email: user.email } : null,
          invite: invite ? { id: invite.id, token: invite.token } : null,
        });
      } catch (error) {
        console.error('Admin create org error:', error);
        res.status(500).json({ error: 'Failed to create organization' });
      }
    }
  );

  /**
   * @openapi
   * /v1/admin/orgs/{id}:
   *   get:
   *     summary: Get organization details (platform admin only)
   *     tags: [Platform Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Organization details
   */
  app.get(
    '/v1/admin/orgs/:id',
    authMiddleware,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;

        const org = await prisma.organization.findUnique({
          where: { id },
          include: {
            users: { select: { id: true, email: true, name: true, role: true, status: true } },
            aiConfig: true,
            practiceAreas: true,
            phoneNumbers: true,
            _count: { select: { leads: true, calls: true, messages: true } },
          },
        });

        if (!org) {
          return res.status(404).json({ error: 'Organization not found' });
        }

        const recentHealth = await prisma.orgHealthSnapshot.findFirst({
          where: { orgId: id },
          orderBy: { snapshotAt: 'desc' },
        });

        res.json({ organization: org, health: recentHealth });
      } catch (error) {
        console.error('Admin get org error:', error);
        res.status(500).json({ error: 'Failed to get organization' });
      }
    }
  );

  /**
   * @openapi
   * /v1/admin/orgs/{id}/invites:
   *   post:
   *     summary: Create invite for organization (platform admin only)
   *     tags: [Platform Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       201:
   *         description: Invite created
   */
  app.post(
    '/v1/admin/orgs/:id/invites',
    authMiddleware,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        const { email, role } = req.body;

        if (!email) {
          return res.status(400).json({ error: 'Email required' });
        }

        const org = await prisma.organization.findUnique({ where: { id } });
        if (!org) {
          return res.status(404).json({ error: 'Organization not found' });
        }

        const token = generateInviteToken();
        const invite = await prisma.userInvite.create({
          data: {
            orgId: id,
            email: email.toLowerCase().trim(),
            role: role || 'owner',
            token,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });

        await createPlatformAdminAuditLog(
          id,
          req.user!.userId,
          'create_invite',
          'user_invite',
          invite.id,
          { email, role: role || 'owner' }
        );

        res
          .status(201)
          .json({ invite: { id: invite.id, token: invite.token, expiresAt: invite.expiresAt } });
      } catch (error) {
        console.error('Admin create invite error:', error);
        res.status(500).json({ error: 'Failed to create invite' });
      }
    }
  );

  /**
   * @openapi
   * /v1/admin/orgs/{id}/impersonate:
   *   post:
   *     summary: Generate impersonation token for organization (platform admin only)
   *     tags: [Platform Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Impersonation token
   */
  app.post(
    '/v1/admin/orgs/:id/impersonate',
    authMiddleware,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;

        const org = await prisma.organization.findUnique({ where: { id } });
        if (!org) {
          return res.status(404).json({ error: 'Organization not found' });
        }

        const token = generateImpersonationToken(req.user!.userId, req.user!.email, id);

        await createPlatformAdminAuditLog(
          id,
          req.user!.userId,
          'impersonate_org',
          'organization',
          id,
          { orgName: org.name }
        );

        res.json({
          token,
          organization: { id: org.id, name: org.name, slug: org.slug },
          expiresIn: '1h',
          warning: 'This is an impersonation token. All actions will be logged.',
        });
      } catch (error) {
        console.error('Admin impersonate error:', error);
        res.status(500).json({ error: 'Failed to create impersonation token' });
      }
    }
  );

  /**
   * @openapi
   * /v1/admin/orgs/{id}/health:
   *   post:
   *     summary: Compute and store org health snapshot (platform admin only)
   *     tags: [Platform Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Health snapshot
   */
  app.post(
    '/v1/admin/orgs/:id/health',
    authMiddleware,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;

        const org = await prisma.organization.findUnique({ where: { id } });
        if (!org) {
          return res.status(404).json({ error: 'Organization not found' });
        }

        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const [leads24h, calls24h, messages24h, webhookFailures24h] = await Promise.all([
          prisma.lead.count({ where: { orgId: id, createdAt: { gte: last24h } } }),
          prisma.call.count({ where: { orgId: id, createdAt: { gte: last24h } } }),
          prisma.message.count({ where: { orgId: id, createdAt: { gte: last24h } } }),
          prisma.outgoingWebhookDelivery.count({
            where: {
              orgId: id,
              createdAt: { gte: last24h },
              status: { in: ['failed', 'error'] },
            },
          }),
        ]);

        const metrics = {
          leads_24h: leads24h,
          calls_24h: calls24h,
          messages_24h: messages24h,
          webhook_failures_24h: webhookFailures24h,
          jobs_pending: 0,
          jobs_failed_24h: 0,
        };

        const snapshot = await prisma.orgHealthSnapshot.create({
          data: {
            orgId: id,
            snapshotAt: now,
            metrics,
          },
        });

        res.json({ snapshot });
      } catch (error) {
        console.error('Admin health snapshot error:', error);
        res.status(500).json({ error: 'Failed to compute health snapshot' });
      }
    }
  );

  /**
   * @openapi
   * /v1/admin/seed:
   *   post:
   *     summary: Seed demo organization and user (requires SEED_SECRET)
   *     tags: [Platform Admin]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - secret
   *             properties:
   *               secret:
   *                 type: string
   *                 description: The SEED_SECRET environment variable value
   *     responses:
   *       200:
   *         description: Seed completed successfully
   *       401:
   *         description: Invalid or missing secret
   */
  app.post('/v1/admin/seed', async (req, res) => {
    const host = (req.headers.host || '').split(':')[0];
    if (process.env.NODE_ENV !== 'development') return res.status(404).json({ error: 'Not found' });
    if (host !== '127.0.0.1' && host !== 'localhost') return res.status(404).json({ error: 'Not found' });

    try {
      const { secret } = req.body;
      const expectedSecret = process.env.SEED_SECRET;

      // Check if any organizations exist
      const orgCount = await prisma.organization.count();
      const isFirstTimeSetup = orgCount === 0;

      // If database already has data, require the secret
      if (!isFirstTimeSetup) {
        if (!expectedSecret) {
          return res.status(500).json({ error: 'SEED_SECRET not configured on server' });
        }

        if (!secret || secret !== expectedSecret) {
          // Check if demo org already exists - allow returning status without secret
          const existingOrg = await prisma.organization.findUnique({
            where: { slug: 'demo-law-firm' },
          });

          if (existingOrg) {
            const existingUser = await prisma.user.findFirst({
              where: { orgId: existingOrg.id, email: 'owner@demo.com' },
            });

            if (existingUser) {
              return res.json({
                message: 'Demo organization and user already exist',
                organization: {
                  id: existingOrg.id,
                  name: existingOrg.name,
                  slug: existingOrg.slug,
                },
                user: { email: existingUser.email, role: existingUser.role },
                alreadySeeded: true,
              });
            }
          }

          return res.status(401).json({ error: 'Invalid seed secret' });
        }
      }

      // Check if demo org already exists
      const existingOrg = await prisma.organization.findUnique({
        where: { slug: 'demo-law-firm' },
      });

      if (existingOrg) {
        // Check if demo user exists
        const existingUser = await prisma.user.findFirst({
          where: { orgId: existingOrg.id, email: 'owner@demo.com' },
        });

        if (existingUser) {
          return res.json({
            message: 'Demo organization and user already exist',
            organization: { id: existingOrg.id, name: existingOrg.name, slug: existingOrg.slug },
            user: { email: existingUser.email, role: existingUser.role },
            alreadySeeded: true,
          });
        }
      }

      // Create Organization
      const org = await prisma.organization.upsert({
        where: { slug: 'demo-law-firm' },
        update: {},
        create: {
          name: 'Demo Law Firm',
          slug: 'demo-law-firm',
          status: 'active',
          timezone: 'America/New_York',
        },
      });

      // Create Owner User
      const passwordHash = await hashPassword('DemoPass123!');
      const owner = await prisma.user.upsert({
        where: {
          orgId_email: {
            orgId: org.id,
            email: 'owner@demo.com',
          },
        },
        update: {},
        create: {
          orgId: org.id,
          email: 'owner@demo.com',
          name: 'Demo Owner',
          role: 'owner',
          status: 'active',
          passwordHash: passwordHash,
        },
      });

      // Create Practice Areas
      const practiceAreas = await Promise.all([
        prisma.practiceArea.upsert({
          where: { id: 'personal-injury-' + org.id },
          update: {},
          create: {
            id: 'personal-injury-' + org.id,
            orgId: org.id,
            name: 'Personal Injury',
            active: true,
          },
        }),
        prisma.practiceArea.upsert({
          where: { id: 'criminal-defense-' + org.id },
          update: {},
          create: {
            id: 'criminal-defense-' + org.id,
            orgId: org.id,
            name: 'Criminal Defense',
            active: true,
          },
        }),
      ]);

      // Create Intake Question Set
      await prisma.intakeQuestionSet.upsert({
        where: { id: 'default-intake-' + org.id },
        update: {},
        create: {
          id: 'default-intake-' + org.id,
          orgId: org.id,
          practiceAreaId: practiceAreas[0].id,
          name: 'Standard Personal Injury Intake',
          version: 1,
          active: true,
          schema: {
            version: '1.0',
            sections: [
              {
                id: 'contact_info',
                title: 'Contact Information',
                questions: [
                  { id: 'full_name', type: 'text', label: 'Full Legal Name', required: true },
                  { id: 'phone', type: 'phone', label: 'Best Phone Number', required: true },
                  { id: 'email', type: 'email', label: 'Email Address', required: false },
                ],
              },
              {
                id: 'incident_details',
                title: 'Incident Details',
                questions: [
                  {
                    id: 'incident_date',
                    type: 'date',
                    label: 'When did the incident occur?',
                    required: true,
                  },
                  {
                    id: 'incident_location',
                    type: 'text',
                    label: 'Where did the incident occur?',
                    required: true,
                  },
                  {
                    id: 'incident_description',
                    type: 'textarea',
                    label: 'Please describe what happened',
                    required: true,
                  },
                  {
                    id: 'injuries',
                    type: 'textarea',
                    label: 'What injuries did you sustain?',
                    required: true,
                  },
                  {
                    id: 'medical_treatment',
                    type: 'radio',
                    label: 'Have you sought medical treatment?',
                    required: true,
                    options: ['Yes', 'No', 'Planned'],
                  },
                ],
              },
            ],
          },
        },
      });

      // Create AI Config
      await prisma.aiConfig.upsert({
        where: { orgId: org.id },
        update: {},
        create: {
          orgId: org.id,
          voiceGreeting:
            "Thank you for calling Demo Law Firm. My name is Alex, and I'm an AI assistant here to help you with your legal matter.",
          disclaimerText:
            'Please note that I am an AI assistant and cannot provide legal advice. Our conversation will be recorded and reviewed by our legal team.',
          toneProfile: {
            style: 'professional',
            empathy_level: 'high',
            formality: 'moderate',
            pace: 'calm',
          },
          handoffRules: {
            emergency_keywords: ['emergency', 'danger', 'threat', 'hurt', 'police'],
            escalation_triggers: ['speak to attorney', 'talk to lawyer', 'human'],
            business_hours: {
              start: '09:00',
              end: '17:00',
              timezone: 'America/New_York',
              days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            },
          },
          qualificationRules: {
            min_score_for_accept: 70,
            min_score_for_review: 40,
            required_fields: ['incident_date', 'incident_location', 'injuries'],
            disqualifiers: ['statute_of_limitations_expired', 'no_injury', 'pre_existing_attorney'],
            scoring_weights: {
              injury_severity: 0.3,
              liability_clarity: 0.25,
              damages_potential: 0.25,
              urgency: 0.2,
            },
          },
        },
      });

      // Create Default Policy Test Suite
      await prisma.policyTestSuite.upsert({
        where: { id: 'default-policy-suite-' + org.id },
        update: {},
        create: {
          id: 'default-policy-suite-' + org.id,
          orgId: org.id,
          name: 'Qualification Regression Tests',
          description: 'Default suite to validate qualification scoring logic',
          active: true,
          testCases: [
            {
              id: 'tc1',
              name: 'Complete lead with phone+email accepts',
              input: {
                contact: { phone: '+15551234567', email: 'test@example.com' },
                practiceArea: true,
                intake: { complete: true },
                calls: 2,
              },
              expectedDisposition: 'accept',
              expectedMinScore: 70,
            },
            {
              id: 'tc2',
              name: 'Minimal info leads to review',
              input: {
                contact: { phone: '+15551234567' },
                practiceArea: false,
                intake: { complete: false },
                calls: 0,
              },
              expectedDisposition: 'review',
            },
            {
              id: 'tc3',
              name: 'No contact info declines',
              input: { contact: {}, practiceArea: false, intake: { complete: false }, calls: 0 },
              expectedDisposition: 'decline',
            },
            {
              id: 'tc4',
              name: 'Partial intake with practice area reviews',
              input: {
                contact: { email: 'partial@test.com' },
                practiceArea: true,
                intake: { complete: false },
                calls: 1,
              },
              expectedDisposition: 'review',
            },
            {
              id: 'tc5',
              name: 'Complete intake without calls accepts',
              input: {
                contact: { phone: '+15559876543', email: 'complete@test.com' },
                practiceArea: true,
                intake: { complete: true },
                calls: 0,
              },
              expectedDisposition: 'accept',
            },
            {
              id: 'tc6',
              name: 'High engagement with partial info reviews',
              input: {
                contact: { phone: '+15551112222' },
                practiceArea: true,
                intake: { complete: false },
                calls: 3,
              },
              expectedDisposition: 'review',
            },
          ],
        },
      });

      // Create Default Follow-up Sequence
      await prisma.followupSequence.upsert({
        where: { id: 'default-followup-' + org.id },
        update: {},
        create: {
          id: 'default-followup-' + org.id,
          orgId: org.id,
          name: 'New Lead Welcome Sequence',
          description: 'Automated follow-up for new leads',
          trigger: 'lead_created',
          active: true,
          steps: [
            {
              delayMinutes: 0,
              channel: 'sms',
              templateBody:
                'Thank you for contacting Demo Law Firm. We have received your inquiry and will be in touch shortly.',
            },
            {
              delayMinutes: 60,
              channel: 'sms',
              templateBody:
                'Hi! Just following up on your inquiry. Is there any additional information you can share about your situation?',
            },
            {
              delayMinutes: 1440,
              channel: 'sms',
              templateBody:
                'We wanted to make sure you received our messages. Our team is ready to help. Reply or call us at your convenience.',
            },
          ],
          stopRules: { onResponse: true, onStatusChange: ['disqualified', 'closed'] },
        },
      });

      console.log(`[SEED] Demo organization and user created: ${owner.email}`);

      res.json({
        message: 'Seed completed successfully',
        organization: { id: org.id, name: org.name, slug: org.slug },
        user: { email: owner.email, role: owner.role },
        credentials: {
          email: 'owner@demo.com',
          password: 'DemoPass123!',
        },
      });
    } catch (error) {
      console.error('Admin seed error:', error);
      res.status(500).json({ error: 'Failed to seed database' });
    }
  });

  /**
   * @openapi
   * /v1/admin/phone-numbers:
   *   post:
   *     summary: Create a phone number for an organization (Platform Admin only)
   *     tags: [Platform Admin]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - orgId
   *               - e164
   *             properties:
   *               orgId:
   *                 type: string
   *                 description: Organization ID
   *               e164:
   *                 type: string
   *                 description: Phone number in E.164 format (e.g., +15551234567)
   *               label:
   *                 type: string
   *                 description: Optional label for the phone number
   *               inboundEnabled:
   *                 type: boolean
   *                 default: true
   *               provider:
   *                 type: string
   *                 default: twilio
   *                 description: Telephony provider
   *     responses:
   *       201:
   *         description: Phone number created
   *       400:
   *         description: Validation error
   *       403:
   *         description: Insufficient permissions
   */
  app.post(
    '/v1/admin/phone-numbers',
    authMiddleware,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { orgId, e164, label, inboundEnabled = true, provider = 'twilio' } = req.body;

        if (!orgId || !e164) {
          return res.status(400).json({ error: 'orgId and e164 required' });
        }

        if (!/^\+[1-9]\d{6,14}$/.test(e164)) {
          return res
            .status(400)
            .json({ error: 'Invalid E.164 format. Must start with + followed by 7-15 digits' });
        }

        const org = await prisma.organization.findUnique({
          where: { id: orgId },
        });

        if (!org) {
          return res.status(404).json({ error: 'Organization not found' });
        }

        const existingPhone = await prisma.phoneNumber.findFirst({
          where: { e164 },
        });

        if (existingPhone) {
          return res
            .status(400)
            .json({ error: 'Phone number already registered', existingOrgId: existingPhone.orgId });
        }

        const phoneNumber = await prisma.phoneNumber.create({
          data: {
            orgId,
            e164,
            label: label || 'Inbound Line',
            provider,
            inboundEnabled,
          },
        });

        await createPlatformAdminAuditLog(
          req.user!.userId,
          'phone_number.create',
          'phone_number',
          phoneNumber.id,
          JSON.stringify({ orgId, e164: maskPhone(e164), label, inboundEnabled })
        );

        console.log(`[Admin] Created phone number ${maskPhone(e164)} for org ${orgId}`);

        res.status(201).json({
          id: phoneNumber.id,
          orgId: phoneNumber.orgId,
          e164: phoneNumber.e164,
          label: phoneNumber.label,
          provider: phoneNumber.provider,
          inboundEnabled: phoneNumber.inboundEnabled,
          createdAt: phoneNumber.createdAt,
        });
      } catch (error) {
        console.error('Admin create phone number error:', error);
        res.status(500).json({ error: 'Failed to create phone number' });
      }
    }
  );

  /**
   * @openapi
   * /v1/admin/phone-numbers:
   *   get:
   *     summary: List all phone numbers (Platform Admin only)
   *     tags: [Platform Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: orgId
   *         schema:
   *           type: string
   *         description: Filter by organization ID
   *     responses:
   *       200:
   *         description: List of phone numbers
   *       403:
   *         description: Insufficient permissions
   */
  app.get(
    '/v1/admin/phone-numbers',
    authMiddleware,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { orgId } = req.query;

        const phoneNumbers = await prisma.phoneNumber.findMany({
          where: orgId ? { orgId: String(orgId) } : undefined,
          include: {
            organization: {
              select: { id: true, name: true, slug: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        res.json(phoneNumbers);
      } catch (error) {
        console.error('Admin list phone numbers error:', error);
        res.status(500).json({ error: 'Failed to list phone numbers' });
      }
    }
  );

  /**
   * @openapi
   * /v1/admin/phone-numbers/{id}:
   *   patch:
   *     summary: Update a phone number (Platform Admin only)
   *     tags: [Platform Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               label:
   *                 type: string
   *               inboundEnabled:
   *                 type: boolean
   *               onCallUserId:
   *                 type: string
   *                 nullable: true
   *     responses:
   *       200:
   *         description: Phone number updated
   */
  app.patch(
    '/v1/admin/phone-numbers/:id',
    authMiddleware,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        const { label, inboundEnabled, onCallUserId } = req.body;

        const existing = await prisma.phoneNumber.findUnique({ where: { id } });
        if (!existing) {
          return res.status(404).json({ error: 'Phone number not found' });
        }

        // Validate onCallUserId if provided
        if (onCallUserId !== undefined && onCallUserId !== null) {
          const user = await prisma.user.findFirst({
            where: { id: onCallUserId, orgId: existing.orgId, status: 'active' },
          });
          if (!user) {
            return res.status(400).json({ error: 'On-call user not found or inactive in this org' });
          }
        }

        const updated = await prisma.phoneNumber.update({
          where: { id },
          data: {
            ...(label !== undefined && { label }),
            ...(inboundEnabled !== undefined && { inboundEnabled }),
            ...(onCallUserId !== undefined && { onCallUserId: onCallUserId || null }),
          },
        });

        await createPlatformAdminAuditLog(
          req.user!.userId,
          'phone_number.update',
          'phone_number',
          id,
          JSON.stringify({ label, inboundEnabled, onCallUserId })
        );

        res.json(updated);
      } catch (error) {
        console.error('Admin update phone number error:', error);
        res.status(500).json({ error: 'Failed to update phone number' });
      }
    }
  );

  /**
   * @openapi
   * /v1/phone-numbers:
   *   get:
   *     summary: List phone numbers for current org
   *     tags: [Telephony]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of phone numbers for the org
   */
  app.get('/v1/phone-numbers', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      const phoneNumbers = await prisma.phoneNumber.findMany({
        where: { orgId: user.orgId },
        select: {
          id: true,
          e164: true,
          label: true,
          provider: true,
          inboundEnabled: true,
          afterHoursEnabled: true,
          onCallUserId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(phoneNumbers);
    } catch (error) {
      console.error('List phone numbers error:', error);
      res.status(500).json({ error: 'Failed to list phone numbers' });
    }
  });

  // ============================================
  // INVITE ACCEPTANCE ROUTES (PUBLIC)
  // ============================================

  /**
   * @openapi
   * /v1/invites/{token}:
   *   get:
   *     summary: Get invite details by token
   *     tags: [Invites]
   *     responses:
   *       200:
   *         description: Invite details
   */
  app.get('/v1/invites/:token', async (req, res) => {
    try {
      const { token } = req.params;

      const invite = await prisma.userInvite.findUnique({
        where: { token },
        include: { organization: { select: { id: true, name: true, slug: true } } },
      });

      if (!invite) {
        return res.status(404).json({ error: 'Invite not found' });
      }

      if (invite.acceptedAt) {
        return res.status(400).json({ error: 'Invite already accepted' });
      }

      if (invite.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Invite has expired' });
      }

      res.json({
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expiresAt,
          organization: invite.organization,
        },
      });
    } catch (error) {
      console.error('Get invite error:', error);
      res.status(500).json({ error: 'Failed to get invite' });
    }
  });

  /**
   * @openapi
   * /v1/invites/{token}/accept:
   *   post:
   *     summary: Accept invite and create user
   *     tags: [Invites]
   *     responses:
   *       200:
   *         description: Invite accepted, user created
   */
  app.post('/v1/invites/:token/accept', async (req, res) => {
    try {
      const { token } = req.params;
      const { name, password } = req.body;

      if (!name || !password) {
        return res.status(400).json({ error: 'Name and password required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const invite = await prisma.userInvite.findUnique({
        where: { token },
        include: { organization: true },
      });

      if (!invite) {
        return res.status(404).json({ error: 'Invite not found' });
      }

      if (invite.acceptedAt) {
        return res.status(400).json({ error: 'Invite already accepted' });
      }

      if (invite.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Invite has expired' });
      }

      const existingUser = await prisma.user.findFirst({
        where: { orgId: invite.orgId, email: invite.email },
      });

      if (existingUser) {
        return res.status(400).json({ error: 'User already exists for this organization' });
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          orgId: invite.orgId,
          email: invite.email,
          name,
          role: invite.role,
          passwordHash,
          lastLoginAt: new Date(),
        },
      });

      await prisma.userInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      await createAuditLog(invite.orgId, user.id, 'user', 'accept_invite', 'user', user.id, {
        inviteId: invite.id,
      });

      const authToken = generateToken({
        userId: user.id,
        orgId: invite.orgId,
        email: user.email,
        role: user.role,
      });

      res.json({
        token: authToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        organization: {
          id: invite.organization.id,
          name: invite.organization.name,
          slug: invite.organization.slug,
          onboardingStatus: invite.organization.onboardingStatus,
        },
      });
    } catch (error) {
      console.error('Accept invite error:', error);
      res.status(500).json({ error: 'Failed to accept invite' });
    }
  });

  // ============================================
  // SETUP WIZARD ROUTES (AUTHENTICATED ORG OWNER/ADMIN)
  // ============================================

  /**
   * @openapi
   * /v1/setup/status:
   *   get:
   *     summary: Get setup wizard status
   *     tags: [Setup]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Setup status
   */
  app.get('/v1/setup/status', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: req.user!.orgId },
        include: {
          aiConfig: true,
          practiceAreas: true,
          phoneNumbers: true,
          intakeQuestionSets: true,
        },
      });

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      res.json({
        onboardingStatus: org.onboardingStatus,
        onboardingCompletedAt: org.onboardingCompletedAt,
        organization: org,
      });
    } catch (error) {
      console.error('Get setup status error:', error);
      res.status(500).json({ error: 'Failed to get setup status' });
    }
  });

  /**
   * @openapi
   * /v1/setup/basics:
   *   patch:
   *     summary: Update firm basics (step 1)
   *     tags: [Setup]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Basics updated
   */
  app.patch(
    '/v1/setup/basics',
    authMiddleware,
    requireMinRole('admin'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { name, timezone } = req.body;
        const orgId = req.user!.orgId;

        const updateData: Record<string, unknown> = {};
        if (name) updateData.name = name;
        if (timezone) updateData.timezone = timezone;
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: 'No fields to update' });
        }

        await prisma.organization.update({
          where: { id: orgId },
          data: {
            ...updateData,
            onboardingStatus: 'in_progress',
          },
        });

        await createAuditLog(
          orgId,
          req.user!.userId,
          'user',
          'update_basics',
          'organization',
          orgId,
          updateData
        );

        res.json({ success: true });
      } catch (error) {
        console.error('Update basics error:', error);
        res.status(500).json({ error: 'Failed to update basics' });
      }
    }
  );

  /**
   * @openapi
   * /v1/setup/business-hours:
   *   patch:
   *     summary: Update business hours (step 2)
   *     tags: [Setup]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Business hours updated
   */
  app.patch(
    '/v1/setup/business-hours',
    authMiddleware,
    requireMinRole('admin'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { businessHours, afterHoursBehavior } = req.body;
        const orgId = req.user!.orgId;

        await prisma.aiConfig.upsert({
          where: { orgId },
          update: {
            handoffRules: { businessHours, afterHoursBehavior },
          },
          create: {
            orgId,
            handoffRules: { businessHours, afterHoursBehavior },
          },
        });

        await prisma.organization.update({
          where: { id: orgId },
          data: { onboardingStatus: 'in_progress' },
        });

        await createAuditLog(
          orgId,
          req.user!.userId,
          'user',
          'update_business_hours',
          'ai_config',
          orgId,
          { businessHours }
        );

        res.json({ success: true });
      } catch (error) {
        console.error('Update business hours error:', error);
        res.status(500).json({ error: 'Failed to update business hours' });
      }
    }
  );

  /**
   * @openapi
   * /v1/setup/practice-areas:
   *   patch:
   *     summary: Update practice areas (step 3)
   *     tags: [Setup]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Practice areas updated
   */
  app.patch(
    '/v1/setup/practice-areas',
    authMiddleware,
    requireMinRole('admin'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { practiceAreas } = req.body;
        const orgId = req.user!.orgId;

        if (!practiceAreas || !Array.isArray(practiceAreas)) {
          return res.status(400).json({ error: 'practiceAreas array required' });
        }

        for (const pa of practiceAreas) {
          if (pa.id) {
            await prisma.practiceArea.update({
              where: { id: pa.id },
              data: { active: pa.active },
            });
          }
        }

        await prisma.organization.update({
          where: { id: orgId },
          data: { onboardingStatus: 'in_progress' },
        });

        await createAuditLog(
          orgId,
          req.user!.userId,
          'user',
          'update_practice_areas',
          'organization',
          orgId,
          { count: practiceAreas.length }
        );

        res.json({ success: true });
      } catch (error) {
        console.error('Update practice areas error:', error);
        res.status(500).json({ error: 'Failed to update practice areas' });
      }
    }
  );

  /**
   * @openapi
   * /v1/setup/phone-numbers:
   *   post:
   *     summary: Add phone number (step 4)
   *     tags: [Setup]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       201:
   *         description: Phone number added
   */
  app.post(
    '/v1/setup/phone-numbers',
    authMiddleware,
    requireMinRole('admin'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { label, e164, afterHoursEnabled, routing, isPrimary } = req.body;
        const orgId = req.user!.orgId;

        if (!label || !e164) {
          return res.status(400).json({ error: 'Label and e164 required' });
        }

        const e164Regex = /^\+[1-9]\d{1,14}$/;
        if (!e164Regex.test(e164)) {
          return res.status(400).json({ error: 'Invalid E.164 phone number format' });
        }

        const existingPhone = await prisma.phoneNumber.findUnique({ where: { e164 } });
        if (existingPhone) {
          return res.status(400).json({ error: 'Phone number already registered' });
        }

        const phone = await prisma.phoneNumber.create({
          data: {
            orgId,
            label,
            e164,
            provider: 'manual',
            afterHoursEnabled: afterHoursEnabled || false,
            routing: routing || {},
          },
        });

        if (isPrimary) {
          await prisma.organization.update({
            where: { id: orgId },
            data: { primaryPhoneNumberId: phone.id, onboardingStatus: 'in_progress' },
          });
        }

        await createAuditLog(
          orgId,
          req.user!.userId,
          'user',
          'add_phone_number',
          'phone_number',
          phone.id,
          { label, e164 }
        );

        res.status(201).json({ phoneNumber: phone });
      } catch (error) {
        console.error('Add phone number error:', error);
        res.status(500).json({ error: 'Failed to add phone number' });
      }
    }
  );

  /**
   * @openapi
   * /v1/setup/ai-config:
   *   patch:
   *     summary: Update AI voice config (step 5)
   *     tags: [Setup]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: AI config updated
   */
  app.patch(
    '/v1/setup/ai-config',
    authMiddleware,
    requireMinRole('admin'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { voiceGreeting, disclaimerText, toneProfile } = req.body;
        const orgId = req.user!.orgId;

        await prisma.aiConfig.upsert({
          where: { orgId },
          update: {
            voiceGreeting,
            disclaimerText,
            toneProfile,
          },
          create: {
            orgId,
            voiceGreeting,
            disclaimerText,
            toneProfile,
          },
        });

        await prisma.organization.update({
          where: { id: orgId },
          data: { onboardingStatus: 'in_progress' },
        });

        await createAuditLog(
          orgId,
          req.user!.userId,
          'user',
          'update_ai_config',
          'ai_config',
          orgId,
          {}
        );

        res.json({ success: true });
      } catch (error) {
        console.error('Update AI config error:', error);
        res.status(500).json({ error: 'Failed to update AI config' });
      }
    }
  );

  /**
   * @openapi
   * /v1/setup/intake-logic:
   *   patch:
   *     summary: Update intake question sets (step 6)
   *     tags: [Setup]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Intake logic updated
   */
  app.patch(
    '/v1/setup/intake-logic',
    authMiddleware,
    requireMinRole('admin'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { questionSets } = req.body;
        const orgId = req.user!.orgId;

        if (!questionSets || !Array.isArray(questionSets)) {
          return res.status(400).json({ error: 'questionSets array required' });
        }

        for (const qs of questionSets) {
          if (qs.schema) {
            try {
              if (typeof qs.schema === 'string') {
                JSON.parse(qs.schema);
              }
            } catch {
              return res.status(400).json({ error: 'Invalid JSON in question set schema' });
            }
          }

          if (qs.id) {
            await prisma.intakeQuestionSet.update({
              where: { id: qs.id },
              data: {
                active: qs.active,
                schema: typeof qs.schema === 'string' ? JSON.parse(qs.schema) : qs.schema,
              },
            });
          } else if (qs.name && qs.practiceAreaId) {
            await prisma.intakeQuestionSet.create({
              data: {
                orgId,
                practiceAreaId: qs.practiceAreaId,
                name: qs.name,
                schema: typeof qs.schema === 'string' ? JSON.parse(qs.schema) : qs.schema || {},
                active: qs.active !== false,
              },
            });
          }
        }

        await prisma.organization.update({
          where: { id: orgId },
          data: { onboardingStatus: 'in_progress' },
        });

        await createAuditLog(
          orgId,
          req.user!.userId,
          'user',
          'update_intake_logic',
          'intake_question_set',
          orgId,
          {}
        );

        res.json({ success: true });
      } catch (error) {
        console.error('Update intake logic error:', error);
        res.status(500).json({ error: 'Failed to update intake logic' });
      }
    }
  );

  /**
   * @openapi
   * /v1/setup/follow-up:
   *   patch:
   *     summary: Update follow-up config (step 7)
   *     tags: [Setup]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Follow-up config updated
   */
  app.patch(
    '/v1/setup/follow-up',
    authMiddleware,
    requireMinRole('admin'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { followUpConfig } = req.body;
        const orgId = req.user!.orgId;

        await prisma.aiConfig.upsert({
          where: { orgId },
          update: {
            qualificationRules: { followUp: followUpConfig },
          },
          create: {
            orgId,
            qualificationRules: { followUp: followUpConfig },
          },
        });

        await prisma.organization.update({
          where: { id: orgId },
          data: { onboardingStatus: 'in_progress' },
        });

        await createAuditLog(
          orgId,
          req.user!.userId,
          'user',
          'update_follow_up',
          'ai_config',
          orgId,
          {}
        );

        res.json({ success: true });
      } catch (error) {
        console.error('Update follow-up error:', error);
        res.status(500).json({ error: 'Failed to update follow-up config' });
      }
    }
  );

  /**
   * @openapi
   * /v1/setup/complete:
   *   post:
   *     summary: Mark setup as complete (step 8)
   *     tags: [Setup]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Setup completed
   */
  app.post(
    '/v1/setup/complete',
    authMiddleware,
    requireMinRole('admin'),
    async (req: AuthenticatedRequest, res) => {
      try {
        const orgId = req.user!.orgId;

        await prisma.organization.update({
          where: { id: orgId },
          data: {
            onboardingStatus: 'complete',
            onboardingCompletedAt: new Date(),
          },
        });

        await createAuditLog(
          orgId,
          req.user!.userId,
          'user',
          'complete_onboarding',
          'organization',
          orgId,
          {}
        );

        res.json({ success: true, message: 'Onboarding completed successfully' });
      } catch (error) {
        console.error('Complete setup error:', error);
        res.status(500).json({ error: 'Failed to complete setup' });
      }
    }
  );

  /**
   * @openapi
   * /v1/auth/me:
   *   get:
   *     summary: Get current user info
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Current user info
   */
  app.get('/v1/auth/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: { organization: true },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
          onboardingStatus: user.organization.onboardingStatus,
        },
        isPlatformAdmin: isPlatformAdmin(user.email),
        isImpersonating: req.user?.isImpersonating || false,
      });
    } catch (error) {
      console.error('Get me error:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  });

  // ============================================
  // INTERACTIONS ROUTES
  // ============================================

  /**
   * @openapi
   * /v1/interactions:
   *   post:
   *     summary: Create a new interaction (for testing)
   *     tags: [Interactions]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       201:
   *         description: Interaction created
   */
  app.post('/v1/interactions', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { leadId, channel, metadata } = req.body;
      const orgId = req.user!.orgId;

      if (!leadId || !channel) {
        return res.status(400).json({ error: 'leadId and channel are required' });
      }

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, orgId },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const interaction = await prisma.interaction.create({
        data: {
          orgId,
          leadId,
          channel,
          status: 'active',
          metadata: metadata || {},
        },
      });

      await createAuditLog(
        orgId,
        req.user!.userId,
        'user',
        'create_interaction',
        'interaction',
        interaction.id,
        { channel }
      );

      res.status(201).json(interaction);
    } catch (error) {
      console.error('Create interaction error:', error);
      res.status(500).json({ error: 'Failed to create interaction' });
    }
  });

  /**
   * @openapi
   * /v1/leads/{id}/interactions:
   *   get:
   *     summary: Get interactions for a lead
   *     tags: [Leads]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of interactions
   */
  app.get('/v1/leads/:id/interactions', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const orgId = req.user!.orgId;

      const lead = await prisma.lead.findFirst({
        where: { id, orgId },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const interactions = await prisma.interaction.findMany({
        where: { leadId: id, orgId },
        include: {
          call: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { startedAt: 'desc' },
      });

      res.json(interactions);
    } catch (error) {
      console.error('Get lead interactions error:', error);
      res.status(500).json({ error: 'Failed to get interactions' });
    }
  });

  // ============================================
  // BOOTSTRAP - ONE-TIME PHONE NUMBER SETUP
  // ============================================

  /**
   * Bootstrap endpoint to ensure phone number exists in production
   * Protected by SEED_SECRET to prevent unauthorized access
   */
  app.post('/v1/bootstrap/phone-number', async (req, res) => {
    try {
      const { secret, orgId, orgName, orgSlug, e164, label, provider } = req.body;

      // Validate secret
      if (secret !== process.env.SEED_SECRET) {
        return res.status(401).json({ error: 'Invalid secret' });
      }

      // Ensure organization exists (create if not, or find by slug)
      let org = await prisma.organization.findUnique({
        where: { id: orgId },
      });

      // If org not found by ID, try to find by slug
      if (!org && orgSlug) {
        org = await prisma.organization.findUnique({
          where: { slug: orgSlug },
        });
        if (org) {
          console.log(`[Bootstrap] Found existing org by slug "${orgSlug}": ${org.id}`);
        }
      }

      // Create org if still not found
      if (!org && orgName && orgSlug) {
        org = await prisma.organization.create({
          data: {
            id: orgId,
            name: orgName,
            slug: orgSlug,
          },
        });
        console.log(`[Bootstrap] Created organization: ${orgName} (${orgId})`);
      }

      if (!org) {
        return res
          .status(400)
          .json({ error: 'Organization not found. Provide orgName and orgSlug to create.' });
      }

      // Use the actual org ID (may differ from provided if found by slug)
      const actualOrgId = org.id;

      // Check if phone number already exists
      const existing = await prisma.phoneNumber.findFirst({
        where: { e164 },
      });

      if (existing) {
        // Update if needed
        const updated = await prisma.phoneNumber.update({
          where: { id: existing.id },
          data: {
            orgId: actualOrgId,
            inboundEnabled: true,
            label: label || existing.label,
            provider: provider || existing.provider,
          },
        });
        console.log(`[Bootstrap] Updated phone number ${maskPhone(e164)} for org ${actualOrgId}`);
        return res.json({
          action: 'updated',
          id: updated.id,
          e164: updated.e164,
          orgId: actualOrgId,
          orgCreated: false,
        });
      }

      // Create new phone number
      const created = await prisma.phoneNumber.create({
        data: {
          orgId: actualOrgId,
          e164,
          label: label || 'Inbound Line',
          provider: provider || 'twilio',
          inboundEnabled: true,
        },
      });
      console.log(`[Bootstrap] Created phone number ${maskPhone(e164)} for org ${actualOrgId}`);
      return res.json({
        action: 'created',
        id: created.id,
        e164: created.e164,
        orgId: actualOrgId,
      });
    } catch (error: any) {
      console.error('[Bootstrap] Error:', error?.message || error);
      res.status(500).json({ error: 'Bootstrap failed', details: error?.message });
    }
  });

  // ============================================
  // TELEPHONY - OPENAI REALTIME WEBHOOK
  // ============================================

  /**
   * @openapi
   * /v1/telephony/openai/webhook:
   *   post:
   *     summary: Handle OpenAI Realtime call webhooks
   *     tags: [Telephony]
   *     description: Receives events from OpenAI when realtime calls come in via SIP
   *     responses:
   *       200:
   *         description: Webhook acknowledged
   *       401:
   *         description: Invalid signature
   */
  app.post('/v1/telephony/openai/webhook', async (req, res) => {
    await handleOpenAIWebhook(req, res);
  });

  // ============================================
  // TELEPHONY - ELEVENLABS WEBHOOKS
  // ============================================

  /**
   * @openapi
   * /v1/webhooks/elevenlabs/inbound:
   *   post:
   *     summary: Handle ElevenLabs inbound call webhook
   *     tags: [Telephony]
   *     description: Creates Lead/Call records when ElevenLabs agent receives a call
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               caller_id:
   *                 type: string
   *               called_number:
   *                 type: string
   *               call_sid:
   *                 type: string
   *               conversation_id:
   *                 type: string
   *     responses:
   *       200:
   *         description: Call/Lead created successfully
   *       400:
   *         description: Invalid request
   *       404:
   *         description: No firm found for called_number
   *
   * /v1/webhooks/elevenlabs/post-call:
   *   post:
   *     summary: Handle ElevenLabs post-call webhook
   *     tags: [Telephony]
   *     description: Updates Lead with extracted intake data and call metadata
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               conversation_id:
   *                 type: string
   *               duration_seconds:
   *                 type: integer
   *               transcript:
   *                 type: string
   *               extracted_data:
   *                 type: object
   *     responses:
   *       200:
   *         description: Lead/Call updated successfully
   *       404:
   *         description: Call not found
   */
  app.use('/v1/webhooks/elevenlabs', createElevenLabsWebhookRouter(prisma));

  /**
   * @openapi
   * /v1/webhooks/vapi/health:
   *   get:
   *     summary: Vapi webhook health check
   *     tags: [Telephony]
   *     responses:
   *       200:
   *         description: Health check response
   *
   * /v1/webhooks/vapi:
   *   post:
   *     summary: Handle Vapi server messages (assistant-request, tool-calls, status-update, etc.)
   *     tags: [Telephony]
   *     description: >
   *       Routes assistant-request to business/after-hours assistant,
   *       returns tool-call results immediately, and ingests
   *       end-of-call-report + transcript into Call/Lead/Intake records
   *       so calls appear in the dashboard.
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               message:
   *                 type: object
   *                 properties:
   *                   type:
   *                     type: string
   *                     enum: [assistant-request, tool-calls, status-update, transcript, end-of-call-report]
   *     responses:
   *       200:
   *         description: Event processed successfully
   *       400:
   *         description: Missing message.type
   *       403:
   *         description: Invalid webhook secret
   */
  app.use('/v1/webhooks/vapi', createVapiWebhookRouter(prisma));

  // ============================================
  // ROUTE MODULES (mounted routers)
  // ============================================
  app.use(aiRouter);
  app.use(summaryRouter);
  app.use(transcriptRouter);
  app.use(analyticsTrendsRouter);
  app.use(callDebugRouter);
  app.use(ingestionOutcomesRouter);

  // ============================================
  // TELEPHONY - TWILIO WEBHOOKS
  // ============================================

  /**
   * @openapi
   * /v1/telephony/twilio/voice:
   *   post:
   *     summary: Handle incoming Twilio voice call webhook
   *     tags: [Telephony]
   *     description: Routes inbound calls to OpenAI Realtime via SIP, or fallback to voicemail
   *     responses:
   *       200:
   *         description: TwiML response
   */
  app.post('/v1/telephony/twilio/voice', async (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const startTime = Date.now();

    try {
      const payload = req.body;
      const { CallSid, From, To, CallStatus, Direction, CallerName } = payload;

      // === [INBOUND] - Immediate top-of-handler logging ===
      console.log(`[INBOUND] callSid=${CallSid || 'UNKNOWN'} from=${maskPhone(From || '')} to=${To || ''} direction=${Direction || 'inbound'} timestamp=${new Date().toISOString()}`);

      recordEvent({
        source: 'twilio-voice-webhook',
        requestId,
        callSid: CallSid,
        e164: To,
        summary: `Inbound call from ${From} to ${To}`,
        payload: {
          CallSid,
          From,
          To,
          CallStatus,
          Direction,
          method: req.method,
          url: req.originalUrl,
          contentType: req.headers['content-type'],
        },
      });

      // === [ENV] - Environment identifiers ===
      const nodeEnv = process.env.NODE_ENV || 'undefined';
      const replSlug = process.env.REPL_SLUG || process.env.REPL_ID || null;
      const railwaySha = process.env.RAILWAY_GIT_COMMIT_SHA || null;
      const appBaseUrl = process.env.APP_BASE_URL || process.env.REPLIT_DEV_DOMAIN || 'unknown';
      console.log(`[ENV] NODE_ENV=${nodeEnv} REPL=${replSlug || 'N/A'} RAILWAY=${railwaySha ? railwaySha.slice(0, 7) : 'N/A'} baseUrl=${appBaseUrl}`);

      // === [DB] - Database identity (NO password) ===
      let dbHost = 'unknown';
      let dbName = 'unknown';
      let dbSchema = 'public';
      const urlMatch = DATABASE_URL.match(/@([^:/]+)(?::(\d+))?\/([^?]+)/);
      if (urlMatch) {
        dbHost = urlMatch[1];
        dbName = urlMatch[3];
      }
      const schemaMatch = DATABASE_URL.match(/[?&]schema=([^&]+)/);
      if (schemaMatch) {
        dbSchema = schemaMatch[1];
      }
      // Get phone_numbers count at request time
      const phoneCount = await prisma.phoneNumber.count();
      console.log(`[DB] host=${dbHost} db=${dbName} schema=${dbSchema} phoneNumbersCount=${phoneCount}`);

      if (!CallSid || !From || !To) {
        console.log(`[Twilio Voice] [${requestId}] ERROR: Missing required params`);
        res.set('Content-Type', 'text/xml');
        return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Missing required call information.</Say>
  <Hangup/>
</Response>`);
      }

      // IDEMPOTENCY: Check if call already exists by twilioCallSid
      const existingCall = await prisma.call.findUnique({
        where: { twilioCallSid: CallSid },
      });

      if (existingCall) {
        console.log(`[Twilio Voice] [${requestId}] Duplicate webhook, returning cached TwiML`);
        res.set('Content-Type', 'text/xml');
        return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for calling. Please hold while we connect you.</Say>
  <Pause length="2"/>
</Response>`);
      }

      // === [NORMALIZED] - Normalize To and From values to E.164 ===
      const rawTo = To || '';
      const rawFrom = From || '';
      let normalizedTo = rawTo.trim();

      // Handle sip: URI format (e.g., sip:+18443214257@...)
      if (normalizedTo.toLowerCase().startsWith('sip:')) {
        const sipMatch = normalizedTo.match(/^sip:([^@]+)@/i);
        if (sipMatch) {
          normalizedTo = sipMatch[1];
        }
      }

      const digitsOnlyTo = normalizedTo.replace(/\D/g, '');

      // Normalize From to E.164
      let normalizedFrom = rawFrom.trim();
      const digitsOnlyFrom = normalizedFrom.replace(/\D/g, '');
      if (digitsOnlyFrom.length === 10) {
        normalizedFrom = '+1' + digitsOnlyFrom;
      } else if (digitsOnlyFrom.length === 11 && digitsOnlyFrom.startsWith('1')) {
        normalizedFrom = '+' + digitsOnlyFrom;
      } else if (!normalizedFrom.startsWith('+') && digitsOnlyFrom.length > 0) {
        normalizedFrom = '+' + digitsOnlyFrom;
      }

      // Build candidate list for To
      const candidates: string[] = [];

      // a) exact trimmed (after sip extraction)
      if (normalizedTo) candidates.push(normalizedTo);

      // b) "+" + digitsOnly
      if (digitsOnlyTo) candidates.push('+' + digitsOnlyTo);

      // c) "+1" + digitsOnly (if 10 digits - US number without country code)
      if (digitsOnlyTo.length === 10) candidates.push('+1' + digitsOnlyTo);

      // De-dupe candidates
      const uniqueCandidates = [...new Set(candidates.filter((c) => c && c.length > 0))];

      // Best normalized E.164 for To
      const normalizedToE164 = uniqueCandidates.find(c => c.startsWith('+')) || uniqueCandidates[0] || rawTo;
      
      console.log(`[NORMALIZED] from=${maskPhone(normalizedFrom)} to=${normalizedToE164} candidates=${uniqueCandidates.length}`);

      // === SINGLE LOOKUP WITH ALL CANDIDATES ===
      const phoneNumber = await prisma.phoneNumber.findFirst({
        where: {
          inboundEnabled: true,
          e164: { in: uniqueCandidates },
        },
        include: { organization: true },
      });

      if (!phoneNumber) {
        // === [TENANT_MISS] - Phone number not found ===
        console.log(`[TENANT_MISS] to=${normalizedToE164} candidates=${uniqueCandidates.join(',')}`);

        // Log top 5 phone_numbers rows (masked) for debugging
        const topPhones = await prisma.phoneNumber.findMany({
          take: 5,
          select: { e164: true, orgId: true, inboundEnabled: true },
        });
        console.log(`[TENANT_MISS] Top 5 DB rows: ${topPhones.map(pn => `****${pn.e164.slice(-4)}(org=${pn.orgId.slice(0,8)},enabled=${pn.inboundEnabled})`).join(', ')}`);

        res.set('Content-Type', 'text/xml');
        return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>This number is not currently configured. Please try again later.</Say>
  <Hangup/>
</Response>`);
      }

      // === [TENANT_HIT] - Phone number found, org resolved ===
      console.log(`[TENANT_HIT] phoneNumberId=${phoneNumber.id} orgId=${phoneNumber.orgId} e164=****${phoneNumber.e164.slice(-4)}`);

      const orgId = phoneNumber.orgId;

      let contact = await prisma.contact.findFirst({
        where: { orgId, primaryPhone: From },
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            orgId,
            name: CallerName || 'Unknown Caller',
            primaryPhone: From,
          },
        });
      }

      let lead = await prisma.lead.findFirst({
        where: {
          orgId,
          contactId: contact.id,
          status: { in: ['new', 'in_progress'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (lead) {
        // === [LEAD_EXISTS] - Existing lead found for this contact ===
        console.log(`[LEAD_EXISTS] leadId=${lead.id} orgId=${orgId} contactId=${contact.id} callSid=${CallSid}`);
      } else {
        // Create new lead
        lead = await prisma.lead.create({
          data: {
            orgId,
            contactId: contact.id,
            source: 'phone',
            status: 'new',
            priority: 'medium',
          },
        });
        // === [LEAD_CREATED] - New lead created ===
        console.log(`[LEAD_CREATED] leadId=${lead.id} orgId=${orgId} contactId=${contact.id} callSid=${CallSid}`);
      }

      const interaction = await prisma.interaction.create({
        data: {
          orgId,
          leadId: lead.id,
          channel: 'call',
          status: 'active',
          metadata: payload,
        },
      });

      console.log(JSON.stringify({ event: 'db_write_attempt', model: 'Call', traceId: CallSid, orgId, leadId: lead.id }));
      let call;
      try {
        call = await prisma.call.create({
          data: {
            orgId,
            leadId: lead.id,
            interactionId: interaction.id,
            phoneNumberId: phoneNumber.id,
            direction: Direction?.toLowerCase() === 'outbound-api' ? 'outbound' : 'inbound',
            provider: 'twilio',
            twilioCallSid: CallSid,
            fromE164: From,
            toE164: To,
            startedAt: new Date(),
            transcriptJson: { rawPayload: payload },
          },
        });
        console.log(JSON.stringify({ event: 'db_write_success', model: 'Call', traceId: CallSid, callId: call.id, orgId, leadId: lead.id }));
      } catch (dbErr: any) {
        console.error(JSON.stringify({ event: 'db_write_error', model: 'Call', traceId: CallSid, orgId, error: dbErr?.message, code: dbErr?.code }));
        throw dbErr;
      }

      await prisma.auditLog.create({
        data: {
          orgId,
          actorType: 'system',
          action: 'inbound_call_received',
          entityType: 'call',
          entityId: call.id,
          details: { twilioCallSid: CallSid, from: From, to: To },
        },
      });

      // === ON-CALL ROUTING ===
      // Priority: phoneNumber.onCallUserId > organization.onCallUserId > fallback to admins
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { onCallUserId: true },
      });

      const callEventPayload = {
        type: 'call.incoming' as const,
        leadId: lead.id,
        timestamp: new Date().toISOString(),
        data: {
          callSid: CallSid,
          from: From,
          to: To,
          callId: call.id,
          contactName: contact.name,
          createdAt: new Date().toISOString(),
        },
      };

      // Determine on-call user: phoneNumber override > org default
      const targetOnCallUserId = phoneNumber.onCallUserId || org?.onCallUserId;
      let onCallSource = phoneNumber.onCallUserId ? 'phone_number' : (org?.onCallUserId ? 'organization' : 'none');

      // Verify on-call user exists and is active
      let activeOnCallUser: { id: string } | null = null;
      if (targetOnCallUserId) {
        activeOnCallUser = await prisma.user.findFirst({
          where: { id: targetOnCallUserId, status: 'active' },
          select: { id: true },
        });
        
        if (!activeOnCallUser) {
          // On-call user is inactive/deleted - log warning
          console.warn(`[Twilio Voice] [${requestId}] On-call user ${targetOnCallUserId} (from ${onCallSource}) is inactive/deleted.`);
          onCallSource = 'none';
        }
      }

      if (activeOnCallUser) {
        // Route to on-call user only
        console.log(JSON.stringify({
          event: 'inbound_call_notify_target',
          requestId,
          targetType: 'oncall_user',
          userId: activeOnCallUser.id,
          onCallSource,
        }));
        
        // Emit WS event to on-call user only
        const wsSent = emitToUser(activeOnCallUser.id, callEventPayload);
        
        // Send push to on-call user only
        sendIncomingCallPushToUser(activeOnCallUser.id, lead.id, CallSid, From)
          .then((result) => {
            console.log(JSON.stringify({
              event: 'inbound_call_push_result',
              requestId,
              sent: result.sent,
              failed: result.failed,
              targetType: 'oncall_user',
            }));
          })
          .catch((err) => {
            console.error(JSON.stringify({
              event: 'inbound_call_push_error',
              requestId,
              error: err?.message || 'unknown',
            }));
          });
      } else {
        // Fallback: notify all org admins and log warning
        const fallbackReason = org?.onCallUserId ? 'oncall_user_inactive' : 'oncall_not_configured';
        console.log(JSON.stringify({
          event: 'inbound_call_notify_target',
          requestId,
          targetType: 'org_fallback',
          reason: fallbackReason,
          orgId,
        }));
        
        // Log distinct analytics event for missing on-call (for monitoring/alerting)
        logAnalyticsEvent({
          orgId,
          type: 'call.incoming',
          payload: {
            oncall_fallback: true,
            reason: fallbackReason,
            callSid: CallSid,
            leadId: lead.id,
          },
        }).catch(() => {});
        
        // Emit to all org clients (fallback)
        emitRealtimeEvent(orgId, callEventPayload);
        
        // Send push to all org devices (fallback)
        sendIncomingCallPush(orgId, lead.id, CallSid, From).catch((err) => {
          console.error(JSON.stringify({
            event: 'inbound_call_push_error',
            requestId,
            error: err?.message || 'unknown',
          }));
        });
      }

      res.set('Content-Type', 'text/xml');

      // Check if OpenAI Realtime is configured - if so, use Media Streams
      const openaiConfigured = isOpenAIConfigured();
      console.log(`[Twilio Voice] [${requestId}] isOpenAIConfigured: ${openaiConfigured}`);

      if (openaiConfigured) {
        try {
          // Build stream URL (clean, no auth in querystring)
          const wsProtocol = 'wss';
          const host = process.env.PUBLIC_HOST || 'casecurrent.co';
          const streamUrl = `${wsProtocol}://${host}/v1/telephony/twilio/stream`;

          // Build auth token for customParameters (HMAC-based)
          const ts = Math.floor(Date.now() / 1000);
          const streamSecret = process.env.STREAM_TOKEN_SECRET || '';
          const authToken = streamSecret ? generateStreamToken(streamSecret, ts) : '';

          // XML-escape helper for safe embedding in TwiML
          const xmlEsc = (str: string) =>
            str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

          // Log exact Stream URL for debugging
          console.log(JSON.stringify({
            tag: '[TWIML_STREAM_URL]',
            callSid: maskCallSid(CallSid),
            streamUrl,
          }));

          const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${xmlEsc(streamUrl)}">
      <Parameter name="auth_token" value="${xmlEsc(authToken)}"/>
      <Parameter name="ts" value="${ts}"/>
      <Parameter name="callSid" value="${xmlEsc(CallSid)}"/>
      <Parameter name="to" value="${xmlEsc(To)}"/>
      <Parameter name="from" value="${xmlEsc(From)}"/>
      <Parameter name="orgId" value="${xmlEsc(orgId)}"/>
      <Parameter name="orgName" value="${xmlEsc(phoneNumber.organization?.name || '')}"/>
      <Parameter name="phoneNumberId" value="${xmlEsc(phoneNumber.id)}"/>
    </Stream>
  </Connect>
  <Pause length="3600"/>
</Response>`;

          const durationMs = Date.now() - startTime;
          
          // [TWIML_STREAM_PARAMS] - Log parameters being passed to stream for debugging
          console.log(JSON.stringify({
            tag: '[TWIML_STREAM_PARAMS]',
            callSid: maskCallSid(CallSid),
            to: maskPhone(To),
            orgId,
            phoneNumberId: phoneNumber.id,
          }));
          
          console.log(JSON.stringify({
            event: 'twilio_voice_webhook',
            requestId,
            callSid: maskCallSid(CallSid),
            orgId,
            responseType: 'twiml_stream',
            durationMs,
          }));

          recordEvent({
            source: 'twilio-voice-webhook',
            requestId,
            callSid: CallSid,
            orgId,
            e164: To,
            summary: `TwiML returned with <Connect><Stream>`,
            payload: { streamUrl },
          });

          res.send(twiml);
        } catch (streamError) {
          console.error(`[Twilio Voice] [${requestId}] Stream setup error:`, streamError);
          // Fallback to voicemail if stream setup fails
          res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. Our assistant is currently unavailable. Please leave a message after the beep.</Say>
  <Pause length="1"/>
  <Record maxLength="120" transcribe="true" transcribeCallback="/v1/telephony/twilio/transcription"/>
</Response>`);
        }
      } else {
        // Fallback: OpenAI not configured, use voicemail capture
        console.log(`[Twilio Voice] [${requestId}] OpenAI not configured, using voicemail`);
        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. Please describe your legal matter after the beep and someone will get back to you.</Say>
  <Pause length="1"/>
  <Record maxLength="120" transcribe="true" transcribeCallback="/v1/telephony/twilio/transcription"/>
</Response>`);
      }

      console.log(`[Twilio Voice] ========== END ${requestId} ==========`);
    } catch (error) {
      console.error('Twilio voice webhook error:', error);
      res.set('Content-Type', 'text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We encountered an error. Please try again later.</Say>
  <Hangup/>
</Response>`);
    }
  });

  /**
   * @openapi
   * /v1/telephony/twilio/voice/diag:
   *   get:
   *     summary: Diagnostic endpoint to verify Twilio voice webhook is reachable
   *     tags: [Telephony]
   *     responses:
   *       200:
   *         description: Diagnostic status
   */
  app.get('/v1/telephony/twilio/voice/diag', async (req, res) => {
    let dbHost = 'unknown';
    let dbName = 'unknown';
    
    const urlMatch = DATABASE_URL.match(/@([^:/]+)(?::(\d+))?\/([^?]+)/);
    if (urlMatch) {
      dbHost = urlMatch[1];
      dbName = urlMatch[3];
    }
    
    const phoneNumbersCount = await prisma.phoneNumber.count();
    
    const topPhones = await prisma.phoneNumber.findMany({
      take: 3,
      select: { e164: true },
    });
    const topPhoneE164Last4 = topPhones.map(p => '****' + p.e164.slice(-4));
    
    res.json({
      ok: true,
      now: new Date().toISOString(),
      envHasTwilioAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
      envHasTwilioAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
      dbHost,
      dbName,
      phoneNumbersCount,
      topPhoneE164Last4,
    });
  });

  /**
   * @openapi
   * /v1/telephony/twilio/stream/diag:
   *   get:
   *     summary: Diagnostic endpoint to verify Twilio stream relay is reachable
   *     tags: [Telephony]
   *     responses:
   *       200:
   *         description: Diagnostic status
   */
  app.get('/v1/telephony/twilio/stream/diag', (req, res) => {
    res.json({
      ok: true,
      now: new Date().toISOString(),
      envHasOpenAIKey: !!process.env.OPENAI_API_KEY,
      envHasStreamTokenSecret: !!process.env.STREAM_TOKEN_SECRET,
    });
  });

  /**
   * @openapi
   * /v1/telephony/twilio/dial-result:
   *   post:
   *     summary: Handle Twilio Dial action callback (captures dial outcome)
   *     tags: [Telephony]
   *     responses:
   *       200:
   *         description: TwiML response
   */
  app.post('/v1/telephony/twilio/dial-result', async (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const payload = req.body;
    const {
      CallSid,
      DialCallSid,
      DialCallStatus,
      DialCallDuration,
      DialSipResponseCode,
      ErrorCode,
      ErrorMessage,
    } = payload;

    recordEvent({
      source: 'twilio-dial-result',
      requestId,
      callSid: CallSid,
      summary: `Dial result: ${DialCallStatus || 'unknown'} (SIP ${DialSipResponseCode || 'N/A'})`,
      payload: {
        CallSid,
        DialCallSid,
        DialCallStatus,
        DialCallDuration,
        DialSipResponseCode,
        ErrorCode,
        ErrorMessage,
      },
    });

    console.log(
      `[Twilio Dial Result] CallSid=${maskCallSid(CallSid || '')} Status=${DialCallStatus} SipCode=${DialSipResponseCode} Error=${ErrorCode}/${ErrorMessage}`
    );

    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>The call has ended. Thank you for calling.</Say>
  <Hangup/>
</Response>`);
  });

  /**
   * @openapi
   * /v1/telephony/twilio/sip-status:
   *   post:
   *     summary: Handle Twilio SIP status callback events
   *     tags: [Telephony]
   *     responses:
   *       200:
   *         description: Status acknowledged
   */
  app.post('/v1/telephony/twilio/sip-status', async (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const payload = req.body;
    const {
      CallSid,
      CallStatus,
      SipResponseCode,
      ErrorCode,
      ErrorMessage,
      Timestamp,
      ParentCallSid,
    } = payload;

    recordEvent({
      source: 'twilio-sip-status',
      requestId,
      callSid: CallSid,
      summary: `SIP status: ${CallStatus || 'unknown'} (SIP ${SipResponseCode || 'N/A'})`,
      payload: {
        CallSid,
        ParentCallSid,
        CallStatus,
        SipResponseCode,
        ErrorCode,
        ErrorMessage,
        Timestamp,
      },
    });

    console.log(
      `[Twilio SIP Status] CallSid=${maskCallSid(CallSid || '')} Status=${CallStatus} SipCode=${SipResponseCode} Error=${ErrorCode}/${ErrorMessage}`
    );

    res.status(200).json({ received: true });
  });

  /**
   * @openapi
   * /v1/telephony/twilio/status:
   *   post:
   *     summary: Handle Twilio call status callback
   *     tags: [Telephony]
   *     responses:
   *       200:
   *         description: Status updated
   */
  app.post('/v1/telephony/twilio/status', async (req, res) => {
    try {
      const payload = req.body;
      const { CallSid, CallStatus, CallDuration } = payload;

      if (!CallSid) {
        return res.status(400).json({ error: 'Missing CallSid' });
      }

      // Look up by twilioCallSid first (primary), fall back to providerCallId
      const call = await prisma.call.findFirst({
        where: {
          OR: [
            { twilioCallSid: CallSid },
            { providerCallId: CallSid },
          ],
        },
      });

      console.log(JSON.stringify({
        event: 'webhook_received',
        route: '/v1/telephony/twilio/status',
        traceId: CallSid,
        callStatus: CallStatus,
        callFound: !!call,
        callId: call?.id || null,
        orgId: call?.orgId || null,
      }));

      if (!call) {
        console.warn(JSON.stringify({ event: 'status_callback_miss', traceId: CallSid, callStatus: CallStatus }));
        return res.status(404).json({ error: 'Call not found' });
      }

      const updateData: any = {
        transcriptJson: {
          ...((call.transcriptJson as any) || {}),
          statusPayload: payload,
        },
      };

      if (['completed', 'busy', 'no-answer', 'canceled', 'failed'].includes(CallStatus)) {
        updateData.endedAt = new Date();

        await prisma.interaction.update({
          where: { id: call.interactionId },
          data: { endedAt: new Date(), status: 'completed' },
        });
      }

      if (CallDuration) {
        updateData.durationSeconds = parseInt(CallDuration, 10);
      }

      await prisma.call.update({
        where: { id: call.id },
        data: updateData,
      });

      await prisma.auditLog.create({
        data: {
          orgId: call.orgId,
          actorType: 'system',
          action: 'call_status_updated',
          entityType: 'call',
          entityId: call.id,
          details: { status: CallStatus, duration: CallDuration },
        },
      });

      // Emit call.completed webhook when call ends
      if (CallStatus === 'completed') {
        await emitWebhookEvent(call.orgId, 'call.completed', {
          callId: call.id,
          leadId: call.leadId,
          direction: call.direction,
          durationSeconds: updateData.durationSeconds || 0,
          status: CallStatus,
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Twilio status webhook error:', error);
      res.status(500).json({ error: 'Failed to update call status' });
    }
  });

  /**
   * @openapi
   * /v1/telephony/twilio/recording:
   *   post:
   *     summary: Handle Twilio recording callback
   *     tags: [Telephony]
   *     responses:
   *       200:
   *         description: Recording stored
   */
  app.post('/v1/telephony/twilio/recording', async (req, res) => {
    try {
      const payload = req.body;
      const { CallSid, RecordingUrl, RecordingSid, RecordingDuration } = payload;

      if (!CallSid || !RecordingUrl) {
        return res.status(400).json({ error: 'Missing CallSid or RecordingUrl' });
      }

      const call = await prisma.call.findFirst({
        where: { providerCallId: CallSid },
      });

      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }

      await prisma.call.update({
        where: { id: call.id },
        data: {
          recordingUrl: RecordingUrl,
          transcriptJson: {
            ...((call.transcriptJson as any) || {}),
            recordingPayload: payload,
            transcriptionJobEnqueued: true,
            transcriptionJobEnqueuedAt: new Date().toISOString(),
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          orgId: call.orgId,
          actorType: 'system',
          action: 'recording_received',
          entityType: 'call',
          entityId: call.id,
          details: { recordingSid: RecordingSid, duration: RecordingDuration },
        },
      });

      res.json({ success: true, message: 'Recording stored, transcription job enqueued' });
    } catch (error) {
      console.error('Twilio recording webhook error:', error);
      res.status(500).json({ error: 'Failed to process recording' });
    }
  });

  /**
   * @openapi
   * /v1/telephony/twilio/sms:
   *   post:
   *     summary: Handle incoming Twilio SMS webhook
   *     tags: [Telephony]
   *     responses:
   *       200:
   *         description: TwiML response
   */
  // STOP word detection helper
  function isStopWord(text: string): boolean {
    const stopWords = ['stop', 'unsubscribe', 'cancel', 'end', 'quit'];
    const normalized = text.trim().toLowerCase();
    return stopWords.includes(normalized);
  }

  app.post('/v1/telephony/twilio/sms', async (req, res) => {
    try {
      const payload = req.body;
      const { MessageSid, From, To, Body } = payload;

      if (!MessageSid || !From || !To) {
        return res.status(400).json({ error: 'Missing required Twilio SMS parameters' });
      }

      const existingMessage = await prisma.message.findFirst({
        where: { providerMessageId: MessageSid },
      });

      if (existingMessage) {
        res.set('Content-Type', 'text/xml');
        return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`);
      }

      const phoneNumber = await prisma.phoneNumber.findFirst({
        where: { e164: To },
        include: { organization: true },
      });

      if (!phoneNumber) {
        console.log(`No phone number found for SMS to ${To}`);
        res.set('Content-Type', 'text/xml');
        return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`);
      }

      const orgId = phoneNumber.orgId;

      let contact = await prisma.contact.findFirst({
        where: { orgId, primaryPhone: From },
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            orgId,
            name: 'Unknown Sender',
            primaryPhone: From,
          },
        });
      }

      let lead = await prisma.lead.findFirst({
        where: {
          orgId,
          contactId: contact.id,
          status: { in: ['new', 'in_progress', 'engaged', 'intake_started'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      const isNewLead = !lead;

      if (!lead) {
        lead = await prisma.lead.create({
          data: {
            orgId,
            contactId: contact.id,
            source: 'sms',
            status: 'new',
            priority: 'medium',
            lastActivityAt: new Date(),
          },
        });
      }

      // Check for STOP word - handle DNC
      if (isStopWord(Body || '')) {
        // Set DNC on lead
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            dnc: true,
            dncReason: `STOP received via SMS: "${Body}"`,
            dncAt: new Date(),
            lastActivityAt: new Date(),
          },
        });

        // Cancel any queued outbound messages
        await prisma.outboundMessage.updateMany({
          where: {
            leadId: lead.id,
            status: 'queued',
          },
          data: {
            status: 'cancelled',
            reason: 'Lead requested STOP',
          },
        });

        // Cancel any pending followup jobs
        await prisma.followupJob.updateMany({
          where: {
            leadId: lead.id,
            status: 'pending',
          },
          data: {
            status: 'cancelled',
            cancelReason: 'Lead requested STOP',
          },
        });

        await prisma.auditLog.create({
          data: {
            orgId,
            actorType: 'system',
            action: 'dnc_set',
            entityType: 'lead',
            entityId: lead.id,
            details: { reason: 'STOP received via SMS', from: From },
          },
        });

        console.log(`[SMS] STOP received from ${From} - DNC set for lead ${lead.id}`);

        // Emit realtime event for DNC
        emitRealtimeEvent(orgId, {
          type: 'lead.dnc_set',
          leadId: lead.id,
          timestamp: new Date().toISOString(),
          data: { reason: 'STOP received' },
        });

        // Return empty response - no reply to STOP
        res.set('Content-Type', 'text/xml');
        return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`);
      }

      let interaction = await prisma.interaction.findFirst({
        where: {
          leadId: lead.id,
          channel: 'sms',
          status: 'active',
        },
        orderBy: { startedAt: 'desc' },
      });

      if (!interaction) {
        interaction = await prisma.interaction.create({
          data: {
            orgId,
            leadId: lead.id,
            channel: 'sms',
            status: 'active',
            metadata: { initialPayload: payload },
          },
        });
      }

      const message = await prisma.message.create({
        data: {
          orgId,
          leadId: lead.id,
          interactionId: interaction.id,
          direction: 'inbound',
          channel: 'sms',
          provider: 'twilio',
          providerMessageId: MessageSid,
          from: From,
          to: To,
          body: Body || '',
        },
      });

      // Update lead status and activity
      const newStatus = lead.status === 'new' ? 'engaged' : lead.status;
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: newStatus,
          lastActivityAt: new Date(),
        },
      });

      // Cancel queued automation messages on engagement
      await prisma.outboundMessage.updateMany({
        where: {
          leadId: lead.id,
          status: 'queued',
          ruleId: { in: ['AFTER_HOURS_SMS_2', 'AFTER_HOURS_SMS_3', 'AFTER_HOURS_SMS_4'] },
        },
        data: {
          status: 'cancelled',
          reason: 'Lead engaged via inbound SMS',
        },
      });

      await prisma.auditLog.create({
        data: {
          orgId,
          actorType: 'system',
          action: 'inbound_sms_received',
          entityType: 'message',
          entityId: message.id,
          details: { from: From, to: To, bodyPreview: Body?.substring(0, 100) },
        },
      });

      // Emit realtime event
      emitRealtimeEvent(orgId, {
        type: 'sms.received',
        leadId: lead.id,
        timestamp: new Date().toISOString(),
        data: {
          messageId: message.id,
          from: From,
          bodyPreview: Body?.substring(0, 50),
          isNewLead,
        },
      });

      if (isNewLead) {
        emitRealtimeEvent(orgId, {
          type: 'lead.created',
          leadId: lead.id,
          timestamp: new Date().toISOString(),
          data: { source: 'sms', phone: From },
        });
      }

      res.set('Content-Type', 'text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thank you for contacting us. An attorney will review your message shortly.</Message>
</Response>`);
    } catch (error) {
      console.error('Twilio SMS webhook error:', error);
      res.set('Content-Type', 'text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`);
    }
  });

  // ============================================
  // PLIVO TELEPHONY WEBHOOKS
  // ============================================

  /**
   * @openapi
   * /v1/telephony/plivo/voice:
   *   post:
   *     summary: Handle incoming Plivo voice call webhook
   *     tags: [Telephony]
   *     responses:
   *       200:
   *         description: Plivo XML response
   */
  app.post('/v1/telephony/plivo/voice', async (req, res) => {
    try {
      const payload = req.body;
      const { CallUUID, From, To, CallStatus, Direction } = payload;

      console.log(
        `[Plivo Voice] Inbound call: CallUUID=${CallUUID} From=${From} To=${To} Status=${CallStatus}`
      );

      if (!To) {
        console.log(`[Plivo Voice] Missing To number`);
        res.set('Content-Type', 'application/xml');
        return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak>We're sorry, an error occurred.</Speak>
  <Hangup/>
</Response>`);
      }

      const phoneNumber = await prisma.phoneNumber.findFirst({
        where: { e164: To },
        include: { organization: true },
      });

      if (!phoneNumber) {
        console.log(`[Plivo Voice] No phone number found for ${To}`);
        res.set('Content-Type', 'application/xml');
        return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak>This number is not configured. Goodbye.</Speak>
  <Hangup/>
</Response>`);
      }

      const orgId = phoneNumber.orgId;

      // Find or create contact
      let contact = await prisma.contact.findFirst({
        where: { orgId, primaryPhone: From },
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            orgId,
            name: 'Unknown Caller',
            primaryPhone: From,
          },
        });
      }

      // Find or create lead
      let lead = await prisma.lead.findFirst({
        where: {
          orgId,
          contactId: contact.id,
          status: { in: ['new', 'in_progress', 'engaged', 'intake_started'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!lead) {
        lead = await prisma.lead.create({
          data: {
            orgId,
            contactId: contact.id,
            source: 'phone',
            status: 'new',
            priority: 'high',
            lastActivityAt: new Date(),
          },
        });
      }

      // Create interaction
      const interaction = await prisma.interaction.create({
        data: {
          orgId,
          leadId: lead.id,
          channel: 'call',
          status: mapPlivoWebhookToDbStatus(CallStatus || 'ringing'),
          metadata: { provider: 'plivo', direction: Direction },
        },
      });

      // Create call record
      const call = await prisma.call.create({
        data: {
          orgId,
          leadId: lead.id,
          interactionId: interaction.id,
          phoneNumberId: phoneNumber.id,
          direction: Direction?.toLowerCase() === 'outbound' ? 'outbound' : 'inbound',
          provider: 'plivo',
          providerCallId: CallUUID,
          fromE164: From,
          toE164: To,
          startedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          orgId,
          actorType: 'system',
          action: 'inbound_call_received',
          entityType: 'call',
          entityId: call.id,
          details: { from: From, to: To, provider: 'plivo', callUUID: CallUUID },
        },
      });

      // Update lead activity
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          lastActivityAt: new Date(),
          status: lead.status === 'new' ? 'engaged' : lead.status,
        },
      });

      // Emit realtime event
      emitRealtimeEvent(orgId, {
        type: 'call.inbound',
        leadId: lead.id,
        timestamp: new Date().toISOString(),
        data: { callId: call.id, from: From, provider: 'plivo' },
      });

      // Return basic voicemail response (no AI integration for Plivo yet)
      res.set('Content-Type', 'application/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak>Thank you for calling. Please leave a message after the tone.</Speak>
  <Record maxLength="120" action="/v1/telephony/plivo/recording" method="POST" />
</Response>`);
    } catch (error) {
      console.error('Plivo voice webhook error:', error);
      res.set('Content-Type', 'application/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak>An error occurred. Please try again later.</Speak>
  <Hangup/>
</Response>`);
    }
  });

  /**
   * @openapi
   * /v1/telephony/plivo/sms:
   *   post:
   *     summary: Handle incoming Plivo SMS webhook
   *     tags: [Telephony]
   *     responses:
   *       200:
   *         description: Plivo XML response
   */
  app.post('/v1/telephony/plivo/sms', async (req, res) => {
    try {
      const payload = req.body;
      const { MessageUUID, From, To, Text } = payload;

      console.log(`[Plivo SMS] Inbound: MessageUUID=${MessageUUID} From=${From} To=${To}`);

      if (!MessageUUID || !From || !To) {
        return res.status(400).json({ error: 'Missing required Plivo SMS parameters' });
      }

      // Check for duplicate
      const existingMessage = await prisma.message.findFirst({
        where: { providerMessageId: MessageUUID },
      });

      if (existingMessage) {
        return res.json({ status: 'duplicate' });
      }

      const phoneNumber = await prisma.phoneNumber.findFirst({
        where: { e164: To },
        include: { organization: true },
      });

      if (!phoneNumber) {
        console.log(`[Plivo SMS] No phone number found for ${To}`);
        return res.json({ status: 'ignored' });
      }

      const orgId = phoneNumber.orgId;

      // Find or create contact
      let contact = await prisma.contact.findFirst({
        where: { orgId, primaryPhone: From },
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            orgId,
            name: 'Unknown Sender',
            primaryPhone: From,
          },
        });
      }

      // Find or create lead
      let lead = await prisma.lead.findFirst({
        where: {
          orgId,
          contactId: contact.id,
          status: { in: ['new', 'in_progress', 'engaged', 'intake_started'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      const isNewLead = !lead;

      if (!lead) {
        lead = await prisma.lead.create({
          data: {
            orgId,
            contactId: contact.id,
            source: 'sms',
            status: 'new',
            priority: 'medium',
            lastActivityAt: new Date(),
          },
        });
      }

      // Check for STOP word
      if (isStopWord(Text || '')) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            dnc: true,
            dncReason: `STOP received via SMS: "${Text}"`,
            dncAt: new Date(),
            lastActivityAt: new Date(),
          },
        });

        await prisma.auditLog.create({
          data: {
            orgId,
            actorType: 'system',
            action: 'dnc_set_via_sms',
            entityType: 'lead',
            entityId: lead.id,
            details: { provider: 'plivo', text: Text },
          },
        });

        return res.json({ status: 'dnc_set' });
      }

      // Create interaction
      const interaction = await prisma.interaction.create({
        data: {
          orgId,
          leadId: lead.id,
          channel: 'sms',
          status: 'completed',
          metadata: { provider: 'plivo' },
        },
      });

      // Create message
      const message = await prisma.message.create({
        data: {
          orgId,
          leadId: lead.id,
          interactionId: interaction.id,
          direction: 'inbound',
          channel: 'sms',
          provider: 'plivo',
          providerMessageId: MessageUUID,
          from: From,
          to: To,
          body: Text || '',
        },
      });

      // Update lead
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: lead.status === 'new' ? 'engaged' : lead.status,
          lastActivityAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          orgId,
          actorType: 'system',
          action: 'inbound_sms_received',
          entityType: 'message',
          entityId: message.id,
          details: { from: From, to: To, provider: 'plivo', bodyPreview: Text?.substring(0, 100) },
        },
      });

      // Emit realtime event
      emitRealtimeEvent(orgId, {
        type: 'sms.received',
        leadId: lead.id,
        timestamp: new Date().toISOString(),
        data: {
          messageId: message.id,
          from: From,
          bodyPreview: Text?.substring(0, 50),
          isNewLead,
          provider: 'plivo',
        },
      });

      if (isNewLead) {
        emitRealtimeEvent(orgId, {
          type: 'lead.created',
          leadId: lead.id,
          timestamp: new Date().toISOString(),
          data: { source: 'sms', phone: From, provider: 'plivo' },
        });
      }

      res.json({ status: 'received', messageId: message.id });
    } catch (error) {
      console.error('Plivo SMS webhook error:', error);
      res.status(500).json({ error: 'Failed to process SMS' });
    }
  });

  /**
   * @openapi
   * /v1/telephony/plivo/recording:
   *   post:
   *     summary: Handle Plivo recording callback
   *     tags: [Telephony]
   *     responses:
   *       200:
   *         description: Success
   */
  app.post('/v1/telephony/plivo/recording', async (req, res) => {
    try {
      const { CallUUID, RecordingUrl, RecordingDuration } = req.body;

      console.log(`[Plivo Recording] CallUUID=${CallUUID} Duration=${RecordingDuration}`);

      if (CallUUID) {
        const call = await prisma.call.findFirst({
          where: { providerCallId: CallUUID },
        });

        if (call) {
          await prisma.call.update({
            where: { id: call.id },
            data: {
              recordingUrl: RecordingUrl,
              durationSeconds: RecordingDuration ? parseInt(RecordingDuration, 10) : undefined,
            },
          });
          await recordIngestionOutcome(prisma, {
            provider: 'plivo', eventType: 'recording', externalId: CallUUID,
            orgId: call.orgId, status: 'persisted',
          });
        } else {
          // Plivo doesn't retry — keep 200, record skipped
          await recordIngestionOutcome(prisma, {
            provider: 'plivo', eventType: 'recording', externalId: CallUUID,
            status: 'skipped', errorCode: 'call_not_found',
            errorMessage: 'No matching call for CallUUID',
          });
        }
      }

      res.json({ status: 'ok' });
    } catch (error: any) {
      console.error('Plivo recording callback error:', error);
      await recordIngestionOutcome(prisma, {
        provider: 'plivo', eventType: 'recording',
        externalId: req.body?.CallUUID || 'unknown',
        status: 'failed', errorCode: 'recording_error',
        errorMessage: error?.message || String(error),
        payload: req.body,
      });
      res.status(500).json({ error: 'Failed to process recording' });
    }
  });

  /**
   * @openapi
   * /v1/telephony/plivo/status:
   *   post:
   *     summary: Handle Plivo call status webhook
   *     tags: [Telephony]
   *     responses:
   *       200:
   *         description: Success
   */
  app.post('/v1/telephony/plivo/status', async (req, res) => {
    try {
      const { CallUUID, CallStatus, Duration, HangupCause } = req.body;

      console.log(`[Plivo Status] CallUUID=${CallUUID} Status=${CallStatus} Duration=${Duration}`);

      if (CallUUID) {
        const call = await prisma.call.findFirst({
          where: { providerCallId: CallUUID },
          include: { interaction: true },
        });

        if (call) {
          const dbStatus = mapPlivoWebhookToDbStatus(CallStatus);
          const isTerminal = isTerminalStatus(dbStatus);

          const callUpdate: { endedAt?: Date; durationSeconds?: number } = {};
          if (isTerminal) {
            callUpdate.endedAt = new Date();
            if (Duration) {
              callUpdate.durationSeconds = parseInt(Duration, 10);
            }
          }

          if (Object.keys(callUpdate).length > 0) {
            await prisma.call.update({
              where: { id: call.id },
              data: callUpdate,
            });
          }

          if (call.interaction) {
            await prisma.interaction.update({
              where: { id: call.interaction.id },
              data: { status: dbStatus, ...(isTerminal ? { endedAt: new Date() } : {}) },
            });
          }

          await recordIngestionOutcome(prisma, {
            provider: 'plivo', eventType: 'status', externalId: CallUUID,
            orgId: call.orgId, status: 'persisted',
          });
        } else {
          // Plivo doesn't retry — keep 200, record skipped
          await recordIngestionOutcome(prisma, {
            provider: 'plivo', eventType: 'status', externalId: CallUUID,
            status: 'skipped', errorCode: 'call_not_found',
            errorMessage: 'No matching call for CallUUID',
          });
        }
      }

      res.json({ status: 'ok' });
    } catch (error: any) {
      console.error('Plivo status callback error:', error);
      await recordIngestionOutcome(prisma, {
        provider: 'plivo', eventType: 'status',
        externalId: req.body?.CallUUID || 'unknown',
        status: 'failed', errorCode: 'status_error',
        errorMessage: error?.message || String(error),
        payload: req.body,
      });
      res.status(500).json({ error: 'Failed to process status' });
    }
  });

  // ============================================
  // INTAKE ENDPOINTS (Checkpoint 6)
  // ============================================

  // GET /v1/leads/:id/intake - Get intake for a lead
  app.get('/v1/leads/:id/intake', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      const { id: leadId } = req.params;

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, orgId: user.orgId },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const intake = await prisma.intake.findUnique({
        where: { leadId },
        include: {
          questionSet: {
            select: { id: true, name: true, schema: true, version: true },
          },
          practiceArea: {
            select: { id: true, name: true },
          },
        },
      });

      if (!intake) {
        return res.json({ exists: false, intake: null });
      }

      res.json({ exists: true, intake });
    } catch (error) {
      console.error('Get intake error:', error);
      res.status(500).json({ error: 'Failed to get intake' });
    }
  });

  // POST /v1/leads/:id/intake/init - Initialize intake for a lead
  app.post('/v1/leads/:id/intake/init', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      const { id: leadId } = req.params;

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, orgId: user.orgId },
        include: { practiceArea: true },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // Check if intake already exists
      const existingIntake = await prisma.intake.findUnique({
        where: { leadId },
      });

      if (existingIntake) {
        return res.status(400).json({ error: 'Intake already exists for this lead' });
      }

      // Find appropriate question set
      // Priority: practice area specific > default (no practice area)
      let questionSet = null;

      if (lead.practiceAreaId) {
        questionSet = await prisma.intakeQuestionSet.findFirst({
          where: {
            orgId: user.orgId,
            practiceAreaId: lead.practiceAreaId,
            active: true,
          },
          orderBy: { version: 'desc' },
        });
      }

      // Fallback to default question set (no practice area)
      if (!questionSet) {
        questionSet = await prisma.intakeQuestionSet.findFirst({
          where: {
            orgId: user.orgId,
            practiceAreaId: null,
            active: true,
          },
          orderBy: { version: 'desc' },
        });
      }

      // Create intake
      const intake = await prisma.intake.create({
        data: {
          orgId: user.orgId,
          leadId,
          practiceAreaId: lead.practiceAreaId,
          questionSetId: questionSet?.id || null,
          answers: {},
          completionStatus: 'partial',
        },
        include: {
          questionSet: {
            select: { id: true, name: true, schema: true, version: true },
          },
          practiceArea: {
            select: { id: true, name: true },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.userId,
          actorType: 'user',
          action: 'intake_initialized',
          entityType: 'intake',
          entityId: intake.id,
          details: {
            leadId,
            questionSetId: questionSet?.id || null,
            practiceAreaId: lead.practiceAreaId,
          },
        },
      });

      res.status(201).json(intake);
    } catch (error) {
      console.error('Init intake error:', error);
      res.status(500).json({ error: 'Failed to initialize intake' });
    }
  });

  // PATCH /v1/leads/:id/intake - Update intake answers
  app.patch('/v1/leads/:id/intake', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      const { id: leadId } = req.params;
      const { answers } = req.body;

      if (!answers || typeof answers !== 'object') {
        return res.status(400).json({ error: 'Invalid answers format' });
      }

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, orgId: user.orgId },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const existingIntake = await prisma.intake.findUnique({
        where: { leadId },
      });

      if (!existingIntake) {
        return res.status(404).json({ error: 'Intake not found. Initialize first.' });
      }

      if (existingIntake.completionStatus === 'complete') {
        return res.status(400).json({ error: 'Cannot update completed intake' });
      }

      // Merge new answers with existing
      const existingAnswers = (existingIntake.answers as Record<string, any>) || {};
      const mergedAnswers = { ...existingAnswers, ...answers };

      const intake = await prisma.intake.update({
        where: { leadId },
        data: {
          answers: mergedAnswers,
        },
        include: {
          questionSet: {
            select: { id: true, name: true, schema: true, version: true },
          },
          practiceArea: {
            select: { id: true, name: true },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.userId,
          actorType: 'user',
          action: 'intake_updated',
          entityType: 'intake',
          entityId: intake.id,
          details: {
            leadId,
            updatedFields: Object.keys(answers),
          },
        },
      });

      res.json(intake);
    } catch (error) {
      console.error('Update intake error:', error);
      res.status(500).json({ error: 'Failed to update intake' });
    }
  });

  // POST /v1/leads/:id/intake/complete - Complete intake
  app.post(
    '/v1/leads/:id/intake/complete',
    authMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const user = req.user!;

        const { id: leadId } = req.params;

        const lead = await prisma.lead.findFirst({
          where: { id: leadId, orgId: user.orgId },
        });

        if (!lead) {
          return res.status(404).json({ error: 'Lead not found' });
        }

        const existingIntake = await prisma.intake.findUnique({
          where: { leadId },
        });

        if (!existingIntake) {
          return res.status(404).json({ error: 'Intake not found. Initialize first.' });
        }

        if (existingIntake.completionStatus === 'complete') {
          return res.status(400).json({ error: 'Intake already completed' });
        }

        const intake = await prisma.intake.update({
          where: { leadId },
          data: {
            completionStatus: 'complete',
            completedAt: new Date(),
          },
          include: {
            questionSet: {
              select: { id: true, name: true, schema: true, version: true },
            },
            practiceArea: {
              select: { id: true, name: true },
            },
          },
        });

        await prisma.auditLog.create({
          data: {
            orgId: user.orgId,
            actorUserId: user.userId,
            actorType: 'user',
            action: 'intake_completed',
            entityType: 'intake',
            entityId: intake.id,
            details: {
              leadId,
              answersCount: Object.keys((intake.answers as Record<string, any>) || {}).length,
            },
          },
        });

        // Emit intake.completed webhook
        await emitWebhookEvent(user.orgId, 'intake.completed', {
          intakeId: intake.id,
          leadId,
          answersCount: Object.keys((intake.answers as Record<string, any>) || {}).length,
          completedAt: intake.completedAt,
        });

        res.json({
          ...intake,
          webhookEvent: {
            type: 'intake.completed',
            recordedAt: new Date().toISOString(),
            note: 'Webhook delivery stub - will be implemented in webhook system',
          },
        });
      } catch (error) {
        console.error('Complete intake error:', error);
        res.status(500).json({ error: 'Failed to complete intake' });
      }
    }
  );

  // ============================================
  // AI PIPELINE & QUALIFICATION (Checkpoint 7)
  // ============================================

  // AI Job Stub: Generate qualification reasons with required JSON contract
  function generateQualificationReasons(lead: any, intake: any, calls: any[]) {
    const scoreFactors: Array<{
      name: string;
      weight: number;
      evidence: string;
      evidence_quote: string | null;
    }> = [];
    const missingFields: string[] = [];
    const disqualifiers: string[] = [];

    let totalScore = 0;
    let maxScore = 0;

    // Factor 1: Contact information completeness
    const hasPhone = !!lead.contact?.primaryPhone;
    const hasEmail = !!lead.contact?.primaryEmail;
    const contactWeight = 20;
    maxScore += contactWeight;
    if (hasPhone && hasEmail) {
      totalScore += contactWeight;
      scoreFactors.push({
        name: 'Contact Information',
        weight: contactWeight,
        evidence: 'Both phone and email provided',
        evidence_quote: null,
      });
    } else if (hasPhone || hasEmail) {
      totalScore += contactWeight / 2;
      scoreFactors.push({
        name: 'Contact Information',
        weight: contactWeight / 2,
        evidence: hasPhone ? 'Phone number provided' : 'Email provided',
        evidence_quote: null,
      });
      missingFields.push(hasPhone ? 'email' : 'phone');
    } else {
      missingFields.push('phone', 'email');
    }

    // Factor 2: Practice area assignment
    const practiceAreaWeight = 15;
    maxScore += practiceAreaWeight;
    if (lead.practiceAreaId) {
      totalScore += practiceAreaWeight;
      scoreFactors.push({
        name: 'Practice Area',
        weight: practiceAreaWeight,
        evidence: `Assigned to practice area: ${lead.practiceArea?.name || 'Unknown'}`,
        evidence_quote: null,
      });
    } else {
      missingFields.push('practice_area');
    }

    // Factor 3: Intake completion
    const intakeWeight = 25;
    maxScore += intakeWeight;
    if (intake?.completionStatus === 'complete') {
      totalScore += intakeWeight;
      const answerCount = Object.keys(intake.answers || {}).length;
      scoreFactors.push({
        name: 'Intake Completed',
        weight: intakeWeight,
        evidence: `Intake form completed with ${answerCount} answers`,
        evidence_quote: null,
      });
    } else if (intake?.completionStatus === 'partial') {
      totalScore += intakeWeight / 2;
      scoreFactors.push({
        name: 'Intake In Progress',
        weight: intakeWeight / 2,
        evidence: 'Intake started but not completed',
        evidence_quote: null,
      });
      missingFields.push('completed_intake');
    } else {
      missingFields.push('intake');
    }

    // Factor 4: Incident information
    const incidentWeight = 20;
    maxScore += incidentWeight;
    if (lead.incidentDate && lead.incidentLocation) {
      totalScore += incidentWeight;
      scoreFactors.push({
        name: 'Incident Details',
        weight: incidentWeight,
        evidence: `Incident on ${new Date(lead.incidentDate).toLocaleDateString()} at ${lead.incidentLocation}`,
        evidence_quote: null,
      });
    } else if (lead.incidentDate || lead.incidentLocation) {
      totalScore += incidentWeight / 2;
      scoreFactors.push({
        name: 'Partial Incident Details',
        weight: incidentWeight / 2,
        evidence: lead.incidentDate ? 'Incident date provided' : 'Incident location provided',
        evidence_quote: null,
      });
      missingFields.push(lead.incidentDate ? 'incident_location' : 'incident_date');
    } else {
      missingFields.push('incident_date', 'incident_location');
    }

    // Factor 5: Communication history
    const commWeight = 20;
    maxScore += commWeight;
    if (calls.length > 0) {
      const hasRecording = calls.some((c) => c.recordingUrl);
      const hasTranscript = calls.some((c) => c.transcriptText);
      let evidence = `${calls.length} call(s) on record`;
      let score = commWeight / 2;
      if (hasTranscript) {
        evidence += ', transcripts available';
        score = commWeight;
      } else if (hasRecording) {
        evidence += ', recordings available';
        score = (commWeight * 3) / 4;
      }
      totalScore += score;
      scoreFactors.push({
        name: 'Communication History',
        weight: score,
        evidence,
        evidence_quote: hasTranscript
          ? calls.find((c) => c.transcriptText)?.transcriptText?.substring(0, 100) || null
          : null,
      });
    }

    // Calculate final score (0-100)
    const finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // Determine disposition
    let disposition: 'accept' | 'review' | 'decline' = 'review';
    if (finalScore >= 70 && missingFields.length <= 2 && disqualifiers.length === 0) {
      disposition = 'accept';
    } else if (finalScore < 30 || disqualifiers.length > 0) {
      disposition = 'decline';
    }

    // Calculate confidence (based on data completeness)
    const confidence = Math.min(100, Math.round((scoreFactors.length / 5) * 100));

    const reasons = {
      score_factors: scoreFactors,
      missing_fields: missingFields,
      disqualifiers,
      routing: {
        practice_area_id: lead.practiceAreaId || null,
        notes:
          disposition === 'accept'
            ? 'Ready for attorney review'
            : disposition === 'decline'
              ? 'Insufficient information'
              : 'Needs additional screening',
      },
      model: {
        provider: 'stub',
        model: 'qualification-v1',
        version: '1.0.0',
      },
      explanations: [
        `Lead scored ${finalScore}/100 based on ${scoreFactors.length} evaluation factors.`,
        missingFields.length > 0
          ? `Missing information: ${missingFields.join(', ')}.`
          : 'All required information provided.',
        disqualifiers.length > 0 ? `Disqualification reasons: ${disqualifiers.join(', ')}.` : '',
      ].filter(Boolean),
    };

    return { score: finalScore, disposition, confidence, reasons };
  }

  // GET /v1/leads/:id/qualification - Get qualification for a lead
  app.get('/v1/leads/:id/qualification', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const { id: leadId } = req.params;

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, orgId: user.orgId },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const qualification = await prisma.qualification.findUnique({
        where: { leadId },
      });

      if (!qualification) {
        return res.json({ exists: false, qualification: null });
      }

      res.json({ exists: true, qualification });
    } catch (error) {
      console.error('Get qualification error:', error);
      res.status(500).json({ error: 'Failed to get qualification' });
    }
  });

  // POST /v1/leads/:id/qualification/run - Run AI qualification
  app.post(
    '/v1/leads/:id/qualification/run',
    authMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const user = req.user!;
        const { id: leadId } = req.params;

        const lead = await prisma.lead.findFirst({
          where: { id: leadId, orgId: user.orgId },
          include: {
            contact: true,
            practiceArea: true,
          },
        });

        if (!lead) {
          return res.status(404).json({ error: 'Lead not found' });
        }

        // Fetch intake for this lead
        const intake = await prisma.intake.findUnique({
          where: { leadId },
        });

        // Fetch calls for this lead
        const calls = await prisma.call.findMany({
          where: { leadId },
        });

        // Run AI qualification stub
        const { score, disposition, confidence, reasons } = generateQualificationReasons(
          lead,
          intake,
          calls
        );

        // Upsert qualification
        const qualification = await prisma.qualification.upsert({
          where: { leadId },
          update: {
            score,
            disposition,
            confidence,
            reasons,
          },
          create: {
            orgId: user.orgId,
            leadId,
            score,
            disposition,
            confidence,
            reasons,
          },
        });

        // Update lead status based on qualification
        if (disposition === 'accept' && lead.status === 'new') {
          await prisma.lead.update({
            where: { id: leadId },
            data: { status: 'qualified' },
          });
        } else if (disposition === 'decline' && lead.status === 'new') {
          await prisma.lead.update({
            where: { id: leadId },
            data: { status: 'unqualified' },
          });
        }

        await prisma.auditLog.create({
          data: {
            orgId: user.orgId,
            actorUserId: user.userId,
            actorType: 'user',
            action: 'qualification_run',
            entityType: 'qualification',
            entityId: qualification.id,
            details: {
              leadId,
              score,
              disposition,
              confidence,
              factorCount: reasons.score_factors.length,
            },
          },
        });

        // Emit lead.qualified webhook
        await emitWebhookEvent(user.orgId, 'lead.qualified', {
          leadId,
          qualificationId: qualification.id,
          score,
          disposition,
          confidence,
        });

        console.log(
          `[AI PIPELINE] qualification.run for lead ${leadId}, score: ${score}, disposition: ${disposition}`
        );

        res.json(qualification);
      } catch (error) {
        console.error('Run qualification error:', error);
        res.status(500).json({ error: 'Failed to run qualification' });
      }
    }
  );

  // PATCH /v1/leads/:id/qualification - Human override
  app.patch(
    '/v1/leads/:id/qualification',
    authMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const user = req.user!;
        const { id: leadId } = req.params;
        const { score, disposition, reasons } = req.body;

        const lead = await prisma.lead.findFirst({
          where: { id: leadId, orgId: user.orgId },
        });

        if (!lead) {
          return res.status(404).json({ error: 'Lead not found' });
        }

        const existingQualification = await prisma.qualification.findUnique({
          where: { leadId },
        });

        if (!existingQualification) {
          return res
            .status(404)
            .json({ error: 'Qualification not found. Run qualification first.' });
        }

        const updateData: any = {};
        if (score !== undefined) updateData.score = score;
        if (disposition !== undefined) updateData.disposition = disposition;
        if (reasons !== undefined) {
          // Merge human override into existing reasons
          const existingReasons = (existingQualification.reasons as any) || {};
          updateData.reasons = {
            ...existingReasons,
            ...reasons,
            explanations: [
              ...(existingReasons.explanations || []),
              `Human override by ${user.email} at ${new Date().toISOString()}`,
            ],
          };
        }

        const qualification = await prisma.qualification.update({
          where: { leadId },
          data: updateData,
        });

        // Update lead status if disposition changed
        if (disposition) {
          let newStatus = lead.status;
          if (disposition === 'accept') newStatus = 'qualified';
          else if (disposition === 'decline') newStatus = 'unqualified';

          if (newStatus !== lead.status) {
            await prisma.lead.update({
              where: { id: leadId },
              data: { status: newStatus },
            });
          }
        }

        await prisma.auditLog.create({
          data: {
            orgId: user.orgId,
            actorUserId: user.userId,
            actorType: 'user',
            action: 'qualification_override',
            entityType: 'qualification',
            entityId: qualification.id,
            details: {
              leadId,
              updatedFields: Object.keys(updateData),
              newDisposition: disposition,
            },
          },
        });

        res.json(qualification);
      } catch (error) {
        console.error('Override qualification error:', error);
        res.status(500).json({ error: 'Failed to override qualification' });
      }
    }
  );

  // AI Job Stubs for future implementation
  // These would be triggered by a job queue in production

  // Stub: Transcription job
  app.post('/v1/ai/transcribe/:callId', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const { callId } = req.params;

      const call = await prisma.call.findFirst({
        where: { id: callId, orgId: user.orgId },
      });

      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }

      if (!call.recordingUrl) {
        return res.status(400).json({ error: 'No recording URL available' });
      }

      // Stub: In production, this would call a transcription service
      const stubTranscript = `[STUB TRANSCRIPT] This is a simulated transcript for call ${callId}. In production, this would be generated from the recording at ${call.recordingUrl}.`;

      await prisma.call.update({
        where: { id: callId },
        data: {
          transcriptText: stubTranscript,
          transcriptJson: {
            segments: [{ start: 0, end: 60, text: stubTranscript, speaker: 'unknown' }],
            provider: 'stub',
            model: 'transcription-v1',
            processedAt: new Date().toISOString(),
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.userId,
          actorType: 'user',
          action: 'ai.transcribe.stub',
          entityType: 'call',
          entityId: callId,
          details: { provider: 'stub', model: 'transcription-v1' },
        },
      });

      console.log(`[AI PIPELINE STUB] transcription completed for call ${callId}`);
      res.json({ success: true, message: 'Transcription stub completed' });
    } catch (error) {
      console.error('Transcription error:', error);
      res.status(500).json({ error: 'Failed to transcribe' });
    }
  });

  // Summarization endpoint moved to server/routes/ai.ts

  // Stub: Intake extraction job
  app.post('/v1/ai/extract/:leadId', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const { leadId } = req.params;

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, orgId: user.orgId },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // Get calls with transcripts for this lead
      const calls = await prisma.call.findMany({
        where: { leadId, transcriptText: { not: null } },
      });

      if (calls.length === 0) {
        return res.status(400).json({ error: 'No transcripts available for extraction' });
      }

      // Stub: In production, this would use an LLM to extract structured data
      const extractedAnswers = {
        extracted_from_calls: true,
        call_count: calls.length,
        ai_extracted: {
          contact_reason: 'Legal consultation requested',
          urgency_level: 'medium',
          extraction_date: new Date().toISOString(),
        },
      };

      // Merge into existing intake answers
      const intake = await prisma.intake.findUnique({ where: { leadId } });
      if (intake) {
        const existingAnswers = (intake.answers as Record<string, any>) || {};
        await prisma.intake.update({
          where: { leadId },
          data: {
            answers: { ...existingAnswers, ...extractedAnswers },
          },
        });
      }

      // Update lead summary if empty
      if (!lead.summary) {
        await prisma.lead.update({
          where: { id: leadId },
          data: {
            summary: `[AI EXTRACTED] Lead from ${calls.length} call(s). Contact reason: Legal consultation requested.`,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.userId,
          actorType: 'user',
          action: 'ai.extract.stub',
          entityType: 'lead',
          entityId: leadId,
          details: { provider: 'stub', callCount: calls.length },
        },
      });

      console.log(`[AI PIPELINE STUB] extraction completed for lead ${leadId}`);
      res.json({ success: true, message: 'Extraction stub completed', extractedAnswers });
    } catch (error) {
      console.error('Extraction error:', error);
      res.status(500).json({ error: 'Failed to extract' });
    }
  });

  // Stub: AI scoring job (runs qualification scoring using shared helper)
  app.post('/v1/ai/score/:leadId', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const { leadId } = req.params;

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, orgId: user.orgId },
        include: {
          contact: true,
          practiceArea: true,
        },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // Fetch intake for this lead
      const intake = await prisma.intake.findUnique({
        where: { leadId },
      });

      // Fetch calls for this lead
      const calls = await prisma.call.findMany({
        where: { leadId },
      });

      // Use shared scoring helper (same as qualification run)
      const { score, disposition, confidence, reasons } = generateQualificationReasons(
        lead,
        intake,
        calls
      );

      // Audit log with consistent entityType/entityId
      await prisma.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.userId,
          actorType: 'user',
          action: 'ai.score.stub',
          entityType: 'lead',
          entityId: leadId,
          details: { score, disposition, confidence },
        },
      });

      console.log(
        `[AI PIPELINE STUB] scoring completed for lead ${leadId}: score=${score}, disposition=${disposition}`
      );
      res.json({
        success: true,
        message: 'Scoring stub completed',
        result: { score, disposition, confidence, reasons },
      });
    } catch (error) {
      console.error('Scoring error:', error);
      res.status(500).json({ error: 'Failed to score' });
    }
  });

  // ============================================
  // EXPERIMENTS API (Conversion Lab)
  // ============================================

  // Deterministic variant assignment using hash
  function assignVariant(leadId: string, experimentId: string, variants: string[]): string {
    const hash = crypto.createHash('sha256').update(`${experimentId}:${leadId}`).digest('hex');
    const index = parseInt(hash.slice(0, 8), 16) % variants.length;
    return variants[index];
  }

  /**
   * @openapi
   * /v1/experiments:
   *   get:
   *     summary: List experiments
   *     tags: [Experiments]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of experiments
   *   post:
   *     summary: Create experiment
   *     tags: [Experiments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               kind:
   *                 type: string
   *                 enum: [intake_script, qualification_rules, follow_up_timing]
   *               config:
   *                 type: object
   *     responses:
   *       201:
   *         description: Created experiment
   */
  // GET /v1/experiments - List experiments
  app.get('/v1/experiments', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const experiments = await prisma.experiment.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { assignments: true } },
        },
      });
      res.json(
        experiments.map((e) => ({
          ...e,
          assignmentsCount: e._count.assignments,
          _count: undefined,
        }))
      );
    } catch (error) {
      console.error('List experiments error:', error);
      res.status(500).json({ error: 'Failed to list experiments' });
    }
  });

  // POST /v1/experiments - Create experiment
  app.post('/v1/experiments', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { name, description, kind, config } = req.body;

      if (!name || !kind || !config) {
        return res.status(400).json({ error: 'name, kind, and config required' });
      }

      const experiment = await prisma.experiment.create({
        data: { orgId, name, description, kind, config, status: 'draft' },
      });

      await prisma.auditLog.create({
        data: {
          orgId,
          actorUserId: req.user!.userId,
          actorType: 'user',
          action: 'experiment.create',
          entityType: 'experiment',
          entityId: experiment.id,
          details: { name, kind },
        },
      });

      res.status(201).json(experiment);
    } catch (error) {
      console.error('Create experiment error:', error);
      res.status(500).json({ error: 'Failed to create experiment' });
    }
  });

  // GET /v1/experiments/:id - Get experiment details
  app.get('/v1/experiments/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const experiment = await prisma.experiment.findFirst({
        where: { id, orgId },
        include: {
          _count: { select: { assignments: true } },
        },
      });

      if (!experiment) {
        return res.status(404).json({ error: 'Experiment not found' });
      }

      res.json({
        ...experiment,
        assignmentsCount: experiment._count.assignments,
        _count: undefined,
      });
    } catch (error) {
      console.error('Get experiment error:', error);
      res.status(500).json({ error: 'Failed to get experiment' });
    }
  });

  // PATCH /v1/experiments/:id - Update experiment
  app.patch('/v1/experiments/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;
      const { name, description, kind, config } = req.body;

      const existing = await prisma.experiment.findFirst({
        where: { id, orgId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Experiment not found' });
      }

      if (existing.status === 'running') {
        return res.status(400).json({ error: 'Cannot edit running experiment' });
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (kind !== undefined) updateData.kind = kind;
      if (config !== undefined) updateData.config = config;

      const experiment = await prisma.experiment.update({
        where: { id },
        data: updateData,
      });

      res.json(experiment);
    } catch (error) {
      console.error('Update experiment error:', error);
      res.status(500).json({ error: 'Failed to update experiment' });
    }
  });

  // POST /v1/experiments/:id/start - Start experiment
  app.post('/v1/experiments/:id/start', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const existing = await prisma.experiment.findFirst({
        where: { id, orgId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Experiment not found' });
      }

      if (existing.status === 'running') {
        return res.status(400).json({ error: 'Experiment already running' });
      }

      const experiment = await prisma.experiment.update({
        where: { id },
        data: { status: 'running', startedAt: new Date(), pausedAt: null },
      });

      await prisma.auditLog.create({
        data: {
          orgId,
          actorUserId: req.user!.userId,
          actorType: 'user',
          action: 'experiment.start',
          entityType: 'experiment',
          entityId: id,
          details: {},
        },
      });

      res.json(experiment);
    } catch (error) {
      console.error('Start experiment error:', error);
      res.status(500).json({ error: 'Failed to start experiment' });
    }
  });

  // POST /v1/experiments/:id/pause - Pause experiment
  app.post('/v1/experiments/:id/pause', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const existing = await prisma.experiment.findFirst({
        where: { id, orgId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Experiment not found' });
      }

      if (existing.status !== 'running') {
        return res.status(400).json({ error: 'Experiment is not running' });
      }

      const experiment = await prisma.experiment.update({
        where: { id },
        data: { status: 'paused', pausedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          orgId,
          actorUserId: req.user!.userId,
          actorType: 'user',
          action: 'experiment.pause',
          entityType: 'experiment',
          entityId: id,
          details: {},
        },
      });

      res.json(experiment);
    } catch (error) {
      console.error('Pause experiment error:', error);
      res.status(500).json({ error: 'Failed to pause experiment' });
    }
  });

  // POST /v1/experiments/:id/end - End experiment
  app.post('/v1/experiments/:id/end', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const existing = await prisma.experiment.findFirst({
        where: { id, orgId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Experiment not found' });
      }

      if (existing.status === 'ended') {
        return res.status(400).json({ error: 'Experiment already ended' });
      }

      const experiment = await prisma.experiment.update({
        where: { id },
        data: { status: 'ended', endedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          orgId,
          actorUserId: req.user!.userId,
          actorType: 'user',
          action: 'experiment.end',
          entityType: 'experiment',
          entityId: id,
          details: {},
        },
      });

      res.json(experiment);
    } catch (error) {
      console.error('End experiment error:', error);
      res.status(500).json({ error: 'Failed to end experiment' });
    }
  });

  // POST /v1/experiments/:id/assign - Assign lead to experiment
  app.post('/v1/experiments/:id/assign', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;
      const { leadId } = req.body;

      if (!leadId) {
        return res.status(400).json({ error: 'leadId required' });
      }

      const experiment = await prisma.experiment.findFirst({
        where: { id, orgId, status: 'running' },
      });

      if (!experiment) {
        return res.status(404).json({ error: 'Running experiment not found' });
      }

      // Check if already assigned
      const existing = await prisma.experimentAssignment.findUnique({
        where: { experimentId_leadId: { experimentId: id, leadId } },
      });

      if (existing) {
        return res.json({ variant: existing.variant, alreadyAssigned: true });
      }

      // Get variants from config
      const config = experiment.config as { variants?: string[] };
      const variants = config.variants || ['control', 'variant_a'];

      // Deterministic assignment
      const variant = assignVariant(leadId, id, variants);

      const assignment = await prisma.experimentAssignment.create({
        data: { orgId, experimentId: id, leadId, variant },
      });

      res.json({ variant: assignment.variant, alreadyAssigned: false });
    } catch (error) {
      console.error('Assign experiment error:', error);
      res.status(500).json({ error: 'Failed to assign experiment' });
    }
  });

  // GET /v1/experiments/:id/report - Get experiment report
  app.get('/v1/experiments/:id/report', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const experiment = await prisma.experiment.findFirst({
        where: { id, orgId },
      });

      if (!experiment) {
        return res.status(404).json({ error: 'Experiment not found' });
      }

      // Get assignment counts per variant
      const assignments = await prisma.experimentAssignment.groupBy({
        by: ['variant'],
        where: { experimentId: id },
        _count: { _all: true },
      });

      // Get conversion data by joining with qualifications
      const variantStats: Record<
        string,
        { leads: number; conversions: number; avgScore: number | null }
      > = {};

      for (const a of assignments) {
        const assignedLeads = await prisma.experimentAssignment.findMany({
          where: { experimentId: id, variant: a.variant },
          select: { leadId: true },
        });

        const leadIds = assignedLeads.map((al) => al.leadId);

        const qualifications = await prisma.qualification.findMany({
          where: { leadId: { in: leadIds }, disposition: 'accept' },
        });

        const allQualifications = await prisma.qualification.findMany({
          where: { leadId: { in: leadIds } },
        });

        const avgScore =
          allQualifications.length > 0
            ? allQualifications.reduce((sum, q) => sum + q.score, 0) / allQualifications.length
            : null;

        variantStats[a.variant] = {
          leads: a._count._all,
          conversions: qualifications.length,
          avgScore,
        };
      }

      // Get daily metrics
      const dailyMetrics = await prisma.experimentMetricsDaily.findMany({
        where: { experimentId: id },
        orderBy: { date: 'asc' },
      });

      res.json({
        experimentId: id,
        name: experiment.name,
        status: experiment.status,
        startedAt: experiment.startedAt,
        endedAt: experiment.endedAt,
        variantStats,
        dailyMetrics,
        totalAssignments: assignments.reduce((sum, a) => sum + a._count._all, 0),
      });
    } catch (error) {
      console.error('Get experiment report error:', error);
      res.status(500).json({ error: 'Failed to get report' });
    }
  });

  // Auto-assign lead to running experiments (internal helper)
  async function autoAssignExperiments(orgId: string, leadId: string) {
    try {
      const runningExperiments = await prisma.experiment.findMany({
        where: { orgId, status: 'running' },
      });

      for (const experiment of runningExperiments) {
        const config = experiment.config as { variants?: string[] };
        const variants = config.variants || ['control', 'variant_a'];

        // Skip if variants array is empty
        if (!variants.length) {
          console.warn(`[EXPERIMENT] Skipping ${experiment.id}: no variants configured`);
          continue;
        }

        const variant = assignVariant(leadId, experiment.id, variants);

        await prisma.experimentAssignment.upsert({
          where: { experimentId_leadId: { experimentId: experiment.id, leadId } },
          update: {},
          create: { orgId, experimentId: experiment.id, leadId, variant },
        });

        console.log(
          `[EXPERIMENT] Auto-assigned lead ${leadId} to experiment ${experiment.id} variant=${variant}`
        );
      }
    } catch (error) {
      console.error('[EXPERIMENT] Auto-assign error:', error);
    }
  }

  // ============================================
  // POLICY TESTS API (Compliance Regression)
  // ============================================

  /**
   * @openapi
   * /v1/policy-tests/suites:
   *   get:
   *     summary: List policy test suites
   *     tags: [Policy Tests]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of test suites
   *   post:
   *     summary: Create policy test suite
   *     tags: [Policy Tests]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       201:
   *         description: Created test suite
   * /v1/policy-tests/suites/{id}/run:
   *   post:
   *     summary: Run policy test suite
   *     tags: [Policy Tests]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Test run results
   * /v1/policy-tests/runs:
   *   get:
   *     summary: Get policy test run history
   *     tags: [Policy Tests]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of test runs
   * /v1/followup-sequences:
   *   get:
   *     summary: List follow-up sequences
   *     tags: [Follow-up]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of follow-up sequences
   *   post:
   *     summary: Create follow-up sequence
   *     tags: [Follow-up]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       201:
   *         description: Created follow-up sequence
   */
  // GET /v1/policy-tests/suites - List suites
  app.get('/v1/policy-tests/suites', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const suites = await prisma.policyTestSuite.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        include: {
          runs: {
            orderBy: { startedAt: 'desc' },
            take: 1,
          },
        },
      });

      res.json(
        suites.map((s) => ({
          ...s,
          lastRun: s.runs[0] || null,
          runs: undefined,
        }))
      );
    } catch (error) {
      console.error('List policy suites error:', error);
      res.status(500).json({ error: 'Failed to list suites' });
    }
  });

  // POST /v1/policy-tests/suites - Create suite
  app.post('/v1/policy-tests/suites', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { name, description, testCases } = req.body;

      if (!name || !testCases || !Array.isArray(testCases)) {
        return res.status(400).json({ error: 'name and testCases array required' });
      }

      const suite = await prisma.policyTestSuite.create({
        data: { orgId, name, description, testCases },
      });

      await createAuditLog(
        orgId,
        req.user!.userId,
        'user',
        'policy_test_suite.create',
        'policy_test_suite',
        suite.id,
        { name, testCasesCount: testCases.length }
      );

      res.status(201).json(suite);
    } catch (error) {
      console.error('Create policy suite error:', error);
      res.status(500).json({ error: 'Failed to create suite' });
    }
  });

  // GET /v1/policy-tests/suites/:id - Get suite
  app.get('/v1/policy-tests/suites/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const suite = await prisma.policyTestSuite.findFirst({
        where: { id, orgId },
      });

      if (!suite) {
        return res.status(404).json({ error: 'Suite not found' });
      }

      res.json(suite);
    } catch (error) {
      console.error('Get policy suite error:', error);
      res.status(500).json({ error: 'Failed to get suite' });
    }
  });

  // PATCH /v1/policy-tests/suites/:id - Update suite
  app.patch(
    '/v1/policy-tests/suites/:id',
    authMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const orgId = req.user!.orgId;
        const { id } = req.params;
        const { name, description, testCases, active } = req.body;

        const existing = await prisma.policyTestSuite.findFirst({
          where: { id, orgId },
        });

        if (!existing) {
          return res.status(404).json({ error: 'Suite not found' });
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (testCases !== undefined) updateData.testCases = testCases;
        if (active !== undefined) updateData.active = active;

        const suite = await prisma.policyTestSuite.update({
          where: { id },
          data: updateData,
        });

        res.json(suite);
      } catch (error) {
        console.error('Update policy suite error:', error);
        res.status(500).json({ error: 'Failed to update suite' });
      }
    }
  );

  // DELETE /v1/policy-tests/suites/:id - Delete suite
  app.delete(
    '/v1/policy-tests/suites/:id',
    authMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const orgId = req.user!.orgId;
        const { id } = req.params;

        const existing = await prisma.policyTestSuite.findFirst({
          where: { id, orgId },
        });

        if (!existing) {
          return res.status(404).json({ error: 'Suite not found' });
        }

        await prisma.policyTestSuite.delete({ where: { id } });
        res.status(204).send();
      } catch (error) {
        console.error('Delete policy suite error:', error);
        res.status(500).json({ error: 'Failed to delete suite' });
      }
    }
  );

  // POST /v1/policy-tests/suites/:id/run - Run policy test suite
  app.post(
    '/v1/policy-tests/suites/:id/run',
    authMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const orgId = req.user!.orgId;
        const { id } = req.params;

        const suite = await prisma.policyTestSuite.findFirst({
          where: { id, orgId },
        });

        if (!suite) {
          return res.status(404).json({ error: 'Suite not found' });
        }

        const testCases = suite.testCases as Array<{
          id: string;
          name: string;
          input: Record<string, unknown>;
          expectedDisposition: string;
          expectedMinScore?: number;
        }>;

        // Run each test case
        const results: Array<{
          testId: string;
          name: string;
          passed: boolean;
          actualDisposition?: string;
          actualScore?: number;
          error?: string;
        }> = [];

        for (const tc of testCases) {
          try {
            // Simulate qualification scoring based on input
            const mockLead = tc.input as {
              contact?: { phone?: string; email?: string };
              practiceArea?: boolean;
              intake?: { complete?: boolean; answers?: Record<string, unknown> };
              calls?: number;
            };

            let score = 0;

            // Contact info scoring (20 points)
            if (mockLead.contact?.phone) score += 10;
            if (mockLead.contact?.email) score += 10;

            // Practice area (15 points)
            if (mockLead.practiceArea) score += 15;

            // Intake completion (25 points)
            if (mockLead.intake?.complete) score += 25;
            else if (mockLead.intake?.answers && Object.keys(mockLead.intake.answers).length > 0)
              score += 10;

            // Incident details (20 points)
            if (mockLead.intake?.answers) {
              const answers = mockLead.intake.answers;
              if (answers.incidentDate) score += 10;
              if (answers.incidentLocation) score += 10;
            }

            // Communication history (20 points)
            if (mockLead.calls && mockLead.calls > 0) score += Math.min(mockLead.calls * 10, 20);

            let disposition = 'review';
            if (score >= 70) disposition = 'accept';
            else if (score < 30) disposition = 'decline';

            const passed =
              disposition === tc.expectedDisposition &&
              (tc.expectedMinScore === undefined || score >= tc.expectedMinScore);

            results.push({
              testId: tc.id,
              name: tc.name,
              passed,
              actualDisposition: disposition,
              actualScore: score,
            });
          } catch (err) {
            results.push({
              testId: tc.id,
              name: tc.name,
              passed: false,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }

        const passedCount = results.filter((r) => r.passed).length;
        const failedCount = results.filter((r) => !r.passed).length;
        const status = failedCount === 0 ? 'passed' : 'failed';

        const run = await prisma.policyTestRun.create({
          data: {
            orgId,
            suiteId: id,
            status,
            results,
            summary: { passedCount, failedCount, totalCount: results.length },
            endedAt: new Date(),
          },
        });

        await prisma.auditLog.create({
          data: {
            orgId,
            actorUserId: req.user!.userId,
            actorType: 'user',
            action: 'policy_test.run',
            entityType: 'policy_test_suite',
            entityId: id,
            details: { runId: run.id, status, passedCount, failedCount },
          },
        });

        res.json(run);
      } catch (error) {
        console.error('Run policy test error:', error);
        res.status(500).json({ error: 'Failed to run tests' });
      }
    }
  );

  // GET /v1/policy-tests/runs - Get run history
  app.get('/v1/policy-tests/runs', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const suiteId = req.query.suite_id as string | undefined;

      const where: { orgId: string; suiteId?: string } = { orgId };
      if (suiteId) where.suiteId = suiteId;

      const runs = await prisma.policyTestRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: 50,
        include: {
          suite: { select: { name: true } },
        },
      });

      res.json(runs);
    } catch (error) {
      console.error('Get policy runs error:', error);
      res.status(500).json({ error: 'Failed to get runs' });
    }
  });

  // ============================================
  // FOLLOW-UP SEQUENCES API
  // ============================================

  // GET /v1/followup-sequences - List sequences
  app.get('/v1/followup-sequences', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const sequences = await prisma.followupSequence.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
      });
      res.json(sequences);
    } catch (error) {
      console.error('List followup sequences error:', error);
      res.status(500).json({ error: 'Failed to list sequences' });
    }
  });

  // POST /v1/followup-sequences - Create sequence
  app.post('/v1/followup-sequences', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { name, description, trigger, steps, stopRules } = req.body;

      if (!name || !trigger || !steps || !Array.isArray(steps)) {
        return res.status(400).json({ error: 'name, trigger, and steps array required' });
      }

      const sequence = await prisma.followupSequence.create({
        data: { orgId, name, description, trigger, steps, stopRules },
      });

      await createAuditLog(
        orgId,
        req.user!.userId,
        'user',
        'followup_sequence.create',
        'followup_sequence',
        sequence.id,
        { name, trigger, stepsCount: steps.length }
      );

      res.status(201).json(sequence);
    } catch (error) {
      console.error('Create followup sequence error:', error);
      res.status(500).json({ error: 'Failed to create sequence' });
    }
  });

  // GET /v1/followup-sequences/:id - Get sequence
  app.get('/v1/followup-sequences/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const sequence = await prisma.followupSequence.findFirst({
        where: { id, orgId },
      });

      if (!sequence) {
        return res.status(404).json({ error: 'Sequence not found' });
      }

      res.json(sequence);
    } catch (error) {
      console.error('Get followup sequence error:', error);
      res.status(500).json({ error: 'Failed to get sequence' });
    }
  });

  // PATCH /v1/followup-sequences/:id - Update sequence
  app.patch(
    '/v1/followup-sequences/:id',
    authMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const orgId = req.user!.orgId;
        const { id } = req.params;
        const { name, description, trigger, steps, stopRules, active } = req.body;

        const existing = await prisma.followupSequence.findFirst({
          where: { id, orgId },
        });

        if (!existing) {
          return res.status(404).json({ error: 'Sequence not found' });
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (trigger !== undefined) updateData.trigger = trigger;
        if (steps !== undefined) updateData.steps = steps;
        if (stopRules !== undefined) updateData.stopRules = stopRules;
        if (active !== undefined) updateData.active = active;

        const sequence = await prisma.followupSequence.update({
          where: { id },
          data: updateData,
        });

        res.json(sequence);
      } catch (error) {
        console.error('Update followup sequence error:', error);
        res.status(500).json({ error: 'Failed to update sequence' });
      }
    }
  );

  // DELETE /v1/followup-sequences/:id - Delete sequence
  app.delete(
    '/v1/followup-sequences/:id',
    authMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const orgId = req.user!.orgId;
        const { id } = req.params;

        const existing = await prisma.followupSequence.findFirst({
          where: { id, orgId },
        });

        if (!existing) {
          return res.status(404).json({ error: 'Sequence not found' });
        }

        await prisma.followupSequence.delete({ where: { id } });
        res.status(204).send();
      } catch (error) {
        console.error('Delete followup sequence error:', error);
        res.status(500).json({ error: 'Failed to delete sequence' });
      }
    }
  );

  // POST /v1/leads/:id/followups/trigger - Trigger followup sequence for lead
  app.post(
    '/v1/leads/:id/followups/trigger',
    authMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const orgId = req.user!.orgId;
        const leadId = req.params.id;
        const { sequenceId } = req.body;

        const lead = await prisma.lead.findFirst({
          where: { id: leadId, orgId },
          include: { contact: true },
        });

        if (!lead) {
          return res.status(404).json({ error: 'Lead not found' });
        }

        // Check stop conditions
        if (lead.status === 'disqualified' || lead.status === 'closed') {
          return res.status(400).json({ error: 'Lead is disqualified or closed' });
        }

        let sequence;
        if (sequenceId) {
          sequence = await prisma.followupSequence.findFirst({
            where: { id: sequenceId, orgId, active: true },
          });
        } else {
          // Find first active sequence matching lead_created trigger
          sequence = await prisma.followupSequence.findFirst({
            where: { orgId, active: true, trigger: 'lead_created' },
          });
        }

        if (!sequence) {
          return res.status(404).json({ error: 'No active sequence found' });
        }

        const steps = sequence.steps as Array<{
          delayMinutes: number;
          channel: string;
          templateBody: string;
        }>;
        const createdJobs = [];

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const scheduledAt = new Date(Date.now() + step.delayMinutes * 60 * 1000);

          const job = await prisma.followupJob.create({
            data: {
              orgId,
              sequenceId: sequence.id,
              leadId,
              stepIndex: i,
              scheduledAt,
              status: 'pending',
            },
          });

          createdJobs.push(job);

          // In dev mode, execute the first job immediately if delay is 0
          if (step.delayMinutes === 0 || i === 0) {
            // Schedule execution
            setImmediate(() => executeFollowupJob(job.id));
          } else {
            // Schedule for later (in-memory for V1)
            setTimeout(() => executeFollowupJob(job.id), step.delayMinutes * 60 * 1000);
          }
        }

        await prisma.auditLog.create({
          data: {
            orgId,
            actorUserId: req.user!.userId,
            actorType: 'user',
            action: 'followup.trigger',
            entityType: 'lead',
            entityId: leadId,
            details: { sequenceId: sequence.id, jobsCreated: createdJobs.length },
          },
        });

        res.json({
          sequenceId: sequence.id,
          sequenceName: sequence.name,
          jobsScheduled: createdJobs.length,
          jobs: createdJobs,
        });
      } catch (error) {
        console.error('Trigger followup error:', error);
        res.status(500).json({ error: 'Failed to trigger followup' });
      }
    }
  );

  // Execute a followup job
  async function executeFollowupJob(jobId: string) {
    try {
      const job = await prisma.followupJob.findUnique({
        where: { id: jobId },
        include: { sequence: true },
      });

      if (!job || job.status !== 'pending') {
        console.log(`[FOLLOWUP] Skipping job ${jobId} - not found or not pending`);
        return;
      }

      // Check stop rules
      const lead = await prisma.lead.findUnique({
        where: { id: job.leadId },
        include: { contact: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });

      if (!lead) {
        await prisma.followupJob.update({
          where: { id: jobId },
          data: { status: 'cancelled', cancelReason: 'Lead not found' },
        });
        return;
      }

      // Stop if lead is disqualified or closed
      if (lead.status === 'disqualified' || lead.status === 'closed') {
        await prisma.followupJob.update({
          where: { id: jobId },
          data: { status: 'cancelled', cancelReason: `Lead status: ${lead.status}` },
        });

        // Cancel remaining jobs for this lead in this sequence
        await prisma.followupJob.updateMany({
          where: {
            sequenceId: job.sequenceId,
            leadId: job.leadId,
            status: 'pending',
            stepIndex: { gt: job.stepIndex },
          },
          data: { status: 'cancelled', cancelReason: `Lead status: ${lead.status}` },
        });
        return;
      }

      // Stop if lead has responded (has inbound message after sequence started)
      const latestMessage = lead.messages[0];
      if (
        latestMessage &&
        latestMessage.direction === 'inbound' &&
        latestMessage.createdAt > job.createdAt
      ) {
        await prisma.followupJob.update({
          where: { id: jobId },
          data: { status: 'cancelled', cancelReason: 'Lead responded' },
        });

        // Cancel remaining jobs
        await prisma.followupJob.updateMany({
          where: {
            sequenceId: job.sequenceId,
            leadId: job.leadId,
            status: 'pending',
            stepIndex: { gt: job.stepIndex },
          },
          data: { status: 'cancelled', cancelReason: 'Lead responded' },
        });
        return;
      }

      // Get the step to execute
      const steps = job.sequence.steps as Array<{
        delayMinutes: number;
        channel: string;
        templateBody: string;
      }>;
      const step = steps[job.stepIndex];

      if (!step) {
        await prisma.followupJob.update({
          where: { id: jobId },
          data: { status: 'failed', cancelReason: 'Step not found' },
        });
        return;
      }

      // Send the message (stub - in production would use Twilio or other provider)
      console.log(
        `[FOLLOWUP] Sending ${step.channel} to lead ${job.leadId}: ${step.templateBody.slice(0, 50)}...`
      );

      // Create an interaction and message for the followup
      const interaction = await prisma.interaction.create({
        data: {
          orgId: job.orgId,
          leadId: job.leadId,
          channel: step.channel,
          status: 'completed',
          endedAt: new Date(),
        },
      });

      await prisma.message.create({
        data: {
          orgId: job.orgId,
          leadId: job.leadId,
          interactionId: interaction.id,
          direction: 'outbound',
          channel: step.channel,
          provider: 'followup_sequence',
          from: 'system',
          to: lead.contact.primaryPhone || lead.contact.primaryEmail || 'unknown',
          body: step.templateBody,
        },
      });

      await prisma.followupJob.update({
        where: { id: jobId },
        data: { status: 'sent', sentAt: new Date() },
      });

      console.log(`[FOLLOWUP] Job ${jobId} completed - message sent`);
    } catch (error) {
      console.error(`[FOLLOWUP] Error executing job ${jobId}:`, error);
      await prisma.followupJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          cancelReason: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  // GET /v1/leads/:id/followups - Get followup jobs for a lead
  app.get('/v1/leads/:id/followups', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const leadId = req.params.id;

      const jobs = await prisma.followupJob.findMany({
        where: { orgId, leadId },
        orderBy: { scheduledAt: 'asc' },
        include: {
          sequence: { select: { name: true } },
        },
      });

      res.json(jobs);
    } catch (error) {
      console.error('Get lead followups error:', error);
      res.status(500).json({ error: 'Failed to get followups' });
    }
  });

  // ============================================
  // MOBILE APP ENDPOINTS (v1)
  // ============================================

  /**
   * @openapi
   * /v1/leads/{id}/thread:
   *   get:
   *     summary: Get unified thread for a lead (calls + SMS + events)
   *     tags: [Mobile, Leads]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: cursor
   *         schema:
   *           type: string
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *     responses:
   *       200:
   *         description: Unified thread items
   */
  app.get('/v1/leads/:id/thread', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const leadId = req.params.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const cursor = req.query.cursor as string | undefined;

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, orgId },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // Fetch calls
      const calls = await prisma.call.findMany({
        where: { leadId, orgId },
        orderBy: { startedAt: 'desc' },
        take: limit,
      });

      // Fetch messages
      const messages = await prisma.message.findMany({
        where: { leadId, orgId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // Fetch audit logs for system events
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          orgId,
          entityId: leadId,
          entityType: 'lead',
          action: {
            in: [
              'intake_link_sent',
              'qualification_run',
              'status_changed',
              'lead_created',
              'appointment_booked',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // Normalize and merge into unified thread
      const threadItems: Array<{
        id: string;
        type: string;
        timestamp: string;
        summary: string;
        payload: any;
      }> = [];

      // Add calls
      for (const call of calls) {
        const isMissed = !call.durationSeconds || call.durationSeconds === 0;
        threadItems.push({
          id: call.id,
          type: isMissed ? 'call.missed' : 'call.completed',
          timestamp: call.startedAt.toISOString(),
          summary: isMissed
            ? `Missed ${call.direction} call from ${call.fromE164}`
            : `${call.direction} call - ${call.durationSeconds}s`,
          payload: {
            direction: call.direction,
            from: call.fromE164,
            to: call.toE164,
            duration: call.durationSeconds,
            recordingUrl: call.recordingUrl,
            aiSummary: call.aiSummary,
          },
        });
      }

      // Add messages
      for (const msg of messages) {
        threadItems.push({
          id: msg.id,
          type: msg.direction === 'inbound' ? 'sms.received' : 'sms.sent',
          timestamp: msg.createdAt.toISOString(),
          summary: msg.body.slice(0, 100) + (msg.body.length > 100 ? '...' : ''),
          payload: {
            direction: msg.direction,
            from: msg.from,
            to: msg.to,
            body: msg.body,
            provider: msg.provider,
          },
        });
      }

      // Add system events
      for (const log of auditLogs) {
        let summary = log.action.replace(/_/g, ' ');
        if (log.action === 'intake_link_sent') summary = 'Intake link sent';
        if (log.action === 'qualification_run') summary = 'Qualification completed';
        if (log.action === 'status_changed') summary = 'Status updated';
        if (log.action === 'lead_created') summary = 'Lead created';
        if (log.action === 'appointment_booked') summary = 'Appointment booked';

        threadItems.push({
          id: log.id,
          type: `system.${log.action}`,
          timestamp: log.createdAt.toISOString(),
          summary,
          payload: log.details,
        });
      }

      // Sort by timestamp descending
      threadItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply limit
      const paginatedItems = threadItems.slice(0, limit);

      res.json({
        items: paginatedItems,
        nextCursor:
          paginatedItems.length === limit ? paginatedItems[paginatedItems.length - 1]?.id : null,
      });
    } catch (error) {
      console.error('Get lead thread error:', error);
      res.status(500).json({ error: 'Failed to get thread' });
    }
  });

  /**
   * @openapi
   * /v1/devices/register:
   *   post:
   *     summary: Register device for push notifications
   *     tags: [Mobile, Devices]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [platform, token, deviceId]
   *             properties:
   *               platform:
   *                 type: string
   *                 enum: [ios, android]
   *               token:
   *                 type: string
   *               deviceId:
   *                 type: string
   *               preferences:
   *                 type: object
   *     responses:
   *       200:
   *         description: Device registered
   */
  app.post('/v1/devices/register', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const { platform, token, deviceId, preferences } = req.body;

      if (!platform || !token || !deviceId) {
        return res
          .status(400)
          .json({ error: 'Missing required fields: platform, token, deviceId' });
      }

      if (!['ios', 'android'].includes(platform)) {
        return res.status(400).json({ error: "Platform must be 'ios' or 'android'" });
      }

      const deviceToken = await prisma.deviceToken.upsert({
        where: {
          userId_deviceId: { userId: user.userId, deviceId },
        },
        update: {
          token,
          platform,
          active: true,
          preferences: preferences || {
            hotLeads: true,
            inboundSms: true,
            slaBreaches: true,
            privacyMode: false,
          },
          updatedAt: new Date(),
        },
        create: {
          userId: user.userId,
          orgId: user.orgId,
          platform,
          token,
          deviceId,
          preferences: preferences || {
            hotLeads: true,
            inboundSms: true,
            slaBreaches: true,
            privacyMode: false,
          },
        },
      });

      res.json({ success: true, deviceTokenId: deviceToken.id });
    } catch (error) {
      console.error('Device register error:', error);
      res.status(500).json({ error: 'Failed to register device' });
    }
  });

  /**
   * @openapi
   * /v1/devices/unregister:
   *   post:
   *     summary: Unregister device from push notifications
   *     tags: [Mobile, Devices]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [deviceId]
   *             properties:
   *               deviceId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Device unregistered
   */
  app.post('/v1/devices/unregister', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const { deviceId } = req.body;

      if (!deviceId) {
        return res.status(400).json({ error: 'Missing deviceId' });
      }

      await prisma.deviceToken.updateMany({
        where: { userId: user.userId, deviceId },
        data: { active: false },
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Device unregister error:', error);
      res.status(500).json({ error: 'Failed to unregister device' });
    }
  });

  /**
   * @openapi
   * /v1/devices/debug:
   *   get:
   *     summary: Debug endpoint to verify registered push tokens (admin only)
   *     tags: [Mobile, Devices, Debug]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Token summary for current user's org
   */
  app.get('/v1/devices/debug', authMiddleware, async (req: AuthenticatedRequest, res) => {
    // SECURITY: Disable entirely in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }

    try {
      const user = req.user!;
      
      // Only allow admin/owner roles (dev only)
      if (!['admin', 'owner'].includes(user.role)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Get all device tokens for this org (no secrets exposed)
      const tokens = await prisma.deviceToken.findMany({
        where: { orgId: user.orgId, active: true },
        select: {
          id: true,
          userId: true,
          platform: true,
          deviceId: true,
          preferences: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: { email: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      // Get org user count for context
      const orgUsers = await prisma.user.count({
        where: { orgId: user.orgId }
      });

      // Summary by user
      const byUser: Record<string, { email: string; name: string; tokenCount: number; platforms: string[] }> = {};
      for (const t of tokens) {
        if (!byUser[t.userId]) {
          byUser[t.userId] = {
            email: t.user.email,
            name: t.user.email,
            tokenCount: 0,
            platforms: []
          };
        }
        byUser[t.userId].tokenCount++;
        if (!byUser[t.userId].platforms.includes(t.platform)) {
          byUser[t.userId].platforms.push(t.platform);
        }
      }

      res.json({
        orgId: user.orgId,
        totalActiveTokens: tokens.length,
        totalOrgUsers: orgUsers,
        usersWithTokens: Object.keys(byUser).length,
        byUser,
        tokens: tokens.map(t => ({
          id: t.id,
          userId: t.userId,
          userEmail: t.user.email,
          platform: t.platform,
          deviceId: t.deviceId.substring(0, 8) + '...',
          tokenPrefix: '...',  // Don't expose actual token
          preferences: t.preferences,
          registeredAt: t.createdAt,
          lastUpdated: t.updatedAt
        }))
      });
    } catch (error) {
      console.error('Device debug error:', error);
      res.status(500).json({ error: 'Failed to fetch device tokens' });
    }
  });

  /**
   * @openapi
   * /v1/leads/{id}/messages:
   *   post:
   *     summary: Send SMS to lead (with DNC enforcement)
   *     tags: [Mobile, Messaging]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [body]
   *             properties:
   *               body:
   *                 type: string
   *               templateId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Message sent
   *       409:
   *         description: Lead is on DNC list
   */
  app.post('/v1/leads/:id/messages', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const leadId = req.params.id;
      const { body } = req.body;

      if (!body || typeof body !== 'string' || body.trim().length === 0) {
        return res.status(400).json({ error: 'Message body is required' });
      }

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, orgId: user.orgId },
        include: { contact: true },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // DNC enforcement
      if (lead.dnc) {
        return res.status(409).json({
          error: 'Cannot send message - lead is on Do Not Contact list',
          dncReason: lead.dncReason,
          dncAt: lead.dncAt,
        });
      }

      if (!lead.contact.primaryPhone) {
        return res.status(400).json({ error: 'Lead has no phone number' });
      }

      // Get org's primary phone number for sending
      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        include: { phoneNumbers: { where: { inboundEnabled: true }, take: 1 } },
      });

      const fromNumber = org?.phoneNumbers[0]?.e164 || '+18443214257';

      // Create interaction
      const interaction = await prisma.interaction.create({
        data: {
          orgId: user.orgId,
          leadId,
          channel: 'sms',
          status: 'completed',
          endedAt: new Date(),
        },
      });

      // Create message record
      const message = await prisma.message.create({
        data: {
          orgId: user.orgId,
          leadId,
          interactionId: interaction.id,
          direction: 'outbound',
          channel: 'sms',
          provider: 'manual',
          from: fromNumber,
          to: lead.contact.primaryPhone,
          body: body.trim(),
        },
      });

      // Update lead activity
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          lastActivityAt: new Date(),
          lastHumanResponseAt: new Date(),
          status: lead.status === 'new' ? 'engaged' : lead.status,
        },
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.userId,
          actorType: 'user',
          action: 'outbound_sms_sent',
          entityType: 'message',
          entityId: message.id,
          details: { to: lead.contact.primaryPhone, bodyPreview: body.slice(0, 100) },
        },
      });

      res.json({
        success: true,
        messageId: message.id,
        status: 'sent',
      });
    } catch (error) {
      console.error('Send SMS error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  /**
   * @openapi
   * /v1/telephony/status:
   *   get:
   *     summary: Get telephony provider status
   *     tags: [Telephony]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Telephony status
   */
  app.get('/v1/telephony/status', authMiddleware, async (_req: AuthenticatedRequest, res) => {
    try {
      const status = getTelephonyStatus();
      res.json(status);
    } catch (error) {
      console.error('Get telephony status error:', error);
      res.status(500).json({ error: 'Failed to get telephony status' });
    }
  });

  /**
   * @openapi
   * /v1/calls/{callId}:
   *   get:
   *     summary: Get call status by ID
   *     tags: [Calls]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: callId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Call status
   */
  app.get('/v1/calls/:callId', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const callId = req.params.callId;

      const call = await prisma.call.findFirst({
        where: { id: callId, orgId: user.orgId },
        include: { interaction: true },
      });

      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }

      const status = mapDbStatusToCanonical(call.interaction?.status || null);
      const duration = calculateDurationSeconds(call.startedAt, call.endedAt, call.durationSeconds);

      res.json({
        id: call.id,
        status,
        provider: call.provider,
        duration,
        direction: call.direction,
        callOutcome: call.callOutcome,
        endReason: call.endReason,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        recordingUrl: call.recordingUrl,
        transcriptText: call.transcriptText,
        transcriptJson: call.transcriptJson,
        aiSummary: call.aiSummary,
        structuredData: call.structuredData,
        successEvaluation: call.successEvaluation,
        messagesJson: call.messagesJson,
        aiFlags: call.aiFlags,
        leadId: call.leadId,
        fromE164: call.fromE164,
        toE164: call.toE164,
      });
    } catch (error) {
      console.error('Get call status error:', error);
      res.status(500).json({ error: 'Failed to get call status' });
    }
  });

  /**
   * @openapi
   * /v1/calls/outcome:
   *   post:
   *     summary: Log manual call outcome
   *     tags: [Calls]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               callId:
   *                 type: string
   *               leadId:
   *                 type: string
   *               outcome:
   *                 type: string
   *               notes:
   *                 type: string
   *     responses:
   *       200:
   *         description: Outcome logged
   */
  app.post('/v1/calls/outcome', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const { callId, leadId, outcome, notes } = req.body;

      if (!outcome) {
        return res.status(400).json({ error: 'Outcome is required' });
      }

      const normalizedOutcome = normalizeOutcome(outcome);
      let resolvedCall: {
        id: string;
        provider: string;
        startedAt: Date;
        endedAt: Date | null;
        interaction: { id: string; status: string } | null;
      } | null = null;

      if (callId) {
        resolvedCall = await prisma.call.findFirst({
          where: { id: callId, orgId: user.orgId },
          include: { interaction: true },
        });
      } else if (leadId) {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        resolvedCall = await prisma.call.findFirst({
          where: {
            leadId,
            orgId: user.orgId,
            createdAt: { gte: twoHoursAgo },
            interaction: {
              status: { in: ['queued', 'ringing', 'in-progress', 'active'] },
            },
          },
          include: { interaction: true },
          orderBy: { createdAt: 'desc' },
        });

        if (!resolvedCall) {
          resolvedCall = await prisma.call.findFirst({
            where: {
              leadId,
              orgId: user.orgId,
              createdAt: { gte: twoHoursAgo },
            },
            include: { interaction: true },
            orderBy: { createdAt: 'desc' },
          });
        }
      }

      await prisma.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.userId,
          actorType: 'user',
          action: 'call_outcome_logged',
          entityType: resolvedCall ? 'call' : leadId ? 'lead' : 'system',
          entityId: resolvedCall?.id || leadId || 'manual_log',
          details: {
            outcome: normalizedOutcome,
            notes: notes || null,
            source: 'manual',
            provider: resolvedCall?.provider || null,
            callId: resolvedCall?.id || null,
            leadId: leadId || null,
            timestamp: new Date().toISOString(),
          },
        },
      });

      let updatedCallId: string | undefined;

      if (resolvedCall) {
        const interactionStatus = resolvedCall.interaction?.status || null;
        const isTerminal = isTerminalStatus(interactionStatus);
        const now = new Date();

        const callUpdateData: {
          callOutcome: string;
          endedAt?: Date;
          durationSeconds?: number;
        } = {
          callOutcome: normalizedOutcome,
        };

        if (!isTerminal) {
          callUpdateData.endedAt = now;
          if (resolvedCall.startedAt) {
            callUpdateData.durationSeconds = Math.floor(
              (now.getTime() - resolvedCall.startedAt.getTime()) / 1000
            );
          }
        } else if (!resolvedCall.endedAt) {
          callUpdateData.endedAt = now;
        }

        await prisma.call.update({
          where: { id: resolvedCall.id },
          data: callUpdateData,
        });

        if (!isTerminal && resolvedCall.interaction) {
          await prisma.interaction.update({
            where: { id: resolvedCall.interaction.id },
            data: { status: 'completed', endedAt: now },
          });
        }

        updatedCallId = resolvedCall.id;
      }

      if (leadId) {
        await prisma.lead
          .update({
            where: { id: leadId, orgId: user.orgId },
            data: {
              lastActivityAt: new Date(),
              lastHumanResponseAt: new Date(),
            },
          })
          .catch(() => {});
      }

      if (outcomeRequiresFollowup(normalizedOutcome)) {
        await prisma.auditLog.create({
          data: {
            orgId: user.orgId,
            actorUserId: user.userId,
            actorType: 'system',
            action: 'followup_automation_check',
            entityType: resolvedCall ? 'call' : leadId ? 'lead' : 'system',
            entityId: resolvedCall?.id || leadId || 'manual_log',
            details: {
              outcome: normalizedOutcome,
              followup_enqueued: false,
              followup_reason: 'not_implemented',
            },
          },
        });
      }

      res.json({ ok: true, updatedCallId });
    } catch (error) {
      console.error('Log call outcome error:', error);
      res.status(500).json({ error: 'Failed to log call outcome' });
    }
  });

  /**
   * @openapi
   * /v1/leads/{id}/call/start:
   *   post:
   *     summary: Start tap-to-call (logs attempt, returns dial instructions)
   *     tags: [Mobile, Calls]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Dial instructions with provider and callId
   */
  app.post('/v1/leads/:id/call/start', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const leadId = req.params.id;
      const provider = getActiveProvider();
      const DEFAULT_CALLER_ID = '+18443214257';

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, orgId: user.orgId },
        include: { contact: true },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      if (!lead.contact.primaryPhone) {
        return res.status(400).json({ error: 'Lead has no phone number' });
      }

      const org = await prisma.organization.findUnique({
        where: { id: user.orgId },
        include: { phoneNumbers: { where: { inboundEnabled: true }, take: 1 } },
      });

      const phoneNumber = org?.phoneNumbers[0];
      const firmCallerId = phoneNumber?.e164 || DEFAULT_CALLER_ID;

      const interaction = await prisma.interaction.create({
        data: {
          orgId: user.orgId,
          leadId,
          channel: 'call',
          status: 'queued',
          metadata: { initiatedBy: user.userId, type: 'tap_to_call', provider },
        },
      });

      let callId: string | null = null;

      if (phoneNumber) {
        const call = await prisma.call.create({
          data: {
            orgId: user.orgId,
            leadId,
            interactionId: interaction.id,
            phoneNumberId: phoneNumber.id,
            direction: 'outbound',
            provider,
            fromE164: firmCallerId,
            toE164: lead.contact.primaryPhone,
            startedAt: new Date(),
          },
        });
        callId = call.id;
      }

      await prisma.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.userId,
          actorType: 'user',
          action: 'outbound_call_initiated',
          entityType: 'interaction',
          entityId: interaction.id,
          details: { to: lead.contact.primaryPhone, firmCallerId, provider, callId },
        },
      });

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          lastActivityAt: new Date(),
          status: lead.status === 'new' ? 'engaged' : lead.status,
        },
      });

      res.json({
        dialTo: lead.contact.primaryPhone,
        firmCallerId,
        provider,
        callId,
        interactionId: interaction.id,
      });
    } catch (error) {
      console.error('Start call error:', error);
      res.status(500).json({ error: 'Failed to start call' });
    }
  });

  /**
   * @openapi
   * /v1/leads/{id}/intake/link:
   *   post:
   *     summary: Generate secure intake link for lead
   *     tags: [Mobile, Intake]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Intake link generated
   */
  app.post('/v1/leads/:id/intake/link', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const leadId = req.params.id;

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, orgId: user.orgId },
        include: { contact: true },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await prisma.leadPortalToken.create({
        data: {
          orgId: user.orgId,
          leadId,
          token,
          purpose: 'intake',
          expiresAt,
        },
      });

      // Log the event
      await prisma.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.userId,
          actorType: 'user',
          action: 'intake_link_sent',
          entityType: 'lead',
          entityId: leadId,
          details: { expiresAt: expiresAt.toISOString() },
        },
      });

      // Update lead
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          lastActivityAt: new Date(),
          nextStep: 'Complete intake form',
        },
      });

      const baseUrl = process.env.PUBLIC_BASE_URL || 'https://casecurrent.co';
      const intakeLink = `${baseUrl}/p/${token}/intake`;

      res.json({
        success: true,
        intakeLink,
        expiresAt: expiresAt.toISOString(),
        token,
      });
    } catch (error) {
      console.error('Generate intake link error:', error);
      res.status(500).json({ error: 'Failed to generate intake link' });
    }
  });

  /**
   * @openapi
   * /v1/leads/{id}/status:
   *   post:
   *     summary: Update lead status
   *     tags: [Mobile, Leads]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status:
   *                 type: string
   *     responses:
   *       200:
   *         description: Status updated
   */
  app.post('/v1/leads/:id/status', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const leadId = req.params.id;
      const { status } = req.body;

      const validStatuses = [
        'new',
        'engaged',
        'intake_started',
        'intake_complete',
        'qualified',
        'not_qualified',
        'consult_set',
        'retained',
        'closed',
        'referred',
      ];

      if (!status || !validStatuses.includes(status)) {
        return res
          .status(400)
          .json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, orgId: user.orgId },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const oldStatus = lead.status;

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          status,
          lastActivityAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.userId,
          actorType: 'user',
          action: 'status_changed',
          entityType: 'lead',
          entityId: leadId,
          details: { oldStatus, newStatus: status },
        },
      });

      res.json({ success: true, oldStatus, newStatus: status });
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({ error: 'Failed to update status' });
    }
  });

  /**
   * @openapi
   * /v1/leads/{id}/assign:
   *   post:
   *     summary: Assign lead to user
   *     tags: [Mobile, Leads]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               userId:
   *                 type: string
   *                 description: User ID to assign, or null to unassign
   *     responses:
   *       200:
   *         description: Lead assigned
   */
  app.post('/v1/leads/:id/assign', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const leadId = req.params.id;
      const { userId } = req.body;

      const lead = await prisma.lead.findFirst({
        where: { id: leadId, orgId: user.orgId },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // If userId provided, verify user exists in org
      if (userId) {
        const assignee = await prisma.user.findFirst({
          where: { id: userId, orgId: user.orgId },
        });
        if (!assignee) {
          return res.status(400).json({ error: 'User not found in organization' });
        }
      }

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          ownerUserId: userId || null,
          lastActivityAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          orgId: user.orgId,
          actorUserId: user.userId,
          actorType: 'user',
          action: 'lead_assigned',
          entityType: 'lead',
          entityId: leadId,
          details: { assignedTo: userId },
        },
      });

      res.json({ success: true, assignedTo: userId });
    } catch (error) {
      console.error('Assign lead error:', error);
      res.status(500).json({ error: 'Failed to assign lead' });
    }
  });

  /**
   * @openapi
   * /v1/analytics/summary:
   *   get:
   *     summary: Get analytics summary for mobile dashboard
   *     tags: [Mobile, Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: range
   *         schema:
   *           type: string
   *           enum: [7d, 30d]
   *           default: 7d
   *     responses:
   *       200:
   *         description: Analytics summary
   */
  app.get('/v1/analytics/summary', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const range = req.query.range === '30d' ? 30 : 7;
      const startDate = new Date(Date.now() - range * 24 * 60 * 60 * 1000);

      // Get leads created in period
      const leadsCreated = await prisma.lead.count({
        where: { orgId: user.orgId, createdAt: { gte: startDate } },
      });

      // Get qualified leads
      const qualifiedLeads = await prisma.qualification.count({
        where: {
          orgId: user.orgId,
          createdAt: { gte: startDate },
          disposition: 'accept',
        },
      });

      // Get missed calls (leads from calls with no duration)
      const missedCallLeads = await prisma.lead.count({
        where: {
          orgId: user.orgId,
          createdAt: { gte: startDate },
          source: { in: ['call', 'missed_call', 'voicemail'] },
        },
      });

      // Get leads with consults set
      const consultsBooked = await prisma.appointment.count({
        where: {
          orgId: user.orgId,
          createdAt: { gte: startDate },
          status: 'booked',
        },
      });

      // Calculate average response time
      const leadsWithResponse = await prisma.lead.findMany({
        where: {
          orgId: user.orgId,
          createdAt: { gte: startDate },
          lastHumanResponseAt: { not: null },
        },
        select: { createdAt: true, lastHumanResponseAt: true },
      });

      let medianResponseMinutes = 0;
      let p90ResponseMinutes = 0;

      if (leadsWithResponse.length > 0) {
        const responseTimes = leadsWithResponse
          .map((l) => (l.lastHumanResponseAt!.getTime() - l.createdAt.getTime()) / 60000)
          .filter((t) => t > 0)
          .sort((a, b) => a - b);

        if (responseTimes.length > 0) {
          medianResponseMinutes = responseTimes[Math.floor(responseTimes.length / 2)];
          p90ResponseMinutes =
            responseTimes[Math.floor(responseTimes.length * 0.9)] || medianResponseMinutes;
        }
      }

      const qualifiedRate =
        leadsCreated > 0 ? Math.round((qualifiedLeads / leadsCreated) * 100) : 0;
      const consultBookedRate =
        leadsCreated > 0 ? Math.round((consultsBooked / leadsCreated) * 100) : 0;

      res.json({
        range: `${range}d`,
        startDate: startDate.toISOString(),
        capturedLeads: leadsCreated,
        missedCallRecovery: missedCallLeads,
        qualifiedRate,
        qualifiedCount: qualifiedLeads,
        consultBookedRate,
        consultBookedCount: consultsBooked,
        medianResponseMinutes: Math.round(medianResponseMinutes),
        p90ResponseMinutes: Math.round(p90ResponseMinutes),
        afterHoursConversionRate: null, // TODO: implement when after-hours tracking is added
      });
    } catch (error) {
      console.error('Analytics summary error:', error);
      res.status(500).json({ error: 'Failed to get analytics' });
    }
  });

  /**
   * @openapi
   * /v1/analytics/pi-dashboard:
   *   get:
   *     summary: Get PI-focused analytics dashboard data
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           default: 30
   *     responses:
   *       200:
   *         description: PI dashboard data with funnel, speed, rescue queue, source ROI, and intake completeness
   */
  app.get('/v1/analytics/pi-dashboard', flexAuthMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      console.log(`[PI_DASHBOARD_HIT] userId=${user.userId} orgId=${user.orgId}`);
      const days = parseInt(req.query.days as string) || 30;
      const data = await getPIDashboardData(prisma, user.orgId, days);
      res.json(data);
    } catch (error) {
      console.error('PI dashboard error:', error);
      res.status(500).json({ error: 'Failed to get PI dashboard data' });
    }
  });

  /**
   * @openapi
   * /v1/calls/{id}/rescue:
   *   post:
   *     summary: Resolve a missed call in the rescue queue
   *     tags: [Calls]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Call resolved
   *       404:
   *         description: Call not found
   */
  app.post('/v1/calls/:id/rescue', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const result = await resolveMissedCall(prisma, user.orgId, id, user.userId);
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Rescue call error:', error);
      res.status(500).json({ error: 'Failed to resolve call' });
    }
  });

  /**
   * @openapi
   * /v1/leads/{id}/milestones:
   *   patch:
   *     summary: Update lead funnel milestones
   *     tags: [Leads]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               consultScheduledAt:
   *                 type: string
   *                 format: date-time
   *               consultCompletedAt:
   *                 type: string
   *                 format: date-time
   *               retainerSentAt:
   *                 type: string
   *                 format: date-time
   *               retainerSignedAt:
   *                 type: string
   *                 format: date-time
   *     responses:
   *       200:
   *         description: Milestones updated
   *       404:
   *         description: Lead not found
   */
  app.patch('/v1/leads/:id/milestones', authMiddleware, requireMinRole('staff'), async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { firstContactAt, consultScheduledAt, consultCompletedAt, retainerSentAt, retainerSignedAt, rejectedAt } = req.body;

      const lead = await prisma.lead.findFirst({ where: { id, orgId: user.orgId } });
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const updateData: Record<string, Date | null> = {};
      if (firstContactAt !== undefined) {
        updateData.firstContactAt = firstContactAt ? new Date(firstContactAt) : null;
      }
      if (consultScheduledAt !== undefined) {
        updateData.consultScheduledAt = consultScheduledAt ? new Date(consultScheduledAt) : null;
      }
      if (consultCompletedAt !== undefined) {
        updateData.consultCompletedAt = consultCompletedAt ? new Date(consultCompletedAt) : null;
      }
      if (retainerSentAt !== undefined) {
        updateData.retainerSentAt = retainerSentAt ? new Date(retainerSentAt) : null;
      }
      if (retainerSignedAt !== undefined) {
        updateData.retainerSignedAt = retainerSignedAt ? new Date(retainerSignedAt) : null;
      }
      if (rejectedAt !== undefined) {
        updateData.rejectedAt = rejectedAt ? new Date(rejectedAt) : null;
      }

      const updated = await prisma.lead.update({
        where: { id },
        data: updateData,
      });

      res.json(updated);
    } catch (error) {
      console.error('Update milestones error:', error);
      res.status(500).json({ error: 'Failed to update milestones' });
    }
  });

  /**
   * @openapi
   * /v1/analytics/captured-leads:
   *   get:
   *     summary: Get captured leads breakdown
   *     tags: [Mobile, Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: range
   *         schema:
   *           type: string
   *           enum: [7d, 30d]
   *           default: 7d
   *     responses:
   *       200:
   *         description: Captured leads list
   */
  app.get(
    '/v1/analytics/captured-leads',
    authMiddleware,
    async (req: AuthenticatedRequest, res) => {
      try {
        const user = req.user!;
        const range = req.query.range === '30d' ? 30 : 7;
        const startDate = new Date(Date.now() - range * 24 * 60 * 60 * 1000);

        const leads = await prisma.lead.findMany({
          where: {
            orgId: user.orgId,
            createdAt: { gte: startDate },
          },
          include: {
            contact: { select: { name: true, primaryPhone: true } },
            practiceArea: { select: { name: true } },
            qualification: { select: { score: true, disposition: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });

        res.json({
          range: `${range}d`,
          count: leads.length,
          leads: leads.map((l) => ({
            id: l.id,
            name: l.contact.name,
            phone: l.contact.primaryPhone,
            source: l.source,
            status: l.status,
            practiceArea: l.practiceArea?.name,
            score: l.qualification?.score || l.score,
            createdAt: l.createdAt.toISOString(),
          })),
        });
      } catch (error) {
        console.error('Captured leads error:', error);
        res.status(500).json({ error: 'Failed to get captured leads' });
      }
    }
  );

  /**
   * @openapi
   * /v1/analytics/events:
   *   get:
   *     summary: Get analytics event counts by type
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: start
   *         schema:
   *           type: string
   *           format: date-time
   *       - in: query
   *         name: end
   *         schema:
   *           type: string
   *           format: date-time
   *       - in: query
   *         name: practiceAreaId
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Event counts by type
   */
  app.get('/v1/analytics/events', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const startDate = req.query.start ? new Date(req.query.start as string) : undefined;
      const endDate = req.query.end ? new Date(req.query.end as string) : undefined;
      const practiceAreaId = req.query.practiceAreaId as string | undefined;

      const counts = await getEventCountsByType({
        orgId: user.orgId,
        startDate,
        endDate,
        practiceAreaId,
      });

      const total = await countAnalyticsEvents({
        orgId: user.orgId,
        startDate,
        endDate,
        practiceAreaId,
      });

      res.json({
        total,
        byType: counts,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        practiceAreaId,
      });
    } catch (error) {
      console.error('Analytics events error:', error);
      res.status(500).json({ error: 'Failed to get analytics events' });
    }
  });

  /**
   * @openapi
   * /v1/experiments/assign:
   *   get:
   *     summary: Get deterministic experiment assignment
   *     tags: [Experiments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: key
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Experiment assignment
   */
  app.get('/v1/experiments/assign', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const key = req.query.key as string;

      if (!key) {
        return res.status(400).json({ error: 'Missing experiment key' });
      }

      const assignment = await getExperimentAssignment(user.orgId, user.userId, key);

      if (!assignment) {
        return res.status(404).json({ error: 'Experiment not found or not active' });
      }

      res.json(assignment);
    } catch (error) {
      console.error('Experiment assignment error:', error);
      res.status(500).json({ error: 'Failed to get experiment assignment' });
    }
  });

  /**
   * @openapi
   * /v1/experiments/convert:
   *   post:
   *     summary: Log experiment conversion
   *     tags: [Experiments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - key
   *               - variant
   *               - eventName
   *             properties:
   *               key:
   *                 type: string
   *               variant:
   *                 type: string
   *               eventName:
   *                 type: string
   *               metadata:
   *                 type: object
   *     responses:
   *       200:
   *         description: Conversion logged
   */
  app.post('/v1/experiments/convert', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const { key, variant, eventName, metadata } = req.body;

      if (!key || !variant || !eventName) {
        return res.status(400).json({ error: 'Missing required fields: key, variant, eventName' });
      }

      await logExperimentConversion(user.orgId, user.userId, key, variant, eventName, metadata);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Experiment conversion error:', error);
      res.status(400).json({ error: error.message || 'Failed to log conversion' });
    }
  });

  /**
   * @openapi
   * /v1/experiments:
   *   get:
   *     summary: List all active experiments
   *     tags: [Experiments]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of experiments
   */
  app.get('/v1/experiments', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const experiments = listExperiments();
      res.json({ experiments });
    } catch (error) {
      console.error('List experiments error:', error);
      res.status(500).json({ error: 'Failed to list experiments' });
    }
  });

  /**
   * @openapi
   * /v1/experiments/{key}/stats:
   *   get:
   *     summary: Get experiment performance statistics
   *     tags: [Experiments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: start
   *         schema:
   *           type: string
   *           format: date-time
   *       - in: query
   *         name: end
   *         schema:
   *           type: string
   *           format: date-time
   *     responses:
   *       200:
   *         description: Experiment statistics
   */
  app.get('/v1/experiments/:key/stats', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const key = req.params.key;
      const startDate = req.query.start ? new Date(req.query.start as string) : undefined;
      const endDate = req.query.end ? new Date(req.query.end as string) : undefined;

      const stats = await getExperimentStats(user.orgId, key, startDate, endDate);

      if (!stats) {
        return res.status(404).json({ error: 'Experiment not found' });
      }

      res.json(stats);
    } catch (error) {
      console.error('Experiment stats error:', error);
      res.status(500).json({ error: 'Failed to get experiment stats' });
    }
  });

  return httpServer;
}
