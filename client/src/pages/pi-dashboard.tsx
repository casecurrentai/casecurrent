import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  PhoneIncoming,
  PhoneMissed,
  Users,
  FileCheck,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Link as LinkIcon,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Target,
  Zap,
} from "lucide-react";

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

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "N/A";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function formatWaitTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

export default function PIDashboardPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 sm:p-6">
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

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-20 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Intake Analytics Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Last 30 days: {new Date(data.periodStart).toLocaleDateString()} - {new Date(data.periodEnd).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
        {data.funnel.map((stage, idx) => (
          <Card key={stage.name} className="relative" data-testid={`card-funnel-${idx}`}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground truncate">{stage.name}</span>
                {idx < data.funnel.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground hidden lg:block" />
                )}
              </div>
              <div className="text-xl sm:text-2xl font-bold">{stage.count}</div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {stage.conversion !== null && (
                  <Badge variant="secondary" className="text-[10px]">
                    {stage.conversion}%
                  </Badge>
                )}
                <span className={`text-[10px] flex items-center gap-0.5 ${
                  stage.trend > 0 ? "text-green-600" : stage.trend < 0 ? "text-red-600" : "text-muted-foreground"
                }`}>
                  {stage.trend > 0 ? <TrendingUp className="h-3 w-3" /> : stage.trend < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                  {stage.trend !== 0 && `${Math.abs(stage.trend)}%`}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-speed-metrics">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Response Speed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Median Response</p>
                <p className="text-2xl font-bold">{formatDuration(data.speed.medianMinutes)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">P90 Response</p>
                <p className="text-2xl font-bold">{formatDuration(data.speed.p90Minutes)}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Within 5 min</span>
                <div className="flex items-center gap-2">
                  <Progress value={data.speed.within5Min} className="w-24" />
                  <span className="font-medium w-12 text-right">{data.speed.within5Min}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Within 15 min</span>
                <div className="flex items-center gap-2">
                  <Progress value={data.speed.within15Min} className="w-24" />
                  <span className="font-medium w-12 text-right">{data.speed.within15Min}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Within 60 min</span>
                <div className="flex items-center gap-2">
                  <Progress value={data.speed.within60Min} className="w-24" />
                  <span className="font-medium w-12 text-right">{data.speed.within60Min}%</span>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <PhoneMissed className="h-4 w-4" />
                  Missed Call Backlog
                </span>
                <Badge variant={data.speed.missedCallBacklog > 0 ? "destructive" : "secondary"}>
                  {data.speed.missedCallBacklog}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-rescue-queue">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Missed Call Rescue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.rescueQueue.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">All calls resolved</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.rescueQueue.slice(0, 10).map((call) => (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    data-testid={`rescue-item-${call.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{call.contactName}</p>
                      <p className="text-xs text-muted-foreground">{call.phone}</p>
                      <p className="text-xs text-muted-foreground">{formatWaitTime(call.waitingMinutes)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.location.href = `/leads/${call.leadId}`}
                        data-testid={`button-view-lead-${call.id}`}
                      >
                        <LinkIcon className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => resolveMutation.mutate(call.id)}
                        disabled={resolveMutation.isPending}
                        data-testid={`button-resolve-${call.id}`}
                      >
                        <CheckCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-source-roi">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Source ROI
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.sourceROI.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No source data available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left py-2 font-medium">Source</th>
                      <th className="text-right py-2 font-medium">Leads</th>
                      <th className="text-right py-2 font-medium">Qualified</th>
                      <th className="text-right py-2 font-medium">Signed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sourceROI.map((source) => (
                      <tr key={source.source} className="border-b border-muted/50">
                        <td className="py-2 font-medium capitalize">{source.source}</td>
                        <td className="text-right py-2">{source.calls}</td>
                        <td className="text-right py-2">
                          {source.qualified}
                          <span className="text-xs text-muted-foreground ml-1">({source.qualifiedRate}%)</span>
                        </td>
                        <td className="text-right py-2">
                          {source.signed}
                          <span className="text-xs text-muted-foreground ml-1">({source.signedRate}%)</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-intake-completeness">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-4 w-4" />
              PI Intake Completeness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Overall Capture Rate</span>
              <div className="flex items-center gap-2">
                <Progress value={data.intakeCompleteness.overallPercentage} className="w-24" />
                <span className="font-bold">{data.intakeCompleteness.overallPercentage}%</span>
              </div>
            </div>
            {data.intakeCompleteness.dropOffStep && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs">
                  Top drop-off: <strong>{FIELD_LABELS[data.intakeCompleteness.dropOffStep] || data.intakeCompleteness.dropOffStep}</strong>
                </span>
              </div>
            )}
            <div className="space-y-2">
              {data.intakeCompleteness.fields.map((field) => (
                <div key={field.field} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate flex-1 mr-2">
                    {FIELD_LABELS[field.field] || field.field}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Progress value={field.percentage} className="w-20" />
                    <span className="w-10 text-right text-xs">{field.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
