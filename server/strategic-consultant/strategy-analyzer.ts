import Anthropic from '@anthropic-ai/sdk';
import { strategyOntologyService } from '../ontology/strategy-ontology-service';

export interface FiveWhysAnalysis {
  problem_statement: string;
  why_1: { question: string; answer: string };
  why_2: { question: string; answer: string };
  why_3: { question: string; answer: string };
  why_4: { question: string; answer: string };
  why_5: { question: string; answer: string };
  root_cause: string;
  strategic_implications: string[];
}

export interface PortersFiveForcesAnalysis {
  competitive_rivalry: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    strategic_response: string;
  };
  supplier_power: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    strategic_response: string;
  };
  buyer_power: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    strategic_response: string;
  };
  threat_of_substitution: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    strategic_response: string;
  };
  threat_of_new_entry: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    strategic_response: string;
  };
  overall_attractiveness: 'low' | 'medium' | 'high';
  key_strategic_priorities: string[];
}

export interface StrategyAnalysis {
  five_whys: FiveWhysAnalysis;
  porters_five_forces: PortersFiveForcesAnalysis;
  recommended_approaches: string[];
  recommended_market: string;
  executive_summary: string;
}

export class StrategyAnalyzer {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  async analyzeFiveWhys(input: string): Promise<FiveWhysAnalysis> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are a strategic consultant performing a 5 Whys root cause analysis.

INPUT:
${input}

Perform a systematic 5 Whys analysis to identify the root problem being solved. Return ONLY valid JSON with this exact structure (no markdown, no explanation):

{
  "problem_statement": "The core problem statement",
  "why_1": {
    "question": "Why question 1",
    "answer": "Answer 1"
  },
  "why_2": {
    "question": "Why question 2",
    "answer": "Answer 2"
  },
  "why_3": {
    "question": "Why question 3",
    "answer": "Answer 3"
  },
  "why_4": {
    "question": "Why question 4",
    "answer": "Answer 4"
  },
  "why_5": {
    "question": "Why question 5",
    "answer": "Answer 5"
  },
  "root_cause": "The fundamental root cause identified",
  "strategic_implications": ["implication 1", "implication 2", "implication 3"]
}`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from 5 Whys analysis response');
    }

    return JSON.parse(jsonMatch[0]);
  }

  async analyzePortersFiveForces(input: string): Promise<PortersFiveForcesAnalysis> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are a strategic consultant performing Porter's Five Forces analysis.

INPUT:
${input}

Analyze the competitive environment using Porter's Five Forces. Return ONLY valid JSON with this exact structure (no markdown, no explanation):

{
  "competitive_rivalry": {
    "level": "low|medium|high",
    "factors": ["factor 1", "factor 2", "factor 3"],
    "strategic_response": "Strategic response to competitive rivalry"
  },
  "supplier_power": {
    "level": "low|medium|high",
    "factors": ["factor 1", "factor 2"],
    "strategic_response": "Strategic response to supplier power"
  },
  "buyer_power": {
    "level": "low|medium|high",
    "factors": ["factor 1", "factor 2"],
    "strategic_response": "Strategic response to buyer power"
  },
  "threat_of_substitution": {
    "level": "low|medium|high",
    "factors": ["factor 1", "factor 2"],
    "strategic_response": "Strategic response to substitution threat"
  },
  "threat_of_new_entry": {
    "level": "low|medium|high",
    "factors": ["factor 1", "factor 2"],
    "strategic_response": "Strategic response to new entry threat"
  },
  "overall_attractiveness": "low|medium|high",
  "key_strategic_priorities": ["priority 1", "priority 2", "priority 3"]
}`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Porter\'s Five Forces analysis response');
    }

    return JSON.parse(jsonMatch[0]);
  }

  async recommendStrategy(
    fiveWhys: FiveWhysAnalysis,
    porters: PortersFiveForcesAnalysis,
    originalInput: string
  ): Promise<{ recommended_approaches: string[]; recommended_market: string; executive_summary: string }> {
    const approaches = strategyOntologyService.getStrategicApproaches();
    const markets = strategyOntologyService.getMarketContexts();

    const approachesDesc = Object.entries(approaches)
      .map(([id, approach]) => `- ${id}: ${approach.label} - Requires: ${approach.requires.join(', ')}`)
      .join('\n');

    const marketsDesc = Object.entries(markets)
      .map(([id, market]) => `- ${id}: ${market.label} - Requirements: ${market.requirements.join(', ')}`)
      .join('\n');

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are a strategic consultant making final strategic recommendations.

ORIGINAL INPUT:
${originalInput.substring(0, 2000)}

5 WHYS ANALYSIS:
Root Cause: ${fiveWhys.root_cause}
Strategic Implications: ${fiveWhys.strategic_implications.join(', ')}

PORTER'S FIVE FORCES:
Overall Attractiveness: ${porters.overall_attractiveness}
Key Priorities: ${porters.key_strategic_priorities.join(', ')}

AVAILABLE STRATEGIC APPROACHES:
${approachesDesc}

AVAILABLE MARKETS:
${marketsDesc}

Based on the analysis, recommend:
1. 1-3 strategic approaches that best fit (use IDs: cost_leadership, differentiation_service, or blue_ocean)
2. 1 target market (use IDs: uae or usa)
3. Executive summary (2-3 sentences)

Return ONLY valid JSON (no markdown, no explanation):

{
  "recommended_approaches": ["approach_id_1", "approach_id_2"],
  "recommended_market": "market_id",
  "executive_summary": "2-3 sentence summary of strategic recommendation"
}`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from strategy recommendation response');
    }

    return JSON.parse(jsonMatch[0]);
  }

  async performFullAnalysis(input: string): Promise<StrategyAnalysis> {
    const [fiveWhys, porters] = await Promise.all([
      this.analyzeFiveWhys(input),
      this.analyzePortersFiveForces(input),
    ]);

    const recommendation = await this.recommendStrategy(fiveWhys, porters, input);

    return {
      five_whys: fiveWhys,
      porters_five_forces: porters,
      recommended_approaches: recommendation.recommended_approaches,
      recommended_market: recommendation.recommended_market,
      executive_summary: recommendation.executive_summary,
    };
  }
}
