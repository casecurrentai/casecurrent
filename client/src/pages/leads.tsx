import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, Phone, Mail, Calendar, ChevronRight, Plus, Briefcase } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  primaryPhone: string | null;
  primaryEmail: string | null;
}

interface Lead {
  id: string;
  contactId: string;
  source: string;
  status: string;
  priority: string;
  practiceAreaId: string | null;
  summary: string | null;
  createdAt: string;
  contact: Contact;
  practiceArea: { id: string; name: string } | null;
}

interface LeadsResponse {
  leads: Lead[];
  total: number;
}

interface PracticeArea {
  id: string;
  name: string;
  active: boolean;
}

interface PracticeAreasResponse {
  practiceAreas: PracticeArea[];
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "unqualified", label: "Unqualified" },
  { value: "converted", label: "Converted" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500 text-white dark:bg-orange-600",
  medium: "bg-yellow-500 text-white dark:bg-yellow-600",
  low: "bg-muted text-muted-foreground",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-primary text-primary-foreground",
  contacted: "bg-blue-500 text-white dark:bg-blue-600",
  qualified: "bg-green-500 text-white dark:bg-green-600",
  unqualified: "bg-muted text-muted-foreground",
  converted: "bg-emerald-500 text-white dark:bg-emerald-600",
  closed: "bg-muted text-muted-foreground",
};

export default function LeadsPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [practiceAreaFilter, setPracticeAreaFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data: practiceAreasData } = useQuery<PracticeAreasResponse>({
    queryKey: ["/v1/practice-areas"],
    queryFn: async () => {
      const res = await fetch("/v1/practice-areas", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch practice areas");
      return res.json();
    },
  });

  const queryParams = new URLSearchParams();
  if (debouncedSearch) queryParams.set("q", debouncedSearch);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (practiceAreaFilter !== "all") queryParams.set("practice_area_id", practiceAreaFilter);

  const { data, isLoading, error } = useQuery<LeadsResponse>({
    queryKey: ["/v1/leads", queryParams.toString()],
    queryFn: async () => {
      const url = `/v1/leads${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Leads</h1>
          <p className="text-muted-foreground">
            Manage and track your potential clients
          </p>
        </div>
        <Button data-testid="button-new-lead">
          <Plus className="h-4 w-4 mr-2" />
          New Lead
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={practiceAreaFilter} onValueChange={setPracticeAreaFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-practice-area">
            <Briefcase className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Practice Area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Practice Areas</SelectItem>
            {practiceAreasData?.practiceAreas.map((pa) => (
              <SelectItem key={pa.id} value={pa.id}>
                {pa.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Failed to load leads. Please try again.
          </CardContent>
        </Card>
      ) : data?.leads.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No leads found</h3>
            <p className="text-muted-foreground mb-4">
              {search || statusFilter !== "all" || practiceAreaFilter !== "all"
                ? "Try adjusting your filters"
                : "Create your first lead to get started"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data?.leads.map((lead) => (
            <Link key={lead.id} href={`/leads/${lead.id}`}>
              <Card className="hover-elevate cursor-pointer" data-testid={`card-lead-${lead.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      {lead.contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate" data-testid={`text-lead-name-${lead.id}`}>
                          {lead.contact.name}
                        </span>
                        <Badge
                          className={STATUS_COLORS[lead.status] || "bg-muted"}
                          data-testid={`badge-status-${lead.id}`}
                        >
                          {lead.status}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={PRIORITY_COLORS[lead.priority]}
                          data-testid={`badge-priority-${lead.id}`}
                        >
                          {lead.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                        {lead.contact.primaryPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {lead.contact.primaryPhone}
                          </span>
                        )}
                        {lead.contact.primaryEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {lead.contact.primaryEmail}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </span>
                        {lead.practiceArea && (
                          <Badge variant="secondary">{lead.practiceArea.name}</Badge>
                        )}
                      </div>
                      {lead.summary && (
                        <p className="text-sm text-muted-foreground mt-2 truncate">
                          {lead.summary}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {data && data.total > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {data.leads.length} of {data.total} leads
        </div>
      )}
    </div>
  );
}
