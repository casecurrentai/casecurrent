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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, Phone, Mail, Calendar, ChevronRight, Plus, Briefcase, Filter, X } from "lucide-react";

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
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

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

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (practiceAreaFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter("all");
    setPracticeAreaFilter("all");
  };

  return (
    <div className="space-y-4">
      {/* Header - Mobile optimized */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-page-title">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track your potential clients
          </p>
        </div>
        <Button className="w-full sm:w-auto" data-testid="button-new-lead">
          <Plus className="h-4 w-4 mr-2" />
          New Lead
        </Button>
      </div>

      {/* Search and Filters - Mobile optimized */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search - Full width on mobile */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>

        {/* Mobile: Filter button that opens sheet */}
        <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="sm:hidden relative" data-testid="button-mobile-filters">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-xl">
            <SheetHeader className="pb-4">
              <div className="flex items-center justify-between gap-2">
                <SheetTitle>Filter Leads</SheetTitle>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                    Clear all
                  </Button>
                )}
              </div>
            </SheetHeader>
            <div className="space-y-4 pb-safe">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger data-testid="mobile-select-status">
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
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Practice Area</label>
                <Select value={practiceAreaFilter} onValueChange={setPracticeAreaFilter}>
                  <SelectTrigger data-testid="mobile-select-practice-area">
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
              <Button 
                className="w-full" 
                onClick={() => setFilterSheetOpen(false)}
                data-testid="button-apply-filters"
              >
                Apply Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop: Inline filters */}
        <div className="hidden sm:flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-status">
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
            <SelectTrigger className="w-[180px]" data-testid="select-practice-area">
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
      </div>

      {/* Active filter chips - Mobile */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 sm:hidden">
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}
              <button 
                onClick={() => setStatusFilter("all")} 
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
                data-testid="button-remove-status-filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {practiceAreaFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {practiceAreasData?.practiceAreas.find(pa => pa.id === practiceAreaFilter)?.name}
              <button 
                onClick={() => setPracticeAreaFilter("all")} 
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
                data-testid="button-remove-practice-filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Leads list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="space-y-2 flex-1 min-w-0">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
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
          <CardContent className="p-8 sm:p-12 text-center">
            <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No leads found</h3>
            <p className="text-muted-foreground mb-4 text-sm sm:text-base">
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
              <Card className="hover-elevate cursor-pointer active:scale-[0.99] transition-transform" data-testid={`card-lead-${lead.id}`}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                      {lead.contact.name.charAt(0).toUpperCase()}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Name and badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-semibold truncate block" data-testid={`text-lead-name-${lead.id}`}>
                            {lead.contact.name}
                          </span>
                          {/* Mobile: Stacked contact info */}
                          <div className="flex flex-col gap-1 text-sm text-muted-foreground mt-1 sm:hidden">
                            {lead.contact.primaryPhone && (
                              <span className="flex items-center gap-1.5">
                                <Phone className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{lead.contact.primaryPhone}</span>
                              </span>
                            )}
                            {lead.contact.primaryEmail && (
                              <span className="flex items-center gap-1.5">
                                <Mail className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{lead.contact.primaryEmail}</span>
                              </span>
                            )}
                          </div>
                          {/* Desktop: Inline contact info */}
                          <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
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
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      </div>
                      
                      {/* Badges row */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <Badge
                          className={`text-xs ${STATUS_COLORS[lead.status] || "bg-muted"}`}
                          data-testid={`badge-status-${lead.id}`}
                        >
                          {lead.status}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${PRIORITY_COLORS[lead.priority]}`}
                          data-testid={`badge-priority-${lead.id}`}
                        >
                          {lead.priority}
                        </Badge>
                        {lead.practiceArea && (
                          <Badge variant="secondary" className="text-xs">{lead.practiceArea.name}</Badge>
                        )}
                        {/* Mobile: Date */}
                        <span className="text-xs text-muted-foreground sm:hidden ml-auto">
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {/* Summary - Truncate on mobile */}
                      {lead.summary && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2 sm:truncate">
                          {lead.summary}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Results count */}
      {data && data.total > 0 && (
        <div className="text-sm text-muted-foreground text-center py-2">
          Showing {data.leads.length} of {data.total} leads
        </div>
      )}
    </div>
  );
}
