import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionBackground } from "@/components/marketing/section-frame";
import { DotGridPattern } from "@/components/marketing/guilloche-pattern";
import { GradientOrb, DecorativeScatter, GradientText, PulseBeacon } from "@/components/marketing/decorative-visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Phone,
  Shield,
  Clock,
  Brain,
  FileText,
  CheckCircle,
  ArrowRight,
  Mic,
  Sparkles,
  Users,
  Globe,
  Volume2,
} from "lucide-react";

// Waveform decoration — subtle SVG bars that evoke an audio fingerprint
function VoiceprintBar({ heights }: { heights: number[] }) {
  return (
    <div className="flex items-center gap-[3px]" aria-hidden="true">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-gradient-to-t from-primary/60 to-primary/20"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}

function AveryCoreCapabilities() {
  const caps = [
    {
      icon: Phone,
      title: "24/7 Voice Intake",
      desc: "Avery answers inbound calls at any hour with your firm's intake rules — practice areas, question sets, urgency flags, and escalation paths all pre-configured.",
      gradient: "from-blue-500 to-indigo-500",
      accent: "border-blue-500/20 bg-blue-500/5",
    },
    {
      icon: Brain,
      title: "Structured Qualification",
      desc: "Every call ends with a clean lead record: contact details, case type, injury or charge specifics, and a priority score your team can act on immediately.",
      gradient: "from-indigo-500 to-purple-500",
      accent: "border-indigo-500/20 bg-indigo-500/5",
    },
    {
      icon: Shield,
      title: "Built-in Legal Guardrails",
      desc: "Avery never gives legal advice. Every call includes clear disclaimers — no attorney-client relationship established, intake purpose only. Your firm controls the language.",
      gradient: "from-amber-500 to-orange-500",
      accent: "border-amber-500/20 bg-amber-500/5",
    },
    {
      icon: FileText,
      title: "Instant Summaries",
      desc: "Clean, structured call summaries delivered to your dashboard within seconds. No messy transcripts — actionable lead data ready for your team.",
      gradient: "from-emerald-500 to-teal-500",
      accent: "border-emerald-500/20 bg-emerald-500/5",
    },
    {
      icon: Clock,
      title: "After-Hours Coverage",
      desc: "Court, depositions, weekends — Avery handles intake while you're unavailable. Leads get the same structured experience as calls during business hours.",
      gradient: "from-cyan-500 to-blue-500",
      accent: "border-cyan-500/20 bg-blue-500/5",
    },
    {
      icon: Users,
      title: "Warm Transfers",
      desc: "On Pro and Elite plans, Avery can screen callers and warm-transfer to an available attorney. High-value leads reach your team before they cool off.",
      gradient: "from-purple-500 to-pink-500",
      accent: "border-purple-500/20 bg-pink-500/5",
    },
  ];

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="graphic-avery-capabilities">
      {caps.map((cap, i) => (
        <div key={i} className={`relative rounded-2xl border p-6 ${cap.accent}`}>
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${cap.gradient} flex items-center justify-center mb-4 shadow-lg`}>
            <cap.icon className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-semibold text-lg mb-1">{cap.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{cap.desc}</p>
        </div>
      ))}
    </div>
  );
}

function VoiceCloneSection() {
  const waveHeights = [8, 14, 20, 28, 18, 32, 24, 16, 28, 20, 36, 24, 16, 28, 22, 18, 30, 24, 14, 20, 28, 18, 32, 24, 16, 28, 20, 14, 10, 8];

  const benefits = [
    "After-hours calls handled in your voice — not a generic AI",
    "Reinforces the personal brand solo practitioners spend years building",
    "Clients trust the voice they recognize before the consultation even begins",
    "No awkward transition between AI intake and human attorney",
  ];

  return (
    <div className="relative" data-testid="section-voice-clone">
      {/* Ambient glow */}
      <div className="absolute -inset-4 bg-gradient-to-br from-primary/8 via-purple-500/5 to-indigo-500/8 rounded-3xl blur-2xl pointer-events-none" aria-hidden="true" />

      <div className="relative bg-card border border-border/60 rounded-3xl overflow-hidden">
        {/* Top accent band */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-purple-500 to-indigo-500" aria-hidden="true" />

        <div className="p-8 lg:p-12">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: copy */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Premium feature
                </Badge>
              </div>

              <h2 className="text-3xl lg:text-4xl font-bold leading-tight">
                Your voice.{" "}
                <GradientText from="from-primary" to="to-purple-500">Your firm.</GradientText>{" "}
                Available 24/7.
              </h2>

              <p className="text-muted-foreground text-lg leading-relaxed">
                Avery can be configured to use a professionally cloned version of your voice through ElevenLabs — giving solo attorneys and small firms a rare advantage: an AI receptionist that sounds personal, credible, and unmistakably aligned with the attorney clients already trust.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                A lawyer's voice is part of their reputation. For solo practitioners, trust is deeply personal. After-hours coverage shouldn't sound generic or outsourced. With attorney voice cloning, it doesn't have to.
              </p>

              <ul className="space-y-3">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-sm text-foreground">{b}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/demo">
                  <Button data-testid="button-voice-clone-demo">
                    Book a Demo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button variant="outline" data-testid="button-voice-clone-contact">
                    Talk to Sales
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right: visual */}
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-br from-primary/12 to-purple-500/12 rounded-2xl blur-xl" aria-hidden="true" />
              <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl shadow-xl p-7 space-y-6">
                {/* Voice ID badge */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg">
                      <Mic className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Attorney Voice ID</p>
                      <p className="text-xs text-muted-foreground">Cloned via ElevenLabs</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <PulseBeacon color="emerald" size="sm" />
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Active</span>
                  </div>
                </div>

                {/* Waveform visualization */}
                <div className="rounded-xl bg-gradient-to-br from-primary/8 to-purple-500/8 border border-primary/10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground">Voice signature</span>
                    </div>
                    <span className="text-xs text-muted-foreground">High fidelity</span>
                  </div>
                  <div className="flex items-center justify-center py-2">
                    <VoiceprintBar heights={waveHeights} />
                  </div>
                </div>

                {/* Sample interaction */}
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Sample after-hours interaction
                  </p>
                  <div className="p-3 rounded-xl bg-muted/50 border border-border/40">
                    <p className="text-sm text-foreground leading-relaxed">
                      <span className="font-medium">Avery:</span> "Thank you for calling the Law Office of [Attorney Name]. This is an AI-assisted intake line. I'd like to gather some information about your situation — everything will be forwarded to the attorney directly…"
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-1">
                    Delivered in the attorney's cloned voice — professional, personal, available.
                  </p>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="outline" className="text-xs">Solo practice</Badge>
                  <Badge variant="outline" className="text-xs">Small firms</Badge>
                  <Badge variant="outline" className="text-xs">Premium add-on</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4 text-center max-w-2xl mx-auto">
        Attorney voice cloning is a premium configuration available on Elite plans and as an add-on for qualifying Pro plans. Voice cloning is performed by ElevenLabs using recordings provided by and consented to by the attorney. Final voice quality depends on source recording length and clarity.
      </p>
    </div>
  );
}

function AveryMultilingualMention() {
  return (
    <div className="relative rounded-2xl border border-border/50 bg-card p-6 lg:p-8" data-testid="section-avery-multilingual">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-xl shrink-0">
          <Globe className="w-7 h-7 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-xl mb-1">Multilingual intake, on request</h3>
          <p className="text-muted-foreground leading-relaxed">
            Avery can also be configured for multilingual voice interactions using ElevenLabs' speech technology — allowing firms serving diverse communities to conduct intake in the caller's preferred language. Language availability depends on the deployment model. Contact us to discuss the right configuration for your practice.
          </p>
        </div>
        <div className="shrink-0">
          <Link href="/contact">
            <Button variant="outline" size="sm" data-testid="button-multilingual-contact">
              Learn more
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AveryPage() {
  return (
    <PageShell
      title="Meet Avery — CaseCurrent's AI Voice Agent"
      description="Avery is CaseCurrent's AI voice intake agent. Available 24/7, configurable for your firm's rules, and optionally cloned in your voice. Built for personal injury and family law."
    >
      <Hero
        headline="Meet Avery — your firm's AI voice agent."
        subheadline="Avery handles inbound calls 24/7 with your firm's intake rules, qualifies leads, delivers structured summaries, and keeps your pipeline moving — even when you can't pick up."
        primaryCta={{ label: "Book a Demo", href: "/demo" }}
        secondaryCta={{ label: "Talk to Avery (Demo Call)", href: "/demo" }}
      >
        <div className="relative">
          <GradientOrb color="primary" size="md" className="absolute -top-10 -right-10 pointer-events-none" />
          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-br from-primary/10 via-blue-500/5 to-purple-500/10 rounded-3xl blur-xl" aria-hidden="true" />
            <div className="relative bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl shadow-2xl p-5 space-y-3">
              {[
                { label: "Inbound Call", sub: "Avery answering...", gradient: "from-blue-500 to-indigo-500", bg: "bg-blue-500/10" },
                { label: "Qualification", sub: "Score: 92/100", gradient: "from-indigo-500 to-purple-500", bg: "bg-indigo-500/10" },
                { label: "Summary Delivered", sub: "Lead flagged — high priority", gradient: "from-emerald-500 to-teal-500", bg: "bg-emerald-500/10" },
              ].map((item, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 ${item.bg} rounded-xl border border-border/30`}>
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-md`}>
                    {i === 0 && <Phone className="w-5 h-5 text-white" />}
                    {i === 1 && <Brain className="w-5 h-5 text-white" />}
                    {i === 2 && <CheckCircle className="w-5 h-5 text-white" />}
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
      </Hero>

      {/* CORE CAPABILITIES */}
      <SectionBackground variant="deep" withMesh meshVariant="ocean">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4" data-testid="text-avery-capabilities-heading">
                What Avery <GradientText from="from-blue-500" to="to-indigo-500">does for your firm</GradientText>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Avery is trained on your firm's practice areas, intake scripts, and rules. Every call follows a disciplined, consistent workflow — no improvisation, no legal advice, no surprises.
              </p>
            </div>
            <AveryCoreCapabilities />
          </div>
        </section>
      </SectionBackground>

      {/* VOICE CLONING */}
      <SectionBackground variant="slate" withMesh meshVariant="midnight">
        <section className="py-20 relative">
          <DecorativeScatter density="sparse" />
          <div className="container mx-auto px-6 relative z-10">
            <VoiceCloneSection />
          </div>
        </section>
      </SectionBackground>

      {/* MULTILINGUAL MENTION */}
      <SectionBackground variant="muted" withMesh meshVariant="ocean">
        <section className="py-16">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto">
              <AveryMultilingualMention />
            </div>
          </div>
        </section>
      </SectionBackground>

      {/* FINAL CTA */}
      <section className="py-20 bg-gradient-to-br from-primary via-blue-600 to-indigo-700 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-32 left-1/4 w-[30rem] h-[30rem] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-20 right-1/3 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Ready to put Avery to work?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto text-lg">
            Book a demo and hear Avery in action — configured for your practice area and intake workflow.
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
