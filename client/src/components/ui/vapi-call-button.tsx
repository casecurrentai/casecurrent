import { useState, useEffect, useRef, useCallback } from "react";
import Vapi from "@vapi-ai/web";
import { Phone, PhoneOff, Loader2, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

type CallStatus = "idle" | "connecting" | "active" | "ending";

const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY as string | undefined;
const VAPI_ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID as string | undefined;

// Business hours: M-F 8am-6pm local time
function isBusinessHours(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
}

function getAssistantId(): string | null {
  if (VAPI_ASSISTANT_ID) return VAPI_ASSISTANT_ID;

  const bh = import.meta.env.VITE_VAPI_ASSISTANT_ID_BH as string | undefined;
  const ah = import.meta.env.VITE_VAPI_ASSISTANT_ID_AH as string | undefined;

  if (bh && ah) return isBusinessHours() ? bh : ah;
  return bh || ah || null;
}

export function VapiCallButton({ className }: { className?: string }) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const vapiRef = useRef<Vapi | null>(null);

  // Ensure cleanup on unmount
  useEffect(() => {
    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop();
        vapiRef.current.removeAllListeners();
        vapiRef.current = null;
      }
    };
  }, []);

  const startCall = useCallback(async () => {
    if (!VAPI_PUBLIC_KEY) {
      setErrorMsg("VITE_VAPI_PUBLIC_KEY not configured");
      return;
    }
    const assistantId = getAssistantId();
    if (!assistantId) {
      setErrorMsg("No Vapi assistant ID configured");
      return;
    }

    setErrorMsg(null);
    setStatus("connecting");

    try {
      const vapi = new Vapi(VAPI_PUBLIC_KEY);
      vapiRef.current = vapi;

      vapi.on("call-start", () => setStatus("active"));
      vapi.on("call-end", () => {
        setStatus("idle");
        setMuted(false);
        setVolumeLevel(0);
        vapiRef.current = null;
      });
      vapi.on("volume-level", (level) => setVolumeLevel(level));
      vapi.on("error", (err) => {
        console.error("[VapiCallButton] error", err);
        setErrorMsg(typeof err === "string" ? err : err?.message || "Call error");
        setStatus("idle");
        vapiRef.current = null;
      });

      await vapi.start(assistantId);
    } catch (err: any) {
      console.error("[VapiCallButton] start failed", err);
      setErrorMsg(err?.message || "Failed to start call");
      setStatus("idle");
      vapiRef.current = null;
    }
  }, []);

  const endCall = useCallback(() => {
    if (vapiRef.current) {
      setStatus("ending");
      vapiRef.current.stop();
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (vapiRef.current && status === "active") {
      const next = !muted;
      vapiRef.current.setMuted(next);
      setMuted(next);
    }
  }, [muted, status]);

  const isActive = status === "active";
  const isConnecting = status === "connecting";
  const isEnding = status === "ending";
  const isBusy = isConnecting || isEnding;

  if (!VAPI_PUBLIC_KEY) return null;

  // Audio-reactive scale: orb grows slightly with volume
  const volumeScale = isActive ? 1 + volumeLevel * 0.15 : 1;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="flex items-center gap-3">
        {/* Orb button */}
        <button
          disabled={isBusy}
          onClick={isActive ? endCall : startCall}
          className={cn(
            "relative group flex items-center justify-center",
            "w-14 h-14 rounded-full",
            "transition-all duration-300 ease-out",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
            isBusy && "cursor-wait",
            !isBusy && !isActive && "cursor-pointer",
          )}
          style={{ transform: `scale(${volumeScale})` }}
          data-testid="button-vapi-call"
        >
          {/* Outer pulse rings — idle breathing / active audio-reactive */}
          <span
            className={cn(
              "absolute inset-0 rounded-full",
              "transition-all duration-300",
              isActive
                ? "bg-red-500/20"
                : "bg-primary/10 animate-[orb-ping_3s_ease-in-out_infinite]",
              isConnecting && "bg-primary/20 animate-[orb-ping_1.2s_ease-in-out_infinite]",
            )}
            style={isActive ? {
              transform: `scale(${1 + volumeLevel * 0.6})`,
              opacity: 0.4 + volumeLevel * 0.4,
            } : undefined}
          />
          <span
            className={cn(
              "absolute inset-[-6px] rounded-full",
              "transition-all duration-500",
              isActive
                ? "bg-red-500/10"
                : "bg-primary/5 animate-[orb-ping_3s_ease-in-out_0.5s_infinite]",
              isConnecting && "bg-primary/10 animate-[orb-ping_1.2s_ease-in-out_0.3s_infinite]",
            )}
            style={isActive ? {
              transform: `scale(${1 + volumeLevel * 0.9})`,
              opacity: 0.2 + volumeLevel * 0.3,
            } : undefined}
          />

          {/* Orb body */}
          <span
            className={cn(
              "relative z-10 flex items-center justify-center",
              "w-14 h-14 rounded-full",
              "shadow-lg transition-all duration-300",
              isActive
                ? "bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/30"
                : "bg-gradient-to-br from-primary to-primary/80 shadow-primary/30",
              isConnecting && "from-primary/80 to-primary/60",
              !isBusy && !isActive && "group-hover:shadow-xl group-hover:shadow-primary/40 group-hover:scale-105",
            )}
          >
            {isConnecting ? (
              <Loader2 className="h-5 w-5 text-primary-foreground animate-spin" />
            ) : isEnding ? (
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            ) : isActive ? (
              <PhoneOff className="h-5 w-5 text-white" />
            ) : (
              <Phone className="h-5 w-5 text-primary-foreground" />
            )}
          </span>
        </button>

        {/* Mute toggle (visible during active call) */}
        {isActive && (
          <button
            onClick={toggleMute}
            className={cn(
              "flex items-center justify-center",
              "w-10 h-10 rounded-full border transition-all duration-200",
              muted
                ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
                : "border-border bg-background hover:bg-muted",
            )}
            data-testid="button-vapi-mute"
          >
            {muted ? <MicOff className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Label */}
      <span
        className={cn(
          "text-xs font-medium transition-colors duration-200",
          isActive ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
          !isActive && !isBusy && "group-hover:text-foreground",
        )}
      >
        {isConnecting ? "Connecting..." : isEnding ? "Ending..." : isActive ? "Tap to end" : "Talk to Avery"}
      </span>

      {errorMsg && (
        <p className="text-xs text-destructive max-w-[260px] text-center" data-testid="text-vapi-error">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
