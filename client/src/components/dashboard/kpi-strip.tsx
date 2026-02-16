import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { MetricCard } from "@/components/ui/metric-card";
import { TrendSparkline } from "@/components/ui/trend-sparkline";
import {
  Phone,
  UserCheck,
  CalendarCheck,
  FileSignature,
  Clock,
  Users,
} from "lucide-react";

interface FunnelStage {
  name: string;
  count: number;
  conversion: number | null;
  trend: number;
}

interface SpeedMetrics {
  medianMinutes: number | null;
}

interface DashboardData {
  funnel: FunnelStage[];
  speed: SpeedMetrics;
}

interface DailyCount {
  date: string;
  newLeads: number;
  calls: number;
  qualified: number;
  signed: number;
}

interface TrendsData {
  dailyCounts: DailyCount[];
}

function findStage(funnel: FunnelStage[], ...names: string[]): FunnelStage | undefined {
  const lower = names.map((n) => n.toLowerCase());
  return funnel.find((s) => lower.includes(s.name.toLowerCase()));
}

function formatMedian(minutes: number | null): string {
  if (minutes == null) return "--";
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

export interface KPIStripProps {
  dashboardData?: DashboardData;
  isLoading?: boolean;
}

export function KPIStrip({ dashboardData, isLoading }: KPIStripProps) {
  const { token } = useAuth();

  const { data: trendsData } = useQuery<TrendsData>({
    queryKey: ["/v1/analytics/pi-dashboard/trends"],
    queryFn: async () => {
      const res = await fetch("/v1/analytics/pi-dashboard/trends", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { dailyCounts: [] };
      return res.json();
    },
    enabled: !!token,
  });

  const dailyCounts = trendsData?.dailyCounts ?? [];

  // Extract sparkline arrays from trend data
  const newLeadsSpark = dailyCounts.map((d) => d.newLeads);
  const qualifiedSpark = dailyCounts.map((d) => d.qualified);
  const signedSpark = dailyCounts.map((d) => d.signed);
  const callsSpark = dailyCounts.map((d) => d.calls);

  if (isLoading || !dashboardData) {
    return (
      <div
        className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory"
        data-testid="kpi-strip"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="min-w-[140px] flex-1 snap-start">
            <MetricCard label="" value="" loading />
          </div>
        ))}
      </div>
    );
  }

  const funnel = dashboardData.funnel;
  const newStage = findStage(funnel, "Inbound Calls", "New");
  const qualifiedStage = findStage(funnel, "Qualified PI", "Qualified");
  const consultStage = findStage(funnel, "Consult Scheduled", "consult_scheduled");
  const retainerStage = findStage(funnel, "Retainer Sent", "retainer_sent");
  const signedStage = findStage(funnel, "Retainer Signed", "Signed", "Converted");

  const metrics = [
    {
      label: "New Cases",
      value: newStage?.count ?? 0,
      trend: newStage?.trend ?? null,
      icon: Users,
      href: "/cases?filter=new",
      spark: newLeadsSpark,
    },
    {
      label: "Qualified",
      value: qualifiedStage?.count ?? 0,
      trend: qualifiedStage?.trend ?? null,
      icon: UserCheck,
      href: "/cases?filter=qualified",
      spark: qualifiedSpark,
    },
    {
      label: "Response Time",
      value: formatMedian(dashboardData.speed.medianMinutes),
      trend: null,
      icon: Clock,
      href: undefined,
      spark: [] as number[],
    },
    {
      label: "Consults",
      value: consultStage?.count ?? 0,
      trend: consultStage?.trend ?? null,
      icon: CalendarCheck,
      href: undefined,
      spark: [] as number[],
    },
    {
      label: "Retainers Sent",
      value: retainerStage?.count ?? 0,
      trend: retainerStage?.trend ?? null,
      icon: FileSignature,
      href: undefined,
      spark: [] as number[],
    },
    {
      label: "Signed",
      value: signedStage?.count ?? 0,
      trend: signedStage?.trend ?? null,
      icon: Phone,
      href: "/cases?filter=signed",
      spark: signedSpark,
    },
  ];

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory"
      data-testid="kpi-strip"
    >
      {metrics.map((m) => (
        <div key={m.label} className="min-w-[140px] flex-1 snap-start">
          <MetricCard
            label={m.label}
            value={m.value}
            trend={m.trend}
            icon={m.icon}
            href={m.href}
          >
            {m.spark.length >= 2 && (
              <TrendSparkline data={m.spark} height={24} />
            )}
          </MetricCard>
        </div>
      ))}
    </div>
  );
}
