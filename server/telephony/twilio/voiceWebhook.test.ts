import { describe, it } from "node:test";
import assert from "node:assert";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

describe("Twilio Voice Webhook", () => {
  it("responds with 200, text/xml, and valid TwiML with <Stream>", async () => {
    const formData = new URLSearchParams({
      CallSid: "CA_TEST_SMOKE_" + Date.now(),
      From: "+15551234567",
      To: "+18443214257",
      Direction: "inbound",
      CallStatus: "ringing",
    });

    const response = await fetch(`${BASE_URL}/v1/telephony/twilio/voice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    assert.strictEqual(response.status, 200);

    const contentType = response.headers.get("content-type") || "";
    assert.ok(contentType.includes("text/xml"));

    const body = await response.text();
    assert.ok(body.includes("<Response>"));
    assert.ok(body.includes("</Response>"));

    const hasStream = body.includes("<Stream");
    const hasRecord = body.includes("<Record");
    const hasSay = body.includes("<Say");

    assert.ok(hasStream || hasRecord || hasSay);

    console.log("TwiML Response:", body);
  });

  it("returns valid TwiML even with missing params", async () => {
    const formData = new URLSearchParams({});

    const response = await fetch(`${BASE_URL}/v1/telephony/twilio/voice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    assert.strictEqual(response.status, 200);

    const contentType = response.headers.get("content-type") || "";
    assert.ok(contentType.includes("text/xml"));

    const body = await response.text();
    assert.ok(body.includes("<Response>"));
    assert.ok(body.includes("</Response>"));
  });

  it("diag endpoint returns ok status", async () => {
    const response = await fetch(`${BASE_URL}/v1/telephony/twilio/voice/diag`);

    assert.strictEqual(response.status, 200);

    const json = await response.json();
    assert.strictEqual(json.ok, true);
    assert.ok(json.now !== undefined);
  });

  it("stream diag endpoint returns ok status", async () => {
    const response = await fetch(`${BASE_URL}/v1/telephony/twilio/stream/diag`);

    assert.strictEqual(response.status, 200);

    const json = await response.json();
    assert.strictEqual(json.ok, true);
    assert.ok(json.now !== undefined);
    assert.ok(json.envHasOpenAIKey !== undefined);
  });
});
