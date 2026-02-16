import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { getBestPhone, getBestDisplayName, getBestPracticeArea } from "@/lib/lead-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CaseProgressBar, type Milestone } from "@/components/ui/case-progress-bar";
import { useToast } from "@/hooks/use-toast";
import { IntakeAnalysisCard } from "@/components/intake-analysis-card";
import { SummaryTab } from "@/components/case/summary-tab";
import { TranscriptTab } from "@/components/case/transcript-tab";
import { ActivityTab } from "@/components/case/activity-tab";
import { CallsTab } from "@/components/case/calls-tab";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  MapPin,
  MessageSquare,
  PhoneCall,
  ClipboardList,
  CheckCircle,
  Bell,
  FileText,
  User,
  Clock,
  Play,
  Save,
  CheckCheck,
  Loader2,
  Zap,
  AlertTriangle,
  Info,
  Target,
  Flag,
  XCircle,
  CalendarCheck,
  FileSignature,
  UserCheck,
} from "lucide-react";

interface Contact {
  id: string;
  name: string;
  primaryPhone: string | null;
  primaryEmail: string | null;
  createdAt: string;
}

interface Lead {
  id: string;
  contactId: string;
  source: string;
  status: string;
  priority: string;
  displayName: string | null;
  practiceAreaId: string | null;
  incidentDate: string | null;
  incidentLocation: string | null;
  summary: string | null;
  score: number | null;
  scoreLabel: string | null;
  scoreReasons: string[] | null;
  urgency: string | null;
  intakeData: any | null;
  createdAt: string;
  updatedAt: string;
  contact: Contact;
  practiceArea: { id: string; name: string } | null;
  firstContactAt: string | null;
  consultScheduledAt: string | null;
  consultCompletedAt: string | null;
  retainerSentAt: string | null;
  retainerSignedAt: string | null;
  rejectedAt: string | null;
}

interface Interaction {
  id: string;
  channel: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  metadata: any;
  call: {
    id: string;
    direction: string;
    provider: string;
    fromE164: string;
    toE164: string;
    startedAt: string;
    endedAt: string | null;
    durationSeconds: number | null;
    recordingUrl: string | null;
  } | null;
  messages: {
    id: string;
    direction: string;
    channel: string;
    from: string;
    to: string;
    body: string;
    createdAt: string;
  }[];
}

interface IntakeResponse {
  exists: boolean;
  intake: {
    id: string;
    leadId: string;
    questionSetId: string | null;
    practiceAreaId: string | null;
    answers: Record<string, any> | null;
    completionStatus: string;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    questionSet: { id: string; name: string; schema: any; version: number } | null;
    practiceArea: { id: string; name: string } | null;
  } | null;
}

interface ScoreFactor {
  name: string;
  weight: number;
  evidence: string;
  evidence_quote: string | null;
}

interface QualificationReasons {
  score_factors: ScoreFactor[];
  missing_fields: string[];
  disqualifiers: string[];
  routing: { practice_area_id: string | null; notes: string | null };
  model: { provider: string; model: string; version: string | null };
  explanations: string[];
}

interface QualificationResponse {
  exists: boolean;
  qualification: {
    id: string;
    leadId: string;
    score: number;
    disposition: string;
    confidence: number;
    reasons: QualificationReasons | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-primary text-primary-foreground",
  contacted: "bg-blue-500 text-white dark:bg-blue-600",
  qualified: "bg-green-500 text-white dark:bg-green-600",
  unqualified: "bg-muted text-muted-foreground",
  converted: "bg-emerald-500 text-white dark:bg-emerald-600",
  closed: "bg-muted text-muted-foreground",
};

const MILESTONE_STEPS = [
  { key: "firstContactAt", label: "First Contact", icon: Phone },
  { key: "consultScheduledAt", label: "Consult Scheduled", icon: CalendarCheck },
  { key: "consultCompletedAt", label: "Consult Completed", icon: UserCheck },
  { key: "retainerSentAt", label: "Retainer Sent", icon: FileSignature },
  { key: "retainerSignedAt", label: "Signed", icon: CheckCircle },
] as const;

function buildProgressMilestones(lead: Lead): Milestone[] {
  return MILESTONE_STEPS.map((step) => {
    const value = lead[step.key as keyof Lead] as string | null;
    return {
      key: step.key,
      label: step.label,
      completed: !!value,
      date: value,
    };
  });
}

function IntakePanel({ leadId, token }: { leadId: string; token: string }) {
  const { toast } = useToast();
  const [answersJson, setAnswersJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const { data: intakeResponse, isLoading } = useQuery<IntakeResponse>({
    queryKey: ["/v1/leads", leadId, "intake"],
    queryFn: async () => {
      const res = await fetch(`/v1/leads/${leadId}/intake`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch intake");
      return res.json();
    },
  });

  const initMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/leads/${leadId}/intake/init`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to initialize intake");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/v1/leads", leadId, "intake"] });
      toast({ title: "Intake initialized" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (answers: Record<string, any>) => {
      const res = await fetch(`/v1/leads/${leadId}/intake`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ answers }), // guardrail-allow: json-dump
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save intake");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/v1/leads", leadId, "intake"] });
      toast({ title: "Intake saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/leads/${leadId}/intake/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to complete intake");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/v1/leads", leadId, "intake"] });
      toast({ title: "Intake completed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    try {
      const parsed = JSON.parse(answersJson || "{}"); // guardrail-allow: json-dump
      setJsonError(null);
      saveMutation.mutate(parsed);
    } catch {
      setJsonError("Invalid JSON format");
    }
  };

  if (isLoading) return <Skeleton className="h-40" />;

  if (!intakeResponse?.exists) {
    return (
      <div className="py-6 text-center">
        <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground mb-4 text-sm">No intake started for this case</p>
        <Button
          onClick={() => initMutation.mutate()}
          disabled={initMutation.isPending}
          data-testid="button-init-intake"
        >
          {initMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Play className="h-4 w-4 mr-2" />
          Start Intake
        </Button>
      </div>
    );
  }

  const intake = intakeResponse.intake!;
  const isComplete = intake.completionStatus === "complete";
  const currentAnswers = intake.answers || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge variant={isComplete ? "default" : "secondary"} data-testid="badge-intake-status">
          {isComplete ? "Complete" : "In Progress"}
        </Badge>
        {intake.questionSet && (
          <span className="text-xs text-muted-foreground">
            {intake.questionSet.name} (v{intake.questionSet.version})
          </span>
        )}
      </div>
      <IntakeAnalysisCard
        answers={currentAnswers}
        data-testid="text-intake-answers"
      />
      {!isComplete && (
        <>
          <Textarea
            value={answersJson}
            onChange={(e) => { setAnswersJson(e.target.value); setJsonError(null); }}
            placeholder='{"question1": "answer1"}'
            className="font-mono text-xs"
            rows={4}
            data-testid="input-intake-answers"
          />
          {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saveMutation.isPending || !answersJson.trim()} data-testid="button-save-intake">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button size="sm" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending} data-testid="button-complete-intake">
              {completeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCheck className="h-4 w-4 mr-2" />
              Complete
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function QualificationPanel({ leadId, token }: { leadId: string; token: string }) {
  const { toast } = useToast();

  const { data: qualResponse, isLoading } = useQuery<QualificationResponse>({
    queryKey: ["/v1/leads", leadId, "qualification"],
    queryFn: async () => {
      const res = await fetch(`/v1/leads/${leadId}/qualification`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch qualification");
      return res.json();
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/leads/${leadId}/qualification/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to run qualification");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/v1/leads", leadId, "qualification"] });
      queryClient.invalidateQueries({ queryKey: ["/v1/leads", leadId] });
      toast({ title: "Qualification completed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getDispositionColor = (disposition: string) => {
    switch (disposition) {
      case "accept": return "bg-green-500 text-white dark:bg-green-600";
      case "decline": return "bg-destructive text-destructive-foreground";
      default: return "bg-yellow-500 text-white dark:bg-yellow-600";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600 dark:text-green-400";
    if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  if (isLoading) return <Skeleton className="h-40" />;

  if (!qualResponse?.exists) {
    return (
      <div className="py-6 text-center">
        <Target className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground mb-4 text-sm">No qualification run for this case</p>
        <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending} data-testid="button-run-qualification">
          {runMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Zap className="h-4 w-4 mr-2" />
          Run AI Qualification
        </Button>
      </div>
    );
  }

  const qual = qualResponse.qualification!;
  const reasons = qual.reasons || {
    score_factors: [], missing_fields: [], disqualifiers: [],
    routing: { practice_area_id: null, notes: null },
    model: { provider: "unknown", model: "unknown", version: null },
    explanations: [],
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="space-y-1 p-2 bg-muted/50 rounded-lg">
          <p className="text-[10px] text-muted-foreground">Score</p>
          <p className={`text-lg font-bold ${getScoreColor(qual.score)}`} data-testid="text-score">{qual.score}</p>
        </div>
        <div className="space-y-1 p-2 bg-muted/50 rounded-lg">
          <p className="text-[10px] text-muted-foreground">Confidence</p>
          <p className="text-lg font-bold" data-testid="text-confidence">{qual.confidence}%</p>
        </div>
        <div className="space-y-1 p-2 bg-muted/50 rounded-lg">
          <p className="text-[10px] text-muted-foreground">Result</p>
          <Badge className={`text-xs ${getDispositionColor(qual.disposition)}`} data-testid="badge-disposition">
            {qual.disposition}
          </Badge>
        </div>
      </div>

      {reasons.score_factors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            Score Factors
          </h4>
          <div className="space-y-2">
            {reasons.score_factors.map((factor, idx) => (
              <div key={idx} className="bg-muted p-2 rounded-md text-xs" data-testid={`factor-${idx}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{factor.name}</span>
                  <Badge variant="outline" className="text-[10px]">+{factor.weight}</Badge>
                </div>
                <p className="text-muted-foreground mt-1">{factor.evidence}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {reasons.missing_fields.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-yellow-500" />
            Missing Information
          </h4>
          <div className="flex flex-wrap gap-1">
            {reasons.missing_fields.map((field, idx) => (
              <Badge key={idx} variant="secondary" className="text-[10px]">{field.replace(/_/g, " ")}</Badge>
            ))}
          </div>
        </div>
      )}

      {reasons.disqualifiers.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3 w-3" />
            Disqualifiers
          </h4>
          {reasons.disqualifiers.map((dq, idx) => (
            <p key={idx} className="text-xs text-destructive">{dq}</p>
          ))}
        </div>
      )}

      {reasons.explanations.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium flex items-center gap-1">
            <Info className="h-3 w-3 text-blue-500" />
            AI Explanation
          </h4>
          {reasons.explanations.map((exp, idx) => (
            <p key={idx} className="text-xs text-muted-foreground">{exp}</p>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground" data-testid="text-model">
        Model: {reasons.model.provider}/{reasons.model.model}{reasons.model.version ? ` v${reasons.model.version}` : ""}
      </p>

      <Button variant="outline" size="sm" onClick={() => runMutation.mutate()} disabled={runMutation.isPending} data-testid="button-rerun-qualification">
        {runMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        <Zap className="h-4 w-4 mr-2" />
        Re-run Qualification
      </Button>
    </div>
  );
}

function FunnelMilestonesPanel({ lead, leadId, token }: { lead: Lead; leadId: string; token: string }) {
  const { toast } = useToast();

  const milestoneMutation = useMutation({
    mutationFn: async ({ milestone, value }: { milestone: string; value: string | null }) => {
      const res = await fetch(`/v1/leads/${leadId}/milestones`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ [milestone]: value }), // guardrail-allow: json-dump
      });
      if (!res.ok) throw new Error("Failed to update milestone");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/v1/leads", leadId] });
      toast({ title: "Milestone updated" });
    },
    onError: () => {
      toast({ title: "Failed to update milestone", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/leads/${leadId}/milestones`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ rejectedAt: new Date().toISOString() }), // guardrail-allow: json-dump
      });
      if (!res.ok) throw new Error("Failed to reject case");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/v1/leads", leadId] });
      toast({ title: "Case marked as rejected" });
    },
    onError: () => {
      toast({ title: "Failed to reject case", variant: "destructive" });
    },
  });

  const isRejected = !!lead.rejectedAt;
  const isPending = milestoneMutation.isPending || rejectMutation.isPending;

  const handleMilestoneClick = (milestone: string, currentValue: string | null) => {
    if (isPending || isRejected) return;
    milestoneMutation.mutate({ milestone, value: currentValue ? null : new Date().toISOString() });
  };

  return (
    <Card data-testid="card-funnel-milestones">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Flag className="h-4 w-4" />
          Case Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isRejected && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm mb-3">
            <XCircle className="h-4 w-4" />
            <span>Rejected {new Date(lead.rejectedAt!).toLocaleDateString()}</span>
          </div>
        )}
        {MILESTONE_STEPS.map((step) => {
          const value = lead[step.key as keyof Lead] as string | null;
          const isComplete = !!value;
          const Icon = step.icon;
          return (
            <button
              key={step.key}
              onClick={() => handleMilestoneClick(step.key, value)}
              disabled={isPending || isRejected}
              className={`flex items-center gap-3 w-full p-2 rounded-md text-left text-sm transition-colors ${
                isComplete
                  ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                  : "bg-muted/50 text-muted-foreground hover-elevate"
              } ${isPending || isRejected ? "opacity-50 cursor-not-allowed" : ""}`}
              data-testid={`milestone-${step.key}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                isComplete ? "bg-green-500 text-white" : "bg-muted"
              }`}>
                {isComplete ? <CheckCircle className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{step.label}</p>
                {isComplete && <p className="text-xs opacity-70">{new Date(value!).toLocaleDateString()}</p>}
              </div>
            </button>
          );
        })}
        <div className="pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => rejectMutation.mutate()}
            disabled={isPending || isRejected}
            data-testid="button-reject-case"
          >
            <XCircle className="h-4 w-4 mr-2" />
            {isRejected ? "Rejected" : "Reject Case"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MobileQuickActions({ lead }: { lead: Lead }) {
  const phone = getBestPhone(lead);
  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 bg-background border-t p-3 flex items-center justify-around gap-2 md:hidden safe-area-bottom">
      {phone && (
        <a href={`tel:${phone}`} className="flex-1">
          <Button variant="outline" className="w-full gap-2" data-testid="mobile-action-call">
            <Phone className="h-4 w-4" />
            Call
          </Button>
        </a>
      )}
      {phone && (
        <a href={`sms:${phone}`} className="flex-1">
          <Button variant="outline" className="w-full gap-2" data-testid="mobile-action-text">
            <MessageSquare className="h-4 w-4" />
            Text
          </Button>
        </a>
      )}
      {lead.contact.primaryEmail && (
        <a href={`mailto:${lead.contact.primaryEmail}`} className="flex-1">
          <Button variant="outline" className="w-full gap-2" data-testid="mobile-action-email">
            <Mail className="h-4 w-4" />
            Email
          </Button>
        </a>
      )}
    </div>
  );
}

export default function CaseDetailPage() {
  const [, params] = useRoute("/cases/:id");
  const { token } = useAuth();
  const leadId = params?.id;

  const { data: lead, isLoading, error } = useQuery<Lead>({
    queryKey: ["/v1/leads", leadId],
    queryFn: async () => {
      const res = await fetch(`/v1/leads/${leadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch case");
      return res.json();
    },
    enabled: !!leadId,
  });

  const { data: interactions = [] } = useQuery<Interaction[]>({
    queryKey: ["/v1/leads", leadId, "interactions"],
    queryFn: async () => {
      const res = await fetch(`/v1/leads/${leadId}/interactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch interactions");
      return res.json();
    },
    enabled: !!leadId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="space-y-4">
        <Link href="/cases">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cases
          </Button>
        </Link>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Case not found or failed to load.
          </CardContent>
        </Card>
      </div>
    );
  }

  const phone = getBestPhone(lead);
  const milestones = buildProgressMilestones(lead);

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      {/* Sticky header */}
      <div className="sticky top-12 z-30 bg-[#F3F4F6] dark:bg-background -mx-4 px-4 py-3 md:-mx-6 md:px-6">
        <div className="flex items-center gap-2">
          <Link href="/cases">
            <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold truncate" data-testid="text-case-name">
                {getBestDisplayName(lead)}
              </h1>
              <Badge className={`text-xs ${STATUS_COLORS[lead.status]}`} data-testid="badge-status">
                {lead.status}
              </Badge>
            </div>
          </div>
          {/* Quick actions - desktop */}
          <div className="hidden md:flex items-center gap-1">
            {phone && (
              <a href={`tel:${phone}`}>
                <Button variant="outline" size="sm"><Phone className="h-3 w-3 mr-1" />Call</Button>
              </a>
            )}
            {phone && (
              <a href={`sms:${phone}`}>
                <Button variant="outline" size="sm"><MessageSquare className="h-3 w-3 mr-1" />Text</Button>
              </a>
            )}
            {lead.contact.primaryEmail && (
              <a href={`mailto:${lead.contact.primaryEmail}`}>
                <Button variant="outline" size="sm"><Mail className="h-3 w-3 mr-1" />Email</Button>
              </a>
            )}
          </div>
        </div>

        {/* Compact progress bar below header */}
        <div className="mt-2">
          <CaseProgressBar milestones={milestones} />
        </div>
      </div>

      {/* Main content with tabs */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main column with tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="summary" data-testid="case-tabs">
            <TabsList className="w-full">
              <TabsTrigger value="summary" className="flex-1">Summary</TabsTrigger>
              <TabsTrigger value="transcript" className="flex-1">Transcript</TabsTrigger>
              <TabsTrigger value="calls" className="flex-1">Calls</TabsTrigger>
              <TabsTrigger value="activity" className="flex-1">
                Activity
                {interactions.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{interactions.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="intake" className="flex-1">Intake</TabsTrigger>
              <TabsTrigger value="score" className="flex-1">Score</TabsTrigger>
            </TabsList>

            <TabsContent value="summary">
              <SummaryTab leadId={leadId!} />
            </TabsContent>

            <TabsContent value="transcript">
              <TranscriptTab leadId={leadId!} />
            </TabsContent>

            <TabsContent value="calls">
              <CallsTab leadId={leadId!} />
            </TabsContent>

            <TabsContent value="activity">
              <ActivityTab interactions={interactions} />
            </TabsContent>

            <TabsContent value="intake">
              <IntakePanel leadId={leadId!} token={token!} />
            </TabsContent>

            <TabsContent value="score">
              <QualificationPanel leadId={leadId!} token={token!} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - Desktop only */}
        <div className="hidden lg:block space-y-4">
          {/* Contact Info Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  {getBestDisplayName(lead).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm">{getBestDisplayName(lead)}</p>
                  <p className="text-xs text-muted-foreground">
                    Since {new Date(lead.contact.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${phone}`} className="hover:underline">{phone}</a>
                </div>
              )}
              {lead.contact.primaryEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${lead.contact.primaryEmail}`} className="hover:underline truncate">{lead.contact.primaryEmail}</a>
                </div>
              )}
              <div className="grid gap-3 grid-cols-2 pt-2 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="text-sm font-medium capitalize">{lead.source}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Practice Area</p>
                  <p className="text-sm font-medium">{getBestPracticeArea(lead)}</p>
                </div>
              </div>
              {(lead.incidentDate || lead.incidentLocation) && (
                <div className="pt-2 border-t space-y-2">
                  {lead.incidentDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{new Date(lead.incidentDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {lead.incidentLocation && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.incidentLocation}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <FunnelMilestonesPanel lead={lead} leadId={leadId!} token={token!} />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground py-6">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile Quick Actions */}
      <MobileQuickActions lead={lead} />
    </div>
  );
}
