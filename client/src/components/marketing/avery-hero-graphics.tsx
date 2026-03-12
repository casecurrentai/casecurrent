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

        {/* Sparkling gem orb — purple/violet with shimmer */}
        <defs>
          <clipPath id="avery-orb-clip">
            <circle cx="200" cy="200" r="75" />
          </clipPath>
          <filter id="avery-blob-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="17" />
          </filter>
          <filter id="avery-sparkle-glow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="avery-a-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id="avery-orb-sheen" cx="34%" cy="24%" r="52%">
            <stop offset="0%" stopColor="white" stopOpacity="0.38" />
            <stop offset="55%" stopColor="white" stopOpacity="0.06" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="avery-orb-depth" cx="55%" cy="88%" r="50%">
            <stop offset="0%" stopColor="#1a0535" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#1a0535" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Deep purple base */}
        <circle cx="200" cy="200" r="75" fill="#0e0520" />

        {/* Drifting colour blobs — vivid purple/violet/cyan */}
        <g clipPath="url(#avery-orb-clip)" filter="url(#avery-blob-blur)">
          <circle r="64" fill="#7c3aed" opacity="0.95">
            <animate attributeName="cx" values="185;225;190;160;210;185" dur="9s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" />
            <animate attributeName="cy" values="205;180;235;200;170;205" dur="9s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" />
          </circle>
          <circle r="50" fill="#a855f7" opacity="0.9">
            <animate attributeName="cx" values="220;168;238;200;172;220" dur="7s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" />
            <animate attributeName="cy" values="178;222;195;238;195;178" dur="7s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" />
          </circle>
          <circle r="40" fill="#4f46e5" opacity="0.8">
            <animate attributeName="cx" values="195;238;178;215;162;195" dur="5.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" />
            <animate attributeName="cy" values="195;212;174;205;228;195" dur="5.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" />
          </circle>
          <circle r="28" fill="#22d3ee" opacity="0.65">
            <animate attributeName="cx" values="190;218;168;228;200;190" dur="6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" />
            <animate attributeName="cy" values="218;172;212;188;242;218" dur="6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" />
          </circle>
        </g>

        {/* Sparkle particles — white */}
        <g clipPath="url(#avery-orb-clip)" filter="url(#avery-sparkle-glow)">
          <circle cx="168" cy="183" r="1.5" fill="white"><animate attributeName="opacity" values="0;1;0.2;1;0" dur="2.1s" begin="0s" repeatCount="indefinite"/></circle>
          <circle cx="225" cy="175" r="1.2" fill="white"><animate attributeName="opacity" values="0;1;0.3;0" dur="1.8s" begin="-0.4s" repeatCount="indefinite"/></circle>
          <circle cx="240" cy="200" r="1.8" fill="white"><animate attributeName="opacity" values="0;0.9;0;1;0" dur="2.5s" begin="-1.2s" repeatCount="indefinite"/></circle>
          <circle cx="230" cy="222" r="1.3" fill="white"><animate attributeName="opacity" values="0;1;0.1;0" dur="1.6s" begin="-0.7s" repeatCount="indefinite"/></circle>
          <circle cx="215" cy="240" r="1.5" fill="white"><animate attributeName="opacity" values="0;0.8;0.2;1;0" dur="2.2s" begin="-1.8s" repeatCount="indefinite"/></circle>
          <circle cx="183" cy="243" r="1.0" fill="white"><animate attributeName="opacity" values="0;1;0;0.6;0" dur="1.9s" begin="-0.3s" repeatCount="indefinite"/></circle>
          <circle cx="163" cy="230" r="1.6" fill="white"><animate attributeName="opacity" values="0;0.9;0.3;0" dur="2.4s" begin="-1.5s" repeatCount="indefinite"/></circle>
          <circle cx="158" cy="207" r="1.2" fill="white"><animate attributeName="opacity" values="0;1;0.2;1;0" dur="1.7s" begin="-0.9s" repeatCount="indefinite"/></circle>
          <circle cx="175" cy="163" r="1.4" fill="white"><animate attributeName="opacity" values="0;0.8;0;1;0" dur="2.0s" begin="-2.1s" repeatCount="indefinite"/></circle>
          <circle cx="200" cy="158" r="1.8" fill="white"><animate attributeName="opacity" values="0;1;0.4;0" dur="1.5s" begin="-0.6s" repeatCount="indefinite"/></circle>
          <circle cx="220" cy="163" r="1.0" fill="white"><animate attributeName="opacity" values="0;0.9;0.1;1;0" dur="2.3s" begin="-1.0s" repeatCount="indefinite"/></circle>
          <circle cx="238" cy="183" r="1.3" fill="white"><animate attributeName="opacity" values="0;1;0.3;0" dur="1.8s" begin="-1.4s" repeatCount="indefinite"/></circle>
          <circle cx="172" cy="218" r="1.5" fill="white"><animate attributeName="opacity" values="0;0.8;0.2;1;0" dur="2.1s" begin="-0.2s" repeatCount="indefinite"/></circle>
          <circle cx="245" cy="195" r="1.4" fill="white"><animate attributeName="opacity" values="0;1;0;0.7;0" dur="2.0s" begin="-1.1s" repeatCount="indefinite"/></circle>
          <circle cx="160" cy="193" r="1.0" fill="white"><animate attributeName="opacity" values="0;0.9;0.3;0" dur="1.7s" begin="-0.5s" repeatCount="indefinite"/></circle>
          <circle cx="178" cy="243" r="1.3" fill="white"><animate attributeName="opacity" values="0;1;0.1;1;0" dur="2.2s" begin="-1.9s" repeatCount="indefinite"/></circle>
          <circle cx="222" cy="245" r="1.5" fill="white"><animate attributeName="opacity" values="0;0.8;0;1;0" dur="1.5s" begin="-0.4s" repeatCount="indefinite"/></circle>
          <circle cx="250" cy="210" r="1.1" fill="white"><animate attributeName="opacity" values="0;1;0.2;0" dur="2.3s" begin="-2.2s" repeatCount="indefinite"/></circle>
          {/* Cyan sparkles */}
          <circle cx="195" cy="166" r="1.6" fill="#67e8f9"><animate attributeName="opacity" values="0;1;0.2;1;0" dur="2.3s" begin="-1.3s" repeatCount="indefinite"/></circle>
          <circle cx="237" cy="190" r="1.2" fill="#67e8f9"><animate attributeName="opacity" values="0;0.9;0;0.8;0" dur="1.9s" begin="-0.6s" repeatCount="indefinite"/></circle>
          <circle cx="228" cy="237" r="1.4" fill="#67e8f9"><animate attributeName="opacity" values="0;1;0.3;0" dur="2.1s" begin="-2.0s" repeatCount="indefinite"/></circle>
          <circle cx="165" cy="222" r="1.3" fill="#67e8f9"><animate attributeName="opacity" values="0;0.8;0.1;1;0" dur="1.7s" begin="-1.1s" repeatCount="indefinite"/></circle>
          <circle cx="186" cy="249" r="1.1" fill="#67e8f9"><animate attributeName="opacity" values="0;1;0;0.6;0" dur="2.4s" begin="-0.3s" repeatCount="indefinite"/></circle>
        </g>

        {/* Bright lens-flare specular highlight — top-left */}
        <circle cx="177" cy="172" r="20" fill="white" opacity="0.10" clipPath="url(#avery-orb-clip)" />
        <circle cx="179" cy="174" r="9" fill="white" opacity="0.20" clipPath="url(#avery-orb-clip)" />
        <circle cx="181" cy="176" r="3.5" fill="white" opacity="0.50" clipPath="url(#avery-orb-clip)" />

        {/* Glassy sheen */}
        <circle cx="200" cy="200" r="75" fill="url(#avery-orb-sheen)" />
        {/* Depth shadow at bottom */}
        <circle cx="200" cy="200" r="75" fill="url(#avery-orb-depth)" />
        {/* Border ring */}
        <circle cx="200" cy="200" r="75" fill="none" stroke="#c4b5fd" strokeOpacity="0.3" strokeWidth="1" />
        {/* Core breathing ring */}
        <circle
          cx="200" cy="200" r="75"
          fill="none"
          stroke="#8b5cf6"
          strokeOpacity="0.14"
          strokeWidth="3"
          className="animate-avery-pulse-ring"
          style={{ transformOrigin: "200px 200px" }}
        />
        {/* Inner accent ring */}
        <circle cx="200" cy="200" r="67" fill="none" stroke="#a78bfa" strokeOpacity="0.09" strokeWidth="0.5" />

        {/* Geometric "A" logo mark — two legs + crossbar + inner triangle hollow */}
        <g filter="url(#avery-a-glow)" clipPath="url(#avery-orb-clip)">
          <path
            d="M 200 166 L 226 234 L 214 234 L 211 219 L 189 219 L 186 234 L 174 234 Z M 200 175 L 208 207 L 192 207 Z"
            fill="white"
            fillRule="evenodd"
            opacity="0.96"
          />
        </g>
      </svg>

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
