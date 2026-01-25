/**
 * SWOT Analyzer
 * Analyzes Strengths, Weaknesses, Opportunities, and Threats
 * Can use BMC output, Porter's output, or raw business context as input
 */

import { aiClients } from '../ai-clients';
import { extractJsonFromMarkdown, createAnalysisErrorResult } from '../utils/json-parser';

export interface SWOTInput {
  businessContext: string;
  bmcOutput?: any;
  portersOutput?: any;
  pestleOutput?: any;
}

export interface SWOTFactor {
  factor: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  evidence?: string;
}

export interface SWOTOutput {
  strengths: SWOTFactor[];
  weaknesses: SWOTFactor[];
  opportunities: SWOTFactor[];
  threats: SWOTFactor[];
  strategicOptions: {
    soStrategies: string[];
    woStrategies: string[];
    stStrategies: string[];
    wtStrategies: string[];
  };
  priorityActions: string[];
  confidence: number;
  metadata: {
    inputSources: string[];
    analysisDepth: 'basic' | 'enhanced';
    generatedAt: string;
  };
}

export class SWOTAnalyzer {
  async analyze(input: SWOTInput): Promise<SWOTOutput> {
    console.log('[SWOT Analyzer] Starting analysis...');

    const contextParts: string[] = [input.businessContext];
    const inputSources: string[] = ['business_context'];

    if (input.bmcOutput) {
      contextParts.push(`Business Model Canvas: ${JSON.stringify(input.bmcOutput)}`);
      inputSources.push('bmc');
    }

    if (input.portersOutput) {
      contextParts.push(`Porter's Five Forces: ${JSON.stringify(input.portersOutput)}`);
      inputSources.push('porters');
    }

    if (input.pestleOutput) {
      contextParts.push(`PESTLE Analysis: ${JSON.stringify(input.pestleOutput)}`);
      inputSources.push('pestle');
    }

    const analysisDepth = inputSources.length > 1 ? 'enhanced' : 'basic';

    const prompt = `
Perform a comprehensive SWOT analysis for this business:

${contextParts.join('\n\n')}

Analyze and provide:

1. STRENGTHS (internal positive factors)
   - What does this business do well?
   - What unique resources does it have?
   - What advantages does it have over competitors?

2. WEAKNESSES (internal negative factors)
   - What could be improved?
   - What resources are lacking?
   - What are competitors doing better?

3. OPPORTUNITIES (external positive factors)
   - What market trends could benefit the business?
   - What gaps exist in the market?
   - What external changes could be leveraged?

4. THREATS (external negative factors)
   - What obstacles does the business face?
   - What are competitors doing?
   - What external changes could hurt the business?

5. STRATEGIC OPTIONS (TOWS Matrix)
   - SO Strategies: Use strengths to capture opportunities
   - WO Strategies: Overcome weaknesses by exploiting opportunities
   - ST Strategies: Use strengths to avoid threats
   - WT Strategies: Minimize weaknesses and avoid threats

6. PRIORITY ACTIONS: Top 3-5 immediate actions based on the analysis

For each factor, provide:
- A clear, specific factor name
- A detailed description
- Importance rating (high/medium/low)
- Supporting evidence if available

Return as JSON matching this structure:
{
  "strengths": [{"factor": "", "description": "", "importance": "high|medium|low", "evidence": ""}],
  "weaknesses": [{"factor": "", "description": "", "importance": "high|medium|low", "evidence": ""}],
  "opportunities": [{"factor": "", "description": "", "importance": "high|medium|low", "evidence": ""}],
  "threats": [{"factor": "", "description": "", "importance": "high|medium|low", "evidence": ""}],
  "strategicOptions": {
    "soStrategies": [""],
    "woStrategies": [""],
    "stStrategies": [""],
    "wtStrategies": [""]
  },
  "priorityActions": [""]
}
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a strategic analysis expert specializing in SWOT analysis. Return only valid JSON without markdown code blocks.',
        userMessage: prompt,
        maxTokens: 4000,
      });

      // Use helper to extract JSON from potentially markdown-wrapped response
      const parseResult = extractJsonFromMarkdown(response.content);
      
      if (!parseResult.success) {
        // Return error structure instead of throwing - this gets saved to framework_insights
        console.error('[SWOT Analyzer] Failed to parse AI response');
        return createAnalysisErrorResult(
          'swot',
          'Failed to parse SWOT analysis response',
          parseResult.rawOutput,
          parseResult.error
        ) as any;
      }

      const result = parseResult.data;

      console.log('[SWOT Analyzer] Analysis complete');
      console.log(`  Strengths: ${result.strengths?.length || 0}`);
      console.log(`  Weaknesses: ${result.weaknesses?.length || 0}`);
      console.log(`  Opportunities: ${result.opportunities?.length || 0}`);
      console.log(`  Threats: ${result.threats?.length || 0}`);

      return {
        ...result,
        confidence: this.calculateConfidence(result, inputSources),
        metadata: {
          inputSources,
          analysisDepth,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      // Even for unexpected errors, return error structure instead of throwing
      console.error('[SWOT Analyzer] Analysis failed:', error);
      return createAnalysisErrorResult(
        'swot',
        `SWOT analysis failed: ${error.message}`,
        '',
        error.message
      ) as any;
    }
  }

  private calculateConfidence(result: any, inputSources: string[]): number {
    let confidence = 0.6;

    confidence += inputSources.length * 0.05;

    const totalFactors =
      (result.strengths?.length || 0) +
      (result.weaknesses?.length || 0) +
      (result.opportunities?.length || 0) +
      (result.threats?.length || 0);

    if (totalFactors >= 12) confidence += 0.1;
    else if (totalFactors >= 8) confidence += 0.05;

    if (result.strategicOptions?.soStrategies?.length > 0) confidence += 0.05;

    return Math.min(0.95, confidence);
  }
}

export const swotAnalyzer = new SWOTAnalyzer();
