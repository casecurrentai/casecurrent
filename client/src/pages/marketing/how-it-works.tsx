import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionBackground } from "@/components/marketing/section-frame";
import { DotGridPattern } from "@/components/marketing/guilloche-pattern";
import { GradientOrb, GlowLine, FloatingShape, DecorativeScatter, PulseBeacon, GradientText } from "@/components/marketing/decorative-visuals";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Phone, MessageSquare, Globe, Brain, Zap, BarChart3, Bell, FileText, CheckCircle, ArrowRight, TrendingUp, Activity } from "lucide-react";

function CaptureChannelGraphic() {
  const channels = [
    {
      icon: Phone,
      title: "Phone Calls",
      description: "AI voice agent answers 24/7, captures details, and qualifies callers naturally.",
      gradient: "from-blue-500 to-indigo-500",
      bgGlow: "from-blue-500/15 to-indigo-500/15",
      stat: "24/7",
      statLabel: "Availability",
    },
    {
      icon: MessageSquare,
      title: "SMS Messages",
      description: "Automated text conversations capture leads from mobile-first prospects.",
      gradient: "from-emerald-500 to-teal-500",
      bgGlow: "from-emerald-500/15 to-teal-500/15",
      stat: "<30s",
      statLabel: "Response",
    },
    {
      icon: Globe,
      title: "Web Inquiries",
      description: "Website chat and forms feed directly into your qualification pipeline.",
      gradient: "from-purple-500 to-pink-500",
      bgGlow: "from-purple-500/15 to-pink-500/15",
      stat: "100%",
      statLabel: "Capture Rate",
    },
  ];

  return (
    <div className="grid md:grid-cols-3 gap-6" data-testid="graphic-capture-channels">
      {channels.map((ch, i) => (
        <div key={i} className="relative group">
          <div className={`absolute -inset-1 bg-gradient-to-br ${ch.bgGlow} rounded-2xl blur-xl opacity-40 group-hover:opacity-80 transition-opacity duration-500`} aria-hidden="true" />
          <div className="relative bg-card border border-border/50 rounded-2xl p-6 h-full">
            <div className="flex items-center justify-between gap-2 mb-5">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${ch.gradient} flex items-center justify-center shadow-lg`}>
                <ch.icon className="w-6 h-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{ch.stat}</div>
                <div className="text-xs text-muted-foreground">{ch.statLabel}</div>
              </div>
            </div>
            <h3 className="font-semibold text-lg mb-2">{ch.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{ch.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkflowJourney() {
  const steps = [
    {
      icon: Phone,
      title: "Lead Capture",
      desc: "AI answers inbound calls and messages 24/7. Natural conversation captures contact info, case details, and urgency signals.",
      gradient: "from-blue-500 to-blue-600",
      accent: "border-blue-500/20 bg-blue-500/5",
    },
    {
      icon: Brain,
      title: "Instant Qualification",
      desc: "Smart scoring evaluates practice area fit, case merit, and timeline. Each decision includes explainable reasons your team can review.",
      gradient: "from-indigo-500 to-purple-500",
      accent: "border-indigo-500/20 bg-indigo-500/5",
    },
    {
      icon: Zap,
      title: "Automated Follow-up",
      desc: "Qualified leads receive immediate confirmation. Follow-up sequences keep prospects warm while your staff prepares.",
      gradient: "from-emerald-500 to-teal-500",
      accent: "border-emerald-500/20 bg-emerald-500/5",
    },
    {
      icon: Bell,
      title: "Staff Notification",
      desc: "High-priority leads trigger instant alerts. Your team sees full context including call recordings and AI summaries.",
      gradient: "from-amber-500 to-orange-500",
      accent: "border-amber-500/20 bg-amber-500/5",
    },
    {
      icon: FileText,
      title: "CRM Integration",
      desc: "Leads sync to Clio, MyCase, or your custom system via webhooks. No duplicate data entry required.",
      gradient: "from-purple-500 to-pink-500",
      accent: "border-purple-500/20 bg-purple-500/5",
    },
    {
      icon: BarChart3,
      title: "Analytics & Optimization",
      desc: "Track conversion funnels, response times, and lead sources. A/B test intake scripts to continuously improve.",
      gradient: "from-cyan-500 to-blue-500",
      accent: "border-cyan-500/20 bg-cyan-500/5",
    },
  ];

  return (
    <div className="relative" data-testid="graphic-workflow-journey">
      <div className="hidden lg:block absolute left-[2.25rem] top-[3.5rem] bottom-[3.5rem] w-0.5" aria-hidden="true">
        <div className="w-full h-full bg-gradient-to-b from-blue-500/30 via-emerald-500/30 to-cyan-500/30 rounded-full" />
      </div>
      <div className="space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="relative flex gap-5 items-start">
            <div className={`w-[4.5rem] h-[4.5rem] rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-xl shrink-0 relative z-10`}>
              <step.icon className="w-7 h-7 text-white" />
            </div>
            <div className={`flex-1 rounded-2xl border p-5 ${step.accent}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground">Step {i + 1}</span>
              </div>
              <h3 className="font-semibold text-lg mb-1">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="relative" data-testid="graphic-dashboard-preview">
      <div className="absolute -inset-2 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 rounded-3xl blur-xl" aria-hidden="true" />
      <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border/50">
          <div className="flex gap-1.5" aria-hidden="true">
            <div className="w-3 h-3 rounded-full bg-red-400/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
            <div className="w-3 h-3 rounded-full bg-green-400/60" />
          </div>
          <div className="flex-1 text-center text-xs text-muted-foreground font-medium">Live Dashboard</div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "355", label: "Leads this month", trend: "+12%", trendColor: "text-emerald-500" },
              { value: "35", label: "New today", trend: "+5", trendColor: "text-emerald-500" },
              { value: "3,299", label: "Consults booked", trend: "+18%", trendColor: "text-emerald-500" },
              { value: "< 2m", label: "Avg response", trend: "-30s", trendColor: "text-emerald-500" },
            ].map((m, i) => (
              <div key={i} className="p-3 rounded-xl bg-gradient-to-br from-muted/60 to-muted/30 border border-border/40">
                <div className="text-xl font-bold">{m.value}</div>
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className={`text-xs font-medium mt-1 ${m.trendColor}`}>
                  <TrendingUp className="w-3 h-3 inline mr-0.5" />{m.trend}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-muted/40 to-muted/20 border border-border/40">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-sm font-medium">Response Time</span>
              <span className="text-xs text-muted-foreground">This week</span>
            </div>
            <div className="h-16 flex items-end gap-1.5">
              {[40, 55, 45, 70, 60, 85, 50].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-md overflow-hidden">
                  <div
                    className="w-full bg-gradient-to-t from-primary to-primary/60 rounded-t-md"
                    style={{ height: `${h}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <span key={d}>{d}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsShowcase() {
  const sources = [
    { name: "Phone", pct: 45, gradient: "from-blue-500 to-blue-600" },
    { name: "Web", pct: 30, gradient: "from-indigo-500 to-purple-500" },
    { name: "SMS", pct: 25, gradient: "from-emerald-500 to-teal-500" },
  ];

  const features = [
    "Conversion rate by source and practice area",
    "Response time tracking and alerts",
    "Lead quality scoring distribution",
    "A/B testing for intake scripts",
  ];

  return (
    <div className="grid lg:grid-cols-2 gap-10 items-center" data-testid="graphic-analytics">
      <div>
        <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4 flex items-center gap-3">
          Real-Time <GradientText from="from-emerald-500" to="to-blue-500">Analytics</GradientText>
          <PulseBeacon color="emerald" />
        </h2>
        <p className="text-muted-foreground mb-6 text-lg">
          Track every step of your intake funnel. See which sources convert best,
          where leads drop off, and how your team performs.
        </p>
        <div className="space-y-3">
          {features.map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        <div className="absolute -inset-2 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-3xl blur-xl" aria-hidden="true" />
        <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl shadow-2xl p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="font-semibold">Lead Sources</span>
            <span className="text-xs text-muted-foreground">Last 30 days</span>
          </div>
          <div className="space-y-4">
            {sources.map((source) => (
              <div key={source.name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">{source.name}</span>
                  <span className="text-muted-foreground font-mono">{source.pct}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${source.gradient} rounded-full`}
                    style={{ width: `${source.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span className="text-muted-foreground">Conversion rate: </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">34.2%</span>
              <TrendingUp className="w-3 h-3 text-emerald-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <PageShell>
      <Hero
        headline="How CaseCurrent Works"
        subheadline="From first contact to qualified consultation in minutes. See how CaseCurrent captures, qualifies, and delivers leads to your team."
        primaryCta={{ label: "Book a Demo", href: "/demo" }}
        secondaryCta={{ label: "Contact Sales", href: "/contact" }}
      >
        <div className="relative">
          <GradientOrb color="primary" size="md" className="absolute -top-10 -right-10 pointer-events-none" />
          <FloatingShape variant="diamond" className="absolute -bottom-4 -left-4 pointer-events-none" />
          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-br from-primary/10 via-blue-500/5 to-purple-500/10 rounded-3xl blur-xl" aria-hidden="true" />
            <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl shadow-2xl p-5">
              <div className="space-y-3">
                {[
                  { icon: Phone, label: "Inbound Call", sub: "AI answering...", gradient: "from-blue-500 to-indigo-500", bg: "bg-blue-500/10" },
                  { icon: Brain, label: "Qualification", sub: "Score: 87/100", gradient: "from-indigo-500 to-purple-500", bg: "bg-indigo-500/10" },
                  { icon: Zap, label: "Follow-up Sent", sub: "SMS + Email", gradient: "from-emerald-500 to-teal-500", bg: "bg-emerald-500/10" },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 ${item.bg} rounded-xl border border-border/30`}>
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-md`}>
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.sub}</div>
                    </div>
                    {i < 2 && <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />}
                    {i === 2 && <CheckCircle className="w-5 h-5 text-emerald-500 ml-auto" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Hero>

      <SectionBackground variant="deep" withMesh meshVariant="ocean">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                <GradientText from="from-blue-500" to="to-indigo-500">Multi-Channel</GradientText> Capture
              </h2>
              <p className="text-muted-foreground text-lg">Meet leads where they are</p>
            </div>
            <CaptureChannelGraphic />
          </div>
        </section>
      </SectionBackground>

      <SectionBackground variant="slate" withMesh meshVariant="midnight">
        <section className="py-20 relative">
          <DecorativeScatter density="sparse" />
          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                The Complete <GradientText from="from-indigo-500" to="to-purple-500">Journey</GradientText>
              </h2>
              <p className="text-muted-foreground text-lg">From inquiry to consultation — every step automated</p>
            </div>
            <div className="grid lg:grid-cols-2 gap-10 items-start">
              <WorkflowJourney />
              <div className="lg:sticky lg:top-24">
                <DashboardPreview />
              </div>
            </div>
          </div>
        </section>
      </SectionBackground>

      <SectionBackground variant="deep" withMesh meshVariant="ocean">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <AnalyticsShowcase />
          </div>
        </section>
      </SectionBackground>

      <section className="py-20 bg-gradient-to-br from-primary via-blue-600 to-indigo-700 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-32 left-1/4 w-[30rem] h-[30rem] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-20 right-1/3 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Ready to See It in Action?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto text-lg">
            Schedule a personalized demo to see how CaseCurrent can transform your intake process.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/demo">
              <Button size="lg" variant="secondary" data-testid="button-cta-demo">
                Book a Demo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" data-testid="button-cta-contact">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
