import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FlaskConical, Users, TrendingUp, Target } from "lucide-react";

interface ExperimentReport {
  experimentId: string;
  name: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  variantStats: Record<string, { leads: number; conversions: number; avgScore: number | null }>;
  dailyMetrics: Array<{
    variant: string;
    date: string;
    leads: number;
    conversions: number;
  }>;
  totalAssignments: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-green-500 text-white dark:bg-green-600",
  paused: "bg-yellow-500 text-white dark:bg-yellow-600",
  ended: "bg-muted text-muted-foreground",
};

export default function ExperimentDetailPage() {
  const { token } = useAuth();
  const params = useParams<{ id: string }>();

  const { data: report, isLoading } = useQuery<ExperimentReport>({
    queryKey: ["/v1/experiments", params.id, "report"],
    queryFn: async () => {
      const res = await fetch(`/v1/experiments/${params.id}/report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch report");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Skeleton className="h-8 w-48 sm:w-64" />
        <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3">
          <Skeleton className="h-24 sm:h-32" />
          <Skeleton className="h-24 sm:h-32" />
          <Skeleton className="h-24 sm:h-32 col-span-2 sm:col-span-1" />
        </div>
        <Skeleton className="h-48 sm:h-64" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <Link href="/experiments">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <p className="text-muted-foreground">Experiment not found</p>
      </div>
    );
  }

  const variants = Object.entries(report.variantStats);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start gap-2 sm:gap-4">
        <Link href="/experiments">
          <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight flex items-center gap-2 truncate" data-testid="text-experiment-name">
              <FlaskConical className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
              <span className="truncate">{report.name}</span>
            </h1>
            <Badge className={`${STATUS_COLORS[report.status]} text-xs shrink-0`}>
              {report.status}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {report.startedAt && `Started ${new Date(report.startedAt).toLocaleDateString()}`}
            {report.endedAt && ` - Ended ${new Date(report.endedAt).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      {/* Stats cards - 2 columns on mobile, 3 on desktop */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Assignments</CardTitle>
            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold" data-testid="text-total-assignments">
              {report.totalAssignments}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
              Leads assigned to this experiment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Variants</CardTitle>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold" data-testid="text-variant-count">
              {variants.length}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
              Test groups being compared
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Conversion</CardTitle>
            <Target className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold" data-testid="text-overall-conversion">
              {report.totalAssignments > 0
                ? `${Math.round((variants.reduce((sum, [, s]) => sum + s.conversions, 0) / report.totalAssignments) * 100)}%`
                : "N/A"}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
              Leads that converted to accepted
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Variant Performance */}
      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg">Variant Performance</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {variants.length === 0 ? (
            <p className="text-muted-foreground text-center py-6 sm:py-8 text-sm">
              No data yet. Assign leads to this experiment to see results.
            </p>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {variants.map(([variant, stats]) => {
                const conversionRate = stats.leads > 0 ? (stats.conversions / stats.leads) * 100 : 0;
                return (
                  <div
                    key={variant}
                    className="flex items-center justify-between p-3 sm:p-4 border rounded-md gap-4"
                    data-testid={`row-variant-${variant}`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{variant}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {stats.leads} leads, {stats.conversions} conv.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base sm:text-lg font-bold">{conversionRate.toFixed(1)}%</p>
                      {stats.avgScore !== null && (
                        <p className="text-[10px] sm:text-sm text-muted-foreground">
                          Avg: {stats.avgScore.toFixed(0)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Metrics - Collapsible on mobile */}
      {report.dailyMetrics.length > 0 && (
        <Card>
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Daily Metrics</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
              {report.dailyMetrics.map((metric, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b last:border-b-0 text-xs sm:text-sm"
                >
                  <span className="truncate">
                    {new Date(metric.date).toLocaleDateString()} - {metric.variant}
                  </span>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {metric.leads}L / {metric.conversions}C
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
