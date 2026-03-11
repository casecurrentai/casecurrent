/**
 * Premium animated hero graphics for the Meet Avery page.
 *
 * Two components:
 * 1. AveryIntelligenceEmblem — circular "A" with layered orbital rings & signal arcs
 * 2. AveryAnalysisPanel — live legal-intake intelligence display
 */

/* ────────────────────────────────────────────
   Graphic 1 — Intelligence Emblem
   ──────────────────────────────────────────── */

function SegmentedRing({ radius, segments, gapDeg, strokeWidth, stroke }: {
  radius: number;
  segments: number;
  gapDeg: number;
  strokeWidth: number;
  stroke: string;
}) {
  const circumference = 2 * Math.PI * radius;
  const totalGap = gapDeg * segments;
  const segmentDeg = (360 - totalGap) / segments;
  const segmentLen = (segmentDeg / 360) * circumference;
  const gapLen = (gapDeg / 360) * circumference;

  return (
    <circle
      cx="200"
      cy="200"
      r={radius}
      fill="none"
      strokeWidth={strokeWidth}
      strokeDasharray={`${segmentLen} ${gapLen}`}
      strokeLinecap="round"
      stroke={stroke}
    />
  );
}

export function AveryIntelligenceEmblem() {
  return (
    <div className="relative w-[280px] h-[280px] lg:w-[320px] lg:h-[320px] mx-auto select-none shrink-0" aria-hidden="true">
      {/* Ambient glow layers */}
      <div className="absolute -inset-8 rounded-full bg-gradient-to-br from-blue-500/25 via-indigo-500/15 to-purple-500/20 blur-3xl animate-avery-breathe" />
      <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-primary/20 to-blue-400/15 blur-2xl animate-avery-breathe" style={{ animationDelay: "-2s" }} />

      {/* SVG ring system */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="avery-rg1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="avery-rg2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="avery-rg3" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="avery-arc1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
            <stop offset="30%" stopColor="#6366f1" stopOpacity="0.6" />
            <stop offset="70%" stopColor="#3b82f6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="avery-arc2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
            <stop offset="40%" stopColor="#8b5cf6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="avery-core-glow">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </radialGradient>
          <filter id="avery-glow-sm">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
          <filter id="avery-glow-md">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Core radial glow */}
        <circle cx="200" cy="200" r="100" fill="url(#avery-core-glow)" />

        {/* Outermost ring — slow orbit, 6 segments */}
        <g className="animate-avery-orbit" style={{ transformOrigin: "200px 200px" }}>
          <SegmentedRing radius={180} segments={6} gapDeg={10} strokeWidth={1.2} stroke="url(#avery-rg1)" />
          {/* Orbital node dots */}
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <circle
              key={deg}
              cx={200 + 180 * Math.cos((deg * Math.PI) / 180)}
              cy={200 + 180 * Math.sin((deg * Math.PI) / 180)}
              r="3"
              fill="#6366f1"
              opacity="0.5"
            />
          ))}
        </g>

        {/* Second ring — reverse orbit, fine dashed */}
        <g className="animate-avery-orbit-reverse" style={{ transformOrigin: "200px 200px" }}>
          <circle cx="200" cy="200" r="155" fill="none" strokeWidth={0.8} strokeDasharray="6 14" stroke="#6366f1" opacity="0.25" />
          {/* Two signal nodes */}
          <circle cx={200 + 155} cy="200" r="4" fill="#3b82f6" opacity="0.7" className="animate-avery-dot-pulse" />
          <circle cx="200" cy={200 - 155} r="3.5" fill="#8b5cf6" opacity="0.6" className="animate-avery-dot-pulse" style={{ animationDelay: "-1s" }} />
        </g>

        {/* Third ring — 4 segments, pulsing */}
        <g className="animate-avery-pulse-ring" style={{ transformOrigin: "200px 200px" }}>
          <SegmentedRing radius={132} segments={4} gapDeg={18} strokeWidth={1.8} stroke="url(#avery-rg2)" />
        </g>

        {/* Fourth ring — 8 fine segments, fast sweep */}
        <g className="animate-avery-signal-sweep" style={{ transformOrigin: "200px 200px" }}>
          <SegmentedRing radius={112} segments={8} gapDeg={8} strokeWidth={0.7} stroke="url(#avery-rg3)" />
        </g>

        {/* Sweeping signal arc 1 — orbiting at mid radius */}
        <g className="animate-avery-orbit" style={{ transformOrigin: "200px 200px", animationDuration: "10s" }}>
          <path
            d={describeArc(200, 200, 165, -25, 35)}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            stroke="url(#avery-arc1)"
            filter="url(#avery-glow-sm)"
          />
        </g>

        {/* Sweeping signal arc 2 — reverse at inner radius */}
        <g className="animate-avery-orbit-reverse" style={{ transformOrigin: "200px 200px", animationDuration: "14s" }}>
          <path
            d={describeArc(200, 200, 142, 50, 100)}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            stroke="url(#avery-arc2)"
            filter="url(#avery-glow-sm)"
          />
        </g>

        {/* Third signal arc — small, fast */}
        <g className="animate-avery-orbit" style={{ transformOrigin: "200px 200px", animationDuration: "7s" }}>
          <path
            d={describeArc(200, 200, 122, 160, 195)}
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
            stroke="#6366f1"
            opacity="0.35"
            filter="url(#avery-glow-sm)"
          />
        </g>

        {/* Radial tick marks — precision detail ring */}
        {Array.from({ length: 72 }).map((_, i) => {
          const angle = (i * 5 * Math.PI) / 180;
          const isMajor = i % 6 === 0;
          const inner = isMajor ? 94 : 97;
          const outer = 102;
          return (
            <line
              key={i}
              x1={200 + inner * Math.cos(angle)}
              y1={200 + inner * Math.sin(angle)}
              x2={200 + outer * Math.cos(angle)}
              y2={200 + outer * Math.sin(angle)}
              strokeWidth={isMajor ? 1.2 : 0.5}
              stroke="#6366f1"
              opacity={isMajor ? 0.35 : 0.12}
            />
          );
        })}

        {/* Inner core circle — dynamic blue gradient */}
        <defs>
          <linearGradient id="avery-core-fill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <circle cx="200" cy="200" r="76" fill="url(#avery-core-fill)" stroke="#818cf8" strokeOpacity="0.3" strokeWidth="1" />
        {/* Core breathing ring */}
        <circle
          cx="200" cy="200" r="76"
          fill="none"
          stroke="#6366f1"
          strokeOpacity="0.1"
          strokeWidth="4"
          className="animate-avery-pulse-ring"
          style={{ transformOrigin: "200px 200px" }}
        />
        {/* Inner accent ring */}
        <circle cx="200" cy="200" r="68" fill="none" stroke="#6366f1" strokeOpacity="0.06" strokeWidth="0.5" />
      </svg>

      {/* Central "A" — HTML for crisp rendering */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <span className="text-[3.2rem] lg:text-[3.8rem] font-bold text-white select-none leading-none tracking-tight drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
            A
          </span>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-7 h-[3px] rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
        </div>
      </div>

      {/* Micro-particles */}
      {[
        { x: "12%", y: "18%", delay: "0s", size: 2 },
        { x: "82%", y: "22%", delay: "-1.5s", size: 2.5 },
        { x: "8%", y: "72%", delay: "-3s", size: 1.5 },
        { x: "88%", y: "68%", delay: "-2s", size: 2 },
        { x: "22%", y: "88%", delay: "-4s", size: 2.5 },
        { x: "72%", y: "10%", delay: "-0.5s", size: 1.5 },
        { x: "50%", y: "5%", delay: "-2.5s", size: 2 },
        { x: "92%", y: "48%", delay: "-1s", size: 1.5 },
        { x: "5%", y: "45%", delay: "-3.5s", size: 2 },
        { x: "60%", y: "92%", delay: "-0.8s", size: 1.5 },
      ].map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-indigo-500/50 animate-avery-dot-pulse"
          style={{
            left: p.x,
            top: p.y,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}

/** SVG arc path helper */
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}


/* ────────────────────────────────────────────
   Graphic 2 — Intelligence Analysis Panel
   ──────────────────────────────────────────── */

const intakeRows: {
  label: string;
  value: string;
  confidence: number;
  status: "active" | "complete" | "processing";
  accent: string;
}[] = [
  { label: "Caller Urgency", value: "High — immediate need", confidence: 94, status: "complete", accent: "bg-red-500" },
  { label: "Matter Type", value: "Personal Injury — Auto", confidence: 97, status: "complete", accent: "bg-blue-500" },
  { label: "Lead Quality", value: "A-tier — retainer likely", confidence: 89, status: "complete", accent: "bg-emerald-500" },
  { label: "Sentiment", value: "Distressed, cooperative", confidence: 82, status: "processing", accent: "bg-amber-500" },
  { label: "Intake Status", value: "Qualification complete", confidence: 100, status: "complete", accent: "bg-indigo-500" },
  { label: "Routing", value: "Warm transfer eligible", confidence: 91, status: "active", accent: "bg-purple-500" },
];

function StatusDot({ status }: { status: "active" | "complete" | "processing" }) {
  if (status === "complete") {
    return (
      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
    );
  }
  if (status === "active") {
    return (
      <div className="relative w-2 h-2">
        <div className="absolute inset-0 rounded-full bg-blue-500 animate-avery-dot-pulse" />
        <div className="absolute -inset-1 rounded-full bg-blue-500/30 animate-ping" />
      </div>
    );
  }
  return (
    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
  );
}

export function AveryAnalysisPanel() {
  return (
    <div className="relative w-full max-w-sm mx-auto select-none" aria-hidden="true">
      {/* Ambient glow */}
      <div className="absolute -inset-4 bg-gradient-to-br from-indigo-500/12 via-blue-500/6 to-purple-500/10 rounded-3xl blur-2xl animate-avery-breathe" />

      <div className="relative bg-white/95 dark:bg-card/95 backdrop-blur-md border border-border/40 rounded-2xl shadow-2xl shadow-indigo-500/5 overflow-hidden">
        {/* Top accent gradient line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

        {/* Header bar */}
        <div className="px-5 py-3.5 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <span className="text-white text-[10px] font-bold">A</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground leading-tight">Avery Intake Analysis</p>
              <p className="text-[10px] text-muted-foreground">Live processing</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative w-1.5 h-1.5">
              <div className="absolute inset-0 rounded-full bg-emerald-500" />
              <div className="absolute -inset-0.5 rounded-full bg-emerald-500/40 animate-ping" />
            </div>
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Active</span>
          </div>
        </div>

        {/* Waveform indicator */}
        <div className="px-5 py-2.5 border-b border-border/20 flex items-center gap-3">
          <div className="flex items-center gap-[2px]">
            {Array.from({ length: 28 }).map((_, i) => {
              const baseH = 6 + Math.sin(i * 0.5) * 5 + (i % 3) * 2;
              return (
                <div
                  key={i}
                  className="w-[2px] rounded-full bg-gradient-to-t from-indigo-500/60 to-indigo-400/25 animate-waveform"
                  style={{
                    height: `${baseH}px`,
                    animationDelay: `${i * 0.07}s`,
                    animationDuration: `${0.7 + Math.sin(i * 0.4) * 0.5}s`,
                  }}
                />
              );
            })}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground truncate">Voice signal — analyzing caller input</p>
          </div>
        </div>

        {/* Analysis rows */}
        <div className="relative">
          {/* Scanning highlight */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute left-0 right-0 h-10 bg-gradient-to-b from-indigo-500/[0.04] via-indigo-500/[0.07] to-transparent animate-avery-scan-line" />
          </div>

          <div className="divide-y divide-border/20">
            {intakeRows.map((row, i) => (
              <div
                key={i}
                className="px-5 py-3 flex items-center gap-3 animate-avery-row-reveal relative"
                style={{ animationDelay: `${i * 0.15}s`, animationFillMode: "both" }}
              >
                <StatusDot status={row.status} />

                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground leading-tight">{row.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{row.value}</p>
                </div>

                <div className="w-14 flex flex-col items-end gap-0.5 shrink-0">
                  <span className="text-[9px] font-semibold text-muted-foreground tabular-nums">{row.confidence}%</span>
                  <div className="w-full h-1 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${row.accent} animate-avery-confidence-fill`}
                      style={{
                        "--fill-width": `${row.confidence}%`,
                        animationDelay: `${i * 0.15 + 0.3}s`,
                        animationFillMode: "both",
                      } as React.CSSProperties}
                    />
                  </div>
                </div>

                {/* Row shimmer */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-avery-shimmer"
                    style={{ animationDelay: `${i * 0.6 + 2}s`, animationDuration: "4s", animationIterationCount: "infinite" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer — routing decision */}
        <div className="px-5 py-3 border-t border-border/30 bg-indigo-500/[0.03]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center">
                <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 6h8M7 3l3 3-3 3" />
                </svg>
              </div>
              <span className="text-[10px] font-medium text-foreground">Routing: Priority transfer queue</span>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map((j) => (
                <div
                  key={j}
                  className="w-1 h-1 rounded-full bg-indigo-500/50 animate-avery-dot-pulse"
                  style={{ animationDelay: `${j * 0.3}s` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom accent */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
      </div>
    </div>
  );
}
