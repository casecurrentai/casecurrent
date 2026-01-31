import { Switch, Route, Redirect, useLocation, useRoute } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/app-layout";
import LoginPage from "@/pages/login";
import CasesPage from "@/pages/cases";
import CaseDetailPage from "@/pages/case-detail";
import ContactSubmissionsPage from "@/pages/admin/contact-submissions";
import AdminOrgsPage from "@/pages/admin/orgs";
import AdminOrgsNewPage from "@/pages/admin/orgs-new";
import AdminOrgDetailPage from "@/pages/admin/org-detail";
import SetupWizardPage from "@/pages/setup";
import InviteAcceptPage from "@/pages/invite";
import WebhooksPage from "@/pages/webhooks";
import ExperimentsPage from "@/pages/experiments";
import ExperimentDetailPage from "@/pages/experiment-detail";
import PolicyTestsPage from "@/pages/policy-tests";
import PIDashboardPage from "@/pages/pi-dashboard";
import DebugPage from "@/pages/debug";
import MenuPage from "@/pages/menu";
import NotFound from "@/pages/not-found";

import MarketingHomePage from "@/pages/marketing/home";
import HowItWorksPage from "@/pages/marketing/how-it-works";
import SecurityPage from "@/pages/marketing/security";
import SolutionsPage from "@/pages/marketing/solutions";
import PricingPage from "@/pages/marketing/pricing";
import ResourcesPage from "@/pages/marketing/resources";
import ContactPage from "@/pages/marketing/contact";
import DemoPage from "@/pages/marketing/demo";
import DesignAuditPage from "@/pages/marketing/design-audit";
import InstallPage from "@/pages/marketing/install";

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, organization } = useAuth();
  const [location, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (organization?.onboardingStatus !== "complete" && !location.startsWith("/setup") && !location.startsWith("/admin")) {
    return <Redirect to="/setup" />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isPlatformAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (!isPlatformAdmin) {
    return <Redirect to="/cases" />;
  }

  return <>{children}</>;
}

function AdminOrOwnerRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, organization } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  const isAdminOrOwner = user.role === "admin" || user.role === "owner";
  if (!isAdminOrOwner) {
    return <Redirect to="/cases" />;
  }

  if (organization?.onboardingStatus !== "complete") {
    return <Redirect to="/setup" />;
  }

  return <>{children}</>;
}

// Redirect wrapper that forwards dynamic params (Wouter <Redirect> doesn't support params)
function LeadDetailRedirect() {
  const [, params] = useRoute("/leads/:id");
  if (params?.id) {
    return <Redirect to={`/cases/${params.id}`} />;
  }
  return <Redirect to="/cases" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={MarketingHomePage} />
      <Route path="/how-it-works" component={HowItWorksPage} />
      <Route path="/security" component={SecurityPage} />
      <Route path="/solutions" component={SolutionsPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/resources" component={ResourcesPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/demo" component={DemoPage} />
      <Route path="/design-audit" component={DesignAuditPage} />
      <Route path="/install" component={InstallPage} />
      <Route path="/login">
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      </Route>
      <Route path="/invite/:token" component={InviteAcceptPage} />
      <Route path="/setup">
        <ProtectedRoute>
          <SetupWizardPage />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute>
          <AppLayout>
            <PIDashboardPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/analytics">
        <ProtectedRoute>
          <AppLayout>
            <PIDashboardPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/pi-dashboard">
        <ProtectedRoute>
          <AppLayout>
            <PIDashboardPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/cases">
        <ProtectedRoute>
          <AppLayout>
            <CasesPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/cases/:id">
        <ProtectedRoute>
          <AppLayout>
            <CaseDetailPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      {/* Legacy /leads redirects */}
      <Route path="/leads/:id" component={LeadDetailRedirect} />
      <Route path="/leads">
        <Redirect to="/cases" />
      </Route>
      <Route path="/menu">
        <ProtectedRoute>
          <AppLayout>
            <MenuPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/webhooks">
        <ProtectedRoute>
          <AppLayout>
            <WebhooksPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/experiments/:id">
        <ProtectedRoute>
          <AppLayout>
            <ExperimentDetailPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/experiments">
        <ProtectedRoute>
          <AppLayout>
            <ExperimentsPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/policy-tests">
        <ProtectedRoute>
          <AppLayout>
            <PolicyTestsPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/debug">
        <AdminOrOwnerRoute>
          <AppLayout>
            <DebugPage />
          </AppLayout>
        </AdminOrOwnerRoute>
      </Route>
      <Route path="/admin/contact-submissions">
        <ProtectedRoute>
          <AppLayout>
            <ContactSubmissionsPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/orgs/new">
        <AdminRoute>
          <AdminOrgsNewPage />
        </AdminRoute>
      </Route>
      <Route path="/admin/orgs/:id">
        <AdminRoute>
          <AdminOrgDetailPage />
        </AdminRoute>
      </Route>
      <Route path="/admin/orgs">
        <AdminRoute>
          <AdminOrgsPage />
        </AdminRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
