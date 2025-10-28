import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useDocumentInsights } from '@/contexts/DocumentInsightsContext';

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
  const { addNotification, setPanelOpen } = useDocumentInsights();
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

  // Poll for document enrichment notifications every 10 seconds
  const { data: enrichmentData } = useQuery({
    queryKey: ['enrichment-notifications'],
    queryFn: async () => {
      const res = await fetch('/api/document-enrichment/notifications');
      if (!res.ok) throw new Error('Failed to fetch enrichment notifications');
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

  // Handle document enrichment notifications
  useEffect(() => {
    if (!enrichmentData?.jobs) return;

    enrichmentData.jobs.forEach((enrichment: any) => {
      // Add to context - it will check if we've seen it before
      addNotification(enrichment);

      // Show a simple toast notification (action button will be in the FAB)
      toast({
        title: '💡 Knowledge Extracted',
        description: `${enrichment.entityCount} statement${enrichment.entityCount !== 1 ? 's' : ''} from ${enrichment.fileName || 'your document'}. Check the insights panel.`,
        duration: 15000,
      });
    });
  }, [enrichmentData, addNotification, toast]);
}
