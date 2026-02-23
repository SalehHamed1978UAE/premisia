import { useEffect, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  CheckCircle2, 
  Target, 
  AlertTriangle, 
  Library, 
  XCircle,
  ArrowRight,
  Sparkles,
  Briefcase,
  Building2
} from "lucide-react";

const formatLabel = (value: string | undefined): string => {
  if (!value) return 'Unknown';
  return value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface Genome {
  id: string;
  genes: {
    industry_vertical: string;
    company_size: string;
    decision_maker: string;
    purchase_trigger: string;
    tech_adoption: string;
    buying_process: string;
    budget_authority: string;
    urgency_profile: string;
  };
  fitness: {
    painIntensity: number;
    accessToDecisionMaker: number;
    purchasePowerMatch: number;
    competitionSaturation: number;
    productFit: number;
    urgencyAlignment: number;
    scalePotential: number;
    gtmEfficiency: number;
    totalScore: number;
  };
  narrativeReason: string;
}

interface GeneLibrary {
  dimensions: {
    industry_vertical: string[];
    company_size: string[];
    decision_maker: string[];
    purchase_trigger: string[];
    tech_adoption: string[];
    buying_process: string[];
    budget_authority: string[];
    urgency_profile: string[];
  };
}

interface SegmentSynthesis {
  beachhead: {
    genome: Genome;
    rationale: string;
    validationPlan: string[];
  };
  backupSegments: Genome[];
  neverList: {
    genome: Genome;
    reason: string;
  }[];
  strategicInsights: string[];
}

interface DiscoveryResults {
  geneLibrary: GeneLibrary;
  genomes: Genome[];
  synthesis: SegmentSynthesis;
  offeringDescription?: string;
  offeringType?: string;
  stage?: string;
  gtmConstraint?: string;
  salesMotion?: string;
}

interface ProgressEvent {
  step: string;
  progress: number;
  message: string;
}

type PageState = 'starting' | 'progress' | 'results' | 'error';

export default function SegmentDiscoveryPage() {
  // Support both /segment-discovery/:id and /results/:id routes
  const [, discoveryParams] = useRoute("/marketing-consultant/segment-discovery/:understandingId");
  const [, resultsParams] = useRoute("/marketing-consultant/results/:understandingId");
  const understandingId = discoveryParams?.understandingId || resultsParams?.understandingId;
  const isViewingResults = !!resultsParams?.understandingId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [pageState, setPageState] = useState<PageState>(isViewingResults ? 'results' : 'starting');
  const [currentStep, setCurrentStep] = useState('Initializing...');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasStartedRef = useRef(false);
  const sseRetryCountRef = useRef(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const usePollingFallbackRef = useRef(false);
  
  const STORAGE_KEY = `segment-discovery-progress-${understandingId}`;
  const MAX_SSE_RETRIES = 3;
  const POLL_INTERVAL_MS = 5000;

  const { data: results, refetch: refetchResults } = useQuery<DiscoveryResults>({
    queryKey: ['/api/marketing-consultant/results', understandingId],
    enabled: pageState === 'results',
  });

  useEffect(() => {
    // Skip if viewing saved results
    if (isViewingResults) return;
    if (!understandingId || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const checkAndResume = async () => {
      try {
        const savedProgress = restoreProgress();
        
        const statusResponse = await authFetch(`/api/marketing-consultant/discovery-status/${understandingId}`);
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          
          if (statusData.status === 'completed') {
            console.log('[SegmentDiscovery] Discovery already completed');
            clearProgress();
            setPageState('results');
            refetchResults();
            return;
          } else if (statusData.status === 'failed') {
            console.log('[SegmentDiscovery] Discovery failed');
            clearProgress();
            setErrorMessage(statusData.error || 'Discovery failed');
            setPageState('error');
            return;
          } else if (statusData.status === 'running') {
            console.log('[SegmentDiscovery] Resuming in-flight discovery');
            if (statusData.progressMessage) {
              setCurrentStep(statusData.progressMessage);
            }
            setPageState('progress');
            connectToSSE();
            return;
          }
          // If status is 'pending', fall through to call start-discovery
        }

        const response = await authFetch(`/api/marketing-consultant/start-discovery/${understandingId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to start discovery');
        }

        setPageState('progress');
        connectToSSE();
      } catch (error: any) {
        console.error('[SegmentDiscovery] Start error:', error);
        setErrorMessage(error.message || 'Failed to start segment discovery');
        setPageState('error');
        toast({
          title: "Error",
          description: error.message || 'Failed to start segment discovery',
          variant: "destructive",
        });
      }
    };

    checkAndResume();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [understandingId, isViewingResults, toast]);

  const saveProgress = (step: string, prog: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, progress: prog, timestamp: Date.now() }));
    } catch (e) {
      console.warn('[SegmentDiscovery] Failed to save progress to localStorage');
    }
  };

  const restoreProgress = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (Date.now() - data.timestamp < 600000) {
          setCurrentStep(data.step);
          setProgress(data.progress);
          console.log('[SegmentDiscovery] Restored progress:', data);
          return data;
        }
      }
    } catch (e) {
      console.warn('[SegmentDiscovery] Failed to restore progress');
    }
    return null;
  };

  const clearProgress = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  };

  const startPollingFallback = () => {
    if (pollingIntervalRef.current) return;
    
    console.log('[SegmentDiscovery] Switching to polling fallback');
    usePollingFallbackRef.current = true;
    
    const poll = async () => {
      try {
        const response = await authFetch(`/api/marketing-consultant/discovery-status/${understandingId}`);
        if (!response.ok) {
          throw new Error('Poll failed');
        }
        const data = await response.json();
        
        if (data.status === 'completed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          clearProgress();
          setPageState('results');
          refetchResults();
        } else if (data.status === 'failed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          clearProgress();
          setErrorMessage(data.error || 'Discovery failed');
          setPageState('error');
        } else if (data.progressMessage) {
          setCurrentStep(data.progressMessage);
        }
      } catch (e) {
        console.error('[SegmentDiscovery] Polling error:', e);
      }
    };

    poll();
    pollingIntervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
  };

  const connectToSSE = (retryAttempt = 0) => {
    if (!understandingId) return;

    restoreProgress();

    if (usePollingFallbackRef.current) {
      startPollingFallback();
      return;
    }

    const eventSource = new EventSource(`/api/marketing-consultant/discovery-stream/${understandingId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        setCurrentStep(data.step);
        setProgress(data.progress);
        saveProgress(data.step, data.progress);
        sseRetryCountRef.current = 0;

        if (data.step === 'complete' || data.progress >= 100) {
          eventSource.close();
          clearProgress();
          setPageState('results');
          refetchResults();
        }
      } catch (error) {
        console.error('[SegmentDiscovery] SSE parse error:', error);
      }
    };

    // Listen for heartbeat events to reset retry counter
    eventSource.addEventListener('heartbeat', () => {
      sseRetryCountRef.current = 0;
    });

    eventSource.onerror = (error) => {
      console.error('[SegmentDiscovery] SSE error:', error);
      eventSource.close();
      
      sseRetryCountRef.current++;
      
      if (sseRetryCountRef.current < MAX_SSE_RETRIES) {
        const backoffMs = Math.pow(2, sseRetryCountRef.current - 1) * 1000;
        console.log(`[SegmentDiscovery] SSE retry ${sseRetryCountRef.current}/${MAX_SSE_RETRIES} in ${backoffMs}ms`);
        toast({
          title: "Connection interrupted",
          description: `Reconnecting... (attempt ${sseRetryCountRef.current})`,
        });
        setTimeout(() => connectToSSE(sseRetryCountRef.current), backoffMs);
      } else {
        console.log('[SegmentDiscovery] SSE retries exhausted, switching to polling');
        toast({
          title: "Switching to polling mode",
          description: "Monitoring progress via polling...",
        });
        startPollingFallback();
      }
    };
  };

  const getScoreColor = (score: number) => {
    if (score > 32) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    if (score >= 24) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
  };

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" => {
    if (score > 32) return 'default';
    if (score >= 24) return 'secondary';
    return 'destructive';
  };

  const renderGeneDetails = (genes: Genome['genes']) => {
    const geneLabels: Record<keyof Genome['genes'], string> = {
      industry_vertical: 'Industry',
      company_size: 'Company Size',
      decision_maker: 'Decision Maker',
      purchase_trigger: 'Purchase Trigger',
      tech_adoption: 'Tech Adoption',
      buying_process: 'Buying Process',
      budget_authority: 'Budget Authority',
      urgency_profile: 'Urgency Profile',
    };

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {Object.entries(genes).map(([key, value]) => (
          <div key={key} className="text-sm">
            <span className="text-muted-foreground">{geneLabels[key as keyof Genome['genes']]}:</span>
            <span className="ml-1 font-medium">{value}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderFitnessScores = (fitness: Genome['fitness']) => {
    const scoreLabels: Record<string, string> = {
      painIntensity: 'Pain Intensity',
      accessToDecisionMaker: 'DM Access',
      purchasePowerMatch: 'Budget Match',
      competitionSaturation: 'Competition',
      productFit: 'Product Fit',
      urgencyAlignment: 'Urgency',
      scalePotential: 'Scale',
      gtmEfficiency: 'GTM Efficiency',
    };

    return (
      <div className="flex flex-wrap gap-2">
        {Object.entries(fitness).filter(([key]) => key !== 'totalScore').map(([key, value]) => (
          <Badge key={key} variant="outline" className="text-xs">
            {scoreLabels[key]}: {value}/5
          </Badge>
        ))}
      </div>
    );
  };

  if (!understandingId) {
    return (
      <AppLayout
        title="Segment Discovery"
        subtitle="Discovering your ideal customer segments"
      >
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive" data-testid="error-no-understanding-id">
            Error: No understanding ID found. Please start a new analysis.
          </p>
        </div>
      </AppLayout>
    );
  }

  if (pageState === 'starting') {
    return (
      <AppLayout
        title="Segment Discovery"
        subtitle="Initializing discovery engine..."
      >
        <div className="flex items-center justify-center min-h-[60vh]" data-testid="state-starting">
          <div className="text-center space-y-6">
            <div className="relative">
              <div className="w-24 h-24 mx-auto rounded-full border-4 border-primary/20 animate-pulse" />
              <Loader2 className="h-12 w-12 animate-spin text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Starting Segment Discovery</h3>
              <p className="text-sm text-muted-foreground mt-1">Preparing analysis engine...</p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const checkForResults = async () => {
    try {
      const response = await authFetch(`/api/marketing-consultant/discovery-status/${understandingId}`);
      if (!response.ok) throw new Error('Failed to check status');
      const data = await response.json();
      
      if (data.status === 'completed') {
        toast({
          title: "Results found!",
          description: "The analysis completed successfully.",
        });
        clearProgress();
        setPageState('results');
        refetchResults();
      } else if (data.status === 'running') {
        toast({
          title: "Still in progress",
          description: "Resuming monitoring...",
        });
        setErrorMessage(null);
        setPageState('progress');
        startPollingFallback();
      } else {
        toast({
          title: "No results available",
          description: "The analysis did not complete. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Check failed",
        description: "Could not verify results. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (pageState === 'error') {
    return (
      <AppLayout
        title="Segment Discovery"
        subtitle="An error occurred"
      >
        <div className="max-w-2xl mx-auto" data-testid="state-error">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-destructive mb-4">
                <AlertTriangle className="h-6 w-6" />
                <h3 className="font-semibold">Discovery Failed</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {errorMessage || 'An unexpected error occurred during segment discovery.'}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                If the analysis was interrupted, it may have completed in the background.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={checkForResults}
                  data-testid="button-check-results"
                >
                  Check for Results
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation('/marketing-consultant/input')}
                  data-testid="button-start-new"
                >
                  Start New Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (pageState === 'progress') {
    return (
      <AppLayout
        title="Segment Discovery"
        subtitle="Analyzing market segments..."
      >
        <div className="flex items-center justify-center min-h-[60vh]" data-testid="state-progress">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center space-y-4">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
                    className="text-primary transition-all duration-500"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-2xl font-bold" data-testid="text-progress-percent">
                  {progress}%
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                  <h3 className="text-lg font-semibold" data-testid="text-current-step">{currentStep}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Discovering your ideal customer segments...
                </p>
              </div>
            </div>

            <Progress value={progress} className="h-2" data-testid="progress-bar" />

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              {usePollingFallbackRef.current ? (
                <span className="flex items-center gap-1" data-testid="status-polling">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  Checking status...
                </span>
              ) : sseRetryCountRef.current > 0 ? (
                <span className="flex items-center gap-1" data-testid="status-reconnecting">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  Reconnecting ({sseRetryCountRef.current}/{MAX_SSE_RETRIES})...
                </span>
              ) : (
                <span className="flex items-center gap-1" data-testid="status-connected">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Live connection
                </span>
              )}
            </div>

            <div className="text-center text-xs text-muted-foreground">
              This may take a few minutes. Please don't close this page.
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (pageState === 'results' && results) {
    const { geneLibrary } = results;
    // Ensure genomes is an array (handles decryption edge cases)
    const genomes: Genome[] = Array.isArray(results.genomes) ? results.genomes : [];
    const top20 = genomes.slice(0, 20);
    
    // Ensure synthesis has valid structure (handles incomplete/corrupted data)
    const synthesis: SegmentSynthesis = results.synthesis && typeof results.synthesis === 'object' 
      ? results.synthesis as SegmentSynthesis
      : {
          beachhead: { genome: genomes[0] || {} as Genome, rationale: 'No synthesis data available', validationPlan: [] },
          backupSegments: [],
          neverList: [],
          strategicInsights: []
        };
    
    // Guard against missing beachhead
    const hasValidBeachhead = synthesis.beachhead && synthesis.beachhead.genome && synthesis.beachhead.genome.fitness;

    const alleleUsageCount = (dimension: keyof GeneLibrary['dimensions'], allele: string) => {
      return genomes.filter(g => g.genes[dimension] === allele).length;
    };

    return (
      <AppLayout
        title="Segment Discovery Complete"
        subtitle="Your market segmentation analysis is ready"
      >
        <div className="max-w-7xl mx-auto space-y-6" data-testid="state-results">
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                    Segment Discovery Complete!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    We analyzed {genomes.length} potential segments and identified your beachhead market.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-business-context">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Your Business</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.offeringDescription && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Business Idea</h4>
                  <p className="text-sm" data-testid="text-offering-description">{results.offeringDescription}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {results.offeringType && (
                  <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-offering-type">
                    <Briefcase className="h-3 w-3" />
                    {formatLabel(results.offeringType)}
                  </Badge>
                )}
                {results.stage && (
                  <Badge variant="outline" data-testid="badge-stage">
                    {formatLabel(results.stage)}
                  </Badge>
                )}
                {results.gtmConstraint && (
                  <Badge variant="outline" data-testid="badge-gtm">
                    {formatLabel(results.gtmConstraint)}
                  </Badge>
                )}
                {results.salesMotion && (
                  <Badge variant="outline" data-testid="badge-sales-motion">
                    {formatLabel(results.salesMotion)}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="beachhead" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="beachhead" data-testid="tab-beachhead">
                <Target className="h-4 w-4 mr-2" />
                Beachhead & Synthesis
              </TabsTrigger>
              <TabsTrigger value="top20" data-testid="tab-top20">
                Top 20 Segments
              </TabsTrigger>
              <TabsTrigger value="library" data-testid="tab-library">
                <Library className="h-4 w-4 mr-2" />
                Gene Library
              </TabsTrigger>
              <TabsTrigger value="never" data-testid="tab-never">
                <XCircle className="h-4 w-4 mr-2" />
                Never List
              </TabsTrigger>
            </TabsList>

            <TabsContent value="beachhead" className="space-y-6 mt-6">
              {hasValidBeachhead ? (
                <Card className="border-2 border-primary bg-primary/5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-6 w-6 text-primary" />
                        <CardTitle>Your Beachhead Market</CardTitle>
                      </div>
                      <Badge variant="default" className="text-lg px-4 py-1">
                        Score: {synthesis.beachhead.genome.fitness.totalScore}/40
                      </Badge>
                    </div>
                    <CardDescription>
                      This is your recommended initial target segment
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-2">Segment Profile</h4>
                      {renderGeneDetails(synthesis.beachhead.genome.genes)}
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Fitness Scores</h4>
                      {renderFitnessScores(synthesis.beachhead.genome.fitness)}
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Why This Segment?</h4>
                      <p className="text-sm text-muted-foreground" data-testid="text-beachhead-rationale">
                        {synthesis.beachhead.rationale}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Validation Plan</h4>
                      <ul className="space-y-2" data-testid="list-validation-plan">
                        {(synthesis.beachhead.validationPlan || []).map((step, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <input type="checkbox" className="mt-1" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-2 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-8 w-8 text-yellow-600" />
                      <div>
                        <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100">
                          Incomplete Analysis Data
                        </h3>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          The discovery process was interrupted. Please run a new segment discovery to get complete results.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {(synthesis.backupSegments || []).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Backup Segments</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="grid-backup-segments">
                    {synthesis.backupSegments.map((segment, idx) => (
                      <Card key={segment.id} data-testid={`card-backup-${idx}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Backup #{idx + 1}</CardTitle>
                            <Badge variant={getScoreBadgeVariant(segment.fitness.totalScore)}>
                              {segment.fitness.totalScore}/40
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground">{segment.narrativeReason}</p>
                          <div className="text-xs space-y-1">
                            <div><span className="text-muted-foreground">Industry:</span> {segment.genes.industry_vertical}</div>
                            <div><span className="text-muted-foreground">Size:</span> {segment.genes.company_size}</div>
                            <div><span className="text-muted-foreground">DM:</span> {segment.genes.decision_maker}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {(synthesis.strategicInsights || []).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Strategic Insights</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2" data-testid="list-strategic-insights">
                      {synthesis.strategicInsights.map((insight, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="top20" className="mt-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="grid-top20">
                {top20.map((genome, idx) => (
                  <Card 
                    key={genome.id} 
                    className={`${getScoreColor(genome.fitness.totalScore)}`}
                    data-testid={`card-segment-${idx}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">#{idx + 1}</CardTitle>
                        <Badge variant={getScoreBadgeVariant(genome.fitness.totalScore)}>
                          {genome.fitness.totalScore}/40
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm">{genome.narrativeReason}</p>
                      <div className="text-xs space-y-1">
                        <div><span className="opacity-70">Industry:</span> {genome.genes.industry_vertical}</div>
                        <div><span className="opacity-70">Size:</span> {genome.genes.company_size}</div>
                        <div><span className="opacity-70">DM:</span> {genome.genes.decision_maker}</div>
                        <div><span className="opacity-70">Trigger:</span> {genome.genes.purchase_trigger}</div>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="grid grid-cols-4 gap-1 text-xs">
                          <div title="Pain">P:{genome.fitness.painIntensity}</div>
                          <div title="Access">A:{genome.fitness.accessToDecisionMaker}</div>
                          <div title="Budget">B:{genome.fitness.purchasePowerMatch}</div>
                          <div title="Competition">C:{genome.fitness.competitionSaturation}</div>
                          <div title="Fit">F:{genome.fitness.productFit}</div>
                          <div title="Urgency">U:{genome.fitness.urgencyAlignment}</div>
                          <div title="Scale">S:{genome.fitness.scalePotential}</div>
                          <div title="GTM">G:{genome.fitness.gtmEfficiency}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="library" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Gene Library</CardTitle>
                  <CardDescription>
                    The 8 dimensions used to define market segments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="w-full" data-testid="accordion-gene-library">
                    {Object.entries(geneLibrary?.dimensions || {}).map(([dimension, alleles]) => (
                      <AccordionItem key={dimension} value={dimension}>
                        <AccordionTrigger className="text-left">
                          <div className="flex items-center justify-between w-full pr-4">
                            <span className="font-medium capitalize">
                              {dimension.replace(/_/g, ' ')}
                            </span>
                            <Badge variant="outline">{alleles.length} alleles</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                            {alleles.map((allele, idx) => {
                              const count = alleleUsageCount(dimension as keyof GeneLibrary['dimensions'], allele);
                              return (
                                <div 
                                  key={idx} 
                                  className="flex items-center justify-between p-2 rounded bg-muted/50"
                                >
                                  <span className="text-sm">{allele}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {count} genomes
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="never" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    Segments to Avoid
                  </CardTitle>
                  <CardDescription>
                    These segments are not recommended for your current offering and constraints
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(synthesis.neverList || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No segments on the never list.</p>
                  ) : (
                    <div className="space-y-4" data-testid="list-never">
                      {(synthesis.neverList || []).map((item, idx) => (
                        <Card key={item.genome?.id || idx} className="border-destructive/30 bg-destructive/5" data-testid={`card-never-${idx}`}>
                          <CardContent className="pt-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                                <span className="font-medium">Avoid This Segment</span>
                              </div>
                              {item.genome?.fitness && (
                                <Badge variant="destructive">
                                  {item.genome.fitness.totalScore}/40
                                </Badge>
                              )}
                            </div>
                            
                            <p className="text-sm text-destructive font-medium">
                              {item.reason}
                            </p>

                            {item.genome?.genes && renderGeneDetails(item.genome.genes)}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => setLocation('/marketing-consultant/input')}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-new-discovery"
                >
                  Start New Discovery
                </Button>
                <Button
                  onClick={() => setLocation(`/journeys?discoveryId=${understandingId}`)}
                  className="flex-1"
                  data-testid="button-view-journeys"
                >
                  View All Journeys
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Segment Discovery"
      subtitle="Loading results..."
    >
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </AppLayout>
  );
}
