import { useState, useRef } from "react";
import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionFrame, BlueprintDivider, SectionBackground } from "@/components/marketing/section-frame";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle, 
  Phone, 
  FileText, 
  Bell, 
  BarChart3, 
  Car, 
  Gavel, 
  Heart, 
  Globe,
  Clock,
  Zap,
  ArrowRight,
  ArrowLeft
} from "lucide-react";

const DEMO_STEPS = [
  {
    icon: Phone,
    title: "Missed-Call Capture",
    description: "See how AI answers after-hours and overflow calls",
  },
  {
    icon: FileText,
    title: "Structured Lead Data",
    description: "Watch lead details get captured and organized automatically",
  },
  {
    icon: Zap,
    title: "Instant Qualification",
    description: "Experience real-time scoring and urgency detection",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description: "Get alerts when high-priority leads come in",
  },
  {
    icon: BarChart3,
    title: "Dashboard Analytics",
    description: "Explore the reporting and conversion insights",
  },
];

const PRACTICE_AREAS = [
  { value: "personal_injury", label: "Personal Injury", icon: Car },
  { value: "criminal_defense", label: "Criminal Defense", icon: Gavel },
  { value: "family_law", label: "Family Law", icon: Heart },
  { value: "immigration", label: "Immigration", icon: Globe },
  { value: "other", label: "Other", icon: FileText },
];

const INTAKE_METHODS = [
  { value: "answering_service", label: "Answering Service" },
  { value: "in_house_staff", label: "In-House Staff" },
  { value: "voicemail", label: "Voicemail Only" },
  { value: "web_forms", label: "Web Forms Only" },
  { value: "mixed", label: "Combination" },
  { value: "none", label: "No Formal Process" },
];

const LEAD_VOLUMES = [
  { value: "under_50", label: "Under 50" },
  { value: "50_100", label: "50-100" },
  { value: "100_250", label: "100-250" },
  { value: "250_500", label: "250-500" },
  { value: "over_500", label: "500+" },
];

const FORM_STEPS = [
  { id: 1, title: "Contact Info" },
  { id: 2, title: "Firm Details" },
  { id: 3, title: "Additional Info" },
];

export default function DemoPage() {
  const { toast } = useToast();
  const formRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    firm_name: "",
    phone: "",
    practice_area: "",
    current_intake_method: "",
    monthly_lead_volume: "",
    message: "",
    website: "",
  });

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function validateStep1() {
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return false;
    }
    if (!formData.email.trim() || !formData.email.includes("@")) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return false;
    }
    return true;
  }

  function nextStep() {
    if (currentStep === 1 && !validateStep1()) return;
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  }

  function prevStep() {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (formData.website) {
      setIsSubmitted(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/v1/marketing/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          firm_name: formData.firm_name || null,
          phone: formData.phone || null,
          practice_area: formData.practice_area || null,
          current_intake_method: formData.current_intake_method || null,
          monthly_lead_volume: formData.monthly_lead_volume || null,
          message: formData.message || null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit");
      }

      setIsSubmitted(true);
      toast({
        title: "Demo request received",
        description: "We'll reach out shortly to schedule your demo.",
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
        headline="See CounselTech AI in Action"
        subheadline="A 15-minute walkthrough tailored to your practice area and intake workflow."
      >
        <Button size="lg" onClick={scrollToForm} data-testid="button-hero-request-demo">
          Request a Demo
        </Button>
      </Hero>

      <SectionBackground variant="subtle">
        <section className="py-20 -mt-10">
          <div className="container mx-auto px-6">
            <SectionFrame variant="brackets" className="p-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-foreground mb-4">What You'll See</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                A complete walkthrough of the CounselTech intake system
              </p>
            </div>
            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
              {DEMO_STEPS.map((step, index) => (
                <div key={step.title} className="text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">Step {index + 1}</div>
                  <h3 className="font-medium text-sm mb-1">{step.title}</h3>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </SectionFrame>
        </div>
      </section>
    </SectionBackground>

      <SectionBackground variant="muted">
        <section className="py-16">
          <div className="container mx-auto px-6">
            <SectionFrame variant="brackets" className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">Who It's For</h2>
              <p className="text-muted-foreground">CounselTech works for firms across practice areas</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {PRACTICE_AREAS.slice(0, 4).map((area) => (
                <div key={area.value} className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border">
                  <area.icon className="w-5 h-5 text-primary" />
                  <span className="font-medium">{area.label}</span>
                </div>
              ))}
            </div>
          </SectionFrame>
        </div>
      </section>
    </SectionBackground>

      <SectionBackground variant="accent">
        <section className="py-16">
          <div className="container mx-auto px-6">
            <SectionFrame variant="brackets" className="p-8 max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">Implementation Timeline</h2>
              <p className="text-muted-foreground">Get started quickly with minimal disruption</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Day 1-2</h3>
                <p className="text-sm text-muted-foreground">Onboarding call & configuration</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Day 3-5</h3>
                <p className="text-sm text-muted-foreground">AI training & testing</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Day 6+</h3>
                <p className="text-sm text-muted-foreground">Go live & iterate</p>
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-6">
              Actual timeline varies based on complexity. Most firms are live within one week.
            </p>
          </SectionFrame>
        </div>
      </section>
    </SectionBackground>

      <SectionBackground variant="muted">
        <section className="py-20" ref={formRef}>
          <div className="container mx-auto px-6">
            <SectionFrame variant="brackets" className="max-w-2xl mx-auto p-6">
            <Card>
              <CardContent className="p-8">
                {isSubmitted ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-semibold mb-2">Demo Request Received</h3>
                    <p className="text-muted-foreground">
                      We'll reach out shortly to schedule your personalized demo.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-foreground mb-2">Request Your Demo</h2>
                      <p className="text-muted-foreground">
                        Fill out the form below and we'll be in touch within one business day.
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 mb-8">
                      {FORM_STEPS.map((step) => (
                        <div key={step.id} className="flex items-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                              currentStep >= step.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                            data-testid={`step-indicator-${step.id}`}
                          >
                            {step.id}
                          </div>
                          {step.id < 3 && (
                            <div
                              className={`w-12 h-0.5 mx-1 ${
                                currentStep > step.id ? "bg-primary" : "bg-muted"
                              }`}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleSubmit}>
                      {currentStep === 1 && (
                        <div className="space-y-4" data-testid="form-step-1">
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="name">Name *</Label>
                              <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Your name"
                                data-testid="input-demo-name"
                              />
                            </div>
                            <div>
                              <Label htmlFor="email">Email *</Label>
                              <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="you@example.com"
                                data-testid="input-demo-email"
                              />
                            </div>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="firm_name">Firm Name</Label>
                              <Input
                                id="firm_name"
                                value={formData.firm_name}
                                onChange={(e) => setFormData({ ...formData, firm_name: e.target.value })}
                                placeholder="Your law firm"
                                data-testid="input-demo-firm"
                              />
                            </div>
                            <div>
                              <Label htmlFor="phone">Phone (optional)</Label>
                              <Input
                                id="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="(555) 123-4567"
                                data-testid="input-demo-phone"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {currentStep === 2 && (
                        <div className="space-y-4" data-testid="form-step-2">
                          <div>
                            <Label htmlFor="practice_area">Practice Area</Label>
                            <Select
                              value={formData.practice_area}
                              onValueChange={(value) => setFormData({ ...formData, practice_area: value })}
                            >
                              <SelectTrigger data-testid="select-demo-practice-area">
                                <SelectValue placeholder="Select practice area" />
                              </SelectTrigger>
                              <SelectContent>
                                {PRACTICE_AREAS.map((area) => (
                                  <SelectItem key={area.value} value={area.value}>
                                    {area.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="current_intake_method">Current Intake Method</Label>
                              <Select
                                value={formData.current_intake_method}
                                onValueChange={(value) => setFormData({ ...formData, current_intake_method: value })}
                              >
                                <SelectTrigger data-testid="select-demo-intake-method">
                                  <SelectValue placeholder="How do you handle intake?" />
                                </SelectTrigger>
                                <SelectContent>
                                  {INTAKE_METHODS.map((method) => (
                                    <SelectItem key={method.value} value={method.value}>
                                      {method.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="monthly_lead_volume">Monthly Lead Volume</Label>
                              <Select
                                value={formData.monthly_lead_volume}
                                onValueChange={(value) => setFormData({ ...formData, monthly_lead_volume: value })}
                              >
                                <SelectTrigger data-testid="select-demo-lead-volume">
                                  <SelectValue placeholder="How many leads/month?" />
                                </SelectTrigger>
                                <SelectContent>
                                  {LEAD_VOLUMES.map((volume) => (
                                    <SelectItem key={volume.value} value={volume.value}>
                                      {volume.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                      {currentStep === 3 && (
                        <div className="space-y-4" data-testid="form-step-3">
                          <div>
                            <Label htmlFor="message">Anything else? (optional)</Label>
                            <Textarea
                              id="message"
                              rows={4}
                              value={formData.message}
                              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                              placeholder="Tell us about your specific needs or questions..."
                              data-testid="input-demo-message"
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
                        </div>
                      )}

                      <div className="flex justify-between mt-8">
                        {currentStep > 1 ? (
                          <Button type="button" variant="outline" onClick={prevStep} data-testid="button-demo-prev">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                          </Button>
                        ) : (
                          <div />
                        )}

                        {currentStep < 3 ? (
                          <Button type="button" onClick={nextStep} data-testid="button-demo-next">
                            Next
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        ) : (
                          <Button type="submit" disabled={isSubmitting} data-testid="button-demo-submit">
                            {isSubmitting ? "Submitting..." : "Request Demo"}
                          </Button>
                        )}
                      </div>
                    </form>
                  </>
                )}
              </CardContent>
            </Card>
          </SectionFrame>
        </div>
      </section>
    </SectionBackground>
    </PageShell>
  );
}
