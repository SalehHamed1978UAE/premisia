import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2, ArrowLeft, ArrowRight, AlertCircle, RefreshCw, Building2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { PortersResults } from "@/components/strategic-consultant/PortersResults";
import { apiRequest } from "@/lib/queryClient";

interface PortersData {
  threatOfNewEntrants: { score: number; analysis: string; barriers: string[]; risks: string[] };
  bargainingPowerOfSuppliers: { score: number; analysis: string; mitigations: string[]; risks: string[] };
  bargainingPowerOfBuyers: { score: number; analysis: string; risks: string[] };
  threatOfSubstitutes: { score: number; analysis: string; substitutes: string[]; risks: string[] };
  competitiveRivalry: { score: number; analysis: string; competitors: string[]; strategies: string[]; risks: string[] };
  overallAttractiveness: { score: number; summary: string; recommendations: string[] };
  strategicImplications: string[];
}

interface ExecuteResponse {
  success: boolean;
  portersResults: PortersData;
  sessionId: string;
  versionNumber: number;
}

export default function PortersResultsPage() {
  const [, setLocation] = useLocation();
  const { sessionId, versionNumber } = useParams<{ sessionId: string; versionNumber: string }>();
  const { toast } = useToast();
  
  const [portersData, setPortersData] = useState<PortersData | null>(null);
  const hasExecuted = useRef(false);

  // Mutation to execute Porter's Five Forces analysis
  const executeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest<ExecuteResponse>(
        "POST",
        `/api/strategic-consultant/frameworks/porters/execute/${sessionId}`
      );
      return response;
    },
    onSuccess: (data) => {
      if (data.portersResults) {
        setPortersData(data.portersResults);
        toast({
          title: "Analysis Complete",
          description: "Porter's Five Forces analysis has been completed successfully.",
        });
      }
    },
    onError: (error: Error) => {
      console.error("[PortersResultsPage] Execute error:", error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to execute Porter's Five Forces analysis",
        variant: "destructive",
      });
    },
  });

  // Execute Porter's analysis on mount
  useEffect(() => {
    if (!sessionId || hasExecuted.current) return;
    
    hasExecuted.current = true;
    console.log(`[PortersResultsPage] Executing Porter's analysis for session: ${sessionId}`);
    executeMutation.mutate();
  }, [sessionId]);

  const handleBack = () => {
    setLocation(`/strategic-consultant/pestle-results/${sessionId}/${versionNumber}`);
  };

  const handleContinue = () => {
    setLocation(`/strategic-consultant/swot-results/${sessionId}/${versionNumber}`);
  };

  const handleRetry = () => {
    hasExecuted.current = false;
    executeMutation.reset();
    executeMutation.mutate();
  };

  // Invalid session state
  if (!sessionId) {
    return (
      <AppLayout
        title="Porter's Five Forces"
        subtitle="Invalid session"
        onViewChange={() => setLocation('/')}
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

  // Loading state
  if (executeMutation.isPending) {
    return (
      <AppLayout
        title="Porter's Five Forces"
        subtitle="Analyzing competitive forces..."
        onViewChange={() => setLocation('/')}
      >
        <div className="max-w-4xl mx-auto py-12">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <Building2 className="h-12 w-12 text-primary opacity-20" />
                  <Loader2 className="h-12 w-12 animate-spin text-primary absolute inset-0" />
                </div>
              </div>
              <CardTitle className="text-2xl" data-testid="text-loading-status">
                Analyzing competitive forces...
              </CardTitle>
              <CardDescription>
                Evaluating market dynamics using Porter's Five Forces framework
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Assessing threat of new entrants, supplier power, buyer power,
                    substitute threats, and competitive rivalry...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This may take 15-30 seconds
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (executeMutation.isError) {
    return (
      <AppLayout
        title="Porter's Five Forces"
        subtitle="Analysis failed"
        onViewChange={() => setLocation('/')}
      >
        <div className="max-w-4xl mx-auto space-y-8 py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analysis Failed</AlertTitle>
            <AlertDescription>
              {executeMutation.error?.message || "Failed to execute Porter's Five Forces analysis"}
            </AlertDescription>
          </Alert>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to PESTLE
            </Button>
            <Button onClick={handleRetry} data-testid="button-retry">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Analysis
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // No data yet (should not happen if mutation succeeded)
  if (!portersData) {
    return (
      <AppLayout
        title="Porter's Five Forces"
        subtitle="Waiting for data..."
        onViewChange={() => setLocation('/')}
      >
        <div className="max-w-4xl mx-auto py-12">
          <Card>
            <CardHeader className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <CardTitle>Loading results...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Success state - show results
  return (
    <AppLayout
      title="Porter's Five Forces Analysis"
      subtitle="Competitive dynamics assessment for your market entry"
      onViewChange={() => setLocation('/')}
    >
      <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-0">
        {/* Porter's Results Component */}
        <PortersResults 
          portersData={portersData} 
        />

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4">
          <Button 
            variant="outline" 
            onClick={handleBack}
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to PESTLE Results
          </Button>
          
          <Button 
            onClick={handleContinue}
            data-testid="button-continue"
            className="gap-2"
          >
            Continue to SWOT Analysis
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
