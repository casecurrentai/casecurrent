import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Building2, 
  ArrowLeft, 
  Users, 
  Phone, 
  Settings, 
  Activity,
  Link as LinkIcon,
  UserCog,
  AlertTriangle,
  Copy
} from "lucide-react";

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  onboardingStatus: string;
  subscriptionStatus: string;
  planTier: string | null;
  createdAt: string;
  users: Array<{ id: string; email: string; name: string; role: string; status: string }>;
  aiConfig: any;
  practiceAreas: Array<{ id: string; name: string; active: boolean }>;
  phoneNumbers: Array<{ id: string; label: string; e164: string }>;
  _count: { leads: number; calls: number; messages: number };
}

export default function AdminOrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, isPlatformAdmin, setAuthFromToken } = useAuth();
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [showImpersonateWarning, setShowImpersonateWarning] = useState(false);

  const { data, isLoading } = useQuery<{ organization: OrgDetail; health: any }>({
    queryKey: ["/v1/admin/orgs", id],
    queryFn: async () => {
      const res = await fetch(`/v1/admin/orgs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch org");
      return res.json();
    },
    enabled: !!token && isPlatformAdmin && !!id,
  });

  const createInviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch(`/v1/admin/orgs/${id}/invites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, role: "owner" }),
      });
      if (!res.ok) throw new Error("Failed to create invite");
      return res.json();
    },
    onSuccess: (data) => {
      const inviteUrl = `${window.location.origin}/invite/${data.invite.token}`;
      navigator.clipboard.writeText(inviteUrl);
      toast({
        title: "Invite created",
        description: "Invite link copied to clipboard",
      });
      setInviteEmail("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/admin/orgs/${id}/impersonate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to impersonate");
      return res.json();
    },
    onSuccess: async (data) => {
      await setAuthFromToken(data.token);
      toast({
        title: "Impersonating",
        description: `Now viewing as ${data.organization.name}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const healthMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/v1/admin/orgs/${id}/health`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to compute health");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/v1/admin/orgs", id] });
      toast({ title: "Health snapshot updated" });
    },
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const org = data?.organization;
  const health = data?.health;

  if (!org) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            Organization not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Link href="/admin/orgs">
        <Button variant="ghost" className="mb-4" data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Organizations
        </Button>
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-org-name">
            <Building2 className="w-6 h-6" />
            {org.name}
          </h1>
          <p className="text-muted-foreground">{org.slug}</p>
          <div className="flex gap-2 mt-2">
            <Badge variant={org.onboardingStatus === "complete" ? "default" : "secondary"}>
              {org.onboardingStatus.replace("_", " ")}
            </Badge>
            <Badge variant={org.subscriptionStatus === "active" ? "default" : "outline"}>
              {org.subscriptionStatus}
            </Badge>
            {org.planTier && <Badge variant="outline">{org.planTier}</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={showImpersonateWarning} onOpenChange={setShowImpersonateWarning}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-impersonate">
                <UserCog className="w-4 h-4 mr-2" />
                Impersonate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Impersonate Organization
                </DialogTitle>
                <DialogDescription>
                  You are about to view this application as {org.name}. All actions will be logged in the audit trail.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowImpersonateWarning(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    impersonateMutation.mutate();
                    setShowImpersonateWarning(false);
                  }}
                  data-testid="button-confirm-impersonate"
                >
                  Start Impersonation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Users</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{org.users.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{org._count.leads}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{org._count.calls}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Generate Invite Link
              </CardTitle>
              <CardDescription>Create an invite for a new user to join this organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="user@example.com"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  data-testid="input-invite-email"
                />
                <Button
                  onClick={() => createInviteMutation.mutate(inviteEmail)}
                  disabled={!inviteEmail || createInviteMutation.isPending}
                  data-testid="button-create-invite"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Create & Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Team Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {org.users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{user.role}</Badge>
                      <Badge variant={user.status === "active" ? "default" : "secondary"}>{user.status}</Badge>
                    </div>
                  </div>
                ))}
                {org.users.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No users yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Practice Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {org.practiceAreas.map((pa) => (
                  <Badge key={pa.id} variant={pa.active ? "default" : "outline"}>
                    {pa.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone Numbers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {org.phoneNumbers.map((phone) => (
                  <div key={phone.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium">{phone.label}</span>
                    <span className="text-muted-foreground">{phone.e164}</span>
                  </div>
                ))}
                {org.phoneNumbers.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No phone numbers configured</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Health Snapshot
              </CardTitle>
              <CardDescription>Last 24 hours metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {health ? (
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Leads (24h)</p>
                    <p className="text-2xl font-bold">{(health.metrics as any)?.leads_24h || 0}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Calls (24h)</p>
                    <p className="text-2xl font-bold">{(health.metrics as any)?.calls_24h || 0}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Webhook Failures (24h)</p>
                    <p className="text-2xl font-bold">{(health.metrics as any)?.webhook_failures_24h || 0}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No health data yet</p>
              )}
              <Button
                onClick={() => healthMutation.mutate()}
                disabled={healthMutation.isPending}
                className="mt-4"
                variant="outline"
                data-testid="button-refresh-health"
              >
                Refresh Health Data
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
