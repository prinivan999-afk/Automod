import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTelegramWebApp } from "@/hooks/use-telegram";
import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";

// Pages
import HomePage from "@/pages/home";
import ConnectionsPage from "@/pages/connections";
import SettingsPage from "@/pages/settings";
import ActivityPage from "@/pages/activity";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/connections" component={ConnectionsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/activity" component={ActivityPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  const { isReady } = useTelegramWebApp();

  if (!isReady) {
    return null; // Or a loading spinner
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <RequireAuth>
            <Router />
          </RequireAuth>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
