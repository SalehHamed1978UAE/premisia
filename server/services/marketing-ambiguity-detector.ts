import { aiClients } from '../ai-clients.js';

export interface ClarificationQuestion {
  id: string;
  type: 'single_select' | 'multi_select' | 'text';
  question: string;
  options?: { value: string; label: string }[];
  required: boolean;
}

export interface AmbiguityResult {
  hasAmbiguities: boolean;
  questions: ClarificationQuestion[];
  reasoning?: string;
}

/**
 * Marketing Ambiguity Detector Service
 * 
 * Generates AI-driven clarification questions tailored to marketing/segment discovery context.
 * Analyzes user input to identify gaps in offering description and generates relevant questions
 * to help identify the best target segments.
 */
export class MarketingAmbiguityDetector {

  /**
   * Detect ambiguities in user input for marketing/segment discovery context
   * @param userInput - The text to analyze
   * @param precomputedQuestions - Optional pre-computed questions to merge
   */
  async detectAmbiguities(
    userInput: string,
    precomputedQuestions: ClarificationQuestion[] = []
  ): Promise<AmbiguityResult> {
    console.log('[Marketing Ambiguity Detector] Analyzing input for marketing context...');

    const mergedQuestions: ClarificationQuestion[] = [...precomputedQuestions];
    
    if (precomputedQuestions.length > 0) {
      console.log(`[Marketing Ambiguity Detector] Including ${precomputedQuestions.length} pre-computed question(s)`);
    }

    const prompt = `You are a marketing strategy expert. Analyze this offering description and identify what information is missing or unclear for effective segment discovery and go-to-market planning.

USER'S OFFERING DESCRIPTION:
"${userInput}"

CONTEXT: We need to understand this offering well enough to identify the best target market segments. Generate 3-5 clarification questions based on what's ACTUALLY missing or unclear in the input.

QUESTION CATEGORIES TO CONSIDER (only ask if NOT already clear from input):

1. **Offering Type** - Is this software/SaaS, professional services, physical product, digital product, marketplace, etc.?

2. **Company Stage** - Where is this company in its lifecycle?
   - Just an idea (nothing built yet)
   - Built but no users/customers
   - Early users/customers (finding product-market fit)
   - Growing (proven model, scaling up)
   - Scaling/established (optimizing and expanding)

3. **GTM Constraints** - What are the resource constraints?
   - Solo founder (limited time/budget)
   - Small team (2-5 people)
   - Funded startup (has runway, building team)
   - Established company (has resources, structure)

4. **Preferred Sales Motion** - How do they want to sell?
   - Self-serve (users buy without talking to sales)
   - Light-touch sales (quick demos, transactional)
   - Enterprise sales (longer cycles, relationships)
   - Partner/channel (sell through others)
   - Combination

5. **Customer Hypothesis** - Do they have an existing hypothesis about who their ideal customer is? (optional free-text)

INSTRUCTIONS:
- Only generate questions for information that is MISSING or UNCLEAR
- Generate 3-5 questions maximum
- Make questions specific and actionable
- For select questions, provide 2-5 clear options
- If the input already provides clear answers to a category, skip that category
- Questions should help us understand who to target and how

Return as JSON:
{
  "hasAmbiguities": true/false,
  "questions": [
    {
      "id": "unique_snake_case_id",
      "type": "single_select" | "multi_select" | "text",
      "question": "Clear, specific question?",
      "options": [
        { "value": "option_value", "label": "Option Label" }
      ],
      "required": true/false
    }
  ],
  "reasoning": "Brief explanation of why these questions matter for segment discovery"
}

NOTES:
- Use "single_select" when only one answer makes sense
- Use "multi_select" when multiple options could apply
- Use "text" for open-ended questions (no options needed)
- Set "required": false only for optional questions like customer hypothesis
- Omit "options" array for text type questions

If the input is already comprehensive enough for segment discovery, return:
{
  "hasAmbiguities": false,
  "questions": [],
  "reasoning": "Input provides sufficient context for segment discovery"
}`;

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a marketing strategy expert helping identify target market segments. Analyze offerings and generate clarification questions to understand the business context better. Return ONLY valid JSON.',
        userMessage: prompt,
        maxTokens: 2000,
      });

      let cleanedContent = response.content.trim();
      
      const codeBlockMatch = cleanedContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        cleanedContent = codeBlockMatch[1];
      }

      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const result = JSON.parse(jsonMatch[0]);

      if (result.questions && result.questions.length > 0) {
        const normalizedQuestions = result.questions.map((q: any) => ({
          id: q.id || `q_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          type: this.normalizeQuestionType(q.type),
          question: q.question,
          options: q.options || undefined,
          required: q.required !== false,
        }));
        mergedQuestions.push(...normalizedQuestions);
      }

      const hasAmbiguities = mergedQuestions.length > 0;

      console.log('[Marketing Ambiguity Detector] ✓ Analysis complete:', {
        hasAmbiguities,
        totalQuestions: mergedQuestions.length,
        precomputedQuestions: precomputedQuestions.length,
        aiDetectedQuestions: result.questions?.length || 0,
      });

      return {
        hasAmbiguities,
        questions: mergedQuestions,
        reasoning: result.reasoning || 'Additional context needed for segment discovery',
      };
    } catch (error) {
      console.error('[Marketing Ambiguity Detector] Error:', error);
      
      if (mergedQuestions.length > 0) {
        return {
          hasAmbiguities: true,
          questions: mergedQuestions,
          reasoning: 'Pre-computed questions require clarification',
        };
      }
      
      return this.getFallbackQuestions();
    }
  }

  /**
   * Normalize question type to valid enum value
   */
  private normalizeQuestionType(type: string): 'single_select' | 'multi_select' | 'text' {
    const normalized = type?.toLowerCase().replace(/[^a-z_]/g, '');
    if (normalized === 'single_select' || normalized === 'singleselect') {
      return 'single_select';
    }
    if (normalized === 'multi_select' || normalized === 'multiselect') {
      return 'multi_select';
    }
    if (normalized === 'text' || normalized === 'freetext' || normalized === 'free_text') {
      return 'text';
    }
    return 'single_select';
  }

  /**
   * Generate fallback questions when AI fails
   */
  private getFallbackQuestions(): AmbiguityResult {
    return {
      hasAmbiguities: true,
      questions: [
        {
          id: 'offering_type',
          type: 'single_select',
          question: 'What type of offering is this?',
          options: [
            { value: 'software_saas', label: 'Software / SaaS' },
            { value: 'services', label: 'Professional Services' },
            { value: 'physical_product', label: 'Physical Product' },
            { value: 'digital_product', label: 'Digital Product (courses, content)' },
            { value: 'marketplace', label: 'Marketplace / Platform' },
          ],
          required: true,
        },
        {
          id: 'company_stage',
          type: 'single_select',
          question: 'What stage is your company at?',
          options: [
            { value: 'idea', label: 'Just an idea (nothing built yet)' },
            { value: 'built_no_users', label: 'Built but no users/customers' },
            { value: 'early_users', label: 'Early users (finding product-market fit)' },
            { value: 'growing', label: 'Growing (proven model, scaling up)' },
            { value: 'scaling', label: 'Scaling/established' },
          ],
          required: true,
        },
        {
          id: 'gtm_constraints',
          type: 'single_select',
          question: 'What are your go-to-market resource constraints?',
          options: [
            { value: 'solo_founder', label: 'Solo founder (limited time/budget)' },
            { value: 'small_team', label: 'Small team (2-5 people)' },
            { value: 'funded_startup', label: 'Funded startup (has runway)' },
            { value: 'established', label: 'Established company (has resources)' },
          ],
          required: true,
        },
        {
          id: 'sales_motion',
          type: 'multi_select',
          question: 'What sales approach do you prefer or expect to use?',
          options: [
            { value: 'self_serve', label: 'Self-serve (users buy without sales)' },
            { value: 'light_touch', label: 'Light-touch sales (quick demos)' },
            { value: 'enterprise', label: 'Enterprise sales (longer cycles)' },
            { value: 'partner_channel', label: 'Partner/channel (sell through others)' },
          ],
          required: true,
        },
        {
          id: 'customer_hypothesis',
          type: 'text',
          question: 'Do you have an existing hypothesis about who your ideal customer is? (optional)',
          required: false,
        },
      ],
      reasoning: 'Using standard marketing discovery questions due to analysis error',
    };
  }

  /**
   * Incorporate clarifications into original input for enhanced context
   */
  buildClarifiedInput(
    originalInput: string,
    clarifications: Record<string, string | string[]>
  ): string {
    const clarificationLines: string[] = [];

    for (const [questionId, answer] of Object.entries(clarifications)) {
      if (!answer || (Array.isArray(answer) && answer.length === 0)) {
        continue;
      }

      const formattedAnswer = Array.isArray(answer) ? answer.join(', ') : answer;
      const label = this.getQuestionLabel(questionId);
      clarificationLines.push(`- ${label}: ${formattedAnswer}`);
    }

    if (clarificationLines.length === 0) {
      return originalInput;
    }

    return `${originalInput}

MARKETING CONTEXT CLARIFICATIONS:
${clarificationLines.join('\n')}`;
  }

  /**
   * Get human-readable label for a question ID
   */
  private getQuestionLabel(questionId: string): string {
    const labels: Record<string, string> = {
      offering_type: 'Offering Type',
      company_stage: 'Company Stage',
      gtm_constraints: 'GTM Constraints',
      sales_motion: 'Sales Motion',
      customer_hypothesis: 'Customer Hypothesis',
    };
    
    return labels[questionId] || questionId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}

export const marketingAmbiguityDetector = new MarketingAmbiguityDetector();
