import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { FeatureCard, MetricCard } from "@/components/marketing/feature-card";
import { SectionFrame, BlueprintDivider, SectionBackground } from "@/components/marketing/section-frame";
import { UIFrame, PhoneFrame } from "@/components/marketing/ui-frame";
import { HorizontalTimeline } from "@/components/marketing/timeline-stepper";
import { DotGridPattern } from "@/components/marketing/guilloche-pattern";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Mic,
  Brain,
  Zap,
  Webhook,
  BarChart3,
  Shield,
  Phone,
  Users,
  FileText,
  Settings,
} from "lucide-react";

const FEATURES = [
  {
    icon: Mic,
    title: "AI Voice Agent",
    description: "24/7 intelligent phone answering that captures lead details, qualifies prospects, and schedules consultations.",
  },
  {
    icon: Brain,
    title: "Smart Qualification",
    description: "AI-powered scoring evaluates case merit, urgency, and fit with explainable decision traces.",
  },
  {
    icon: Zap,
    title: "Instant Follow-up",
    description: "Automated SMS and email responses ensure no lead goes cold while your team focuses on cases.",
  },
  {
    icon: Webhook,
    title: "Webhooks & Integrations",
    description: "Connect to Clio, MyCase, Zapier, and custom systems with real-time event webhooks.",
  },
  {
    icon: BarChart3,
    title: "Dashboard Analytics",
    description: "Track conversion rates, response times, and lead sources with actionable insights.",
  },
  {
    icon: Shield,
    title: "Security & Compliance",
    description: "Role-based access, audit logs, and encrypted data handling meet law firm standards.",
  },
];

const HOW_IT_WORKS_STEPS = [
  { title: "Capture", description: "AI answers calls and web inquiries 24/7" },
  { title: "Qualify", description: "Smart scoring evaluates case fit" },
  { title: "Follow-up", description: "Automated outreach keeps leads warm" },
  { title: "Deliver", description: "Qualified leads reach your staff" },
];

export default function MarketingHomePage() {
  return (
    <PageShell>
      <Hero
        headline="AI-Powered Intake & Lead Capture for Law Firms"
        subheadline="Convert more inquiries into qualified leads with intelligent voice agents, smart qualification scoring, and seamless CRM integration. Built for modern law firms."
        primaryCta={{ label: "Book a Demo", href: "/demo" }}
        secondaryCta={{ label: "Contact Sales", href: "/contact" }}
      >
        <SectionFrame variant="corners" className="p-4">
          <UIFrame title="Dashboard">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <MetricCard value="35" label="New Leads" trend="+12% this week" />
                <MetricCard value="89%" label="Qualification Rate" />
                <MetricCard value="2.3m" label="Avg Response" />
              </div>
              <div className="h-24 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                Analytics Chart Area
              </div>
            </div>
          </UIFrame>
        </SectionFrame>
      </Hero>

      <SectionBackground variant="subtle">
        <section className="py-20 relative">
          <DotGridPattern />
          <div className="container mx-auto px-6 relative z-10">
            <SectionFrame variant="brackets" className="p-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-4">Everything Included</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                A complete platform for capturing, qualifying, and converting legal leads
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((feature) => (
                <FeatureCard
                  key={feature.title}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                />
              ))}
              </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <BlueprintDivider />

      <SectionBackground variant="muted">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <SectionFrame variant="crosshairs" className="p-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-4">How It Works</h2>
                <p className="text-muted-foreground">From first contact to qualified consultation</p>
              </div>
              <HorizontalTimeline steps={HOW_IT_WORKS_STEPS} className="max-w-4xl mx-auto" />
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <BlueprintDivider />

      <SectionBackground variant="accent">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <SectionFrame variant="rails" className="p-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">Client Mobile App</h2>
              <p className="text-muted-foreground">
                Your team stays connected with a native mobile experience
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-8">
              <PhoneFrame>
                <div className="bg-background h-full p-4">
                  <div className="text-xs text-muted-foreground mb-2">Dashboard</div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <MetricCard value="12" label="New" className="flex-1" />
                      <MetricCard value="8" label="Qualified" className="flex-1 ml-2" />
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted" />
                          <div className="flex-1">
                            <div className="h-3 bg-muted rounded w-24" />
                            <div className="h-2 bg-muted/50 rounded w-16 mt-1" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </PhoneFrame>
              <PhoneFrame>
                <div className="bg-background h-full p-4">
                  <div className="text-xs text-muted-foreground mb-2">Leads</div>
                  <div className="space-y-2">
                    {["Anna Martinez", "James Chen", "Sarah Johnson", "Mike Brown"].map((name) => (
                      <div key={name} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <Users className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{name}</div>
                          <div className="text-xs text-muted-foreground">Personal Injury</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </PhoneFrame>
              <PhoneFrame>
                <div className="bg-background h-full p-4">
                  <div className="text-xs text-muted-foreground mb-2">Lead Detail</div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">Anna Martinez</div>
                        <div className="text-xs text-muted-foreground">Motor Vehicle Accident</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted/50 rounded-lg p-2">
                        <Phone className="w-4 h-4 mx-auto text-muted-foreground" />
                        <div className="text-xs mt-1">Call</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <FileText className="w-4 h-4 mx-auto text-muted-foreground" />
                        <div className="text-xs mt-1">Notes</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <Settings className="w-4 h-4 mx-auto text-muted-foreground" />
                        <div className="text-xs mt-1">Tasks</div>
                      </div>
                    </div>
                  </div>
                </div>
              </PhoneFrame>
            </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Intake Process?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Join law firms that capture 40% more qualified leads with AI-powered intake.
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
