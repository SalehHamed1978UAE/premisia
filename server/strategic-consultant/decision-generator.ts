import Anthropic from '@anthropic-ai/sdk';
import { strategyOntologyService } from '../ontology/strategy-ontology-service';
import type { StrategyAnalysis, PortersFiveForcesAnalysis } from './strategy-analyzer';
import type { ResearchFindings } from './market-researcher';

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  estimated_cost?: { min: number; max: number };
  estimated_timeline_months?: number;
  pros: string[];
  cons: string[];
  recommended?: boolean;
  warning?: string;
  reasoning?: string;
}

export interface DecisionPoint {
  id: string;
  title: string;
  question: string;
  context: string;
  options: DecisionOption[];
  impact_areas: string[];
}

export interface GeneratedDecisions {
  decisions: DecisionPoint[];
  decision_flow: string;
  estimated_completion_time_minutes: number;
}

export class DecisionGenerator {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  async generateDecisions(
    analysis: StrategyAnalysis,
    originalInput: string
  ): Promise<GeneratedDecisions> {
    const approaches = strategyOntologyService.getStrategicApproaches();
    const markets = strategyOntologyService.getMarketContexts();

    const approachOptions = analysis.recommended_approaches.map(id => {
      const approach = approaches[id];
      return {
        id,
        label: approach?.label || id,
        requires: approach?.requires || [],
        cost_range: approach?.cost_range,
        timeline: approach?.timeline_months
      };
    });

    const marketInfo = markets[analysis.recommended_market];

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: `You are a strategic consultant creating decision points for executive review.

CONTEXT:
${analysis.executive_summary}

ROOT CAUSE: ${analysis.five_whys.root_cause}

RECOMMENDED APPROACHES: ${approachOptions.map(a => a.label).join(', ')}
RECOMMENDED MARKET: ${marketInfo?.label || analysis.recommended_market}

ORIGINAL INPUT SUMMARY:
${originalInput.substring(0, 1500)}

Create 2-4 strategic decision points that an executive must choose between. Each decision should:
1. Have 2-4 options to choose from
2. Include cost estimates where relevant (in dollars)
3. Include timeline estimates where relevant (in months)
4. Show pros and cons clearly
5. Mark one option as recommended

Decision points should cover:
- Strategic approach selection
- Market entry strategy
- Implementation priorities
- Resource allocation

Return ONLY valid JSON (no markdown, no explanation):

{
  "decisions": [
    {
      "id": "decision_1",
      "title": "Decision Title",
      "question": "Clear question for executive to answer",
      "context": "Why this decision matters (2-3 sentences)",
      "options": [
        {
          "id": "option_1",
          "label": "Option Label",
          "description": "Detailed description of this option",
          "estimated_cost": { "min": 1000000, "max": 2000000 },
          "estimated_timeline_months": 12,
          "pros": ["pro 1", "pro 2", "pro 3"],
          "cons": ["con 1", "con 2"],
          "recommended": true
        }
      ],
      "impact_areas": ["area 1", "area 2"]
    }
  ],
  "decision_flow": "Brief explanation of how these decisions build on each other",
  "estimated_completion_time_minutes": 5
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
      throw new Error('Failed to extract JSON from decision generation response');
    }

    const generated = JSON.parse(jsonMatch[0]);

    return this.enrichWithOntologyData(generated, analysis);
  }

  async generateDecisionsWithResearch(
    analysis: StrategyAnalysis,
    originalInput: string,
    researchFindings: ResearchFindings,
    portersAnalysis: PortersFiveForcesAnalysis
  ): Promise<GeneratedDecisions> {
    const approaches = strategyOntologyService.getStrategicApproaches();
    const markets = strategyOntologyService.getMarketContexts();

    const approachOptions = analysis.recommended_approaches.map(id => {
      const approach = approaches[id];
      return {
        id,
        label: approach?.label || id,
        requires: approach?.requires || [],
        cost_range: approach?.cost_range,
        timeline: approach?.timeline_months
      };
    });

    const marketInfo = markets[analysis.recommended_market];

    // Extract key research insights
    const languageInsights = researchFindings.language_preferences.map(f => f.fact).join('; ');
    const marketDynamics = researchFindings.market_dynamics.map(f => f.fact).join('; ');
    const competitiveInsights = researchFindings.competitive_landscape.map(f => f.fact).join('; ');
    const buyerBehavior = researchFindings.buyer_behavior.map(f => f.fact).join('; ');

    // Extract Porter's strategic responses
    const strategicResponses = [
      portersAnalysis.competitive_rivalry.strategic_response,
      portersAnalysis.supplier_power.strategic_response,
      portersAnalysis.buyer_power.strategic_response,
      portersAnalysis.threat_of_substitution.strategic_response,
      portersAnalysis.threat_of_new_entry.strategic_response
    ].filter(Boolean);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: `You are a strategic consultant creating decision points for executive review.

CRITICAL CONSTRAINT: You must generate decisions that are CONSISTENT WITH RESEARCH FINDINGS.

CONTEXT:
${analysis.executive_summary}

ROOT CAUSE: ${analysis.five_whys.root_cause}

RECOMMENDED APPROACHES: ${approachOptions.map(a => a.label).join(', ')}
RECOMMENDED MARKET: ${marketInfo?.label || analysis.recommended_market}

ORIGINAL INPUT SUMMARY:
${originalInput.substring(0, 1000)}

RESEARCH FINDINGS:
Language Preferences: ${languageInsights || 'No specific insights'}
Market Dynamics: ${marketDynamics || 'No specific insights'}
Competitive Landscape: ${competitiveInsights || 'No specific insights'}
Buyer Behavior: ${buyerBehavior || 'No specific insights'}

PORTER'S FIVE FORCES STRATEGIC RESPONSES:
${strategicResponses.join('\n')}

KEY STRATEGIC PRIORITIES FROM PORTER'S ANALYSIS:
${portersAnalysis.key_strategic_priorities.join(', ')}

RULES FOR DECISION OPTIONS:
1. If research CONTRADICTS an assumption from the original input, DO NOT recommend options based on that assumption
2. Prioritize options that align with research findings and Porter's strategic responses
3. Mark as "recommended: true" ONLY options that are supported by research findings
4. If the input mentioned a strategy that research contradicted, include it as an option but mark "recommended: false" and add a "warning" field explaining why
5. Each option must include a "reasoning" field that cites specific research findings or Porter's analysis

EXAMPLE (Arabic language case):
If input said: "Arabic language differentiation"
But research found: "English dominates UAE business (78% of enterprises)"

CORRECT decision structure:
{
  "options": [
    {
      "id": "english_first",
      "label": "English-First Global Alternative",
      "description": "Position as premium English-based platform with optional multilingual support",
      "recommended": true,
      "reasoning": "Research shows English is dominant business language in 78% of UAE enterprises",
      "pros": ["Aligns with market reality", "Lower localization cost", "Faster time to market"],
      "cons": ["May miss niche Arabic-only opportunities"]
    },
    {
      "id": "arabic_focus",
      "label": "Arabic-First Cultural Pioneer",
      "description": "Differentiate through comprehensive Arabic language and cultural features",
      "recommended": false,
      "warning": "Not recommended - contradicts research findings",
      "reasoning": "Research shows English dominates UAE business communications; limited evidence of willingness-to-pay for Arabic-specific features",
      "pros": ["Potential niche differentiation"],
      "cons": ["Contradicts market research", "Higher development cost", "Smaller addressable market"]
    }
  ]
}

Create 2-4 strategic decision points that an executive must choose between. Each decision should:
1. Have 2-4 options to choose from
2. Include cost estimates where relevant (in dollars)
3. Include timeline estimates where relevant (in months)
4. Show pros and cons clearly
5. Mark one option as recommended (the one MOST ALIGNED with research findings)
6. Include reasoning field citing research findings or Porter's analysis
7. Add warning field for options contradicted by research

Decision points should cover:
- Strategic approach selection (informed by Porter's priorities)
- Market entry strategy (informed by research)
- Implementation priorities (informed by competitive landscape)
- Resource allocation (informed by buyer behavior)

Return ONLY valid JSON (no markdown, no explanation):

{
  "decisions": [
    {
      "id": "decision_1",
      "title": "Decision Title",
      "question": "Clear question for executive to answer",
      "context": "Why this decision matters (2-3 sentences)",
      "options": [
        {
          "id": "option_1",
          "label": "Option Label",
          "description": "Detailed description of this option",
          "estimated_cost": { "min": 1000000, "max": 2000000 },
          "estimated_timeline_months": 12,
          "pros": ["pro 1", "pro 2", "pro 3"],
          "cons": ["con 1", "con 2"],
          "recommended": true,
          "reasoning": "Cite specific research finding or Porter's analysis here"
        }
      ],
      "impact_areas": ["area 1", "area 2"]
    }
  ],
  "decision_flow": "Brief explanation of how these decisions build on each other",
  "estimated_completion_time_minutes": 5
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
      throw new Error('Failed to extract JSON from research-informed decision generation response');
    }

    const generated = JSON.parse(jsonMatch[0]);

    // Validate against research before returning
    const validation = this.validateDecisionsAgainstResearch(generated, researchFindings);
    if (!validation.valid) {
      // If there are critical contradictions, throw an error to force regeneration
      const criticalIssues = validation.issues.filter(issue => 
        issue.includes('recommends Arabic') || 
        issue.includes('contradicts research')
      );
      
      if (criticalIssues.length > 0) {
        throw new Error(
          `Decision generation contradicts research findings:\n${criticalIssues.join('\n')}\n\nPlease regenerate decisions that align with research.`
        );
      }
      
      // Non-critical issues just get logged as warnings
      console.warn('Decision validation warnings:', validation.issues);
    }

    return this.enrichWithOntologyData(generated, analysis);
  }

  validateDecisionsAgainstResearch(
    decisions: GeneratedDecisions,
    researchFindings: ResearchFindings
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Extract key research facts for validation
    const languageFacts = researchFindings.language_preferences.map(f => f.fact.toLowerCase());
    const marketFacts = researchFindings.market_dynamics.map(f => f.fact.toLowerCase());

    // Check each decision for contradictions
    decisions.decisions.forEach(decision => {
      decision.options.forEach(option => {
        if (option.recommended) {
          // Check for common contradictions
          
          // Arabic language contradiction
          const optionText = `${option.label} ${option.description}`.toLowerCase();
          const emphasizesArabic = /arabic|multilingual.*arabic|arabic.*first/i.test(optionText);
          const englishDominates = languageFacts.some(f => /english.*dominat|english.*preferre|english.*78%|english.*majority/i.test(f));

          if (emphasizesArabic && englishDominates) {
            issues.push(
              `Option "${option.label}" in decision "${decision.title}" recommends Arabic focus but research shows English dominates business communications`
            );
          }

          // Check if option lacks reasoning field
          if (!option.reasoning) {
            issues.push(
              `Option "${option.label}" in decision "${decision.title}" is recommended but lacks research-based reasoning`
            );
          }
        }

        // Check that contradicted options have warnings
        if (option.recommended === false && !option.warning) {
          issues.push(
            `Option "${option.label}" in decision "${decision.title}" is not recommended but lacks warning explanation`
          );
        }
      });
    });

    return {
      valid: issues.length === 0,
      issues
    };
  }

  private enrichWithOntologyData(
    decisions: GeneratedDecisions,
    analysis: StrategyAnalysis
  ): GeneratedDecisions {
    const enrichedDecisions = decisions.decisions.map(decision => {
      const enrichedOptions = decision.options.map(option => {
        if (option.id.includes('approach') || analysis.recommended_approaches.some(a => option.label.includes(a))) {
          const approachId = analysis.recommended_approaches.find(id =>
            option.label.toLowerCase().includes(id.replace('_', ' '))
          );

          if (approachId) {
            const costEstimate = strategyOntologyService.calculateCostEstimate(
              approachId,
              analysis.recommended_market
            );

            if (costEstimate && !option.estimated_cost) {
              option.estimated_cost = { min: costEstimate.min, max: costEstimate.max };
              option.estimated_timeline_months = costEstimate.timeline_months;
            }
          }
        }

        return option;
      });

      return {
        ...decision,
        options: enrichedOptions
      };
    });

    return {
      ...decisions,
      decisions: enrichedDecisions
    };
  }

  async validateDecisions(decisions: GeneratedDecisions): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    if (decisions.decisions.length < 2) {
      issues.push('Must have at least 2 decision points');
    }

    if (decisions.decisions.length > 4) {
      issues.push('Should have at most 4 decision points');
    }

    for (const decision of decisions.decisions) {
      if (decision.options.length < 2) {
        issues.push(`Decision "${decision.title}" must have at least 2 options`);
      }

      if (decision.options.length > 4) {
        issues.push(`Decision "${decision.title}" should have at most 4 options`);
      }

      const recommendedCount = decision.options.filter(o => o.recommended).length;
      if (recommendedCount === 0) {
        issues.push(`Decision "${decision.title}" should have one recommended option`);
      }
      if (recommendedCount > 1) {
        issues.push(`Decision "${decision.title}" should have only one recommended option`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}
