import { getLLMProvider } from '../lib/llm-provider';
import { journeyValidatorService } from './journey-validator-service';

/**
 * Journey Recommendation Service
 * 
 * PURPOSE: Provides AI-powered analysis and recommendations for journeys
 * 
 * WHAT IT DOES:
 * 1. Analyzes selected frameworks
 * 2. Validates knowledge graph completeness
 * 3. Provides recommendations for improvement
 * 4. Explains what the journey achieves
 */
export class JourneyRecommendationService {
  /**
   * Analyze a custom journey and provide recommendations
   */
  async analyzeJourney(params: {
    steps: Array<{ frameworkKey: string; name: string }>;
    userGoal?: string;
  }): Promise<{
    suitableFor: string[];
    strengths: string[];
    potentialGaps: string[];
    recommendation: string;
    estimatedDuration: number;
    validation: {
      hasRequiredInfo: boolean;
      missingInformation: string[];
      warnings: string[];
      recommendations: string[];
      informationCollected: string[];
    };
  }> {
    console.log('[Journey Recommendation] Analyzing journey with validation...');

    const selectedFrameworks = params.steps.map(s => s.frameworkKey);

    // =========================================================================
    // STEP 1: Validate - does journey build complete enough knowledge graph?
    // =========================================================================
    const validation = await journeyValidatorService.validateJourney({
      selectedFrameworks,
      userGoal: params.userGoal,
    });

    // =========================================================================
    // STEP 2: Get AI analysis of journey purpose and value
    // =========================================================================
    const llm = getLLMProvider();

    const prompt = `Analyze this strategic journey:

Frameworks selected:
${params.steps.map((s, i) => `${i + 1}. ${s.name}`).join('\n')}

Knowledge graph entities that will be collected:
${validation.informationCollected.map(i => `- ${i}`).join('\n')}

${params.userGoal ? `User's stated goal: ${params.userGoal}` : ''}

CONTEXT:
- Context enrichment runs automatically between each framework
- Each framework adds entities and relationships to a growing knowledge graph
- The journey ends with EPM Generation (which includes WBS Builder, Resource Planner, etc.)
- Each journey creates its own isolated knowledge graph

Provide analysis:
1. What is this journey suitable for? (2-4 specific use cases)
2. What are the strengths of this framework sequence?
3. Are there any gaps in the knowledge graph that would limit EPM quality?
4. One-sentence summary of what this journey achieves

Format as JSON:
{
  "suitableFor": ["specific use case 1", "specific use case 2"],
  "strengths": ["strength 1 with reasoning", "strength 2 with reasoning"],
  "potentialGaps": ["gap 1 (or empty if none)"],
  "recommendation": "One clear sentence about what this journey achieves"
}`;

    const aiAnalysis = await llm.generateStructuredResponse(prompt, {
      suitableFor: 'array',
      strengths: 'array',
      potentialGaps: 'array',
      recommendation: 'string',
    });

    // Calculate estimated duration
    const estimatedDuration = params.steps.length * 8; // ~8 min per framework average

    console.log('[Journey Recommendation] ✓ Analysis complete');

    return {
      ...aiAnalysis,
      estimatedDuration,
      validation: {
        hasRequiredInfo: validation.hasRequiredInfo,
        missingInformation: validation.missingInformation,
        warnings: validation.warnings,
        recommendations: validation.recommendations,
        informationCollected: validation.informationCollected,
      },
    };
  }

  /**
   * Suggest frameworks based on user goal
   */
  async suggestFrameworks(userGoal: string): Promise<{
    recommended: string[];
    reasoning: string;
  }> {
    console.log('[Journey Recommendation] Suggesting frameworks for goal...');

    const llm = getLLMProvider();

    const prompt = `User wants to: "${userGoal}"

Available frameworks:
- strategic_understanding: Build strategic context and knowledge graph foundation
- five_whys: Root cause analysis - uncover assumptions
- business_model_canvas: Business model validation
- porters_five_forces: Competitive and industry analysis
- pestle: Macro-environmental factors and trends
- swot: Strengths, weaknesses, opportunities, threats analysis
- strategic_decisions: Make strategic choices (risk, priorities, go/no-go)

RULES:
- strategic_understanding should ALWAYS be first (builds knowledge graph foundation)
- strategic_decisions should come near the end (after analysis frameworks)
- Journey automatically ends with EPM generation (don't include it)
- Recommend 3-5 frameworks total

Recommend a sequence that will build a complete knowledge graph for this goal.

Format as JSON:
{
  "recommended": ["strategic_understanding", "framework_2", "framework_3", ...],
  "reasoning": "Why this sequence makes sense for the user's goal"
}`;

    const response = await llm.generateStructuredResponse(prompt, {
      recommended: 'array',
      reasoning: 'string',
    });

    return response;
  }
}

export const journeyRecommendationService = new JourneyRecommendationService();
