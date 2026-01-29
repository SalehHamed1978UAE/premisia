import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { SWOTAnalyzer, type SWOTInput } from '../../intelligence/swot-analyzer';
import { aiClients } from '../../ai-clients';
import { 
  type SWOTOutput, 
  type SWOTItem,
  type Strategy,
  SWOT_REASONING_STEPS_NEW_VENTURE,
  SWOT_REASONING_STEPS_EXISTING_BUSINESS,
  SWOT_QUALITY_CRITERIA,
  NewVentureStrengthCategories,
  NewVentureWeaknessCategories,
} from '@shared/contracts/swot.schema';
import { type PESTLEOutput } from '@shared/contracts/pestle.schema';
import { type PortersOutput } from '@shared/contracts/porters.schema';
import { scoreQuality, type QualityScore } from '@shared/contracts/quality.criteria';
import { applyPortersToSWOTBridge } from '../bridges/porters-to-swot-bridge';

/**
 * SWOT Framework Executor
 * 
 * Synthesizes external analysis (PESTLE, Porter's) with internal assessment
 * to define strategic position.
 * 
 * CRITICAL: Different handling for new ventures vs existing businesses.
 * CRITICAL: O/T must trace back to PESTLE and Porter's outputs.
 * CRITICAL: S/W for new ventures use 5 pre-operational categories.
 */
export class SWOTExecutor implements FrameworkExecutor {
  name = 'swot' as const;
  private analyzer = new SWOTAnalyzer();

  async validate(context: StrategicContext) {
    const errors: string[] = [];
    
    if (!context.userInput) {
      errors.push('Business context required for SWOT analysis');
    }
    
    // Check for prior analyses (warn if missing, but don't fail)
    if (!context.insights?.pestleOutput && !context.insights?.trendFactors) {
      console.warn('[SWOT Executor] Warning: PESTLE output not available');
    }
    
    if (!context.insights?.portersOutput && !context.insights?.portersForces) {
      console.warn('[SWOT Executor] Warning: Porter\'s output not available');
    }
    
    return { 
      valid: errors.length === 0, 
      errors: errors.length > 0 ? errors : undefined 
    };
  }

  async execute(context: StrategicContext): Promise<SWOTOutput> {
    console.log('[SWOT Executor] Starting SWOT analysis...');
    const startTime = Date.now();

    // Extract positioning and prior analyses
    const positioning = this.extractPositioning(context);
    const businessName = positioning.businessConcept.name;
    const ventureType = positioning.ventureType || 'new_venture';
    
    const pestleOutput = this.extractPESTLEOutput(context);
    const portersOutput = this.extractPortersOutput(context);
    
    // Apply Porter's → SWOT bridge to derive O/T
    let bridgeContext: any = null;
    if (portersOutput) {
      try {
        bridgeContext = await applyPortersToSWOTBridge(
          portersOutput as PortersOutput, 
          pestleOutput as PESTLEOutput | undefined,
          positioning
        );
        console.log('[SWOT Executor] Applied bridge:', {
          derivedOpportunities: bridgeContext.derivedOpportunities?.length || 0,
          derivedThreats: bridgeContext.derivedThreats?.length || 0,
        });
      } catch (error) {
        console.warn('[SWOT Executor] Failed to apply bridge:', error);
      }
    }

    // Build cognitive prompt
    const systemPrompt = this.buildSystemPrompt(businessName, ventureType);
    const userPrompt = this.buildUserPrompt(positioning, context.userInput, bridgeContext, ventureType);

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt,
        userMessage: userPrompt,
        maxTokens: 6000,
      });

      const swotResults = JSON.parse(response.content);

      // Transform to typed output, incorporating bridge-derived O/T
      const output = this.transformToTypedOutput(swotResults, positioning, bridgeContext, ventureType, startTime);

      // Score quality
      const qualityScore = this.scoreOutput(output);

      console.log('[SWOT Executor] SWOT analysis complete');
      console.log(`  Venture Type: ${output.ventureType}`);
      console.log(`  Strengths: ${output.strengths.length}`);
      console.log(`  Weaknesses: ${output.weaknesses.length}`);
      console.log(`  Opportunities: ${output.opportunities.length}`);
      console.log(`  Threats: ${output.threats.length}`);
      console.log(`  SO Strategies: ${output.strategies.SO.length}`);
      console.log(`  ST Strategies: ${output.strategies.ST.length}`);
      console.log(`  WO Strategies: ${output.strategies.WO.length}`);
      console.log(`  WT Strategies: ${output.strategies.WT.length}`);
      console.log(`  PESTLE factors used: ${output.pestleFactorsUsed.length}`);
      console.log(`  Porter forces used: ${output.porterForcesUsed.length}`);
      console.log(`  Quality Score: ${qualityScore.overallScore.toFixed(1)}/10`);

      return output;
    } catch (error) {
      console.error('[SWOT Executor] Analysis failed:', error);
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
        geography: this.extractGeography(context),
      },
      customer: {
        primarySegment: 'Target customers',
      },
      valueProposition: {
        hypothesis: context.userInput,
        keyDifferentiators: [],
      },
      ventureType: 'new_venture' as const,
    };
  }

  /**
   * Extract PESTLE output from context
   */
  private extractPESTLEOutput(context: StrategicContext): any {
    if (context.insights?.pestleOutput) return context.insights.pestleOutput;
    if (context.insights?.trendFactors) return context.insights.trendFactors;
    return null;
  }

  /**
   * Extract Porter's output from context
   */
  private extractPortersOutput(context: StrategicContext): any {
    if (context.insights?.portersOutput) return context.insights.portersOutput;
    if (context.insights?.portersForces) return context.insights.portersForces;
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
    return 'Global';
  }

  /**
   * Build system prompt
   */
  private buildSystemPrompt(businessName: string, ventureType: string): string {
    const reasoningSteps = ventureType === 'existing_business' 
      ? SWOT_REASONING_STEPS_EXISTING_BUSINESS 
      : SWOT_REASONING_STEPS_NEW_VENTURE;

    const swCategories = ventureType === 'new_venture' ? `
## NEW VENTURE S/W CATEGORIES (Use ONLY these for S/W)
STRENGTHS must use one of these categories:
- value_proposition_fit: How well does offering match market opportunities?
- founder_capabilities: What relevant expertise/networks do founders bring?
- business_model_advantages: What structural advantages does the model have?
- timing_first_mover: Is there a window of opportunity being captured?
- resource_positioning: What key resources/partnerships are secured?

WEAKNESSES must use one of these categories:
- capability_gaps: What critical capabilities are missing?
- resource_constraints: What resource limitations exist?
- unvalidated_assumptions: What critical assumptions haven't been tested?
- market_access_barriers: What obstacles to reaching customers?
- competitive_disadvantages: Where structurally weaker than alternatives?
` : '';

    return `You are a strategic analyst conducting SWOT analysis for "${businessName}".

## CRITICAL RULES
1. O/T MUST trace back to PESTLE factors and Porter's forces - include sourceReference
2. S/W must be realistic for a ${ventureType === 'new_venture' ? 'new venture (use pre-operational categories)' : 'established business'}
3. Each item must have a priority (1-5, 1=highest) and priorityRationale
4. Generate SO, ST, WO, WT strategies linking specific S/W to O/T
5. Maximum 5 items per quadrant, prioritized
${swCategories}
## COGNITIVE PROCESS
${reasoningSteps.map(step => step).join('\n')}

## OUTPUT FORMAT
Return valid JSON:
{
  "strengths": [{"id": "S-1", "item": "...", "description": "...", "priority": 1, "priorityRationale": "...", "sourceAnalysis": "positioning|internal", "category": "value_proposition_fit|..."}],
  "weaknesses": [{"id": "W-1", "item": "...", "description": "...", "priority": 1, "priorityRationale": "...", "sourceAnalysis": "positioning|internal", "category": "capability_gaps|..."}],
  "opportunities": [{"id": "O-1", "item": "...", "description": "...", "priority": 1, "priorityRationale": "...", "sourceAnalysis": "pestle|porters|combined", "sourceReference": "PESTLE Economic E-3"}],
  "threats": [{"id": "T-1", "item": "...", "description": "...", "priority": 1, "priorityRationale": "...", "sourceAnalysis": "pestle|porters|combined", "sourceReference": "Porter's High Rivalry"}],
  "strategies": {
    "SO": [{"id": "SO-1", "strategy": "...", "leverages": ["S-1"], "addresses": ["O-1"], "actions": ["..."], "timeframe": "..."}],
    "ST": [...],
    "WO": [...],
    "WT": [...]
  },
  "priorityActions": ["Top immediate action 1", "..."],
  "pestleFactorsUsed": ["P-1", "E-2"],
  "porterForcesUsed": ["threatOfNewEntrants", "competitiveRivalry"]
}

Do NOT include text outside JSON.`;
  }

  /**
   * Build user prompt with bridge context
   */
  private buildUserPrompt(positioning: any, userInput: string, bridgeContext: any, ventureType: string): string {
    let bridgeSection = '';
    
    if (bridgeContext) {
      bridgeSection = `
## DERIVED OPPORTUNITIES (from PESTLE + Porter's bridge)
Use these as your Opportunities base - each already has source attribution:
${JSON.stringify(bridgeContext.derivedOpportunities || [], null, 2)}

## DERIVED THREATS (from PESTLE + Porter's bridge)
Use these as your Threats base - each already has source attribution:
${JSON.stringify(bridgeContext.derivedThreats || [], null, 2)}

## COMPETITOR INSIGHTS
Weaknesses to exploit (opportunities): ${JSON.stringify(bridgeContext.competitorInsights?.weaknesses || [], null, 2)}
Strengths to defend against (threats): ${JSON.stringify(bridgeContext.competitorInsights?.strengths || [], null, 2)}
`;
    }

    return `## BUSINESS CONTEXT
**Name**: ${positioning.businessConcept.name}
**Description**: ${positioning.businessConcept.description}
**Industry**: ${positioning.market.industry}
**Geography**: ${positioning.market.geography}
**Venture Type**: ${ventureType}
**Value Proposition**: ${positioning.valueProposition.hypothesis}

## ORIGINAL USER INPUT
${userInput}
${bridgeSection}
## TASK
Conduct SWOT analysis for **${positioning.businessConcept.name}**.

${ventureType === 'new_venture' ? `
Since this is a NEW VENTURE:
- Assess Strengths using ONLY the 5 pre-operational categories
- Assess Weaknesses using ONLY the 5 pre-operational categories
- DO NOT list operational capabilities that don't exist yet
` : ''}

Use the derived O/T from the bridge as your starting point, then:
1. Prioritize each item (1-5)
2. Create SO, ST, WO, WT strategies
3. Identify top priority actions

Return valid JSON only.`;
  }

  /**
   * Transform raw output to typed SWOTOutput
   */
  private transformToTypedOutput(
    raw: any,
    positioning: any,
    bridgeContext: any,
    ventureType: string,
    startTime: number
  ): SWOTOutput {
    const transformItem = (item: any, prefix: string, index: number): SWOTItem => ({
      id: item.id || `${prefix}-${index + 1}`,
      item: item.item || item.description || item,
      description: item.description || item.item || '',
      priority: item.priority || index + 1,
      priorityRationale: item.priorityRationale || 'Based on strategic importance',
      sourceAnalysis: item.sourceAnalysis || 'combined',
      sourceReference: item.sourceReference,
      category: item.category,
    });

    const transformStrategy = (s: any, prefix: string, index: number): Strategy => ({
      id: s.id || `${prefix}-${index + 1}`,
      strategy: s.strategy || s.description || '',
      leverages: s.leverages || [],
      addresses: s.addresses || [],
      actions: s.actions || [],
      timeframe: s.timeframe || '6-12 months',
    });

    // Merge bridge-derived O/T with LLM-generated ones
    let opportunities = (raw.opportunities || []).map((o: any, i: number) => transformItem(o, 'O', i));
    let threats = (raw.threats || []).map((t: any, i: number) => transformItem(t, 'T', i));

    // If bridge provided derived O/T, ensure they're included
    if (bridgeContext?.derivedOpportunities?.length > 0) {
      const bridgeOpps = bridgeContext.derivedOpportunities.map((o: any, i: number) => ({
        id: o.id || `O-B-${i + 1}`,
        item: o.description,
        description: o.rationale || o.description,
        priority: o.magnitude === 'high' ? 1 : o.magnitude === 'medium' ? 2 : 3,
        priorityRationale: `Derived from ${o.source}: ${o.sourceDetails?.portersForce || o.sourceDetails?.pestleFactor || 'external analysis'}`,
        sourceAnalysis: o.source === 'porters_force' ? 'porters' : o.source === 'pestle_factor' ? 'pestle' : 'combined',
        sourceReference: o.sourceDetails?.portersForce 
          ? `Porter's ${o.sourceDetails.portersForce}` 
          : o.sourceDetails?.pestleFactorId,
      }));
      
      // Merge, avoiding duplicates
      const existingDescs = new Set(opportunities.map((o: SWOTItem) => o.item.toLowerCase()));
      for (const bo of bridgeOpps) {
        if (!existingDescs.has(bo.item.toLowerCase())) {
          opportunities.push(bo);
        }
      }
    }

    if (bridgeContext?.derivedThreats?.length > 0) {
      const bridgeThreats = bridgeContext.derivedThreats.map((t: any, i: number) => ({
        id: t.id || `T-B-${i + 1}`,
        item: t.description,
        description: t.rationale || t.description,
        priority: t.magnitude === 'high' ? 1 : t.magnitude === 'medium' ? 2 : 3,
        priorityRationale: `Derived from ${t.source}: ${t.sourceDetails?.portersForce || t.sourceDetails?.pestleFactor || 'external analysis'}`,
        sourceAnalysis: t.source === 'porters_force' ? 'porters' : t.source === 'pestle_factor' ? 'pestle' : 'combined',
        sourceReference: t.sourceDetails?.portersForce 
          ? `Porter's ${t.sourceDetails.portersForce}` 
          : t.sourceDetails?.pestleFactorId,
      }));
      
      const existingDescs = new Set(threats.map((t: SWOTItem) => t.item.toLowerCase()));
      for (const bt of bridgeThreats) {
        if (!existingDescs.has(bt.item.toLowerCase())) {
          threats.push(bt);
        }
      }
    }

    // Limit to 5 per quadrant and sort by priority
    const sortByPriority = (items: SWOTItem[]) => 
      items.sort((a, b) => a.priority - b.priority).slice(0, 5);

    opportunities = sortByPriority(opportunities);
    threats = sortByPriority(threats);

    return {
      moduleId: 'swot',
      moduleVersion: '2.0.0',
      executedAt: new Date().toISOString(),
      
      qualityScore: 0,
      qualityDetails: [],
      confidenceScore: 0.7,
      
      metadata: {
        executionTimeMs: Date.now() - startTime,
        sourcesUsed: 0,
        limitations: [],
        assumptions: [],
      },
      
      bridgeHints: {
        topStrength: raw.strengths?.[0]?.item,
        topWeakness: raw.weaknesses?.[0]?.item,
        topOpportunity: opportunities[0]?.item,
        topThreat: threats[0]?.item,
      },
      
      ventureType: ventureType as any,
      
      strengths: sortByPriority((raw.strengths || []).map((s: any, i: number) => transformItem(s, 'S', i))),
      weaknesses: sortByPriority((raw.weaknesses || []).map((w: any, i: number) => transformItem(w, 'W', i))),
      opportunities,
      threats,
      
      strategies: {
        SO: (raw.strategies?.SO || []).map((s: any, i: number) => transformStrategy(s, 'SO', i)),
        ST: (raw.strategies?.ST || []).map((s: any, i: number) => transformStrategy(s, 'ST', i)),
        WO: (raw.strategies?.WO || []).map((s: any, i: number) => transformStrategy(s, 'WO', i)),
        WT: (raw.strategies?.WT || []).map((s: any, i: number) => transformStrategy(s, 'WT', i)),
      },
      
      priorityActions: raw.priorityActions || [],
      
      pestleFactorsUsed: raw.pestleFactorsUsed || [],
      porterForcesUsed: raw.porterForcesUsed || [],
      
      summary: {
        topStrength: raw.strengths?.[0]?.item || 'None identified',
        topWeakness: raw.weaknesses?.[0]?.item || 'None identified',
        topOpportunity: opportunities[0]?.item || 'None identified',
        topThreat: threats[0]?.item || 'None identified',
        overallAssessment: raw.overallAssessment || 'SWOT analysis complete',
      },
    };
  }

  /**
   * Score output quality
   */
  private scoreOutput(output: SWOTOutput): QualityScore {
    const qualityCriteria = Object.values(SWOT_QUALITY_CRITERIA).map(c => ({
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
      autoCheck: (out: unknown) => c.autoCheck(out as SWOTOutput),
    }));

    return scoreQuality(output, {} as any, qualityCriteria, 7);
  }
}
