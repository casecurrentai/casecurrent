import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronRight, ChevronLeft, Building2, Clock, Briefcase, Phone, Bot, FileText, Bell, CheckCircle, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const STEPS = [
  { id: 1, title: "Firm Basics", icon: Building2 },
  { id: 2, title: "Business Hours", icon: Clock },
  { id: 3, title: "Practice Areas", icon: Briefcase },
  { id: 4, title: "Phone Numbers", icon: Phone },
  { id: 5, title: "AI Voice", icon: Bot },
  { id: 6, title: "Intake Logic", icon: FileText },
  { id: 7, title: "Follow-up", icon: Bell },
  { id: 8, title: "Review", icon: CheckCircle },
];

const STEP_HELP: Record<number, { title: string; description: string; faqs: Array<{ q: string; a: string }> }> = {
  1: {
    title: "Firm Basics Help",
    description: "Set up your law firm's basic information. This will be used throughout the platform.",
    faqs: [
      { q: "Why do I need to set a timezone?", a: "The timezone ensures your business hours, call logs, and notifications display in your local time. It also affects when AI agents switch to after-hours mode." },
      { q: "Can I change my firm name later?", a: "Yes, you can update your firm name anytime from the Settings page after completing setup." },
    ],
  },
  2: {
    title: "Business Hours Help",
    description: "Define when your office is open to receive calls. The AI will adjust its behavior based on these hours.",
    faqs: [
      { q: "What happens outside business hours?", a: "Depending on your after-hours setting, calls can go to voicemail, be handled by AI, or forward to a mobile number." },
      { q: "Can I set different hours for different days?", a: "The initial setup uses the same hours for all weekdays. You can configure per-day schedules in Settings after setup." },
      { q: "What does 'AI Agent Handles' mean?", a: "The AI will answer calls, gather information, and create leads even when your office is closed." },
    ],
  },
  3: {
    title: "Practice Areas Help",
    description: "Select the types of cases your firm handles. This helps the AI route and qualify leads appropriately.",
    faqs: [
      { q: "Why do practice areas matter?", a: "Practice areas determine which intake questions to ask and how leads are scored. Each area can have its own qualification criteria." },
      { q: "Can I add custom practice areas?", a: "Yes, after completing setup you can add custom practice areas from the Settings page." },
      { q: "What if I handle multiple case types?", a: "Enable all practice areas that apply. The AI will ask callers about their case type to route them correctly." },
    ],
  },
  4: {
    title: "Phone Numbers Help",
    description: "Add your firm's phone number for call tracking and AI voice agent integration.",
    faqs: [
      { q: "What is E.164 format?", a: "E.164 is the international phone number format starting with + and country code. For US numbers: +1 followed by 10 digits (e.g., +15551234567)." },
      { q: "Do I need to port my number?", a: "No, you can keep your existing phone number. CounselTech works with your current phone provider via call forwarding." },
      { q: "Can I add multiple phone numbers?", a: "Yes, you can add additional numbers after setup for different offices or departments." },
    ],
  },
  5: {
    title: "AI Voice Help",
    description: "Configure how the AI greets callers and sets expectations during the conversation.",
    faqs: [
      { q: "What makes a good voice greeting?", a: "Keep it professional but welcoming. Include your firm name and a brief offer to help. Example: 'Thank you for calling Smith Law. How may I assist you today?'" },
      { q: "Why include a disclaimer?", a: "Recording disclaimers are legally required in many states. The AI will play this at the start of each call for compliance." },
      { q: "What do the tone options mean?", a: "Professional is formal and business-like. Friendly is warmer and conversational. Empathetic is especially supportive, ideal for personal injury or family law." },
    ],
  },
  6: {
    title: "Intake Logic Help",
    description: "Define the questions the AI asks to gather case information. This step is optional during initial setup.",
    faqs: [
      { q: "Do I need to configure this now?", a: "No, CounselTech includes default intake questions. You can customize them later in Settings." },
      { q: "What format should the JSON be?", a: "Use a schema with 'questions' array. Each question needs: id, text, type (text/select/date), and optional 'required' flag." },
      { q: "Can different practice areas have different questions?", a: "Yes, each practice area can have its own intake question set tailored to that case type." },
    ],
  },
  7: {
    title: "Follow-up Help",
    description: "Configure automatic follow-up messages to keep leads engaged after their initial contact.",
    faqs: [
      { q: "What is auto follow-up?", a: "When enabled, the system automatically sends SMS or email messages to leads who haven't responded, keeping them engaged until your team can connect." },
      { q: "How does the delay work?", a: "The delay is the time between a lead's last contact and the follow-up message. 30 minutes is recommended to seem responsive but not pushy." },
      { q: "Can I customize the follow-up messages?", a: "Yes, after setup you can create custom follow-up sequences with multiple messages, timing, and conditions." },
    ],
  },
  8: {
    title: "Review & Complete",
    description: "Review your settings before completing the setup. You can always adjust these settings later.",
    faqs: [
      { q: "Can I change settings after completing setup?", a: "Absolutely! All settings are accessible from the Settings page. Setup just gets you started quickly." },
      { q: "What happens after I complete setup?", a: "You'll be taken to the Leads dashboard where you can start receiving and managing leads immediately." },
      { q: "Is my data saved if I leave?", a: "Yes, each step saves automatically when you click Next. You can close and return to continue where you left off." },
    ],
  },
};

export default function SetupWizardPage() {
  const { token, organization, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [helpOpen, setHelpOpen] = useState(false);
  
  // Allow revisiting setup with ?edit=true query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const isEditMode = urlParams.get("edit") === "true";

  const [basics, setBasics] = useState({ name: "", timezone: "America/New_York" });
  const [businessHours, setBusinessHours] = useState({
    startTime: "09:00",
    endTime: "17:00",
    afterHoursBehavior: "voicemail",
  });
  const [practiceAreas, setPracticeAreas] = useState<Array<{ id: string; name: string; active: boolean }>>([]);
  const [phoneNumber, setPhoneNumber] = useState({ label: "", e164: "", afterHoursEnabled: false });
  const [aiConfig, setAiConfig] = useState({
    voiceGreeting: "Hello, thank you for calling. How may I assist you today?",
    disclaimerText: "This call may be recorded for quality assurance purposes.",
    toneProfile: "professional",
  });
  const [intakeLogic, setIntakeLogic] = useState("");
  const [followUp, setFollowUp] = useState({ autoFollowUp: true, delayMinutes: 30 });

  const { data: setupData, isLoading } = useQuery({
    queryKey: ["/v1/setup/status"],
    queryFn: async () => {
      const res = await fetch("/v1/setup/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch setup status");
      return res.json();
    },
    enabled: !!token,
  });

  useEffect(() => {
    if (setupData?.organization) {
      const org = setupData.organization;
      setBasics({ name: org.name || "", timezone: org.timezone || "America/New_York" });
      setPracticeAreas(org.practiceAreas || []);
      if (org.aiConfig) {
        setAiConfig({
          voiceGreeting: org.aiConfig.voiceGreeting || "",
          disclaimerText: org.aiConfig.disclaimerText || "",
          toneProfile: (org.aiConfig.toneProfile as any)?.style || "professional",
        });
        if (org.aiConfig.handoffRules) {
          const rules = org.aiConfig.handoffRules as any;
          if (rules.businessHours) {
            setBusinessHours({
              startTime: rules.businessHours.start || "09:00",
              endTime: rules.businessHours.end || "17:00",
              afterHoursBehavior: rules.afterHoursBehavior || "voicemail",
            });
          }
        }
      }
    }
  }, [setupData]);

  useEffect(() => {
    // Only redirect if onboarding is complete AND not in edit mode
    if (setupData?.onboardingStatus === "complete" && !isEditMode) {
      setLocation("/leads");
    }
  }, [setupData, setLocation, isEditMode]);

  const saveMutation = useMutation({
    mutationFn: async ({ endpoint, data }: { endpoint: string; data: any }) => {
      const res = await fetch(endpoint, {
        method: endpoint.includes("phone-numbers") ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/v1/setup/status"] });
      toast({ title: "Saved" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/v1/setup/complete", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to complete setup");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Setup complete", description: "Your account is now ready to use" });
      setLocation("/leads");
    },
  });

  function handleNext() {
    switch (currentStep) {
      case 1:
        saveMutation.mutate({ endpoint: "/v1/setup/basics", data: basics });
        break;
      case 2:
        saveMutation.mutate({
          endpoint: "/v1/setup/business-hours",
          data: { businessHours: { start: businessHours.startTime, end: businessHours.endTime }, afterHoursBehavior: businessHours.afterHoursBehavior },
        });
        break;
      case 3:
        saveMutation.mutate({ endpoint: "/v1/setup/practice-areas", data: { practiceAreas } });
        break;
      case 4:
        if (phoneNumber.e164) {
          saveMutation.mutate({ endpoint: "/v1/setup/phone-numbers", data: { ...phoneNumber, isPrimary: true } });
        }
        break;
      case 5:
        saveMutation.mutate({
          endpoint: "/v1/setup/ai-config",
          data: { voiceGreeting: aiConfig.voiceGreeting, disclaimerText: aiConfig.disclaimerText, toneProfile: { style: aiConfig.toneProfile } },
        });
        break;
      case 6:
        if (intakeLogic && intakeLogic.trim()) {
          try {
            const parsedSchema = JSON.parse(intakeLogic);
            const activePracticeAreas = practiceAreas.filter(pa => pa.active);
            const questionSets = activePracticeAreas.length > 0 
              ? activePracticeAreas.map(pa => ({
                  practiceAreaId: pa.id,
                  name: `${pa.name} Intake`,
                  schema: parsedSchema,
                  active: true,
                }))
              : [];
            saveMutation.mutate({ endpoint: "/v1/setup/intake-logic", data: { questionSets } });
          } catch {
            toast({ title: "Invalid JSON", variant: "destructive" });
            return;
          }
        }
        break;
      case 7:
        saveMutation.mutate({ endpoint: "/v1/setup/follow-up", data: { followUpConfig: followUp } });
        break;
    }
    if (currentStep < 8) {
      setCurrentStep((s) => s + 1);
    }
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(1, s - 1));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Welcome to CounselTech</h1>
          <p className="text-muted-foreground">Complete your setup to get started</p>
        </div>

        <div className="flex justify-center mb-8 overflow-x-auto">
          <div className="flex items-center gap-1">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors ${
                    currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : currentStep > step.id
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                  data-testid={`step-${step.id}`}
                >
                  <step.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{step.title}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>

        <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary" />
                {STEP_HELP[currentStep]?.title}
              </DialogTitle>
              <DialogDescription>
                {STEP_HELP[currentStep]?.description}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <h4 className="font-medium text-sm text-foreground">Frequently Asked Questions</h4>
              <div className="space-y-3">
                {STEP_HELP[currentStep]?.faqs.map((faq, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <p className="font-medium text-sm text-foreground">{faq.q}</p>
                    <p className="text-sm text-muted-foreground mt-1">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                {(() => {
                  const StepIcon = STEPS[currentStep - 1].icon;
                  return <StepIcon className="w-5 h-5" />;
                })()}
                {STEPS[currentStep - 1].title}
              </CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setHelpOpen(true)}
                aria-label="Get help for this step"
                data-testid="button-help"
              >
                <HelpCircle className="w-5 h-5 text-muted-foreground" />
              </Button>
            </div>
            <CardDescription>Step {currentStep} of 8</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Firm Name</Label>
                  <Input
                    id="name"
                    value={basics.name}
                    onChange={(e) => setBasics({ ...basics, name: e.target.value })}
                    placeholder="Your law firm name"
                    data-testid="input-firm-name"
                  />
                </div>
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={basics.timezone} onValueChange={(v) => setBasics({ ...basics, timezone: v })}>
                    <SelectTrigger data-testid="select-timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startTime">Office Opens</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={businessHours.startTime}
                      onChange={(e) => setBusinessHours({ ...businessHours, startTime: e.target.value })}
                      data-testid="input-start-time"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime">Office Closes</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={businessHours.endTime}
                      onChange={(e) => setBusinessHours({ ...businessHours, endTime: e.target.value })}
                      data-testid="input-end-time"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="afterHours">After-Hours Behavior</Label>
                  <Select
                    value={businessHours.afterHoursBehavior}
                    onValueChange={(v) => setBusinessHours({ ...businessHours, afterHoursBehavior: v })}
                  >
                    <SelectTrigger data-testid="select-after-hours">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="voicemail">Send to Voicemail</SelectItem>
                      <SelectItem value="ai_agent">AI Agent Handles</SelectItem>
                      <SelectItem value="forwarding">Forward to Cell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Enable the practice areas your firm handles</p>
                {practiceAreas.map((pa) => (
                  <div key={pa.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <span className="font-medium">{pa.name}</span>
                    <Switch
                      checked={pa.active}
                      onCheckedChange={(checked) => {
                        setPracticeAreas((prev) =>
                          prev.map((p) => (p.id === pa.id ? { ...p, active: checked } : p))
                        );
                      }}
                      data-testid={`switch-pa-${pa.id}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Add your firm's phone number. Telephony integration will be configured later.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phoneLabel">Label</Label>
                    <Input
                      id="phoneLabel"
                      value={phoneNumber.label}
                      onChange={(e) => setPhoneNumber({ ...phoneNumber, label: e.target.value })}
                      placeholder="Main Office"
                      data-testid="input-phone-label"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phoneE164">Phone Number (E.164)</Label>
                    <Input
                      id="phoneE164"
                      value={phoneNumber.e164}
                      onChange={(e) => setPhoneNumber({ ...phoneNumber, e164: e.target.value })}
                      placeholder="+15551234567"
                      data-testid="input-phone-e164"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>Enable After-Hours AI</Label>
                    <p className="text-sm text-muted-foreground">AI will answer calls outside business hours</p>
                  </div>
                  <Switch
                    checked={phoneNumber.afterHoursEnabled}
                    onCheckedChange={(c) => setPhoneNumber({ ...phoneNumber, afterHoursEnabled: c })}
                    data-testid="switch-after-hours"
                  />
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="voiceGreeting">Voice Greeting</Label>
                  <Textarea
                    id="voiceGreeting"
                    rows={3}
                    value={aiConfig.voiceGreeting}
                    onChange={(e) => setAiConfig({ ...aiConfig, voiceGreeting: e.target.value })}
                    placeholder="Hello, thank you for calling..."
                    data-testid="input-voice-greeting"
                  />
                </div>
                <div>
                  <Label htmlFor="disclaimerText">Disclaimer Text</Label>
                  <Textarea
                    id="disclaimerText"
                    rows={2}
                    value={aiConfig.disclaimerText}
                    onChange={(e) => setAiConfig({ ...aiConfig, disclaimerText: e.target.value })}
                    placeholder="This call may be recorded..."
                    data-testid="input-disclaimer"
                  />
                </div>
                <div>
                  <Label htmlFor="toneProfile">AI Tone</Label>
                  <Select
                    value={aiConfig.toneProfile}
                    onValueChange={(v) => setAiConfig({ ...aiConfig, toneProfile: v })}
                  >
                    <SelectTrigger data-testid="select-tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="empathetic">Empathetic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {currentStep === 6 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configure intake question sets for each practice area. You can edit these later.
                </p>
                <div>
                  <Label htmlFor="intakeLogic">Question Set Schema (JSON, optional)</Label>
                  <Textarea
                    id="intakeLogic"
                    rows={6}
                    value={intakeLogic}
                    onChange={(e) => setIntakeLogic(e.target.value)}
                    placeholder='{"questions": [...]}'
                    className="font-mono text-sm"
                    data-testid="input-intake-logic"
                  />
                </div>
              </div>
            )}

            {currentStep === 7 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>Auto Follow-up</Label>
                    <p className="text-sm text-muted-foreground">Automatically follow up with leads</p>
                  </div>
                  <Switch
                    checked={followUp.autoFollowUp}
                    onCheckedChange={(c) => setFollowUp({ ...followUp, autoFollowUp: c })}
                    data-testid="switch-auto-followup"
                  />
                </div>
                {followUp.autoFollowUp && (
                  <div>
                    <Label htmlFor="delayMinutes">Follow-up Delay (minutes)</Label>
                    <Input
                      id="delayMinutes"
                      type="number"
                      value={followUp.delayMinutes}
                      onChange={(e) => setFollowUp({ ...followUp, delayMinutes: parseInt(e.target.value) || 30 })}
                      data-testid="input-delay-minutes"
                    />
                  </div>
                )}
              </div>
            )}

            {currentStep === 8 && (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Review your settings and complete the setup.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Firm Details</h4>
                    <p className="text-sm text-muted-foreground">Name: {basics.name || organization?.name}</p>
                    <p className="text-sm text-muted-foreground">Timezone: {basics.timezone}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Business Hours</h4>
                    <p className="text-sm text-muted-foreground">
                      {businessHours.startTime} - {businessHours.endTime}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Practice Areas</h4>
                    <p className="text-sm text-muted-foreground">
                      {practiceAreas.filter((pa) => pa.active).map((pa) => pa.name).join(", ") || "None selected"}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">AI Voice</h4>
                    <p className="text-sm text-muted-foreground">Tone: {aiConfig.toneProfile}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleBack} disabled={currentStep === 1} data-testid="button-back">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              {currentStep < 8 ? (
                <Button onClick={handleNext} disabled={saveMutation.isPending} data-testid="button-next">
                  {saveMutation.isPending ? "Saving..." : "Next"}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending} data-testid="button-complete">
                  {completeMutation.isPending ? "Completing..." : "Complete Setup"}
                  <Check className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
