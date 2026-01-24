/**
 * Custom Journey Executor
 * 
 * Executes custom journey configurations node-by-node in topological order,
 * streaming progress via SSE and updating database state.
 */

import { Response } from 'express';
import { db } from '../db';
import { customJourneyConfigs, customJourneyExecutions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getExecutionOrder } from '../modules/compatibility';
import { moduleRegistry } from '../modules/registry';

interface NodeConfig {
  id: string;
  moduleId: string;
  position: { x: number; y: number };
  config?: Record<string, any>;
}

interface EdgeConfig {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

interface NodeState {
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  output?: any;
  error?: string;
}

type SSEEvent = 
  | { type: 'execution_started'; executionId: string; totalNodes: number }
  | { type: 'node_start'; nodeId: string; moduleId: string; nodeName: string; progress: number }
  | { type: 'node_progress'; nodeId: string; message: string; progress: number }
  | { type: 'node_complete'; nodeId: string; output: any; progress: number }
  | { type: 'node_error'; nodeId: string; error: string }
  | { type: 'journey_complete'; aggregatedOutputs: Record<string, any> }
  | { type: 'journey_error'; error: string };

export class CustomJourneyExecutor {
  private abortController: AbortController | null = null;
  private isAborted = false;

  async executeJourney(
    executionId: string,
    res: Response
  ): Promise<void> {
    this.abortController = new AbortController();
    this.isAborted = false;

    res.on('close', () => {
      console.log(`[CustomJourneyExecutor] Client disconnected for execution ${executionId}`);
      this.isAborted = true;
      this.abortController?.abort();
    });

    try {
      const [execution] = await db
        .select()
        .from(customJourneyExecutions)
        .where(eq(customJourneyExecutions.id, executionId));

      if (!execution) {
        this.sendEvent(res, { type: 'journey_error', error: 'Execution not found' });
        return;
      }

      const [config] = await db
        .select()
        .from(customJourneyConfigs)
        .where(eq(customJourneyConfigs.id, execution.configId));

      if (!config) {
        this.sendEvent(res, { type: 'journey_error', error: 'Journey config not found' });
        return;
      }

      const nodes = (config.nodes as NodeConfig[]) || [];
      const edges = (config.edges as EdgeConfig[]) || [];

      if (nodes.length === 0) {
        this.sendEvent(res, { type: 'journey_error', error: 'Journey has no nodes' });
        return;
      }

      const executionOrder = getExecutionOrder(
        nodes.map(n => ({ id: n.id })),
        edges.map(e => ({ sourceNodeId: e.sourceNodeId, targetNodeId: e.targetNodeId }))
      );

      console.log(`[CustomJourneyExecutor] Execution order: ${executionOrder.join(' -> ')}`);

      await db
        .update(customJourneyExecutions)
        .set({
          status: 'running',
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(customJourneyExecutions.id, executionId));

      this.sendEvent(res, {
        type: 'execution_started',
        executionId,
        totalNodes: executionOrder.length,
      });

      const nodeStates: Record<string, NodeState> = {};
      const aggregatedOutputs: Record<string, any> = {};
      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      for (const nodeId of executionOrder) {
        nodeStates[nodeId] = { status: 'pending' };
      }

      let completedCount = 0;
      let hasError = false;

      for (const nodeId of executionOrder) {
        if (this.isAborted) {
          console.log(`[CustomJourneyExecutor] Execution aborted for ${executionId}`);
          break;
        }

        const node = nodeMap.get(nodeId);
        if (!node) {
          console.error(`[CustomJourneyExecutor] Node ${nodeId} not found`);
          continue;
        }

        const module = moduleRegistry.getModule(node.moduleId);
        const moduleName = module?.name || node.moduleId;

        nodeStates[nodeId] = {
          status: 'running',
          startedAt: new Date().toISOString(),
        };

        await this.updateExecutionState(executionId, nodeStates, aggregatedOutputs, nodeId, completedCount, executionOrder.length);

        const progress = Math.round((completedCount / executionOrder.length) * 100);
        this.sendEvent(res, {
          type: 'node_start',
          nodeId,
          moduleId: node.moduleId,
          nodeName: moduleName,
          progress,
        });

        try {
          const nodeInputs = this.gatherNodeInputs(nodeId, edges, aggregatedOutputs, execution.inputData as Record<string, any>);
          
          this.sendEvent(res, {
            type: 'node_progress',
            nodeId,
            message: `Processing ${moduleName}...`,
            progress,
          });

          let output: any;
          
          if (module?.status === 'stub' || !module) {
            output = await this.simulateStubModule(node.moduleId, nodeInputs, res, nodeId);
          } else {
            output = await this.executeImplementedModule(module, nodeInputs, node.config);
          }

          nodeStates[nodeId] = {
            status: 'completed',
            startedAt: nodeStates[nodeId].startedAt,
            completedAt: new Date().toISOString(),
            output,
          };
          aggregatedOutputs[nodeId] = output;

          completedCount++;
          const newProgress = Math.round((completedCount / executionOrder.length) * 100);

          await this.updateExecutionState(executionId, nodeStates, aggregatedOutputs, null, completedCount, executionOrder.length);

          this.sendEvent(res, {
            type: 'node_complete',
            nodeId,
            output,
            progress: newProgress,
          });

        } catch (error: any) {
          console.error(`[CustomJourneyExecutor] Error executing node ${nodeId}:`, error);
          
          nodeStates[nodeId] = {
            status: 'error',
            startedAt: nodeStates[nodeId].startedAt,
            completedAt: new Date().toISOString(),
            error: error.message || 'Unknown error',
          };

          hasError = true;

          await this.updateExecutionState(executionId, nodeStates, aggregatedOutputs, null, completedCount, executionOrder.length);

          this.sendEvent(res, {
            type: 'node_error',
            nodeId,
            error: error.message || 'Unknown error',
          });
        }
      }

      const finalStatus = this.isAborted ? 'paused' : (hasError ? 'failed' : 'completed');
      
      await db
        .update(customJourneyExecutions)
        .set({
          status: finalStatus,
          nodeStates,
          aggregatedOutputs,
          progress: 100,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(customJourneyExecutions.id, executionId));

      if (!this.isAborted) {
        this.sendEvent(res, {
          type: 'journey_complete',
          aggregatedOutputs,
        });
      }

    } catch (error: any) {
      console.error(`[CustomJourneyExecutor] Fatal error for execution ${executionId}:`, error);
      
      await db
        .update(customJourneyExecutions)
        .set({
          status: 'failed',
          errorMessage: error.message || 'Unknown error',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(customJourneyExecutions.id, executionId));

      this.sendEvent(res, {
        type: 'journey_error',
        error: error.message || 'Unknown error',
      });
    }
  }

  private sendEvent(res: Response, event: SSEEvent): boolean {
    try {
      const eventData = JSON.stringify({
        ...event,
        timestamp: new Date().toISOString(),
      });
      res.write(`data: ${eventData}\n\n`);
      return true;
    } catch (error) {
      console.error('[CustomJourneyExecutor] Error sending SSE event:', error);
      return false;
    }
  }

  private async updateExecutionState(
    executionId: string,
    nodeStates: Record<string, NodeState>,
    aggregatedOutputs: Record<string, any>,
    currentNodeId: string | null,
    completedCount: number,
    totalCount: number
  ): Promise<void> {
    const progress = Math.round((completedCount / totalCount) * 100);
    
    await db
      .update(customJourneyExecutions)
      .set({
        nodeStates,
        aggregatedOutputs,
        currentNodeId,
        progress,
        updatedAt: new Date(),
      })
      .where(eq(customJourneyExecutions.id, executionId));
  }

  private gatherNodeInputs(
    nodeId: string,
    edges: EdgeConfig[],
    aggregatedOutputs: Record<string, any>,
    initialInputData: Record<string, any> | null
  ): Record<string, any> {
    const inputs: Record<string, any> = {};

    if (initialInputData) {
      Object.assign(inputs, initialInputData);
    }

    const incomingEdges = edges.filter(e => e.targetNodeId === nodeId);
    
    for (const edge of incomingEdges) {
      const sourceOutput = aggregatedOutputs[edge.sourceNodeId];
      if (sourceOutput !== undefined) {
        inputs[edge.targetPortId] = sourceOutput;
        inputs[edge.sourcePortId] = sourceOutput;
        inputs[`from_${edge.sourceNodeId}`] = sourceOutput;
      }
    }

    return inputs;
  }

  private async simulateStubModule(
    moduleId: string,
    inputs: Record<string, any>,
    res: Response,
    nodeId: string
  ): Promise<any> {
    const delay = 2000 + Math.random() * 1000;
    
    this.sendEvent(res, {
      type: 'node_progress',
      nodeId,
      message: `Simulating ${moduleId} (stub module)...`,
      progress: 0,
    });

    await this.sleep(delay / 2);
    
    this.sendEvent(res, {
      type: 'node_progress',
      nodeId,
      message: `Almost done with ${moduleId}...`,
      progress: 50,
    });

    await this.sleep(delay / 2);

    return this.generateMockOutput(moduleId, inputs);
  }

  private async executeImplementedModule(
    module: any,
    inputs: Record<string, any>,
    nodeConfig?: Record<string, any>
  ): Promise<any> {
    console.log(`[CustomJourneyExecutor] Executing implemented module: ${module.id}`);
    
    await this.sleep(1500);
    
    return this.generateMockOutput(module.id, inputs);
  }

  private generateMockOutput(moduleId: string, inputs: Record<string, any>): any {
    const baseOutput = {
      moduleId,
      processedAt: new Date().toISOString(),
      inputSummary: Object.keys(inputs).length > 0 
        ? `Processed ${Object.keys(inputs).length} inputs` 
        : 'No inputs received',
    };

    if (moduleId.includes('bmc') || moduleId.includes('business-model')) {
      return {
        ...baseOutput,
        type: 'bmc_output',
        blocks: {
          customerSegments: ['Segment A', 'Segment B'],
          valuePropositions: ['Value Prop 1', 'Value Prop 2'],
          channels: ['Channel 1'],
          customerRelationships: ['Relationship type'],
          revenueStreams: ['Revenue stream 1'],
          keyResources: ['Resource 1'],
          keyActivities: ['Activity 1'],
          keyPartnerships: ['Partner 1'],
          costStructure: ['Cost 1'],
        },
      };
    }

    if (moduleId.includes('swot')) {
      return {
        ...baseOutput,
        type: 'swot_output',
        strengths: ['Strength 1', 'Strength 2'],
        weaknesses: ['Weakness 1'],
        opportunities: ['Opportunity 1', 'Opportunity 2'],
        threats: ['Threat 1'],
      };
    }

    if (moduleId.includes('porter')) {
      return {
        ...baseOutput,
        type: 'porters_output',
        forces: {
          competitiveRivalry: 'Medium',
          supplierPower: 'Low',
          buyerPower: 'High',
          threatOfSubstitution: 'Medium',
          threatOfNewEntry: 'Low',
        },
      };
    }

    if (moduleId.includes('pestle')) {
      return {
        ...baseOutput,
        type: 'pestle_output',
        factors: {
          political: ['Factor 1'],
          economic: ['Factor 2'],
          social: ['Factor 3'],
          technological: ['Factor 4'],
          legal: ['Factor 5'],
          environmental: ['Factor 6'],
        },
      };
    }

    if (moduleId.includes('five-whys')) {
      return {
        ...baseOutput,
        type: 'five_whys_output',
        rootCause: 'Identified root cause',
        whysChain: ['Why 1', 'Why 2', 'Why 3', 'Why 4', 'Why 5'],
      };
    }

    return {
      ...baseOutput,
      type: 'generic_output',
      result: `Output from ${moduleId}`,
      data: { success: true },
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const customJourneyExecutor = new CustomJourneyExecutor();
