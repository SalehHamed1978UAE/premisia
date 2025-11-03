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
  const [scrolled, setScrolled] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignIn = () => {
    setIsSigningIn(true);
    window.location.href = '/api/login';
  };

  const handleSeeDemo = () => {
    setIsDemoLoading(true);
    const featuresSection = document.querySelector('[data-testid="section-features"]');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => setIsDemoLoading(false), 1000);
    } else {
      setIsDemoLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(var(--orbit-radius)) rotate(0deg); }
          to { transform: rotate(360deg) translateX(var(--orbit-radius)) rotate(-360deg); }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }

        .orbital-dot {
          position: absolute;
          width: 12px;
          height: 12px;
          background: linear-gradient(135deg, #3b82f6, #10b981);
          border-radius: 50%;
          animation: orbit var(--orbit-duration) linear infinite, pulse 2s ease-in-out infinite;
        }
      `}</style>

      <div className="min-h-screen bg-[#1a1f2e] text-white overflow-x-hidden">
        {/* Navigation */}
        <nav 
          className={cn(
            "fixed top-0 w-full px-6 md:px-12 z-[1000] transition-all duration-300",
            scrolled 
              ? "py-4 bg-[#1a1f2e]/95 backdrop-blur-lg shadow-lg" 
              : "py-5 bg-[#1a1f2e]/80 backdrop-blur-md"
          )}
          data-testid="navbar"
        >
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div 
              className="text-2xl font-bold bg-gradient-to-r from-[#3b82f6] to-[#10b981] bg-clip-text text-transparent"
              data-testid="logo"
            >
              PREMISIA
            </div>
            <div className="flex gap-6 md:gap-8 items-center">
              <a href="#features" className="hidden md:block text-gray-400 hover:text-white transition-colors" data-testid="link-features">Features</a>
              <a href="#pricing" className="hidden md:block text-gray-400 hover:text-white transition-colors" data-testid="link-pricing">Pricing</a>
              <button
                onClick={handleSignIn}
                disabled={isSigningIn}
                className={cn(
                  "px-5 py-2.5 bg-gradient-to-r from-[#3b82f6] to-[#10b981] text-white rounded-lg font-semibold transition-all duration-300",
                  !isSigningIn && "hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(59,130,246,0.3)]",
                  isSigningIn && "opacity-90 cursor-not-allowed"
                )}
                data-testid="button-nav-signin"
              >
                {isSigningIn ? (
                  <span className="flex items-center gap-2">
                    <GeometricLoader type="dots" size="small" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  "Get Started"
                )}
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-32 pb-20 px-6" data-testid="section-hero">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Left Content */}
              <div>
                <div className="mb-6">
                  <h1 className="text-5xl md:text-6xl font-bold mb-3 bg-gradient-to-r from-[#3b82f6] to-[#60a5fa] bg-clip-text text-transparent" data-testid="text-hero-title">
                    PREMISIA
                  </h1>
                  <p className="text-2xl md:text-3xl text-[#10b981] font-semibold" data-testid="text-hero-tagline">
                    Think it through
                  </p>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white" data-testid="text-hero-headline">
                  Transform Your Big Idea into Strategic Reality
                </h2>
                <p className="text-lg text-gray-300 mb-8" data-testid="text-hero-subtext">
                  Whether you're a startup founder validating your vision or an enterprise leader driving transformation, Premisia gives you AI-powered strategic intelligence to make smarter decisions faster.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    size="lg" 
                    onClick={handleSignIn}
                    disabled={isSigningIn}
                    className="bg-gradient-to-r from-[#3b82f6] to-[#10b981] hover:from-[#2563eb] hover:to-[#059669] text-white font-semibold shadow-lg"
                    data-testid="button-cta-primary"
                  >
                    {isSigningIn ? (
                      <>
                        <GeometricLoader type="orbit" size="small" className="mr-2" />
                        <span>Starting...</span>
                      </>
                    ) : (
                      "Start Free - No Card Required"
                    )}
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline"
                    onClick={handleSeeDemo}
                    disabled={isDemoLoading}
                    className="border-2 border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white"
                    data-testid="button-cta-secondary"
                  >
                    {isDemoLoading ? (
                      <>
                        <GeometricLoader type="dots" />
                        <span className="ml-2">Loading...</span>
                      </>
                    ) : (
                      <>
                        <PlayCircle className="mr-2 h-5 w-5" />
                        See It In Action
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Right Orbital Animation */}
              <div className="hidden md:flex justify-center items-center relative h-96" data-testid="animation-orbital">
                <div className="relative w-80 h-80">
                  {/* Center dot */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gradient-to-r from-[#3b82f6] to-[#10b981] rounded-full shadow-lg"></div>
                  
                  {/* Orbits */}
                  {[80, 120, 160].map((radius, idx) => (
                    <div 
                      key={idx}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-[#3b82f6]/20 rounded-full"
                      style={{ width: `${radius}px`, height: `${radius}px` }}
                    >
                      <div 
                        className="orbital-dot"
                        style={{
                          '--orbit-radius': `${radius / 2}px`,
                          '--orbit-duration': `${4 + idx * 2}s`,
                          animationDelay: `${idx * 0.5}s`
                        } as React.CSSProperties}
                      ></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 px-6 bg-[#141824]" data-testid="section-stats">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-[#1a1f2e] border-[#3b82f6]/20" data-testid="card-stat-time">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-[#3b82f6] mb-2">2-3h</div>
                  <div className="text-gray-400">From Idea to Strategy</div>
                </CardContent>
              </Card>
              <Card className="bg-[#1a1f2e] border-[#10b981]/20" data-testid="card-stat-cost">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-[#10b981] mb-2">$0</div>
                  <div className="text-gray-400">To Start (Free Trial)</div>
                </CardContent>
              </Card>
              <Card className="bg-[#1a1f2e] border-[#3b82f6]/20" data-testid="card-stat-speed">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-[#3b82f6] mb-2">10x</div>
                  <div className="text-gray-400">Faster Than Consultants</div>
                </CardContent>
              </Card>
              <Card className="bg-[#1a1f2e] border-[#10b981]/20" data-testid="card-stat-availability">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl font-bold text-[#10b981] mb-2">24/7</div>
                  <div className="text-gray-400">AI Strategy Partner</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Built for Dreamers & Doers Section */}
        <section id="features" className="py-20 px-6" data-testid="section-features">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white" data-testid="heading-features">
                Built for Dreamers & Doers
              </h2>
              <p className="text-lg text-gray-300 max-w-3xl mx-auto" data-testid="subheading-features">
                From startup validation to enterprise transformation - one platform, infinite possibilities
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-[#1a1f2e] border-[#3b82f6]/20 relative" data-testid="card-feature-validate">
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 text-xs font-semibold bg-purple-600/20 text-purple-400 rounded-full border border-purple-600/40">
                    For Startups
                  </span>
                </div>
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-br from-[#3b82f6] to-[#60a5fa] rounded-lg flex items-center justify-center mb-4">
                    <Rocket className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-white">Validate Before You Build</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400">
                    Test assumptions, explore market fit, and refine your vision with AI-powered strategic analysis before investing time and money.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-[#1a1f2e] border-[#10b981]/20" data-testid="card-feature-pmf">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-br from-[#10b981] to-[#34d399] rounded-lg flex items-center justify-center mb-4">
                    <Target className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-white">Find Product-Market Fit</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400">
                    Identify your ideal customer, refine positioning, and develop go-to-market strategies backed by research and data.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-[#1a1f2e] border-[#3b82f6]/20" data-testid="card-feature-investor">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-br from-[#3b82f6] to-[#60a5fa] rounded-lg flex items-center justify-center mb-4">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-white">Investor-Ready Plans</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400">
                    Generate comprehensive business models, financial projections, and execution roadmaps that investors expect.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-[#1a1f2e] border-[#10b981]/20" data-testid="card-feature-scale">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-br from-[#10b981] to-[#34d399] rounded-lg flex items-center justify-center mb-4">
                    <BarChart className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-white">Scale Smart</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400">
                    Plan expansion, optimize operations, and manage growth with enterprise-grade program management tools.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-[#1a1f2e] border-[#3b82f6]/20 relative" data-testid="card-feature-ai">
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 text-xs font-semibold bg-purple-600/20 text-purple-400 rounded-full border border-purple-600/40">
                    Enterprise
                  </span>
                </div>
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-br from-[#3b82f6] to-[#60a5fa] rounded-lg flex items-center justify-center mb-4">
                    <Brain className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-white">AI Strategy Partner</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400">
                    Multi-agent AI system that challenges assumptions, explores scenarios, and delivers evidence-based recommendations.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-[#1a1f2e] border-[#10b981]/20" data-testid="card-feature-secure">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-br from-[#10b981] to-[#34d399] rounded-lg flex items-center justify-center mb-4">
                    <Lock className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-white">Secure & Scalable</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400">
                    Enterprise-grade security with AES-256 encryption, SSO, and compliance features to protect your strategic IP.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="py-20 px-6 bg-[#141824]" data-testid="section-usecases">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Startups */}
              <Card className="bg-[#1a1f2e] border-[#10b981]/40" data-testid="card-usecase-startups">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#10b981] to-[#34d399] rounded-lg flex items-center justify-center">
                      <Rocket className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-2xl text-white">Entrepreneurs & Startups</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {[
                      'Pre-launch Validation',
                      'MVP Planning',
                      'Pitch Deck Creation',
                      'Growth Strategy',
                      'Pivot Analysis'
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-center gap-3" data-testid={`usecase-startup-${idx}`}>
                        <Check className="h-5 w-5 text-[#10b981] flex-shrink-0" />
                        <span className="text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Enterprise */}
              <Card className="bg-[#1a1f2e] border-[#3b82f6]/40" data-testid="card-usecase-enterprise">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#3b82f6] to-[#60a5fa] rounded-lg flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-2xl text-white">Enterprises & Executives</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {[
                      'Digital Transformation',
                      'Market Expansion',
                      'M&A Strategy',
                      'Innovation Programs',
                      'Board Presentations'
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-center gap-3" data-testid={`usecase-enterprise-${idx}`}>
                        <Check className="h-5 w-5 text-[#3b82f6] flex-shrink-0" />
                        <span className="text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 px-6" data-testid="section-pricing">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white" data-testid="heading-pricing">
                Simple, Transparent Pricing
              </h2>
              <p className="text-lg text-gray-300" data-testid="subheading-pricing">
                Start free. Scale as you grow. No surprises.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Starter */}
              <Card className="bg-[#1a1f2e] border-[#3b82f6]/20" data-testid="card-pricing-starter">
                <CardHeader>
                  <CardTitle className="text-2xl text-white">Starter</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-white">$0</span>
                    <span className="text-gray-400">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {[
                      '3 analyses/month',
                      'Business Model Canvas',
                      'AI coaching',
                      'Export to PDF'
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-center gap-3" data-testid={`pricing-starter-feature-${idx}`}>
                        <Check className="h-5 w-5 text-[#10b981] flex-shrink-0" />
                        <span className="text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full bg-[#3b82f6] hover:bg-[#2563eb]"
                    onClick={handleSignIn}
                    disabled={isSigningIn}
                    data-testid="button-pricing-starter"
                  >
                    {isSigningIn ? (
                      <>
                        <GeometricLoader type="dots" size="small" className="mr-2" />
                        <span>Starting...</span>
                      </>
                    ) : (
                      "Start Free"
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Growth - MOST POPULAR */}
              <Card className="bg-gradient-to-b from-[#1a1f2e] to-[#141824] border-[#10b981] border-2 relative" data-testid="card-pricing-growth">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 text-sm font-bold bg-gradient-to-r from-[#10b981] to-[#34d399] text-white rounded-full">
                    MOST POPULAR
                  </span>
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl text-white">Growth</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-white">$49</span>
                    <span className="text-gray-400">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {[
                      'Unlimited analyses',
                      'Advanced AI agents',
                      'Competitive research',
                      'Program management',
                      'Team collaboration'
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-center gap-3" data-testid={`pricing-growth-feature-${idx}`}>
                        <Check className="h-5 w-5 text-[#10b981] flex-shrink-0" />
                        <span className="text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full bg-gradient-to-r from-[#10b981] to-[#34d399] hover:from-[#059669] hover:to-[#10b981]"
                    onClick={handleSignIn}
                    disabled={isSigningIn}
                    data-testid="button-pricing-growth"
                  >
                    {isSigningIn ? (
                      <>
                        <GeometricLoader type="orbit" size="small" className="mr-2" />
                        <span>Starting Trial...</span>
                      </>
                    ) : (
                      "Start 14-Day Trial"
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Enterprise */}
              <Card className="bg-[#1a1f2e] border-[#3b82f6]/20" data-testid="card-pricing-enterprise">
                <CardHeader>
                  <CardTitle className="text-2xl text-white">Enterprise</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-white">Custom</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {[
                      'Everything in Growth',
                      'Custom AI training',
                      'SSO & security',
                      'Dedicated support',
                      'SLA guarantee'
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-center gap-3" data-testid={`pricing-enterprise-feature-${idx}`}>
                        <Check className="h-5 w-5 text-[#3b82f6] flex-shrink-0" />
                        <span className="text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full bg-[#1a1f2e] border-2 border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white"
                    variant="outline"
                    data-testid="button-pricing-enterprise"
                  >
                    Contact Sales
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Social Proof Footer */}
        <section className="py-16 px-6 bg-[#141824]" data-testid="section-social-proof">
          <div className="max-w-7xl mx-auto text-center">
            <h3 className="text-2xl font-bold mb-8 text-white" data-testid="heading-social-proof">
              Trusted by innovators at every stage
            </h3>
            <div className="grid md:grid-cols-3 gap-8">
              <div data-testid="social-proof-startups">
                <Users className="h-12 w-12 text-[#10b981] mx-auto mb-3" />
                <div className="text-lg font-semibold text-white mb-1">Startup Founders</div>
                <p className="text-gray-400 text-sm">Building the next big thing</p>
              </div>
              <div data-testid="social-proof-yc">
                <Star className="h-12 w-12 text-[#3b82f6] mx-auto mb-3" />
                <div className="text-lg font-semibold text-white mb-1">Y Combinator Alumni</div>
                <p className="text-gray-400 text-sm">Scaling with confidence</p>
              </div>
              <div data-testid="social-proof-fortune">
                <Building2 className="h-12 w-12 text-[#10b981] mx-auto mb-3" />
                <div className="text-lg font-semibold text-white mb-1">Fortune 500 Execs</div>
                <p className="text-gray-400 text-sm">Driving transformation</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-6 border-t border-gray-800" data-testid="footer">
          <div className="max-w-7xl mx-auto text-center text-gray-400 text-sm">
            <p>&copy; 2025 Premisia. All rights reserved.</p>
          </div>
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
