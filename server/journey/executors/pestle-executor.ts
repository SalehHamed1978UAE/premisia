import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { PESTLEAnalyzer } from '../../intelligence/pestle-analyzer';
import { aiClients } from '../../ai-clients';

/**
 * PESTLE Framework Executor
 * Analyzes macro-environmental factors: Political, Economic, Social, Technological, Legal, Environmental
 */
export class PESTLEExecutor implements FrameworkExecutor {
  name = 'pestle' as const;
  private analyzer = new PESTLEAnalyzer();

  async validate(context: StrategicContext) {
    return { 
      valid: !!context.userInput, 
      errors: context.userInput ? undefined : ['Business context required for PESTLE analysis']
    };
  }

  async execute(context: StrategicContext): Promise<any> {
    console.log('[PESTLE Executor] Starting PESTLE macro-environmental analysis...');

    const prompt = `
Perform a comprehensive PESTLE analysis for this business:

Business Context: ${context.userInput}

Analyze the macro-environmental factors:

1. POLITICAL - Government policies, regulations, political stability, trade policies
2. ECONOMIC - Economic growth, interest rates, inflation, currency exchange, market conditions
3. SOCIAL - Demographics, cultural trends, consumer attitudes, lifestyle changes
4. TECHNOLOGICAL - Innovation trends, tech adoption, digital transformation, automation
5. LEGAL - Regulations, compliance requirements, intellectual property, data protection
6. ENVIRONMENTAL - Climate change, sustainability, natural resources, environmental regulations

For each factor, provide:
- Key trends (with strength 1-10)
- Timeframe (near-term/medium-term/long-term)
- Impact on business (positive/negative)
- Opportunities for the business
- Risks to monitor
- Required actions/adaptations

Return as JSON with structure:
{
  "political": {"trends": [{"description": "", "strength": 5, "timeframe": "", "impact": ""}], "opportunities": [{"description": "", "requirements": []}], "risks": [{"description": "", "probability": 0.5, "impact": "High"}]},
  "economic": {...},
  "social": {...},
  "technological": {...},
  "legal": {...},
  "environmental": {...},
  "strategicRecommendations": [""],
  "crossFactorInsights": {"synergies": [""], "conflicts": [""]}
}
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a strategic analysis expert specializing in PESTLE analysis. Analyze macro-environmental factors and return only valid JSON.',
        userMessage: prompt,
        maxTokens: 4000,
      });

      const pestleResults = JSON.parse(response.content);

      console.log('[PESTLE Executor] PESTLE analysis generated');
      console.log(`  Political factors: ${pestleResults.political?.trends?.length || 0} trends`);
      console.log(`  Economic factors: ${pestleResults.economic?.trends?.length || 0} trends`);
      console.log(`  Social factors: ${pestleResults.social?.trends?.length || 0} trends`);
      console.log(`  Technological factors: ${pestleResults.technological?.trends?.length || 0} trends`);
      console.log(`  Legal factors: ${pestleResults.legal?.trends?.length || 0} trends`);
      console.log(`  Environmental factors: ${pestleResults.environmental?.trends?.length || 0} trends`);

      // Convert to strategic insights using the analyzer
      console.log('[PESTLE Executor] Converting PESTLE results to strategic insights...');
      const insights = await this.analyzer.analyze(pestleResults);

      console.log('[PESTLE Executor] PESTLE analysis complete');

      return {
        framework: 'pestle',
        pestleResults,
        insights,
        summary: {
          factors: 6,
          trends: Object.values(pestleResults)
            .filter((f: any) => f.trends)
            .reduce((sum: number, f: any) => sum + f.trends.length, 0),
          opportunities: Object.values(pestleResults)
            .filter((f: any) => f.opportunities)
            .reduce((sum: number, f: any) => sum + f.opportunities.length, 0),
        },
      };
    } catch (error) {
      console.error('[PESTLE Executor] Analysis failed:', error);
      throw error;
    }
  }
}
