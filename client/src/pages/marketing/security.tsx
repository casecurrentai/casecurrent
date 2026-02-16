import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { TrustList, SecurityCard } from "@/components/marketing/trust-list";
import { SectionFrame, BlueprintDivider, SectionBackground } from "@/components/marketing/section-frame";
import { UIFrame } from "@/components/marketing/ui-frame";
import { DotGridPattern } from "@/components/marketing/guilloche-pattern";
import { GradientOrb, GlowLine, DecorativeScatter, SectionGlow } from "@/components/marketing/decorative-visuals";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Shield, Lock, Eye, Database, Users, FileCheck } from "lucide-react";

const TRUST_ITEMS = [
  {
    title: "Role-Based Access Control (RBAC)",
    description: "Owner, admin, staff, and viewer roles with granular permissions",
  },
  {
    title: "Complete Audit Logging",
    description: "Every action is logged with actor, timestamp, and change details",
  },
  {
    title: "Encryption in Transit",
    description: "TLS 1.3 for all data transmission between clients and servers",
  },
  {
    title: "Encryption at Rest",
    description: "AES-256 encryption for stored data and backups",
  },
  {
    title: "Data Retention Controls",
    description: "Configurable retention policies per organization",
  },
  {
    title: "Multi-Tenant Isolation",
    description: "Strict org_id scoping ensures complete data separation",
  },
];

const SECURITY_SECTIONS = [
  {
    title: "Access Control",
    items: [
      "JWT-based authentication",
      "Role hierarchy enforcement",
      "Session management",
      "API key rotation support",
    ],
  },
  {
    title: "Data Protection",
    items: [
      "Field-level encryption",
      "Secure credential storage",
      "PII handling compliance",
      "Automatic data masking",
    ],
  },
  {
    title: "Monitoring",
    items: [
      "Real-time audit trail",
      "Anomaly detection",
      "Access pattern analysis",
      "Security alerts",
    ],
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

      <SectionBackground variant="subtle" withMesh meshVariant="cool">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <SectionFrame variant="crosshairs" className="p-8">
              <div className="grid lg:grid-cols-2 gap-12">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-6">Trust Checklist</h2>
                <TrustList items={TRUST_ITEMS} />
              </div>
              <UIFrame title="Security Overview">
                <div className="space-y-4">
                  {SECURITY_SECTIONS.map((section) => (
                    <SecurityCard
                      key={section.title}
                      title={section.title}
                      items={section.items}
                    />
                  ))}
                </div>
              </UIFrame>
              </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <SectionBackground variant="muted" withMesh meshVariant="blue-purple">
        <section className="py-20 relative">
        <DotGridPattern />
        <DecorativeScatter density="sparse" />
        <div className="container mx-auto px-6 relative z-10">
          <SectionFrame variant="minimal" className="p-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">Unrelenting Security</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Every layer of the platform is designed with security-first principles
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <Lock className="w-10 h-10 text-primary mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Secure Infrastructure</h3>
                  <p className="text-muted-foreground text-sm">
                    Hosted on enterprise-grade cloud infrastructure with network isolation,
                    DDoS protection, and continuous monitoring.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <Eye className="w-10 h-10 text-primary mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Transparent Logging</h3>
                  <p className="text-muted-foreground text-sm">
                    Comprehensive audit logs capture every data access and modification,
                    exportable for compliance reviews.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <Database className="w-10 h-10 text-primary mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Data Boundaries</h3>
                  <p className="text-muted-foreground text-sm">
                    Strict org_id scoping ensures complete tenant isolation at the
                    database level with cascading delete protection.
                  </p>
                </CardContent>
              </Card>
            </div>
          </SectionFrame>
        </div>
      </section>
    </SectionBackground>

      <SectionBackground variant="accent" withMesh meshVariant="emerald-blue">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <SectionFrame variant="crosshairs" className="p-8">
              <div className="text-center mb-8">
                <GlowLine className="mb-6" />
                <h2 className="text-2xl font-bold text-foreground mb-4">Compliance Status</h2>
              <p className="text-muted-foreground">
                Our commitment to meeting industry standards
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <Card>
                <CardContent className="p-6 text-center">
                  <FileCheck className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
                  <h4 className="font-semibold mb-2">Data Encryption</h4>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Implemented
                  </Badge>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <Users className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
                  <h4 className="font-semibold mb-2">RBAC</h4>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Implemented
                  </Badge>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <Shield className="w-8 h-8 text-amber-600 mx-auto mb-3" />
                  <h4 className="font-semibold mb-2">SOC 2 Type II</h4>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    Planned
                  </Badge>
                </CardContent>
              </Card>
              </div>
            </SectionFrame>
          </div>
        </section>
      </SectionBackground>

      <section className="py-16 bg-primary text-primary-foreground relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true"><div className="absolute -top-20 left-1/3 w-96 h-96 rounded-full bg-white/5 blur-3xl" /></div>
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-2xl font-bold mb-4">Questions About Security?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Our team is happy to walk through our security practices and answer any compliance questions.
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
