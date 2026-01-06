import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface SectionFrameProps {
  children: React.ReactNode;
  className?: string;
  showCorners?: boolean;
  showConnectors?: boolean;
}

export function SectionFrame({
  children,
  className,
  showCorners = true,
  showConnectors = false,
}: SectionFrameProps) {
  const [debugFrame, setDebugFrame] = useState(false);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setDebugFrame(params.get("debugFrame") === "1");
    }
  }, []);

  const cornerBorderColor = debugFrame ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.2)";
  const connectorBgColor = debugFrame ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.2)";
  const cornerSize = debugFrame ? 32 : 24;
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
      {showCorners && (
        <>
          <div 
            className="absolute top-0 left-0" 
            style={{ 
              width: cornerSize, 
              height: cornerSize, 
              borderLeft: `${borderWidth}px solid ${cornerBorderColor}`,
              borderTop: `${borderWidth}px solid ${cornerBorderColor}`
            }} 
          />
          <div 
            className="absolute top-0 right-0" 
            style={{ 
              width: cornerSize, 
              height: cornerSize, 
              borderRight: `${borderWidth}px solid ${cornerBorderColor}`,
              borderTop: `${borderWidth}px solid ${cornerBorderColor}`
            }} 
          />
          <div 
            className="absolute bottom-0 left-0" 
            style={{ 
              width: cornerSize, 
              height: cornerSize, 
              borderLeft: `${borderWidth}px solid ${cornerBorderColor}`,
              borderBottom: `${borderWidth}px solid ${cornerBorderColor}`
            }} 
          />
          <div 
            className="absolute bottom-0 right-0" 
            style={{ 
              width: cornerSize, 
              height: cornerSize, 
              borderRight: `${borderWidth}px solid ${cornerBorderColor}`,
              borderBottom: `${borderWidth}px solid ${cornerBorderColor}`
            }} 
          />
        </>
      )}
      {showConnectors && (
        <>
          <div className="absolute top-1/2 left-0 w-3 -translate-y-1/2" style={{ height: 1, backgroundColor: connectorBgColor }} />
          <div className="absolute top-1/2 right-0 w-3 -translate-y-1/2" style={{ height: 1, backgroundColor: connectorBgColor }} />
          <div className="absolute top-0 left-1/2 h-3 -translate-x-1/2" style={{ width: 1, backgroundColor: connectorBgColor }} />
          <div className="absolute bottom-0 left-1/2 h-3 -translate-x-1/2" style={{ width: 1, backgroundColor: connectorBgColor }} />
        </>
      )}
      {children}
    </div>
  );
}
