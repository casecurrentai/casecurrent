import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { CaseProgressBar, type Milestone } from "@/components/ui/case-progress-bar";
import {
  Phone,
  MessageSquare,
  Globe,
  ChevronRight,
  Inbox,
} from "lucide-react";

interface Contact {
  id: string;
  name: string;
  primaryPhone: string | null;
}

interface Lead {
  id: string;
  displayName: string | null;
  status: string;
  source: string;
  urgency: string | null;
  summary: string | null;
  score: number | null;
  createdAt: string;
  contact: Contact;
  intakeData: Record<string, unknown> | null;
}

interface LeadsResponse {
  leads: Lead[];
  total: number;
}

const SOURCE_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  phone: Phone,
  sms: MessageSquare,
  web: Globe,
};

const MILESTONE_KEYS = [
  { key: "intake", label: "Intake" },
  { key: "qualified", label: "Qualified" },
  { key: "consult", label: "Consult" },
  { key: "retainer", label: "Retainer" },
  { key: "signed", label: "Signed" },
];

function getBestName(lead: Lead): string {
  if (lead.displayName?.trim()) return lead.displayName;
  if (lead.contact?.name?.trim() && lead.contact.name !== "Unknown Caller") {
    return lead.contact.name;
  }
  const intake = lead.intakeData;
  if (intake) {
    const callerName = intake.callerName;
    if (typeof callerName === "string" && callerName.trim()) return callerName;
    const caller = intake.caller as Record<string, unknown> | undefined;
    if (caller && typeof caller.fullName === "string" && caller.fullName.trim()) {
      return caller.fullName;
    }
  }
  return "Unknown Caller";
}

function getTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function buildMilestones(lead: Lead): Milestone[] {
  const status = lead.status.toLowerCase();
  const progressOrder = ["new", "engaged", "contacted", "intake_started", "intake_complete", "qualified", "consult_scheduled", "consult_set", "retainer_sent", "retained", "converted", "signed"];
  const statusIdx = progressOrder.indexOf(status);

  return MILESTONE_KEYS.map((m, i) => ({
    key: m.key,
    label: m.label,
    completed: i === 0 || statusIdx >= i,
  }));
}

export function IntakeFeed() {
  const { token } = useAuth();

  const { data, isLoading } = useQuery<LeadsResponse>({
    queryKey: ["/v1/leads", { limit: 10, sort: "newest" }],
    queryFn: async () => {
      const res = await fetch("/v1/leads?limit=10&sort=newest", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 30_000,
  });

  return (
    <Card data-testid="intake-feed">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Inbox className="h-4 w-4" />
          Recent Intakes
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-1 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : !data?.leads.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent intakes</p>
            <p className="text-xs mt-1">New calls will appear here</p>
          </div>
        ) : (
          <div className="divide-y">
            {data.leads.map((lead) => {
              const SourceIcon = SOURCE_ICONS[lead.source] ?? Phone;
              const milestones = buildMilestones(lead);

              return (
                <Link key={lead.id} href={`/cases/${lead.id}`}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors">
                    {/* Source icon */}
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <SourceIcon className="h-4 w-4 text-muted-foreground" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {getBestName(lead)}
                        </span>
                        <StatusPill status={lead.status} className="shrink-0" />
                        {lead.urgency && (
                          <StatusPill status={lead.urgency} label={`${lead.urgency} urgency`} className="shrink-0" />
                        )}
                      </div>
                      {lead.summary && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {lead.summary}
                        </p>
                      )}
                      <CaseProgressBar milestones={milestones} className="max-w-[200px]" />
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {getTimeAgo(lead.createdAt)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
