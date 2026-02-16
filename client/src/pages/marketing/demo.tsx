import { useState, useRef } from "react";
import { PageShell } from "@/components/marketing/page-shell";
import { Hero } from "@/components/marketing/hero";
import { SectionBackground } from "@/components/marketing/section-frame";
import { GradientText } from "@/components/marketing/decorative-visuals";
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
    gradient: "from-blue-500 to-indigo-500",
  },
  {
    icon: FileText,
    title: "Structured Lead Data",
    description: "Watch lead details get captured and organized automatically",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: Zap,
    title: "Instant Qualification",
    description: "Experience real-time scoring and urgency detection",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description: "Get alerts when high-priority leads come in",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: BarChart3,
    title: "Dashboard Analytics",
    description: "Explore the reporting and conversion insights",
    gradient: "from-cyan-500 to-blue-500",
  },
];

const PRACTICE_AREAS = [
  { value: "personal_injury", label: "Personal Injury", icon: Car, gradient: "from-blue-500 to-indigo-500" },
  { value: "criminal_defense", label: "Criminal Defense", icon: Gavel, gradient: "from-amber-500 to-orange-500" },
  { value: "family_law", label: "Family Law", icon: Heart, gradient: "from-pink-500 to-rose-500" },
  { value: "immigration", label: "Immigration", icon: Globe, gradient: "from-emerald-500 to-teal-500" },
  { value: "other", label: "Other", icon: FileText, gradient: "from-slate-500 to-slate-600" },
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
        headline="See CaseCurrent AI in Action"
        subheadline="A 15-minute walkthrough tailored to your practice area and intake workflow."
      >
        <Button size="lg" onClick={scrollToForm} data-testid="button-hero-request-demo">
          Request a Demo
        </Button>
      </Hero>

      <SectionBackground variant="deep" withMesh meshVariant="ocean">
        <section className="py-20 -mt-10">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                What You'll <GradientText from="from-blue-500" to="to-indigo-500">See</GradientText>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                A complete walkthrough of the CaseCurrent intake system
              </p>
            </div>
            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-5">
              {DEMO_STEPS.map((step, index) => (
                <div key={step.title} className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/8 to-blue-500/8 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                  <div className="relative bg-card border border-border/50 rounded-2xl p-5 text-center h-full">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                      <step.icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-xs text-muted-foreground mb-1 font-mono">Step {index + 1}</div>
                    <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </SectionBackground>

      <SectionBackground variant="slate" withMesh meshVariant="midnight">
        <section className="py-16">
          <div className="container mx-auto px-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-4">Who It's For</h2>
              <p className="text-muted-foreground text-lg">CaseCurrent works for firms across practice areas</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {PRACTICE_AREAS.slice(0, 4).map((area) => (
                <div key={area.value} className="flex items-center gap-3 p-4 bg-card border border-border/50 rounded-xl">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${area.gradient} flex items-center justify-center shadow-md`}>
                    <area.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-semibold">{area.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </SectionBackground>

      <SectionBackground variant="deep" withMesh meshVariant="ocean">
        <section className="py-16">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-foreground mb-4">
                  <GradientText from="from-emerald-500" to="to-blue-500">Implementation</GradientText> Timeline
                </h2>
                <p className="text-muted-foreground text-lg">Get started quickly with minimal disruption</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-6 relative">
                <div className="hidden sm:block absolute top-[2.5rem] left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-1 rounded-full overflow-hidden" aria-hidden="true">
                  <div className="w-full h-full bg-gradient-to-r from-blue-500/30 via-amber-500/30 to-emerald-500/30" />
                </div>
                {[
                  { icon: Clock, title: "Day 1-2", desc: "Onboarding call & configuration", gradient: "from-blue-500 to-indigo-500" },
                  { icon: Zap, title: "Day 3-5", desc: "AI training & testing", gradient: "from-amber-500 to-orange-500" },
                  { icon: CheckCircle, title: "Day 6+", desc: "Go live & iterate", gradient: "from-emerald-500 to-teal-500" },
                ].map((step, i) => (
                  <div key={i} className="text-center relative z-10">
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mx-auto mb-4 shadow-xl`}>
                      <step.icon className="w-9 h-9 text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground mt-8">
                Actual timeline varies based on complexity. Most firms are live within one week.
              </p>
            </div>
          </div>
        </section>
      </SectionBackground>

      <SectionBackground variant="slate" withMesh meshVariant="steel">
        <section className="py-20 relative" ref={formRef}>
          <div className="container mx-auto px-6">
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <div className="absolute -inset-3 bg-gradient-to-br from-primary/10 via-blue-500/5 to-indigo-500/10 rounded-3xl blur-xl" aria-hidden="true" />
                <Card className="relative">
                  <CardContent className="p-8">
                    {isSubmitted ? (
                      <div className="text-center py-8">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-xl">
                          <CheckCircle className="w-10 h-10 text-white" />
                        </div>
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
              </div>
            </div>
          </div>
        </section>
      </SectionBackground>
    </PageShell>
  );
}
