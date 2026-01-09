import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Shield, Sparkles, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSetupDemo() {
    setIsSeeding(true);
    setError("");
    setSeedSuccess("");

    try {
      const response = await fetch("/v1/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Database already has data. Contact support for demo access.");
        }
        throw new Error(data.error || "Failed to set up demo account");
      }

      setEmail("owner@demo.com");
      setPassword("DemoPass123!");
      setSeedSuccess(data.alreadySeeded 
        ? "Demo account ready! Click Sign In to continue." 
        : "Demo account created! Click Sign In to continue."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set up demo account");
    } finally {
      setIsSeeding(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-logo">
            CaseCurrent
          </h1>
          <p className="text-muted-foreground">
            AI-powered intake and lead capture
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md" data-testid="text-error">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {seedSuccess && (
                <div className="flex items-center gap-2 p-3 text-sm text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 rounded-md" data-testid="text-seed-success">
                  <CheckCircle2 className="h-4 w-4" />
                  {seedSuccess}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  data-testid="input-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleSetupDemo}
                disabled={isSeeding}
                data-testid="button-setup-demo"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isSeeding ? "Setting up..." : "Setup Demo Account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-3">
            <div className="flex items-start gap-2 text-xs text-yellow-800 dark:text-yellow-200">
              <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Security Notice</p>
                <p className="mt-0.5 text-yellow-700 dark:text-yellow-300">
                  This demo stores your authentication token in localStorage which may be vulnerable to XSS attacks.
                  In production, use httpOnly cookies for secure token storage.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
