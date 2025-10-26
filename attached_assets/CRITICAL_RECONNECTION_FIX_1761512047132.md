# 🚨 CRITICAL: Reconnection Logic Missing

## Problem
User navigated away during EPM generation and now:
- ❌ Progress tracker disappeared
- ❌ Can't find running job anywhere
- ❌ "Generate EPM" button still available (doesn't know job is running)
- ❌ No way to check job status

**The background job is likely STILL RUNNING in the database, but UI has no idea!**

---

## 🔧 URGENT FIXES

### Fix 1: Add Global Job Context (30 min)

**Create global context to track jobs across all pages:**

```typescript
// client/src/contexts/JobContext.tsx

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface BackgroundJob {
  id: string;
  jobType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  progressMessage: string | null;
  resultData: any;
  sessionId: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface JobContextType {
  runningJobs: BackgroundJob[];
  completedJobs: BackgroundJob[];
  isLoading: boolean;
  refetch: () => void;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export function JobProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [seenCompletions, setSeenCompletions] = useState<Set<string>>(new Set());

  // Poll for ALL user jobs every 3 seconds
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['all-user-jobs'],
    queryFn: async () => {
      const res = await fetch('/api/background-jobs?limit=20');
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    },
    refetchInterval: 3000, // Poll every 3 seconds
  });

  const jobs = data?.jobs || [];
  const runningJobs = jobs.filter((j: BackgroundJob) =>
    j.status === 'pending' || j.status === 'running'
  );
  const completedJobs = jobs.filter((j: BackgroundJob) =>
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

        toast({
          title: '✅ EPM Generation Complete!',
          description: 'Your program is ready to view',
          action: (
            <button
              onClick={() => {
                window.location.href = `/programs/${job.resultData?.programId}`;
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded"
            >
              View Program
            </button>
          ),
          duration: 15000,
        });
      }
    });
  }, [completedJobs, seenCompletions, toast]);

  return (
    <JobContext.Provider value={{ runningJobs, completedJobs, isLoading, refetch }}>
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
```

**Add to App.tsx:**

```typescript
// client/src/App.tsx

import { JobProvider } from '@/contexts/JobContext';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <JobProvider>  {/* ADD THIS */}
        <Router>
          {/* Your routes */}
        </Router>
      </JobProvider>
    </QueryClientProvider>
  );
}
```

---

### Fix 2: Add Global Job Tracker Component (45 min)

**Shows all running jobs, persists across navigation:**

```typescript
// client/src/components/GlobalJobTracker.tsx

import { useJobs } from '@/contexts/JobContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, X, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export function GlobalJobTracker() {
  const { runningJobs } = useJobs();
  const [dismissedJobs, setDismissedJobs] = useState<Set<string>>(new Set());

  if (runningJobs.length === 0) return null;

  const visibleJobs = runningJobs.filter(job => !dismissedJobs.has(job.id));

  if (visibleJobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 space-y-2 z-50">
      {visibleJobs.map(job => (
        <Card key={job.id} className="shadow-lg border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <CardTitle className="text-base">
                  {job.jobType === 'epm_generation' ? 'EPM Generation' : job.jobType}
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDismissedJobs(prev => new Set(prev).add(job.id));
                }}
                className="h-6 w-6"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Progress value={job.progress} className="h-2" />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">
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
                onClick={() => {
                  window.location.href = '/programs';
                }}
              >
                Go to Programs
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Add to App.tsx layout:**

```typescript
// client/src/App.tsx

import { GlobalJobTracker } from '@/components/GlobalJobTracker';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <JobProvider>
        <Router>
          {/* Your routes */}
        </Router>
        <GlobalJobTracker />  {/* ADD THIS - Shows on ALL pages */}
      </JobProvider>
    </QueryClientProvider>
  );
}
```

---

### Fix 3: Disable Buttons When Job Running (30 min)

**Prevent starting duplicate jobs:**

```typescript
// In any component that starts EPM generation

import { useJobs } from '@/contexts/JobContext';

function AnalysisPage() {
  const { runningJobs } = useJobs();

  // Check if EPM generation already running for this session
  const hasRunningEPMJob = runningJobs.some(job =>
    job.jobType === 'epm_generation' &&
    job.sessionId === currentSessionId
  );

  return (
    <Button
      onClick={handleGenerateEPM}
      disabled={hasRunningEPMJob}
    >
      {hasRunningEPMJob ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          EPM Generation In Progress...
        </>
      ) : (
        'Review Results and Make Strategic Decisions'
      )}
    </Button>
  );
}
```

---

### Fix 4: Add Running Jobs to Programs Page (30 min)

```typescript
// client/src/pages/programs/ProgramsPage.tsx

import { useJobs } from '@/contexts/JobContext';

export function ProgramsPage() {
  const { runningJobs, completedJobs } = useJobs();

  return (
    <div className="space-y-6">
      {/* Running Jobs Section */}
      {runningJobs.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            In Progress ({runningJobs.length})
          </h2>
          <div className="space-y-3">
            {runningJobs.map(job => (
              <Card key={job.id}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">EPM Generation</p>
                        <p className="text-sm text-muted-foreground">
                          Started {formatRelativeTime(job.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">{job.progress}%</p>
                      </div>
                    </div>
                    <Progress value={job.progress} />
                    <p className="text-sm text-muted-foreground">
                      {job.progressMessage}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Recently Completed (last hour) */}
      {completedJobs.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">
            Recently Generated
          </h2>
          <div className="space-y-3">
            {completedJobs.slice(0, 5).map(job => (
              <Card
                key={job.id}
                className="cursor-pointer hover:bg-accent"
                onClick={() => {
                  window.location.href = `/programs/${job.resultData?.programId}`;
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">
                          {job.resultData?.summary || 'EPM Program'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Completed {formatRelativeTime(job.completedAt)}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      View <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Existing programs list */}
    </div>
  );
}
```

---

### Fix 5: Add Menu Badge (15 min)

```typescript
// client/src/components/Sidebar.tsx (or wherever menu is)

import { useJobs } from '@/contexts/JobContext';
import { Badge } from '@/components/ui/badge';

function Sidebar() {
  const { runningJobs } = useJobs();

  return (
    <nav>
      <Link to="/programs" className="flex items-center gap-2">
        <FolderKanban className="h-5 w-5" />
        Programs
        {runningJobs.length > 0 && (
          <Badge
            variant="default"
            className="ml-auto animate-pulse bg-blue-500"
          >
            {runningJobs.length}
          </Badge>
        )}
      </Link>
    </nav>
  );
}
```

---

## 🔍 Debug Current Situation

**First, let's check if job is still running:**

```sql
-- Run this in database
SELECT
  id,
  job_type,
  status,
  progress,
  progress_message,
  created_at,
  started_at,
  completed_at,
  error_message
FROM background_jobs
WHERE status IN ('pending', 'running')
ORDER BY created_at DESC
LIMIT 5;
```

**Possible outcomes:**

1. **Job is running** → Need reconnection UI (implement fixes above)
2. **Job completed** → Need to show in Programs page
3. **Job failed** → Need to show error and allow retry
4. **No job found** → Frontend didn't create job (bug in job creation)

---

## 📋 Implementation Order (URGENT)

### Immediate (Do Now):
1. **Fix 1**: Global Job Context (30 min)
2. **Fix 2**: Global Job Tracker (45 min)
3. **Fix 3**: Disable buttons when running (30 min)

**After these 3, user will see running jobs everywhere!**

### Important (Next):
4. **Fix 4**: Programs page sections (30 min)
5. **Fix 5**: Menu badge (15 min)

---

## 🎯 Expected Behavior After Fix

**When user navigates away:**
1. ✅ Job tracker stays visible in bottom-right corner (ALL pages)
2. ✅ Programs menu shows badge: "Programs (1)"
3. ✅ Can go to Programs page and see "In Progress" section
4. ✅ "Generate EPM" button shows "In Progress..." and is disabled
5. ✅ When complete → Toast notification appears
6. ✅ Click toast → Go to program

**User is never lost or confused!**

---

## End of Critical Fix

These fixes make jobs truly persistent across navigation.
