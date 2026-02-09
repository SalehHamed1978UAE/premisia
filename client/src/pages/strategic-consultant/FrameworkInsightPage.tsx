import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft, TrendingUp, TrendingDown, Target, Shield } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AppLayout } from "@/components/layout/AppLayout";

interface FrameworkInsightData {
  success: boolean;
  insight: {
    id: string;
    sessionId: string;
    frameworkName: string;
    frameworkVersion: string;
    insights: any;
    telemetry: { duration: number; executedAt: string };
    createdAt: string;
  };
  session: {
    id: string;
    journeyType: string;
    status: string;
    currentFrameworkIndex: number;
    completedFrameworks: string[];
    understandingId?: string;
    metadata: {
      frameworks: string[]; // All journey steps including non-executable (for navigation)
      executableFrameworks?: string[]; // Only AI-analyzable frameworks
      templateId?: string;
      isCustomJourney: boolean;
    };
  };
  nextStepRedirectUrl?: string | null;
}

interface SWOTFactor {
  factor: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  evidence?: string[];
}

interface SWOTOutput {
  strengths?: SWOTFactor[];
  weaknesses?: SWOTFactor[];
  opportunities?: SWOTFactor[];
  threats?: SWOTFactor[];
  strategicOptions?: {
    soStrategies?: string[];
    stStrategies?: string[];
    woStrategies?: string[];
    wtStrategies?: string[];
  };
  confidence?: number;
}

function SWOTRenderer({ data }: { data: any }) {
  // Handle both direct output format and wrapped format
  const output: SWOTOutput = data?.output || data;
  
  const getImpactColor = (impact: string) => {
    switch (impact?.toLowerCase()) {
      case 'high': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const renderFactorList = (factors: SWOTFactor[] | undefined, title: string, icon: React.ReactNode, color: string) => {
    if (!factors || factors.length === 0) return null;
    
    return (
      <Card className={`border-l-4 ${color}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            {icon}
            {title}
            <Badge variant="secondary">{factors.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {factors.map((factor, idx) => (
              <li key={idx} className="border-b border-border pb-2 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{factor.factor}</span>
                  <Badge className={getImpactColor(factor.impact)} variant="outline">
                    {factor.impact || 'medium'}
                  </Badge>
                </div>
                {factor.description && (
                  <p className="text-sm text-muted-foreground mt-1">{factor.description}</p>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  };

  const renderStrategies = (strategies: string[] | undefined, title: string, description: string) => {
    if (!strategies || strategies.length === 0) return null;
    
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {strategies.map((strategy, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{strategy}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderFactorList(output.strengths, 'Strengths', <TrendingUp className="h-5 w-5 text-green-600" />, 'border-l-green-500')}
        {renderFactorList(output.weaknesses, 'Weaknesses', <TrendingDown className="h-5 w-5 text-red-600" />, 'border-l-red-500')}
        {renderFactorList(output.opportunities, 'Opportunities', <Target className="h-5 w-5 text-blue-600" />, 'border-l-blue-500')}
        {renderFactorList(output.threats, 'Threats', <Shield className="h-5 w-5 text-orange-600" />, 'border-l-orange-500')}
      </div>

      {output.strategicOptions && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Strategic Options</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderStrategies(output.strategicOptions.soStrategies, 'SO Strategies (Offensive)', 'Use strengths to exploit opportunities')}
            {renderStrategies(output.strategicOptions.stStrategies, 'ST Strategies (Defensive)', 'Use strengths to counter threats')}
            {renderStrategies(output.strategicOptions.woStrategies, 'WO Strategies (Adaptive)', 'Overcome weaknesses to exploit opportunities')}
            {renderStrategies(output.strategicOptions.wtStrategies, 'WT Strategies (Mitigation)', 'Minimize weaknesses and avoid threats')}
          </div>
        </div>
      )}

      {data.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{data.summary.totalFactors}</p>
                <p className="text-sm text-muted-foreground">Total Factors</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.strategicGroups?.offensive || 0}</p>
                <p className="text-sm text-muted-foreground">Offensive Strategies</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.strategicGroups?.defensive || 0}</p>
                <p className="text-sm text-muted-foreground">Defensive Strategies</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round((data.summary.confidence || output.confidence || 0) * 100)}%</p>
                <p className="text-sm text-muted-foreground">Confidence</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GenericRenderer({ data, frameworkName }: { data: any; frameworkName: string }) {
  // Helper to safely extract text from nested objects
  const safeText = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.map(safeText).join(', ');
    if (typeof value === 'object') {
      if ('text' in value) return safeText(value.text);
      if ('content' in value) return safeText(value.content);
      if ('description' in value) return safeText(value.description);
      if ('answer' in value) return safeText(value.answer);
      if ('value' in value) return safeText(value.value);
      if ('name' in value) return safeText(value.name);
    }
    return '';
  };

  // Render a single value with appropriate formatting
  const renderValue = (value: any, depth: number = 0): React.ReactNode => {
    if (!value) return <span className="text-muted-foreground italic">Not specified</span>;

    if (typeof value === 'string') {
      return <span>{value}</span>;
    }

    if (typeof value === 'number') {
      return <span className="font-mono">{value}</span>;
    }

    if (typeof value === 'boolean') {
      return <Badge variant={value ? 'default' : 'secondary'}>{value ? 'Yes' : 'No'}</Badge>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-muted-foreground italic">None</span>;
      }
      // Check if array contains simple strings
      if (value.every(v => typeof v === 'string')) {
        return (
          <ul className="space-y-1 list-disc list-inside">
            {value.map((item, i) => (
              <li key={i} className="text-sm">{item}</li>
            ))}
          </ul>
        );
      }
      // Complex array items
      return (
        <div className="space-y-2">
          {value.map((item, i) => (
            <div key={i} className="p-3 bg-muted/50 rounded-lg">
              {renderValue(item, depth + 1)}
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === 'object') {
      // Try to extract meaningful text first
      const text = safeText(value);
      if (text && !text.includes(',')) {
        return <span>{text}</span>;
      }

      // Render as key-value pairs
      const entries = Object.entries(value).filter(([k, v]) =>
        v !== null && v !== undefined && k !== 'id' && !k.startsWith('_')
      );

      if (entries.length === 0) {
        return <span className="text-muted-foreground italic">Empty</span>;
      }

      return (
        <div className={`space-y-2 ${depth > 0 ? 'pl-4 border-l-2 border-muted' : ''}`}>
          {entries.map(([key, val]) => (
            <div key={key}>
              <span className="font-medium text-sm capitalize">
                {key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}:
              </span>
              <div className="mt-1 text-sm text-muted-foreground">
                {renderValue(val, depth + 1)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return <span>{String(value)}</span>;
  };

  // Extract main content from data
  const output = data?.output || data;
  const summary = data?.summary || output?.summary;

  // Get the main sections to display
  const mainSections = Object.entries(output || {}).filter(([key, value]) =>
    value !== null &&
    value !== undefined &&
    !['summary', 'id', 'frameworkName', 'confidence', 'version'].includes(key) &&
    !key.startsWith('_')
  );

  return (
    <div className="space-y-4">
      {/* Summary if available */}
      {summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{safeText(summary)}</p>
          </CardContent>
        </Card>
      )}

      {/* Main content sections */}
      {mainSections.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{frameworkDisplayNames[frameworkName] || frameworkName} Results</CardTitle>
            <CardDescription>Analysis output</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mainSections.map(([key, value]) => (
              <div key={key} className="space-y-2">
                <h4 className="font-semibold capitalize text-sm">
                  {key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
                </h4>
                <div className="text-sm">
                  {renderValue(value)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Framework Results</CardTitle>
            <CardDescription>Raw output from {frameworkName} analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm max-h-[600px]">
              {JSON.stringify(data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Confidence score if available */}
      {(data?.confidence || output?.confidence) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Confidence:</span>
          <Badge variant="outline">
            {Math.round((data?.confidence || output?.confidence) * 100)}%
          </Badge>
        </div>
      )}
    </div>
  );
}

export default function FrameworkInsightPage() {
  const [, params] = useRoute("/strategic-consultant/framework-insight/:sessionId");
  const [, setLocation] = useLocation();
  const [pollCount, setPollCount] = useState(0);
  const [isWaitingForAnalysis, setIsWaitingForAnalysis] = useState(true);
  const [isWaitingForDecisions, setIsWaitingForDecisions] = useState(false);
  const [decisionsPollCount, setDecisionsPollCount] = useState(0);
  
  const sessionId = params?.sessionId;
  const searchParams = new URLSearchParams(window.location.search);
  const frameworkName = searchParams.get('framework') || '';

  const { data, isLoading, error, refetch } = useQuery<FrameworkInsightData>({
    queryKey: ['/api/strategic-consultant/framework-insights', sessionId, frameworkName],
    enabled: !!sessionId && !!frameworkName,
    retry: false,
  });

  // Poll for results every 3 seconds while analysis is in progress
  useEffect(() => {
    // If we have data and it's successful, stop polling
    if (data?.success && data?.insight) {
      setIsWaitingForAnalysis(false);
      return;
    }

    // If we've polled more than 60 times (3 mins), give up
    if (pollCount > 60) {
      setIsWaitingForAnalysis(false);
      return;
    }

    // Continue polling if we don't have results yet
    if (!data?.success || !data?.insight) {
      const timer = setTimeout(() => {
        setPollCount(prev => prev + 1);
        refetch();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [data, pollCount, refetch]);

  // Poll for decisions redirect URL while waiting for DecisionGenerator
  useEffect(() => {
    if (!isWaitingForDecisions) return;
    
    // If we have the redirect URL now, navigate
    if (data?.nextStepRedirectUrl) {
      console.log('[FrameworkInsightPage] Got redirect URL, navigating:', data.nextStepRedirectUrl);
      setIsWaitingForDecisions(false);
      setLocation(data.nextStepRedirectUrl);
      return;
    }
    
    // If we've polled more than 40 times (2 mins), show error
    if (decisionsPollCount > 40) {
      console.error('[FrameworkInsightPage] Timeout waiting for decisions to be generated');
      setIsWaitingForDecisions(false);
      return;
    }
    
    // Continue polling for the redirect URL
    const timer = setTimeout(() => {
      setDecisionsPollCount(prev => prev + 1);
      refetch();
    }, 3000);
    return () => clearTimeout(timer);
  }, [isWaitingForDecisions, data?.nextStepRedirectUrl, decisionsPollCount, refetch, setLocation]);

  // Non-executable steps that should navigate to the strategy page instead of framework-insight
  const nonExecutableSteps = ['strategic_decisions'];
  
  const handleContinue = () => {
    // Get frameworks from metadata or completedFrameworks as fallback
    const frameworks = data?.session?.metadata?.frameworks || data?.session?.completedFrameworks || [];
    const understandingId = data?.session?.understandingId;
    
    // Helper to navigate to strategy page
    const navigateToStrategy = () => {
      if (understandingId) {
        setLocation(`/strategies/${understandingId}`);
      } else {
        setLocation('/strategies');
      }
    };
    
    if (frameworks.length === 0) {
      // No framework list available, return to strategies
      navigateToStrategy();
      return;
    }
    
    // Use nextStepRedirectUrl from API if available (for strategic_decisions with correct version)
    if (data?.nextStepRedirectUrl) {
      setLocation(data.nextStepRedirectUrl);
      return;
    }
    
    const currentIndex = frameworks.indexOf(frameworkName);
    
    if (currentIndex >= 0 && currentIndex < frameworks.length - 1) {
      const nextFramework = frameworks[currentIndex + 1];
      
      // Check if next step is a non-executable step (should navigate to decision page)
      // Normalize framework name for comparison
      const normalizedNext = nextFramework.toLowerCase().replace(/_/g, '-');
      if (normalizedNext === 'strategic-decisions') {
        // For strategic_decisions, we must wait for the backend to generate decisions
        // and provide the redirect URL - do NOT navigate immediately as the row may not exist yet
        console.log('[FrameworkInsightPage] Next step is strategic-decisions, starting to poll for redirect URL');
        setIsWaitingForDecisions(true);
        setDecisionsPollCount(0);
        return; // Don't navigate yet - the useEffect will handle it when ready
      } else if (nonExecutableSteps.map(s => s.toLowerCase().replace(/_/g, '-')).includes(normalizedNext)) {
        navigateToStrategy();
      } else {
        // Navigate to the next framework insight page
        setLocation(`/strategic-consultant/framework-insight/${sessionId}?framework=${nextFramework}`);
      }
    } else {
      // Either current framework not found or it's the last one
      navigateToStrategy();
    }
  };

  const handleBack = () => {
    // For custom journeys, go back to strategies; otherwise go to journeys
    const isCustomJourney = data?.session?.metadata?.isCustomJourney;
    const understandingId = data?.session?.understandingId;
    
    if (isCustomJourney && understandingId) {
      setLocation(`/strategies/${understandingId}`);
    } else {
      setLocation('/strategies');
    }
  };

  if (!sessionId || !frameworkName) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Invalid Request</AlertTitle>
          <AlertDescription>Missing session ID or framework name</AlertDescription>
        </Alert>
      </div>
    );
  }

  const frameworkDisplayNames: Record<string, string> = {
    swot: 'SWOT Analysis',
    bmc: 'Business Model Canvas',
    porters: "Porter's Five Forces",
    pestle: 'PESTLE Analysis',
    five_whys: 'Five Whys Analysis',
    ansoff: 'Ansoff Matrix',
    blue_ocean: 'Blue Ocean Strategy',
    bcg_matrix: 'BCG Matrix',
    value_chain: 'Value Chain Analysis',
    vrio: 'VRIO Analysis',
    strategic_decisions: 'Strategic Decisions',
  };

  // Show loading state on initial load or while waiting for analysis
  if (isLoading || (isWaitingForAnalysis && (!data?.success || !data?.insight))) {
    // Calculate approximate progress (SWOT typically takes 30-45 seconds)
    const estimatedProgress = Math.min(95, pollCount * 5);
    
    return (
      <AppLayout title={frameworkDisplayNames[frameworkName] || frameworkName.toUpperCase()}>
        <div className="container mx-auto p-6 max-w-2xl">
          <Card className="border-primary/20" data-testid="card-analysis-progress">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" data-testid="spinner-analysis" />
              </div>
              <CardTitle data-testid="text-analysis-title">
                {frameworkDisplayNames[frameworkName] || frameworkName.toUpperCase()} in Progress
              </CardTitle>
              <CardDescription data-testid="text-analysis-description">
                Our AI is analyzing your strategic context. This typically takes 30-60 seconds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={estimatedProgress} className="h-2" data-testid="progress-analysis" />
              <p className="text-sm text-center text-muted-foreground" data-testid="text-poll-status">
                {pollCount === 0 
                  ? 'Starting analysis...' 
                  : `Checking for results... (${pollCount * 3}s elapsed)`}
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Show loading state while waiting for DecisionGenerator to create the strategy_versions row
  if (isWaitingForDecisions) {
    const estimatedProgress = Math.min(95, 30 + decisionsPollCount * 3);
    
    return (
      <AppLayout title="Generating Strategic Decisions">
        <div className="container mx-auto p-6 max-w-2xl">
          <Card className="border-primary/20" data-testid="card-decisions-progress">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" data-testid="spinner-decisions" />
              </div>
              <CardTitle data-testid="text-decisions-title">
                Generating Strategic Decisions
              </CardTitle>
              <CardDescription data-testid="text-decisions-description">
                Our AI is transforming your analysis into actionable strategic decisions. This typically takes 20-30 seconds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={estimatedProgress} className="h-2" data-testid="progress-decisions" />
              <p className="text-sm text-center text-muted-foreground" data-testid="text-decisions-poll-status">
                {decisionsPollCount === 0 
                  ? 'Starting decision generation...' 
                  : `Preparing decisions... (${decisionsPollCount * 3}s elapsed)`}
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Only show error if we've stopped polling and still have no data
  if (!isWaitingForAnalysis && (error || !data?.success || !data?.insight)) {
    return (
      <AppLayout title="Analysis Error">
        <div className="container mx-auto p-6 max-w-md">
          <Alert variant="destructive" data-testid="alert-analysis-timeout">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analysis Not Ready</AlertTitle>
            <AlertDescription data-testid="text-timeout-message">
              {pollCount > 60 
                ? 'The analysis is taking longer than expected. Please try again later.'
                : (error as any)?.message || `The ${frameworkName} analysis couldn't be found.`}
            </AlertDescription>
            <Button onClick={handleBack} className="mt-4" variant="outline" data-testid="button-back-error">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Journeys
            </Button>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  const insight = data!.insight;
  const session = data!.session;
  // Use metadata frameworks or completedFrameworks as fallback
  const frameworks = session?.metadata?.frameworks || session?.completedFrameworks || [];
  const currentIndex = frameworks.length > 0 ? frameworks.indexOf(frameworkName) : -1;
  const hasNextFramework = currentIndex >= 0 && currentIndex < frameworks.length - 1;

  const renderFrameworkContent = () => {
    const insightData = insight?.insights;
    
    // Guard against missing or invalid insight data
    if (!insightData) {
      return (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>
            The analysis results are not available. The framework may still be processing.
          </AlertDescription>
        </Alert>
      );
    }
    
    // Check for error structure - analysis failed but was saved for debugging
    if (insightData?.error === true) {
      return (
        <div className="space-y-4" data-testid="analysis-error-container">
          <Alert variant="destructive" data-testid="alert-analysis-failed">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analysis Failed</AlertTitle>
            <AlertDescription data-testid="text-error-message">
              {insightData.message || 'The analysis could not be completed.'}
              {insightData.parseError && (
                <span className="block mt-1 text-xs opacity-75" data-testid="text-parse-error">
                  Technical: {insightData.parseError}
                </span>
              )}
            </AlertDescription>
          </Alert>
          
          {insightData.rawOutput && (
            <Card data-testid="card-raw-output">
              <CardHeader>
                <CardTitle className="text-sm">Raw AI Output (for debugging)</CardTitle>
                <CardDescription>
                  This shows what the AI returned. Share this with support if the issue persists.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96 whitespace-pre-wrap" data-testid="text-raw-output">
                  {insightData.rawOutput}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }
    
    switch (frameworkName) {
      case 'swot':
        // Validate that we have some SWOT-like structure
        const hasSWOTData = insightData?.output?.strengths || 
                           insightData?.output?.weaknesses || 
                           insightData?.strengths || 
                           insightData?.weaknesses;
        if (hasSWOTData) {
          return <SWOTRenderer data={insightData} />;
        }
        return <GenericRenderer data={insightData} frameworkName={frameworkName} />;
      default:
        return <GenericRenderer data={insightData} frameworkName={frameworkName} />;
    }
  };

  return (
    <AppLayout 
      title={frameworkDisplayNames[frameworkName] || frameworkName.toUpperCase()}
    >
      <div className="container mx-auto p-6 max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{frameworkDisplayNames[frameworkName] || frameworkName.toUpperCase()}</h1>
            <p className="text-muted-foreground">
              Step {currentIndex + 1} of {frameworks.length} in your custom journey
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
              {session.status}
            </Badge>
            {insight.telemetry?.executedAt && (
              <span className="text-sm text-muted-foreground">
                Completed {new Date(insight.telemetry.executedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {renderFrameworkContent()}

        <div className="flex justify-between pt-4 border-t">
          <Button onClick={handleBack} variant="outline" data-testid="button-back-strategy">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Strategy
          </Button>
          
          {hasNextFramework ? (
            <Button onClick={handleContinue} data-testid="button-continue-next">
              Continue to {frameworkDisplayNames[frameworks[currentIndex + 1]] || frameworks[currentIndex + 1]}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleContinue} data-testid="button-complete">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              View Strategy
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
