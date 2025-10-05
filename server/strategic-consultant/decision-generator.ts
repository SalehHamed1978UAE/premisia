import Anthropic from '@anthropic-ai/sdk';
import { strategyOntologyService } from '../ontology/strategy-ontology-service';
import type { StrategyAnalysis } from './strategy-analyzer';

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  estimated_cost?: { min: number; max: number };
  estimated_timeline_months?: number;
  pros: string[];
  cons: string[];
  recommended?: boolean;
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
