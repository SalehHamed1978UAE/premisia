# 🎯 Universal Background Jobs - HYBRID Approach

## ⚡ **IMPORTANT CLARIFICATION**

This is **NOT** about removing the current foreground experience. We want **BOTH**:

1. ✅ **Keep current flow** - User stays on page, watches progress, sees results immediately
2. ✅ **Add safety net** - If user navigates away, job continues and they can check back later

---

## 🎭 Dual-Mode Design

### Mode 1: Foreground (Primary) - **Keep Existing UX**
```
User triggers EPM generation
  ↓
Stays on page watching progress bar
  ↓
Sees live updates (SSE/polling)
  ↓
Gets result immediately
  ↓
Continues to next step
```

**This is what we have now - KEEP IT!**

### Mode 2: Background (Safety Net) - **NEW**
```
User triggers EPM generation
  ↓
Starts watching progress...
  ↓
User navigates away (closes tab, goes to different page, etc.)
  ↓
Job continues running in background
  ↓
User returns later → sees "Job completed" notification
  ↓
Can view results
```

**This is what we're ADDING.**

---

## 🏗️ Architecture Changes (Minimal)

### What Changes:
1. **Create background job record** when operation starts
2. **Track job in database** so we can find it later
3. **Add "Jobs" page** to see running/completed jobs
4. **Add notification** when background jobs complete

### What DOESN'T Change:
- ✅ Current progress bars and live updates
- ✅ SSE streaming (BMC, Web Research)
- ✅ Immediate result display
- ✅ User flow and navigation
- ✅ UI/UX of existing pages

---

## 📋 Revised Implementation Plan

### Phase 1: Database & Job Tracking (30 min)
**Goal**: Track long-running operations in database

**Same as before**:
- Create `background_jobs` table
- Job service for CRUD operations

**New thinking**: This is just an audit log + recovery mechanism

---

### Phase 2: Hybrid Job Creation (1 hour)

**Update operation endpoints to create job record**:

```typescript
// BEFORE (Current):
router.post('/generate-epm', async (req, res) => {
  // Start EPM generation
  const result = await epmSynthesizer.synthesize(...);

  // Return result
  res.json({ programId: result.programId });
});

// AFTER (Hybrid):
router.post('/generate-epm', async (req, res) => {
  const userId = req.user.claims.sub;

  // 1. Create background job record (NEW)
  const jobId = await backgroundJobService.createJob({
    userId,
    jobType: 'epm_generation',
    inputData: { understandingId, sessionId },
    sessionId,
  });

  // 2. Start EPM generation (SAME AS BEFORE)
  // But now update job record as we go
  const result = await epmSynthesizer.synthesize({
    understandingId,
    sessionId,
    onProgress: (progress, message) => {
      // Update job record (NEW)
      backgroundJobService.updateJob(jobId, { progress, progressMessage: message });

      // Send to frontend via SSE (EXISTING)
      res.write(`data: ${JSON.stringify({ progress, message })}\n\n`);
    }
  });

  // 3. Mark job complete (NEW)
  await backgroundJobService.updateJob(jobId, {
    status: 'completed',
    resultData: { programId: result.programId }
  });

  // 4. Return result (SAME AS BEFORE)
  res.json({ success: true, programId: result.programId, jobId });
});
```

**Key insight**: We're adding job tracking ALONGSIDE existing behavior, not replacing it.

---

### Phase 3: Add Jobs Dashboard (1 hour)

**Create new page**: `/jobs` or `/background-jobs`

Shows:
- Currently running jobs (with progress)
- Recently completed jobs
- Failed jobs with error messages

**This is OPTIONAL navigation** - users can check if they want to see what's running.

---

### Phase 4: Add Reconnection Logic (1 hour)

**Handle browser refresh / return later**:

```typescript
// When user returns to a page that was processing something
useEffect(() => {
  const checkForRunningJobs = async () => {
    // Check if there's a running job for this session
    const runningJobs = await fetch('/api/background-jobs/running').then(r => r.json());

    const relevantJob = runningJobs.jobs.find(j =>
      j.sessionId === currentSessionId &&
      j.jobType === 'epm_generation'
    );

    if (relevantJob) {
      // Found a running job! Resume watching it
      setJobId(relevantJob.id);
      setShowProgressBar(true);
    }
  };

  checkForRunningJobs();
}, []);
```

**User experience**:
- User starts EPM generation, leaves page
- Comes back later
- Page says "Your EPM generation is still running (75% complete)"
- Can watch it finish OR navigate elsewhere

---

### Phase 5: Notifications (Optional, 30 min)

**Toast notification when background job completes**:

```typescript
// Poll for job completion
useEffect(() => {
  if (!userId) return;

  const interval = setInterval(async () => {
    const response = await fetch('/api/background-jobs/recent-completions');
    const { jobs } = await response.json();

    jobs.forEach(job => {
      if (job.status === 'completed' && !seenJobs.has(job.id)) {
        toast({
          title: `${job.jobType} completed!`,
          description: 'Click to view results',
          action: <Button onClick={() => navigate(`/view/${job.id}`)}>View</Button>
        });
        seenJobs.add(job.id);
      }
    });
  }, 10000); // Check every 10 seconds

  return () => clearInterval(interval);
}, [userId]);
```

---

## 🎯 Example User Journeys

### Journey 1: User Stays (Current Behavior - Unchanged)
```
1. Click "Generate EPM Program"
2. Progress bar appears: "Extracting tasks... 25%"
3. Watches progress: "Generating resources... 50%"
4. Sees completion: "Done! View program"
5. Clicks to view program
```

**Nothing changes here!**

### Journey 2: User Leaves (New Capability)
```
1. Click "Generate EPM Program"
2. Progress bar appears: "Extracting tasks... 25%"
3. User remembers they need to check email
4. Navigates to different page / closes tab
5. [Job continues running in background]
6. User returns 5 minutes later
7. Sees notification: "EPM Program generation completed!"
8. Clicks notification → views program
```

**This is the new safety net.**

### Journey 3: User Checks Jobs Page (New Optional Feature)
```
1. User goes to /jobs page
2. Sees list of operations:
   - ✅ Coffee Shop EPM - Completed 5 min ago
   - 🔄 Market Research - Running (75%)
   - ❌ Five Whys Analysis - Failed
3. Can click any to view details/results
```

**This is for power users who want visibility.**

---

## 🔧 Implementation Priority

### Must Have (Core Safety Net):
1. ✅ Database job tracking
2. ✅ Update job records during operations
3. ✅ API to check job status
4. ✅ Reconnection logic (resume watching if user returns)

### Nice to Have (Enhanced UX):
5. ⭐ Jobs dashboard page
6. ⭐ Toast notifications for completions
7. ⭐ Job history with filters
8. ⭐ Retry failed jobs

### Can Skip for MVP:
9. ❌ Job queue with workers (not needed - operations run immediately)
10. ❌ Concurrent job limiting
11. ❌ Job prioritization

---

## 🚫 What We're NOT Doing

### ❌ NOT Replacing SSE with Polling
- BMC Research uses SSE → **Keep it**
- Web Research uses SSE → **Keep it**
- Just add job tracking alongside

### ❌ NOT Changing User Flow
- User still sees progress bars
- User still gets immediate results
- Just adding safety net if they leave

### ❌ NOT Building Job Queue
- Operations run immediately (not queued)
- Job record is for tracking, not scheduling

### ❌ NOT Hiding Progress
- Keep all progress UI
- Keep all streaming updates
- Just add recovery mechanism

---

## 📝 Revised Code Example

### Minimal Changes to Existing Endpoint

```typescript
// File: server/routes/strategic-consultant.ts

router.post('/generate-epm', async (req, res) => {
  try {
    const { understandingId, sessionId } = req.body;
    const userId = req.user.claims.sub;

    // NEW: Create job record for tracking
    const jobId = await backgroundJobService.createJob({
      userId,
      jobType: 'epm_generation',
      inputData: { understandingId, sessionId },
      sessionId,
      relatedEntityId: understandingId,
      relatedEntityType: 'strategic_understanding',
    });

    // EXISTING: Run EPM synthesis
    // But now we update job record too
    const result = await epmSynthesizer.synthesizeProgram(
      understandingId,
      sessionId,
      userId,
      {
        // EXISTING: SSE progress updates
        onProgress: async (progress, message) => {
          // NEW: Update job record (for recovery)
          await backgroundJobService.updateJob(jobId, {
            status: 'running',
            progress,
            progressMessage: message,
          });
        }
      }
    );

    // NEW: Mark job complete
    await backgroundJobService.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      resultData: {
        programId: result.programId,
        summary: result.summary,
      },
    });

    // EXISTING: Return result (unchanged)
    res.json({
      success: true,
      programId: result.programId,
      summary: result.summary,
      jobId, // NEW: Include jobId so frontend can track
    });

  } catch (error) {
    // NEW: Mark job failed
    if (jobId) {
      await backgroundJobService.failJob(jobId, error);
    }

    // EXISTING: Return error
    res.status(500).json({ error: error.message });
  }
});
```

**Notice**: The core logic is the same! We just added job tracking.

---

## 🎨 Frontend Changes (Minimal)

### Current Component (Keep This)
```typescript
// User stays on page, watches progress
<div>
  <Progress value={progress} />
  <p>{progressMessage}</p>
</div>
```

### Add Reconnection Logic
```typescript
// NEW: Check if operation was running when user left
useEffect(() => {
  const checkRunningJob = async () => {
    if (!sessionId) return;

    const res = await fetch(`/api/background-jobs/by-session/${sessionId}`);
    const { job } = await res.json();

    if (job && (job.status === 'pending' || job.status === 'running')) {
      // Resume watching this job
      setResumedJobId(job.id);
      setShowProgress(true);
    } else if (job && job.status === 'completed') {
      // Job finished while user was away
      setShowCompletionMessage(true);
    }
  };

  checkRunningJob();
}, [sessionId]);
```

### Add Optional "View Jobs" Link
```typescript
// In navigation
<Link to="/jobs">
  Background Jobs {runningCount > 0 && `(${runningCount})`}
</Link>
```

---

## ✅ Success Criteria (Revised)

### Must Work:
- ✅ User can stay on page and watch progress (existing behavior)
- ✅ User can leave page, job continues
- ✅ User can return and see job status
- ✅ If job completes while away, user can view results

### Nice to Have:
- ⭐ Toast notification when background job completes
- ⭐ Jobs dashboard page
- ⭐ Job history

### Not Required:
- ❌ Job queue
- ❌ Worker processes
- ❌ Concurrent limits

---

## 🎯 Implementation Steps (Revised)

### Step 1: Add Job Tracking (30 min)
- Create `background_jobs` table
- Create `BackgroundJobService`
- Test CRUD operations

### Step 2: Update EPM Endpoint (30 min)
- Add job creation before synthesis
- Add job updates during progress
- Add job completion after result
- Keep all existing behavior

### Step 3: Add Reconnection API (30 min)
- `GET /api/background-jobs/by-session/:sessionId`
- `GET /api/background-jobs/running` (for current user)
- Test reconnection flow

### Step 4: Update Frontend (1 hour)
- Add reconnection check on page load
- Show "resuming..." state if job found
- Show "completed while away" message if needed
- Keep all existing progress UI

### Step 5: Add Jobs Page (Optional, 1 hour)
- Create `/jobs` route
- List all user's jobs
- Show status, progress, errors
- Link to results

---

## 📊 Comparison

### What User Had Before:
```
Start operation → Watch progress → Get result → Continue
                ↓ (if user leaves)
               Lost! Must start over.
```

### What User Has After:
```
Start operation → Watch progress → Get result → Continue
                ↓ (if user leaves)
               Job continues → Return later → See result
```

**We're adding the safety net, not replacing the experience.**

---

## 🎬 Ready to Implement

This is much less invasive than a full background job system!

**Core message**: We're adding an audit trail and recovery mechanism, not rebuilding the execution model.

**Time estimate**: 2-3 hours (not 4-5) since we're keeping existing flows.

**Key files to modify**:
1. `shared/schema.ts` - Add jobs table
2. `server/services/background-job-service.ts` - CRUD for jobs
3. `server/routes/strategic-consultant.ts` - Add job tracking to existing endpoints
4. `client/src/hooks/useJobRecovery.ts` - Check for running jobs on mount
5. `client/src/pages/JobsPage.tsx` - Optional dashboard

**Key insight**: Minimal changes, maximum safety net.
