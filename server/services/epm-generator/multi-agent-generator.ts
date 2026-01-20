/**
 * Multi-Agent EPM Generator
 * 
 * HTTP client for the CrewAI Python service.
 * Handles communication, timeouts, and health checks.
 */

import type { IEPMGenerator, EPMGeneratorInput, EPMGeneratorOutput } from './types';
import { createCFIntegration } from './cf-integration';

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
   * Check if the CrewAI service is available
   */
  async isHealthy(): Promise<boolean> {
    if (!this.serviceUrl) {
      console.error('[MultiAgentGenerator] CREWAI_SERVICE_URL not configured');
      return false;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.serviceUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('[MultiAgentGenerator] Health check failed:', error);
      return false;
    }
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.serviceUrl}/generate-program`, {
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
      if (error.name === 'AbortError') {
        throw new Error('Multi-agent generation timed out after 10 minutes');
      }
      throw error;
    }
  }
}
