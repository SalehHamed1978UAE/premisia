import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { AnimatedBackground } from "./AnimatedBackground";

interface BMCResearchExperienceProps {
  progress: number;
  currentMessage: string;
  elapsedSeconds: number;
  onComplete?: () => void;
}

interface BlockStatus {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'complete';
  message?: string;
}

const BMC_BLOCKS = [
  { id: 'customer_segments', name: 'Customer Segments' },
  { id: 'value_propositions', name: 'Value Propositions' },
  { id: 'channels', name: 'Channels' },
  { id: 'customer_relationships', name: 'Customer Relationships' },
  { id: 'revenue_streams', name: 'Revenue Streams' },
  { id: 'key_resources', name: 'Key Resources' },
  { id: 'key_activities', name: 'Key Activities' },
  { id: 'key_partnerships', name: 'Key Partnerships' },
  { id: 'cost_structure', name: 'Cost Structure' },
];

const SIMPLE_MODE_KEY = "research-simple-mode-preference";

export function BMCResearchExperience({
  progress,
  currentMessage,
  elapsedSeconds,
  onComplete,
}: BMCResearchExperienceProps) {
  const [showSimpleMode, setShowSimpleMode] = useState(() => {
    const stored = localStorage.getItem(SIMPLE_MODE_KEY);
    return stored === "true";
  });

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [blocks, setBlocks] = useState<BlockStatus[]>(
    BMC_BLOCKS.map(b => ({ ...b, status: 'pending' as const }))
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!currentMessage) return;

    const messageLower = currentMessage.toLowerCase();

    setBlocks(prev => prev.map(block => {
      const blockNameLower = block.name.toLowerCase();
      const blockIdSpaced = block.id.replace(/_/g, ' ');
      
      if (messageLower.includes(blockNameLower) || messageLower.includes(blockIdSpaced)) {
        if (messageLower.includes('analyzing') || messageLower.includes('researching') || messageLower.includes('examining')) {
          return { ...block, status: 'in_progress', message: currentMessage };
        }
        if (messageLower.includes('complete') || messageLower.includes('found') || messageLower.includes('discovered')) {
          return { ...block, status: 'complete', message: currentMessage };
        }
        return { ...block, status: 'in_progress', message: currentMessage };
      }
      return block;
    }));

    const progressPerBlock = 100 / BMC_BLOCKS.length;
    const completedBlocks = Math.floor(progress / progressPerBlock);
    
    setBlocks(prev => prev.map((block, index) => {
      if (index < completedBlocks && block.status === 'pending') {
        return { ...block, status: 'complete' };
      }
      if (index === completedBlocks && block.status === 'pending') {
        return { ...block, status: 'in_progress' };
      }
      return block;
    }));
  }, [currentMessage, progress]);

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

  const completedCount = blocks.filter(b => b.status === 'complete').length;
  const inProgressCount = blocks.filter(b => b.status === 'in_progress').length;

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
              Business Model Canvas Analysis
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2" data-testid="text-current-message">
              {currentMessage}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-3" data-testid="progress-bar-simple" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Analyzing {completedCount}/9 blocks</span>
              <span className="font-medium" data-testid="text-progress-percent">
                {Math.floor(progress)}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {blocks.map(block => (
                <div 
                  key={block.id}
                  className={`p-2 rounded border ${
                    block.status === 'complete' ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' :
                    block.status === 'in_progress' ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800' :
                    'bg-muted border-border'
                  }`}
                  data-testid={`block-status-${block.id}`}
                >
                  <div className="flex items-center gap-1">
                    {block.status === 'complete' && <Check className="w-3 h-3 text-green-600" />}
                    {block.status === 'in_progress' && <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />}
                    <span className="truncate">{block.name}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center text-xs text-muted-foreground">
              Time elapsed: {elapsedSeconds}s
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="bmc-research-experience">
      <AnimatedBackground prefersReducedMotion={shouldReduceMotion} />

      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-research-title">
                Business Model Canvas Analysis
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

        <div className="px-4 md:px-6 mb-6">
          <div className="max-w-7xl mx-auto">
            <Progress value={progress} className="h-2" data-testid="progress-bar" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{completedCount} of 9 blocks complete</span>
              <span>{Math.floor(progress)}%</span>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 md:px-6 pb-20">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-lg font-semibold mb-4">9-Block Canvas Synthesis</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {blocks.map(block => (
                <Card 
                  key={block.id}
                  className={`transition-all duration-300 ${
                    block.status === 'complete' ? 'border-green-500 bg-green-50/50 dark:bg-green-950/30' :
                    block.status === 'in_progress' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-lg' :
                    'opacity-60'
                  }`}
                  data-testid={`block-card-${block.id}`}
                >
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{block.name}</CardTitle>
                      {block.status === 'complete' && (
                        <Check className="w-4 h-4 text-green-600" />
                      )}
                      {block.status === 'in_progress' && (
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      )}
                    </div>
                  </CardHeader>
                  {block.message && block.status !== 'pending' && (
                    <CardContent className="py-2 px-4">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {block.message}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h3 className="text-sm font-medium mb-2">What's happening</h3>
              <p className="text-xs text-muted-foreground">
                Analyzing your business model across 9 key dimensions. Each block represents 
                a critical aspect of your value creation and delivery system.
              </p>
            </div>
          </div>
        </div>

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
    </div>
  );
}
