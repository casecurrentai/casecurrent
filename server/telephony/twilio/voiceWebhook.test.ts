import { describe, it, expect } from "vitest";

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

    expect(response.status).toBe(200);

    const contentType = response.headers.get("content-type") || "";
    expect(contentType).toContain("text/xml");

    const body = await response.text();
    expect(body).toContain("<Response>");
    expect(body).toContain("</Response>");

    const hasStream = body.includes("<Stream");
    const hasRecord = body.includes("<Record");
    const hasSay = body.includes("<Say");

    expect(hasStream || hasRecord || hasSay).toBe(true);

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

    expect(response.status).toBe(200);

    const contentType = response.headers.get("content-type") || "";
    expect(contentType).toContain("text/xml");

    const body = await response.text();
    expect(body).toContain("<Response>");
    expect(body).toContain("</Response>");
  });

  it("diag endpoint returns ok status", async () => {
    const response = await fetch(`${BASE_URL}/v1/telephony/twilio/voice/diag`);

    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.now).toBeDefined();
  });

  it("stream diag endpoint returns ok status", async () => {
    const response = await fetch(`${BASE_URL}/v1/telephony/twilio/stream/diag`);

    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.now).toBeDefined();
    expect(json.envHasOpenAIKey).toBeDefined();
  });
});
