import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '../journey-types';
import { BMCResearcher } from '../../strategic-consultant/bmc-researcher';

/**
 * Business Model Canvas Framework Executor
 * Conducts comprehensive BMC research across all 9 building blocks
 */
export class BMCExecutor implements FrameworkExecutor {
  name = 'bmc' as const;
  private researcher = new BMCResearcher();

  async execute(context: StrategicContext): Promise<any> {
    console.log('[BMC Executor] Starting Business Model Canvas research...');
    
    // Extract BMC constraints from context (if provided by Five Whys)
    const constraints = context.insights.bmcDesignConstraints;
    
    if (constraints) {
      console.log('[BMC Executor] Using Five Whys constraints:', {
        problems: constraints.problemsToSolve.length,
        capabilities: constraints.mustHaveCapabilities.length,
        principles: constraints.designPrinciples.length,
      });
    }

    // Conduct BMC research
    const bmcResults = await this.researcher.conductBMCResearch(
      context.userInput,
      context.sessionId
    );
    
    console.log(`[BMC Executor] Completed - generated ${Object.keys(bmcResults.blocks || {}).length} blocks`);
    
    return bmcResults;
  }
}
