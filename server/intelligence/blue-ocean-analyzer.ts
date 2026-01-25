/**
 * Blue Ocean Analyzer
 * Applies Blue Ocean Strategy framework to identify uncontested market space
 * Uses eliminate/reduce/raise/create grid and value curve analysis
 */

import { aiClients } from '../ai-clients';

export interface BlueOceanInput {
  businessContext: string;
  industry: string;
  currentOffering: string[];
  swotOutput?: any;
  portersOutput?: any;
  competitorsData?: any;
}

export interface Factor {
  name: string;
  currentApproach: string;
  redOceanLevel: number;
  blueOceanLevel: number;
  rationale: string;
}

export interface ErcGrid {
  eliminate: Factor[];
  reduce: Factor[];
  raise: Factor[];
  create: Factor[];
}

export interface BlueOceanOutput {
  ercGrid: ErcGrid;
  valueCurve: {
    currentCurve: { [factor: string]: number };
    competitorCurves: { [competitorName: string]: { [factor: string]: number } };
    bluOceanCurve: { [factor: string]: number };
    comparison: string;
  };
  blueOceanOpportunities: {
    opportunity: string;
    description: string;
    marketSize: 'large' | 'medium' | 'small';
    implementationComplexity: 'high' | 'medium' | 'low';
    timeToMarket: string;
    potentialROI: string;
  }[];
  newMarketSpaceRecommendations: {
    strategy: string;
    targetCustomers: string;
    keyOffering: string;
    valueProposition: string;
    costStructure: string;
    profitModel: string;
    riskFactors: string[];
  };
  innovationStrategy: {
    focusAreas: string[];
    discontinuitiesDriven: string[];
    newValueCurve: string;
  };
  priorityActions: string[];
  confidence: number;
  metadata: {
    industryAnalyzed: string;
    inputSources: string[];
    generatedAt: string;
  };
}

export class BlueOceanAnalyzer {
  async analyze(input: BlueOceanInput): Promise<BlueOceanOutput> {
    console.log('[BlueOcean Analyzer] Starting Blue Ocean analysis...');

    const contextParts: string[] = [input.businessContext];
    const inputSources: string[] = ['business_context'];

    contextParts.push(`Industry: ${input.industry}`);
    contextParts.push(`Current Offering: ${input.currentOffering.join(', ')}`);

    if (input.swotOutput) {
      contextParts.push(`SWOT Analysis: ${JSON.stringify(input.swotOutput)}`);
      inputSources.push('swot');
    }

    if (input.portersOutput) {
      contextParts.push(`Porter's Five Forces: ${JSON.stringify(input.portersOutput)}`);
      inputSources.push('porters');
    }

    if (input.competitorsData) {
      contextParts.push(`Competitors Data: ${JSON.stringify(input.competitorsData)}`);
      inputSources.push('competitors');
    }

    const prompt = `
Perform a Blue Ocean Strategy analysis for this business:

${contextParts.join('\n\n')}

Apply the Blue Ocean framework to identify uncontested market space:

1. ELIMINATE-REDUCE-RAISE-CREATE GRID
   Identify factors/attributes in the industry (5-8 key factors):
   
   For each factor:
   - ELIMINATE: Factors the industry takes for granted that should be removed
   - REDUCE: Factors that should be below industry standards
   - RAISE: Factors that should be increased above industry standards
   - CREATE: Factors the industry has never offered that should be created

   For each item, provide:
   - Factor name
   - Current approach in the industry
   - Red Ocean level (1-10 where industry currently competes)
   - Blue Ocean level (1-10 target for differentiation)
   - Rationale for the shift

2. VALUE CURVE ANALYSIS
   - Current value curve: Your business's profile across key factors
   - Competitor curves: 2-3 major competitors' profiles
   - Blue Ocean curve: The proposed new value curve
   - Comparison: How the Blue Ocean curve breaks from the red ocean

3. BLUE OCEAN OPPORTUNITIES (3-5 specific opportunities)
   For each opportunity:
   - Clear opportunity description
   - What this creates/enables
   - Market size estimate: large/medium/small
   - Implementation complexity: high/medium/low
   - Time to market estimate
   - Potential ROI estimate

4. NEW MARKET SPACE RECOMMENDATIONS
   - Overall Blue Ocean strategy description
   - Target customers for this new market space
   - Key offering/value proposition
   - Value proposition statement
   - Cost structure adjustments needed
   - Profit model in the new market space
   - Risk factors in pursuing this strategy

5. INNOVATION STRATEGY
   - Focus areas for innovation
   - Discontinuities being driven (what changes fundamentally)
   - Description of the new value curve

6. PRIORITY ACTIONS: Top 3-5 actions to create blue ocean space

Return as JSON:
{
  "ercGrid": {
    "eliminate": [{"name": "", "currentApproach": "", "redOceanLevel": 7, "blueOceanLevel": 2, "rationale": ""}],
    "reduce": [{"name": "", "currentApproach": "", "redOceanLevel": 8, "blueOceanLevel": 4, "rationale": ""}],
    "raise": [{"name": "", "currentApproach": "", "redOceanLevel": 4, "blueOceanLevel": 8, "rationale": ""}],
    "create": [{"name": "", "currentApproach": "", "redOceanLevel": 0, "blueOceanLevel": 7, "rationale": ""}]
  },
  "valueCurve": {
    "currentCurve": {"factor1": 7, "factor2": 5},
    "competitorCurves": {"Competitor A": {"factor1": 8, "factor2": 6}},
    "bluOceanCurve": {"factor1": 4, "factor2": 9},
    "comparison": ""
  },
  "blueOceanOpportunities": [{"opportunity": "", "description": "", "marketSize": "large", "implementationComplexity": "medium", "timeToMarket": "", "potentialROI": ""}],
  "newMarketSpaceRecommendations": {"strategy": "", "targetCustomers": "", "keyOffering": "", "valueProposition": "", "costStructure": "", "profitModel": "", "riskFactors": []},
  "innovationStrategy": {"focusAreas": [], "discontinuitiesDriven": [], "newValueCurve": ""},
  "priorityActions": []
}
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a Blue Ocean Strategy expert. Identify uncontested market spaces and return valid JSON.',
        userMessage: prompt,
        maxTokens: 4000,
      });

      const result = JSON.parse(response.content);

      console.log('[BlueOcean Analyzer] Analysis complete');
      console.log(`  Eliminate factors: ${result.ercGrid?.eliminate?.length || 0}`);
      console.log(`  Reduce factors: ${result.ercGrid?.reduce?.length || 0}`);
      console.log(`  Raise factors: ${result.ercGrid?.raise?.length || 0}`);
      console.log(`  Create factors: ${result.ercGrid?.create?.length || 0}`);
      console.log(`  Blue Ocean opportunities: ${result.blueOceanOpportunities?.length || 0}`);

      return {
        ...result,
        confidence: this.calculateConfidence(result, inputSources),
        metadata: {
          industryAnalyzed: input.industry,
          inputSources,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[BlueOcean Analyzer] Analysis failed:', error);
      throw error;
    }
  }

  private calculateConfidence(result: any, inputSources: string[]): number {
    let confidence = 0.6;

    confidence += inputSources.length * 0.05;

    const ercFactors =
      (result.ercGrid?.eliminate?.length || 0) +
      (result.ercGrid?.reduce?.length || 0) +
      (result.ercGrid?.raise?.length || 0) +
      (result.ercGrid?.create?.length || 0);

    if (ercFactors >= 8) confidence += 0.1;
    else if (ercFactors >= 4) confidence += 0.05;

    if (result.blueOceanOpportunities?.length >= 2) confidence += 0.1;
    if (result.valueCurve?.bluOceanCurve) confidence += 0.05;

    return Math.min(0.95, confidence);
  }
}

export const blueOceanAnalyzer = new BlueOceanAnalyzer();
