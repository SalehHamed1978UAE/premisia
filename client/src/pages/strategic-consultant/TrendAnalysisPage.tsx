import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, ArrowRight, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { TrendProgressView } from "@/components/trend-analysis/TrendProgressView";
import { PESTLEFactorsView } from "@/components/trend-analysis/PESTLEFactorsView";
import { AssumptionComparisonView } from "@/components/trend-analysis/AssumptionComparisonView";
import { TrendSynthesisView } from "@/components/trend-analysis/TrendSynthesisView";
import { TrendAnalysisResult, TrendProgressMessage } from "@/types/trend-analysis";
import { DeleteAnalysisDialog } from "@/components/DeleteAnalysisDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function TrendAnalysisPage() {
  const [, params] = useRoute("/strategic-consultant/trend-analysis/:sessionId/:versionNumber");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const sessionId = params?.sessionId;
  const versionNumber = params?.versionNumber ? parseInt(params.versionNumber) : 1;

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [currentPhase, setCurrentPhase] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(4);
  const [analysisResult, setAnalysisResult] = useState<TrendAnalysisResult | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  // Get understanding ID from strategic understanding table
  const { data: understandingData } = useQuery<{ understandingId: string }>({
    queryKey: ['/api/strategic-consultant/understanding', sessionId],
    enabled: !!sessionId,
  });

  const understandingId = understandingData?.understandingId;

  // Check if analysis already exists
  const { data: existingAnalysis, isLoading: isCheckingExisting } = useQuery<{ success: boolean; data: TrendAnalysisResult | null }>({
    queryKey: ['/api/trend-analysis', understandingId, 'latest'],
    enabled: !!understandingId,
    retry: false,
  });

  useEffect(() => {
    if (existingAnalysis?.data) {
      setAnalysisResult(existingAnalysis.data);
      setAnalysisComplete(true);
      setAnalysisId(existingAnalysis.data.insightId);
    }
  }, [existingAnalysis]);

  const handleDeleteAnalysis = async () => {
    if (!analysisId) return;

    setIsDeleting(true);
    try {
      await apiRequest('DELETE', `/api/repository/analyses/${analysisId}`);
      
      toast({
        title: 'Analysis deleted',
        description: 'Your PESTLE analysis has been permanently deleted',
      });

      // Invalidate cache
      await queryClient.invalidateQueries({ queryKey: ['/api/trend-analysis', understandingId] });
      await queryClient.invalidateQueries({ queryKey: ['/api/repository/statements'] });
      
      // Navigate back to repository
      setLocation('/repository');
    } catch (error) {
      console.error('Error deleting analysis:', error);
      toast({
        title: 'Failed to delete',
        description: error instanceof Error ? error.message : 'Could not delete analysis',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!understandingId) {
      toast({
        title: 'Missing Understanding ID',
        description: 'Cannot start analysis without strategic understanding',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisComplete(false);
    setProgressMessage('Starting PESTLE trend analysis...');
    setCurrentPhase('domain_extraction');
    setCurrentStep(1);

    try {
      const response = await fetch(`/api/trend-analysis/${understandingId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ sessionId, versionNumber }),
      });

      if (!response.ok) {
        throw new Error('Failed to start trend analysis');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            let data: TrendProgressMessage;
            try {
              data = JSON.parse(line.slice(6));
            } catch (parseError) {
              console.error('[TREND-FRONTEND] Failed to parse SSE message:', line, parseError);
              continue;
            }
            
            if (data.type === 'error') {
              throw new Error(data.error || 'Analysis failed');
            }
            
            if (data.type === 'complete' && data.result) {
              setAnalysisResult(data.result);
              setProgressMessage('✅ Analysis complete!');
              setAnalysisComplete(true);
              toast({
                title: 'Trend Analysis Complete',
                description: 'PESTLE analysis has been generated successfully',
              });
            } 
            else if (data.type === 'progress' && data.message) {
              setProgressMessage(data.message);
              if (data.phase) setCurrentPhase(data.phase);
              if (data.step !== undefined) setCurrentStep(data.step);
              if (data.totalSteps !== undefined) setTotalSteps(data.totalSteps);
            }
          }
        }
      }
    } catch (error: any) {
      setProgressMessage('');
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Failed to conduct trend analysis',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
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

  if (isCheckingExisting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading trend analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout
      title="PESTLE Trend Analysis"
      subtitle="Evidence-based macro-environmental analysis"
      onViewChange={(view) => setLocation('/')}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <p className="text-sm text-muted-foreground" data-testid="text-session-id">
            Session: {sessionId} • Version {versionNumber}
          </p>
        </div>

        {/* Start Button or Progress */}
        {!analysisComplete && !isAnalyzing && (
          <div className="text-center space-y-4 py-12">
            <div className="max-w-2xl mx-auto space-y-3">
              <h2 className="text-2xl font-bold">Ready for Trend Analysis</h2>
              <p className="text-muted-foreground">
                Conduct AI-powered PESTLE analysis to identify Political, Economic, Social, 
                Technological, Legal, and Environmental trends affecting your strategy.
              </p>
              <p className="text-sm text-muted-foreground">
                This analysis will compare industry trends with your strategic assumptions 
                to validate or challenge your thinking.
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleStartAnalysis}
              disabled={!understandingId}
              data-testid="button-start-trend-analysis"
            >
              Start PESTLE Analysis
            </Button>
          </div>
        )}

        {/* Progress Indicator */}
        {isAnalyzing && (
          <TrendProgressView
            phase={currentPhase}
            message={progressMessage}
            step={currentStep}
            totalSteps={totalSteps}
            isComplete={false}
          />
        )}

        {/* Results */}
        {analysisComplete && analysisResult && (
          <>
            <TrendProgressView
              phase="synthesis"
              message="Analysis complete"
              step={totalSteps}
              totalSteps={totalSteps}
              isComplete={true}
            />

            {/* PESTLE Factors */}
            <PESTLEFactorsView factors={analysisResult.pestleFactors} />

            {/* Assumption Comparison */}
            <AssumptionComparisonView comparisons={analysisResult.comparisons} />

            {/* Synthesis */}
            <TrendSynthesisView 
              synthesis={analysisResult.synthesis} 
              telemetry={analysisResult.telemetry}
            />

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <Button
                variant="destructive"
                size="lg"
                onClick={() => setShowDeleteDialog(true)}
                data-testid="button-delete-analysis"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Analysis
              </Button>
              <Button
                size="lg"
                onClick={() => setLocation(`/strategic-consultant/decisions/${sessionId}/${versionNumber}`)}
                data-testid="button-proceed-decisions"
              >
                Proceed to Strategic Decisions <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {/* Delete Confirmation Dialog */}
        <DeleteAnalysisDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleDeleteAnalysis}
          frameworkName="PESTLE"
          isDeleting={isDeleting}
        />
      </div>
    </AppLayout>
  );
}
