/**
 * Ansoff Matrix Analyzer
 * Evaluates growth strategy options: Market Penetration, Market Development,
 * Product Development, Diversification
 */

import { aiClients } from '../ai-clients';

export interface AnsoffInput {
  businessContext: string;
  currentProducts?: string[];
  currentMarkets?: string[];
  swotOutput?: any;
  bmcOutput?: any;
}

export interface AnsoffQuadrant {
  score: number;
  strategies: string[];
  risks: string[];
  opportunities: string[];
  implementationNotes: string;
  timeframe: 'short-term' | 'medium-term' | 'long-term';
}

export interface AnsoffOutput {
  marketPenetration: AnsoffQuadrant;
  marketDevelopment: AnsoffQuadrant;
  productDevelopment: AnsoffQuadrant;
  diversification: AnsoffQuadrant;
  recommendation: {
    primaryStrategy: string;
    secondaryStrategy?: string;
    rationale: string;
    riskLevel: 'low' | 'medium' | 'high';
  };
  priorityActions: string[];
  confidence: number;
  metadata: {
    inputSources: string[];
    generatedAt: string;
  };
}

export class AnsoffAnalyzer {
  async analyze(input: AnsoffInput): Promise<AnsoffOutput> {
    console.log('[Ansoff Analyzer] Starting growth strategy analysis...');

    const contextParts: string[] = [input.businessContext];
    const inputSources: string[] = ['business_context'];

    if (input.currentProducts?.length) {
      contextParts.push(`Current Products/Services: ${input.currentProducts.join(', ')}`);
    }

    if (input.currentMarkets?.length) {
      contextParts.push(`Current Markets: ${input.currentMarkets.join(', ')}`);
    }

    if (input.swotOutput) {
      contextParts.push(`SWOT Analysis: ${JSON.stringify(input.swotOutput)}`);
      inputSources.push('swot');
    }

    if (input.bmcOutput) {
      contextParts.push(`Business Model Canvas: ${JSON.stringify(input.bmcOutput)}`);
      inputSources.push('bmc');
    }

    const prompt = `
Analyze growth strategy options using the Ansoff Matrix for this business:

${contextParts.join('\n\n')}

Evaluate each of the four growth strategies:

1. MARKET PENETRATION (Existing Products, Existing Markets)
   - How can the business grow by selling more to current customers?
   - What market share can be captured?
   - What pricing or promotion strategies would work?

2. MARKET DEVELOPMENT (Existing Products, New Markets)
   - What new geographic markets could be entered?
   - What new customer segments could be targeted?
   - What channels could reach new markets?

3. PRODUCT DEVELOPMENT (New Products, Existing Markets)
   - What new products/services could be offered to current customers?
   - What product improvements or extensions are possible?
   - What unmet needs can be addressed?

4. DIVERSIFICATION (New Products, New Markets)
   - What related diversification opportunities exist?
   - What unrelated diversification makes sense?
   - What synergies could be leveraged?

For each quadrant, provide:
- Score (1-10 for attractiveness)
- Specific strategies
- Key risks
- Main opportunities
- Implementation notes
- Timeframe (short/medium/long-term)

Then recommend the PRIMARY growth strategy with rationale.

Return as JSON:
{
  "marketPenetration": {"score": 8, "strategies": [], "risks": [], "opportunities": [], "implementationNotes": "", "timeframe": "short-term"},
  "marketDevelopment": {"score": 6, "strategies": [], "risks": [], "opportunities": [], "implementationNotes": "", "timeframe": "medium-term"},
  "productDevelopment": {"score": 7, "strategies": [], "risks": [], "opportunities": [], "implementationNotes": "", "timeframe": "medium-term"},
  "diversification": {"score": 4, "strategies": [], "risks": [], "opportunities": [], "implementationNotes": "", "timeframe": "long-term"},
  "recommendation": {"primaryStrategy": "", "secondaryStrategy": "", "rationale": "", "riskLevel": "medium"},
  "priorityActions": []
}
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a strategic growth expert specializing in Ansoff Matrix analysis. Return only valid JSON.',
        userMessage: prompt,
        maxTokens: 4000,
      });

      const result = JSON.parse(response.content);

      console.log('[Ansoff Analyzer] Analysis complete');
      console.log(`  Recommended: ${result.recommendation?.primaryStrategy}`);

      return {
        ...result,
        confidence: this.calculateConfidence(result, inputSources),
        metadata: {
          inputSources,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[Ansoff Analyzer] Analysis failed:', error);
      throw error;
    }
  }

  private calculateConfidence(result: any, inputSources: string[]): number {
    let confidence = 0.6;
    confidence += inputSources.length * 0.05;

    if (result.recommendation?.primaryStrategy) confidence += 0.1;
    if (result.priorityActions?.length >= 3) confidence += 0.05;

    return Math.min(0.95, confidence);
  }
}

export const ansoffAnalyzer = new AnsoffAnalyzer();
