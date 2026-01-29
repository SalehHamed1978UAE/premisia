import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { PESTLEAnalyzer } from '../../intelligence/pestle-analyzer';
import { aiClients } from '../../ai-clients';
import { 
  type PESTLEOutput, 
  type PESTLEFactor,
  PESTLE_REASONING_STEPS,
  PESTLE_QUALITY_CRITERIA 
} from '@shared/contracts/pestle.schema';
import { extractPositioningFromUnderstanding } from '@shared/contracts/positioning.schema';
import { scoreQuality, type QualityScore } from '@shared/contracts/quality.criteria';

/**
 * PESTLE Framework Executor
 * 
 * Analyzes macro-environmental factors: Political, Economic, Social, 
 * Technological, Legal, Environmental.
 * 
 * CRITICAL: Every factor must be SPECIFIC to this business, not generic.
 * CRITICAL: Every factor must have an IMPLICATION for the business.
 * CRITICAL: Factors should be CITED where possible.
 */
export class PESTLEExecutor implements FrameworkExecutor {
  name = 'pestle' as const;
  private analyzer = new PESTLEAnalyzer();

  async validate(context: StrategicContext) {
    const errors: string[] = [];
    
    if (!context.userInput) {
      errors.push('Business context required for PESTLE analysis');
    }
    
    if (context.userInput && context.userInput.length < 20) {
      errors.push('Business context too short - provide more detail');
    }
    
    return { 
      valid: errors.length === 0, 
      errors: errors.length > 0 ? errors : undefined 
    };
  }

  async execute(context: StrategicContext): Promise<PESTLEOutput> {
    console.log('[PESTLE Executor] Starting PESTLE macro-environmental analysis...');
    const startTime = Date.now();

    // Extract positioning from context
    const positioning = this.extractPositioning(context);
    const businessName = positioning.businessConcept.name;
    const geography = positioning.market.geography;
    const industry = positioning.market.industry;

    // Build the cognitive prompt with reasoning steps
    const systemPrompt = this.buildSystemPrompt(businessName);
    const userPrompt = this.buildUserPrompt(positioning, context.userInput);

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt,
        userMessage: userPrompt,
        maxTokens: 6000,
      });

      const pestleResults = JSON.parse(response.content);

      // Transform to typed output
      const output = this.transformToTypedOutput(pestleResults, positioning, startTime);

      // Score quality
      const qualityScore = this.scoreOutput(output, positioning);

      console.log('[PESTLE Executor] PESTLE analysis generated');
      console.log(`  Scope: ${output.scope}`);
      console.log(`  Political factors: ${output.factors.political.length}`);
      console.log(`  Economic factors: ${output.factors.economic.length}`);
      console.log(`  Social factors: ${output.factors.social.length}`);
      console.log(`  Technological factors: ${output.factors.technological.length}`);
      console.log(`  Legal factors: ${output.factors.legal.length}`);
      console.log(`  Environmental factors: ${output.factors.environmental.length}`);
      console.log(`  Quality Score: ${qualityScore.overallScore.toFixed(1)}/10`);

      return output;
    } catch (error) {
      console.error('[PESTLE Executor] Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Extract positioning from strategic context
   */
  private extractPositioning(context: StrategicContext) {
    // If we have a proper strategic understanding, use it
    // Otherwise, construct from available data
    return {
      businessConcept: {
        name: this.extractBusinessName(context),
        description: context.userInput,
        category: 'Business',
      },
      market: {
        industry: this.extractIndustry(context),
        industryNarrow: undefined,
        geography: this.extractGeography(context),
        geographyScope: 'country' as const,
      },
      customer: {
        primarySegment: 'Target customers',
        secondarySegments: [],
        demographicProfile: undefined,
      },
      valueProposition: {
        hypothesis: context.userInput,
        keyDifferentiators: [],
      },
      strategicQuestion: 'What external factors affect this business?',
      analysisScope: {
        inScope: ['PESTLE analysis'],
        outOfScope: [],
        timeHorizon: '12 months',
      },
      ventureType: 'new_venture' as const,
    };
  }

  /**
   * Extract business name from context
   */
  private extractBusinessName(context: StrategicContext): string {
    // Try to get from insights if available
    if (context.insights?.positioningOutput?.businessConcept?.name) {
      return context.insights.positioningOutput.businessConcept.name;
    }
    
    // Extract from user input
    const input = context.userInput || '';
    
    // Look for patterns like "called X" or "named X"
    const patterns = [
      /(?:called|named)\s+["']?([^"'\n,]+)["']?/i,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:is|will|would)/,
    ];
    
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Fallback
    return input.slice(0, 50).trim() || 'The Business';
  }

  /**
   * Extract industry from context
   */
  private extractIndustry(context: StrategicContext): string {
    if (context.insights?.positioningOutput?.market?.industry) {
      return context.insights.positioningOutput.market.industry;
    }
    return 'General Business';
  }

  /**
   * Extract geography from context
   */
  private extractGeography(context: StrategicContext): string {
    if (context.insights?.positioningOutput?.market?.geography) {
      return context.insights.positioningOutput.market.geography;
    }
    
    // Try to extract from user input
    const input = context.userInput?.toLowerCase() || '';
    const geoPatterns = [
      { pattern: /\buae\b/i, geo: 'UAE' },
      { pattern: /\bdubai\b/i, geo: 'Dubai, UAE' },
      { pattern: /\babu dhabi\b/i, geo: 'Abu Dhabi, UAE' },
      { pattern: /\bunited states\b|\busa\b|\bu\.s\./i, geo: 'United States' },
      { pattern: /\buk\b|\bunited kingdom\b/i, geo: 'United Kingdom' },
    ];
    
    for (const { pattern, geo } of geoPatterns) {
      if (pattern.test(input)) {
        return geo;
      }
    }
    
    return 'Global';
  }

  /**
   * Build system prompt with cognitive instructions
   */
  private buildSystemPrompt(businessName: string): string {
    return `You are a strategic analyst conducting a PESTLE analysis for "${businessName}".

## CRITICAL RULES
1. EVERY factor MUST mention "${businessName}" specifically - NOT generic statements
2. EVERY factor MUST have a citation or be marked as "inferred"  
3. EVERY factor MUST end with an implication: "For ${businessName}, this means..."
4. PRIORITIZE top 5-7 factors by impact on THIS business

## COGNITIVE PROCESS (Follow these steps)
${PESTLE_REASONING_STEPS.map(step => step).join('\n')}

## OUTPUT FORMAT
Return valid JSON matching this structure exactly:
{
  "scope": "string describing what environment we're analyzing",
  "factors": {
    "political": [{ "id": "P-1", "category": "P", "factor": "...", "description": "...", "impact": "opportunity|threat|neutral", "magnitude": "high|medium|low", "implication": "For ${businessName}, this means...", "evidence": "...", "citation": {"url": "...", "title": "...", "date": "..."}, "confidence": "verified|researched|inferred" }],
    "economic": [...],
    "social": [...],
    "technological": [...],
    "legal": [...],
    "environmental": [...]
  },
  "prioritizedFactors": [/* top 5-7 most impactful factors */],
  "opportunities": [{ "id": "OPP-1", "description": "...", "sourceFactors": ["P-1"], "magnitude": "high|medium|low" }],
  "threats": [{ "id": "THR-1", "description": "...", "sourceFactors": ["E-2"], "magnitude": "high|medium|low", "likelihood": "high|medium|low" }],
  "researchGaps": ["..."],
  "assumptions": ["..."],
  "confidenceLevel": "high|medium|low",
  "summary": {
    "keyFavorableFactors": ["..."],
    "keyUnfavorableFactors": ["..."],
    "overallAssessment": "..."
  }
}

Do NOT include any text outside the JSON structure.`;
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(positioning: any, userInput: string): string {
    return `## BUSINESS CONTEXT
**Name**: ${positioning.businessConcept.name}
**Description**: ${positioning.businessConcept.description}
**Industry**: ${positioning.market.industry}
**Geography**: ${positioning.market.geography}
**Customer**: ${positioning.customer.primarySegment}
**Value Proposition**: ${positioning.valueProposition.hypothesis}

## ORIGINAL USER INPUT
${userInput}

## TASK
Conduct a comprehensive PESTLE analysis for **${positioning.businessConcept.name}** in **${positioning.market.geography}**.

For EACH of the 6 PESTLE categories:
1. Identify 2-4 specific factors relevant to this business in this geography
2. For each factor, provide the full structure as specified
3. Ensure every implication mentions "${positioning.businessConcept.name}" by name

After all categories, identify the top 5-7 prioritizedFactors by strategic impact.
Derive opportunities and threats from the factors.
Note any research gaps and assumptions.

Return valid JSON only.`;
  }

  /**
   * Transform raw LLM output to typed PESTLEOutput
   */
  private transformToTypedOutput(
    raw: any, 
    positioning: any,
    startTime: number
  ): PESTLEOutput {
    const transformFactor = (f: any, category: string, index: number): PESTLEFactor => ({
      id: f.id || `${category}-${index + 1}`,
      category: category as any,
      factor: f.factor || f.description || 'Unknown factor',
      description: f.description || f.factor || '',
      impact: f.impact || 'neutral',
      magnitude: f.magnitude || 'medium',
      implication: f.implication || `For ${positioning.businessConcept.name}, this factor should be monitored.`,
      evidence: f.evidence || 'Based on general market knowledge',
      citation: f.citation,
      confidence: f.confidence || 'inferred',
      timeframe: f.timeframe,
    });

    const factors = {
      political: (raw.factors?.political || []).map((f: any, i: number) => transformFactor(f, 'P', i)),
      economic: (raw.factors?.economic || []).map((f: any, i: number) => transformFactor(f, 'E', i)),
      social: (raw.factors?.social || []).map((f: any, i: number) => transformFactor(f, 'S', i)),
      technological: (raw.factors?.technological || []).map((f: any, i: number) => transformFactor(f, 'T', i)),
      legal: (raw.factors?.legal || []).map((f: any, i: number) => transformFactor(f, 'L', i)),
      environmental: (raw.factors?.environmental || []).map((f: any, i: number) => transformFactor(f, 'ENV', i)),
    };

    const allFactors = [
      ...factors.political,
      ...factors.economic,
      ...factors.social,
      ...factors.technological,
      ...factors.legal,
      ...factors.environmental,
    ];

    // Build prioritized factors
    const prioritizedFactors = (raw.prioritizedFactors || []).map((f: any, i: number) => {
      // Try to find the full factor from our processed factors
      const found = allFactors.find(af => af.id === f.id || af.factor === f.factor);
      return found || transformFactor(f, f.category || 'P', i);
    });

    return {
      moduleId: 'pestle',
      moduleVersion: '2.0.0',
      executedAt: new Date().toISOString(),
      
      qualityScore: 0, // Will be calculated separately
      qualityDetails: [],
      confidenceScore: raw.confidenceLevel === 'high' ? 0.8 : raw.confidenceLevel === 'medium' ? 0.6 : 0.4,
      
      metadata: {
        executionTimeMs: Date.now() - startTime,
        sourcesUsed: allFactors.filter(f => f.citation?.url).length,
        limitations: raw.researchGaps || [],
        assumptions: raw.assumptions || [],
      },
      
      bridgeHints: {
        highImpactLegalFactors: factors.legal.filter(f => f.magnitude === 'high'),
        economicGrowthFactors: factors.economic.filter(f => f.factor.toLowerCase().includes('growth')),
        techDisruptors: factors.technological.filter(f => f.impact === 'threat'),
      },
      
      scope: raw.scope || `${positioning.market.geography} market for ${positioning.market.industry}`,
      factors,
      prioritizedFactors: prioritizedFactors.slice(0, 7),
      
      opportunities: (raw.opportunities || []).map((o: any, i: number) => ({
        id: o.id || `OPP-${i + 1}`,
        description: o.description,
        sourceFactors: o.sourceFactors || [],
        magnitude: o.magnitude || 'medium',
        timeframe: o.timeframe,
      })),
      
      threats: (raw.threats || []).map((t: any, i: number) => ({
        id: t.id || `THR-${i + 1}`,
        description: t.description,
        sourceFactors: t.sourceFactors || [],
        magnitude: t.magnitude || 'medium',
        likelihood: t.likelihood,
        mitigationSuggestion: t.mitigationSuggestion,
      })),
      
      researchGaps: raw.researchGaps || [],
      assumptions: raw.assumptions || [],
      confidenceLevel: raw.confidenceLevel || 'medium',
      
      summary: {
        keyFavorableFactors: raw.summary?.keyFavorableFactors || [],
        keyUnfavorableFactors: raw.summary?.keyUnfavorableFactors || [],
        overallAssessment: raw.summary?.overallAssessment || 'Analysis complete',
      },
    };
  }

  /**
   * Score the output quality
   */
  private scoreOutput(output: PESTLEOutput, positioning: any): QualityScore {
    const qualityCriteria = Object.values(PESTLE_QUALITY_CRITERIA).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      weight: c.weight,
      rubric: {
        score1to3: 'Poor',
        score4to6: 'Fair',
        score7to8: 'Good',
        score9to10: 'Excellent',
      },
      redFlags: [],
      autoCheck: (out: unknown) => c.autoCheck(out as PESTLEOutput, positioning),
    }));

    return scoreQuality(output, { positioning } as any, qualityCriteria, 7);
  }
}
