import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Archive, FileText, ArrowRight, CheckCircle, Menu, TrendingUp, Target, Calendar, ShieldCheck, Zap } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { SiGoogle } from "react-icons/si";
import logoLight from "@assets/Untitled (3600 x 1000 px)_1762102046406.png";
import logoDark from "@assets/Untitled (3600 x 1000 px)-modified_1762102046405.png";
import logoFullLight from "@assets/Untitled (3600 x 1000 px)_1762102046406.png";
import logoFullDark from "@assets/Untitled (3600 x 1000 px)-modified_1762102046405.png";

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
    title: "Strategies Hub",
    icon: Target,
    description: "Unified view of all strategic initiatives with full provenance",
    features: [
      "AI-generated titles for easy navigation and recognition",
      "Journey timeline showing framework progression and versioning",
      "Research library with confidence scores and component mapping",
      "Context inheritance - start new journeys from existing strategies",
      "Full artifact hierarchy: journeys, analyses, decisions, EPM programs"
    ],
    color: "from-indigo-500 to-indigo-600",
    path: "/strategies"
  },
  {
    id: 3,
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
    id: 4,
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
          <div className="flex flex-col items-center mb-8">
            <img 
              src={logoFullLight} 
              alt="Premisia - Think it through" 
              className="w-full h-auto dark:hidden mb-6"
            />
            <img 
              src={logoFullDark} 
              alt="Premisia - Think it through" 
              className="w-full h-auto hidden dark:block mb-6"
            />
            <span className="px-3 py-1 text-sm font-semibold bg-primary/10 text-primary rounded-lg">BETA</span>
          </div>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Premisia structures complex choices so leaders can align, commit, and move. <span className="font-semibold text-foreground">66% of EMEA leaders already see significant AI productivity gains</span>—it's time to turn that into strategic advantage.
          </p>
        </div>

        {/* Step Indicators - Display only, not clickable */}
        <div className="flex justify-center mb-8 px-4">
          <div className="flex flex-row items-center gap-0">
            {ONBOARDING_STEPS.map((step, index) => (
              <>
                <div
                  key={step.id}
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
                </div>
                {index < ONBOARDING_STEPS.length - 1 && (
                  <div 
                    key={`connector-${index}`}
                    className={cn(
                      "w-12 sm:w-16 h-1 mx-2 transition-all",
                      index < currentStep ? "bg-primary" : "bg-muted"
                    )} 
                  />
                )}
              </>
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
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
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
        <CardContent className="grid gap-4 grid-cols-1 md:grid-cols-3">
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

function PublicLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img 
              src={logoLight} 
              alt="Premisia" 
              className="h-8 w-auto dark:hidden"
            />
            <img 
              src={logoDark} 
              alt="Premisia" 
              className="h-8 w-auto hidden dark:block"
            />
            <span className="px-2 py-1 text-xs font-semibold bg-primary/10 text-primary rounded">BETA</span>
          </div>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-header-signin"
          >
            Sign In
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-8">
        {/* Hero Section */}
        <div className="text-center mb-12 md:mb-16">
          <div className="mb-6">
            <img 
              src={logoFullLight} 
              alt="Premisia - Think it through" 
              className="w-full h-auto mx-auto dark:hidden"
            />
            <img 
              src={logoFullDark} 
              alt="Premisia - Think it through" 
              className="w-full h-auto mx-auto hidden dark:block"
            />
          </div>
          <p className="text-xl md:text-2xl text-foreground font-medium mb-6 max-w-4xl mx-auto">
            Premisia structures complex choices so leaders can align, commit, and move—fast
          </p>
          <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
            Multi-agent AI that turns leadership intent into EPM-grade roadmaps, budgets, and OKRs—with live evidence, governance, and change tracking.
          </p>

          {/* Leaders' Reality — By the Numbers */}
          <div className="flex flex-wrap justify-center gap-6 md:gap-12 mt-12 text-sm">
            <div className="text-center max-w-xs">
              <div className="text-3xl md:text-4xl font-bold text-primary">Only 21%</div>
              <div className="text-muted-foreground mt-1">of executive strategies pass<br />McKinsey's quality tests</div>
              <div className="text-xs text-muted-foreground/70 mt-2">McKinsey & Company</div>
            </div>
            <div className="text-center max-w-xs">
              <div className="text-3xl md:text-4xl font-bold text-primary">~40% / +18%</div>
              <div className="text-muted-foreground mt-1">less time, higher quality<br />on complex strategic tasks</div>
              <div className="text-xs text-muted-foreground/70 mt-2">science.org</div>
            </div>
            <div className="text-center max-w-xs">
              <div className="text-3xl md:text-4xl font-bold text-primary">Only 25%</div>
              <div className="text-muted-foreground mt-1">of AI initiatives deliver ROI—<br />need governed, outcome-tied use</div>
              <div className="text-xs text-muted-foreground/70 mt-2">IBM Newsroom</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-8 italic max-w-2xl mx-auto">
            "The greatest danger in times of turbulence is to act with yesterday's logic."
            <span className="block mt-1 not-italic opacity-70">— Peter F. Drucker, druckerforum.org</span>
          </p>
        </div>

        {/* Value Pillars */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Speed with substance</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                Compress weeks of slide-making and stakeholder wrangling into hours—with on-call agents for scenarios, risks, budgets, and benefits. Field studies show sizeable productivity lifts for knowledge work when AI assists complex tasks.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Evidence you can audit</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                Every recommendation carries sources, bias-checks, and assumptions so boards and auditors can trace decisions end-to-end. Your strategic IP backed by research provenance and knowledge graphs.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Execution-ready, not just ideas</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                Output is EPM-structured (charter, milestones, costs, KPIs, RAID, RACI) with AI-powered scheduling, critical path analysis, and resource conflict detection. Board-ready programs that sync with your delivery stack.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Continuous refinement</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                Strategies evolve as data changes—living programs that learn from outcomes. Add new context, run additional frameworks, or refine existing analyses. Your strategic intelligence compounds over time.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How it works */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-foreground">How it works</h2>
          <div className="flex flex-col md:grid md:grid-cols-3 gap-8 md:gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Ingest & orient</h3>
              <p className="text-muted-foreground">
                Securely connect policies, financials, KPIs, and prior initiatives. Premisia builds a knowledge graph of your enterprise context.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Think it through</h3>
              <p className="text-muted-foreground">
                Advisory agents co-draft scenarios, explore trade-offs, and validate OKRs. Run risk and compliance checks in-line with traceable citations.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">Commit & ship</h3>
              <p className="text-muted-foreground">
                Export to your PM suite with charter, plan, costs, KPIs, owners, and tracking—with full sources and assumptions. Keep iterating as conditions change.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="max-w-md mx-auto border-2">
            <CardContent className="p-6 md:p-8">
              <h3 className="text-xl md:text-2xl font-bold mb-4">Turn debate into direction</h3>
              <p className="text-muted-foreground mb-6">
                Sign in to start structuring your strategic choices with traceable evidence and execution-ready outputs
              </p>
              <Button 
                onClick={() => window.location.href = '/api/login'}
                size="lg"
                className="w-full"
                data-testid="button-landing-login"
              >
                <SiGoogle className="mr-2 h-5 w-5" />
                Sign in with Replit
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Secure OAuth 2.0 / OIDC authentication • AES-256 encryption
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useQuery<DashboardSummary>({
    queryKey: ['/api/dashboard-summary'],
    enabled: !!user, // Only fetch when user is authenticated
  });

  // Show public landing page if not authenticated
  if (!user && !isLoading) {
    return <PublicLandingPage />;
  }

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
      
      {(isLoading || summaryLoading) ? (
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
