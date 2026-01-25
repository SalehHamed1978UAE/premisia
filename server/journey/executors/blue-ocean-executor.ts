import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { BlueOceanAnalyzer, type BlueOceanInput } from '../../intelligence/blue-ocean-analyzer';

/**
 * Blue Ocean Framework Executor
 * Applies Blue Ocean Strategy to identify uncontested market space
 */
export class BlueOceanExecutor implements FrameworkExecutor {
  name = 'blue_ocean' as const;
  private analyzer = new BlueOceanAnalyzer();

  async validate(context: StrategicContext) {
    return { 
      valid: !!context.userInput, 
      errors: context.userInput ? undefined : ['Business context required for Blue Ocean analysis']
    };
  }

  async execute(context: StrategicContext): Promise<any> {
    console.log('[Blue Ocean Executor] Starting Blue Ocean strategy analysis...');

    // Build the Blue Ocean input from strategic context
    const blueOceanInput: BlueOceanInput = {
      businessContext: context.userInput,
      industry: 'Industry', // Would be extracted from context if available
      currentOffering: [], // Would be extracted from BMC if available
      ...(context.insights.bmcBlocks && { swotOutput: context.insights.bmcBlocks }),
      ...(context.insights.portersForces && { portersOutput: context.insights.portersForces }),
      ...(context.insights.competitivePressures && { competitorsData: context.insights.competitivePressures }),
    };

    try {
      console.log('[Blue Ocean Executor] Building Blue Ocean analysis context...');
      if (blueOceanInput.swotOutput) console.log('  - Including SWOT analysis');
      if (blueOceanInput.portersOutput) console.log('  - Including Porter\'s Five Forces');
      if (blueOceanInput.competitorsData) console.log('  - Including competitor data');

      const output = await this.analyzer.analyze(blueOceanInput);

      console.log('[Blue Ocean Executor] Blue Ocean analysis complete');
      console.log(`  ERRC Grid Factors: ${(output.ercGrid?.eliminate?.length || 0) + (output.ercGrid?.reduce?.length || 0) + (output.ercGrid?.raise?.length || 0) + (output.ercGrid?.create?.length || 0)}`);
      console.log(`  Blue Ocean Opportunities: ${output.blueOceanOpportunities?.length || 0}`);
      console.log(`  Priority Actions: ${output.priorityActions?.length || 0}`);

      return {
        framework: 'blue_ocean',
        output,
        summary: {
          eliminateFactors: output.ercGrid?.eliminate?.length || 0,
          reduceFactors: output.ercGrid?.reduce?.length || 0,
          raiseFactors: output.ercGrid?.raise?.length || 0,
          createFactors: output.ercGrid?.create?.length || 0,
          opportunities: output.blueOceanOpportunities?.length || 0,
          newValueCurve: output.innovationStrategy?.newValueCurve,
          confidence: output.confidence,
        },
      };
    } catch (error) {
      console.error('[Blue Ocean Executor] Analysis failed:', error);
      throw error;
    }
  }
}
