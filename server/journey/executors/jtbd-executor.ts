import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { JTBDAnalyzer, type JTBDInput } from '../../intelligence/jtbd-analyzer';

/**
 * Jobs To Be Done (JTBD) Framework Executor
 * Analyzes customer motivations and the "jobs" customers are trying to accomplish
 */
export class JTBDExecutor implements FrameworkExecutor {
  name = 'jobs_to_be_done' as const;
  private analyzer = new JTBDAnalyzer();

  async validate(context: StrategicContext) {
    return { 
      valid: !!context.userInput, 
      errors: context.userInput ? undefined : ['Business context required for Jobs-To-Be-Done analysis']
    };
  }

  async execute(context: StrategicContext): Promise<any> {
    console.log('[JTBD Executor] Starting Jobs-To-Be-Done customer analysis...');

    // Extract target segments from BMC if available
    const targetSegments = this.extractTargetSegments(context);

    // Build the JTBD input from strategic context
    const jtbdInput: JTBDInput = {
      businessContext: context.userInput,
      ...(targetSegments && { targetSegments }),
      ...(context.insights.bmcBlocks && { bmcOutput: context.insights.bmcBlocks }),
    };

    try {
      console.log('[JTBD Executor] Building customer analysis context...');
      if (jtbdInput.bmcOutput) console.log('  - Including Business Model Canvas');
      if (jtbdInput.targetSegments?.length) console.log(`  - Analyzing ${jtbdInput.targetSegments.length} customer segments`);

      const jtbdOutput = await this.analyzer.analyze(jtbdInput);

      console.log('[JTBD Executor] Jobs-To-Be-Done analysis complete');
      console.log(`  Core Jobs: ${jtbdOutput.coreJobs?.length || 0}`);
      console.log(`  Related Jobs: ${jtbdOutput.relatedJobs?.length || 0}`);
      console.log(`  Underserved Jobs: ${jtbdOutput.opportunities?.underservedJobs?.length || 0}`);
      console.log(`  Top Opportunities: ${jtbdOutput.opportunities?.topOpportunities?.length || 0}`);

      return {
        framework: 'jtbd',
        output: jtbdOutput,
        summary: {
          totalJobs: (jtbdOutput.coreJobs?.length || 0) + (jtbdOutput.relatedJobs?.length || 0),
          coreJobs: jtbdOutput.coreJobs?.map(j => j.job) || [],
          opportunities: {
            underserved: jtbdOutput.opportunities?.underservedJobs?.length || 0,
            overserved: jtbdOutput.opportunities?.overservedJobs?.length || 0,
            top: jtbdOutput.opportunities?.topOpportunities?.length || 0,
            innovations: jtbdOutput.opportunities?.innovationDirections?.length || 0,
          },
          alignment: {
            wellAligned: jtbdOutput.valuePropositionAlignment?.wellAligned?.length || 0,
            gaps: jtbdOutput.valuePropositionAlignment?.gaps?.length || 0,
          },
          segmentsAnalyzed: jtbdOutput.metadata?.segmentsAnalyzed,
          confidence: jtbdOutput.confidence,
        },
      };
    } catch (error) {
      console.error('[JTBD Executor] Analysis failed:', error);
      throw error;
    }
  }

  private extractTargetSegments(context: StrategicContext): any[] | undefined {
    // Try to extract customer segments from BMC if available
    if (context.insights.bmcBlocks?.['Customer Segments']) {
      const segments = context.insights.bmcBlocks['Customer Segments'];
      if (Array.isArray(segments)) {
        return segments.map(s => typeof s === 'string' ? { segment: s } : s);
      } else if (typeof segments === 'string') {
        return [{ segment: segments }];
      }
    }
    return undefined;
  }
}
