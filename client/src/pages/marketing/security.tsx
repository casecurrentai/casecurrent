import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionBackground } from "@/components/marketing/section-frame";
import { DecorativeScatter, GradientText } from "@/components/marketing/decorative-visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Shield, Lock, Eye, Database, Users, FileCheck, CheckCircle, ArrowRight, Key, Server } from "lucide-react";

const TRUST_ITEMS = [
  {
    icon: Users,
    title: "Role-Based Access Control (RBAC)",
    description: "Owner, admin, staff, and viewer roles with granular permissions",
    gradient: "from-blue-500 to-indigo-500",
  },
  {
    icon: Eye,
    title: "Complete Audit Logging",
    description: "Every action is logged with actor, timestamp, and change details",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: Lock,
    title: "Encryption in Transit",
    description: "TLS 1.3 for all data transmission between clients and servers",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: Key,
    title: "Encryption at Rest",
    description: "AES-256 encryption for stored data and backups",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: Database,
    title: "Data Retention Controls",
    description: "Configurable retention policies per organization",
    gradient: "from-cyan-500 to-blue-500",
  },
  {
    icon: Server,
    title: "Multi-Tenant Isolation",
    description: "Strict org_id scoping ensures complete data separation",
    gradient: "from-slate-500 to-slate-600",
  },
];

const SECURITY_PILLARS = [
  {
    icon: Lock,
    title: "Secure Infrastructure",
    description: "Hosted on enterprise-grade cloud infrastructure with network isolation, DDoS protection, and continuous monitoring.",
    gradient: "from-blue-500 to-indigo-500",
    bgGlow: "from-blue-500/15 to-indigo-500/15",
    details: ["JWT-based authentication", "Role hierarchy enforcement", "Session management", "API key rotation support"],
  },
  {
    icon: Eye,
    title: "Transparent Logging",
    description: "Comprehensive audit logs capture every data access and modification, exportable for compliance reviews.",
    gradient: "from-emerald-500 to-teal-500",
    bgGlow: "from-emerald-500/15 to-teal-500/15",
    details: ["Real-time audit trail", "Anomaly detection", "Access pattern analysis", "Security alerts"],
  },
  {
    icon: Database,
    title: "Data Boundaries",
    description: "Strict org_id scoping ensures complete tenant isolation at the database level with cascading delete protection.",
    gradient: "from-purple-500 to-pink-500",
    bgGlow: "from-purple-500/15 to-pink-500/15",
    details: ["Field-level encryption", "Secure credential storage", "PII handling compliance", "Automatic data masking"],
  },
];

export default function SecurityPage() {
  return (
    <PageShell>
      <Hero
        headline="Trust & Security"
        subheadline="Security you can explain to a law firm. Built with compliance, auditability, and data protection as foundational requirements."
        primaryCta={{ label: "Book a Demo", href: "/demo" }}
        secondaryCta={{ label: "Contact Sales", href: "/contact" }}
      />

      <SectionBackground variant="deep" withMesh meshVariant="ocean">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                <GradientText from="from-blue-500" to="to-indigo-500">Trust</GradientText> Checklist
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Enterprise-grade security built into every layer of the platform
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {TRUST_ITEMS.map((item, i) => (
                <div key={i} className="relative group" data-testid={`trust-item-${i}`}>
                  <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/8 to-blue-500/8 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                  <div className="relative bg-card border border-border/50 rounded-2xl p-5 h-full">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
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
                Unrelenting <GradientText from="from-emerald-500" to="to-blue-500">Security</GradientText>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                Every layer of the platform is designed with security-first principles
              </p>
            </div>
            <div className="grid lg:grid-cols-3 gap-6">
              {SECURITY_PILLARS.map((pillar, i) => (
                <div key={i} className="relative group" data-testid={`security-pillar-${i}`}>
                  <div className={`absolute -inset-1 bg-gradient-to-br ${pillar.bgGlow} rounded-2xl blur-xl opacity-40 group-hover:opacity-70 transition-opacity duration-500`} aria-hidden="true" />
                  <div className="relative bg-card border border-border/50 rounded-2xl p-6 h-full">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${pillar.gradient} flex items-center justify-center mb-5 shadow-xl`}>
                      <pillar.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="font-bold text-xl mb-2">{pillar.title}</h3>
                    <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{pillar.description}</p>
                    <div className="space-y-2">
                      {pillar.details.map((detail, j) => (
                        <div key={j} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="text-foreground">{detail}</span>
                        </div>
                      ))}
                    </div>
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
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                <GradientText from="from-emerald-500" to="to-teal-500">Compliance</GradientText> Status
              </h2>
              <p className="text-muted-foreground text-lg">
                Our commitment to meeting industry standards
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                {
                  icon: FileCheck,
                  title: "Data Encryption",
                  status: "Implemented" as const,
                  gradient: "from-emerald-500 to-teal-500",
                  description: "AES-256 at rest, TLS 1.3 in transit",
                },
                {
                  icon: Users,
                  title: "RBAC",
                  status: "Implemented" as const,
                  gradient: "from-emerald-500 to-teal-500",
                  description: "Four-tier role hierarchy with granular permissions",
                },
                {
                  icon: Shield,
                  title: "SOC 2 Type II",
                  status: "Planned" as const,
                  gradient: "from-amber-500 to-orange-500",
                  description: "Formal certification process planned for 2026",
                },
              ].map((item, i) => (
                <div key={i} className="relative group" data-testid={`compliance-item-${i}`}>
                  <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/8 to-blue-500/8 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                  <div className="relative bg-card border border-border/50 rounded-2xl p-6 text-center h-full">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mx-auto mb-4 shadow-xl`}>
                      <item.icon className="w-7 h-7 text-white" />
                    </div>
                    <h4 className="font-bold text-lg mb-2">{item.title}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                    <Badge
                      variant="secondary"
                      className={
                        item.status === "Implemented"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }
                    >
                      {item.status}
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
          <div className="absolute -top-32 left-1/3 w-[30rem] h-[30rem] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-20 right-1/4 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Questions About Security?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto text-lg">
            Our team is happy to walk through our security practices and answer any compliance questions.
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
