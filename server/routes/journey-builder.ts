import { Router } from 'express';
import { journeyBuilderService } from '../services/journey-builder-service';
import { journeyValidatorService } from '../services/journey-validator-service';
import { journeyRecommendationService } from '../services/journey-recommendation-service';
import type { JourneyStep } from '@shared/journey-types';

const router = Router();

/**
 * Journey Builder API Routes
 * 
 * Endpoints:
 * - GET    /templates           - List all journey templates (system + custom)
 * - GET    /frameworks          - List all available frameworks
 * - POST   /start               - Start a new journey instance
 * - GET    /:sessionId          - Get journey by session ID
 * - POST   /:sessionId/complete-step - Complete a journey step
 * - POST   /validate            - Validate a journey for EPM readiness
 * - POST   /analyze             - Analyze a custom journey
 * - POST   /suggest             - Get AI framework suggestions
 */

// =============================================================================
// GET /api/journeys/templates
// List all available journey templates
// =============================================================================
router.get('/templates', async (req, res) => {
  try {
    const templates = await journeyBuilderService.getTemplates();
    
    res.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('[Journey Builder API] Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journey templates',
    });
  }
});

// =============================================================================
// GET /api/journeys/my-templates
// List custom journey templates created by the current user
// =============================================================================
router.get('/my-templates', async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const templates = await journeyBuilderService.getUserTemplates(userId);
    
    res.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('[Journey Builder API] Error fetching user templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user templates',
    });
  }
});

// =============================================================================
// GET /api/journeys/frameworks
// List all available frameworks (user-selectable)
// =============================================================================
router.get('/frameworks', async (req, res) => {
  try {
    const frameworks = await journeyBuilderService.getFrameworks();
    
    res.json({
      success: true,
      frameworks,
      count: frameworks.length,
    });
  } catch (error) {
    console.error('[Journey Builder API] Error fetching frameworks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch frameworks',
    });
  }
});

// =============================================================================
// POST /api/journeys/start
// Start a new journey instance
// 
// Body:
//   - templateId?: string (for pre-defined journeys)
//   - customSteps?: JourneyStep[] (for custom journeys)
//   - name?: string
// =============================================================================
router.post('/start', async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { templateId, customSteps, name } = req.body;

    const result = await journeyBuilderService.startJourney({
      userId,
      templateId,
      customSteps,
      name,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Journey Builder API] Error starting journey:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start journey',
    });
  }
});

// =============================================================================
// GET /api/journeys/:sessionId
// Get journey by session ID
// =============================================================================
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const journey = await journeyBuilderService.getJourney(sessionId);

    if (!journey) {
      return res.status(404).json({
        success: false,
        error: 'Journey not found',
      });
    }

    res.json({
      success: true,
      journey,
    });
  } catch (error) {
    console.error('[Journey Builder API] Error fetching journey:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journey',
    });
  }
});

// =============================================================================
// POST /api/journeys/:sessionId/complete-step
// Complete a journey step
// 
// Body:
//   - stepId: string
//   - result: any
//   - contextUpdates?: Record<string, any>
// =============================================================================
router.post('/:sessionId/complete-step', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { stepId, result, contextUpdates } = req.body;

    if (!stepId) {
      return res.status(400).json({
        success: false,
        error: 'stepId is required',
      });
    }

    const completion = await journeyBuilderService.completeStep({
      sessionId,
      stepId,
      result,
      contextUpdates,
    });

    res.json({
      success: true,
      ...completion,
    });
  } catch (error) {
    console.error('[Journey Builder API] Error completing step:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete step',
    });
  }
});

// =============================================================================
// POST /api/journeys/validate
// Validate if journey collects enough information for EPM generation
// 
// Body:
//   - selectedFrameworks: string[] (framework keys)
//   - userGoal?: string
// =============================================================================
router.post('/validate', async (req, res) => {
  try {
    const { selectedFrameworks, userGoal } = req.body;

    if (!selectedFrameworks || !Array.isArray(selectedFrameworks)) {
      return res.status(400).json({
        success: false,
        error: 'selectedFrameworks array is required',
      });
    }

    const validation = await journeyValidatorService.validateJourney({
      selectedFrameworks,
      userGoal,
    });

    res.json({
      success: true,
      validation,
    });
  } catch (error) {
    console.error('[Journey Builder API] Error validating journey:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate journey',
    });
  }
});

// =============================================================================
// POST /api/journeys/analyze
// Analyze a custom journey and get recommendations
// 
// Body:
//   - steps: Array<{ frameworkKey: string; name: string }>
//   - userGoal?: string
// =============================================================================
router.post('/analyze', async (req, res) => {
  try {
    const { steps, userGoal } = req.body;

    if (!steps || !Array.isArray(steps)) {
      return res.status(400).json({
        success: false,
        error: 'steps array is required',
      });
    }

    const analysis = await journeyRecommendationService.analyzeJourney({
      steps,
      userGoal,
    });

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('[Journey Builder API] Error analyzing journey:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze journey',
    });
  }
});

// =============================================================================
// POST /api/journey-builder/journeys
// Create a custom journey template
// 
// Body:
//   - name: string
//   - description?: string
//   - steps: JourneyStep[]
//   - tags?: string[]
// =============================================================================
router.post('/journeys', async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { name, description, steps, tags } = req.body;

    if (!name || !steps || !Array.isArray(steps)) {
      return res.status(400).json({
        success: false,
        error: 'name and steps are required',
      });
    }

    const template = await journeyBuilderService.createTemplate({
      name,
      description,
      steps,
      tags: tags || ['custom'],
      createdBy: userId,
    });

    res.json({
      success: true,
      journey: template,
    });
  } catch (error) {
    console.error('[Journey Builder API] Error creating custom journey:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create custom journey',
    });
  }
});

// =============================================================================
// POST /api/journeys/suggest
// Get AI framework suggestions based on user goal
// 
// Body:
//   - userGoal: string
// =============================================================================
router.post('/suggest', async (req, res) => {
  try {
    const { userGoal } = req.body;

    if (!userGoal) {
      return res.status(400).json({
        success: false,
        error: 'userGoal is required',
      });
    }

    const suggestions = await journeyRecommendationService.suggestFrameworks(userGoal);

    res.json({
      success: true,
      ...suggestions,
    });
  } catch (error) {
    console.error('[Journey Builder API] Error suggesting frameworks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to suggest frameworks',
    });
  }
});

export default router;
