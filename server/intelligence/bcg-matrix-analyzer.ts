/**
 * BCG Matrix Analyzer
 * Classifies products/business units using the Boston Consulting Group matrix
 * Market growth rate vs relative market share positioning
 */

import { aiClients } from '../ai-clients';

export interface BusinessUnit {
  name: string;
  description?: string;
  revenue?: number;
  marketSize?: number;
  estimatedMarketShare?: number;
  growthRate?: number;
}

export interface BCGMatrixInput {
  businessContext: string;
  products: BusinessUnit[];
  industryData?: any;
  portersOutput?: any;
  ansoffOutput?: any;
}

export interface BCGClassification {
  unit: string;
  classification: 'star' | 'cash-cow' | 'question-mark' | 'dog';
  marketShare: number;
  marketGrowth: number;
  description: string;
  financialCharacteristics: {
    cashGeneration: 'high' | 'medium' | 'low';
    investmentNeeds: 'high' | 'medium' | 'low';
    profitability: 'high' | 'medium' | 'low';
  };
  strategicRecommendations: string[];
  risks: string[];
  opportunities: string[];
}

export interface PortfolioBalance {
  description: string;
  healthAssessment: 'healthy' | 'at-risk' | 'imbalanced';
  concerns: string[];
  recommendations: string[];
}

export interface BCGMatrixOutput {
  classifications: BCGClassification[];
  portfolioBalance: PortfolioBalance;
  stars: {
    count: number;
    totalRevenue?: number;
    strategicImportance: string;
    investmentStrategy: string;
  };
  cashCows: {
    count: number;
    totalRevenue?: number;
    strategicImportance: string;
    utilizationStrategy: string;
  };
  questionMarks: {
    count: number;
    totalRevenue?: number;
    strategicImportance: string;
    decisionStrategy: string;
  };
  dogs: {
    count: number;
    totalRevenue?: number;
    strategicImportance: string;
    exitStrategy: string;
  };
  portfolioStrategy: {
    shortTermActions: string[];
    mediumTermActions: string[];
    longTermVision: string;
  };
  priorityActions: string[];
  confidence: number;
  metadata: {
    unitsAnalyzed: number;
    inputSources: string[];
    generatedAt: string;
  };
}

export class BCGMatrixAnalyzer {
  async analyze(input: BCGMatrixInput): Promise<BCGMatrixOutput> {
    console.log('[BCG Matrix Analyzer] Starting analysis...');

    const contextParts: string[] = [input.businessContext];
    const inputSources: string[] = ['business_context'];

    contextParts.push(`Business Units: ${JSON.stringify(input.products)}`);

    if (input.industryData) {
      contextParts.push(`Industry Data: ${JSON.stringify(input.industryData)}`);
      inputSources.push('industry');
    }

    if (input.portersOutput) {
      contextParts.push(`Porter's Five Forces: ${JSON.stringify(input.portersOutput)}`);
      inputSources.push('porters');
    }

    if (input.ansoffOutput) {
      contextParts.push(`Ansoff Analysis: ${JSON.stringify(input.ansoffOutput)}`);
      inputSources.push('ansoff');
    }

    const prompt = `
Perform a BCG Matrix analysis for this business's products/units:

${contextParts.join('\n\n')}

Classify each product/business unit using the BCG Matrix framework:

1. UNIT CLASSIFICATIONS
   For each unit, determine:
   - Classification: Star (high growth, high share) / Cash Cow (low growth, high share) / Question Mark (high growth, low share) / Dog (low growth, low share)
   - Market share percentage (1-100)
   - Market growth rate (% annually)
   - Detailed description of the unit's position
   - Financial characteristics: cash generation, investment needs, profitability (high/medium/low)
   - 3-4 strategic recommendations specific to this classification
   - Key risks for this unit
   - Key opportunities

   Classification guidelines:
   - STARS: High growth rate (>10%), high market share (>50%). Require investment to maintain position.
   - CASH COWS: Low growth rate (<5%), high market share (>50%). Generate steady cash flow.
   - QUESTION MARKS: High growth rate (>10%), low market share (<50%). Need decisions about investment.
   - DOGS: Low growth rate (<5%), low market share (<50%). May need restructuring or exit.

2. PORTFOLIO BALANCE ASSESSMENT
   - Overall portfolio health: healthy/at-risk/imbalanced
   - Key concerns about current portfolio mix
   - Recommendations for balance

3. PORTFOLIO SUMMARY BY CATEGORY
   For Stars, Cash Cows, Question Marks, and Dogs:
   - Count and estimated total revenue
   - Strategic importance to the business
   - Overall strategy (invest/harvest/divest/decide)

4. OVERALL PORTFOLIO STRATEGY
   - Short-term actions (0-6 months)
   - Medium-term actions (6-18 months)
   - Long-term vision (2+ years)

5. PRIORITY ACTIONS: Top 3-5 portfolio management actions

Return as JSON:
{
  "classifications": [
    {
      "unit": "",
      "classification": "star|cash-cow|question-mark|dog",
      "marketShare": 75,
      "marketGrowth": 15,
      "description": "",
      "financialCharacteristics": {"cashGeneration": "high", "investmentNeeds": "high", "profitability": "high"},
      "strategicRecommendations": [],
      "risks": [],
      "opportunities": []
    }
  ],
  "portfolioBalance": {
    "description": "",
    "healthAssessment": "healthy|at-risk|imbalanced",
    "concerns": [],
    "recommendations": []
  },
  "stars": {"count": 0, "totalRevenue": 0, "strategicImportance": "", "investmentStrategy": ""},
  "cashCows": {"count": 0, "totalRevenue": 0, "strategicImportance": "", "utilizationStrategy": ""},
  "questionMarks": {"count": 0, "totalRevenue": 0, "strategicImportance": "", "decisionStrategy": ""},
  "dogs": {"count": 0, "totalRevenue": 0, "strategicImportance": "", "exitStrategy": ""},
  "portfolioStrategy": {
    "shortTermActions": [],
    "mediumTermActions": [],
    "longTermVision": ""
  },
  "priorityActions": []
}
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a portfolio strategy expert specializing in BCG Matrix analysis. Return only valid JSON.',
        userMessage: prompt,
        maxTokens: 4000,
      });

      const result = JSON.parse(response.content);

      console.log('[BCG Matrix Analyzer] Analysis complete');
      console.log(`  Total units classified: ${result.classifications?.length || 0}`);
      console.log(`  Stars: ${result.stars?.count || 0}`);
      console.log(`  Cash Cows: ${result.cashCows?.count || 0}`);
      console.log(`  Question Marks: ${result.questionMarks?.count || 0}`);
      console.log(`  Dogs: ${result.dogs?.count || 0}`);

      return {
        ...result,
        confidence: this.calculateConfidence(result, inputSources, input.products.length),
        metadata: {
          unitsAnalyzed: input.products.length,
          inputSources,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[BCG Matrix Analyzer] Analysis failed:', error);
      throw error;
    }
  }

  private calculateConfidence(result: any, inputSources: string[], unitCount: number): number {
    let confidence = 0.6;

    confidence += inputSources.length * 0.05;
    confidence += Math.min(0.1, unitCount * 0.02);

    if (result.classifications?.length === unitCount) confidence += 0.1;
    if (result.portfolioStrategy?.shortTermActions?.length >= 2) confidence += 0.05;
    if (result.portfolioBalance?.healthAssessment) confidence += 0.05;

    return Math.min(0.95, confidence);
  }
}

export const bcgMatrixAnalyzer = new BCGMatrixAnalyzer();
