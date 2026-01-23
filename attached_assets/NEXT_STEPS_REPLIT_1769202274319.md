# Next Steps: B2C Validation + SSE Stabilization

**Date:** January 24, 2026
**Priority:** HIGH

---

## Part 1: Quick B2C Generalization Test

The B2C segmentation fix is working for restaurants. Before moving on, confirm it works for other B2C business types.

### Test Scenario: Kids Educational Toys

Run a new segment discovery with this input:

```
Educational STEM toys for children ages 5-12, focusing on robotics and coding basics
```

**Classification:**
- Offering Type: Physical Product
- Stage: Idea Stage
- GTM Constraint: Small Team
- Sales Motion: Self Serve

**Expected Segments (CORRECT):**
- "Parents of elementary school kids, birthday gift shopping"
- "Grandparents buying holiday gifts for grandchildren"
- "Teachers/educators purchasing classroom supplies"
- "Tech-savvy parents wanting STEM education for kids"
- "Gift shoppers for nieces/nephews"

**NOT Expected (WRONG - would indicate B2B drift):**
- "School district procurement officers"
- "Educational toy distributors"
- "Retail store buyers"
- "Amazon marketplace sellers"

### Test Scenario 2 (Optional): Premium Skincare

```
Organic anti-aging skincare line using natural ingredients, targeting women 35-55
```

**Expected Segments:**
- "Health-conscious professional women, self-care routine"
- "Women approaching milestone birthdays, treating themselves"
- "Wellness enthusiasts preferring natural products"
- "Gift buyers for mothers/sisters"

**NOT Expected:**
- "Spa owners looking for product lines"
- "Beauty salon purchasing managers"
- "Dermatology clinic buyers"

### Verification Checklist

After running the tests, check:

- [ ] Segments are individual CONSUMERS (people who buy/use the product)
- [ ] NOT businesses or B2B buyers
- [ ] Validation plan focuses on consumer channels (social media, retail, online)
- [ ] NOT B2B channels (trade shows, distributor partnerships)

If both tests pass → B2C fix is confirmed working. Move to Part 2.

---

## Part 2: SSE Connection Stabilization

The Marketing Consultant discovery process takes 2-3 minutes. The SSE (Server-Sent Events) connection sometimes drops before completion, showing "Incomplete Analysis Data" even though the backend finishes successfully.

### Problem

1. Frontend opens SSE connection to `/api/marketing-consultant/discovery-stream/:id`
2. Discovery runs for 2-3 minutes
3. SSE connection drops (timeout, network hiccup, Replit proxy)
4. Frontend shows error, but backend actually completed
5. Results ARE in the database, but user sees failure

### Solution: Implement Resilient SSE with Fallback Polling

#### Step 1: Add Heartbeat to SSE Stream

**File:** `server/routes/marketing-consultant.ts` (or wherever SSE stream is implemented)

Add periodic heartbeat events to keep the connection alive:

```typescript
// In the SSE stream handler
const heartbeatInterval = setInterval(() => {
  if (!res.writableEnded) {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
  }
}, 15000); // Send heartbeat every 15 seconds

// Clean up on close
res.on('close', () => {
  clearInterval(heartbeatInterval);
});
```

#### Step 2: Add Status Polling Endpoint

Create an endpoint to check discovery status without SSE:

```typescript
// GET /api/marketing-consultant/discovery-status/:id
router.get('/discovery-status/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query.segmentDiscoveryResults.findFirst({
      where: eq(segmentDiscoveryResults.id, id),
      columns: {
        status: true,
        progressMessage: true,
        errorMessage: true,
        completedAt: true,
      }
    });

    if (!result) {
      return res.status(404).json({ error: 'Discovery not found' });
    }

    // Calculate progress percentage based on status
    let progress = 0;
    if (result.status === 'completed') progress = 100;
    else if (result.status === 'failed') progress = -1;
    else if (result.progressMessage) {
      // Parse progress from message if available
      const match = result.progressMessage.match(/(\d+)%/);
      if (match) progress = parseInt(match[1]);
    }

    res.json({
      status: result.status,
      progress,
      message: result.progressMessage,
      error: result.errorMessage,
      completedAt: result.completedAt,
    });
  } catch (error) {
    console.error('[Marketing Consultant] Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});
```

#### Step 3: Update Frontend with Fallback Polling

**File:** `client/src/pages/marketing-consultant/SegmentDiscoveryPage.tsx` (or similar)

Add reconnection logic and polling fallback:

```typescript
const [connectionAttempts, setConnectionAttempts] = useState(0);
const [usePolling, setUsePolling] = useState(false);
const MAX_RECONNECT_ATTEMPTS = 3;
const POLL_INTERVAL = 5000; // 5 seconds

// SSE connection with reconnection
useEffect(() => {
  if (!discoveryId || usePolling) return;

  let eventSource: EventSource | null = null;
  let reconnectTimeout: NodeJS.Timeout;

  const connect = () => {
    eventSource = new EventSource(`/api/marketing-consultant/discovery-stream/${discoveryId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress);
      setStatus(data.status);

      if (data.status === 'completed' || data.status === 'failed') {
        eventSource?.close();
        fetchResults();
      }
    };

    eventSource.addEventListener('heartbeat', () => {
      // Connection is alive, reset attempts
      setConnectionAttempts(0);
    });

    eventSource.onerror = () => {
      eventSource?.close();

      setConnectionAttempts(prev => {
        const newAttempts = prev + 1;

        if (newAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.log('Max reconnection attempts reached, switching to polling');
          setUsePolling(true);
          return newAttempts;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, newAttempts - 1) * 1000;
        console.log(`SSE disconnected, reconnecting in ${delay}ms (attempt ${newAttempts})`);

        reconnectTimeout = setTimeout(connect, delay);
        return newAttempts;
      });
    };
  };

  connect();

  return () => {
    eventSource?.close();
    clearTimeout(reconnectTimeout);
  };
}, [discoveryId, usePolling]);

// Polling fallback
useEffect(() => {
  if (!discoveryId || !usePolling) return;

  const pollStatus = async () => {
    try {
      const response = await fetch(`/api/marketing-consultant/discovery-status/${discoveryId}`);
      const data = await response.json();

      setProgress(data.progress);
      setStatus(data.status);

      if (data.status === 'completed') {
        fetchResults();
        return true; // Stop polling
      }
      if (data.status === 'failed') {
        setError(data.error || 'Discovery failed');
        return true; // Stop polling
      }
      return false; // Continue polling
    } catch (error) {
      console.error('Polling error:', error);
      return false;
    }
  };

  const interval = setInterval(async () => {
    const shouldStop = await pollStatus();
    if (shouldStop) {
      clearInterval(interval);
    }
  }, POLL_INTERVAL);

  // Initial poll
  pollStatus();

  return () => clearInterval(interval);
}, [discoveryId, usePolling]);
```

#### Step 4: Add "Check Results" Button for Recovery

If the user sees an error but results might exist, add a recovery option:

```typescript
// In the error state UI
{status === 'error' && (
  <div className="error-recovery">
    <p>Connection was lost during analysis.</p>
    <button onClick={async () => {
      // Check if results exist
      const response = await fetch(`/api/marketing-consultant/discovery-status/${discoveryId}`);
      const data = await response.json();

      if (data.status === 'completed') {
        fetchResults(); // Load the completed results
      } else if (data.status === 'running') {
        setUsePolling(true); // Resume with polling
        setError(null);
      } else {
        // Actually failed, show option to retry
        setShowRetryOption(true);
      }
    }}>
      Check for Results
    </button>
  </div>
)}
```

### Step 5: Increase Server Timeouts

**File:** `server/index.ts` or Express configuration

```typescript
// Increase timeout for long-running SSE connections
app.use('/api/marketing-consultant/discovery-stream', (req, res, next) => {
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000);
  next();
});
```

### Step 6: Add Connection Status Indicator

Show the user when connection is being maintained:

```typescript
// In the discovery progress UI
<div className="connection-status">
  {usePolling ? (
    <span className="polling-indicator">📡 Checking status...</span>
  ) : (
    <span className="live-indicator">🟢 Live connection</span>
  )}
  {connectionAttempts > 0 && !usePolling && (
    <span className="reconnecting">Reconnecting ({connectionAttempts}/{MAX_RECONNECT_ATTEMPTS})...</span>
  )}
</div>
```

---

## Summary

### Part 1: B2C Validation (Do First)
1. Run "Educational STEM toys" discovery
2. Verify segments are consumers (parents, grandparents, teachers buying for personal use)
3. NOT B2B (distributors, school procurement)
4. If passes, B2C fix is confirmed ✅

### Part 2: SSE Stabilization (Do After)
1. Add heartbeat to SSE stream (keeps connection alive)
2. Add status polling endpoint (fallback)
3. Update frontend with auto-reconnect + polling fallback
4. Add "Check Results" recovery button
5. Increase server timeouts
6. Add connection status indicator

### Expected Outcome

After these changes:
- B2C segmentation works for any consumer business ✓
- SSE connections stay alive with heartbeat ✓
- If SSE drops, automatically reconnects (up to 3 times) ✓
- If reconnection fails, falls back to polling ✓
- User can manually check for results if needed ✓
- No more "Incomplete Analysis Data" when backend actually succeeded ✓

---

## Quick Test After SSE Fix

1. Start a new segment discovery
2. Wait for it to complete (~2-3 minutes)
3. Should see smooth progress updates
4. If connection drops, should see "Reconnecting..." then resume
5. Results should always be accessible if backend completed
