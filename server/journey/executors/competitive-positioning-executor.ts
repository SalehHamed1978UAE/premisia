import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { CompetitivePositioningAnalyzer, type CompetitivePositioningInput } from '../../intelligence/competitive-positioning-analyzer';

/**
 * Competitive Positioning Framework Executor
 * Analyzes market position relative to competitors
 */
export class CompetitivePositioningExecutor implements FrameworkExecutor {
  name = 'competitive_positioning' as const;
  private analyzer = new CompetitivePositioningAnalyzer();

  async validate(context: StrategicContext) {
    return { 
      valid: !!context.userInput, 
      errors: context.userInput ? undefined : ['Business context required for competitive positioning analysis']
    };
  }

  async execute(context: StrategicContext): Promise<any> {
    console.log('[Competitive Positioning Executor] Starting competitive positioning analysis...');

    // Build the input from strategic context
    const competitivePositioningInput: CompetitivePositioningInput = {
      businessContext: context.userInput,
      competitors: [], // Would be populated from context.insights if available
      targetMarket: 'Target Market', // Would be extracted from context if available
      ...(context.insights.bmcBlocks && { bmcOutput: context.insights.bmcBlocks }),
      ...(context.insights.portersForces && { portersOutput: context.insights.portersForces }),
    };

    try {
      console.log('[Competitive Positioning Executor] Building competitive analysis context...');
      if (competitivePositioningInput.bmcOutput) console.log('  - Including Business Model Canvas');
      if (competitivePositioningInput.portersOutput) console.log('  - Including Porter\'s Five Forces');

      const output = await this.analyzer.analyze(competitivePositioningInput);

      console.log('[Competitive Positioning Executor] Competitive positioning analysis complete');
      console.log(`  Positioning Axes: ${output.positioningMap?.length || 0}`);
      console.log(`  Differentiation Factors: ${output.differentationFactors?.length || 0}`);
      console.log(`  Competitive Advantages: ${output.competitiveAdvantages?.length || 0}`);
      console.log(`  Competitive Threats: ${output.competitiveThreats?.length || 0}`);

      return {
        framework: 'competitive_positioning',
        output,
        summary: {
          positioningAxes: output.positioningMap?.length || 0,
          differentiators: output.differentationFactors?.length || 0,
          advantages: output.competitiveAdvantages?.length || 0,
          threats: output.competitiveThreats?.length || 0,
          recommendedPosition: output.positioningRecommendation?.recommendedPosition,
          confidence: output.confidence,
        },
      };
    } catch (error) {
      console.error('[Competitive Positioning Executor] Analysis failed:', error);
      throw error;
    }
  }
}
