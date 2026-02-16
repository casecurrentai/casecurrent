import { PageShell } from "@/components/marketing/page-shell";
import { SectionBackground } from "@/components/marketing/section-frame";
import { PricingCard } from "@/components/marketing/pricing-card";
import { GuillocheUnderlay, DotGridPattern } from "@/components/marketing/guilloche-pattern";
import { GradientOrb, GlowLine, FloatingShape, HeroGlow, GradientText, PulseBeacon, DecorativeScatter } from "@/components/marketing/decorative-visuals";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Phone,
  Clock,
  ArrowRight,
  CheckCircle,
  FileText,
  Activity,
  Check,
  X,
  Zap,
  Shield,
  BarChart3,
  MessageSquare,
  Brain,
  Bell,
  Target,
  TrendingUp,
  Users,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

function IntakePipelineGraphic() {
  const stages = [
    { icon: Phone, label: "Inbound Call", status: "active", color: "from-blue-500 to-blue-600" },
    { icon: Brain, label: "AI Qualification", status: "processing", color: "from-indigo-500 to-purple-500" },
    { icon: FileText, label: "Structured Lead", status: "complete", color: "from-emerald-500 to-emerald-600" },
    { icon: Bell, label: "Team Notified", status: "complete", color: "from-amber-500 to-orange-500" },
  ];

  return (
    <div className="relative" data-testid="graphic-intake-pipeline">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-emerald-500/10 rounded-2xl blur-xl" aria-hidden="true" />
      <div className="relative bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-6">
          <PulseBeacon color="emerald" size="sm" />
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Live Intake Pipeline</span>
        </div>

        <div className="space-y-3">
          {stages.map((stage, i) => (
            <div key={i} className="relative">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-muted/60 to-muted/30 border border-border/40">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stage.color} flex items-center justify-center shadow-lg`}>
                  <stage.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{stage.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {stage.status === "active" && "Processing..."}
                    {stage.status === "processing" && "Score: 87/100"}
                    {stage.status === "complete" && "Complete"}
                  </div>
                </div>
                {stage.status === "active" && (
                  <div className="flex gap-0.5 items-center h-6">
                    {[...Array(8)].map((_, j) => (
                      <div key={j} className="w-0.5 bg-blue-500/60 rounded-full animate-pulse" style={{ height: `${Math.random() * 16 + 6}px`, animationDelay: `${j * 0.1}s` }} />
                    ))}
                  </div>
                )}
                {stage.status === "complete" && (
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                )}
                {stage.status === "processing" && (
                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="w-[87%] h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
                  </div>
                )}
              </div>
              {i < stages.length - 1 && (
                <div className="ml-8 h-3 flex items-center justify-center" aria-hidden="true">
                  <div className="w-0.5 h-full bg-gradient-to-b from-border to-border/30" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold">Sarah Martinez</div>
                <div className="text-xs text-muted-foreground">PI — Auto Accident</div>
              </div>
            </div>
            <Badge className="bg-emerald-600 text-white">Consult Booked</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveMetricsBar() {
  const metrics = [
    { value: "24/7", label: "Availability", icon: Clock },
    { value: "<2min", label: "Response Time", icon: Zap },
    { value: "98%", label: "Capture Rate", icon: Target },
    { value: "3.2x", label: "More Consults", icon: TrendingUp },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="graphic-metrics-bar">
      {metrics.map((m, i) => (
        <div key={i} className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 to-blue-500/8 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
          <div className="relative bg-card border border-border/60 rounded-xl p-5 text-center">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/15 to-blue-500/15 flex items-center justify-center mx-auto mb-3">
              <m.icon className="w-5 h-5 text-primary" />
            </div>
            <div className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{m.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProblemSolutionComparison() {
  const problems = [
    { text: "Missed calls after hours become lost cases", icon: Phone },
    { text: "Inconsistent intake quality day to day", icon: FileText },
    { text: "Staff time burned gathering basic details", icon: Clock },
    { text: "Leads go cold before you get a clean summary", icon: X },
  ];

  const solutions = [
    { text: "AI answers 24/7 with your firm's rules", icon: Phone },
    { text: "Every caller gets the same structured experience", icon: Shield },
    { text: "Structured data delivered automatically", icon: Zap },
    { text: "Instant summaries with priority flags", icon: CheckCircle },
  ];

  return (
    <div className="grid lg:grid-cols-2 gap-6" data-testid="graphic-problem-solution">
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-2xl blur-lg" aria-hidden="true" />
        <div className="relative bg-card border border-destructive/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
              <X className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Without CaseCurrent</h3>
              <p className="text-xs text-muted-foreground">Leads slip through the cracks</p>
            </div>
          </div>
          <div className="space-y-3">
            {problems.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10" data-testid={`problem-item-${i}`}>
                <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <p.icon className="w-4 h-4 text-destructive" />
                </div>
                <span className="text-sm text-foreground">{p.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
            <TrendingUp className="w-4 h-4 text-destructive rotate-180" />
            <span className="text-sm font-medium text-destructive">Revenue leaking from your pipeline</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-2xl blur-lg" aria-hidden="true" />
        <div className="relative bg-card border border-emerald-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg">With CaseCurrent</h3>
              <p className="text-xs text-muted-foreground">Every lead captured and qualified</p>
            </div>
          </div>
          <div className="space-y-3">
            {solutions.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10" data-testid={`solution-item-${i}`}>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <s.icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm text-foreground">{s.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">More signed cases, less effort</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CapabilityShowcase() {
  const capabilities = [
    {
      icon: Phone,
      title: "24/7 Voice Intake",
      description: "AI voice agent answers using your firm's rules and practice areas",
      gradient: "from-blue-500 to-indigo-500",
      bgGlow: "from-blue-500/15 to-indigo-500/15",
    },
    {
      icon: FileText,
      title: "Structured Summaries",
      description: "Clean, organized lead data — not messy transcripts",
      gradient: "from-emerald-500 to-teal-500",
      bgGlow: "from-emerald-500/15 to-teal-500/15",
    },
    {
      icon: Target,
      title: "Lead Routing + Priority",
      description: "Automatic routing with urgency flags for time-sensitive matters",
      gradient: "from-amber-500 to-orange-500",
      bgGlow: "from-amber-500/15 to-orange-500/15",
    },
    {
      icon: MessageSquare,
      title: "SMS Follow-up",
      description: "Secure intake links and document upload nudges via text",
      gradient: "from-purple-500 to-pink-500",
      bgGlow: "from-purple-500/15 to-pink-500/15",
    },
    {
      icon: BarChart3,
      title: "Intake Analytics",
      description: "Track funnels, response times, and source ROI",
      gradient: "from-cyan-500 to-blue-500",
      bgGlow: "from-cyan-500/15 to-blue-500/15",
    },
    {
      icon: Shield,
      title: "Full Audit Trail",
      description: "Every question asked, answer given, and action taken — logged",
      gradient: "from-slate-500 to-slate-600",
      bgGlow: "from-slate-500/15 to-slate-600/15",
    },
  ];

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="graphic-capabilities">
      {capabilities.map((cap, i) => (
        <div key={i} className="relative group">
          <div className={`absolute -inset-0.5 bg-gradient-to-br ${cap.bgGlow} rounded-2xl blur-lg opacity-50 group-hover:opacity-100 transition-opacity duration-500`} aria-hidden="true" />
          <div className="relative bg-card border border-border/50 rounded-2xl p-6 h-full">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cap.gradient} flex items-center justify-center mb-4 shadow-lg`}>
              <cap.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-lg mb-2">{cap.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{cap.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function OnboardingTimeline() {
  const steps = [
    {
      num: "1",
      title: "Provision Your Number",
      desc: "Get a dedicated local firm number (toll-free available as add-on)",
      gradient: "from-blue-500 to-indigo-500",
    },
    {
      num: "2",
      title: "Set Your Intake Rules",
      desc: "Configure practice areas, question sets, and routing logic",
      gradient: "from-indigo-500 to-purple-500",
    },
    {
      num: "3",
      title: "Go Live",
      desc: "Start capturing leads with summaries delivered to your dashboard",
      gradient: "from-purple-500 to-emerald-500",
    },
  ];

  return (
    <div className="relative max-w-4xl mx-auto" data-testid="graphic-onboarding">
      <div className="hidden md:block absolute top-[2.5rem] left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-1 rounded-full overflow-hidden" aria-hidden="true">
        <div className="w-full h-full bg-gradient-to-r from-blue-500/30 via-indigo-500/30 to-emerald-500/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 animate-pulse opacity-40" />
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {steps.map((step, i) => (
          <div key={i} className="text-center relative">
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mx-auto mb-5 shadow-xl relative z-10`}>
              <span className="text-2xl font-bold text-white">{step.num}</span>
            </div>
            <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DifferentiatorGrid() {
  const items = [
    {
      icon: Shield,
      title: "Rules-First Behavior",
      desc: "What to ask, what to avoid, when to escalate — all configurable",
      accent: "border-blue-500/20 bg-blue-500/5",
      iconBg: "from-blue-500 to-blue-600",
    },
    {
      icon: X,
      title: "No Legal Advice",
      desc: "Only structured intake and scheduling workflows",
      accent: "border-amber-500/20 bg-amber-500/5",
      iconBg: "from-amber-500 to-orange-500",
    },
    {
      icon: Users,
      title: "Firm-Specific Voice",
      desc: "Premium voice + tone customization for your brand",
      accent: "border-purple-500/20 bg-purple-500/5",
      iconBg: "from-purple-500 to-pink-500",
    },
    {
      icon: BarChart3,
      title: "Built for Accountability",
      desc: "Easy to review, audit, and improve over time",
      accent: "border-emerald-500/20 bg-emerald-500/5",
      iconBg: "from-emerald-500 to-teal-500",
    },
  ];

  return (
    <div className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto" data-testid="graphic-differentiators">
      {items.map((item, i) => (
        <div key={i} className={`relative rounded-2xl border p-6 ${item.accent}`} data-testid={`differentiator-item-${i}`}>
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.iconBg} flex items-center justify-center mb-4 shadow-lg`}>
            <item.icon className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
          <p className="text-sm text-muted-foreground">{item.desc}</p>
        </div>
      ))}
    </div>
  );
}

export default function MarketingHomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <PageShell
      title="CaseCurrent — AI Voice Intake for Personal Injury & Family Law"
      description="Capture every lead with rules-first AI intake: 24/7 voice answering, structured summaries, follow-ups, and predictable handoffs for PI and family firms."
    >
      {/* HERO SECTION */}
      <section className="relative overflow-hidden py-20 lg:py-28" data-testid="section-hero">
        <GuillocheUnderlay />
        <HeroGlow />
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-slate-500/5 pointer-events-none" aria-hidden="true" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20" data-testid="badge-hero-label">
                <PulseBeacon color="primary" size="sm" />
                <span className="ml-2">AI-Powered Legal Intake</span>
              </Badge>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight leading-tight" data-testid="text-hero-headline">
                Never miss a{" "}
                <GradientText from="from-primary" to="to-blue-500">case-worthy</GradientText>{" "}
                call again.
              </h1>
              <p className="text-lg lg:text-xl text-muted-foreground max-w-xl leading-relaxed" data-testid="text-hero-description">
                CaseCurrent is an AI voice intake system built for personal injury and family law. It answers 24/7, captures the right details, sends clean follow-ups, and hands your team a structured lead.
              </p>
              
              <div className="flex flex-wrap gap-4 pt-4">
                <Link href="/demo">
                  <Button size="lg" data-testid="button-hero-demo">
                    Book a demo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/how-it-works">
                  <Button size="lg" variant="outline" data-testid="button-hero-how-it-works">
                    See how intake works
                  </Button>
                </Link>
              </div>

              <div className="flex flex-wrap gap-6 pt-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-emerald-500" /> No contracts</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-emerald-500" /> Live in days</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-emerald-500" /> Cancel anytime</span>
              </div>
            </div>

            <IntakePipelineGraphic />
          </div>
        </div>
      </section>

      {/* METRICS BAR */}
      <SectionBackground variant="deep" withMesh meshVariant="steel">
        <section className="py-14" data-testid="section-metrics-bar">
          <div className="container mx-auto px-6">
            <LiveMetricsBar />
          </div>
        </section>
      </SectionBackground>

      {/* PROOF BAR */}
      <section className="border-y border-border py-5 bg-gradient-to-r from-slate-100/80 via-blue-50/50 to-slate-100/80 dark:from-slate-900/80 dark:via-blue-950/30 dark:to-slate-900/80" data-testid="section-proof-bar">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <span className="font-medium">Works with:</span>
            <div className="flex flex-wrap items-center gap-6">
              {["Clio", "MyCase", "LeadDocket", "Webhooks"].map((name) => (
                <span key={name} className="font-semibold text-foreground tracking-wide" data-testid={`text-integration-${name.toLowerCase()}`}>{name}</span>
              ))}
            </div>
            <span className="hidden md:inline mx-4 text-border">|</span>
            <span className="text-muted-foreground" data-testid="text-trusted-by">Trusted by forward-looking firms</span>
          </div>
        </div>
      </section>

      {/* PROBLEM vs SOLUTION */}
      <SectionBackground variant="slate" withMesh meshVariant="midnight">
        <section className="py-20 relative">
          <DecorativeScatter density="sparse" />
          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4" data-testid="text-problem-heading">
                Most firms don't lose leads — they lose <GradientText from="from-red-500" to="to-orange-500">momentum</GradientText>.
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                See the difference between hoping leads stick around and systematically converting them.
              </p>
            </div>
            <ProblemSolutionComparison />
          </div>
        </section>
      </SectionBackground>

      {/* CAPABILITIES */}
      <SectionBackground variant="muted" withMesh meshVariant="ocean">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4" data-testid="text-solution-heading">
                Answer. Qualify. Route. Follow up. <GradientText>Automatically.</GradientText>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                CaseCurrent handles first contact like a disciplined intake specialist: asks the right questions, records the facts, flags urgency, and delivers a predictable handoff.
              </p>
            </div>
            <CapabilityShowcase />
          </div>
        </section>
      </SectionBackground>

      {/* HOW IT WORKS */}
      <SectionBackground variant="deep" withMesh meshVariant="steel">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4" data-testid="text-how-it-works-heading">
                Go live in <GradientText from="from-blue-500" to="to-indigo-500">days</GradientText>, not months.
              </h2>
              <p className="text-muted-foreground">Three steps to a fully automated intake system.</p>
            </div>
            <OnboardingTimeline />
            <p className="text-center text-sm text-muted-foreground mt-10">
              Want a toll-free number? Available as a premium add-on.
            </p>
          </div>
        </section>
      </SectionBackground>

      {/* DIFFERENTIATOR */}
      <SectionBackground variant="slate" withMesh meshVariant="midnight">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4" data-testid="text-differentiator-heading">
                Predictable intake, not <GradientText from="from-purple-500" to="to-pink-500">"AI vibes."</GradientText>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Most AI intake tools optimize for conversation. CaseCurrent optimizes for operational control: consistent questions, consistent routing, consistent records.
              </p>
            </div>
            <DifferentiatorGrid />
          </div>
        </section>
      </SectionBackground>

      {/* PACKAGES */}
      <SectionBackground variant="muted" withMesh meshVariant="ocean">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4" data-testid="text-packages-heading">
                Choose the level of automation you want.
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <PricingCard
                name="Core — Voice Intake"
                price=""
                period=""
                description=""
                features={[
                  "Dedicated firm number",
                  "24/7 voice intake + structured summaries",
                  "Dashboard visibility",
                ]}
                ctaLabel="Get Started"
                ctaHref="/contact"
              />
              <PricingCard
                name="Pro — Voice + SMS"
                price=""
                period=""
                description=""
                features={[
                  "Appointment confirmations/reminders",
                  "Follow-up sequences to complete intake",
                  "Secure document upload nudges via SMS",
                ]}
                ctaLabel="Get Started"
                ctaHref="/contact"
                highlighted
              />
              <PricingCard
                name="Premium — Custom Agent"
                price=""
                period=""
                description=""
                features={[
                  "Firm-specific conversational rules",
                  "Custom question sets/modules (PI + Family)",
                  "Custom routing/escalation logic",
                ]}
                ctaLabel="Contact Sales"
                ctaHref="/contact"
              />
            </div>
            <p className="text-center text-sm text-muted-foreground mt-8">
              Add-on: Toll-free number (premium monthly)
            </p>
          </div>
        </section>
      </SectionBackground>

      {/* FAQ */}
      <SectionBackground variant="deep" withMesh meshVariant="steel">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-faq-heading">
                Common questions
              </h2>
            </div>
            <div className="max-w-3xl mx-auto space-y-3">
              {[
                {
                  q: "Does CaseCurrent give legal advice?",
                  a: "No. CaseCurrent is an intake tool, not a legal advisor. It asks structured questions, captures responses, and routes leads. It never interprets the law.",
                },
                {
                  q: "Can I customize the questions for my practice?",
                  a: "Yes\u2014on Premium plans. Core and Pro use pre-built question sets for PI and Family law.",
                },
                {
                  q: "What happens outside business hours?",
                  a: "CaseCurrent answers 24/7. After-hours calls follow the same intake rules and generate the same structured summaries.",
                },
                {
                  q: "How does it integrate with my CRM?",
                  a: "Via webhooks. We support custom endpoints and are building direct integrations with Clio, MyCase, and LeadDocket.",
                },
              ].map((faq, i) => (
                <div key={i} className="border border-border rounded-xl overflow-hidden" data-testid={`faq-item-${i}`}>
                  <button
                    className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left bg-card hover:bg-muted/30 transition-colors"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    data-testid={`faq-toggle-${i}`}
                  >
                    <h3 className="font-semibold text-foreground">{faq.q}</h3>
                    <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-6 py-4 bg-muted/20 border-t border-border/50">
                      <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </SectionBackground>

      {/* FINAL CTA */}
      <section className="py-20 bg-gradient-to-br from-primary via-blue-600 to-indigo-700 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-32 left-1/4 w-[30rem] h-[30rem] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-20 right-1/3 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50rem] h-[50rem] rounded-full bg-gradient-to-br from-blue-400/10 to-indigo-400/10 blur-3xl" />
        </div>
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Your intake system should work harder than your receptionist.</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto text-lg">
            Schedule a demo and see how CaseCurrent turns missed calls into signed cases.
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
