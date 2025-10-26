# 🚨 Background Jobs UX Fix - Non-Blocking Progress

## Problem Identified

When EPM generation starts with SSE progress tracker:
- ❌ Page gets blurred/locked (modal overlay)
- ❌ User can't click anything else
- ❌ User can't navigate away
- ❌ **This defeats the entire purpose of background jobs!**

## Solution: Non-Blocking Progress with Exit Option

---

## 🎯 User Experience We Want

### When User Starts EPM Generation:

```
┌─────────────────────────────────────────────────┐
│  📊 EPM Generation In Progress                  │
│                                                  │
│  [Progress Bar: ████████░░░░░░░░ 45%]          │
│  Building planning context...                   │
│                                                  │
│  ℹ️  You can safely leave this page.            │
│     We'll notify you when it's ready.           │
│                                                  │
│  [Continue Watching]  [Navigate Away]           │
└─────────────────────────────────────────────────┘

Rest of page is NOT blurred - user can still see/click things
```

### If User Clicks "Navigate Away":
```
✅ Progress tracker minimizes to small toast/banner at top
✅ User can navigate anywhere in the app
✅ Progress continues in background
✅ When complete → Toast notification + badge on "Programs" menu
```

### If User Stays:
```
✅ Progress tracker stays visible (non-blocking)
✅ Can still click other things on page
✅ When complete → Shows "View Program" button
```

---

## 📋 Implementation Tasks

### Task 1: Remove Modal Overlay/Blur (15 min)

**Problem:** Progress tracker is likely using a modal component that locks the page.

**Files to check:**
- `client/src/pages/strategic-consultant/*` (wherever EPM generation is triggered)
- Look for `<Dialog>`, `<Modal>`, or `backdrop-blur` classes

**Fix:**

```typescript
// BEFORE (Modal - blocks page):
<Dialog open={isGenerating}>
  <DialogContent className="backdrop-blur">
    <Progress value={progress} />
    <p>{progressMessage}</p>
  </DialogContent>
</Dialog>

// AFTER (Non-blocking Card):
{isGenerating && (
  <Card className="fixed bottom-4 right-4 w-96 shadow-lg z-50">
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle>EPM Generation In Progress</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMinimize}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <Progress value={progress} />
      <p className="text-sm text-muted-foreground mt-2">
        {progressMessage}
      </p>

      <Alert className="mt-4">
        <Info className="h-4 w-4" />
        <AlertDescription>
          You can safely navigate away. We'll notify you when it's ready.
        </AlertDescription>
      </Alert>

      <div className="flex gap-2 mt-4">
        <Button
          variant="outline"
          onClick={handleNavigateAway}
          className="flex-1"
        >
          Navigate Away
        </Button>
        <Button
          variant="default"
          disabled
          className="flex-1"
        >
          Continue Watching
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

**Key changes:**
- `fixed bottom-4 right-4` - Positioned in corner, doesn't block page
- NO `Dialog` or `Modal` wrapper
- NO `backdrop-blur` or overlay
- Add "Navigate Away" button
- Add info message about notifications

---

### Task 2: Minimize Progress Tracker (30 min)

**Create minimized state:**

```typescript
// client/src/components/MinimizedJobTracker.tsx

interface MinimizedJobTrackerProps {
  job: BackgroundJob;
  onExpand: () => void;
  onDismiss: () => void;
}

export function MinimizedJobTracker({ job, onExpand, onDismiss }: MinimizedJobTrackerProps) {
  return (
    <div className="fixed top-4 right-4 w-80 bg-background border rounded-lg shadow-lg z-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className="text-sm font-medium">EPM Generation</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onExpand}
            className="h-6 w-6"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className="h-6 w-6"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Progress value={job.progress} className="h-1" />
      <p className="text-xs text-muted-foreground mt-1">
        {job.progress}% - {job.progressMessage}
      </p>
    </div>
  );
}
```

**Usage:**

```typescript
const [isMinimized, setIsMinimized] = useState(false);

const handleNavigateAway = () => {
  setIsMinimized(true);
  // User can now navigate anywhere
};

return (
  <>
    {isMinimized ? (
      <MinimizedJobTracker
        job={currentJob}
        onExpand={() => setIsMinimized(false)}
        onDismiss={() => {
          // Store dismissal in localStorage
          localStorage.setItem(`job-dismissed-${currentJob.id}`, 'true');
          setIsMinimized(false);
        }}
      />
    ) : (
      <FullProgressTracker
        job={currentJob}
        onMinimize={() => setIsMinimized(true)}
      />
    )}
  </>
);
```

---

### Task 3: Notification System (1 hour)

**Three notification methods:**

#### 3.1: In-App Toast (Immediate - Required)

```typescript
// client/src/hooks/useJobNotifications.ts

import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useRef } from 'react';

export function useJobNotifications() {
  const { toast } = useToast();
  const seenJobs = useRef(new Set<string>());

  // Poll for completed jobs every 10 seconds
  useQuery({
    queryKey: ['job-notifications'],
    queryFn: async () => {
      const res = await fetch('/api/background-jobs/recent-completions');
      return res.json();
    },
    refetchInterval: 10000, // Every 10 seconds
    onSuccess: (data) => {
      const { jobs } = data;

      jobs.forEach((job: BackgroundJob) => {
        if (seenJobs.current.has(job.id)) return;

        seenJobs.current.add(job.id);

        if (job.status === 'completed') {
          toast({
            title: '✅ EPM Generation Complete!',
            description: 'Your program is ready to view',
            action: (
              <Button onClick={() => navigateToResult(job)}>
                View Program
              </Button>
            ),
            duration: 10000, // Show for 10 seconds
          });
        } else if (job.status === 'failed') {
          toast({
            title: '❌ EPM Generation Failed',
            description: job.errorMessage || 'An error occurred',
            variant: 'destructive',
          });
        }
      });
    },
  });
}

// Use in App.tsx or root layout
export default function App() {
  useJobNotifications(); // Always running

  return <Router>...</Router>;
}
```

#### 3.2: Menu Badge (Visual Indicator - Required)

```typescript
// client/src/components/layout/Sidebar.tsx (or wherever menu is)

import { useQuery } from '@tanstack/react-query';

function Sidebar() {
  const { data: runningJobs } = useQuery({
    queryKey: ['running-jobs'],
    queryFn: async () => {
      const res = await fetch('/api/background-jobs/running');
      return res.json();
    },
    refetchInterval: 5000, // Every 5 seconds
  });

  const runningCount = runningJobs?.jobs?.length || 0;

  return (
    <nav>
      {/* Other menu items */}

      <Link to="/programs" className="flex items-center gap-2">
        <FolderKanban className="h-5 w-5" />
        Programs

        {runningCount > 0 && (
          <Badge variant="default" className="ml-auto animate-pulse">
            {runningCount}
          </Badge>
        )}
      </Link>
    </nav>
  );
}
```

#### 3.3: Email Notifications (Optional - Low Priority)

**For later implementation:**

```typescript
// server/services/email-notification-service.ts

export class EmailNotificationService {
  async sendJobCompletionEmail(userId: string, job: BackgroundJob) {
    const user = await db.select().from(users).where(eq(users.id, userId));

    if (!user[0]?.email) return;

    await sendEmail({
      to: user[0].email,
      subject: 'Your EPM Program is Ready',
      html: `
        <h2>EPM Generation Complete</h2>
        <p>Your program "${job.resultData.summary}" is ready to view.</p>
        <a href="${process.env.APP_URL}/programs/${job.resultData.programId}">
          View Program
        </a>
      `,
    });
  }
}

// Call after job completion
await backgroundJobService.updateJob(jobId, { status: 'completed' });
await emailNotificationService.sendJobCompletionEmail(userId, job);
```

**Priority:**
1. ✅ **In-app toast** (Required - implement now)
2. ✅ **Menu badge** (Required - implement now)
3. ⏭️ **Email** (Optional - implement later if users request)

---

### Task 4: Add Completed Jobs to Programs Page (45 min)

**Show recent EPM generations in Programs page:**

```typescript
// client/src/pages/programs/ProgramsPage.tsx

import { useQuery } from '@tanstack/react-query';

export function ProgramsPage() {
  // Existing programs query
  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: fetchPrograms,
  });

  // NEW: Recent EPM jobs
  const { data: recentJobs } = useQuery({
    queryKey: ['recent-epm-jobs'],
    queryFn: async () => {
      const res = await fetch('/api/background-jobs?jobType=epm_generation&limit=10');
      return res.json();
    },
  });

  const completedJobs = recentJobs?.jobs?.filter(j => j.status === 'completed') || [];
  const runningJobs = recentJobs?.jobs?.filter(j => j.status === 'running' || j.status === 'pending') || [];

  return (
    <div className="space-y-6">
      {/* Running Jobs Section */}
      {runningJobs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">In Progress</h2>
          {runningJobs.map(job => (
            <Card key={job.id} className="mb-2">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <div className="flex-1">
                    <p className="font-medium">EPM Generation</p>
                    <p className="text-sm text-muted-foreground">
                      {job.progressMessage}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{job.progress}%</p>
                    <p className="text-xs text-muted-foreground">
                      Started {formatRelativeTime(job.createdAt)}
                    </p>
                  </div>
                </div>
                <Progress value={job.progress} className="mt-2" />
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Recently Completed Jobs */}
      {completedJobs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Recently Generated</h2>
          {completedJobs.map(job => (
            <Card key={job.id} className="mb-2 cursor-pointer hover:bg-accent" onClick={() => {
              navigate(`/programs/${job.resultData.programId}`);
            }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div className="flex-1">
                    <p className="font-medium">{job.resultData.summary || 'EPM Program'}</p>
                    <p className="text-sm text-muted-foreground">
                      Completed {formatRelativeTime(job.completedAt)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    View <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Existing Programs List */}
      <section>
        <h2 className="text-lg font-semibold mb-3">All Programs</h2>
        {/* Existing program cards */}
      </section>
    </div>
  );
}
```

---

### Task 5: Add Backend Endpoint for Recent Completions (15 min)

```typescript
// server/routes/background-jobs.ts

// Get recent completions (for notifications)
router.get('/recent-completions', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get jobs completed in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const jobs = await db
      .select()
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.userId, userId),
          inArray(backgroundJobs.status, ['completed', 'failed']),
          gte(backgroundJobs.completedAt, fiveMinutesAgo)
        )
      )
      .orderBy(desc(backgroundJobs.completedAt));

    res.json({ success: true, jobs });
  } catch (error: any) {
    console.error('Error fetching recent completions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get jobs by type (for Programs page)
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const jobType = req.query.jobType as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    let query = db
      .select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.userId, userId))
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(limit);

    if (jobType) {
      query = query.where(
        and(
          eq(backgroundJobs.userId, userId),
          eq(backgroundJobs.jobType, jobType as any)
        )
      );
    }

    const jobs = await query;

    res.json({ success: true, jobs });
  } catch (error: any) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

## 🎯 Summary of Changes

### What User Sees:

**1. Start EPM Generation:**
- ✅ Progress card in corner (not blocking)
- ✅ "Navigate Away" button with helpful message
- ✅ Can still interact with rest of page

**2. Navigate Away:**
- ✅ Progress minimizes to small banner at top
- ✅ Badge appears on "Programs" menu showing "1 in progress"
- ✅ Can go anywhere in app

**3. Job Completes:**
- ✅ Toast notification pops up: "EPM Generation Complete! [View Program]"
- ✅ Badge on "Programs" menu updates
- ✅ Program appears in "Recently Generated" section

**4. Return to Programs Page:**
- ✅ See "In Progress" section (if jobs running)
- ✅ See "Recently Generated" section (completed jobs)
- ✅ Click to view program directly

---

## 📋 Implementation Checklist for Replit

- [ ] **Task 1**: Remove modal/blur from progress tracker (15 min)
- [ ] **Task 2**: Create minimized progress component (30 min)
- [ ] **Task 3**: Add toast notifications with polling (1 hour)
- [ ] **Task 4**: Add running/completed jobs to Programs page (45 min)
- [ ] **Task 5**: Add `/recent-completions` API endpoint (15 min)

**Total: ~2.5 hours**

---

## 🎯 Testing Checklist

After implementation:

- [ ] Start EPM generation
- [ ] Verify page is NOT blurred/locked
- [ ] Click "Navigate Away" button
- [ ] Progress minimizes to small banner
- [ ] Navigate to different page (e.g., /dashboard)
- [ ] Verify minimized banner still visible at top
- [ ] Check "Programs" menu has badge showing "1 in progress"
- [ ] Wait for job to complete
- [ ] Verify toast notification appears
- [ ] Click toast "View Program" button
- [ ] Verify navigates to program correctly
- [ ] Go to Programs page
- [ ] Verify program shows in "Recently Generated" section

---

## 📧 Email Notifications - Decision Needed

**Question:** Should we send email notifications?

**Pros:**
- ✅ User gets notified even if they close browser
- ✅ Professional feel
- ✅ Good for very long operations (>10 min)

**Cons:**
- ❌ Requires email service setup (SendGrid, AWS SES, etc.)
- ❌ Cost considerations
- ❌ SPAM concerns
- ❌ Most jobs complete in 5-7 minutes (user likely still browsing)

**My Recommendation:**
- **Start with in-app toast + badge** (no email)
- **Add email later** if users request it or if you see users frequently miss completions
- **Or make it opt-in** (user preference: "Email me when long operations complete")

**For MVP:** Skip email, focus on in-app notifications.

---

## End of UX Fix Guide

This turns background jobs from "locked and waiting" into "free to explore while we work."
