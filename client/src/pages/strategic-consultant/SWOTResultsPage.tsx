import { useEffect, useState } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2, ArrowLeft, ArrowRight, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { SWOTResults } from "@/components/strategic-consultant/SWOTResults";

interface SWOTFactor {
  factor: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  evidence?: string;
}

interface SWOTData {
  strengths: SWOTFactor[];
  weaknesses: SWOTFactor[];
  opportunities: SWOTFactor[];
  threats: SWOTFactor[];
  strategicOptions: {
    soStrategies: string[];
    woStrategies: string[];
    stStrategies: string[];
    wtStrategies: string[];
  };
  priorityActions: string[];
  confidence: number;
}

interface SWOTExecuteResponse {
  success: boolean;
  framework: string;
  data: {
    framework: string;
    output: SWOTData;
    summary?: {
      strengthCount: number;
      weaknessCount: number;
      opportunityCount: number;
      threatCount: number;
    };
  };
  decisions?: any;
  versionNumber: number;
}

export default function SWOTResultsPage() {
  const [, setLocation] = useLocation();
  const { sessionId, versionNumber } = useParams<{ sessionId: string; versionNumber: string }>();
  const searchString = useSearch();
  const { toast } = useToast();
  const [swotData, setSwotData] = useState<SWOTData | null>(null);
  const [hasExecuted, setHasExecuted] = useState(false);

  // Check if this is a view-only request (from Statement Analysis page)
  const isViewOnly = searchString.includes('viewOnly=true');

  // Try to fetch existing SWOT results first (for page refresh / back navigation)
  const { data: existingData, isLoading: isLoadingExisting } = useQuery({
    queryKey: ['swot-results', sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/strategic-consultant/frameworks/swot/${sessionId}`);
      if (!response.ok) {
        // 404 is expected if SWOT hasn't been run yet
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch SWOT results');
      }
      return response.json();
    },
    enabled: !!sessionId,
    retry: false,
  });

  // Execute SWOT analysis mutation
  const executeSWOT = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/strategic-consultant/frameworks/swot/execute/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `SWOT analysis failed (${res.status})`);
      }
      
      return res.json();
    },
    onSuccess: (data: any) => {
      console.log('[SWOTResultsPage] SWOT execution successful:', data);
      
      // Normalize SWOT response - handle multiple possible response shapes from the API
      // The API may nest data differently: data.data.data.swotResults, data.data.output, or direct props
      let swotResults = null;
      
      // Check for deeply nested structure: data.data.data.swotResults or data.data.data.output
      if (data.data?.data?.swotResults) {
        swotResults = data.data.data.swotResults;
      } else if (data.data?.data?.output) {
        swotResults = data.data.data.output;
      }
      // Check for semi-nested structure: data.data.swotResults or data.data.output
      else if (data.data?.swotResults) {
        swotResults = data.data.swotResults;
      } else if (data.data?.output) {
        swotResults = data.data.output;
      }
      // Check for direct swotResults or output: data.swotResults/data.output
      else if (data.swotResults) {
        swotResults = data.swotResults;
      } else if (data.output) {
        swotResults = data.output;
      }
      // Check if data.data.data contains direct SWOT properties (strengths array)
      else if (data.data?.data?.strengths) {
        swotResults = data.data.data;
      }
      // Fallback: try data.data if it has direct SWOT properties
      else if (data.data?.strengths) {
        swotResults = data.data;
      }
      // Last resort: use whatever data we have
      else {
        swotResults = data.data?.data || data.data || data;
      }
      
      console.log('[SWOTResultsPage] Extracted swotResults:', swotResults);
      
      setSwotData(swotResults);
      setHasExecuted(true);
      toast({
        title: "SWOT Analysis Complete",
        description: "Strategic insights have been synthesized successfully.",
      });
    },
    onError: (error: any) => {
      console.error('[SWOTResultsPage] SWOT execution failed:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to complete SWOT analysis. Please try again.",
        variant: "destructive",
      });
    },
  });

  // On mount, check if we have existing data or need to execute
  useEffect(() => {
    if (isLoadingExisting) return;

    // If we have existing data, use it - apply same robust extraction
    if (existingData) {
      let swotResults = null;
      if (existingData.data?.data?.swotResults) {
        swotResults = existingData.data.data.swotResults;
      } else if (existingData.data?.data?.output) {
        swotResults = existingData.data.data.output;
      } else if (existingData.data?.swotResults) {
        swotResults = existingData.data.swotResults;
      } else if (existingData.data?.output) {
        swotResults = existingData.data.output;
      } else if (existingData.data?.strengths) {
        swotResults = existingData.data;
      } else if (existingData.strengths) {
        swotResults = existingData;
      }
      
      if (swotResults) {
        setSwotData(swotResults);
        setHasExecuted(true);
        return;
      }
    }

    // If viewOnly mode and no data, don't run analysis - just mark as executed
    if (isViewOnly) {
      console.log('[SWOTResultsPage] View-only mode, no existing data found');
      setHasExecuted(true);
      return;
    }

    // No existing data and haven't executed yet - execute SWOT
    if (!hasExecuted && !executeSWOT.isPending) {
      console.log('[SWOTResultsPage] No existing SWOT data, executing analysis...');
      executeSWOT.mutate();
    }
  }, [isLoadingExisting, existingData, hasExecuted, executeSWOT.isPending, isViewOnly]);

  const handleContinue = () => {
    setLocation(`/strategy-workspace/decisions/${sessionId}/${versionNumber}`);
  };

  const handleBack = () => {
    setLocation(`/strategic-consultant/porters-results/${sessionId}/${versionNumber}`);
  };

  const handleRetry = () => {
    setHasExecuted(false);
    executeSWOT.mutate();
  };

  // Missing session ID
  if (!sessionId) {
    return (
      <AppLayout
        title="SWOT Analysis"
        subtitle="Error"
      >
        <div className="max-w-2xl mx-auto py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Invalid Session</AlertTitle>
            <AlertDescription>No session ID provided in URL</AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  // Loading state - either fetching existing or executing SWOT
  if (isLoadingExisting || (executeSWOT.isPending && !swotData)) {
    return (
      <AppLayout
        title="SWOT Analysis"
        subtitle="Synthesizing strategic insights..."
      >
        <div className="max-w-2xl mx-auto py-12">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <CardTitle className="text-2xl" data-testid="text-swot-status">
                Synthesizing strategic insights...
              </CardTitle>
              <CardDescription>
                Analyzing strengths, weaknesses, opportunities, and threats based on your market research
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Integrating PESTLE and Porter's Five Forces analysis
                </p>
                <p className="text-xs text-muted-foreground">
                  This may take 15-30 seconds
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (executeSWOT.isError && !swotData) {
    return (
      <AppLayout
        title="SWOT Analysis"
        subtitle="Analysis failed"
      >
        <div className="max-w-2xl mx-auto py-12 space-y-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analysis Failed</AlertTitle>
            <AlertDescription>
              {(executeSWOT.error as any)?.message || "Failed to complete SWOT analysis"}
            </AlertDescription>
          </Alert>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Porter's
            </Button>
            <Button onClick={handleRetry} data-testid="button-retry-swot">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Analysis
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Results display
  return (
    <AppLayout
      title="SWOT Analysis Results"
      subtitle="Strategic insights synthesized from market research"
    >
      <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-0">
        {/* Success Banner */}
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                    SWOT Analysis Complete!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Review your strategic insights below
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SWOT Results Component */}
        {swotData && (
          <SWOTResults 
            swotData={swotData}
          />
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Porter's
          </Button>
          <Button onClick={handleContinue} className="gap-2" data-testid="button-continue-decisions">
            Continue to Strategic Decisions
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
