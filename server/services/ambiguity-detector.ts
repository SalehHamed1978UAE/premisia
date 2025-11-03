import { aiClients } from '../ai-clients.js';

export interface AmbiguityQuestion {
  id: string;
  question: string;
  multiSelect?: boolean;
  options: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

export interface AmbiguityDetectionResult {
  hasAmbiguities: boolean;
  questions: AmbiguityQuestion[];
  reasoning?: string;
}

/**
 * Ambiguity Detector Service
 * 
 * Detects ambiguous business inputs and generates clarifying questions
 */
export class AmbiguityDetectorService {

  /**
   * Common ambiguity patterns to watch for
   */
  private readonly AMBIGUITY_PATTERNS = {
    technology_usage_vs_teaching: [
      'AI tutoring', 'AI coaching', 'AI consulting', 'AI training',
      'tech education', 'digital training', 'software tutoring'
    ],
    b2b_vs_b2c: [
      'consulting', 'services', 'platform', 'marketplace', 'app'
    ],
    physical_vs_digital: [
      'store', 'shop', 'location', 'platform', 'service'
    ],
    product_vs_service: [
      'offering', 'solution', 'business'
    ],
    local_vs_international: [
      'market', 'customers', 'expansion'
    ],
  };

  /**
   * Detect ambiguities in user input
   */
  async detectAmbiguities(userInput: string): Promise<AmbiguityDetectionResult> {
    console.log('[Ambiguity Detector] Analyzing input for ambiguities...');

    const prompt = `Analyze this business idea for ambiguities that would affect strategic planning:

"${userInput}"

COMMON AMBIGUITIES TO CHECK:

1. **Technology Role Ambiguity**
   - Does "AI tutoring" mean using AI to tutor students, OR teaching students about AI?
   - Does "tech consulting" mean advising on technology, OR providing tech services?

2. **Customer Type Ambiguity**
   - B2B (selling to businesses) or B2C (selling to consumers)?
   - Who is the actual customer?

3. **Delivery Mode Ambiguity**
   - Physical location (store, office) or digital (app, website, online)?
   - In-person or remote?

4. **Business Model Ambiguity**
   - Product (selling goods) or service (providing services)?
   - One-time purchase or subscription?

5. **Market Scope Ambiguity**
   - Local/regional or national/international?
   - Geographic boundaries unclear?

INSTRUCTIONS:
- Identify CRITICAL ambiguities that would lead to wrong strategic decisions
- For each ambiguity, generate a clear multiple-choice question
- Provide 2-3 specific options (not "other")
- Keep questions simple and direct

Return as JSON:
{
  "hasAmbiguities": true/false,
  "questions": [
    {
      "id": "unique_id",
      "question": "Clear question?",
      "multiSelect": true/false,
      "options": [
        {
          "value": "option_a",
          "label": "Short label",
          "description": "What this means"
        }
      ]
    }
  ],
  "reasoning": "Why these ambiguities matter"
}

NOTE: Set "multiSelect": true if options are NOT mutually exclusive (user can select multiple). Set "multiSelect": false or omit if options are mutually exclusive (user must choose one).

If NO critical ambiguities found, return:
{
  "hasAmbiguities": false,
  "questions": [],
  "reasoning": "Input is clear"
}`;

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a strategic planning expert. Detect ambiguities that would lead to wrong business assumptions. Return ONLY valid JSON.',
        userMessage: prompt,
        maxTokens: 1500,
      });

      // Extract JSON from response
      let cleanedContent = response.content.trim();
      
      // Remove markdown code blocks if present
      const codeBlockMatch = cleanedContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        cleanedContent = codeBlockMatch[1];
      }

      // Extract JSON object
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const result = JSON.parse(jsonMatch[0]);

      console.log('[Ambiguity Detector] ✓ Analysis complete:', {
        hasAmbiguities: result.hasAmbiguities,
        questionCount: result.questions?.length || 0,
      });

      return result;
    } catch (error) {
      console.error('[Ambiguity Detector] Error:', error);
      // On error, assume no ambiguities (fail gracefully)
      return {
        hasAmbiguities: false,
        questions: [],
        reasoning: 'Error detecting ambiguities - proceeding with input as-is',
      };
    }
  }

  /**
   * Incorporate clarifications into original input
   */
  buildClarifiedInput(
    originalInput: string,
    clarifications: Record<string, string>
  ): string {
    const clarificationText = Object.entries(clarifications)
      .map(([question, answer]) => `- ${answer}`)
      .join('\n');

    return `${originalInput}

CLARIFICATIONS:
${clarificationText}`;
  }
}

export const ambiguityDetector = new AmbiguityDetectorService();
