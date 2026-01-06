import { useAuth, ProtectedRoute } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";
import { Users, LayoutDashboard, Settings, LogOut, ChevronDown, MessageSquare, Webhook, FlaskConical, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/policy-tests", label: "Policy Tests", icon: ShieldCheck },
  { href: "/admin/contact-submissions", label: "Inquiries", icon: MessageSquare },
  { href: "/settings/webhooks", label: "Webhooks", icon: Webhook },
];

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayoutInner>{children}</AppLayoutInner>
    </ProtectedRoute>
  );
}

function AppLayoutInner({ children }: { children: ReactNode }) {
  const { user, organization, logout } = useAuth();
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4 px-4">
          <Link href="/leads">
            <span className="font-bold text-lg tracking-tight cursor-pointer" data-testid="text-header-logo">
              CounselTech
            </span>
          </Link>

          <nav className="flex items-center gap-1 flex-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    data-testid={`nav-${item.label.toLowerCase()}`}
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2" data-testid="button-user-menu">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {user?.name}
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {organization?.name} - {user?.role}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid="menu-settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} data-testid="menu-logout">
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="container px-4 py-6">
        {children}
      </main>
    </div>
  );
}
