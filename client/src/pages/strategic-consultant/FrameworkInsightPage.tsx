import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft, TrendingUp, TrendingDown, Target, Shield } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
    metadata: {
      frameworks: string[];
      templateId?: string;
      isCustomJourney: boolean;
    };
  };
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
  return (
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
  );
}

export default function FrameworkInsightPage() {
  const [, params] = useRoute("/strategic-consultant/framework-insight/:sessionId");
  const [, setLocation] = useLocation();
  
  const sessionId = params?.sessionId;
  const searchParams = new URLSearchParams(window.location.search);
  const frameworkName = searchParams.get('framework') || '';

  const { data, isLoading, error } = useQuery<FrameworkInsightData>({
    queryKey: ['/api/strategic-consultant/framework-insights', sessionId, frameworkName],
    enabled: !!sessionId && !!frameworkName,
  });

  const handleContinue = () => {
    // Get frameworks from metadata or completedFrameworks as fallback
    const frameworks = data?.session?.metadata?.frameworks || data?.session?.completedFrameworks || [];
    
    if (frameworks.length === 0) {
      // No framework list available, return to journeys
      setLocation('/journeys');
      return;
    }
    
    const currentIndex = frameworks.indexOf(frameworkName);
    
    if (currentIndex >= 0 && currentIndex < frameworks.length - 1) {
      const nextFramework = frameworks[currentIndex + 1];
      setLocation(`/strategic-consultant/framework-insight/${sessionId}?framework=${nextFramework}`);
    } else {
      // Either current framework not found or it's the last one
      setLocation('/journeys');
    }
  };

  const handleBack = () => {
    setLocation('/journeys');
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading {frameworkName.toUpperCase()} analysis...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.success || !data.insight) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Analysis Not Found</AlertTitle>
          <AlertDescription>
            {(error as any)?.message || `The ${frameworkName} analysis hasn't been completed yet or couldn't be found.`}
          </AlertDescription>
          <Button onClick={handleBack} className="mt-4" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Journeys
          </Button>
        </Alert>
      </div>
    );
  }

  const insight = data.insight;
  const session = data.session;
  // Use metadata frameworks or completedFrameworks as fallback
  const frameworks = session?.metadata?.frameworks || session?.completedFrameworks || [];
  const currentIndex = frameworks.length > 0 ? frameworks.indexOf(frameworkName) : -1;
  const hasNextFramework = currentIndex >= 0 && currentIndex < frameworks.length - 1;

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
  };

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
          <Button onClick={handleBack} variant="outline" data-testid="button-back-journeys">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Journeys
          </Button>
          
          {hasNextFramework ? (
            <Button onClick={handleContinue} data-testid="button-continue-next">
              Continue to {frameworkDisplayNames[frameworks[currentIndex + 1]] || frameworks[currentIndex + 1]}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleBack} data-testid="button-complete">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Journey Complete
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
