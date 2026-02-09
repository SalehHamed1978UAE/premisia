import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { VRIOAnalyzer, type VRIOInput } from '../../intelligence/vrio-analyzer';

/**
 * VRIO Framework Executor
 * Evaluates resources and capabilities against VRIO criteria (Valuable, Rare, Costly to Imitate, Organized)
 */
export class VRIOExecutor implements FrameworkExecutor {
  name = 'vrio' as const;
  private analyzer = new VRIOAnalyzer();

  async validate(context: StrategicContext) {
    return { 
      valid: !!context.userInput, 
      errors: context.userInput ? undefined : ['Business context required for VRIO resource evaluation']
    };
  }

  async execute(context: StrategicContext): Promise<any> {
    console.log('[VRIO Executor] Starting VRIO resource evaluation...');

    // Build the VRIO input from strategic context
    const vrioInput: VRIOInput = {
      businessContext: context.userInput,
      resources: [], // Would be extracted from context.insights if available
    };

    try {
      console.log('[VRIO Executor] Building resource evaluation context...');

      const output = await this.analyzer.analyze(vrioInput);

      console.log('[VRIO Executor] VRIO analysis complete');
      console.log(`  Resources Evaluated: ${output.evaluations?.length || 0}`);
      console.log(`  Sustained Advantage Resources: ${output.summary?.sustainedAdvantageResources?.length || 0}`);
      console.log(`  Temporary Advantage Resources: ${output.summary?.temporaryAdvantageResources?.length || 0}`);
      console.log(`  Parity Resources: ${output.summary?.parityResources?.length || 0}`);
      console.log(`  Disadvantage Resources: ${output.summary?.disadvantageResources?.length || 0}`);

      return {
        framework: 'vrio',
        output,
        summary: {
          resourcesEvaluated: output.evaluations?.length || 0,
          sustainedAdvantage: output.summary?.sustainedAdvantageResources?.length || 0,
          temporaryAdvantage: output.summary?.temporaryAdvantageResources?.length || 0,
          parity: output.summary?.parityResources?.length || 0,
          disadvantage: output.summary?.disadvantageResources?.length || 0,
          recommendations: output.strategicRecommendations?.length || 0,
          confidence: output.confidence,
        },
      };
    } catch (error) {
      console.error('[VRIO Executor] Analysis failed:', error);
      throw error;
    }
  }
}
