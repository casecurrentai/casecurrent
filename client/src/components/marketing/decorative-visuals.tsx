import { cn } from "@/lib/utils";

interface GradientOrbProps {
  className?: string;
  color?: "primary" | "blue" | "emerald" | "purple" | "amber";
  size?: "sm" | "md" | "lg" | "xl";
  animate?: boolean;
}

const orbColors = {
  primary: "from-primary/20 to-primary/5",
  blue: "from-blue-500/20 to-blue-400/5",
  emerald: "from-emerald-500/20 to-emerald-400/5",
  purple: "from-purple-500/20 to-purple-400/5",
  amber: "from-amber-500/20 to-amber-400/5",
};

const orbSizes = {
  sm: "w-32 h-32",
  md: "w-64 h-64",
  lg: "w-96 h-96",
  xl: "w-[32rem] h-[32rem]",
};

export function GradientOrb({ className, color = "primary", size = "lg", animate = true }: GradientOrbProps) {
  return (
    <div
      className={cn(
        "absolute rounded-full bg-gradient-radial blur-3xl pointer-events-none",
        `bg-gradient-to-br ${orbColors[color]}`,
        orbSizes[size],
        animate && "animate-float-slow",
        className
      )}
      aria-hidden="true"
    />
  );
}

interface GlowLineProps {
  className?: string;
  direction?: "horizontal" | "vertical";
  color?: "primary" | "blue" | "emerald";
}

export function GlowLine({ className, direction = "horizontal", color = "primary" }: GlowLineProps) {
  const colorMap = {
    primary: "from-transparent via-primary/40 to-transparent",
    blue: "from-transparent via-blue-500/40 to-transparent",
    emerald: "from-transparent via-emerald-500/40 to-transparent",
  };

  return (
    <div
      className={cn(
        "pointer-events-none",
        direction === "horizontal" ? "h-px w-full bg-gradient-to-r" : "w-px h-full bg-gradient-to-b",
        colorMap[color],
        className
      )}
      aria-hidden="true"
    />
  );
}

interface FloatingShapeProps {
  className?: string;
  variant?: "diamond" | "circle" | "ring" | "cross" | "dot";
  color?: "primary" | "muted" | "blue" | "emerald";
  size?: number;
}

export function FloatingShape({ className, variant = "diamond", color = "primary", size = 12 }: FloatingShapeProps) {
  const colorMap = {
    primary: "border-primary/30 bg-primary/10",
    muted: "border-muted-foreground/20 bg-muted-foreground/5",
    blue: "border-blue-500/30 bg-blue-500/10",
    emerald: "border-emerald-500/30 bg-emerald-500/10",
  };

  const solidColorMap = {
    primary: "bg-primary/20",
    muted: "bg-muted-foreground/15",
    blue: "bg-blue-500/20",
    emerald: "bg-emerald-500/20",
  };

  if (variant === "diamond") {
    return (
      <div
        className={cn("absolute pointer-events-none rotate-45 border", colorMap[color], className)}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  if (variant === "ring") {
    return (
      <div
        className={cn("absolute pointer-events-none rounded-full border-2", colorMap[color].split(" ")[0], "bg-transparent", className)}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  if (variant === "cross") {
    return (
      <div className={cn("absolute pointer-events-none", className)} style={{ width: size, height: size }} aria-hidden="true">
        <div className={cn("absolute top-1/2 left-0 right-0 h-px", solidColorMap[color])} />
        <div className={cn("absolute left-1/2 top-0 bottom-0 w-px", solidColorMap[color])} />
      </div>
    );
  }

  if (variant === "dot") {
    return (
      <div
        className={cn("absolute pointer-events-none rounded-full", solidColorMap[color], className)}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={cn("absolute pointer-events-none rounded-full border", colorMap[color], className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  from?: string;
  to?: string;
}

export function GradientText({ children, className, from = "from-primary", to = "to-blue-500" }: GradientTextProps) {
  return (
    <span className={cn("bg-gradient-to-r bg-clip-text text-transparent", from, to, className)}>
      {children}
    </span>
  );
}

interface PulseBeaconProps {
  className?: string;
  color?: "primary" | "emerald" | "amber" | "blue";
  size?: "sm" | "md";
}

export function PulseBeacon({ className, color = "primary", size = "sm" }: PulseBeaconProps) {
  const colorMap = {
    primary: "bg-primary",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    blue: "bg-blue-500",
  };

  const ringColorMap = {
    primary: "bg-primary/30",
    emerald: "bg-emerald-500/30",
    amber: "bg-amber-500/30",
    blue: "bg-blue-500/30",
  };

  const sizeMap = {
    sm: { dot: "w-2 h-2", ring: "w-4 h-4" },
    md: { dot: "w-3 h-3", ring: "w-6 h-6" },
  };

  return (
    <div className={cn("relative flex items-center justify-center", className)} aria-hidden="true">
      <div className={cn("absolute rounded-full animate-ping", ringColorMap[color], sizeMap[size].ring)} />
      <div className={cn("rounded-full", colorMap[color], sizeMap[size].dot)} />
    </div>
  );
}

interface AnimatedGridProps {
  className?: string;
  cellSize?: number;
  color?: "primary" | "muted";
}

export function AnimatedGrid({ className, cellSize = 40, color = "muted" }: AnimatedGridProps) {
  const strokeColor = color === "primary" ? "hsl(var(--primary) / 0.06)" : "hsl(var(--muted-foreground) / 0.06)";

  return (
    <svg
      className={cn("absolute inset-0 w-full h-full pointer-events-none", className)}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern id="animated-grid" x="0" y="0" width={cellSize} height={cellSize} patternUnits="userSpaceOnUse">
          <rect width={cellSize} height={cellSize} fill="none" stroke={strokeColor} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#animated-grid)" />
    </svg>
  );
}

interface MeshGradientBgProps {
  className?: string;
  variant?: "blue-purple" | "emerald-blue" | "warm" | "cool" | "primary";
}

export function MeshGradientBg({ className, variant = "blue-purple" }: MeshGradientBgProps) {
  const gradients: Record<string, string[]> = {
    "blue-purple": [
      "from-blue-500/8 via-transparent to-transparent",
      "from-purple-500/8 via-transparent to-transparent",
      "from-primary/6 via-transparent to-transparent",
    ],
    "emerald-blue": [
      "from-emerald-500/8 via-transparent to-transparent",
      "from-blue-500/6 via-transparent to-transparent",
      "from-primary/5 via-transparent to-transparent",
    ],
    warm: [
      "from-amber-500/8 via-transparent to-transparent",
      "from-orange-500/6 via-transparent to-transparent",
      "from-primary/5 via-transparent to-transparent",
    ],
    cool: [
      "from-blue-500/8 via-transparent to-transparent",
      "from-cyan-500/6 via-transparent to-transparent",
      "from-primary/5 via-transparent to-transparent",
    ],
    primary: [
      "from-primary/10 via-transparent to-transparent",
      "from-primary/6 via-transparent to-transparent",
      "from-blue-500/5 via-transparent to-transparent",
    ],
  };

  const layers = gradients[variant] || gradients["blue-purple"];

  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)} aria-hidden="true">
      <div className={cn("absolute -top-1/4 -left-1/4 w-3/4 h-3/4 rounded-full bg-gradient-to-br blur-3xl", layers[0])} />
      <div className={cn("absolute -bottom-1/4 -right-1/4 w-3/4 h-3/4 rounded-full bg-gradient-to-tl blur-3xl", layers[1])} />
      <div className={cn("absolute top-1/3 left-1/2 -translate-x-1/2 w-1/2 h-1/2 rounded-full bg-gradient-to-b blur-3xl", layers[2])} />
    </div>
  );
}

interface DecorativeScatterProps {
  className?: string;
  density?: "sparse" | "normal" | "dense";
}

export function DecorativeScatter({ className, density = "normal" }: DecorativeScatterProps) {
  const sparseShapes = [
    { variant: "diamond" as const, x: "10%", y: "15%", size: 10, color: "primary" as const, delay: "0s" },
    { variant: "ring" as const, x: "85%", y: "25%", size: 16, color: "blue" as const, delay: "1s" },
    { variant: "dot" as const, x: "75%", y: "75%", size: 6, color: "primary" as const, delay: "2s" },
    { variant: "cross" as const, x: "20%", y: "80%", size: 14, color: "muted" as const, delay: "3s" },
  ];

  const normalShapes = [
    ...sparseShapes,
    { variant: "diamond" as const, x: "60%", y: "10%", size: 8, color: "muted" as const, delay: "1.5s" },
    { variant: "ring" as const, x: "30%", y: "50%", size: 12, color: "primary" as const, delay: "2.5s" },
    { variant: "dot" as const, x: "90%", y: "55%", size: 5, color: "blue" as const, delay: "0.5s" },
    { variant: "cross" as const, x: "50%", y: "90%", size: 10, color: "muted" as const, delay: "3.5s" },
  ];

  const denseShapes = [
    ...normalShapes,
    { variant: "diamond" as const, x: "45%", y: "20%", size: 6, color: "emerald" as const, delay: "4s" },
    { variant: "ring" as const, x: "15%", y: "45%", size: 10, color: "muted" as const, delay: "1.2s" },
    { variant: "dot" as const, x: "70%", y: "40%", size: 4, color: "primary" as const, delay: "2.8s" },
    { variant: "cross" as const, x: "5%", y: "65%", size: 8, color: "blue" as const, delay: "0.8s" },
  ];

  const shapes = density === "sparse" ? sparseShapes : density === "dense" ? denseShapes : normalShapes;

  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)} aria-hidden="true">
      {shapes.map((shape, i) => (
        <div
          key={i}
          className="absolute animate-float-slow"
          style={{ left: shape.x, top: shape.y, animationDelay: shape.delay }}
        >
          <FloatingShape
            variant={shape.variant}
            color={shape.color}
            size={shape.size}
          />
        </div>
      ))}
    </div>
  );
}

export function SectionGlow({ className, position = "center" }: { className?: string; position?: "left" | "center" | "right" }) {
  const posMap = {
    left: "-left-20 top-1/2 -translate-y-1/2",
    center: "left-1/2 -translate-x-1/2 top-0",
    right: "-right-20 top-1/2 -translate-y-1/2",
  };

  return (
    <div
      className={cn(
        "absolute w-96 h-96 rounded-full bg-primary/5 blur-3xl pointer-events-none",
        posMap[position],
        className
      )}
      aria-hidden="true"
    />
  );
}

export function HeroGlow({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)} aria-hidden="true">
      <div className="absolute -top-32 -left-32 w-[40rem] h-[40rem] rounded-full bg-gradient-to-br from-primary/15 via-primary/5 to-transparent blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-[30rem] h-[30rem] rounded-full bg-gradient-to-tl from-blue-500/10 via-transparent to-transparent blur-3xl" />
      <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full bg-gradient-to-b from-purple-500/8 to-transparent blur-3xl" />
    </div>
  );
}

export function StatNumber({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <div className={cn("text-center", className)}>
      <div className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
        {value}
      </div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export function GlowCard({ children, className, glowColor = "primary" }: { children: React.ReactNode; className?: string; glowColor?: "primary" | "emerald" | "blue" }) {
  const glowMap = {
    primary: "shadow-primary/5 hover:shadow-primary/10",
    emerald: "shadow-emerald-500/5 hover:shadow-emerald-500/10",
    blue: "shadow-blue-500/5 hover:shadow-blue-500/10",
  };

  return (
    <div className={cn("relative rounded-lg shadow-lg transition-shadow duration-300", glowMap[glowColor], className)}>
      {children}
    </div>
  );
}

export function AnimatedWaveform({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-0.5", className)} aria-hidden="true">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-primary/40 rounded-full animate-waveform"
          style={{
            height: `${Math.sin(i * 0.5) * 12 + 16}px`,
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
}
