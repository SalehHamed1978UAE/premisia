import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { AnimatedBackground } from "./AnimatedBackground";
import { ProgressTimeline } from "./ProgressTimeline";
import { type InsightCardData } from "./InsightCard";
import { StatsPanel } from "./StatsPanel";
import { NarrativeBeat } from "./NarrativeBeat";

interface ResearchExperienceProps {
  progress: number;
  currentMessage: string;
  elapsedSeconds: number;
  onComplete?: () => void;
}

const SIMPLE_MODE_KEY = "research-simple-mode-preference";

export function PortersResearchExperience({
  progress,
  currentMessage,
  elapsedSeconds,
  onComplete,
}: ResearchExperienceProps) {
  const [showSimpleMode, setShowSimpleMode] = useState(() => {
    const stored = localStorage.getItem(SIMPLE_MODE_KEY);
    return stored === "true";
  });

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [insights, setInsights] = useState<InsightCardData[]>([]);
  const [narrativeBeat, setNarrativeBeat] = useState<string>("");
  const [stats, setStats] = useState({
    sourcesScanned: 0,
    articlesAnalyzed: 0,
    contradictionsFlagged: 0,
  });

  // Check for prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Parse currentMessage for insights and narrative beats
  useEffect(() => {
    if (!currentMessage) return;

    const messageLower = currentMessage.toLowerCase();

    // Extract insight cards from message patterns
    if (messageLower.includes("found") || messageLower.includes("discovered") || messageLower.includes("analyzing")) {
      const categories = ["market_dynamics", "competitive_landscape", "buyer_behavior", "regulatory_factors", "language_preferences"];
      const matchedCategory = categories.find(cat => messageLower.includes(cat.replace(/_/g, " ")));
      
      if (matchedCategory && insights.length < 5) {
        const newInsight: InsightCardData = {
          id: `insight-${Date.now()}-${Math.random()}`,
          category: matchedCategory,
          headline: currentMessage.substring(0, 60),
          summary: currentMessage.length > 60 ? currentMessage.substring(0, 120) + "..." : currentMessage,
          confidence: 0.6 + Math.random() * 0.3,
          sourcesCount: Math.floor(Math.random() * 5) + 1,
        };
        
        setInsights((prev) => {
          const updated = [newInsight, ...prev];
          return updated.slice(0, 5);
        });
      }
    }

    // Extract narrative beats from keywords
    const keywords = ["artisan", "premium", "local", "sustainable", "organic", "community", "quality", "authentic"];
    const foundKeyword = keywords.find(kw => messageLower.includes(kw));
    if (foundKeyword) {
      setNarrativeBeat(`Top keyword: ${foundKeyword}`);
    }

    // Update stats based on progress
    const newStats = {
      sourcesScanned: Math.floor(progress * 2.5),
      articlesAnalyzed: Math.floor(progress * 1.5),
      contradictionsFlagged: Math.floor(progress * 0.3),
    };
    setStats(newStats);
  }, [currentMessage, progress]);

  // Call onComplete when research finishes
  useEffect(() => {
    if (progress >= 100 && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [progress, onComplete]);

  const toggleSimpleMode = () => {
    const newMode = !showSimpleMode;
    setShowSimpleMode(newMode);
    localStorage.setItem(SIMPLE_MODE_KEY, String(newMode));
  };

  const shouldReduceMotion = prefersReducedMotion || showSimpleMode;

  // Simple mode fallback
  if (showSimpleMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSimpleMode}
            data-testid="button-toggle-animations"
          >
            <Eye className="w-4 h-4 mr-2" />
            Show Animations
          </Button>
        </div>

        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl" data-testid="text-research-title">
              Conducting Market Research
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2" data-testid="text-current-message">
              {currentMessage}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-3" data-testid="progress-bar-simple" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium" data-testid="text-progress-percent">
                {Math.floor(progress)}%
              </span>
            </div>
            <div className="text-center text-xs text-muted-foreground">
              Time elapsed: {elapsedSeconds}s
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Immersive animated mode
  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="research-experience">
      {/* Animated Background */}
      <AnimatedBackground prefersReducedMotion={shouldReduceMotion} />

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <div className="p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-research-title">
                Market Research in Progress
              </h1>
              <div className="text-sm text-muted-foreground">
                {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, "0")}
              </div>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-current-message">
              {currentMessage}
            </p>
          </div>
        </div>

        {/* Progress Timeline */}
        <div className="px-4 md:px-6 mb-6">
          <div className="max-w-7xl mx-auto">
            <ProgressTimeline
              progress={progress}
              prefersReducedMotion={shouldReduceMotion}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 px-4 md:px-6 pb-20">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-center">
              {/* Stats Panel (centered) */}
              <div className="w-full max-w-md space-y-4">
                <h2 className="text-lg font-semibold mb-4">Research Stats</h2>
                <StatsPanel
                  sourcesScanned={stats.sourcesScanned}
                  articlesAnalyzed={stats.articlesAnalyzed}
                  contradictionsFlagged={stats.contradictionsFlagged}
                  prefersReducedMotion={shouldReduceMotion}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Controls (bottom-right) */}
        <div className="fixed bottom-4 right-4 z-20 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSimpleMode}
            className="bg-background/80 backdrop-blur-sm"
            data-testid="button-skip-animation"
          >
            <EyeOff className="w-4 h-4 mr-2" />
            Skip Animation
          </Button>
        </div>
      </div>

      {/* Narrative Beats */}
      {narrativeBeat && (
        <NarrativeBeat
          message={narrativeBeat}
          duration={3000}
          prefersReducedMotion={shouldReduceMotion}
        />
      )}
    </div>
  );
}
