import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { AnsoffAnalyzer, type AnsoffInput } from '../../intelligence/ansoff-analyzer';

/**
 * Ansoff Matrix Framework Executor
 * Evaluates growth strategy options: Market Penetration, Market Development, Product Development, Diversification
 */
export class AnsoffExecutor implements FrameworkExecutor {
  name = 'ansoff' as const;
  private analyzer = new AnsoffAnalyzer();

  async validate(context: StrategicContext) {
    return { 
      valid: !!context.userInput, 
      errors: context.userInput ? undefined : ['Business context required for Ansoff Matrix analysis']
    };
  }

  async execute(context: StrategicContext): Promise<any> {
    console.log('[Ansoff Executor] Starting Ansoff Matrix growth strategy analysis...');

    // Build the Ansoff input from strategic context
    const ansoffInput: AnsoffInput = {
      businessContext: context.userInput,
      // Include previous framework outputs if available
      ...(context.insights.bmcBlocks && { bmcOutput: context.insights.bmcBlocks }),
      // If BMC has customer segments, extract as market info
      ...(context.insights.bmcBlocks?.['Customer Segments'] && {
        currentMarkets: Array.isArray(context.insights.bmcBlocks['Customer Segments'])
          ? context.insights.bmcBlocks['Customer Segments'].map((s: any) => s.segment || s)
          : [context.insights.bmcBlocks['Customer Segments']]
      }),
      // If BMC has products/services, extract as current offerings
      ...(context.insights.bmcBlocks?.['Value Propositions'] && {
        currentProducts: Array.isArray(context.insights.bmcBlocks['Value Propositions'])
          ? context.insights.bmcBlocks['Value Propositions'].map((p: any) => p.proposition || p)
          : [context.insights.bmcBlocks['Value Propositions']]
      }),
    };

    try {
      console.log('[Ansoff Executor] Building growth strategy context...');
      if (ansoffInput.bmcOutput) console.log('  - Including Business Model Canvas');
      if (ansoffInput.currentMarkets?.length) console.log(`  - Current markets: ${ansoffInput.currentMarkets.length}`);
      if (ansoffInput.currentProducts?.length) console.log(`  - Current products: ${ansoffInput.currentProducts.length}`);

      const ansoffOutput = await this.analyzer.analyze(ansoffInput);

      console.log('[Ansoff Executor] Ansoff Matrix analysis complete');
      console.log(`  Market Penetration Score: ${ansoffOutput.marketPenetration?.score}/10`);
      console.log(`  Market Development Score: ${ansoffOutput.marketDevelopment?.score}/10`);
      console.log(`  Product Development Score: ${ansoffOutput.productDevelopment?.score}/10`);
      console.log(`  Diversification Score: ${ansoffOutput.diversification?.score}/10`);
      console.log(`  Recommended: ${ansoffOutput.recommendation?.primaryStrategy}`);

      return {
        framework: 'ansoff',
        output: ansoffOutput,
        summary: {
          quadrants: {
            marketPenetration: {
              score: ansoffOutput.marketPenetration?.score || 0,
              riskLevel: this.scoreToRisk(ansoffOutput.marketPenetration?.score || 0),
              timeframe: ansoffOutput.marketPenetration?.timeframe,
            },
            marketDevelopment: {
              score: ansoffOutput.marketDevelopment?.score || 0,
              riskLevel: this.scoreToRisk(ansoffOutput.marketDevelopment?.score || 0),
              timeframe: ansoffOutput.marketDevelopment?.timeframe,
            },
            productDevelopment: {
              score: ansoffOutput.productDevelopment?.score || 0,
              riskLevel: this.scoreToRisk(ansoffOutput.productDevelopment?.score || 0),
              timeframe: ansoffOutput.productDevelopment?.timeframe,
            },
            diversification: {
              score: ansoffOutput.diversification?.score || 0,
              riskLevel: this.scoreToRisk(ansoffOutput.diversification?.score || 0),
              timeframe: ansoffOutput.diversification?.timeframe,
            },
          },
          recommendation: ansoffOutput.recommendation?.primaryStrategy,
          riskLevel: ansoffOutput.recommendation?.riskLevel,
          confidence: ansoffOutput.confidence,
        },
      };
    } catch (error) {
      console.error('[Ansoff Executor] Analysis failed:', error);
      throw error;
    }
  }

  private scoreToRisk(score: number): 'low' | 'medium' | 'high' {
    if (score >= 8) return 'low';
    if (score >= 5) return 'medium';
    return 'high';
  }
}
