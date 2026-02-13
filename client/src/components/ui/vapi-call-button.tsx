import { useState, useEffect, useRef, useCallback } from "react";
import Vapi from "@vapi-ai/web";
import { Button } from "@/components/ui/button";
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

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="flex items-center gap-2">
        {/* Main call button */}
        <Button
          size="lg"
          variant={isActive ? "destructive" : "default"}
          disabled={isBusy}
          onClick={isActive ? endCall : startCall}
          className={cn(
            "relative gap-2 font-semibold",
            isActive && "animate-pulse-subtle"
          )}
          data-testid="button-vapi-call"
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : isEnding ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Ending...
            </>
          ) : isActive ? (
            <>
              <PhoneOff className="h-4 w-4" />
              End Call
            </>
          ) : (
            <>
              <Phone className="h-4 w-4" />
              Talk to Avery
            </>
          )}

          {/* Volume indicator ring */}
          {isActive && (
            <span
              className="absolute inset-0 rounded-md border-2 border-primary/50 pointer-events-none"
              style={{ opacity: Math.min(volumeLevel * 2, 1) }}
            />
          )}
        </Button>

        {/* Mute toggle (visible during active call) */}
        {isActive && (
          <Button
            size="icon"
            variant="outline"
            onClick={toggleMute}
            data-testid="button-vapi-mute"
          >
            {muted ? <MicOff className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {errorMsg && (
        <p className="text-xs text-destructive max-w-[260px] text-center" data-testid="text-vapi-error">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
