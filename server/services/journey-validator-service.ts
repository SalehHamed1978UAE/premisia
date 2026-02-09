import { getLLMProvider } from '../lib/llm-provider';

interface ValidationResult {
  isValid: boolean;
  hasRequiredInfo: boolean;
  missingInformation: string[];
  warnings: string[];
  recommendations: string[];
  informationCollected: string[];
}

/**
 * Journey Validator Service
 * 
 * PURPOSE: Validates that a journey collects enough information for EPM Generator
 * 
 * KEY CONCEPT: Each journey builds a knowledge graph progressively.
 * This service checks if the selected frameworks will produce enough
 * entities and relationships for EPM Generator to create a complete program.
 */
export class JourneyValidatorService {
  /**
   * Define what INFORMATION EPM Generator needs to work effectively
   * These map to knowledge graph entities that must be present
   */
  private readonly EPM_REQUIRED_INFORMATION = {
    strategic_context: 'Strategic understanding and business context',
    business_model: 'Validated business model (value proposition, customers, revenue)',
    strategic_decisions: 'Key strategic choices (risk tolerance, priorities)',
  };

  /**
   * Map frameworks to what knowledge graph entities they produce
   * This is based on your existing framework implementations
   */
  private readonly FRAMEWORK_INFO_MAP: Record<string, string[]> = {
    strategic_understanding: ['strategic_context', 'company_context', 'goals', 'assumptions'],
    five_whys: ['root_causes', 'causal_chains', 'assumptions_validated'],
    business_model_canvas: ['business_model', 'value_proposition', 'customer_segments', 'revenue_streams'],
    porters_five_forces: ['competitive_analysis', 'industry_attractiveness', 'competitive_threats'],
    pestle: ['macro_environment', 'trends', 'external_factors'],
    swot: ['strengths', 'weaknesses', 'opportunities', 'threats'],
    strategic_decisions: ['strategic_decisions', 'risk_tolerance', 'priorities', 'go_decision'],
  };

  /**
   * Validate if journey collects enough information for EPM Generator
   */
  async validateJourney(params: {
    selectedFrameworks: string[];
    userGoal?: string;
  }): Promise<ValidationResult> {
    console.log('[Journey Validator] Validating journey for EPM readiness...');

    const { selectedFrameworks } = params;

    const result: ValidationResult = {
      isValid: true,
      hasRequiredInfo: true,
      missingInformation: [],
      warnings: [],
      recommendations: [],
      informationCollected: [],
    };

    // =========================================================================
    // Collect what knowledge graph entities this journey will generate
    // =========================================================================
    const infoCollected = new Set<string>();
    selectedFrameworks.forEach(fk => {
      const info = this.FRAMEWORK_INFO_MAP[fk] || [];
      info.forEach(i => infoCollected.add(i));
    });

    result.informationCollected = Array.from(infoCollected);

    // =========================================================================
    // CRITICAL CHECK: Do we have strategic context?
    // Without this, EPM Generator has no foundation
    // =========================================================================
    if (!infoCollected.has('strategic_context')) {
      result.missingInformation.push('strategic_context');
      result.warnings.push('🚨 CRITICAL: Missing Strategic Understanding - EPM will lack business context and goals');
      result.hasRequiredInfo = false;
      result.isValid = false;
    }

    // =========================================================================
    // CRITICAL CHECK: Do we have business model?
    // Without this, EPM Generator cannot create coherent work breakdown
    // =========================================================================
    if (!infoCollected.has('business_model')) {
      result.missingInformation.push('business_model');
      result.warnings.push('🚨 CRITICAL: Missing Business Model - EPM cannot generate coherent workstreams and tasks');
      result.hasRequiredInfo = false;
      result.isValid = false;
    }

    // =========================================================================
    // RECOMMENDED CHECK: Do we have strategic decisions?
    // Without this, EPM will use defaults which may not match user intent
    // =========================================================================
    if (!infoCollected.has('strategic_decisions')) {
      result.warnings.push('⚠️ RECOMMENDED: Add Strategic Decisions to capture risk tolerance and priorities');
      result.recommendations.push('Strategic Decisions step ensures EPM reflects your specific choices');
    }

    // =========================================================================
    // ENHANCEMENT SUGGESTIONS: What would enrich the knowledge graph?
    // =========================================================================
    if (!infoCollected.has('root_causes') && !infoCollected.has('assumptions_validated')) {
      result.recommendations.push('Consider 5 Whys to uncover assumptions and root causes - strengthens EPM risk analysis');
    }

    if (!infoCollected.has('competitive_analysis') && !infoCollected.has('macro_environment')) {
      result.recommendations.push("Consider Porter's Five Forces or PESTLE for market context - improves EPM stakeholder and risk analysis");
    }

    // =========================================================================
    // LLM DEEP ANALYSIS: Get AI recommendations
    // =========================================================================
    const llmAnalysis = await this.getLLMRecommendations(
      selectedFrameworks,
      Array.from(infoCollected),
      params.userGoal
    );

    if (llmAnalysis.recommendations.length > 0) {
      result.recommendations.push(...llmAnalysis.recommendations);
    }

    console.log('[Journey Validator] ✓ Validation complete:', {
      hasRequiredInfo: result.hasRequiredInfo,
      infoCollected: result.informationCollected.length,
      warnings: result.warnings.length,
      recommendations: result.recommendations.length,
    });

    return result;
  }

  /**
   * Use LLM to analyze information completeness for EPM generation
   */
  private async getLLMRecommendations(
    selectedFrameworks: string[],
    infoCollected: string[],
    userGoal?: string
  ): Promise<{ recommendations: string[] }> {
    try {
      const llm = getLLMProvider();

      const frameworkNames = selectedFrameworks.map(fk => {
        const names: Record<string, string> = {
          strategic_understanding: 'Strategic Understanding',
          five_whys: '5 Whys',
          business_model_canvas: 'Business Model Canvas',
          porters_five_forces: "Porter's Five Forces",
          pestle: 'PESTLE',
          swot: 'SWOT',
          strategic_decisions: 'Strategic Decisions',
        };
        return names[fk] || fk;
      });

      const prompt = `A user is building a strategic journey with these frameworks:
${frameworkNames.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Knowledge graph entities that will be collected:
${infoCollected.map(i => `- ${i}`).join('\n')}

${userGoal ? `User's goal: ${userGoal}` : ''}

This journey will end with EPM Generation which produces a complete 14-component execution program including:
- Work breakdown structure
- Timeline & schedule  
- Resource plan (roles, team composition)
- Financial plan (budget, costs)
- Risk register
- Benefits realization
- KPIs & success metrics
- Stakeholder map
- Governance structure
- Stage gates
- QA plan
- Procurement plan
- Exit strategy
- Executive summary

Context enrichment will automatically run between frameworks to build connections in the knowledge graph.

Does this journey collect enough information for EPM Generator to produce high-quality outputs? 

Provide 1-2 specific, actionable recommendations to improve the journey (or return empty array if it's already complete).

Format as JSON:
{
  "recommendations": ["specific recommendation"]
}`;

      const response = await llm.generateStructuredResponse(prompt, {
        recommendations: 'array',
      });

      return response;
    } catch (error) {
      console.error('[Journey Validator] LLM analysis failed:', error);
      return { recommendations: [] };
    }
  }
}

export const journeyValidatorService = new JourneyValidatorService();
