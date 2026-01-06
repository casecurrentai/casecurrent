import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export type FrameVariant = "corners" | "brackets" | "crosshairs" | "rails" | "grid" | "minimal";

interface SectionFrameProps {
  children: React.ReactNode;
  className?: string;
  variant?: FrameVariant;
  showConnectors?: boolean;
  accentColor?: "primary" | "secondary" | "muted";
}

export function SectionFrame({
  children,
  className,
  variant = "corners",
  showConnectors = true,
  accentColor = "primary",
}: SectionFrameProps) {
  const [debugFrame, setDebugFrame] = useState(false);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setDebugFrame(params.get("debugFrame") === "1");
    }
  }, []);

  const colorMap = {
    primary: debugFrame ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.35)",
    secondary: debugFrame ? "hsl(var(--secondary-foreground))" : "hsl(var(--secondary-foreground) / 0.25)",
    muted: debugFrame ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground) / 0.2)",
  };
  
  const borderColor = colorMap[accentColor];
  const cornerSize = debugFrame ? 40 : 28;
  const borderWidth = debugFrame ? 4 : 2;

  return (
    <div 
      className={cn("relative", className)}
      style={debugFrame ? { 
        outline: "2px dotted hsl(var(--primary) / 0.6)", 
        outlineOffset: "4px",
        backgroundColor: "hsla(var(--primary) / 0.02)"
      } : {}}
      data-testid="section-frame"
    >
      {variant === "corners" && (
        <>
          <div 
            className="absolute top-0 left-0" 
            style={{ width: cornerSize, height: cornerSize, borderLeft: `${borderWidth}px solid ${borderColor}`, borderTop: `${borderWidth}px solid ${borderColor}` }} 
          />
          <div 
            className="absolute top-0 right-0" 
            style={{ width: cornerSize, height: cornerSize, borderRight: `${borderWidth}px solid ${borderColor}`, borderTop: `${borderWidth}px solid ${borderColor}` }} 
          />
          <div 
            className="absolute bottom-0 left-0" 
            style={{ width: cornerSize, height: cornerSize, borderLeft: `${borderWidth}px solid ${borderColor}`, borderBottom: `${borderWidth}px solid ${borderColor}` }} 
          />
          <div 
            className="absolute bottom-0 right-0" 
            style={{ width: cornerSize, height: cornerSize, borderRight: `${borderWidth}px solid ${borderColor}`, borderBottom: `${borderWidth}px solid ${borderColor}` }} 
          />
        </>
      )}

      {variant === "brackets" && (
        <>
          <div className="absolute top-0 left-0 flex items-start">
            <div style={{ width: 3, height: cornerSize * 1.5, backgroundColor: borderColor }} />
            <div style={{ width: cornerSize, height: 3, backgroundColor: borderColor }} />
          </div>
          <div className="absolute top-0 right-0 flex items-start justify-end">
            <div style={{ width: cornerSize, height: 3, backgroundColor: borderColor }} />
            <div style={{ width: 3, height: cornerSize * 1.5, backgroundColor: borderColor }} />
          </div>
          <div className="absolute bottom-0 left-0 flex items-end">
            <div style={{ width: 3, height: cornerSize * 1.5, backgroundColor: borderColor }} />
            <div style={{ width: cornerSize, height: 3, backgroundColor: borderColor, marginBottom: 0, alignSelf: "flex-end" }} />
          </div>
          <div className="absolute bottom-0 right-0 flex items-end justify-end">
            <div style={{ width: cornerSize, height: 3, backgroundColor: borderColor, alignSelf: "flex-end" }} />
            <div style={{ width: 3, height: cornerSize * 1.5, backgroundColor: borderColor }} />
          </div>
        </>
      )}

      {variant === "crosshairs" && (
        <>
          <div className="absolute top-0 left-0" style={{ transform: "translate(-50%, -50%)" }}>
            <div style={{ width: 20, height: 2, backgroundColor: borderColor, position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
            <div style={{ width: 2, height: 20, backgroundColor: borderColor, position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
            <div style={{ width: 8, height: 8, border: `2px solid ${borderColor}`, borderRadius: "50%", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
          </div>
          <div className="absolute top-0 right-0" style={{ transform: "translate(50%, -50%)" }}>
            <div style={{ width: 20, height: 2, backgroundColor: borderColor, position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
            <div style={{ width: 2, height: 20, backgroundColor: borderColor, position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
            <div style={{ width: 8, height: 8, border: `2px solid ${borderColor}`, borderRadius: "50%", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
          </div>
          <div className="absolute bottom-0 left-0" style={{ transform: "translate(-50%, 50%)" }}>
            <div style={{ width: 20, height: 2, backgroundColor: borderColor, position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
            <div style={{ width: 2, height: 20, backgroundColor: borderColor, position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
            <div style={{ width: 8, height: 8, border: `2px solid ${borderColor}`, borderRadius: "50%", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
          </div>
          <div className="absolute bottom-0 right-0" style={{ transform: "translate(50%, 50%)" }}>
            <div style={{ width: 20, height: 2, backgroundColor: borderColor, position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
            <div style={{ width: 2, height: 20, backgroundColor: borderColor, position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
            <div style={{ width: 8, height: 8, border: `2px solid ${borderColor}`, borderRadius: "50%", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
          </div>
        </>
      )}

      {variant === "rails" && (
        <>
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4" style={{ height: 1 }}>
            <div style={{ width: "30%", height: 2, backgroundColor: borderColor }} />
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ width: 8, height: 2, backgroundColor: borderColor }} />
              ))}
            </div>
            <div style={{ width: "30%", height: 2, backgroundColor: borderColor }} />
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4" style={{ height: 1 }}>
            <div style={{ width: "30%", height: 2, backgroundColor: borderColor }} />
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ width: 8, height: 2, backgroundColor: borderColor }} />
              ))}
            </div>
            <div style={{ width: "30%", height: 2, backgroundColor: borderColor }} />
          </div>
        </>
      )}

      {variant === "grid" && (
        <>
          <div className="absolute top-2 left-2 grid grid-cols-3 gap-1">
            {[...Array(9)].map((_, i) => (
              <div key={i} style={{ width: 4, height: 4, backgroundColor: borderColor, borderRadius: 1 }} />
            ))}
          </div>
          <div className="absolute top-2 right-2 grid grid-cols-3 gap-1">
            {[...Array(9)].map((_, i) => (
              <div key={i} style={{ width: 4, height: 4, backgroundColor: borderColor, borderRadius: 1 }} />
            ))}
          </div>
          <div className="absolute bottom-2 left-2 grid grid-cols-3 gap-1">
            {[...Array(9)].map((_, i) => (
              <div key={i} style={{ width: 4, height: 4, backgroundColor: borderColor, borderRadius: 1 }} />
            ))}
          </div>
          <div className="absolute bottom-2 right-2 grid grid-cols-3 gap-1">
            {[...Array(9)].map((_, i) => (
              <div key={i} style={{ width: 4, height: 4, backgroundColor: borderColor, borderRadius: 1 }} />
            ))}
          </div>
        </>
      )}

      {variant === "minimal" && (
        <>
          <div className="absolute top-0 left-0" style={{ width: 12, height: 2, backgroundColor: borderColor }} />
          <div className="absolute top-0 left-0" style={{ width: 2, height: 12, backgroundColor: borderColor }} />
          <div className="absolute top-0 right-0" style={{ width: 12, height: 2, backgroundColor: borderColor }} />
          <div className="absolute top-0 right-0" style={{ width: 2, height: 12, backgroundColor: borderColor }} />
          <div className="absolute bottom-0 left-0" style={{ width: 12, height: 2, backgroundColor: borderColor }} />
          <div className="absolute bottom-0 left-0" style={{ width: 2, height: 12, backgroundColor: borderColor }} />
          <div className="absolute bottom-0 right-0" style={{ width: 12, height: 2, backgroundColor: borderColor }} />
          <div className="absolute bottom-0 right-0" style={{ width: 2, height: 12, backgroundColor: borderColor }} />
        </>
      )}

      {showConnectors && (
        <>
          <div className="absolute top-1/2 left-0 w-3 -translate-y-1/2" style={{ height: 1, backgroundColor: borderColor }} />
          <div className="absolute top-1/2 right-0 w-3 -translate-y-1/2" style={{ height: 1, backgroundColor: borderColor }} />
          <div className="absolute top-0 left-1/2 h-3 -translate-x-1/2" style={{ width: 1, backgroundColor: borderColor }} />
          <div className="absolute bottom-0 left-1/2 h-3 -translate-x-1/2" style={{ width: 1, backgroundColor: borderColor }} />
        </>
      )}
      {children}
    </div>
  );
}

export function BlueprintDivider({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 py-8", className)}>
      <div className="flex-1 h-px bg-primary/20" />
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rotate-45 border border-primary/30" />
        <div className="w-3 h-3 rounded-full border-2 border-primary/30" />
        <div className="w-2 h-2 rotate-45 border border-primary/30" />
      </div>
      <div className="flex-1 h-px bg-primary/20" />
    </div>
  );
}

export function SectionBackground({ 
  children, 
  variant = "default",
  className 
}: { 
  children: React.ReactNode; 
  variant?: "default" | "subtle" | "muted" | "accent";
  className?: string;
}) {
  const bgClasses = {
    default: "",
    subtle: "bg-muted/30",
    muted: "bg-muted/50",
    accent: "bg-primary/5",
  };

  return (
    <div className={cn(bgClasses[variant], className)}>
      {children}
    </div>
  );
}
