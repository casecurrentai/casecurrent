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
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Experiment not found</p>
      </div>
    );
  }

  const variants = Object.entries(report.variantStats);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/experiments">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-experiment-name">
              <FlaskConical className="h-6 w-6" />
              {report.name}
            </h1>
            <Badge className={STATUS_COLORS[report.status]}>
              {report.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {report.startedAt && `Started ${new Date(report.startedAt).toLocaleDateString()}`}
            {report.endedAt && ` - Ended ${new Date(report.endedAt).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-assignments">
              {report.totalAssignments}
            </div>
            <p className="text-xs text-muted-foreground">
              Leads assigned to this experiment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variants</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-variant-count">
              {variants.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Test groups being compared
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Conversion</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-overall-conversion">
              {report.totalAssignments > 0
                ? `${Math.round((variants.reduce((sum, [, s]) => sum + s.conversions, 0) / report.totalAssignments) * 100)}%`
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              Leads that converted to accepted
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Variant Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {variants.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No data yet. Assign leads to this experiment to see results.
            </p>
          ) : (
            <div className="space-y-4">
              {variants.map(([variant, stats]) => {
                const conversionRate = stats.leads > 0 ? (stats.conversions / stats.leads) * 100 : 0;
                return (
                  <div
                    key={variant}
                    className="flex items-center justify-between p-4 border rounded-md"
                    data-testid={`row-variant-${variant}`}
                  >
                    <div>
                      <p className="font-medium">{variant}</p>
                      <p className="text-sm text-muted-foreground">
                        {stats.leads} leads, {stats.conversions} conversions
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{conversionRate.toFixed(1)}%</p>
                      {stats.avgScore !== null && (
                        <p className="text-sm text-muted-foreground">
                          Avg score: {stats.avgScore.toFixed(0)}
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

      {report.dailyMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {report.dailyMetrics.map((metric, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b last:border-b-0"
                >
                  <span className="text-sm">
                    {new Date(metric.date).toLocaleDateString()} - {metric.variant}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {metric.leads} leads, {metric.conversions} conversions
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
