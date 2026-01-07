/**
 * Simulate OpenAI Realtime webhook events for local testing.
 * 
 * Usage: npx tsx scripts/simulate-openai-incoming-call.ts [command]
 * 
 * Commands:
 *   incoming  - Simulate realtime.call.incoming webhook (default)
 *   ended     - Simulate realtime.call.ended webhook
 *   twiml     - Test Twilio voice TwiML response
 *   invalid   - Test invalid signature rejection
 * 
 * Environment variables:
 *   BASE_URL              - Server URL (default: http://localhost:5000)
 *   OPENAI_WEBHOOK_SECRET - Webhook secret for signing (format: whsec_xxxx)
 */

import crypto from "crypto";

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const WEBHOOK_SECRET = process.env.OPENAI_WEBHOOK_SECRET || "whsec_dGVzdHNlY3JldDEyMw==";

function generateStandardWebhooksSignature(
  webhookId: string,
  webhookTimestamp: string,
  body: string
): string {
  const secretKey = WEBHOOK_SECRET.replace("whsec_", "");
  const secretBytes = Buffer.from(secretKey, "base64");
  const signedPayload = `${webhookId}.${webhookTimestamp}.${body}`;
  const signature = crypto
    .createHmac("sha256", secretBytes)
    .update(signedPayload)
    .digest("base64");
  return `v1,${signature}`;
}

async function simulateIncomingCall(): Promise<void> {
  const callId = `call_test_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const webhookId = `wh_${crypto.randomUUID()}`;
  const webhookTimestamp = Math.floor(Date.now() / 1000).toString();

  const event = {
    type: "realtime.call.incoming",
    data: {
      call_id: callId,
      sip_headers: [
        { name: "From", value: "sip:+15551234567@sip.twilio.com" },
        { name: "To", value: "sip:+15559876543@sip.api.openai.com" },
        { name: "Call-ID", value: callId },
        { name: "X-Twilio-CallSid", value: `CA${callId}` },
      ],
    },
  };

  const body = JSON.stringify(event);
  const signature = generateStandardWebhooksSignature(webhookId, webhookTimestamp, body);

  console.log("=".repeat(60));
  console.log("SIMULATING OPENAI realtime.call.incoming (Standard Webhooks)");
  console.log("=".repeat(60));
  console.log("\nEndpoint:", `${BASE_URL}/v1/telephony/openai/webhook`);
  console.log("Call ID:", callId);
  console.log("Webhook ID:", webhookId);
  console.log("Timestamp:", webhookTimestamp);
  console.log("\nPayload:");
  console.log(JSON.stringify(event, null, 2));
  console.log("\nHeaders:");
  console.log("  webhook-id:", webhookId);
  console.log("  webhook-timestamp:", webhookTimestamp);
  console.log("  webhook-signature:", signature);
  console.log("\n" + "-".repeat(60));

  try {
    const response = await fetch(`${BASE_URL}/v1/telephony/openai/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "webhook-id": webhookId,
        "webhook-timestamp": webhookTimestamp,
        "webhook-signature": signature,
      },
      body,
    });

    const responseBody = await response.text();
    
    console.log("\nRESPONSE:");
    console.log("Status:", response.status, response.statusText);
    console.log("Body:", responseBody);
    console.log("\n" + "=".repeat(60));

    if (response.ok) {
      const parsed = JSON.parse(responseBody);
      if (parsed.action === "accepted") {
        console.log("\n✓ Call accepted!");
        console.log("  → Accept endpoint was called");
        console.log("  → Sideband WebSocket connection should be starting");
        console.log("  → Check server logs for [Realtime] messages");
      } else if (parsed.action === "rejected") {
        console.log("\n⚠ Call rejected:", parsed.reason);
        console.log("  → No matching org found for the called number");
        console.log("  → Ensure phone_numbers table has a matching entry");
      } else if (parsed.duplicate) {
        console.log("\n⚠ Duplicate webhook (already processed)");
      }
    } else {
      console.log("\n✗ Webhook rejected the request");
      if (response.status === 401) {
        console.log("  → Signature verification failed");
        console.log("  → Check OPENAI_WEBHOOK_SECRET matches the test secret");
      }
    }
  } catch (error) {
    console.error("\n✗ Failed to reach webhook endpoint:");
    console.error(error);
    console.log("\nMake sure the server is running: npm run dev");
  }
}

async function simulateCallEnded(): Promise<void> {
  const callId = process.argv[3] || `call_test_${Date.now()}`;
  const webhookId = `wh_${crypto.randomUUID()}`;
  const webhookTimestamp = Math.floor(Date.now() / 1000).toString();
  
  const event = {
    type: "realtime.call.ended",
    data: {
      call_id: callId,
      status_code: 200,
      reason: "normal",
    },
  };

  const body = JSON.stringify(event);
  const signature = generateStandardWebhooksSignature(webhookId, webhookTimestamp, body);

  console.log("=".repeat(60));
  console.log("SIMULATING OPENAI realtime.call.ended");
  console.log("=".repeat(60));
  console.log("\nCall ID:", callId);
  console.log("Webhook ID:", webhookId);

  try {
    const response = await fetch(`${BASE_URL}/v1/telephony/openai/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "webhook-id": webhookId,
        "webhook-timestamp": webhookTimestamp,
        "webhook-signature": signature,
      },
      body,
    });

    const responseBody = await response.text();
    console.log("\nResponse:", response.status, responseBody);
  } catch (error) {
    console.error("Error:", error);
  }
}

async function testTwilioVoice(): Promise<void> {
  console.log("=".repeat(60));
  console.log("TESTING TWILIO /v1/telephony/twilio/voice");
  console.log("=".repeat(60));

  const twilioPayload = new URLSearchParams({
    CallSid: `CA_test_${Date.now()}`,
    From: "+15551234567",
    To: "+15559876543",
    CallStatus: "ringing",
    Direction: "inbound",
    CallerName: "Test Caller",
  });

  try {
    const response = await fetch(`${BASE_URL}/v1/telephony/twilio/voice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: twilioPayload.toString(),
    });

    const twiml = await response.text();
    
    console.log("\nTwiML Response:");
    console.log("-".repeat(40));
    console.log(twiml);
    console.log("-".repeat(40));

    if (twiml.includes("<Sip>")) {
      console.log("\n✓ SIP bridging is configured!");
      const sipMatch = twiml.match(/<Sip>([^<]+)<\/Sip>/);
      if (sipMatch) {
        console.log("  SIP URI:", sipMatch[1]);
      }
    } else if (twiml.includes("<Record")) {
      console.log("\n⚠ Fallback to voicemail (OpenAI not configured)");
      console.log("  Set OPENAI_API_KEY, OPENAI_PROJECT_ID, OPENAI_WEBHOOK_SECRET");
    } else if (twiml.includes("not currently configured")) {
      console.log("\n⚠ Phone number not found in database");
      console.log("  Add the phone number to the phone_numbers table");
    }
  } catch (error) {
    console.error("\n✗ Failed to reach Twilio voice endpoint:");
    console.error(error);
  }
}

async function testInvalidSignature(): Promise<void> {
  console.log("=".repeat(60));
  console.log("TESTING INVALID SIGNATURE (should reject with 401)");
  console.log("=".repeat(60));

  const event = {
    type: "realtime.call.incoming",
    data: {
      call_id: "call_invalid_test",
      sip_headers: [],
    },
  };

  try {
    const response = await fetch(`${BASE_URL}/v1/telephony/openai/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "webhook-id": "wh_invalid",
        "webhook-timestamp": Math.floor(Date.now() / 1000).toString(),
        "webhook-signature": "v1,aW52YWxpZFNpZ25hdHVyZQ==",
      },
      body: JSON.stringify(event),
    });

    const result = await response.text();
    console.log(`\nResponse status: ${response.status} (expected: 401)`);
    console.log(`Response body: ${result}`);
    
    if (response.status === 401) {
      console.log("\n✓ Correctly rejected invalid signature!");
    } else {
      console.log("\n✗ Should have rejected with 401");
    }
  } catch (error) {
    console.error("Request failed:", error);
  }
}

const command = process.argv[2] || "incoming";

switch (command) {
  case "incoming":
    simulateIncomingCall();
    break;
  case "ended":
    simulateCallEnded();
    break;
  case "twiml":
    testTwilioVoice();
    break;
  case "invalid":
    testInvalidSignature();
    break;
  default:
    console.log("Usage: npx tsx scripts/simulate-openai-incoming-call.ts [command]");
    console.log("");
    console.log("Commands:");
    console.log("  incoming  - Simulate realtime.call.incoming webhook (default)");
    console.log("  ended     - Simulate realtime.call.ended webhook");
    console.log("  twiml     - Test Twilio voice TwiML response");
    console.log("  invalid   - Test invalid signature rejection");
    console.log("");
    console.log("Environment variables:");
    console.log("  BASE_URL              - Server URL (default: http://localhost:5000)");
    console.log("  OPENAI_WEBHOOK_SECRET - Webhook secret (format: whsec_xxxx)");
}
