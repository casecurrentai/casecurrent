/**
 * Twilio Webhook Simulator for CounselTech
 * 
 * Run with: npx tsx scripts/simulate-twilio.ts
 * 
 * Simulates Twilio webhook events for local testing:
 * - Incoming voice calls
 * - Call status updates
 * - Recording webhooks
 * - Incoming SMS messages
 */

const BASE_URL = process.env.API_URL || "http://localhost:5000";

async function post(path: string, body: Record<string, string>) {
  const formData = new URLSearchParams(body);
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });
}

async function simulateVoiceCall() {
  console.log("\n[VOICE] Simulating incoming call...");
  
  const callSid = `CA${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const from = "+15551234567";
  const to = "+18005551234";
  
  // 1. Initial voice webhook
  console.log("  Sending voice webhook...");
  const voiceRes = await post("/v1/telephony/twilio/voice", {
    CallSid: callSid,
    AccountSid: "ACtest123",
    From: from,
    To: to,
    CallStatus: "ringing",
    Direction: "inbound",
    CallerName: "Test Caller",
    FromCity: "San Francisco",
    FromState: "CA",
  });
  
  if (voiceRes.ok) {
    const twiml = await voiceRes.text();
    console.log(`  Response: ${twiml.slice(0, 100)}...`);
  } else {
    console.log(`  Error: ${voiceRes.status}`);
  }
  
  // 2. Status update - in-progress
  console.log("  Sending status update (in-progress)...");
  await post("/v1/telephony/twilio/status", {
    CallSid: callSid,
    AccountSid: "ACtest123",
    CallStatus: "in-progress",
    CallDuration: "0",
  });
  
  // 3. Wait a bit
  await new Promise(r => setTimeout(r, 500));
  
  // 4. Status update - completed
  console.log("  Sending status update (completed)...");
  await post("/v1/telephony/twilio/status", {
    CallSid: callSid,
    AccountSid: "ACtest123",
    CallStatus: "completed",
    CallDuration: "125",
  });
  
  // 5. Recording webhook
  console.log("  Sending recording webhook...");
  const recordingSid = `RE${Date.now()}`;
  await post("/v1/telephony/twilio/recording", {
    CallSid: callSid,
    AccountSid: "ACtest123",
    RecordingSid: recordingSid,
    RecordingUrl: `https://api.twilio.com/recordings/${recordingSid}`,
    RecordingStatus: "completed",
    RecordingDuration: "120",
  });
  
  console.log("  Voice call simulation complete.");
  return callSid;
}

async function simulateSMS() {
  console.log("\n[SMS] Simulating incoming SMS...");
  
  const messageSid = `SM${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const from = "+15559876543";
  const to = "+18005551234";
  
  console.log("  Sending SMS webhook...");
  const smsRes = await post("/v1/telephony/twilio/sms", {
    MessageSid: messageSid,
    AccountSid: "ACtest123",
    From: from,
    To: to,
    Body: "Hi, I was in a car accident last week and need legal help. Can someone call me back?",
    NumMedia: "0",
    FromCity: "Los Angeles",
    FromState: "CA",
  });
  
  if (smsRes.ok) {
    const twiml = await smsRes.text();
    console.log(`  Response: ${twiml.slice(0, 100)}...`);
  } else {
    console.log(`  Error: ${smsRes.status}`);
  }
  
  console.log("  SMS simulation complete.");
  return messageSid;
}

async function runSimulation() {
  console.log("========================================");
  console.log("Twilio Webhook Simulator");
  console.log(`Target: ${BASE_URL}`);
  console.log("========================================");
  
  const mode = process.argv[2] || "all";
  
  switch (mode) {
    case "voice":
      await simulateVoiceCall();
      break;
    case "sms":
      await simulateSMS();
      break;
    case "all":
    default:
      await simulateVoiceCall();
      await simulateSMS();
      break;
  }
  
  console.log("\n========================================");
  console.log("Simulation Complete");
  console.log("========================================");
  console.log("\nCheck the leads page to see the created leads.");
  console.log("\nUsage:");
  console.log("  npx tsx scripts/simulate-twilio.ts        # Run all simulations");
  console.log("  npx tsx scripts/simulate-twilio.ts voice  # Voice call only");
  console.log("  npx tsx scripts/simulate-twilio.ts sms    # SMS only");
  console.log("\n");
}

runSimulation().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
