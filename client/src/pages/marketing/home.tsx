import { useState } from "react";
import { PageShell } from "@/components/marketing/page-shell";
import { SectionFrame, BlueprintDivider, SectionBackground } from "@/components/marketing/section-frame";
import { PricingCard } from "@/components/marketing/pricing-card";
import { GuillocheUnderlay, DotGridPattern } from "@/components/marketing/guilloche-pattern";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link } from "wouter";
import {
  Phone,
  Clock,
  Calendar,
  ArrowRight,
  Shield,
  Headphones,
  MessageSquare,
  Webhook,
  BarChart3,
  CheckCircle,
  Play,
  AlertTriangle,
  FileText,
  Users,
  Lock,
  Activity,
  Zap,
  Check,
  X,
} from "lucide-react";

const FEATURES = [
  {
    icon: Headphones,
    title: "24/7 Intake Coverage",
    description: "Calls, voicemails, web inquiries.",
  },
  {
    icon: Calendar,
    title: "Consult Booking",
    description: "Calendar rules + confirmations.",
  },
  {
    icon: AlertTriangle,
    title: "Warm Transfer for Urgent Matters",
    description: "Escalation paths.",
  },
  {
    icon: MessageSquare,
    title: "Automated Follow-Up",
    description: "Text/email sequences for non-converted leads.",
  },
  {
    icon: BarChart3,
    title: "Lead Intelligence Dashboard",
    description: "Summaries, priorities, conversion analytics.",
  },
  {
    icon: Webhook,
    title: "Integrations + Webhooks",
    description: "Push to systems securely.",
  },
];

const GOVERNANCE_ITEMS = [
  "Disclaimers enforced on every intake",
  "Configurable recording + consent language",
  "Role-based access controls",
  "Audit trail of every action and outcome",
  "Data retention rules that match your firm",
];

const BEFORE_ITEMS = [
  "Missed calls after-hours",
  "Inconsistent intake quality",
  "Slow voicemail follow-up",
  "Unstructured lead data",
];

const AFTER_ITEMS = [
  "24/7 capture + routing",
  "Standardized intake every time",
  "Summaries delivered instantly",
  "Analytics your marketing can use",
];

const TIMELINE_STEPS = [
  {
    label: "A",
    title: "Strategy Call (45 min)",
    description: "Scripts, routing, success metrics.",
  },
  {
    label: "B",
    title: "Implementation (3-6 days)",
    description: "Integrations, testing, launch checklist.",
  },
  {
    label: "C",
    title: "Go-Live + Optimization",
    description: "Weekly tuning based on outcomes.",
  },
];

const TESTIMONIALS = [
  {
    firmType: "Personal Injury Firm",
    outcome: "Increased qualified consultations by 40% in the first month.",
  },
  {
    firmType: "Family Law Practice",
    outcome: "Reduced missed after-hours calls to zero.",
  },
  {
    firmType: "Criminal Defense Firm",
    outcome: "Cut intake-to-consultation time from hours to minutes.",
  },
];

export default function MarketingHomePage() {
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [billingAnnual, setBillingAnnual] = useState(true);

  return (
    <PageShell>
      {/* HERO SECTION */}
      <section className="relative overflow-hidden py-20 lg:py-28" data-testid="section-hero">
        <GuillocheUnderlay />
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy */}
            <div className="space-y-6">
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight text-foreground leading-tight" data-testid="text-hero-headline">
                Never miss a case-worthy call again.
              </h1>
              <p className="text-lg lg:text-xl text-muted-foreground max-w-xl leading-relaxed" data-testid="text-hero-description">
                CounselTech answers calls and voicemails 24/7, qualifies leads with your criteria, and routes outcomes instantly—so your team spends time on cases, not callbacks.
              </p>
              
              <div className="flex flex-wrap gap-4 pt-4">
                <Link href="/demo">
                  <Button size="lg" data-testid="button-hero-demo">
                    Book a Demo
                  </Button>
                </Link>
                <Button 
                  size="lg" 
                  variant="outline" 
                  onClick={() => setDemoModalOpen(true)}
                  data-testid="button-hero-listen"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Listen to a Real Intake
                </Button>
              </div>

              {/* Trust Strip */}
              <div className="flex flex-wrap gap-4 pt-6" data-testid="trust-strip">
                <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="trust-item-disclaimers">
                  <Shield className="w-4 h-4 text-primary" />
                  <span>Disclaimers enforced automatically</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="trust-item-routing">
                  <Zap className="w-4 h-4 text-primary" />
                  <span>Configurable routing + warm transfer rules</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="trust-item-recording">
                  <FileText className="w-4 h-4 text-primary" />
                  <span>Recording + structured intake summary</span>
                </div>
              </div>
            </div>

            {/* Right: Product Vignette */}
            <div className="relative">
              <SectionFrame variant="corners" className="p-6">
                <div className="space-y-4">
                  {/* Call in Progress Card */}
                  <Card className="border-primary/20" data-testid="card-call-progress">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <Phone className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm font-medium" data-testid="text-call-status">Call in Progress</div>
                            <div className="text-xs text-muted-foreground" data-testid="text-call-phone">+1 (555) 123-4567</div>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" data-testid="badge-call-live">
                          <Activity className="w-3 h-3 mr-1" />
                          Live
                        </Badge>
                      </div>
                      {/* Waveform */}
                      <div className="h-10 flex items-center gap-0.5 bg-muted/50 rounded px-3">
                        {[...Array(40)].map((_, i) => (
                          <div 
                            key={i} 
                            className="w-1 bg-primary/60 rounded-full" 
                            style={{ height: `${Math.random() * 24 + 8}px` }}
                          />
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 flex justify-between">
                        <span>02:34</span>
                        <span className="text-primary text-[10px] font-medium">Firm script</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Transcript Snippet */}
                  <Card data-testid="card-transcript">
                    <CardContent className="p-4">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Transcript</div>
                      <div className="space-y-2 text-sm" data-testid="text-transcript-content">
                        <p className="text-muted-foreground"><span className="font-medium text-foreground">AI:</span> How can I help you today?</p>
                        <p className="text-muted-foreground"><span className="font-medium text-foreground">Caller:</span> I was in a car accident last week...</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Lead Created Panel */}
                  <Card className="border-emerald-200 dark:border-emerald-800" data-testid="card-lead-created">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-medium text-muted-foreground">Lead Created</div>
                        <span className="text-[10px] text-primary font-medium">Routing rules</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Name</div>
                          <div className="font-medium" data-testid="text-lead-name">Sarah Martinez</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Phone</div>
                          <div className="font-medium" data-testid="text-lead-phone">+1 (555) 123-4567</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Practice Area</div>
                          <div className="font-medium" data-testid="text-lead-practice">Personal Injury</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Urgency</div>
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" data-testid="badge-lead-urgency">High</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Outcome Badge */}
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-600 text-white" data-testid="badge-outcome">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Consult Booked
                    </Badge>
                    <span className="text-[10px] text-primary font-medium">Audit log event</span>
                  </div>
                </div>
              </SectionFrame>
            </div>
          </div>
        </div>
      </section>

      {/* PROOF BAR */}
      <section className="border-y border-border py-6 bg-muted/30" data-testid="section-proof-bar">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <span className="font-medium">Works with:</span>
            <div className="flex flex-wrap items-center gap-6">
              {["Clio", "MyCase", "LeadDocket", "Webhooks"].map((name) => (
                <span key={name} className="font-medium text-foreground" data-testid={`text-integration-${name.toLowerCase()}`}>{name}</span>
              ))}
            </div>
            <span className="hidden md:inline mx-4 text-border">|</span>
            <span className="text-muted-foreground" data-testid="text-trusted-by">Trusted by forward-looking firms</span>
          </div>
        </div>
      </section>

      {/* OUTCOMES SECTION */}
      <SectionBackground variant="subtle">
        <section className="py-20 relative">
          <DotGridPattern />
          <div className="container mx-auto px-6 relative z-10">
            <SectionFrame variant="brackets" className="p-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-outcomes-heading">Outcomes you can measure in week one.</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { 
                    title: "Fewer missed opportunities", 
                    description: "Every inbound is captured, tagged, and queued.",
                    metric: "100%",
                    metricLabel: "Capture Rate"
                  },
                  { 
                    title: "Faster speed-to-lead", 
                    description: "Voicemails become structured intakes in minutes, not hours.",
                    metric: "<5m",
                    metricLabel: "Avg Response"
                  },
                  { 
                    title: "More consistent conversion", 
                    description: "Standardized questions + follow-up automation + consult booking.",
                    metric: "+40%",
                    metricLabel: "Conversion Lift"
                  },
                ].map((item, index) => (
                  <Card key={index} className="relative overflow-hidden" data-testid={`card-outcome-${index}`}>
                    {/* Faint chart ghost */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 opacity-5">
                      <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                        <path 
                          d="M0,40 L20,30 L40,35 L60,20 L80,25 L100,10 L100,40 Z" 
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <CardContent className="p-6 relative">
                      <div className="text-3xl font-bold text-primary mb-1" data-testid={`text-metric-${index}`}>{item.metric}</div>
                      <div className="text-xs text-muted-foreground mb-4">{item.metricLabel}</div>
                      <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                      <p className="text-muted-foreground text-sm">{item.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <BlueprintDivider />

      {/* HOW IT WORKS SECTION */}
      <SectionBackground variant="muted">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <SectionFrame variant="crosshairs" className="p-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-how-it-works-heading">Ring → qualified intake → routed outcome</h2>
              </div>
              <div className="flex flex-col md:flex-row items-start justify-center gap-8 max-w-4xl mx-auto">
                {[
                  { step: "1", title: "Capture", description: "Answer live calls, return missed calls, and process voicemails automatically.", icon: Phone },
                  { step: "2", title: "Qualify", description: "Ask your questions. Flag urgency. Filter by criteria.", icon: CheckCircle },
                  { step: "3", title: "Route & Sync", description: "Book consults, warm transfer urgent matters, and sync the summary.", icon: ArrowRight },
                ].map((item, index) => (
                  <div key={index} className="flex-1 relative" data-testid={`step-how-it-works-${index}`}>
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 border-2 border-primary/20">
                        <item.icon className="w-7 h-7 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2" data-testid={`text-step-title-${index}`}>{item.title}</h3>
                      <p className="text-muted-foreground text-sm">{item.description}</p>
                    </div>
                    {index < 2 && (
                      <div className="hidden md:block absolute top-8 -right-4 w-8">
                        <ArrowRight className="w-6 h-6 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <BlueprintDivider />

      {/* FEATURE GRID */}
      <SectionBackground variant="subtle">
        <section className="py-20 relative">
          <div className="container mx-auto px-6">
            <SectionFrame variant="rails" className="p-8">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {FEATURES.map((feature, index) => (
                  <Card key={feature.title} className="h-full" data-testid={`card-feature-${index}`}>
                    <CardContent className="p-6">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                        <feature.icon className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2" data-testid={`text-feature-title-${index}`}>{feature.title}</h3>
                      <p className="text-muted-foreground text-sm">{feature.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <BlueprintDivider />

      {/* GOVERNANCE / SECURITY SECTION */}
      <SectionBackground variant="muted">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <SectionFrame variant="grid" className="p-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-governance-heading">Built for real firms with real risk.</h2>
              </div>
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-4" data-testid="list-governance">
                  {GOVERNANCE_ITEMS.map((item, index) => (
                    <div key={index} className="flex items-center gap-3" data-testid={`governance-item-${index}`}>
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  {/* Policy Control Panel Mock */}
                  <Card data-testid="card-policy-panel">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Lock className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">Policy & Routing</span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <span className="text-sm">Recording Disclaimer</span>
                          <Badge variant="secondary" data-testid="badge-policy-disclaimer">Enabled</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <span className="text-sm">After-Hours Routing</span>
                          <Badge variant="secondary" data-testid="badge-policy-routing">AI Agent</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <span className="text-sm">Warm Transfer Threshold</span>
                          <Badge variant="secondary" data-testid="badge-policy-threshold">High Urgency</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {/* Audit Log Snippet */}
                  <Card data-testid="card-audit-log">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">Audit Log</span>
                      </div>
                      <div className="space-y-2 text-xs font-mono" data-testid="audit-log-entries">
                        <div className="text-muted-foreground">
                          <span className="text-primary">14:32:01</span> Call answered, disclaimer played
                        </div>
                        <div className="text-muted-foreground">
                          <span className="text-primary">14:34:22</span> Lead created, score: 85
                        </div>
                        <div className="text-muted-foreground">
                          <span className="text-primary">14:34:23</span> Consult booked, synced to Clio
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <BlueprintDivider />

      {/* BEFORE / AFTER SECTION */}
      <SectionBackground variant="subtle">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <SectionFrame variant="minimal" className="p-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-before-after-heading">Standardize intake without adding headcount.</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <Card className="border-destructive/20" data-testid="card-before">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <X className="w-5 h-5 text-destructive" />
                      <span className="font-semibold">Without CounselTech</span>
                    </div>
                    <ul className="space-y-3">
                      {BEFORE_ITEMS.map((item, index) => (
                        <li key={index} className="flex items-center gap-2 text-muted-foreground" data-testid={`before-item-${index}`}>
                          <div className="w-1.5 h-1.5 rounded-full bg-destructive/50" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card className="border-emerald-500/20" data-testid="card-after">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-semibold">With CounselTech</span>
                    </div>
                    <ul className="space-y-3">
                      {AFTER_ITEMS.map((item, index) => (
                        <li key={index} className="flex items-center gap-2 text-foreground" data-testid={`after-item-${index}`}>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <BlueprintDivider />

      {/* PRICING SECTION */}
      <SectionBackground variant="muted">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-pricing-heading">Simple, transparent pricing</h2>
              <div className="flex items-center justify-center gap-3">
                <span className={billingAnnual ? "text-muted-foreground" : "text-foreground font-medium"}>Monthly</span>
                <Switch 
                  checked={billingAnnual} 
                  onCheckedChange={setBillingAnnual}
                  data-testid="switch-billing"
                />
                <span className={billingAnnual ? "text-foreground font-medium" : "text-muted-foreground"}>
                  Annual <Badge variant="secondary" className="ml-1" data-testid="badge-savings">Save 20%</Badge>
                </span>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <PricingCard
                name="Starter"
                price={billingAnnual ? "$199" : "$249"}
                period="/month"
                description="Best for solo practitioners and new firms"
                features={[
                  "24/7 intake + voicemail",
                  "Structured summaries",
                  "Basic routing rules",
                  "Email notifications",
                  "Standard support",
                ]}
                ctaLabel="Get Started"
                ctaHref="/contact"
              />
              <PricingCard
                name="Growth"
                price={billingAnnual ? "$399" : "$499"}
                period="/month"
                description="For growing firms with multiple practice areas"
                features={[
                  "Everything in Starter",
                  "Follow-up sequences",
                  "Consult booking",
                  "Clio/MyCase integration",
                  "Priority support",
                ]}
                ctaLabel="Get Started"
                ctaHref="/contact"
                highlighted
              />
              <PricingCard
                name="Enterprise"
                price="Custom"
                period=""
                description="For firms with advanced governance needs"
                features={[
                  "Everything in Growth",
                  "Advanced governance",
                  "Custom dashboards",
                  "Security controls",
                  "Dedicated success manager",
                ]}
                ctaLabel="Contact Sales"
                ctaHref="/contact"
              />
            </div>
            <p className="text-center text-sm text-muted-foreground mt-8">
              Implementation support included with all plans.
            </p>
          </div>
        </section>
      </SectionBackground>

      <BlueprintDivider />

      {/* ONBOARDING TIMELINE SECTION */}
      <SectionBackground variant="subtle">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <SectionFrame variant="corners" className="p-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-onboarding-heading">Live in days, not months.</h2>
              </div>
              <div className="flex flex-col md:flex-row items-start justify-center gap-8 max-w-4xl mx-auto">
                {TIMELINE_STEPS.map((step, index) => (
                  <div key={index} className="flex-1 relative" data-testid={`step-onboarding-${index}`}>
                    <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-4 font-bold text-lg" data-testid={`step-label-${step.label}`}>
                        {step.label}
                      </div>
                      <h3 className="font-semibold text-lg mb-2" data-testid={`text-onboarding-title-${index}`}>{step.title}</h3>
                      <p className="text-muted-foreground text-sm">{step.description}</p>
                    </div>
                    {index < TIMELINE_STEPS.length - 1 && (
                      <div className="hidden md:block absolute top-6 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-border" />
                    )}
                  </div>
                ))}
              </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <BlueprintDivider />

      {/* TESTIMONIALS SECTION */}
      <SectionBackground variant="muted">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-testimonials-heading">Firms don't need more calls. They need more signed matters.</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {TESTIMONIALS.map((testimonial, index) => (
                <Card key={index} data-testid={`card-testimonial-${index}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Users className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium text-sm" data-testid={`text-testimonial-firm-${index}`}>{testimonial.firmType}</div>
                        <div className="text-xs text-muted-foreground">Verified Customer</div>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm italic" data-testid={`text-testimonial-quote-${index}`}>"{testimonial.outcome}"</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </SectionBackground>

      {/* FINAL CTA SECTION */}
      <section className="relative py-20 bg-slate-900 dark:bg-slate-950 text-white overflow-hidden" data-testid="section-final-cta">
        <div className="absolute inset-0 opacity-10">
          <GuillocheUnderlay />
        </div>
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl font-bold mb-4" data-testid="text-final-headline">Ready to stop losing cases while you sleep?</h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            See exactly how CounselTech handles your calls—script, disclaimers, routing, and integrations included.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/demo">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100" data-testid="button-final-demo">
                Book a Demo
              </Button>
            </Link>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-white/30 text-white hover:bg-white/10"
              onClick={() => setDemoModalOpen(true)}
              data-testid="button-final-listen"
            >
              <Play className="w-4 h-4 mr-2" />
              Listen to a Real Intake
            </Button>
          </div>
        </div>
      </section>

      {/* DEMO MODAL */}
      <Dialog open={demoModalOpen} onOpenChange={setDemoModalOpen}>
        <DialogContent className="max-w-4xl" data-testid="dialog-demo">
          <DialogHeader>
            <DialogTitle data-testid="text-demo-title">Hear exactly what your callers experience.</DialogTitle>
            <DialogDescription>
              Professional, calm, and configured to your script, disclaimers, and routing rules.
            </DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-6 mt-4">
            {/* Left: Waveform + Transcript */}
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" data-testid="button-play-demo">
                      <Play className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium">Sample Intake Call</span>
                  </div>
                  <span className="text-xs text-muted-foreground">2:34</span>
                </div>
                {/* Waveform */}
                <div className="h-16 flex items-center gap-0.5">
                  {[...Array(60)].map((_, i) => (
                    <div 
                      key={i} 
                      className="flex-1 bg-primary/40 rounded-full" 
                      style={{ height: `${Math.random() * 48 + 16}px` }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <span className="font-medium text-primary">AI:</span> Thank you for calling Smith Law. This call may be recorded. How can I help you today?
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <span className="font-medium text-foreground">Caller:</span> Hi, I was in a car accident last week and I think I need a lawyer.
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <span className="font-medium text-primary">AI:</span> I'm sorry to hear that. Let me gather some information to connect you with the right attorney...
                </div>
              </div>
            </div>
            {/* Right: Extracted Intake Card */}
            <div>
              <Card data-testid="card-extracted-intake">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-semibold">Extracted Intake</span>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Name</div>
                        <div className="font-medium">Sarah Martinez</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Phone</div>
                        <div className="font-medium">+1 (555) 123-4567</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Practice Area</div>
                        <Badge variant="secondary">Personal Injury</Badge>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Urgency</div>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">High</Badge>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Notes</div>
                      <p className="text-sm text-muted-foreground">Car accident last week. Looking for legal representation. Ready to schedule consultation.</p>
                    </div>
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Outcome</span>
                        <Badge className="bg-emerald-600 text-white">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Consult Booked
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
