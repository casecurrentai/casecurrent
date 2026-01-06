import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  MapPin,
  MessageSquare,
  PhoneCall,
  ClipboardList,
  CheckCircle,
  Bell,
  FileText,
  User,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
} from "lucide-react";

interface Contact {
  id: string;
  name: string;
  primaryPhone: string | null;
  primaryEmail: string | null;
  createdAt: string;
}

interface Lead {
  id: string;
  contactId: string;
  source: string;
  status: string;
  priority: string;
  practiceAreaId: string | null;
  incidentDate: string | null;
  incidentLocation: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  contact: Contact;
  practiceArea: { id: string; name: string } | null;
}

interface Call {
  id: string;
  direction: string;
  provider: string;
  fromE164: string;
  toE164: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  recordingUrl: string | null;
}

interface Message {
  id: string;
  direction: string;
  channel: string;
  from: string;
  to: string;
  body: string;
  createdAt: string;
}

interface Interaction {
  id: string;
  channel: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  metadata: any;
  call: Call | null;
  messages: Message[];
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-primary text-primary-foreground",
  contacted: "bg-blue-500 text-white dark:bg-blue-600",
  qualified: "bg-green-500 text-white dark:bg-green-600",
  unqualified: "bg-muted text-muted-foreground",
  converted: "bg-emerald-500 text-white dark:bg-emerald-600",
  closed: "bg-muted text-muted-foreground",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500 text-white dark:bg-orange-600",
  medium: "bg-yellow-500 text-white dark:bg-yellow-600",
  low: "bg-muted text-muted-foreground",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "N/A";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function PlaceholderPanel({ icon: Icon, title }: { icon: typeof Phone; title: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <Icon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">Coming soon</p>
      </CardContent>
    </Card>
  );
}

function InteractionTimeline({ interactions }: { interactions: Interaction[] }) {
  if (interactions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No interactions yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {interactions.map((interaction) => (
        <Card key={interaction.id} data-testid={`interaction-${interaction.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {interaction.channel === "call" && (
                  interaction.call?.direction === "inbound" 
                    ? <PhoneIncoming className="w-5 h-5 text-primary" />
                    : <PhoneOutgoing className="w-5 h-5 text-primary" />
                )}
                {interaction.channel === "sms" && <MessageSquare className="w-5 h-5 text-primary" />}
                {interaction.channel === "webchat" && <MessageSquare className="w-5 h-5 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium capitalize">{interaction.channel}</span>
                  <Badge variant={interaction.status === "active" ? "default" : "secondary"} className="text-xs">
                    {interaction.status}
                  </Badge>
                  {interaction.call && (
                    <Badge variant="outline" className="text-xs">
                      {interaction.call.direction}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(interaction.startedAt).toLocaleString()}
                  </span>
                  {interaction.call?.durationSeconds && (
                    <span>{formatDuration(interaction.call.durationSeconds)}</span>
                  )}
                </div>
                
                {interaction.call && (
                  <div className="mt-2 text-sm">
                    <span className="text-muted-foreground">From: </span>
                    <span>{interaction.call.fromE164}</span>
                    <span className="text-muted-foreground mx-2">To: </span>
                    <span>{interaction.call.toE164}</span>
                  </div>
                )}
                
                {interaction.messages.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {interaction.messages.slice(0, 3).map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`p-2 rounded-lg text-sm ${
                          msg.direction === "inbound" 
                            ? "bg-muted" 
                            : "bg-primary/10 ml-4"
                        }`}
                      >
                        <p className="text-xs text-muted-foreground mb-1">
                          {msg.direction === "inbound" ? msg.from : "You"} - {new Date(msg.createdAt).toLocaleTimeString()}
                        </p>
                        <p>{msg.body}</p>
                      </div>
                    ))}
                    {interaction.messages.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{interaction.messages.length - 3} more messages
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CallsPanel({ interactions }: { interactions: Interaction[] }) {
  const calls = interactions.filter(i => i.channel === "call" && i.call);
  
  if (calls.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <PhoneCall className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No calls yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {calls.map((interaction) => (
        <Card key={interaction.id}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                {interaction.call?.direction === "inbound" 
                  ? <PhoneIncoming className="w-5 h-5 text-primary" />
                  : <PhoneOutgoing className="w-5 h-5 text-primary" />
                }
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium capitalize">{interaction.call?.direction} Call</span>
                  <Badge variant={interaction.status === "active" ? "default" : "secondary"} className="text-xs">
                    {interaction.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {new Date(interaction.startedAt).toLocaleString()}
                  {interaction.call?.durationSeconds && ` - ${formatDuration(interaction.call.durationSeconds)}`}
                </p>
              </div>
              {interaction.call?.recordingUrl && (
                <Badge variant="outline">Recording available</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MessagesPanel({ interactions }: { interactions: Interaction[] }) {
  const messageInteractions = interactions.filter(i => i.channel === "sms" || i.channel === "webchat");
  const allMessages = messageInteractions.flatMap(i => i.messages).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  if (allMessages.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No messages yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {allMessages.map((msg) => (
        <div 
          key={msg.id} 
          className={`p-3 rounded-lg ${
            msg.direction === "inbound" 
              ? "bg-muted" 
              : "bg-primary/10 ml-8"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium">
              {msg.direction === "inbound" ? msg.from : "Outbound"}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(msg.createdAt).toLocaleString()}
            </span>
            <Badge variant="outline" className="text-xs">{msg.channel}</Badge>
          </div>
          <p className="text-sm">{msg.body}</p>
        </div>
      ))}
    </div>
  );
}

export default function LeadDetailPage() {
  const [, params] = useRoute("/leads/:id");
  const { token } = useAuth();
  const leadId = params?.id;

  const { data: lead, isLoading, error } = useQuery<Lead>({
    queryKey: ["/v1/leads", leadId],
    queryFn: async () => {
      const res = await fetch(`/v1/leads/${leadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch lead");
      return res.json();
    },
    enabled: !!leadId,
  });

  const { data: interactions = [] } = useQuery<Interaction[]>({
    queryKey: ["/v1/leads", leadId, "interactions"],
    queryFn: async () => {
      const res = await fetch(`/v1/leads/${leadId}/interactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch interactions");
      return res.json();
    },
    enabled: !!leadId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-60" />
          </div>
          <Skeleton className="h-60" />
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="space-y-6">
        <Link href="/leads">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leads
          </Button>
        </Link>
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Lead not found or failed to load.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/leads">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold" data-testid="text-lead-name">
              {lead.contact.name}
            </h1>
            <Badge className={STATUS_COLORS[lead.status]} data-testid="badge-status">
              {lead.status}
            </Badge>
            <Badge variant="outline" className={PRIORITY_COLORS[lead.priority]} data-testid="badge-priority">
              {lead.priority}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Created {new Date(lead.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lead Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Source</p>
                  <p className="font-medium capitalize" data-testid="text-source">{lead.source}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Practice Area</p>
                  <p className="font-medium" data-testid="text-practice-area">
                    {lead.practiceArea?.name || "Not assigned"}
                  </p>
                </div>
                {lead.incidentDate && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Incident Date
                    </p>
                    <p className="font-medium">
                      {new Date(lead.incidentDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {lead.incidentLocation && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Location
                    </p>
                    <p className="font-medium">{lead.incidentLocation}</p>
                  </div>
                )}
              </div>
              {lead.summary && (
                <div className="space-y-1 pt-2 border-t">
                  <p className="text-sm text-muted-foreground">Summary</p>
                  <p data-testid="text-summary">{lead.summary}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="interactions" className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="interactions" data-testid="tab-interactions">
                <MessageSquare className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Interactions</span>
                {interactions.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{interactions.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="calls" data-testid="tab-calls">
                <PhoneCall className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Calls</span>
              </TabsTrigger>
              <TabsTrigger value="messages" data-testid="tab-messages">
                <MessageSquare className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Messages</span>
              </TabsTrigger>
              <TabsTrigger value="intake" data-testid="tab-intake">
                <ClipboardList className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Intake</span>
              </TabsTrigger>
              <TabsTrigger value="qualification" data-testid="tab-qualification">
                <CheckCircle className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Qualification</span>
              </TabsTrigger>
              <TabsTrigger value="tasks" data-testid="tab-tasks">
                <FileText className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Tasks</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="interactions" className="mt-4">
              <InteractionTimeline interactions={interactions} />
            </TabsContent>
            <TabsContent value="calls" className="mt-4">
              <CallsPanel interactions={interactions} />
            </TabsContent>
            <TabsContent value="messages" className="mt-4">
              <MessagesPanel interactions={interactions} />
            </TabsContent>
            <TabsContent value="intake" className="mt-4">
              <PlaceholderPanel icon={ClipboardList} title="Intake form responses will appear here" />
            </TabsContent>
            <TabsContent value="qualification" className="mt-4">
              <PlaceholderPanel icon={CheckCircle} title="Qualification score and reasons will appear here" />
            </TabsContent>
            <TabsContent value="tasks" className="mt-4">
              <PlaceholderPanel icon={FileText} title="Tasks and follow-ups will appear here" />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                  {lead.contact.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold" data-testid="text-contact-name">{lead.contact.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Contact since {new Date(lead.contact.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {lead.contact.primaryPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`tel:${lead.contact.primaryPhone}`}
                    className="hover:underline"
                    data-testid="link-phone"
                  >
                    {lead.contact.primaryPhone}
                  </a>
                </div>
              )}
              {lead.contact.primaryEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`mailto:${lead.contact.primaryEmail}`}
                    className="hover:underline"
                    data-testid="link-email"
                  >
                    {lead.contact.primaryEmail}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground py-6">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
