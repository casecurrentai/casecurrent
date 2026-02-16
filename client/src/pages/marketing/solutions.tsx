import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionBackground } from "@/components/marketing/section-frame";
import { DotGridPattern } from "@/components/marketing/guilloche-pattern";
import { GradientOrb, DecorativeScatter, GradientText, PulseBeacon } from "@/components/marketing/decorative-visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Car,
  Gavel,
  Heart,
  Globe,
  Link2,
  Phone,
  Calendar,
  MessageSquare,
  FileText,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";

const PRACTICE_AREAS = [
  {
    icon: Car,
    name: "Personal Injury",
    description: "Motor vehicle accidents, slip and fall, medical malpractice",
    gradient: "from-blue-500 to-indigo-500",
    bgGlow: "from-blue-500/15 to-indigo-500/15",
    accent: "border-blue-500/20 bg-blue-500/5",
    intakeFields: [
      "Incident date and location",
      "Injury severity",
      "Medical treatment status",
      "Insurance information",
      "Liability indicators",
    ],
  },
  {
    icon: Gavel,
    name: "Criminal Defense",
    description: "DUI, felony charges, misdemeanors, expungements",
    gradient: "from-amber-500 to-orange-500",
    bgGlow: "from-amber-500/15 to-orange-500/15",
    accent: "border-amber-500/20 bg-amber-500/5",
    intakeFields: [
      "Charge type and date",
      "Court and case number",
      "Bail/bond status",
      "Prior record",
      "Urgency level",
    ],
  },
  {
    icon: Heart,
    name: "Family Law",
    description: "Divorce, custody, child support, adoption",
    gradient: "from-pink-500 to-rose-500",
    bgGlow: "from-pink-500/15 to-rose-500/15",
    accent: "border-pink-500/20 bg-pink-500/5",
    intakeFields: [
      "Case type",
      "Children involved",
      "Asset complexity",
      "Opposing counsel",
      "Timeline urgency",
    ],
  },
  {
    icon: Globe,
    name: "Immigration",
    description: "Visa applications, green cards, deportation defense",
    gradient: "from-emerald-500 to-teal-500",
    bgGlow: "from-emerald-500/15 to-teal-500/15",
    accent: "border-emerald-500/20 bg-emerald-500/5",
    intakeFields: [
      "Immigration status",
      "Visa category",
      "Deadline dates",
      "Family petitions",
      "Employer sponsorship",
    ],
  },
];

const INTEGRATIONS = [
  {
    name: "Zapier",
    description: "Connect to 5,000+ apps with no-code automation",
    status: "Available" as const,
    gradient: "from-orange-500 to-red-500",
  },
  {
    name: "Clio",
    description: "Sync leads directly to your Clio Manage contacts",
    status: "Coming Soon" as const,
    gradient: "from-blue-500 to-indigo-500",
  },
  {
    name: "MyCase",
    description: "Automatic lead import to MyCase intake",
    status: "Coming Soon" as const,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    name: "Custom Webhooks",
    description: "Real-time event notifications to any endpoint",
    status: "Available" as const,
    gradient: "from-purple-500 to-pink-500",
  },
];

const OUTCOMES = [
  {
    icon: Phone,
    title: "24/7 Availability",
    description: "Never miss a lead, even outside business hours",
    gradient: "from-blue-500 to-blue-600",
    stat: "100%",
  },
  {
    icon: Zap,
    title: "Faster Response",
    description: "Average response time under 2 minutes",
    gradient: "from-amber-500 to-orange-500",
    stat: "<2min",
  },
  {
    icon: Shield,
    title: "Consistent Quality",
    description: "AI ensures every caller gets the same professional experience",
    gradient: "from-emerald-500 to-teal-500",
    stat: "98%",
  },
  {
    icon: FileText,
    title: "Complete Data",
    description: "Structured intake data ready for case evaluation",
    gradient: "from-purple-500 to-pink-500",
    stat: "100%",
  },
];

export default function SolutionsPage() {
  return (
    <PageShell>
      <Hero
        headline="Solutions for Every Practice"
        subheadline="Tailored intake workflows for the practice areas that matter most. Capture the right information from day one."
        primaryCta={{ label: "Book a Demo", href: "/demo" }}
        secondaryCta={{ label: "Contact Sales", href: "/contact" }}
      />

      <SectionBackground variant="deep" withMesh meshVariant="ocean">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                <GradientText from="from-blue-500" to="to-indigo-500">Practice Areas</GradientText>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                Pre-built intake templates with practice-specific qualification criteria
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {PRACTICE_AREAS.map((area) => (
                <div key={area.name} className="relative group" data-testid={`practice-area-${area.name.toLowerCase().replace(/\s/g, '-')}`}>
                  <div className={`absolute -inset-1 bg-gradient-to-br ${area.bgGlow} rounded-2xl blur-xl opacity-40 group-hover:opacity-70 transition-opacity duration-500`} aria-hidden="true" />
                  <div className={`relative rounded-2xl border p-6 h-full ${area.accent}`}>
                    <div className="flex items-center gap-4 mb-5">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${area.gradient} flex items-center justify-center shadow-xl`}>
                        <area.icon className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl">{area.name}</h3>
                        <p className="text-sm text-muted-foreground">{area.description}</p>
                      </div>
                    </div>
                    <div className="mb-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Intake Fields</h4>
                      <div className="space-y-2">
                        {area.intakeFields.map((field) => (
                          <div key={field} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="text-foreground">{field}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </SectionBackground>

      <SectionBackground variant="slate" withMesh meshVariant="midnight">
        <section className="py-20 relative">
          <DecorativeScatter density="sparse" />
          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                Operational <GradientText from="from-emerald-500" to="to-blue-500">Outcomes</GradientText>
              </h2>
              <p className="text-muted-foreground text-lg">
                Measurable improvements to your intake process
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {OUTCOMES.map((outcome, i) => (
                <div key={i} className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/10 to-blue-500/10 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                  <div className="relative bg-card border border-border/50 rounded-2xl p-6 text-center h-full">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${outcome.gradient} flex items-center justify-center mx-auto mb-4 shadow-xl`}>
                      <outcome.icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-3xl font-bold mb-1">{outcome.stat}</div>
                    <h3 className="font-semibold mb-1">{outcome.title}</h3>
                    <p className="text-sm text-muted-foreground">{outcome.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </SectionBackground>

      <SectionBackground variant="deep" withMesh meshVariant="ocean">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                <GradientText from="from-purple-500" to="to-pink-500">Integrations</GradientText>
              </h2>
              <p className="text-muted-foreground text-lg">
                Connect CaseCurrent to your existing tools
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {INTEGRATIONS.map((integration, i) => (
                <div key={i} className="relative group" data-testid={`integration-${integration.name.toLowerCase().replace(/\s/g, '-')}`}>
                  <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/8 to-blue-500/8 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                  <div className="relative bg-card border border-border/50 rounded-2xl p-5 h-full">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${integration.gradient} flex items-center justify-center shadow-lg`}>
                        <Link2 className="w-5 h-5 text-white" />
                      </div>
                      <span className="font-semibold text-lg">{integration.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {integration.description}
                    </p>
                    <Badge
                      variant="secondary"
                      className={
                        integration.status === "Available"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }
                    >
                      {integration.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </SectionBackground>

      <section className="py-20 bg-gradient-to-br from-primary via-blue-600 to-indigo-700 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-32 right-1/4 w-[30rem] h-[30rem] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">See CaseCurrent for Your Practice Area</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto text-lg">
            Schedule a demo tailored to your specific practice and intake workflow.
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
