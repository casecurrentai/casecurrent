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
import { Check, ChevronRight, ChevronLeft, Building2, Clock, Briefcase, Phone, Bot, FileText, Bell, CheckCircle } from "lucide-react";

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

export default function SetupWizardPage() {
  const { token, organization, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);

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
    if (setupData?.onboardingStatus === "complete") {
      setLocation("/leads");
    }
  }, [setupData, setLocation]);

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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const StepIcon = STEPS[currentStep - 1].icon;
                return <StepIcon className="w-5 h-5" />;
              })()}
              {STEPS[currentStep - 1].title}
            </CardTitle>
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
