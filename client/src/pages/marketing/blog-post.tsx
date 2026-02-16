import { useRoute, Link } from "wouter";
import { PageShell } from "@/components/marketing/page-shell";
import { SectionBackground } from "@/components/marketing/section-frame";
import { GlowLine } from "@/components/marketing/decorative-visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BLOG_ARTICLES, CATEGORY_COLORS } from "./blog-data";
import type { BlogContentBlock } from "./blog-data";
import { ArrowLeft, Calendar, Clock, User, ArrowRight } from "lucide-react";

function renderBlock(block: BlogContentBlock, index: number) {
  switch (block.type) {
    case "paragraph":
      return <p key={index} className="text-muted-foreground leading-relaxed mb-6">{block.text}</p>;
    case "heading":
      if (block.level === 2) {
        return <h2 key={index} className="text-xl font-bold text-foreground mt-10 mb-4">{block.text}</h2>;
      }
      return <h3 key={index} className="text-lg font-semibold text-foreground mt-8 mb-3">{block.text}</h3>;
    case "list":
      if (block.ordered) {
        return (
          <ol key={index} className="list-decimal list-inside space-y-2 mb-6 ml-4">
            {block.items.map((item, i) => (
              <li key={i} className="text-muted-foreground leading-relaxed">{item}</li>
            ))}
          </ol>
        );
      }
      return (
        <ul key={index} className="list-disc list-inside space-y-2 mb-6 ml-4">
          {block.items.map((item, i) => (
            <li key={i} className="text-muted-foreground leading-relaxed">{item}</li>
          ))}
        </ul>
      );
    case "callout": {
      const variantStyles: Record<string, string> = {
        tip: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
        warning: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
        stat: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
        info: "bg-muted border-border",
      };
      const titleStyles: Record<string, string> = {
        tip: "text-emerald-700 dark:text-emerald-400",
        warning: "text-amber-700 dark:text-amber-400",
        stat: "text-blue-700 dark:text-blue-400",
        info: "text-foreground",
      };
      return (
        <div key={index} className={`rounded-md border p-4 mb-6 ${variantStyles[block.variant]}`}>
          <p className={`font-semibold text-sm mb-1 ${titleStyles[block.variant]}`}>{block.title}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{block.text}</p>
        </div>
      );
    }
    case "quote":
      return (
        <blockquote key={index} className="border-l-4 border-primary/30 pl-4 py-2 mb-6 italic">
          <p className="text-muted-foreground leading-relaxed">{block.text}</p>
          {block.attribution && (
            <footer className="text-sm text-muted-foreground/70 mt-2">\u2014 {block.attribution}</footer>
          )}
        </blockquote>
      );
    default:
      return null;
  }
}

export default function BlogPostPage() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug;
  const article = BLOG_ARTICLES.find((a) => a.slug === slug);

  if (!article) {
    return (
      <PageShell title="Article Not Found | CaseCurrent" description="The requested blog article could not be found.">
        <SectionBackground variant="subtle">
          <section className="py-20">
            <div className="container mx-auto px-6 text-center">
              <h1 className="text-3xl font-bold text-foreground mb-4">Article Not Found</h1>
              <p className="text-muted-foreground mb-8">The article you're looking for doesn't exist or has been moved.</p>
              <Link href="/resources">
                <Button data-testid="button-back-to-blog">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Resources
                </Button>
              </Link>
            </div>
          </section>
        </SectionBackground>
      </PageShell>
    );
  }

  const currentIndex = BLOG_ARTICLES.findIndex((a) => a.id === article.id);
  const prevArticle = currentIndex > 0 ? BLOG_ARTICLES[currentIndex - 1] : null;
  const nextArticle = currentIndex < BLOG_ARTICLES.length - 1 ? BLOG_ARTICLES[currentIndex + 1] : null;

  return (
    <PageShell title={`${article.title} | CaseCurrent Blog`} description={article.excerpt}>
      <SectionBackground variant="subtle" withMesh meshVariant="cool">
        <section className="py-16">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <Link href="/resources">
                <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back-to-resources">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Resources
                </Button>
              </Link>

              <Badge
                variant="secondary"
                className={CATEGORY_COLORS[article.category] || ""}
              >
                {article.category}
              </Badge>

              <h1 className="text-3xl md:text-4xl font-bold text-foreground mt-4 mb-4" data-testid="text-blog-title">
                {article.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-10">
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {article.author}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {article.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {article.readTime}
                </span>
              </div>

              <GlowLine className="mb-8" />

              <div className="prose-custom" data-testid="text-blog-content">
                {article.content.map((block, i) => renderBlock(block, i))}
              </div>

              <div className="border-t border-border mt-12 pt-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {prevArticle ? (
                    <Link href={`/blog/${prevArticle.slug}`}>
                      <Button variant="outline" size="sm" data-testid="button-prev-article">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Previous
                      </Button>
                    </Link>
                  ) : <div />}
                  {nextArticle ? (
                    <Link href={`/blog/${nextArticle.slug}`}>
                      <Button variant="outline" size="sm" data-testid="button-next-article">
                        Next
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  ) : <div />}
                </div>
              </div>
            </div>
          </div>
        </section>
      </SectionBackground>

      <SectionBackground variant="muted" withMesh meshVariant="blue-purple">
        <section className="py-16">
          <div className="container mx-auto px-6">
            <h2 className="text-2xl font-bold text-foreground text-center mb-8">Related Articles</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {BLOG_ARTICLES.filter((a) => a.id !== article.id).slice(0, 3).map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`}>
                  <Card className="hover-elevate cursor-pointer group h-full">
                    <CardContent className="p-6">
                      <Badge variant="secondary" className={CATEGORY_COLORS[post.category] || ""}>
                        {post.category}
                      </Badge>
                      <h3 className="font-semibold text-lg mt-4 mb-2 group-hover:text-primary transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-3">{post.excerpt}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
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
              <Button size="lg" variant="secondary" data-testid="button-blog-cta-demo">
                Book a Demo
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground" data-testid="button-blog-cta-contact">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
