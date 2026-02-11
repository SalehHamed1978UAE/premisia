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

export interface ClarificationConflictResult {
  clarifiedInput: string;
  conflicts: string[];
}

/**
 * Ambiguity Detector Service
 * 
 * Detects ambiguous business inputs and generates clarifying questions
 */
export class AmbiguityDetectorService {
  private readonly CLARIFICATION_PLACEHOLDERS = new Set([
    'primary sales channel',
    'sales channel',
    'offering type',
    'company stage',
    'gtm constraints',
    'go to market constraints',
    'budget range',
    'timeline',
    'target timeline',
    'team size',
    'deployment model',
    'data residency',
    'privacy level',
    'pricing model',
    'roi target',
    'success metrics',
    'target segment',
    'customer segment',
    'customer type',
    'market segment',
  ]);

  private readonly CLARIFICATION_CONFLICT_RULES = [
    {
      label: 'Deployment model',
      groups: [
        { id: 'cloud_only', keywords: ['cloud-only', 'cloud only', 'saas only', 'hosted only', 'cloud hosted'] },
        { id: 'self_hosted', keywords: ['company-owned', 'on-prem', 'on premise', 'self-hosted', 'private cloud', 'in-house'] },
      ],
    },
    {
      label: 'Automation model',
      groups: [
        { id: 'alerts_only', keywords: ['alerts-only', 'alerts only', 'monitoring only'] },
        { id: 'automated_actions', keywords: ['automated actions', 'automatic actions', 'automated interventions', 'auto-remediation', 'autonomous actions'] },
      ],
    },
    {
      label: 'Sales motion',
      groups: [
        { id: 'channel_partners', keywords: ['channel partners', 'partner channel', 'resellers', 'channel sales'] },
        { id: 'direct_sales', keywords: ['direct sales only', 'direct sales', 'sales only', 'no channel'] },
      ],
    },
  ];

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
   * @param userInput - The text to analyze
   * @param precomputedQuestions - Optional pre-computed questions (e.g., from geographic disambiguation)
   */
  async detectAmbiguities(
    userInput: string,
    precomputedQuestions: AmbiguityQuestion[] = []
  ): Promise<AmbiguityDetectionResult> {
    console.log('[Ambiguity Detector] Analyzing input for ambiguities...');

    // If we have pre-computed questions, start with those
    const mergedQuestions: AmbiguityQuestion[] = [...precomputedQuestions];
    
    if (precomputedQuestions.length > 0) {
      console.log(`[Ambiguity Detector] Including ${precomputedQuestions.length} pre-computed question(s)`);
    }

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

      // Merge AI-detected questions with pre-computed questions
      if (result.questions && result.questions.length > 0) {
        mergedQuestions.push(...result.questions);
      }

      const hasAmbiguities = mergedQuestions.length > 0;

      console.log('[Ambiguity Detector] ✓ Analysis complete:', {
        hasAmbiguities,
        totalQuestions: mergedQuestions.length,
        precomputedQuestions: precomputedQuestions.length,
        aiDetectedQuestions: result.questions?.length || 0,
      });

      return {
        hasAmbiguities,
        questions: mergedQuestions,
        reasoning: result.reasoning || 'Questions require clarification',
      };
    } catch (error) {
      console.error('[Ambiguity Detector] Error:', error);
      // On error, still return pre-computed questions if any
      if (mergedQuestions.length > 0) {
        return {
          hasAmbiguities: true,
          questions: mergedQuestions,
          reasoning: 'Geographic disambiguation needed',
        };
      }
      // Otherwise, assume no ambiguities (fail gracefully)
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

  buildClarifiedInputWithConflicts(
    originalInput: string,
    clarifications: Record<string, string>
  ): ClarificationConflictResult {
    const baseInput = this.stripClarificationBlocks(originalInput);
    const clarificationLines = this.extractClarificationLines(clarifications);
    const conflicts = this.detectClarificationConflicts(clarificationLines);

    if (clarificationLines.length === 0) {
      return { clarifiedInput: baseInput, conflicts };
    }

    let clarifiedInput = `${baseInput}

CLARIFICATIONS:
${clarificationLines.map((line) => `- ${line}`).join('\n')}`;

    if (conflicts.length > 0) {
      clarifiedInput = `${clarifiedInput}

CLARIFICATION_CONFLICTS:
${conflicts.map((line) => `- ${line}`).join('\n')}`;
    }

    return { clarifiedInput, conflicts };
  }

  private extractClarificationLines(clarifications: Record<string, string>): string[] {
    return Object.values(clarifications)
      .map((value) => (value ?? '').toString().trim())
      .filter((value) => value.length > 0);
  }

  private detectClarificationConflicts(lines: string[]): string[] {
    const conflicts: string[] = [];
    const normalizedLines = lines.map((line) => this.normalizeForMatch(line));

    lines.forEach((line) => {
      if (this.isPlaceholderClarification(line)) {
        conflicts.push(`Placeholder clarification: "${line}"`);
      }
    });

    this.CLARIFICATION_CONFLICT_RULES.forEach((rule) => {
      const matched: Record<string, string[]> = {};
      rule.groups.forEach((group) => {
        const matches = lines.filter((line, idx) =>
          group.keywords.some((keyword) => normalizedLines[idx].includes(this.normalizeForMatch(keyword)))
        );
        if (matches.length > 0) {
          matched[group.id] = matches;
        }
      });

      const matchedGroups = Object.values(matched);
      if (matchedGroups.length > 1) {
        const summary = matchedGroups
          .map((groupLines) => groupLines.join('; '))
          .join(' vs ');
        conflicts.push(`${rule.label} conflict: ${summary}`);
      }
    });

    return conflicts;
  }

  private isPlaceholderClarification(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) {
      return true;
    }

    const normalized = this.normalizeForMatch(trimmed);
    if (this.CLARIFICATION_PLACEHOLDERS.has(normalized)) {
      return true;
    }

    if (/^(tbd|tbc|unknown|unspecified|not specified|n\/a|na)$/i.test(trimmed)) {
      return true;
    }

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex >= 0 && trimmed.slice(colonIndex + 1).trim().length === 0) {
      return true;
    }

    const wordCount = normalized.split(' ').filter(Boolean).length;
    if (wordCount <= 3 && normalized.includes('channel')) {
      return true;
    }

    return false;
  }

  private normalizeForMatch(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  private stripClarificationBlocks(input: string): string {
    const lines = input.split('\n');
    const kept: string[] = [];
    let skipping = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^clarifications?:/i.test(trimmed) || /^clarification_conflicts?:/i.test(trimmed)) {
        skipping = true;
        continue;
      }

      if (skipping) {
        if (trimmed === '' || /^\s*-\s+/.test(trimmed)) {
          continue;
        }
        skipping = false;
      }

      kept.push(line);
    }

    return kept.join('\n').trim();
  }
}

export const ambiguityDetector = new AmbiguityDetectorService();
