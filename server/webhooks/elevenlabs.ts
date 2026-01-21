import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../apps/api/src/generated/prisma';

const router = Router();

interface InboundPayload {
  caller_id: string;
  called_number: string;
  call_sid?: string;
  conversation_id?: string;
  timestamp?: string;
}

interface PostCallPayload {
  conversation_id: string;
  call_sid?: string;
  caller_id?: string;
  called_number?: string;
  duration_seconds?: number;
  transcript?: string;
  transcript_json?: Array<{ role: string; message: string; timestamp?: string }>;
  summary?: string;
  extracted_data?: Record<string, unknown>;
  outcome?: string;
  recording_url?: string;
  ended_at?: string;
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

export function createElevenLabsWebhookRouter(prisma: PrismaClient): Router {
  // Debug endpoint to view recent webhook events with linked Call/Lead IDs
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
            select: { id: true, leadId: true, orgId: true, durationSeconds: true, callOutcome: true },
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

  router.post('/inbound', async (req: Request, res: Response) => {
    const startMs = Date.now();
    const payload = req.body as InboundPayload;

    console.log(JSON.stringify({
      event: 'elevenlabs_inbound_received',
      caller_id: maskPhone(payload.caller_id),
      called_number: maskPhone(payload.called_number),
      has_call_sid: !!payload.call_sid,
      has_conversation_id: !!payload.conversation_id,
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

      const call = await prisma.call.create({
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

      await prisma.lead.update({
        where: { id: lead.id },
        data: { lastActivityAt: new Date() },
      });

      console.log(JSON.stringify({
        event: 'elevenlabs_inbound_processed',
        callId: call.id,
        leadId: lead.id,
        orgId,
        durationMs: Date.now() - startMs,
      }));

      res.status(200).json({
        status: 'ok',
        callId: call.id,
        leadId: lead.id,
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

  router.post('/post-call', async (req: Request, res: Response) => {
    const startMs = Date.now();
    const payload = req.body as PostCallPayload;

    console.log(JSON.stringify({
      event: 'elevenlabs_postcall_received',
      conversation_id: payload.conversation_id,
      has_transcript: !!payload.transcript,
      has_extracted_data: !!payload.extracted_data,
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

      const call = await prisma.call.findFirst({
        where: {
          OR: [
            { elevenLabsId: payload.conversation_id },
            { twilioCallSid: payload.call_sid || undefined },
          ],
        },
        include: { lead: true },
      });

      if (!call) {
        console.log(JSON.stringify({
          event: 'elevenlabs_postcall_call_not_found',
          conversation_id: payload.conversation_id,
          call_sid: payload.call_sid,
        }));
        res.status(404).json({ error: 'Call not found' });
        return;
      }

      // Only update fields that ElevenLabs provides - do NOT overwrite Twilio-set callOutcome
      const callUpdateData: Record<string, unknown> = {
        endedAt: payload.ended_at ? new Date(payload.ended_at) : (call.endedAt || new Date()),
        transcriptText: payload.transcript || call.transcriptText,
        transcriptJson: payload.transcript_json ? (payload.transcript_json as any) : undefined,
        aiSummary: payload.summary || call.aiSummary,
        recordingUrl: payload.recording_url || call.recordingUrl,
      };
      
      // Only set durationSeconds if not already set by Twilio
      if (payload.duration_seconds && !call.durationSeconds) {
        callUpdateData.durationSeconds = payload.duration_seconds;
      }
      
      // Only set callOutcome if not already set (Twilio may have set it)
      if (payload.outcome && !call.callOutcome) {
        callUpdateData.callOutcome = payload.outcome;
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
        hasExtractedData: !!payload.extracted_data,
        durationMs: Date.now() - startMs,
      }));

      res.status(200).json({
        status: 'ok',
        callId: call.id,
        leadId: call.leadId,
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
