import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { frameworkSelections } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export type FrameworkType = 'business_model_canvas' | 'porters_five_forces' | 'user_choice';

export interface FrameworkSignals {
  bmcKeywords: string[];
  portersKeywords: string[];
  businessStage: string;
  queryType: string;
}

export interface FrameworkSelectionResult {
  selectedFramework: FrameworkType;
  confidence: number;
  signals: FrameworkSignals;
  reasoning: string;
  alternativeFramework?: FrameworkType;
  userOverride?: boolean;
}

export class FrameworkSelector {
  private anthropic: Anthropic;

  private bmcKeywords = [
    'business model',
    'revenue', 'ARR', 'MRR',
    'customer', 'customers', 'client', 'clients',
    'value proposition', 'value propositions',
    'pivot', 'pivoting', 'pivoted',
    'new venture', 'startup', 'startups', 'early stage',
    'monetize', 'monetization', 'monetizing',
    'customer segment', 'customer segments',
    'revenue stream', 'revenue streams', 'revenue target', 'revenue goal',
    'key resource', 'key resources',
    'cost structure', 'costs',
    'channel', 'channels', 'distribution',
    'partnership', 'partnerships', 'partner', 'partners',
    'launch', 'launching', 'expanding',
    'go-to-market', 'GTM',
    'product-market fit', 'PMF',
    'scaling', 'scale', 'growth',
    'pricing model', 'pricing strategy',
    'business design',
    'localization', 'market entry', 'market expansion',
    'investment', 'invest', 'investing',
    'target market', 'positioning strategy',
  ];

  private portersKeywords = [
    'competitive', 'competition', 'compete', 'competing',
    'competitor', 'competitors',
    'market force', 'market forces',
    'industry analysis', 'industry structure',
    'rivalry', 'competitive rivalry',
    'threat of entry', 'new entrant', 'new entrants', 'barriers to entry',
    'substitute', 'substitutes', 'substitution',
    'supplier power', 'bargaining power of suppliers',
    'buyer power', 'bargaining power of buyers',
    'competitive advantage', 'differentiation',
    'market position', 'positioning',
    'industry dynamics',
    'competitive landscape',
    'market share',
    'strategic positioning',
  ];

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  async selectFramework(
    sessionId: string,
    userId: string,
    input: string
  ): Promise<FrameworkSelectionResult> {
    const signals = this.detectSignals(input);
    
    const analysis = await this.analyzeWithClaude(input, signals);

    // Only save to database if not a test session
    if (!sessionId.startsWith('test-')) {
      await db.insert(frameworkSelections).values({
        sessionId,
        userId,
        selectedFramework: analysis.selectedFramework,
        confidence: analysis.confidence.toFixed(2),
        signals: signals as any,
        reasoning: analysis.reasoning,
        userOverride: false,
        alternativeFramework: analysis.alternativeFramework || null,
      });
    }

    return analysis;
  }

  private detectSignals(input: string): FrameworkSignals {
    const lowerInput = input.toLowerCase();
    
    const normalizedInput = lowerInput.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');

    const bmcMatches = this.bmcKeywords.filter(keyword => {
      const normalizedKeyword = keyword.toLowerCase();
      const wordBoundaryPattern = new RegExp(`\\b${normalizedKeyword.replace(/\s+/g, '\\s+')}\\b`, 'i');
      return wordBoundaryPattern.test(normalizedInput) || normalizedInput.includes(normalizedKeyword);
    });

    const portersMatches = this.portersKeywords.filter(keyword => {
      const normalizedKeyword = keyword.toLowerCase();
      const wordBoundaryPattern = new RegExp(`\\b${normalizedKeyword.replace(/\s+/g, '\\s+')}\\b`, 'i');
      return wordBoundaryPattern.test(normalizedInput) || normalizedInput.includes(normalizedKeyword);
    });

    const businessStage = this.detectBusinessStage(lowerInput);
    const queryType = this.detectQueryType(lowerInput);

    return {
      bmcKeywords: bmcMatches,
      portersKeywords: portersMatches,
      businessStage,
      queryType,
    };
  }

  private detectBusinessStage(input: string): string {
    if (/\b(startup|new venture|launch|founding|early stage)\b/i.test(input)) {
      return 'early_stage';
    }
    if (/\b(pivot|transform|change direction|rethink|redesign)\b/i.test(input)) {
      return 'pivoting';
    }
    if (/\b(scale|expand|growth|mature|established)\b/i.test(input)) {
      return 'scaling';
    }
    return 'unknown';
  }

  private detectQueryType(input: string): string {
    if (/\b(how to|strategy for|approach to|plan for)\b/i.test(input)) {
      return 'strategic_planning';
    }
    if (/\b(analyze|assessment|evaluation|review)\b/i.test(input)) {
      return 'analysis';
    }
    if (/\b(compete|competitive|vs|versus|against)\b/i.test(input)) {
      return 'competitive';
    }
    return 'general';
  }

  private async analyzeWithClaude(
    input: string,
    signals: FrameworkSignals
  ): Promise<FrameworkSelectionResult> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are a strategic framework selection expert. Analyze the user's input and select the most appropriate framework.

FRAMEWORKS:
1. Business Model Canvas (BMC): Best for designing/redesigning business models, understanding revenue/customers/value
2. Porter's Five Forces: Best for competitive analysis, industry dynamics, market positioning

USER INPUT:
${input.substring(0, 1500)}

DETECTED SIGNALS:
- BMC keywords found: ${signals.bmcKeywords.join(', ') || 'none'}
- Porter's keywords found: ${signals.portersKeywords.join(', ') || 'none'}
- Business stage: ${signals.businessStage}
- Query type: ${signals.queryType}

SELECTION CRITERIA:
- Choose BMC if: Input focuses on business model design, revenue models, customer segments, value propositions, market entry/expansion strategy, investment decisions, or go-to-market planning
- Choose Porter's if: Input focuses on competitive dynamics, market forces, competitor analysis, industry structure analysis, or competitive positioning
- If both apply, prioritize BMC when discussing revenue targets, customer acquisition, value delivery, or investment strategy
- If both apply, prioritize Porter's when discussing competitive threats, industry barriers, or supplier/buyer power

Return ONLY valid JSON (no markdown, no explanation):

{
  "selectedFramework": "business_model_canvas|porters_five_forces",
  "confidence": 0.85,
  "reasoning": "Clear 2-3 sentence explanation of why this framework was selected based on input focus",
  "alternativeFramework": "business_model_canvas|porters_five_forces|null"
}

Confidence scale:
- 0.9-1.0: Very clear single framework focus
- 0.7-0.89: Clear primary framework with some secondary signals
- 0.5-0.69: Mixed signals but one framework is more appropriate
- <0.5: Unclear, may need user choice`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const ClaudeResponseSchema = z.object({
      selectedFramework: z.enum(['business_model_canvas', 'porters_five_forces']),
      confidence: z.number().min(0).max(1),
      reasoning: z.string().min(10),
      alternativeFramework: z.enum(['business_model_canvas', 'porters_five_forces', 'null']).optional().nullable(),
    });

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('FrameworkSelector: Failed to extract JSON from Claude response');
      return this.defaultSelection(signals);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const validated = ClaudeResponseSchema.parse(parsed);

      return {
        selectedFramework: validated.selectedFramework,
        confidence: validated.confidence,
        signals,
        reasoning: validated.reasoning,
        alternativeFramework: validated.alternativeFramework === 'null' || !validated.alternativeFramework 
          ? undefined 
          : validated.alternativeFramework,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('FrameworkSelector: Schema validation failed', error.errors);
      } else {
        console.error('FrameworkSelector: Error parsing Claude response', error);
      }
      return this.defaultSelection(signals);
    }
  }

  private defaultSelection(signals: FrameworkSignals): FrameworkSelectionResult {
    const bmcScore = signals.bmcKeywords.length;
    const portersScore = signals.portersKeywords.length;

    if (bmcScore > portersScore) {
      return {
        selectedFramework: 'business_model_canvas',
        confidence: 0.6,
        signals,
        reasoning: 'Selected Business Model Canvas based on keyword matching (Business model, revenue, customers). Confidence is moderate due to automatic detection.',
        alternativeFramework: portersScore > 0 ? 'porters_five_forces' : undefined,
      };
    } else if (portersScore > bmcScore) {
      return {
        selectedFramework: 'porters_five_forces',
        confidence: 0.6,
        signals,
        reasoning: 'Selected Porter\'s Five Forces based on keyword matching (Competitive analysis, market forces). Confidence is moderate due to automatic detection.',
        alternativeFramework: bmcScore > 0 ? 'business_model_canvas' : undefined,
      };
    }

    return {
      selectedFramework: 'porters_five_forces',
      confidence: 0.5,
      signals,
      reasoning: 'Defaulting to Porter\'s Five Forces as no clear framework signals were detected. Low confidence - user may want to choose manually.',
    };
  }

  async updateUserOverride(
    selectionId: string,
    overriddenFramework: FrameworkType
  ): Promise<void> {
    await db
      .update(frameworkSelections)
      .set({
        selectedFramework: overriddenFramework,
        userOverride: true,
      })
      .where(eq(frameworkSelections.id, selectionId));
  }
}
