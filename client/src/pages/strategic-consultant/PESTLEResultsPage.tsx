import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2, ArrowLeft, ArrowRight, AlertCircle, RefreshCw, Globe } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { PESTLEResults } from "@/components/strategic-consultant/PESTLEResults";

interface PESTLEExecuteResponse {
  success: boolean;
  framework: string;
  data: {
    data: {
      political: any;
      economic: any;
      social: any;
      technological: any;
      legal: any;
      environmental: any;
      strategicRecommendations: string[];
      crossFactorInsights: {
        synergies: string[];
        conflicts: string[];
      };
    };
  };
  versionNumber: number;
}

export default function PESTLEResultsPage() {
  const [, setLocation] = useLocation();
  const { sessionId, versionNumber } = useParams<{ sessionId: string; versionNumber: string }>();
  const { toast } = useToast();
  
  // Track if we've already initiated the execute call
  const hasInitiated = useRef(false);
  
  // State to hold PESTLE results
  const [pestleData, setPestleData] = useState<any>(null);
  const [finalVersionNumber, setFinalVersionNumber] = useState<number | null>(null);

  // Fetch journey session to get the back URL (understandingId for journey selection)
  const { data: journeySession } = useQuery({
    queryKey: ['journey-session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const res = await fetch(`/api/strategic-consultant/journey-sessions/by-session/${sessionId}`);
      if (!res.ok) {
        console.warn(`[PESTLEResultsPage] Journey session not found for ${sessionId}`);
        return null;
      }
      return res.json();
    },
    enabled: !!sessionId,
  });

  // Mutation to execute PESTLE analysis
  const executePestle = useMutation({
    mutationFn: async (sid: string) => {
      const res = await fetch(`/api/strategic-consultant/frameworks/pestle/execute/${sid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `PESTLE analysis failed (${res.status})`);
      }
      
      return res.json() as Promise<PESTLEExecuteResponse>;
    },
    onSuccess: (data) => {
      console.log('[PESTLEResultsPage] PESTLE analysis complete:', data);
      
      // The PESTLE data is nested: response.data.data contains the actual PESTLE factors
      const pestleResults = data.data?.data || data.data;
      setPestleData(pestleResults);
      setFinalVersionNumber(data.versionNumber);
      
      toast({
        title: "PESTLE Analysis Complete",
        description: "Macro-environmental factors have been analyzed",
      });
    },
    onError: (error: Error) => {
      console.error('[PESTLEResultsPage] PESTLE analysis failed:', error);
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Execute PESTLE analysis on mount
  useEffect(() => {
    if (!sessionId || hasInitiated.current) return;
    
    console.log('[PESTLEResultsPage] Initiating PESTLE analysis for session:', sessionId);
    hasInitiated.current = true;
    executePestle.mutate(sessionId);
  }, [sessionId]);

  // Handle navigation to Porter's analysis
  const handleContinue = () => {
    const nextVersionNumber = finalVersionNumber || versionNumber || 1;
    setLocation(`/strategic-consultant/porters-results/${sessionId}/${nextVersionNumber}`);
  };

  // Handle back navigation to journey selection
  const handleBack = () => {
    if (journeySession?.understandingId) {
      setLocation(`/strategic-consultant/journey-selection/${journeySession.understandingId}`);
    } else {
      // Fallback: go to input page
      setLocation('/strategic-consultant/input');
    }
  };

  // Handle retry
  const handleRetry = () => {
    hasInitiated.current = false;
    setPestleData(null);
    executePestle.mutate(sessionId!);
  };

  // Invalid session
  if (!sessionId) {
    return (
      <AppLayout
        title="PESTLE Analysis"
        subtitle="Error"
        onViewChange={() => setLocation('/')}
      >
        <div className="max-w-2xl mx-auto p-4">
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
  if (executePestle.isPending) {
    return (
      <AppLayout
        title="PESTLE Analysis"
        subtitle="Analyzing macro-environmental factors"
        onViewChange={() => setLocation('/')}
      >
        <div className="max-w-4xl mx-auto space-y-8 p-4 sm:p-8">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <Loader2 className="h-16 w-16 animate-spin text-primary" />
                  <Globe className="h-8 w-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary/70" />
                </div>
              </div>
              <CardTitle className="text-2xl" data-testid="text-loading-title">
                Analyzing Macro-Environmental Factors...
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Examining Political, Economic, Social, Technological, Legal, and Environmental factors
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center text-sm text-muted-foreground">
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-2xl mb-1 block">🏛️</span>
                  Political
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-2xl mb-1 block">📊</span>
                  Economic
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-2xl mb-1 block">👥</span>
                  Social
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-2xl mb-1 block">💻</span>
                  Technological
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-2xl mb-1 block">⚖️</span>
                  Legal
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <span className="text-2xl mb-1 block">🌱</span>
                  Environmental
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center pt-4">
                This may take 30-60 seconds as we conduct comprehensive analysis
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (executePestle.isError) {
    return (
      <AppLayout
        title="PESTLE Analysis"
        subtitle="Analysis failed"
        onViewChange={() => setLocation('/')}
      >
        <div className="max-w-4xl mx-auto space-y-8 p-4 sm:p-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>PESTLE Analysis Failed</AlertTitle>
            <AlertDescription>
              {executePestle.error?.message || 'An unexpected error occurred'}
            </AlertDescription>
          </Alert>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Journey Selection
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

  // Results state
  if (pestleData) {
    return (
      <AppLayout
        title="PESTLE Analysis"
        subtitle="Macro-environmental analysis complete"
        onViewChange={() => setLocation('/')}
      >
        <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-0">
          {/* Back button at top */}
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={handleBack}
              className="gap-2"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Journey Selection
            </Button>
          </div>

          {/* PESTLE Results Component */}
          <PESTLEResults 
            pestleData={pestleData}
            onContinue={handleContinue}
          />

          {/* Bottom navigation */}
          <div className="flex justify-between items-center pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={handleBack}
              className="gap-2"
              data-testid="button-back-bottom"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button 
              onClick={handleContinue}
              className="gap-2"
              data-testid="button-continue"
            >
              Continue to Porter's Analysis
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Fallback loading state
  return (
    <AppLayout
      title="PESTLE Analysis"
      subtitle="Preparing analysis"
      onViewChange={() => setLocation('/')}
    >
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </AppLayout>
  );
}
