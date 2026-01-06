import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  title: string;
  description: string;
}

interface TimelineStepperProps {
  steps: Step[];
  className?: string;
}

export function TimelineStepper({ steps, className }: TimelineStepperProps) {
  return (
    <div className={cn("space-y-0", className)}>
      {steps.map((step, index) => (
        <div key={index} className="relative flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm z-10">
              {index + 1}
            </div>
            {index < steps.length - 1 && (
              <div className="w-0.5 h-full bg-border flex-1 min-h-[60px]" />
            )}
          </div>
          <div className="pb-8 pt-1">
            <h4 className="font-semibold text-lg text-foreground">{step.title}</h4>
            <p className="text-muted-foreground mt-1">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

interface HorizontalTimelineProps {
  steps: Step[];
  className?: string;
}

export function HorizontalTimeline({ steps, className }: HorizontalTimelineProps) {
  return (
    <div className={cn("flex flex-col md:flex-row gap-6 md:gap-4", className)}>
      {steps.map((step, index) => (
        <div key={index} className="flex-1 relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm shrink-0">
              {index + 1}
            </div>
            {index < steps.length - 1 && (
              <div className="hidden md:block flex-1 h-0.5 bg-border" />
            )}
          </div>
          <h4 className="font-semibold text-foreground">{step.title}</h4>
          <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
        </div>
      ))}
    </div>
  );
}
