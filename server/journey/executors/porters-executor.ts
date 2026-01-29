import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { PortersAnalyzer } from '../../intelligence/porters-analyzer';
import { aiClients } from '../../ai-clients';
import { 
  type PortersOutput, 
  type ForceAnalysis,
  PORTERS_REASONING_STEPS,
  PORTERS_QUALITY_CRITERIA 
} from '@shared/contracts/porters.schema';
import { type PESTLEOutput } from '@shared/contracts/pestle.schema';
import { scoreQuality, type QualityScore } from '@shared/contracts/quality.criteria';
import { applyPESTLEToPortersBridge } from '../bridges/pestle-to-porters-bridge';

/**
 * Porter's Five Forces Framework Executor
 * 
 * Analyzes competitive forces: Threat of New Entrants, Supplier Power, 
 * Buyer Power, Threat of Substitutes, Competitive Rivalry.
 * 
 * CRITICAL: Must incorporate PESTLE context from prior analysis.
 * CRITICAL: Must name specific competitors, suppliers, substitutes.
 * CRITICAL: Each force must have a strategic response.
 */
export class PortersExecutor implements FrameworkExecutor {
  name = 'porters' as const;
  private analyzer = new PortersAnalyzer();

  async validate(context: StrategicContext) {
    const errors: string[] = [];
    
    if (!context.userInput) {
      errors.push('Business context required for Porter\'s Five Forces analysis');
    }
    
    // Warn if PESTLE not available (but don't fail)
    if (!context.insights?.pestleOutput && !context.insights?.trendFactors) {
      console.warn('[Porters Executor] Warning: PESTLE output not available - analysis may be less contextualized');
    }
    
    return { 
      valid: errors.length === 0, 
      errors: errors.length > 0 ? errors : undefined 
    };
  }

  async execute(context: StrategicContext): Promise<PortersOutput> {
    console.log('[Porters Executor] Starting Porter\'s Five Forces competitive analysis...');
    const startTime = Date.now();

    // Extract positioning and PESTLE context
    const positioning = this.extractPositioning(context);
    const businessName = positioning.businessConcept.name;
    const pestleOutput = this.extractPESTLEOutput(context);
    
    // Apply PESTLE → Porter's bridge if PESTLE is available
    let pestleContext: any = null;
    if (pestleOutput) {
      try {
        pestleContext = await applyPESTLEToPortersBridge(pestleOutput as PESTLEOutput, positioning);
        console.log('[Porters Executor] Applied PESTLE bridge:', {
          regulatoryBarriers: pestleContext.forceContext?.threatOfNewEntrants?.regulatoryBarriers?.length || 0,
          tradeRestrictions: pestleContext.forceContext?.supplierPower?.tradeRestrictions?.length || 0,
          economicConditions: pestleContext.forceContext?.buyerPower?.economicConditions?.length || 0,
          techEnablers: pestleContext.forceContext?.threatOfSubstitutes?.techEnablers?.length || 0,
        });
      } catch (error) {
        console.warn('[Porters Executor] Failed to apply PESTLE bridge:', error);
      }
    }

    // Build the cognitive prompt with reasoning steps
    const systemPrompt = this.buildSystemPrompt(businessName);
    const userPrompt = this.buildUserPrompt(positioning, context.userInput, pestleContext);

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt,
        userMessage: userPrompt,
        maxTokens: 6000,
      });

      const portersResults = JSON.parse(response.content);

      // Transform to typed output
      const output = this.transformToTypedOutput(portersResults, positioning, pestleContext, startTime);

      // Score quality
      const qualityScore = this.scoreOutput(output);

      console.log('[Porters Executor] Porter\'s analysis generated');
      console.log(`  Industry: ${output.industryDefinition}`);
      console.log(`  Threat of New Entrants: ${output.forces.threatOfNewEntrants.level} (${output.forces.threatOfNewEntrants.score}/10)`);
      console.log(`  Supplier Power: ${output.forces.supplierPower.level} (${output.forces.supplierPower.score}/10)`);
      console.log(`  Buyer Power: ${output.forces.buyerPower.level} (${output.forces.buyerPower.score}/10)`);
      console.log(`  Threat of Substitutes: ${output.forces.threatOfSubstitutes.level} (${output.forces.threatOfSubstitutes.score}/10)`);
      console.log(`  Competitive Rivalry: ${output.forces.competitiveRivalry.level} (${output.forces.competitiveRivalry.score}/10)`);
      console.log(`  Overall Attractiveness: ${output.overallAttractiveness.assessment} (${output.overallAttractiveness.score}/10)`);
      console.log(`  Competitors identified: ${output.competitorsIdentified.length}`);
      console.log(`  PESTLE connections: ${output.pestleConnections.length}`);
      console.log(`  Quality Score: ${qualityScore.overallScore.toFixed(1)}/10`);

      return output;
    } catch (error) {
      console.error('[Porters Executor] Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Extract positioning from strategic context
   */
  private extractPositioning(context: StrategicContext) {
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
      },
      valueProposition: {
        hypothesis: context.userInput,
      },
    };
  }

  /**
   * Extract PESTLE output from context
   */
  private extractPESTLEOutput(context: StrategicContext): any {
    // Check for typed output first
    if (context.insights?.pestleOutput) {
      return context.insights.pestleOutput;
    }
    
    // Check for legacy trendFactors format
    if (context.insights?.trendFactors) {
      return context.insights.trendFactors;
    }
    
    return null;
  }

  /**
   * Extract business name from context
   */
  private extractBusinessName(context: StrategicContext): string {
    if (context.insights?.positioningOutput?.businessConcept?.name) {
      return context.insights.positioningOutput.businessConcept.name;
    }
    
    const input = context.userInput || '';
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
    
    const input = context.userInput?.toLowerCase() || '';
    const geoPatterns = [
      { pattern: /\buae\b/i, geo: 'UAE' },
      { pattern: /\bdubai\b/i, geo: 'Dubai, UAE' },
      { pattern: /\babu dhabi\b/i, geo: 'Abu Dhabi, UAE' },
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
    return `You are a strategic analyst conducting Porter's Five Forces analysis for "${businessName}".

## CRITICAL RULES
1. Define industry SPECIFICALLY: Not "retail" but "premium sneaker retail in UAE"
2. NAME SPECIFIC competitors, suppliers, substitutes - not generic descriptions
3. INCORPORATE PESTLE context where provided - each force should reference relevant PESTLE factors
4. Each force MUST have a specific STRATEGIC RESPONSE for "${businessName}"
5. Score each force 1-10 and provide level (very_low, low, medium, high, very_high)

## COGNITIVE PROCESS (Follow these steps)
${PORTERS_REASONING_STEPS.map(step => step).join('\n')}

## OUTPUT FORMAT
Return valid JSON matching this structure:
{
  "industryDefinition": "Specific industry definition",
  "forces": {
    "threatOfNewEntrants": {
      "force": "Threat of New Entrants",
      "score": 6,
      "level": "medium",
      "drivers": [{"driver": "...", "explanation": "...", "impact": "increases_force|decreases_force|neutral", "evidence": "..."}],
      "evidence": ["..."],
      "pestleReferences": [{"factorId": "L-1", "factor": "...", "howItAffects": "..."}],
      "strategicResponse": "For ${businessName}, the response is..."
    },
    "supplierPower": { /* same structure */ },
    "buyerPower": { /* same structure */ },
    "threatOfSubstitutes": { /* same structure */ },
    "competitiveRivalry": { /* same structure */ }
  },
  "overallAttractiveness": {
    "score": 6,
    "assessment": "attractive|moderate|unattractive",
    "rationale": "..."
  },
  "strategicImplications": ["..."],
  "pestleConnections": [{"pestleFactorId": "...", "pestleFactor": "...", "affectedForce": "threatOfNewEntrants|supplierPower|buyerPower|threatOfSubstitutes|competitiveRivalry", "howItAffects": "..."}],
  "competitorsIdentified": [{"name": "...", "description": "...", "strengths": ["..."], "weaknesses": ["..."], "marketShare": "..."}],
  "suppliersIdentified": [{"name": "...", "category": "...", "powerLevel": "high|medium|low", "reasoning": "..."}],
  "substitutesIdentified": [{"name": "...", "description": "...", "threatLevel": "high|medium|low", "reasoning": "..."}]
}

Do NOT include any text outside the JSON structure.`;
  }

  /**
   * Build user prompt with context and PESTLE data
   */
  private buildUserPrompt(positioning: any, userInput: string, pestleContext: any): string {
    let pestleSection = '';
    
    if (pestleContext) {
      pestleSection = `
## PESTLE CONTEXT (Use this to inform your analysis)
The following PESTLE factors have been identified and should inform your Five Forces analysis:

### Factors Affecting Entry Barriers:
${JSON.stringify(pestleContext.forceContext?.threatOfNewEntrants || {}, null, 2)}

### Factors Affecting Supplier Power:
${JSON.stringify(pestleContext.forceContext?.supplierPower || {}, null, 2)}

### Factors Affecting Buyer Power:
${JSON.stringify(pestleContext.forceContext?.buyerPower || {}, null, 2)}

### Factors Affecting Substitutes:
${JSON.stringify(pestleContext.forceContext?.threatOfSubstitutes || {}, null, 2)}

Reference these factors in your pestleReferences for each force where relevant.
`;
    }

    return `## BUSINESS CONTEXT
**Name**: ${positioning.businessConcept.name}
**Description**: ${positioning.businessConcept.description}
**Industry**: ${positioning.market.industry}
**Geography**: ${positioning.market.geography}
**Customer**: ${positioning.customer.primarySegment}
**Value Proposition**: ${positioning.valueProposition.hypothesis}

## ORIGINAL USER INPUT
${userInput}
${pestleSection}
## TASK
Conduct a comprehensive Porter's Five Forces analysis for **${positioning.businessConcept.name}** in the **${positioning.market.industry}** industry in **${positioning.market.geography}**.

For EACH of the 5 forces:
1. Score the force (1-10) and assign a level
2. Identify 2-4 specific drivers
3. Name SPECIFIC competitors, suppliers, or substitutes where relevant
4. Reference any relevant PESTLE factors in pestleReferences
5. Provide a specific strategic response for "${positioning.businessConcept.name}"

Return valid JSON only.`;
  }

  /**
   * Transform raw LLM output to typed PortersOutput
   */
  private transformToTypedOutput(
    raw: any, 
    positioning: any,
    pestleContext: any,
    startTime: number
  ): PortersOutput {
    const transformForce = (f: any, forceName: string): ForceAnalysis => ({
      force: f.force || forceName,
      score: f.score || 5,
      level: f.level || 'medium',
      drivers: (f.drivers || []).map((d: any) => ({
        driver: d.driver || d,
        explanation: d.explanation || '',
        impact: d.impact || 'neutral',
        evidence: d.evidence,
        citation: d.citation,
      })),
      evidence: f.evidence || [],
      pestleReferences: (f.pestleReferences || []).map((p: any) => ({
        factorId: p.factorId || p.id || '',
        factor: p.factor || p.description || '',
        howItAffects: p.howItAffects || p.interpretation || '',
      })),
      strategicResponse: f.strategicResponse || `Monitor and respond to changes in this force.`,
      confidence: f.confidence,
    });

    const forces = {
      threatOfNewEntrants: transformForce(raw.forces?.threatOfNewEntrants || raw.threatOfNewEntrants, 'Threat of New Entrants'),
      supplierPower: transformForce(raw.forces?.supplierPower || raw.bargainingPowerOfSuppliers, 'Supplier Power'),
      buyerPower: transformForce(raw.forces?.buyerPower || raw.bargainingPowerOfBuyers, 'Buyer Power'),
      threatOfSubstitutes: transformForce(raw.forces?.threatOfSubstitutes || raw.threatOfSubstitutes, 'Threat of Substitutes'),
      competitiveRivalry: transformForce(raw.forces?.competitiveRivalry || raw.competitiveRivalry, 'Competitive Rivalry'),
    };

    // Calculate average force score
    const avgScore = (
      forces.threatOfNewEntrants.score +
      forces.supplierPower.score +
      forces.buyerPower.score +
      forces.threatOfSubstitutes.score +
      forces.competitiveRivalry.score
    ) / 5;

    // Determine attractiveness (inverse of forces - high forces = less attractive)
    const attractivenessScore = raw.overallAttractiveness?.score || Math.round(10 - avgScore);
    const assessment = attractivenessScore >= 7 ? 'attractive' : attractivenessScore >= 4 ? 'moderate' : 'unattractive';

    return {
      moduleId: 'porters',
      moduleVersion: '2.0.0',
      executedAt: new Date().toISOString(),
      
      qualityScore: 0, // Will be calculated separately
      qualityDetails: [],
      confidenceScore: 0.7,
      
      metadata: {
        executionTimeMs: Date.now() - startTime,
        sourcesUsed: 0,
        limitations: [],
        assumptions: [],
      },
      
      bridgeHints: {
        lowForces: Object.entries(forces)
          .filter(([_, f]) => f.level === 'low' || f.level === 'very_low')
          .map(([name, _]) => name),
        highForces: Object.entries(forces)
          .filter(([_, f]) => f.level === 'high' || f.level === 'very_high')
          .map(([name, _]) => name),
      },
      
      industryDefinition: raw.industryDefinition || `${positioning.market.industry} in ${positioning.market.geography}`,
      forces,
      
      overallAttractiveness: {
        score: attractivenessScore,
        assessment,
        rationale: raw.overallAttractiveness?.rationale || raw.overallAttractiveness?.summary || 
          `Based on five forces analysis, the market is ${assessment}.`,
      },
      
      strategicImplications: raw.strategicImplications || [],
      
      pestleConnections: (raw.pestleConnections || []).map((c: any) => ({
        pestleFactorId: c.pestleFactorId || c.factorId || '',
        pestleFactor: c.pestleFactor || c.factor || '',
        affectedForce: c.affectedForce || 'competitiveRivalry',
        howItAffects: c.howItAffects || c.interpretation || '',
      })),
      
      competitorsIdentified: (raw.competitorsIdentified || raw.competitors || []).map((c: any) => ({
        name: c.name || c,
        description: c.description,
        strengths: c.strengths || [],
        weaknesses: c.weaknesses || [],
        marketShare: c.marketShare,
        citation: c.citation,
      })),
      
      suppliersIdentified: (raw.suppliersIdentified || raw.suppliers || []).map((s: any) => ({
        name: s.name || s,
        category: s.category,
        powerLevel: s.powerLevel,
        reasoning: s.reasoning,
      })),
      
      substitutesIdentified: (raw.substitutesIdentified || raw.substitutes || []).map((s: any) => ({
        name: s.name || s,
        description: s.description,
        threatLevel: s.threatLevel,
        reasoning: s.reasoning,
      })),
      
      summary: {
        strongestForces: Object.entries(forces)
          .filter(([_, f]) => f.score >= 7)
          .map(([name, _]) => name),
        weakestForces: Object.entries(forces)
          .filter(([_, f]) => f.score <= 3)
          .map(([name, _]) => name),
        keyCompetitiveAdvantageOpportunities: raw.strategicImplications?.slice(0, 3) || [],
      },
    };
  }

  /**
   * Score the output quality
   */
  private scoreOutput(output: PortersOutput): QualityScore {
    const qualityCriteria = Object.values(PORTERS_QUALITY_CRITERIA).map(c => ({
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
      autoCheck: (out: unknown) => c.autoCheck(out as PortersOutput),
    }));

    return scoreQuality(output, {} as any, qualityCriteria, 7);
  }
}
