/**
 * @module planning/api/endpoints
 * Express API endpoints for planning system
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createPlanningSystem } from '../index';
import { replaceTimelineGeneration } from '../integration/epm-integration';
import { createRepository } from '../database/repository';
import { PlanningErrorHandler } from '../utils/retry-handler';

const router = Router();
const repository = createRepository();

// ============================================
// MAIN PLANNING ENDPOINT
// ============================================

router.post('/planning/generate', async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = await repository.createSession(
    req.body.epmProgramId,
    req.body.businessContext
  );
  
  try {
    console.log(`Starting planning session ${sessionId}`);
    
    // Track progress through SSE or WebSocket
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    // Create planning system
    const planner = createPlanningSystem({
      openaiApiKey: process.env.OPENAI_API_KEY!,
      maxIterations: parseInt(process.env.MAX_PLANNING_ITERATIONS || '10'),
      targetScore: parseInt(process.env.TARGET_PLANNING_SCORE || '85')
    });
    
    // Subscribe to progress events
    planner.on('step-start', async (step) => {
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        step: step.name,
        status: 'running'
      })}\n\n`);
      
      await repository.savePlanningStep(sessionId, {
        name: step.name,
        status: 'running',
        startedAt: new Date()
      });
    });
    
    planner.on('step-complete', async (step) => {
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        step: step.name,
        status: 'complete'
      })}\n\n`);
      
      await repository.savePlanningStep(sessionId, {
        name: step.name,
        status: 'complete',
        startedAt: step.startTime!,
        completedAt: new Date(),
        durationMs: Date.now() - step.startTime!.getTime()
      });
    });
    
    // Execute planning
    const result = await planner.plan(req.body);
    
    // Save results to database
    if (result.schedule) {
      const scheduleId = await repository.saveSchedule(
        sessionId,
        result.schedule,
        1,
        result.success
      );
      
      if (result.validation) {
        await repository.saveValidationResult(scheduleId, result.validation);
      }
    }
    
    if (result.strategyAdjustments) {
      await repository.saveStrategyAdjustments(
        sessionId,
        result.strategyAdjustments
      );
    }
    
    // Update session
    await repository.updateSession(sessionId, {
      status: result.success ? 'completed' : 'needs_adjustment',
      iterations: result.metadata.iterations,
      finalScore: result.metadata.score,
      success: result.success,
      completedAt: new Date()
    });
    
    // Send final result
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      result
    })}\n\n`);
    
    res.end();
    
  } catch (error) {
    await PlanningErrorHandler.handleError(
      error as Error,
      'planning_generation',
    );
    
    await repository.updateSession(sessionId, {
      status: 'failed',
      completedAt: new Date()
    });
    
    await repository.logError(
      error as Error,
      { sessionId, request: req.body },
      sessionId
    );
    
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: (error as Error).message
    })}\n\n`);
    
    res.end();
  }
});

// ============================================
// INTEGRATION ENDPOINT FOR EPM
// ============================================

router.post('/planning/epm-integration', async (req: Request, res: Response) => {
  try {
    const { epmProgram, businessContext, config } = req.body;
    
    const result = await replaceTimelineGeneration(
      epmProgram,
      businessContext,
      config
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('EPM integration failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// ============================================
// RATIONALIZATION ENDPOINT
// ============================================

router.post('/planning/rationalize', async (req: Request, res: Response) => {
  try {
    const { schedule } = req.body;
    
    const planner = createPlanningSystem({
      openaiApiKey: process.env.OPENAI_API_KEY!
    });
    
    const validator = planner.modules.validator;
    const report = await validator.rationalize(schedule);
    
    res.json(report);
    
  } catch (error) {
    console.error('Rationalization failed:', error);
    res.status(500).json({
      error: (error as Error).message
    });
  }
});

// ============================================
// HISTORY ENDPOINT
// ============================================

router.get('/planning/history/:epmProgramId', async (req: Request, res: Response) => {
  try {
    const history = await repository.getPlanningHistory(
      req.params.epmProgramId
    );
    
    res.json(history);
    
  } catch (error) {
    console.error('Failed to fetch history:', error);
    res.status(500).json({
      error: (error as Error).message
    });
  }
});

// ============================================
// SESSION ENDPOINT
// ============================================

router.get('/planning/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const session = await repository.getSession(req.params.sessionId);
    const schedule = await repository.getLatestSchedule(req.params.sessionId);
    
    res.json({
      session,
      schedule
    });
    
  } catch (error) {
    console.error('Failed to fetch session:', error);
    res.status(500).json({
      error: (error as Error).message
    });
  }
});

// ============================================
// CONFLICT RESOLUTION ENDPOINT
// ============================================

router.post('/planning/resolve-conflict', async (req: Request, res: Response) => {
  try {
    const { conflictId, resolution } = req.body;
    
    // Implementation would resolve the conflict
    // This is a placeholder
    
    res.json({
      success: true,
      conflictId,
      resolution
    });
    
  } catch (error) {
    console.error('Conflict resolution failed:', error);
    res.status(500).json({
      error: (error as Error).message
    });
  }
});

// ============================================
// METRICS ENDPOINT
// ============================================

router.get('/planning/metrics', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();
    
    const metrics = await repository.getMetrics(startDate, endDate);
    
    res.json(metrics);
    
  } catch (error) {
    console.error('Failed to fetch metrics:', error);
    res.status(500).json({
      error: (error as Error).message
    });
  }
});

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================

router.get('/planning/health', async (req: Request, res: Response) => {
  try {
    // Check database connection
    const dbHealth = await repository.getSession('test').then(
      () => true
    ).catch(() => false);
    
    // Check LLM availability
    const llmHealth = process.env.OPENAI_API_KEY ? true : false;
    
    res.json({
      status: dbHealth && llmHealth ? 'healthy' : 'degraded',
      database: dbHealth ? 'connected' : 'disconnected',
      llm: llmHealth ? 'configured' : 'missing_api_key',
      timestamp: new Date()
    });
    
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: (error as Error).message
    });
  }
});

// ============================================
// CACHE MANAGEMENT ENDPOINTS
// ============================================

router.post('/planning/cache/clear', async (req: Request, res: Response) => {
  try {
    const cleared = await repository.cleanupCache();
    
    res.json({
      success: true,
      entriesCleared: cleared
    });
    
  } catch (error) {
    console.error('Cache clear failed:', error);
    res.status(500).json({
      error: (error as Error).message
    });
  }
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

router.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Planning API error:', error);
  
  // Log to database
  repository.logError(error, {
    path: req.path,
    method: req.method,
    body: req.body
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

export default router;
