import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Search, Users, Target } from "lucide-react";

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
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Platform admin access required.</p>
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
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Organizations
          </h1>
          <p className="text-muted-foreground">Platform admin organization management</p>
        </div>
        <Link href="/admin/orgs/new">
          <Button data-testid="button-create-org">
            <Plus className="w-4 h-4 mr-2" />
            Create Firm
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
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
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid gap-4">
          {data?.organizations.map((org) => (
            <Link key={org.id} href={`/admin/orgs/${org.id}`}>
              <Card className="hover-elevate cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold" data-testid={`text-org-name-${org.id}`}>{org.name}</h3>
                        <span className="text-muted-foreground text-sm">({org.slug})</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {org._count.users} users
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          {org._count.leads} leads
                        </span>
                        <span>Created {new Date(org.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {data?.organizations.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No organizations found.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
