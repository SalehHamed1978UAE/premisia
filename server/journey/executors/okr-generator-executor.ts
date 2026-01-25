import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { OKRGenerator, type OKRGeneratorInput } from '../../intelligence/okr-generator';

/**
 * OKR Generator Framework Executor
 * Generates measurable Objectives and Key Results aligned with strategic goals
 */
export class OKRGeneratorExecutor implements FrameworkExecutor {
  name = 'okr_generator' as const;
  private generator = new OKRGenerator();

  async validate(context: StrategicContext) {
    return { 
      valid: !!context.userInput, 
      errors: context.userInput ? undefined : ['Business context required for OKR generation']
    };
  }

  async execute(context: StrategicContext): Promise<any> {
    console.log('[OKR Generator Executor] Starting OKR generation...');

    // Build the OKR Generator input from strategic context
    const okrGeneratorInput: OKRGeneratorInput = {
      businessContext: context.userInput,
      strategicGoals: context.insights.keyOpportunities || [], // Would be extracted from previous frameworks
      timeframe: '12 months', // Would be extracted from context if available
    };

    try {
      console.log('[OKR Generator Executor] Building OKR generation context...');
      console.log(`  Strategic Goals: ${okrGeneratorInput.strategicGoals.length}`);
      console.log(`  Timeframe: ${okrGeneratorInput.timeframe}`);

      const output = await this.generator.generate(okrGeneratorInput);

      console.log('[OKR Generator Executor] OKR generation complete');
      console.log(`  OKRs Generated: ${output.okrs?.length || 0}`);
      console.log(`  Total Key Results: ${output.okrs?.reduce((sum, okr) => sum + (okr.keyResults?.length || 0), 0) || 0}`);
      console.log(`  Critical Priority OKRs: ${output.okrs?.filter(o => o.priority === 'critical').length || 0}`);
      console.log(`  Implementation Phases: ${output.implementation?.length || 0}`);

      return {
        framework: 'okr_generator',
        output,
        summary: {
          okrsGenerated: output.okrs?.length || 0,
          totalKeyResults: output.okrs?.reduce((sum, okr) => sum + (okr.keyResults?.length || 0), 0) || 0,
          criticalOKRs: output.okrs?.filter(o => o.priority === 'critical').length || 0,
          highPriorityOKRs: output.okrs?.filter(o => o.priority === 'high').length || 0,
          implementationPhases: output.implementation?.length || 0,
          alignmentGoals: output.alignmentMap?.length || 0,
          successMetrics: output.successMetrics?.length || 0,
          confidence: output.confidence,
        },
      };
    } catch (error) {
      console.error('[OKR Generator Executor] Generation failed:', error);
      throw error;
    }
  }
}
