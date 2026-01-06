import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Mail, Building, MessageSquare, Calendar, Phone } from "lucide-react";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
          Marketing Submissions
        </h1>
        <p className="text-muted-foreground">
          Contact form and demo request submissions from the marketing website
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">
            All ({contactCount + demoCount})
          </TabsTrigger>
          <TabsTrigger value="demo" data-testid="tab-demo">
            Demo Requests ({demoCount})
          </TabsTrigger>
          <TabsTrigger value="contact" data-testid="tab-contact">
            Contact Forms ({contactCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="space-y-6">
            {demoCount > 0 && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5" />
                    Demo Requests
                    <Badge variant="default" className="ml-2">{demoCount}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DemoTable submissions={demoData?.submissions || []} isLoading={demoLoading} />
                </CardContent>
              </Card>
            )}
            
            {contactCount > 0 && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquare className="h-5 w-5" />
                    Contact Submissions
                    <Badge variant="secondary" className="ml-2">{contactCount}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ContactTable submissions={contactData?.submissions || []} isLoading={contactLoading} />
                </CardContent>
              </Card>
            )}

            {!isLoading && contactCount === 0 && demoCount === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No marketing submissions yet
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="demo" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Demo Requests
                <Badge variant="default" className="ml-2">{demoCount}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DemoTable submissions={demoData?.submissions || []} isLoading={demoLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Contact Submissions
                <Badge variant="secondary" className="ml-2">{contactCount}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ContactTable submissions={contactData?.submissions || []} isLoading={contactLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DemoTable({ submissions, isLoading }: { submissions: MarketingSubmission[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!submissions.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No demo requests yet
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Firm</TableHead>
            <TableHead>Practice Area</TableHead>
            <TableHead>Lead Volume</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission) => (
            <TableRow key={submission.id} data-testid={`row-demo-${submission.id}`}>
              <TableCell className="whitespace-nowrap">
                {format(new Date(submission.createdAt), "MMM d, yyyy HH:mm")}
              </TableCell>
              <TableCell className="font-medium">{submission.name}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  {submission.email}
                </div>
              </TableCell>
              <TableCell>
                {submission.firm ? (
                  <div className="flex items-center gap-1">
                    <Building className="h-3 w-3 text-muted-foreground" />
                    {submission.firm}
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                {submission.practiceArea ? (
                  <Badge variant="outline" className="capitalize">
                    {submission.practiceArea.replace(/_/g, " ")}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                {submission.monthlyLeadVolume ? (
                  <span className="text-sm">{submission.monthlyLeadVolume.replace(/_/g, "-")}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ContactTable({ submissions, isLoading }: { submissions: ContactSubmission[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!submissions.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No contact submissions yet
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Firm</TableHead>
            <TableHead className="max-w-[300px]">Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission) => (
            <TableRow key={submission.id} data-testid={`row-contact-${submission.id}`}>
              <TableCell className="whitespace-nowrap">
                {format(new Date(submission.createdAt), "MMM d, yyyy HH:mm")}
              </TableCell>
              <TableCell className="font-medium">{submission.name}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  {submission.email}
                </div>
              </TableCell>
              <TableCell>
                {submission.firm ? (
                  <div className="flex items-center gap-1">
                    <Building className="h-3 w-3 text-muted-foreground" />
                    {submission.firm}
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="max-w-[300px] truncate">
                {submission.message}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
