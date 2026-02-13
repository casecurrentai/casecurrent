import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '../../apps/api/src/generated/prisma';
import crypto from 'crypto';

const router = Router();

interface InboundPayload {
  caller_id: string;
  called_number: string;
  call_sid?: string;
  conversation_id?: string;
  timestamp?: string;
  client_data?: {
    interactionId?: string;
    callSid?: string;
    [key: string]: unknown;
  };
}

interface RawTranscriptEntry {
  role?: string;
  speaker?: string;
  message?: string;
  text?: string;
  content?: string;
  timestamp?: string | number;
  time?: number;
  timeInCallSecs?: number;
  start_time?: number;
  [key: string]: unknown;
}

interface NormalizedTranscriptEntry {
  role: string;
  message: string;
  timeInCallSecs: number | null;
}

interface PostCallPayload {
  conversation_id: string;
  call_sid?: string;
  caller_id?: string;
  called_number?: string;
  duration_seconds?: number;
  transcript?: string;
  transcript_json?: RawTranscriptEntry[];
  summary?: string;
  extracted_data?: Record<string, unknown>;
  outcome?: string;
  recording_url?: string;
  ended_at?: string;
  client_data?: {
    interactionId?: string;
    callSid?: string;
    [key: string]: unknown;
  };
}

function normalizeE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (digits.startsWith('1') && digits.length > 11) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

function maskPhone(phone: string | null): string {
  if (!phone) return 'null';
  if (phone.length <= 4) return '****';
  return `****${phone.slice(-4)}`;
}

function normalizeTranscript(raw: RawTranscriptEntry[] | undefined): NormalizedTranscriptEntry[] {
  if (!raw || !Array.isArray(raw)) return [];
  
  return raw.map((entry) => {
    const role = entry.role || entry.speaker || 'unknown';
    const message = entry.message || entry.text || entry.content || '';
    
    let timeInCallSecs: number | null = null;
    if (typeof entry.timeInCallSecs === 'number') {
      timeInCallSecs = entry.timeInCallSecs;
    } else if (typeof entry.time === 'number') {
      timeInCallSecs = entry.time;
    } else if (typeof entry.start_time === 'number') {
      timeInCallSecs = entry.start_time;
    } else if (typeof entry.timestamp === 'number') {
      timeInCallSecs = entry.timestamp;
    }
    
    return {
      role: String(role),
      message: String(message),
      timeInCallSecs,
    };
  });
}

function verifyElevenLabsSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  try {
    const parts = signatureHeader.split(',');
    if (parts.length < 2) return false;

    const timestampPart = parts.find(p => p.startsWith('t='));
    const hashPart = parts.find(p => p.startsWith('v1='));

    if (!timestampPart || !hashPart) return false;

    const timestamp = timestampPart.split('=')[1];
    const receivedHash = hashPart.split('=')[1];

    const payload = `${timestamp}.${rawBody}`;
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(receivedHash, 'hex'), Buffer.from(expectedHash, 'hex'))) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const timestampNum = parseInt(timestamp, 10);
    if (Math.abs(now - timestampNum) > 300) {
      console.log(JSON.stringify({
        event: 'elevenlabs_signature_timestamp_expired',
        timestampAge: now - timestampNum,
      }));
      return false;
    }

    return true;
  } catch (err) {
    console.log(JSON.stringify({
      event: 'elevenlabs_signature_verification_error',
      error: err instanceof Error ? err.message : String(err),
    }));
    return false;
  }
}

async function lookupFirmByNumber(
  prisma: PrismaClient,
  calledNumber: string
): Promise<{ orgId: string; phoneNumberId: string } | null> {
  const normalized = normalizeE164(calledNumber);
  if (!normalized) return null;

  const phoneNumber = await prisma.phoneNumber.findFirst({
    where: {
      e164: normalized,
      inboundEnabled: true,
    },
    select: { id: true, orgId: true },
  });

  if (!phoneNumber) {
    console.log(JSON.stringify({
      event: 'elevenlabs_firm_lookup_miss',
      calledNumber: maskPhone(normalized),
    }));
    return null;
  }

  return { orgId: phoneNumber.orgId, phoneNumberId: phoneNumber.id };
}

async function checkIdempotency(
  prisma: PrismaClient,
  provider: string,
  externalId: string,
  eventType: string,
  payload: unknown
): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({
      data: {
        provider,
        externalId,
        eventType,
        payload: payload as any,
      },
    });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      console.log(JSON.stringify({
        event: 'elevenlabs_idempotent_skip',
        provider,
        externalId,
        eventType,
      }));
      return false;
    }
    throw err;
  }
}

async function findCallByCorrelation(
  prisma: PrismaClient,
  payload: PostCallPayload
): Promise<{ call: any; correlationMethod: string } | null> {
  const clientData = payload.client_data;

  if (clientData?.interactionId) {
    const call = await prisma.call.findFirst({
      where: { interactionId: clientData.interactionId },
      include: { lead: true },
    });
    if (call) {
      return { call, correlationMethod: 'clientData.interactionId' };
    }
  }

  if (clientData?.callSid) {
    const call = await prisma.call.findFirst({
      where: { twilioCallSid: clientData.callSid },
      include: { lead: true },
    });
    if (call) {
      return { call, correlationMethod: 'clientData.callSid' };
    }
  }

  if (payload.conversation_id) {
    const call = await prisma.call.findFirst({
      where: { elevenLabsId: payload.conversation_id },
      include: { lead: true },
    });
    if (call) {
      return { call, correlationMethod: 'conversation_id' };
    }
  }

  if (payload.call_sid) {
    const call = await prisma.call.findFirst({
      where: { twilioCallSid: payload.call_sid },
      include: { lead: true },
    });
    if (call) {
      return { call, correlationMethod: 'call_sid' };
    }
  }

  return null;
}

export function createElevenLabsWebhookRouter(prisma: PrismaClient): Router {
  const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;

  const signatureMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (!webhookSecret) {
      console.log(JSON.stringify({
        event: 'elevenlabs_signature_skipped',
        reason: 'ELEVENLABS_WEBHOOK_SECRET not configured',
      }));
      next();
      return;
    }

    const signature = req.headers['elevenlabs-signature'] as string | undefined;
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (!verifyElevenLabsSignature(rawBody, signature, webhookSecret)) {
      console.log(JSON.stringify({
        event: 'elevenlabs_signature_invalid',
        hasSignature: !!signature,
      }));
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }

    next();
  };

  router.get('/debug/recent', async (req: Request, res: Response) => {
    try {
      const events = await prisma.webhookEvent.findMany({
        where: { provider: 'elevenlabs' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      const enrichedEvents = await Promise.all(
        events.map(async (event) => {
          const payload = event.payload as Record<string, unknown>;
          const conversationId = payload.conversation_id || event.externalId;
          
          const call = await prisma.call.findFirst({
            where: { elevenLabsId: conversationId as string },
            select: { id: true, leadId: true, orgId: true, durationSeconds: true, callOutcome: true, aiFlags: true },
          });

          return {
            id: event.id,
            eventType: event.eventType,
            externalId: event.externalId,
            processedAt: event.processedAt,
            call: call ? {
              callId: call.id,
              leadId: call.leadId,
              orgId: call.orgId,
              durationSeconds: call.durationSeconds,
              callOutcome: call.callOutcome,
              aiFlags: call.aiFlags,
            } : null,
          };
        })
      );

      res.status(200).json({ events: enrichedEvents });
    } catch (err: any) {
      console.log(JSON.stringify({
        event: 'elevenlabs_debug_error',
        error: err?.message || String(err),
      }));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/inbound', signatureMiddleware, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const payload = req.body as InboundPayload;

    console.log(JSON.stringify({
      event: 'elevenlabs_inbound_received',
      caller_id: maskPhone(payload.caller_id),
      called_number: maskPhone(payload.called_number),
      has_call_sid: !!payload.call_sid,
      has_conversation_id: !!payload.conversation_id,
      has_client_data: !!payload.client_data,
    }));

    try {
      const externalId = payload.conversation_id || payload.call_sid;
      if (!externalId) {
        res.status(400).json({ error: 'Missing conversation_id or call_sid' });
        return;
      }

      const isNew = await checkIdempotency(prisma, 'elevenlabs', externalId, 'inbound', payload);
      if (!isNew) {
        res.status(200).json({ status: 'duplicate', externalId });
        return;
      }

      const fromE164 = normalizeE164(payload.caller_id);
      const toE164 = normalizeE164(payload.called_number);

      if (!fromE164 || !toE164) {
        res.status(400).json({ error: 'Invalid phone numbers' });
        return;
      }

      const firm = await lookupFirmByNumber(prisma, payload.called_number);
      if (!firm) {
        res.status(404).json({ error: 'No firm found for called_number' });
        return;
      }

      const { orgId, phoneNumberId } = firm;

      let contact = await prisma.contact.findFirst({
        where: { orgId, primaryPhone: fromE164 },
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            orgId,
            name: 'Unknown Caller',
            primaryPhone: fromE164,
          },
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

      const traceId = payload.call_sid || payload.conversation_id || 'unknown';
      console.log(JSON.stringify({ event: 'db_write_attempt', model: 'Call', traceId, orgId, leadId: lead.id, provider: 'elevenlabs' }));
      let call;
      try {
        call = await prisma.call.create({
          data: {
            orgId,
            leadId: lead.id,
            interactionId: interaction.id,
            phoneNumberId,
            direction: 'inbound',
            provider: 'elevenlabs',
            elevenLabsId: payload.conversation_id || null,
            twilioCallSid: payload.call_sid || null,
            fromE164,
            toE164,
            startedAt: new Date(),
          },
        });
        console.log(JSON.stringify({ event: 'db_write_success', model: 'Call', traceId, callId: call.id, orgId, leadId: lead.id }));
      } catch (dbErr: any) {
        console.error(JSON.stringify({ event: 'db_write_error', model: 'Call', traceId, orgId, error: dbErr?.message, code: dbErr?.code }));
        throw dbErr;
      }

      await prisma.lead.update({
        where: { id: lead.id },
        data: { lastActivityAt: new Date() },
      });

      console.log(JSON.stringify({
        event: 'elevenlabs_inbound_processed',
        callId: call.id,
        leadId: lead.id,
        orgId,
        interactionId: interaction.id,
        traceId,
        durationMs: Date.now() - startMs,
      }));

      res.status(200).json({
        status: 'ok',
        callId: call.id,
        leadId: lead.id,
        interactionId: interaction.id,
      });
    } catch (err: any) {
      console.log(JSON.stringify({
        event: 'elevenlabs_inbound_error',
        error: err?.message || String(err),
        durationMs: Date.now() - startMs,
      }));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/post-call', signatureMiddleware, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const payload = req.body as PostCallPayload;

    console.log(JSON.stringify({
      event: 'elevenlabs_postcall_received',
      conversation_id: payload.conversation_id,
      has_transcript: !!payload.transcript,
      has_extracted_data: !!payload.extracted_data,
      has_client_data: !!payload.client_data,
      duration_seconds: payload.duration_seconds,
    }));

    try {
      if (!payload.conversation_id) {
        res.status(400).json({ error: 'Missing conversation_id' });
        return;
      }

      const isNew = await checkIdempotency(prisma, 'elevenlabs', payload.conversation_id, 'post-call', payload);
      if (!isNew) {
        res.status(200).json({ status: 'duplicate', conversation_id: payload.conversation_id });
        return;
      }

      const correlationResult = await findCallByCorrelation(prisma, payload);

      if (!correlationResult) {
        console.log(JSON.stringify({
          event: 'UNLINKED_ELEVENLABS_CALL',
          conversation_id: payload.conversation_id,
          call_sid: payload.call_sid,
          caller_id: maskPhone(payload.caller_id || null),
          called_number: maskPhone(payload.called_number || null),
          from_e164: maskPhone(normalizeE164(payload.caller_id)),
          to_e164: maskPhone(normalizeE164(payload.called_number)),
          client_data_interaction_id: payload.client_data?.interactionId,
          client_data_call_sid: payload.client_data?.callSid,
        }));

        res.status(200).json({
          status: 'unlinked',
          conversation_id: payload.conversation_id,
          message: 'Webhook stored but no matching call found',
        });
        return;
      }

      const { call, correlationMethod } = correlationResult;

      const normalizedTranscript = normalizeTranscript(payload.transcript_json);

      const existingAiFlags = (call.aiFlags as Record<string, unknown>) || {};
      const updatedAiFlags: Record<string, unknown> = { ...existingAiFlags };
      
      if (payload.outcome) {
        updatedAiFlags.aiOutcomeGuess = payload.outcome;
      }

      const callUpdateData: Record<string, unknown> = {
        endedAt: payload.ended_at ? new Date(payload.ended_at) : (call.endedAt || new Date()),
        transcriptText: payload.transcript || call.transcriptText,
        aiSummary: payload.summary || call.aiSummary,
        recordingUrl: payload.recording_url || call.recordingUrl,
        aiFlags: updatedAiFlags,
      };

      if (normalizedTranscript.length > 0) {
        callUpdateData.transcriptJson = normalizedTranscript;
      }

      if (payload.duration_seconds && !call.durationSeconds) {
        callUpdateData.durationSeconds = payload.duration_seconds;
      }

      if (!call.elevenLabsId && payload.conversation_id) {
        callUpdateData.elevenLabsId = payload.conversation_id;
      }

      await prisma.call.update({
        where: { id: call.id },
        data: callUpdateData,
      });

      await prisma.interaction.update({
        where: { id: call.interactionId },
        data: { endedAt: new Date(), status: 'completed' },
      });

      if (payload.extracted_data && Object.keys(payload.extracted_data).length > 0) {
        const existingIntakeData = (call.lead.intakeData as Record<string, unknown>) || {};
        const mergedIntakeData = { ...existingIntakeData, ...payload.extracted_data };

        await prisma.lead.update({
          where: { id: call.leadId },
          data: {
            intakeData: mergedIntakeData as any,
            lastActivityAt: new Date(),
            displayName: extractDisplayName(payload.extracted_data) || call.lead.displayName,
            summary: payload.summary || call.lead.summary,
          },
        });
      } else {
        await prisma.lead.update({
          where: { id: call.leadId },
          data: {
            lastActivityAt: new Date(),
            summary: payload.summary || call.lead.summary,
          },
        });
      }

      console.log(JSON.stringify({
        event: 'elevenlabs_postcall_processed',
        callId: call.id,
        leadId: call.leadId,
        correlationMethod,
        hasExtractedData: !!payload.extracted_data,
        transcriptEntries: normalizedTranscript.length,
        aiOutcomeGuess: payload.outcome || null,
        durationMs: Date.now() - startMs,
      }));

      res.status(200).json({
        status: 'ok',
        callId: call.id,
        leadId: call.leadId,
        correlationMethod,
      });
    } catch (err: any) {
      console.log(JSON.stringify({
        event: 'elevenlabs_postcall_error',
        error: err?.message || String(err),
        durationMs: Date.now() - startMs,
      }));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

function extractDisplayName(data: Record<string, unknown>): string | null {
  const nameFields = ['callerName', 'caller_name', 'name', 'fullName', 'full_name'];
  for (const field of nameFields) {
    if (data[field] && typeof data[field] === 'string') {
      return data[field] as string;
    }
  }
  if (data.caller && typeof data.caller === 'object') {
    const caller = data.caller as Record<string, unknown>;
    if (caller.name && typeof caller.name === 'string') return caller.name;
    if (caller.fullName && typeof caller.fullName === 'string') return caller.fullName;
  }
  return null;
}

export default router;
