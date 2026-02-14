import { Phone, PhoneOff, Loader2, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVapi } from "@/lib/vapi-context";

export function VapiCallButton({ className }: { className?: string }) {
  const { status, muted, volumeLevel, errorMsg, startCall, endCall, toggleMute, enabled } = useVapi();

  const isActive = status === "active";
  const isConnecting = status === "connecting";
  const isEnding = status === "ending";
  const isBusy = isConnecting || isEnding;

  if (!enabled) return null;

  const volumeScale = isActive ? 1 + volumeLevel * 0.18 : 1;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="flex items-center gap-3">
        {/* Orb container */}
        <div className="relative group">
          {/* Rotating gradient halo */}
          <span
            className={cn(
              "absolute inset-[-3px] rounded-full opacity-0 transition-opacity duration-500",
              "bg-[conic-gradient(from_0deg,#2563eb,#06b6d4,#3b82f6,#8b5cf6,#2563eb)]",
              "animate-[orb-spin_4s_linear_infinite]",
              !isActive && !isBusy && "group-hover:opacity-100",
              isConnecting && "opacity-100 animate-[orb-spin_1.5s_linear_infinite]",
              isActive && "opacity-100 bg-[conic-gradient(from_0deg,#ef4444,#f97316,#ef4444,#dc2626,#ef4444)] animate-[orb-spin_3s_linear_infinite]",
            )}
          />

          {/* Pulse rings */}
          <span
            className={cn(
              "absolute inset-[-8px] rounded-full transition-all duration-300",
              isActive
                ? "bg-red-500/15"
                : "bg-blue-500/10 animate-[orb-ping_2.5s_ease-in-out_infinite]",
              isConnecting && "bg-blue-400/20 animate-[orb-ping_1s_ease-in-out_infinite]",
            )}
            style={isActive ? {
              transform: `scale(${1 + volumeLevel * 0.7})`,
              opacity: 0.3 + volumeLevel * 0.5,
            } : undefined}
          />
          <span
            className={cn(
              "absolute inset-[-16px] rounded-full transition-all duration-500",
              isActive
                ? "bg-red-500/8"
                : "bg-blue-400/6 animate-[orb-ping_2.5s_ease-in-out_0.4s_infinite]",
              isConnecting && "bg-blue-400/10 animate-[orb-ping_1s_ease-in-out_0.3s_infinite]",
            )}
            style={isActive ? {
              transform: `scale(${1 + volumeLevel * 1.1})`,
              opacity: 0.15 + volumeLevel * 0.3,
            } : undefined}
          />
          <span
            className={cn(
              "absolute inset-[-24px] rounded-full transition-all duration-700",
              isActive
                ? "bg-red-500/5"
                : "bg-cyan-400/4 animate-[orb-ping_2.5s_ease-in-out_0.8s_infinite]",
              isConnecting && "hidden",
            )}
            style={isActive ? {
              transform: `scale(${1 + volumeLevel * 1.4})`,
              opacity: 0.08 + volumeLevel * 0.2,
            } : undefined}
          />

          {/* Main orb button */}
          <button
            disabled={isBusy}
            onClick={isActive ? endCall : startCall}
            className={cn(
              "relative flex items-center justify-center",
              "w-16 h-16 rounded-full",
              "transition-all duration-300 ease-out",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-2",
              isBusy && "cursor-wait",
              !isBusy && "cursor-pointer",
            )}
            style={{ transform: `scale(${volumeScale})` }}
            data-testid="button-vapi-call"
          >
            {/* Inner gradient body */}
            <span
              className={cn(
                "absolute inset-0 rounded-full transition-all duration-300",
                "shadow-lg",
                isActive
                  ? "bg-gradient-to-br from-red-500 via-red-600 to-orange-600 shadow-red-500/40"
                  : "bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 shadow-blue-500/40",
                isConnecting && "from-blue-400 via-blue-500 to-cyan-400",
                !isBusy && !isActive && "group-hover:shadow-xl group-hover:shadow-blue-500/50 group-hover:from-blue-400 group-hover:via-blue-500 group-hover:to-cyan-400",
              )}
            />

            {/* Shimmer sweep */}
            <span
              className={cn(
                "absolute inset-0 rounded-full overflow-hidden",
                !isActive && !isBusy && "animate-[orb-shimmer_3s_ease-in-out_infinite]",
                isConnecting && "animate-[orb-shimmer_1.2s_ease-in-out_infinite]",
              )}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] animate-[inherit]" />
            </span>

            {/* Icon */}
            <span className="relative z-10">
              {isConnecting ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : isEnding ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : isActive ? (
                <PhoneOff className="h-6 w-6 text-white drop-shadow-sm" />
              ) : (
                <Phone className="h-6 w-6 text-white drop-shadow-sm" />
              )}
            </span>
          </button>
        </div>

        {/* Mute toggle */}
        {isActive && (
          <button
            onClick={toggleMute}
            className={cn(
              "flex items-center justify-center",
              "w-10 h-10 rounded-full border-2 transition-all duration-200",
              muted
                ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950"
                : "border-border/50 bg-background/80 backdrop-blur-sm hover:bg-muted hover:border-border",
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
          "text-xs font-semibold tracking-wide uppercase transition-colors duration-200",
          isActive ? "text-red-500 dark:text-red-400" : "text-blue-600 dark:text-blue-400",
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
