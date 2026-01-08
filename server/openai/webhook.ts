import crypto from "crypto";
import type { Request, Response } from "express";
import { getOpenAIWebhookSecret } from "./client";
import { startRealtimeSession } from "./realtime";
import { prisma } from "../db";
import { COUNSELTECH_INTAKE_PROMPT, VOICE_SETTINGS } from "../agent/prompt";
import { getToolSchemas } from "../agent/tools";
import { maskPhone, maskCallSid } from "../utils/logMasking";

// GATE 2: Deploy marker at module load
console.log(`[DEPLOY_MARK] openai webhook module loaded v3 ${new Date().toISOString()}`);

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
    console.log(`[OpenAI Webhook DIAG] Secret starts with whsec_: ${secret.startsWith("whsec_")}`);
    console.log(`[OpenAI Webhook DIAG] Secret length: ${secret.length}`);
    
    const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64");
    console.log(`[OpenAI Webhook DIAG] SecretBytes length: ${secretBytes.length}`);
    
    const timestampNum = parseInt(webhookTimestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(now - timestampNum);
    
    console.log(`[OpenAI Webhook DIAG] Timestamp check: now=${now}, webhook=${timestampNum}, diff=${timeDiff}s, tolerance=${WEBHOOK_TOLERANCE_SECONDS}s`);
    
    if (timeDiff > WEBHOOK_TOLERANCE_SECONDS) {
      console.error("[OpenAI Webhook] Timestamp outside tolerance window");
      return false;
    }

    const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody.toString("utf-8")}`;
    const expectedSignature = crypto
      .createHmac("sha256", secretBytes)
      .update(signedPayload)
      .digest("base64");

    console.log(`[OpenAI Webhook DIAG] Expected sig (first 20 chars): ${expectedSignature.substring(0, 20)}...`);
    console.log(`[OpenAI Webhook DIAG] Received webhook-signature: ${webhookSignature.substring(0, 50)}...`);

    const signatures = webhookSignature.split(" ");
    for (const sig of signatures) {
      const parts = sig.split(",");
      for (const part of parts) {
        const cleanSig = part.replace("v1,", "").replace("v1=", "").trim();
        if (cleanSig && cleanSig.length > 0) {
          console.log(`[OpenAI Webhook DIAG] Comparing with cleanSig (first 20): ${cleanSig.substring(0, 20)}...`);
          try {
            if (crypto.timingSafeEqual(
              Buffer.from(expectedSignature, "base64"),
              Buffer.from(cleanSig, "base64")
            )) {
              return true;
            }
          } catch (compareErr) {
            console.log(`[OpenAI Webhook DIAG] Compare error: ${compareErr}`);
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
  const existing = await prisma.webhookReceipt.findUnique({
    where: { webhookId },
  });
  return !!existing;
}

async function recordWebhookProcessed(webhookId: string, eventType: string): Promise<void> {
  await prisma.webhookReceipt.create({
    data: {
      webhookId,
      source: "openai",
      eventType,
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

function extractTwilioCallSid(headers: SipHeader[] | undefined): string | null {
  const xTwilioCallSid = getSipHeader(headers, "X-Twilio-CallSid");
  if (xTwilioCallSid) return xTwilioCallSid;
  
  const pAssertedIdentity = getSipHeader(headers, "P-Asserted-Identity");
  if (pAssertedIdentity) {
    const match = pAssertedIdentity.match(/CA[a-f0-9]{32}/i);
    if (match) return match[0];
  }
  
  return null;
}

// Track last accept call status for diagnostics
let lastAcceptCallStatus: { timestamp: string; callId: string; success: boolean; error?: string } | null = null;
export function getLastAcceptCallStatus() { return lastAcceptCallStatus; }

export async function handleOpenAIWebhook(req: Request, res: Response): Promise<void> {
  // GATE 2: Deploy marker at route entry
  console.log(`[DEPLOY_MARK] openai webhook hit v3`);
  
  console.log(`[OpenAI Webhook DIAG] ========== INCOMING REQUEST ==========`);
  console.log(`[OpenAI Webhook DIAG] Method: ${req.method}`);
  console.log(`[OpenAI Webhook DIAG] URL: ${req.originalUrl}`);
  console.log(`[OpenAI Webhook DIAG] Content-Type: ${req.headers["content-type"]}`);
  console.log(`[OpenAI Webhook DIAG] webhook-id: ${req.headers["webhook-id"] || "MISSING"}`);
  console.log(`[OpenAI Webhook DIAG] webhook-timestamp: ${req.headers["webhook-timestamp"] || "MISSING"}`);
  console.log(`[OpenAI Webhook DIAG] webhook-signature present: ${!!req.headers["webhook-signature"]}`);
  console.log(`[OpenAI Webhook DIAG] rawBody present: ${!!(req as any).rawBody}`);
  console.log(`[OpenAI Webhook DIAG] rawBody length: ${(req as any).rawBody?.length || 0}`);
  
  const webhookId = req.headers["webhook-id"] as string;
  const webhookTimestamp = req.headers["webhook-timestamp"] as string;
  const webhookSignature = req.headers["webhook-signature"] as string;
  const rawBody = (req as any).rawBody as Buffer;

  if (!rawBody || !webhookId || !webhookTimestamp || !webhookSignature) {
    console.error("[OpenAI Webhook] Missing required headers or body");
    res.status(400).json({ error: "Missing required webhook headers" });
    return;
  }

  console.log(`[OpenAI Webhook DIAG] Starting signature verification...`);
  const isValid = verifyStandardWebhooksSignature(rawBody, webhookId, webhookTimestamp, webhookSignature);
  console.log(`[OpenAI Webhook DIAG] Signature valid: ${isValid}`);
  if (!isValid) {
    console.error("[OpenAI Webhook] Invalid signature - REJECTING");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  // Parse event BEFORE idempotency check so we can process fast
  let event: OpenAIWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString("utf-8"));
    console.log(`[OpenAI Webhook DIAG] Parsed event type: ${event.type}`);
  } catch (error) {
    console.error("[OpenAI Webhook] Failed to parse event:", error);
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  // GATE 3: ACK FAST - Send 200 immediately for incoming calls, process async
  if (event.type === "realtime.call.incoming") {
    console.log(`[OpenAI Webhook DIAG] ACK FAST: Sending 200 immediately for incoming call`);
    res.status(200).json({ received: true, processing: "async" });
    
    // Process call acceptance async (no await on response)
    setImmediate(async () => {
      try {
        console.log(`[OpenAI Webhook DIAG] ASYNC: Starting call processing...`);
        await handleIncomingCallAsync(event, webhookId);
      } catch (err: any) {
        console.error(`[OpenAI Webhook DIAG] ASYNC ERROR:`, err?.message || err);
      }
    });
    return;
  }

  // For other event types, process normally
  console.log(`[OpenAI Webhook] Received event: ${event.type}`, { call_id: event.data?.call_id });

  switch (event.type) {
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
  
  // DB write for idempotency - best effort, non-blocking for non-incoming events
  recordWebhookProcessed(webhookId, event.type).catch(err => {
    console.error(`[OpenAI Webhook DIAG] recordWebhookProcessed FAILED (non-blocking):`, err?.message);
  });
}

// GATE 3: Async handler for incoming calls - accepts call FIRST, then DB write
async function handleIncomingCallAsync(event: OpenAIWebhookEvent, webhookId: string): Promise<void> {
  const callId = event.data?.call_id;
  console.log(`[OpenAI Webhook DIAG] ========== handleIncomingCallAsync START ==========`);
  console.log(`[OpenAI Webhook DIAG] call_id: ${callId ? maskCallSid(callId) : "MISSING"}`);

  if (!callId) {
    console.error("[OpenAI Webhook] Missing call_id in incoming call event");
    return;
  }

  // Extract headers for org lookup
  const fromHeader = getSipHeader(event.data.sip_headers, "From");
  const toHeader = getSipHeader(event.data.sip_headers, "To");
  const twilioCallSid = extractTwilioCallSid(event.data.sip_headers);
  const xTwilioFromE164 = getSipHeader(event.data.sip_headers, "X-Twilio-FromE164");
  const xTwilioToE164 = getSipHeader(event.data.sip_headers, "X-Twilio-ToE164");

  const fromNumber = xTwilioFromE164 || (fromHeader ? extractPhoneFromSipHeader(fromHeader) : "unknown");
  const toNumber = xTwilioToE164 || (toHeader ? extractPhoneFromSipHeader(toHeader) : "unknown");

  console.log(`[OpenAI Webhook DIAG] fromNumber: ${maskPhone(fromNumber)}, toNumber: ${maskPhone(toNumber)}`);
  console.log(`[OpenAI Webhook DIAG] twilioCallSid: ${twilioCallSid ? maskCallSid(twilioCallSid) : "NONE"}`);

  // Quick org lookup
  let orgId: string | null = null;
  
  if (twilioCallSid) {
    const existingCall = await prisma.call.findFirst({ where: { twilioCallSid } });
    if (existingCall) {
      orgId = existingCall.orgId;
      console.log(`[OpenAI Webhook DIAG] Found org via twilioCallSid: ${orgId}`);
    }
  }
  
  if (!orgId) {
    const org = await findOrgByPhoneNumber(toNumber);
    if (org) {
      orgId = org.id;
      console.log(`[OpenAI Webhook DIAG] Found org via phone: ${orgId}`);
    }
  }

  if (!orgId) {
    console.error(`[OpenAI Webhook DIAG] REJECT: No org found`);
    lastAcceptCallStatus = { timestamp: new Date().toISOString(), callId, success: false, error: "no_org_found" };
    await rejectCall(callId, 603, "Decline - org not found");
    return;
  }

  // GATE 3: ACCEPT CALL FIRST - before any other DB operations
  console.log(`[OpenAI Webhook DIAG] ACCEPT FIRST: Calling acceptCall(${maskCallSid(callId)})...`);
  try {
    const accepted = await acceptCall(callId);
    if (accepted) {
      console.log(`[OpenAI Webhook DIAG] acceptCall SUCCEEDED`);
      lastAcceptCallStatus = { timestamp: new Date().toISOString(), callId, success: true };
    } else {
      console.error(`[OpenAI Webhook DIAG] acceptCall returned false`);
      lastAcceptCallStatus = { timestamp: new Date().toISOString(), callId, success: false, error: "accept_returned_false" };
      return;
    }
  } catch (acceptErr: any) {
    console.error(`[OpenAI Webhook DIAG] acceptCall EXCEPTION:`, acceptErr?.message || acceptErr);
    lastAcceptCallStatus = { timestamp: new Date().toISOString(), callId, success: false, error: acceptErr?.message };
    return;
  }

  // Now do DB operations (best effort, non-blocking)
  console.log(`[OpenAI Webhook DIAG] POST-ACCEPT: Starting DB operations (non-blocking)...`);
  
  // Record webhook processed - best effort
  recordWebhookProcessed(webhookId, event.type).catch(err => {
    console.error(`[OpenAI Webhook DIAG] recordWebhookProcessed FAILED (non-blocking):`, err?.message);
  });

  // Create call records - best effort
  try {
    await createCallRecords(orgId, callId, fromNumber, toNumber, twilioCallSid);
    console.log(`[OpenAI Webhook DIAG] createCallRecords succeeded`);
  } catch (dbErr: any) {
    console.error(`[OpenAI Webhook DIAG] createCallRecords FAILED (non-blocking):`, dbErr?.message);
  }

  // Start realtime session
  try {
    console.log(`[OpenAI Webhook DIAG] Starting realtime session...`);
    await startRealtimeSession(callId, orgId);
    console.log(`[OpenAI Webhook DIAG] Realtime session started`);
  } catch (sessionErr: any) {
    console.error(`[OpenAI Webhook DIAG] startRealtimeSession FAILED:`, sessionErr?.message);
  }

  console.log(`[OpenAI Webhook DIAG] ========== handleIncomingCallAsync END ==========`);
}

async function handleIncomingCall(event: OpenAIWebhookEvent, res: Response): Promise<void> {
  console.log(`[OpenAI Webhook DIAG] ========== handleIncomingCall START ==========`);
  console.log(`[OpenAI Webhook DIAG] event.type: ${event.type}`);
  const callId = event.data?.call_id;
  console.log(`[OpenAI Webhook DIAG] call_id: ${callId ? maskCallSid(callId) : "MISSING"}`);

  if (!callId) {
    console.error("[OpenAI Webhook] Missing call_id in incoming call event");
    res.status(400).json({ error: "Missing call_id" });
    return;
  }

  // Log all SIP headers for debugging (names only, values masked)
  const headerNames = event.data.sip_headers?.map(h => h.name) || [];
  console.log(`[OpenAI Webhook DIAG] SIP headers received: [${headerNames.join(", ")}]`);

  const fromHeader = getSipHeader(event.data.sip_headers, "From");
  const toHeader = getSipHeader(event.data.sip_headers, "To");
  const twilioCallSid = extractTwilioCallSid(event.data.sip_headers);
  const xTwilioCallSid = getSipHeader(event.data.sip_headers, "X-Twilio-CallSid");
  const pAssertedIdentity = getSipHeader(event.data.sip_headers, "P-Asserted-Identity");
  
  // Custom headers we're passing from Twilio TwiML
  const xTwilioFromE164 = getSipHeader(event.data.sip_headers, "X-Twilio-FromE164");
  const xTwilioToE164 = getSipHeader(event.data.sip_headers, "X-Twilio-ToE164");

  console.log(`[OpenAI Webhook DIAG] X-Twilio-CallSid header: ${xTwilioCallSid ? maskCallSid(xTwilioCallSid) : "NOT PRESENT"}`);
  console.log(`[OpenAI Webhook DIAG] X-Twilio-FromE164 header: ${xTwilioFromE164 ? maskPhone(xTwilioFromE164) : "NOT PRESENT"}`);
  console.log(`[OpenAI Webhook DIAG] X-Twilio-ToE164 header: ${xTwilioToE164 ? maskPhone(xTwilioToE164) : "NOT PRESENT"}`);
  console.log(`[OpenAI Webhook DIAG] P-Asserted-Identity header: ${pAssertedIdentity ? "present" : "NOT PRESENT"}`);
  console.log(`[OpenAI Webhook DIAG] Extracted twilioCallSid: ${twilioCallSid ? maskCallSid(twilioCallSid) : "NONE"}`);

  // Prefer our custom headers, fall back to SIP header extraction
  const fromNumber = xTwilioFromE164 || (fromHeader ? extractPhoneFromSipHeader(fromHeader) : "unknown");
  const toNumber = xTwilioToE164 || (toHeader ? extractPhoneFromSipHeader(toHeader) : "unknown");

  console.log(`[OpenAI Webhook DIAG] Final fromNumber: ${maskPhone(fromNumber)}`);
  console.log(`[OpenAI Webhook DIAG] Final toNumber: ${maskPhone(toNumber)}`);

  // === NEW PRIORITY: Try twilioCallSid lookup FIRST ===
  let orgId: string | null = null;
  let existingCall: any = null;

  if (twilioCallSid) {
    console.log(`[OpenAI Webhook DIAG] PRIORITY 1: Looking up Call by twilioCallSid...`);
    existingCall = await prisma.call.findFirst({
      where: { twilioCallSid },
    });
    
    if (existingCall) {
      orgId = existingCall.orgId;
      console.log(`[OpenAI Webhook DIAG] FOUND Call by twilioCallSid! call.id=${existingCall.id}, orgId=${orgId}`);
      
      // Update with OpenAI call_id
      await prisma.call.update({
        where: { id: existingCall.id },
        data: { 
          providerCallId: callId,
          provider: "openai_realtime",
        },
      });
      console.log(`[OpenAI Webhook DIAG] Updated Call with providerCallId=${maskCallSid(callId)}`);
    } else {
      console.log(`[OpenAI Webhook DIAG] No Call found by twilioCallSid`);
    }
  } else {
    console.log(`[OpenAI Webhook DIAG] No twilioCallSid available, skipping Priority 1`);
  }

  // === FALLBACK: Try phone number lookup only if twilioCallSid didn't work ===
  if (!orgId) {
    console.log(`[OpenAI Webhook DIAG] PRIORITY 2: Looking up org by toNumber: ${maskPhone(toNumber)}`);
    const org = await findOrgByPhoneNumber(toNumber);
    if (org) {
      orgId = org.id;
      console.log(`[OpenAI Webhook DIAG] FOUND org by phone number! orgId=${orgId}`);
    } else {
      console.log(`[OpenAI Webhook DIAG] No org found by phone number`);
    }
  }

  // === REJECT only if BOTH lookups failed ===
  if (!orgId) {
    console.error(`[OpenAI Webhook DIAG] REJECT: No org found via twilioCallSid OR toNumber`);
    console.log(`[OpenAI Webhook DIAG] twilioCallSid=${twilioCallSid || "none"}, toNumber=${maskPhone(toNumber)}`);
    await rejectCall(callId, 603, "Decline - org not found");
    res.status(200).json({ received: true, action: "rejected", reason: "no_org_match" });
    console.log(`[OpenAI Webhook DIAG] ========== handleIncomingCall END (rejected) ==========`);
    return;
  }

  console.log(`[OpenAI Webhook DIAG] Using orgId: ${orgId}`);

  try {
    // Create call records if we didn't find existing
    if (!existingCall) {
      console.log(`[OpenAI Webhook DIAG] Creating new call records for orgId=${orgId}`);
      const result = await createCallRecords(orgId, callId, fromNumber, toNumber, twilioCallSid);
      existingCall = result.call;
      console.log(`[OpenAI Webhook DIAG] Created call record: ${existingCall.id}`);
    }

    // Accept the call
    console.log(`[OpenAI Webhook DIAG] Calling acceptCall(${maskCallSid(callId)})...`);
    const accepted = await acceptCall(callId);
    
    if (!accepted) {
      console.error(`[OpenAI Webhook DIAG] acceptCall FAILED for ${maskCallSid(callId)}`);
      res.status(200).json({ received: true, action: "accept_failed" });
      console.log(`[OpenAI Webhook DIAG] ========== handleIncomingCall END (accept_failed) ==========`);
      return;
    }

    console.log(`[OpenAI Webhook DIAG] acceptCall SUCCEEDED for ${maskCallSid(callId)}`);
    console.log(`[OpenAI Webhook DIAG] Starting sideband session...`);

    await startRealtimeSession(callId, orgId);

    console.log(`[OpenAI Webhook DIAG] ========== handleIncomingCall END (accepted) ==========`);
    res.status(200).json({ received: true, call_id: callId, action: "accepted" });
  } catch (error: any) {
    console.error(`[OpenAI Webhook DIAG] ERROR in handleIncomingCall: ${error?.message || error}`);
    await rejectCall(callId, 500, "Internal error");
    res.status(200).json({ received: true, action: "error" });
    console.log(`[OpenAI Webhook DIAG] ========== handleIncomingCall END (error) ==========`);
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

  console.error(`[OpenAI Webhook] No matching phone number found for ${maskPhone(phoneNumber)}`);
  return null;
}

async function createCallRecords(
  orgId: string,
  callId: string,
  fromNumber: string,
  toNumber: string,
  twilioCallSid?: string | null
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
      twilioCallSid: twilioCallSid || null,
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
      details: { providerCallId: callId, twilioCallSid, from: fromNumber, to: toNumber },
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
    type: "realtime",
    model: "gpt-realtime",
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
      console.error(`[OpenAI Webhook DIAG] acceptCall FAILED: status=${response.status}, body=${errorText}`);
      return false;
    }

    const responseData = await response.json().catch(() => ({}));
    console.log(`[OpenAI Webhook DIAG] acceptCall SUCCEEDED: status=${response.status}`);
    return true;
  } catch (error: any) {
    console.error(`[OpenAI Webhook DIAG] acceptCall EXCEPTION: ${error?.message || error}`);
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
      console.log(`[OpenAI Webhook] Rejected call ${maskCallSid(callId)} with status ${statusCode}`);
    }
  } catch (error) {
    console.error("[OpenAI Webhook] Reject call error:", error);
  }
}
