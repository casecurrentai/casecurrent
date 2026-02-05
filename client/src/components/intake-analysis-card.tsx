import { AlertTriangle, FileText, List, MapPin, Phone, User, Calendar, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getIntakeDisplayData, IntakeDisplayData } from "@/lib/intake-display";
import { useState } from "react";

interface IntakeAnalysisCardProps {
  /** Raw intake answers data - can be object, JSON string, or null */
  answers: unknown;
  /** Optional className for the container */
  className?: string;
  /** Test ID for the component */
  "data-testid"?: string;
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const urgencyLower = urgency.toLowerCase();
  const variant = urgencyLower === "high"
    ? "destructive"
    : urgencyLower === "medium"
      ? "secondary"
      : "outline";

  const colorClass = urgencyLower === "high"
    ? "bg-red-500 text-white"
    : urgencyLower === "medium"
      ? "bg-yellow-500 text-black"
      : "";

  return (
    <Badge
      variant={variant}
      className={cn("capitalize", colorClass)}
      data-testid="badge-intake-urgency"
    >
      {urgencyLower === "high" && <AlertTriangle className="h-3 w-3 mr-1" />}
      {urgency}
    </Badge>
  );
}

function IntakeField({
  icon: Icon,
  label,
  value,
  testId,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | undefined;
  testId?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2" data-testid={testId}>
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

function DebugPayload({ data }: { data: unknown }) {
  const [isOpen, setIsOpen] = useState(false);

  // Only show in development
  const isDev = typeof window !== "undefined" &&
    (process.env.NODE_ENV !== "production" ||
      process.env.NEXT_PUBLIC_SHOW_DEBUG_PAYLOAD === "1");

  if (!isDev) return null;

  return (
    <div className="mt-4 border-t pt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            isOpen && "rotate-180"
          )}
        />
        Debug (dev only)
      </button>
      {isOpen && (
        <pre className="mt-2 p-2 bg-muted rounded text-[10px] font-mono overflow-x-auto max-h-60 overflow-y-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function IntakeAnalysisCard({
  answers,
  className,
  "data-testid": testId = "intake-analysis-card",
}: IntakeAnalysisCardProps) {
  const displayData = getIntakeDisplayData(answers);

  // If no meaningful data, show a placeholder
  if (!displayData) {
    return (
      <div
        className={cn("text-sm text-muted-foreground", className)}
        data-testid={testId}
      >
        No intake data available.
      </div>
    );
  }

  const practiceArea =
    displayData.practiceArea || displayData.practiceAreaGuess || "Unknown";

  return (
    <div className={cn("space-y-4", className)} data-testid={testId}>
      {/* Header with urgency badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Intake Analysis
        </h4>
        {displayData.urgency && (
          <UrgencyBadge urgency={displayData.urgency} />
        )}
      </div>

      {/* Summary */}
      <div data-testid="intake-summary">
        <span className="text-xs text-muted-foreground">Summary</span>
        <p className="text-sm mt-1">
          {displayData.summary || "No summary provided."}
        </p>
      </div>

      {/* Practice Area */}
      <div className="flex items-center gap-2" data-testid="intake-practice-area">
        <Badge variant="outline">{practiceArea}</Badge>
        {displayData.practiceAreaGuess && !displayData.practiceArea && (
          <span className="text-xs text-muted-foreground">(detected)</span>
        )}
      </div>

      {/* Injury Description */}
      {displayData.injuryDescription && (
        <div data-testid="intake-injury">
          <span className="text-xs text-muted-foreground">Injury Description</span>
          <p className="text-sm mt-1">{displayData.injuryDescription}</p>
        </div>
      )}

      {/* Key Facts */}
      {displayData.keyFacts && displayData.keyFacts.length > 0 && (
        <div data-testid="intake-key-facts">
          <div className="flex items-center gap-2 mb-2">
            <List className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Key Facts</span>
          </div>
          <ul className="space-y-1 pl-6">
            {displayData.keyFacts.map((fact, index) => (
              <li key={index} className="text-sm list-disc">
                {fact}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Additional details: incident date, location */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <IntakeField
          icon={Calendar}
          label="Incident Date"
          value={displayData.incidentDate}
          testId="intake-incident-date"
        />
        <IntakeField
          icon={MapPin}
          label="Location"
          value={displayData.location}
          testId="intake-location"
        />
      </div>

      {/* Caller Info */}
      {(displayData.callerName || displayData.callerPhone || displayData.callerEmail) && (
        <div className="border-t pt-3">
          <span className="text-xs text-muted-foreground mb-2 block">Caller Information</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <IntakeField
              icon={User}
              label="Name"
              value={displayData.callerName}
              testId="intake-caller-name"
            />
            <IntakeField
              icon={Phone}
              label="Phone"
              value={displayData.callerPhone}
              testId="intake-caller-phone"
            />
          </div>
          {displayData.callerEmail && (
            <div className="mt-2 text-sm text-muted-foreground">
              Email: {displayData.callerEmail}
            </div>
          )}
        </div>
      )}

      {/* Debug payload - only in dev */}
      <DebugPayload data={answers} />
    </div>
  );
}
