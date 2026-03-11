import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Mic,
  MicOff,
  PhoneOff,
  X,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useElevenLabs, type ChatMessage } from "@/lib/elevenlabs-context";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Collapsed FAB — Animated Orb                                      */
/* ------------------------------------------------------------------ */

function AveryFab({ onClick }: { onClick: () => void }) {
  const { status, isSpeaking } = useElevenLabs();
  const isConnected = status === "connected";

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center gap-1.5",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-2 rounded-full",
      )}
      aria-label="Open Avery chat"
    >
      {/* Pulse rings */}
      <span
        className={cn(
          "absolute inset-[-8px] rounded-full transition-all duration-300",
          isConnected
            ? "bg-emerald-500/15"
            : "bg-blue-500/10 animate-[orb-ping_2.5s_ease-in-out_infinite]",
        )}
      />
      <span
        className={cn(
          "absolute inset-[-16px] rounded-full transition-all duration-500",
          isConnected
            ? "bg-emerald-500/8"
            : "bg-blue-400/6 animate-[orb-ping_2.5s_ease-in-out_0.4s_infinite]",
        )}
      />

      {/* Rotating gradient halo */}
      <span
        className={cn(
          "absolute inset-[-3px] rounded-full opacity-0 transition-opacity duration-500",
          "bg-[conic-gradient(from_0deg,#2563eb,#06b6d4,#3b82f6,#8b5cf6,#2563eb)]",
          "animate-[orb-spin_4s_linear_infinite]",
          "group-hover:opacity-100",
          isConnected &&
            "opacity-100 bg-[conic-gradient(from_0deg,#10b981,#06b6d4,#10b981,#3b82f6,#10b981)]",
        )}
      />

      {/* Main orb body */}
      <span
        className={cn(
          "relative flex items-center justify-center",
          "w-14 h-14 rounded-full",
          "shadow-lg transition-all duration-300",
          isConnected
            ? "bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-500 shadow-emerald-500/40"
            : "bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 shadow-blue-500/40",
          "group-hover:shadow-xl group-hover:scale-105",
        )}
      >
        {/* Shimmer */}
        <span className="absolute inset-0 rounded-full overflow-hidden animate-[orb-shimmer_3s_ease-in-out_infinite]">
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent translate-x-[-100%] animate-[inherit]" />
        </span>

        {/* Icon */}
        <MessageCircle className="relative z-10 h-6 w-6 text-white drop-shadow-sm" />
      </span>

      {/* Label */}
      <span
        className={cn(
          "text-[11px] font-semibold tracking-wide uppercase",
          isConnected
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-blue-600 dark:text-blue-400",
        )}
      >
        Avery
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Chat message bubble                                               */
/* ------------------------------------------------------------------ */

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-blue-600 text-white rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                       */
/* ------------------------------------------------------------------ */

function ChatEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/30">
        <MessageCircle className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          Start a conversation
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Type a message or tap the mic to talk
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini orb for header                                               */
/* ------------------------------------------------------------------ */

function MiniOrb({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "relative h-9 w-9 rounded-full flex-shrink-0",
        "bg-gradient-to-br shadow-md transition-all duration-300",
        active
          ? "from-emerald-500 via-teal-600 to-cyan-500 shadow-emerald-500/30"
          : "from-blue-500 via-blue-600 to-cyan-500 shadow-blue-500/30",
      )}
    >
      <span className="absolute inset-0 rounded-full overflow-hidden animate-[orb-shimmer_3s_ease-in-out_infinite]">
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] animate-[inherit]" />
      </span>
      <span className="absolute inset-0 flex items-center justify-center">
        <MessageCircle className="h-4 w-4 text-white" />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Expanded chat panel                                               */
/* ------------------------------------------------------------------ */

function AveryChatPanel({ onClose }: { onClose: () => void }) {
  const {
    status,
    messages,
    isSpeaking,
    errorMsg,
    connect,
    disconnect,
    sendMessage,
  } = useElevenLabs();

  const [textInput, setTextInput] = useState("");
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const isTransitioning = isConnecting || status === "disconnecting";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const handleSendText = useCallback(() => {
    if (!textInput.trim() || isTransitioning) return;
    sendMessage(textInput.trim());
    setTextInput("");
  }, [textInput, isTransitioning, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendText();
      }
    },
    [handleSendText],
  );

  const handleVoiceToggle = useCallback(async () => {
    if (isVoiceMode && isConnected) {
      // End voice session
      disconnect();
      setIsVoiceMode(false);
    } else if (!isVoiceMode) {
      // Start voice session
      setIsVoiceMode(true);
      await connect(false); // WebRTC
    }
  }, [isVoiceMode, isConnected, connect, disconnect]);

  const handleEndCall = useCallback(() => {
    disconnect();
    setIsVoiceMode(false);
  }, [disconnect]);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl",
        "w-[370px] h-[460px]",
        "animate-[widget-expand_0.25s_ease-out_forwards]",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <MiniOrb active={isConnected} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-none">Avery</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isConnecting ? (
              <span className="text-xs text-muted-foreground animate-pulse">
                Connecting...
              </span>
            ) : isConnected ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  {isVoiceMode
                    ? isSpeaking
                      ? "Speaking"
                      : "Listening"
                    : "Connected"}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                AI Intake Agent
              </span>
            )}
          </div>
        </div>

        {/* End call button (voice mode) */}
        {isVoiceMode && isConnected && (
          <Button
            size="icon"
            variant="destructive"
            className="h-8 w-8 rounded-full"
            onClick={handleEndCall}
          >
            <PhoneOff className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Conversation body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <ChatEmptyState />
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 p-4">
            {messages.map((msg, i) => (
              <ChatBubble key={i} message={msg} />
            ))}

            {/* Typing indicator when waiting for response */}
            {isConnected &&
              messages.length > 0 &&
              messages[messages.length - 1].role === "user" && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-2.5">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="mx-4 mb-2 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          {errorMsg}
        </div>
      )}

      {/* Footer */}
      <div className="border-t px-3 py-2.5">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isVoiceMode && isConnected
                ? "Voice mode active..."
                : "Type a message..."
            }
            disabled={isTransitioning || (isVoiceMode && isConnected)}
            className={cn(
              "flex-1 h-9 rounded-lg border bg-background px-3 text-sm",
              "placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-1 focus:ring-blue-400",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          />

          {/* Send button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-full shrink-0"
            onClick={handleSendText}
            disabled={
              !textInput.trim() ||
              isTransitioning ||
              (isVoiceMode && isConnected)
            }
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>

          {/* Voice toggle */}
          <Button
            size="icon"
            variant={isVoiceMode && isConnected ? "secondary" : "ghost"}
            className={cn(
              "h-9 w-9 rounded-full shrink-0 transition-all",
              isVoiceMode &&
                isConnected &&
                "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900",
            )}
            onClick={handleVoiceToggle}
            disabled={isTransitioning}
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isVoiceMode && isConnected ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            <span className="sr-only">
              {isVoiceMode && isConnected
                ? "End voice call"
                : "Start voice call"}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Root widget — toggles between FAB and chat panel                  */
/* ------------------------------------------------------------------ */

export function AveryWidget() {
  const [expanded, setExpanded] = useState(false);
  const { enabled } = useElevenLabs();

  if (!enabled) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {expanded ? (
        <AveryChatPanel onClose={() => setExpanded(false)} />
      ) : (
        <AveryFab onClick={() => setExpanded(true)} />
      )}
    </div>
  );
}
