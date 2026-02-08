import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Sparkles,
  Clock,
} from "lucide-react";

interface KeyMoment {
  timestamp: string;
  text: string;
  sentiment: string;
}

interface CompletenessItem {
  field: string;
  status: string;
}

interface CaseSummaryData {
  snapshot: string;
  keyMoments: KeyMoment[];
  sentiment: string;
  completeness: CompletenessItem[];
  confidence?: number;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-red-500/15 text-red-600 dark:text-red-400",
  mixed: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

const COMPLETENESS_ICONS: Record<string, typeof CheckCircle> = {
  captured: CheckCircle,
  missing: XCircle,
  partial: AlertTriangle,
};

export function SummaryTab({ leadId }: { leadId: string }) {
  const { token } = useAuth();

  const { data, isLoading, error } = useQuery<CaseSummaryData>({
    queryKey: ["/v1/leads", leadId, "summary"],
    queryFn: async () => {
      const res = await fetch(`/v1/leads/${leadId}/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    enabled: !!leadId && !!token,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-6 text-center">
        <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground text-sm">
          No AI summary available yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Summaries are generated after call transcripts are processed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI Snapshot */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <h3 className="text-sm font-medium">AI Summary</h3>
            {data.confidence != null && (
              <ConfidenceBadge value={data.confidence} className="ml-auto" />
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {data.snapshot}
          </p>
          <div className="mt-2">
            <Badge className={`text-xs ${SENTIMENT_COLORS[data.sentiment] ?? SENTIMENT_COLORS.neutral}`}>
              {data.sentiment}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Key Moments */}
      {data.keyMoments.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-3">Key Moments</h3>
            <div className="space-y-2">
              {data.keyMoments.map((moment, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-xs text-muted-foreground font-mono shrink-0 mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {moment.timestamp}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{moment.text}</p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] mt-1 ${
                        SENTIMENT_COLORS[moment.sentiment] ?? ""
                      }`}
                    >
                      {moment.sentiment}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completeness Checklist */}
      {data.completeness.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-3">Intake Completeness</h3>
            <div className="grid gap-1.5">
              {data.completeness.map((item) => {
                const Icon = COMPLETENESS_ICONS[item.status] ?? AlertTriangle;
                const color =
                  item.status === "captured"
                    ? "text-emerald-500"
                    : item.status === "missing"
                      ? "text-red-500"
                      : "text-amber-500";
                return (
                  <div key={item.field} className="flex items-center gap-2 text-sm">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
                    <span className="capitalize">
                      {item.field.replace(/_/g, " ")}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
