import WebSocket from "ws";
import { executeToolCall, type ToolCallContext } from "../agent/toolRunner";
import { prisma } from "../db";
import { formatForVoice, type LunaStyleContext } from "../agent/formatters/lunaStyle";

const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime";

const isLunaStyleEnabled = (): boolean => {
  return process.env.AVERY_LUNA_STYLE === "true";
};

interface RealtimeSession {
  ws: WebSocket;
  callId: string;
  context: ToolCallContext;
  connected: boolean;
  transcriptBuffer: string[];
  processedToolCalls: Set<string>;
  emotionalContext?: {
    isEmergency: boolean;
    isSeriou: boolean;
    keyword?: string;
    callerName?: string;
  };
  pendingResponseText: string;
  lastCallerUtterance: string;
  awaitingEmpathyIntervention: boolean;
  empathyDelivered: boolean;
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
    pendingResponseText: "",
    lastCallerUtterance: "",
    awaitingEmpathyIntervention: false,
    empathyDelivered: false,
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
  let greetingInstructions = "Greet the caller warmly and introduce yourself as Avery. State the required disclaimers naturally about not being an attorney and not creating an attorney-client relationship. Then ask how you can help them today.";
  
  if (isLunaStyleEnabled()) {
    greetingInstructions = `Greet the caller warmly. Say something like: "Hi, this is Avery. Before we get started, I should mention I'm an AI assistant, not an attorney. This call doesn't create an attorney-client relationship and I can't give legal advice. But I can help gather your information so an attorney can review your case. How can I help you today?"

Keep it natural and conversational. Short sentences. Warm tone.`;
  }
  
  sendMessage(session, {
    type: "response.create",
    response: {
      modalities: ["text", "audio"],
      instructions: greetingInstructions,
    },
  });
  console.log(`[Realtime] Initial greeting sent for call ${session.callId} (luna_style=${isLunaStyleEnabled()})`);
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
        session.lastCallerUtterance = event.transcript;
        console.log(`[Realtime] Caller said: ${event.transcript}`);
        
        if (isLunaStyleEnabled()) {
          const previouslyDetected = session.emotionalContext?.keyword;
          detectEmotionalContext(session, event.transcript);
          
          if (session.emotionalContext?.isEmergency && 
              session.emotionalContext.keyword !== previouslyDetected &&
              !session.empathyDelivered) {
            console.log(`[Realtime] [Luna] Emergency detected! Flagging for empathy intervention`);
            session.awaitingEmpathyIntervention = true;
          }
        }
      }
      break;

    case "response.created":
      console.log(`[Realtime] Response started for call ${session.callId}`);
      if (isLunaStyleEnabled() && session.awaitingEmpathyIntervention) {
        const responseId = event.response?.id;
        console.log(`[Realtime] [Luna] INTERCEPTING: Canceling auto-response ${responseId} to inject empathy`);
        injectEmpathyResponse(session, responseId);
        session.awaitingEmpathyIntervention = false;
        session.empathyDelivered = true;
      }
      break;

    case "response.done":
      if (isLunaStyleEnabled() && session.emotionalContext) {
        console.log(`[Realtime] [Luna] Response completed with emotional context: ${session.emotionalContext.keyword}`);
      }
      session.pendingResponseText = "";
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

  const responsePayload: any = {
    type: "response.create",
  };

  if (isLunaStyleEnabled()) {
    let instructions = "Continue the conversation naturally. Short sentences, one question at a time, warm and present tone.";
    
    if (session.emotionalContext?.isEmergency) {
      instructions = `The caller mentioned something difficult (${session.emotionalContext.keyword}). Before continuing, briefly acknowledge their situation with empathy: "I'm so sorry to hear that" or "That sounds really difficult." Then gently proceed with one question. Short sentences, warm tone.`;
    } else if (session.emotionalContext?.isSeriou) {
      instructions = `The caller is dealing with a serious matter (${session.emotionalContext.keyword}). Be warm and understanding. Acknowledge briefly if not already done, then continue with one question at a time. Short sentences.`;
    }
    
    responsePayload.response = {
      modalities: ["text", "audio"],
      instructions,
    };
  }

  sendMessage(session, responsePayload);
}

function sendMessage(session: RealtimeSession, message: any): void {
  if (session.ws.readyState === WebSocket.OPEN) {
    session.ws.send(JSON.stringify(message));
  } else {
    console.warn(`[Realtime] WebSocket not open for call ${session.callId}`);
  }
}

const EMERGENCY_KEYWORDS = [
  'hospital', 'emergency', 'hurt', 'injured', 'accident', 'pain',
  'bleeding', 'died', 'death', 'dying', 'surgery', 'icu', 'ambulance',
  'arrested', 'jail', 'custody', 'crisis', 'scared', 'afraid'
];

const SERIOUS_KEYWORDS = [
  'fired', 'evicted', 'divorce', 'custody', 'foreclosure', 'bankrupt',
  'discrimination', 'harassment', 'assault', 'abuse', 'threatening'
];

function detectEmotionalContext(session: RealtimeSession, transcript: string): void {
  const lower = transcript.toLowerCase();
  
  for (const keyword of EMERGENCY_KEYWORDS) {
    if (lower.includes(keyword)) {
      session.emotionalContext = {
        isEmergency: true,
        isSeriou: true,
        keyword
      };
      console.log(`[Realtime] [Luna] Detected emergency keyword: ${keyword}`);
      return;
    }
  }
  
  for (const keyword of SERIOUS_KEYWORDS) {
    if (lower.includes(keyword)) {
      session.emotionalContext = {
        isEmergency: false,
        isSeriou: true,
        keyword
      };
      console.log(`[Realtime] [Luna] Detected serious keyword: ${keyword}`);
      return;
    }
  }
}

function injectEmpathyResponse(session: RealtimeSession, responseId?: string): void {
  if (responseId) {
    sendMessage(session, {
      type: "response.cancel",
      response_id: responseId,
    });
    console.log(`[Realtime] [Luna] Cancelled response: ${responseId}`);
  }
  
  const keyword = session.emotionalContext?.keyword || "situation";
  const empathyText = formatForVoice(
    `Oh no. I'm so sorry to hear that. Are you okay?`,
    { isEmergency: true }
  );
  
  console.log(`[Realtime] [Luna] Injecting empathy response for keyword: ${keyword}`);
  console.log(`[Realtime] [Luna] Empathy text to speak: "${empathyText}"`);
  
  sendMessage(session, {
    type: "response.create",
    response: {
      modalities: ["text", "audio"],
      instructions: `IMPORTANT: First, speak this EXACT empathy response out loud: "${empathyText}"

After speaking that, pause briefly, then gently ask one question to continue gathering information about their ${keyword} situation. Keep responses short and warm.`,
    },
  });
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
