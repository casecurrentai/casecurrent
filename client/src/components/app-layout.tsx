import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import {
  Users,
  LogOut,
  ChevronDown,
  MessageSquare,
  Webhook,
  ShieldCheck,
  Home,
  Bug,
  Menu as MenuIcon,
  Briefcase,
  PanelLeft,
  BarChart3,
  ListChecks,
} from "lucide-react";
import type { ReactNode } from "react";
import logoPath from "@assets/CaseCURRENT_-_2_1771296974787.png";

interface BuildInfo {
  sha: string;
  buildTime: string;
  nodeEnv: string;
  source: string;
}

function useVersion(): BuildInfo | null {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  useEffect(() => {
    fetch("/api/version", { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setBuildInfo({
        sha: data.sha || 'unknown',
        buildTime: data.buildTime || '',
        nodeEnv: data.nodeEnv || '',
        source: data.source || '',
      }))
      .catch(() => setBuildInfo(null));
  }, []);
  return buildInfo;
}

// Sidebar nav structure
const MAIN_NAV = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/cases", label: "Cases", icon: Briefcase },
];

const INSIGHTS_NAV = [
  { href: "/dashboard", label: "Analytics", icon: BarChart3 },
];

const TASKS_NAV = [
  { href: "/admin/contact-submissions", label: "Inquiries", icon: MessageSquare },
  { href: "/settings/webhooks", label: "Integrations", icon: Webhook },
];

const SYSTEM_NAV = [
  { href: "/debug", label: "Activity Log", icon: Bug },
];

// Mobile bottom nav - exactly 3 items
const MOBILE_NAV = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/cases", label: "Cases", icon: Briefcase },
  { href: "/menu", label: "Menu", icon: MenuIcon },
];

export function AppLayout({ children }: { children: ReactNode }) {
  return <AppLayoutInner>{children}</AppLayoutInner>;
}

function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <>
      {/* Bottom navigation bar - fixed at bottom on mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around px-2">
          {MOBILE_NAV.map((item) => {
            const isActive = item.href === "/menu"
              ? location === "/menu"
              : location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={`flex flex-col items-center justify-center gap-0.5 px-4 min-h-[56px] min-w-[72px] transition-colors ${
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground"
                  }`}
                  data-testid={`mobile-nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-6 w-6" />
                  <span className="text-[11px] font-medium">{item.label}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacer for bottom nav on mobile - accounts for safe area */}
      <div className="h-[72px] md:hidden" />
    </>
  );
}

function AppSidebar() {
  const [location] = useLocation();
  const { user, organization, logout } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  return (
    <Sidebar collapsible="icon" className="hidden md:flex">
      <SidebarHeader className="p-4">
        <Link href="/cases" className="flex items-center gap-2">
          <img src={logoPath} alt="CaseCurrent" className="h-7 w-auto flex-shrink-0" />
          <span className="font-bold text-lg tracking-tight cursor-pointer group-data-[collapsible=icon]:hidden" data-testid="text-header-logo">
            CaseCurrent
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Main */}
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN_NAV.map((item) => {
                const isActive = location.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Insights */}
        <SidebarGroup>
          <SidebarGroupLabel>Insights</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {INSIGHTS_NAV.map((item) => {
                const isActive = location.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tasks */}
        <SidebarGroup>
          <SidebarGroupLabel>Tasks</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {TASKS_NAV.map((item) => {
                const isActive = location.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* System (admin/owner only) */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {SYSTEM_NAV.map((item) => {
                  const isActive = location.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{organization?.name}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 group-data-[collapsible=icon]:hidden"
            onClick={logout}
            data-testid="sidebar-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function UserMenu() {
  const { user, organization, logout } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" data-testid="button-user-menu">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <span className="hidden sm:inline max-w-[100px] truncate">
            {user?.name}
          </span>
          <ChevronDown className="h-3 w-3 hidden sm:block" />
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
        <DropdownMenuItem onClick={logout} data-testid="menu-logout">
          <LogOut className="h-4 w-4 mr-2" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppLayoutInner({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const buildInfo = useVersion();
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  const formatBuildTime = (isoTime: string) => {
    if (!isoTime) return '';
    try {
      const date = new Date(isoTime);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoTime.slice(0, 16);
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-[#F3F4F6] dark:bg-background">
        {/* Thin top bar inside SidebarInset */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-12 items-center gap-2 px-4">
            {/* Sidebar toggle (desktop only) */}
            <SidebarTrigger className="hidden md:flex" />

            {/* Mobile: Logo */}
            <Link href="/cases" className="md:hidden flex items-center gap-2">
              <img src={logoPath} alt="CaseCurrent" className="h-6 w-auto" />
              <span className="font-bold text-lg tracking-tight cursor-pointer" data-testid="text-header-logo-mobile">
                CaseCurrent
              </span>
            </Link>

            {/* Spacer */}
            <div className="flex-1" />

            {/* User menu */}
            <UserMenu />
          </div>
        </header>

        {/* Main content with bottom padding for mobile nav */}
        <main className="flex-1 px-4 py-4 md:py-6 md:px-6 pb-24 md:pb-6">
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <MobileBottomNav />

        {/* Footer with version SHA + buildTime for admin users */}
        {isAdmin && buildInfo && buildInfo.sha !== "local" && (
          <footer className="hidden md:block border-t py-2 px-4 text-center">
            <span className="text-xs text-muted-foreground font-mono" data-testid="text-version-sha">
              Build: {buildInfo.sha} @ {formatBuildTime(buildInfo.buildTime)}
            </span>
          </footer>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
