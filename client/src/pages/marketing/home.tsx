import { PageShell } from "@/components/marketing/page-shell";
import { SectionFrame, BlueprintDivider, SectionBackground } from "@/components/marketing/section-frame";
import { PricingCard } from "@/components/marketing/pricing-card";
import { GuillocheUnderlay, DotGridPattern } from "@/components/marketing/guilloche-pattern";
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
} from "lucide-react";

export default function MarketingHomePage() {
  return (
    <PageShell
      title="CounselTech — AI Voice Intake for Personal Injury & Family Law"
      description="Capture every lead with rules-first AI intake: 24/7 voice answering, structured summaries, follow-ups, and predictable handoffs for PI and family firms."
    >
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
                CounselTech is an AI voice intake system built for personal injury and family law. It answers 24/7, captures the right details, sends clean follow-ups, and hands your team a structured lead—without sounding like a robot.
              </p>
              
              <div className="flex flex-wrap gap-4 pt-4">
                <Link href="/demo">
                  <Button size="lg" data-testid="button-hero-demo">
                    Book a demo
                  </Button>
                </Link>
                <Link href="/how-it-works">
                  <Button size="lg" variant="outline" data-testid="button-hero-how-it-works">
                    See how intake works
                  </Button>
                </Link>
              </div>

              {/* Micro-proof */}
              <p className="text-sm text-muted-foreground pt-4" data-testid="text-micro-proof">
                Built for firms that want more signed cases, fewer dropped leads, and zero chaos.
              </p>
            </div>

            {/* Right: Product Vignette */}
            <div className="relative">
              <SectionFrame variant="corners" className="p-6">
                <div className="space-y-4">
                  {/* Call in Progress Card */}
                  <Card className="border-primary/20" data-testid="card-call-progress">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
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
                      <div className="text-xs text-muted-foreground mt-2 flex justify-between gap-2">
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
                      <div className="flex items-center justify-between gap-2 mb-3">
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
                  <div className="flex items-center justify-between gap-2">
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

      {/* PROBLEM SECTION */}
      <SectionBackground variant="subtle">
        <section className="py-20 relative">
          <DotGridPattern />
          <div className="container mx-auto px-6 relative z-10">
            <SectionFrame variant="brackets" className="p-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-problem-heading">
                  Most firms don't lose leads—they lose momentum.
                </h2>
              </div>
              <div className="max-w-3xl mx-auto">
                <ul className="space-y-4">
                  <li className="flex items-start gap-3" data-testid="problem-item-0">
                    <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="w-4 h-4 text-destructive" />
                    </div>
                    <span className="text-muted-foreground">Missed calls after hours (and during peak hours) become "I called someone else."</span>
                  </li>
                  <li className="flex items-start gap-3" data-testid="problem-item-1">
                    <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="w-4 h-4 text-destructive" />
                    </div>
                    <span className="text-muted-foreground">Intake is inconsistent: great one day, messy the next.</span>
                  </li>
                  <li className="flex items-start gap-3" data-testid="problem-item-2">
                    <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="w-4 h-4 text-destructive" />
                    </div>
                    <span className="text-muted-foreground">Staff time gets burned on back-and-forth just to gather basics.</span>
                  </li>
                  <li className="flex items-start gap-3" data-testid="problem-item-3">
                    <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="w-4 h-4 text-destructive" />
                    </div>
                    <span className="text-muted-foreground">The lead goes cold before you ever get a clean summary.</span>
                  </li>
                </ul>
                <p className="text-center mt-8 text-foreground font-medium" data-testid="text-problem-closer">
                  CounselTech turns every inbound call into a controlled, trackable intake flow.
                </p>
              </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <BlueprintDivider />

      {/* SOLUTION SECTION */}
      <SectionBackground variant="muted">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <SectionFrame variant="crosshairs" className="p-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-solution-heading">
                  Answer. Qualify. Route. Follow up. Automatically.
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  CounselTech handles first contact like a disciplined intake specialist: it asks the right questions, records the right facts, flags urgency, and gives your firm a predictable handoff every time.
                </p>
              </div>
              <div className="max-w-3xl mx-auto">
                <ul className="space-y-4">
                  <li className="flex items-start gap-3" data-testid="solution-item-0">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground">24/7 voice intake using your firm's rules and practice areas</span>
                  </li>
                  <li className="flex items-start gap-3" data-testid="solution-item-1">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground">Structured lead summaries (not messy transcripts)</span>
                  </li>
                  <li className="flex items-start gap-3" data-testid="solution-item-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground">Lead routing + priority flags for time-sensitive matters</span>
                  </li>
                  <li className="flex items-start gap-3" data-testid="solution-item-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground">Secure intake link when the caller prefers to finish on their phone</span>
                  </li>
                  <li className="flex items-start gap-3" data-testid="solution-item-4">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground">Document upload nudges with secure links (when SMS is enabled)</span>
                  </li>
                  <li className="flex items-start gap-3" data-testid="solution-item-5">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground">Clear audit trail of what was asked, answered, and sent</span>
                  </li>
                </ul>
              </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <BlueprintDivider />

      {/* HOW IT WORKS SECTION */}
      <SectionBackground variant="subtle">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <SectionFrame variant="corners" className="p-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-how-it-works-heading">
                  Go live in days, not months.
                </h2>
              </div>
              <div className="flex flex-col md:flex-row items-start justify-center gap-8 max-w-4xl mx-auto">
                <div className="flex-1 relative" data-testid="step-how-it-works-0">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-4 font-bold text-lg">
                      1
                    </div>
                    <p className="text-muted-foreground text-sm">Provision a dedicated firm number (local by default)</p>
                  </div>
                  <div className="hidden md:block absolute top-6 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-border" />
                </div>
                <div className="flex-1 relative" data-testid="step-how-it-works-1">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-4 font-bold text-lg">
                      2
                    </div>
                    <p className="text-muted-foreground text-sm">Set your intake rules (PI, Family, or both)</p>
                  </div>
                  <div className="hidden md:block absolute top-6 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-border" />
                </div>
                <div className="flex-1" data-testid="step-how-it-works-2">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-4 font-bold text-lg">
                      3
                    </div>
                    <p className="text-muted-foreground text-sm">Start capturing leads with summaries delivered to your dashboard/workflow</p>
                  </div>
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground mt-8">
                Want a toll-free number? Offer it as a premium add-on.
              </p>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <BlueprintDivider />

      {/* DIFFERENTIATOR SECTION */}
      <SectionBackground variant="muted">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <SectionFrame variant="grid" className="p-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-differentiator-heading">
                  Predictable intake, not "AI vibes."
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Most AI intake tools optimize for conversation. CounselTech optimizes for operational control: consistent questions, consistent routing, consistent records. Your firm gets a repeatable intake machine—not a novelty.
                </p>
              </div>
              <div className="max-w-3xl mx-auto">
                <ul className="space-y-4">
                  <li className="flex items-start gap-3" data-testid="differentiator-item-0">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground">Rules-first behavior (what to ask, what to avoid, when to escalate)</span>
                  </li>
                  <li className="flex items-start gap-3" data-testid="differentiator-item-1">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground">No legal advice—only structured intake and scheduling workflows</span>
                  </li>
                  <li className="flex items-start gap-3" data-testid="differentiator-item-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground">Firm-specific voice + tone (premium customization)</span>
                  </li>
                  <li className="flex items-start gap-3" data-testid="differentiator-item-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground">Designed for accountability (easy to review and audit)</span>
                  </li>
                </ul>
              </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <BlueprintDivider />

      {/* PACKAGES SECTION */}
      <SectionBackground variant="subtle">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-packages-heading">
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

      <BlueprintDivider />

      {/* FAQ SECTION */}
      <SectionBackground variant="muted">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <SectionFrame variant="minimal" className="p-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-faq-heading">
                  FAQ
                </h2>
              </div>
              <div className="max-w-3xl mx-auto space-y-8">
                <div data-testid="faq-item-0">
                  <h3 className="font-semibold text-foreground mb-2">Does this replace my staff?</h3>
                  <p className="text-muted-foreground">No. It protects your staff by handling first-contact intake and giving them clean, structured handoffs.</p>
                </div>
                <div data-testid="faq-item-1">
                  <h3 className="font-semibold text-foreground mb-2">Will it give legal advice?</h3>
                  <p className="text-muted-foreground">No. It captures facts, preferences, and urgency—then routes to your team.</p>
                </div>
                <div data-testid="faq-item-2">
                  <h3 className="font-semibold text-foreground mb-2">Can we control what it asks?</h3>
                  <p className="text-muted-foreground">Yes. Your firm chooses practice areas, disqualifiers, escalation triggers, and intake depth.</p>
                </div>
                <div data-testid="faq-item-3">
                  <h3 className="font-semibold text-foreground mb-2">What if a caller is urgent or unsafe?</h3>
                  <p className="text-muted-foreground">You set escalation rules (transfer, emergency guidance, staff alerts).</p>
                </div>
              </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      {/* FINAL CTA SECTION */}
      <section className="relative py-20 bg-slate-900 dark:bg-slate-950 text-white overflow-hidden" data-testid="section-final-cta">
        <div className="absolute inset-0 opacity-10">
          <GuillocheUnderlay />
        </div>
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl font-bold mb-4" data-testid="text-final-headline">
            Turn missed calls into signed cases.
          </h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            If your firm is serious about conversion and control, CounselTech is built for you.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/demo">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100" data-testid="button-final-demo">
                Book a demo
              </Button>
            </Link>
            <Link href="/how-it-works">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white/30 text-white hover:bg-white/10"
                data-testid="button-final-how-it-works"
              >
                See how intake works
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
