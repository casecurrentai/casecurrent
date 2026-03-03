/**
 * AveryHero — cinematic, animated hero for /avery
 *
 * Visual system:
 *  - Intelligence core: SVG orb with concentric pulsing rings, arc segments, scan line
 *  - Particle field: CSS-only drifting dots
 *  - Live Intake module: animated pipeline (progress bars → check → glow sweep)
 *  - Mouse parallax on desktop
 *  - prefers-reduced-motion: static premium fallback (frozen completion state)
 *
 * No external libraries. SVG + CSS keyframes + React state only.
 * All animations defined in tailwind.config.ts keyframes.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { GuillocheUnderlay } from "./guilloche-pattern";
import { Phone, FileText, Brain, CheckCircle, ArrowRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParallaxOffset {
  x: number;
  y: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const INTAKE_STEPS = [
  { icon: Phone,        label: "Call recording",  delay: 0,    duration: 1800, gradient: "from-blue-500 to-indigo-600" },
  { icon: FileText,     label: "Transcript",       delay: 1400, duration: 2000, gradient: "from-indigo-500 to-violet-600" },
  { icon: Brain,        label: "Smart summary",    delay: 3000, duration: 2200, gradient: "from-violet-500 to-purple-600" },
  { icon: CheckCircle,  label: "Lead fields",      delay: 4800, duration: 1600, gradient: "from-emerald-500 to-teal-500" },
] as const;

// Total loop duration: last delay + last duration + 2s rest = ~10400ms
const LOOP_MS = 10800;

// Particle layout — fixed positions so SSR/hydration is deterministic
const PARTICLES = [
  { x: 52, y: 8,  size: 3, dx: 30,  dy: -55, delay: 0,    dur: 5.2 },
  { x: 74, y: 22, size: 2, dx: 50,  dy: -40, delay: 1.1,  dur: 4.8 },
  { x: 38, y: 15, size: 2, dx: -35, dy: -50, delay: 2.3,  dur: 5.5 },
  { x: 62, y: 68, size: 3, dx: 40,  dy: 50,  delay: 0.7,  dur: 4.6 },
  { x: 28, y: 55, size: 2, dx: -45, dy: 35,  delay: 1.9,  dur: 5.0 },
  { x: 80, y: 50, size: 2, dx: 55,  dy: -25, delay: 3.2,  dur: 4.4 },
  { x: 45, y: 80, size: 2, dx: -20, dy: 55,  delay: 2.8,  dur: 5.3 },
  { x: 18, y: 30, size: 3, dx: -50, dy: -30, delay: 0.4,  dur: 6.0 },
] as const;

// ── Sub-components ────────────────────────────────────────────────────────────

/** Central intelligence orb — SVG with rings, arcs, scan line */
function AveryOrb({ reduced }: { reduced: boolean }) {
  const cx = 120;
  const cy = 120;
  const r  = 120;

  return (
    <svg
      viewBox="0 0 240 240"
      className="w-full h-full"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Core radial gradient — soft bloom */}
        <radialGradient id="avery-core" cx="50%" cy="42%" r="55%">
          <stop offset="0%"   stopColor="hsl(239 84% 80%)" stopOpacity="1" />
          <stop offset="40%"  stopColor="hsl(239 84% 67%)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(250 80% 45%)" stopOpacity="0.4" />
        </radialGradient>

        {/* Spotlight behind orb */}
        <radialGradient id="avery-spotlight" cx="50%" cy="50%" r="60%">
          <stop offset="0%"   stopColor="hsl(239 84% 67%)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(239 84% 67%)" stopOpacity="0" />
        </radialGradient>

        {/* Ring gradient */}
        <radialGradient id="ring-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="hsl(239 84% 67%)" stopOpacity="0" />
          <stop offset="80%"  stopColor="hsl(239 84% 67%)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="hsl(239 84% 67%)" stopOpacity="0" />
        </radialGradient>

        {/* Scan line gradient */}
        <linearGradient id="scan-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="hsl(199 90% 65%)" stopOpacity="0" />
          <stop offset="40%"  stopColor="hsl(199 90% 65%)" stopOpacity="0.7" />
          <stop offset="60%"  stopColor="hsl(199 90% 65%)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="hsl(199 90% 65%)" stopOpacity="0" />
        </linearGradient>

        {/* Arc gradient */}
        <linearGradient id="arc-grad-1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="hsl(199 90% 65%)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(239 84% 67%)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="arc-grad-2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="hsl(280 80% 70%)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="hsl(239 84% 67%)" stopOpacity="0" />
        </linearGradient>

        {/* Clip orb contents to circle */}
        <clipPath id="orb-clip">
          <circle cx={cx} cy={cy} r="56" />
        </clipPath>
      </defs>

      {/* ── Spotlight backdrop ── */}
      <circle cx={cx} cy={cy} r={r} fill="url(#avery-spotlight)" />

      {/* ── Pulsing concentric rings ── */}
      {!reduced && [72, 90, 108].map((radius, i) => (
        <circle
          key={radius}
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="hsl(239 84% 67%)"
          strokeWidth="1"
          opacity="0"
          className="animate-ring-expand"
          style={{
            animationDelay: `${i * 1}s`,
            animationDuration: "3s",
          }}
        />
      ))}

      {/* Static halo rings (always visible, reduced or not) */}
      <circle cx={cx} cy={cy} r="72" fill="none" stroke="hsl(239 84% 67% / 0.12)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r="90" fill="none" stroke="hsl(239 84% 67% / 0.07)" strokeWidth="1" />

      {/* ── Outer rotating arc segments ── */}
      {!reduced ? (
        <>
          <g
            style={{ transformOrigin: `${cx}px ${cy}px` }}
            className="animate-arc-spin"
          >
            <path
              d={describeArc(cx, cy, 96, 0, 100)}
              fill="none"
              stroke="url(#arc-grad-1)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
          <g
            style={{ transformOrigin: `${cx}px ${cy}px` }}
            className="animate-arc-spin-reverse"
          >
            <path
              d={describeArc(cx, cy, 104, 180, 290)}
              fill="none"
              stroke="url(#arc-grad-2)"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </g>
        </>
      ) : (
        <>
          <path d={describeArc(cx, cy, 96, 0, 100)}  fill="none" stroke="hsl(199 90% 65% / 0.4)" strokeWidth="1.5" strokeLinecap="round" />
          <path d={describeArc(cx, cy, 104, 180, 290)} fill="none" stroke="hsl(280 80% 70% / 0.3)" strokeWidth="1"   strokeLinecap="round" />
        </>
      )}

      {/* ── Core sphere ── */}
      <circle
        cx={cx} cy={cy} r="56"
        fill="url(#avery-core)"
        className={reduced ? "" : "animate-core-breathe"}
      />

      {/* Core inner highlight */}
      <ellipse cx={cx - 12} cy={cy - 16} rx="18" ry="12"
        fill="hsl(0 0% 100%)" opacity="0.12" />

      {/* ── Abstract 'A' node motif (negative space suggestion) ── */}
      <g clipPath="url(#orb-clip)" opacity="0.25">
        {/* Left leg */}
        <line x1={cx - 18} y1={cy + 20} x2={cx}     y2={cy - 20}
          stroke="hsl(0 0% 100%)" strokeWidth="2" strokeLinecap="round" />
        {/* Right leg */}
        <line x1={cx}      y1={cy - 20} x2={cx + 18} y2={cy + 20}
          stroke="hsl(0 0% 100%)" strokeWidth="2" strokeLinecap="round" />
        {/* Crossbar */}
        <line x1={cx - 9} y1={cy + 2}  x2={cx + 9}  y2={cy + 2}
          stroke="hsl(0 0% 100%)" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* ── Scan line ── */}
      {!reduced && (
        <g clipPath="url(#orb-clip)">
          <rect
            x={cx - 56} y={cy - 56}
            width="112" height="3"
            fill="url(#scan-grad)"
            className="animate-scan-line"
          />
        </g>
      )}

      {/* ── Node graph dots around orb ── */}
      {[
        { angle: 30,  r: 68, size: 3 },
        { angle: 130, r: 72, size: 2 },
        { angle: 210, r: 66, size: 3 },
        { angle: 310, r: 70, size: 2 },
      ].map(({ angle, r: nr, size }) => {
        const rad = (angle * Math.PI) / 180;
        const nx = cx + nr * Math.cos(rad);
        const ny = cy + nr * Math.sin(rad);
        return (
          <circle
            key={angle}
            cx={nx} cy={ny} r={size}
            fill="hsl(239 84% 80%)"
            opacity="0.6"
          />
        );
      })}

      {/* Connector lines from nodes to core edge */}
      {[30, 130, 210, 310].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            x1={cx + 56 * Math.cos(rad)} y1={cy + 56 * Math.sin(rad)}
            x2={cx + 66 * Math.cos(rad)} y2={cy + 66 * Math.sin(rad)}
            stroke="hsl(239 84% 67%)" strokeWidth="0.8" opacity="0.35"
          />
        );
      })}
    </svg>
  );
}

/** Animated Live Intake pipeline module */
function LiveIntakeModule({ reduced }: { reduced: boolean }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setTick((t) => (t + 1) % LOOP_MS);
    }, 100);
    return () => clearInterval(id);
  }, [reduced]);

  // Elapsed ms within current loop
  const elapsed = useRef(0);
  useEffect(() => {
    if (reduced) return;
    elapsed.current = (Date.now() % LOOP_MS);
  });

  // Simpler: use a CSS-driven approach. We'll use a key to restart the animation loop.
  const [loopKey, setLoopKey] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setLoopKey((k) => k + 1), LOOP_MS);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-white/10 bg-background/90 backdrop-blur-sm shadow-2xl"
      style={{ boxShadow: "0 0 0 1px hsl(239 84% 67% / 0.15), 0 24px 64px hsl(239 84% 67% / 0.12), 0 4px 16px rgba(0,0,0,0.2)" }}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/30">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <span className="ml-2 text-xs font-medium text-muted-foreground">Avery · New Intake</span>
        {!reduced && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        )}
      </div>

      {/* Pipeline rows */}
      <div className="p-4 space-y-3">
        {INTAKE_STEPS.map((step, i) => (
          <IntakeRow
            key={`${loopKey}-${i}`}
            step={step}
            reduced={reduced}
          />
        ))}

        {/* Completion banner */}
        <CompletionBanner loopKey={loopKey} reduced={reduced} />
      </div>
    </div>
  );
}

/** Single pipeline row with animated progress bar */
function IntakeRow({
  step,
  reduced,
}: {
  step: typeof INTAKE_STEPS[number];
  reduced: boolean;
}) {
  const Icon = step.icon;
  const [phase, setPhase] = useState<"waiting" | "filling" | "done">(
    reduced ? "done" : "waiting"
  );

  useEffect(() => {
    if (reduced) { setPhase("done"); return; }
    setPhase("waiting");
    const t1 = setTimeout(() => setPhase("filling"), step.delay);
    const t2 = setTimeout(() => setPhase("done"), step.delay + step.duration + 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [step.delay, step.duration, reduced]);

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-500 ${
        phase === "done"
          ? "bg-gradient-to-r from-muted/60 to-muted/30 border-border/40"
          : phase === "filling"
          ? "bg-gradient-to-r from-primary/5 to-muted/20 border-primary/20"
          : "bg-muted/20 border-border/20"
      }`}
    >
      {/* Icon badge */}
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-md flex-shrink-0`}>
        <Icon className="w-4 h-4 text-white" />
      </div>

      {/* Label + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-xs font-medium transition-colors duration-300 ${
            phase === "done" ? "text-foreground" : "text-muted-foreground"
          }`}>
            {step.label}
          </span>
          {phase === "done" && (
            <CheckCircle
              className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 animate-check-pop"
              style={{ animationFillMode: "both" }}
            />
          )}
        </div>

        {/* Progress track */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          {phase === "filling" && (
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400 animate-bar-fill"
              style={{
                animationDuration: `${step.duration}ms`,
                animationFillMode: "forwards",
              }}
            />
          )}
          {phase === "done" && (
            <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500/70 to-emerald-400/50" />
          )}
          {/* Row complete glow sweep */}
          {phase === "done" && !reduced && (
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent"
              style={{
                animation: "row-complete 0.4s cubic-bezier(0.2,0,0,1) both",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Intake complete banner — fades in after all steps done */
function CompletionBanner({ loopKey, reduced }: { loopKey: number; reduced: boolean }) {
  const [visible, setVisible] = useState(reduced);

  useEffect(() => {
    if (reduced) { setVisible(true); return; }
    setVisible(false);
    // Last step finishes at delay 4800 + duration 1600 + 200 = 6600ms
    const t = setTimeout(() => setVisible(true), 6800);
    return () => clearTimeout(t);
  }, [loopKey, reduced]);

  if (!visible) return <div className="h-10" />;

  return (
    <div
      className="mt-1 p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-blue-500/8 border border-emerald-500/20"
      style={{ animation: reduced ? undefined : "intake-complete 0.5s cubic-bezier(0.2,0,0,1) both" }}
    >
      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        Intake complete · Lead created
      </p>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const s = polarToCartesian(cx, cy, r, startAngle);
  const e = polarToCartesian(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function AveryHero() {
  const [reduced, setReduced] = useState(false);
  const [parallax, setParallax] = useState<ParallaxOffset>({ x: 0, y: 0 });
  const heroRef = useRef<HTMLElement>(null);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Mouse parallax
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (reduced || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width  - 0.5; // -0.5 to 0.5
    const ny = (e.clientY - rect.top)  / rect.height - 0.5;
    setParallax({ x: nx * 18, y: ny * 10 });
  }, [reduced]);

  const handleMouseLeave = useCallback(() => {
    setParallax({ x: 0, y: 0 });
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden py-20 lg:py-28"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Background layers ── */}
      <GuillocheUnderlay />

      {/* Soft spotlight vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 60% at 65% 50%, hsl(239 84% 67% / 0.08) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Ambient glow blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -left-32 w-[40rem] h-[40rem] rounded-full bg-gradient-to-br from-primary/15 via-primary/5 to-transparent blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[30rem] h-[30rem] rounded-full bg-gradient-to-tl from-blue-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute top-1/3 right-1/3 w-64 h-64 rounded-full bg-gradient-to-b from-violet-500/8 to-transparent blur-3xl" />
      </div>

      {/* ── Content ── */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* ── Left: copy + CTAs ── */}
          <div className="space-y-6">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-xs font-semibold text-primary uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Voice Intelligence
            </div>

            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight text-foreground leading-tight">
              Avery,{" "}
              <span className="bg-gradient-to-r from-primary via-blue-500 to-violet-500 bg-clip-text text-transparent">
                in real time.
              </span>
            </h1>

            <p className="text-lg lg:text-xl text-muted-foreground max-w-xl leading-relaxed">
              Answers missed and after-hours calls, qualifies the case, and delivers a
              structured intake record{" "}
              <span className="text-foreground font-medium">the moment the call ends.</span>
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/demo">
                <Button size="lg" data-testid="button-hero-primary-cta" className="gap-2">
                  Talk to Avery
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#what-your-team-receives">
                <Button size="lg" variant="outline" data-testid="button-hero-secondary-cta">
                  See what gets captured
                </Button>
              </a>
            </div>

            {/* Micro-trust line */}
            <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5 flex-wrap">
              <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block" />
              Recording
              <span className="text-border">·</span>
              Transcript
              <span className="text-border">·</span>
              Smart summary
              <span className="text-border">·</span>
              Lead fields
              <span className="text-border">·</span>
              <span className="font-medium text-foreground/70">captured automatically.</span>
            </p>
          </div>

          {/* ── Right: Entity + Live Intake ── */}
          <div
            className="relative flex flex-col items-center gap-6"
            style={{
              transform: reduced ? undefined : `translate(${parallax.x * 0.5}px, ${parallax.y * 0.5}px)`,
              transition: "transform 0.1s cubic-bezier(0.2,0,0,1)",
            }}
          >
            {/* Particle field */}
            {!reduced && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
                {PARTICLES.map((p, i) => (
                  <div
                    key={i}
                    className="absolute rounded-full bg-primary animate-particle-drift"
                    style={{
                      left: `${p.x}%`,
                      top:  `${p.y}%`,
                      width:  p.size,
                      height: p.size,
                      animationDelay:    `${p.delay}s`,
                      animationDuration: `${p.dur}s`,
                      animationIterationCount: "infinite",
                      // CSS custom properties for randomized drift direction
                      ["--dx" as string]: `${p.dx}px`,
                      ["--dy" as string]: `${p.dy}px`,
                      opacity: 0,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Intelligence core orb */}
            <div
              className="relative w-52 h-52 sm:w-60 sm:h-60"
              style={{
                transform: reduced ? undefined : `translate(${parallax.x * 0.3}px, ${parallax.y * 0.3}px)`,
                transition: "transform 0.15s cubic-bezier(0.2,0,0,1)",
                filter: "drop-shadow(0 0 32px hsl(239 84% 67% / 0.35))",
              }}
            >
              <AveryOrb reduced={reduced} />
            </div>

            {/* Live Intake module */}
            <div
              className="w-full max-w-sm"
              data-testid="graphic-avery-card-stack"
              style={{
                transform: reduced ? undefined : `translate(${-parallax.x * 0.2}px, ${-parallax.y * 0.2}px)`,
                transition: "transform 0.12s cubic-bezier(0.2,0,0,1)",
              }}
            >
              <LiveIntakeModule reduced={reduced} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
