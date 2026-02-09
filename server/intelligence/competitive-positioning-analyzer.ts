/**
 * Competitive Positioning Analyzer
 * Analyzes market position relative to competitors
 * Maps competitive positioning on selected axes
 */

import { aiClients } from '../ai-clients';

export interface CompetitorProfile {
  name: string;
  strengths?: string[];
  weaknesses?: string[];
  marketShare?: number;
  positioning?: string;
}

export interface CompetitivePositioningInput {
  businessContext: string;
  competitors: CompetitorProfile[];
  targetMarket: string;
  bmcOutput?: any;
  portersOutput?: any;
}

export interface PositioningAxis {
  name: string;
  lowEnd: string;
  highEnd: string;
  businessPosition: number;
  competitorPositions: { [competitorName: string]: number };
  rationale: string;
}

export interface CompetitivePositioningOutput {
  positioningMap: PositioningAxis[];
  differentationFactors: {
    factor: string;
    description: string;
    strength: 'unique' | 'strong' | 'moderate' | 'weak';
    defensible: boolean;
    evidence?: string;
  }[];
  competitiveAdvantages: {
    advantage: string;
    type: 'cost' | 'differentiation' | 'focus';
    duration: 'sustainable' | 'temporary';
    description: string;
  }[];
  positioningRecommendation: {
    recommendedPosition: string;
    keyMessage: string;
    targetSegment: string;
    actionPriorities: string[];
    riskFactors: string[];
  };
  competitiveThreats: {
    threat: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    countermeasures: string[];
  }[];
  priorityActions: string[];
  confidence: number;
  metadata: {
    competitorsAnalyzed: number;
    inputSources: string[];
    generatedAt: string;
  };
}

export class CompetitivePositioningAnalyzer {
  async analyze(input: CompetitivePositioningInput): Promise<CompetitivePositioningOutput> {
    console.log('[CompetitivePositioning Analyzer] Starting analysis...');

    const contextParts: string[] = [input.businessContext];
    const inputSources: string[] = ['business_context'];

    contextParts.push(`Target Market: ${input.targetMarket}`);
    contextParts.push(`Competitors Analyzed: ${input.competitors.map(c => c.name).join(', ')}`);
    contextParts.push(`Competitor Details: ${JSON.stringify(input.competitors)}`);

    if (input.bmcOutput) {
      contextParts.push(`Business Model Canvas: ${JSON.stringify(input.bmcOutput)}`);
      inputSources.push('bmc');
    }

    if (input.portersOutput) {
      contextParts.push(`Porter's Five Forces: ${JSON.stringify(input.portersOutput)}`);
      inputSources.push('porters');
    }

    const prompt = `
Analyze the competitive positioning for this business in the target market:

${contextParts.join('\n\n')}

Provide a comprehensive competitive positioning analysis:

1. POSITIONING MAP (Select 2-3 most relevant axes for the market)
   For each axis, provide:
   - Axis name and what it measures
   - Low end descriptor and high end descriptor
   - Business position (1-10 scale)
   - Competitor positions on the same scale
   - Rationale for positioning

   Suggested axes (choose the most relevant):
   - Price vs Quality
   - Innovation vs Stability
   - Breadth vs Depth
   - Convenience vs Experience
   - Mass Market vs Premium

2. DIFFERENTIATION FACTORS (3-5 key ways to differentiate)
   For each factor:
   - Clear factor name
   - Detailed description
   - Strength level: unique/strong/moderate/weak
   - Is it defensible? (true/false)
   - Supporting evidence

3. COMPETITIVE ADVANTAGES (2-4 core advantages)
   For each advantage:
   - Advantage description
   - Type: cost/differentiation/focus
   - Duration: sustainable/temporary
   - How it's achieved

4. POSITIONING RECOMMENDATION
   - Recommended market position
   - Key brand/positioning message
   - Target segment focus
   - Top 3-5 action priorities to achieve positioning
   - Risk factors to monitor

5. COMPETITIVE THREATS (2-3 major threats)
   For each threat:
   - Threat description
   - Severity: high/medium/low
   - Why this is a threat
   - Countermeasures to implement

6. PRIORITY ACTIONS: Top 3-5 immediate actions to strengthen positioning

Return as JSON:
{
  "positioningMap": [
    {
      "name": "",
      "lowEnd": "",
      "highEnd": "",
      "businessPosition": 7,
      "competitorPositions": {"Competitor A": 5, "Competitor B": 8},
      "rationale": ""
    }
  ],
  "differentationFactors": [
    {"factor": "", "description": "", "strength": "unique|strong|moderate|weak", "defensible": true, "evidence": ""}
  ],
  "competitiveAdvantages": [
    {"advantage": "", "type": "cost|differentiation|focus", "duration": "sustainable|temporary", "description": ""}
  ],
  "positioningRecommendation": {
    "recommendedPosition": "",
    "keyMessage": "",
    "targetSegment": "",
    "actionPriorities": [],
    "riskFactors": []
  },
  "competitiveThreats": [
    {"threat": "", "severity": "high|medium|low", "description": "", "countermeasures": []}
  ],
  "priorityActions": []
}
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a competitive strategy expert specializing in positioning analysis. Return only valid JSON.',
        userMessage: prompt,
        maxTokens: 4000,
      });

      const result = JSON.parse(response.content);

      console.log('[CompetitivePositioning Analyzer] Analysis complete');
      console.log(`  Positioning Axes: ${result.positioningMap?.length || 0}`);
      console.log(`  Differentiation Factors: ${result.differentationFactors?.length || 0}`);
      console.log(`  Competitive Advantages: ${result.competitiveAdvantages?.length || 0}`);
      console.log(`  Competitive Threats: ${result.competitiveThreats?.length || 0}`);

      return {
        ...result,
        confidence: this.calculateConfidence(result, inputSources, input.competitors.length),
        metadata: {
          competitorsAnalyzed: input.competitors.length,
          inputSources,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[CompetitivePositioning Analyzer] Analysis failed:', error);
      throw error;
    }
  }

  private calculateConfidence(result: any, inputSources: string[], competitorCount: number): number {
    let confidence = 0.6;

    confidence += inputSources.length * 0.05;
    confidence += Math.min(0.1, competitorCount * 0.025);

    if (result.positioningMap?.length >= 2) confidence += 0.1;
    if (result.differentationFactors?.length >= 3) confidence += 0.05;
    if (result.competitiveAdvantages?.length >= 2) confidence += 0.05;

    return Math.min(0.95, confidence);
  }
}

export const competitivePositioningAnalyzer = new CompetitivePositioningAnalyzer();
