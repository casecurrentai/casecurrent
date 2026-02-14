import { useState } from "react";
import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionFrame, SectionBackground } from "@/components/marketing/section-frame";
import { DotGridPattern } from "@/components/marketing/guilloche-pattern";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Check,
  X,
  ArrowRight,
  Shield,
  FileCheck,
  Plug,
  Scale,
  ChevronDown,
  Phone,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PILOT_PLANS,
  STANDARD_PLANS,
  PILOT_CONFIG,
  COMPARISON_ROWS,
  FAQS,
  TRUST_ITEMS,
  type PlanDef,
  type ComparisonRow,
  type FaqItem,
} from "@/lib/pricing-config";

// ──────────────────────────────────────────────
// Trust row icon map
// ──────────────────────────────────────────────

const TRUST_ICON_MAP: Record<string, React.ReactNode> = {
  shield: <Shield className="w-5 h-5" />,
  "file-check": <FileCheck className="w-5 h-5" />,
  plug: <Plug className="w-5 h-5" />,
  scale: <Scale className="w-5 h-5" />,
};

// ──────────────────────────────────────────────
// Plan Card component
// ──────────────────────────────────────────────

function PlanCard({ plan, onSelect }: { plan: PlanDef; onSelect?: (id: string) => void }) {
  return (
    <Card
      className={cn(
        "relative flex flex-col h-full",
        plan.highlighted && "border-primary border-2 shadow-lg",
      )}
      data-testid={`card-pricing-${plan.id}`}
    >
      {plan.badge && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap" variant="default">
          {plan.badge}
        </Badge>
      )}
      <CardHeader className="pb-4">
        <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
        <div className="mt-2">
          <span className="text-3xl font-bold text-foreground">${plan.price}</span>
          <span className="text-muted-foreground ml-1">/ month</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{plan.tagline}</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <p className="text-sm font-medium text-foreground mb-4">{plan.positioning}</p>

        {/* Usage block */}
        <div className="rounded-lg bg-muted/50 border border-border p-3 mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Monthly usage
          </p>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-primary" />
              {plan.usage.callsPerMonth} calls
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              {plan.usage.minutesPerMonth} min
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Overage: ${plan.usage.overagePerMinute.toFixed(2)}/min
          </p>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {plan.includesLabel}
          </p>
          <ul className="space-y-2">
            {plan.features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  {feature.text}
                  {feature.comingSoon && (
                    <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0">
                      Coming soon
                    </Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto pt-4 space-y-2">
          <Link href={plan.ctaHref}>
            <Button
              className="w-full"
              variant={plan.highlighted ? "default" : "outline"}
              onClick={() => onSelect?.(plan.id)}
              data-testid={`button-pricing-${plan.id}`}
            >
              {plan.cta}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          {plan.secondaryCta && (
            <Link href={plan.secondaryCta.href}>
              <Button className="w-full" variant="ghost" size="sm" data-testid={`button-pricing-${plan.id}-secondary`}>
                {plan.secondaryCta.label}
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────
// Comparison Table
// ──────────────────────────────────────────────

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto" />;
  if (value === false) return <X className="w-5 h-5 text-muted-foreground/40 mx-auto" />;
  return <span className="text-sm text-foreground">{value}</span>;
}

function ComparisonTable({ rows }: { rows: ComparisonRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse" data-testid="table-comparison">
        <thead>
          <tr className="border-b border-border">
            <th className="py-3 px-4 text-sm font-semibold text-foreground w-[40%]">Feature</th>
            <th className="py-3 px-4 text-sm font-semibold text-foreground text-center">Core</th>
            <th className="py-3 px-4 text-sm font-semibold text-primary text-center">Pro</th>
            <th className="py-3 px-4 text-sm font-semibold text-foreground text-center">Elite</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={cn("border-b border-border/50", i % 2 === 0 && "bg-muted/20")}>
              <td className="py-3 px-4 text-sm text-foreground">{row.label}</td>
              <td className="py-3 px-4 text-center"><CellValue value={row.core} /></td>
              <td className="py-3 px-4 text-center"><CellValue value={row.pro} /></td>
              <td className="py-3 px-4 text-center"><CellValue value={row.elite} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Mobile accordion comparison
function ComparisonAccordion({ rows }: { rows: ComparisonRow[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div className="space-y-2" data-testid="accordion-comparison">
      {rows.map((row, i) => (
        <div key={i} className="border border-border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground bg-card"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
          >
            {row.label}
            <ChevronDown className={cn("w-4 h-4 transition-transform", openIndex === i && "rotate-180")} />
          </button>
          {openIndex === i && (
            <div className="px-4 py-3 bg-muted/30 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Core</p>
                <CellValue value={row.core} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pro</p>
                <CellValue value={row.pro} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Elite</p>
                <CellValue value={row.elite} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// FAQ section
// ──────────────────────────────────────────────

function FaqSection({ faqs }: { faqs: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div className="space-y-3 max-w-3xl mx-auto" data-testid="faq-section">
      {faqs.map((faq, i) => (
        <div key={i} className="border border-border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-foreground bg-card hover:bg-muted/30 transition-colors"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            data-testid={`faq-toggle-${i}`}
          >
            {faq.question}
            <ChevronDown className={cn("w-4 h-4 shrink-0 ml-4 transition-transform", openIndex === i && "rotate-180")} />
          </button>
          {openIndex === i && (
            <div className="px-5 py-4 bg-muted/20 text-sm text-muted-foreground leading-relaxed">
              {faq.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// Mobile sticky CTA
// ──────────────────────────────────────────────

function MobileStickyCta({ selectedPlan }: { selectedPlan: PlanDef | null }) {
  const plan = selectedPlan ?? PILOT_PLANS.find((p) => p.highlighted) ?? PILOT_PLANS[0];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{plan.name}</p>
        <p className="text-xs text-muted-foreground">${plan.price}/mo</p>
      </div>
      <Link href={plan.ctaHref}>
        <Button size="sm" data-testid="button-mobile-sticky-cta">
          {plan.cta}
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </Link>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────

type PlanSet = "pilot" | "standard";

export default function PricingPage() {
  const [planSet, setPlanSet] = useState<PlanSet>("pilot");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const activePlans = planSet === "pilot" ? PILOT_PLANS : STANDARD_PLANS;
  const selectedPlan = activePlans.find((p) => p.id === selectedPlanId) ?? null;

  return (
    <PageShell
      title="Pricing | CaseCurrent"
      description="Simple, transparent pricing for AI-powered legal intake. Start with a Founding Firm Pilot or choose a standard plan."
    >
      {/* ── A) Hero ─────────────────────────────── */}
      <Hero
        headline="AI Intake that captures more qualified cases — 24/7."
        subheadline="Start with a Founding Firm Pilot. Upgrade when you're ready for full-scale intake and SLA-backed reliability."
        primaryCta={{ label: "Start Founding Firm Pilot", href: "/demo?plan=pro-pilot" }}
        secondaryCta={{ label: "Talk to Avery (Demo Call)", href: "/demo" }}
      >
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            No long-term contract during Pilot. Cancel anytime.
          </p>
          {/* Trust row */}
          <div className="flex flex-wrap gap-4">
            {TRUST_ITEMS.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span className="text-primary">{TRUST_ICON_MAP[item.icon]}</span>
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </Hero>

      {/* ── B) Plan set toggle ─────────────────── */}
      <SectionBackground variant="subtle">
        <section className="py-16 -mt-8">
          <div className="container mx-auto px-6">
            {/* Toggle tabs */}
            <div className="flex justify-center mb-10">
              <div className="inline-flex rounded-lg border border-border bg-card p-1 gap-1">
                <button
                  className={cn(
                    "px-5 py-2 rounded-md text-sm font-medium transition-colors",
                    planSet === "pilot"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setPlanSet("pilot")}
                  data-testid="tab-pilot"
                >
                  Pilot (Limited)
                </button>
                <button
                  className={cn(
                    "px-5 py-2 rounded-md text-sm font-medium transition-colors",
                    planSet === "standard"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setPlanSet("standard")}
                  data-testid="tab-standard"
                >
                  Standard Plans
                </button>
              </div>
            </div>

            {/* ── C/D) Plan cards ────────────────── */}
            <SectionFrame variant="brackets" className="p-6">
              <div
                className={cn(
                  "grid gap-6 max-w-6xl mx-auto",
                  activePlans.length === 2 ? "md:grid-cols-2 max-w-4xl" : "md:grid-cols-3",
                )}
              >
                {activePlans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} onSelect={setSelectedPlanId} />
                ))}
              </div>
            </SectionFrame>

            {/* Pilot footnote */}
            {planSet === "pilot" && (
              <p className="text-xs text-muted-foreground text-center mt-6 max-w-2xl mx-auto">
                {PILOT_CONFIG.footnote}
              </p>
            )}
          </div>
        </section>
      </SectionBackground>

      {/* ── E) Usage & Overage Block ───────────── */}
      <SectionBackground variant="muted">
        <section className="py-16 relative">
          <DotGridPattern />
          <div className="container mx-auto px-6 relative z-10">
            <SectionFrame variant="corners" className="p-8 max-w-3xl mx-auto">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-foreground">
                  Transparent usage. Predictable billing.
                </h2>
              </div>
              <ul className="space-y-3 max-w-xl mx-auto">
                {[
                  "Each plan includes a monthly call and minute allowance.",
                  "Overages only apply when you exceed included usage.",
                  "You'll receive alerts at 80% and 100% usage.",
                  "Upgrade your plan anytime to get more included usage.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="text-center mt-6">
                <Button variant="ghost" size="sm" className="text-primary" data-testid="button-usage-info">
                  How usage is calculated
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      {/* ── F) Risk Reversal ───────────────────── */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <SectionFrame variant="minimal" className="p-8 max-w-3xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-foreground">Try it without the fear.</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  icon: <AlertTriangle className="w-5 h-5 text-primary" />,
                  title: "Cancel anytime",
                  desc: "No long-term contract during Pilot. Cancel before your term ends with zero penalty.",
                },
                {
                  icon: <Clock className="w-5 h-5 text-primary" />,
                  title: "90-day Pilot",
                  desc: "Full access to your plan tier for 90 days at reduced pricing before transitioning to standard rates.",
                },
                {
                  icon: <Shield className="w-5 h-5 text-primary" />,
                  title: "Full audit trail",
                  desc: "Audit logs and call history so you can verify performance before committing long-term.",
                },
              ].map((item) => (
                <div key={item.title} className="text-center space-y-2 p-4">
                  <div className="flex justify-center">{item.icon}</div>
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </SectionFrame>
        </div>
      </section>

      {/* ── G) Comparison Table ────────────────── */}
      <SectionBackground variant="subtle">
        <section className="py-16">
          <div className="container mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-foreground">Compare plans</h2>
              <p className="text-muted-foreground mt-2">See exactly what's included at every tier.</p>
            </div>
            {/* Desktop table */}
            <div className="hidden md:block max-w-4xl mx-auto">
              <SectionFrame variant="brackets" className="p-6">
                <ComparisonTable rows={COMPARISON_ROWS} />
              </SectionFrame>
            </div>
            {/* Mobile accordion */}
            <div className="md:hidden">
              <ComparisonAccordion rows={COMPARISON_ROWS} />
            </div>
          </div>
        </section>
      </SectionBackground>

      {/* ── H) FAQs ───────────────────────────── */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-foreground">Frequently asked questions</h2>
          </div>
          <FaqSection faqs={FAQS} />
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────── */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to capture more cases?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Join the Founding Firm Pilot and see results in your first week.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/demo">
              <Button size="lg" variant="secondary" data-testid="button-cta-demo">
                Start Founding Firm Pilot
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 text-primary-foreground"
                data-testid="button-cta-contact"
              >
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Mobile sticky CTA ──────────────────── */}
      <MobileStickyCta selectedPlan={selectedPlan} />
    </PageShell>
  );
}
