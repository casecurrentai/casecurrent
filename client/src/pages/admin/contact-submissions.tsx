import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Mail, Building, MessageSquare } from "lucide-react";

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  firm: string | null;
  message: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

interface SubmissionsResponse {
  submissions: ContactSubmission[];
  total: number;
}

export default function ContactSubmissionsPage() {
  const { token } = useAuth();

  const { data, isLoading, error } = useQuery<SubmissionsResponse>({
    queryKey: ["/v1/marketing/contact-submissions"],
    queryFn: async () => {
      const res = await fetch("/v1/marketing/contact-submissions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
  });

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-destructive">Failed to load contact submissions</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
          Contact Submissions
        </h1>
        <p className="text-muted-foreground">
          Marketing contact form submissions from the website
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Recent Submissions
            {data && (
              <Badge variant="secondary" className="ml-2">
                {data.total}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !data?.submissions.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No contact submissions yet
            </div>
          ) : (
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
                  {data.submissions.map((submission) => (
                    <TableRow key={submission.id} data-testid={`row-submission-${submission.id}`}>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
