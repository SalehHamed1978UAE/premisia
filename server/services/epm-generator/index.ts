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
import { TypeScriptMultiAgentGenerator } from './typescript-multi-agent-generator';

export * from './types';
export { LegacyEPMGenerator } from './legacy-generator';
export { MultiAgentEPMGenerator } from './multi-agent-generator';
export { TypeScriptMultiAgentGenerator } from './typescript-multi-agent-generator';
export { createCFIntegration } from './cf-integration';

/**
 * EPM Generator Router
 * 
 * Manages generator selection and fallback behavior.
 * Now supports TypeScript-native multi-agent generator (default) or legacy CrewAI HTTP client.
 */
export class EPMGeneratorRouter {
  private legacyGenerator: LegacyEPMGenerator;
  private multiAgentGenerator: MultiAgentEPMGenerator;
  private tsMultiAgentGenerator: TypeScriptMultiAgentGenerator;

  constructor() {
    this.legacyGenerator = new LegacyEPMGenerator();
    this.multiAgentGenerator = new MultiAgentEPMGenerator();
    this.tsMultiAgentGenerator = new TypeScriptMultiAgentGenerator();
  }

  /**
   * Get the active generator based on configuration.
   * 
   * Priority:
   * 1. forceLegacy option → Legacy Generator
   * 2. forceMultiAgent option → TypeScript Multi-Agent Generator
   * 3. USE_MULTI_AGENT_EPM=true → TypeScript Multi-Agent Generator
   * 4. USE_CREWAI_HTTP=true + USE_MULTI_AGENT_EPM=true → CrewAI HTTP client (deprecated)
   * 5. Default → Legacy Generator
   */
  getGenerator(options?: EPMRouterOptions): IEPMGenerator {
    if (options?.forceLegacy) {
      console.log('[EPMRouter] Forced to use Legacy Generator');
      return this.legacyGenerator;
    }

    if (options?.forceMultiAgent) {
      console.log('[EPMRouter] Forced to use TypeScript Multi-Agent Generator');
      return this.tsMultiAgentGenerator;
    }

    const useMultiAgent = process.env.USE_MULTI_AGENT_EPM === 'true';
    const useCrewAIHttp = process.env.USE_CREWAI_HTTP === 'true';

    if (useMultiAgent) {
      if (useCrewAIHttp) {
        console.log('[EPMRouter] Config: Using CrewAI HTTP Multi-Agent Generator (deprecated)');
        return this.multiAgentGenerator;
      }
      console.log('[EPMRouter] Config: Using TypeScript Multi-Agent Generator');
      return this.tsMultiAgentGenerator;
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
      return generator.generate(input, { onProgress: options?.onProgress });
    }

    // TypeScript multi-agent generator is always available (runs in-process)
    if (generator instanceof TypeScriptMultiAgentGenerator) {
      console.log('[EPM] TypeScript Multi-Agent system READY (7 agents, in-process)');
      try {
        console.log('[EPMRouter] Starting TypeScript multi-agent generation...');
        return await generator.generate(input, { onProgress: options?.onProgress });
      } catch (error: any) {
        console.error('[EPMRouter] TypeScript multi-agent generation failed:', error.message);
        if (fallbackEnabled) {
          console.warn('[EPM] TypeScript Multi-agent FAILED - falling back to legacy generator');
          const fallbackResult = await this.legacyGenerator.generate(input, { onProgress: options?.onProgress });
          return {
            ...fallbackResult,
            metadata: {
              ...fallbackResult.metadata,
              generator: 'legacy',
              fallbackReason: error.message,
            },
          } as EPMGeneratorOutput;
        }
        throw error;
      }
    }

    // CrewAI HTTP multi-agent - check health first
    const crewAIHealthy = await this.multiAgentGenerator.isHealthy();
    
    if (crewAIHealthy) {
      console.log('[EPM] CrewAI Multi-agent system READY (7 agents on port 8001)');
    } else {
      console.warn('[EPM] CrewAI Multi-agent UNAVAILABLE - using legacy generator');
      const fallbackResult = await this.legacyGenerator.generate(input, { onProgress: options?.onProgress });
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
      console.log('[EPMRouter] Attempting CrewAI multi-agent generation...');
      return await generator.generate(input, { onProgress: options?.onProgress });
    } catch (error: any) {
      console.error('[EPMRouter] CrewAI multi-agent generation failed:', error.message);
      console.warn('[EPM] CrewAI Multi-agent FAILED - falling back to legacy generator');
      
      const fallbackResult = await this.legacyGenerator.generate(input, { onProgress: options?.onProgress });
      
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
    useTypescriptGenerator: boolean;
    fallbackEnabled: boolean;
    crewAIConfigured: boolean;
    cfIntegrationEnabled: boolean;
  } {
    const useMultiAgent = process.env.USE_MULTI_AGENT_EPM === 'true';
    const useCrewAIHttp = process.env.USE_CREWAI_HTTP === 'true';
    return {
      useMultiAgent,
      useTypescriptGenerator: useMultiAgent && !useCrewAIHttp,
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
