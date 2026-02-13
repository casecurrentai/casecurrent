import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '../../apps/api/src/generated/prisma';
import crypto from 'crypto';

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
  call?: { id?: string; [key: string]: unknown };
  status?: string;
  transcript?: string;
  toolCalls?: VapiToolCall[];
  toolCallList?: VapiToolCall[];
  [key: string]: unknown;
}

function isBusinessHours(): boolean {
  const now = new Date();
  const chicago = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now);

  const weekday = chicago.find((p) => p.type === 'weekday')?.value;
  const hour = parseInt(chicago.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(chicago.find((p) => p.type === 'minute')?.value || '0', 10);

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  if (!weekday || !weekdays.includes(weekday)) return false;

  const timeMinutes = hour * 60 + minute;
  return timeMinutes >= 540 && timeMinutes < 1020; // 09:00–17:00
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

  // Health check — no auth
  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, ts: new Date().toISOString() });
  });

  // Main webhook endpoint
  router.post('/', secretMiddleware, async (req: Request, res: Response) => {
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

    try {
      if (messageType === 'assistant-request') {
        const biz = isBusinessHours();
        const assistantId = biz
          ? process.env.VAPI_ASSISTANT_ID_BUSINESS_HOURS
          : process.env.VAPI_ASSISTANT_ID_AFTER_HOURS;

        console.log(JSON.stringify({
          event: 'vapi_assistant_request',
          callId,
          isBusinessHours: biz,
          hasAssistantId: !!assistantId,
        }));

        res.status(200).json({ assistantId });
        return;
      }

      if (messageType === 'tool-calls') {
        const toolCalls = message.toolCalls || message.toolCallList || [];
        const results = toolCalls.map((tc) => ({
          toolCallId: tc.id,
          result: 'ok',
        }));

        // Respond immediately — Vapi expects < 1s
        res.status(200).json({ results });

        // Store payload in background for debugging (fire-and-forget)
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

      // All other types: status-update, transcript, end-of-call-report, etc.
      console.log(JSON.stringify({
        event: 'vapi_event_logged',
        type: messageType,
        callId,
        status: (message as any).status || null,
      }));

      res.status(200).json({ status: 'ok', type: messageType });
    } catch (err: any) {
      console.log(JSON.stringify({
        event: 'vapi_webhook_error',
        type: messageType,
        callId,
        error: err?.message || String(err),
      }));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
