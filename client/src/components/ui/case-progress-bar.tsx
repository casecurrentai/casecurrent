import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check } from "lucide-react";

export interface Milestone {
  key: string;
  label: string;
  completed: boolean;
  date?: string | null;
}

export interface CaseProgressBarProps {
  milestones: Milestone[];
  className?: string;
}

export function CaseProgressBar({ milestones, className }: CaseProgressBarProps) {
  if (!milestones.length) return null;

  const completedCount = milestones.filter((m) => m.completed).length;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex items-center gap-1", className)}>
        {milestones.map((milestone, i) => (
          <Tooltip key={milestone.key}>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 flex-1 min-w-0">
                {/* Segment bar */}
                <div
                  className={cn(
                    "h-2 flex-1 rounded-full transition-colors",
                    milestone.completed
                      ? "bg-primary"
                      : "bg-muted",
                  )}
                />
                {/* Connector dot between segments */}
                {i < milestones.length - 1 && (
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      milestone.completed
                        ? "bg-primary"
                        : "bg-muted-foreground/30",
                    )}
                  />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="flex items-center gap-1.5">
                {milestone.completed && (
                  <Check className="h-3 w-3 text-primary" />
                )}
                <span className="font-medium">{milestone.label}</span>
              </div>
              {milestone.date && (
                <p className="text-muted-foreground mt-0.5">
                  {new Date(milestone.date).toLocaleDateString()}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
        <span className="text-xs text-muted-foreground tabular-nums ml-1 shrink-0">
          {completedCount}/{milestones.length}
        </span>
      </div>
    </TooltipProvider>
  );
}
