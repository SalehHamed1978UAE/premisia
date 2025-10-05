import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, CheckCircle2, ExternalLink, ChevronDown, AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";

interface Finding {
  fact: string;
  citation: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ResearchFindings {
  market_dynamics: Finding[];
  competitive_landscape: Finding[];
  language_preferences: Finding[];
  buyer_behavior: Finding[];
  regulatory_factors: Finding[];
  sources: Array<{
    url: string;
    title: string;
    relevance_score: number;
  }>;
}

interface ResearchResponse {
  findings: ResearchFindings;
  searchQueriesUsed: string[];
  sourcesAnalyzed: number;
  timeElapsed: string;
  versionNumber: number;
}

const getConfidenceBadgeVariant = (confidence: string) => {
  switch (confidence.toLowerCase()) {
    case 'high':
      return 'default';
    case 'medium':
      return 'secondary';
    case 'low':
      return 'outline';
    default:
      return 'outline';
  }
};

const categoryConfig = [
  { key: 'market_dynamics', label: 'Market Dynamics', icon: '📊' },
  { key: 'competitive_landscape', label: 'Competitive Landscape', icon: '🏢' },
  { key: 'language_preferences', label: 'Language/Cultural Preferences', icon: '🌐' },
  { key: 'buyer_behavior', label: 'Buyer Behavior Patterns', icon: '👥' },
  { key: 'regulatory_factors', label: 'Regulatory/Compliance Factors', icon: '⚖️' },
];

export default function ResearchPage() {
  const [, params] = useRoute("/strategic-consultant/research/:sessionId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const sessionId = params?.sessionId;

  const [progress, setProgress] = useState(0);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [autoNavigateCountdown, setAutoNavigateCountdown] = useState<number | null>(null);

  const researchMutation = useMutation({
    mutationFn: async () => {
      const rootCause = localStorage.getItem(`strategic-rootCause-${sessionId}`) || '';
      const whysPathStr = localStorage.getItem(`strategic-whysPath-${sessionId}`) || '[]';
      const whysPath = JSON.parse(whysPathStr);
      const input = localStorage.getItem(`strategic-input-${sessionId}`) || '';

      if (!rootCause || !whysPath.length || !input) {
        throw new Error('Missing required data from previous steps');
      }

      const response = await apiRequest('POST', '/api/strategic-consultant/research', {
        sessionId,
        rootCause,
        whysPath,
        input,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem(`strategic-versionNumber-${sessionId}`, data.versionNumber.toString());
      toast({
        title: "Research complete",
        description: `Analyzed ${data.sourcesAnalyzed} sources in ${data.timeElapsed}`,
      });
      setAutoNavigateCountdown(3);
    },
    onError: (error) => {
      toast({
        title: "Research failed",
        description: error.message || "Failed to conduct market research",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (sessionId) {
      researchMutation.mutate();
    }
  }, [sessionId]);

  useEffect(() => {
    if (researchMutation.isPending) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return 95;
          return prev + 1;
        });
      }, 300);

      return () => clearInterval(interval);
    } else if (researchMutation.isSuccess) {
      setProgress(100);
    }
  }, [researchMutation.isPending, researchMutation.isSuccess]);

  useEffect(() => {
    if (autoNavigateCountdown === null) return;

    if (autoNavigateCountdown === 0) {
      setLocation(`/strategic-consultant/analysis/${sessionId}`);
      return;
    }

    const timer = setTimeout(() => {
      setAutoNavigateCountdown(autoNavigateCountdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [autoNavigateCountdown, sessionId, setLocation]);

  const handleContinue = () => {
    setAutoNavigateCountdown(null);
    setLocation(`/strategic-consultant/analysis/${sessionId}`);
  };

  const handleRetry = () => {
    setProgress(0);
    researchMutation.mutate();
  };

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Invalid Session</AlertTitle>
          <AlertDescription>No session ID provided in URL</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (researchMutation.isPending) {
    return (
      <AppLayout
        title="Market Research"
        subtitle="Conducting comprehensive market analysis"
        onViewChange={(view) => setLocation('/')}
      >
        <div className="max-w-4xl mx-auto space-y-8 py-12">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <CardTitle className="text-2xl" data-testid="text-research-status">
                Researching market conditions...
              </CardTitle>
              <CardDescription>
                Analyzing market dynamics, competition, and strategic opportunities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progress} className="h-2" data-testid="progress-research" />
              <p className="text-center text-sm text-muted-foreground" data-testid="text-progress-percent">
                {progress}% complete
              </p>
              <div className="pt-4 space-y-2">
                <p className="text-xs text-muted-foreground text-center">
                  This may take 20-30 seconds as we gather comprehensive market intelligence
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (researchMutation.isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Research Failed</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>{researchMutation.error?.message || "Failed to conduct market research"}</p>
            <Button
              onClick={handleRetry}
              variant="outline"
              className="w-full"
              data-testid="button-retry"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Research
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!researchMutation.data) {
    return null;
  }

  const { findings, sourcesAnalyzed, timeElapsed } = researchMutation.data;

  return (
    <AppLayout
      title="Market Research"
      subtitle="Comprehensive market intelligence gathered"
      onViewChange={(view) => setLocation('/')}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500" data-testid="icon-complete" />
            <div>
              <h2 className="text-xl font-semibold" data-testid="text-research-complete">
                Research complete ✓
              </h2>
              <p className="text-sm text-muted-foreground">
                Sources analyzed: <span className="font-medium" data-testid="text-sources-count">{sourcesAnalyzed}</span> • 
                Time: <span className="font-medium" data-testid="text-time-elapsed">{timeElapsed}</span>
              </p>
            </div>
          </div>
          {autoNavigateCountdown !== null && (
            <div className="text-sm text-muted-foreground">
              Auto-navigating in {autoNavigateCountdown}s...
            </div>
          )}
        </div>

        {findings.sources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Research Sources</CardTitle>
              <CardDescription>Top sources used for analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {findings.sources.map((source: { url: string; title: string; relevance_score: number }, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded border"
                    data-testid={`source-${idx}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{source.title}</p>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline truncate block"
                        data-testid={`link-source-${idx}`}
                      >
                        {source.url}
                      </a>
                    </div>
                    <Badge variant="outline" className="ml-2 shrink-0">
                      {(source.relevance_score * 100).toFixed(0)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {categoryConfig.map(({ key, label, icon }) => {
            const findings_list = findings[key as keyof typeof findings] as Finding[];
            if (!Array.isArray(findings_list) || findings_list.length === 0) return null;

            const isOpen = openSections[key] !== false;

            return (
              <Card key={key} data-testid={`section-${key}`}>
                <Collapsible open={isOpen} onOpenChange={() => toggleSection(key)}>
                  <CardHeader className="cursor-pointer" onClick={() => toggleSection(key)}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{icon}</span>
                          <CardTitle className="text-lg">{label}</CardTitle>
                          <Badge variant="secondary">{findings_list.length}</Badge>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="space-y-4">
                      {findings_list.map((finding, idx) => (
                        <div
                          key={idx}
                          className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                          data-testid={`finding-${key}-${idx}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm flex-1">{finding.fact}</p>
                            <Badge
                              variant={getConfidenceBadgeVariant(finding.confidence)}
                              className="shrink-0"
                              data-testid={`badge-confidence-${key}-${idx}`}
                            >
                              {finding.confidence}
                            </Badge>
                          </div>
                          <a
                            href={finding.citation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline"
                            data-testid={`link-citation-${key}-${idx}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                            View source
                          </a>
                        </div>
                      ))}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end pt-4">
          <Button
            size="lg"
            onClick={handleContinue}
            data-testid="button-continue-analysis"
          >
            Continue to Strategic Analysis
            {autoNavigateCountdown !== null && ` (${autoNavigateCountdown})`}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
