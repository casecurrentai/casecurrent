import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/app-layout";
import LoginPage from "@/pages/login";
import LeadsPage from "@/pages/leads";
import LeadDetailPage from "@/pages/lead-detail";
import ContactSubmissionsPage from "@/pages/admin/contact-submissions";
import NotFound from "@/pages/not-found";

import MarketingHomePage from "@/pages/marketing/home";
import HowItWorksPage from "@/pages/marketing/how-it-works";
import SecurityPage from "@/pages/marketing/security";
import SolutionsPage from "@/pages/marketing/solutions";
import PricingPage from "@/pages/marketing/pricing";
import ResourcesPage from "@/pages/marketing/resources";
import ContactPage from "@/pages/marketing/contact";
import DemoPage from "@/pages/marketing/demo";

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
      <Route path="/login">
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      </Route>
      <Route path="/dashboard">
        <AppLayout>
          <Redirect to="/leads" />
        </AppLayout>
      </Route>
      <Route path="/leads">
        <AppLayout>
          <LeadsPage />
        </AppLayout>
      </Route>
      <Route path="/leads/:id">
        <AppLayout>
          <LeadDetailPage />
        </AppLayout>
      </Route>
      <Route path="/admin/contact-submissions">
        <AppLayout>
          <ContactSubmissionsPage />
        </AppLayout>
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
