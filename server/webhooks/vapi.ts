import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../apps/api/src/generated/prisma';
import {
  normalizeE164,
  maskPhone,
  lookupFirmByNumber,
  extractDisplayName,
} from './shared';
import { recordIngestionOutcome } from './ingestion-outcome';
// Note: checkIdempotency removed — webhook_events table may be missing in prod.
// Idempotency now relies on providerCallId uniqueness on the Call table.

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface VapiToolCall {
  id: string;
  type?: string;
  function?: {
    name: string;
    arguments?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

interface VapiMessage {
  type: string;
  call?: {
    id?: string;
    type?: string; // "inboundPhoneCall" | "outboundPhoneCall" | "webCall"
    assistantId?: string;
    phoneNumber?: { number?: string; [key: string]: unknown };
    customer?: { number?: string; [key: string]: unknown };
    [key: string]: unknown;
  };
  status?: string;
  transcript?: string;
  toolCalls?: VapiToolCall[];
  toolCallList?: VapiToolCall[];
  endedReason?: string;
  recordingUrl?: string;
  summary?: string;
  durationSeconds?: number;
  cost?: number;
  messages?: Array<{ role: string; content: string; [key: string]: unknown }>;
  artifact?: {
    transcript?: string;
    recordingUrl?: string;
    messages?: Array<{ role: string; content: string; [key: string]: unknown }>;
    [key: string]: unknown;
  };
  analysis?: {
    summary?: string;
    structuredData?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

const INTAKE_FIELDS = [
  'callerName', 'phoneNumber', 'phone', 'from',
  'practiceAreaGuess', 'incidentDate', 'incidentLocation',
  'injuryDescription', 'atFaultParty', 'medicalTreatment', 'insuranceInfo',
] as const;

const SAVE_INTAKE_TOOLS = ['save_partial_intake', 'save_intake_answers', 'savePartialIntake', 'saveIntakeAnswers'];
const COMPLETE_INTAKE_TOOLS = ['complete_intake', 'intake_complete', 'completeIntake', 'end_call'];
const HANDOFF_TOOLS = ['human_handoff_needed', 'handoff', 'transfer', 'needs_handoff', 'transfer_call_to_firm'];

// ─────────────────────────────────────────────
// In-memory ring buffer for diagnostics
// ─────────────────────────────────────────────

interface DiagEntry {
  ts: string;
  reqId: string;
  eventType: string;
  callId: string | null;
  callType: string;
  from: string | null;
  to: string | null;
  assistantId: string | null;
  orgResolved: string | null;
  outcome: string;
  error: string | null;
}

const DIAG_RING_SIZE = 50;
const diagRing: DiagEntry[] = [];

function pushDiag(entry: DiagEntry): void {
  diagRing.push(entry);
  if (diagRing.length > DIAG_RING_SIZE) diagRing.shift();
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

let _reqCounter = 0;
function nextReqId(): string {
  return `vapi-${Date.now()}-${(++_reqCounter).toString(36)}`;
}

/** Sanitized DB identity for logging — never log credentials */
function dbIdentity(): { dbHost: string; dbName: string; nodeEnv: string } {
  const url = process.env.DATABASE_URL || '';
  let dbHost = 'unknown';
  let dbName = 'unknown';
  try {
    // Parse postgresql://user:pass@host:port/dbname?params
    const match = url.match(/@([^:/]+)[:/].*?\/([^?]+)/);
    if (match) {
      dbHost = match[1];
      dbName = match[2];
    }
  } catch { /* ignore parse errors */ }
  return { dbHost, dbName, nodeEnv: process.env.NODE_ENV || 'unknown' };
}

function flattenIntakeData(data: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const key of INTAKE_FIELDS) {
    if (data[key] !== undefined && data[key] !== null) {
      flat[key] = data[key];
    }
  }
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null && !(key in flat)) {
      flat[key] = value;
    }
  }
  return flat;
}

/**
 * Store a raw webhook event. Best-effort — does NOT block core persistence.
 * Returns true if stored, false if duplicate or table missing.
 */
async function storeRawEvent(
  prisma: PrismaClient,
  callId: string | null,
  eventType: string,
  payload: unknown,
  reqId: string,
): Promise<boolean> {
  const externalId = callId
    ? `${callId}:${eventType}`
    : `unknown:${eventType}:${Date.now()}`;
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: 'vapi',
        externalId,
        eventType,
        payload: payload as any,
      },
    });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2002') return false; // duplicate
    console.log(JSON.stringify({
      tag: 'vapi_raw_store_error',
      reqId,
      externalId,
      errorCode: err?.code || null,
      error: err?.message || String(err),
      hint: err?.code === 'P2010' || /relation.*does not exist/i.test(err?.message || '')
        ? 'webhook_events table may be missing — run prisma migrate deploy'
        : null,
    }));
    return false;
  }
}

/**
 * Resolve phone numbers from Vapi's call object.
 * Vapi may put numbers in different places — try multiple paths.
 */
function resolvePhoneNumbers(message: VapiMessage): {
  fromNumber: string | null;
  toNumber: string | null;
  fromE164: string | null;
  toE164: string | null;
} {
  const call = message.call || {};

  const toNumber =
    (call.phoneNumber as any)?.number ||
    (call as any).phoneNumberId ||
    (call as any).to ||
    (call as any).calledNumber ||
    null;

  const fromNumber =
    (call.customer as any)?.number ||
    (call as any).from ||
    (call as any).callerNumber ||
    (call as any).caller?.number ||
    null;

  return {
    fromNumber,
    toNumber,
    fromE164: normalizeE164(fromNumber),
    toE164: normalizeE164(toNumber),
  };
}

/**
 * Find or create the full record chain (Contact → Lead → Interaction → Call).
 * UNIFIED path for both phone calls and web calls.
 * Uses providerCallId (unique) as the stable key.
 */
async function findOrCreateCallChain(
  prisma: PrismaClient,
  vapiCallId: string,
  message: VapiMessage,
  reqId: string,
): Promise<{
  dbCallId: string;
  leadId: string;
  orgId: string;
  created: boolean;
} | null> {
  // 1. Check if call already exists
  const existing = await prisma.call.findUnique({
    where: { providerCallId: vapiCallId },
    select: { id: true, leadId: true, orgId: true },
  });
  if (existing) {
    return { dbCallId: existing.id, leadId: existing.leadId, orgId: existing.orgId, created: false };
  }

  // 2. Extract call metadata
  const callType = (message.call as any)?.type as string | undefined;
  const assistantId = (message.call as any)?.assistantId
    || (message.call as any)?.assistant?.id
    || null;
  const isWebCall = callType === 'webCall' || callType === 'vapi.websocketCall';

  // 3. Resolve phone numbers
  const { fromNumber, toNumber, fromE164, toE164 } = resolvePhoneNumbers(message);

  console.log(JSON.stringify({
    tag: 'vapi_chain_resolve',
    reqId,
    callId: vapiCallId,
    callType: callType || 'unknown',
    assistantId,
    isWebCall,
    fromRaw: maskPhone(fromNumber),
    toRaw: maskPhone(toNumber),
    fromE164: maskPhone(fromE164),
    toE164: maskPhone(toE164),
  }));

  // 4. Resolve org, phoneNumberId, and contact identifiers
  let orgId: string;
  let phoneNumberId: string;
  let contactFromE164: string;
  let contactToE164: string;
  let callSource: 'web' | 'phone';

  // ── Path A: Phone call (has both from and to numbers) ──
  if (fromE164 && toE164) {
    const firm = await lookupFirmByNumber(prisma, toNumber!);
    if (!firm) {
      // Fallback: try VAPI_DEFAULT_ORG_ID even for phone calls
      const fallbackOrgId = process.env.VAPI_DEFAULT_ORG_ID;
      if (fallbackOrgId) {
        console.log(JSON.stringify({
          tag: 'vapi_phone_firm_miss_fallback',
          reqId,
          callId: vapiCallId,
          toE164: maskPhone(toE164),
          toRaw: toNumber,
          fallbackOrgId,
        }));
        const orgPhone = await prisma.phoneNumber.findFirst({
          where: { orgId: fallbackOrgId, inboundEnabled: true },
          select: { id: true },
        });
        if (!orgPhone) {
          console.log(JSON.stringify({
            tag: 'vapi_chain_fail',
            reqId,
            callId: vapiCallId,
            reason: 'fallback_org_no_phone',
            orgId: fallbackOrgId,
          }));
          return null;
        }
        orgId = fallbackOrgId;
        phoneNumberId = orgPhone.id;
      } else {
        console.log(JSON.stringify({
          tag: 'vapi_chain_fail',
          reqId,
          callId: vapiCallId,
          reason: 'no_firm_for_number',
          toE164: maskPhone(toE164),
          toRaw: toNumber,
          hint: 'Number not in phone_numbers table with inbound_enabled=true and no VAPI_DEFAULT_ORG_ID set',
        }));
        return null;
      }
    } else {
      orgId = firm.orgId;
      phoneNumberId = firm.phoneNumberId;
    }
    contactFromE164 = fromE164;
    contactToE164 = toE164;
    callSource = 'phone';

  // ── Path B: Web call OR missing phone numbers ──
  } else {
    const defaultOrgId = process.env.VAPI_DEFAULT_ORG_ID;
    if (!defaultOrgId) {
      console.log(JSON.stringify({
        tag: 'vapi_chain_fail',
        reqId,
        callId: vapiCallId,
        reason: isWebCall ? 'web_call_no_org' : 'missing_phones_no_fallback',
        callType,
        assistantId,
        fromPresent: !!fromNumber,
        toPresent: !!toNumber,
        hint: 'Set VAPI_DEFAULT_ORG_ID env var',
        callKeys: message.call ? Object.keys(message.call) : [],
      }));
      return null;
    }

    orgId = defaultOrgId;
    const orgPhone = await prisma.phoneNumber.findFirst({
      where: { orgId, inboundEnabled: true },
      select: { id: true, e164: true },
    });
    if (!orgPhone) {
      console.log(JSON.stringify({
        tag: 'vapi_chain_fail',
        reqId,
        callId: vapiCallId,
        reason: 'org_no_phone_number',
        orgId,
      }));
      return null;
    }

    phoneNumberId = orgPhone.id;
    // Use real numbers if available, synthetic otherwise
    contactFromE164 = fromE164 || `+0web${vapiCallId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
    contactToE164 = toE164 || orgPhone.e164;
    callSource = isWebCall ? 'web' : (fromE164 ? 'phone' : 'web');
  }

  // 5. Persist: Contact → Lead → Interaction → Call
  const isWebContact = contactFromE164.startsWith('+0web');

  let contact = isWebContact
    ? null
    : await prisma.contact.findFirst({ where: { orgId, primaryPhone: contactFromE164 } });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        orgId,
        name: isWebContact ? 'Web Visitor' : 'Unknown Caller',
        primaryPhone: contactFromE164,
      },
    });
  }

  let lead: { id: string; intakeData: unknown; displayName: string | null; summary: string | null } | null = null;
  if (!isWebContact) {
    lead = await prisma.lead.findFirst({
      where: { orgId, contactId: contact.id, status: { in: ['new', 'contacted', 'engaged', 'in_progress', 'intake_started'] } },
      orderBy: { createdAt: 'desc' },
    });
  }
  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        orgId,
        contactId: contact.id,
        source: callSource,
        status: 'new',
        priority: 'medium',
      },
    });
  }

  const interaction = await prisma.interaction.create({
    data: {
      orgId,
      leadId: lead.id,
      channel: isWebContact ? 'webchat' : 'call',
      status: 'active',
      startedAt: new Date(),
    },
  });

  const dbCall = await prisma.call.create({
    data: {
      orgId,
      leadId: lead.id,
      interactionId: interaction.id,
      phoneNumberId,
      direction: 'inbound',
      provider: 'vapi',
      providerCallId: vapiCallId,
      fromE164: contactFromE164,
      toE164: contactToE164,
      startedAt: new Date(),
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { lastActivityAt: new Date() },
  });

  // 6. Verify persistence — read back immediately
  const verified = await prisma.call.findUnique({
    where: { id: dbCall.id },
    select: { id: true, orgId: true, leadId: true, providerCallId: true },
  });

  console.log(JSON.stringify({
    tag: 'vapi_chain_created',
    reqId,
    callId: vapiCallId,
    dbCallId: dbCall.id,
    leadId: lead.id,
    contactId: contact.id,
    orgId,
    callSource,
    verified: !!verified,
    verifiedOrgId: verified?.orgId || null,
  }));

  return { dbCallId: dbCall.id, leadId: lead.id, orgId, created: true };
}

// ─────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────

export function createVapiWebhookRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Log DB identity once at startup
  const identity = dbIdentity();
  console.log(JSON.stringify({
    tag: 'vapi_router_init',
    ...identity,
    hasDefaultOrgId: !!process.env.VAPI_DEFAULT_ORG_ID,
    defaultOrgId: process.env.VAPI_DEFAULT_ORG_ID || null,
  }));

  // Health check
  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, ts: new Date().toISOString(), ...identity });
  });

  // ── Diagnostic: in-memory ring buffer (works even if webhook_events table is missing) ──
  router.get('/diag/ring', (_req: Request, res: Response) => {
    res.json({ count: diagRing.length, maxSize: DIAG_RING_SIZE, entries: [...diagRing].reverse() });
  });

  // ── Diagnostic: recent raw Vapi webhook events (DB-backed) ──
  router.get('/diag/events', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const events = await prisma.webhookEvent.findMany({
        where: { provider: 'vapi' },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, externalId: true, eventType: true, createdAt: true },
      });
      res.json({ count: events.length, events });
    } catch (err: any) {
      res.json({ count: 0, events: [], error: 'webhook_events table may be missing', detail: err?.message });
    }
  });

  // ── Diagnostic: recent Vapi calls in DB ──
  router.get('/diag/calls', async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const calls = await prisma.call.findMany({
      where: { provider: 'vapi' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        providerCallId: true,
        leadId: true,
        orgId: true,
        fromE164: true,
        toE164: true,
        startedAt: true,
        endedAt: true,
        durationSeconds: true,
        callOutcome: true,
        transcriptText: true,
        aiSummary: true,
        createdAt: true,
      },
    });
    res.json({ count: calls.length, calls });
  });

  // ── Diagnostic: phone numbers registered for inbound ──
  router.get('/diag/phones', async (_req: Request, res: Response) => {
    const phones = await prisma.phoneNumber.findMany({
      where: { inboundEnabled: true },
      select: { id: true, e164: true, label: true, provider: true, orgId: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const masked = phones.map((p) => ({
      ...p,
      e164: maskPhone(p.e164),
    }));
    res.json({ count: masked.length, phones: masked });
  });

  // ── Diagnostic: show raw payload from DB ──
  router.get('/diag/raw', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);
      const events = await prisma.webhookEvent.findMany({
        where: { provider: 'vapi' },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, externalId: true, eventType: true, payload: true, createdAt: true },
      });
      res.json({ count: events.length, events });
    } catch (err: any) {
      // Fallback: return ring buffer data
      res.json({
        count: diagRing.length,
        source: 'in_memory_ring_buffer',
        error: 'webhook_events table may be missing',
        entries: [...diagRing].reverse().slice(0, 10),
      });
    }
  });

  // ── Main webhook endpoint ──
  router.post('/', async (req: Request, res: Response) => {
    const reqId = nextReqId();
    const body = req.body;
    const message: VapiMessage = body?.message || body;
    const messageType = message?.type;
    const callId = message?.call?.id || null;
    const callType = (message?.call as any)?.type || 'unknown';
    const assistantId = (message?.call as any)?.assistantId || null;
    const { fromNumber, toNumber, fromE164, toE164 } = resolvePhoneNumbers(message);

    // ── INCONTROVERTIBLE top-of-handler log ──
    console.log(JSON.stringify({
      tag: 'vapi_webhook_received',
      reqId,
      eventType: messageType,
      callId,
      callType,
      from: maskPhone(fromNumber),
      to: maskPhone(toNumber),
      fromE164: maskPhone(fromE164),
      toE164: maskPhone(toE164),
      assistantId,
      hasDefaultOrgId: !!process.env.VAPI_DEFAULT_ORG_ID,
      bodyKeys: body ? Object.keys(body) : [],
      callKeys: message?.call ? Object.keys(message.call) : [],
    }));

    if (!messageType) {
      res.status(400).json({ error: 'Missing message.type' });
      return;
    }

    // ── Fast path: assistant-request (no DB, must respond < 1s) ──
    if (messageType === 'assistant-request') {
      const aid = process.env.VAPI_ASSISTANT_ID_BUSINESS_HOURS || process.env.VAPI_ASSISTANT_ID;
      console.log(JSON.stringify({ tag: 'vapi_assistant_request', reqId, callId, hasAssistantId: !!aid }));
      pushDiag({ ts: new Date().toISOString(), reqId, eventType: messageType, callId, callType, from: maskPhone(fromNumber), to: maskPhone(toNumber), assistantId, orgResolved: null, outcome: 'assistant_response', error: null });
      res.status(200).json({ assistantId: aid });
      return;
    }

    // ── Fast path: tool-calls (must respond quickly with results) ──
    if (messageType === 'tool-calls') {
      const toolCalls = message.toolCalls || message.toolCallList || [];
      const results = toolCalls.map((tc) => ({ toolCallId: tc.id, result: 'ok' }));
      // Respond immediately for tool-calls (Vapi expects quick response)
      res.status(200).json({ results });
      pushDiag({ ts: new Date().toISOString(), reqId, eventType: messageType, callId, callType, from: maskPhone(fromNumber), to: maskPhone(toNumber), assistantId, orgResolved: null, outcome: 'tool_response', error: null });
      // Process async — but log errors
      processToolCalls(prisma, callId, toolCalls, body, reqId).catch((err: any) => {
        console.log(JSON.stringify({ tag: 'vapi_tool_calls_error', reqId, callId, error: err?.message || String(err) }));
      });
      return;
    }

    // ── All other events: await persistence BEFORE responding ──
    if (!callId) {
      console.log(JSON.stringify({ tag: 'vapi_no_call_id', reqId, eventType: messageType }));
      pushDiag({ ts: new Date().toISOString(), reqId, eventType: messageType || 'unknown', callId, callType, from: maskPhone(fromNumber), to: maskPhone(toNumber), assistantId, orgResolved: null, outcome: 'no_call_id', error: null });
      res.status(200).json({ ok: true });
      return;
    }

    // Store raw event (best-effort — does NOT block core persistence)
    storeRawEvent(prisma, callId, messageType, body, reqId).catch(() => {});

    let outcome = 'unknown';
    let resolvedOrg: string | null = null;
    let error: string | null = null;

    try {
      if (messageType === 'end-of-call-report') {
        const result = await ingestEndOfCallReport(prisma, callId, message, body, reqId);
        if (result) {
          outcome = 'persisted';
          resolvedOrg = result.orgId;
          await recordIngestionOutcome(prisma, {
            provider: 'vapi', eventType: messageType, externalId: callId,
            orgId: result.orgId, status: 'persisted',
          });
        } else {
          // chain_failed = permanent config issue (missing firm). Retrying won't help.
          outcome = 'chain_failed';
          await recordIngestionOutcome(prisma, {
            provider: 'vapi', eventType: messageType, externalId: callId,
            status: 'skipped', errorCode: 'chain_failed',
            errorMessage: 'No firm resolved for call — check vapi_chain_fail logs',
            payload: body,
          });
        }
      } else if (messageType === 'status-update') {
        const result = await ingestStatusUpdate(prisma, callId, message, reqId);
        outcome = result || 'processed';
        resolvedOrg = null; // logged inside function
      } else if (messageType === 'transcript') {
        await ingestTranscript(prisma, callId, message, reqId);
        outcome = 'transcript_processed';
      } else {
        outcome = 'event_logged';
        console.log(JSON.stringify({ tag: 'vapi_event_logged', reqId, eventType: messageType, callId }));
      }

      // Respond 200 AFTER persistence succeeds
      res.status(200).json({ ok: true });
    } catch (err: any) {
      error = err?.message || String(err);
      outcome = 'error';
      console.log(JSON.stringify({
        tag: 'vapi_persist_error',
        reqId,
        eventType: messageType,
        callId,
        error,
        stack: err?.stack?.split('\n').slice(0, 4).join(' | '),
      }));
      // Return 503 so Vapi retries (up to 3x). Idempotent via providerCallId.
      await recordIngestionOutcome(prisma, {
        provider: 'vapi', eventType: messageType, externalId: callId,
        status: 'failed', errorCode: 'persistence_error',
        errorMessage: error, payload: body,
      });
      res.status(503).json({ ok: false, error: 'persistence_failed' });
    }

    pushDiag({
      ts: new Date().toISOString(),
      reqId,
      eventType: messageType,
      callId,
      callType,
      from: maskPhone(fromNumber),
      to: maskPhone(toNumber),
      assistantId,
      orgResolved: resolvedOrg,
      outcome,
      error,
    });
  });

  return router;
}

// ─────────────────────────────────────────────
// Ingestion functions (awaited, not fire-and-forget)
// ─────────────────────────────────────────────

async function ingestStatusUpdate(
  prisma: PrismaClient,
  vapiCallId: string,
  message: VapiMessage,
  reqId: string,
): Promise<string> {
  if (message.status === 'in-progress') {
    const result = await findOrCreateCallChain(prisma, vapiCallId, message, reqId);
    console.log(JSON.stringify({
      tag: 'vapi_status_in_progress',
      reqId,
      callId: vapiCallId,
      dbCallId: result?.dbCallId || null,
      created: result?.created || false,
      chainNull: !result,
    }));
    return result ? 'chain_created' : 'chain_failed';
  }

  if (message.status === 'ended') {
    const dbCall = await prisma.call.findUnique({
      where: { providerCallId: vapiCallId },
      select: { id: true, interactionId: true, startedAt: true },
    });
    if (dbCall) {
      const dur = dbCall.startedAt
        ? Math.round((Date.now() - dbCall.startedAt.getTime()) / 1000)
        : null;
      await prisma.call.update({
        where: { id: dbCall.id },
        data: { endedAt: new Date(), ...(dur ? { durationSeconds: dur } : {}) },
      });
      await prisma.interaction.update({
        where: { id: dbCall.interactionId },
        data: { endedAt: new Date(), status: 'completed' },
      });
      console.log(JSON.stringify({
        tag: 'vapi_status_ended',
        reqId,
        callId: vapiCallId,
        dbCallId: dbCall.id,
        durationSeconds: dur,
      }));
      return 'ended';
    }
    console.log(JSON.stringify({
      tag: 'vapi_status_ended_no_call',
      reqId,
      callId: vapiCallId,
    }));
    return 'ended_no_call';
  }

  console.log(JSON.stringify({ tag: 'vapi_status_ignored', reqId, callId: vapiCallId, status: message.status }));
  return 'ignored';
}

async function ingestTranscript(
  prisma: PrismaClient,
  vapiCallId: string,
  message: VapiMessage,
  reqId: string,
): Promise<void> {
  const transcript = message.transcript;
  if (!transcript) return;

  const dbCall = await prisma.call.findUnique({
    where: { providerCallId: vapiCallId },
    select: { id: true },
  });

  if (!dbCall) {
    // Call chain might not exist yet — try creating it
    const chain = await findOrCreateCallChain(prisma, vapiCallId, message, reqId);
    if (chain) {
      await prisma.call.update({
        where: { id: chain.dbCallId },
        data: { transcriptText: transcript },
      });
      console.log(JSON.stringify({ tag: 'vapi_transcript_created_chain', reqId, callId: vapiCallId, dbCallId: chain.dbCallId }));
    } else {
      console.log(JSON.stringify({ tag: 'vapi_transcript_skip', reqId, callId: vapiCallId, reason: 'chain_failed' }));
    }
    return;
  }

  await prisma.call.update({
    where: { id: dbCall.id },
    data: { transcriptText: transcript },
  });
  console.log(JSON.stringify({ tag: 'vapi_transcript_updated', reqId, callId: vapiCallId, dbCallId: dbCall.id, length: transcript.length }));
}

async function processToolCalls(
  prisma: PrismaClient,
  callId: string | null,
  toolCalls: VapiToolCall[],
  rawBody: unknown,
  reqId: string,
): Promise<void> {
  storeRawEvent(prisma, callId, 'tool-calls', rawBody, reqId).catch(() => {});

  if (!callId || toolCalls.length === 0) return;

  const dbCall = await prisma.call.findUnique({
    where: { providerCallId: callId },
    include: { lead: true },
  });

  if (!dbCall) {
    console.log(JSON.stringify({
      tag: 'vapi_tool_calls_no_call',
      reqId,
      callId,
      toolNames: toolCalls.map((tc) => tc.function?.name).filter(Boolean),
    }));
    return;
  }

  for (const tc of toolCalls) {
    const toolName = tc.function?.name || '';
    const toolArgs = (tc.function?.arguments || {}) as Record<string, unknown>;

    console.log(JSON.stringify({ tag: 'vapi_tool_call', reqId, callId, toolName, argKeys: Object.keys(toolArgs) }));

    if (SAVE_INTAKE_TOOLS.includes(toolName)) {
      const existingIntakeData = (dbCall.lead.intakeData as Record<string, unknown>) || {};
      const flatData = flattenIntakeData(toolArgs);
      const merged = { ...existingIntakeData, ...flatData };

      await prisma.lead.update({
        where: { id: dbCall.leadId },
        data: {
          intakeData: merged as any,
          lastActivityAt: new Date(),
          displayName: extractDisplayName(flatData) || dbCall.lead.displayName,
        },
      });
      console.log(JSON.stringify({ tag: 'vapi_tool_save_intake', reqId, callId, toolName, fieldsUpdated: Object.keys(flatData).length }));
    } else if (COMPLETE_INTAKE_TOOLS.includes(toolName)) {
      await prisma.intake.upsert({
        where: { leadId: dbCall.leadId },
        create: {
          orgId: dbCall.orgId,
          leadId: dbCall.leadId,
          completionStatus: 'complete',
          completedAt: new Date(),
          answers: toolArgs as any,
        },
        update: {
          completionStatus: 'complete',
          completedAt: new Date(),
        },
      });
      console.log(JSON.stringify({ tag: 'vapi_tool_complete_intake', reqId, callId, toolName }));
    } else if (HANDOFF_TOOLS.includes(toolName)) {
      await prisma.lead.update({
        where: { id: dbCall.leadId },
        data: { status: 'needs_handoff', lastActivityAt: new Date() },
      });
      await prisma.auditLog.create({
        data: {
          orgId: dbCall.orgId,
          actorType: 'ai',
          action: 'handoff_requested',
          entityType: 'lead',
          entityId: dbCall.leadId,
          details: { toolName, callId, provider: 'vapi' } as any,
        },
      });
      console.log(JSON.stringify({ tag: 'vapi_tool_handoff', reqId, callId, toolName }));
    } else {
      console.log(JSON.stringify({ tag: 'vapi_tool_unknown', reqId, callId, toolName }));
    }
  }
}

async function ingestEndOfCallReport(
  prisma: PrismaClient,
  vapiCallId: string,
  message: VapiMessage,
  rawBody: unknown,
  reqId: string,
): Promise<{ orgId: string } | null> {
  // Idempotency: try to store raw event, skip if duplicate
  const stored = await storeRawEvent(prisma, vapiCallId, 'end-of-call-report-idem', rawBody, reqId);
  // Note: storeRawEvent returns false for P2002 (duplicate) and for table-missing errors.
  // For table-missing, we STILL proceed with core persistence.
  // For true duplicates (P2002), we should skip — but since table may be missing, we can't
  // rely on this for idempotency. Use providerCallId uniqueness on Call table instead.

  // Find or create the full chain
  const chain = await findOrCreateCallChain(prisma, vapiCallId, message, reqId);
  if (!chain) {
    console.log(JSON.stringify({
      tag: 'vapi_eocr_unlinked',
      reqId,
      callId: vapiCallId,
      hint: 'Chain creation failed — check vapi_chain_fail logs above',
    }));
    return null;
  }

  const { dbCallId, leadId, orgId } = chain;

  // Pull data from Vapi payload (multiple possible locations)
  const transcript = message.transcript || message.artifact?.transcript || null;
  const recordingUrl = message.recordingUrl || message.artifact?.recordingUrl || null;
  const summary = message.summary || message.analysis?.summary || null;
  const durationSeconds = typeof message.durationSeconds === 'number' ? message.durationSeconds : null;
  const messages = message.messages || message.artifact?.messages || null;

  // Update Call
  const callUpdate: Record<string, unknown> = {
    endedAt: new Date(),
    callOutcome: 'connected',
    aiFlags: { endedReason: message.endedReason || null },
  };
  if (transcript) callUpdate.transcriptText = transcript;
  if (recordingUrl) callUpdate.recordingUrl = recordingUrl;
  if (summary) callUpdate.aiSummary = summary;
  if (durationSeconds) callUpdate.durationSeconds = durationSeconds;
  if (messages && Array.isArray(messages) && messages.length > 0) {
    callUpdate.transcriptJson = messages.map((m) => ({
      role: m.role,
      text: m.content,
      timeInCallSecs: null,
    }));
  }

  await prisma.call.update({
    where: { id: dbCallId },
    data: callUpdate,
  });

  // Update Interaction
  const dbCall = await prisma.call.findUnique({
    where: { id: dbCallId },
    select: { interactionId: true },
  });
  if (dbCall) {
    await prisma.interaction.update({
      where: { id: dbCall.interactionId },
      data: { endedAt: new Date(), status: 'completed' },
    });
  }

  // Update Lead with intake data
  const extractedData: Record<string, unknown> = {};
  if (message.analysis?.structuredData && typeof message.analysis.structuredData === 'object') {
    Object.assign(extractedData, message.analysis.structuredData);
  }
  if (message.analysis && typeof message.analysis === 'object') {
    for (const [key, value] of Object.entries(message.analysis)) {
      if (key !== 'summary' && key !== 'structuredData' && value !== undefined && value !== null) {
        extractedData[key] = value;
      }
    }
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { intakeData: true, displayName: true, summary: true },
  });

  const existingIntakeData = (lead?.intakeData as Record<string, unknown>) || {};
  const flatData = Object.keys(extractedData).length > 0 ? flattenIntakeData(extractedData) : {};
  const mergedIntakeData = { ...existingIntakeData, ...flatData };

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      intakeData: Object.keys(mergedIntakeData).length > 0 ? mergedIntakeData as any : undefined,
      lastActivityAt: new Date(),
      displayName: extractDisplayName(flatData) || lead?.displayName || undefined,
      summary: summary || lead?.summary || undefined,
    },
  });

  // Upsert Intake
  await prisma.intake.upsert({
    where: { leadId },
    create: {
      orgId,
      leadId,
      completionStatus: 'complete',
      completedAt: new Date(),
      answers: mergedIntakeData as any,
    },
    update: {
      completionStatus: 'complete',
      completedAt: new Date(),
    },
  });

  // ── Verify: read back persisted record ──
  const verifyCall = await prisma.call.findUnique({
    where: { id: dbCallId },
    select: { id: true, orgId: true, leadId: true, aiSummary: true, transcriptText: true },
  });
  const verifyLead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, orgId: true, status: true, source: true, displayName: true },
  });

  console.log(JSON.stringify({
    tag: 'vapi_eocr_persisted',
    reqId,
    callId: vapiCallId,
    dbCallId,
    leadId,
    orgId,
    hasTranscript: !!transcript,
    hasSummary: !!summary,
    hasRecording: !!recordingUrl,
    durationSeconds,
    endedReason: message.endedReason || null,
    extractedFields: Object.keys(flatData),
    verify: {
      callFound: !!verifyCall,
      callOrgId: verifyCall?.orgId,
      callHasSummary: !!verifyCall?.aiSummary,
      callHasTranscript: !!verifyCall?.transcriptText,
      leadFound: !!verifyLead,
      leadOrgId: verifyLead?.orgId,
      leadStatus: verifyLead?.status,
      leadSource: verifyLead?.source,
      leadDisplayName: verifyLead?.displayName,
    },
  }));

  return { orgId };
}
