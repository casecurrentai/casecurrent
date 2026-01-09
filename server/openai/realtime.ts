import WebSocket from "ws";
import { executeToolCall, type ToolCallContext } from "../agent/toolRunner";
import { prisma } from "../db";

const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime";

interface RealtimeSession {
  ws: WebSocket;
  callId: string;
  context: ToolCallContext;
  connected: boolean;
  transcriptBuffer: string[];
  processedToolCalls: Set<string>;
}

const activeSessions = new Map<string, RealtimeSession>();

export async function startRealtimeSession(
  callId: string,
  orgId: string
): Promise<void> {
  console.log(`[Realtime] Starting sideband session for call ${callId}, org ${orgId}`);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[Realtime] OPENAI_API_KEY not configured");
    return;
  }

  const context: ToolCallContext = {
    callId,
    orgId,
  };

  const wsUrl = `${OPENAI_REALTIME_URL}?call_id=${callId}`;
  
  const ws = new WebSocket(wsUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const session: RealtimeSession = {
    ws,
    callId,
    context,
    connected: false,
    transcriptBuffer: [],
    processedToolCalls: new Set(),
  };

  activeSessions.set(callId, session);

  ws.on("open", () => {
    console.log(`[Realtime] WebSocket connected for call ${callId}`);
    session.connected = true;
    sendInitialGreeting(session);
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

function sendInitialGreeting(session: RealtimeSession): void {
  sendMessage(session, {
    type: "response.create",
    response: {
      modalities: ["text", "audio"],
      instructions: "Greet the caller warmly and introduce yourself as CaseCurrent AI. State the required disclaimers about not being an attorney and not creating an attorney-client relationship. Then ask how you can help them today.",
    },
  });
  console.log(`[Realtime] Initial greeting sent for call ${session.callId}`);
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
  const itemId = event.item_id;
  const name = event.name;
  const argumentsStr = event.arguments;

  if (!name || !argumentsStr) {
    console.error(`[Realtime] Invalid function call event:`, event);
    return;
  }

  const toolCallKey = `${itemId}:${name}`;
  if (session.processedToolCalls.has(toolCallKey)) {
    console.log(`[Realtime] Skipping duplicate tool call: ${toolCallKey}`);
    return;
  }
  session.processedToolCalls.add(toolCallKey);

  console.log(`[Realtime] Executing tool: ${name}`, argumentsStr);

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argumentsStr);
  } catch (error) {
    console.error(`[Realtime] Failed to parse function arguments:`, error);
    args = {};
  }

  const result = await executeToolCall(name, args, session.context);

  console.log(`[Realtime] Tool ${name} result:`, result);

  sendMessage(session, {
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: itemId,
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

      await prisma.auditLog.create({
        data: {
          orgId: call.orgId,
          actorType: "system",
          action: "transcript_saved",
          entityType: "call",
          entityId: call.id,
          details: { segmentCount: session.transcriptBuffer.length },
        },
      });
    }
  } catch (error) {
    console.error(`[Realtime] Failed to save transcript:`, error);
  }
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
