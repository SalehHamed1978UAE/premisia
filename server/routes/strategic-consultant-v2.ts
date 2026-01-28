/**
 * Strategic Consultant V2 Routes
 * 
 * API routes for the unified Strategic Consultant V2.
 * Uses Journey Builder as the EPM generation engine.
 */

import { Router, Request, Response } from 'express';
import { strategicConsultantV2 } from '../strategic-consultant-v2';
import { templateRegistry } from '../journey/templates';
import { randomUUID } from 'crypto';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Strategic Consultant V2 API is healthy',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

router.get('/templates', (req: Request, res: Response) => {
  try {
    const templates = templateRegistry.list();
    res.json({
      success: true,
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        analysisFrameworks: t.analysisFrameworks,
        moduleCount: t.epmModules.length,
        defaultTimeline: t.defaultTimeline,
        defaultBudget: t.defaultBudget,
      })),
    });
  } catch (error) {
    console.error('[SC-V2 Routes] Error listing templates:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/start', async (req: Request, res: Response) => {
  try {
    const { userInput, sessionId } = req.body;

    if (!userInput) {
      res.status(400).json({
        success: false,
        error: 'userInput is required',
      });
      return;
    }

    const actualSessionId = sessionId || randomUUID();
    
    console.log(`[SC-V2 Routes] Starting context gathering for session: ${actualSessionId}`);
    
    const context = await strategicConsultantV2.gatherContext(userInput, actualSessionId);

    res.json({
      success: true,
      sessionId: actualSessionId,
      context: {
        industry: context.industry,
        businessType: context.businessType,
        analysis: context.analysis,
      },
    });
  } catch (error) {
    console.error('[SC-V2 Routes] Error in /start:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { sessionId, templateId, context } = req.body;

    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: 'sessionId is required',
      });
      return;
    }

    console.log(`[SC-V2 Routes] Executing journey for session: ${sessionId}`);
    
    const result = await strategicConsultantV2.executeJourney(
      context || { sessionId, userInput: '' },
      templateId
    );

    res.json(result);
  } catch (error) {
    console.error('[SC-V2 Routes] Error in /execute:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/run', async (req: Request, res: Response) => {
  try {
    const { userInput, sessionId, templateId } = req.body;

    if (!userInput) {
      res.status(400).json({
        success: false,
        error: 'userInput is required',
      });
      return;
    }

    const actualSessionId = sessionId || randomUUID();
    
    console.log(`[SC-V2 Routes] Full flow for session: ${actualSessionId}`);
    console.log(`[SC-V2 Routes] Input: ${userInput.substring(0, 100)}...`);
    
    const result = await strategicConsultantV2.run(userInput, actualSessionId, templateId);

    res.json(result);
  } catch (error) {
    console.error('[SC-V2 Routes] Error in /run:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/template/:templateId', (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    
    if (!templateRegistry.has(templateId)) {
      res.status(404).json({
        success: false,
        error: `Template ${templateId} not found`,
      });
      return;
    }
    
    const template = templateRegistry.get(templateId);
    res.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('[SC-V2 Routes] Error getting template:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
