/**
 * SMS thread component — iMessage-style bubbles.
 * Shows inbound (left, muted bg) and outbound (right, primary bg) messages.
 * Includes a composer with quick-reply chips.
 * If messaging is not configured for the firm, shows a clean disabled state.
 */

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Paperclip, AlertCircle } from "lucide-react";

interface SmsMessage {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  createdAt: string;
  channel: string;
  from?: string;
  to?: string;
}

interface ThreadResponse {
  messages: SmsMessage[];
  messagingEnabled: boolean;
}

const QUICK_REPLIES = [
  "We received your call and will be in touch shortly.",
  "Please complete your intake form: [intake link]",
  "Are you available for a consultation tomorrow?",
  "Our team will call you back within 2 hours.",
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return `Yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function MessageBubble({ msg }: { msg: SmsMessage }) {
  const isOutbound = msg.direction === "outbound";
  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"} mb-2`}>
      <div className={`max-w-[78%] ${isOutbound ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-snug ${
            isOutbound
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted text-foreground rounded-bl-sm"
          }`}
        >
          {msg.body}
        </div>
        <span className="text-[10px] text-muted-foreground px-1">{formatTime(msg.createdAt)}</span>
      </div>
    </div>
  );
}

export function SmsThread({ leadId }: { leadId: string }) {
  const { token } = useAuth();
  const [composer, setComposer] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<ThreadResponse>({
    queryKey: ["/v1/leads", leadId, "thread"],
    queryFn: async () => {
      const res = await fetch(`/v1/leads/${leadId}/thread`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load thread");
      const body = await res.json();
      // Normalize: thread endpoint returns threadItems; extract SMS messages
      const msgs: SmsMessage[] = (body.threadItems ?? body.items ?? [])
        .filter((item: any) => item.type === "sms.inbound" || item.type === "sms.outbound" || item.type === "message")
        .map((item: any) => ({
          id: item.id,
          direction: (item.type === "sms.inbound" || item.payload?.direction === "inbound")
            ? "inbound"
            : "outbound",
          body: item.summary ?? item.payload?.body ?? "",
          createdAt: item.timestamp,
          channel: "sms",
        }));
      return { messages: msgs, messagingEnabled: body.messagingEnabled !== false };
    },
    enabled: !!leadId && !!token,
    refetchInterval: 30000,
  });

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(`/v1/leads/${leadId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ body, channel: "sms" }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      setComposer("");
      queryClient.invalidateQueries({ queryKey: ["/v1/leads", leadId, "thread"] });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-10 w-1/2 ml-auto" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    );
  }

  if (error || !data?.messagingEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-sm">Messaging not enabled</p>
          <p className="text-xs text-muted-foreground mt-1">
            SMS is not configured for your firm. Contact support to enable text messaging.
          </p>
        </div>
      </div>
    );
  }

  const messages = data?.messages ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <MessageSquare className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground">Send a text to start the conversation</p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      {showQuickReplies && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {QUICK_REPLIES.map((reply) => (
            <button
              key={reply}
              onClick={() => {
                setComposer(reply);
                setShowQuickReplies(false);
              }}
              className="text-xs bg-muted hover:bg-muted/80 rounded-full px-3 py-1 text-left truncate max-w-[200px] transition-colors"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="border-t p-3 flex gap-2 items-end">
        <button
          onClick={() => setShowQuickReplies(!showQuickReplies)}
          className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          title="Quick replies"
        >
          <Paperclip className="w-4 h-4 text-muted-foreground" />
        </button>
        <Textarea
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 resize-none min-h-[36px] max-h-28 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && composer.trim()) {
              e.preventDefault();
              sendMutation.mutate(composer.trim());
            }
          }}
        />
        <Button
          size="sm"
          className="flex-shrink-0 h-9 w-9 p-0"
          disabled={!composer.trim() || sendMutation.isPending}
          onClick={() => composer.trim() && sendMutation.mutate(composer.trim())}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
