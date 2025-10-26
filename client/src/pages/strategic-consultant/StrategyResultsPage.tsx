import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertCircle, Download, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppLayout } from "@/components/layout/AppLayout";
import { getFrameworkRenderer, hasFrameworkRenderer } from "@/components/frameworks";
import { FRAMEWORK_METADATA } from "@shared/framework-types";
import type { FrameworkResult, FrameworkName } from "@shared/framework-types";
import { useJobs } from "@/contexts/JobContext";

interface VersionData {
  id?: string;
  versionNumber: number;
  status: string;
  createdAt: string;
  finalizedAt?: string;
  analysis?: {
    // Legacy structure support
    five_whys?: any;
    porters_five_forces?: any;
    bmc_research?: any;
    enhanced_analysis?: any;
    
    // New modular structure
    frameworks?: FrameworkResult[];
    
    // Metadata
    executiveSummary?: string;
    recommendedApproaches?: string[];
    recommendedMarket?: string;
    research?: any;
  };
  decisions?: any;
  selectedDecisions?: any;
  program?: any;
}

/**
 * Normalize legacy analysis structure to framework results
 */
function normalizeAnalysisToFrameworks(analysis: VersionData['analysis']): FrameworkResult[] {
  if (!analysis) return [];
  
  // If already in new format, use it
  if (analysis.frameworks && Array.isArray(analysis.frameworks)) {
    return analysis.frameworks;
  }
  
  // Otherwise, normalize legacy structure
  const frameworks: FrameworkResult[] = [];
  
  // Five Whys
  if (analysis.five_whys) {
    frameworks.push({
      framework: 'five_whys',
      ...analysis.five_whys
    } as FrameworkResult);
  }
  
  // Porter's Five Forces
  if (analysis.porters_five_forces || analysis.enhanced_analysis?.portersAnalysis) {
    const portersData = analysis.enhanced_analysis?.portersAnalysis || analysis.porters_five_forces;
    frameworks.push({
      framework: 'porters',
      ...portersData,
      recommendations: analysis.enhanced_analysis?.recommendations,
      citations: analysis.enhanced_analysis?.citations,
      confidenceScore: analysis.enhanced_analysis?.confidenceScore,
      confidenceExplanation: analysis.enhanced_analysis?.confidenceExplanation,
    } as FrameworkResult);
  }
  
  // BMC
  if (analysis.bmc_research) {
    frameworks.push({
      framework: 'bmc',
      ...analysis.bmc_research
    } as FrameworkResult);
  }
  
  return frameworks;
}

export default function StrategyResultsPage() {
  const [, params] = useRoute("/strategic-consultant/results/:sessionId/:versionNumber");
  const [, setLocation] = useLocation();
  const { runningJobs } = useJobs();
  
  const sessionId = params?.sessionId || '';
  const versionNumber = params?.versionNumber ? parseInt(params.versionNumber) : 1;

  const { data: response, isLoading, error } = useQuery<{ success: boolean; version: VersionData }>({
    queryKey: ['/api/strategic-consultant/versions', sessionId, versionNumber],
    enabled: !!sessionId,
  });

  const versionData = response?.version;
  const frameworks = normalizeAnalysisToFrameworks(versionData?.analysis);
  
  // Detect supported and unsupported frameworks
  const supportedFrameworks = frameworks.filter(f => hasFrameworkRenderer(f.framework));
  const unsupportedFrameworks = frameworks.filter(f => !hasFrameworkRenderer(f.framework));

  // Check if EPM program exists for this strategy version
  const strategyVersionId = versionData?.id;
  const { data: epmProgramsData } = useQuery<{ programs: Array<{ id: string; strategyVersionId: string }> }>({
    queryKey: ['/api/strategy-workspace/epm'],
    enabled: !!strategyVersionId,
  });
  
  // Find EPM program for this specific strategy version
  const existingEpmProgram = epmProgramsData?.programs?.find(
    prog => prog.strategyVersionId === strategyVersionId
  );
  
  // Check if EPM generation is currently running for this session
  const hasRunningEPM = runningJobs.some(job =>
    job.jobType === 'epm_generation' && job.sessionId === sessionId
  );

  if (isLoading) {
    return (
      <AppLayout
        title="Strategy Analysis Results"
        subtitle="Loading framework analysis"
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading analysis results...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !response) {
    return (
      <AppLayout
        title="Strategy Analysis Results"
        subtitle="Error loading results"
      >
        <div className="max-w-2xl mx-auto py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Results</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'Failed to load strategy analysis'}
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  if (frameworks.length === 0) {
    return (
      <AppLayout
        title="Strategy Analysis Results"
        subtitle="No analysis found"
      >
        <div className="max-w-2xl mx-auto py-12">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Analysis Found</AlertTitle>
            <AlertDescription>
              This version does not contain any framework analysis yet.
              The analysis may still be running or might have failed.
            </AlertDescription>
          </Alert>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => setLocation('/strategic-consultant')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Strategic Consultant
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Strategy Analysis Results"
      subtitle={`Version ${versionNumber} • ${frameworks.length} framework${frameworks.length > 1 ? 's' : ''}`}
    >
      <div className="max-w-6xl mx-auto space-y-8 py-6">
        {/* Header with metadata */}
        <Card data-testid="card-results-header">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Strategic Analysis Complete</CardTitle>
                <CardDescription>
                  Analyzed with {frameworks.map(f => FRAMEWORK_METADATA[f.framework]?.displayName || f.framework).join(', ')}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {frameworks.map(f => (
                  <Badge key={f.framework} variant="secondary" data-testid={`badge-framework-${f.framework}`}>
                    {FRAMEWORK_METADATA[f.framework]?.icon || '📊'} {FRAMEWORK_METADATA[f.framework]?.displayName || f.framework}
                  </Badge>
                ))}
              </div>
            </div>
          </CardHeader>
          {versionData?.analysis?.executiveSummary && (
            <CardContent>
              <p className="text-muted-foreground">{versionData.analysis.executiveSummary}</p>
            </CardContent>
          )}
        </Card>

        <Separator />

        {/* Render each framework */}
        <div className="space-y-8">
          {supportedFrameworks.map((frameworkData) => {
            const Renderer = getFrameworkRenderer(frameworkData.framework);
            if (!Renderer) return null;
            
            return (
              <div key={frameworkData.framework} data-testid={`framework-section-${frameworkData.framework}`}>
                <Renderer 
                  data={frameworkData} 
                  sessionId={sessionId}
                  versionNumber={versionNumber}
                />
              </div>
            );
          })}
        </div>

        {/* Unsupported frameworks warning */}
        {unsupportedFrameworks.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Additional Frameworks Pending</AlertTitle>
            <AlertDescription>
              The following frameworks are not yet available for display: {' '}
              {unsupportedFrameworks.map(f => f.framework).join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="space-y-4">
          {/* EPM Program Access (if exists) */}
          {existingEpmProgram && (
            <div className="p-6 border-2 border-green-500 rounded-lg bg-green-50 dark:bg-green-950">
              <h3 className="text-lg font-semibold mb-2 text-green-700 dark:text-green-300">✓ EPM Program Generated</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your complete EPM program is ready to view and edit
              </p>
              <Button 
                size="lg"
                onClick={() => setLocation(`/strategy-workspace/epm/${existingEpmProgram.id}`)}
                data-testid="button-view-epm-program"
                className="w-full bg-green-600 hover:bg-green-700 text-sm md:text-base px-3 py-2 sm:px-4 sm:py-2"
              >
                <span className="truncate">View EPM Program</span>
              </Button>
            </div>
          )}

          {/* EPM Generation In Progress */}
          {!existingEpmProgram && hasRunningEPM && (
            <div className="p-6 border-2 border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-950">
              <h3 className="text-lg font-semibold mb-2 text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                EPM Generation In Progress
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your EPM program is being generated. You can safely navigate away - we'll notify you when it's ready.
              </p>
              <Button 
                size="lg"
                onClick={() => setLocation('/strategy-workspace/programs')}
                variant="outline"
                data-testid="button-view-programs-in-progress"
                className="w-full text-sm md:text-base px-3 py-2 sm:px-4 sm:py-2"
              >
                <span className="truncate">View Programs & Running Jobs</span>
              </Button>
            </div>
          )}

          {/* Next Step: Decision Making (if no EPM exists and none generating) */}
          {!existingEpmProgram && !hasRunningEPM && (
            <div className="p-6 border-2 border-primary rounded-lg bg-primary/5">
              <h3 className="text-lg font-semibold mb-2">Next Step: Strategic Decision Making</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Review the analysis above and make key strategic decisions to generate your complete EPM program
              </p>
              <Button 
                size="lg"
                onClick={() => setLocation(`/strategy-workspace/decisions/${sessionId}/${versionNumber}`)}
                data-testid="button-review-decide"
                className="w-full text-sm md:text-base px-3 py-2 sm:px-4 sm:py-2"
              >
                <span className="truncate">Review Results & Make Strategic Decisions</span>
              </Button>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              variant="outline"
              onClick={() => setLocation('/strategic-consultant')}
              data-testid="button-new-analysis"
              className="w-full sm:w-auto text-sm md:text-base px-3 py-2 sm:px-4 sm:py-2"
            >
              <span className="truncate">Start New Analysis</span>
            </Button>
            <Button 
              variant="outline"
              onClick={() => setLocation(`/strategic-consultant/decisions/${sessionId}/${versionNumber}`)}
              data-testid="button-view-decisions"
              className="w-full sm:w-auto text-sm md:text-base px-3 py-2 sm:px-4 sm:py-2"
            >
              <span className="truncate">View AI Decisions (Old Flow)</span>
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
