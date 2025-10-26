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
  inputData: Record<string, any> | null;
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
        
        // Show completion notification
        const toastId = toast({
          title: '✅ EPM Generation Complete!',
          description: programId 
            ? 'Click to view your program' 
            : 'Your program is ready',
          duration: 15000, // Show for 15 seconds
        });
        
        // Navigate immediately if we have programId
        if (programId) {
          setTimeout(() => setLocation(`/strategy-workspace/epm/${programId}`), 500);
        }
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
