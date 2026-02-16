import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionFrame, BlueprintDivider, SectionBackground } from "@/components/marketing/section-frame";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DotGridPattern } from "@/components/marketing/guilloche-pattern";
import { Link } from "wouter";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { BLOG_ARTICLES, CATEGORY_COLORS } from "./blog-data";

export default function ResourcesPage() {
  return (
    <PageShell>
      <Hero
        headline="Resources & Insights"
        subheadline="Expert guidance on legal intake, lead qualification, and growing your practice with AI-powered tools."
        primaryCta={{ label: "Book a Demo", href: "/demo" }}
      />

      <SectionBackground variant="subtle">
        <section className="py-20 -mt-10 relative">
          <DotGridPattern />
          <div className="container mx-auto px-6 relative z-10">
            <SectionFrame variant="grid" className="p-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {BLOG_ARTICLES.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`}>
                  <Card className="hover-elevate cursor-pointer group h-full">
                    <CardContent className="p-6">
                      <Badge
                        variant="secondary"
                        className={CATEGORY_COLORS[post.category] || ""}
                      >
                        {post.category}
                      </Badge>
                      <h3 className="font-semibold text-lg mt-4 mb-2 group-hover:text-primary transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                        {post.excerpt}
                      </p>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {post.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {post.readTime}
                          </span>
                        </div>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </SectionFrame>
        </div>
      </section>
    </SectionBackground>

      <SectionBackground variant="muted">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <SectionFrame variant="minimal" className="p-8 max-w-2xl mx-auto">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Subscribe to Our Newsletter</h2>
              <p className="text-muted-foreground mb-6">
                Get the latest insights on legal intake, AI, and practice growth delivered to your inbox.
              </p>
              <form className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="input-newsletter-email"
                />
                <Button type="button" data-testid="button-newsletter-subscribe">
                  Subscribe
                </Button>
              </form>
            </div>
          </SectionFrame>
        </div>
      </section>
    </SectionBackground>

      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Transform Your Intake?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            See how CaseCurrent can help your firm capture more qualified leads.
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
