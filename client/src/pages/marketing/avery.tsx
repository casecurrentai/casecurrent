/**
 * /avery — Meet Avery marketing page
 *
 * Design consistency:
 *  - Hero: @/components/marketing/hero (same as solutions, how-it-works, security)
 *  - Section wrappers: SectionBackground variants matching solutions.tsx
 *  - Cards: FeatureCard from @/components/marketing/feature-card (same card used on pricing/how-it-works)
 *  - Bullet lists: TrustList from @/components/marketing/trust-list (same as security page)
 *  - UI mock: UIFrame from @/components/marketing/ui-frame (same as how-it-works)
 *  - Section headers: text-center mb-14 / text-3xl lg:text-4xl — exact solutions.tsx pattern
 *  - CheckCircle intake-field rows: exact solutions.tsx line 186-189 pattern
 *  - Final CTA: exact solutions.tsx lines 275-299
 *  - Icons: lucide-react only (same source as every other marketing page)
 *  - No inline styles, no new dependencies, no new CSS
 */
import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionBackground } from "@/components/marketing/section-frame";
import { FeatureCard } from "@/components/marketing/feature-card";
import { TrustList } from "@/components/marketing/trust-list";
import { UIFrame } from "@/components/marketing/ui-frame";
import { GradientText, DecorativeScatter } from "@/components/marketing/decorative-visuals";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Phone,
  FileText,
  Brain,
  Bell,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

// ── Data ─────────────────────────────────────────────────────────────────────

const HERO_OUTPUTS = [
  { icon: Phone, label: "Call recording", gradient: "from-blue-500 to-indigo-500" },
  { icon: FileText, label: "Transcript", gradient: "from-indigo-500 to-purple-500" },
  { icon: Brain, label: "Smart summary", gradient: "from-purple-500 to-pink-500" },
  { icon: CheckCircle, label: "Lead fields", gradient: "from-emerald-500 to-teal-500" },
] as const;

const WHY_AVERY = [
  {
    title: "Missed calls become qualified leads",
    description:
      "Avery answers 24/7, so every inbound call becomes a structured intake record — not a lost opportunity.",
  },
  {
    title: "Staff doesn't have to replay voicemails",
    description:
      "The transcript and plain-English summary are ready the moment the call ends.",
  },
  {
    title: "Every intake is auditable",
    description:
      "Recording, transcript, and structured fields are stored with a complete audit trail.",
  },
];

const INTAKE_FIELDS = [
  "Caller name + callback number",
  "Case type (PI, MVA, slip & fall, etc.)",
  "Incident date + location",
  "Injuries + treatment status",
  "Insurance + at-fault party (if applicable)",
  "Prior attorney / conflicts check prompt",
];

const OUTPUTS = [
  {
    icon: Phone,
    title: "Recording + Transcript",
    description:
      "Full call recording and speaker-attributed transcript stored automatically.",
  },
  {
    icon: Brain,
    title: "Smart Summary",
    description:
      "Plain-English summary of the call — no replaying or note-taking required.",
  },
  {
    icon: FileText,
    title: "Structured Lead Fields",
    description: "CRM-ready structured data from every intake conversation.",
  },
  {
    icon: Bell,
    title: "Notifications + Automations",
    description:
      "Webhook and Zapier hooks fire instantly when a new lead lands.",
  },
] as const;

const DIALOGUE = [
  {
    from: "avery" as const,
    text: "Hi, thanks for calling. I'm Avery, an AI assistant. I can take your information and make sure someone gets back to you quickly. What happened — can you give me a brief overview?",
  },
  { from: "caller" as const, text: "I was in a car accident last Tuesday. The other driver ran a red light." },
  {
    from: "avery" as const,
    text: "I'm sorry to hear that. Have you seen a doctor or received any medical treatment since the accident?",
  },
  { from: "caller" as const, text: "I went to urgent care the day after. I've got some neck pain." },
  {
    from: "avery" as const,
    text: "Got it. Do you know whether the other driver's insurance has been contacted yet?",
  },
  { from: "caller" as const, text: "Not yet. I wanted to talk to a lawyer first." },
  {
    from: "avery" as const,
    text: "What's the best number to reach you? And would you like us to text you a secure link to upload any photos or documents from the accident?",
  },
];

const SAFETY_ITEMS = [
  {
    title: "Consent-aware texting",
    description:
      "STOP / HELP language included wherever SMS is used, in line with A2P 10DLC requirements.",
  },
  {
    title: "Data retention + audit trail",
    description:
      "Recordings, transcripts, and structured fields are stored with a complete audit log.",
  },
  {
    title: "Configurable disclaimers",
    description:
      "Per-firm disclaimers can be added to call greetings or SMS confirmations.",
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AveryPage() {
  return (
    <PageShell
      title="Meet Avery — AI Intake Agent | CaseCurrent"
      description="Avery answers missed and after-hours calls, qualifies the case, and delivers a structured intake record instantly."
    >
      {/* ── Hero ── */}
      <Hero
        headline="Meet Avery"
        subheadline="Avery answers missed and after-hours calls, qualifies the case, and delivers a structured intake record instantly."
        primaryCta={{ label: "Talk to Avery", href: "/demo" }}
        secondaryCta={{ label: "See what gets captured", href: "#what-your-team-receives" }}
      >
        {/* Right-side: UIFrame card stack — same component as how-it-works.tsx */}
        <UIFrame title="Avery · New Intake" data-testid="graphic-avery-card-stack">
          <div className="space-y-2">
            {HERO_OUTPUTS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-muted/60 to-muted/30 border border-border/40"
                >
                  <div
                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-lg`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <div className="ml-auto w-16 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-r from-emerald-500/60 to-emerald-400/40 rounded-full" />
                  </div>
                </div>
              );
            })}
            <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Intake complete · Lead created
              </p>
            </div>
          </div>
        </UIFrame>
      </Hero>

      {/* ── Why Avery exists ── */}
      <SectionBackground variant="muted" withMesh meshVariant="ocean">
        <section className="py-20" data-testid="section-why-avery">
          <div className="container mx-auto px-6 max-w-3xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                Why Avery <GradientText from="from-blue-500" to="to-indigo-500">exists</GradientText>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                Every missed call is a case that never got to you.
              </p>
            </div>
            <TrustList items={WHY_AVERY} />
          </div>
        </section>
      </SectionBackground>

      {/* ── What Avery collects ── */}
      <SectionBackground variant="deep" withMesh meshVariant="steel">
        <section className="py-20" data-testid="section-what-avery-collects">
          <div className="container mx-auto px-6">
            <div className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                What Avery{" "}
                <GradientText from="from-emerald-500" to="to-blue-500">collects</GradientText>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                Structured fields captured on every call.
              </p>
            </div>
            {/* Same CheckCircle + span pattern as solutions.tsx lines 186-189 */}
            <div className="grid md:grid-cols-2 gap-x-10 gap-y-3 max-w-2xl mx-auto mb-8">
              {INTAKE_FIELDS.map((field) => (
                <div key={field} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-foreground">{field}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground italic">
              Avery adapts questions based on case type.
            </p>
          </div>
        </section>
      </SectionBackground>

      {/* ── What your team receives ── */}
      <SectionBackground variant="slate" withMesh meshVariant="midnight">
        <section
          id="what-your-team-receives"
          className="py-20 relative"
          data-testid="section-team-receives"
        >
          <DecorativeScatter density="sparse" />
          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                What your team{" "}
                <GradientText from="from-purple-500" to="to-pink-500">receives</GradientText>
              </h2>
              <p className="text-muted-foreground text-lg">
                Everything you need to evaluate, route, and act on every lead.
              </p>
            </div>
            {/* FeatureCard — same component used on pricing/how-it-works */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {OUTPUTS.map((o) => (
                <FeatureCard
                  key={o.title}
                  icon={o.icon}
                  title={o.title}
                  description={o.description}
                />
              ))}
            </div>
          </div>
        </section>
      </SectionBackground>

      {/* ── How Avery sounds ── */}
      <SectionBackground variant="muted" withMesh meshVariant="cool">
        <section className="py-20" data-testid="section-dialogue">
          <div className="container mx-auto px-6">
            <div className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                How Avery{" "}
                <GradientText from="from-blue-500" to="to-indigo-500">sounds</GradientText>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                Human, brief, and professional — never robotic.
              </p>
            </div>
            <div className="max-w-lg mx-auto">
              {/* UIFrame — same component as how-it-works.tsx dashboard preview */}
              <UIFrame title="Sample call — inbound PI inquiry">
                <div className="space-y-3">
                  {DIALOGUE.map((line, i) => (
                    <div
                      key={i}
                      className={`flex ${line.from === "avery" ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          line.from === "avery"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {line.text}
                      </div>
                    </div>
                  ))}
                </div>
              </UIFrame>
            </div>
          </div>
        </section>
      </SectionBackground>

      {/* ── Safety & compliance ── */}
      <SectionBackground variant="deep" withMesh meshVariant="blue-purple">
        <section className="py-20" data-testid="section-safety">
          <div className="container mx-auto px-6 max-w-3xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                Safety &amp;{" "}
                <GradientText from="from-blue-500" to="to-purple-500">compliance</GradientText>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                Built to fit how plaintiff firms actually operate.
              </p>
            </div>
            <TrustList items={SAFETY_ITEMS} />
          </div>
        </section>
      </SectionBackground>

      {/* ── Credibility ── */}
      <section className="py-14 border-t border-border" data-testid="section-credibility">
        <div className="container mx-auto px-6 flex flex-col items-center gap-4 text-center">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Supported by
          </p>
          <a
            href="https://elevenlabs.io/startup-grants"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-elevenlabs-grants-avery"
          >
            <img
              src="https://eleven-public-cdn.elevenlabs.io/payloadcms/pwsc4vchsqt-ElevenLabsGrants.webp"
              alt="ElevenLabs Startup Grants"
              className="w-40 sm:w-52 lg:w-64 h-auto"
            />
          </a>
          <p className="text-sm text-muted-foreground">Built for plaintiff firms.</p>
        </div>
      </section>

      {/* ── Final CTA — exact solutions.tsx pattern (lines 275-299) ── */}
      <section
        className="py-20 bg-gradient-to-br from-primary via-blue-600 to-indigo-700 text-primary-foreground relative overflow-hidden"
        data-testid="section-cta-final"
      >
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-32 right-1/4 w-[30rem] h-[30rem] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Run a live test with your firm's number
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto text-lg">
            See how Avery handles a real intake call — no script, no demo environment, your actual number.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="mailto:hello@casecurrent.com?subject=Avery%20Onboarding">
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                data-testid="button-cta-onboarding"
              >
                Schedule onboarding
              </Button>
            </a>
            <Link href="/demo">
              <Button size="lg" variant="secondary" data-testid="button-cta-demo">
                Talk to Avery
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
