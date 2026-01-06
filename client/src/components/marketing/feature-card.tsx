import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({ icon: Icon, title, description, className }: FeatureCardProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardContent className="p-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

interface MetricCardProps {
  value: string;
  label: string;
  trend?: string;
  className?: string;
}

export function MetricCard({ value, label, trend, className }: MetricCardProps) {
  return (
    <div className={cn("bg-card border border-border rounded-lg p-4", className)}>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
      {trend && (
        <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{trend}</div>
      )}
    </div>
  );
}

interface StatPillProps {
  value: string;
  label: string;
  className?: string;
}

export function StatPill({ value, label, className }: StatPillProps) {
  return (
    <div className={cn("inline-flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2", className)}>
      <span className="font-semibold text-foreground">{value}</span>
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  );
}
