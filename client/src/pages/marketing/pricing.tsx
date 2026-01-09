import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionFrame, BlueprintDivider, SectionBackground } from "@/components/marketing/section-frame";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Check, ArrowRight } from "lucide-react";

interface TierFeature {
  text: string;
}

interface PricingTierProps {
  name: string;
  price: string;
  tagline: string;
  description: string;
  includesLabel?: string;
  features: TierFeature[];
  outcome: string;
  highlighted?: boolean;
}

function PricingTier({
  name,
  price,
  tagline,
  description,
  includesLabel = "Includes",
  features,
  outcome,
  highlighted = false,
}: PricingTierProps) {
  return (
    <Card className={`relative flex flex-col ${highlighted ? "border-primary border-2 shadow-lg" : ""}`}>
      {highlighted && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" variant="default">
          Most Popular
        </Badge>
      )}
      <CardHeader className="pb-4">
        <h3 className="text-xl font-bold text-foreground">{name}</h3>
        <div className="mt-2">
          <span className="text-3xl font-bold text-foreground">{price}</span>
          <span className="text-muted-foreground ml-1">/ month</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{tagline}</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <p className="text-sm text-foreground mb-4">{description}</p>
        
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {includesLabel}
          </p>
          <ul className="space-y-2">
            {features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{feature.text}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="mt-auto pt-4 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Outcome
          </p>
          <p className="text-sm text-foreground">{outcome}</p>
        </div>
        
        <Link href="/demo" className="mt-4">
          <Button className="w-full" variant={highlighted ? "default" : "outline"} data-testid={`button-pricing-${name.toLowerCase().replace(/\s+/g, '-')}`}>
            Get Started
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

const CORE_FEATURES: TierFeature[] = [
  { text: "AI voice agent for missed & after-hours calls" },
  { text: "Voicemail transcription + intelligent summaries" },
  { text: "Lead capture (name, phone, case type, urgency)" },
  { text: "Email & SMS lead notifications" },
  { text: "Secure dashboard with call and lead history" },
  { text: "Built-in legal disclaimers" },
  { text: "1 firm, 1 phone number" },
];

const PRO_FEATURES: TierFeature[] = [
  { text: "Live call screening & warm transfers" },
  { text: "Custom intake logic by practice area" },
  { text: "CRM integrations (Clio, MyCase)" },
  { text: "Zapier & webhook automations" },
  { text: "AI follow-ups for missed leads" },
  { text: "Advanced analytics & conversion insights" },
  { text: "Multiple phone numbers" },
  { text: "Priority support" },
];

const ELITE_FEATURES: TierFeature[] = [
  { text: "24/7 AI call handling (not just overflow)" },
  { text: "Advanced qualification & urgency scoring" },
  { text: "Practice-area-specific AI models" },
  { text: "Firm-branded AI voice & scripting" },
  { text: "Reliability monitoring & priority incident response" },
  { text: "Dedicated onboarding & quarterly optimization" },
  { text: "Optional bilingual support" },
];

const SETUP_INCLUDES = [
  "AI configuration & training",
  "Call flow setup",
  "CRM & automation connections",
  "Firm-specific intake logic",
];

const WHY_CHOOSE = [
  "Costs less than a part-time receptionist",
  "Works 24/7 — nights, weekends, holidays",
  "No per-call or per-lead fees",
  "Designed exclusively for legal intake",
  "Built to integrate with your existing systems",
];

export default function PricingPage() {
  return (
    <PageShell>
      <Hero
        headline="Simple, Transparent Pricing"
        subheadline="Built for Law Firms. Priced for Real Results."
      >
        <div className="max-w-2xl mx-auto text-center space-y-4 mt-4">
          <p className="text-muted-foreground">
            CaseCurrent AI replaces missed-call revenue loss and intake bottlenecks with a 24/7 AI-powered intake system designed specifically for law firms.
          </p>
          <p className="text-muted-foreground">
            No long-term contracts. No per-call nickel-and-diming. Just predictable monthly pricing.
          </p>
        </div>
      </Hero>

      <SectionBackground variant="subtle">
        <section className="py-16 -mt-8">
          <div className="container mx-auto px-6">
            <SectionFrame variant="brackets" className="p-6">
            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <PricingTier
                name="CaseCurrent Core"
                price="$349"
                tagline="Best for solo attorneys and small firms getting started with AI intake"
                description="Never miss another after-hours or overflow call."
                features={CORE_FEATURES}
                outcome="Capture leads you're already paying for — without hiring staff."
              />
              <PricingTier
                name="CaseCurrent Pro"
                price="$749"
                tagline="Designed for growing firms that care about conversion, not just coverage"
                description="Turn more callers into qualified cases automatically."
                includesLabel="Includes everything in Core, plus"
                features={PRO_FEATURES}
                outcome="Replace manual intake, improve lead quality, and increase signed cases — without adding headcount."
                highlighted
              />
              <PricingTier
                name="CaseCurrent Elite"
                price="$1,499"
                tagline="For high-volume and multi-attorney firms"
                description="A fully branded, always-on AI intake system."
                includesLabel="Includes everything in Pro, plus"
                features={ELITE_FEATURES}
                outcome="Enterprise-grade intake without enterprise complexity."
              />
            </div>
          </SectionFrame>
        </div>
      </section>
    </SectionBackground>

      <SectionBackground variant="muted">
        <section className="py-16">
          <div className="container mx-auto px-6">
            <SectionFrame variant="corners" className="p-8 max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground">One-Time Setup</h2>
              <p className="text-3xl font-bold text-primary mt-2">$500–$1,000</p>
              <p className="text-sm text-muted-foreground mt-1">(based on complexity)</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {SETUP_INCLUDES.map((item) => (
                <div key={item} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
                  <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground mt-6">
              Occasionally waived during promotions.
            </p>
          </SectionFrame>
        </div>
      </section>
    </SectionBackground>

      <SectionBackground variant="accent">
        <section className="py-16">
          <div className="container mx-auto px-6">
            <SectionFrame variant="brackets" className="p-8 max-w-3xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground">Why Law Firms Choose CaseCurrent</h2>
            </div>
            <ul className="space-y-3">
              {WHY_CHOOSE.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
              </ul>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            See how CaseCurrent can transform your firm's intake process.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/demo">
              <Button size="lg" variant="secondary" data-testid="button-cta-demo">
                Book a Demo
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground" data-testid="button-cta-contact">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
