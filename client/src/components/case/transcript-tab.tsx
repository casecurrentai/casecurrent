import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Copy, Download, Check, MessageSquare } from "lucide-react";

interface TranscriptMessage {
  role: string;
  speaker?: string;
  text: string;
  timestamp: string | null;
}

interface TranscriptData {
  messages: TranscriptMessage[];
  callCount: number;
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "";
  const num = parseFloat(ts);
  if (!isNaN(num)) {
    const mins = Math.floor(num / 60);
    const secs = Math.floor(num % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return ts;
}

function highlightText(text: string, search: string): React.ReactNode {
  if (!search.trim()) return text;
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/50 rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function TranscriptTab({ leadId }: { leadId: string }) {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  const { data, isLoading, error } = useQuery<TranscriptData>({
    queryKey: ["/v1/leads", leadId, "transcript", debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      const url = `/v1/leads/${leadId}/transcript${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch transcript");
      return res.json();
    },
    enabled: !!leadId && !!token,
  });

  const handleCopy = useCallback(() => {
    if (!data?.messages.length) return;
    const text = data.messages
      .map((m) => {
        const ts = formatTimestamp(m.timestamp);
        return `${ts ? `[${ts}] ` : ""}${m.role}: ${m.text}`;
      })
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data]);

  const handleDownload = useCallback(() => {
    if (!data?.messages.length) return;
    const text = data.messages
      .map((m) => {
        const ts = formatTimestamp(m.timestamp);
        return `${ts ? `[${ts}] ` : ""}${m.role}: ${m.text}`;
      })
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${leadId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, leadId]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-6 text-center">
        <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground text-sm">No transcript available</p>
        <p className="text-xs text-muted-foreground mt-1">
          Transcripts appear after voice calls are completed
        </p>
      </div>
    );
  }

  const messages = data.messages;

  return (
    <div className="space-y-3">
      {/* Search + actions bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transcript..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-transcript-search"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={!messages.length}
          className="shrink-0"
          data-testid="button-copy-transcript"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={!messages.length}
          className="shrink-0"
          data-testid="button-download-transcript"
        >
          <Download className="h-3 w-3" />
        </Button>
      </div>

      {/* Transcript messages */}
      {messages.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground">
          <p className="text-sm">
            {search ? "No matching messages" : "No transcript messages"}
          </p>
        </div>
      ) : (
        <div className="space-y-1" data-testid="transcript-messages">
          {messages.map((msg, i) => {
            const roleLower = msg.role.toLowerCase();
            const isAgent = roleLower === "ai" || roleLower === "avery" || roleLower === "agent" || roleLower === "assistant" || roleLower === "bot";
            const displayName = msg.speaker || (isAgent ? "Avery" : "Caller");
            const displayText = msg.text || "(no text)";
            return (
              <div
                key={i}
                className={`flex gap-2 py-1.5 px-2 rounded text-sm ${
                  isAgent
                    ? "bg-primary/5"
                    : ""
                }`}
              >
                {msg.timestamp && (
                  <span className="text-xs text-muted-foreground font-mono shrink-0 mt-0.5 tabular-nums">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                )}
                <div className="min-w-0">
                  <span className={`text-xs font-medium ${isAgent ? "text-primary" : "text-foreground"}`}>
                    {displayName}
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {highlightText(displayText, search)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
