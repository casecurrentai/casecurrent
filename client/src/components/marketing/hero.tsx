import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { GuillocheUnderlay } from "./guilloche-pattern";
import { HeroGlow } from "./decorative-visuals";
import { ArrowRight, Mic, Phone } from "lucide-react";

interface HeroProps {
  headline: string;
  subheadline: string;
  primaryCta?: {
    label: string;
    href: string;
  };
  secondaryCta?: {
    label: string;
    href: string;
  };
  children?: React.ReactNode;
  className?: string;
}

function HeroActions({ primaryCta, secondaryCta }: Pick<HeroProps, "primaryCta" | "secondaryCta">) {
  if (!primaryCta && !secondaryCta) return null;

  return (
    <div className="flex flex-col gap-5 pt-6" data-testid="hero-actions">
      <div className="flex items-center gap-5">
        <Link href={primaryCta?.href || "/demo"}>
          <button
            className={cn(
              "group relative flex items-center gap-3 rounded-full",
              "bg-gradient-to-r from-primary via-blue-600 to-cyan-500",
              "pl-1.5 pr-6 py-1.5",
              "text-white font-semibold text-sm",
              "shadow-lg shadow-primary/25",
              "hover:shadow-xl hover:shadow-primary/35 hover:scale-[1.02]",
              "active:scale-[0.98]",
              "transition-all duration-300 ease-out",
            )}
            data-testid="button-hero-primary-cta"
          >
            <span className={cn(
              "relative flex items-center justify-center",
              "w-10 h-10 rounded-full",
              "bg-white/20 backdrop-blur-sm",
              "ring-1 ring-white/30",
            )}>
              <span className="absolute inset-0 rounded-full bg-white/10 animate-ping [animation-duration:2s]" />
              <Phone className="w-4 h-4 text-white relative z-10" />
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[13px] tracking-wide">{primaryCta?.label || "Book a Demo"}</span>
              <span className="text-[10px] text-white/70 font-normal">Free consultation</span>
            </span>
            <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" />
          </button>
        </Link>

        <span className="text-muted-foreground/40 text-sm font-light select-none">or</span>

        <button
          onClick={() => {
            const widget = document.querySelector("elevenlabs-convai") as any;
            if (widget?.show) widget.show();
          }}
          className={cn(
            "group relative flex items-center gap-2.5",
            "rounded-full px-5 py-2.5",
            "border border-primary/20 bg-primary/5",
            "text-sm font-medium text-primary",
            "hover:bg-primary/10 hover:border-primary/30 hover:shadow-md hover:shadow-primary/10",
            "active:scale-[0.97]",
            "transition-all duration-300",
          )}
          data-testid="button-hero-talk-avery"
        >
          <span className="relative flex items-center justify-center w-6 h-6">
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-pulse" />
            <Mic className="w-3.5 h-3.5 relative z-10" />
          </span>
          Talk to Avery
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground/60">
        <span className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
          AI answers in seconds
        </span>
        <span className="w-px h-3 bg-border" />
        <span>No credit card needed</span>
        <span className="w-px h-3 bg-border" />
        <span>24/7 availability</span>
      </div>
    </div>
  );
}

export function Hero({
  headline,
  subheadline,
  primaryCta,
  secondaryCta,
  children,
  className,
}: HeroProps) {
  return (
    <section className={cn("relative overflow-hidden py-20 lg:py-28", className)}>
      <GuillocheUnderlay />
      <HeroGlow />
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight text-foreground leading-tight">
              {headline}
            </h1>
            <p className="text-lg lg:text-xl text-muted-foreground max-w-xl leading-relaxed">
              {subheadline}
            </p>
            <HeroActions primaryCta={primaryCta} secondaryCta={secondaryCta} />
          </div>
          {children && <div className="relative">{children}</div>}
        </div>
      </div>
    </section>
  );
}
