/**
 * TypeScript-Native Multi-Agent EPM Generator
 * 
 * Full TypeScript implementation of the multi-agent EPM generation system.
 * Replaces the Python/CrewAI approach with native Node.js implementation.
 * 
 * Key advantages:
 * - No orphaned processes (runs in-process)
 * - Full DB persistence enables resume capability
 * - Better integration with existing Node.js infrastructure
 * - Logs captured directly (not lost to Python stderr)
 */

import type { IEPMGenerator, EPMGeneratorInput, EPMGeneratorOutput, GenerateOptions, GenerationProgress } from './types';
import { multiAgentOrchestrator, ProgressUpdate } from '../multi-agent';
import { BusinessContext } from '../multi-agent/persistence/conversation-log';
import { postProcessWithCPM } from './cpm-processor';

export class TypeScriptMultiAgentGenerator implements IEPMGenerator {
  private isInitialized = false;

  constructor() {
    console.log('[TSMultiAgentGenerator] TypeScript-native multi-agent generator initialized');
    this.isInitialized = true;
  }

  /**
   * Always healthy since we run in-process
   */
  async isHealthy(): Promise<boolean> {
    return this.isInitialized;
  }

  /**
   * Generate EPM program using the TypeScript multi-agent orchestrator.
   * All 7 rounds execute in-process with full DB persistence.
   */
  async generate(input: EPMGeneratorInput, options?: GenerateOptions): Promise<EPMGeneratorOutput> {
    const startTime = Date.now();
    console.log('[TSMultiAgentGenerator] Starting TypeScript multi-agent generation');
    console.log(`[TSMultiAgentGenerator] Session: ${input.sessionId}`);
    console.log(`[TSMultiAgentGenerator] Business: ${input.businessContext.name}`);

    try {
      // Convert EPMGeneratorInput to BusinessContext for orchestrator
      // Include all fields for complete context preservation
      const businessContext: BusinessContext = {
        name: input.businessContext.name,
        type: input.businessContext.type,
        scale: input.businessContext.scale,
        description: input.businessContext.description,
        industry: input.businessContext.industry,
        keywords: input.businessContext.keywords,
        constraints: input.constraints ? {
          budget: input.constraints.budget,
          deadline: input.constraints.deadline?.toISOString(),
          regulations: input.constraints.regulations,
          maxHeadcount: input.constraints.resourceLimits?.maxHeadcount,
          maxContractors: input.constraints.resourceLimits?.maxContractors,
        } : undefined,
        bmcInsights: input.bmcInsights,
        strategyInsights: input.strategyInsights,
        userId: input.userId,
        journeyType: input.journeyType,
      };

      // Progress callback to emit SSE events if provided
      const onProgress = options?.onProgress 
        ? (update: ProgressUpdate) => {
            const progress: GenerationProgress = this.convertProgress(update);
            options.onProgress!(progress);
          }
        : undefined;

      // Execute the full multi-agent orchestration
      // Pass input.sessionId as both journeySessionId and providedSessionId for correlation
      const result = await multiAgentOrchestrator.generate(
        input.userId,
        businessContext,
        input.bmcInsights,
        input.sessionId,  // journeySessionId for linking
        onProgress,
        input.sessionId   // providedSessionId - use caller's ID for resume capability
      );

      const generationTime = Date.now() - startTime;

      // Apply CPM post-processing for mathematically rigorous scheduling
      let program = result.program as any;
      if (program) {
        console.log('[TSMultiAgentGenerator] Applying CPM post-processing...');
        program = postProcessWithCPM(program);
      }

      console.log('[TSMultiAgentGenerator] Generation complete');
      console.log(`[TSMultiAgentGenerator] Session ID: ${result.sessionId}`);
      console.log(`[TSMultiAgentGenerator] Generation time: ${(generationTime / 1000).toFixed(1)}s`);

      // Return in the expected EPMGeneratorOutput format
      // Expose sessionId for resume capability
      return {
        program: program || this.createEmptyProgram(input),
        metadata: {
          generator: 'multi-agent' as const,
          generatedAt: new Date().toISOString(),
          confidence: 0.85,
          generationTimeMs: generationTime,
          roundsCompleted: 7,
          multiAgentSessionId: result.sessionId,
          resumable: true,
        },
      };

    } catch (error: any) {
      const errorMessage = error.message || String(error);
      console.error('[TSMultiAgentGenerator] Generation failed:', errorMessage);
      throw error;
    }
  }

  /**
   * Resume a previously interrupted generation session
   */
  async resumeSession(sessionId: string, options?: GenerateOptions): Promise<EPMGeneratorOutput> {
    const startTime = Date.now();
    console.log(`[TSMultiAgentGenerator] Resuming session ${sessionId}`);
    
    try {
      // Progress callback to emit SSE events if provided
      const onProgress = options?.onProgress 
        ? (update: ProgressUpdate) => {
            const progress: GenerationProgress = this.convertProgress(update);
            options.onProgress!(progress);
          }
        : undefined;

      const result = await multiAgentOrchestrator.resume(sessionId, onProgress);
      const generationTime = Date.now() - startTime;

      // Apply CPM post-processing
      let program = result.program as any;
      if (program) {
        console.log('[TSMultiAgentGenerator] Applying CPM post-processing...');
        program = postProcessWithCPM(program);
      }

      console.log('[TSMultiAgentGenerator] Resume complete');
      console.log(`[TSMultiAgentGenerator] Generation time: ${(generationTime / 1000).toFixed(1)}s`);

      return {
        program: program,
        metadata: {
          generator: 'multi-agent' as const,
          generatedAt: new Date().toISOString(),
          confidence: 0.85,
          generationTimeMs: generationTime,
          roundsCompleted: 7,
          multiAgentSessionId: result.sessionId,
          resumable: true,
        },
      };
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      console.error('[TSMultiAgentGenerator] Resume failed:', errorMessage);
      throw error;
    }
  }

  /**
   * Convert internal progress updates to the GenerationProgress format
   */
  private convertProgress(update: ProgressUpdate): GenerationProgress {
    const round = update.round || 1;
    return {
      round,
      totalRounds: 7,
      currentAgent: update.agent || 'system',
      message: this.getProgressMessage(update),
      percentComplete: Math.round((round / 7) * 100),
    };
  }

  private getProgressMessage(update: ProgressUpdate): string {
    switch (update.type) {
      case 'round_start':
        return `Starting round ${update.round}`;
      case 'round_complete':
        return `Completed round ${update.round}`;
      case 'agent_start':
        return `Agent ${update.agent} is analyzing...`;
      case 'agent_complete':
        return `Agent ${update.agent} completed analysis`;
      case 'synthesis_start':
        return `Synthesizing round ${update.round} outputs`;
      case 'synthesis_complete':
        return `Synthesis complete for round ${update.round}`;
      case 'conflict_resolution_start':
        return `Resolving conflicts in round ${update.round}`;
      case 'conflict_resolution_complete':
        return `Conflicts resolved for round ${update.round}`;
      case 'error':
        return `Error: ${update.error || 'Unknown error'}`;
      default:
        return `Progress update: ${update.type}`;
    }
  }

  /**
   * Create an empty program structure when generation fails
   */
  private createEmptyProgram(input: EPMGeneratorInput): any {
    return {
      id: input.sessionId,
      name: `${input.businessContext.name} Program`,
      description: input.businessContext.description,
      workstreams: [],
      timeline: {
        phases: [],
        milestones: [],
        gantt: [],
      },
      resources: [],
      risks: [],
      financials: {
        budget: {},
        forecast: {},
      },
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Singleton instance
 */
export const typescriptMultiAgentGenerator = new TypeScriptMultiAgentGenerator();
