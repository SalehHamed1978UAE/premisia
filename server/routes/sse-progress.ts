/**
 * SSE Progress Endpoint
 *
 * Client connects here to receive real-time progress updates for EPM generation
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

/**
 * GET /api/epm/progress-test/:sessionId
 *
 * Test endpoint that sends fake progress events every second
 * Useful for testing SSE connectivity
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
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (!sseProgressManager.hasConnection(sessionId)) {
      console.log(`[SSE Test] Client disconnected, stopping test`);
      return;
    }
    sseProgressManager.sendProgress(sessionId, {
      type: 'progress',
      ...step,
    });
  }

  await new Promise(resolve => setTimeout(resolve, 1000));
  sseProgressManager.sendComplete(sessionId, { success: true, test: true });
});

export default router;
