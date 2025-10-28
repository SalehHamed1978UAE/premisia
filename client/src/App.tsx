import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { ProgramProvider } from "./contexts/ProgramContext";
import { JobProvider } from "./contexts/JobContext";
import { DocumentInsightsProvider } from "./contexts/DocumentInsightsContext";
import { SessionContextPanel } from "@/components/SessionContext";
import { GlobalJobTracker } from "@/components/GlobalJobTracker";
import { DocumentInsightsFAB } from "@/components/DocumentInsightsFAB";
import { DocumentInsightsPanel } from "@/components/DocumentInsightsPanel";
import { useJobNotifications } from "@/hooks/useJobNotifications";
import HomePage from "@/pages/home-page";
import ProgramsPage from "@/pages/programs-page";
import StrategyTest from "@/pages/strategy-test";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import InputPage from "@/pages/strategic-consultant/InputPage";
import ClassificationPage from "@/pages/strategic-consultant/ClassificationPage";
import JourneySelectionPage from "@/pages/strategic-consultant/JourneySelectionPage";
import JourneyResultsPage from "@/pages/strategic-consultant/JourneyResultsPage";
import StrategyResultsPage from "@/pages/strategic-consultant/StrategyResultsPage";
import AnalysisPage from "@/pages/strategic-consultant/AnalysisPage";
import TrendAnalysisPage from "@/pages/strategic-consultant/TrendAnalysisPage";
import DecisionPage from "@/pages/strategic-consultant/DecisionPage";
import WhysTreePage from "@/pages/strategic-consultant/WhysTreePage";
import ResearchPage from "@/pages/strategic-consultant/ResearchPage";
import EPMPage from "@/pages/strategic-consultant/EPMPage";
import VersionsPage from "@/pages/strategic-consultant/VersionsPage";
import BMCTestPage from "@/pages/BMCTestPage";
import BMCResultsPage from "@/pages/BMCResultsPage";
import RepositoryBrowser from "@/pages/RepositoryBrowser";
import StatementDetailView from "@/pages/StatementDetailView";
import DecisionSummaryPage from "@/pages/strategy-workspace/DecisionSummaryPage";
import PrioritizationPage from "@/pages/strategy-workspace/PrioritizationPage";
import EPMProgramView from "@/pages/strategy-workspace/EPMProgramView";
import { ProgramsListPage } from "@/pages/strategy-workspace/ProgramsListPage";
import { JourneyHub } from "@/pages/journeys/JourneyHub";
import { ProtectedRoute } from "./lib/protected-route";
import { Loader2 } from "lucide-react";


function Router() {
  const { user } = useAuth();
  
  return (
    <>
      <Switch>
        <ProtectedRoute path="/" component={HomePage} />
        <ProtectedRoute path="/programs" component={ProgramsPage} />
        <ProtectedRoute path="/strategy/test" component={StrategyTest} />
        <ProtectedRoute path="/bmc/test" component={BMCTestPage} />
        <ProtectedRoute path="/bmc/results/:sessionId/:versionNumber" component={BMCResultsPage} />
        <ProtectedRoute path="/strategic-consultant" component={InputPage} />
        <ProtectedRoute path="/strategic-consultant/input" component={InputPage} />
        <ProtectedRoute path="/strategic-consultant/classification/:understandingId" component={ClassificationPage} />
        <ProtectedRoute path="/strategic-consultant/journey-selection/:understandingId" component={JourneySelectionPage} />
        <ProtectedRoute path="/strategic-consultant/journey-results/:sessionId" component={JourneyResultsPage} />
        <ProtectedRoute path="/strategic-consultant/results/:sessionId/:versionNumber" component={StrategyResultsPage} />
        <ProtectedRoute path="/strategic-consultant/analysis/:sessionId" component={AnalysisPage} />
        <ProtectedRoute path="/strategic-consultant/trend-analysis/:sessionId/:versionNumber" component={TrendAnalysisPage} />
        <ProtectedRoute path="/strategic-consultant/decisions/:sessionId/:versionNumber" component={DecisionPage} />
        <ProtectedRoute path="/strategic-consultant/whys-tree/:understandingId" component={WhysTreePage} />
        <ProtectedRoute path="/strategic-consultant/research/:sessionId" component={ResearchPage} />
        <ProtectedRoute path="/strategic-consultant/epm/:sessionId/:versionNumber" component={EPMPage} />
        <ProtectedRoute path="/strategic-consultant/versions/:sessionId" component={VersionsPage} />
        <ProtectedRoute path="/strategy-workspace/programs" component={ProgramsListPage} />
        <ProtectedRoute path="/strategy-workspace/decisions/:sessionId/:versionNumber" component={DecisionSummaryPage} />
        <ProtectedRoute path="/strategy-workspace/prioritization/:sessionId/:versionNumber" component={PrioritizationPage} />
        <ProtectedRoute path="/strategy-workspace/epm/:id" component={EPMProgramView} />
        <ProtectedRoute path="/journeys" component={JourneyHub} />
        <ProtectedRoute path="/repository" component={RepositoryBrowser} />
        <ProtectedRoute path="/repository/:understandingId" component={StatementDetailView} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
      {user && <SessionContextPanel />}
    </>
  );
}

function AppContent() {
  const { user } = useAuth();
  
  // Only wrap with ProgramProvider and JobProvider when user is authenticated
  // This prevents unnecessary API calls on the public landing page
  return user ? (
    <JobProvider>
      <ProgramProvider>
        <DocumentInsightsProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <GlobalJobTracker />
            <DocumentInsightsFAB />
            <DocumentInsightsPanel />
          </TooltipProvider>
        </DocumentInsightsProvider>
      </ProgramProvider>
    </JobProvider>
  ) : (
    <TooltipProvider>
      <Toaster />
      <Router />
    </TooltipProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
