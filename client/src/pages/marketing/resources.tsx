import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DotGridPattern } from "@/components/marketing/guilloche-pattern";
import { Calendar, Clock, ArrowRight } from "lucide-react";

const BLOG_POSTS = [
  {
    id: "1",
    title: "5 Ways AI is Transforming Legal Intake",
    excerpt: "Discover how artificial intelligence is revolutionizing the way law firms capture and qualify leads, from 24/7 voice agents to predictive scoring.",
    category: "Industry Trends",
    date: "Jan 3, 2025",
    readTime: "5 min read",
  },
  {
    id: "2",
    title: "The True Cost of Missed Calls for Law Firms",
    excerpt: "Research shows that 67% of callers who reach voicemail never call back. Learn the financial impact and how to prevent lost leads.",
    category: "Best Practices",
    date: "Dec 28, 2024",
    readTime: "4 min read",
  },
  {
    id: "3",
    title: "Building a Lead Qualification Framework",
    excerpt: "A step-by-step guide to creating scoring criteria that identify high-value cases while filtering out poor-fit inquiries.",
    category: "How-To",
    date: "Dec 20, 2024",
    readTime: "7 min read",
  },
  {
    id: "4",
    title: "Personal Injury Intake Best Practices",
    excerpt: "Essential questions to ask during PI intake calls and how to structure your qualification workflow for maximum conversion.",
    category: "Practice Areas",
    date: "Dec 15, 2024",
    readTime: "6 min read",
  },
  {
    id: "5",
    title: "Integrating Your Intake with Clio and MyCase",
    excerpt: "Technical guide to connecting CounselTech with popular legal practice management software for seamless data flow.",
    category: "Integrations",
    date: "Dec 10, 2024",
    readTime: "8 min read",
  },
  {
    id: "6",
    title: "Measuring Intake ROI: Key Metrics to Track",
    excerpt: "The essential KPIs every law firm should monitor to understand intake performance and optimize for growth.",
    category: "Analytics",
    date: "Dec 5, 2024",
    readTime: "5 min read",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Industry Trends": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Best Practices": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "How-To": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Practice Areas": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Integrations": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  "Analytics": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

export default function ResourcesPage() {
  return (
    <PageShell>
      <Hero
        headline="Resources & Insights"
        subheadline="Expert guidance on legal intake, lead qualification, and growing your practice with AI-powered tools."
      />

      <section className="py-20 -mt-10 relative">
        <DotGridPattern />
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BLOG_POSTS.map((post) => (
              <Card key={post.id} className="hover-elevate cursor-pointer group">
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
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
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
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Subscribe to Our Newsletter</h2>
          <p className="text-primary-foreground/80 mb-6 max-w-lg mx-auto">
            Get the latest insights on legal intake, AI, and practice growth delivered to your inbox.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-2 rounded-md bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/30"
              data-testid="input-newsletter-email"
            />
            <button
              type="button"
              className="px-6 py-2 bg-primary-foreground text-primary font-medium rounded-md hover:bg-primary-foreground/90 transition-colors"
              data-testid="button-newsletter-subscribe"
            >
              Subscribe
            </button>
          </form>
        </div>
      </section>
    </PageShell>
  );
}
