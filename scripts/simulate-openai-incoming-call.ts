/**
 * Simulate an OpenAI Realtime incoming call webhook for local testing.
 * 
 * Usage: npx tsx scripts/simulate-openai-incoming-call.ts
 * 
 * This script sends a fake "realtime.call.incoming" event to the webhook
 * endpoint to test the sideband WebSocket connection logic without 
 * requiring actual Twilio/SIP integration.
 */

import crypto from "crypto";

const BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:5000";
const WEBHOOK_SECRET = process.env.OPENAI_WEBHOOK_SECRET || "test-secret-for-simulation";

interface SimulatedCallEvent {
  type: string;
  call_id: string;
  project_id: string;
  from: string;
  to: string;
  timestamp: string;
}

async function simulateIncomingCall() {
  const callId = `sim_call_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  
  const event: SimulatedCallEvent = {
    type: "realtime.call.incoming",
    call_id: callId,
    project_id: process.env.OPENAI_PROJECT_ID || "proj_test123",
    from: "+15551234567",
    to: "+15559876543",
    timestamp: new Date().toISOString(),
  };

  const body = JSON.stringify(event);
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(Buffer.from(body))
    .digest("hex");

  console.log("=".repeat(60));
  console.log("SIMULATING OPENAI REALTIME INCOMING CALL");
  console.log("=".repeat(60));
  console.log("\nEndpoint:", `${BASE_URL}/v1/telephony/openai/webhook`);
  console.log("Call ID:", callId);
  console.log("From:", event.from);
  console.log("To:", event.to);
  console.log("\nPayload:");
  console.log(JSON.stringify(event, null, 2));
  console.log("\nSignature:", `sha256=${signature}`);
  console.log("\n" + "-".repeat(60));

  try {
    const response = await fetch(`${BASE_URL}/v1/telephony/openai/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenAI-Signature": `sha256=${signature}`,
      },
      body,
    });

    const responseBody = await response.text();
    
    console.log("\nRESPONSE:");
    console.log("Status:", response.status, response.statusText);
    console.log("Body:", responseBody);
    console.log("\n" + "=".repeat(60));

    if (response.ok) {
      console.log("\n✓ Webhook accepted the simulated call!");
      console.log("  Check server logs for sideband WebSocket connection attempts.");
      console.log("\n  Note: Without actual OpenAI credentials, the WS connection");
      console.log("  will fail, but you can verify the flow is correct.");
    } else {
      console.log("\n✗ Webhook rejected the request");
      if (response.status === 401) {
        console.log("  → Signature verification failed");
        console.log("  → Set OPENAI_WEBHOOK_SECRET to match the test secret");
      }
    }
  } catch (error) {
    console.error("\n✗ Failed to reach webhook endpoint:");
    console.error(error);
    console.log("\nMake sure the server is running: npm run dev");
  }
}

async function simulateCallEnded() {
  const callId = process.argv[3] || `sim_call_${Date.now()}`;
  
  const event = {
    type: "realtime.call.ended",
    call_id: callId,
    project_id: process.env.OPENAI_PROJECT_ID || "proj_test123",
    timestamp: new Date().toISOString(),
    data: {
      duration_seconds: 45,
      reason: "completed",
    },
  };

  const body = JSON.stringify(event);
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(Buffer.from(body))
    .digest("hex");

  console.log("Simulating call ended event for:", callId);

  try {
    const response = await fetch(`${BASE_URL}/v1/telephony/openai/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenAI-Signature": `sha256=${signature}`,
      },
      body,
    });

    console.log("Response:", response.status, await response.text());
  } catch (error) {
    console.error("Error:", error);
  }
}

async function testTwilioVoiceTwiML() {
  console.log("=".repeat(60));
  console.log("TESTING TWILIO VOICE TWIML RESPONSE");
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
    }
  } catch (error) {
    console.error("\n✗ Failed to reach Twilio voice endpoint:");
    console.error(error);
  }
}

// Main
const command = process.argv[2] || "incoming";

switch (command) {
  case "incoming":
    simulateIncomingCall();
    break;
  case "ended":
    simulateCallEnded();
    break;
  case "twiml":
    testTwilioVoiceTwiML();
    break;
  default:
    console.log("Usage: npx tsx scripts/simulate-openai-incoming-call.ts [command]");
    console.log("");
    console.log("Commands:");
    console.log("  incoming  - Simulate an incoming call webhook (default)");
    console.log("  ended     - Simulate a call ended webhook");
    console.log("  twiml     - Test the Twilio voice TwiML response");
}
