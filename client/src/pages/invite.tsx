import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface InviteData {
  invite: {
    id: string;
    email: string;
    role: string;
    expiresAt: string;
    organization: {
      id: string;
      name: string;
      slug: string;
    };
  };
}

export default function InviteAcceptPage() {
  const { token: inviteToken } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { setAuthFromToken } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading, error } = useQuery<InviteData>({
    queryKey: ["/v1/invites", inviteToken],
    queryFn: async () => {
      const res = await fetch(`/v1/invites/${inviteToken}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Invalid invite");
      }
      return res.json();
    },
    enabled: !!inviteToken,
    retry: false,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    if (password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/v1/invites/${inviteToken}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to accept invite");
      }

      const result = await res.json();
      await setAuthFromToken(result.token);
      
      toast({
        title: "Welcome!",
        description: `You've joined ${result.organization.name}`,
      });

      if (result.organization.onboardingStatus !== "complete") {
        setLocation("/setup");
      } else {
        setLocation("/cases");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading invite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">Invalid Invite</h2>
            <p className="text-muted-foreground mb-4">{(error as Error).message}</p>
            <Button onClick={() => setLocation("/login")} variant="outline">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invite = data?.invite;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 py-8 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Join {invite?.organization.name}</CardTitle>
          <CardDescription>
            You've been invited as {invite?.role}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={invite?.email || ""} disabled data-testid="input-email" />
            </div>
            <div>
              <Label htmlFor="name">Your Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                required
                data-testid="input-name"
              />
            </div>
            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                data-testid="input-password"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                data-testid="input-confirm-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-accept">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accept Invite & Join
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
