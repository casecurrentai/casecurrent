/**
 * AveryWidget — multimodal floating AI widget
 *
 * Modes:
 *  - Voice: uses Vapi (existing VapiProvider). The ElevenLabs Orb reflects call state.
 *  - Chat:  streams responses from POST /v1/chat/avery (OpenAI gpt-4o-mini).
 *
 * The Orb acts as the FAB (fixed bottom-right). Clicking it opens a panel
 * that slides up above it with Voice / Chat tabs.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Orb } from "@/components/ui/orb";
import { useVapi } from "@/lib/vapi-context";
import { cn } from "@/lib/utils";
import { X, Mic, MicOff, PhoneOff, Phone, Send, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "voice" | "chat";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content: "Hi! I'm Avery. I can answer questions about your case, or click Voice to talk with me directly. What can I help you with?",
};

// ── Chat hook ────────────────────────────────────────────────────────────────

function useAveryChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setIsStreaming(true);

    // Optimistically add empty assistant message
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/v1/chat/avery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Handle both streaming SSE and plain JSON fallback
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream")) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const raw = decoder.decode(value, { stream: true });
          const lines = raw.split("\n").filter((l) => l.startsWith("data: "));
          for (const line of lines) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const { text: chunk } = JSON.parse(data);
              accumulated += chunk;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: accumulated };
                return updated;
              });
            } catch {}
          }
        }
      } else {
        const json = await res.json();
        const msg = json.message ?? "Sorry, I couldn't process that. Please try again.";
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: msg };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "I'm having trouble connecting right now. Please try the voice button or call us directly.",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [input, messages, isStreaming]);

  return { messages, input, setInput, isStreaming, send };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function VoicePanel({
  status,
  muted,
  errorMsg,
  startCall,
  endCall,
  toggleMute,
  enabled,
}: ReturnType<typeof useVapi>) {
  const isActive = status === "active";
  const isConnecting = status === "connecting";
  const isBusy = isConnecting || status === "ending";

  return (
    <div className="flex flex-col items-center gap-4 py-6 px-4">
      {/* Status */}
      <p className={cn(
        "text-sm font-medium transition-colors",
        isActive ? "text-emerald-500" : isConnecting ? "text-blue-500" : "text-muted-foreground",
      )}>
        {isConnecting ? "Connecting…" : status === "ending" ? "Ending…" : isActive ? "Live" : "Ready to talk"}
      </p>

      {/* Start / end call */}
      {!enabled ? (
        <p className="text-xs text-muted-foreground text-center max-w-[200px]">
          Voice calls aren't configured yet. Use the chat tab to get help.
        </p>
      ) : (
        <button
          disabled={isBusy}
          onClick={isActive ? endCall : startCall}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all",
            isActive
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-primary hover:bg-primary/90 text-primary-foreground",
            isBusy && "opacity-60 cursor-wait",
          )}
          data-testid="button-avery-voice-toggle"
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isActive ? (
            <PhoneOff className="h-4 w-4" />
          ) : (
            <Phone className="h-4 w-4" />
          )}
          {isConnecting ? "Connecting…" : status === "ending" ? "Ending…" : isActive ? "End call" : "Start voice call"}
        </button>
      )}

      {/* Mute */}
      {isActive && (
        <button
          onClick={toggleMute}
          className={cn(
            "flex items-center gap-1.5 text-xs transition-colors",
            muted ? "text-red-500" : "text-muted-foreground hover:text-foreground",
          )}
          data-testid="button-avery-mute"
        >
          {muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          {muted ? "Unmute" : "Mute"}
        </button>
      )}

      {errorMsg && (
        <p className="text-xs text-destructive text-center max-w-[220px]" data-testid="text-avery-error">
          {errorMsg}
        </p>
      )}
    </div>
  );
}

function ChatPanel({ messages, input, setInput, isStreaming, send }: ReturnType<typeof useAveryChat>) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {msg.content || (
                <span className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask Avery anything…"
          disabled={isStreaming}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
          data-testid="input-avery-chat"
        />
        <button
          onClick={send}
          disabled={!input.trim() || isStreaming}
          className="flex-shrink-0 p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 transition-opacity hover:opacity-90"
          data-testid="button-avery-chat-send"
        >
          {isStreaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function AveryWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");

  const vapi = useVapi();
  const chat = useAveryChat();

  const { status, volumeLevel } = vapi;

  // Auto-open panel when a call starts; switch to voice tab
  useEffect(() => {
    if (status === "connecting" || status === "active") {
      setIsOpen(true);
      setMode("voice");
    }
  }, [status]);

  // Derive orb agentState from Vapi call status + volume heuristic
  const orbAgentState: "thinking" | "listening" | "talking" | null =
    status === "connecting" || status === "ending" ? "thinking"
    : status === "active" ? (volumeLevel > 0.1 ? "talking" : "listening")
    : null;

  return (
    <>
      {/* Expandable panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: "min(480px, calc(100dvh - 120px))" }}
          data-testid="panel-avery-widget"
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-semibold text-foreground flex-1">Avery</span>
            {/* Mode tabs */}
            <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
              <ModeTab active={mode === "voice"} onClick={() => setMode("voice")}>
                🎙 Voice
              </ModeTab>
              <ModeTab active={mode === "chat"} onClick={() => setMode("chat")}>
                💬 Chat
              </ModeTab>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="ml-1 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close"
              data-testid="button-avery-close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Panel body */}
          <div className={cn("flex-1 min-h-0", mode === "chat" ? "flex flex-col" : "")}>
            {mode === "voice" ? (
              <VoicePanel {...vapi} />
            ) : (
              <ChatPanel {...chat} />
            )}
          </div>
        </div>
      )}

      {/* Orb FAB */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
        aria-label={isOpen ? "Close Avery" : "Chat with Avery"}
        data-testid="button-avery-orb"
      >
        <Orb
          agentState={orbAgentState}
          volumeMode="manual"
          manualOutput={volumeLevel}
          manualInput={0}
          className="w-full h-full"
        />
      </button>

      {/* Label — only when panel is closed */}
      {!isOpen && (
        <span className="fixed bottom-[5.25rem] right-6 z-50 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground text-center w-16 pointer-events-none">
          Ask Avery
        </span>
      )}
    </>
  );
}
