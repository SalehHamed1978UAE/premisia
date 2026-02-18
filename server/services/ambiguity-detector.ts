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
        maxTokens: 4096,
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
    const existingClarifications = this.extractClarificationLines(originalInput);
    const incomingClarifications = Object.entries(clarifications)
      .map(([_, answer]) => answer)
      .filter(Boolean);

    const { lines: resolvedClarifications, conflicts } = this.resolveClarificationConflicts(
      existingClarifications,
      incomingClarifications
    );

    const strippedInput = this.stripClarificationBlocks(originalInput);

    if (resolvedClarifications.length === 0) {
      if (conflicts.length === 0) {
        return strippedInput;
      }
      const conflictText = `\n\nCLARIFICATION_CONFLICTS:\n${conflicts.map(c => `- ${c}`).join('\n')}`;
      console.warn('[Ambiguity Detector] Clarification conflicts detected:', conflicts);
      return `${strippedInput}${conflictText}`;
    }

    const clarificationText = resolvedClarifications.map(c => `- ${c}`).join('\n');
    const conflictText = conflicts.length > 0
      ? `\n\nCLARIFICATION_CONFLICTS:\n${conflicts.map(c => `- ${c}`).join('\n')}`
      : '';

    if (conflicts.length > 0) {
      console.warn('[Ambiguity Detector] Clarification conflicts detected:', conflicts);
    }

    return `${strippedInput}

CLARIFICATIONS:
${clarificationText}${conflictText}`;
  }

  /**
   * Extract existing clarifications from a user-provided input block
   * Looks for "CLARIFICATIONS:" sections and collects bullet lines.
   */
  private parseInlineBullets(value: string): string[] {
    if (!value) {
      return [];
    }
    const parts = value.split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [value.trim()];
  }

  extractClarificationLines(input: string): string[] {
    const lines = input.split('\n');
    const clarifications: string[] = [];
    let inBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();
      // Strip markdown formatting from header (e.g., *CLARIFICATIONS:*, **CLARIFICATIONS:**)
      const stripped = trimmed.replace(/^\*+\s*/, '').replace(/\s*\*+$/, '');
      if (/^clarifications:/i.test(stripped)) {
        inBlock = true;
        const afterHeader = stripped.replace(/^clarifications:/i, '').trim();
        if (afterHeader) {
          this.parseInlineBullets(afterHeader).forEach(item => clarifications.push(item));
        }
        continue;
      }
      if (!inBlock) {
        // Check for mid-line CLARIFICATIONS: (e.g., "...text CLARIFICATIONS: We want...")
        const midLineMatch = trimmed.match(/\bCLARIFICATIONS:\s*(.+)/i);
        if (midLineMatch && midLineMatch[1] && !/^\*?clarifications:\*?$/i.test(trimmed)) {
          const inlineText = midLineMatch[1].trim()
            .replace(/^\*+/, '').replace(/\*+$/, '').trim(); // Strip trailing markdown
          if (inlineText.length > 1) {
            // Split by sentence boundaries
            const sentences = inlineText.split(/\.\s+/).map(s => s.trim().replace(/\.$/, '')).filter(Boolean);
            sentences.forEach(s => {
              if (s.length > 1) clarifications.push(s);
            });
          }
        }
        continue;
      }
      if (trimmed === '') {
        continue;
      }
      if (/^[A-Z_][A-Z0-9_ ]*:\s*$/i.test(trimmed)) {
        inBlock = false;
        continue;
      }
      // Support bullets: -, *, •, ⁠ (word joiner + bullet patterns)
      if (/^[-*•⁠]\s+/.test(trimmed) || /^[•⁠]\s*/.test(trimmed)) {
        const cleaned = trimmed.replace(/^[-*•⁠]+\s*/, '').trim();
        if (cleaned.length > 1) {
          clarifications.push(cleaned);
        }
        continue;
      }
      // End block on first non-bullet line
      inBlock = false;
    }

    return clarifications;
  }

  /**
   * Remove existing CLARIFICATIONS blocks to prevent duplication.
   */
  private stripClarificationBlocks(input: string): string {
    const lines = input.split('\n');
    const output: string[] = [];
    let inBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^clarifications:/i.test(trimmed)) {
        inBlock = true;
        continue;
      }
      if (inBlock) {
        if (trimmed === '' || /^[-*]\s+/.test(trimmed)) {
          continue;
        }
        // End block when encountering non-bullet content
        inBlock = false;
      }
      if (!inBlock) {
        output.push(line);
      }
    }

    return output.join('\n').trim();
  }

  /**
   * Resolve contradictory clarifications and return a clean list + conflict notes.
   * Resolution strategy: prefer clarifications explicitly present in the original input.
   */
  private resolveClarificationConflicts(
    existing: string[],
    incoming: string[]
  ): { lines: string[]; conflicts: string[] } {
    const entries = [
      ...existing.map(text => ({ text, source: 'input' as const })),
      ...incoming.map(text => ({ text, source: 'answer' as const })),
    ];

    const rules = [
      {
        id: 'deployment',
        label: 'Deployment model',
        a: ['cloud-only', 'cloud only', 'saas only'],
        b: ['company-owned infrastructure', 'on-prem', 'on premises', 'self-hosted', 'customer-owned'],
      },
      {
        id: 'automation',
        label: 'Automation scope',
        a: ['automated system actions', 'automated actions', 'system actions'],
        b: ['alerts only', 'recommendations only', 'alerts and recommendations only', 'no automated actions'],
      },
      {
        id: 'channel',
        label: 'Sales channel',
        a: ['through channel partners', 'channel partners', 'partner channel'],
        b: ['sales and lead generation only', 'direct sales', 'sales only'],
      },
    ];

    const conflicts: string[] = [];
    const keep = new Set(entries.map((_, idx) => idx));

    entries.forEach((entry, idx) => {
      if (this.isPlaceholderClarification(entry.text)) {
        conflicts.push(`Placeholder clarification: "${entry.text}"`);
        keep.delete(idx);
      }
    });

    for (const rule of rules) {
      const matchesA = entries
        .map((e, idx) => ({ e, idx }))
        .filter(({ e, idx }) => keep.has(idx) && this.matchesAny(e.text, rule.a));
      const matchesB = entries
        .map((e, idx) => ({ e, idx }))
        .filter(({ e, idx }) => keep.has(idx) && this.matchesAny(e.text, rule.b));

      if (matchesA.length > 0 && matchesB.length > 0) {
        conflicts.push(`${rule.label} conflict: "${matchesA[0].e.text}" vs "${matchesB[0].e.text}"`);

        const inputA = matchesA.some(m => m.e.source === 'input');
        const inputB = matchesB.some(m => m.e.source === 'input');

        if (inputA || inputB) {
          // Prefer explicit input clarifications; drop conflicting answers
          if (inputA) {
            matchesB.filter(m => m.e.source === 'answer').forEach(m => keep.delete(m.idx));
          }
          if (inputB) {
            matchesA.filter(m => m.e.source === 'answer').forEach(m => keep.delete(m.idx));
          }
        } else {
          // No explicit input: keep earliest occurrence, drop the other side
          const keepA = matchesA[0].idx < matchesB[0].idx;
          const drop = keepA ? matchesB : matchesA;
          drop.forEach(m => keep.delete(m.idx));
        }
      }
    }

    const normalized = new Set<string>();
    const resolved: string[] = [];
    entries.forEach((entry, idx) => {
      if (!keep.has(idx)) return;
      const key = entry.text.trim().toLowerCase();
      if (normalized.has(key)) return;
      normalized.add(key);
      resolved.push(entry.text.trim());
    });

    return { lines: resolved, conflicts };
  }

  private matchesAny(text: string, terms: string[]): boolean {
    const lower = text.toLowerCase();
    return terms.some(term => lower.includes(term));
  }

  buildClarifiedInputWithConflicts(
    originalInput: string,
    clarifications: Record<string, string>
  ): ClarificationConflictResult {
    const baseInput = this.stripClarificationBlocks(originalInput);
    const clarificationLines = this.extractClarificationLinesFromRecord(clarifications);
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

  private extractClarificationLinesFromRecord(clarifications: Record<string, string>): string[] {
    return Object.values(clarifications)
      .map((value) => (value ?? '').toString().trim())
      .filter((value) => value.length > 0);
  }

  detectClarificationConflicts(lines: string[]): string[] {
    const conflicts: string[] = [];
    const normalizedLines = lines.map((line) => this.normalizeForMatch(line));

    lines.forEach((line) => {
      if (this.isPlaceholderClarification(line)) {
        conflicts.push(`Placeholder clarification: "${line}"`);
      }
    });

    this.CLARIFICATION_CONFLICT_RULES.forEach((rule) => {
      const matched: Record<string, { lines: string[]; indices: Set<number> }> = {};
      rule.groups.forEach((group) => {
        const matchingLines: string[] = [];
        const matchingIndices = new Set<number>();
        lines.forEach((line, idx) => {
          if (group.keywords.some((keyword) => normalizedLines[idx].includes(this.normalizeForMatch(keyword)))) {
            matchingLines.push(line);
            matchingIndices.add(idx);
          }
        });
        if (matchingLines.length > 0) {
          matched[group.id] = { lines: matchingLines, indices: matchingIndices };
        }
      });

      const matchedEntries = Object.values(matched);
      if (matchedEntries.length > 1) {
        // Only flag conflict if opposing groups match on DIFFERENT lines.
        // A single line containing both keywords (e.g. "both channel partners and direct sales")
        // is the user describing their intent, not a contradiction between separate statements.
        const allMatchedIndices = new Set(matchedEntries.flatMap((e) => Array.from(e.indices)));
        if (allMatchedIndices.size > 1) {
          const summary = matchedEntries
            .map((e) => e.lines.join('; '))
            .join(' vs ');
          conflicts.push(`${rule.label} conflict: ${summary}`);
        }
      }
    });

    return conflicts;
  }

  /**
   * LLM-based semantic conflict detection. Catches contradictions that keyword rules miss.
   * Runs AFTER keyword-based detection as an enhancement layer.
   * Works for ANY business domain — no hardcoded keywords.
   */
  async detectSemanticConflicts(lines: string[]): Promise<string[]> {
    const meaningful = lines.filter((l) => l.trim().length > 3 && !this.isPlaceholderClarification(l));
    if (meaningful.length < 2) return [];

    const systemPrompt = `You are a business strategy analyst reviewing clarification statements provided by a user for a strategic planning tool. Your job is to identify CONTRADICTIONS between different statements.

A contradiction exists when two statements make claims that cannot both be true simultaneously. Examples:
- "Direct Sales Only" contradicts "sell through channel partners" (can't be direct-only AND use partners)
- "Full Automation" contradicts "manual human-driven review" (can't be fully automated AND manual)
- "Cloud-only deployment" contradicts "on-premises installation" (mutually exclusive)

Do NOT flag as contradictions:
- Statements that are simply different topics
- Vague or incomplete statements (flag as "unclear" instead)
- Statements that represent complementary strategies (e.g., "target SMBs" and "also serve enterprise")

Return a JSON object with this structure:
{
  "conflicts": [
    {
      "line1": "exact text of first conflicting statement",
      "line2": "exact text of second conflicting statement",
      "type": "brief category (e.g., sales_channel, automation_scope, deployment_model)",
      "explanation": "one sentence explaining why these contradict"
    }
  ],
  "unclear": [
    {
      "line": "exact text of vague statement",
      "reason": "why it's too vague to be actionable"
    }
  ]
}

If no conflicts or unclear items exist, return empty arrays.`;

    const userMessage = `Here are the clarification statements to analyze:\n\n${meaningful.map((l, i) => `${i + 1}. "${l}"`).join('\n')}`;

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt,
        userMessage,
        maxTokens: 1024,
      });

      const parsed = JSON.parse(response.content);
      const semanticConflicts: string[] = [];

      if (parsed.conflicts && Array.isArray(parsed.conflicts)) {
        for (const c of parsed.conflicts) {
          if (c.line1 && c.line2 && c.explanation) {
            semanticConflicts.push(
              `${c.type || 'Semantic'} conflict: "${c.line1}" vs "${c.line2}" — ${c.explanation}`
            );
          }
        }
      }

      if (parsed.unclear && Array.isArray(parsed.unclear)) {
        for (const u of parsed.unclear) {
          if (u.line && u.reason) {
            semanticConflicts.push(`Unclear clarification: "${u.line}" — ${u.reason}`);
          }
        }
      }

      return semanticConflicts;
    } catch (error: any) {
      console.warn(`[AmbiguityDetector] Semantic conflict detection failed (non-blocking): ${error.message}`);
      return [];
    }
  }

  /**
   * Combined conflict detection: keyword rules (fast, free) + LLM semantic analysis (thorough, async).
   * Returns all unique conflicts from both methods.
   */
  async detectAllConflicts(lines: string[]): Promise<string[]> {
    const keywordConflicts = this.detectClarificationConflicts(lines);
    const semanticConflicts = await this.detectSemanticConflicts(lines);

    // Deduplicate: if a keyword conflict covers the same lines as a semantic one, keep the semantic (more descriptive)
    const allConflicts = [...keywordConflicts];
    for (const sc of semanticConflicts) {
      const isDuplicate = keywordConflicts.some((kc) => {
        // Simple overlap check: if both mention the same pair of quoted strings
        const kcQuotes: string[] = kc.match(/"[^"]+"/g) || [];
        const scQuotes: string[] = sc.match(/"[^"]+"/g) || [];
        return kcQuotes.length >= 2 && scQuotes.length >= 2 &&
          kcQuotes.some((q) => scQuotes.includes(q));
      });
      if (!isDuplicate) {
        allConflicts.push(sc);
      }
    }

    return allConflicts;
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

    return false;
  }

  private normalizeForMatch(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

}

export const ambiguityDetector = new AmbiguityDetectorService();
