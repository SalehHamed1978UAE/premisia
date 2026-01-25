import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { OceanStrategyAnalyzer } from '../../intelligence/ocean-strategy-analyzer';

/**
 * Ocean Strategy Mapping Executor
 * Analyzes all four ocean strategies (Red, Blue, Green, White)
 * and recommends the optimal approach for the business
 */
export class OceanStrategyExecutor implements FrameworkExecutor {
  name = 'ocean_strategy' as const;
  private analyzer = new OceanStrategyAnalyzer();

  async validate(context: StrategicContext) {
    return {
      valid: !!context.userInput,
      errors: context.userInput ? undefined : ['Business context is required'],
    };
  }

  async execute(context: StrategicContext): Promise<any> {
    console.log('[OceanStrategy Executor] Starting Ocean Strategy analysis...');

    const insights = (context.insights || {}) as Record<string, any>;

    const input = {
      businessContext: context.userInput,
      industry: this.extractIndustry(context),
      currentMarketPosition: this.extractMarketPosition(insights),
      competitiveLandscape: this.extractCompetitiveLandscape(insights),
      sustainabilityGoals: this.extractSustainabilityGoals(insights),
      blueOceanOutput: insights.blue_ocean,
      swotOutput: insights.swot,
      portersOutput: insights.porters,
    };

    const result = await this.analyzer.analyze(input);

    console.log('[OceanStrategy Executor] Analysis complete');
    console.log(`  Recommended: ${result.recommendedOcean?.ocean} ocean`);
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);

    return {
      ...result,
      summary: {
        currentOcean: result.currentOcean?.ocean,
        recommendedOcean: result.recommendedOcean?.ocean,
        assessmentCount: result.oceanAssessments?.length || 0,
        hasHybridStrategy: !!result.hybridStrategy,
        roadmapPhases: result.implementationRoadmap?.length || 0,
        priorityActionCount: result.priorityActions?.length || 0,
      },
    };
  }

  private extractIndustry(context: StrategicContext): string {
    const insights = (context.insights || {}) as Record<string, any>;
    if (insights.bmc?.metadata?.industryAnalyzed) {
      return insights.bmc.metadata.industryAnalyzed;
    }
    if (insights.porters?.metadata?.industryAnalyzed) {
      return insights.porters.metadata.industryAnalyzed;
    }
    const industryMatch = context.userInput.match(/(?:industry|sector|market)[:\s]+([^.,\n]+)/i);
    return industryMatch?.[1]?.trim() || 'General business';
  }

  private extractMarketPosition(insights: any): string | undefined {
    if (insights.competitive_positioning) {
      return JSON.stringify({
        position: insights.competitive_positioning.positioningRecommendation,
        advantages: insights.competitive_positioning.competitiveAdvantages,
      });
    }
    if (insights.swot?.strengths) {
      return `Strengths: ${insights.swot.strengths.slice(0, 3).map((s: any) => s.factor).join(', ')}`;
    }
    return undefined;
  }

  private extractCompetitiveLandscape(insights: any): string | undefined {
    if (insights.porters) {
      return JSON.stringify({
        rivalry: insights.porters.competitiveRivalry?.score,
        newEntrants: insights.porters.threatOfNewEntrants?.score,
        attractiveness: insights.porters.overallAttractiveness?.score,
      });
    }
    return undefined;
  }

  private extractSustainabilityGoals(insights: any): string | undefined {
    if (insights.pestle?.environmental) {
      return `Environmental factors: ${JSON.stringify(insights.pestle.environmental)}`;
    }
    return undefined;
  }
}
