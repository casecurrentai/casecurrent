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
