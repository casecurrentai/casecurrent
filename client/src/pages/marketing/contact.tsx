import { useState } from "react";
import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionFrame, BlueprintDivider, SectionBackground } from "@/components/marketing/section-frame";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Mail, Phone, Clock, CheckCircle, ArrowRight } from "lucide-react";

export default function ContactPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    firm: "",
    message: "",
    website: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (formData.website) {
      setIsSubmitted(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/v1/marketing/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          firm: formData.firm || null,
          message: formData.message,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit");
      }

      setIsSubmitted(true);
      toast({
        title: "Message sent",
        description: "We'll get back to you within 24 hours.",
      });
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageShell>
      <Hero
        headline="Contact Sales"
        subheadline="Have questions about CounselTech? Our team is here to help."
        primaryCta={{ label: "Book a Demo", href: "/demo" }}
      />

      <SectionBackground variant="subtle">
        <section className="py-20 -mt-10">
          <div className="container mx-auto px-6">
            <SectionFrame variant="corners" className="p-8 max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-6">Get in Touch</h2>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Email</h3>
                      <p className="text-muted-foreground">hello@counseltech.io</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Phone</h3>
                      <p className="text-muted-foreground">(555) 123-4567</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Response Time</h3>
                      <p className="text-muted-foreground">Within 24 hours on business days</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-muted/50 rounded-lg">
                  <h3 className="font-medium mb-2">Looking for a demo?</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    See CounselTech in action with a personalized walkthrough.
                  </p>
                  <Link href="/demo">
                    <Button variant="outline" size="sm" data-testid="link-demo-from-contact">
                      Book a Demo
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>

              <Card>
                <CardContent className="p-6">
                  {isSubmitted ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Message Received</h3>
                      <p className="text-muted-foreground">
                        Thank you for reaching out. We'll be in touch within 24 hours.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Your name"
                          data-testid="input-contact-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="you@example.com"
                          data-testid="input-contact-email"
                        />
                      </div>
                      <div>
                        <Label htmlFor="firm">Firm Name</Label>
                        <Input
                          id="firm"
                          value={formData.firm}
                          onChange={(e) => setFormData({ ...formData, firm: e.target.value })}
                          placeholder="Your law firm (optional)"
                          data-testid="input-contact-firm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="message">Message *</Label>
                        <Textarea
                          id="message"
                          required
                          rows={4}
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          placeholder="Tell us about your intake needs..."
                          data-testid="input-contact-message"
                        />
                      </div>
                      <div className="hidden" aria-hidden="true">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          tabIndex={-1}
                          autoComplete="off"
                          value={formData.website}
                          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting}
                        data-testid="button-contact-submit"
                      >
                        {isSubmitting ? "Sending..." : "Send Message"}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          </SectionFrame>
        </div>
      </section>
    </SectionBackground>
    </PageShell>
  );
}
