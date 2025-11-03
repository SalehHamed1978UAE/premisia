import { useJobs } from '@/contexts/JobContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, X, ChevronRight, Minimize2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function GlobalJobTracker() {
  const { runningJobs } = useJobs();
  const [location, setLocationNav] = useLocation();
  const { toast } = useToast();
  const [dismissedJobs, setDismissedJobs] = useState<Set<string>>(new Set());
  const [minimizedJobs, setMinimizedJobs] = useState<Set<string>>(new Set());
  const [showAllJobs, setShowAllJobs] = useState(false);

  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiRequest('DELETE', `/api/background-jobs/${jobId}`);
    },
    onSuccess: (_, jobId) => {
      toast({
        title: "Job Cancelled",
        description: "The background job has been cancelled successfully.",
      });
      // Remove from dismissed list so it disappears
      setDismissedJobs(prev => new Set(prev).add(jobId));
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error?.message || "Unable to cancel the job. It may have already completed.",
        variant: "destructive",
      });
    },
  });

  // Don't show on PrioritizationPage - it has its own detailed tracker
  const onPrioritizationPage = location.includes('/strategy-workspace/prioritization');
  if (onPrioritizationPage) return null;

  if (runningJobs.length === 0) return null;

  const visibleJobs = runningJobs.filter(job => !dismissedJobs.has(job.id));

  if (visibleJobs.length === 0) return null;

  const getJobTypeLabel = (jobType: string) => {
    switch (jobType) {
      case 'epm_generation': return 'EPM Generation';
      case 'bmc_analysis': return 'Business Model Canvas Analysis';
      case 'five_whys_generation': return 'Five Whys Analysis';
      case 'porters_analysis': return 'Porter\'s Five Forces Analysis';
      case 'pestle_analysis': return 'PESTLE Analysis';
      case 'web_research': return 'Web Research';
      case 'strategic_understanding': return 'Strategic Understanding';
      default: return jobType;
    }
  };

  // Extract meaningful title from job metadata
  const getJobTitle = (job: any) => {
    const inputData = job.inputData || {};
    
    // For EPM generation, show strategy name
    if (job.jobType === 'epm_generation' && inputData.strategyName) {
      // Truncate long names to 40 chars
      const name = inputData.strategyName;
      return name.length > 40 ? name.substring(0, 37) + '...' : name;
    }
    
    // Fallback to generic type label
    return getJobTypeLabel(job.jobType);
  };

  // Overflow handling - show summary if 4+ jobs
  const hasOverflow = visibleJobs.length > 3;
  const jobsToDisplay = hasOverflow && !showAllJobs ? visibleJobs.slice(0, 2) : visibleJobs;

  return (
    <div className="fixed bottom-4 right-4 w-full sm:w-96 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto space-y-2 z-50" data-testid="global-job-tracker">
      {jobsToDisplay.map(job => {
        const isMinimized = minimizedJobs.has(job.id);
        
        if (isMinimized) {
          // Minimized compact view
          return (
            <Card 
              key={job.id} 
              className="shadow-lg border-2 cursor-pointer hover:shadow-xl transition-shadow bg-card dark:bg-gray-900 opacity-100"
              onClick={() => setMinimizedJobs(prev => {
                const next = new Set(prev);
                next.delete(job.id);
                return next;
              })}
              data-testid={`minimized-job-${job.id}`}
              style={{ backgroundColor: 'var(--card)' }}
            >
              <CardContent className="p-3 bg-card dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getJobTitle(job)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {job.progress}% - {job.progressMessage || 'Processing...'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDismissedJobs(prev => new Set(prev).add(job.id));
                    }}
                    data-testid="button-dismiss-minimized"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        }

        // Full expanded view
        return (
          <Card 
            key={job.id} 
            className="shadow-lg border-2 bg-card dark:bg-gray-900 opacity-100" 
            data-testid={`expanded-job-${job.id}`}
            style={{ backgroundColor: 'var(--card)' }}
          >
            <CardHeader className="pb-3 bg-card dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
                  <CardTitle className="text-base truncate">
                    {getJobTitle(job)}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMinimizedJobs(prev => new Set(prev).add(job.id))}
                    className="h-6 w-6"
                    data-testid="button-minimize-job"
                  >
                    <Minimize2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDismissedJobs(prev => new Set(prev).add(job.id))}
                    className="h-6 w-6"
                    data-testid="button-dismiss-job"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Progress value={job.progress} className="h-2" />
                <div className="flex items-center justify-between mt-1 gap-2">
                  <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
                    {job.progressMessage || 'Processing...'}
                  </p>
                  <p className="text-xs font-medium flex-shrink-0">{job.progress}%</p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">
                  ℹ️ You can safely navigate anywhere. We'll notify you when it's ready.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {job.jobType === 'epm_generation' && (
                  <Button
                    variant="outline"
                    className="flex-1 text-xs sm:text-sm"
                    size="sm"
                    onClick={() => setLocationNav('/strategy-workspace/programs')}
                    data-testid="button-view-programs"
                  >
                    Go to Programs
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={job.jobType === 'epm_generation' ? 'text-xs sm:text-sm' : 'w-full text-xs sm:text-sm'}
                  onClick={() => cancelJobMutation.mutate(job.id)}
                  disabled={cancelJobMutation.isPending}
                  data-testid={`button-cancel-job-${job.id}`}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {/* Overflow summary card - show if 4+ jobs and not showing all */}
      {hasOverflow && !showAllJobs && (
        <Card className="shadow-lg border-2 border-blue-500/50" data-testid="job-overflow-summary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <div>
                  <p className="text-sm font-medium">
                    + {visibleJobs.length - 2} more job{visibleJobs.length - 2 !== 1 ? 's' : ''} running
                  </p>
                  <p className="text-xs text-muted-foreground">
                    All jobs processing in background
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllJobs(true)}
                data-testid="button-show-all-jobs"
              >
                View All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Show "Collapse" button if showing all jobs */}
      {hasOverflow && showAllJobs && (
        <Card className="shadow-lg border-2 border-blue-500/50" data-testid="job-collapse-summary">
          <CardContent className="p-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllJobs(false)}
              className="w-full"
              data-testid="button-collapse-jobs"
            >
              Show Less
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
