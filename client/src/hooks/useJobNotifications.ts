import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';

interface BackgroundJob {
  id: string;
  jobType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  progressMessage: string | null;
  resultData: any;
  errorMessage: string | null;
  completedAt: string | null;
  failedAt: string | null;
}

export function useJobNotifications() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const seenJobs = useRef(new Set<string>());

  // Poll for completed jobs every 10 seconds
  const { data } = useQuery({
    queryKey: ['job-notifications'],
    queryFn: async () => {
      const res = await fetch('/api/background-jobs/recent-completions');
      if (!res.ok) throw new Error('Failed to fetch job notifications');
      return res.json();
    },
    refetchInterval: 10000, // Every 10 seconds
    retry: false,
  });

  useEffect(() => {
    if (!data?.jobs) return;

    const jobs: BackgroundJob[] = data.jobs;

    jobs.forEach((job: BackgroundJob) => {
      if (seenJobs.current.has(job.id)) return;

      seenJobs.current.add(job.id);

      if (job.status === 'completed' && job.jobType === 'epm_generation') {
        const programId = job.resultData?.programId;
        
        toast({
          title: '✅ EPM Generation Complete!',
          description: 'Your program is ready to view',
          action: programId ? (
            <button
              onClick={() => setLocation(`/strategy-workspace/epm/${programId}`)}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              View Program
            </button>
          ) : undefined,
          duration: 15000, // Show for 15 seconds
        });
      } else if (job.status === 'failed') {
        toast({
          title: '❌ Generation Failed',
          description: job.errorMessage || 'An error occurred during generation',
          variant: 'destructive',
          duration: 10000,
        });
      }
    });
  }, [data, toast, setLocation]);
}
