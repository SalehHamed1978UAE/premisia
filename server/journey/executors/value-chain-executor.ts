import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { ValueChainAnalyzer, type ValueChainInput } from '../../intelligence/value-chain-analyzer';

/**
 * Value Chain Framework Executor
 * Analyzes Porter's Value Chain to identify sources of competitive advantage
 */
export class ValueChainExecutor implements FrameworkExecutor {
  name = 'value_chain' as const;
  private analyzer = new ValueChainAnalyzer();

  async validate(context: StrategicContext) {
    return { 
      valid: !!context.userInput, 
      errors: context.userInput ? undefined : ['Business context required for Value Chain analysis']
    };
  }

  async execute(context: StrategicContext): Promise<any> {
    console.log('[Value Chain Executor] Starting Value Chain analysis...');

    // Build the Value Chain input from strategic context
    const valueChainInput: ValueChainInput = {
      businessContext: context.userInput,
      industry: 'Industry', // Would be extracted from context if available
      ...(context.insights.portersForces && { portersOutput: context.insights.portersForces }),
      ...(context.insights.keyOpportunities && { competitivePositionData: context.insights.keyOpportunities }),
      ...(context.insights.bmcBlocks && { operationsData: context.insights.bmcBlocks }),
    };

    try {
      console.log('[Value Chain Executor] Building value chain analysis context...');
      if (valueChainInput.portersOutput) console.log('  - Including Porter\'s Five Forces');
      if (valueChainInput.competitivePositionData) console.log('  - Including competitive position data');
      if (valueChainInput.operationsData) console.log('  - Including operations data');

      const output = await this.analyzer.analyze(valueChainInput);

      console.log('[Value Chain Executor] Value Chain analysis complete');
      console.log(`  Primary Activities Analyzed: 5`);
      console.log(`  Support Activities Analyzed: 4`);
      console.log(`  Value Drivers: ${output.valueDrivers?.length || 0}`);
      console.log(`  Cost Drivers: ${output.costDrivers?.length || 0}`);
      console.log(`  Competitive Advantages: ${output.competitiveAdvantages?.length || 0}`);

      return {
        framework: 'value_chain',
        output,
        summary: {
          primaryActivitiesScore: output.primaryActivities?.summary?.valueCreationScore,
          supportActivitiesScore: output.supportActivities?.summary?.valueCreationScore,
          valueDrivers: output.valueDrivers?.length || 0,
          costDrivers: output.costDrivers?.length || 0,
          competitiveAdvantages: output.competitiveAdvantages?.length || 0,
          linkages: output.linkages?.length || 0,
          strategicOpportunities: output.strategicOpportunities?.length || 0,
          confidence: output.confidence,
        },
      };
    } catch (error) {
      console.error('[Value Chain Executor] Analysis failed:', error);
      throw error;
    }
  }
}
