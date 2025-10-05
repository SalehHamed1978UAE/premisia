import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import { ProgramProvider } from "./contexts/ProgramContext";
import { SessionContextPanel } from "@/components/SessionContext";
import HomePage from "@/pages/home-page";
import ProgramsPage from "@/pages/programs-page";
import StrategyTest from "@/pages/strategy-test";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <>
      <Switch>
        <ProtectedRoute path="/" component={HomePage} />
        <ProtectedRoute path="/programs" component={ProgramsPage} />
        <ProtectedRoute path="/strategy/test" component={StrategyTest} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
      <SessionContextPanel />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProgramProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ProgramProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
