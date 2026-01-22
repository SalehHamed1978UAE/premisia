# EXACT Instructions for Replit: Fix SSE Progress Tracking

**Priority:** CRITICAL
**Problem:** Progress UI stuck at 15%, SSE events not reaching frontend
**Goal:** Real-time progress updates that reflect actual generation state

---

## STEP 1: Understand the SSE Flow

```
[EPM Generator] → emits progress → [SSE Endpoint] → sends event → [Frontend]
```

The problem: Events are emitted but not reaching frontend. We need to trace and fix each link.

---

## STEP 2: Create a Single SSE Manager (One Source of Truth)

Create this file EXACTLY as written:

**File: `server/services/sse-progress-manager.ts`**

```typescript
/**
 * SSE Progress Manager - Single source of truth for all progress events
 *
 * This manager holds active SSE connections and broadcasts progress to them.
 * All generators (multi-agent, legacy, etc.) use this to send progress.
 */

import { Response } from 'express';

interface ProgressEvent {
  type: 'progress' | 'step_start' | 'step_complete' | 'error' | 'complete';
  percent: number;
  step: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

interface SSEConnection {
  res: Response;
  sessionId: string;
  connectedAt: Date;
}

class SSEProgressManager {
  private connections: Map<string, SSEConnection> = new Map();

  /**
   * Register a new SSE connection for a session
   */
  registerConnection(sessionId: string, res: Response): void {
    // Close existing connection for this session if any
    const existing = this.connections.get(sessionId);
    if (existing) {
      try {
        existing.res.end();
      } catch (e) {
        // Ignore - connection may already be closed
      }
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',  // Disable nginx buffering
    });

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ sessionId, timestamp: new Date().toISOString() })}\n\n`);

    // Store connection
    this.connections.set(sessionId, {
      res,
      sessionId,
      connectedAt: new Date(),
    });

    console.log(`[SSE] Connection registered for session ${sessionId}`);

    // Handle client disconnect
    res.on('close', () => {
      this.connections.delete(sessionId);
      console.log(`[SSE] Connection closed for session ${sessionId}`);
    });

    // Keep-alive ping every 15 seconds
    const keepAlive = setInterval(() => {
      if (this.connections.has(sessionId)) {
        try {
          res.write(`: keepalive\n\n`);
        } catch (e) {
          clearInterval(keepAlive);
          this.connections.delete(sessionId);
        }
      } else {
        clearInterval(keepAlive);
      }
    }, 15000);
  }

  /**
   * Send progress event to a specific session
   */
  sendProgress(sessionId: string, event: Omit<ProgressEvent, 'timestamp'>): void {
    const connection = this.connections.get(sessionId);

    const fullEvent: ProgressEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // Always log for debugging
    console.log(`[SSE] Progress for ${sessionId}: ${event.percent}% - ${event.step} - ${event.message}`);

    if (!connection) {
      console.warn(`[SSE] No connection found for session ${sessionId} - event dropped`);
      return;
    }

    try {
      const data = JSON.stringify(fullEvent);
      connection.res.write(`event: progress\ndata: ${data}\n\n`);
    } catch (error) {
      console.error(`[SSE] Failed to send event to ${sessionId}:`, error);
      this.connections.delete(sessionId);
    }
  }

  /**
   * Send completion event and close connection
   */
  sendComplete(sessionId: string, result: any): void {
    const connection = this.connections.get(sessionId);

    console.log(`[SSE] Sending completion for ${sessionId}`);

    if (connection) {
      try {
        const data = JSON.stringify({
          type: 'complete',
          percent: 100,
          step: 'Complete',
          message: 'EPM generation complete',
          result,
          timestamp: new Date().toISOString(),
        });
        connection.res.write(`event: complete\ndata: ${data}\n\n`);
        connection.res.end();
      } catch (error) {
        console.error(`[SSE] Failed to send completion to ${sessionId}:`, error);
      }
      this.connections.delete(sessionId);
    }
  }

  /**
   * Send error event and close connection
   */
  sendError(sessionId: string, error: string): void {
    const connection = this.connections.get(sessionId);

    console.log(`[SSE] Sending error for ${sessionId}: ${error}`);

    if (connection) {
      try {
        const data = JSON.stringify({
          type: 'error',
          percent: -1,
          step: 'Error',
          message: error,
          timestamp: new Date().toISOString(),
        });
        connection.res.write(`event: error\ndata: ${data}\n\n`);
        connection.res.end();
      } catch (e) {
        console.error(`[SSE] Failed to send error to ${sessionId}:`, e);
      }
      this.connections.delete(sessionId);
    }
  }

  /**
   * Check if a session has an active connection
   */
  hasConnection(sessionId: string): boolean {
    return this.connections.has(sessionId);
  }

  /**
   * Get count of active connections (for debugging)
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
}

// Singleton instance
export const sseProgressManager = new SSEProgressManager();
```

---

## STEP 3: Create the SSE Endpoint

Add this route. If a similar route exists, REPLACE it with this exact code.

**File: `server/routes/sse-progress.ts`**

```typescript
/**
 * SSE Progress Endpoint
 *
 * Client connects here to receive real-time progress updates
 */

import { Router } from 'express';
import { sseProgressManager } from '../services/sse-progress-manager';

const router = Router();

/**
 * GET /api/epm/progress/:sessionId
 *
 * SSE endpoint for progress updates
 */
router.get('/progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  console.log(`[SSE Route] Client connecting for session ${sessionId}`);

  // Register this connection with the SSE manager
  sseProgressManager.registerConnection(sessionId, res);

  // Don't call res.end() - SSE keeps connection open
});

export default router;
```

**Register the route in your main routes file (e.g., `server/routes/index.ts` or `server/index.ts`):**

```typescript
import sseProgressRoutes from './routes/sse-progress';

// Add this line where other routes are registered
app.use('/api/epm', sseProgressRoutes);
```

---

## STEP 4: Update EPM Generator to Emit Progress Events

Find the file that handles EPM generation (likely `server/services/epm-generator/legacy-generator.ts` or similar).

**Add this import at the top:**

```typescript
import { sseProgressManager } from '../sse-progress-manager';
```

**Add this helper function:**

```typescript
function emitProgress(sessionId: string, percent: number, step: string, message: string) {
  sseProgressManager.sendProgress(sessionId, {
    type: 'progress',
    percent,
    step,
    message,
  });
}
```

**Then add progress calls throughout the generation process. Here are the EXACT places to add them:**

```typescript
async generate(input: EPMGeneratorInput): Promise<EPMGeneratorOutput> {
  const sessionId = input.sessionId;

  try {
    // === PROGRESS: Starting ===
    emitProgress(sessionId, 5, 'Initializing', 'Starting EPM generation...');

    // === PROGRESS: Analyzing Strategy ===
    emitProgress(sessionId, 10, 'Analyzing Strategy', 'Processing strategic insights...');

    // ... your strategy analysis code ...

    // === PROGRESS: Generating Workstreams ===
    emitProgress(sessionId, 20, 'Generating Workstreams', 'Creating strategic workstreams from analysis...');

    // ... your workstream generation code ...
    // If you loop through workstreams, emit progress for each:
    for (let i = 0; i < workstreams.length; i++) {
      const percent = 20 + Math.round((i / workstreams.length) * 20);  // 20-40%
      emitProgress(sessionId, percent, 'Generating Workstreams', `Processing workstream ${i + 1} of ${workstreams.length}: ${workstreams[i].name}`);

      // ... generate this workstream ...
    }

    // === PROGRESS: Extracting Tasks ===
    emitProgress(sessionId, 45, 'Extracting Tasks', 'Breaking down workstreams into detailed tasks...');

    // ... your task extraction code ...

    // === PROGRESS: Building Schedule ===
    emitProgress(sessionId, 55, 'Building Schedule', 'Creating timeline with Critical Path Method...');

    // ... your scheduling code ...

    // === PROGRESS: Allocating Resources ===
    emitProgress(sessionId, 70, 'Allocating Resources', 'Matching skills to tasks...');

    // ... your resource allocation code ...

    // === PROGRESS: Risk Assessment ===
    emitProgress(sessionId, 80, 'Assessing Risks', 'Identifying and analyzing risks...');

    // ... your risk assessment code ...

    // === PROGRESS: Finalizing ===
    emitProgress(sessionId, 90, 'Finalizing', 'Assembling final EPM program...');

    // ... your final assembly code ...

    // === PROGRESS: Complete ===
    const result = { program, metadata };
    sseProgressManager.sendComplete(sessionId, { success: true });

    return result;

  } catch (error) {
    // === PROGRESS: Error ===
    sseProgressManager.sendError(sessionId, error.message || 'Generation failed');
    throw error;
  }
}
```

---

## STEP 5: Update Frontend to Listen to SSE

Find your frontend progress component (likely in `client/src/components/` or similar).

**Replace the progress listening code with this:**

```typescript
// In your React component or hook

useEffect(() => {
  if (!sessionId) return;

  console.log(`[Progress] Connecting to SSE for session ${sessionId}`);

  const eventSource = new EventSource(`/api/epm/progress/${sessionId}`);

  eventSource.addEventListener('connected', (event) => {
    console.log('[Progress] SSE connected:', event.data);
  });

  eventSource.addEventListener('progress', (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[Progress] Received:', data);

      setProgress(data.percent);
      setCurrentStep(data.step);
      setMessage(data.message);
    } catch (e) {
      console.error('[Progress] Failed to parse event:', e);
    }
  });

  eventSource.addEventListener('complete', (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[Progress] Complete:', data);

      setProgress(100);
      setCurrentStep('Complete');
      setMessage('EPM generation complete');
      setIsComplete(true);

      eventSource.close();
    } catch (e) {
      console.error('[Progress] Failed to parse complete event:', e);
    }
  });

  eventSource.addEventListener('error', (event) => {
    console.error('[Progress] SSE error:', event);
    // Don't immediately close - SSE will auto-reconnect
    // Only close on explicit error event from server
    if (event.data) {
      try {
        const data = JSON.parse(event.data);
        setError(data.message);
        eventSource.close();
      } catch (e) {
        // Connection error, not server error
      }
    }
  });

  eventSource.onerror = (error) => {
    console.error('[Progress] EventSource error:', error);
    // EventSource will auto-reconnect on connection errors
  };

  return () => {
    console.log('[Progress] Closing SSE connection');
    eventSource.close();
  };
}, [sessionId]);
```

---

## STEP 6: Test the SSE Connection

Add this test endpoint to verify SSE is working:

**File: `server/routes/sse-progress.ts`** (add to existing file)

```typescript
/**
 * GET /api/epm/progress-test/:sessionId
 *
 * Test endpoint that sends fake progress events every second
 */
router.get('/progress-test/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  console.log(`[SSE Test] Starting test for session ${sessionId}`);

  // Register connection
  sseProgressManager.registerConnection(sessionId, res);

  // Send test progress events
  const steps = [
    { percent: 10, step: 'Step 1', message: 'Test step 1...' },
    { percent: 25, step: 'Step 2', message: 'Test step 2...' },
    { percent: 50, step: 'Step 3', message: 'Test step 3...' },
    { percent: 75, step: 'Step 4', message: 'Test step 4...' },
    { percent: 90, step: 'Step 5', message: 'Test step 5...' },
  ];

  for (const step of steps) {
    await new Promise(resolve => setTimeout(resolve, 1000));  // Wait 1 second
    sseProgressManager.sendProgress(sessionId, {
      type: 'progress',
      ...step,
    });
  }

  await new Promise(resolve => setTimeout(resolve, 1000));
  sseProgressManager.sendComplete(sessionId, { test: true });
});
```

**To test:**
1. Open browser console
2. Run: `new EventSource('/api/epm/progress-test/test123').addEventListener('progress', e => console.log(JSON.parse(e.data)))`
3. You should see 5 progress events logged, then a complete event

---

## STEP 7: Debug Checklist

If progress still doesn't work, check these IN ORDER:

### 7.1 Check Server is Sending Events

Add this temporary log to `sseProgressManager.sendProgress`:

```typescript
sendProgress(sessionId: string, event: Omit<ProgressEvent, 'timestamp'>): void {
  console.log(`[SSE DEBUG] sendProgress called for ${sessionId}:`, event);
  // ... rest of function
}
```

If you don't see this log, the generator isn't calling `emitProgress`.

### 7.2 Check Connection Exists

Add this log:

```typescript
sendProgress(sessionId: string, event: Omit<ProgressEvent, 'timestamp'>): void {
  console.log(`[SSE DEBUG] Active connections: ${Array.from(this.connections.keys()).join(', ')}`);
  console.log(`[SSE DEBUG] Looking for: ${sessionId}`);
  // ... rest of function
}
```

If the sessionId doesn't match, there's a mismatch between frontend and backend session IDs.

### 7.3 Check Frontend is Listening

In browser console, check:

```javascript
// Should show your EventSource
console.log(window.eventSources);  // if you stored them

// Or check network tab for /api/epm/progress/xxx requests
// Should show "EventStream" type, not "XHR" or "fetch"
```

### 7.4 Check for Proxy/Buffering Issues

If using nginx or a reverse proxy, add these headers:

```nginx
location /api/epm/progress {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;
}
```

---

## STEP 8: Verify Session ID Consistency

The #1 cause of SSE not working is mismatched session IDs.

**Backend sessionId must EXACTLY match frontend sessionId.**

Add this log to the EPM generation endpoint:

```typescript
app.post('/api/epm/generate', async (req, res) => {
  const sessionId = req.body.sessionId;
  console.log(`[EPM Generate] Received sessionId: "${sessionId}"`);
  console.log(`[EPM Generate] Active SSE connections: ${sseProgressManager.getConnectionCount()}`);
  console.log(`[EPM Generate] Has connection for this session: ${sseProgressManager.hasConnection(sessionId)}`);
  // ... rest of handler
});
```

And in the frontend, log the sessionId being used for both:
- The SSE connection URL
- The generate request body

They MUST be identical strings.

---

## Summary of Files to Create/Modify

| File | Action |
|------|--------|
| `server/services/sse-progress-manager.ts` | CREATE (new file) |
| `server/routes/sse-progress.ts` | CREATE (new file) |
| `server/routes/index.ts` or `server/index.ts` | MODIFY (add route) |
| `server/services/epm-generator/*.ts` | MODIFY (add emitProgress calls) |
| Frontend progress component | MODIFY (add EventSource listener) |

---

## Expected Console Output When Working

**Server:**
```
[SSE] Connection registered for session abc123
[SSE] Progress for abc123: 5% - Initializing - Starting EPM generation...
[SSE] Progress for abc123: 10% - Analyzing Strategy - Processing strategic insights...
[SSE] Progress for abc123: 20% - Generating Workstreams - Creating strategic workstreams...
[SSE] Progress for abc123: 25% - Generating Workstreams - Processing workstream 1 of 4: Market Analysis
...
[SSE] Progress for abc123: 90% - Finalizing - Assembling final EPM program...
[SSE] Sending completion for abc123
[SSE] Connection closed for session abc123
```

**Browser Console:**
```
[Progress] Connecting to SSE for session abc123
[Progress] SSE connected: {"sessionId":"abc123","timestamp":"..."}
[Progress] Received: {percent: 5, step: "Initializing", message: "Starting EPM generation..."}
[Progress] Received: {percent: 10, step: "Analyzing Strategy", message: "Processing strategic insights..."}
...
[Progress] Complete: {percent: 100, step: "Complete", ...}
```

---

## DO NOT

1. ❌ Do NOT use `res.json()` for SSE - it closes the connection
2. ❌ Do NOT use `res.send()` for SSE - it closes the connection
3. ❌ Do NOT forget `\n\n` at the end of each SSE message
4. ❌ Do NOT use different sessionIds for SSE connection vs generation request
5. ❌ Do NOT buffer responses (disable nginx/proxy buffering)
6. ❌ Do NOT call `res.end()` until generation is complete
