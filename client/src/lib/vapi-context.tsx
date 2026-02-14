import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import Vapi from "@vapi-ai/web";

type CallStatus = "idle" | "connecting" | "active" | "ending";

interface VapiContextValue {
  status: CallStatus;
  muted: boolean;
  volumeLevel: number;
  errorMsg: string | null;
  startCall: () => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  enabled: boolean;
}

const VapiContext = createContext<VapiContextValue | null>(null);

const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY as string | undefined;
const VAPI_ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID as string | undefined;

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

export function VapiProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const vapiRef = useRef<Vapi | null>(null);

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
        console.error("[Vapi] error", err);
        setErrorMsg(typeof err === "string" ? err : err?.message || "Call error");
        setStatus("idle");
        vapiRef.current = null;
      });

      await vapi.start(assistantId);
    } catch (err: any) {
      console.error("[Vapi] start failed", err);
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

  return (
    <VapiContext.Provider
      value={{
        status,
        muted,
        volumeLevel,
        errorMsg,
        startCall,
        endCall,
        toggleMute,
        enabled: !!VAPI_PUBLIC_KEY,
      }}
    >
      {children}
    </VapiContext.Provider>
  );
}

export function useVapi() {
  const ctx = useContext(VapiContext);
  if (!ctx) throw new Error("useVapi must be used within VapiProvider");
  return ctx;
}
