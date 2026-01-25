/**
 * VRIO Analyzer
 * Evaluates resources and capabilities against VRIO criteria:
 * Valuable, Rare, Costly to Imitate, Organized to Capture
 */

import { aiClients } from '../ai-clients';

export interface VRIOInput {
  businessContext: string;
  resources: string[];
}

export interface VRIOResourceEvaluation {
  resource: string;
  description: string;
  valuable: boolean;
  rare: boolean;
  costlyToImitate: boolean;
  organizedToCapture: boolean;
  competitiveImplication: 'sustained-advantage' | 'temporary-advantage' | 'parity' | 'disadvantage';
  reasoning: string;
}

export interface VRIOOutput {
  evaluations: VRIOResourceEvaluation[];
  summary: {
    sustainedAdvantageResources: string[];
    temporaryAdvantageResources: string[];
    parityResources: string[];
    disadvantageResources: string[];
  };
  strategicRecommendations: string[];
  confidence: number;
  metadata: {
    resourcesEvaluated: number;
    generatedAt: string;
  };
}

export class VRIOAnalyzer {
  async analyze(input: VRIOInput): Promise<VRIOOutput> {
    console.log('[VRIO Analyzer] Starting resource evaluation...');

    const prompt = `
Perform a comprehensive VRIO analysis for this business and its resources/capabilities:

Business Context:
${input.businessContext}

Resources/Capabilities to Evaluate:
${input.resources.map((r, i) => `${i + 1}. ${r}`).join('\n')}

For each resource, evaluate it against the VRIO criteria:

1. VALUABLE - Does the resource help the company exploit opportunities or neutralize threats?
2. RARE - Is the resource uncommon among current and potential competitors?
3. COSTLY TO IMITATE - Would it be difficult and expensive for competitors to develop or acquire this resource?
4. ORGANIZED TO CAPTURE VALUE - Does the company have the organizational systems and processes to fully utilize this resource?

Based on the VRIO evaluation, each resource will have a competitive implication:
- If all 4 criteria are YES → Sustained Competitive Advantage
- If first 3 criteria are YES but not organized → Temporary Competitive Advantage
- If only some criteria are YES → Competitive Parity
- If most criteria are NO → Competitive Disadvantage

Provide detailed reasoning for each evaluation. Consider the business context when assessing each resource.

Return as JSON:
{
  "evaluations": [
    {
      "resource": "",
      "description": "",
      "valuable": true/false,
      "rare": true/false,
      "costlyToImitate": true/false,
      "organizedToCapture": true/false,
      "competitiveImplication": "sustained-advantage|temporary-advantage|parity|disadvantage",
      "reasoning": ""
    }
  ],
  "strategicRecommendations": [""]
}
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a strategic resource analyst specializing in VRIO analysis. Evaluate resources comprehensively and return only valid JSON.',
        userMessage: prompt,
        maxTokens: 4000,
      });

      const result = JSON.parse(response.content);

      console.log('[VRIO Analyzer] Analysis complete');
      console.log(`  Resources evaluated: ${result.evaluations?.length || 0}`);

      const summary = {
        sustainedAdvantageResources: result.evaluations
          .filter((e: VRIOResourceEvaluation) => e.competitiveImplication === 'sustained-advantage')
          .map((e: VRIOResourceEvaluation) => e.resource),
        temporaryAdvantageResources: result.evaluations
          .filter((e: VRIOResourceEvaluation) => e.competitiveImplication === 'temporary-advantage')
          .map((e: VRIOResourceEvaluation) => e.resource),
        parityResources: result.evaluations
          .filter((e: VRIOResourceEvaluation) => e.competitiveImplication === 'parity')
          .map((e: VRIOResourceEvaluation) => e.resource),
        disadvantageResources: result.evaluations
          .filter((e: VRIOResourceEvaluation) => e.competitiveImplication === 'disadvantage')
          .map((e: VRIOResourceEvaluation) => e.resource),
      };

      return {
        evaluations: result.evaluations,
        summary,
        strategicRecommendations: result.strategicRecommendations || [],
        confidence: this.calculateConfidence(result),
        metadata: {
          resourcesEvaluated: result.evaluations?.length || 0,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[VRIO Analyzer] Analysis failed:', error);
      throw error;
    }
  }

  private calculateConfidence(result: any): number {
    let confidence = 0.6;

    const evaluationCount = result.evaluations?.length || 0;
    if (evaluationCount >= 5) confidence += 0.15;
    else if (evaluationCount >= 3) confidence += 0.1;

    const allHaveReasoning = result.evaluations?.every((e: VRIOResourceEvaluation) => e.reasoning) ?? false;
    if (allHaveReasoning) confidence += 0.1;

    if (result.strategicRecommendations?.length > 0) confidence += 0.05;

    return Math.min(0.95, confidence);
  }
}

export const vrioAnalyzer = new VRIOAnalyzer();
