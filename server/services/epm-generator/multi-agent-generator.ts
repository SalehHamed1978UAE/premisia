/**
 * Multi-Agent EPM Generator
 * 
 * HTTP client for the CrewAI Python service.
 * Handles communication, timeouts, and health checks.
 * 
 * Uses shared CPM post-processing to apply Critical Path Method scheduling
 * to the agent-generated workstreams, ensuring mathematical rigor.
 */

import type { IEPMGenerator, EPMGeneratorInput, EPMGeneratorOutput, GenerateOptions, GenerationProgress } from './types';
import { createCFIntegration } from './cf-integration';
import { postProcessWithCPM } from './cpm-processor';

export class MultiAgentEPMGenerator implements IEPMGenerator {
  private serviceUrl: string;
  private jobPollInterval: number;
  private maxJobDuration: number;

  constructor() {
    const serviceUrl = process.env.CREWAI_SERVICE_URL;
    if (!serviceUrl) {
      console.warn('[MultiAgentGenerator] CREWAI_SERVICE_URL not set - multi-agent generation will not be available');
    }
    this.serviceUrl = serviceUrl || '';
    this.jobPollInterval = 5000; // Poll every 5 seconds
    this.maxJobDuration = 3600000; // 60 minutes max for multi-agent (7 rounds × ~5 min each)
  }

  /**
   * Check if the CrewAI service is available with retry logic
   */
  async isHealthy(): Promise<boolean> {
    if (!this.serviceUrl) {
      console.error('[MultiAgentGenerator] CREWAI_SERVICE_URL not configured');
      return false;
    }
    
    const maxRetries = 3;
    const retryDelayMs = 1000;
    const healthCheckUrl = `${this.serviceUrl}/health`;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(healthCheckUrl, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log('[MultiAgentGenerator] Health check succeeded');
          return true;
        }
        
        console.warn(`[MultiAgentGenerator] Health check attempt ${attempt}/${maxRetries} failed with status ${response.status} ${response.statusText}`);
      } catch (error: any) {
        const errorType = error.name || 'Unknown';
        const errorMessage = error.message || String(error);
        
        console.warn(`[MultiAgentGenerator] Health check attempt ${attempt}/${maxRetries} failed (${errorType}): ${errorMessage}`);
        
        if (attempt < maxRetries) {
          console.log(`[MultiAgentGenerator] Waiting ${retryDelayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      }
    }
    
    console.error('[MultiAgentGenerator] Health check failed after all 3 attempts');
    return false;
  }

  /**
   * Generate EPM program using multi-agent collaboration with async job pattern.
   * 
   * Uses the new async pattern:
   * 1. POST /start-job to begin generation, returns jobId immediately
   * 2. Poll /job-status/{jobId} for progress updates
   * 3. Fetch result from /job-result/{jobId} when complete
   */
  async generate(input: EPMGeneratorInput, options?: GenerateOptions): Promise<EPMGeneratorOutput> {
    const startTime = Date.now();
    console.log('[MultiAgentGenerator] Starting multi-agent collaboration (async pattern)');
    console.log(`[MultiAgentGenerator] Service URL: ${this.serviceUrl}`);
    console.log(`[MultiAgentGenerator] Session: ${input.sessionId}`);
    console.log(`[MultiAgentGenerator] Max duration: ${Math.round(this.maxJobDuration / 60000)} minutes`);

    // Check service health first
    const healthy = await this.isHealthy();
    if (!healthy) {
      throw new Error('CrewAI service is not available. Check if the Python service is running.');
    }

    try {
      // Step 1: Start the async job
      const startJobUrl = `${this.serviceUrl}/start-job`;
      console.log(`[MultiAgentGenerator] Starting async job via ${startJobUrl}`);

      const startResponse = await fetch(startJobUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_context: {
            name: input.businessContext.name,
            type: input.businessContext.type,
            scale: input.businessContext.scale,
            description: input.businessContext.description,
            industry: input.businessContext.industry,
            keywords: input.businessContext.keywords,
          },
          bmc_insights: input.bmcInsights,
          strategy_insights: input.strategyInsights,
          constraints: input.constraints ? {
            budget: input.constraints.budget,
            deadline: input.constraints.deadline?.toISOString(),
            regulations: input.constraints.regulations,
            resource_limits: input.constraints.resourceLimits,
          } : null,
          user_id: input.userId,
          session_id: input.sessionId,
          journey_type: input.journeyType,
        }),
      });

      if (!startResponse.ok) {
        const errorText = await startResponse.text();
        throw new Error(`Failed to start job: ${startResponse.status} - ${errorText}`);
      }

      const { jobId } = await startResponse.json();
      console.log(`[MultiAgentGenerator] Job started with ID: ${jobId}`);

      // Step 2: Poll for job completion
      const statusUrl = `${this.serviceUrl}/job-status/${jobId}`;
      const deadline = Date.now() + this.maxJobDuration;
      let lastProgress = 0;
      let lastRound = 0;

      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, this.jobPollInterval));

        try {
          const statusResponse = await fetch(statusUrl);
          
          if (!statusResponse.ok) {
            console.warn(`[MultiAgentGenerator] Status check failed: ${statusResponse.status}`);
            continue;
          }

          const status = await statusResponse.json();
          
          // Log progress changes and call callback
          if (status.progress !== lastProgress || status.currentRound !== lastRound) {
            console.log(`[MultiAgentGenerator] Progress: ${status.progress}% | Round: ${status.currentRound || 0}/7 | ${status.message || ''}`);
            lastProgress = status.progress;
            lastRound = status.currentRound || 0;
            
            // Call progress callback if provided
            if (options?.onProgress) {
              const progress: GenerationProgress = {
                round: status.currentRound || 0,
                totalRounds: 7,
                currentAgent: status.message?.includes(':') ? status.message.split(':')[1]?.trim() || '' : '',
                message: status.message || '',
                percentComplete: status.progress || 0,
              };
              try {
                options.onProgress(progress);
              } catch (e) {
                console.warn('[MultiAgentGenerator] Progress callback error:', e);
              }
            }
          }

          if (status.status === 'completed') {
            console.log('[MultiAgentGenerator] Job completed successfully');
            break;
          }

          if (status.status === 'failed') {
            throw new Error(`Job failed: ${status.error || 'Unknown error'}`);
          }
        } catch (pollError: any) {
          if (pollError.message?.includes('Job failed')) {
            throw pollError;
          }
          console.warn(`[MultiAgentGenerator] Poll error (will retry): ${pollError.message}`);
        }
      }

      // Check if we timed out
      if (Date.now() >= deadline) {
        throw new Error(`Multi-agent generation timed out after ${Math.round(this.maxJobDuration / 60000)} minutes`);
      }

      // Step 3: Fetch the result
      const resultUrl = `${this.serviceUrl}/job-result/${jobId}`;
      console.log(`[MultiAgentGenerator] Fetching result from ${resultUrl}`);

      const resultResponse = await fetch(resultUrl);
      
      if (!resultResponse.ok) {
        const errorText = await resultResponse.text();
        throw new Error(`Failed to fetch result: ${resultResponse.status} - ${errorText}`);
      }

      const result = await resultResponse.json();
      const generationTime = Date.now() - startTime;

      console.log('[MultiAgentGenerator] Generation complete');
      console.log(`[MultiAgentGenerator] Rounds completed: ${result.metadata?.roundsCompleted || 'unknown'}`);
      console.log(`[MultiAgentGenerator] Agents participated: ${result.metadata?.agentsParticipated || 'unknown'}`);
      console.log(`[MultiAgentGenerator] Generation time: ${(generationTime / 1000).toFixed(1)}s`);

      // Apply CPM post-processing to add mathematical scheduling rigor
      if (result.program) {
        console.log('[MultiAgentGenerator] Applying CPM post-processing...');
        result.program = postProcessWithCPM(result.program);
      }

      // Process knowledge ledger through CF integration
      if (result.knowledgeLedger) {
        const cfHook = createCFIntegration();
        
        // Send individual emissions
        for (const emission of result.knowledgeLedger.emissions || []) {
          await cfHook.onKnowledgeEmission(emission);
        }
        
        // Send complete ledger
        await cfHook.onLedgerComplete(result.knowledgeLedger);
        
        console.log(`[MultiAgentGenerator] Knowledge emissions: ${result.knowledgeLedger.stats?.emitted || 0}`);
      }

      // Ensure metadata includes generation time
      return {
        ...result,
        metadata: {
          ...result.metadata,
          generator: 'multi-agent' as const,
          generationTimeMs: generationTime,
        },
      };

    } catch (error: any) {
      const errorType = error.name || typeof error;
      const errorMessage = error.message || String(error);
      
      console.error('[MultiAgentGenerator] Generate request failed');
      console.error(`[MultiAgentGenerator] Error type: ${errorType}`);
      console.error(`[MultiAgentGenerator] Error message: ${errorMessage}`);
      
      if (errorMessage.includes('ECONNREFUSED')) {
        console.error('[MultiAgentGenerator] Connection refused - service may not be running');
      }
      
      throw error;
    }
  }
}
