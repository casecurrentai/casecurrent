import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Mail, Building, MessageSquare, Calendar, Phone, ChevronRight } from "lucide-react";

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  firm: string | null;
  message: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

interface MarketingSubmission {
  id: string;
  type: string;
  name: string;
  email: string;
  firm: string | null;
  phone: string | null;
  practiceArea: string | null;
  currentIntakeMethod: string | null;
  monthlyLeadVolume: string | null;
  message: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

interface ContactSubmissionsResponse {
  submissions: ContactSubmission[];
  total: number;
}

interface MarketingSubmissionsResponse {
  submissions: MarketingSubmission[];
  total: number;
}

export default function ContactSubmissionsPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("all");

  const { data: contactData, isLoading: contactLoading } = useQuery<ContactSubmissionsResponse>({
    queryKey: ["/v1/marketing/contact-submissions"],
    queryFn: async () => {
      const res = await fetch("/v1/marketing/contact-submissions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch contact submissions");
      return res.json();
    },
  });

  const { data: demoData, isLoading: demoLoading } = useQuery<MarketingSubmissionsResponse>({
    queryKey: ["/v1/marketing/submissions", "demo"],
    queryFn: async () => {
      const res = await fetch("/v1/marketing/submissions?type=demo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch demo requests");
      return res.json();
    },
  });

  const isLoading = contactLoading || demoLoading;
  const contactCount = contactData?.total || 0;
  const demoCount = demoData?.total || 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight" data-testid="text-page-title">
          Marketing Submissions
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Contact form and demo request submissions
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-auto">
            <TabsTrigger value="all" data-testid="tab-all" className="text-xs sm:text-sm">
              All ({contactCount + demoCount})
            </TabsTrigger>
            <TabsTrigger value="demo" data-testid="tab-demo" className="text-xs sm:text-sm">
              Demo ({demoCount})
            </TabsTrigger>
            <TabsTrigger value="contact" data-testid="tab-contact" className="text-xs sm:text-sm">
              Contact ({contactCount})
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="sm:hidden" />
        </ScrollArea>

        <TabsContent value="all" className="mt-4 sm:mt-6">
          <div className="space-y-4 sm:space-y-6">
            {demoCount > 0 && (
              <Card>
                <CardHeader className="pb-3 px-3 sm:px-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                    Demo Requests
                    <Badge variant="default" className="ml-2 text-xs">{demoCount}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  <DemoList submissions={demoData?.submissions || []} isLoading={demoLoading} />
                </CardContent>
              </Card>
            )}
            
            {contactCount > 0 && (
              <Card>
                <CardHeader className="pb-3 px-3 sm:px-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                    Contact Submissions
                    <Badge variant="secondary" className="ml-2 text-xs">{contactCount}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  <ContactList submissions={contactData?.submissions || []} isLoading={contactLoading} />
                </CardContent>
              </Card>
            )}

            {!isLoading && contactCount === 0 && demoCount === 0 && (
              <Card>
                <CardContent className="py-8 sm:py-12 text-center text-muted-foreground text-sm">
                  No marketing submissions yet
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="demo" className="mt-4 sm:mt-6">
          <Card>
            <CardHeader className="px-3 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                Demo Requests
                <Badge variant="default" className="ml-2 text-xs">{demoCount}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <DemoList submissions={demoData?.submissions || []} isLoading={demoLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="mt-4 sm:mt-6">
          <Card>
            <CardHeader className="px-3 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                Contact Submissions
                <Badge variant="secondary" className="ml-2 text-xs">{contactCount}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <ContactList submissions={contactData?.submissions || []} isLoading={contactLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DemoList({ submissions, isLoading }: { submissions: MarketingSubmission[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 sm:h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!submissions.length) {
    return (
      <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
        No demo requests yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {submissions.map((submission) => (
        <div
          key={submission.id}
          className="p-3 border rounded-lg space-y-2"
          data-testid={`card-demo-${submission.id}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm sm:text-base truncate">{submission.name}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{submission.email}</span>
              </div>
            </div>
            <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
              {format(new Date(submission.createdAt), "MMM d, HH:mm")}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {submission.firm && (
              <Badge variant="outline" className="text-[10px] sm:text-xs gap-1">
                <Building className="h-2.5 w-2.5" />
                {submission.firm}
              </Badge>
            )}
            {submission.practiceArea && (
              <Badge variant="secondary" className="text-[10px] sm:text-xs capitalize">
                {submission.practiceArea.replace(/_/g, " ")}
              </Badge>
            )}
            {submission.monthlyLeadVolume && (
              <Badge variant="outline" className="text-[10px] sm:text-xs">
                {submission.monthlyLeadVolume.replace(/_/g, "-")} leads/mo
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactList({ submissions, isLoading }: { submissions: ContactSubmission[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 sm:h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!submissions.length) {
    return (
      <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
        No contact submissions yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {submissions.map((submission) => (
        <div
          key={submission.id}
          className="p-3 border rounded-lg space-y-2"
          data-testid={`card-contact-${submission.id}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm sm:text-base truncate">{submission.name}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{submission.email}</span>
              </div>
            </div>
            <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
              {format(new Date(submission.createdAt), "MMM d, HH:mm")}
            </span>
          </div>
          {submission.firm && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building className="h-3 w-3" />
              {submission.firm}
            </div>
          )}
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
            {submission.message}
          </p>
        </div>
      ))}
    </div>
  );
}
