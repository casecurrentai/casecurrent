import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '../../apps/api/src/generated/prisma';
import crypto from 'crypto';
import {
  normalizeE164,
  maskPhone,
  checkIdempotency,
  lookupFirmByNumber,
  extractDisplayName,
} from './shared';

interface VapiCall {
  id: string;
  phoneNumber?: { number?: string };
  customer?: { number?: string };
  [key: string]: unknown;
}

interface VapiToolCall {
  id?: string;
  type?: string;
  function?: {
    name: string;
    arguments?: Record<string, unknown>;
  };
  result?: unknown;
  [key: string]: unknown;
}

interface VapiMessage {
  type: string;
  call?: VapiCall;
  status?: string;
  transcript?: string;
  toolCalls?: VapiToolCall[];
  toolCallList?: VapiToolCall[];
  endedReason?: string;
  recordingUrl?: string;
  summary?: string;
  messages?: Array<{ role: string; content: string }>;
  artifact?: {
    transcript?: string;
    recordingUrl?: string;
    messages?: Array<{ role: string; content: string }>;
    [key: string]: unknown;
  };
  analysis?: {
    summary?: string;
    [key: string]: unknown;
  };
  durationSeconds?: number;
  [key: string]: unknown;
}

const INTAKE_FIELDS = [
  'callerName', 'phoneNumber', 'phone', 'from',
  'practiceAreaGuess', 'incidentDate', 'incidentLocation',
  'injuryDescription', 'atFaultParty', 'medicalTreatment', 'insuranceInfo',
] as const;

const SAVE_INTAKE_TOOLS = ['save_intake_answers', 'save_partial_intake'];
const COMPLETE_INTAKE_TOOLS = ['complete_intake', 'intake_complete', 'end_call'];
const HANDOFF_TOOLS = ['handoff', 'transfer', 'needs_handoff'];

function flattenIntakeData(data: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const key of INTAKE_FIELDS) {
    if (data[key] !== undefined && data[key] !== null) {
      flat[key] = data[key];
    }
  }
  // Also pass through any other keys from the data
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null && !(key in flat)) {
      flat[key] = value;
    }
  }
  return flat;
}

export function createVapiWebhookRouter(prisma: PrismaClient): Router {
  const router = Router();
  const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.log(JSON.stringify({
      event: 'vapi_signature_skipped',
      reason: 'VAPI_WEBHOOK_SECRET not configured — webhook signature verification disabled',
    }));
  }

  const secretMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (!webhookSecret) {
      next();
      return;
    }

    const receivedSecret = req.headers['x-vapi-secret'] as string | undefined;
    if (!receivedSecret) {
      console.log(JSON.stringify({ event: 'vapi_signature_invalid', reason: 'missing x-vapi-secret header' }));
      res.status(403).json({ error: 'Missing x-vapi-secret header' });
      return;
    }

    const expected = Buffer.from(webhookSecret);
    const received = Buffer.from(receivedSecret);
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      console.log(JSON.stringify({ event: 'vapi_signature_invalid', reason: 'secret mismatch' }));
      res.status(403).json({ error: 'Invalid webhook secret' });
      return;
    }

    next();
  };

  // Health check (no auth)
  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, ts: new Date().toISOString() });
  });

  // Main webhook endpoint
  router.post('/', secretMiddleware, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const body = req.body;
    const message: VapiMessage = body?.message || body;
    const messageType = message?.type;
    const call = message?.call;
    const callId = call?.id;

    console.log(JSON.stringify({
      event: 'vapi_webhook_received',
      type: messageType,
      callId: callId || null,
    }));

    if (!messageType) {
      res.status(400).json({ error: 'Missing message.type' });
      return;
    }

    if (!callId) {
      res.status(400).json({ error: 'Missing message.call.id' });
      return;
    }

    try {
      switch (messageType) {
        case 'status-update':
          await handleStatusUpdate(prisma, message, callId, res);
          break;
        case 'transcript':
          await handleTranscript(prisma, message, callId, res);
          break;
        case 'tool-calls':
          await handleToolCalls(prisma, message, callId, res);
          break;
        case 'end-of-call-report':
          await handleEndOfCallReport(prisma, message, callId, res);
          break;
        default:
          console.log(JSON.stringify({ event: 'vapi_unknown_type', type: messageType, callId }));
          res.status(200).json({ status: 'ignored', type: messageType });
          return;
      }
    } catch (err: any) {
      console.log(JSON.stringify({
        event: 'vapi_webhook_error',
        type: messageType,
        callId,
        error: err?.message || String(err),
        durationMs: Date.now() - startMs,
      }));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

async function handleStatusUpdate(
  prisma: PrismaClient,
  message: VapiMessage,
  callId: string,
  res: Response
): Promise<void> {
  const status = message.status;

  if (status === 'in-progress') {
    const isNew = await checkIdempotency(prisma, 'vapi', callId, 'status-update:in-progress', message);
    if (!isNew) {
      console.log(JSON.stringify({ event: 'vapi_idempotent_skip', callId, eventType: 'status-update:in-progress' }));
      res.status(200).json({ status: 'duplicate', callId });
      return;
    }

    const call = message.call!;
    const toNumber = call.phoneNumber?.number;
    const fromNumber = call.customer?.number;

    const fromE164 = normalizeE164(fromNumber || null);
    const toE164 = normalizeE164(toNumber || null);

    if (!fromE164 || !toE164) {
      console.log(JSON.stringify({
        event: 'vapi_status_update_invalid_phones',
        callId,
        from: maskPhone(fromNumber || null),
        to: maskPhone(toNumber || null),
      }));
      res.status(400).json({ error: 'Invalid phone numbers' });
      return;
    }

    const firm = await lookupFirmByNumber(prisma, toNumber!);
    if (!firm) {
      console.log(JSON.stringify({
        event: 'vapi_firm_lookup_miss',
        callId,
        calledNumber: maskPhone(toE164),
      }));
      res.status(404).json({ error: 'No firm found for called number' });
      return;
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
        providerCallId: callId,
        fromE164,
        toE164,
        startedAt: new Date(),
      },
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastActivityAt: new Date() },
    });

    console.log(JSON.stringify({
      event: 'vapi_status_update_processed',
      status: 'in-progress',
      callId,
      dbCallId: dbCall.id,
      leadId: lead.id,
      orgId,
    }));

    res.status(200).json({ status: 'ok', callId: dbCall.id, leadId: lead.id });
  } else if (status === 'ended') {
    const isNew = await checkIdempotency(prisma, 'vapi', callId, 'status-update:ended', message);
    if (!isNew) {
      console.log(JSON.stringify({ event: 'vapi_idempotent_skip', callId, eventType: 'status-update:ended' }));
      res.status(200).json({ status: 'duplicate', callId });
      return;
    }

    const dbCall = await prisma.call.findFirst({
      where: { providerCallId: callId },
    });

    if (!dbCall) {
      console.log(JSON.stringify({ event: 'vapi_call_not_found', callId, eventType: 'status-update:ended' }));
      res.status(200).json({ status: 'unlinked', callId });
      return;
    }

    const updateData: Record<string, unknown> = {
      endedAt: new Date(),
    };

    if (dbCall.startedAt) {
      updateData.durationSeconds = Math.round((Date.now() - dbCall.startedAt.getTime()) / 1000);
    }

    await prisma.call.update({
      where: { id: dbCall.id },
      data: updateData,
    });

    await prisma.interaction.update({
      where: { id: dbCall.interactionId },
      data: { endedAt: new Date(), status: 'completed' },
    });

    console.log(JSON.stringify({
      event: 'vapi_status_update_processed',
      status: 'ended',
      callId,
      dbCallId: dbCall.id,
    }));

    res.status(200).json({ status: 'ok', callId: dbCall.id });
  } else {
    console.log(JSON.stringify({ event: 'vapi_status_update_ignored', status, callId }));
    res.status(200).json({ status: 'ignored', callId });
  }
}

async function handleTranscript(
  prisma: PrismaClient,
  message: VapiMessage,
  callId: string,
  res: Response
): Promise<void> {
  const transcript = message.transcript;
  if (!transcript) {
    res.status(200).json({ status: 'ignored', reason: 'no transcript text' });
    return;
  }

  const dbCall = await prisma.call.findFirst({
    where: { providerCallId: callId },
  });

  if (!dbCall) {
    console.log(JSON.stringify({ event: 'vapi_call_not_found', callId, eventType: 'transcript' }));
    res.status(200).json({ status: 'unlinked', callId });
    return;
  }

  await prisma.call.update({
    where: { id: dbCall.id },
    data: { transcriptText: transcript },
  });

  console.log(JSON.stringify({
    event: 'vapi_transcript_updated',
    callId,
    dbCallId: dbCall.id,
    transcriptLength: transcript.length,
  }));

  res.status(200).json({ status: 'ok', callId: dbCall.id });
}

async function handleToolCalls(
  prisma: PrismaClient,
  message: VapiMessage,
  callId: string,
  res: Response
): Promise<void> {
  const toolCalls = message.toolCalls || message.toolCallList || [];
  if (toolCalls.length === 0) {
    res.status(200).json({ status: 'ignored', reason: 'no tool calls' });
    return;
  }

  const dbCall = await prisma.call.findFirst({
    where: { providerCallId: callId },
    include: { lead: true },
  });

  if (!dbCall) {
    console.log(JSON.stringify({ event: 'vapi_call_not_found', callId, eventType: 'tool-calls' }));
    res.status(200).json({ status: 'unlinked', callId });
    return;
  }

  for (const toolCall of toolCalls) {
    const toolName = toolCall.function?.name || '';
    const toolArgs = toolCall.function?.arguments || {};
    const toolResult = (toolCall.result as Record<string, unknown>) || toolArgs;

    if (SAVE_INTAKE_TOOLS.includes(toolName)) {
      const existingIntakeData = (dbCall.lead.intakeData as Record<string, unknown>) || {};
      const flatData = flattenIntakeData(toolResult);
      const mergedIntakeData = { ...existingIntakeData, ...flatData };

      await prisma.lead.update({
        where: { id: dbCall.leadId },
        data: {
          intakeData: mergedIntakeData as any,
          lastActivityAt: new Date(),
          displayName: extractDisplayName(flatData) || dbCall.lead.displayName,
        },
      });

      console.log(JSON.stringify({
        event: 'vapi_tool_call_processed',
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
          answers: toolResult as any,
        },
        update: {
          completionStatus: 'complete',
          completedAt: new Date(),
        },
      });

      console.log(JSON.stringify({
        event: 'vapi_tool_call_processed',
        callId,
        toolName,
        action: 'complete_intake',
      }));
    } else if (HANDOFF_TOOLS.includes(toolName)) {
      await prisma.lead.update({
        where: { id: dbCall.leadId },
        data: {
          status: 'needs_handoff',
          lastActivityAt: new Date(),
        },
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
        callId,
        toolName,
        action: 'handoff',
        leadId: dbCall.leadId,
      }));
    } else {
      console.log(JSON.stringify({
        event: 'vapi_tool_call_processed',
        callId,
        toolName,
        action: 'unknown_tool',
      }));
    }
  }

  res.status(200).json({ status: 'ok', callId: dbCall.id, toolCallsProcessed: toolCalls.length });
}

async function handleEndOfCallReport(
  prisma: PrismaClient,
  message: VapiMessage,
  callId: string,
  res: Response
): Promise<void> {
  const isNew = await checkIdempotency(prisma, 'vapi', callId, 'end-of-call-report', message);
  if (!isNew) {
    console.log(JSON.stringify({ event: 'vapi_idempotent_skip', callId, eventType: 'end-of-call-report' }));
    res.status(200).json({ status: 'duplicate', callId });
    return;
  }

  const dbCall = await prisma.call.findFirst({
    where: { providerCallId: callId },
    include: { lead: true },
  });

  if (!dbCall) {
    console.log(JSON.stringify({ event: 'vapi_call_not_found', callId, eventType: 'end-of-call-report' }));
    res.status(200).json({ status: 'unlinked', callId });
    return;
  }

  const transcript = message.transcript || message.artifact?.transcript || null;
  const recordingUrl = message.recordingUrl || message.artifact?.recordingUrl || null;
  const summary = message.summary || message.analysis?.summary || null;
  const durationSeconds = message.durationSeconds || null;
  const messages = message.messages || message.artifact?.messages || null;

  const callUpdateData: Record<string, unknown> = {
    endedAt: dbCall.endedAt || new Date(),
  };

  if (transcript) callUpdateData.transcriptText = transcript;
  if (recordingUrl) callUpdateData.recordingUrl = recordingUrl;
  if (summary) callUpdateData.aiSummary = summary;
  if (durationSeconds && !dbCall.durationSeconds) callUpdateData.durationSeconds = durationSeconds;

  if (messages && Array.isArray(messages) && messages.length > 0) {
    callUpdateData.transcriptJson = messages.map((m) => ({
      role: m.role,
      message: m.content,
      timeInCallSecs: null,
    }));
  }

  const existingAiFlags = (dbCall.aiFlags as Record<string, unknown>) || {};
  callUpdateData.aiFlags = {
    ...existingAiFlags,
    endedReason: message.endedReason || null,
  };

  await prisma.call.update({
    where: { id: dbCall.id },
    data: callUpdateData,
  });

  // Extract flat intake data from the report if structured data exists
  const extractedData: Record<string, unknown> = {};
  if (message.analysis && typeof message.analysis === 'object') {
    for (const [key, value] of Object.entries(message.analysis)) {
      if (key !== 'summary' && value !== undefined && value !== null) {
        extractedData[key] = value;
      }
    }
  }

  const existingIntakeData = (dbCall.lead.intakeData as Record<string, unknown>) || {};
  const flatData = Object.keys(extractedData).length > 0 ? flattenIntakeData(extractedData) : {};
  const mergedIntakeData = { ...existingIntakeData, ...flatData };

  await prisma.lead.update({
    where: { id: dbCall.leadId },
    data: {
      intakeData: Object.keys(mergedIntakeData).length > 0 ? mergedIntakeData as any : dbCall.lead.intakeData,
      lastActivityAt: new Date(),
      displayName: extractDisplayName(flatData) || dbCall.lead.displayName,
      summary: summary || dbCall.lead.summary,
    },
  });

  // Update intake if one exists
  const existingIntake = await prisma.intake.findUnique({
    where: { leadId: dbCall.leadId },
  });
  if (existingIntake) {
    await prisma.intake.update({
      where: { leadId: dbCall.leadId },
      data: { completionStatus: 'complete', completedAt: existingIntake.completedAt || new Date() },
    });
  }

  // Mark interaction as completed
  await prisma.interaction.update({
    where: { id: dbCall.interactionId },
    data: { endedAt: new Date(), status: 'completed' },
  });

  console.log(JSON.stringify({
    event: 'vapi_end_of_call_processed',
    callId,
    dbCallId: dbCall.id,
    leadId: dbCall.leadId,
    hasTranscript: !!transcript,
    hasRecordingUrl: !!recordingUrl,
    hasSummary: !!summary,
    endedReason: message.endedReason || null,
  }));

  res.status(200).json({ status: 'ok', callId: dbCall.id, leadId: dbCall.leadId });
}
