import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Link } from "wouter";

interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  ctaLabel?: string;
  ctaHref?: string;
  highlighted?: boolean;
  className?: string;
}

export function PricingCard({
  name,
  price,
  period = "/month",
  description,
  features,
  ctaLabel = "Get Started",
  ctaHref = "/contact",
  highlighted = false,
  className,
}: PricingCardProps) {
  return (
    <div className="relative">
      {highlighted && (
        <div className="absolute -inset-px rounded-lg bg-gradient-to-b from-primary/20 via-primary/5 to-transparent pointer-events-none" aria-hidden="true" />
      )}
      <Card className={cn(
        "h-full relative hover-elevate",
        highlighted && "border-primary shadow-lg shadow-primary/5",
        className
      )} data-testid={`card-pricing-${name.toLowerCase()}`}>
        {highlighted && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
            Most Popular
          </div>
        )}
        <CardHeader className="pb-4">
          <h3 className="text-xl font-bold text-foreground" data-testid={`text-pricing-name-${name.toLowerCase()}`}>{name}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <span className="text-4xl font-bold text-foreground" data-testid={`text-pricing-price-${name.toLowerCase()}`}>{price}</span>
            {period && <span className="text-muted-foreground">{period}</span>}
          </div>
          <ul className="space-y-3">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
          <Link href={ctaHref}>
            <Button 
              className="w-full" 
              variant={highlighted ? "default" : "outline"}
              data-testid={`button-pricing-${name.toLowerCase()}`}
            >
              {ctaLabel}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
