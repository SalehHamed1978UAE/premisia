import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { PortersAnalyzer } from '../../intelligence/porters-analyzer';
import { aiClients } from '../../ai-clients';
import { extractJsonFromMarkdown } from '../../utils/json-parser';

/**
 * Porter's Five Forces Framework Executor
 * Analyzes competitive forces: Threat of New Entrants, Supplier Power, Buyer Power, Threat of Substitutes, Competitive Rivalry
 */
export class PortersExecutor implements FrameworkExecutor {
  name = 'porters' as const;
  private analyzer = new PortersAnalyzer();

  async validate(context: StrategicContext) {
    return { 
      valid: !!context.userInput, 
      errors: context.userInput ? undefined : ['Business context required for Porter\'s Five Forces analysis']
    };
  }

  async execute(context: StrategicContext): Promise<any> {
    console.log('[Porters Executor] Starting Porter\'s Five Forces competitive analysis...');

    const prompt = `
Perform a comprehensive Porter's Five Forces analysis for this business:

Business Context: ${context.userInput}

Analyze the five competitive forces:

1. THREAT OF NEW ENTRANTS - How easy/hard is it for new competitors to enter?
   - Barriers to entry: capital requirements, economies of scale, switching costs, brand loyalty, regulatory barriers
   - New entrant strategies that could emerge
   
2. BARGAINING POWER OF SUPPLIERS - How much power do suppliers have?
   - Supplier concentration
   - Availability of substitutes for supplier inputs
   - Cost of switching suppliers
   - Mitigation strategies
   
3. BARGAINING POWER OF BUYERS - How much power do buyers have?
   - Buyer concentration
   - Price sensitivity
   - Availability of alternatives
   - Switching costs for buyers
   
4. THREAT OF SUBSTITUTES - How likely are customers to switch to alternatives?
   - Substitute products/services
   - Relative pricing and performance
   - Customer switching costs
   
5. COMPETITIVE RIVALRY - How intense is rivalry among existing competitors?
   - Number and balance of competitors
   - Industry growth rate
   - Competitive strategies
   - Exit barriers

For each force, provide:
- Score (1-10, where 10 = very high threat)
- Analysis explanation
- Key risks from this force
- Relevant competitors/suppliers/substitutes

Synthesize into:
- Overall market attractiveness score (1-10)
- Attractiveness summary
- Strategic recommendations

Return as JSON:
{
  "threatOfNewEntrants": {"score": 6, "analysis": "", "barriers": [""], "risks": [""]},
  "bargainingPowerOfSuppliers": {"score": 5, "analysis": "", "mitigations": [""], "risks": [""]},
  "bargainingPowerOfBuyers": {"score": 6, "analysis": "", "risks": [""]},
  "threatOfSubstitutes": {"score": 7, "analysis": "", "substitutes": [""], "risks": [""]},
  "competitiveRivalry": {"score": 8, "analysis": "", "competitors": [""], "strategies": [""], "risks": [""]},
  "overallAttractiveness": {"score": 6, "summary": "", "recommendations": [""]},
  "strategicImplications": [""]
}
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a strategic analyst specializing in Porter\'s Five Forces. Analyze competitive dynamics and return only valid JSON.',
        userMessage: prompt,
        maxTokens: 4000,
      });

      const parseResult = extractJsonFromMarkdown(response.content);
      if (!parseResult.success) {
        console.error('[Porters Executor] Failed to parse AI response:', parseResult.error);
        throw new Error(`Failed to parse Porter's analysis: ${parseResult.error}`);
      }
      const portersResults = parseResult.data;

      console.log('[Porters Executor] Porter\'s analysis generated');
      console.log(`  Threat of New Entrants: ${portersResults.threatOfNewEntrants?.score}/10`);
      console.log(`  Supplier Power: ${portersResults.bargainingPowerOfSuppliers?.score}/10`);
      console.log(`  Buyer Power: ${portersResults.bargainingPowerOfBuyers?.score}/10`);
      console.log(`  Threat of Substitutes: ${portersResults.threatOfSubstitutes?.score}/10`);
      console.log(`  Competitive Rivalry: ${portersResults.competitiveRivalry?.score}/10`);
      console.log(`  Overall Market Attractiveness: ${portersResults.overallAttractiveness?.score}/10`);

      // Convert to strategic insights using the analyzer
      console.log('[Porters Executor] Converting Porter\'s results to strategic insights...');
      const insights = await this.analyzer.analyze(portersResults);

      console.log('[Porters Executor] Porter\'s Five Forces analysis complete');

      return {
        framework: 'porters',
        portersResults,
        insights,
        summary: {
          forces: 5,
          averageForceScore: (
            (portersResults.threatOfNewEntrants?.score || 0) +
            (portersResults.bargainingPowerOfSuppliers?.score || 0) +
            (portersResults.bargainingPowerOfBuyers?.score || 0) +
            (portersResults.threatOfSubstitutes?.score || 0) +
            (portersResults.competitiveRivalry?.score || 0)
          ) / 5,
          marketAttractiveness: portersResults.overallAttractiveness?.score,
          attractivenessLevel: this.getAttractiveness(portersResults.overallAttractiveness?.score || 5),
        },
      };
    } catch (error) {
      console.error('[Porters Executor] Analysis failed:', error);
      throw error;
    }
  }

  private getAttractiveness(score: number): string {
    if (score >= 8) return 'Very Attractive';
    if (score >= 6) return 'Attractive';
    if (score >= 4) return 'Moderately Attractive';
    return 'Unattractive';
  }
}
