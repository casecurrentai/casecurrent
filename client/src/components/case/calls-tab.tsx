import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  ChevronDown,
  ChevronUp,
  Mic,
  FileText,
  BarChart3,
  PhoneCall,
} from "lucide-react";

interface TranscriptTurn {
  role: string;
  text: string;
  timeInCallSecs?: number | null;
}

interface CallData {
  id: string;
  direction: string;
  provider: string;
  callOutcome: string | null;
  endReason: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  recordingUrl: string | null;
  transcriptText: string | null;
  transcriptJson: TranscriptTurn[] | null;
  aiSummary: string | null;
  structuredData: Record<string, unknown> | null;
  successEvaluation: Record<string, unknown> | null;
  messagesJson: unknown[] | null;
  aiFlags: Record<string, unknown> | null;
  fromE164: string;
  toE164: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "N/A";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function outcomeLabel(outcome: string | null): string {
  if (!outcome) return "Unknown";
  const map: Record<string, string> = {
    connected: "Connected",
    "no-answer": "No Answer",
    busy: "Busy",
    voicemail: "Voicemail",
    failed: "Failed",
  };
  return map[outcome] || outcome;
}

function outcomeColor(outcome: string | null): string {
  if (outcome === "connected") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (outcome === "no-answer" || outcome === "busy") return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  if (outcome === "failed") return "bg-red-500/15 text-red-600 dark:text-red-400";
  return "bg-muted text-muted-foreground";
}

function RecordingPlayer({ url }: { url: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <Mic className="h-3 w-3" /> Recording
      </p>
      <audio controls className="w-full h-8" preload="none">
        <source src={url} />
        Your browser does not support audio playback.
      </audio>
    </div>
  );
}

function TranscriptBubbles({ turns }: { turns: TranscriptTurn[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <FileText className="h-3 w-3" /> Transcript
      </p>
      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
        {turns.map((turn, i) => {
          const isAssistant = turn.role === "assistant" || turn.role === "bot" || turn.role === "ai";
          return (
            <div
              key={i}
              className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[85%] px-3 py-1.5 rounded-xl text-sm ${
                  isAssistant
                    ? "bg-muted text-foreground rounded-bl-sm"
                    : "bg-primary text-primary-foreground rounded-br-sm"
                }`}
              >
                <p className="text-[10px] font-medium opacity-70 mb-0.5 capitalize">
                  {isAssistant ? "AI" : "Caller"}
                </p>
                <p className="whitespace-pre-wrap">{turn.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StructuredDataSection({ data, label }: { data: Record<string, unknown>; label: string }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <BarChart3 className="h-3 w-3" /> {label}
      </p>
      <div className="grid gap-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-2 text-sm">
            <span className="text-muted-foreground text-xs min-w-0 break-words">
              {key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").trim()}:
            </span>
            <span className="font-medium text-xs break-words min-w-0">
              {typeof value === "object" ? JSON.stringify(value) : String(value)} {/* guardrail-allow: json-dump */}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CallCard({ call }: { call: CallData }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!(call.recordingUrl || call.transcriptJson || call.aiSummary || call.structuredData);
  const DirIcon = call.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;

  return (
    <Card>
      <CardContent className="p-3">
        {/* Header row — always visible */}
        <button
          className="w-full flex items-center gap-3 text-left"
          onClick={() => hasDetails && setExpanded(!expanded)}
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <DirIcon className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm capitalize">{call.direction} Call</span>
              <Badge className={`text-[10px] ${outcomeColor(call.callOutcome)}`}>
                {outcomeLabel(call.callOutcome)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">{call.provider}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(call.startedAt).toLocaleString()}
              </span>
              {call.durationSeconds != null && (
                <span>{formatDuration(call.durationSeconds)}</span>
              )}
            </div>
          </div>
          {hasDetails && (
            <div className="flex-shrink-0 text-muted-foreground">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          )}
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-4">
            {/* AI Summary */}
            {call.aiSummary && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Executive Summary</p>
                <p className="text-sm leading-relaxed">{call.aiSummary}</p>
              </div>
            )}

            {/* Recording */}
            {call.recordingUrl && <RecordingPlayer url={call.recordingUrl} />}

            {/* Transcript */}
            {call.transcriptJson && Array.isArray(call.transcriptJson) && call.transcriptJson.length > 0 && (
              <TranscriptBubbles turns={call.transcriptJson} />
            )}

            {/* Structured Data */}
            {call.structuredData && typeof call.structuredData === "object" && (
              <StructuredDataSection data={call.structuredData} label="Structured Data" />
            )}

            {/* Success Evaluation */}
            {call.successEvaluation && typeof call.successEvaluation === "object" && (
              <StructuredDataSection data={call.successEvaluation} label="Success Evaluation" />
            )}

            {/* End reason */}
            {call.endReason && (
              <p className="text-xs text-muted-foreground">
                End reason: <span className="font-medium">{call.endReason}</span>
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CallsTab({ leadId }: { leadId: string }) {
  const { token } = useAuth();

  const { data, isLoading, error } = useQuery<{ calls: CallData[] }>({
    queryKey: ["/v1/leads", leadId, "calls"],
    queryFn: async () => {
      const res = await fetch(`/v1/leads/${leadId}/calls`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch calls");
      return res.json();
    },
    enabled: !!leadId && !!token,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Failed to load calls.
        </CardContent>
      </Card>
    );
  }

  const calls = data?.calls ?? [];

  if (calls.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <PhoneCall className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No calls recorded for this lead</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {calls.map((call) => (
        <CallCard key={call.id} call={call} />
      ))}
    </div>
  );
}
