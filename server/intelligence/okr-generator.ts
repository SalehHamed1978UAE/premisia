/**
 * OKR Generator
 * Generates measurable Objectives and Key Results aligned with strategic goals
 */

import { aiClients } from '../ai-clients';

export interface OKRGeneratorInput {
  businessContext: string;
  strategicGoals: string[];
  timeframe: string;
}

export interface KeyResult {
  text: string;
  metric: string;
  target: string;
  initiative?: string;
}

export interface OKR {
  objective: string;
  objectiveDescription: string;
  keyResults: KeyResult[];
  owner: string;
  timeline: string;
  priority: 'critical' | 'high' | 'medium';
  alignedWithGoal: string;
  successCriteria: string;
}

export interface OKRGeneratorOutput {
  okrs: OKR[];
  executiveSummary: string;
  alignmentMap: {
    strategicGoal: string;
    alignedOKRs: string[];
  }[];
  successMetrics: {
    metric: string;
    target: string;
    measurement: string;
  }[];
  implementation: {
    phase: string;
    focus: string;
    duration: string;
  }[];
  confidence: number;
  metadata: {
    okrsGenerated: number;
    timeframe: string;
    generatedAt: string;
  };
}

export class OKRGenerator {
  async generate(input: OKRGeneratorInput): Promise<OKRGeneratorOutput> {
    console.log('[OKR Generator] Starting OKR generation...');

    const prompt = `
Generate a comprehensive OKR (Objectives and Key Results) framework for this organization:

Business Context:
${input.businessContext}

Strategic Goals:
${input.strategicGoals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

Timeframe: ${input.timeframe}

Create a complete OKR framework with the following characteristics:

1. OBJECTIVES - Clear, inspirational statements of what to achieve
   - Should be qualitative and motivating
   - Aligned with the strategic goals

2. KEY RESULTS - Measurable outcomes that define success
   - Should be 3-5 per objective
   - Must be specific, measurable, and ambitious yet achievable
   - Should include: the metric, target value, and any supporting initiatives

3. OWNERSHIP - Suggest an owner or role for each OKR

4. TIMELINE - Specify the realistic timeline for achieving each OKR within the given timeframe

5. PRIORITY - Classify each OKR as critical, high, or medium priority

6. ALIGNMENT - Show how each OKR maps back to a strategic goal

7. SUCCESS CRITERIA - Define what complete success looks like for each OKR

Also provide:
- An executive summary of the OKR strategy
- An alignment map showing which OKRs support each strategic goal
- Key success metrics for measuring overall performance
- Implementation phases/waves for rolling out the OKRs

Return as JSON:
{
  "okrs": [
    {
      "objective": "",
      "objectiveDescription": "",
      "keyResults": [
        {
          "text": "",
          "metric": "",
          "target": "",
          "initiative": ""
        }
      ],
      "owner": "",
      "timeline": "",
      "priority": "critical|high|medium",
      "alignedWithGoal": "",
      "successCriteria": ""
    }
  ],
  "executiveSummary": "",
  "alignmentMap": [
    {
      "strategicGoal": "",
      "alignedOKRs": [""]
    }
  ],
  "successMetrics": [
    {
      "metric": "",
      "target": "",
      "measurement": ""
    }
  ],
  "implementation": [
    {
      "phase": "",
      "focus": "",
      "duration": ""
    }
  ]
}
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are an expert in OKR methodology and strategic goal-setting. Generate comprehensive, measurable OKRs that are ambitious yet achievable. Return only valid JSON.',
        userMessage: prompt,
        maxTokens: 5000,
      });

      const result = JSON.parse(response.content);

      console.log('[OKR Generator] OKR generation complete');
      console.log(`  OKRs generated: ${result.okrs?.length || 0}`);
      console.log(`  Implementation phases: ${result.implementation?.length || 0}`);

      return {
        okrs: result.okrs || [],
        executiveSummary: result.executiveSummary || '',
        alignmentMap: result.alignmentMap || [],
        successMetrics: result.successMetrics || [],
        implementation: result.implementation || [],
        confidence: this.calculateConfidence(result, input.strategicGoals.length),
        metadata: {
          okrsGenerated: result.okrs?.length || 0,
          timeframe: input.timeframe,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[OKR Generator] OKR generation failed:', error);
      throw error;
    }
  }

  private calculateConfidence(result: any, goalCount: number): number {
    let confidence = 0.65;

    const okrCount = result.okrs?.length || 0;
    if (okrCount >= goalCount * 1.5) confidence += 0.15;
    else if (okrCount >= goalCount) confidence += 0.1;

    const allOKRsComplete = result.okrs?.every((o: OKR) =>
      o.objective && o.keyResults?.length >= 3 && o.owner && o.priority
    ) ?? false;
    if (allOKRsComplete) confidence += 0.1;

    const avgKeyResultsPerOKR = okrCount > 0
      ? result.okrs.reduce((sum: number, o: OKR) => sum + (o.keyResults?.length || 0), 0) / okrCount
      : 0;
    if (avgKeyResultsPerOKR >= 3) confidence += 0.05;

    if (result.executiveSummary && result.alignmentMap?.length > 0) confidence += 0.05;

    return Math.min(0.95, confidence);
  }
}

export const okrGenerator = new OKRGenerator();
