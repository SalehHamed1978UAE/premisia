import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PlanningProgressTracker } from "@/components/intelligent-planning/PlanningProgressTracker";
import { MinimizedJobTracker } from "@/components/MinimizedJobTracker";
import { useJobs } from "@/contexts/JobContext";
import {
  ArrowUp,
  ArrowDown,
  Lightbulb,
  AlertTriangle,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface VersionData {
  id: string;
  versionNumber: number;
  analysis?: {
    bmc_research?: {
      keyInsights?: string[];
      criticalGaps?: string[];
      recommendations?: Array<string | { action: string }>;
    };
  };
  decisions?: {
    decisions?: Array<{
      id: string;
      title: string;
      question: string;
      options: Array<{
        id: string;
        label: string;
        description: string;
        recommended?: boolean;
      }>;
    }>;
  };
  selectedDecisions?: Record<string, string>; // decisionId -> optionId
}

interface PrioritizedItem {
  id: string;
  title: string;
  description: string;
  isRecommended: boolean;
  decisionId: string;
}

export default function PrioritizationPage() {
  const [, params] = useRoute("/strategy-workspace/prioritization/:sessionId/:versionNumber");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { runningJobs } = useJobs();

  const sessionIdParam = params?.sessionId;
  const sessionId = sessionIdParam ?? '';

  const routeVersionNumber = params?.versionNumber ? parseInt(params.versionNumber, 10) : NaN;
  const storedVersionNumber =
    typeof window !== 'undefined' && sessionId
      ? parseInt(window.localStorage.getItem(`strategic-versionNumber-${sessionId}`) || '', 10)
      : NaN;

  const versionNumber =
    !Number.isNaN(routeVersionNumber) && routeVersionNumber > 0
      ? routeVersionNumber
      : !Number.isNaN(storedVersionNumber) && storedVersionNumber > 0
        ? storedVersionNumber
        : 1;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!sessionId || !versionNumber || Number.isNaN(versionNumber)) return;
    window.localStorage.setItem(`strategic-versionNumber-${sessionId}`, versionNumber.toString());
  }, [sessionId, versionNumber]);
  
  // Context sidebar state (collapsed by default on smaller screens)
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Get the running EPM generation job for this session (if any)
  const currentJob = runningJobs.find(
    job => job.jobType === 'epm_generation' && job.sessionId === sessionId
  );
  
  // Extract meaningful title from job metadata
  const getProgressTitle = () => {
    if (currentJob?.inputData?.strategyName) {
      const name = currentJob.inputData.strategyName;
      return name.length > 35 ? name.substring(0, 32) + '...' : name;
    }
    return 'EPM Generation';
  };

  // Fetch strategy version data
  const { data: response, isLoading, error } = useQuery<{ success: boolean; version: VersionData }>({
    queryKey: ['/api/strategic-consultant/versions', sessionId, versionNumber],
    enabled: !!sessionIdParam,
  });

  const versionData = response?.version;
  const strategyVersionId = versionData?.id;

  // Build prioritized items from selected decisions
  const [prioritizedItems, setPrioritizedItems] = useState<PrioritizedItem[]>([]);
  
  // Progress tracking state
  const [showProgress, setShowProgress] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('');
  const [progressId, setProgressId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [completedJobResult, setCompletedJobResult] = useState<{
    programId: string;
    confidence: number;
  } | null>(null);
  
  // Load dismissed job IDs from localStorage (persistent across mounts)
  const [dismissedJobIds, setDismissedJobIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('dismissedEPMJobs');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  
  // Persist dismissed job IDs to localStorage
  const dismissJob = (jobId: string) => {
    setDismissedJobIds(prev => {
      const updated = new Set(prev).add(jobId);
      localStorage.setItem('dismissedEPMJobs', JSON.stringify(Array.from(updated)));
      return updated;
    });
  };

  // Check for existing background job on mount (reconnection logic)
  const { data: existingJob, refetch: refetchJob } = useQuery({
    queryKey: ['/api/background-jobs/by-session', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const res = await fetch(`/api/background-jobs/by-session/${sessionId}`);
      if (!res.ok) throw new Error('Failed to fetch job');
      return res.json();
    },
    retry: false,
  });

  // Initialize prioritized items when data loads
  useEffect(() => {
    if (!versionData) return;
    
    const items: PrioritizedItem[] = [];
    const decisions = versionData.decisions?.decisions || [];
    const selectedDecisions = versionData.selectedDecisions || {};

    decisions.forEach((decision) => {
      const selectedOptionId = selectedDecisions[decision.id];
      if (selectedOptionId) {
        const option = decision.options.find(opt => opt.id === selectedOptionId);
        if (option) {
          items.push({
            id: option.id,
            title: option.label,
            description: option.description,
            isRecommended: option.recommended || false,
            decisionId: decision.id,
          });
        }
      }
    });

    setPrioritizedItems(items);
  }, [versionData]);

  // Handle existing background job (reconnection logic)
  useEffect(() => {
    if (!existingJob?.job) return;
    
    const job = existingJob.job;
    console.log('[Reconnection] Found existing job:', job);
    
    // Skip if this job was already dismissed
    if (dismissedJobIds.has(job.id)) {
      console.log('[Reconnection] Job already dismissed, skipping');
      return;
    }
    
    if (job.jobType !== 'epm_generation') return;
    
    // CRITICAL: Only process jobs for THIS version, not old versions
    const jobVersionNumber = job.inputData?.versionNumber;
    if (jobVersionNumber !== versionNumber) {
      console.log(`[Reconnection] Job version (${jobVersionNumber}) doesn't match current version (${versionNumber}), skipping`);
      return;
    }
    
    // Extract progressId from job inputData (stored during job creation)
    const storedProgressId = job.inputData?.progressId;
    
    if (job.status === 'completed') {
      // Job completed while user was away - show it once
      const programId = job.resultData?.programId;
      const confidence = job.resultData?.overallConfidence || 0;
      
      if (programId) {
        setCompletedJobResult({ programId, confidence });
        toast({
          title: "EPM Generation Complete",
          description: `Your EPM program finished generating while you were away (${Math.round(confidence * 100)}% confidence)`,
        });
      }
    } else if (job.status === 'running' && storedProgressId) {
      // Job still running - reconnect to progress stream using stored progressId
      console.log('[Reconnection] Reconnecting to running job with progressId:', storedProgressId);
      setProgressId(storedProgressId);
      setShowProgress(true);
      toast({
        title: "Resuming EPM Generation",
        description: "Reconnecting to your in-progress EPM generation...",
      });
    } else if (job.status === 'failed' && !dismissedJobIds.has(job.id)) {
      toast({
        title: "EPM Generation Failed",
        description: job.errorMessage || "The EPM generation encountered an error",
        variant: "destructive",
      });
      // Auto-dismiss failed jobs so error doesn't keep showing
      dismissJob(job.id);
    }
  }, [existingJob, dismissedJobIds, toast, dismissJob]);
  
  // Handle viewing completed program - dismiss the job
  const handleViewProgram = () => {
    if (completedJobResult && existingJob?.job) {
      // Dismiss the job so it doesn't reappear on next mount
      dismissJob(existingJob.job.id);
      setCompletedJobResult(null);
      setLocation(`/strategy-workspace/epm/${completedJobResult.programId}`);
    }
  };

  // Extract insights and gaps
  const bmcAnalysis = versionData?.analysis?.bmc_research;
  const keyInsights = bmcAnalysis?.keyInsights || [];
  const criticalGaps = bmcAnalysis?.criticalGaps || [];

  // Connect to SSE for progress updates
  useEffect(() => {
    if (!progressId) return;
    
    const eventSource = new EventSource(`/api/strategy-workspace/epm/progress/${progressId}`);
    eventSourceRef.current = eventSource;
    
    // Timeout: if no events received for 10 minutes, assume failure
    let timeoutId = setTimeout(() => {
      eventSource.close();
      setShowProgress(false);
      toast({
        title: "Generation Timeout",
        description: "EPM generation took too long. Please try again or check your results later.",
        variant: "destructive",
      });
    }, 10 * 60 * 1000); // 10 minute timeout
    
    eventSource.onmessage = (event) => {
      // Reset timeout on any message
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        eventSource.close();
        setShowProgress(false);
        toast({
          title: "Generation Timeout",
          description: "No progress updates received. The generation may have completed - check your programs list.",
          variant: "destructive",
        });
      }, 10 * 60 * 1000);
      
      const data = JSON.parse(event.data);
      console.log('[Progress] Received SSE event:', data);
      
      // Track current progress for minimized view
      if (data.progress !== undefined) {
        setCurrentProgress(data.progress);
      }
      if (data.description || data.message) {
        setCurrentMessage(data.description || data.message);
      }
      
      // Update the progress tracker via window method
      if ((window as any).__updatePlanningProgress) {
        (window as any).__updatePlanningProgress(data);
      }
      
      // Handle completion
      if (data.type === 'complete') {
        clearTimeout(timeoutId);
        eventSource.close();
        setShowProgress(false);

        // Check if program ID exists
        if (!data.epmProgramId) {
          console.error('[Progress] ❌ EPM completed but no program ID returned!', data);
          toast({
            title: "EPM Generation Issue",
            description: "EPM was generated but could not be retrieved. Please check your programs list.",
            variant: "destructive",
          });
          return;
        }

        console.log('[Progress] ✅ EPM generation complete with ID:', data.epmProgramId);
        
        toast({
          title: "EPM Program Generated",
          description: `Created with ${Math.round(parseFloat(data.overallConfidence || '0') * 100)}% confidence`,
        });

        // Navigate to EPM view with valid program ID
        console.log('[Progress] Navigating to:', `/strategy-workspace/epm/${data.epmProgramId}`);
        setLocation(`/strategy-workspace/epm/${data.epmProgramId}`);
      }
      
      // Handle errors
      if (data.type === 'error') {
        clearTimeout(timeoutId);
        eventSource.close();
        setShowProgress(false);
        toast({
          title: "EPM Generation Failed",
          description: data.message || "Please try again",
          variant: "destructive",
        });
      }
    };
    
    eventSource.onerror = () => {
      clearTimeout(timeoutId);
      eventSource.close();
      setShowProgress(false);
      toast({
        title: "Connection Error",
        description: "Lost connection to progress updates. The generation may still be running - check your programs list.",
        variant: "destructive",
      });
    };
    
    return () => {
      clearTimeout(timeoutId);
      eventSource.close();
    };
  }, [progressId, setLocation, toast]);

  // Generate EPM mutation
  const generateEPMMutation = useMutation({
    mutationFn: async () => {
      if (!strategyVersionId) {
        throw new Error('Strategy version ID not available');
      }

      // Save prioritized order
      const prioritizedOrder = prioritizedItems.map(item => item.id);

      // Generate EPM program with prioritized recommendations
      const epmResponse = await apiRequest('POST', '/api/strategy-workspace/epm/generate', {
        strategyVersionId,
        prioritizedOrder,
      });
      return epmResponse.json();
    },
    onSuccess: (data) => {
      // New response format includes progressId
      if (data.progressId) {
        setProgressId(data.progressId);
        setShowProgress(true);
      } else {
        // Fallback to old format
        toast({
          title: "EPM Program Generated",
          description: `Created with ${Math.round(parseFloat(data.overallConfidence) * 100)}% confidence`,
        });
        setLocation(`/strategy-workspace/epm/${data.epmProgramId}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate EPM",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...prioritizedItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    // Swap items
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setPrioritizedItems(newItems);
  };

  if (isLoading) {
    return (
      <AppLayout
        title="Prioritize Strategic Initiatives"
        subtitle="Organize your strategic choices by priority"
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading strategy data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !response) {
    return (
      <AppLayout
        title="Prioritize Strategic Initiatives"
        subtitle="Organize your strategic choices by priority"
      >
        <div className="max-w-2xl mx-auto py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Data</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'Failed to load strategy data'}
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  if (prioritizedItems.length === 0 && versionData) {
    return (
      <AppLayout
        title="Prioritize Strategic Initiatives"
        subtitle="Organize your strategic choices by priority"
      >
        <div className="max-w-2xl mx-auto py-12">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Strategic Decisions</AlertTitle>
            <AlertDescription>
              No strategic decisions found. Please complete the decision-making process first.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button 
              onClick={() => setLocation(`/strategy-workspace/decisions/${sessionId}/${versionNumber}`)}
              className="w-full sm:w-auto"
              data-testid="button-go-decisions"
            >
              Go to Decisions
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Prioritize Strategic Initiatives"
      subtitle="Drag to reorder initiatives by priority - highest priority at the top"
    >
      <div className="flex gap-6 relative">
        {/* Main Content */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Instructions */}
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Finalize Your Strategic Priorities
              </CardTitle>
              <CardDescription>
                Your strategic choices are listed below. Use the arrows to reorder them by priority. 
                The top item will become your primary focus in the EPM program.
              </CardDescription>
            </CardHeader>
          </Card>

        {/* Prioritized Items */}
        <Card>
          <CardHeader>
            <CardTitle>Strategic Initiatives (in priority order)</CardTitle>
            <CardDescription>
              {prioritizedItems.length} {prioritizedItems.length === 1 ? 'initiative' : 'initiatives'} selected
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {prioritizedItems.map((item, index) => (
              <div
                key={`${item.decisionId}-${item.id}`}
                className="flex items-start gap-4 p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
                data-testid={`priority-item-${index}`}
              >
                {/* Priority Number */}
                <div className="flex flex-col items-center gap-1 min-w-[3rem]">
                  <Badge variant={index === 0 ? "default" : "outline"} className="text-lg font-bold">
                    #{index + 1}
                  </Badge>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveItem(index, 'up')}
                      disabled={index === 0}
                      className="h-6 w-6 p-0"
                      data-testid={`button-move-up-${index}`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveItem(index, 'down')}
                      disabled={index === prioritizedItems.length - 1}
                      className="h-6 w-6 p-0"
                      data-testid={`button-move-down-${index}`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Item Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{item.title}</h4>
                    {item.isRecommended && (
                      <Badge variant="default" className="text-xs">
                        AI Recommended
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        {completedJobResult ? (
          <Card className="border-2 border-green-500">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <h3 className="font-semibold">EPM Program Generated</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your EPM program was generated with {Math.round(completedJobResult.confidence * 100)}% confidence. 
                    Click below to view the results.
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={handleViewProgram}
                  className="w-full sm:w-auto"
                  data-testid="button-view-epm"
                >
                  View EPM Program
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-primary">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Ready to Generate Your EPM Program?</h3>
                  <p className="text-sm text-muted-foreground">
                    Your strategic initiatives will be converted into a complete EPM program with workstreams 
                    structured according to your priority order.
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={() => generateEPMMutation.mutate()}
                  disabled={generateEPMMutation.isPending || prioritizedItems.length === 0}
                  className="w-full sm:w-auto"
                  data-testid="button-generate-epm"
                >
                  {generateEPMMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate EPM Program'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Back Button */}
        <div className="flex justify-start">
          <Button
            variant="outline"
            onClick={() => setLocation(`/strategy-workspace/decisions/${sessionId}/${versionNumber}`)}
            data-testid="button-back-decisions"
          >
            ← Back to Decisions
          </Button>
        </div>
        
        {/* Non-Blocking Progress Tracker */}
        {showProgress && !isMinimized && (
          <Card className="fixed top-4 bottom-4 right-4 w-96 shadow-lg z-50 flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden" data-testid="progress-tracker-card">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 flex-1 min-w-0">
                  <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
                  <span className="truncate">{getProgressTitle()}</span>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMinimized(true)}
                  data-testid="button-minimize-progress"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 overflow-y-auto flex-1">
              <PlanningProgressTracker />
              
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  You can safely navigate away. We'll notify you when it's ready.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsMinimized(true);
                    toast({
                      title: "Generation continues in background",
                      description: "Check the Programs menu for completion status",
                    });
                  }}
                  className="flex-1"
                  data-testid="button-navigate-away"
                >
                  Navigate Away
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Minimized Progress Tracker */}
        {showProgress && isMinimized && (
          <MinimizedJobTracker
            progress={currentProgress}
            message={currentMessage}
            title={getProgressTitle()}
            onExpand={() => setIsMinimized(false)}
            onDismiss={() => {
              setIsMinimized(false);
              setShowProgress(false);
            }}
          />
        )}
        </div>

        {/* Context Sidebar - Collapsible on Right */}
        <div className={`hidden lg:block transition-all duration-300 ${sidebarOpen ? 'w-80' : 'w-0'}`}>
          {sidebarOpen && (
            <div className="space-y-4 sticky top-4">
              {keyInsights.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      Key Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-xs">
                      {keyInsights.map((insight, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary font-bold mt-0.5">•</span>
                          <span className="text-muted-foreground">{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {criticalGaps.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Critical Gaps
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-xs">
                      {criticalGaps.map((gap, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-orange-500 font-bold mt-0.5">•</span>
                          <span className="text-muted-foreground">{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Toggle Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden lg:flex fixed right-4 top-24 z-40 shadow-lg"
          data-testid="button-toggle-sidebar"
        >
          {sidebarOpen ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </AppLayout>
  );
}
