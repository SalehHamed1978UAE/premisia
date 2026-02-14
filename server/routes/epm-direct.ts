/**
 * EPM Direct Synthesis Endpoint
 *
 * Fast-path for testing EPM synthesis without running Five Whys + BMC.
 * Accepts pre-computed framework insights and jumps directly to EPM generation.
 *
 * Purpose: Rapid iteration on EPM synthesis layer (Sprint 6B testing)
 */

import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { strategyVersions, backgroundJobs } from '@shared/schema';
import { EPMSynthesizer } from '../intelligence/epm-synthesizer';
import { BackgroundJobService } from '../services/background-job-service';
import type { StrategyInsights } from '../intelligence/types';
import { nanoid } from 'nanoid';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();
const epmSynthesizer = new EPMSynthesizer();
const backgroundJobService = new BackgroundJobService();

/**
 * POST /api/epm/synthesize-direct
 *
 * Direct EPM synthesis from framework insights (bypasses Five Whys + BMC)
 *
 * Request body:
 * {
 *   insights: StrategyInsights,           // Pre-computed framework insights
 *   userContext: {                        // Constraints and preferences
 *     budgetRange?: { min: number, max: number },
 *     timelineRange?: { min: number, max: number },
 *     sessionId?: string,
 *     initiativeType?: string
 *   },
 *   namingContext?: {                     // Optional naming hints
 *     journeyTitle?: string,
 *     bmcKeyInsights?: string[],
 *     framework?: string
 *   },
 *   saveToDatabase?: boolean              // If true, saves result to strategy_versions
 * }
 *
 * Response:
 * {
 *   success: true,
 *   epmProgram: EPMProgram,
 *   versionId?: string (if saveToDatabase=true)
 * }
 */
router.post('/synthesize-direct', async (req, res) => {
  try {
    const {
      insights,
      userContext = {},
      namingContext = {},
      saveToDatabase = false
    } = req.body;

    // Validate required fields
    if (!insights || !insights.insights || !Array.isArray(insights.insights)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid insights object'
      });
    }

    console.log('[EPM Direct] Starting direct synthesis...');
    console.log('[EPM Direct] Constraints:', {
      budget: userContext.budgetRange,
      timeline: userContext.timelineRange,
      initiativeType: userContext.initiativeType || insights.initiativeType
    });

    // Build decisionsWithPriority object (mimics strategy-workspace.ts line 716)
    const decisionsWithPriority = {
      prioritizedOrder: [],
      sessionId: userContext.sessionId || nanoid(),
      clarificationConflicts: [],
      budgetRange: userContext.budgetRange,
      timelineRange: userContext.timelineRange,
    };

    // Determine initiative type from insights or userContext
    const initiativeType = userContext.initiativeType || insights.initiativeType || 'general';

    // Run EPM synthesis (no progress events for direct mode)
    const epmProgram = await epmSynthesizer.synthesize(
      insights,
      decisionsWithPriority,
      namingContext,
      {
        onProgress: (event) => {
          console.log(`[EPM Direct] ${event.description || event.message}`);
        },
        initiativeType
      }
    );

    console.log('[EPM Direct] ✓ Synthesis complete');
    console.log('[EPM Direct] Resource plan: FTEs =', epmProgram.resourcePlan.totalFTEs);
    console.log('[EPM Direct] Financial plan: Budget =', `$${(epmProgram.financialPlan.totalBudget / 1e6).toFixed(2)}M`);
    console.log('[EPM Direct] Timeline: Months =', epmProgram.timeline.totalMonths);

    // Optionally save to database (for persistence)
    let versionId: string | undefined;
    if (saveToDatabase) {
      const sessionId = userContext.sessionId || nanoid();
      const versionIdGenerated = nanoid();

      await db.insert(strategyVersions).values({
        id: versionIdGenerated,
        sessionId,
        versionNumber: 1,
        snapshotData: epmProgram,
        finalizedAt: new Date(),
        costMax: userContext.budgetRange?.max,
        costMin: userContext.budgetRange?.min,
        timelineMonths: userContext.timelineRange?.max,
        createdAt: new Date(),
      });

      versionId = versionIdGenerated;
      console.log('[EPM Direct] Saved to database:', versionId);
    }

    res.json({
      success: true,
      epmProgram,
      versionId,
      metadata: {
        synthesisMode: 'direct',
        initiativeType,
        constraints: {
          budget: userContext.budgetRange,
          timeline: userContext.timelineRange
        }
      }
    });

  } catch (error: any) {
    console.error('[EPM Direct] Synthesis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/epm/fixtures/capture
 *
 * Capture framework insights from a completed strategy version as a fixture.
 * Use this to save insights from a real run for fast-path testing.
 *
 * Request body:
 * {
 *   versionId: string,        // ID of strategy version to capture
 *   fixtureName: string,      // Name for the fixture (e.g., "fintech-baseline")
 *   description?: string      // Optional description
 * }
 *
 * Response:
 * {
 *   success: true,
 *   fixturePath: string,
 *   fixtureData: {...}
 * }
 */
router.post('/fixtures/capture', async (req, res) => {
  try {
    const { versionId, fixtureName, description } = req.body;

    if (!versionId || !fixtureName) {
      return res.status(400).json({
        success: false,
        error: 'Missing versionId or fixtureName'
      });
    }

    // Fetch version from database
    const [version] = await db
      .select()
      .from(strategyVersions)
      .where(eq(strategyVersions.id, versionId))
      .limit(1);

    if (!version) {
      return res.status(404).json({
        success: false,
        error: `Version ${versionId} not found`
      });
    }

    // For capture to work, we need the original insights used to generate this EPM.
    // Since insights aren't stored in strategy_versions, we need to reconstruct or fetch them.
    // For now, return an error with instructions.

    return res.status(501).json({
      success: false,
      error: 'Fixture capture requires framework insights to be stored in strategy_versions',
      instructions: 'Use /api/epm/fixtures/save-insights instead to manually provide insights'
    });

  } catch (error: any) {
    console.error('[EPM Direct] Fixture capture failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/epm/fixtures/save-insights
 *
 * Manually save framework insights as a fixture for fast-path testing.
 *
 * Request body:
 * {
 *   fixtureName: string,             // Name for the fixture (e.g., "fintech-baseline")
 *   insights: StrategyInsights,      // Framework insights to save
 *   description?: string,            // Optional description
 *   defaultConstraints?: {           // Default constraints for this fixture
 *     budgetRange?: { min: number, max: number },
 *     timelineRange?: { min: number, max: number }
 *   }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   fixturePath: string
 * }
 */
router.post('/fixtures/save-insights', async (req, res) => {
  try {
    const { fixtureName, insights, description, defaultConstraints } = req.body;

    if (!fixtureName || !insights) {
      return res.status(400).json({
        success: false,
        error: 'Missing fixtureName or insights'
      });
    }

    // Validate fixture name (alphanumeric + hyphens only)
    if (!/^[a-z0-9-]+$/.test(fixtureName)) {
      return res.status(400).json({
        success: false,
        error: 'Fixture name must be lowercase alphanumeric with hyphens only'
      });
    }

    // Save fixture to fixtures directory
    const fixturesDir = path.join(process.cwd(), 'server', 'fixtures', 'epm');
    await fs.mkdir(fixturesDir, { recursive: true });

    const fixturePath = path.join(fixturesDir, `${fixtureName}.json`);

    const fixtureData = {
      name: fixtureName,
      description: description || `EPM fixture: ${fixtureName}`,
      createdAt: new Date().toISOString(),
      insights,
      defaultConstraints: defaultConstraints || {
        budgetRange: { min: 1500000, max: 1800000 },
        timelineRange: { min: 18, max: 24 }
      }
    };

    await fs.writeFile(fixturePath, JSON.stringify(fixtureData, null, 2), 'utf-8');

    console.log('[EPM Direct] Fixture saved:', fixturePath);

    res.json({
      success: true,
      fixturePath,
      message: `Fixture '${fixtureName}' saved successfully`
    });

  } catch (error: any) {
    console.error('[EPM Direct] Save fixture failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/epm/fixtures/list
 *
 * List all available EPM fixtures.
 *
 * Response:
 * {
 *   success: true,
 *   fixtures: [
 *     { name: "fintech-baseline", description: "...", defaultConstraints: {...} }
 *   ]
 * }
 */
router.get('/fixtures/list', async (req, res) => {
  try {
    const fixturesDir = path.join(process.cwd(), 'server', 'fixtures', 'epm');

    let files: string[];
    try {
      files = await fs.readdir(fixturesDir);
    } catch (err) {
      // Fixtures directory doesn't exist yet
      return res.json({
        success: true,
        fixtures: []
      });
    }

    const fixtures = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const fixturePath = path.join(fixturesDir, file);
        const fixtureData = JSON.parse(await fs.readFile(fixturePath, 'utf-8'));

        fixtures.push({
          name: fixtureData.name,
          description: fixtureData.description,
          defaultConstraints: fixtureData.defaultConstraints,
          createdAt: fixtureData.createdAt
        });
      }
    }

    res.json({
      success: true,
      fixtures
    });

  } catch (error: any) {
    console.error('[EPM Direct] List fixtures failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/epm/fixtures/load
 *
 * Load a fixture and run direct synthesis with custom constraints.
 *
 * Request body:
 * {
 *   fixtureName: string,                // Name of the fixture to load
 *   overrideConstraints?: {             // Override default constraints
 *     budgetRange?: { min: number, max: number },
 *     timelineRange?: { min: number, max: number }
 *   },
 *   saveToDatabase?: boolean
 * }
 *
 * Response:
 * {
 *   success: true,
 *   epmProgram: EPMProgram,
 *   versionId?: string
 * }
 */
router.post('/fixtures/load', async (req, res) => {
  try {
    const { fixtureName, overrideConstraints, saveToDatabase = false } = req.body;

    if (!fixtureName) {
      return res.status(400).json({
        success: false,
        error: 'Missing fixtureName'
      });
    }

    // Load fixture from disk
    const fixturesDir = path.join(process.cwd(), 'server', 'fixtures', 'epm');
    const fixturePath = path.join(fixturesDir, `${fixtureName}.json`);

    let fixtureData;
    try {
      const fixtureContent = await fs.readFile(fixturePath, 'utf-8');
      fixtureData = JSON.parse(fixtureContent);
    } catch (err: any) {
      return res.status(404).json({
        success: false,
        error: `Fixture '${fixtureName}' not found`
      });
    }

    console.log('[EPM Direct] Loaded fixture:', fixtureName);

    // Merge default constraints with overrides
    const budgetRange = overrideConstraints?.budgetRange || fixtureData.defaultConstraints?.budgetRange;
    const timelineRange = overrideConstraints?.timelineRange || fixtureData.defaultConstraints?.timelineRange;

    // Run direct synthesis using fixture insights
    const decisionsWithPriority = {
      prioritizedOrder: [],
      sessionId: nanoid(),
      clarificationConflicts: [],
      budgetRange,
      timelineRange,
    };

    const initiativeType = fixtureData.insights.initiativeType || 'general';

    const epmProgram = await epmSynthesizer.synthesize(
      fixtureData.insights,
      decisionsWithPriority,
      {
        journeyTitle: fixtureData.name,
        framework: fixtureData.insights.frameworkType
      },
      {
        onProgress: (event) => {
          console.log(`[EPM Direct] ${event.description || event.message}`);
        },
        initiativeType
      }
    );

    console.log('[EPM Direct] ✓ Synthesis complete from fixture');
    console.log('[EPM Direct] Resource plan: FTEs =', epmProgram.resourcePlan.totalFTEs);
    console.log('[EPM Direct] Financial plan: Budget =', `$${(epmProgram.financialPlan.totalBudget / 1e6).toFixed(2)}M`);
    console.log('[EPM Direct] Timeline: Months =', epmProgram.timeline.totalMonths);

    // Optionally save to database
    let versionId: string | undefined;
    if (saveToDatabase) {
      const sessionId = nanoid();
      const versionIdGenerated = nanoid();

      await db.insert(strategyVersions).values({
        id: versionIdGenerated,
        sessionId,
        versionNumber: 1,
        snapshotData: epmProgram,
        finalizedAt: new Date(),
        costMax: budgetRange?.max,
        costMin: budgetRange?.min,
        timelineMonths: timelineRange?.max,
        createdAt: new Date(),
      });

      versionId = versionIdGenerated;
      console.log('[EPM Direct] Saved to database:', versionId);
    }

    res.json({
      success: true,
      epmProgram,
      versionId,
      metadata: {
        synthesisMode: 'fixture',
        fixtureName,
        initiativeType,
        constraints: {
          budget: budgetRange,
          timeline: timelineRange
        }
      }
    });

  } catch (error: any) {
    console.error('[EPM Direct] Fixture load failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
