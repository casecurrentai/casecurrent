import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionFrame, BlueprintDivider, SectionBackground } from "@/components/marketing/section-frame";
import { UIFrame } from "@/components/marketing/ui-frame";
import { TimelineStepper } from "@/components/marketing/timeline-stepper";
import { FeatureCard, MetricCard } from "@/components/marketing/feature-card";
import { DotGridPattern } from "@/components/marketing/guilloche-pattern";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Phone, MessageSquare, Globe, Brain, Zap, BarChart3 } from "lucide-react";

const CAPTURE_METHODS = [
  {
    icon: Phone,
    title: "Phone Calls",
    description: "AI voice agent answers 24/7, captures details, and qualifies callers naturally.",
  },
  {
    icon: MessageSquare,
    title: "SMS Messages",
    description: "Automated text conversations capture leads from mobile-first prospects.",
  },
  {
    icon: Globe,
    title: "Web Inquiries",
    description: "Website chat and forms feed directly into your qualification pipeline.",
  },
];

const WORKFLOW_STEPS = [
  {
    title: "Lead Capture",
    description: "AI answers inbound calls and messages 24/7. Natural conversation captures contact info, case details, and urgency signals.",
  },
  {
    title: "Instant Qualification",
    description: "Smart scoring evaluates practice area fit, case merit, and timeline. Each decision includes explainable reasons your team can review.",
  },
  {
    title: "Automated Follow-up",
    description: "Qualified leads receive immediate confirmation. Follow-up sequences keep prospects warm while your staff prepares.",
  },
  {
    title: "Staff Notification",
    description: "High-priority leads trigger instant alerts. Your team sees full context including call recordings and AI summaries.",
  },
  {
    title: "CRM Integration",
    description: "Leads sync to Clio, MyCase, or your custom system via webhooks. No duplicate data entry required.",
  },
  {
    title: "Analytics & Optimization",
    description: "Track conversion funnels, response times, and lead sources. A/B test intake scripts to continuously improve.",
  },
];

export default function HowItWorksPage() {
  return (
    <PageShell>
      <Hero
        headline="How CaseCurrent Works"
        subheadline="From first contact to qualified consultation in minutes. See how CaseCurrent captures, qualifies, and delivers leads to your team."
        primaryCta={{ label: "Book a Demo", href: "/demo" }}
        secondaryCta={{ label: "Contact Sales", href: "/contact" }}
      >
        <SectionFrame variant="brackets" className="p-4">
          <UIFrame title="Intake Flow">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg">
                <Phone className="w-5 h-5 text-primary" />
                <div>
                  <div className="font-medium text-sm">Inbound Call</div>
                  <div className="text-xs text-muted-foreground">AI answering...</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Brain className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">Qualification</div>
                  <div className="text-xs text-muted-foreground">Score: 87/100</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-emerald-500/10 rounded-lg">
                <Zap className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="font-medium text-sm">Follow-up Sent</div>
                  <div className="text-xs text-muted-foreground">SMS + Email</div>
                </div>
              </div>
            </div>
          </UIFrame>
        </SectionFrame>
      </Hero>

      <SectionBackground variant="subtle">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <SectionFrame variant="brackets" className="p-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">Multi-Channel Capture</h2>
              <p className="text-muted-foreground">Meet leads where they are</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {CAPTURE_METHODS.map((method) => (
                <FeatureCard
                  key={method.title}
                  icon={method.icon}
                  title={method.title}
                  description={method.description}
                />
              ))}
            </div>
          </SectionFrame>
        </div>
      </section>
    </SectionBackground>

      <SectionBackground variant="muted">
        <section className="py-20 relative">
        <DotGridPattern />
        <div className="container mx-auto px-6 relative z-10">
          <SectionFrame variant="crosshairs" className="p-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">What Happens Next</h2>
              <p className="text-muted-foreground">The complete journey from inquiry to consultation</p>
            </div>
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <TimelineStepper steps={WORKFLOW_STEPS} />
              <div className="sticky top-24">
                <UIFrame title="Live Dashboard">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <MetricCard value="355" label="Leads this month" />
                      <MetricCard value="35" label="New today" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <MetricCard value="3,299" label="Consults booked" />
                      <MetricCard value="10m" label="Avg response time" />
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">Response Time</span>
                        <span className="text-xs text-muted-foreground">This week</span>
                      </div>
                      <div className="h-20 flex items-end gap-1">
                        {[40, 55, 45, 70, 60, 85, 50].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-primary/60 rounded-t"
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </UIFrame>
              </div>
            </div>
          </SectionFrame>
        </div>
      </section>
    </SectionBackground>

      <SectionBackground variant="accent">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <SectionFrame variant="crosshairs" className="p-8">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-3xl font-bold text-foreground mb-4">Real-Time Analytics</h2>
                <p className="text-muted-foreground mb-6">
                  Track every step of your intake funnel. See which sources convert best,
                  where leads drop off, and how your team performs.
                </p>
                <ul className="space-y-3">
                  {[
                    "Conversion rate by source and practice area",
                    "Response time tracking and alerts",
                    "Lead quality scoring distribution",
                    "A/B testing for intake scripts",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <UIFrame title="Analytics">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Lead Sources</span>
                    <span className="text-xs text-muted-foreground">Last 30 days</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: "Phone", value: 45, color: "bg-primary" },
                      { name: "Web", value: 30, color: "bg-blue-500" },
                      { name: "SMS", value: 25, color: "bg-emerald-500" },
                    ].map((source) => (
                      <div key={source.name} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{source.name}</span>
                          <span className="text-muted-foreground">{source.value}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${source.color}`}
                            style={{ width: `${source.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </UIFrame>
              </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to See It in Action?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Schedule a personalized demo to see how CaseCurrent can transform your intake process.
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
