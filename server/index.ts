import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';
import stripeRoutes from './routes/stripe';

// Fail-fast env validation - must be imported early
import { DATABASE_URL } from "./env";

// GATE 4: Global crash handlers (anti-crash)
process.on("unhandledRejection", (reason, promise) => {
  console.error(`[CRASH_GUARD] Unhandled Rejection at:`, promise, `reason:`, reason);
});
process.on("uncaughtException", (error) => {
  console.error(`[CRASH_GUARD] Uncaught Exception:`, error);
});

const DEPLOY_ID = process.env.REPL_SLUG_COMMIT || process.env.RAILWAY_GIT_COMMIT_SHA || `local-${Date.now()}`;
const BOOT_TS = new Date().toISOString();
console.log(`=== AVERY STARTUP === DEPLOY_ID=${DEPLOY_ID} time=${BOOT_TS} NODE_ENV=${process.env.NODE_ENV || "undefined"} PID=${process.pid}`);

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// CRITICAL: Stripe webhook route MUST be registered BEFORE express.json()
// Webhook needs raw Buffer body, not parsed JSON
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        console.error('[STRIPE WEBHOOK] req.body is not a Buffer - express.json() may have run first');
        return res.status(500).json({ error: 'Webhook processing error' });
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[STRIPE WEBHOOK] Error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Now apply JSON middleware for all other routes
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Register Stripe API routes (after express.json so they get parsed bodies)
app.use(stripeRoutes);

const CANONICAL_HOST = "casecurrent.co";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Build a set of allowed hosts from Replit env vars
const REPLIT_ALLOWED_HOSTS = new Set<string>();
if (process.env.REPLIT_DEV_DOMAIN) {
  REPLIT_ALLOWED_HOSTS.add(process.env.REPLIT_DEV_DOMAIN.toLowerCase());
}
if (process.env.REPLIT_DOMAINS) {
  for (const d of process.env.REPLIT_DOMAINS.split(",")) {
    const trimmed = d.trim().toLowerCase();
    if (trimmed) REPLIT_ALLOWED_HOSTS.add(trimmed);
  }
}

const CANONICAL_REDIRECT_ENABLED = IS_PRODUCTION;
console.log(
  `[CANONICAL] host=${CANONICAL_HOST} redirects=${CANONICAL_REDIRECT_ENABLED ? "enabled" : "disabled"} ` +
  `replitHosts=[${[...REPLIT_ALLOWED_HOSTS].join(", ")}]`
);

app.use((req, res, next) => {
  if (!CANONICAL_REDIRECT_ENABLED) return next();

  const host = (req.hostname || req.headers.host?.split(":")[0] || "").toLowerCase();
  const method = req.method.toUpperCase();
  const path = req.path || req.originalUrl.split("?")[0];

  if (method !== "GET" && method !== "HEAD") return next();
  if (path.startsWith("/v1/") || path.startsWith("/api/") || path.startsWith("/.well-known/")) return next();

  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host === CANONICAL_HOST ||
    host.endsWith(".replit.dev") ||
    host.endsWith(".repl.co") ||
    REPLIT_ALLOWED_HOSTS.has(host)
  ) {
    return next();
  }

  const redirectUrl = `https://${CANONICAL_HOST}${req.originalUrl}`;
  console.log(`[REDIRECT] 301 ${host}${req.originalUrl} -> ${redirectUrl}`);
  return res.redirect(301, redirectUrl);
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize Stripe schema and sync
  try {
    console.log('[STRIPE] Initializing schema...');
    await runMigrations({ databaseUrl: DATABASE_URL, schema: 'stripe' });
    console.log('[STRIPE] Schema ready');

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    try {
      const result = await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`
      );
      console.log(`[STRIPE] Webhook configured: ${result?.webhook?.url || 'managed'}`);
    } catch (webhookErr: any) {
      console.log(`[STRIPE] Webhook setup skipped (will use existing): ${webhookErr?.message}`);
    }

    stripeSync.syncBackfill()
      .then(() => console.log('[STRIPE] Data synced'))
      .catch((err: any) => console.error('[STRIPE] Sync error:', err.message));
  } catch (err: any) {
    console.error('[STRIPE] Init error (non-fatal):', err?.message || err);
  }

  // TASK B & C - Database fingerprint and phone number check on startup
  try {
    // Parse DATABASE_URL for fingerprint (don't log credentials)
    const urlMatch = DATABASE_URL.match(/@([^:/]+)(?::(\d+))?\/([^?]+)/);
    if (urlMatch) {
      const host = urlMatch[1];
      const dbName = urlMatch[3];
      const dbFingerprint = dbName.length > 6 ? dbName.slice(-6) : dbName;
      console.log(`[DB] Fingerprint - host=${host} db=...${dbFingerprint}`);
    } else {
      console.log(`[DB] Fingerprint - Could not parse DATABASE_URL`);
    }
    
    // TASK C - Seed demo phone number on startup (idempotent)
    const { PrismaClient } = await import("../apps/api/src/generated/prisma");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const startupPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
    
    // Use the demo dashboard org (matches what users see when logging in)
    const DEMO_ORG_ID = '4a906d8e-952a-4ee0-8eae-57f293362987';
    const DEMO_PHONE_E164 = '+18443214257';
    
    // Check if org exists; if not, create it
    let demoOrg = await startupPrisma.organization.findUnique({
      where: { id: DEMO_ORG_ID },
    });
    
    if (!demoOrg) {
      // Create with unique slug (append timestamp to avoid conflicts)
      demoOrg = await startupPrisma.organization.create({
        data: { id: DEMO_ORG_ID, name: 'Demo Law Firm', slug: `demo-law-firm-${Date.now()}` },
      });
    }
    
    // Upsert the demo phone number (idempotent)
    const phoneRecord = await startupPrisma.phoneNumber.upsert({
      where: { e164: DEMO_PHONE_E164 },
      create: {
        orgId: DEMO_ORG_ID,
        e164: DEMO_PHONE_E164,
        label: 'Twilio Main Line',
        provider: 'twilio',
        inboundEnabled: true,
      },
      update: {
        orgId: DEMO_ORG_ID,
        inboundEnabled: true,
      },
    });
    
    console.log(`[DB STARTUP] Demo phone ${DEMO_PHONE_E164} -> org ${phoneRecord.orgId} phoneNumberId=${phoneRecord.id} (inbound=${phoneRecord.inboundEnabled})`);
    
    const totalPhones = await startupPrisma.phoneNumber.count();
    console.log(`[DB STARTUP] Total phone_numbers in database: ${totalPhones}`);
    
    await startupPrisma.$disconnect();
  } catch (err: any) {
    console.error(`[DB STARTUP] Error during DB check:`, err?.message || err);
  }

  // TELEPHONY PROVIDER BOOT LOG
  const telephonyProvider = (process.env.TELEPHONY_PROVIDER || 'twilio').toLowerCase();
  const isPlivo = telephonyProvider === 'plivo';
  const voiceEnabled = isPlivo 
    ? !!(process.env.PLIVO_AUTH_ID && process.env.PLIVO_AUTH_TOKEN)
    : !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  const smsEnabled = voiceEnabled; // Same credential check for both
  console.log(`[TELEPHONY] Provider: ${isPlivo ? 'plivo' : 'twilio'} | Voice: ${voiceEnabled} | SMS: ${smsEnabled}`);

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);

  // Setup Vite or static serving
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
