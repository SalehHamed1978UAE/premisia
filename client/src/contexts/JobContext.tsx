import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { getAccessToken } from '@/lib/supabase';

interface BackgroundJob {
  id: string;
  jobType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  progressMessage: string | null;
  inputData: Record<string, any> | null;
  resultData: any;
  sessionId: string | null;
  versionNumber: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
}

interface JobContextType {
  runningJobs: BackgroundJob[];
  completedJobs: BackgroundJob[];
  allJobs: BackgroundJob[];
  isLoading: boolean;
  refetch: () => void;
  hasRunningJobForSession: (sessionId: string, jobType: string) => boolean;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export function JobProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [seenCompletions, setSeenCompletions] = useState<Set<string>>(new Set());

  // Poll for ALL user jobs every 3 seconds
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['all-user-jobs'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return { jobs: [] };
      const res = await fetch('/api/background-jobs?limit=50', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) return { jobs: [] };
        throw new Error('Failed to fetch jobs');
      }
      return res.json();
    },
    refetchInterval: 3000, // Poll every 3 seconds
    retry: false,
  });

  const allJobs: BackgroundJob[] = data?.jobs || [];
  const runningJobs = allJobs.filter((j: BackgroundJob) =>
    j.status === 'pending' || j.status === 'running'
  );
  const completedJobs = allJobs.filter((j: BackgroundJob) =>
    j.status === 'completed'
  );

  // Show toast when jobs complete
  useEffect(() => {
    completedJobs.forEach((job: BackgroundJob) => {
      if (seenCompletions.has(job.id)) return;

      // Only notify if completed in last 30 seconds
      const completedAt = new Date(job.completedAt!);
      const now = new Date();
      const secondsAgo = (now.getTime() - completedAt.getTime()) / 1000;

      if (secondsAgo < 30) {
        setSeenCompletions(prev => new Set(prev).add(job.id));

        if (job.jobType === 'epm_generation') {
          const programId = job.resultData?.programId;
          
          toast({
            title: '✅ EPM Generation Complete!',
            description: 'Your program is ready to view',
            duration: 15000,
          });

          // Auto-navigate to program view
          if (programId) {
            setTimeout(() => setLocation(`/strategy-workspace/epm/${programId}`), 500);
          }
        } else {
          toast({
            title: '✅ Job Complete!',
            description: `${job.jobType} finished successfully`,
            duration: 10000,
          });
        }
      }
    });
  }, [completedJobs, seenCompletions, toast, setLocation]);

  // Helper to check if a job is running for a specific session
  const hasRunningJobForSession = (sessionId: string, jobType: string) => {
    return runningJobs.some(job =>
      job.sessionId === sessionId && job.jobType === jobType
    );
  };

  return (
    <JobContext.Provider value={{
      runningJobs,
      completedJobs,
      allJobs,
      isLoading,
      refetch,
      hasRunningJobForSession,
    }}>
      {children}
    </JobContext.Provider>
  );
}

export function useJobs() {
  const context = useContext(JobContext);
  if (context === undefined) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
}
