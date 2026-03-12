import { createContext, useContext, useState, useCallback, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import type { Status } from "@elevenlabs/react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ElevenLabsContextValue {
  status: Status;
  messages: ChatMessage[];
  isSpeaking: boolean;
  errorMsg: string | null;
  connect: (textOnly?: boolean) => Promise<void>;
  disconnect: () => void;
  sendMessage: (text: string) => void;
  getInputVolume: () => number;
  getOutputVolume: () => number;
  enabled: boolean;
}

const ElevenLabsContext = createContext<ElevenLabsContextValue | null>(null);

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string | undefined;

// Voice quality overrides for Avery 2.0 Web
// These are applied on every session start to keep the voice emotional and
// human-sounding while preventing over-eagerness.
//
// stability (0–1): lower = more expressive emotional variation.
//   Default is ~0.5. Set to 0.35 for warmer, more human-sounding delivery
//   without losing coherence.
//
// similarityBoost (0–1): keeps voice character consistent across turns.
//   0.82 maintains Avery's identity while allowing natural variation.
//
// speed (0.7–1.2): 0.92 gives a slightly more deliberate, unhurried pace so
//   Avery does not sound eager to cut in or rush through a response.
//
// DASHBOARD SETTINGS (must be tuned in the ElevenLabs agent UI — not
// overridable from the client SDK):
//   • interruption_threshold → raise to ~500 ms (default ~100 ms) so brief
//     background noise, filler words, or short pauses do not trigger a
//     barge-in and cut Avery off mid-sentence.
//   • silence_end_duration_ms (turn-end VAD) → raise to ~900–1000 ms so
//     Avery waits for a genuine pause before considering the caller's turn
//     complete, rather than jumping in after every short breath.
//   • Turn detection model → prefer "turn_v3" if available; it uses a
//     smarter acoustic model that is less sensitive to ambient noise.
const AVERY_TTS_OVERRIDES = {
  stability: 0.35,       // emotional expressiveness; lower = warmer / more varied
  similarityBoost: 0.82, // voice-character consistency across turns
  speed: 0.92,           // slightly unhurried so responses feel considered
} as const;

export function ElevenLabsProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isTextOnlyRef = useRef(true);

  const conversation = useConversation({
    onConnect: () => {
      setErrorMsg(null);
    },
    onDisconnect: () => {
      // Keep messages visible after disconnect
    },
    onMessage: (msg) => {
      if (msg.message) {
        setMessages((prev) => [
          ...prev,
          {
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.message,
          },
        ]);
      }
    },
    onError: (message) => {
      console.error("[ElevenLabs] error:", message);
      setErrorMsg(typeof message === "string" ? message : "Connection error");
    },
  });

  const connect = useCallback(
    async (textOnly = true) => {
      if (!AGENT_ID) {
        setErrorMsg("VITE_ELEVENLABS_AGENT_ID not configured");
        return;
      }

      isTextOnlyRef.current = textOnly;
      setErrorMsg(null);

      try {
        await conversation.startSession({
          agentId: AGENT_ID,
          connectionType: textOnly ? "websocket" : "webrtc",
          overrides: {
            tts: AVERY_TTS_OVERRIDES,
            conversation: { textOnly },
          },
        });
      } catch (err: any) {
        console.error("[ElevenLabs] start failed:", err);
        setErrorMsg(err?.message || "Failed to connect");
      }
    },
    [conversation],
  );

  const disconnect = useCallback(() => {
    conversation.endSession();
  }, [conversation]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Auto-connect in text mode if not connected
      if (conversation.status === "disconnected") {
        isTextOnlyRef.current = true;
        setErrorMsg(null);

        if (!AGENT_ID) {
          setErrorMsg("VITE_ELEVENLABS_AGENT_ID not configured");
          return;
        }

        try {
          // Add user message immediately for responsiveness
          setMessages((prev) => [...prev, { role: "user", content: text }]);

          await conversation.startSession({
            agentId: AGENT_ID,
            connectionType: "websocket",
            overrides: {
              tts: AVERY_TTS_OVERRIDES,
              conversation: { textOnly: true },
            },
          });

          // Send after connection established
          conversation.sendUserMessage(text);
        } catch (err: any) {
          console.error("[ElevenLabs] auto-connect failed:", err);
          setErrorMsg(err?.message || "Failed to connect");
        }
        return;
      }

      // Already connected — send directly
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      conversation.sendUserMessage(text);
    },
    [conversation],
  );

  return (
    <ElevenLabsContext.Provider
      value={{
        status: conversation.status,
        messages,
        isSpeaking: conversation.isSpeaking,
        errorMsg,
        connect,
        disconnect,
        sendMessage,
        getInputVolume: conversation.getInputVolume,
        getOutputVolume: conversation.getOutputVolume,
        enabled: !!AGENT_ID,
      }}
    >
      {children}
    </ElevenLabsContext.Provider>
  );
}

export function useElevenLabs() {
  const ctx = useContext(ElevenLabsContext);
  if (!ctx) throw new Error("useElevenLabs must be used within ElevenLabsProvider");
  return ctx;
}
