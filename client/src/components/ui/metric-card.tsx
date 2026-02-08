import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Link } from "wouter";

export interface MetricCardProps {
  /** Display label (e.g. "New Cases") */
  label: string;
  /** Primary value (e.g. "42" or "$12.5k") */
  value: string | number;
  /** Trend percentage — positive shows green up arrow, negative shows red down arrow */
  trend?: number | null;
  /** Optional icon component */
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional link — wraps the card in a clickable link */
  href?: string;
  /** Loading skeleton state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Optional children rendered below the value (e.g. TrendSparkline) */
  children?: React.ReactNode;
}

function TrendIndicator({ trend }: { trend: number }) {
  if (trend === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        0%
      </span>
    );
  }

  const isPositive = trend > 0;
  const Icon = isPositive ? ArrowUp : ArrowDown;
  const colorClass = isPositive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", colorClass)}>
      <Icon className="h-3 w-3" />
      {Math.abs(trend).toFixed(1)}%
    </span>
  );
}

export function MetricCard({
  label,
  value,
  trend,
  icon: Icon,
  href,
  loading = false,
  className,
  children,
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className={cn("p-4", className)}>
        <CardContent className="p-0 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-12" />
        </CardContent>
      </Card>
    );
  }

  const content = (
    <Card className={cn("p-4", href && "hover-elevate cursor-pointer", className)}>
      <CardContent className="p-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground truncate">{label}</span>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight">{value}</span>
          {trend != null && <TrendIndicator trend={trend} />}
        </div>
        {children}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
