/**
 * Multi-Agent EPM Generator
 * 
 * HTTP client for the CrewAI Python service.
 * Handles communication, timeouts, and health checks.
 * 
 * Uses shared CPM post-processing to apply Critical Path Method scheduling
 * to the agent-generated workstreams, ensuring mathematical rigor.
 */

import type { IEPMGenerator, EPMGeneratorInput, EPMGeneratorOutput } from './types';
import { createCFIntegration } from './cf-integration';
import { postProcessWithCPM } from './cpm-processor';

export class MultiAgentEPMGenerator implements IEPMGenerator {
  private serviceUrl: string;
  private timeout: number;

  constructor() {
    const serviceUrl = process.env.CREWAI_SERVICE_URL;
    if (!serviceUrl) {
      console.warn('[MultiAgentGenerator] CREWAI_SERVICE_URL not set - multi-agent generation will not be available');
    }
    this.serviceUrl = serviceUrl || '';
    this.timeout = 600000; // 10 minutes - multi-agent collaboration takes time
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
   * Generate EPM program using multi-agent collaboration
   */
  async generate(input: EPMGeneratorInput): Promise<EPMGeneratorOutput> {
    const startTime = Date.now();
    console.log('[MultiAgentGenerator] Starting multi-agent collaboration');
    console.log(`[MultiAgentGenerator] Service URL: ${this.serviceUrl}`);
    console.log(`[MultiAgentGenerator] Session: ${input.sessionId}`);

    // Check service health first
    const healthy = await this.isHealthy();
    if (!healthy) {
      throw new Error('CrewAI service is not available. Check if the Python service is running.');
    }

    try {
      const generateUrl = `${this.serviceUrl}/generate-program`;
      const timeoutSeconds = Math.round(this.timeout / 1000);
      
      console.log(`[MultiAgentGenerator] Initiating request to ${generateUrl}`);
      console.log(`[MultiAgentGenerator] Timeout configured: ${timeoutSeconds}s (${Math.round(timeoutSeconds / 60)}m)`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(`[MultiAgentGenerator] Timeout will trigger in 0s - aborting request after ${timeoutSeconds}s`);
        controller.abort();
      }, this.timeout);

      const response = await fetch(generateUrl, {
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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`CrewAI service error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
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
      const generateUrl = `${this.serviceUrl}/generate-program`;
      const errorType = error.name || typeof error;
      const errorMessage = error.message || String(error);
      
      if (error.name === 'AbortError') {
        console.error(`[MultiAgentGenerator] Request timed out after ${Math.round(this.timeout / 1000 / 60)} minutes`);
        console.error(`[MultiAgentGenerator] URL: ${generateUrl}`);
        throw new Error(`Multi-agent generation timed out after ${Math.round(this.timeout / 1000 / 60)} minutes`);
      }
      
      console.error('[MultiAgentGenerator] Generate request failed');
      console.error(`[MultiAgentGenerator] Error type: ${errorType}`);
      console.error(`[MultiAgentGenerator] Error message: ${errorMessage}`);
      console.error(`[MultiAgentGenerator] URL: ${generateUrl}`);
      
      // Log common error types for easier diagnosis
      if (errorType === 'TypeError') {
        if (errorMessage.includes('fetch')) {
          console.error('[MultiAgentGenerator] This appears to be a network connectivity issue');
        }
      }
      if (errorMessage.includes('ECONNREFUSED')) {
        console.error('[MultiAgentGenerator] Connection refused - service may not be running at the configured URL');
      }
      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
        console.error('[MultiAgentGenerator] DNS resolution failed - unable to reach the service host');
      }
      if (errorMessage.includes('ETIMEDOUT')) {
        console.error('[MultiAgentGenerator] Connection timed out - service is not responding');
      }
      
      throw error;
    }
  }
}
