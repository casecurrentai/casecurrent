import { useState } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link, useLocation } from "wouter";
import { 
  Users, 
  Settings, 
  LogOut, 
  ChevronDown, 
  MessageSquare, 
  Webhook, 
  FlaskConical, 
  ShieldCheck,
  Menu,
  X,
  MoreHorizontal,
  Home,
} from "lucide-react";
import type { ReactNode } from "react";

// Primary navigation - shown in bottom nav on mobile
const PRIMARY_NAV = [
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/policy-tests", label: "Tests", icon: ShieldCheck },
];

// Secondary navigation - shown in "More" menu on mobile
const SECONDARY_NAV = [
  { href: "/admin/contact-submissions", label: "Inquiries", icon: MessageSquare },
  { href: "/settings/webhooks", label: "Webhooks", icon: Webhook },
];

const ALL_NAV_ITEMS = [...PRIMARY_NAV, ...SECONDARY_NAV];

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayoutInner>{children}</AppLayoutInner>
    </ProtectedRoute>
  );
}

function MobileBottomNav() {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* Bottom navigation bar - fixed at bottom on mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around px-2">
          {PRIMARY_NAV.map((item) => {
            const isActive = location.startsWith(item.href);
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
          
          {/* More menu for secondary items */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                className={`flex flex-col items-center justify-center gap-0.5 px-4 min-h-[56px] min-w-[72px] transition-colors ${
                  SECONDARY_NAV.some(item => location.startsWith(item.href))
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground"
                }`}
                data-testid="mobile-nav-more"
              >
                <MoreHorizontal className="h-6 w-6" />
                <span className="text-[11px] font-medium">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[50vh] rounded-t-xl">
              <SheetHeader className="pb-4">
                <SheetTitle>More Options</SheetTitle>
              </SheetHeader>
              <div className="space-y-1 pb-safe">
                {SECONDARY_NAV.map((item) => {
                  const isActive = location.startsWith(item.href);
                  return (
                    <Link key={item.href} href={item.href}>
                      <button
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors ${
                          isActive 
                            ? "bg-primary/10 text-primary" 
                            : "text-foreground hover-elevate"
                        }`}
                        data-testid={`mobile-more-${item.label.toLowerCase()}`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    </Link>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Spacer for bottom nav on mobile - accounts for safe area */}
      <div className="h-[72px] md:hidden" />
    </>
  );
}

function DesktopNav() {
  const [location] = useLocation();

  return (
    <nav className="hidden md:flex items-center gap-1 flex-1">
      {ALL_NAV_ITEMS.map((item) => {
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
  );
}

function MobileHeader() {
  const { user, organization, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 md:hidden">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="p-4 border-b">
              <SheetTitle className="text-left">CaseCurrent</SheetTitle>
            </SheetHeader>
            
            {/* User info */}
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{organization?.name}</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {ALL_NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href}>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover-elevate text-left"
                    data-testid={`mobile-menu-${item.label.toLowerCase()}`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </button>
                </Link>
              ))}
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t space-y-1">
              <button
                className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover-elevate text-left"
                data-testid="mobile-menu-settings"
              >
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover-elevate text-left text-destructive"
                data-testid="mobile-menu-logout"
              >
                <LogOut className="h-5 w-5" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
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
  );
}

function AppLayoutInner({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-2 px-4 md:container md:px-4">
          {/* Mobile menu button */}
          <MobileHeader />
          
          {/* Logo */}
          <Link href="/leads">
            <span className="font-bold text-lg tracking-tight cursor-pointer" data-testid="text-header-logo">
              CaseCurrent
            </span>
          </Link>

          {/* Desktop navigation */}
          <DesktopNav />

          {/* Spacer on mobile */}
          <div className="flex-1 md:hidden" />

          {/* User menu */}
          <UserMenu />
        </div>
      </header>

      {/* Main content with bottom padding for mobile nav */}
      <main className="flex-1 px-4 py-4 md:py-6 md:container md:px-4 pb-24 md:pb-6">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
    </div>
  );
}
