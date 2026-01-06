import { useLocation } from "wouter";

interface GuillochePatternProps {
  className?: string;
}

export function GuillochePattern({ className }: GuillochePatternProps) {
  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none ${className || ""}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: 0.03 }}
    >
      <defs>
        <pattern
          id="guilloche-pattern"
          x="0"
          y="0"
          width="100"
          height="100"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0,50 Q25,0 50,50 T100,50"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          <path
            d="M0,50 Q25,100 50,50 T100,50"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="0.3" />
          <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="0.3" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#guilloche-pattern)" />
    </svg>
  );
}

export function DotGridPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: 0.04 }}
    >
      <defs>
        <pattern
          id="dot-grid"
          x="0"
          y="0"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="1" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-grid)" />
    </svg>
  );
}

export function GuillocheUnderlay() {
  const [location] = useLocation();
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const debugPattern = searchParams.get("debugPattern") === "1";
  const debugFrame = searchParams.get("debugFrame") === "1";
  
  const baseOpacity = debugPattern ? 0.8 : 0.25;
  
  return (
    <div 
      className="absolute inset-0 overflow-hidden pointer-events-none" 
      style={{ 
        zIndex: 0,
        outline: debugFrame ? "4px dashed hsl(var(--primary))" : "none",
        outlineOffset: "-4px",
        backgroundColor: debugFrame ? "hsla(var(--primary) / 0.03)" : "transparent",
      }}
      data-testid="guilloche-underlay-container"
    >
      <svg
        className="absolute inset-0 w-full h-full text-primary"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: baseOpacity }}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id="guilloche-underlay"
            x="0"
            y="0"
            width="120"
            height="120"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0,60 Q30,0 60,60 T120,60"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
            />
            <path
              d="M0,60 Q30,120 60,60 T120,60"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
            />
            <path
              d="M60,0 Q0,30 60,60 T60,120"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.6"
            />
            <path
              d="M60,0 Q120,30 60,60 T60,120"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.6"
            />
            <circle cx="60" cy="60" r="25" fill="none" stroke="currentColor" strokeWidth="0.4" />
            <circle cx="60" cy="60" r="40" fill="none" stroke="currentColor" strokeWidth="0.4" />
            <circle cx="60" cy="60" r="55" fill="none" stroke="currentColor" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#guilloche-underlay)" />
      </svg>
      
      <svg
        className="absolute inset-0 w-full h-full text-muted-foreground"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: baseOpacity * 0.6 }}
      >
        <defs>
          <pattern
            id="dot-underlay"
            x="0"
            y="0"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="0.8" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-underlay)" />
      </svg>
    </div>
  );
}
