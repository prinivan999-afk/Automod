import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";
import { useEffect, lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/home"));
const ZayavkiList = lazy(() => import("@/pages/zayavki"));
const ZayavkiDetail = lazy(() => import("@/pages/zayavki-detail"));
const Tarif = lazy(() => import("@/pages/tarif"));
const Analitika = lazy(() => import("@/pages/analitika"));
const Profil = lazy(() => import("@/pages/profil"));
const Raspisanie = lazy(() => import("@/pages/raspisanie"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error: unknown) => {
        const status = (error as any)?.response?.status ?? (error as any)?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
    },
  },
});

function Router() {
  return (
    <Layout>
      <Suspense fallback={<div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/zayavki" component={ZayavkiList} />
          <Route path="/zayavki/:id" component={ZayavkiDetail} />
          <Route path="/tarif" component={Tarif} />
          <Route path="/analitika" component={Analitika} />
          <Route path="/profil" component={Profil} />
          <Route path="/raspisanie" component={Raspisanie} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    // Force dark mode for this sleek CRM
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
