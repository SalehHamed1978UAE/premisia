/**
 * Custom Journey Executor
 *
 * Executes custom journey configurations node-by-node in topological order,
 * streaming progress via SSE and updating database state.
 *
 * Now routes to REAL analyzers instead of mock data.
 * UPDATED: Now applies cognitive bridges between frameworks for enriched data flow.
 */

import { Response } from 'express';
import { db } from '../db';
import { customJourneyConfigs, customJourneyExecutions, frameworkInsights, strategyVersions, strategicUnderstanding, journeySessions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { getExecutionOrder } from '../modules/compatibility';
import { moduleRegistry } from '../modules/registry';
import { v4 as uuidv4 } from 'uuid';

// Import bridge functions for cognitive transformation between frameworks
import { applyPESTLEToPortersBridge } from '../journey/bridges/pestle-to-porters-bridge';
import { applyPortersToSWOTBridge } from '../journey/bridges/porters-to-swot-bridge';
import { applyWhysToBMCBridge, transformWhysToBMC } from '../journey/bridges/whys-to-bmc-bridge';
import { transformWhysToSwot } from '../journey/bridges/whys-to-swot-bridge';
import { transformSwotToBmc } from '../journey/bridges/swot-to-bmc-bridge';
import { transformPortersToBmc } from '../journey/bridges/porters-to-bmc-bridge';
import { transformBmcToBlueOcean } from '../journey/bridges/bmc-to-blueocean-bridge';
import { transformPestleToBmc } from '../journey/bridges/pestle-to-bmc-bridge';
import { transformBmcToAnsoff } from '../journey/bridges/bmc-to-ansoff-bridge';
import { transformPestleToAnsoff } from '../journey/bridges/pestle-to-ansoff-bridge';
import { transformAnsoffToBmc } from '../journey/bridges/ansoff-to-bmc-bridge';

// Import real analyzers - singletons
import { swotAnalyzer, SWOTOutput } from '../intelligence/swot-analyzer';
import { DecisionGenerator } from '../strategic-consultant-legacy/decision-generator';
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

// Import additional modules
import { ambiguityDetector } from './ambiguity-detector';
import { FiveWhysCoach } from './five-whys-coach';
import { SegmentDiscoveryEngine } from './segment-discovery-engine';
import { OKRGenerator } from '../intelligence/okr-generator';
import { EPMSynthesizer } from '../intelligence/epm-synthesizer';
import { createOpenAIProvider } from '../../src/lib/intelligent-planning/llm-provider';

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
  'segment_discovery': 'segment-discovery-analyzer',
  'okr': 'okr-generator',
  'epm': 'epm-generator',
  // User input steps (not AI modules)
  'strategic_decisions': 'strategic-decisions',
  'prioritization': 'prioritization',
};

// User input steps that pause execution and redirect to a page
const USER_INPUT_STEPS = [
  'strategic_decisions',
  'strategic-decisions',
  'strategic_understanding',
  'strategic-understanding',
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
            
            // For strategic decisions, we need to create a version record
            let sessionId = (execution.inputData as Record<string, any>)?.understandingId || '';
            let versionNumber = 1;
            let redirectUrl = `/strategies/${sessionId}`;
            
            if (node.moduleId.includes('decision') || node.moduleId.includes('strategic_decisions')) {
              // For strategy_versions, we MUST use understandingId as sessionId
              // The DecisionPage queries by understandingId, so we need consistency
              if (!sessionId) {
                // Try to extract understandingId from the journey session metadata
                const journeySession = await db.select()
                  .from(journeySessions)
                  .where(eq(journeySessions.id, executionId))
                  .limit(1);
                
                if (journeySession.length > 0 && journeySession[0].understandingId) {
                  sessionId = journeySession[0].understandingId;
                  console.log(`[CustomJourneyExecutor] Retrieved understandingId from journey session: ${sessionId}`);
                } else {
                  // Last resort fallback to executionId
                  sessionId = executionId;
                  console.warn(`[CustomJourneyExecutor] WARNING: Could not find understandingId, falling back to executionId: ${sessionId}`);
                }
              }
              
              // Check if an understanding record exists for this session
              const existingUnderstanding = await db.select()
                .from(strategicUnderstanding)
                .where(eq(strategicUnderstanding.sessionId, sessionId))
                .limit(1);
              
              if (existingUnderstanding.length === 0) {
                // Create a placeholder strategic understanding record
                // Use 'software_development' as default since custom journeys could be any type
                console.log(`[CustomJourneyExecutor] Creating placeholder understanding for session: ${sessionId}`);
                
                // Build user input from journey context with defensive defaults
                const journeyName = execution.configId ? 'Custom Journey Analysis' : 'Strategic Analysis';
                const completedFrameworks = aggregatedOutputs ? Object.keys(aggregatedOutputs) : [];
                const inputData = execution.inputData as Record<string, any> || {};
                const providedUserInput = (typeof inputData.businessContext === 'string' && inputData.businessContext.trim())
                  ? inputData.businessContext.trim()
                  : (typeof inputData.userInput === 'string' && inputData.userInput.trim())
                    ? inputData.userInput.trim()
                    : '';
                // Always provide a non-empty userInput to satisfy NOT NULL constraint.
                // Prefer actual user input when available to preserve constraints/clarifications.
                const userInputText = providedUserInput || (
                  completedFrameworks.length > 0
                    ? `Custom journey analysis with frameworks: ${completedFrameworks.join(', ')}`
                    : 'Custom strategic journey - awaiting user input'
                );
                const clarificationsProvided = (inputData.clarifications && typeof inputData.clarifications === 'object')
                  ? inputData.clarifications
                  : null;
                const clarificationQuestions = Array.isArray(inputData.clarificationQuestions)
                  ? inputData.clarificationQuestions
                  : null;
                
                try {
                  // Run conflict detection on clarification lines from user input
                  const clarificationLines = ambiguityDetector.extractClarificationLines(userInputText || '');
                  const clarificationConflicts = await ambiguityDetector.detectAllConflicts(clarificationLines);
                  if (clarificationConflicts.length > 0) {
                    console.log(`[CustomJourneyExecutor] Detected ${clarificationConflicts.length} clarification conflicts`);
                  }

                  const stratMeta: Record<string, any> = {
                    completedFrameworks: completedFrameworks,
                    clarificationQuestions: clarificationQuestions || undefined,
                    clarificationsProvided: clarificationsProvided || undefined,
                    lastUpdated: new Date().toISOString(),
                  };
                  if (clarificationLines.length > 0) {
                    stratMeta.clarificationLines = clarificationLines;
                  }
                  if (clarificationConflicts.length > 0) {
                    stratMeta.clarificationConflicts = clarificationConflicts;
                    stratMeta.requiresApproval = { clarifications: true };
                  }

                  // Extract budget/timeline constraints from user input for dual-mode EPM
                  let budgetConstraintValue: { amount?: number; timeline?: number } | null = null;
                  if (userInputText) {
                    const budgetMatch = userInputText.match(/\$\s*(\d+(?:\.\d+)?)\s*(million|mil|m|M)\b/i);
                    const timelineMatch = userInputText.match(/(\d+)\s*months?\b/i);
                    if (budgetMatch || timelineMatch) {
                      budgetConstraintValue = {};
                      if (budgetMatch) {
                        budgetConstraintValue.amount = parseFloat(budgetMatch[1]) * 1_000_000;
                        console.log(`[CustomJourneyExecutor] Extracted budget constraint: $${(budgetConstraintValue.amount / 1e6).toFixed(1)}M`);
                      }
                      if (timelineMatch) {
                        budgetConstraintValue.timeline = parseInt(timelineMatch[1], 10);
                        console.log(`[CustomJourneyExecutor] Extracted timeline constraint: ${budgetConstraintValue.timeline} months`);
                      }
                      // Update strategyMetadata to constrained mode
                      stratMeta.constraintPolicy = {
                        mode: 'constrained',
                        source: 'user-input-extraction',
                        updatedAt: new Date().toISOString(),
                        hasExplicitConstraint: true,
                      };
                    }
                  }

                  await db.insert(strategicUnderstanding).values({
                    sessionId: sessionId,
                    userInput: userInputText || 'Strategic analysis pending user input',
                    title: journeyName || 'Strategic Analysis',
                    initiativeType: 'software_development',
                    strategyMetadata: stratMeta,
                    ...(budgetConstraintValue && { budgetConstraint: budgetConstraintValue }),
                  });
                  console.log(`[CustomJourneyExecutor] Created understanding record for session: ${sessionId}`);
                } catch (insertError: any) {
                  console.error(`[CustomJourneyExecutor] Failed to create understanding:`, insertError.message);
                  throw new Error(`Cannot proceed with user input step: failed to create strategic understanding record - ${insertError.message}`);
                }
              } else {
                // Existing understanding row: keep constraint extraction in sync when users
                // provide explicit "$XM over N months" style constraints in new input.
                const inputData = execution.inputData as Record<string, any> || {};
                const providedUserInput = (typeof inputData.businessContext === 'string' && inputData.businessContext.trim())
                  ? inputData.businessContext.trim()
                  : (typeof inputData.userInput === 'string' && inputData.userInput.trim())
                    ? inputData.userInput.trim()
                    : '';

                if (providedUserInput) {
                  const budgetMatch = providedUserInput.match(/\$\s*(\d+(?:\.\d+)?)\s*(million|mil|m|M)\b/i);
                  const timelineMatch = providedUserInput.match(/(\d+)\s*months?\b/i);

                  if (budgetMatch || timelineMatch) {
                    const budgetConstraintValue: { amount?: number; timeline?: number } = {};
                    if (budgetMatch) {
                      budgetConstraintValue.amount = parseFloat(budgetMatch[1]) * 1_000_000;
                    }
                    if (timelineMatch) {
                      budgetConstraintValue.timeline = parseInt(timelineMatch[1], 10);
                    }

                    const existingRow = existingUnderstanding[0] as any;
                    const existingMetadata = (existingRow?.strategyMetadata && typeof existingRow.strategyMetadata === 'object')
                      ? existingRow.strategyMetadata as Record<string, any>
                      : {};
                    const updatedMetadata: Record<string, any> = {
                      ...existingMetadata,
                      constraintPolicy: {
                        mode: 'constrained',
                        source: 'user-input-extraction',
                        updatedAt: new Date().toISOString(),
                        hasExplicitConstraint: true,
                      },
                      lastUpdated: new Date().toISOString(),
                    };

                    await db.update(strategicUnderstanding)
                      .set({
                        budgetConstraint: budgetConstraintValue,
                        strategyMetadata: updatedMetadata,
                      })
                      .where(eq(strategicUnderstanding.id, existingRow.id));

                    console.log(
                      `[CustomJourneyExecutor] Updated existing understanding with extracted constraints for session: ${sessionId}`
                    );
                  }
                }
              }
              
              // Check if a version already exists
              const existingVersions = await db.select()
                .from(strategyVersions)
                .where(eq(strategyVersions.sessionId, sessionId));
              
              if (existingVersions.length === 0) {
                // Create a version with AI-generated decisions based on prior analysis
                versionNumber = 1;
                const analysisData = aggregatedOutputs || {};
                
                // Extract SWOT output if available for AI decision generation
                // Handle: direct keys ('swot', 'swot-analyzer'), nodeIds containing 'swot', or scan for SWOT shape
                const inputData = execution.inputData as Record<string, any> || {};
                const businessContext = inputData.businessContext || inputData.userInput || '';
                
                // Function to check if an object is a valid SWOTOutput
                const isValidSwotOutput = (obj: any): obj is SWOTOutput => {
                  if (!obj) return false;
                  // Check for nested output
                  const candidate = obj.output || obj;
                  return candidate && Array.isArray(candidate.strengths) && Array.isArray(candidate.weaknesses);
                };
                
                // Function to extract normalized SWOT from an object
                const extractSwot = (obj: any): SWOTOutput | null => {
                  if (!obj) return null;
                  const candidate = obj.output || obj;
                  if (candidate && Array.isArray(candidate.strengths) && Array.isArray(candidate.weaknesses)) {
                    return candidate as SWOTOutput;
                  }
                  return null;
                };
                
                // Try multiple lookup strategies
                let normalizedSwot: SWOTOutput | null = null;
                
                // Strategy 1: Direct keys
                normalizedSwot = extractSwot(aggregatedOutputs['swot']) || extractSwot(aggregatedOutputs['swot-analyzer']);
                
                // Strategy 2: Scan nodeIds containing 'swot'
                if (!normalizedSwot) {
                  for (const [key, value] of Object.entries(aggregatedOutputs)) {
                    if (key.toLowerCase().includes('swot') && isValidSwotOutput(value)) {
                      normalizedSwot = extractSwot(value);
                      console.log(`[CustomJourneyExecutor] Found SWOT output via nodeId: ${key}`);
                      break;
                    }
                  }
                }
                
                // Strategy 3: Scan all outputs for SWOT shape
                if (!normalizedSwot) {
                  for (const [key, value] of Object.entries(aggregatedOutputs)) {
                    if (isValidSwotOutput(value)) {
                      normalizedSwot = extractSwot(value);
                      console.log(`[CustomJourneyExecutor] Found SWOT output by shape detection in: ${key}`);
                      break;
                    }
                  }
                }
                
                if (normalizedSwot) {
                  console.log(`[CustomJourneyExecutor] Valid SWOT output found with ${normalizedSwot.strengths.length} strengths, ${normalizedSwot.weaknesses.length} weaknesses`);
                }
                
                let decisionsData: any;
                
                if (normalizedSwot) {
                  // Use AI to generate contextual decisions from SWOT analysis
                  console.log(`[CustomJourneyExecutor] Generating AI decisions from SWOT output`);
                  try {
                    const decisionGenerator = new DecisionGenerator();
                    const generatedDecisions = await decisionGenerator.generateDecisionsFromSWOT(
                      normalizedSwot,
                      businessContext
                    );
                    decisionsData = generatedDecisions;
                    console.log(`[CustomJourneyExecutor] AI generated ${generatedDecisions.decisions?.length || 0} decision points`);
                  } catch (decisionError: any) {
                    console.error(`[CustomJourneyExecutor] AI decision generation failed, using fallback:`, decisionError.message);
                    decisionsData = this.generatePlaceholderDecisions(aggregatedOutputs);
                  }
                } else {
                  // Fallback to placeholder if no valid SWOT available
                  console.log(`[CustomJourneyExecutor] No valid SWOT output available, using placeholder decisions`);
                  decisionsData = this.generatePlaceholderDecisions(aggregatedOutputs);
                }
                
                console.log(`[CustomJourneyExecutor] Creating version ${versionNumber} for session: ${sessionId}`);
                
                // Create version with atomic verification via .returning()
                const [insertedVersion] = await db.insert(strategyVersions).values({
                  sessionId: sessionId,
                  versionNumber: versionNumber,
                  versionLabel: `Strategic Decisions v${versionNumber}`,
                  analysisData: analysisData,
                  decisionsData: decisionsData,
                  status: 'draft',
                  createdBy: execution.userId || 'system',
                  userId: execution.userId || null,
                }).returning({
                  id: strategyVersions.id,
                  sessionId: strategyVersions.sessionId,
                  versionNumber: strategyVersions.versionNumber,
                });
                
                // VALIDATION GATE: Verify the insert returned the exact row we expect
                if (!insertedVersion || insertedVersion.sessionId !== sessionId || insertedVersion.versionNumber !== versionNumber) {
                  console.error(`[CustomJourneyExecutor] VALIDATION FAILED: Insert did not return expected row for session=${sessionId}, version=${versionNumber}`);
                  throw new Error(`Failed to create strategy version ${versionNumber} for session ${sessionId}`);
                }
                console.log(`[CustomJourneyExecutor] ✓ VALIDATION PASSED: strategy_versions row (id=${insertedVersion.id}, session=${sessionId}, version=${versionNumber}) atomically verified`);
              } else {
                versionNumber = existingVersions.length + 1;
              }
              
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

          // Apply cognitive bridges to enrich data for downstream nodes
          const outgoingEdges = edges.filter(e => e.sourceNodeId === nodeId);
          for (const edge of outgoingEdges) {
            const targetNode = nodeMap.get(edge.targetNodeId);
            if (targetNode) {
              const bridgeEnhancement = await this.applyBridgeIfExists(
                normalizedModuleId,
                this.normalizeModuleId(targetNode.moduleId),
                output,
                aggregatedOutputs
              );
              if (bridgeEnhancement) {
                // Store bridge enhancement with a special key for the target node to pick up
                const bridgeKey = `bridge_${nodeId}_to_${edge.targetNodeId}`;
                aggregatedOutputs[bridgeKey] = bridgeEnhancement;
                console.log(`[CustomJourneyExecutor] Applied bridge: ${normalizedModuleId} → ${targetNode.moduleId}`);
              }
            }
          }

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

        // Also include bridge-enhanced data if available
        // Bridges provide cognitive transformations between frameworks
        const bridgeKey = `bridge_${edge.sourceNodeId}_to_${nodeId}`;
        const bridgeEnhancement = aggregatedOutputs[bridgeKey];
        if (bridgeEnhancement) {
          inputs.bridgeContext = bridgeEnhancement;
          inputs[`bridge_from_${edge.sourceNodeId}`] = bridgeEnhancement;
          console.log(`[CustomJourneyExecutor] Including bridge context for node ${nodeId}`);
        }
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
        
        case 'five-whys-analyzer':
        case 'five_whys':
          // Five Whys requires a problem statement
          const fiveWhysCoach = new FiveWhysCoach();
          const problemStatement = inputs.problemStatement || inputs.problem_statement || businessContext;
          // Return structured output for the Five Whys analysis chain
          return {
            problemStatement,
            whyChain: [],
            rootCause: null,
            status: 'initialized',
            message: 'Five Whys analysis initialized - requires user interaction to complete the why chain',
            metadata: {
              generatedAt: new Date().toISOString(),
              moduleId,
            },
          };
        
        case 'segment-discovery-analyzer':
        case 'segment_discovery':
          // Segment Discovery requires business context and mode
          const segmentEngine = new SegmentDiscoveryEngine();
          const segmentMode = inputs.mode || (businessContext.toLowerCase().includes('b2b') ? 'b2b' : 'b2c');
          try {
            const geneLibrary = await segmentEngine.generateGeneLibrary(businessContext, segmentMode);
            return {
              type: 'segment_discovery_output',
              mode: segmentMode,
              geneLibrary,
              segments: [],
              status: 'gene_library_generated',
              metadata: {
                generatedAt: new Date().toISOString(),
              },
            };
          } catch (segmentError: any) {
            console.error('[CustomJourneyExecutor] Segment Discovery error:', segmentError.message);
            return this.generateMockOutput(moduleId, inputs);
          }
        
        case 'okr-generator':
        case 'okr':
          // OKR Generator requires strategic goals
          const okrGenerator = new OKRGenerator();
          const strategicGoals = inputs.strategicGoals || inputs.strategic_goals || 
            (inputs.decisions?.map((d: any) => d.title) || ['Improve operations', 'Increase market share']);
          const timeframe = inputs.timeframe || inputs.time_horizon || '12 months';
          return await okrGenerator.generate({
            businessContext,
            strategicGoals: Array.isArray(strategicGoals) ? strategicGoals : [strategicGoals],
            timeframe,
          });
        
        case 'epm-generator':
        case 'epm':
          // EPM Generator requires strategic decisions and analysis results
          // CRITICAL: Must pass LLM provider for WBS Builder to work
          if (!process.env.OPENAI_API_KEY) {
            console.error('[CustomJourneyExecutor] OPENAI_API_KEY not set, EPM synthesis will fail');
            throw new Error('EPM synthesis requires OPENAI_API_KEY environment variable');
          }
          const epmLlm = createOpenAIProvider({
            apiKey: process.env.OPENAI_API_KEY,
            model: process.env.OPENAI_MODEL || 'gpt-4o'
          });
          const epmSynthesizer = new EPMSynthesizer(epmLlm);
          const strategyInsights = {
            analysisType: inputs.frameworkType || 'comprehensive',
            data: inputs.analysisResults || inputs.aggregatedOutputs || inputs,
          };
          try {
            const epmProgram = await epmSynthesizer.synthesize(
              { insights: [strategyInsights] } as any,
              {
                userInput: businessContext,
                initiativeType: inputs.initiativeType || 'strategic',
              } as any
            );
            return epmProgram;
          } catch (epmError: any) {
            console.error('[CustomJourneyExecutor] EPM Synthesizer error:', epmError.message);
            return {
              error: epmError.message,
              type: 'epm_program',
              status: 'failed',
              partialData: inputs,
            };
          }
        
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
   * Generate placeholder decisions structure based on prior analysis
   */
  private generatePlaceholderDecisions(aggregatedOutputs: Record<string, any>): any {
    // Create a decisions structure that the Decision Page can work with
    const decisions: any[] = [];
    
    // If we have SWOT analysis, generate decisions based on it
    const swotOutput = aggregatedOutputs['swot'] || aggregatedOutputs['swot-analyzer'] || null;
    
    if (swotOutput) {
      decisions.push({
        id: 'strategic_direction',
        title: 'Strategic Direction',
        question: 'Based on the analysis, what strategic direction should we pursue?',
        context: 'Consider the strengths, weaknesses, opportunities, and threats identified.',
        options: [
          {
            id: 'growth',
            label: 'Growth Strategy',
            description: 'Focus on expanding market share and capabilities',
            pros: ['Increased revenue potential', 'Market leadership'],
            cons: ['Higher investment required', 'Increased risk'],
          },
          {
            id: 'consolidation',
            label: 'Consolidation Strategy',
            description: 'Focus on optimizing current operations and market position',
            pros: ['Lower risk', 'Improved efficiency'],
            cons: ['Limited growth', 'Potential market share loss'],
          },
          {
            id: 'transformation',
            label: 'Transformation Strategy',
            description: 'Pursue significant changes to business model or offerings',
            pros: ['Innovation potential', 'New market opportunities'],
            cons: ['High disruption', 'Significant investment'],
          },
        ],
        impact_areas: ['Market Position', 'Revenue', 'Operations'],
      });
    }
    
    // Add a default decision if no analysis outputs yet
    if (decisions.length === 0) {
      decisions.push({
        id: 'initial_focus',
        title: 'Initial Focus Area',
        question: 'What should be the initial focus area for this initiative?',
        context: 'Select the primary area to focus strategic efforts.',
        options: [
          {
            id: 'market_expansion',
            label: 'Market Expansion',
            description: 'Focus on entering new markets or segments',
            pros: ['Growth opportunities', 'Diversification'],
            cons: ['Market research needed', 'Competitive challenges'],
          },
          {
            id: 'product_innovation',
            label: 'Product Innovation',
            description: 'Focus on developing new products or services',
            pros: ['Differentiation', 'Premium pricing potential'],
            cons: ['R&D investment', 'Time to market'],
          },
          {
            id: 'operational_excellence',
            label: 'Operational Excellence',
            description: 'Focus on improving efficiency and reducing costs',
            pros: ['Quick wins', 'Improved margins'],
            cons: ['Limited growth impact', 'Employee concerns'],
          },
        ],
        impact_areas: ['Operations', 'Strategy', 'Resources'],
      });
    }
    
    return {
      decisions,
      decision_flow: 'sequential',
      estimated_completion_time_minutes: 10,
    };
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
   * Apply cognitive bridge between frameworks if one exists
   * Bridges transform outputs from one framework into enriched context for the next
   */
  private async applyBridgeIfExists(
    sourceModuleId: string,
    targetModuleId: string,
    sourceOutput: any,
    allOutputs: Record<string, any>
  ): Promise<any | null> {
    // Normalize module IDs for bridge lookup
    const normalizedSource = this.getFrameworkKey(sourceModuleId);
    const normalizedTarget = this.getFrameworkKey(targetModuleId);

    console.log(`[CustomJourneyExecutor] Checking for bridge: ${normalizedSource} → ${normalizedTarget}`);

    try {
      // Route to the appropriate bridge based on source → target pair
      switch (`${normalizedSource}_to_${normalizedTarget}`) {
        case 'pestle_to_porters':
          return await applyPESTLEToPortersBridge(sourceOutput, {});

        case 'porters_to_swot':
          const pestleForSwot = this.findOutputByType(allOutputs, 'pestle');
          return await applyPortersToSWOTBridge(sourceOutput, pestleForSwot, {});

        case 'five_whys_to_bmc':
        case 'whys_to_bmc':
          // transformWhysToBMC expects { rootCauses, whysPath, strategicImplications, userInput }
          const whysInput = {
            rootCauses: sourceOutput.rootCauses || sourceOutput.root_causes || [],
            whysPath: sourceOutput.whysPath || sourceOutput.whys_path || [],
            strategicImplications: sourceOutput.strategicImplications || sourceOutput.strategic_implications || [],
            userInput: sourceOutput.userInput || sourceOutput.businessContext || '',
          };
          return transformWhysToBMC(whysInput);

        case 'five_whys_to_swot':
        case 'whys_to_swot':
          return transformWhysToSwot(sourceOutput);

        case 'swot_to_bmc':
          return transformSwotToBmc(sourceOutput);

        case 'porters_to_bmc':
          return transformPortersToBmc(sourceOutput);

        case 'bmc_to_blue_ocean':
        case 'bmc_to_blueocean':
          return transformBmcToBlueOcean(sourceOutput);

        case 'pestle_to_bmc':
          return transformPestleToBmc(sourceOutput);

        case 'bmc_to_ansoff':
          return transformBmcToAnsoff(sourceOutput);

        case 'pestle_to_ansoff':
          return transformPestleToAnsoff(sourceOutput);

        case 'ansoff_to_bmc':
          return transformAnsoffToBmc(sourceOutput);

        default:
          // No bridge exists for this pair
          return null;
      }
    } catch (error: any) {
      console.warn(`[CustomJourneyExecutor] Bridge error (${normalizedSource} → ${normalizedTarget}):`, error.message);
      return null;
    }
  }

  /**
   * Get the canonical framework key for bridge lookup
   */
  private getFrameworkKey(moduleId: string): string {
    // Map analyzer IDs back to framework keys
    const reverseMap: Record<string, string> = {
      'pestle-analyzer': 'pestle',
      'porters-analyzer': 'porters',
      'swot-analyzer': 'swot',
      'bmc-analyzer': 'bmc',
      'five-whys-analyzer': 'five_whys',
      'ansoff-analyzer': 'ansoff',
      'blue-ocean-analyzer': 'blue_ocean',
      'value-chain-analyzer': 'value_chain',
      'vrio-analyzer': 'vrio',
      'bcg-matrix-analyzer': 'bcg_matrix',
    };

    return reverseMap[moduleId] || moduleId.replace(/-analyzer$/, '').replace(/-/g, '_');
  }

  /**
   * Find output by framework type from all outputs
   */
  private findOutputByType(allOutputs: Record<string, any>, frameworkType: string): any | null {
    // Search for output matching the framework type
    for (const [key, value] of Object.entries(allOutputs)) {
      if (key.includes(frameworkType) || key.includes(frameworkType.replace(/_/g, '-'))) {
        return value;
      }
    }
    return null;
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
