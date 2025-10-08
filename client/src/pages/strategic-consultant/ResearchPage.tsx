import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, CheckCircle2, ExternalLink, ChevronDown, AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";

interface Finding {
  fact: string;
  citation: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ValidationResult {
  claim: string;
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  sourceCount: number;
  recencyMonths: number;
  hasCounterEvidence: boolean;
  contradicts: boolean;
  details: string;
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
  validation?: ValidationResult[];
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

const getValidationIndicator = (strength: 'STRONG' | 'MODERATE' | 'WEAK') => {
  switch (strength) {
    case 'STRONG':
      return '🟢';
    case 'MODERATE':
      return '🟡';
    case 'WEAK':
      return '🔴';
    default:
      return '⚪';
  }
};

const findValidationForClaim = (claim: string, validation?: ValidationResult[]): ValidationResult | null => {
  if (!validation) return null;
  
  const claimLower = claim.toLowerCase().replace(/[^\w\s]/g, '').trim();
  
  return validation.find(v => {
    const vClaimLower = v.claim.toLowerCase().replace(/[^\w\s]/g, '').trim();
    return claimLower.includes(vClaimLower) || vClaimLower.includes(claimLower);
  }) || null;
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
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isResearching, setIsResearching] = useState(false);
  const [researchData, setResearchData] = useState<ResearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [autoNavigateCountdown, setAutoNavigateCountdown] = useState<number | null>(null);
  const [isUpdatingDecisions, setIsUpdatingDecisions] = useState(false);
  const [decisionsUpdated, setDecisionsUpdated] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const rootCause = localStorage.getItem(`strategic-rootCause-${sessionId}`) || '';
    const whysPathStr = localStorage.getItem(`strategic-whysPath-${sessionId}`) || '[]';
    const whysPath = JSON.parse(whysPathStr);
    const input = localStorage.getItem(`strategic-input-${sessionId}`) || '';

    if (!rootCause || !whysPath.length || !input) {
      setError('Missing required data from previous steps');
      return;
    }

    setIsResearching(true);
    const startTime = Date.now();

    const params = new URLSearchParams({
      rootCause,
      whysPath: JSON.stringify(whysPath),
      input,
    });

    const eventSource = new EventSource(`/api/strategic-consultant/research/stream/${sessionId}?${params.toString()}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'progress' || data.type === 'query') {
        setProgress(data.progress || 0);
        setCurrentQuery(data.message || '');
      } else if (data.type === 'complete') {
        setProgress(100);
        setResearchData(data.data);
        setIsResearching(false);
        localStorage.setItem(`strategic-versionNumber-${sessionId}`, data.data.versionNumber.toString());
        toast({
          title: "Research complete ✓",
          description: `Analyzed ${data.data.sourcesAnalyzed} sources in ${data.data.timeElapsed}`,
        });
        eventSource.close();
      } else if (data.type === 'error') {
        setError(data.error || 'Research failed');
        setIsResearching(false);
        toast({
          title: "Research failed",
          description: data.error || "Failed to conduct market research",
          variant: "destructive",
        });
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setError('Connection to research stream failed');
      setIsResearching(false);
      eventSource.close();
    };

    const timerInterval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => {
      eventSource.close();
      clearInterval(timerInterval);
    };
  }, [sessionId]);

  // After research completes, run enhanced analysis and regenerate decisions
  useEffect(() => {
    if (!researchData || !sessionId) return;
    if (isUpdatingDecisions || decisionsUpdated) return;

    const rootCause = localStorage.getItem(`strategic-rootCause-${sessionId}`) || '';
    const whysPathStr = localStorage.getItem(`strategic-whysPath-${sessionId}`) || '[]';
    const whysPath = JSON.parse(whysPathStr);
    const versionNumber = researchData.versionNumber;

    const updateDecisions = async () => {
      setIsUpdatingDecisions(true);

      try {
        // Step 1: Run enhanced analysis (Porter's)
        toast({
          title: "⟳ Updating strategic decisions...",
          description: "Running Porter's Five Forces analysis based on research findings",
        });

        await apiRequest('POST', '/api/strategic-consultant/analyze-enhanced', {
          sessionId,
          rootCause,
          whysPath,
          versionNumber
        });

        // Step 2: Regenerate decisions with research
        toast({
          title: "⟳ Regenerating decisions...",
          description: "Updating recommendations to reflect research insights",
        });

        await apiRequest('POST', '/api/strategic-consultant/decisions/generate-with-research', {
          sessionId,
          versionNumber
        });

        setDecisionsUpdated(true);
        setIsUpdatingDecisions(false);

        toast({
          title: "✓ Decisions updated",
          description: "Recommendations now reflect research insights",
        });

        // Start auto-navigate countdown after decisions are updated
        setAutoNavigateCountdown(3);
      } catch (error: any) {
        console.error('Failed to update decisions:', error);
        setIsUpdatingDecisions(false);
        toast({
          title: "Warning: Decision update failed",
          description: "Continuing with original decisions. " + (error.message || ''),
          variant: "destructive",
        });
        // Still navigate even if decision update fails
        setAutoNavigateCountdown(3);
      }
    };

    updateDecisions();
  }, [researchData, sessionId, isUpdatingDecisions, decisionsUpdated, toast]);

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
    window.location.reload();
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

  if (isResearching) {
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
              <CardDescription data-testid="text-current-query">{currentQuery}</CardDescription>
              <CardDescription className="mt-2 text-sm text-muted-foreground">
                Time elapsed: {elapsedSeconds}s
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="h-2" data-testid="progress-research" />
              <p className="text-center mt-4 text-sm text-muted-foreground" data-testid="text-progress-percentage">
                {progress.toFixed(0)}% complete
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout
        title="Market Research"
        subtitle="Research failed"
        onViewChange={(view) => setLocation('/')}
      >
        <div className="max-w-4xl mx-auto space-y-8 py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Research Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex justify-center">
            <Button onClick={handleRetry} data-testid="button-retry-research">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Research
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!researchData) {
    return (
      <AppLayout
        title="Market Research"
        subtitle="Loading..."
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

  const { findings, sourcesAnalyzed, timeElapsed } = researchData;

  return (
    <AppLayout
      title="Market Research"
      subtitle="Comprehensive market intelligence gathered"
      onViewChange={(view) => setLocation('/')}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isUpdatingDecisions ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" data-testid="icon-updating" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-green-500" data-testid="icon-complete" />
            )}
            <div>
              {isUpdatingDecisions ? (
                <>
                  <h2 className="text-xl font-semibold" data-testid="text-updating-decisions">
                    ⟳ Updating strategic decisions based on research findings...
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Running Porter's analysis and regenerating recommendations
                  </p>
                </>
              ) : decisionsUpdated ? (
                <>
                  <h2 className="text-xl font-semibold text-green-600" data-testid="text-decisions-updated">
                    ✓ Decisions updated - recommendations now reflect research insights
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Sources analyzed: <span className="font-medium" data-testid="text-sources-count">{sourcesAnalyzed}</span> • 
                    Time: <span className="font-medium" data-testid="text-time-elapsed">{timeElapsed}</span>
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-semibold" data-testid="text-research-complete">
                    ✓ Research complete
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Sources analyzed: <span className="font-medium" data-testid="text-sources-count">{sourcesAnalyzed}</span> • 
                    Time: <span className="font-medium" data-testid="text-time-elapsed">{timeElapsed}</span>
                  </p>
                </>
              )}
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
                      {findings_list.map((finding, idx) => {
                        const validation = findValidationForClaim(finding.fact, findings.validation);
                        
                        return (
                          <div
                            key={idx}
                            className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                            data-testid={`finding-${key}-${idx}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-2 flex-1">
                                {validation && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span 
                                          className="text-lg cursor-help mt-0.5"
                                          data-testid={`validation-indicator-${key}-${idx}`}
                                        >
                                          {getValidationIndicator(validation.strength)}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <p className="font-semibold">{validation.strength}</p>
                                        <p className="text-xs mt-1">{validation.details}</p>
                                        {validation.contradicts && (
                                          <p className="text-xs mt-1 text-amber-500">
                                            ⚠️ Contradictory evidence found
                                          </p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                <p className="text-sm flex-1">{finding.fact}</p>
                              </div>
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
                        );
                      })}
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
