import { cn } from "@/lib/utils";

const DEFAULT_COLORS: Record<string, string> = {
  new: "bg-primary/15 text-primary",
  contacted: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  qualified: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  unqualified: "bg-muted text-muted-foreground",
  converted: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  signed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  closed: "bg-muted text-muted-foreground",
  rejected: "bg-red-500/15 text-red-600 dark:text-red-400",
  high: "bg-red-500/15 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  low: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

const DOT_COLORS: Record<string, string> = {
  new: "bg-primary",
  contacted: "bg-blue-500",
  qualified: "bg-emerald-500",
  unqualified: "bg-muted-foreground",
  converted: "bg-emerald-500",
  signed: "bg-emerald-500",
  closed: "bg-muted-foreground",
  rejected: "bg-red-500",
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

export interface StatusPillProps {
  /** Status value — maps to color presets, or uses neutral fallback */
  status: string;
  /** Optional display label override (defaults to capitalized status) */
  label?: string;
  /** Custom color map override */
  colorMap?: Record<string, string>;
  /** Additional class names */
  className?: string;
}

export function StatusPill({ status, label, colorMap, className }: StatusPillProps) {
  const key = status.toLowerCase();
  const colors = colorMap ?? DEFAULT_COLORS;
  const pillColor = colors[key] ?? "bg-muted text-muted-foreground";
  const dotColor = DOT_COLORS[key] ?? "bg-muted-foreground";
  const displayLabel = label ?? status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        pillColor,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor)} />
      {displayLabel}
    </span>
  );
}
