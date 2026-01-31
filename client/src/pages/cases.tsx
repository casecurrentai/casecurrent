import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Search, Users, Phone, Mail, Calendar, ChevronRight, Plus, Briefcase, Filter, X, MoreVertical, MessageSquare } from "lucide-react";

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
  displayName: string | null;
  practiceAreaId: string | null;
  summary: string | null;
  score: number | null;
  scoreLabel: string | null;
  scoreReasons: string[] | null;
  urgency: string | null;
  intakeData: any | null;
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

const FILTER_OPTIONS = [
  { value: "action", label: "Action Required" },
  { value: "all", label: "All Cases" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "unqualified", label: "Unqualified" },
  { value: "converted", label: "Won / Signed" },
  { value: "closed", label: "Closed / Lost" },
];

function getBestDisplayName(lead: Lead): string {
  if (lead.displayName && lead.displayName.trim()) {
    return lead.displayName;
  }
  if (lead.contact?.name && lead.contact.name.trim() && lead.contact.name !== "Unknown Caller") {
    return lead.contact.name;
  }
  const intakeData = lead.intakeData as Record<string, any> | null;
  if (intakeData?.callerName && typeof intakeData.callerName === "string" && intakeData.callerName.trim()) {
    return intakeData.callerName;
  }
  if (intakeData?.caller?.fullName && typeof intakeData.caller.fullName === "string" && intakeData.caller.fullName.trim()) {
    return intakeData.caller.fullName;
  }
  return "Unknown Caller";
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-primary text-primary-foreground",
  contacted: "bg-blue-500 text-white dark:bg-blue-600",
  qualified: "bg-green-500 text-white dark:bg-green-600",
  unqualified: "bg-muted text-muted-foreground",
  converted: "bg-emerald-500 text-white dark:bg-emerald-600",
  closed: "bg-muted text-muted-foreground",
};

function getContextString(lead: Lead): string {
  const now = Date.now();
  const created = new Date(lead.createdAt).getTime();
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let timeAgo: string;
  if (diffMins < 60) timeAgo = `${diffMins}m ago`;
  else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
  else if (diffDays < 7) timeAgo = `${diffDays}d ago`;
  else timeAgo = new Date(lead.createdAt).toLocaleDateString();

  const sourceLabel = lead.source === "call" ? "Call" : lead.source === "sms" ? "Text" : lead.source === "web" ? "Web" : lead.source;

  return `${sourceLabel} - ${timeAgo}`;
}

/**
 * Best-effort dedup for current page; does not span pagination.
 * Groups cases by normalized phone → lowercase email → contactId.
 * Returns most recent per group.
 */
function groupCasesByContact(leads: Lead[]): Lead[] {
  const groups = new Map<string, Lead[]>();

  for (const lead of leads) {
    const phone = lead.contact?.primaryPhone?.replace(/\D/g, "") || "";
    const email = lead.contact?.primaryEmail?.toLowerCase() || "";
    const key = phone || email || lead.contactId;

    const existing = groups.get(key);
    if (existing) {
      existing.push(lead);
    } else {
      groups.set(key, [lead]);
    }
  }

  const result: Lead[] = [];
  for (const group of groups.values()) {
    // Sort by most recent first
    group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    result.push(group[0]);
  }

  return result;
}

// Status group definitions
const STATUS_GROUPS = [
  { label: "Needs Action", statuses: ["new"], key: "needs-action" },
  { label: "In Progress", statuses: ["contacted", "qualified"], key: "in-progress" },
  { label: "Won / Signed", statuses: ["converted"], key: "won" },
  { label: "Closed / Lost", statuses: ["unqualified", "closed"], key: "closed" },
];

export default function CasesPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("action");
  const [practiceAreaFilter, setPracticeAreaFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [newCaseSheetOpen, setNewCaseSheetOpen] = useState(false);
  const [newCaseName, setNewCaseName] = useState("");
  const [newCasePhone, setNewCasePhone] = useState("");
  const [newCaseEmail, setNewCaseEmail] = useState("");

  const createCaseMutation = useMutation({
    mutationFn: async (data: { contactName: string; contactPhone?: string; contactEmail?: string }) => {
      const res = await fetch("/v1/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...data,
          source: "web",
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create case");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/v1/leads"] });
      setNewCaseSheetOpen(false);
      setNewCaseName("");
      setNewCasePhone("");
      setNewCaseEmail("");
    },
  });

  const handleCreateCase = () => {
    if (!newCaseName.trim()) return;
    createCaseMutation.mutate({
      contactName: newCaseName.trim(),
      contactPhone: newCasePhone.trim() || undefined,
      contactEmail: newCaseEmail.trim() || undefined,
    });
  };

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

  // Build query params - for "action" filter, fetch all and filter client-side
  const queryParams = new URLSearchParams();
  if (debouncedSearch) queryParams.set("q", debouncedSearch);
  if (filterMode !== "all" && filterMode !== "action") queryParams.set("status", filterMode);
  if (practiceAreaFilter !== "all") queryParams.set("practice_area_id", practiceAreaFilter);

  const { data, isLoading, error } = useQuery<LeadsResponse>({
    queryKey: ["/v1/leads", queryParams.toString()],
    queryFn: async () => {
      const url = `/v1/leads${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch cases");
      return res.json();
    },
  });

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Group and filter cases
  const groupedCases = useMemo(() => {
    if (!data?.leads) return [];
    return groupCasesByContact(data.leads);
  }, [data?.leads]);

  // Filter for "action" mode
  const filteredCases = useMemo(() => {
    if (filterMode === "action") {
      return groupedCases.filter(c => ["new", "contacted", "qualified"].includes(c.status));
    }
    return groupedCases;
  }, [groupedCases, filterMode]);

  // Group by status sections
  const sectionedCases = useMemo(() => {
    return STATUS_GROUPS.map(group => ({
      ...group,
      cases: filteredCases.filter(c => group.statuses.includes(c.status)),
    })).filter(g => g.cases.length > 0);
  }, [filteredCases]);

  const activeFilterCount = (filterMode !== "action" ? 1 : 0) + (practiceAreaFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setFilterMode("action");
    setPracticeAreaFilter("all");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-page-title">Cases</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track your potential clients
          </p>
        </div>
        <Sheet open={newCaseSheetOpen} onOpenChange={setNewCaseSheetOpen}>
          <SheetTrigger asChild>
            <Button className="w-full sm:w-auto" data-testid="button-new-case">
              <Plus className="h-4 w-4 mr-2" />
              New Case
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>New Case</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="new-case-name">Name *</Label>
                <Input
                  id="new-case-name"
                  placeholder="Contact name"
                  value={newCaseName}
                  onChange={(e) => setNewCaseName(e.target.value)}
                  data-testid="input-new-case-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-case-phone">Phone</Label>
                <Input
                  id="new-case-phone"
                  placeholder="Phone number"
                  value={newCasePhone}
                  onChange={(e) => setNewCasePhone(e.target.value)}
                  data-testid="input-new-case-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-case-email">Email</Label>
                <Input
                  id="new-case-email"
                  type="email"
                  placeholder="Email address"
                  value={newCaseEmail}
                  onChange={(e) => setNewCaseEmail(e.target.value)}
                  data-testid="input-new-case-email"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCreateCase}
                disabled={!newCaseName.trim() || createCaseMutation.isPending}
                data-testid="button-create-case"
              >
                {createCaseMutation.isPending ? "Creating..." : "Create Case"}
              </Button>
              {createCaseMutation.isError && (
                <p className="text-sm text-destructive">
                  {createCaseMutation.error?.message || "Failed to create case"}
                </p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>

        {/* Mobile: Filter button */}
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
                <SheetTitle>Filter Cases</SheetTitle>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                    Clear all
                  </Button>
                )}
              </div>
            </SheetHeader>
            <div className="space-y-4 pb-safe">
              <div className="space-y-2">
                <label className="text-sm font-medium">View</label>
                <Select value={filterMode} onValueChange={setFilterMode}>
                  <SelectTrigger data-testid="mobile-select-status">
                    <SelectValue placeholder="Filter by view" />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPTIONS.map((option) => (
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
          <Select value={filterMode} onValueChange={setFilterMode}>
            <SelectTrigger className="w-[180px]" data-testid="select-status">
              <SelectValue placeholder="Filter by view" />
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map((option) => (
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

      {/* Cases list */}
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
            Failed to load cases. Please try again.
          </CardContent>
        </Card>
      ) : filteredCases.length === 0 ? (
        <Card>
          <CardContent className="p-8 sm:p-12 text-center">
            <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No cases found</h3>
            <p className="text-muted-foreground mb-4 text-sm sm:text-base">
              {search || filterMode !== "action" || practiceAreaFilter !== "all"
                ? "Try adjusting your filters"
                : "Create your first case to get started"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sectionedCases.map((section) => (
            <div key={section.key} className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                {section.label} ({section.cases.length})
              </h2>
              <div className="space-y-2">
                {section.cases.map((lead) => (
                  <CaseRow key={lead.id} lead={lead} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results count */}
      {data && data.total > 0 && (
        <div className="text-sm text-muted-foreground text-center py-2">
          Showing {filteredCases.length} of {data.total} cases
        </div>
      )}
    </div>
  );
}

function CaseRow({ lead }: { lead: Lead }) {
  const name = getBestDisplayName(lead);
  const context = getContextString(lead);

  return (
    <div className="flex items-center gap-2">
      <Link href={`/cases/${lead.id}`} className="flex-1 min-w-0">
        <Card className="hover-elevate cursor-pointer active:scale-[0.99] transition-transform" data-testid={`card-case-${lead.id}`}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                {name.charAt(0).toUpperCase()}
              </div>

              {/* Content - Super Cell */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate text-sm" data-testid={`text-case-name-${lead.id}`}>
                    {name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {context}
                </p>
              </div>

              {/* Stage pill */}
              <Badge
                className={`text-[10px] flex-shrink-0 ${STATUS_COLORS[lead.status] || "bg-muted"}`}
                data-testid={`badge-status-${lead.id}`}
              >
                {lead.status}
              </Badge>

              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Kebab menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" data-testid={`kebab-${lead.id}`}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {lead.contact.primaryPhone && (
            <DropdownMenuItem asChild>
              <a href={`tel:${lead.contact.primaryPhone}`}>
                <Phone className="h-4 w-4 mr-2" />
                Call
              </a>
            </DropdownMenuItem>
          )}
          {lead.contact.primaryPhone && (
            <DropdownMenuItem asChild>
              <a href={`sms:${lead.contact.primaryPhone}`}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Text
              </a>
            </DropdownMenuItem>
          )}
          {lead.contact.primaryEmail && (
            <DropdownMenuItem asChild>
              <a href={`mailto:${lead.contact.primaryEmail}`}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </a>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
