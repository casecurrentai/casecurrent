/**
 * Calls Inbox — law-firm grade call management dashboard.
 *
 * Left panel:  Filterable call list (name, summary, badges, timestamp)
 * Right panel: Call detail with recording player, transcript, AI summary, SMS thread
 *
 * Design: Two-panel layout on desktop; single column (list → detail) on mobile.
 * All data is scoped to the authenticated firm via backend tenant-scoping.
 */

import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmsThread } from "@/components/calls/sms-thread";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Search,
  Mic,
  FileText,
  BarChart3,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  ExternalLink,
  ArrowLeft,
  PlayCircle,
  Pause,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Filter = "all" | "missed" | "new_leads" | "high_value" | "needs_followup";

interface CallInboxItem {
  id: string;
  leadId: string;
  direction: string;
  vapiCallId: string | null;
  status: string;
  callOutcome: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  callerName: string;
  callerPhone: string | null;
  summary: string | null;
  badges: string[];
  hasTranscript: boolean;
  hasRecording: boolean;
  resolved: boolean;
  leadStatus: string | null;
  leadScore: number | null;
}

interface CallArtifacts {
  transcript: Array<{ role: string; transcript: string; start?: number }>;
  recordingUrl: string | null;
  durationSec: number | null;
  summary: string | null;
  structuredData: Record<string, unknown> | null;
  endedReason: string | null;
  messages: Array<{ role: string; content: string; time?: number }>;
  analysis: Record<string, unknown> | null;
  source?: string;
  error?: string;
  message?: string;
}

interface CallDetail {
  id: string;
  leadId: string;
  direction: string;
  callOutcome: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  fromE164: string;
  toE164: string;
  callerName: string;
  callerPhone: string | null;
  vapiCallId: string | null;
  hasTranscript: boolean;
  hasRecording: boolean;
  aiSummary: string | null;
  transcriptJson: Array<{ role: string; text: string; timeInCallSecs?: number }> | null;
  recordingUrl: string | null;
  structuredData: Record<string, unknown> | null;
  resolved: boolean;
  lead: {
    id: string;
    status: string;
    displayName: string | null;
    score: number | null;
    consultScheduledAt: string | null;
    retainerSignedAt: string | null;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(sec: number | null): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const LEAD_STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-600",
  intake_started: "bg-purple-500/15 text-purple-600",
  contacted: "bg-yellow-500/15 text-yellow-600",
  engaged: "bg-orange-500/15 text-orange-600",
  consult_scheduled: "bg-cyan-500/15 text-cyan-600",
  retainer_signed: "bg-emerald-500/15 text-emerald-600",
  closed: "bg-muted text-muted-foreground",
};

const BADGE_COLORS: Record<string, string> = {
  missed: "bg-red-500/15 text-red-600",
  "after-hours": "bg-orange-500/15 text-orange-600",
  voicemail: "bg-purple-500/15 text-purple-600",
  "high-value": "bg-emerald-500/15 text-emerald-600",
};

const BADGE_LABELS: Record<string, string> = {
  missed: "Missed",
  "after-hours": "After Hours",
  voicemail: "Voicemail",
  "high-value": "High Value",
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new_leads", label: "New Leads" },
  { id: "missed", label: "Missed" },
  { id: "high_value", label: "High Value" },
  { id: "needs_followup", label: "Follow-up" },
];

// ─── Call list item ───────────────────────────────────────────────────────────

function CallListItem({
  call,
  selected,
  onClick,
}: {
  call: CallInboxItem;
  selected: boolean;
  onClick: () => void;
}) {
  const DirIcon =
    !call.durationSeconds || call.durationSeconds === 0
      ? PhoneMissed
      : call.direction === "inbound"
      ? PhoneIncoming
      : PhoneOutgoing;

  const iconColor =
    !call.durationSeconds || call.durationSeconds === 0
      ? "text-red-500"
      : "text-primary";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b transition-colors hover:bg-muted/50 ${
        selected ? "bg-primary/5 border-l-2 border-l-primary" : "border-l-2 border-l-transparent"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-muted flex items-center justify-center mt-0.5">
          <DirIcon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm truncate">{call.callerName}</span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {formatRelativeTime(call.startedAt)}
            </span>
          </div>
          {call.summary && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{call.summary}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {call.durationSeconds ? (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />
                {formatDuration(call.durationSeconds)}
              </span>
            ) : null}
            {call.badges.map((b) => (
              <span
                key={b}
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${BADGE_COLORS[b] ?? "bg-muted text-muted-foreground"}`}
              >
                {BADGE_LABELS[b] ?? b}
              </span>
            ))}
            {call.leadStatus && LEAD_STATUS_COLORS[call.leadStatus] && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${LEAD_STATUS_COLORS[call.leadStatus]}`}
              >
                {call.leadStatus.replace(/_/g, " ")}
              </span>
            )}
            {call.hasRecording && (
              <Mic className="w-3 h-3 text-muted-foreground" title="Recording available" />
            )}
            {call.hasTranscript && (
              <FileText className="w-3 h-3 text-muted-foreground" title="Transcript available" />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Recording Player ─────────────────────────────────────────────────────────

function RecordingPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play();
      setPlaying(true);
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5];
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (el) setProgress(el.currentTime / (el.duration || 1));
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const t = parseFloat(e.target.value) * (el.duration || 0);
    el.currentTime = t;
    setProgress(parseFloat(e.target.value));
  };

  const formatSec = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-muted/50 rounded-xl p-4 flex items-center gap-3">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onEnded={() => setPlaying(false)}
      />
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
      >
        {playing ? <Pause className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
      </button>
      <div className="flex-1 space-y-1">
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onChange={handleScrub}
          className="w-full accent-primary h-1.5"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{formatSec((audioRef.current?.currentTime) ?? 0)}</span>
          <span>{formatSec(duration)}</span>
        </div>
      </div>
      <button
        onClick={cycleSpeed}
        className="flex-shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
      >
        {speed}×
      </button>
    </div>
  );
}

// ─── Transcript panel ─────────────────────────────────────────────────────────

function TranscriptPanel({
  turns,
}: {
  turns: Array<{ role: string; transcript: string; start?: number }>;
}) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? turns.filter((t) => t.transcript.toLowerCase().includes(search.toLowerCase()))
    : turns;

  const highlight = (text: string) => {
    if (!search) return text;
    const parts = text.split(new RegExp(`(${search})`, "gi"));
    return parts.map((p, i) =>
      p.toLowerCase() === search.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">
          {p}
        </mark>
      ) : (
        p
      )
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search transcript…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {filtered.map((turn, i) => {
          const isAssistant =
            turn.role === "assistant" || turn.role === "bot" || turn.role === "ai";
          return (
            <div key={i} className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  isAssistant
                    ? "bg-muted text-foreground rounded-bl-sm"
                    : "bg-primary/10 text-foreground rounded-br-sm"
                }`}
              >
                <p className="text-[10px] font-semibold opacity-60 mb-0.5 capitalize">
                  {isAssistant ? "AI" : "Caller"}
                  {turn.start !== undefined && (
                    <span className="ml-1 font-normal">{Math.floor(turn.start)}s</span>
                  )}
                </p>
                <p className="whitespace-pre-wrap">{highlight(turn.transcript)}</p>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No matches found</p>
        )}
      </div>
    </div>
  );
}

// ─── AI Summary panel ─────────────────────────────────────────────────────────

function AiSummaryPanel({
  summary,
  structuredData,
}: {
  summary: string | null;
  structuredData: Record<string, unknown> | null;
}) {
  if (!summary && !structuredData) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No AI summary available for this call.
      </p>
    );
  }

  const entries = structuredData
    ? Object.entries(structuredData).filter(([, v]) => v !== null && v !== undefined && v !== "")
    : [];

  // Try to bucket structured data into law-firm categories
  const categories: Record<string, string[]> = {
    Injuries: ["injury", "injuries", "injuryDescription", "medicalTreatment"],
    "Liability / Fault": ["atFault", "atFaultParty", "liability", "accidentType"],
    Insurance: ["insurance", "insuranceInfo", "policyNumber", "claimNumber"],
    "Incident Details": ["incidentDate", "incidentLocation", "incidentType", "dateOfAccident"],
    "Next Steps": ["nextSteps", "nextStep", "followUp"],
  };

  const bucketed: Record<string, Array<[string, unknown]>> = {};
  const uncategorized: Array<[string, unknown]> = [];

  for (const [key, value] of entries) {
    let found = false;
    for (const [cat, keys] of Object.entries(categories)) {
      if (keys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
        if (!bucketed[cat]) bucketed[cat] = [];
        bucketed[cat].push([key, value]);
        found = true;
        break;
      }
    }
    if (!found) uncategorized.push([key, value]);
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            What happened
          </p>
          <p className="text-sm leading-relaxed">{summary}</p>
        </div>
      )}

      {Object.entries(bucketed).map(([cat, pairs]) => (
        <div key={cat}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            {cat}
          </p>
          <div className="space-y-1">
            {pairs.map(([key, value]) => (
              <div key={key} className="flex gap-2 text-sm">
                <span className="text-muted-foreground text-xs min-w-[120px] flex-shrink-0 pt-0.5">
                  {key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").trim()}
                </span>
                <span className="font-medium text-xs break-words">
                  {typeof value === "object"
                    ? Object.entries(value as object)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {uncategorized.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Additional Details
          </p>
          <div className="space-y-1">
            {uncategorized.map(([key, value]) => (
              <div key={key} className="flex gap-2 text-sm">
                <span className="text-muted-foreground text-xs min-w-[120px] flex-shrink-0 pt-0.5">
                  {key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").trim()}
                </span>
                <span className="font-medium text-xs break-words">
                  {typeof value === "object" ? JSON.stringify(value) /* guardrail-allow: json-dump */ : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Call Detail Panel ────────────────────────────────────────────────────────

function CallDetailPanel({ callId, leadId, onBack }: { callId: string; leadId: string; onBack?: () => void }) {
  const { token } = useAuth();

  // Load call detail from DB
  const { data: call, isLoading: callLoading, error: callError } = useQuery<CallDetail>({
    queryKey: ["/v1/calls", callId],
    queryFn: async () => {
      const res = await fetch(`/v1/calls/${callId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load call");
      return res.json();
    },
    enabled: !!callId && !!token,
  });

  // Load Vapi artifacts on demand
  const {
    data: artifacts,
    isLoading: artifactsLoading,
    error: artifactsError,
    refetch: refetchArtifacts,
  } = useQuery<CallArtifacts>({
    queryKey: ["/v1/calls", callId, "artifacts"],
    queryFn: async () => {
      const res = await fetch(`/v1/calls/${callId}/artifacts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 409) return { error: "no_vapi_call_id", message: (await res.json()).message } as any;
      if (!res.ok) throw new Error("Failed to load artifacts");
      return res.json();
    },
    enabled: !!callId && !!token,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (callLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (callError || !call) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="font-medium">Failed to load call</p>
        <Button variant="outline" size="sm" onClick={onBack}>
          Go back
        </Button>
      </div>
    );
  }

  // Resolve transcript: prefer fresh Vapi artifacts, fall back to DB transcript
  const transcript: Array<{ role: string; transcript: string; start?: number }> =
    (artifacts?.transcript && artifacts.transcript.length > 0)
      ? artifacts.transcript
      : (call.transcriptJson ?? []).map((t) => ({
          role: t.role,
          transcript: t.text,
          start: t.timeInCallSecs ?? undefined,
        }));

  const recordingUrl = artifacts?.recordingUrl ?? call.recordingUrl ?? null;
  const summary = artifacts?.summary ?? call.aiSummary ?? null;
  const structuredData = artifacts?.structuredData ?? call.structuredData ?? null;

  const leadStatus = call.lead?.status ?? null;
  const statusColor = leadStatus ? (LEAD_STATUS_COLORS[leadStatus] ?? "bg-muted text-muted-foreground") : "";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground mb-2 hover:text-foreground">
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-base truncate">{call.callerName}</h2>
            {call.callerPhone && (
              <p className="text-xs text-muted-foreground">{call.callerPhone}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {leadStatus && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                {leadStatus.replace(/_/g, " ")}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {new Date(call.startedAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <Link href={`/cases/${call.leadId}`}>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <ExternalLink className="w-3 h-3" /> View Case
            </Button>
          </Link>
          {call.resolved ? (
            <Badge variant="outline" className="h-7 text-xs gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-200">
              <CheckCircle className="w-3 h-3" /> Resolved
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Content tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="overview" className="h-full flex flex-col">
          <TabsList className="w-full rounded-none border-b h-9 bg-transparent justify-start gap-0 px-4">
            {[
              { id: "overview", label: "Overview", icon: BarChart3 },
              { id: "transcript", label: "Transcript", icon: FileText },
              { id: "sms", label: "SMS", icon: MessageSquare },
            ].map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-9 text-xs gap-1.5"
              >
                <Icon className="w-3 h-3" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Overview tab */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto p-4 space-y-5 mt-0">
            {/* Recording */}
            {artifactsLoading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : recordingUrl ? (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Mic className="w-3 h-3" /> Recording
                </p>
                <RecordingPlayer url={recordingUrl} />
              </div>
            ) : null}

            {/* AI Summary */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <BarChart3 className="w-3 h-3" /> AI Analysis
              </p>
              {artifactsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              ) : artifacts?.error === "no_vapi_call_id" ? (
                <p className="text-sm text-muted-foreground italic">{artifacts.message}</p>
              ) : artifactsError ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Failed to load AI analysis.</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => refetchArtifacts()}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Retry
                  </Button>
                </div>
              ) : (
                <AiSummaryPanel summary={summary} structuredData={structuredData} />
              )}
            </div>

            {/* Call metadata */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Call Details
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div className="text-muted-foreground">Duration</div>
                <div className="font-medium">{formatDuration(call.durationSeconds) || "N/A"}</div>
                <div className="text-muted-foreground">Direction</div>
                <div className="font-medium capitalize">{call.direction}</div>
                <div className="text-muted-foreground">Outcome</div>
                <div className="font-medium capitalize">{call.callOutcome ?? "N/A"}</div>
                {artifacts?.endedReason && (
                  <>
                    <div className="text-muted-foreground">End reason</div>
                    <div className="font-medium">{artifacts.endedReason}</div>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Transcript tab */}
          <TabsContent value="transcript" className="flex-1 overflow-y-auto p-4 mt-0">
            {artifactsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                    <Skeleton className={`h-12 ${i % 2 === 0 ? "w-2/3" : "w-1/2"} rounded-xl`} />
                  </div>
                ))}
              </div>
            ) : transcript.length > 0 ? (
              <TranscriptPanel turns={transcript} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <FileText className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {artifacts?.error === "no_vapi_call_id"
                    ? "No Vapi ID — transcript unavailable"
                    : "No transcript available for this call"}
                </p>
              </div>
            )}
          </TabsContent>

          {/* SMS thread tab */}
          <TabsContent value="sms" className="flex-1 overflow-hidden mt-0 flex flex-col">
            <SmsThread leadId={call.leadId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Main Calls Inbox Page ────────────────────────────────────────────────────

export default function CallsInboxPage() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [search, setSearch] = useState("");

  const { data, isLoading, error, refetch } = useQuery<{
    calls: CallInboxItem[];
    count: number;
  }>({
    queryKey: ["/v1/calls", filter],
    queryFn: async () => {
      const res = await fetch(`/v1/calls?filter=${filter}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load calls");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 60000,
  });

  const selectCall = useCallback((id: string, leadId: string) => {
    setSelectedCallId(id);
    setSelectedLeadId(leadId);
    setMobileView("detail");
  }, []);

  const calls = data?.calls ?? [];
  const filtered = search
    ? calls.filter(
        (c) =>
          c.callerName.toLowerCase().includes(search.toLowerCase()) ||
          (c.callerPhone ?? "").includes(search) ||
          (c.summary ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : calls;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex-shrink-0 border-b px-5 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-base flex items-center gap-2">
            <Phone className="w-4 h-4" /> Calls
          </h1>
          <p className="text-xs text-muted-foreground">{data?.count ?? 0} calls</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 w-8 p-0">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel — call list */}
        <div
          className={`flex flex-col border-r ${
            mobileView === "detail" ? "hidden lg:flex" : "flex"
          } w-full lg:w-[340px] xl:w-[380px] flex-shrink-0`}
        >
          {/* Filters */}
          <div className="flex-shrink-0 px-3 py-2 border-b overflow-x-auto">
            <div className="flex gap-1">
              {FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`text-xs px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                    filter === id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="flex-shrink-0 px-3 py-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search calls…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 h-7 text-xs"
              />
            </div>
          </div>

          {/* Call list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 p-6 text-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-muted-foreground">Failed to load calls</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 p-6 text-center">
                <Phone className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No calls found</p>
                {filter !== "all" && (
                  <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>
                    Show all
                  </Button>
                )}
              </div>
            ) : (
              filtered.map((call) => (
                <CallListItem
                  key={call.id}
                  call={call}
                  selected={call.id === selectedCallId}
                  onClick={() => selectCall(call.id, call.leadId)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right panel — call detail */}
        <div
          className={`flex-1 min-w-0 ${
            mobileView === "list" ? "hidden lg:flex" : "flex"
          } flex-col`}
        >
          {selectedCallId && selectedLeadId ? (
            <CallDetailPanel
              key={selectedCallId}
              callId={selectedCallId}
              leadId={selectedLeadId}
              onBack={() => setMobileView("list")}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Phone className="w-7 h-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Select a call</p>
                <p className="text-sm text-muted-foreground">
                  Choose a call from the list to see the transcript, recording, and AI analysis.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
