import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { SWOTAnalyzer, type SWOTInput } from '../../intelligence/swot-analyzer';

/**
 * SWOT Framework Executor
 * Analyzes Strengths, Weaknesses, Opportunities, and Threats
 */
export class SWOTExecutor implements FrameworkExecutor {
  name = 'swot' as const;
  private analyzer = new SWOTAnalyzer();

  async validate(context: StrategicContext) {
    return { 
      valid: !!context.userInput, 
      errors: context.userInput ? undefined : ['Business context required for SWOT analysis']
    };
  }

  async execute(context: StrategicContext): Promise<any> {
    console.log('[SWOT Executor] Starting SWOT analysis...');

    // Build the SWOT input from strategic context
    const swotInput: SWOTInput = {
      businessContext: context.userInput,
      // Include previous framework outputs if available
      ...(context.insights.bmcBlocks && { bmcOutput: context.insights.bmcBlocks }),
      ...(context.insights.portersForces && { portersOutput: context.insights.portersForces }),
      ...(context.insights.trendFactors && { pestleOutput: context.insights.trendFactors }),
    };

    try {
      console.log('[SWOT Executor] Building analysis context...');
      if (swotInput.bmcOutput) console.log('  - Including BMC insights');
      if (swotInput.portersOutput) console.log('  - Including Porter\'s Five Forces');
      if (swotInput.pestleOutput) console.log('  - Including PESTLE analysis');

      const swotOutput = await this.analyzer.analyze(swotInput);

      console.log('[SWOT Executor] SWOT analysis complete');
      console.log(`  Strengths: ${swotOutput.strengths?.length || 0}`);
      console.log(`  Weaknesses: ${swotOutput.weaknesses?.length || 0}`);
      console.log(`  Opportunities: ${swotOutput.opportunities?.length || 0}`);
      console.log(`  Threats: ${swotOutput.threats?.length || 0}`);
      console.log(`  Strategic Options: ${Object.values(swotOutput.strategicOptions || {}).flat().length}`);

      return {
        framework: 'swot',
        output: swotOutput,
        summary: {
          totalFactors: (swotOutput.strengths?.length || 0) + 
                       (swotOutput.weaknesses?.length || 0) + 
                       (swotOutput.opportunities?.length || 0) + 
                       (swotOutput.threats?.length || 0),
          strategicGroups: {
            offensive: swotOutput.strategicOptions?.soStrategies?.length || 0,
            defensive: swotOutput.strategicOptions?.stStrategies?.length || 0,
            adaptive: swotOutput.strategicOptions?.woStrategies?.length || 0,
            mitigation: swotOutput.strategicOptions?.wtStrategies?.length || 0,
          },
          analysisDepth: swotOutput.metadata?.analysisDepth,
          confidence: swotOutput.confidence,
        },
      };
    } catch (error) {
      console.error('[SWOT Executor] Analysis failed:', error);
      throw error;
    }
  }
}
