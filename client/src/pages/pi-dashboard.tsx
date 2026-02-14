import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  ArrowRight,
  MoreVertical,
  BarChart3,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KPIStrip } from "@/components/dashboard/kpi-strip";
import { IntakeFeed } from "@/components/dashboard/intake-feed";


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

  if (error && !data) {
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

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Sticky greeting header */}
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

      {/* KPI Strip — replaces Pulse Card + Pipeline Snapshot */}
      <KPIStrip dashboardData={data} isLoading={isLoading} />

      {/* Two-column layout: IntakeFeed (left) + Analytics Panel (right) */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left column: Intake Feed */}
        <div className="space-y-6">
          <IntakeFeed />

          {/* Rescue Queue — missed calls requiring action */}
          {data && data.rescueQueue.length > 0 && (
            <Card data-testid="card-worklist">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PhoneMissed className="h-4 w-4 text-destructive" />
                  Missed Calls ({data.rescueQueue.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Analytics Panel */}
        <div className="space-y-6">
          {/* Source ROI */}
          <Card data-testid="card-source-roi">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Source Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : !data?.sourceROI.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No source data yet
                </p>
              ) : (
                <div className="space-y-3">
                  {data.sourceROI.map((src) => (
                    <div key={src.source} className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize truncate">{src.source}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{src.calls} calls</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {src.qualifiedRate}% qual
                        </span>
                        <span className="font-medium text-foreground">
                          {src.signed} signed
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversion Funnel */}
          <Card data-testid="card-conversion-funnel">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Conversion Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : !data?.funnel.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No funnel data yet
                </p>
              ) : (
                <div className="space-y-2">
                  {data.funnel.map((stage, i) => {
                    const maxCount = Math.max(...data.funnel.map((s) => s.count), 1);
                    const pct = (stage.count / maxCount) * 100;
                    return (
                      <div key={stage.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="capitalize">{stage.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{stage.count}</span>
                            {stage.conversion != null && (
                              <span className="text-xs text-muted-foreground">
                                ({stage.conversion}%)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Intake Health */}
          <Card data-testid="card-intake-health">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Intake Health</span>
                </div>
                {data && (
                  <span className="text-lg font-bold">
                    {data.intakeCompleteness.overallPercentage}%
                  </span>
                )}
              </div>
              {isLoading ? (
                <Skeleton className="h-2 w-full" />
              ) : data ? (
                <>
                  <Progress value={data.intakeCompleteness.overallPercentage} className="mb-2" />
                  {data.intakeCompleteness.dropOffStep && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>
                        Top drop-off:{" "}
                        {FIELD_LABELS[data.intakeCompleteness.dropOffStep] ||
                          data.intakeCompleteness.dropOffStep}
                      </span>
                    </div>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
