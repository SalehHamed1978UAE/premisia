import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Archive, FileText, ArrowRight, CheckCircle, Menu, TrendingUp, Target, Calendar } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface DashboardSummary {
  counts: {
    analyses: number;
    strategies: number;
    programs: number;
  };
  recentArtifacts: Array<{
    id: string;
    type: 'analysis' | 'strategy' | 'program';
    title: string;
    createdAt: string;
    link: string;
  }>;
}

const ONBOARDING_STEPS = [
  {
    id: 1,
    title: "Strategic Consultant",
    icon: Sparkles,
    description: "AI-powered strategic analysis with evidence-based insights",
    features: [
      "Multi-agent AI system tests assumptions and frames problems",
      "Real-time web research with source validation and anti-bias checks",
      "Battle-tested frameworks: Five Whys, BMC, PESTLE, Porter's Forces",
      "AI coaching validates your thinking against quality criteria",
      "Upload documents (PDF, Word, Excel, images) for context enrichment"
    ],
    color: "from-blue-500 to-blue-600",
    path: "/strategic-consultant/input"
  },
  {
    id: 2,
    title: "Analysis Repository",
    icon: Archive,
    description: "Access your strategic intelligence knowledge base",
    features: [
      "All completed analyses with framework-specific insights",
      "Knowledge graph tracks entities, relationships, and contradictions",
      "Export professional reports in multiple formats (PDF, Word, Markdown)",
      "Compare strategy versions and track how decisions evolved",
      "Encrypted storage protects your strategic IP"
    ],
    color: "from-purple-500 to-purple-600",
    path: "/repository"
  },
  {
    id: 3,
    title: "EPM Programs",
    icon: FileText,
    description: "Complete execution blueprints ready to launch",
    features: [
      "14-component programs: workstreams, timelines, resources, financials",
      "AI-powered scheduling with critical path and dependency management",
      "Risk registers, KPIs, governance, and benefits realization",
      "Interactive Gantt charts with resource conflict detection",
      "Board-ready outputs in one session vs. weeks of consulting work"
    ],
    color: "from-green-500 to-green-600",
    path: "/strategy-workspace/programs"
  }
];

function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(0);
  const [, setLocation] = useLocation();

  const handleGetStarted = () => {
    setLocation('/strategic-consultant/input');
  };

  const currentStepData = ONBOARDING_STEPS[currentStep];
  const Icon = currentStepData.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary to-primary/80 rounded-2xl mb-6 shadow-lg">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              Welcome to QGentic
            </h1>
            <span className="px-3 py-1 text-sm font-semibold bg-primary/10 text-primary rounded-lg">BETA</span>
          </div>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            AI-enhanced strategic intelligence platform that transforms your ideas into complete, execution-ready EPM programs. <span className="font-semibold text-foreground">15-30 minutes first time, 10-20 when familiar</span>—vs. weeks of traditional consulting.
          </p>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {ONBOARDING_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => setCurrentStep(index)}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all",
                    index === currentStep
                      ? "bg-primary text-primary-foreground shadow-lg scale-110"
                      : index < currentStep
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                  data-testid={`step-indicator-${index}`}
                >
                  {index < currentStep ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    step.id
                  )}
                </button>
                {index < ONBOARDING_STEPS.length - 1 && (
                  <div className={cn(
                    "w-16 h-1 mx-2 transition-all",
                    index < currentStep ? "bg-primary" : "bg-muted"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Current Step Content */}
        <Card className="max-w-4xl mx-auto shadow-xl">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Icon & Title */}
              <div className="flex-shrink-0">
                <div className={cn(
                  "w-24 h-24 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg",
                  currentStepData.color
                )}>
                  <Icon className="h-12 w-12 text-white" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Step {currentStep + 1} of {ONBOARDING_STEPS.length}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                  {currentStepData.title}
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  {currentStepData.description}
                </p>

                {/* Features List */}
                <div className="space-y-3 mb-8">
                  {currentStepData.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-foreground">{feature}</p>
                    </div>
                  ))}
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center gap-4">
                  {currentStep > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(currentStep - 1)}
                      data-testid="button-previous"
                    >
                      Previous
                    </Button>
                  )}
                  
                  {currentStep < ONBOARDING_STEPS.length - 1 ? (
                    <Button
                      onClick={() => setCurrentStep(currentStep + 1)}
                      className="ml-auto"
                      data-testid="button-next"
                    >
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleGetStarted}
                      className="ml-auto bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
                      size="lg"
                      data-testid="button-get-started"
                    >
                      <Sparkles className="mr-2 h-5 w-5" />
                      Start Your First Analysis
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Access Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto">
          {ONBOARDING_STEPS.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <Card
                key={step.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-lg",
                  index === currentStep && "ring-2 ring-primary"
                )}
                onClick={() => setCurrentStep(index)}
                data-testid={`quick-access-${index}`}
              >
                <CardContent className="p-6">
                  <div className={cn(
                    "w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center mb-4",
                    step.color
                  )}>
                    <StepIcon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ summary }: { summary: DashboardSummary }) {
  const [, setLocation] = useLocation();

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your strategic work</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analyses Complete</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.counts.analyses}</div>
            <p className="text-xs text-muted-foreground">
              Strategic analyses completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Strategies Complete</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.counts.strategies}</div>
            <p className="text-xs text-muted-foreground">
              Finalized strategy decisions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programs Complete</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.counts.programs}</div>
            <p className="text-xs text-muted-foreground">
              EPM programs generated
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Artifacts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <p className="text-sm text-muted-foreground">Your last 5 artifacts</p>
        </CardHeader>
        <CardContent>
          {summary.recentArtifacts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No artifacts yet. Start by creating your first strategic analysis!
            </p>
          ) : (
            <div className="space-y-3">
              {summary.recentArtifacts.map((artifact) => (
                <Link key={artifact.id} href={artifact.link}>
                  <div
                    className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-lg border border-border hover:bg-accent transition-colors cursor-pointer"
                    data-testid={`artifact-${artifact.id}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                        artifact.type === 'analysis' && "bg-blue-100 dark:bg-blue-900/30",
                        artifact.type === 'program' && "bg-green-100 dark:bg-green-900/30"
                      )}>
                        {artifact.type === 'analysis' ? (
                          <Archive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground truncate">{artifact.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {artifact.type === 'analysis' ? 'Strategic Analysis' : 'EPM Program'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0 pl-14 sm:pl-0">
                      <Calendar className="h-4 w-4" />
                      <span className="whitespace-nowrap">{format(new Date(artifact.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Button
            className="justify-start h-auto p-4"
            variant="outline"
            onClick={() => setLocation('/strategic-consultant/input')}
            data-testid="quick-action-analysis"
          >
            <Sparkles className="mr-3 h-5 w-5" />
            <div className="text-left">
              <div className="font-semibold">New Analysis</div>
              <div className="text-xs opacity-70">Start strategic analysis</div>
            </div>
          </Button>

          <Button
            className="justify-start h-auto p-4"
            variant="outline"
            onClick={() => setLocation('/repository')}
            data-testid="quick-action-repository"
          >
            <Archive className="mr-3 h-5 w-5" />
            <div className="text-left">
              <div className="font-semibold">View Repository</div>
              <div className="text-xs opacity-70">Browse analyses</div>
            </div>
          </Button>

          <Button
            className="justify-start h-auto p-4"
            variant="outline"
            onClick={() => setLocation('/strategy-workspace/programs')}
            data-testid="quick-action-programs"
          >
            <FileText className="mr-3 h-5 w-5" />
            <div className="text-left">
              <div className="font-semibold">EPM Programs</div>
              <div className="text-xs opacity-70">View programs</div>
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: summary, isLoading } = useQuery<DashboardSummary>({
    queryKey: ['/api/dashboard-summary'],
  });

  const hasWork = summary && (
    summary.counts.analyses > 0 || 
    summary.counts.strategies > 0 || 
    summary.counts.programs > 0
  );

  return (
    <AppLayout 
      showTopBar={hasWork ? true : false}
      title="Home"
      subtitle={hasWork ? "Dashboard" : undefined}
      sidebarOpen={sidebarOpen} 
      onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
    >
      {/* Mobile Menu Button - Only show for onboarding view */}
      {!hasWork && (
        <div className="lg:hidden fixed top-4 left-4 z-10">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="bg-card shadow-lg"
            data-testid="button-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      )}
      
      {isLoading ? (
        <div className="p-6 space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      ) : hasWork ? (
        <Dashboard summary={summary!} />
      ) : (
        <OnboardingFlow />
      )}
    </AppLayout>
  );
}
