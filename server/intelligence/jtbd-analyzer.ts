/**
 * Jobs To Be Done (JTBD) Analyzer
 * Analyzes customer motivations through the lens of "jobs" they're trying to accomplish
 */

import { aiClients } from '../ai-clients';

export interface JTBDInput {
  businessContext: string;
  targetSegments?: any[];
  bmcOutput?: any;
}

export interface JobDefinition {
  job: string;
  type: 'functional' | 'emotional' | 'social';
  context: string;
  desiredOutcome: string;
  currentSolution: string;
  painPoints: string[];
  importance: 'high' | 'medium' | 'low';
  frequency: 'daily' | 'weekly' | 'monthly' | 'occasionally';
}

export interface JTBDOutput {
  coreJobs: JobDefinition[];
  relatedJobs: JobDefinition[];
  opportunities: {
    underservedJobs: string[];
    overservedJobs: string[];
    topOpportunities: string[];
    innovationDirections: string[];
  };
  valuePropositionAlignment: {
    wellAligned: string[];
    gaps: string[];
    recommendations: string[];
  };
  priorityActions: string[];
  confidence: number;
  metadata: {
    segmentsAnalyzed: number;
    inputSources: string[];
    generatedAt: string;
  };
}

export class JTBDAnalyzer {
  async analyze(input: JTBDInput): Promise<JTBDOutput> {
    console.log('[JTBD Analyzer] Starting jobs-to-be-done analysis...');

    const contextParts: string[] = [input.businessContext];
    const inputSources: string[] = ['business_context'];
    let segmentsAnalyzed = 0;

    if (input.targetSegments?.length) {
      contextParts.push(`Target Segments: ${JSON.stringify(input.targetSegments)}`);
      inputSources.push('segments');
      segmentsAnalyzed = input.targetSegments.length;
    }

    if (input.bmcOutput) {
      contextParts.push(`Business Model Canvas: ${JSON.stringify(input.bmcOutput)}`);
      inputSources.push('bmc');
    }

    const prompt = `
Perform a Jobs-To-Be-Done analysis for this business:

${contextParts.join('\n\n')}

Identify and analyze the "jobs" customers are trying to accomplish:

1. CORE JOBS (3-5 primary jobs)
   For each job, provide:
   - The job statement: "When [situation], I want to [motivation], so I can [outcome]"
   - Type: functional (practical task), emotional (feeling), or social (perception by others)
   - Context: When/where does this job arise?
   - Desired outcome: What does success look like?
   - Current solution: How do customers currently solve this?
   - Pain points: What frustrations exist with current solutions?
   - Importance: high/medium/low
   - Frequency: daily/weekly/monthly/occasionally

2. RELATED JOBS (2-3 adjacent jobs)
   Jobs that often occur before, during, or after the core jobs

3. OPPORTUNITIES
   - Underserved jobs: Jobs not well addressed by current solutions
   - Overserved jobs: Jobs where solutions exceed needs (cost-cutting opportunity)
   - Top opportunities: Highest-value improvement areas
   - Innovation directions: New product/service possibilities

4. VALUE PROPOSITION ALIGNMENT
   - Well-aligned: Where the business already addresses jobs well
   - Gaps: Where the business doesn't address important jobs
   - Recommendations: How to better align with customer jobs

5. PRIORITY ACTIONS: Top 3-5 actions to better serve customer jobs

Return as JSON:
{
  "coreJobs": [{"job": "", "type": "functional|emotional|social", "context": "", "desiredOutcome": "", "currentSolution": "", "painPoints": [], "importance": "high", "frequency": "weekly"}],
  "relatedJobs": [],
  "opportunities": {"underservedJobs": [], "overservedJobs": [], "topOpportunities": [], "innovationDirections": []},
  "valuePropositionAlignment": {"wellAligned": [], "gaps": [], "recommendations": []},
  "priorityActions": []
}
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a Jobs-To-Be-Done expert. Analyze customer motivations and return valid JSON.',
        userMessage: prompt,
        maxTokens: 4000,
      });

      const result = JSON.parse(response.content);

      console.log('[JTBD Analyzer] Analysis complete');
      console.log(`  Core Jobs: ${result.coreJobs?.length || 0}`);
      console.log(`  Related Jobs: ${result.relatedJobs?.length || 0}`);

      return {
        ...result,
        confidence: this.calculateConfidence(result, inputSources),
        metadata: {
          segmentsAnalyzed,
          inputSources,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[JTBD Analyzer] Analysis failed:', error);
      throw error;
    }
  }

  private calculateConfidence(result: any, inputSources: string[]): number {
    let confidence = 0.6;
    confidence += inputSources.length * 0.05;

    if (result.coreJobs?.length >= 3) confidence += 0.1;
    if (result.opportunities?.topOpportunities?.length >= 2) confidence += 0.05;

    return Math.min(0.95, confidence);
  }
}

export const jtbdAnalyzer = new JTBDAnalyzer();
