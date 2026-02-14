import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../apps/api/src/generated/prisma';
import {
  normalizeE164,
  maskPhone,
  checkIdempotency,
  lookupFirmByNumber,
  extractDisplayName,
} from './shared';

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
// Helpers
// ─────────────────────────────────────────────

let _reqCounter = 0;
function nextReqId(): string {
  return `vapi-${Date.now()}-${(++_reqCounter).toString(36)}`;
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
 * Store a raw webhook event. This is the ground-truth record of what Vapi sent.
 * Uses (provider, externalId, eventType) unique constraint for idempotency.
 * Returns true if stored (new), false if duplicate.
 */
async function storeRawEvent(
  prisma: PrismaClient,
  callId: string | null,
  eventType: string,
  payload: unknown,
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
    // Log but don't throw — storing the event is best-effort
    console.log(JSON.stringify({
      event: 'vapi_raw_store_error',
      externalId,
      error: err?.message || String(err),
    }));
    return true; // proceed anyway
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

  // "to" = the number that was called (our Vapi number) = call.phoneNumber.number
  // "from" = the caller = call.customer.number
  // But also check alternate locations Vapi might use
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
 * Find or create the full record chain (Contact → Lead → Interaction → Call)
 * for a Vapi call. Uses providerCallId (unique) as the stable key.
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

  // 2. Detect web calls (browser-based, no phone numbers)
  const callType = (message.call as any)?.type as string | undefined;
  const isWebCall = callType === 'webCall' || callType === 'vapi.websocketCall';

  // 3. Resolve phone numbers (will be null for web calls)
  const { fromNumber, toNumber, fromE164, toE164 } = resolvePhoneNumbers(message);

  console.log(JSON.stringify({
    event: 'vapi_chain_create_attempt',
    reqId,
    callId: vapiCallId,
    callType: callType || 'unknown',
    isWebCall,
    fromRaw: maskPhone(fromNumber),
    toRaw: maskPhone(toNumber),
    fromE164: maskPhone(fromE164),
    toE164: maskPhone(toE164),
  }));

  let orgId: string;
  let phoneNumberId: string;
  let contactFromE164: string;
  let contactToE164: string;

  if (isWebCall || (!fromE164 && !toE164)) {
    // ── Web call path: no phone numbers, resolve org by assistant ID or env ──
    const assistantId = (message.call as any)?.assistantId
      || (message.call as any)?.assistant?.id
      || null;

    // Try to find org: use VAPI_DEFAULT_ORG_ID env var (works for single-org deployments)
    const defaultOrgId = process.env.VAPI_DEFAULT_ORG_ID;
    const resolvedOrgId = defaultOrgId || null;

    if (!resolvedOrgId) {
      console.log(JSON.stringify({
        event: 'vapi_chain_create_fail',
        reqId,
        callId: vapiCallId,
        reason: 'web_call_no_org',
        callType,
        assistantId,
        hint: 'Set VAPI_DEFAULT_ORG_ID env var to the org UUID for web call routing',
        callKeys: message.call ? Object.keys(message.call) : [],
      }));
      return null;
    }

    orgId = resolvedOrgId;

    // Get org's first inbound phone number for FK reference
    const orgPhone = await prisma.phoneNumber.findFirst({
      where: { orgId, inboundEnabled: true },
      select: { id: true, e164: true },
    });
    if (!orgPhone) {
      console.log(JSON.stringify({
        event: 'vapi_chain_create_fail',
        reqId,
        callId: vapiCallId,
        reason: 'web_call_no_phone_number',
        orgId,
        hint: 'Org needs at least one phone number with inboundEnabled=true',
      }));
      return null;
    }

    phoneNumberId = orgPhone.id;
    // Use synthetic E164 values: "from" = web-{callId}, "to" = org's number
    contactFromE164 = `+0web${vapiCallId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
    contactToE164 = orgPhone.e164;

    console.log(JSON.stringify({
      event: 'vapi_web_call_resolved',
      reqId,
      callId: vapiCallId,
      orgId,
      phoneNumberId,
      assistantId,
    }));
  } else if (!fromE164 || !toE164) {
    // Partial phone data — can't proceed
    console.log(JSON.stringify({
      event: 'vapi_chain_create_fail',
      reqId,
      callId: vapiCallId,
      reason: 'missing_phones',
      fromPresent: !!fromNumber,
      toPresent: !!toNumber,
      callType,
      callKeys: message.call ? Object.keys(message.call) : [],
    }));
    return null;
  } else {
    // ── Phone call path: lookup org by called number ──
    const firm = await lookupFirmByNumber(prisma, toNumber!);
    if (!firm) {
      console.log(JSON.stringify({
        event: 'vapi_chain_create_fail',
        reqId,
        callId: vapiCallId,
        reason: 'no_firm_for_number',
        toE164: maskPhone(toE164),
        toRaw: toNumber,
        hint: 'Ensure this number exists in phone_numbers table with inbound_enabled=true',
      }));
      return null;
    }

    orgId = firm.orgId;
    phoneNumberId = firm.phoneNumberId;
    contactFromE164 = fromE164;
    contactToE164 = toE164;
  }

  // 4. Find or create Contact
  const isWeb = contactFromE164.startsWith('+0web');
  let contact = isWeb
    ? null
    : await prisma.contact.findFirst({
        where: { orgId, primaryPhone: contactFromE164 },
      });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        orgId,
        name: isWeb ? 'Web Visitor' : 'Unknown Caller',
        primaryPhone: contactFromE164,
      },
    });
  }

  // 5. Find or create Lead
  let lead: { id: string; intakeData: unknown; displayName: string | null; summary: string | null } | null = null;
  if (!isWeb) {
    lead = await prisma.lead.findFirst({
      where: { orgId, contactId: contact.id, status: { in: ['new', 'contacted', 'in_progress'] } },
      orderBy: { createdAt: 'desc' },
    });
  }
  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        orgId,
        contactId: contact.id,
        source: isWeb ? 'web' : 'phone',
        status: 'new',
        priority: 'medium',
      },
    });
  }

  // 6. Create Interaction
  const interaction = await prisma.interaction.create({
    data: {
      orgId,
      leadId: lead.id,
      channel: isWeb ? 'webchat' : 'call',
      status: 'active',
      startedAt: new Date(),
    },
  });

  // 7. Create Call
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

  console.log(JSON.stringify({
    event: 'vapi_chain_created',
    reqId,
    callId: vapiCallId,
    dbCallId: dbCall.id,
    leadId: lead.id,
    contactId: contact.id,
    orgId,
  }));

  return { dbCallId: dbCall.id, leadId: lead.id, orgId, created: true };
}

// ─────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────

export function createVapiWebhookRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Health check — public
  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, ts: new Date().toISOString() });
  });

  // ── Diagnostic: recent raw Vapi webhook events ──
  router.get('/diag/events', async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const events = await prisma.webhookEvent.findMany({
      where: { provider: 'vapi' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, externalId: true, eventType: true, createdAt: true },
    });
    res.json({ count: events.length, events });
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
    // Mask the numbers for safety
    const masked = phones.map((p) => ({
      ...p,
      e164: maskPhone(p.e164),
    }));
    res.json({ count: masked.length, phones: masked });
  });

  // ── Diagnostic: show raw payload of most recent webhook events ──
  router.get('/diag/raw', async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);
    const events = await prisma.webhookEvent.findMany({
      where: { provider: 'vapi' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, externalId: true, eventType: true, payload: true, createdAt: true },
    });
    res.json({ count: events.length, events });
  });

  // ── Main webhook endpoint — PUBLIC (no auth) ──
  router.post('/', async (req: Request, res: Response) => {
    const reqId = nextReqId();
    const body = req.body;
    const message: VapiMessage = body?.message || body;
    const messageType = message?.type;
    const callId = message?.call?.id || null;

    console.log(JSON.stringify({
      event: 'vapi_webhook_received',
      reqId,
      type: messageType,
      callId,
      callType: (message?.call as any)?.type || 'unknown',
      assistantId: (message?.call as any)?.assistantId || null,
      bodyKeys: body ? Object.keys(body) : [],
      messageKeys: message ? Object.keys(message) : [],
      hasCallObj: !!message?.call,
      callKeys: message?.call ? Object.keys(message.call) : [],
    }));

    if (!messageType) {
      res.status(400).json({ error: 'Missing message.type' });
      return;
    }

    // ── Fast path: assistant-request (no DB, < 1s) ──
    if (messageType === 'assistant-request') {
      const assistantId = process.env.VAPI_ASSISTANT_ID_BUSINESS_HOURS || process.env.VAPI_ASSISTANT_ID;

      console.log(JSON.stringify({
        event: 'vapi_assistant_request',
        reqId,
        callId,
        hasAssistantId: !!assistantId,
      }));

      res.status(200).json({ assistantId });
      return;
    }

    // ── Fast path: tool-calls (respond immediately, process async) ──
    if (messageType === 'tool-calls') {
      const toolCalls = message.toolCalls || message.toolCallList || [];
      const results = toolCalls.map((tc) => ({
        toolCallId: tc.id,
        result: 'ok',
      }));

      res.status(200).json({ results });

      // Store + process async
      processToolCalls(prisma, callId, toolCalls, body, reqId).catch((err: any) => {
        console.log(JSON.stringify({
          event: 'vapi_tool_calls_error',
          reqId,
          callId,
          error: err?.message || String(err),
        }));
      });
      return;
    }

    // ── All other events: respond 200, store raw, process async ──
    res.status(200).json({ ok: true });

    // Store raw payload for every event type (ground truth)
    storeRawEvent(prisma, callId, messageType, body).catch((err: any) => {
      console.log(JSON.stringify({
        event: 'vapi_raw_store_error_unhandled',
        reqId,
        callId,
        type: messageType,
        error: err?.message || String(err),
      }));
    });

    if (!callId) {
      console.log(JSON.stringify({ event: 'vapi_no_call_id', reqId, type: messageType }));
      return;
    }

    try {
      if (messageType === 'end-of-call-report') {
        await ingestEndOfCallReport(prisma, callId, message, body, reqId);
      } else if (messageType === 'transcript') {
        await ingestTranscript(prisma, callId, message, reqId);
      } else if (messageType === 'status-update') {
        await ingestStatusUpdate(prisma, callId, message, reqId);
      } else {
        console.log(JSON.stringify({
          event: 'vapi_event_logged',
          reqId,
          type: messageType,
          callId,
        }));
      }
    } catch (err: any) {
      console.log(JSON.stringify({
        event: 'vapi_async_error',
        reqId,
        type: messageType,
        callId,
        error: err?.message || String(err),
        stack: err?.stack?.split('\n').slice(0, 3).join(' | '),
      }));
    }
  });

  return router;
}

// ─────────────────────────────────────────────
// Async ingestion functions
// ─────────────────────────────────────────────

async function ingestStatusUpdate(
  prisma: PrismaClient,
  vapiCallId: string,
  message: VapiMessage,
  reqId: string,
): Promise<void> {
  if (message.status === 'in-progress') {
    const result = await findOrCreateCallChain(prisma, vapiCallId, message, reqId);
    console.log(JSON.stringify({
      event: 'vapi_status_update_processed',
      reqId,
      status: 'in-progress',
      callId: vapiCallId,
      dbCallId: result?.dbCallId || null,
      created: result?.created || false,
      chainNull: !result,
    }));
  } else if (message.status === 'ended') {
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
        event: 'vapi_status_update_processed',
        reqId,
        status: 'ended',
        callId: vapiCallId,
        dbCallId: dbCall.id,
        durationSeconds: dur,
      }));
    } else {
      console.log(JSON.stringify({
        event: 'vapi_status_update_no_call',
        reqId,
        callId: vapiCallId,
        status: 'ended',
      }));
    }
  } else {
    console.log(JSON.stringify({
      event: 'vapi_status_update_ignored',
      reqId,
      callId: vapiCallId,
      status: message.status,
    }));
  }
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
    console.log(JSON.stringify({
      event: 'vapi_transcript_skip',
      reqId,
      callId: vapiCallId,
      reason: 'no_call_yet',
    }));
    return;
  }

  await prisma.call.update({
    where: { id: dbCall.id },
    data: { transcriptText: transcript },
  });

  console.log(JSON.stringify({
    event: 'vapi_transcript_updated',
    reqId,
    callId: vapiCallId,
    dbCallId: dbCall.id,
    length: transcript.length,
  }));
}

async function processToolCalls(
  prisma: PrismaClient,
  callId: string | null,
  toolCalls: VapiToolCall[],
  rawBody: unknown,
  reqId: string,
): Promise<void> {
  // Store raw event
  await storeRawEvent(prisma, callId, 'tool-calls', rawBody);

  if (!callId || toolCalls.length === 0) return;

  const dbCall = await prisma.call.findUnique({
    where: { providerCallId: callId },
    include: { lead: true },
  });

  if (!dbCall) {
    console.log(JSON.stringify({
      event: 'vapi_tool_calls_no_call',
      reqId,
      callId,
      toolNames: toolCalls.map((tc) => tc.function?.name).filter(Boolean),
    }));
    return;
  }

  for (const tc of toolCalls) {
    const toolName = tc.function?.name || '';
    const toolArgs = (tc.function?.arguments || {}) as Record<string, unknown>;

    console.log(JSON.stringify({
      event: 'vapi_tool_call_processing',
      reqId,
      callId,
      toolName,
      argKeys: Object.keys(toolArgs),
    }));

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

      console.log(JSON.stringify({
        event: 'vapi_tool_call_processed',
        reqId,
        callId,
        toolName,
        action: 'save_intake',
        fieldsUpdated: Object.keys(flatData).length,
      }));
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

      console.log(JSON.stringify({
        event: 'vapi_tool_call_processed',
        reqId,
        callId,
        toolName,
        action: 'complete_intake',
      }));
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

      console.log(JSON.stringify({
        event: 'vapi_tool_call_processed',
        reqId,
        callId,
        toolName,
        action: 'handoff',
      }));
    } else {
      console.log(JSON.stringify({
        event: 'vapi_tool_call_unknown',
        reqId,
        callId,
        toolName,
      }));
    }
  }
}

async function ingestEndOfCallReport(
  prisma: PrismaClient,
  vapiCallId: string,
  message: VapiMessage,
  rawBody: unknown,
  reqId: string,
): Promise<void> {
  // Idempotency check (also stores the raw event)
  const isNew = await checkIdempotency(prisma, 'vapi', vapiCallId, 'end-of-call-report', rawBody);
  if (!isNew) {
    console.log(JSON.stringify({ event: 'vapi_idempotent_skip', reqId, callId: vapiCallId, eventType: 'end-of-call-report' }));
    return;
  }

  // Find or create the full chain
  const chain = await findOrCreateCallChain(prisma, vapiCallId, message, reqId);
  if (!chain) {
    console.log(JSON.stringify({
      event: 'vapi_eocr_unlinked',
      reqId,
      callId: vapiCallId,
      hint: 'Chain creation failed — check vapi_chain_create_fail logs above',
    }));
    return;
  }

  const { dbCallId, leadId, orgId } = chain;

  // Pull data from Vapi payload (multiple possible locations)
  const transcript = message.transcript || message.artifact?.transcript || null;
  const recordingUrl = message.recordingUrl || message.artifact?.recordingUrl || null;
  const summary = message.summary || message.analysis?.summary || null;
  const durationSeconds = typeof message.durationSeconds === 'number' ? message.durationSeconds : null;
  const messages = message.messages || message.artifact?.messages || null;

  // ── Update Call ──
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
      message: m.content,
      timeInCallSecs: null,
    }));
  }

  await prisma.call.update({
    where: { id: dbCallId },
    data: callUpdate,
  });

  // ── Update Interaction ──
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

  // ── Update Lead with intake data ──
  const extractedData: Record<string, unknown> = {};

  // Pull from analysis.structuredData (Vapi's primary structured output)
  if (message.analysis?.structuredData && typeof message.analysis.structuredData === 'object') {
    Object.assign(extractedData, message.analysis.structuredData);
  }
  // Also pull from analysis top-level keys
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

  // Always set summary from EOCR so dashboard has something to show
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      intakeData: Object.keys(mergedIntakeData).length > 0 ? mergedIntakeData as any : undefined,
      lastActivityAt: new Date(),
      displayName: extractDisplayName(flatData) || lead?.displayName || undefined,
      summary: summary || lead?.summary || undefined,
    },
  });

  // ── Upsert Intake ──
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

  console.log(JSON.stringify({
    event: 'vapi_end_of_call_ingested',
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
  }));
}
