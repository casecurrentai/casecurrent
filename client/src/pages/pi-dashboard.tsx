import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Phone,
  PhoneMissed,
  CheckCircle,
  AlertTriangle,
  Target,
  Zap,
  ArrowRight,
  CalendarCheck,
  FileSignature,
  UserCheck,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FunnelStage {
  name: string;
  count: number;
  conversion: number | null;
  trend: number;
}

interface SpeedMetrics {
  medianMinutes: number | null;
  p90Minutes: number | null;
  within5Min: number;
  within15Min: number;
  within60Min: number;
  missedCallBacklog: number;
}

interface MissedCall {
  id: string;
  callId: string;
  leadId: string;
  contactName: string;
  phone: string;
  calledAt: string;
  waitingMinutes: number;
  resolved: boolean;
}

interface SourceROI {
  source: string;
  calls: number;
  qualified: number;
  signed: number;
  qualifiedRate: number;
  signedRate: number;
}

interface IntakeField {
  field: string;
  captured: number;
  total: number;
  percentage: number;
}

interface IntakeCompleteness {
  overallPercentage: number;
  fields: IntakeField[];
  dropOffStep: string | null;
}

interface PIDashboardData {
  funnel: FunnelStage[];
  speed: SpeedMetrics;
  rescueQueue: MissedCall[];
  sourceROI: SourceROI[];
  intakeCompleteness: IntakeCompleteness;
  periodStart: string;
  periodEnd: string;
}

const FIELD_LABELS: Record<string, string> = {
  callerName: "Caller Name",
  phone: "Phone Number",
  incidentDate: "Incident Date",
  incidentLocation: "Incident Location",
  injuryDescription: "Injury Description",
  atFault: "At-Fault Party",
  medicalTreatment: "Medical Treatment",
  insuranceInfo: "Insurance Info",
};

function formatWaitTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

export default function PIDashboardPage() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const firstName = user?.name?.split(" ")[0] || "there";

  const { data, isLoading, error } = useQuery<PIDashboardData>({
    queryKey: ["/v1/analytics/pi-dashboard"],
    queryFn: async () => {
      const res = await fetch("/v1/analytics/pi-dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body}`);
      }
      return res.json();
    },
    enabled: !!token,
  });

  const resolveMutation = useMutation({
    mutationFn: async (callId: string) => {
      const res = await fetch(`/v1/calls/${callId}/rescue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error("Failed to resolve call");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/v1/analytics/pi-dashboard"] });
      toast({ title: "Call marked as resolved" });
    },
    onError: () => {
      toast({ title: "Failed to resolve call", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="mb-2">Failed to load dashboard data.</p>
            {error && (
              <p className="text-xs text-destructive">{error.message}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Extract key metrics from funnel
  const newCases24h = data.funnel.find(s => s.name === "New" || s.name === "new")?.count ?? 0;
  const qualifiedCount = data.funnel.find(s => s.name === "Qualified" || s.name === "qualified")?.count ?? 0;
  const missedBacklog = data.speed.missedCallBacklog;

  // Pipeline metrics from funnel
  const consultsScheduled = data.funnel.find(s => s.name === "Consult Scheduled" || s.name === "consult_scheduled")?.count ?? 0;
  const retainersSent = data.funnel.find(s => s.name === "Retainer Sent" || s.name === "retainer_sent")?.count ?? 0;
  const retainersSigned = data.funnel.find(s => s.name === "Signed" || s.name === "signed" || s.name === "Converted" || s.name === "converted")?.count ?? 0;

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-dashboard-title">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">{dateStr}</p>
        </div>
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
          {firstName.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Pulse Card - Hero metric */}
      <Link href="/cases?filter=new">
        <Card className="bg-primary text-primary-foreground cursor-pointer hover-elevate" data-testid="card-pulse">
          <CardContent className="p-5">
            <p className="text-sm opacity-80">New Cases (30d)</p>
            <p className="text-4xl font-bold mt-1">{newCases24h}</p>
            <p className="text-sm opacity-80 mt-2">
              Qualified: {qualifiedCount} &middot; Missed calls: {missedBacklog}
            </p>
          </CardContent>
        </Card>
      </Link>

      {/* Daily Worklist - Rescue queue */}
      <Card data-testid="card-worklist">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Priority Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.rescueQueue.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">All caught up</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.rescueQueue.slice(0, 5).map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  data-testid={`rescue-item-${call.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <PhoneMissed className="h-4 w-4 text-destructive flex-shrink-0" />
                      <p className="font-medium text-sm truncate">{call.contactName}</p>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      Missed call &middot; {formatWaitTime(call.waitingMinutes)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a href={`tel:${call.phone}`}>
                      <Button size="sm" variant="outline" data-testid={`button-callback-${call.id}`}>
                        <Phone className="h-3 w-3 mr-1" />
                        Call Back
                      </Button>
                    </a>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => resolveMutation.mutate(call.id)}
                          disabled={resolveMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark done
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/cases/${call.leadId}`}>
                            <ArrowRight className="h-4 w-4 mr-2" />
                            View case
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Snapshot - 3 compact cards */}
      <div className="grid gap-3 grid-cols-3">
        <Card data-testid="card-pipeline-consults">
          <CardContent className="p-3 text-center">
            <CalendarCheck className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{consultsScheduled}</p>
            <p className="text-[10px] text-muted-foreground">Consults</p>
          </CardContent>
        </Card>
        <Card data-testid="card-pipeline-retainers-sent">
          <CardContent className="p-3 text-center">
            <FileSignature className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{retainersSent}</p>
            <p className="text-[10px] text-muted-foreground">Retainers Sent</p>
          </CardContent>
        </Card>
        <Card data-testid="card-pipeline-signed">
          <CardContent className="p-3 text-center">
            <UserCheck className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{retainersSigned}</p>
            <p className="text-[10px] text-muted-foreground">Signed</p>
          </CardContent>
        </Card>
      </div>

      {/* Intake Health */}
      <Card data-testid="card-intake-health">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Intake Health</span>
            </div>
            <span className="text-lg font-bold">{data.intakeCompleteness.overallPercentage}%</span>
          </div>
          <Progress value={data.intakeCompleteness.overallPercentage} className="mb-2" />
          {data.intakeCompleteness.dropOffStep && (
            <div className="flex items-center gap-2 mt-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
              <span>
                Top drop-off: {FIELD_LABELS[data.intakeCompleteness.dropOffStep] || data.intakeCompleteness.dropOffStep}
              </span>
            </div>
          )}
          <Link href="/experiments">
            <Button variant="ghost" size="sm" className="px-0 mt-2 h-auto text-xs text-primary">
              Improve intake <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
