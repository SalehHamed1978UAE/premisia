import Anthropic from '@anthropic-ai/sdk';
import { strategyOntologyService } from '../ontology/strategy-ontology-service';
import { ResearchFindings, Source, Finding } from './market-researcher';

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

export interface PorterForceWithCitations {
  level: 'low' | 'medium' | 'high';
  factors: Array<{
    factor: string;
    citations: string[];
  }>;
  strategic_response: string;
  confidence: 'high' | 'medium' | 'low';
  insufficientData?: boolean;
}

export interface PortersWithCitations {
  competitive_rivalry: PorterForceWithCitations;
  supplier_power: PorterForceWithCitations;
  buyer_power: PorterForceWithCitations;
  threat_of_substitution: PorterForceWithCitations;
  threat_of_new_entry: PorterForceWithCitations;
  overall_attractiveness: 'low' | 'medium' | 'high';
}

export interface Recommendation {
  text: string;
  rationale: string;
  citations: string[];
}

export interface EnhancedAnalysisResult {
  executiveSummary: string;
  portersAnalysis: PortersWithCitations;
  recommendations: Recommendation[];
  researchBased: true;
  confidenceScore: number;
  citations: Source[];
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

  async analyzeWithResearch(
    sessionId: string,
    rootCause: string,
    whysPath: string[],
    research: ResearchFindings,
    input: string
  ): Promise<EnhancedAnalysisResult> {
    const formatFindings = (findings: Finding[]) => 
      findings.map(f => `- ${f.fact} [Citation: ${f.citation}] (Confidence: ${f.confidence})`).join('\n');

    const researchSummary = `
MARKET DYNAMICS:
${formatFindings(research.market_dynamics)}

COMPETITIVE LANDSCAPE:
${formatFindings(research.competitive_landscape)}

LANGUAGE/CULTURAL PREFERENCES:
${formatFindings(research.language_preferences)}

BUYER BEHAVIOR:
${formatFindings(research.buyer_behavior)}

REGULATORY FACTORS:
${formatFindings(research.regulatory_factors)}

AVAILABLE SOURCES:
${research.sources.map(s => `- ${s.title} (${s.url}) - Relevance: ${s.relevance_score}`).join('\n')}
`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are a strategic consultant performing a research-backed Porter's Five Forces analysis.

CRITICAL INSTRUCTIONS:
1. Do NOT make assumptions - only use validated data from the research findings below
2. Cite specific research findings for EVERY statement using the citation URLs
3. If research is inconclusive or missing for any aspect, explicitly state "Insufficient data" and note what additional research is needed
4. Base confidence levels on the quality and quantity of research available
5. All factors and responses must be grounded in the research provided

STRATEGIC CONTEXT:
Root Cause: ${rootCause}

Original Input: ${input.substring(0, 1500)}

Analysis Path (5 Whys):
${whysPath.map((w, i) => `${i + 1}. ${w}`).join('\n')}

RESEARCH FINDINGS:
${researchSummary}

ANALYSIS REQUIREMENTS:

For each of Porter's Five Forces, provide:
1. Level assessment (low/medium/high) based on research
2. Key factors with specific citations from research findings
3. Strategic response grounded in research insights
4. Confidence level (high/medium/low) based on research quality
5. insufficientData flag if research is lacking

Also generate:
1. Executive summary (3-4 sentences) incorporating root cause and key recommendations
2. Strategic recommendations (4-6 actionable recommendations based on Porter's analysis + research)
3. Each recommendation must include text, rationale, and citations

Return ONLY valid JSON with this exact structure (no markdown, no explanation):

{
  "portersAnalysis": {
    "competitive_rivalry": {
      "level": "low|medium|high",
      "factors": [
        {
          "factor": "Specific factor description",
          "citations": ["https://citation-url-1.com", "https://citation-url-2.com"]
        }
      ],
      "strategic_response": "Research-backed strategic response",
      "confidence": "high|medium|low",
      "insufficientData": false
    },
    "supplier_power": {
      "level": "low|medium|high",
      "factors": [
        {
          "factor": "Specific factor description",
          "citations": ["https://citation-url.com"]
        }
      ],
      "strategic_response": "Research-backed strategic response",
      "confidence": "high|medium|low",
      "insufficientData": false
    },
    "buyer_power": {
      "level": "low|medium|high",
      "factors": [
        {
          "factor": "Specific factor description",
          "citations": ["https://citation-url.com"]
        }
      ],
      "strategic_response": "Research-backed strategic response",
      "confidence": "high|medium|low",
      "insufficientData": false
    },
    "threat_of_substitution": {
      "level": "low|medium|high",
      "factors": [
        {
          "factor": "Specific factor description",
          "citations": ["https://citation-url.com"]
        }
      ],
      "strategic_response": "Research-backed strategic response",
      "confidence": "high|medium|low",
      "insufficientData": false
    },
    "threat_of_new_entry": {
      "level": "low|medium|high",
      "factors": [
        {
          "factor": "Specific factor description",
          "citations": ["https://citation-url.com"]
        }
      ],
      "strategic_response": "Research-backed strategic response",
      "confidence": "high|medium|low",
      "insufficientData": false
    },
    "overall_attractiveness": "low|medium|high"
  },
  "recommendations": [
    {
      "text": "Specific actionable recommendation",
      "rationale": "Why this recommendation is important based on analysis",
      "citations": ["https://citation-url.com"]
    }
  ],
  "executiveSummary": "3-4 sentence executive summary incorporating root cause and key strategic recommendations"
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
      throw new Error('Failed to extract JSON from research-backed analysis response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Normalize citations - ensure all factors have citations array
    const normalizeForce = (force: any): PorterForceWithCitations => ({
      level: force.level,
      factors: (force.factors || []).map((f: any) => ({
        factor: typeof f === 'string' ? f : f.factor,
        citations: Array.isArray(f.citations) ? f.citations : []
      })),
      strategic_response: force.strategic_response,
      confidence: force.confidence || 'medium',
      insufficientData: force.insufficientData || false
    });

    const normalizedPorters: PortersWithCitations = {
      competitive_rivalry: normalizeForce(parsed.portersAnalysis.competitive_rivalry),
      supplier_power: normalizeForce(parsed.portersAnalysis.supplier_power),
      buyer_power: normalizeForce(parsed.portersAnalysis.buyer_power),
      threat_of_substitution: normalizeForce(parsed.portersAnalysis.threat_of_substitution),
      threat_of_new_entry: normalizeForce(parsed.portersAnalysis.threat_of_new_entry),
      overall_attractiveness: parsed.portersAnalysis.overall_attractiveness || 'medium'
    };

    const normalizedRecommendations: Recommendation[] = (parsed.recommendations || []).map((r: any) => ({
      text: r.text,
      rationale: r.rationale,
      citations: Array.isArray(r.citations) ? r.citations : []
    }));

    const confidenceScore = this.calculateOverallConfidence(normalizedPorters, research);

    return {
      executiveSummary: parsed.executiveSummary,
      portersAnalysis: normalizedPorters,
      recommendations: normalizedRecommendations,
      researchBased: true,
      confidenceScore,
      citations: research.sources,
    };
  }

  private calculateOverallConfidence(porters: PortersWithCitations, research: ResearchFindings): number {
    const confidenceMap = { high: 100, medium: 60, low: 30 };
    
    const forceConfidences = [
      porters.competitive_rivalry.confidence,
      porters.supplier_power.confidence,
      porters.buyer_power.confidence,
      porters.threat_of_substitution.confidence,
      porters.threat_of_new_entry.confidence,
    ];

    const avgForceConfidence = forceConfidences.reduce((sum, c) => sum + confidenceMap[c], 0) / forceConfidences.length;

    const totalFindings = 
      research.market_dynamics.length +
      research.competitive_landscape.length +
      research.language_preferences.length +
      research.buyer_behavior.length +
      research.regulatory_factors.length;

    const highConfidenceFindings = [
      ...research.market_dynamics,
      ...research.competitive_landscape,
      ...research.language_preferences,
      ...research.buyer_behavior,
      ...research.regulatory_factors,
    ].filter(f => f.confidence === 'high').length;

    const researchQuality = totalFindings > 0 ? (highConfidenceFindings / totalFindings) * 100 : 0;

    const insufficientDataPenalty = [
      porters.competitive_rivalry.insufficientData,
      porters.supplier_power.insufficientData,
      porters.buyer_power.insufficientData,
      porters.threat_of_substitution.insufficientData,
      porters.threat_of_new_entry.insufficientData,
    ].filter(Boolean).length * 10;

    const baseScore = (avgForceConfidence * 0.6) + (researchQuality * 0.4);
    const finalScore = Math.max(0, Math.min(100, baseScore - insufficientDataPenalty));

    return Math.round(finalScore);
  }

  private createExecutiveSummary(
    rootCause: string,
    recommendations: Recommendation[],
    research: ResearchFindings
  ): string {
    const topRecommendations = recommendations.slice(0, 3).map(r => r.text).join('; ');
    
    const keyInsights = [
      research.market_dynamics[0]?.fact,
      research.competitive_landscape[0]?.fact,
    ].filter(Boolean).join('. ');

    return `Based on the root cause of "${rootCause}" and comprehensive market research, the strategic analysis reveals: ${keyInsights}. Key recommendations include: ${topRecommendations}.`;
  }
}
