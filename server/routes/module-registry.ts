/**
 * Module Registry API Routes
 * Exposes module and journey information via REST endpoints
 */

import { Router, Request, Response } from 'express';
import { moduleRegistry } from '../modules/registry';

export const moduleRegistryRouter = Router();

moduleRegistryRouter.get('/modules', (_req: Request, res: Response) => {
  try {
    const modules = moduleRegistry.listModules();
    res.json({
      success: true,
      count: modules.length,
      modules: modules.map(m => ({
        id: m.id,
        name: m.name,
        version: m.version,
        description: m.description,
        type: m.type,
        inputs: m.inputs,
        outputs: m.outputs,
        requires: m.requires,
        tags: m.tags,
        estimatedDuration: m.estimatedDuration,
        isActive: m.isActive,
        uiComponent: m.uiComponent,
      })),
    });
  } catch (error) {
    console.error('[ModuleRegistry API] Error listing modules:', error);
    res.status(500).json({ success: false, error: 'Failed to list modules' });
  }
});

moduleRegistryRouter.get('/modules/:id', (req: Request, res: Response) => {
  try {
    const module = moduleRegistry.getModule(req.params.id);
    if (!module) {
      return res.status(404).json({ success: false, error: `Module not found: ${req.params.id}` });
    }
    res.json({ success: true, module });
  } catch (error) {
    console.error('[ModuleRegistry API] Error getting module:', error);
    res.status(500).json({ success: false, error: 'Failed to get module' });
  }
});

moduleRegistryRouter.get('/journeys', (_req: Request, res: Response) => {
  try {
    const journeys = moduleRegistry.listJourneys();
    res.json({
      success: true,
      count: journeys.length,
      journeys: journeys.map(j => ({
        id: j.id,
        name: j.name,
        version: j.version,
        description: j.description,
        modules: j.modules,
        pageSequence: j.pageSequence,
        transitions: j.transitions,
        estimatedDuration: j.estimatedDuration,
        available: j.available,
        summaryBuilder: j.summaryBuilder,
        tags: j.tags,
      })),
    });
  } catch (error) {
    console.error('[ModuleRegistry API] Error listing journeys:', error);
    res.status(500).json({ success: false, error: 'Failed to list journeys' });
  }
});

moduleRegistryRouter.get('/journeys/:id', (req: Request, res: Response) => {
  try {
    const journey = moduleRegistry.getJourney(req.params.id);
    if (!journey) {
      return res.status(404).json({ success: false, error: `Journey not found: ${req.params.id}` });
    }
    res.json({
      success: true,
      journey: {
        id: journey.id,
        name: journey.name,
        version: journey.version,
        description: journey.description,
        modules: journey.modules,
        pageSequence: journey.pageSequence,
        transitions: journey.transitions,
        estimatedDuration: journey.estimatedDuration,
        available: journey.available,
        summaryBuilder: journey.summaryBuilder,
        defaultReadiness: journey.defaultReadiness,
        insightsConfig: journey.insightsConfig,
        tags: journey.tags,
      },
    });
  } catch (error) {
    console.error('[ModuleRegistry API] Error getting journey:', error);
    res.status(500).json({ success: false, error: 'Failed to get journey' });
  }
});

moduleRegistryRouter.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = moduleRegistry.getStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    console.error('[ModuleRegistry API] Error getting stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});
