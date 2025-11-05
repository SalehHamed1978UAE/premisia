import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useProgram } from "@/contexts/ProgramContext";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { useLocation } from "wouter";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useKnowledgeInsights } from "@/hooks/useKnowledgeInsights";
import { KnowledgeInsightsCard } from "@/components/knowledge/KnowledgeInsightsCard";
import { 
  Calendar, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Users,
  Target,
  Activity,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Lightbulb
} from "lucide-react";

interface DashboardSummary {
  tasks: {
    total: number;
    completed: number;
    active: number;
    completionRate: number;
  };
  budget: {
    total: number;
    spent: number;
    remaining: number;
    utilizationRate: number;
  };
  risks: {
    total: number;
    active: number;
    high: number;
  };
  kpis: number;
  benefits: number;
}

export function Dashboard() {
  const { selectedProgramId, isLoading: programsLoading } = useProgram();
  const [, setLocation] = useLocation();
  const { knowledgeGraph: knowledgeGraphEnabled } = useFeatureFlags();
  
  const { data: summary, isLoading, error } = useQuery<DashboardSummary>({
    queryKey: ['/api/dashboard/summary', selectedProgramId],
    queryFn: async () => {
      if (!selectedProgramId) return null;
      const res = await fetch(`/api/dashboard/summary?programId=${selectedProgramId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch dashboard summary');
      return res.json();
    },
    enabled: !!selectedProgramId,
  });

  // Fetch latest BMI session for Knowledge Graph insights
  const { data: latestSession } = useQuery<{ sessionId: string | null }>({
    queryKey: ['/api/strategies/latest-bmi-session'],
    queryFn: async () => {
      const res = await fetch('/api/strategies/latest-bmi-session', {
        credentials: 'include',
      });
      if (!res.ok) return { sessionId: null };
      return res.json();
    },
    enabled: knowledgeGraphEnabled,
  });

  // Fetch Knowledge Graph insights for the latest BMI session
  const {
    data: insightsData,
    isLoading: insightsLoading,
    error: insightsError
  } = useKnowledgeInsights(latestSession?.sessionId || null, {
    enabled: knowledgeGraphEnabled && !!latestSession?.sessionId,
  });

  if (programsLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load dashboard data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  if (!summary) {
    return (
      <>
        <WelcomeModal />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-2xl w-full shadow-lg" data-testid="card-empty-state">
            <CardContent className="pt-8 pb-8">
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                    <Sparkles className="h-10 w-10 text-white" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">
                    Welcome to Premisia!
                  </h2>
                  <p className="text-muted-foreground text-lg">
                    Think it through—turn strategic questions into execution-ready programs
                  </p>
                </div>

                <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-6 space-y-4 text-left">
                  <div className="flex items-start space-x-3">
                    <Lightbulb className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground mb-1">
                        Start with Strategic Consultant
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Share your business idea, upload strategy documents, or describe a challenge. Our AI will analyze it, guide you through root cause analysis, and help you build a complete program structure.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <TrendingUp className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground mb-1">
                        AI-Powered Analysis
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Get strategic decisions backed by market research, competitive analysis, and evidence-based insights from Claude Sonnet 4.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Target className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground mb-1">
                        Auto-Generate Programs
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Convert your finalized strategy into workstreams, tasks, KPIs, risks, benefits, and resource plans automatically.
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  size="lg"
                  onClick={() => setLocation("/strategic-consultant/input")}
                  className="bg-gradient-to-r from-primary to-primary/80 shadow-lg text-lg px-8 py-6 h-auto"
                  data-testid="button-get-started"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Get Started with Strategic Consultant
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                <p className="text-xs text-muted-foreground">
                  Look for the <span className="font-semibold text-primary">Strategic Consultant</span> button at the top of the sidebar
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Knowledge Graph Insights - Show at top when available */}
      {knowledgeGraphEnabled && latestSession?.sessionId && (
        <KnowledgeInsightsCard
          insights={insightsData ? {
            similarStrategies: insightsData.similarStrategies || [],
            incentives: insightsData.incentives || [],
            evidence: insightsData.evidence || [],
          } : undefined}
          loading={insightsLoading}
          error={insightsError}
          hasConsent={insightsData?.hasConsent}
          dataClassification={insightsData?.dataClassification}
        />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-schedule-adherence">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Schedule Adherence</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.tasks.completionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {summary.tasks.completed} of {summary.tasks.total} tasks completed
            </p>
            <Progress 
              value={summary.tasks.completionRate} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card data-testid="card-budget-utilization">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget Utilization</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.budget.spent)}</div>
            <p className="text-xs text-muted-foreground">
              of {formatCurrency(summary.budget.total)} allocated
            </p>
            <Progress 
              value={summary.budget.utilizationRate} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card data-testid="card-active-risks">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Risks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.risks.active}</div>
            <p className="text-xs text-muted-foreground">
              {summary.risks.high} high priority
            </p>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant={summary.risks.high > 5 ? "destructive" : summary.risks.high > 2 ? "secondary" : "default"}>
                {summary.risks.high > 5 ? "High Alert" : summary.risks.high > 2 ? "Monitor" : "Good"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-task-completion">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Progress</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.tasks.active}</div>
            <p className="text-xs text-muted-foreground">
              tasks in progress
            </p>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant="outline">
                {summary.tasks.active > 10 ? "High Activity" : "Manageable"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage Gates & Timeline Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Stage Gates Progress</span>
            </CardTitle>
            <CardDescription>Program milestone checkpoints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground">G0 - Ideation</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
              <Badge variant="default" className="bg-green-100 text-green-800">Passed</Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground">G1 - Concept</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
              <Badge variant="default" className="bg-green-100 text-green-800">Passed</Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-bold">2</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">G2 - Feasibility</p>
                  <p className="text-sm text-muted-foreground">In Review</p>
                </div>
              </div>
              <Badge variant="secondary">In Progress</Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-500 font-bold">3</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">G3 - Development</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
              <Badge variant="outline">Pending</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Program Health</span>
            </CardTitle>
            <CardDescription>Overall program metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Schedule Health</span>
                <span className="text-sm font-bold text-green-600">87%</span>
              </div>
              <Progress value={87} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">On track with milestones</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Budget Health</span>
                <span className="text-sm font-bold text-blue-600">72%</span>
              </div>
              <Progress value={72} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">Within allocated budget</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Risk Score</span>
                <span className="text-sm font-bold text-yellow-600">65%</span>
              </div>
              <Progress value={65} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">Moderate risk level</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Resource Utilization</span>
                <span className="text-sm font-bold text-green-600">82%</span>
              </div>
              <Progress value={82} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">Optimal resource allocation</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest program updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
              <div className="flex-1">
                <p className="text-sm text-foreground">
                  <span className="font-medium">Task completed:</span> Database Schema Design
                </p>
                <p className="text-xs text-muted-foreground">2 hours ago</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2"></div>
              <div className="flex-1">
                <p className="text-sm text-foreground">
                  <span className="font-medium">Risk identified:</span> Resource availability constraint
                </p>
                <p className="text-xs text-muted-foreground">5 hours ago</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
              <div className="flex-1">
                <p className="text-sm text-foreground">
                  <span className="font-medium">KPI updated:</span> Budget utilization increased to 72%
                </p>
                <p className="text-xs text-muted-foreground">1 day ago</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
              <div className="flex-1">
                <p className="text-sm text-foreground">
                  <span className="font-medium">Stage Gate G2</span> review scheduled
                </p>
                <p className="text-xs text-muted-foreground">2 days ago</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>Key program indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-lg bg-blue-50">
                <div className="text-2xl font-bold text-blue-600">{summary.kpis}</div>
                <div className="text-sm text-blue-600">KPIs Tracked</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50">
                <div className="text-2xl font-bold text-green-600">{summary.benefits}</div>
                <div className="text-sm text-green-600">Benefits Identified</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-50">
                <div className="text-2xl font-bold text-yellow-600">{formatCurrency(summary.budget.remaining)}</div>
                <div className="text-sm text-yellow-600">Budget Remaining</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-purple-50">
                <div className="text-2xl font-bold text-purple-600">4</div>
                <div className="text-sm text-purple-600">Workstreams</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
