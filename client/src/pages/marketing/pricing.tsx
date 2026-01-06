import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { PricingCard } from "@/components/marketing/pricing-card";
import { SectionFrame } from "@/components/marketing/section-frame";
import { DotGridPattern } from "@/components/marketing/guilloche-pattern";
import { Card, CardContent } from "@/components/ui/card";
import { Check, HelpCircle } from "lucide-react";

const PRICING_TIERS = [
  {
    name: "Starter",
    price: "$299",
    description: "For solo practitioners and small firms",
    features: [
      "Up to 100 leads/month",
      "AI voice agent (business hours)",
      "Basic qualification scoring",
      "Email notifications",
      "Standard support",
      "1 practice area",
    ],
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$599",
    description: "For growing firms with multiple attorneys",
    features: [
      "Up to 500 leads/month",
      "AI voice agent (24/7)",
      "Advanced qualification with reasons",
      "SMS + Email follow-up",
      "Webhook integrations",
      "Priority support",
      "3 practice areas",
      "Team roles (5 users)",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large firms with custom requirements",
    features: [
      "Unlimited leads",
      "Custom AI voice configuration",
      "White-label options",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantees",
      "Unlimited practice areas",
      "Unlimited team members",
      "A/B testing engine",
    ],
    highlighted: false,
    ctaLabel: "Contact Sales",
  },
];

const FAQ_ITEMS = [
  {
    question: "How does pricing work for overages?",
    answer: "Leads above your monthly limit are charged at $3/lead for Starter and $2/lead for Growth. Enterprise plans include custom overage rates.",
  },
  {
    question: "Can I change plans at any time?",
    answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.",
  },
  {
    question: "Is there a free trial?",
    answer: "We offer a 14-day free trial on the Growth plan so you can experience the full feature set before committing.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards. Enterprise customers can also pay via ACH or wire transfer with annual billing.",
  },
];

export default function PricingPage() {
  return (
    <PageShell>
      <Hero
        headline="Simple, Transparent Pricing"
        subheadline="Choose the plan that fits your firm. No hidden fees, no long-term contracts."
      />

      <section className="py-20 -mt-10">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING_TIERS.map((tier) => (
              <PricingCard
                key={tier.name}
                name={tier.name}
                price={tier.price}
                period={tier.period}
                description={tier.description}
                features={tier.features}
                highlighted={tier.highlighted}
                ctaLabel={tier.ctaLabel}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/30 relative">
        <DotGridPattern />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">All Plans Include</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              "Secure data hosting",
              "Audit logging",
              "RBAC permissions",
              "API access",
              "Mobile app access",
              "Email support",
              "Knowledge base",
              "Onboarding assistance",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 p-3 bg-card rounded-lg border border-border">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-6">
          <SectionFrame showCorners className="p-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {FAQ_ITEMS.map((item) => (
                <Card key={item.question}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <HelpCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold mb-2">{item.question}</h4>
                        <p className="text-sm text-muted-foreground">{item.answer}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </SectionFrame>
        </div>
      </section>
    </PageShell>
  );
}
