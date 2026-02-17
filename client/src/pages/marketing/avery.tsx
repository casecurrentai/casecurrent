import { PageShell } from "@/components/marketing/page-shell";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Phone,
  FileText,
  Brain,
  Webhook,
  CheckCircle,
  ShieldCheck,
  Database,
  Settings,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

// ── Hero card-stack mock ──────────────────────────────────────────────────────

function AveryCardStack() {
  const cards = [
    { icon: Phone, label: "Call recording", color: "text-blue-500" },
    { icon: FileText, label: "Transcript", color: "text-indigo-500" },
    { icon: Brain, label: "Smart summary", color: "text-purple-500" },
    { icon: CheckCircle, label: "Lead fields", color: "text-emerald-500" },
  ];

  return (
    <div
      className="relative w-full max-w-xs mx-auto"
      aria-label="Avery output card stack"
      data-testid="graphic-avery-card-stack"
    >
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-card border border-border/60 rounded-xl px-5 py-3 flex items-center gap-3 shadow-sm mb-2"
            style={{ marginLeft: `${i * 8}px`, marginRight: `${i * 8}px` }}
          >
            <Icon className={`w-5 h-5 shrink-0 ${card.color}`} />
            <span className="text-sm font-medium text-foreground">{card.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Why Avery exists ──────────────────────────────────────────────────────────

function WhyAvery() {
  const bullets = [
    { icon: Phone, text: "Missed calls become qualified leads" },
    { icon: FileText, text: "Staff doesn't have to replay voicemails" },
    { icon: ShieldCheck, text: "Every intake is auditable — recording + transcript" },
  ];

  return (
    <section
      id="why-avery"
      className="py-16 border-t border-border"
      data-testid="section-why-avery"
    >
      <div className="container mx-auto px-6 max-w-3xl">
        <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
          Why Avery exists
        </h2>
        <ul className="space-y-5">
          {bullets.map((b) => {
            const Icon = b.icon;
            return (
              <li key={b.text} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-base text-muted-foreground leading-relaxed pt-1.5">{b.text}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ── What Avery collects ───────────────────────────────────────────────────────

function WhatAveryCollects() {
  const fields = [
    "Caller name + callback number",
    "Case type (PI, MVA, slip & fall, etc.)",
    "Incident date + location",
    "Injuries + treatment status",
    "Insurance + at-fault party (if applicable)",
    "Prior attorney / conflicts check prompt",
  ];

  return (
    <section
      id="what-avery-collects"
      className="py-16 bg-muted/30"
      data-testid="section-what-avery-collects"
    >
      <div className="container mx-auto px-6 max-w-3xl">
        <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
          What Avery collects
        </h2>
        <p className="text-center text-muted-foreground mb-8">
          Structured fields captured on every call.
        </p>
        <ul className="grid sm:grid-cols-2 gap-3">
          {fields.map((f) => (
            <li
              key={f}
              className="flex items-center gap-3 bg-card border border-border/50 rounded-lg px-4 py-3"
            >
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-sm text-foreground">{f}</span>
            </li>
          ))}
        </ul>
        <p className="text-center text-xs text-muted-foreground mt-6 italic">
          Avery adapts questions based on case type.
        </p>
      </div>
    </section>
  );
}

// ── What your team receives ───────────────────────────────────────────────────

function WhatYourTeamReceives() {
  const outputs = [
    {
      icon: Phone,
      title: "Recording + Transcript",
      desc: "Full call recording and speaker-attributed transcript stored automatically.",
      gradient: "from-blue-500 to-indigo-500",
    },
    {
      icon: Brain,
      title: "Smart Summary",
      desc: "Plain-English summary of the call — no replaying required.",
      gradient: "from-purple-500 to-pink-500",
    },
    {
      icon: FileText,
      title: "Structured Lead Fields",
      desc: "CRM-ready structured data from every intake conversation.",
      gradient: "from-emerald-500 to-teal-500",
    },
    {
      icon: Webhook,
      title: "Notifications + Automations",
      desc: "Webhook and Zapier hooks fire instantly when a new lead lands.",
      gradient: "from-orange-500 to-amber-500",
    },
  ];

  return (
    <section
      id="what-your-team-receives"
      className="py-16 border-t border-border"
      data-testid="section-team-receives"
    >
      <div className="container mx-auto px-6">
        <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
          What your team receives
        </h2>
        <p className="text-center text-muted-foreground mb-10">
          Everything you need to evaluate, route, and act on every lead.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {outputs.map((o) => {
            const Icon = o.icon;
            return (
              <div
                key={o.title}
                className="bg-card border border-border/50 rounded-2xl p-6"
              >
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${o.gradient} flex items-center justify-center mb-4`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{o.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{o.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Sample dialogue ───────────────────────────────────────────────────────────

type BubbleProps = {
  from: "avery" | "caller";
  text: string;
};

function Bubble({ from, text }: BubbleProps) {
  const isAvery = from === "avery";
  return (
    <div className={`flex ${isAvery ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isAvery
            ? "bg-primary text-primary-foreground rounded-tl-sm"
            : "bg-muted text-foreground rounded-tr-sm"
        }`}
      >
        {isAvery && (
          <span className="block text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-0.5">
            Avery
          </span>
        )}
        {text}
      </div>
    </div>
  );
}

function SampleDialogue() {
  const exchanges: BubbleProps[] = [
    {
      from: "avery",
      text: "Hi, thanks for calling. I'm Avery, an AI assistant. I can take your information and make sure someone gets back to you quickly. What happened — can you give me a brief overview?",
    },
    {
      from: "caller",
      text: "I was in a car accident last Tuesday. The other driver ran a red light.",
    },
    {
      from: "avery",
      text: "I'm sorry to hear that. Have you seen a doctor or received any medical treatment since the accident?",
    },
    {
      from: "caller",
      text: "I went to urgent care the day after. I've got some neck pain.",
    },
    {
      from: "avery",
      text: "Got it. Do you know whether the other driver's insurance has been contacted yet?",
    },
    {
      from: "caller",
      text: "Not yet. I wanted to talk to a lawyer first.",
    },
    {
      from: "avery",
      text: "What's the best number to reach you? And would you like us to text you a secure link to upload any photos or documents from the accident?",
    },
  ];

  return (
    <section
      id="conversation-style"
      className="py-16 bg-muted/30"
      data-testid="section-dialogue"
    >
      <div className="container mx-auto px-6 max-w-lg">
        <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
          How Avery sounds
        </h2>
        <p className="text-center text-muted-foreground mb-8">
          Human, brief, and professional — never robotic.
        </p>
        <div className="space-y-3">
          {exchanges.map((ex, i) => (
            <Bubble key={i} from={ex.from} text={ex.text} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Safety + Compliance ───────────────────────────────────────────────────────

function SafetySection() {
  const points = [
    {
      icon: ShieldCheck,
      title: "Consent-aware texting",
      desc: "STOP / HELP language included wherever SMS is used, in line with A2P 10DLC requirements.",
    },
    {
      icon: Database,
      title: "Data retention + audit trail",
      desc: "Recordings, transcripts, and structured fields are stored with a complete audit log.",
    },
    {
      icon: Settings,
      title: "Configurable disclaimers",
      desc: "Per-firm disclaimers can be added to call greetings or SMS confirmations.",
    },
  ];

  return (
    <section
      id="safety-compliance"
      className="py-16 border-t border-border"
      data-testid="section-safety"
    >
      <div className="container mx-auto px-6 max-w-3xl">
        <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
          Safety &amp; compliance
        </h2>
        <p className="text-center text-muted-foreground mb-8">
          Built to fit how plaintiff firms actually operate.
        </p>
        <div className="space-y-5">
          {points.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{p.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{p.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Credibility ───────────────────────────────────────────────────────────────

function CredibilitySection() {
  return (
    <section
      id="credibility"
      className="py-14 bg-muted/30 border-t border-border"
      data-testid="section-credibility"
    >
      <div className="container mx-auto px-6 flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground font-medium tracking-wide uppercase">
          Supported by
        </p>
        <a
          href="https://elevenlabs.io/startup-grants"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block"
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
  );
}

// ── Final CTA band ────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section
      id="get-started"
      className="py-20 border-t border-border"
      data-testid="section-cta-final"
    >
      <div className="container mx-auto px-6 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          Run a live test with your firm's number
        </h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          See how Avery handles a real intake call — no script, no demo environment, your actual number.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="mailto:hello@casecurrent.com?subject=Avery%20Onboarding">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Schedule onboarding
            </Button>
          </a>
          <Link href="/demo">
            <Button size="lg" className="w-full sm:w-auto gap-2">
              Talk to Avery <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AveryPage() {
  return (
    <PageShell
      title="Meet Avery — AI Intake Agent | CaseCurrent"
      description="Avery answers missed and after-hours calls, qualifies the case, and delivers a structured intake record instantly."
    >
      {/* Hero */}
      <section
        id="hero"
        className="py-20 md:py-28"
        data-testid="section-avery-hero"
      >
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            {/* Left: copy */}
            <div>
              <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
                AI Intake Agent
              </p>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight mb-5">
                Meet Avery
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Avery answers missed and after-hours calls, qualifies the case,
                and delivers a structured intake record instantly.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/demo">
                  <Button size="lg" className="w-full sm:w-auto gap-2">
                    Talk to Avery <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <a href="#what-your-team-receives">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2">
                    See what gets captured <ChevronDown className="w-4 h-4" />
                  </Button>
                </a>
              </div>
            </div>

            {/* Right: card stack */}
            <div className="flex justify-center">
              <AveryCardStack />
            </div>
          </div>
        </div>
      </section>

      <WhyAvery />
      <WhatAveryCollects />
      <WhatYourTeamReceives />
      <SampleDialogue />
      <SafetySection />
      <CredibilitySection />
      <FinalCTA />
    </PageShell>
  );
}
