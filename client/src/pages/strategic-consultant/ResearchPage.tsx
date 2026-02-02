import { useEffect, useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, CheckCircle2, ExternalLink, ChevronDown, AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { ResearchExperience } from "@/components/research-experience/ResearchExperience";
import { BMCCanvas, type BMCAnalysis } from "@/components/strategic-consultant/BMCCanvas";

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
  const [logEntries, setLogEntries] = useState<Array<{
    id: string;
    timestamp: string;
    type: 'context' | 'query' | 'synthesis' | 'progress' | 'complete' | 'debug';
    message: string;
    meta?: Record<string, string>;
  }>>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [bmcAnalysis, setBmcAnalysis] = useState<BMCAnalysis | null>(null);
  
  // Use ref to prevent double execution in React Strict Mode
  const hasInitiatedResearch = useRef(false);

  // Fetch journey session to get authoritative journey type
  const { data: journeySession, isLoading: loadingJourney } = useQuery({
    queryKey: ['journey-session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const res = await fetch(`/api/strategic-consultant/journey-sessions/by-session/${sessionId}`);
      if (!res.ok) {
        console.warn(`[ResearchPage] Journey session not found for ${sessionId}, will use fallback`);
        return null;
      }
      return res.json();
    },
    enabled: !!sessionId,
  });

  // Clear stale data when sessionId changes
  useEffect(() => {
    setLogEntries([]);
    setNextUrl(null);
    setResearchData(null);
    setError(null);
    setProgress(0);
    setBmcAnalysis(null);
    setAutoAdvance(true);
    hasInitiatedResearch.current = false;
    
    // Clear stale localStorage entries for this session
    if (sessionId) {
      localStorage.removeItem(`strategic-rootCause-${sessionId}`);
      localStorage.removeItem(`strategic-whysPath-${sessionId}`);
      localStorage.removeItem(`strategic-input-${sessionId}`);
      localStorage.removeItem(`strategic-versionNumber-${sessionId}`);
      localStorage.removeItem(`journey-type-${sessionId}`);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || loadingJourney || hasInitiatedResearch.current) return;

    // Use backend journey type if available, fallback to localStorage
    const journeyType = journeySession?.journeyType || localStorage.getItem(`journey-type-${sessionId}`) || 'business_model_innovation';
    console.log(`[ResearchPage] Journey type: ${journeyType} (from ${journeySession?.journeyType ? 'backend' : 'localStorage or default'})`);

    // Determine which endpoint to use based on journey type
    // BMI uses BMC research endpoint (after Five Whys)
    // Market Entry uses Market Entry research endpoint (PESTLE→Porter's→SWOT)
    // Other journeys use BMC research endpoint (no Five Whys needed)
    const isBMCJourney = journeyType === 'business_model_innovation';
    const isMarketEntryJourney = journeyType === 'market_entry';

    // Five Whys data is only needed for journeys that explicitly use Five Whys framework
    // These are: business_model_innovation and crisis_recovery
    // Other journeys like competitive_strategy, digital_transformation, growth_strategy
    // go to Research page for BMC but don't use Five Whys
    const fiveWhysJourneys = ['business_model_innovation', 'crisis_recovery'];
    const requiresFiveWhys = fiveWhysJourneys.includes(journeyType);
    
    // Only require Five Whys data for journeys that need it
    if (requiresFiveWhys) {
      const rootCause = localStorage.getItem(`strategic-rootCause-${sessionId}`) || '';
      const whysPathStr = localStorage.getItem(`strategic-whysPath-${sessionId}`) || '[]';
      const whysPath = JSON.parse(whysPathStr);
      const input = localStorage.getItem(`strategic-input-${sessionId}`) || '';
      
      if (!rootCause || !whysPath.length || !input) {
        setError('Missing required data from previous steps');
        return;
      }
    }

    setIsResearching(true);
    const startTime = Date.now();
    
    let eventSource: EventSource;

    if (isMarketEntryJourney) {
      // For Market Entry journeys, use dedicated PESTLE→Porter's→SWOT stream
      eventSource = new EventSource(`/api/strategic-consultant/market-entry-research/stream/${sessionId}`);
      console.log('[ResearchPage] Using Market Entry research endpoint (PESTLE→Porter\'s→SWOT)');
    } else if (requiresFiveWhys) {
      // For journeys that use Five Whys (BMI, crisis_recovery), use standard research stream
      const rootCause = localStorage.getItem(`strategic-rootCause-${sessionId}`) || '';
      const whysPathStr = localStorage.getItem(`strategic-whysPath-${sessionId}`) || '[]';
      const whysPath = JSON.parse(whysPathStr);
      const input = localStorage.getItem(`strategic-input-${sessionId}`) || '';
      const params = new URLSearchParams({
        rootCause,
        whysPath: JSON.stringify(whysPath),
        input,
      });
      eventSource = new EventSource(`/api/strategic-consultant/research/stream/${sessionId}?${params.toString()}`);
      console.log(`[ResearchPage] Using Five Whys research endpoint for ${journeyType}`);
    } else {
      // For other journeys (competitive_strategy, digital_transformation, growth_strategy)
      // Use BMC research stream - input is fetched from journey session on backend
      eventSource = new EventSource(`/api/strategic-consultant/bmc-research/stream/${sessionId}`);
      console.log(`[ResearchPage] Using BMC research endpoint for ${journeyType}`);
    }

    console.log('[ResearchPage] Connecting to research stream:', eventSource.url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[ResearchPage] Received message:', data.type || 'unknown', data);

        // Handle debug event - log debugInput to console for QA verification
        if (data.type === 'debug' && data.debugInput) {
          console.log('[ResearchPage] 🔍 Debug Input:', data.debugInput);
        }

        // Append log entry for streaming events
        if (data.type === 'context' || data.type === 'query' || data.type === 'synthesis' || data.type === 'progress' || data.type === 'complete' || data.type === 'debug') {
          const logEntry = {
            id: `${data.type}-${Date.now()}-${Math.random()}`,
            timestamp: new Date().toISOString(),
            type: data.type as 'context' | 'query' | 'synthesis' | 'progress' | 'complete' | 'debug',
            message: data.message || data.query || data.debugInput || `${data.block || 'Unknown'}`,
            meta: data.purpose ? { purpose: data.purpose, queryType: data.queryType } : (data.progress !== undefined ? { progress: data.progress.toString() } : undefined),
          };
          setLogEntries(prev => [...prev, logEntry]);
        }

        if (data.type === 'progress' || data.type === 'query') {
          setProgress(data.progress || 0);
          setCurrentQuery(data.message || data.query || '');
        } else if (data.type === 'complete') {
          setProgress(100);
          setResearchData(data.data);
          setIsResearching(false);
          
          // Capture nextUrl from complete event
          if (data.data.nextUrl) {
            setNextUrl(data.data.nextUrl);
          }
          
          // Capture BMC analysis for 9-block canvas display
          if (data.data.bmcAnalysis) {
            setBmcAnalysis(data.data.bmcAnalysis);
            // Disable auto-advance when we have BMC analysis so user can review the 9-block
            setAutoAdvance(false);
          }
          
          localStorage.setItem(`strategic-versionNumber-${sessionId}`, data.data.versionNumber.toString());
          toast({
            title: "Research complete ✓",
            description: `Analyzed ${data.data.sourcesAnalyzed} sources in ${data.data.timeElapsed}`,
          });
          eventSource.close();
        } else if (data.type === 'error') {
          console.error('[ResearchPage] Research error from backend:', data.error);
          setError(data.error || 'Research failed');
          setIsResearching(false);
          toast({
            title: "Research failed",
            description: data.error || "Failed to conduct market research",
            variant: "destructive",
          });
          eventSource.close();
        }
      } catch (parseError) {
        console.error('[ResearchPage] Error parsing SSE message:', parseError, event.data);
      }
    };

    eventSource.onerror = (event) => {
      console.error('[ResearchPage] EventSource error:', {
        readyState: eventSource.readyState,
        url: eventSource.url,
        event
      });
      
      const errorMessage = eventSource.readyState === EventSource.CLOSED 
        ? 'Connection closed by server - the research request may have timed out or encountered an error'
        : 'Connection to research stream failed - check your network connection';
      
      setError(errorMessage);
      setIsResearching(false);
      hasInitiatedResearch.current = false; // Reset to allow retries
      eventSource.close();
      
      toast({
        title: "Connection Error",
        description: errorMessage,
        variant: "destructive",
      });
    };

    eventSource.onopen = () => {
      console.log('[ResearchPage] EventSource connection opened successfully');
      // Mark as initiated only after successful connection (prevents Strict Mode double execution)
      hasInitiatedResearch.current = true;
    };

    const timerInterval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => {
      eventSource.close();
      clearInterval(timerInterval);
    };
  }, [sessionId, loadingJourney, journeySession, toast]);

  // Navigate immediately when both researchData and nextUrl are ready (if autoAdvance is enabled)
  useEffect(() => {
    if (!researchData || !nextUrl || !autoAdvance) return;

    console.log('[ResearchPage] Both researchData and nextUrl ready, auto-navigating to:', nextUrl);
    toast({
      title: "✓ Research complete",
      description: "Proceeding to next step in your journey",
    });
    setLocation(nextUrl);
  }, [researchData, nextUrl, autoAdvance, setLocation, toast]);

  const handleContinue = () => {
    console.log('[ResearchPage] Manual continue to:', nextUrl);
    if (nextUrl) {
      setLocation(nextUrl);
    }
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
      <ResearchExperience
        progress={progress}
        currentMessage={currentQuery}
        elapsedSeconds={elapsedSeconds}
      />
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
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 p-4 sm:p-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" data-testid="icon-complete" />
            <div>
              <h2 className="text-xl font-semibold text-green-600" data-testid="text-research-complete">
                ✓ Research complete
              </h2>
              <p className="text-sm text-muted-foreground break-words">
                Sources analyzed: <span className="font-medium" data-testid="text-sources-count">{sourcesAnalyzed}</span> • 
                Time: <span className="font-medium" data-testid="text-time-elapsed">{timeElapsed}</span>
              </p>
            </div>
          </div>
        </div>

        {/* BMC 9-Block Canvas Display */}
        {bmcAnalysis && bmcAnalysis.blocks && bmcAnalysis.blocks.length > 0 && (
          <div className="mt-6" data-testid="bmc-canvas-section">
            <h3 className="text-lg font-semibold mb-4">Business Model Canvas</h3>
            <BMCCanvas analysis={bmcAnalysis} />
          </div>
        )}

        {findings && findings.sources && findings.sources.length > 0 && (
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg">Research Sources</CardTitle>
              <CardDescription>Top sources used for analysis</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
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

        {!findings || Object.keys(findings).filter(k => k !== 'sources' && k !== 'validation').every(k => !findings[k as keyof typeof findings] || (findings[k as keyof typeof findings] as any[]).length === 0) ? (
          <Card>
            <CardHeader>
              <CardTitle>No findings available</CardTitle>
              <CardDescription>
                The research didn't produce detailed findings. You can still continue to the next step.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <div className="space-y-4">
          {findings && categoryConfig.map(({ key, label, icon }) => {
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
            className="w-full sm:w-auto"
            disabled={!nextUrl}
          >
            {nextUrl ? (
              "Continue to Strategic Analysis"
            ) : (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing next step...
              </>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
