import { Link } from "wouter";
import { PageShell } from "@/components/marketing/page-shell";
import { SectionBackground } from "@/components/marketing/section-frame";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, ExternalLink } from "lucide-react";

const MARKETING_ROUTES = [
  { path: "/", label: "Home" },
  { path: "/how-it-works", label: "How It Works" },
  { path: "/security", label: "Security" },
  { path: "/solutions", label: "Solutions" },
  { path: "/pricing", label: "Pricing" },
  { path: "/resources", label: "Resources" },
  { path: "/contact", label: "Contact" },
  { path: "/demo", label: "Demo" },
];

const CHECKLIST_ITEMS = [
  { id: "guilloche", label: "Guilloche underlay visible in debug mode (debugPattern=1)" },
  { id: "section-bg", label: "SectionBackground with colored backgrounds separates all sections" },
  { id: "mesh-gradients", label: "Dynamic mesh gradients applied to section backgrounds" },
  { id: "ctas", label: "Primary CTAs route to /demo" },
  { id: "page-shell", label: "All pages use PageShell component" },
];

export default function DesignAuditPage() {
  return (
    <PageShell>
      <SectionBackground variant="subtle" withMesh meshVariant="cool">
        <div className="py-16">
          <div className="container mx-auto px-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-4">Design Audit Page</h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Internal tool for verifying marketing signature consistency across all pages.
              </p>
            </div>
          </div>
        </div>
      </SectionBackground>

      <SectionBackground variant="muted" withMesh meshVariant="blue-purple">
        <div className="py-12">
          <div className="container mx-auto px-6">
            <h2 className="text-xl font-bold text-foreground mb-6">Marketing Routes with Debug Links</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {MARKETING_ROUTES.map((route) => (
                <Card key={route.path}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">{route.label}</span>
                      <Badge variant="outline">{route.path}</Badge>
                    </div>
                    <div className="flex flex-col gap-2">
                      <a
                        href={`${route.path}?debugPattern=1&debugFrame=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        data-testid={`link-audit-${route.path.replace(/\//g, '-') || 'home'}`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open with debug flags
                      </a>
                      <a
                        href={route.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open normally
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </SectionBackground>

      <SectionBackground variant="accent" withMesh meshVariant="emerald-blue">
        <div className="py-12">
          <div className="container mx-auto px-6">
            <h2 className="text-xl font-bold text-foreground mb-6">Design Signature Checklist</h2>
            <div className="space-y-4">
              {CHECKLIST_ITEMS.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-4 bg-card rounded-lg border border-border">
                  <CheckCircle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-8 p-4 bg-primary/5 rounded-lg border border-primary/10">
              <h3 className="font-semibold text-foreground mb-2">Verification Instructions</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Click any "Open with debug flags" link above</li>
                <li>Verify the guilloche pattern is clearly visible (high opacity)</li>
                <li>Verify colored section backgrounds alternate between sections</li>
                <li>Verify dynamic mesh gradients appear in section backgrounds</li>
                <li>Ensure primary CTAs navigate to /demo</li>
              </ol>
            </div>
          </div>
        </div>
      </SectionBackground>
    </PageShell>
  );
}
