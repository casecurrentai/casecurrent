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
              <PlaceholderPanel icon={MessageSquare} title="Interactions will appear here" />
            </TabsContent>
            <TabsContent value="calls" className="mt-4">
              <PlaceholderPanel icon={PhoneCall} title="Call history will appear here" />
            </TabsContent>
            <TabsContent value="messages" className="mt-4">
              <PlaceholderPanel icon={MessageSquare} title="SMS and chat messages will appear here" />
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
