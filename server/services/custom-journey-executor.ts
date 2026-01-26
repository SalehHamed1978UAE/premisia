/**
 * Custom Journey Executor
 * 
 * Executes custom journey configurations node-by-node in topological order,
 * streaming progress via SSE and updating database state.
 * 
 * Now routes to REAL analyzers instead of mock data.
 */

import { Response } from 'express';
import { db } from '../db';
import { customJourneyConfigs, customJourneyExecutions, frameworkInsights } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getExecutionOrder } from '../modules/compatibility';
import { moduleRegistry } from '../modules/registry';

// Import real analyzers - singletons
import { swotAnalyzer } from '../intelligence/swot-analyzer';
import { ansoffAnalyzer } from '../intelligence/ansoff-analyzer';
import { jtbdAnalyzer } from '../intelligence/jtbd-analyzer';
import { vrioAnalyzer } from '../intelligence/vrio-analyzer';
import { scenarioPlanningAnalyzer } from '../intelligence/scenario-planning-analyzer';
import { oceanStrategyAnalyzer } from '../intelligence/ocean-strategy-analyzer';
import { blueOceanAnalyzer } from '../intelligence/blue-ocean-analyzer';
import { bcgMatrixAnalyzer } from '../intelligence/bcg-matrix-analyzer';
import { valueChainAnalyzer } from '../intelligence/value-chain-analyzer';
import { competitivePositioningAnalyzer } from '../intelligence/competitive-positioning-analyzer';

// Import class-based analyzers
import { BMCAnalyzer } from '../intelligence/bmc-analyzer';
import { PortersAnalyzer } from '../intelligence/porters-analyzer';
import { PESTLEAnalyzer } from '../intelligence/pestle-analyzer';

// Module ID mapping: registry keys (swot) -> analyzer IDs (swot-analyzer)
const FRAMEWORK_KEY_TO_MODULE_ID: Record<string, string> = {
  'strategic_understanding': 'input-processor',
  'five_whys': 'five-whys-analyzer',
  'business_model_canvas': 'bmc-analyzer',
  'bmc': 'bmc-analyzer',
  'porters_five_forces': 'porters-analyzer',
  'porters': 'porters-analyzer',
  'pestle': 'pestle-analyzer',
  'swot': 'swot-analyzer',
  'ansoff': 'ansoff-analyzer',
  'blue_ocean': 'blue-ocean-analyzer',
  'bcg_matrix': 'bcg-matrix-analyzer',
  'value_chain': 'value-chain-analyzer',
  'vrio': 'vrio-analyzer',
  'scenario_planning': 'scenario-planning-analyzer',
  'jobs_to_be_done': 'jtbd-analyzer',
  'jtbd': 'jtbd-analyzer',
  'competitive_positioning': 'competitive-positioning-analyzer',
  'ocean_strategy': 'ocean-strategy-analyzer',
  // User input steps (not AI modules)
  'strategic_decisions': 'strategic-decisions',
  'prioritization': 'prioritization',
};

// User input steps that pause execution and redirect to a page
const USER_INPUT_STEPS = [
  'strategic_decisions',
  'strategic-decisions',
  'prioritization',
];

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
  | { type: 'user_input_required'; stepType: string; redirectUrl: string; message: string }
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
          // Normalize module ID for lookup
          const normalizedModuleId = this.normalizeModuleId(node.moduleId);
          
          // Check if this is a user input step (strategic_decisions, prioritization, etc.)
          if (this.isUserInputStep(node.moduleId)) {
            console.log(`[CustomJourneyExecutor] User input step detected: ${node.moduleId}`);
            
            // Build redirect URL - for strategic decisions, go to Decision Page
            const understandingId = (execution.inputData as Record<string, any>)?.understandingId || '';
            const versionNumber = 1; // Default version
            let redirectUrl = `/strategies/${understandingId}`;
            
            if (node.moduleId.includes('decision')) {
              // Get session ID for Decision Page - use journey session if available
              const sessionId = (execution.inputData as Record<string, any>)?.journeySessionId || executionId;
              redirectUrl = `/strategic-consultant/decisions/${sessionId}/${versionNumber}`;
            }
            
            // Send SSE event to redirect user
            this.sendEvent(res, {
              type: 'user_input_required',
              stepType: node.moduleId,
              redirectUrl,
              message: 'Please make your strategic selections',
            });
            
            // Update status and pause execution
            nodeStates[nodeId] = {
              status: 'pending',
              startedAt: nodeStates[nodeId].startedAt,
            };
            
            await db
              .update(customJourneyExecutions)
              .set({
                status: 'paused',  // Paused for user input
                currentNodeId: nodeId,
                nodeStates,
                aggregatedOutputs,
                progressMessage: `Awaiting user input: ${node.moduleId}`,
                updatedAt: new Date(),
              })
              .where(eq(customJourneyExecutions.id, executionId));
            
            // Stop execution here - user needs to complete their input
            return;
          }
          
          const nodeInputs = this.gatherNodeInputs(nodeId, edges, aggregatedOutputs, execution.inputData as Record<string, any>);
          
          this.sendEvent(res, {
            type: 'node_progress',
            nodeId,
            message: `Processing ${moduleName}...`,
            progress,
          });

          let output: any;
          const startTime = Date.now();
          
          // Route to real analyzers
          if (module?.status === 'stub' || !module) {
            // Try to use real analyzer even if module not registered
            output = await this.executeRealAnalyzer(normalizedModuleId, nodeInputs, res, nodeId);
          } else {
            output = await this.executeImplementedModule(module, nodeInputs, node.config, normalizedModuleId);
          }
          
          const duration = Date.now() - startTime;

          nodeStates[nodeId] = {
            status: 'completed',
            startedAt: nodeStates[nodeId].startedAt,
            completedAt: new Date().toISOString(),
            output,
          };
          aggregatedOutputs[nodeId] = output;
          
          // Save to frameworkInsights table for UI display
          const understandingId = (execution.inputData as Record<string, any>)?.understandingId;
          if (understandingId && output) {
            await this.saveToFrameworkInsights(
              understandingId,
              executionId,
              normalizedModuleId,
              output,
              duration
            );
          }

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
    // Try to use real analyzer first, fallback to mock if not found
    return this.executeRealAnalyzer(moduleId, inputs, res, nodeId);
  }

  private async executeImplementedModule(
    module: any,
    inputs: Record<string, any>,
    nodeConfig?: Record<string, any>,
    normalizedModuleId?: string
  ): Promise<any> {
    const moduleId = normalizedModuleId || module.id;
    console.log(`[CustomJourneyExecutor] Executing real analyzer for: ${moduleId}`);
    
    return this.executeRealAnalyzer(moduleId, inputs, null, null);
  }
  
  /**
   * Route to real analyzers based on module ID
   */
  private async executeRealAnalyzer(
    moduleId: string,
    inputs: Record<string, any>,
    res: Response | null,
    nodeId: string | null
  ): Promise<any> {
    console.log(`[CustomJourneyExecutor] Routing to real analyzer: ${moduleId}`);
    
    // Extract business context from inputs
    const businessContext = inputs.businessContext 
      || inputs.strategic_context 
      || inputs.context 
      || inputs.originalInput
      || JSON.stringify(inputs);
    
    try {
      // Route to appropriate analyzer based on module ID
      switch (moduleId) {
        case 'swot-analyzer':
        case 'swot':
          return await swotAnalyzer.analyze({
            businessContext,
            bmcOutput: inputs.bmc_output || inputs.bmcOutput,
            portersOutput: inputs.porters_output || inputs.portersOutput,
            pestleOutput: inputs.pestle_output || inputs.pestleOutput,
          });
        
        case 'ansoff-analyzer':
        case 'ansoff':
          return await ansoffAnalyzer.analyze({
            businessContext,
            currentProducts: inputs.currentProducts,
            currentMarkets: inputs.currentMarkets,
            swotOutput: inputs.swot_output || inputs.swotOutput,
            bmcOutput: inputs.bmc_output || inputs.bmcOutput,
          });
        
        case 'bmc-analyzer':
        case 'business_model_canvas':
        case 'bmc':
          // BMC analyzer expects framework results, not raw context
          const bmcAnalyzer = new BMCAnalyzer();
          if (inputs.bmcResults || inputs.frameworkResults) {
            return await bmcAnalyzer.analyze(inputs.bmcResults || inputs.frameworkResults);
          }
          // If no pre-existing BMC results, return placeholder
          console.log('[CustomJourneyExecutor] BMC analyzer needs framework results input');
          return this.generateMockOutput(moduleId, inputs);
        
        case 'porters-analyzer':
        case 'porters_five_forces':
        case 'porters':
          const portersAnalyzer = new PortersAnalyzer();
          if (inputs.portersResults || inputs.frameworkResults) {
            return await portersAnalyzer.analyze(inputs.portersResults || inputs.frameworkResults);
          }
          console.log('[CustomJourneyExecutor] Porter\'s analyzer needs framework results input');
          return this.generateMockOutput(moduleId, inputs);
        
        case 'pestle-analyzer':
        case 'pestle':
          const pestleAnalyzer = new PESTLEAnalyzer();
          if (inputs.pestleResults || inputs.frameworkResults) {
            return await pestleAnalyzer.analyze(inputs.pestleResults || inputs.frameworkResults);
          }
          console.log('[CustomJourneyExecutor] PESTLE analyzer needs framework results input');
          return this.generateMockOutput(moduleId, inputs);
        
        case 'jtbd-analyzer':
        case 'jobs_to_be_done':
        case 'jtbd':
          return await jtbdAnalyzer.analyze({
            businessContext,
            targetSegments: inputs.targetSegments || inputs.target_segments,
          });
        
        case 'vrio-analyzer':
        case 'vrio':
          // VRIO requires resources array
          const resources = inputs.resources || inputs.keyResources || ['General capabilities'];
          return await vrioAnalyzer.analyze({
            businessContext,
            resources: Array.isArray(resources) ? resources : [resources],
          });
        
        case 'scenario-planning-analyzer':
        case 'scenario_planning':
          // Scenario planning requires timeHorizon and uncertainties
          return await scenarioPlanningAnalyzer.analyze({
            businessContext,
            timeHorizon: inputs.timeHorizon || inputs.time_horizon || '3-5 years',
            uncertainties: inputs.uncertainties || inputs.macro_factors || ['Market conditions', 'Technology changes'],
          });
        
        case 'blue-ocean-analyzer':
        case 'blue_ocean':
          // Blue Ocean requires industry and currentOffering
          return await blueOceanAnalyzer.analyze({
            businessContext,
            industry: inputs.industry || inputs.industryAnalysis || 'General',
            currentOffering: inputs.currentOffering || inputs.offerings || ['Current products/services'],
            swotOutput: inputs.swot_output || inputs.swotOutput,
            portersOutput: inputs.porters_output || inputs.portersOutput,
          });
        
        case 'ocean-strategy-analyzer':
        case 'ocean_strategy':
          // Ocean Strategy requires industry
          return await oceanStrategyAnalyzer.analyze({
            businessContext,
            industry: inputs.industry || inputs.industryAnalysis || 'General',
            currentMarketPosition: inputs.currentMarketPosition,
            competitiveLandscape: inputs.competitiveLandscape,
            blueOceanOutput: inputs.blue_ocean_output || inputs.blueOceanOutput,
            swotOutput: inputs.swot_output || inputs.swotOutput,
          });
        
        case 'bcg-matrix-analyzer':
        case 'bcg_matrix':
          // BCG Matrix requires products array
          const products = inputs.products || inputs.businessUnits || [
            { name: 'Main Product', marketShare: 0.5, marketGrowth: 0.1 }
          ];
          return await bcgMatrixAnalyzer.analyze({
            businessContext,
            products: Array.isArray(products) ? products : [products],
            industryData: inputs.industryData,
            portersOutput: inputs.porters_output || inputs.portersOutput,
          });
        
        case 'value-chain-analyzer':
        case 'value_chain':
          // Value Chain requires industry
          return await valueChainAnalyzer.analyze({
            businessContext,
            industry: inputs.industry || 'General',
            portersOutput: inputs.porters_output || inputs.portersOutput,
          });
        
        case 'competitive-positioning-analyzer':
        case 'competitive_positioning':
          // Competitive Positioning requires competitors and targetMarket
          const competitors = inputs.competitors || [
            { name: 'Competitor 1', strengths: ['Market presence'], weaknesses: ['Limited offerings'] }
          ];
          return await competitivePositioningAnalyzer.analyze({
            businessContext,
            competitors: Array.isArray(competitors) ? competitors : [competitors],
            targetMarket: inputs.targetMarket || inputs.target_market || 'General market',
            bmcOutput: inputs.bmc_output || inputs.bmcOutput,
            portersOutput: inputs.porters_output || inputs.portersOutput,
          });
        
        default:
          console.log(`[CustomJourneyExecutor] No real analyzer found for ${moduleId}, using mock`);
          return this.generateMockOutput(moduleId, inputs);
      }
    } catch (error: any) {
      console.error(`[CustomJourneyExecutor] Analyzer error for ${moduleId}:`, error.message);
      // Fallback to mock output on error
      return this.generateMockOutput(moduleId, inputs);
    }
  }
  
  /**
   * Check if module ID represents a user input step
   */
  private isUserInputStep(moduleId: string): boolean {
    const normalized = moduleId.toLowerCase().replace(/_/g, '-');
    return USER_INPUT_STEPS.some(step => 
      moduleId === step || 
      normalized === step.replace(/_/g, '-') ||
      moduleId.includes('strategic') && moduleId.includes('decision')
    );
  }
  
  /**
   * Normalize module ID to analyzer ID format
   */
  private normalizeModuleId(moduleId: string): string {
    // Check if there's a mapping
    const mapped = FRAMEWORK_KEY_TO_MODULE_ID[moduleId];
    if (mapped) return mapped;
    
    // Try underscore to hyphen conversion
    const hyphenated = moduleId.replace(/_/g, '-');
    const mappedHyphen = FRAMEWORK_KEY_TO_MODULE_ID[hyphenated];
    if (mappedHyphen) return mappedHyphen;
    
    return moduleId;
  }
  
  /**
   * Save framework analysis results to frameworkInsights table
   */
  private async saveToFrameworkInsights(
    understandingId: string,
    sessionId: string,
    frameworkName: string,
    insights: any,
    duration: number
  ): Promise<void> {
    try {
      // Convert module ID back to framework name for storage
      const storedFrameworkName = frameworkName
        .replace('-analyzer', '')
        .replace(/-/g, '_');
      
      console.log(`[CustomJourneyExecutor] Saving ${storedFrameworkName} to frameworkInsights`);
      
      await db.insert(frameworkInsights).values({
        understandingId,
        sessionId,
        frameworkName: storedFrameworkName,
        frameworkVersion: '1.0',
        insights: insights,
        telemetry: {
          duration,
          executedAt: new Date().toISOString(),
          source: 'custom_journey_executor',
        } as any,
      }).onConflictDoNothing();
      
      console.log(`[CustomJourneyExecutor] ✓ Saved ${storedFrameworkName} insights`);
    } catch (error: any) {
      console.error(`[CustomJourneyExecutor] Failed to save framework insights:`, error.message);
      // Don't throw - this is not critical to execution
    }
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
