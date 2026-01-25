/**
 * Smart Option Generator - Creates intelligent multiple choice options
 * based on the journey's analysis context
 */

import { aiClients } from '../../ai-clients';
import { EPMRequirement } from './requirements';
import { StrategicContext } from '../context/strategic-accumulator';

export interface SmartOption {
  id: string;
  label: string;
  sublabel?: string;
  value: any;
  confidence: number;
  recommended: boolean;
  source?: string;
}

export interface GapFillerQuestion {
  requirementId: string;
  question: string;
  description?: string;
  type: 'single_select' | 'multi_select' | 'scale' | 'timeline' | 'budget';
  options: SmartOption[];
  allowCustom: boolean;
  validateCustom: boolean;
  minSelections?: number;
  maxSelections?: number;
}

export class SmartOptionGenerator {
  async generateOptions(
    requirement: EPMRequirement,
    context: StrategicContext
  ): Promise<GapFillerQuestion> {
    console.log(`[Smart Options] Generating options for: ${requirement.id}`);

    if (['timeline', 'budget', 'scale'].includes(requirement.questionType)) {
      return this.getPredefinedQuestion(requirement);
    }

    const options = await this.generateContextAwareOptions(requirement, context);

    return {
      requirementId: requirement.id,
      question: requirement.fallbackQuestion,
      description: requirement.description,
      type: requirement.questionType,
      options,
      allowCustom: true,
      validateCustom: true,
      minSelections: requirement.questionType === 'multi_select' ? 1 : undefined,
      maxSelections: requirement.questionType === 'multi_select' ? 5 : undefined,
    };
  }

  private async generateContextAwareOptions(
    requirement: EPMRequirement,
    context: StrategicContext
  ): Promise<SmartOption[]> {
    const prompt = `
Based on this strategic analysis context, generate 3-4 smart multiple choice options for the question:
"${requirement.fallbackQuestion}"

Analysis Context:
- Business: ${context.businessProfile.name} - ${context.businessProfile.description}
- Industry: ${context.businessProfile.industry}
${context.synthesizedInsights.targetSegments.length > 0 ? `- Target Segments: ${context.synthesizedInsights.targetSegments.join(', ')}` : ''}
${context.synthesizedInsights.keyStrengths.length > 0 ? `- Key Strengths: ${context.synthesizedInsights.keyStrengths.join(', ')}` : ''}
${context.synthesizedInsights.opportunities.length > 0 ? `- Opportunities: ${context.synthesizedInsights.opportunities.join(', ')}` : ''}
${context.synthesizedInsights.growthStrategy ? `- Suggested Growth Strategy: ${context.synthesizedInsights.growthStrategy}` : ''}

Generate options that:
1. Are derived from the analysis data (not generic)
2. Are specific to this business
3. Include one recommended option (highest confidence)
4. Each has a clear, concise label (2-5 words)
5. Each has a sublabel explaining why this option fits

Return as JSON array:
[
  {
    "label": "Short option name",
    "sublabel": "Why this fits based on analysis",
    "value": "option_value",
    "confidence": 0.85,
    "recommended": true,
    "source": "Which analysis suggested this"
  }
]
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a strategic advisor. Return only valid JSON array.',
        userMessage: prompt,
        maxTokens: 1000,
      });

      const parsed = JSON.parse(response.content);
      const options = Array.isArray(parsed) ? parsed : parsed.options || [];

      return options.map((opt: any, i: number) => ({
        ...opt,
        id: `${requirement.id}_opt_${i}`,
      }));
    } catch (error) {
      console.error('[Smart Options] AI generation failed, using fallback');
      return this.getFallbackOptions(requirement, context);
    }
  }

  private getPredefinedQuestion(requirement: EPMRequirement): GapFillerQuestion {
    let options: SmartOption[] = [];

    switch (requirement.questionType) {
      case 'timeline':
        options = [
          { id: 'timeline_1', label: '0-3 months', sublabel: 'Quick launch', value: '0-3_months', confidence: 0.7, recommended: false },
          { id: 'timeline_2', label: '3-6 months', sublabel: 'Standard timeline', value: '3-6_months', confidence: 0.85, recommended: true },
          { id: 'timeline_3', label: '6-12 months', sublabel: 'Thorough preparation', value: '6-12_months', confidence: 0.75, recommended: false },
          { id: 'timeline_4', label: '12+ months', sublabel: 'Long-term project', value: '12+_months', confidence: 0.6, recommended: false },
        ];
        break;

      case 'budget':
        options = [
          { id: 'budget_1', label: 'Under $10K', sublabel: 'Bootstrap', value: 'under_10k', confidence: 0.6, recommended: false },
          { id: 'budget_2', label: '$10K - $50K', sublabel: 'Small business', value: '10k-50k', confidence: 0.75, recommended: false },
          { id: 'budget_3', label: '$50K - $250K', sublabel: 'Growth stage', value: '50k-250k', confidence: 0.85, recommended: true },
          { id: 'budget_4', label: '$250K+', sublabel: 'Significant investment', value: '250k+', confidence: 0.7, recommended: false },
        ];
        break;

      case 'scale':
        options = [
          { id: 'risk_1', label: 'Conservative', sublabel: 'Minimize risk', value: 'conservative', confidence: 0.7, recommended: false },
          { id: 'risk_2', label: 'Moderate', sublabel: 'Balanced approach', value: 'moderate', confidence: 0.85, recommended: true },
          { id: 'risk_3', label: 'Aggressive', sublabel: 'High risk/reward', value: 'aggressive', confidence: 0.7, recommended: false },
        ];
        break;
    }

    return {
      requirementId: requirement.id,
      question: requirement.fallbackQuestion,
      description: requirement.description,
      type: requirement.questionType,
      options,
      allowCustom: false,
      validateCustom: false,
    };
  }

  private getFallbackOptions(requirement: EPMRequirement, context: StrategicContext): SmartOption[] {
    const insights = context.synthesizedInsights;

    if (requirement.id === 'target_segments' && insights.targetSegments.length > 0) {
      return insights.targetSegments.map((seg, i) => ({
        id: `${requirement.id}_opt_${i}`,
        label: seg,
        sublabel: 'From segment analysis',
        value: seg.toLowerCase().replace(/\s+/g, '_'),
        confidence: 0.8,
        recommended: i === 0,
        source: 'Segment Discovery',
      }));
    }

    if (requirement.id === 'competitive_strategy') {
      return [
        { id: `${requirement.id}_opt_0`, label: 'Cost Leadership', sublabel: 'Compete on price', value: 'cost_leadership', confidence: 0.7, recommended: false },
        { id: `${requirement.id}_opt_1`, label: 'Differentiation', sublabel: 'Unique offerings', value: 'differentiation', confidence: 0.8, recommended: true },
        { id: `${requirement.id}_opt_2`, label: 'Focus Strategy', sublabel: 'Niche market focus', value: 'focus', confidence: 0.7, recommended: false },
      ];
    }

    if (requirement.id === 'growth_strategy') {
      return [
        { id: `${requirement.id}_opt_0`, label: 'Market Penetration', sublabel: 'Grow in current market', value: 'market_penetration', confidence: 0.8, recommended: true },
        { id: `${requirement.id}_opt_1`, label: 'Market Development', sublabel: 'New markets', value: 'market_development', confidence: 0.7, recommended: false },
        { id: `${requirement.id}_opt_2`, label: 'Product Development', sublabel: 'New products', value: 'product_development', confidence: 0.7, recommended: false },
        { id: `${requirement.id}_opt_3`, label: 'Diversification', sublabel: 'New products & markets', value: 'diversification', confidence: 0.5, recommended: false },
      ];
    }

    return [
      { id: `${requirement.id}_opt_0`, label: 'Option A', sublabel: 'First alternative', value: 'option_a', confidence: 0.6, recommended: false },
      { id: `${requirement.id}_opt_1`, label: 'Option B', sublabel: 'Second alternative', value: 'option_b', confidence: 0.6, recommended: false },
      { id: `${requirement.id}_opt_2`, label: 'Option C', sublabel: 'Third alternative', value: 'option_c', confidence: 0.6, recommended: false },
    ];
  }
}

export const smartOptionGenerator = new SmartOptionGenerator();
