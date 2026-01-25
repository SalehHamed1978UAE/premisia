/**
 * Ocean Strategy Analyzer
 * Comprehensive ocean strategy mapping covering Red, Blue, Green, and White ocean approaches
 * Recommends which ocean strategy best fits the business context
 */

import { aiClients } from '../ai-clients';

export interface OceanStrategyInput {
  businessContext: string;
  industry: string;
  currentMarketPosition?: string;
  competitiveLandscape?: string;
  sustainabilityGoals?: string;
  blueOceanOutput?: any;
  swotOutput?: any;
  portersOutput?: any;
}

export interface OceanAssessment {
  ocean: 'red' | 'blue' | 'green' | 'white';
  displayName: string;
  description: string;
  fitScore: number;
  strengths: string[];
  challenges: string[];
  requiredCapabilities: string[];
  timeToImplement: string;
  riskLevel: 'high' | 'medium' | 'low';
  potentialRewards: string;
}

export interface OceanStrategyOutput {
  currentOcean: {
    ocean: 'red' | 'blue' | 'green' | 'white';
    reasoning: string;
    marketCharacteristics: string[];
  };
  oceanAssessments: OceanAssessment[];
  recommendedOcean: {
    ocean: 'red' | 'blue' | 'green' | 'white';
    reasoning: string;
    transitionPath: string[];
    quickWins: string[];
    longTermGoals: string[];
  };
  oceanComparison: {
    redOcean: {
      approach: string;
      focus: string;
      competitionMode: string;
      valueCreation: string;
      suitable: boolean;
      suitabilityReason: string;
    };
    blueOcean: {
      approach: string;
      focus: string;
      competitionMode: string;
      valueCreation: string;
      suitable: boolean;
      suitabilityReason: string;
    };
    greenOcean: {
      approach: string;
      focus: string;
      competitionMode: string;
      valueCreation: string;
      suitable: boolean;
      suitabilityReason: string;
    };
    whiteOcean: {
      approach: string;
      focus: string;
      competitionMode: string;
      valueCreation: string;
      suitable: boolean;
      suitabilityReason: string;
    };
  };
  hybridStrategy?: {
    primaryOcean: 'red' | 'blue' | 'green' | 'white';
    secondaryOcean: 'red' | 'blue' | 'green' | 'white';
    integration: string;
    benefits: string[];
    risks: string[];
  };
  implementationRoadmap: {
    phase: string;
    actions: string[];
    timeline: string;
    milestones: string[];
  }[];
  priorityActions: string[];
  confidence: number;
  metadata: {
    industryAnalyzed: string;
    inputSources: string[];
    generatedAt: string;
  };
}

export class OceanStrategyAnalyzer {
  async analyze(input: OceanStrategyInput): Promise<OceanStrategyOutput> {
    console.log('[OceanStrategy Analyzer] Starting Ocean Strategy analysis...');

    const contextParts: string[] = [input.businessContext];
    const inputSources: string[] = ['business_context'];

    contextParts.push(`Industry: ${input.industry}`);

    if (input.currentMarketPosition) {
      contextParts.push(`Current Market Position: ${input.currentMarketPosition}`);
      inputSources.push('market_position');
    }

    if (input.competitiveLandscape) {
      contextParts.push(`Competitive Landscape: ${input.competitiveLandscape}`);
      inputSources.push('competitive_landscape');
    }

    if (input.sustainabilityGoals) {
      contextParts.push(`Sustainability Goals: ${input.sustainabilityGoals}`);
      inputSources.push('sustainability');
    }

    if (input.blueOceanOutput) {
      contextParts.push(`Blue Ocean Analysis: ${JSON.stringify(input.blueOceanOutput)}`);
      inputSources.push('blue_ocean');
    }

    if (input.swotOutput) {
      contextParts.push(`SWOT Analysis: ${JSON.stringify(input.swotOutput)}`);
      inputSources.push('swot');
    }

    if (input.portersOutput) {
      contextParts.push(`Porter's Five Forces: ${JSON.stringify(input.portersOutput)}`);
      inputSources.push('porters');
    }

    const prompt = `
Perform a comprehensive Ocean Strategy analysis for this business:

${contextParts.join('\n\n')}

Analyze the business against ALL FOUR OCEAN STRATEGIES:

**RED OCEAN** - Compete in existing market space
- Beat the competition in existing markets
- Exploit existing demand
- Make value-cost trade-off
- Align activities with strategic choice of differentiation OR low cost

**BLUE OCEAN** - Create uncontested market space
- Create and capture new demand
- Break the value-cost trade-off
- Align activities in pursuit of differentiation AND low cost
- Make competition irrelevant

**GREEN OCEAN** - Sustainable and purpose-driven strategy
- Balance profit with environmental/social responsibility
- Build sustainability into the core business model
- Create shared value for all stakeholders
- Long-term resilience through ESG integration

**WHITE OCEAN** - Social enterprise and impact-first strategy
- Primary focus on social/community impact
- Business model serves social mission
- Profit enables mission, not the reverse
- Collaborative, ecosystem-building approach

Provide analysis in this structure:

1. CURRENT OCEAN ASSESSMENT
   - Which ocean does this business currently operate in?
   - What are the market characteristics that indicate this?
   - Reasoning for this assessment

2. ASSESSMENT OF EACH OCEAN (for all 4 oceans)
   For each ocean provide:
   - Fit score (1-10 how well this strategy fits the business)
   - Strengths of this approach for this business
   - Challenges/obstacles to this approach
   - Required capabilities to pursue this ocean
   - Time to implement this strategy
   - Risk level (high/medium/low)
   - Potential rewards

3. RECOMMENDED OCEAN
   - Which ocean strategy is best for this business?
   - Detailed reasoning for this recommendation
   - Transition path from current state (step by step)
   - Quick wins in the first 90 days
   - Long-term goals (1-3 years)

4. OCEAN COMPARISON
   For each ocean (red, blue, green, white) provide:
   - Core approach
   - Primary focus
   - How competition is handled
   - How value is created
   - Whether it's suitable for this business
   - Why/why not suitable

5. HYBRID STRATEGY (if applicable)
   - Can this business combine ocean strategies?
   - Primary and secondary ocean
   - How to integrate them
   - Benefits and risks of hybrid approach

6. IMPLEMENTATION ROADMAP
   3-4 phases with:
   - Phase name/description
   - Specific actions
   - Timeline
   - Key milestones

7. PRIORITY ACTIONS: Top 5 immediate actions

Return as JSON:
{
  "currentOcean": {
    "ocean": "red|blue|green|white",
    "reasoning": "",
    "marketCharacteristics": []
  },
  "oceanAssessments": [
    {
      "ocean": "red",
      "displayName": "Red Ocean Strategy",
      "description": "",
      "fitScore": 7,
      "strengths": [],
      "challenges": [],
      "requiredCapabilities": [],
      "timeToImplement": "",
      "riskLevel": "medium",
      "potentialRewards": ""
    }
  ],
  "recommendedOcean": {
    "ocean": "blue",
    "reasoning": "",
    "transitionPath": [],
    "quickWins": [],
    "longTermGoals": []
  },
  "oceanComparison": {
    "redOcean": {"approach": "", "focus": "", "competitionMode": "", "valueCreation": "", "suitable": true, "suitabilityReason": ""},
    "blueOcean": {"approach": "", "focus": "", "competitionMode": "", "valueCreation": "", "suitable": true, "suitabilityReason": ""},
    "greenOcean": {"approach": "", "focus": "", "competitionMode": "", "valueCreation": "", "suitable": false, "suitabilityReason": ""},
    "whiteOcean": {"approach": "", "focus": "", "competitionMode": "", "valueCreation": "", "suitable": false, "suitabilityReason": ""}
  },
  "hybridStrategy": {
    "primaryOcean": "blue",
    "secondaryOcean": "green",
    "integration": "",
    "benefits": [],
    "risks": []
  },
  "implementationRoadmap": [
    {"phase": "", "actions": [], "timeline": "", "milestones": []}
  ],
  "priorityActions": []
}
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are an Ocean Strategy expert specializing in Red, Blue, Green, and White ocean strategies. Analyze businesses and recommend the optimal ocean strategy. Return valid JSON only.',
        userMessage: prompt,
        maxTokens: 4500,
      });

      const result = JSON.parse(response.content);

      console.log('[OceanStrategy Analyzer] Analysis complete');
      console.log(`  Current ocean: ${result.currentOcean?.ocean || 'unknown'}`);
      console.log(`  Recommended ocean: ${result.recommendedOcean?.ocean || 'unknown'}`);
      console.log(`  Assessments: ${result.oceanAssessments?.length || 0} oceans analyzed`);
      console.log(`  Roadmap phases: ${result.implementationRoadmap?.length || 0}`);

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
      console.error('[OceanStrategy Analyzer] Analysis failed:', error);
      throw error;
    }
  }

  private calculateConfidence(result: any, inputSources: string[]): number {
    let confidence = 0.6;

    confidence += inputSources.length * 0.04;

    if (result.oceanAssessments?.length >= 4) confidence += 0.1;
    else if (result.oceanAssessments?.length >= 2) confidence += 0.05;

    if (result.recommendedOcean?.reasoning?.length > 100) confidence += 0.05;
    if (result.recommendedOcean?.transitionPath?.length >= 3) confidence += 0.05;
    if (result.implementationRoadmap?.length >= 3) confidence += 0.05;
    if (result.hybridStrategy) confidence += 0.03;

    return Math.min(0.95, confidence);
  }
}

export const oceanStrategyAnalyzer = new OceanStrategyAnalyzer();
