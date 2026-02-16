import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionBackground } from "@/components/marketing/section-frame";
import { DecorativeScatter, GradientText, GlowLine } from "@/components/marketing/decorative-visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { BLOG_ARTICLES, CATEGORY_COLORS } from "./blog-data";

const CATEGORY_GRADIENTS: Record<string, string> = {
  "AI & Automation": "from-blue-500 to-indigo-500",
  "Lead Management": "from-emerald-500 to-teal-500",
  "Industry Trends": "from-purple-500 to-pink-500",
  "Best Practices": "from-amber-500 to-orange-500",
};

export default function ResourcesPage() {
  return (
    <PageShell>
      <Hero
        headline="Resources & Insights"
        subheadline="Expert guidance on legal intake, lead qualification, and growing your practice with AI-powered tools."
        primaryCta={{ label: "Book a Demo", href: "/demo" }}
      />

      <SectionBackground variant="deep" withMesh meshVariant="ocean">
        <section className="py-20 -mt-10 relative">
          <DecorativeScatter density="sparse" />
          <div className="container mx-auto px-6 relative z-10">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {BLOG_ARTICLES.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`}>
                  <div className="relative group cursor-pointer h-full">
                    <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/8 to-blue-500/8 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                    <div className="relative bg-card border border-border/50 rounded-2xl p-6 h-full flex flex-col">
                      <div className="flex items-center gap-2 mb-4">
                        <div className={`w-1.5 h-8 rounded-full bg-gradient-to-b ${CATEGORY_GRADIENTS[post.category] || "from-primary to-blue-500"}`} />
                        <Badge
                          variant="secondary"
                          className={CATEGORY_COLORS[post.category] || ""}
                        >
                          {post.category}
                        </Badge>
                      </div>
                      <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1">
                        {post.excerpt}
                      </p>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-3 border-t border-border/50">
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
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </SectionBackground>

      <SectionBackground variant="slate" withMesh meshVariant="midnight">
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-4">
                <GradientText from="from-blue-500" to="to-indigo-500">Subscribe</GradientText> to Our Newsletter
              </h2>
              <p className="text-muted-foreground mb-8 text-lg">
                Get the latest insights on legal intake, AI, and practice growth delivered to your inbox.
              </p>
              <div className="relative">
                <div className="absolute -inset-3 bg-gradient-to-r from-primary/10 via-blue-500/5 to-indigo-500/10 rounded-2xl blur-xl" aria-hidden="true" />
                <form className="relative flex flex-col sm:flex-row gap-3 bg-card border border-border/50 rounded-2xl p-4">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1 px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="input-newsletter-email"
                  />
                  <Button type="button" data-testid="button-newsletter-subscribe">
                    Subscribe
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </div>
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
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Ready to Transform Your Intake?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto text-lg">
            See how CaseCurrent can help your firm capture more qualified leads.
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
