import { useState, useEffect, useRef } from "react";
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
    <>
      {/* Animated background matching landing page */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .onboarding-bg {
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
          animation-delay: 0s;
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
      `}</style>
      
      <div className="onboarding-bg">
        <div className="gradient-orb orb1"></div>
        <div className="gradient-orb orb2"></div>
        <div className="gradient-orb orb3"></div>
      </div>

      <div className="min-h-screen text-white p-6">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="flex flex-col items-center mb-8">
              <span className="px-3 py-1 text-sm font-semibold bg-white/10 text-white rounded-lg backdrop-blur-sm">BETA</span>
            </div>
            <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Premisia structures complex choices so leaders can align, commit, and move. <span className="font-semibold text-white">66% of EMEA leaders already see significant AI productivity gains</span>—it's time to turn that into strategic advantage.
            </p>
          </div>

          {/* Step Indicators - Display only, not clickable */}
          <div className="flex justify-center mb-8 px-4">
            <div className="flex flex-col sm:flex-row items-center gap-0">
              {ONBOARDING_STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all",
                      index === currentStep
                        ? "bg-gradient-to-r from-[#3b82f6] to-[#10b981] text-white shadow-lg shadow-blue-500/50 scale-110"
                        : index < currentStep
                        ? "bg-white/20 text-white backdrop-blur-sm"
                        : "bg-white/10 text-gray-400 backdrop-blur-sm"
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
                      className={cn(
                        "w-12 sm:w-16 h-1 mx-2 transition-all",
                        index < currentStep ? "bg-gradient-to-r from-[#3b82f6] to-[#10b981]" : "bg-white/20"
                      )} 
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Current Step Content */}
          <Card className="max-w-4xl mx-auto bg-white/5 backdrop-blur-md border-white/10 shadow-2xl">
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
                    <span className="text-sm font-medium text-gray-400">
                      Step {currentStep + 1} of {ONBOARDING_STEPS.length}
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                    {currentStepData.title}
                  </h2>
                  <p className="text-lg text-gray-300 mb-6">
                    {currentStepData.description}
                  </p>

                  {/* Features List */}
                  <div className="space-y-3 mb-8">
                    {currentStepData.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center mt-0.5">
                          <CheckCircle className="h-4 w-4 text-[#10b981]" />
                        </div>
                        <p className="text-gray-200">{feature}</p>
                      </div>
                    ))}
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex items-center gap-4">
                    {currentStep > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep(currentStep - 1)}
                        className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white backdrop-blur-sm"
                        data-testid="button-previous"
                      >
                        Previous
                      </Button>
                    )}
                    
                    {currentStep < ONBOARDING_STEPS.length - 1 ? (
                      <Button
                        onClick={() => setCurrentStep(currentStep + 1)}
                        className="ml-auto bg-gradient-to-r from-[#3b82f6] to-[#10b981] text-white hover:shadow-lg hover:shadow-blue-500/50 transition-all"
                        data-testid="button-next"
                      >
                        Next
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        onClick={handleGetStarted}
                        className="ml-auto bg-gradient-to-r from-[#3b82f6] to-[#10b981] text-white hover:shadow-lg hover:shadow-blue-500/50 transition-all"
                        size="lg"
                        data-testid="button-get-started"
                      >
                        <Sparkles className="mr-2 h-5 w-5" />
                        Start your first journey
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Dashboard({ summary }: { summary: DashboardSummary }) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 px-6 pt-2 pb-6 space-y-3">
      {/* Primary CTA */}
      <div className="text-center max-w-4xl mx-auto mb-4">
        <Button
          onClick={() => setLocation('/strategic-consultant/input')}
          className="bg-gradient-to-r from-primary to-primary/80 shadow-lg hover:shadow-xl transition-all"
          size="lg"
          data-testid="button-start-new-analysis"
        >
          <Sparkles className="mr-2 h-5 w-5" />
          Start a new strategic journey
        </Button>
      </div>

      {/* Stats Cards - Now Interactive Quick Actions */}
      <div className="max-w-6xl mx-auto grid gap-2 grid-cols-3 md:gap-4">
        {/* Analyses Complete - Click to navigate to repository */}
        <Link href="/repository">
          <Card className="shadow-lg border-primary/20 hover:shadow-xl hover:border-primary/40 transition-all cursor-pointer group" data-testid="button-go-to-analyses">
            <CardContent className="p-3 md:p-5">
              <div className="flex flex-col md:flex-row items-center md:gap-3 text-center md:text-left">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform mb-2 md:mb-0">
                  <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] md:text-xs font-medium text-muted-foreground leading-tight">
                    <span className="md:hidden">Analyses<br />Complete</span>
                    <span className="hidden md:inline">Analyses Complete</span>
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">{summary.counts.analyses}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Strategies Complete - Click to navigate to strategies hub */}
        <Link href="/strategies">
          <Card className="shadow-lg border-primary/20 hover:shadow-xl hover:border-primary/40 transition-all cursor-pointer group" data-testid="button-go-to-strategies">
            <CardContent className="p-3 md:p-5">
              <div className="flex flex-col md:flex-row items-center md:gap-3 text-center md:text-left">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform mb-2 md:mb-0">
                  <Target className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] md:text-xs font-medium text-muted-foreground leading-tight">
                    <span className="md:hidden">Strategies<br />Complete</span>
                    <span className="hidden md:inline">Strategies Complete</span>
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">{summary.counts.strategies}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Programs Complete - Click to navigate to EPM programs */}
        <Link href="/strategy-workspace/programs">
          <Card className="shadow-lg border-primary/20 hover:shadow-xl hover:border-primary/40 transition-all cursor-pointer group" data-testid="button-go-to-programs">
            <CardContent className="p-3 md:p-5">
              <div className="flex flex-col md:flex-row items-center md:gap-3 text-center md:text-left">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform mb-2 md:mb-0">
                  <FileText className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] md:text-xs font-medium text-muted-foreground leading-tight">
                    <span className="md:hidden">Programs<br />Complete</span>
                    <span className="hidden md:inline">Programs Complete</span>
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">{summary.counts.programs}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Artifacts */}
      <div className="max-w-6xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Recent Activity</CardTitle>
            <p className="text-sm text-muted-foreground">Your last 5 artifacts</p>
          </CardHeader>
          <CardContent>
            {summary.recentArtifacts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto mb-4 shadow-md">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <p className="text-muted-foreground text-lg mb-6">
                  No artifacts yet. Start by creating your first strategic analysis!
                </p>
                <Button
                  onClick={() => setLocation('/strategic-consultant/input')}
                  className="bg-gradient-to-r from-primary to-primary/80 shadow-lg"
                  size="lg"
                  data-testid="button-empty-state-start"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Get Started
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {summary.recentArtifacts.map((artifact) => (
                  <Link key={artifact.id} href={artifact.link}>
                    <div
                      className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-xl border border-border hover:shadow-md hover:border-primary/30 transition-all cursor-pointer bg-card"
                      data-testid={`artifact-${artifact.id}`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
                          artifact.type === 'analysis' && "bg-gradient-to-br from-purple-500 to-purple-600",
                          artifact.type === 'program' && "bg-gradient-to-br from-green-500 to-green-600"
                        )}>
                          {artifact.type === 'analysis' ? (
                            <Archive className="h-6 w-6 text-white" />
                          ) : (
                            <FileText className="h-6 w-6 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground truncate text-lg">{artifact.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {artifact.type === 'analysis' ? 'Strategic Analysis' : 'EPM Program'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0 pl-16 sm:pl-0">
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
      </div>

      <RotatingQuote />
    </div>
  );
}

function PublicLandingPage() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [statsAnimated, setStatsAnimated] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({
    frameworks: 0,
    analysis: 0,
    availability: 0,
    clicks: 0
  });

  useEffect(() => {
    // Navbar scroll effect
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);

    // Stats animation observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !statsAnimated) {
            setStatsAnimated(true);
            animateStats();
          }
        });
      },
      { threshold: 0.3 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    // Parallax effect for orbs
    const handleMouseMove = (e: MouseEvent) => {
      const orbs = document.querySelectorAll('.gradient-orb');
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;

      orbs.forEach((orb, index) => {
        const speed = (index + 1) * 10;
        (orb as HTMLElement).style.transform = `translate(${x * speed}px, ${y * speed}px)`;
      });
    };
    document.addEventListener('mousemove', handleMouseMove);

    // Color changing dots
    const colorInterval = setInterval(() => {
      const dots = document.querySelectorAll('.orbit-dot');
      dots.forEach(dot => {
        (dot as HTMLElement).style.background = `hsl(${Math.random() * 60 + 180}, 70%, 50%)`;
      });
    }, 3000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousemove', handleMouseMove);
      clearInterval(colorInterval);
      if (statsRef.current) {
        observer.unobserve(statsRef.current);
      }
    };
  }, [statsAnimated]);

  const animateStats = () => {
    const duration = 2000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      setStats({
        frameworks: Math.floor(5 * progress),
        analysis: Math.floor(100 * progress),
        availability: Math.floor(24 * progress),
        clicks: Math.floor(1 * progress)
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };

  const handleSignIn = () => {
    setIsSigningIn(true);
    window.location.href = '/api/login';
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
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

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-50px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(50px); }
          to { opacity: 1; transform: translateX(0); }
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
          pointer-events: none;
        }

        .gradient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.3;
          animation: float 20s infinite ease-in-out;
          will-change: transform;
        }

        .orb1 {
          width: 600px;
          height: 600px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          top: -200px;
          right: -200px;
          animation-delay: 0s;
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

        .hero-visual {
          animation: fadeIn 1s ease;
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
          transition: background 0.3s ease;
        }

        .stat-card {
          position: relative;
          overflow: hidden;
        }

        .stat-card:before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 3px;
          background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%);
        }

        .stat-card:hover {
          transform: translateY(-10px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .feature-card {
          position: relative;
          overflow: hidden;
          opacity: 0;
          transform: translateY(20px);
          animation: fadeInUp 0.6s ease forwards;
        }

        .feature-card:nth-child(1) { animation-delay: 0.1s; }
        .feature-card:nth-child(2) { animation-delay: 0.2s; }
        .feature-card:nth-child(3) { animation-delay: 0.3s; }
        .feature-card:nth-child(4) { animation-delay: 0.4s; }
        .feature-card:nth-child(5) { animation-delay: 0.5s; }
        .feature-card:nth-child(6) { animation-delay: 0.6s; }

        .feature-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .feature-badge {
          position: absolute;
          top: 20px;
          right: 20px;
          padding: 5px 10px;
          background: #8b5cf6;
          color: white;
          font-size: 12px;
          border-radius: 20px;
          font-weight: 600;
        }

        .timeline {
          position: relative;
          padding: 40px 0;
          display: flex;
          flex-direction: column;
          gap: 40px;
        }

        .timeline-item {
          display: flex;
          opacity: 0;
          animation: fadeInUp 0.6s ease forwards;
        }

        .timeline-item:nth-child(1) { animation-delay: 0.1s; justify-content: flex-start; }
        .timeline-item:nth-child(2) { animation-delay: 0.2s; justify-content: flex-end; }
        .timeline-item:nth-child(3) { animation-delay: 0.3s; justify-content: flex-start; }
        .timeline-item:nth-child(4) { animation-delay: 0.4s; justify-content: flex-end; }
        .timeline-item:nth-child(5) { animation-delay: 0.5s; justify-content: flex-start; }

        .timeline-content {
          width: 100%;
          max-width: 500px;
          padding: 30px;
          background: #202938;
          border-radius: 15px;
          position: relative;
        }

        @media (max-width: 768px) {
          .timeline-item {
            justify-content: flex-start !important;
          }

          .timeline-content {
            max-width: 100%;
          }

          .navbar.scrolled {
            padding: 15px 20px;
          }
        }

        .navbar.scrolled {
          padding: 15px 50px;
          background: rgba(15, 20, 25, 0.95);
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
          className={cn(
            "fixed top-0 w-full px-6 md:px-12 py-5 z-[1000] transition-all duration-300",
            scrolled && "py-4"
          )}
          style={{ 
            background: scrolled ? 'rgba(15, 20, 25, 0.95)' : 'rgba(15, 20, 25, 0.8)', 
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          }}
          data-testid="navbar"
        >
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div 
              className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#3b82f6] to-[#10b981] bg-clip-text text-transparent"
              data-testid="logo-text"
            >
              PREMISIA
            </div>
            <div className="flex gap-4 md:gap-8 items-center">
              <button 
                onClick={() => scrollToSection('features')} 
                className="hidden md:block text-gray-400 hover:text-white transition-colors text-sm md:text-base"
                data-testid="link-features"
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection('process')} 
                className="hidden md:block text-gray-400 hover:text-white transition-colors text-sm md:text-base"
                data-testid="link-how-it-works"
              >
                How it Works
              </button>
              <button 
                onClick={() => scrollToSection('security')} 
                className="hidden md:block text-gray-400 hover:text-white transition-colors text-sm md:text-base"
                data-testid="link-security"
              >
                Security
              </button>
              <button
                onClick={handleSignIn}
                disabled={isSigningIn}
                className={cn(
                  "px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-[#3b82f6] to-[#10b981] text-white rounded-lg font-semibold transition-all duration-300",
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
          className="min-h-screen flex items-center px-6 md:px-12 pt-32 pb-20 relative"
          data-testid="section-hero"
        >
          <div className="max-w-7xl mx-auto w-full">
            <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
              {/* Left Content */}
              <div>
                <h1 className="hero-title text-5xl md:text-7xl lg:text-[72px] font-bold mb-5 bg-gradient-to-r from-[#3b82f6] to-[#10b981] bg-clip-text text-transparent" data-testid="text-hero-title">
                  PREMISIA
                </h1>
                <p className="hero-subtitle text-2xl md:text-3xl lg:text-[32px] text-[#10b981] mb-8" data-testid="text-hero-subtitle">
                  Think it through
                </p>
                <h2 className="hero-headline text-3xl md:text-4xl lg:text-[36px] font-bold mb-5 text-white" data-testid="text-hero-headline">
                  Turn Your Wild Ideas into Real Strategies
                </h2>
                <p className="hero-description text-base md:text-lg text-gray-300 mb-10 leading-relaxed" data-testid="text-hero-description">
                  Stop staring at blank whiteboards. Premisia uses AI to help you structure messy ideas 
                  into clear strategic plans. From "I have this crazy idea" to "here's exactly how we do it" 
                  in hours, not weeks.
                </p>
                <div className="hero-buttons flex flex-col sm:flex-row gap-5">
                  <button 
                    onClick={handleSignIn}
                    disabled={isSigningIn}
                    className={cn(
                      "px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-[#3b82f6] to-[#10b981] text-white rounded-xl text-base md:text-lg font-semibold transition-all duration-300",
                      !isSigningIn && "hover:-translate-y-0.5 hover:shadow-[0_10px_40px_rgba(59,130,246,0.4)]",
                      isSigningIn && "opacity-90 cursor-not-allowed"
                    )}
                    data-testid="button-cta-try-free"
                  >
                    {isSigningIn ? (
                      <span className="flex items-center justify-center gap-2">
                        <GeometricLoader type="orbit" size="small" />
                        <span>Starting...</span>
                      </span>
                    ) : (
                      "🚀 Try It Now - It's Free"
                    )}
                  </button>
                  <button 
                    onClick={() => scrollToSection('features')}
                    className="px-6 md:px-8 py-3 md:py-4 bg-transparent border-2 border-[#3b82f6] text-white rounded-xl text-base md:text-lg font-semibold transition-all duration-300 hover:bg-[#3b82f6] hover:text-white"
                    data-testid="button-cta-see-how"
                  >
                    👀 See How It Works
                  </button>
                </div>
              </div>

              {/* Right Brain Animation */}
              <div className="hero-visual hidden md:flex justify-center items-center" data-testid="animation-brain">
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
                    className="brain-core w-[200px] h-[200px] bg-gradient-to-br from-[#3b82f6] to-[#10b981] rounded-full relative"
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
          ref={statsRef}
          className="py-16 md:py-20 px-6 md:px-12 bg-[#1a1f2e] relative overflow-hidden"
          data-testid="section-stats"
        >
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
              <div 
                className="stat-card text-center p-6 md:p-10 bg-[#202938] rounded-2xl md:rounded-3xl transition-all duration-300"
                data-testid="card-stat-frameworks"
              >
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#3b82f6] to-[#10b981] bg-clip-text text-transparent mb-2 md:mb-3">
                  {stats.frameworks}
                </div>
                <div className="text-sm md:text-lg text-gray-400">Strategic Frameworks</div>
              </div>
              <div 
                className="stat-card text-center p-6 md:p-10 bg-[#202938] rounded-2xl md:rounded-3xl transition-all duration-300"
                data-testid="card-stat-analysis"
              >
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#3b82f6] to-[#10b981] bg-clip-text text-transparent mb-2 md:mb-3">
                  {stats.analysis}+
                </div>
                <div className="text-sm md:text-lg text-gray-400">Analysis Points</div>
              </div>
              <div 
                className="stat-card text-center p-6 md:p-10 bg-[#202938] rounded-2xl md:rounded-3xl transition-all duration-300"
                data-testid="card-stat-availability"
              >
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#3b82f6] to-[#10b981] bg-clip-text text-transparent mb-2 md:mb-3">
                  {stats.availability}/7
                </div>
                <div className="text-sm md:text-lg text-gray-400">AI Available</div>
              </div>
              <div 
                className="stat-card text-center p-6 md:p-10 bg-[#202938] rounded-2xl md:rounded-3xl transition-all duration-300"
                data-testid="card-stat-clicks"
              >
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#3b82f6] to-[#10b981] bg-clip-text text-transparent mb-2 md:mb-3">
                  {stats.clicks} Click
                </div>
                <div className="text-sm md:text-lg text-gray-400">To Get Started</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section 
          id="features"
          className="py-16 md:py-24 px-6 md:px-12"
          data-testid="section-features"
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-5 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent" data-testid="heading-features">
                Not Your Average Strategy Tool
              </h2>
              <p className="text-base md:text-lg lg:text-xl text-gray-400" data-testid="subheading-features">
                We built this because consultants are expensive and your napkin sketches deserve better
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {/* Feature 1: Multi-Agent AI Brain */}
              <div 
                className="feature-card p-6 md:p-10 bg-[#202938] rounded-2xl md:rounded-3xl transition-all duration-300 cursor-pointer"
                data-testid="card-feature-multi-agent"
              >
                <div className="feature-badge">AI Magic</div>
                <div 
                  className="w-12 h-12 md:w-[60px] md:h-[60px] bg-gradient-to-br from-[#3b82f6] to-[#10b981] rounded-xl md:rounded-2xl flex items-center justify-center mb-4 md:mb-5 text-2xl md:text-3xl transition-all duration-300"
                  style={{ willChange: 'transform' }}
                >
                  🧠
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-white">Multi-Agent AI Brain</h3>
                <p className="text-sm md:text-base text-gray-400 leading-relaxed">
                  Three specialized AI agents work together: one challenges your assumptions, one builds your strategy, and one makes sure it actually makes sense.
                </p>
              </div>

              {/* Feature 2: Five Whys on Steroids */}
              <div 
                className="feature-card p-6 md:p-10 bg-[#202938] rounded-2xl md:rounded-3xl transition-all duration-300 cursor-pointer"
                data-testid="card-feature-five-whys"
              >
                <div 
                  className="w-12 h-12 md:w-[60px] md:h-[60px] bg-gradient-to-br from-[#3b82f6] to-[#10b981] rounded-xl md:rounded-2xl flex items-center justify-center mb-4 md:mb-5 text-2xl md:text-3xl transition-all duration-300"
                >
                  🎯
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-white">Five Whys on Steroids</h3>
                <p className="text-sm md:text-base text-gray-400 leading-relaxed">
                  Our AI doesn't just ask "why" five times. It digs deep, finds patterns you missed, and calls out the elephant in the room you've been ignoring.
                </p>
              </div>

              {/* Feature 3: Business Model Canvas++ */}
              <div 
                className="feature-card p-6 md:p-10 bg-[#202938] rounded-2xl md:rounded-3xl transition-all duration-300 cursor-pointer"
                data-testid="card-feature-bmc"
              >
                <div 
                  className="w-12 h-12 md:w-[60px] md:h-[60px] bg-gradient-to-br from-[#3b82f6] to-[#10b981] rounded-xl md:rounded-2xl flex items-center justify-center mb-4 md:mb-5 text-2xl md:text-3xl transition-all duration-300"
                >
                  📊
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-white">Business Model Canvas++</h3>
                <p className="text-sm md:text-base text-gray-400 leading-relaxed">
                  Fill out a BMC that actually thinks. It spots gaps, suggests connections, and tells you when your revenue model doesn't match your value prop.
                </p>
              </div>

              {/* Feature 4: Bias Detector */}
              <div 
                className="feature-card p-6 md:p-10 bg-[#202938] rounded-2xl md:rounded-3xl transition-all duration-300 cursor-pointer"
                data-testid="card-feature-bias-detector"
              >
                <div 
                  className="w-12 h-12 md:w-[60px] md:h-[60px] bg-gradient-to-br from-[#3b82f6] to-[#10b981] rounded-xl md:rounded-2xl flex items-center justify-center mb-4 md:mb-5 text-2xl md:text-3xl transition-all duration-300"
                >
                  🔍
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-white">Bias Detector</h3>
                <p className="text-sm md:text-base text-gray-400 leading-relaxed">
                  We all drink our own Kool-Aid. Our AI is that friend who tells you your idea might not be as brilliant as you think (but helps you fix it).
                </p>
              </div>

              {/* Feature 5: Instant Program Plans */}
              <div 
                className="feature-card p-6 md:p-10 bg-[#202938] rounded-2xl md:rounded-3xl transition-all duration-300 cursor-pointer"
                data-testid="card-feature-program-plans"
              >
                <div 
                  className="w-12 h-12 md:w-[60px] md:h-[60px] bg-gradient-to-br from-[#3b82f6] to-[#10b981] rounded-xl md:rounded-2xl flex items-center justify-center mb-4 md:mb-5 text-2xl md:text-3xl transition-all duration-300"
                >
                  📈
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-white">Instant Program Plans</h3>
                <p className="text-sm md:text-base text-gray-400 leading-relaxed">
                  Go from strategy to execution roadmap in minutes. Complete with milestones, dependencies, and reality checks.
                </p>
              </div>

              {/* Feature 6: Enterprise-Grade Security */}
              <div 
                className="feature-card p-6 md:p-10 bg-[#202938] rounded-2xl md:rounded-3xl transition-all duration-300 cursor-pointer"
                data-testid="card-feature-security"
              >
                <div className="feature-badge">Live</div>
                <div 
                  className="w-12 h-12 md:w-[60px] md:h-[60px] bg-gradient-to-br from-[#3b82f6] to-[#10b981] rounded-xl md:rounded-2xl flex items-center justify-center mb-4 md:mb-5 text-2xl md:text-3xl transition-all duration-300"
                >
                  🔒
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-white">Enterprise-Grade Security</h3>
                <p className="text-sm md:text-base text-gray-400 leading-relaxed">
                  AWS KMS envelope encryption with AES-256-GCM. Every record gets unique encryption keys. The same security trusted by Fortune 500 companies.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section 
          id="process"
          className="py-16 md:py-24 px-6 md:px-12 bg-[#1a1f2e]"
          data-testid="section-process"
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-5 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent" data-testid="heading-process">
                From Chaos to Clarity in 5 Steps
              </h2>
              <p className="text-base md:text-lg lg:text-xl text-gray-400" data-testid="subheading-process">
                How we turn your 3am shower thoughts into boardroom-ready strategies
              </p>
            </div>

            <div className="timeline max-w-4xl mx-auto">
              {/* Step 1 */}
              <div className="timeline-item" data-testid="timeline-step-1">
                <div className="timeline-content">
                  <h3 className="text-xl md:text-2xl font-bold text-[#3b82f6] mb-3 md:mb-4">1. Brain Dump</h3>
                  <p className="text-sm md:text-base text-gray-400 leading-relaxed">
                    Type, talk, or upload your messy ideas. Half-baked is fine. Contradictory is expected.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="timeline-item" data-testid="timeline-step-2">
                <div className="timeline-content">
                  <h3 className="text-xl md:text-2xl font-bold text-[#3b82f6] mb-3 md:mb-4">2. AI Interrogation</h3>
                  <p className="text-sm md:text-base text-gray-400 leading-relaxed">
                    Our AI asks the hard questions you've been avoiding. It's like therapy for your business idea.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="timeline-item" data-testid="timeline-step-3">
                <div className="timeline-content">
                  <h3 className="text-xl md:text-2xl font-bold text-[#3b82f6] mb-3 md:mb-4">3. Structure Emerges</h3>
                  <p className="text-sm md:text-base text-gray-400 leading-relaxed">
                    Watch as your random thoughts transform into organized frameworks. It's oddly satisfying.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="timeline-item" data-testid="timeline-step-4">
                <div className="timeline-content">
                  <h3 className="text-xl md:text-2xl font-bold text-[#3b82f6] mb-3 md:mb-4">4. Reality Check</h3>
                  <p className="text-sm md:text-base text-gray-400 leading-relaxed">
                    Our bias detector and feasibility analyzer make sure you're not building castles in the sky.
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="timeline-item" data-testid="timeline-step-5">
                <div className="timeline-content">
                  <h3 className="text-xl md:text-2xl font-bold text-[#3b82f6] mb-3 md:mb-4">5. Action Plan</h3>
                  <p className="text-sm md:text-base text-gray-400 leading-relaxed">
                    Get a complete execution roadmap with timelines, resources, and KPIs. Ready to present or implement.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works - Feature Walkthrough Section */}
        <section 
          id="how-it-works"
          className="py-16 md:py-24 px-6 md:px-12"
          data-testid="section-how-it-works"
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12 md:mb-20">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-5 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent" data-testid="heading-how-it-works">
                See the Platform in Action
              </h2>
              <p className="text-base md:text-lg lg:text-xl text-gray-400" data-testid="subheading-how-it-works">
                A real example: transforming "open cafe dubai" into a complete business strategy
              </p>
            </div>

            {/* Walkthrough Step 1: Strategic Input */}
            <div className="mb-16 md:mb-24">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
                <div className="order-2 lg:order-1">
                  <div className="inline-block px-3 py-1 bg-[#3b82f6]/20 text-[#3b82f6] rounded-full text-sm font-semibold mb-4">
                    Step 1
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">Start with Your Idea</h3>
                  <p className="text-base md:text-lg text-gray-400 leading-relaxed mb-4">
                    Simply type your strategic challenge or business idea. No need for formal planning language—just describe what you're thinking about.
                  </p>
                  <p className="text-sm md:text-base text-gray-500 leading-relaxed">
                    Upload supporting documents (PDF, Word, Excel, images) to give the AI more context. The system starts processing your input immediately.
                  </p>
                </div>
                <div className="order-1 lg:order-2">
                  <div className="rounded-2xl overflow-hidden shadow-2xl border border-[#3b82f6]/30 bg-[#202938] p-8 md:p-12 flex items-center justify-center min-h-[300px]">
                    <div className="text-center">
                      <div className="text-6xl mb-4">💭</div>
                      <p className="text-gray-400">Strategic Input Interface</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Note: Feature walkthrough with descriptions - screenshots to be added later */}
            <div className="text-center py-8 px-6 bg-[#202938] rounded-2xl">
              <p className="text-gray-400 text-lg">
                📸 Interactive product walkthrough coming soon - showcasing the complete journey from idea to EPM program
              </p>
              <p className="text-gray-500 text-sm mt-2">
                12 steps: Input → Clarification → Classification → Journey Selection → Five Whys → Research → Decisions → Prioritization → EPM Summary → Timeline → Workstreams → Resources
              </p>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section 
          id="security"
          className="py-16 md:py-24 px-6 md:px-12"
          data-testid="section-security"
        >
          <div className="max-w-7xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-5 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent" data-testid="heading-security">
                🔒 Enterprise-Grade Security
              </h2>
              <p className="text-base md:text-lg lg:text-xl text-gray-400" data-testid="subheading-security">
                Your strategic ideas deserve serious protection
              </p>
            </div>

            {/* Bank-Grade Encryption Card */}
            <div 
              className="p-6 md:p-10 bg-[#202938] rounded-2xl md:rounded-3xl mb-8 md:mb-12 transition-all duration-300 hover:-translate-y-1"
              style={{ border: '2px solid', borderImage: 'linear-gradient(135deg, #10b981 0%, #059669 100%) 1' }}
              data-testid="card-bank-encryption"
            >
              <h3 className="text-2xl md:text-3xl font-bold mb-6 text-[#10b981]">Bank-Grade Encryption</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-6 h-6 rounded-full bg-[#10b981]/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <Check className="h-4 w-4 text-[#10b981]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">AWS KMS Envelope Encryption</h4>
                      <p className="text-sm text-gray-400">The same encryption system trusted by Fortune 500 companies</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-6 h-6 rounded-full bg-[#10b981]/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <Check className="h-4 w-4 text-[#10b981]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">AES-256-GCM</h4>
                      <p className="text-sm text-gray-400">Military-grade encryption with authenticated integrity protection</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#10b981]/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <Check className="h-4 w-4 text-[#10b981]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Unique Encryption Keys</h4>
                      <p className="text-sm text-gray-400">Every record gets its own data encryption key</p>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-6 h-6 rounded-full bg-[#10b981]/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <Check className="h-4 w-4 text-[#10b981]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Secure Data Transit</h4>
                      <p className="text-sm text-gray-400">HTTPS encryption for all data transmission</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#10b981]/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <Check className="h-4 w-4 text-[#10b981]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Server-Side Protection</h4>
                      <p className="text-sm text-gray-400">Your data is encrypted at rest in our secure infrastructure</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Two-Column How It Works Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-12">
              {/* Data Flow */}
              <div 
                className="p-6 md:p-10 bg-[#202938] rounded-2xl md:rounded-3xl transition-all duration-300 hover:-translate-y-1"
                data-testid="card-data-flow"
              >
                <h3 className="text-2xl font-bold mb-6 text-[#3b82f6]">How Your Data Flows</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#3b82f6]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#3b82f6]">1</span>
                    </div>
                    <p className="text-sm text-gray-300">You input your strategic idea</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#3b82f6]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#3b82f6]">2</span>
                    </div>
                    <p className="text-sm text-gray-300">HTTPS encrypts data in transit</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#3b82f6]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#3b82f6]">3</span>
                    </div>
                    <p className="text-sm text-gray-300">AES-256-GCM encrypts with unique key</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#3b82f6]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#3b82f6]">4</span>
                    </div>
                    <p className="text-sm text-gray-300">AWS KMS secures encryption keys</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#3b82f6]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#3b82f6]">5</span>
                    </div>
                    <p className="text-sm text-gray-300">Encrypted data stored securely</p>
                  </div>
                </div>
              </div>

              {/* Access Control */}
              <div 
                className="p-6 md:p-10 bg-[#202938] rounded-2xl md:rounded-3xl transition-all duration-300 hover:-translate-y-1"
                data-testid="card-access-control"
              >
                <h3 className="text-2xl font-bold mb-6 text-[#3b82f6]">Access Control</h3>
                <div className="space-y-4">
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Your data is processed server-side to enable AI analysis and strategic recommendations.
                  </p>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    This means our servers decrypt your data during processing.
                  </p>
                  <div className="p-4 bg-[#3b82f6]/10 rounded-lg border border-[#3b82f6]/30">
                    <h4 className="font-semibold text-white mb-2">Why this matters:</h4>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      We can provide powerful AI insights while maintaining strong security. Your data is protected from external threats and unauthorized access.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Roadmap */}
            <div 
              className="p-6 md:p-10 bg-[#202938] rounded-2xl md:rounded-3xl mb-8 md:mb-12 transition-all duration-300 hover:-translate-y-1"
              style={{ border: '2px solid #a855f7' }}
              data-testid="card-security-roadmap"
            >
              <h3 className="text-2xl md:text-3xl font-bold mb-6 text-purple-400">Security Roadmap</h3>
              <p className="text-gray-400 mb-6">Future enhancements we're building:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <ArrowRight className="h-5 w-5 text-purple-400 flex-shrink-0" />
                  <p className="text-sm text-gray-300">Client-side encryption options</p>
                </div>
                <div className="flex items-center gap-3">
                  <ArrowRight className="h-5 w-5 text-purple-400 flex-shrink-0" />
                  <p className="text-sm text-gray-300">Zero-knowledge architecture for sensitive data</p>
                </div>
                <div className="flex items-center gap-3">
                  <ArrowRight className="h-5 w-5 text-purple-400 flex-shrink-0" />
                  <p className="text-sm text-gray-300">SOC 2 Type II certification</p>
                </div>
                <div className="flex items-center gap-3">
                  <ArrowRight className="h-5 w-5 text-purple-400 flex-shrink-0" />
                  <p className="text-sm text-gray-300">Bring your own encryption keys</p>
                </div>
              </div>
            </div>

            {/* Your Data, Your Control */}
            <div>
              <h3 className="text-2xl md:text-3xl font-bold mb-8 text-center text-white">Your Data, Your Control</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div 
                  className="p-6 bg-[#202938] rounded-xl transition-all duration-300 hover:-translate-y-1"
                  data-testid="data-control-delete"
                >
                  <div className="text-4xl mb-4">🗑️</div>
                  <h4 className="font-semibold text-white mb-2">Delete Anytime</h4>
                  <p className="text-sm text-gray-400">Remove your data whenever you want</p>
                </div>
                <div 
                  className="p-6 bg-[#202938] rounded-xl transition-all duration-300 hover:-translate-y-1"
                  data-testid="data-control-export"
                >
                  <div className="text-4xl mb-4">📤</div>
                  <h4 className="font-semibold text-white mb-2">Export Everything</h4>
                  <p className="text-sm text-gray-400">Download your work in standard formats</p>
                </div>
                <div 
                  className="p-6 bg-[#202938] rounded-xl transition-all duration-300 hover:-translate-y-1"
                  data-testid="data-control-sales"
                >
                  <div className="text-4xl mb-4">🚫</div>
                  <h4 className="font-semibold text-white mb-2">No Data Sales</h4>
                  <p className="text-sm text-gray-400">Your strategies are never sold or shared</p>
                </div>
                <div 
                  className="p-6 bg-[#202938] rounded-xl transition-all duration-300 hover:-translate-y-1"
                  data-testid="data-control-transparency"
                >
                  <div className="text-4xl mb-4">📊</div>
                  <h4 className="font-semibold text-white mb-2">Usage Transparency</h4>
                  <p className="text-sm text-gray-400">Clear policies on how we process your data</p>
                </div>
              </div>
            </div>

            {/* Security Contact Footer */}
            <div className="text-center mt-12">
              <p className="text-gray-400">
                Questions about security? Contact us at{' '}
                <a href="mailto:security@premisia.ai" className="text-[#3b82f6] hover:text-[#10b981] transition-colors">
                  security@premisia.ai
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section 
          className="py-16 md:py-24 px-6 md:px-12 bg-[#1a1f2e]"
          data-testid="section-cta"
        >
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent" data-testid="heading-cta">
              Ready to Stop Overthinking and Start Building?
            </h2>
            <p className="text-base md:text-lg lg:text-xl text-gray-400 mb-8 md:mb-10 leading-relaxed">
              Join hundreds of founders and leaders who turned their wild ideas into executable strategies.
            </p>
            <button 
              onClick={handleSignIn}
              disabled={isSigningIn}
              className={cn(
                "px-8 md:px-12 py-4 md:py-5 bg-gradient-to-r from-[#3b82f6] to-[#10b981] text-white rounded-xl text-lg md:text-xl font-bold transition-all duration-300",
                !isSigningIn && "hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(59,130,246,0.5)]",
                isSigningIn && "opacity-90 cursor-not-allowed"
              )}
              data-testid="button-cta-final"
            >
              {isSigningIn ? (
                <span className="flex items-center justify-center gap-2">
                  <GeometricLoader type="orbit" size="small" />
                  <span>Starting...</span>
                </span>
              ) : (
                "Start Building Your Strategy →"
              )}
            </button>
            <p className="text-xs md:text-sm text-gray-500 mt-4 md:mt-6">
              No credit card required • Free to start • Takes 2 minutes
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer 
          className="py-12 md:py-16 px-6 text-center border-t border-[#202938]"
          data-testid="footer"
        >
          <div className="mb-4">
            <div className="text-xl md:text-2xl font-bold bg-gradient-to-r from-[#3b82f6] to-[#10b981] bg-clip-text text-transparent mb-2">
              PREMISIA
            </div>
            <p className="text-sm md:text-base text-[#10b981]">Think it through</p>
          </div>
          <p className="text-sm md:text-base text-gray-400">&copy; 2025 Premisia - Where Ideas Become Action</p>
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
      subtitle="Your strategic command center"
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
