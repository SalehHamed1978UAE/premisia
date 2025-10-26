import { useJobs } from '@/contexts/JobContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, X, ChevronRight, Minimize2 } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'wouter';

export function GlobalJobTracker() {
  const { runningJobs } = useJobs();
  const [, setLocation] = useLocation();
  const [dismissedJobs, setDismissedJobs] = useState<Set<string>>(new Set());
  const [minimizedJobs, setMinimizedJobs] = useState<Set<string>>(new Set());

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

  return (
    <div className="fixed bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)] space-y-2 z-50" data-testid="global-job-tracker">
      {visibleJobs.map(job => {
        const isMinimized = minimizedJobs.has(job.id);
        
        if (isMinimized) {
          // Minimized compact view
          return (
            <Card 
              key={job.id} 
              className="shadow-lg border-2 cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => setMinimizedJobs(prev => {
                const next = new Set(prev);
                next.delete(job.id);
                return next;
              })}
              data-testid={`minimized-job-${job.id}`}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getJobTypeLabel(job.jobType)}
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
          <Card key={job.id} className="shadow-lg border-2" data-testid={`expanded-job-${job.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <CardTitle className="text-base">
                    {getJobTypeLabel(job.jobType)}
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
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {job.progressMessage || 'Processing...'}
                  </p>
                  <p className="text-xs font-medium">{job.progress}%</p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  ℹ️ You can safely navigate anywhere. We'll notify you when it's ready.
                </p>
              </div>

              {job.jobType === 'epm_generation' && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setLocation('/strategy-workspace/programs')}
                  data-testid="button-view-programs"
                >
                  Go to Programs
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
