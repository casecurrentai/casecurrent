import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { GuillochePattern } from "./guilloche-pattern";

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
      <GuillochePattern />
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight text-foreground leading-tight">
              {headline}
            </h1>
            <p className="text-lg lg:text-xl text-muted-foreground max-w-xl leading-relaxed">
              {subheadline}
            </p>
            {(primaryCta || secondaryCta) && (
              <div className="flex flex-wrap gap-4 pt-4">
                {primaryCta && (
                  <Link href={primaryCta.href}>
                    <Button size="lg" data-testid="button-hero-primary-cta">
                      {primaryCta.label}
                    </Button>
                  </Link>
                )}
                {secondaryCta && (
                  <Link href={secondaryCta.href}>
                    <Button size="lg" variant="outline" data-testid="button-hero-secondary-cta">
                      {secondaryCta.label}
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
          {children && <div className="relative">{children}</div>}
        </div>
      </div>
    </section>
  );
}
