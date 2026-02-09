import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { BCGMatrixAnalyzer, type BCGMatrixInput } from '../../intelligence/bcg-matrix-analyzer';

/**
 * BCG Matrix Framework Executor
 * Classifies products/business units using the Boston Consulting Group matrix
 */
export class BCGMatrixExecutor implements FrameworkExecutor {
  name = 'bcg_matrix' as const;
  private analyzer = new BCGMatrixAnalyzer();

  async validate(context: StrategicContext) {
    return { 
      valid: !!context.userInput, 
      errors: context.userInput ? undefined : ['Business context required for BCG Matrix analysis']
    };
  }

  async execute(context: StrategicContext): Promise<any> {
    console.log('[BCG Matrix Executor] Starting BCG Matrix portfolio analysis...');

    // Build the BCG Matrix input from strategic context
    const bcgMatrixInput: BCGMatrixInput = {
      businessContext: context.userInput,
      products: [], // Would be extracted from context if available
      ...(context.insights.trendFactors && { industryData: context.insights.trendFactors }),
      ...(context.insights.portersForces && { portersOutput: context.insights.portersForces }),
      ...(context.insights.keyOpportunities && { ansoffOutput: { growthOpportunities: context.insights.keyOpportunities } }),
    };

    try {
      console.log('[BCG Matrix Executor] Building portfolio analysis context...');
      if (bcgMatrixInput.industryData) console.log('  - Including industry data');
      if (bcgMatrixInput.portersOutput) console.log('  - Including Porter\'s Five Forces');
      if (bcgMatrixInput.ansoffOutput) console.log('  - Including Ansoff growth options');

      const output = await this.analyzer.analyze(bcgMatrixInput);

      console.log('[BCG Matrix Executor] BCG Matrix analysis complete');
      console.log(`  Star Units: ${output.stars?.count || 0}`);
      console.log(`  Cash Cow Units: ${output.cashCows?.count || 0}`);
      console.log(`  Question Mark Units: ${output.questionMarks?.count || 0}`);
      console.log(`  Dog Units: ${output.dogs?.count || 0}`);
      console.log(`  Portfolio Balance: ${output.portfolioBalance?.healthAssessment}`);

      return {
        framework: 'bcg_matrix',
        output,
        summary: {
          stars: output.stars?.count || 0,
          cashCows: output.cashCows?.count || 0,
          questionMarks: output.questionMarks?.count || 0,
          dogs: output.dogs?.count || 0,
          portfolioHealth: output.portfolioBalance?.healthAssessment,
          shortTermActions: output.portfolioStrategy?.shortTermActions?.length || 0,
          confidence: output.confidence,
        },
      };
    } catch (error) {
      console.error('[BCG Matrix Executor] Analysis failed:', error);
      throw error;
    }
  }
}
