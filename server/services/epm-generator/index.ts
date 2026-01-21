/**
 * EPM Generator Router
 * 
 * Factory that returns the appropriate generator based on configuration.
 * Single point of control for switching between legacy and multi-agent implementations.
 * Includes automatic fallback logic when multi-agent service is unavailable.
 */

import type { IEPMGenerator, EPMGeneratorInput, EPMGeneratorOutput, EPMRouterOptions } from './types';
import { LegacyEPMGenerator } from './legacy-generator';
import { MultiAgentEPMGenerator } from './multi-agent-generator';

export * from './types';
export { LegacyEPMGenerator } from './legacy-generator';
export { MultiAgentEPMGenerator } from './multi-agent-generator';
export { createCFIntegration } from './cf-integration';

/**
 * EPM Generator Router
 * 
 * Manages generator selection and fallback behavior.
 */
export class EPMGeneratorRouter {
  private legacyGenerator: LegacyEPMGenerator;
  private multiAgentGenerator: MultiAgentEPMGenerator;

  constructor() {
    this.legacyGenerator = new LegacyEPMGenerator();
    this.multiAgentGenerator = new MultiAgentEPMGenerator();
  }

  /**
   * Get the active generator based on configuration.
   */
  getGenerator(options?: EPMRouterOptions): IEPMGenerator {
    if (options?.forceLegacy) {
      console.log('[EPMRouter] Forced to use Legacy Generator');
      return this.legacyGenerator;
    }

    if (options?.forceMultiAgent) {
      console.log('[EPMRouter] Forced to use Multi-Agent Generator');
      return this.multiAgentGenerator;
    }

    const useMultiAgent = process.env.USE_MULTI_AGENT_EPM === 'true';

    if (useMultiAgent) {
      console.log('[EPMRouter] Config: Using Multi-Agent Generator');
      return this.multiAgentGenerator;
    } else {
      console.log('[EPMRouter] Config: Using Legacy Generator');
      return this.legacyGenerator;
    }
  }

  /**
   * Generate EPM with automatic fallback.
   * 
   * If multi-agent is selected but fails, automatically falls back to legacy
   * when fallbackOnError is enabled (default: true based on EPM_FALLBACK_ON_ERROR env).
   */
  async generate(input: EPMGeneratorInput, options?: EPMRouterOptions): Promise<EPMGeneratorOutput> {
    const fallbackEnabled = options?.fallbackOnError ?? 
                           (process.env.EPM_FALLBACK_ON_ERROR !== 'false');
    
    const generator = this.getGenerator(options);
    
    // If using legacy or fallback is disabled, just run directly
    if (generator instanceof LegacyEPMGenerator || !fallbackEnabled) {
      return generator.generate(input);
    }

    // Multi-agent with fallback enabled - check health first
    const crewAIHealthy = await this.multiAgentGenerator.isHealthy();
    
    if (crewAIHealthy) {
      console.log('[EPM] Multi-agent system READY (7 agents on port 8001)');
    } else {
      console.warn('[EPM] Multi-agent UNAVAILABLE - using legacy generator');
      const fallbackResult = await this.legacyGenerator.generate(input);
      return {
        ...fallbackResult,
        metadata: {
          ...fallbackResult.metadata,
          generator: 'legacy',
          fallbackReason: 'CrewAI service not healthy',
        },
      } as EPMGeneratorOutput;
    }
    
    try {
      console.log('[EPMRouter] Attempting multi-agent generation...');
      return await generator.generate(input);
    } catch (error: any) {
      console.error('[EPMRouter] Multi-agent generation failed:', error.message);
      console.warn('[EPM] Multi-agent FAILED - falling back to legacy generator');
      
      const fallbackResult = await this.legacyGenerator.generate(input);
      
      // Mark that we fell back
      return {
        ...fallbackResult,
        metadata: {
          ...fallbackResult.metadata,
          generator: 'legacy',
          fallbackReason: error.message,
        },
      } as EPMGeneratorOutput;
    }
  }

  /**
   * Check health of multi-agent service
   */
  async checkMultiAgentHealth(): Promise<boolean> {
    return this.multiAgentGenerator.isHealthy();
  }

  /**
   * Get current configuration status
   */
  getStatus(): {
    useMultiAgent: boolean;
    fallbackEnabled: boolean;
    crewAIConfigured: boolean;
    cfIntegrationEnabled: boolean;
  } {
    return {
      useMultiAgent: process.env.USE_MULTI_AGENT_EPM === 'true',
      fallbackEnabled: process.env.EPM_FALLBACK_ON_ERROR !== 'false',
      crewAIConfigured: !!process.env.CREWAI_SERVICE_URL,
      cfIntegrationEnabled: process.env.CF_INTEGRATION_ENABLED === 'true',
    };
  }
}

// Singleton instance for convenience
let routerInstance: EPMGeneratorRouter | null = null;

export function getEPMRouter(): EPMGeneratorRouter {
  if (!routerInstance) {
    routerInstance = new EPMGeneratorRouter();
  }
  return routerInstance;
}

/**
 * Convenience function for one-off generation
 */
export async function generateEPM(
  input: EPMGeneratorInput, 
  options?: EPMRouterOptions
): Promise<EPMGeneratorOutput> {
  return getEPMRouter().generate(input, options);
}
