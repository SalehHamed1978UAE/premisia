import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Archive, FileText, ArrowRight, CheckCircle, Menu, TrendingUp, Target, Calendar, ShieldCheck, Zap, Rocket, Building2, Users, Brain, Lock, DollarSign, BarChart, PlayCircle, Star, Check } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { SiGoogle } from "react-icons/si";
import { GeometricLoader } from "@/components/loaders/GeometricLoader";
import logoLight from "@assets/Untitled (3600 x 1000 px)_1762102046406.png";
import logoDark from "@assets/Untitled (3600 x 1000 px)-modified_1762102046405.png";
import logoFullLight from "@assets/Untitled (3600 x 1000 px)_1762102046406.png";
import logoFullDark from "@assets/Untitled (3600 x 1000 px)-modified_1762102046405.png";

const EXECUTIVE_QUOTES = [
  {
    text: "The greatest danger in times of turbulence is to act with yesterday's logic.",
    author: "Peter F. Drucker",
    source: "druckerforum.org"
  },
  {
    text: "Speed is often a strategy in and of itself… those who learn faster will also win.",
    author: "Alex Singla, Senior Partner, McKinsey",
    source: "McKinsey & Company"
  },
  {
    text: "A strategic inflection point is a time… when fundamentals are about to change.",
    author: "Andrew S. Grove",
    source: "Only the Paranoid Survive"
  },
  {
    text: "Speed matters in today's volatile environment; leaders who streamline decisions and empower the frontline have a clear edge.",
    author: "McKinsey",
    source: "McKinsey & Company"
  },
  {
    text: "CEOs are balancing short-term ROI and long-term innovation when adopting AI… those who keep innovating in uncertainty will emerge stronger.",
    author: "IBM Institute for Business Value",
    source: "IBM Newsroom"
  },
  {
    text: "Given constant change, leaders must continue to evolve… find traction in the tensions.",
    author: "Deloitte",
    source: "Global Human Capital Trends"
  },
  {
    text: "The pace of change has never been this fast, yet it will never be this slow again.",
    author: "Justin Trudeau",
    source: "World Economic Forum"
  }
];

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

function RotatingQuote() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % EXECUTIVE_QUOTES.length);
        setFade(true);
      }, 500);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const quote = EXECUTIVE_QUOTES[currentIndex];

  return (
    <p 
      className={cn(
        "text-xs text-muted-foreground text-center mt-8 italic max-w-2xl mx-auto transition-opacity duration-500",
        fade ? "opacity-100" : "opacity-0"
      )}
    >
      "{quote.text}"
      <span className="block mt-1 not-italic opacity-70">— {quote.author}, {quote.source}</span>
    </p>
  );
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
          <div className="flex flex-col sm:flex-row items-center gap-0">
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
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isTryItFreeLoading, setIsTryItFreeLoading] = useState(false);
  const [isLearnMoreLoading, setIsLearnMoreLoading] = useState(false);

  const handleSignIn = () => {
    setIsSigningIn(true);
    window.location.href = '/api/login';
  };

  const handleTryItFree = () => {
    setIsTryItFreeLoading(true);
    window.location.href = '/api/login';
  };

  const handleLearnMore = () => {
    setIsLearnMoreLoading(true);
    const featuresSection = document.querySelector('#features');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => setIsLearnMoreLoading(false), 1000);
    } else {
      setIsLearnMoreLoading(false);
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.querySelector(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .animated-bg {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: -1;
          background: #0f1419;
          overflow: hidden;
        }

        .gradient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.3;
          animation: float 20s infinite ease-in-out;
        }

        .orb1 {
          width: 600px;
          height: 600px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          top: -200px;
          right: -200px;
        }

        .orb2 {
          width: 500px;
          height: 500px;
          background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%);
          bottom: -150px;
          left: -150px;
          animation-delay: 5s;
        }

        .orb3 {
          width: 400px;
          height: 400px;
          background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
          top: 50%;
          left: 50%;
          animation-delay: 10s;
        }

        .hero-title {
          animation: fadeInUp 0.8s ease;
        }

        .hero-subtitle {
          animation: fadeInUp 0.8s ease 0.2s both;
        }

        .hero-headline {
          animation: fadeInUp 0.8s ease 0.4s both;
        }

        .hero-description {
          animation: fadeInUp 0.8s ease 0.6s both;
        }

        .hero-buttons {
          animation: fadeInUp 0.8s ease 0.8s both;
        }

        .brain-core {
          animation: breathe 3s infinite ease-in-out;
        }

        .orbit {
          position: absolute;
          border: 2px solid rgba(59, 130, 246, 0.3);
          border-radius: 50%;
          animation: rotate 20s linear infinite;
        }

        .orbit1 { 
          width: 300px; 
          height: 300px; 
          animation-duration: 15s; 
        }

        .orbit2 { 
          width: 400px; 
          height: 400px; 
          animation-duration: 20s; 
          animation-direction: reverse; 
        }

        .orbit3 { 
          width: 500px; 
          height: 500px; 
          animation-duration: 25s; 
        }

        .orbit-dot {
          position: absolute;
          width: 10px;
          height: 10px;
          background: #10b981;
          border-radius: 50%;
          top: -5px;
          left: 50%;
          transform: translateX(-50%);
          box-shadow: 0 0 20px #10b981;
        }

        .stat-card:hover {
          transform: translateY(-10px);
        }

        .feature-card:hover {
          transform: translateY(-5px);
        }
      `}</style>

      {/* Animated Background */}
      <div className="animated-bg">
        <div className="gradient-orb orb1"></div>
        <div className="gradient-orb orb2"></div>
        <div className="gradient-orb orb3"></div>
      </div>

      <div className="min-h-screen text-white overflow-x-hidden">
        {/* Navigation */}
        <nav 
          className="fixed top-0 w-full px-6 md:px-12 py-5 z-[1000] transition-all duration-300"
          style={{ 
            background: 'rgba(15, 20, 25, 0.9)', 
            backdropFilter: 'blur(10px)' 
          }}
          data-testid="navbar"
        >
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div 
              className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#3b82f6] to-[#10b981] bg-clip-text text-transparent"
              data-testid="logo"
            >
              PREMISIA
            </div>
            <div className="flex gap-6 md:gap-8 items-center">
              <button 
                onClick={() => scrollToSection('#features')} 
                className="hidden md:block text-gray-400 hover:text-white transition-colors border-none bg-transparent cursor-pointer"
                data-testid="link-features"
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection('#stats')} 
                className="hidden md:block text-gray-400 hover:text-white transition-colors border-none bg-transparent cursor-pointer"
                data-testid="link-stats"
              >
                Stats
              </button>
              <button
                onClick={handleSignIn}
                disabled={isSigningIn}
                className={cn(
                  "px-5 py-2.5 bg-gradient-to-r from-[#3b82f6] to-[#10b981] text-white rounded-lg font-semibold transition-all duration-300",
                  !isSigningIn && "hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(59,130,246,0.3)]",
                  isSigningIn && "opacity-90 cursor-not-allowed"
                )}
                data-testid="button-login"
              >
                {isSigningIn ? (
                  <span className="flex items-center gap-2">
                    <GeometricLoader type="dots" size="small" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  "Login"
                )}
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section 
          className="min-h-screen flex items-center px-6 md:px-12 pt-32 pb-20"
          data-testid="section-hero"
        >
          <div className="max-w-6xl mx-auto w-full">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Left Content */}
              <div>
                <h1 className="hero-title text-5xl md:text-7xl font-bold mb-5 bg-gradient-to-r from-[#3b82f6] to-[#10b981] bg-clip-text text-transparent" data-testid="text-hero-title">
                  PREMISIA
                </h1>
                <p className="hero-subtitle text-3xl md:text-4xl text-[#10b981] font-semibold mb-8" data-testid="text-hero-tagline">
                  Think it through
                </p>
                <h2 className="hero-headline text-3xl md:text-4xl font-bold mb-5 text-white" data-testid="text-hero-headline">
                  Turn Ideas into Strategic Plans
                </h2>
                <p className="hero-description text-lg text-gray-300 mb-10 leading-relaxed" data-testid="text-hero-description">
                  Stop staring at blank whiteboards. Premisia uses AI to help you structure messy ideas 
                  into clear strategic plans. From crazy idea to execution plan in hours.
                </p>
                <div className="hero-buttons flex flex-col sm:flex-row gap-5">
                  <button 
                    onClick={handleTryItFree}
                    disabled={isTryItFreeLoading}
                    className={cn(
                      "px-8 py-4 bg-gradient-to-r from-[#3b82f6] to-[#10b981] text-white rounded-xl text-lg font-semibold transition-all duration-300",
                      !isTryItFreeLoading && "hover:shadow-[0_10px_40px_rgba(59,130,246,0.4)]",
                      isTryItFreeLoading && "opacity-90 cursor-not-allowed"
                    )}
                    data-testid="button-cta-primary"
                  >
                    {isTryItFreeLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <GeometricLoader type="orbit" size="small" />
                        <span>Starting...</span>
                      </span>
                    ) : (
                      "🚀 Try It Free"
                    )}
                  </button>
                  <button 
                    onClick={handleLearnMore}
                    disabled={isLearnMoreLoading}
                    className={cn(
                      "px-8 py-4 bg-transparent border-2 border-[#3b82f6] text-white rounded-xl text-lg font-semibold transition-all duration-300",
                      !isLearnMoreLoading && "hover:bg-[#3b82f6] hover:text-white",
                      isLearnMoreLoading && "opacity-90 cursor-not-allowed"
                    )}
                    data-testid="button-cta-secondary"
                  >
                    {isLearnMoreLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <GeometricLoader type="dots" size="small" />
                        <span>Loading...</span>
                      </span>
                    ) : (
                      "👀 Learn More"
                    )}
                  </button>
                </div>
              </div>

              {/* Right Brain Animation */}
              <div className="hidden md:flex justify-center items-center" data-testid="animation-brain">
                <div className="relative w-full h-[500px] flex items-center justify-center">
                  {/* Orbits */}
                  <div className="orbit orbit1">
                    <div className="orbit-dot"></div>
                  </div>
                  <div className="orbit orbit2">
                    <div className="orbit-dot"></div>
                  </div>
                  <div className="orbit orbit3">
                    <div className="orbit-dot"></div>
                  </div>
                  
                  {/* Brain Core */}
                  <div 
                    className="brain-core w-[200px] h-[200px] bg-gradient-to-r from-[#3b82f6] to-[#10b981] rounded-full"
                    style={{ boxShadow: '0 0 100px rgba(59, 130, 246, 0.5)' }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section 
          id="stats"
          className="py-20 px-6 md:px-12 bg-[#1a1f2e]"
          data-testid="section-stats"
        >
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
              <div 
                className="stat-card text-center p-10 bg-[#202938] rounded-3xl transition-transform duration-300"
                data-testid="card-stat-frameworks"
              >
                <div className="text-5xl font-bold bg-gradient-to-r from-[#3b82f6] to-[#10b981] bg-clip-text text-transparent mb-3">
                  5
                </div>
                <div className="text-lg text-gray-400">Frameworks</div>
              </div>
              <div 
                className="stat-card text-center p-10 bg-[#202938] rounded-3xl transition-transform duration-300"
                data-testid="card-stat-analysis"
              >
                <div className="text-5xl font-bold bg-gradient-to-r from-[#3b82f6] to-[#10b981] bg-clip-text text-transparent mb-3">
                  100+
                </div>
                <div className="text-lg text-gray-400">Analysis Points</div>
              </div>
              <div 
                className="stat-card text-center p-10 bg-[#202938] rounded-3xl transition-transform duration-300"
                data-testid="card-stat-availability"
              >
                <div className="text-5xl font-bold bg-gradient-to-r from-[#3b82f6] to-[#10b981] bg-clip-text text-transparent mb-3">
                  24/7
                </div>
                <div className="text-lg text-gray-400">AI Available</div>
              </div>
              <div 
                className="stat-card text-center p-10 bg-[#202938] rounded-3xl transition-transform duration-300"
                data-testid="card-stat-start"
              >
                <div className="text-5xl font-bold bg-gradient-to-r from-[#3b82f6] to-[#10b981] bg-clip-text text-transparent mb-3">
                  1
                </div>
                <div className="text-lg text-gray-400">Click to Start</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section 
          id="features"
          className="py-24 px-6 md:px-12"
          data-testid="section-features"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-5 text-white" data-testid="heading-features">
                Not Your Average Strategy Tool
              </h2>
              <p className="text-lg text-gray-400" data-testid="subheading-features">
                Built because consultants are expensive and napkin sketches deserve better
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div 
                className="feature-card p-10 bg-[#202938] rounded-3xl transition-transform duration-300"
                data-testid="card-feature-ai"
              >
                <div className="text-5xl mb-5">🧠</div>
                <h3 className="text-2xl font-bold mb-4 text-white">Multi-Agent AI</h3>
                <p className="text-gray-400 leading-relaxed">
                  Three AI agents that challenge, build, and validate your strategy.
                </p>
              </div>
              <div 
                className="feature-card p-10 bg-[#202938] rounded-3xl transition-transform duration-300"
                data-testid="card-feature-whys"
              >
                <div className="text-5xl mb-5">🎯</div>
                <h3 className="text-2xl font-bold mb-4 text-white">Five Whys++</h3>
                <p className="text-gray-400 leading-relaxed">
                  Deep analysis that finds patterns and calls out what you're missing.
                </p>
              </div>
              <div 
                className="feature-card p-10 bg-[#202938] rounded-3xl transition-transform duration-300"
                data-testid="card-feature-canvas"
              >
                <div className="text-5xl mb-5">📊</div>
                <h3 className="text-2xl font-bold mb-4 text-white">Smart Canvas</h3>
                <p className="text-gray-400 leading-relaxed">
                  Business Model Canvas that thinks and spots gaps in your logic.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer 
          className="py-16 px-6 text-center border-t border-[#202938]"
          data-testid="footer"
        >
          <p className="text-gray-400">&copy; 2025 Premisia - Where Ideas Become Action</p>
        </footer>
      </div>
    </>
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
