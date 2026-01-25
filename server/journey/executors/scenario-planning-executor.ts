import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { ScenarioPlanningAnalyzer, type ScenarioPlanningInput } from '../../intelligence/scenario-planning-analyzer';

/**
 * Scenario Planning Framework Executor
 * Generates plausible future business scenarios based on uncertainties
 */
export class ScenarioPlanningExecutor implements FrameworkExecutor {
  name = 'scenario_planning' as const;
  private analyzer = new ScenarioPlanningAnalyzer();

  async validate(context: StrategicContext) {
    return { 
      valid: !!context.userInput, 
      errors: context.userInput ? undefined : ['Business context required for scenario planning']
    };
  }

  async execute(context: StrategicContext): Promise<any> {
    console.log('[Scenario Planning Executor] Starting scenario planning analysis...');

    // Build the Scenario Planning input from strategic context
    const scenarioPlanningInput: ScenarioPlanningInput = {
      businessContext: context.userInput,
      timeHorizon: '3-5 years', // Would be extracted from context if available
      uncertainties: context.insights.externalForces || [], // Would be extracted from PESTLE or previous frameworks
    };

    try {
      console.log('[Scenario Planning Executor] Building scenario analysis context...');
      console.log(`  Time Horizon: ${scenarioPlanningInput.timeHorizon}`);
      console.log(`  Key Uncertainties: ${scenarioPlanningInput.uncertainties.length}`);

      const output = await this.analyzer.analyze(scenarioPlanningInput);

      console.log('[Scenario Planning Executor] Scenario planning analysis complete');
      console.log(`  Scenarios Generated: ${output.scenarios?.length || 0}`);
      console.log(`  Critical Uncertainties: ${output.criticalUncertainties?.length || 0}`);
      console.log(`  Robust Strategies: ${output.robustStrategies?.length || 0}`);
      console.log(`  Strategic Options: ${output.strategicOptions?.length || 0}`);

      return {
        framework: 'scenario_planning',
        output,
        summary: {
          scenarios: output.scenarios?.length || 0,
          timeHorizon: scenarioPlanningInput.timeHorizon,
          criticalUncertainties: output.criticalUncertainties?.length || 0,
          robustStrategies: output.robustStrategies?.length || 0,
          strategicOptions: output.strategicOptions?.length || 0,
          scenarioNames: output.scenarios?.map(s => s.name) || [],
          confidence: output.confidence,
        },
      };
    } catch (error) {
      console.error('[Scenario Planning Executor] Analysis failed:', error);
      throw error;
    }
  }
}
