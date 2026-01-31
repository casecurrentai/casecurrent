import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Briefcase,
  ShieldCheck,
  Webhook,
  MessageSquare,
  FlaskConical,
  Bug,
  LogOut,
  Settings,
  ChevronRight,
} from "lucide-react";

const FIRM_OPS = [
  { href: "/cases", label: "Cases", description: "Manage potential clients", icon: Briefcase },
  { href: "/policy-tests", label: "Safety Checks", description: "Run intake policy tests", icon: ShieldCheck },
  { href: "/settings/webhooks", label: "Integrations", description: "Webhook configuration", icon: Webhook },
  { href: "/admin/contact-submissions", label: "Inquiries", description: "Contact form submissions", icon: MessageSquare },
];

const INTAKE_LAB = [
  { href: "/experiments", label: "Experiments", description: "Test intake configurations", icon: FlaskConical },
];

const SYSTEM_NAV = [
  { href: "/debug", label: "Activity Log", description: "System events and debugging", icon: Bug },
];

export default function MenuPage() {
  const { user, organization, logout } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold">{greeting}, {user?.name?.split(" ")[0] || "there"}</h1>
        <p className="text-sm text-muted-foreground">{dateStr}</p>
      </div>

      {/* Firm Ops */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Firm Ops</h2>
        <Card>
          <CardContent className="p-0">
            {FIRM_OPS.map((item, idx) => (
              <Link key={item.href} href={item.href}>
                <button className={`flex items-center gap-3 w-full px-4 py-3 text-left hover-elevate transition-colors ${
                  idx < FIRM_OPS.length - 1 ? "border-b" : ""
                }`}>
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Intake Lab */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Intake Lab</h2>
        <Card>
          <CardContent className="p-0">
            {INTAKE_LAB.map((item, idx) => (
              <Link key={item.href} href={item.href}>
                <button className={`flex items-center gap-3 w-full px-4 py-3 text-left hover-elevate transition-colors ${
                  idx < INTAKE_LAB.length - 1 ? "border-b" : ""
                }`}>
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* System (admin/owner only) */}
      {isAdmin && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">System</h2>
          <Card>
            <CardContent className="p-0">
              {SYSTEM_NAV.map((item, idx) => (
                <Link key={item.href} href={item.href}>
                  <button className={`flex items-center gap-3 w-full px-4 py-3 text-left hover-elevate transition-colors ${
                    idx < SYSTEM_NAV.length - 1 ? "border-b" : ""
                  }`}>
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Profile Card */}
      <Separator />
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-semibold">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{organization?.name}</p>
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={logout}
              data-testid="menu-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
