import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.warn("[OpenAI] OPENAI_API_KEY not set - Realtime voice features will be unavailable");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export function getOpenAIProjectId(): string {
  const projectId = process.env.OPENAI_PROJECT_ID;
  if (!projectId) {
    throw new Error("OPENAI_PROJECT_ID environment variable is required for SIP integration");
  }
  return projectId;
}

export function getOpenAIWebhookSecret(): string {
  const secret = process.env.OPENAI_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("OPENAI_WEBHOOK_SECRET environment variable is required for webhook verification");
  }
  return secret;
}

export function isOpenAIConfigured(): boolean {
  return !!(
    process.env.OPENAI_API_KEY &&
    process.env.OPENAI_PROJECT_ID &&
    process.env.OPENAI_WEBHOOK_SECRET
  );
}
