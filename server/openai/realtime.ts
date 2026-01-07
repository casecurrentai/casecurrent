import WebSocket from "ws";
import { COUNSELTECH_INTAKE_PROMPT, VOICE_SETTINGS } from "../agent/prompt";
import { getToolSchemas } from "../agent/tools";
import { executeToolCall, type ToolCallContext } from "../agent/toolRunner";
import { prisma } from "../db";

const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime";

interface RealtimeSession {
  ws: WebSocket;
  callId: string;
  context: ToolCallContext;
  connected: boolean;
  transcriptBuffer: string[];
}

const activeSessions = new Map<string, RealtimeSession>();

export async function startRealtimeSession(
  callId: string,
  fromNumber: string,
  toNumber: string
): Promise<void> {
  console.log(`[Realtime] Starting session for call ${callId}`);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[Realtime] OPENAI_API_KEY not configured");
    return;
  }

  const org = await findOrgByPhoneNumber(toNumber);
  if (!org) {
    console.error(`[Realtime] No org found for phone number ${toNumber}`);
    return;
  }

  const context: ToolCallContext = {
    callId,
    orgId: org.id,
  };

  const wsUrl = `${OPENAI_REALTIME_URL}?call_id=${callId}`;
  
  const ws = new WebSocket(wsUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  const session: RealtimeSession = {
    ws,
    callId,
    context,
    connected: false,
    transcriptBuffer: [],
  };

  activeSessions.set(callId, session);

  ws.on("open", () => {
    console.log(`[Realtime] WebSocket connected for call ${callId}`);
    session.connected = true;
    sendSessionUpdate(session);
  });

  ws.on("message", (data: Buffer) => {
    handleRealtimeMessage(session, data);
  });

  ws.on("error", (error) => {
    console.error(`[Realtime] WebSocket error for call ${callId}:`, error);
  });

  ws.on("close", (code, reason) => {
    console.log(`[Realtime] WebSocket closed for call ${callId}:`, code, reason.toString());
    session.connected = false;
    activeSessions.delete(callId);
    saveTranscript(session);
  });
}

function sendSessionUpdate(session: RealtimeSession): void {
  const sessionUpdate = {
    type: "session.update",
    session: {
      model: "gpt-4o-realtime-preview",
      instructions: COUNSELTECH_INTAKE_PROMPT,
      voice: VOICE_SETTINGS.voice,
      modalities: VOICE_SETTINGS.modalities,
      temperature: VOICE_SETTINGS.temperature,
      max_response_output_tokens: VOICE_SETTINGS.max_response_output_tokens,
      turn_detection: VOICE_SETTINGS.turn_detection,
      tools: getToolSchemas(),
      tool_choice: "auto",
    },
  };

  sendMessage(session, sessionUpdate);
  console.log(`[Realtime] Session update sent for call ${session.callId}`);

  setTimeout(() => {
    sendMessage(session, {
      type: "response.create",
      response: {
        modalities: ["text", "audio"],
        instructions: "Greet the caller warmly and introduce yourself as CounselTech AI. State the required disclaimers about not being an attorney and not creating an attorney-client relationship. Then ask how you can help them today.",
      },
    });
  }, 500);
}

function handleRealtimeMessage(session: RealtimeSession, data: Buffer): void {
  let event: any;
  try {
    event = JSON.parse(data.toString());
  } catch (error) {
    console.error(`[Realtime] Failed to parse message:`, error);
    return;
  }

  const eventType = event.type;

  switch (eventType) {
    case "session.created":
      console.log(`[Realtime] Session created for call ${session.callId}`);
      break;

    case "session.updated":
      console.log(`[Realtime] Session updated for call ${session.callId}`);
      break;

    case "response.created":
      console.log(`[Realtime] Response started for call ${session.callId}`);
      break;

    case "response.output_item.added":
      break;

    case "response.content_part.added":
      break;

    case "response.audio.delta":
      break;

    case "response.audio_transcript.delta":
      if (event.delta) {
        session.transcriptBuffer.push(`[AI]: ${event.delta}`);
      }
      break;

    case "response.text.delta":
      if (event.delta) {
        session.transcriptBuffer.push(`[AI]: ${event.delta}`);
      }
      break;

    case "conversation.item.input_audio_transcription.completed":
      if (event.transcript) {
        session.transcriptBuffer.push(`[Caller]: ${event.transcript}`);
        console.log(`[Realtime] Caller said: ${event.transcript}`);
      }
      break;

    case "response.function_call_arguments.done":
      handleFunctionCall(session, event);
      break;

    case "response.done":
      if (event.response?.output) {
        for (const output of event.response.output) {
          if (output.type === "function_call") {
            handleFunctionCallOutput(session, output);
          }
        }
      }
      break;

    case "input_audio_buffer.speech_started":
      console.log(`[Realtime] Caller started speaking`);
      break;

    case "input_audio_buffer.speech_stopped":
      console.log(`[Realtime] Caller stopped speaking`);
      break;

    case "error":
      console.error(`[Realtime] Error event:`, event.error);
      break;

    default:
      break;
  }
}

async function handleFunctionCall(session: RealtimeSession, event: any): Promise<void> {
  const callId = event.call_id || event.item_id;
  const name = event.name;
  const argumentsStr = event.arguments;

  if (!name || !argumentsStr) {
    console.error(`[Realtime] Invalid function call event:`, event);
    return;
  }

  console.log(`[Realtime] Function call: ${name}`, argumentsStr);

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argumentsStr);
  } catch (error) {
    console.error(`[Realtime] Failed to parse function arguments:`, error);
    args = {};
  }

  const result = await executeToolCall(name, args, session.context);

  sendMessage(session, {
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: callId,
      output: JSON.stringify(result),
    },
  });

  sendMessage(session, {
    type: "response.create",
  });
}

async function handleFunctionCallOutput(session: RealtimeSession, output: any): Promise<void> {
  const name = output.name;
  const callId = output.call_id;
  const argumentsStr = output.arguments;

  if (!name) return;

  console.log(`[Realtime] Processing function output: ${name}`);

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argumentsStr || "{}");
  } catch {
    args = {};
  }

  const result = await executeToolCall(name, args, session.context);

  sendMessage(session, {
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: callId,
      output: JSON.stringify(result),
    },
  });

  sendMessage(session, {
    type: "response.create",
  });
}

function sendMessage(session: RealtimeSession, message: any): void {
  if (session.ws.readyState === WebSocket.OPEN) {
    session.ws.send(JSON.stringify(message));
  } else {
    console.warn(`[Realtime] WebSocket not open for call ${session.callId}`);
  }
}

async function saveTranscript(session: RealtimeSession): Promise<void> {
  if (session.transcriptBuffer.length === 0) return;

  const transcript = session.transcriptBuffer.join("\n");

  try {
    const call = await prisma.call.findFirst({
      where: { providerCallId: session.callId },
    });

    if (call) {
      await prisma.call.update({
        where: { id: call.id },
        data: {
          transcriptText: transcript,
          transcriptJson: {
            segments: session.transcriptBuffer,
            savedAt: new Date().toISOString(),
          },
        },
      });
      console.log(`[Realtime] Transcript saved for call ${session.callId}`);
    }
  } catch (error) {
    console.error(`[Realtime] Failed to save transcript:`, error);
  }
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
    },
    select: { orgId: true },
  });

  if (phone) {
    return { id: phone.orgId };
  }

  const defaultOrg = await prisma.organization.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return defaultOrg;
}

export function getActiveSession(callId: string): RealtimeSession | undefined {
  return activeSessions.get(callId);
}

export function endSession(callId: string): void {
  const session = activeSessions.get(callId);
  if (session) {
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.close();
    }
    activeSessions.delete(callId);
  }
}
