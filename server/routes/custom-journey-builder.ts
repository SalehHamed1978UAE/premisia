/**
 * Custom Journey Builder API Routes
 * 
 * Visual drag-and-drop journey configuration CRUD and execution
 * Uses customJourneyConfigs and customJourneyExecutions tables
 */

import { Router, Request, Response } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db';
import { customJourneyConfigs, customJourneyExecutions } from '@shared/schema';
import { moduleRegistry } from '../modules/registry';
import { isConnectionAllowed, detectCycle, getExecutionOrder } from '../modules/compatibility';
import type { ModuleManifest } from '../modules/manifest';
import { z } from 'zod';

const router = Router();

const nodeSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  config: z.record(z.any()).optional(),
});

const edgeSchema = z.object({
  id: z.string(),
  sourceNodeId: z.string(),
  sourcePortId: z.string(),
  targetNodeId: z.string(),
  targetPortId: z.string(),
});

const createJourneyConfigSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  nodes: z.array(nodeSchema).default([]),
  edges: z.array(edgeSchema).default([]),
  metadata: z.record(z.any()).optional(),
});

const updateJourneyConfigSchema = createJourneyConfigSchema.partial().extend({
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

const validateJourneySchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
});

router.get('/modules', async (_req: Request, res: Response) => {
  try {
    const allModules = moduleRegistry.listModules();
    
    const modules = allModules.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      category: m.category,
      icon: m.icon,
      status: m.status,
      inputs: m.inputs.map(i => ({
        id: i.id,
        name: i.name,
        type: i.type,
        required: i.required,
        description: i.description,
      })),
      outputs: m.outputs.map(o => ({
        id: o.id,
        name: o.name,
        type: o.type,
        description: o.description,
      })),
      estimatedDuration: m.estimatedDuration,
      tags: m.tags,
    }));

    res.json({
      success: true,
      modules,
      count: modules.length,
    });
  } catch (error) {
    console.error('[Custom Journey Builder] Error fetching modules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch modules',
    });
  }
});

router.get('/configs', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const status = req.query.status as string | undefined;
    
    let whereClause = eq(customJourneyConfigs.createdBy, userId);
    if (status && ['draft', 'published', 'archived'].includes(status)) {
      whereClause = and(
        eq(customJourneyConfigs.createdBy, userId),
        eq(customJourneyConfigs.status, status as 'draft' | 'published' | 'archived')
      )!;
    }

    const configs = await db
      .select()
      .from(customJourneyConfigs)
      .where(whereClause)
      .orderBy(desc(customJourneyConfigs.updatedAt));

    res.json({
      success: true,
      configs,
      count: configs.length,
    });
  } catch (error) {
    console.error('[Custom Journey Builder] Error fetching configs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journey configs',
    });
  }
});

router.get('/configs/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const [config] = await db
      .select()
      .from(customJourneyConfigs)
      .where(eq(customJourneyConfigs.id, id));

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Journey config not found',
      });
    }

    if (config.createdBy !== userId && config.status !== 'published') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this config',
      });
    }

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('[Custom Journey Builder] Error fetching config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch journey config',
    });
  }
});

router.post('/configs', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const validatedData = createJourneyConfigSchema.parse(req.body);
    
    let estimatedDuration = 0;
    const nodes = validatedData.nodes as { moduleId: string }[];
    for (const node of nodes) {
      const module = moduleRegistry.getModule(node.moduleId);
      if (module) {
        estimatedDuration += module.estimatedDuration || 0;
      }
    }

    const [newConfig] = await db
      .insert(customJourneyConfigs)
      .values({
        name: validatedData.name,
        description: validatedData.description,
        createdBy: userId,
        nodes: validatedData.nodes,
        edges: validatedData.edges,
        metadata: validatedData.metadata,
        estimatedDurationMinutes: estimatedDuration,
      })
      .returning();

    res.status(201).json({
      success: true,
      config: newConfig,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      });
    }
    console.error('[Custom Journey Builder] Error creating config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create journey config',
    });
  }
});

router.put('/configs/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const [existingConfig] = await db
      .select()
      .from(customJourneyConfigs)
      .where(eq(customJourneyConfigs.id, id));

    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        error: 'Journey config not found',
      });
    }

    if (existingConfig.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this config',
      });
    }

    const validatedData = updateJourneyConfigSchema.parse(req.body);
    
    let estimatedDuration = existingConfig.estimatedDurationMinutes;
    if (validatedData.nodes) {
      estimatedDuration = 0;
      const nodes = validatedData.nodes as { moduleId: string }[];
      for (const node of nodes) {
        const module = moduleRegistry.getModule(node.moduleId);
        if (module) {
          estimatedDuration += module.estimatedDuration || 0;
        }
      }
    }

    const publishedAt = validatedData.status === 'published' && existingConfig.status !== 'published'
      ? new Date()
      : existingConfig.publishedAt;

    const [updatedConfig] = await db
      .update(customJourneyConfigs)
      .set({
        ...validatedData,
        estimatedDurationMinutes: estimatedDuration,
        publishedAt,
        version: existingConfig.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(customJourneyConfigs.id, id))
      .returning();

    res.json({
      success: true,
      config: updatedConfig,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      });
    }
    console.error('[Custom Journey Builder] Error updating config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update journey config',
    });
  }
});

router.delete('/configs/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const [existingConfig] = await db
      .select()
      .from(customJourneyConfigs)
      .where(eq(customJourneyConfigs.id, id));

    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        error: 'Journey config not found',
      });
    }

    if (existingConfig.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this config',
      });
    }

    const runningExecutions = await db
      .select()
      .from(customJourneyExecutions)
      .where(and(
        eq(customJourneyExecutions.configId, id),
        eq(customJourneyExecutions.status, 'running')
      ));

    if (runningExecutions.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete config with running executions',
      });
    }

    await db
      .delete(customJourneyConfigs)
      .where(eq(customJourneyConfigs.id, id));

    res.json({
      success: true,
      message: 'Journey config deleted',
    });
  } catch (error) {
    console.error('[Custom Journey Builder] Error deleting config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete journey config',
    });
  }
});

router.post('/validate', async (req: Request, res: Response) => {
  try {
    const validatedData = validateJourneySchema.parse(req.body);
    const { nodes, edges } = validatedData;

    const errors: string[] = [];
    const warnings: string[] = [];

    if (nodes.length === 0) {
      errors.push('Journey must have at least one node');
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const allModules = moduleRegistry.listModules();
    const moduleMap = new Map<string, ModuleManifest>(allModules.map(m => [m.id, m]));

    for (const node of nodes) {
      const module = moduleMap.get(node.moduleId);
      if (!module) {
        errors.push(`Unknown module: ${node.moduleId}`);
      } else if (module.status === 'stub') {
        warnings.push(`Module "${module.name}" is not yet implemented`);
      }
    }

    const cycleResult = detectCycle(
      nodes.map(n => ({ id: n.id })),
      edges.map(e => ({ sourceNodeId: e.sourceNodeId, targetNodeId: e.targetNodeId }))
    );
    if (cycleResult.hasCycle) {
      errors.push(`Cycle detected in journey: ${cycleResult.cycleNodes?.join(' → ')}`);
    }

    for (const edge of edges) {
      const sourceNode = nodeMap.get(edge.sourceNodeId);
      const targetNode = nodeMap.get(edge.targetNodeId);
      
      if (!sourceNode || !targetNode) {
        errors.push(`Invalid edge: missing node ${!sourceNode ? edge.sourceNodeId : edge.targetNodeId}`);
        continue;
      }

      const sourceModule = moduleMap.get(sourceNode.moduleId);
      const targetModule = moduleMap.get(targetNode.moduleId);
      
      if (!sourceModule || !targetModule) continue;

      const sourcePort = sourceModule.outputs.find(o => o.id === edge.sourcePortId);
      const targetPort = targetModule.inputs.find(i => i.id === edge.targetPortId);

      if (!sourcePort) {
        errors.push(`Invalid source port: ${edge.sourcePortId} on ${sourceModule.name}`);
        continue;
      }
      if (!targetPort) {
        errors.push(`Invalid target port: ${edge.targetPortId} on ${targetModule.name}`);
        continue;
      }

      const connectionCheck = isConnectionAllowed(
        sourceNode.moduleId,
        edge.sourcePortId,
        targetNode.moduleId,
        edge.targetPortId,
        sourcePort.type,
        targetPort.type
      );

      if (!connectionCheck.allowed) {
        errors.push(`Invalid connection: ${connectionCheck.reason}`);
      }
    }

    const targetedNodes = new Set(edges.map(e => e.targetNodeId));
    for (const node of nodes) {
      const module = moduleMap.get(node.moduleId);
      if (!module) continue;

      const requiredInputs = module.inputs.filter(i => i.required);
      if (requiredInputs.length > 0 && !targetedNodes.has(node.id)) {
        const hasInputConnection = edges.some(e => e.targetNodeId === node.id);
        if (!hasInputConnection && module.type !== 'processor') {
          warnings.push(`"${module.name}" has no input connections`);
        }
      }
    }

    const executionOrder = !cycleResult.hasCycle 
      ? getExecutionOrder(
          nodes.map(n => ({ id: n.id })),
          edges.map(e => ({ sourceNodeId: e.sourceNodeId, targetNodeId: e.targetNodeId }))
        )
      : [];

    res.json({
      success: true,
      isValid: errors.length === 0,
      errors,
      warnings,
      executionOrder,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      });
    }
    console.error('[Custom Journey Builder] Error validating journey:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate journey',
    });
  }
});

router.get('/executions', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const executions = await db
      .select()
      .from(customJourneyExecutions)
      .where(eq(customJourneyExecutions.userId, userId))
      .orderBy(desc(customJourneyExecutions.createdAt));

    res.json({
      success: true,
      executions,
      count: executions.length,
    });
  } catch (error) {
    console.error('[Custom Journey Builder] Error fetching executions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch executions',
    });
  }
});

router.get('/executions/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const [execution] = await db
      .select()
      .from(customJourneyExecutions)
      .where(eq(customJourneyExecutions.id, id));

    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found',
      });
    }

    if (execution.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this execution',
      });
    }

    res.json({
      success: true,
      execution,
    });
  } catch (error) {
    console.error('[Custom Journey Builder] Error fetching execution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch execution',
    });
  }
});

router.post('/executions', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { configId, inputData } = req.body;

    if (!configId) {
      return res.status(400).json({
        success: false,
        error: 'configId is required',
      });
    }

    const [config] = await db
      .select()
      .from(customJourneyConfigs)
      .where(eq(customJourneyConfigs.id, configId));

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Journey config not found',
      });
    }

    const [execution] = await db
      .insert(customJourneyExecutions)
      .values({
        configId,
        userId,
        inputData,
        status: 'pending',
      })
      .returning();

    res.status(201).json({
      success: true,
      execution,
    });
  } catch (error) {
    console.error('[Custom Journey Builder] Error creating execution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create execution',
    });
  }
});

export default router;
