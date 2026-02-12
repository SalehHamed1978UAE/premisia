import Anthropic from '@anthropic-ai/sdk';
import { strategyOntologyService } from '../ontology/strategy-ontology-service';
import { ResearchFindings, Source, Finding } from './market-researcher';
import { groundStrategicAnalysis, isContextFoundryConfigured, orchestrateAnalysis, OrchestrationResult } from '../services/grounded-analysis-service';
import { ContextBundle } from '../services/context-foundry-client';
import { whysPathToText } from '../utils/whys-path';

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
  confidenceExplanation: string;
  citations: Source[];
}

export class StrategyAnalyzer {
  private anthropic: Anthropic;
  private useGrounding: boolean;

  constructor(options?: { useGrounding?: boolean }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
    this.useGrounding = options?.useGrounding ?? isContextFoundryConfigured();
  }

  /**
   * Analyze Five Whys with optional Context Foundry grounding
   * Note: focalEntity parameter is now deprecated - CF handles entity extraction internally
   */
  async analyzeFiveWhys(input: string, _focalEntity?: string): Promise<FiveWhysAnalysis & { groundingContext?: ContextBundle | null; flaggedAssumptions?: string[]; externalClaimsForWebSearch?: string[] }> {
    let analysisInput = input;
    let groundingContext: ContextBundle | null = null;
    let flaggedAssumptions: string[] = [];
    let externalClaimsForWebSearch: string[] = [];

    // Apply intelligent routing orchestration if configured
    // Now sends raw text to CF - entity extraction happens server-side
    if (this.useGrounding) {
      try {
        const orchestration = await orchestrateAnalysis(input, 'five_whys');
        analysisInput = orchestration.groundedPrompt;
        groundingContext = orchestration.cfContext;
        flaggedAssumptions = orchestration.flaggedAssumptions;
        externalClaimsForWebSearch = orchestration.externalClaimsForWebSearch;
        console.log('[StrategyAnalyzer] Five Whys analysis orchestrated with intelligent routing');
      } catch (error) {
        console.warn('[StrategyAnalyzer] Orchestration failed, proceeding without:', error);
      }
    }

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are a strategic business consultant performing a 5 Whys root cause analysis.

CRITICAL: Focus on PRACTICAL BUSINESS REASONING, not cultural anthropology or academic analysis.

Each "Why?" should probe these BUSINESS dimensions:
- Market conditions and dynamics
- Competitive positioning and dynamics
- Product capabilities and differentiation
- Customer needs and pain points
- Resource constraints and capabilities

INPUT:
${analysisInput}

Perform a systematic 5 Whys analysis using business-focused causal reasoning. Each answer should address practical business factors, NOT cultural or anthropological theories.

WRONG: "Arabic reflects deep cultural identity and power structures..."
RIGHT: "Arabic language support addresses a market gap where 60% of regional buyers prefer native-language interfaces..."

Return ONLY valid JSON with this exact structure (no markdown, no explanation):

{
  "problem_statement": "The core business problem statement",
  "why_1": {
    "question": "Why question 1 (focused on business/market factors)",
    "answer": "Business-focused answer (market conditions, competitive dynamics, customer needs)"
  },
  "why_2": {
    "question": "Why question 2 (focused on business/market factors)",
    "answer": "Business-focused answer (product capabilities, resource constraints)"
  },
  "why_3": {
    "question": "Why question 3 (focused on business/market factors)",
    "answer": "Business-focused answer (competitive positioning, market dynamics)"
  },
  "why_4": {
    "question": "Why question 4 (focused on business/market factors)",
    "answer": "Business-focused answer (customer needs, market opportunities)"
  },
  "why_5": {
    "question": "Why question 5 (focused on business/market factors)",
    "answer": "Business-focused answer (strategic positioning, market fit)"
  },
  "root_cause": "The fundamental business problem or opportunity identified",
  "strategic_implications": ["business implication 1", "business implication 2", "business implication 3"]
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

    const result = JSON.parse(jsonMatch[0]);
    return { ...result, groundingContext, flaggedAssumptions, externalClaimsForWebSearch };
  }

  /**
   * Analyze Porter's Five Forces with optional Context Foundry grounding
   * Note: focalEntity parameter is now deprecated - CF handles entity extraction internally
   */
  async analyzePortersFiveForces(input: string, _focalEntity?: string): Promise<PortersFiveForcesAnalysis & { groundingContext?: ContextBundle | null; flaggedAssumptions?: string[]; externalClaimsForWebSearch?: string[] }> {
    let analysisInput = input;
    let groundingContext: ContextBundle | null = null;
    let flaggedAssumptions: string[] = [];
    let externalClaimsForWebSearch: string[] = [];

    // Apply intelligent routing orchestration if configured
    // Now sends raw text to CF - entity extraction happens server-side
    if (this.useGrounding) {
      try {
        const orchestration = await orchestrateAnalysis(input, 'porters');
        analysisInput = orchestration.groundedPrompt;
        groundingContext = orchestration.cfContext;
        flaggedAssumptions = orchestration.flaggedAssumptions;
        externalClaimsForWebSearch = orchestration.externalClaimsForWebSearch;
        console.log('[StrategyAnalyzer] Porter\'s analysis orchestrated with intelligent routing');
      } catch (error) {
        console.warn('[StrategyAnalyzer] Orchestration failed, proceeding without:', error);
      }
    }
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are a strategic consultant performing Porter's Five Forces analysis.

INPUT:
${analysisInput}

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

    const result = JSON.parse(jsonMatch[0]);
    return { ...result, groundingContext, flaggedAssumptions, externalClaimsForWebSearch };
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
    whysPath: any[],
    research: ResearchFindings,
    input: string
  ): Promise<EnhancedAnalysisResult> {
    const whysPathText = whysPathToText(whysPath);
    const findValidation = (fact: string) => {
      if (!research.validation) return null;
      const factLower = fact.toLowerCase().replace(/[^\w\s]/g, '').trim();
      return research.validation.find(v => {
        const vClaimLower = v.claim.toLowerCase().replace(/[^\w\s]/g, '').trim();
        return factLower.includes(vClaimLower) || vClaimLower.includes(factLower);
      });
    };

    const formatFindings = (findings: Finding[]) => 
      findings.map(f => {
        const validation = findValidation(f.fact);
        let validationNote = '';
        if (validation) {
          if (validation.strength === 'WEAK') {
            validationNote = ` [⚠️ WEAK VALIDATION: ${validation.details}]`;
          } else if (validation.strength === 'MODERATE') {
            validationNote = ` [⚡ MODERATE VALIDATION: ${validation.details}]`;
          }
        }
        return `- ${f.fact}${validationNote} [Citation: ${f.citation}] (Confidence: ${f.confidence})`;
      }).join('\n');

    const validationSummary = research.validation && research.validation.length > 0 
      ? `\nVALIDATION WARNINGS:\n${research.validation
          .filter(v => v.strength !== 'STRONG')
          .map(v => `- ${v.claim}: ${v.strength} (${v.details})`)
          .join('\n')}`
      : '';

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
${validationSummary}

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

VALIDATION-AWARE ANALYSIS:
6. Research findings are marked with validation strength: ⚠️ WEAK or ⚡ MODERATE
7. When using WEAK findings, use qualifying language:
   - Instead of: "95% of AI projects are failing"
   - Write: "Some older studies from 2021 suggest high failure rates (95%), though this data is contested and may be outdated"
   - Or: "Contested research indicates potential challenges with AI project success"
8. WEAK validation means: outdated data (>2 years old), single-source claims, or contradicted by other evidence
9. Never state WEAK claims as definitive facts - always qualify them with appropriate caveats
10. Lower confidence scores for analysis based primarily on WEAK validation findings

STRATEGIC CONTEXT:
Root Cause: ${rootCause}

Original Input: ${input.substring(0, 1500)}

Analysis Path (5 Whys):
${whysPathText.map((w, i) => `${i + 1}. ${w}`).join('\n')}

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
    const confidenceExplanation = this.generateConfidenceExplanation(confidenceScore, normalizedPorters, research, input);

    return {
      executiveSummary: parsed.executiveSummary,
      portersAnalysis: normalizedPorters,
      recommendations: normalizedRecommendations,
      researchBased: true,
      confidenceScore,
      confidenceExplanation,
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

  private generateConfidenceExplanation(
    score: number,
    porters: PortersWithCitations,
    research: ResearchFindings,
    originalInput: string
  ): string {
    const explanationParts: string[] = [];

    // Overall assessment
    if (score < 40) {
      explanationParts.push(`Low confidence (${score}%) due to:`);
    } else if (score < 70) {
      explanationParts.push(`Moderate confidence (${score}%) due to:`);
    } else {
      explanationParts.push(`High confidence (${score}%) due to:`);
    }

    // Research quality assessment
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

    if (totalFindings < 10) {
      explanationParts.push(`- Limited research data (only ${totalFindings} findings)`);
    }

    if (highConfidenceFindings < totalFindings * 0.5) {
      explanationParts.push(`- Low research quality (only ${highConfidenceFindings}/${totalFindings} high-confidence findings)`);
    }

    // Check for insufficient data flags
    const insufficientDataCount = [
      porters.competitive_rivalry.insufficientData,
      porters.supplier_power.insufficientData,
      porters.buyer_power.insufficientData,
      porters.threat_of_substitution.insufficientData,
      porters.threat_of_new_entry.insufficientData,
    ].filter(Boolean).length;

    if (insufficientDataCount > 0) {
      explanationParts.push(`- ${insufficientDataCount} of 5 Porter's forces lack sufficient research data`);
    }

    // Check for contradictions to input assumptions
    const inputLower = originalInput.toLowerCase();
    const contradictions: string[] = [];

    // Check language preferences for contradictions
    research.language_preferences.forEach(finding => {
      const factLower = finding.fact.toLowerCase();
      
      // If input mentions Arabic but research shows English dominance
      if ((inputLower.includes('arabic') || inputLower.includes('عربي')) && 
          (factLower.includes('english') && (factLower.includes('dominat') || factLower.includes('prefer') || factLower.includes('primary')))) {
        contradictions.push(`Research shows English dominance, contradicting any Arabic differentiation assumption: "${finding.fact}"`);
      }
      
      // Generic contradiction detection
      if (inputLower.includes('differentiat') && factLower.includes('not') && factLower.includes('differentiat')) {
        contradictions.push(`Research questions differentiation assumption: "${finding.fact}"`);
      }
    });

    if (contradictions.length > 0) {
      explanationParts.push(`\n\nKEY CONTRADICTIONS TO INPUT:`);
      contradictions.forEach(c => explanationParts.push(`- ${c}`));
    }

    return explanationParts.join('\n');
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
