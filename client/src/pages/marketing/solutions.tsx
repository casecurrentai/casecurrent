import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { FeatureCard } from "@/components/marketing/feature-card";
import { SectionFrame } from "@/components/marketing/section-frame";
import { DotGridPattern } from "@/components/marketing/guilloche-pattern";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Car,
  Gavel,
  Heart,
  Globe,
  Webhook,
  Link2,
  FileText,
  Phone,
  Calendar,
  MessageSquare,
} from "lucide-react";

const PRACTICE_AREAS = [
  {
    icon: Car,
    name: "Personal Injury",
    description: "Motor vehicle accidents, slip and fall, medical malpractice",
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
    status: "Available",
  },
  {
    name: "Clio",
    description: "Sync leads directly to your Clio Manage contacts",
    status: "Coming Soon",
  },
  {
    name: "MyCase",
    description: "Automatic lead import to MyCase intake",
    status: "Coming Soon",
  },
  {
    name: "Custom Webhooks",
    description: "Real-time event notifications to any endpoint",
    status: "Available",
  },
];

const OUTCOMES = [
  {
    icon: Phone,
    title: "24/7 Availability",
    description: "Never miss a lead, even outside business hours",
  },
  {
    icon: Calendar,
    title: "Faster Response",
    description: "Average response time under 2 minutes",
  },
  {
    icon: MessageSquare,
    title: "Consistent Quality",
    description: "AI ensures every caller gets the same professional experience",
  },
  {
    icon: FileText,
    title: "Complete Data",
    description: "Structured intake data ready for case evaluation",
  },
];

export default function SolutionsPage() {
  return (
    <PageShell>
      <Hero
        headline="Solutions for Every Practice"
        subheadline="Tailored intake workflows for the practice areas that matter most. Capture the right information from day one."
        primaryCta={{ label: "Book a Demo", href: "/contact" }}
      />

      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Practice Areas</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Pre-built intake templates with practice-specific qualification criteria
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {PRACTICE_AREAS.map((area) => (
              <Card key={area.name}>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <area.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{area.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{area.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <h4 className="text-sm font-medium mb-3">Common Intake Fields</h4>
                  <div className="flex flex-wrap gap-2">
                    {area.intakeFields.map((field) => (
                      <Badge key={field} variant="secondary" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/30 relative">
        <DotGridPattern />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Operational Outcomes</h2>
            <p className="text-muted-foreground">
              Measurable improvements to your intake process
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {OUTCOMES.map((outcome) => (
              <FeatureCard
                key={outcome.title}
                icon={outcome.icon}
                title={outcome.title}
                description={outcome.description}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-6">
          <SectionFrame showCorners className="p-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">Integrations</h2>
              <p className="text-muted-foreground">
                Connect CounselTech to your existing tools
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {INTEGRATIONS.map((integration) => (
                <Card key={integration.name}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 className="w-4 h-4 text-primary" />
                      <span className="font-medium">{integration.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
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
                  </CardContent>
                </Card>
              ))}
            </div>
          </SectionFrame>
        </div>
      </section>
    </PageShell>
  );
}
