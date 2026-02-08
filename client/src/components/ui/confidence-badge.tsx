import { cn } from "@/lib/utils";

export interface ConfidenceBadgeProps {
  /** Numeric confidence/score value (0-100) */
  value: number;
  /** Optional label override (defaults to "{value}%") */
  label?: string;
  /** Additional class names */
  className?: string;
}

function getScoreColor(value: number): string {
  if (value >= 70) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (value >= 40) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-red-500/15 text-red-700 dark:text-red-400";
}

export function ConfidenceBadge({ value, label, className }: ConfidenceBadgeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const colorClass = getScoreColor(clamped);
  const displayLabel = label ?? `${clamped}%`;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
        colorClass,
        className,
      )}
    >
      {displayLabel}
    </span>
  );
}
