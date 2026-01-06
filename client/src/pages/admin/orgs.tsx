import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Plus, Search, Users, Target, ChevronRight } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  slug: string;
  onboardingStatus: string;
  subscriptionStatus: string;
  planTier: string | null;
  createdAt: string;
  _count: {
    users: number;
    leads: number;
  };
}

export default function AdminOrgsPage() {
  const { token, isPlatformAdmin } = useAuth();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ organizations: Organization[] }>({
    queryKey: ["/v1/admin/orgs", search],
    queryFn: async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/v1/admin/orgs${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch orgs");
      return res.json();
    },
    enabled: !!token && isPlatformAdmin,
  });

  if (!isPlatformAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md">
          <CardContent className="p-6 sm:p-8 text-center">
            <h2 className="text-lg sm:text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-sm text-muted-foreground">Platform admin access required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const onboardingStatusColor = (status: string) => {
    switch (status) {
      case "complete": return "default";
      case "in_progress": return "secondary";
      default: return "outline";
    }
  };

  const subscriptionStatusColor = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "trial": return "secondary";
      case "past_due": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            Organizations
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Platform admin organization management</p>
        </div>
        <Link href="/admin/orgs/new">
          <Button className="w-full sm:w-auto" data-testid="button-create-org">
            <Plus className="w-4 h-4 mr-2" />
            Create Firm
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-orgs"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 sm:h-20" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {data?.organizations.map((org) => (
            <Link key={org.id} href={`/admin/orgs/${org.id}`}>
              <Card className="hover-elevate cursor-pointer" data-testid={`card-org-${org.id}`}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-sm sm:text-base truncate" data-testid={`text-org-name-${org.id}`}>
                          {org.name}
                        </h3>
                        <span className="text-muted-foreground text-xs sm:text-sm hidden sm:inline">
                          ({org.slug})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                          {org._count.users}
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3 sm:w-4 sm:h-4" />
                          {org._count.leads}
                        </span>
                        <span className="hidden sm:inline">
                          {new Date(org.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {/* Mobile: Badges below stats */}
                      <div className="flex items-center gap-1.5 mt-2 sm:hidden flex-wrap">
                        <Badge variant={onboardingStatusColor(org.onboardingStatus)} className="text-[10px]">
                          {org.onboardingStatus.replace("_", " ")}
                        </Badge>
                        <Badge variant={subscriptionStatusColor(org.subscriptionStatus)} className="text-[10px]">
                          {org.subscriptionStatus}
                        </Badge>
                        {org.planTier && (
                          <Badge variant="outline" className="text-[10px]">{org.planTier}</Badge>
                        )}
                      </div>
                    </div>
                    {/* Desktop: Badges on the right */}
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <Badge variant={onboardingStatusColor(org.onboardingStatus)}>
                        {org.onboardingStatus.replace("_", " ")}
                      </Badge>
                      <Badge variant={subscriptionStatusColor(org.subscriptionStatus)}>
                        {org.subscriptionStatus}
                      </Badge>
                      {org.planTier && (
                        <Badge variant="outline">{org.planTier}</Badge>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 sm:hidden" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {data?.organizations.length === 0 && (
            <Card>
              <CardContent className="py-8 sm:py-12 text-center text-muted-foreground text-sm">
                No organizations found.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
