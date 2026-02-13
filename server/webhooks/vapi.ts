import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../apps/api/src/generated/prisma';
import {
  normalizeE164,
  maskPhone,
  checkIdempotency,
  lookupFirmByNumber,
  extractDisplayName,
} from './shared';

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
    phoneNumber?: { number?: string };
    customer?: { number?: string };
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
  messages?: Array<{ role: string; content: string; [key: string]: unknown }>;
  artifact?: {
    transcript?: string;
    recordingUrl?: string;
    messages?: Array<{ role: string; content: string; [key: string]: unknown }>;
    [key: string]: unknown;
  };
  analysis?: {
    summary?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

const INTAKE_FIELDS = [
  'callerName', 'phoneNumber', 'phone', 'from',
  'practiceAreaGuess', 'incidentDate', 'incidentLocation',
  'injuryDescription', 'atFaultParty', 'medicalTreatment', 'insuranceInfo',
] as const;

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
 * Find or create the full record chain (Contact → Lead → Interaction → Call)
 * for a Vapi call. Uses providerCallId (unique) as the stable key.
 * If the call already exists, returns it. Otherwise creates the full chain
 * using the called/customer phone numbers from the Vapi payload.
 */
async function findOrCreateCallChain(
  prisma: PrismaClient,
  vapiCallId: string,
  message: VapiMessage,
): Promise<{
  dbCallId: string;
  leadId: string;
  orgId: string;
  created: boolean;
} | null> {
  // Try to find existing call first
  const existing = await prisma.call.findUnique({
    where: { providerCallId: vapiCallId },
    select: { id: true, leadId: true, orgId: true },
  });
  if (existing) {
    return { dbCallId: existing.id, leadId: existing.leadId, orgId: existing.orgId, created: false };
  }

  // Need to create — resolve org from called number
  const call = message.call;
  const toNumber = call?.phoneNumber?.number;
  const fromNumber = call?.customer?.number;
  const fromE164 = normalizeE164(fromNumber || null);
  const toE164 = normalizeE164(toNumber || null);

  if (!fromE164 || !toE164) {
    console.log(JSON.stringify({
      event: 'vapi_create_chain_skip',
      reason: 'missing_phones',
      callId: vapiCallId,
      from: maskPhone(fromNumber || null),
      to: maskPhone(toNumber || null),
    }));
    return null;
  }

  const firm = await lookupFirmByNumber(prisma, toNumber!);
  if (!firm) {
    console.log(JSON.stringify({
      event: 'vapi_create_chain_skip',
      reason: 'no_firm_for_number',
      callId: vapiCallId,
      calledNumber: maskPhone(toE164),
    }));
    return null;
  }

  const { orgId, phoneNumberId } = firm;

  let contact = await prisma.contact.findFirst({
    where: { orgId, primaryPhone: fromE164 },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: { orgId, name: 'Unknown Caller', primaryPhone: fromE164 },
    });
  }

  let lead = await prisma.lead.findFirst({
    where: { orgId, contactId: contact.id, status: { in: ['new', 'contacted', 'in_progress'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        orgId,
        contactId: contact.id,
        source: 'phone',
        status: 'new',
        priority: 'medium',
      },
    });
  }

  const interaction = await prisma.interaction.create({
    data: {
      orgId,
      leadId: lead.id,
      channel: 'call',
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
      fromE164,
      toE164,
      startedAt: new Date(),
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { lastActivityAt: new Date() },
  });

  return { dbCallId: dbCall.id, leadId: lead.id, orgId, created: true };
}

export function createVapiWebhookRouter(prisma: PrismaClient): Router {
  const router = Router();
  // Health check — public
  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, ts: new Date().toISOString() });
  });

  // Main webhook endpoint — PUBLIC (no auth). Vapi assistant-request
  // does not send x-vapi-secret, so this route must have no auth middleware.
  router.post('/', async (req: Request, res: Response) => {
    const body = req.body;
    const message: VapiMessage = body?.message || body;
    const messageType = message?.type;
    const callId = message?.call?.id || null;

    console.log(JSON.stringify({
      event: 'vapi_webhook_received',
      type: messageType,
      callId,
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
        callId,
        hasAssistantId: !!assistantId,
      }));

      res.status(200).json({ assistantId });
      return;
    }

    // ── Fast path: tool-calls (respond immediately, store async) ──
    if (messageType === 'tool-calls') {
      const toolCalls = message.toolCalls || message.toolCallList || [];
      const results = toolCalls.map((tc) => ({
        toolCallId: tc.id,
        result: 'ok',
      }));

      res.status(200).json({ results });

      prisma.webhookEvent.create({
        data: {
          provider: 'vapi',
          externalId: callId || `tool-calls-${Date.now()}`,
          eventType: 'tool-calls',
          payload: body as any,
        },
      }).catch((err: any) => {
        if (err?.code !== 'P2002') {
          console.log(JSON.stringify({
            event: 'vapi_tool_calls_store_error',
            callId,
            error: err?.message || String(err),
          }));
        }
      });

      console.log(JSON.stringify({
        event: 'vapi_tool_calls_processed',
        callId,
        toolCount: toolCalls.length,
      }));
      return;
    }

    // ── Ingestion path: end-of-call-report ──
    if (messageType === 'end-of-call-report') {
      res.status(200).json({ ok: true });

      if (!callId) {
        console.log(JSON.stringify({ event: 'vapi_eocr_skip', reason: 'no_call_id' }));
        return;
      }

      ingestEndOfCallReport(prisma, callId, message, body).catch((err: any) => {
        console.log(JSON.stringify({
          event: 'vapi_eocr_error',
          callId,
          error: err?.message || String(err),
        }));
      });
      return;
    }

    // ── Ingestion path: transcript ──
    if (messageType === 'transcript') {
      res.status(200).json({ ok: true });

      if (!callId) return;

      ingestTranscript(prisma, callId, message).catch((err: any) => {
        console.log(JSON.stringify({
          event: 'vapi_transcript_error',
          callId,
          error: err?.message || String(err),
        }));
      });
      return;
    }

    // ── Lightweight path: status-update ──
    if (messageType === 'status-update') {
      res.status(200).json({ ok: true });

      if (!callId) return;

      if (message.status === 'in-progress') {
        findOrCreateCallChain(prisma, callId, message).then((result) => {
          console.log(JSON.stringify({
            event: 'vapi_status_update_processed',
            status: 'in-progress',
            callId,
            dbCallId: result?.dbCallId || null,
            created: result?.created || false,
          }));
        }).catch((err: any) => {
          console.log(JSON.stringify({
            event: 'vapi_status_update_error',
            callId,
            error: err?.message || String(err),
          }));
        });
      } else {
        console.log(JSON.stringify({
          event: 'vapi_event_logged',
          type: messageType,
          callId,
          status: message.status || null,
        }));
      }
      return;
    }

    // ── All other types: log only ──
    console.log(JSON.stringify({
      event: 'vapi_event_logged',
      type: messageType,
      callId,
      status: (message as any).status || null,
    }));

    res.status(200).json({ ok: true });
  });

  return router;
}

// ─────────────────────────────────────────────
// Async ingestion functions (fire-and-forget)
// ─────────────────────────────────────────────

async function ingestEndOfCallReport(
  prisma: PrismaClient,
  vapiCallId: string,
  message: VapiMessage,
  rawBody: unknown,
): Promise<void> {
  // Idempotency
  const isNew = await checkIdempotency(prisma, 'vapi', vapiCallId, 'end-of-call-report', rawBody);
  if (!isNew) {
    console.log(JSON.stringify({ event: 'vapi_idempotent_skip', callId: vapiCallId, eventType: 'end-of-call-report' }));
    return;
  }

  // Find or create the full chain
  const chain = await findOrCreateCallChain(prisma, vapiCallId, message);
  if (!chain) {
    console.log(JSON.stringify({ event: 'vapi_eocr_unlinked', callId: vapiCallId }));
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
  if (message.analysis && typeof message.analysis === 'object') {
    for (const [key, value] of Object.entries(message.analysis)) {
      if (key !== 'summary' && value !== undefined && value !== null) {
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
    callId: vapiCallId,
    dbCallId,
    leadId,
    orgId,
    hasTranscript: !!transcript,
    hasSummary: !!summary,
    endedReason: message.endedReason || null,
  }));
}

async function ingestTranscript(
  prisma: PrismaClient,
  vapiCallId: string,
  message: VapiMessage,
): Promise<void> {
  const transcript = message.transcript;
  if (!transcript) return;

  const dbCall = await prisma.call.findUnique({
    where: { providerCallId: vapiCallId },
    select: { id: true },
  });

  if (!dbCall) {
    // Call doesn't exist yet — transcript will arrive again in end-of-call-report
    console.log(JSON.stringify({ event: 'vapi_transcript_skip', callId: vapiCallId, reason: 'no_call_yet' }));
    return;
  }

  await prisma.call.update({
    where: { id: dbCall.id },
    data: { transcriptText: transcript },
  });

  console.log(JSON.stringify({
    event: 'vapi_transcript_updated',
    callId: vapiCallId,
    dbCallId: dbCall.id,
    length: transcript.length,
  }));
}
