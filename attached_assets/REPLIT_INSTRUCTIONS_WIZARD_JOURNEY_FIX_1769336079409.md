# CRITICAL FIX: Wizard-Created Journey Execution

## The Problem

There are THREE journey systems in the codebase:

1. **Strategic Journeys** (`journeySessions` table) - Has `JourneyOrchestrator` executor ✅
2. **Custom Journey Builder** (`customJourneyExecutions` table) - Has `CustomJourneyExecutor` ✅
3. **Wizard Templates** (`journey_templates` + `user_journeys` tables) - **NO EXECUTOR** ❌

When user creates a journey via wizard (e.g., Strategic Understanding → SWOT → Strategic Decisions), it stores in `journey_templates` and creates `user_journeys` entries. But there's no code to actually EXECUTE the frameworks.

The `ClassificationPage` routes to framework pages, but those pages expect data from `strategy_versions` or `journeySessions` - tables that never get populated because there's no executor.

---

## The Fix

**Wire wizard-created journeys to use the existing `JourneyOrchestrator`.**

### Step 1: Update `startCustomJourneyExecution` in `journey-builder-service.ts`

**File:** `server/services/journey-builder-service.ts`

**Current code (around line 360):**
```typescript
async startCustomJourneyExecution(params: {
  userId: string;
  templateId: string;
  understandingId: string;
}): Promise<{ journeySessionId: string; firstFramework: string }> {
  // ... creates user_journeys entry
  // ... returns firstFramework from template.steps[0]
}
```

**Replace with:**
```typescript
async startCustomJourneyExecution(params: {
  userId: string;
  templateId: string;
  understandingId: string;
}): Promise<{ journeySessionId: string; firstFramework: string }> {
  const { userId, templateId, understandingId } = params;

  // Load template
  const template = await this.getTemplateById(templateId, userId);
  if (!template) throw new Error('Template not found');

  // Convert template steps to framework names (skip strategic_understanding - already done)
  const frameworks = template.steps
    .filter(step => step.frameworkKey !== 'strategic_understanding')
    .map(step => step.frameworkKey);

  if (frameworks.length === 0) {
    throw new Error('Template has no executable frameworks');
  }

  // Use JourneyOrchestrator to create a proper journey session
  const journeyOrchestrator = container.resolve<JourneyOrchestrator>('JourneyOrchestrator');

  // Create journey session with custom framework sequence
  const { journeySessionId, versionNumber } = await journeyOrchestrator.startCustomJourney({
    understandingId,
    userId,
    frameworks,  // Pass the framework sequence from template
    templateId,
  });

  return {
    journeySessionId,
    firstFramework: frameworks[0],
  };
}
```

### Step 2: Add `startCustomJourney` method to `JourneyOrchestrator`

**File:** `server/journey/journey-orchestrator.ts`

Add this new method:
```typescript
async startCustomJourney(params: {
  understandingId: string;
  userId: string;
  frameworks: string[];  // Custom framework sequence
  templateId?: string;
}): Promise<{ journeySessionId: string; versionNumber: number }> {
  const { understandingId, userId, frameworks, templateId } = params;

  // Load strategic understanding
  const understanding = await this.secureUnderstandingService.getById(understandingId, userId, true);
  if (!understanding) {
    throw new Error('Strategic understanding not found');
  }

  // Initialize context
  const context = initializeContext(understanding, 'custom' as JourneyType);

  // Create journey session with custom frameworks
  const sessionId = `journey_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Use advisory lock for version atomicity (same as existing startJourney)
  const lockId = this.hashToInt32(understandingId);

  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`);

    const maxVersionResult = await tx
      .select({ maxVersion: sql<number>`COALESCE(MAX(${journeySessions.versionNumber}), 0)` })
      .from(journeySessions)
      .where(eq(journeySessions.understandingId, understandingId));

    const newVersionNumber = (maxVersionResult[0]?.maxVersion ?? 0) + 1;

    const [session] = await tx.insert(journeySessions).values({
      id: sessionId,
      understandingId,
      userId,
      journeyType: 'custom',  // Mark as custom
      status: 'initializing',
      currentFrameworkIndex: 0,
      completedFrameworks: [],
      accumulatedContext: await this.encryptContext(context),
      versionNumber: newVersionNumber,
      startedAt: new Date(),
      // Store custom framework sequence in metadata
      metadata: JSON.stringify({ frameworks, templateId }),
    }).returning();

    return {
      journeySessionId: session.id,
      versionNumber: newVersionNumber,
    };
  });
}
```

### Step 3: Update `executeJourney` to handle custom framework sequences

**File:** `server/journey/journey-orchestrator.ts`

In the `executeJourney` method, update how frameworks are determined:

```typescript
async executeJourney(
  journeySessionId: string,
  progressCallback?: (progress: JourneyProgress) => void
): Promise<StrategicContext> {
  const session = await this.loadSession(journeySessionId);
  let context = await this.decryptContext(session.accumulatedContext);

  // Get framework sequence - either from journey definition OR from custom metadata
  let frameworks: string[];

  if (session.journeyType === 'custom' && session.metadata) {
    const metadata = JSON.parse(session.metadata);
    frameworks = metadata.frameworks;
  } else {
    const journey = getJourneyDefinition(session.journeyType);
    frameworks = journey.frameworks;
  }

  // Rest of execution loop remains the same...
  for (let i = context.currentFrameworkIndex; i < frameworks.length; i++) {
    const frameworkName = frameworks[i];
    // ... execute framework
    // ... accumulate results
    // ... save progress
  }
}
```

### Step 4: Update ClassificationPage routing

**File:** `client/src/pages/strategic-consultant/ClassificationPage.tsx`

After calling `start-custom-journey`, immediately trigger journey execution:

```typescript
const handleConfirm = async () => {
  // ... existing code to start custom journey ...

  const { journeySessionId, firstFramework } = await response.json();

  // Trigger journey execution in background
  fetch(`/api/strategic-consultant/journeys/${journeySessionId}/execute`, {
    method: 'POST',
  });

  // Navigate to first framework page
  const route = getFrameworkRoute(firstFramework, understandingId, journeySessionId);
  navigate(route);
};
```

### Step 5: Update framework pages to work with journeySessions

The framework pages (SWOT, Porter's, etc.) need to read from `journeySessions.accumulatedContext` and `framework_insights` instead of `strategy_versions`.

**File:** `client/src/pages/strategic-consultant/AnalysisPage.tsx`

Update the data fetching:
```typescript
// Instead of fetching from strategy_versions:
const { data } = useQuery({
  queryKey: ['/api/strategic-consultant/journey-session', sessionId],
});

// Backend endpoint returns:
// - accumulatedContext.insights (previous framework outputs)
// - framework_insights for this session
```

### Step 6: Add journey session API endpoint

**File:** `server/routes/strategic-consultant.ts`

```typescript
// GET /api/strategic-consultant/journey-session/:sessionId
router.get('/journey-session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  const session = await db.query.journeySessions.findFirst({
    where: eq(journeySessions.id, sessionId),
  });

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Decrypt context
  const context = await decryptContext(session.accumulatedContext);

  // Get framework insights for this session
  const insights = await db.query.frameworkInsights.findMany({
    where: eq(frameworkInsights.sessionId, sessionId),
    orderBy: [asc(frameworkInsights.createdAt)],
  });

  res.json({
    session: {
      id: session.id,
      journeyType: session.journeyType,
      status: session.status,
      currentFrameworkIndex: session.currentFrameworkIndex,
      completedFrameworks: session.completedFrameworks,
      versionNumber: session.versionNumber,
    },
    context: {
      userInput: context.userInput,
      insights: context.insights,
    },
    frameworkInsights: insights,
  });
});
```

---

## Data Flow After Fix

```
User clicks "Start Journey" on wizard template
  ↓
ClassificationPage calls POST /api/journey-builder/start-custom-journey
  ↓
startCustomJourneyExecution():
  - Loads template steps
  - Filters out strategic_understanding (already done)
  - Calls journeyOrchestrator.startCustomJourney()
  - Creates journeySessions entry with custom framework sequence
  ↓
Returns { journeySessionId, firstFramework }
  ↓
ClassificationPage:
  - Triggers POST /journeys/{id}/execute (background)
  - Navigates to first framework page
  ↓
JourneyOrchestrator.executeJourney():
  - Reads custom frameworks from session.metadata
  - Executes each framework sequentially
  - Accumulates context via addFrameworkResult()
  - Saves to framework_insights table
  - Updates journeySessions.accumulatedContext
  ↓
Framework pages read from journeySessions + framework_insights
  ↓
User sees results ✓
```

---

## Why This Approach

1. **Reuses existing infrastructure** - JourneyOrchestrator already handles framework execution, context accumulation, and insight storage
2. **Single source of truth** - All journeys use `journeySessions` table
3. **Phase 9 architecture is used** - Strategic Accumulator, framework executors, insight extraction
4. **Minimal new code** - Just wiring, not rebuilding

---

## Files to Modify

1. `server/services/journey-builder-service.ts` - Update startCustomJourneyExecution
2. `server/journey/journey-orchestrator.ts` - Add startCustomJourney, update executeJourney
3. `client/src/pages/strategic-consultant/ClassificationPage.tsx` - Trigger execution
4. `server/routes/strategic-consultant.ts` - Add journey-session endpoint
5. `client/src/pages/strategic-consultant/AnalysisPage.tsx` - Read from journey session

---

## Test Case

1. Create wizard journey: Strategic Understanding → SWOT → Strategic Decisions
2. Start journey, enter business idea
3. Complete clarifications
4. Should see SWOT analysis page with accumulated context
5. Complete SWOT, should see Strategic Decisions with SWOT output as input
