import crypto from "crypto";
import type { Request, Response } from "express";
import { getOpenAIWebhookSecret } from "./client";
import { startRealtimeSession } from "./realtime";
import { prisma } from "../db";

interface OpenAIWebhookEvent {
  type: string;
  call_id?: string;
  project_id?: string;
  from?: string;
  to?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
}

export function verifyOpenAISignature(rawBody: Buffer, signature: string): boolean {
  try {
    const secret = getOpenAIWebhookSecret();
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    
    const providedSig = signature.replace("sha256=", "");
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(providedSig, "hex")
    );
  } catch (error) {
    console.error("[OpenAI Webhook] Signature verification failed:", error);
    return false;
  }
}

export async function handleOpenAIWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers["x-openai-signature"] as string;
  const rawBody = (req as any).rawBody as Buffer;

  if (!rawBody || !signature) {
    console.error("[OpenAI Webhook] Missing raw body or signature");
    res.status(400).json({ error: "Missing signature or body" });
    return;
  }

  const isValid = verifyOpenAISignature(rawBody, signature);
  if (!isValid) {
    console.error("[OpenAI Webhook] Invalid signature");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  let event: OpenAIWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString("utf-8"));
  } catch (error) {
    console.error("[OpenAI Webhook] Failed to parse event:", error);
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  console.log(`[OpenAI Webhook] Received event: ${event.type}`, {
    call_id: event.call_id,
    from: event.from,
    to: event.to,
  });

  switch (event.type) {
    case "realtime.call.incoming":
      await handleIncomingCall(event, res);
      break;
    case "realtime.call.connected":
      console.log(`[OpenAI Webhook] Call connected: ${event.call_id}`);
      res.status(200).json({ received: true });
      break;
    case "realtime.call.ended":
      await handleCallEnded(event, res);
      break;
    default:
      console.log(`[OpenAI Webhook] Unhandled event type: ${event.type}`);
      res.status(200).json({ received: true });
  }
}

async function handleIncomingCall(event: OpenAIWebhookEvent, res: Response): Promise<void> {
  const callId = event.call_id;
  const fromNumber = event.from || "unknown";
  const toNumber = event.to || "unknown";

  if (!callId) {
    console.error("[OpenAI Webhook] Missing call_id in incoming call event");
    res.status(400).json({ error: "Missing call_id" });
    return;
  }

  console.log(`[OpenAI Webhook] Starting realtime session for call: ${callId}`);

  try {
    await startRealtimeSession(callId, fromNumber, toNumber);
    res.status(200).json({ received: true, call_id: callId });
  } catch (error) {
    console.error("[OpenAI Webhook] Failed to start realtime session:", error);
    res.status(500).json({ error: "Failed to start session" });
  }
}

async function handleCallEnded(event: OpenAIWebhookEvent, res: Response): Promise<void> {
  const callId = event.call_id;
  
  if (!callId) {
    res.status(200).json({ received: true });
    return;
  }

  console.log(`[OpenAI Webhook] Call ended: ${callId}`);

  try {
    const call = await prisma.call.findFirst({
      where: { providerCallId: callId },
    });

    if (call) {
      await prisma.call.update({
        where: { id: call.id },
        data: {
          endedAt: new Date(),
          durationSeconds: call.startedAt
            ? Math.floor((Date.now() - call.startedAt.getTime()) / 1000)
            : null,
        },
      });

      await prisma.interaction.update({
        where: { id: call.interactionId },
        data: {
          status: "completed",
          endedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error("[OpenAI Webhook] Failed to update call ended:", error);
  }

  res.status(200).json({ received: true });
}
