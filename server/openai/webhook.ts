import crypto from "crypto";
import type { Request, Response } from "express";
import { getOpenAIWebhookSecret } from "./client";
import { startRealtimeSession } from "./realtime";
import { prisma } from "../db";
import { COUNSELTECH_INTAKE_PROMPT, VOICE_SETTINGS } from "../agent/prompt";
import { getToolSchemas } from "../agent/tools";

const OPENAI_API_BASE = "https://api.openai.com/v1";
const WEBHOOK_TOLERANCE_SECONDS = parseInt(process.env.OPENAI_WEBHOOK_TOLERANCE_SECONDS || "300", 10);

interface SipHeader {
  name: string;
  value: string;
}

interface OpenAIRealtimeEventData {
  call_id: string;
  sip_headers?: SipHeader[];
  status_code?: number;
  reason?: string;
}

interface OpenAIWebhookEvent {
  type: string;
  data: OpenAIRealtimeEventData;
}

export function verifyStandardWebhooksSignature(
  rawBody: Buffer,
  webhookId: string,
  webhookTimestamp: string,
  webhookSignature: string
): boolean {
  try {
    const secret = getOpenAIWebhookSecret();
    const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64");
    
    const timestampNum = parseInt(webhookTimestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    
    if (Math.abs(now - timestampNum) > WEBHOOK_TOLERANCE_SECONDS) {
      console.error("[OpenAI Webhook] Timestamp outside tolerance window");
      return false;
    }

    const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody.toString("utf-8")}`;
    const expectedSignature = crypto
      .createHmac("sha256", secretBytes)
      .update(signedPayload)
      .digest("base64");

    const signatures = webhookSignature.split(" ");
    for (const sig of signatures) {
      const parts = sig.split(",");
      for (const part of parts) {
        const cleanSig = part.replace("v1,", "").replace("v1=", "").trim();
        if (cleanSig && cleanSig.length > 0) {
          try {
            if (crypto.timingSafeEqual(
              Buffer.from(expectedSignature, "base64"),
              Buffer.from(cleanSig, "base64")
            )) {
              return true;
            }
          } catch {
            continue;
          }
        }
      }
    }

    console.error("[OpenAI Webhook] No matching signature found");
    return false;
  } catch (error) {
    console.error("[OpenAI Webhook] Signature verification error:", error);
    return false;
  }
}

async function checkIdempotency(webhookId: string): Promise<boolean> {
  const existing = await prisma.auditLog.findFirst({
    where: {
      action: "webhook_processed",
      details: {
        path: ["webhookId"],
        equals: webhookId,
      },
    },
  });
  return !!existing;
}

async function recordWebhookProcessed(webhookId: string, eventType: string): Promise<void> {
  await prisma.auditLog.create({
    data: {
      orgId: "system",
      actorType: "system",
      action: "webhook_processed",
      entityType: "openai_webhook",
      entityId: webhookId,
      details: { webhookId, eventType, processedAt: new Date().toISOString() },
    },
  });
}

function extractPhoneFromSipHeader(sipHeaderValue: string): string {
  const match = sipHeaderValue.match(/sip:([+\d]+)@/);
  if (match) {
    return match[1];
  }
  const digitMatch = sipHeaderValue.match(/([+]?\d{10,15})/);
  return digitMatch ? digitMatch[1] : sipHeaderValue;
}

function getSipHeader(headers: SipHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : null;
}

export async function handleOpenAIWebhook(req: Request, res: Response): Promise<void> {
  const webhookId = req.headers["webhook-id"] as string;
  const webhookTimestamp = req.headers["webhook-timestamp"] as string;
  const webhookSignature = req.headers["webhook-signature"] as string;
  const rawBody = (req as any).rawBody as Buffer;

  if (!rawBody || !webhookId || !webhookTimestamp || !webhookSignature) {
    console.error("[OpenAI Webhook] Missing required headers or body");
    res.status(400).json({ error: "Missing required webhook headers" });
    return;
  }

  const isValid = verifyStandardWebhooksSignature(rawBody, webhookId, webhookTimestamp, webhookSignature);
  if (!isValid) {
    console.error("[OpenAI Webhook] Invalid signature");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const alreadyProcessed = await checkIdempotency(webhookId);
  if (alreadyProcessed) {
    console.log(`[OpenAI Webhook] Duplicate webhook-id ${webhookId}, ignoring`);
    res.status(200).json({ received: true, duplicate: true });
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
    call_id: event.data?.call_id,
    webhookId,
  });

  await recordWebhookProcessed(webhookId, event.type);

  switch (event.type) {
    case "realtime.call.incoming":
      await handleIncomingCall(event, res);
      break;
    case "realtime.call.connected":
      console.log(`[OpenAI Webhook] Call connected: ${event.data?.call_id}`);
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
  const callId = event.data?.call_id;

  if (!callId) {
    console.error("[OpenAI Webhook] Missing call_id in incoming call event");
    res.status(400).json({ error: "Missing call_id" });
    return;
  }

  const fromHeader = getSipHeader(event.data.sip_headers, "From");
  const toHeader = getSipHeader(event.data.sip_headers, "To");

  const fromNumber = fromHeader ? extractPhoneFromSipHeader(fromHeader) : "unknown";
  const toNumber = toHeader ? extractPhoneFromSipHeader(toHeader) : "unknown";

  console.log(`[OpenAI Webhook] Incoming call ${callId} from ${fromNumber} to ${toNumber}`);

  const org = await findOrgByPhoneNumber(toNumber);
  
  if (!org) {
    console.error(`[OpenAI Webhook] No org found for phone number ${toNumber}, rejecting call`);
    await rejectCall(callId, 603, "Decline - number not configured");
    res.status(200).json({ received: true, action: "rejected", reason: "no_org_match" });
    return;
  }

  try {
    const { contact, lead, interaction, call } = await createCallRecords(
      org.id,
      callId,
      fromNumber,
      toNumber
    );

    console.log(`[OpenAI Webhook] Created call record ${call.id} for org ${org.id}`);

    const accepted = await acceptCall(callId);
    
    if (!accepted) {
      console.error(`[OpenAI Webhook] Failed to accept call ${callId}`);
      res.status(200).json({ received: true, action: "accept_failed" });
      return;
    }

    console.log(`[OpenAI Webhook] Call ${callId} accepted, starting sideband session`);

    await startRealtimeSession(callId, org.id);

    res.status(200).json({ received: true, call_id: callId, action: "accepted" });
  } catch (error) {
    console.error("[OpenAI Webhook] Failed to handle incoming call:", error);
    await rejectCall(callId, 500, "Internal error");
    res.status(200).json({ received: true, action: "error" });
  }
}

async function handleCallEnded(event: OpenAIWebhookEvent, res: Response): Promise<void> {
  const callId = event.data?.call_id;
  
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

      await prisma.auditLog.create({
        data: {
          orgId: call.orgId,
          actorType: "system",
          action: "call_ended",
          entityType: "call",
          entityId: call.id,
          details: { providerCallId: callId, statusCode: event.data.status_code },
        },
      });
    }
  } catch (error) {
    console.error("[OpenAI Webhook] Failed to update call ended:", error);
  }

  res.status(200).json({ received: true });
}

async function findOrgByPhoneNumber(phoneNumber: string): Promise<{ id: string } | null> {
  const normalized = phoneNumber.replace(/\D/g, "");
  
  const phone = await prisma.phoneNumber.findFirst({
    where: {
      OR: [
        { e164: phoneNumber },
        { e164: `+${normalized}` },
        { e164: `+1${normalized}` },
      ],
      inboundEnabled: true,
    },
    select: { orgId: true },
  });

  if (phone) {
    return { id: phone.orgId };
  }

  console.error(`[OpenAI Webhook] No matching phone number found for ${phoneNumber}`);
  return null;
}

async function createCallRecords(
  orgId: string,
  callId: string,
  fromNumber: string,
  toNumber: string
): Promise<{ contact: any; lead: any; interaction: any; call: any }> {
  const phoneNumber = await prisma.phoneNumber.findFirst({
    where: { 
      orgId,
      OR: [
        { e164: toNumber },
        { e164: `+${toNumber.replace(/\D/g, "")}` },
      ],
    },
  });

  if (!phoneNumber) {
    throw new Error(`No phone number record found for ${toNumber} in org ${orgId}`);
  }

  let contact = await prisma.contact.findFirst({
    where: { orgId, primaryPhone: fromNumber },
  });

  if (!contact) {
    const normalizedFrom = fromNumber.startsWith("+") ? fromNumber : `+${fromNumber.replace(/\D/g, "")}`;
    contact = await prisma.contact.create({
      data: {
        orgId,
        name: "Unknown Caller",
        primaryPhone: normalizedFrom,
      },
    });
  }

  let lead = await prisma.lead.findFirst({
    where: {
      orgId,
      contactId: contact.id,
      status: { in: ["new", "in_progress"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        orgId,
        contactId: contact.id,
        source: "phone",
        status: "new",
        priority: "medium",
      },
    });
  }

  const interaction = await prisma.interaction.create({
    data: {
      orgId,
      leadId: lead.id,
      channel: "call",
      status: "active",
    },
  });

  const call = await prisma.call.create({
    data: {
      orgId,
      leadId: lead.id,
      interactionId: interaction.id,
      phoneNumberId: phoneNumber.id,
      direction: "inbound",
      provider: "openai_realtime",
      providerCallId: callId,
      fromE164: fromNumber.startsWith("+") ? fromNumber : `+${fromNumber.replace(/\D/g, "")}`,
      toE164: phoneNumber.e164,
      startedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      orgId,
      actorType: "system",
      action: "inbound_call_received",
      entityType: "call",
      entityId: call.id,
      details: { providerCallId: callId, from: fromNumber, to: toNumber },
    },
  });

  return { contact, lead, interaction, call };
}

async function acceptCall(callId: string): Promise<boolean> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[OpenAI Webhook] OPENAI_API_KEY not configured");
    return false;
  }

  const acceptConfig = {
    model: "gpt-4o-realtime-preview",
    instructions: COUNSELTECH_INTAKE_PROMPT,
    voice: VOICE_SETTINGS.voice,
    modalities: VOICE_SETTINGS.modalities,
    temperature: VOICE_SETTINGS.temperature,
    max_response_output_tokens: VOICE_SETTINGS.max_response_output_tokens,
    turn_detection: VOICE_SETTINGS.turn_detection,
    tools: getToolSchemas(),
    tool_choice: "auto",
  };

  try {
    const response = await fetch(`${OPENAI_API_BASE}/realtime/calls/${callId}/accept`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(acceptConfig),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenAI Webhook] Accept call failed: ${response.status} ${errorText}`);
      return false;
    }

    console.log(`[OpenAI Webhook] Accept call ${callId} succeeded`);
    return true;
  } catch (error) {
    console.error("[OpenAI Webhook] Accept call error:", error);
    return false;
  }
}

async function rejectCall(callId: string, statusCode: number, reason: string): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[OpenAI Webhook] OPENAI_API_KEY not configured, cannot reject");
    return;
  }

  try {
    const response = await fetch(`${OPENAI_API_BASE}/realtime/calls/${callId}/reject`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status_code: statusCode, reason }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenAI Webhook] Reject call failed: ${response.status} ${errorText}`);
    } else {
      console.log(`[OpenAI Webhook] Rejected call ${callId} with status ${statusCode}`);
    }
  } catch (error) {
    console.error("[OpenAI Webhook] Reject call error:", error);
  }
}
