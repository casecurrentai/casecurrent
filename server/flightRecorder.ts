import { maskPhone, maskCallSid, maskSipUri } from "./utils/logMasking";

export type TelephonyEventSource = 
  | "twilio-voice-webhook"
  | "twilio-status-callback"
  | "twilio-sip-status"
  | "twilio-dial-result"
  | "openai-webhook"
  | "openai-accept";

export interface TelephonyEvent {
  ts: string;
  source: TelephonyEventSource;
  requestId: string;
  callSid?: string;
  callId?: string;
  orgId?: string;
  e164?: string;
  summary: string;
  payload: Record<string, unknown>;
}

const RING_BUFFER_SIZE = 200;
const eventBuffer: TelephonyEvent[] = [];

function redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    if (lowerKey.includes("secret") || lowerKey.includes("password") || lowerKey.includes("token") || lowerKey.includes("key") || lowerKey.includes("authorization")) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "string") {
      let redacted = value;
      redacted = redacted.replace(/whsec_[A-Za-z0-9+/=]+/g, "whsec_[REDACTED]");
      redacted = redacted.replace(/sk-[A-Za-z0-9]+/g, "sk-[REDACTED]");
      redacted = redacted.replace(/Bearer [A-Za-z0-9._-]+/g, "Bearer [REDACTED]");
      
      if (lowerKey.includes("from") || lowerKey.includes("phone") || lowerKey === "caller") {
        redacted = maskPhone(redacted);
      }
      if (lowerKey.includes("callsid") || lowerKey.includes("call_id")) {
        redacted = maskCallSid(redacted);
      }
      if (lowerKey.includes("sip") || lowerKey.includes("uri")) {
        redacted = maskSipUri(redacted);
      }
      
      result[key] = redacted;
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = redactSecrets(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

export function recordEvent(event: Omit<TelephonyEvent, "ts">): void {
  const fullEvent: TelephonyEvent = {
    ...event,
    ts: new Date().toISOString(),
    payload: redactSecrets(event.payload),
    callSid: event.callSid ? maskCallSid(event.callSid) : undefined,
    callId: event.callId ? maskCallSid(event.callId) : undefined,
    e164: event.e164 ? maskPhone(event.e164) : undefined,
  };
  
  eventBuffer.push(fullEvent);
  
  if (eventBuffer.length > RING_BUFFER_SIZE) {
    eventBuffer.shift();
  }
  
  console.log(`[FlightRecorder] ${fullEvent.source} | ${fullEvent.summary}`);
}

export function getRecentEvents(limit: number = 50): TelephonyEvent[] {
  const count = Math.min(limit, eventBuffer.length);
  return eventBuffer.slice(-count).reverse();
}

export function getEventCount(): number {
  return eventBuffer.length;
}
