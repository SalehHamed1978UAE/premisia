import { aiClients } from '../ai-clients.js';
import { z } from 'zod';
import { parseAIJson } from '../utils/parse-ai-json';

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
  error?: string;
}

const ambiguityOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional().default(""),
});

const ambiguityQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  multiSelect: z.boolean().optional(),
  options: z.array(ambiguityOptionSchema).min(1),
});

const ambiguityResponseSchema = z.object({
  hasAmbiguities: z.boolean().optional(),
  questions: z.array(ambiguityQuestionSchema).optional(),
  reasoning: z.string().optional(),
});

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
  private getFrameworkGapContext(journeyType?: string): string {
    const journeyGaps: Record<string, string> = {
      market_entry_strategy: `This analysis will run PESTLE → Porter's Five Forces → SWOT.
Key information gaps to probe:
- Geographic/regulatory context (which markets? what regulatory environment?)
- Competitive landscape (who are the main competitors? what's the market structure?)
- Internal capabilities (what resources/expertise does the team bring?)
- Market timing (why now? what's the trigger or opportunity?)`,

      business_model_innovation: `This analysis will run Five Whys root-cause → Business Model Canvas.
Key information gaps to probe:
- The specific business problem or trigger (what's failing or what opportunity exists?)
- Revenue/monetization approach (how will this make money?)
- Customer segment specificity (who exactly is the target buyer, and how do they buy today?)
- Delivery/operational model (how will the product or service reach customers?)`,

      crisis_recovery: `This analysis will run Five Whys → SWOT → Business Model Canvas.
Key information gaps to probe:
- The crisis trigger (what happened? what's the timeline and severity?)
- Current organizational state (what resources/capabilities remain intact?)
- Stakeholder impact (who is most affected — customers, employees, investors?)
- Recovery constraints (timeline pressure, budget limitations, regulatory requirements?)`,

      competitive_strategy: `This analysis will run Porter's Five Forces → BMC → Blue Ocean Strategy.
Key information gaps to probe:
- Specific competitors and their positioning (who are the top 2-3 rivals?)
- Current competitive advantages or disadvantages (what do you do better/worse?)
- Customer switching behavior (why do customers choose you vs alternatives?)
- Differentiation aspirations (where do you want to create uncontested space?)`,

      digital_transformation: `This analysis will run PESTLE → BMC → Ansoff Matrix.
Key information gaps to probe:
- Current operating model (what does the business look like today — analog vs digital?)
- Technology landscape (what systems exist? what's the tech maturity?)
- Transformation scope (incremental improvement or fundamental redesign?)
- Change readiness (team capabilities, budget, organizational appetite for change?)`,

      growth_strategy: `This analysis will run PESTLE → Ansoff Matrix → BMC.
Key information gaps to probe:
- Current products and markets (what do you sell today, and to whom?)
- Growth ambition (organic expansion vs new markets vs new products?)
- Resource constraints (funding, team size, timeline for growth?)
- Market conditions (growing, mature, or declining market?)`,

      market_segmentation_discovery: `This analysis will run Segment Discovery.
Key information gaps to probe:
- Current customer base (who buys today? any patterns noticed?)
- Segmentation criteria (geographic, behavioral, demographic, or needs-based?)
- Purchase decision factors (price, quality, convenience, brand — what matters most?)
- Channel and distribution (how do customers find and buy the product?)`,
    };

    return journeyGaps[journeyType || ''] || `No specific journey selected yet. Focus on the most impactful strategic gaps:
- Strategic intent (what's the goal — growth, defense, transformation, recovery?)
- Customer and market clarity (who is the customer, what market, what geography?)
- Competitive context (is there competition? what alternatives exist?)
- Resource and constraint awareness (budget, timeline, team size, key limitations?)`;
  }

  async detectAmbiguities(
    userInput: string,
    precomputedQuestions: AmbiguityQuestion[] = [],
    journeyType?: string
  ): Promise<AmbiguityDetectionResult> {
    console.log('[Ambiguity Detector] Analyzing input for ambiguities...', { journeyType: journeyType || 'none', inputLength: userInput.length });

    const mergedQuestions: AmbiguityQuestion[] = [...precomputedQuestions];
    
    if (precomputedQuestions.length > 0) {
      console.log(`[Ambiguity Detector] Including ${precomputedQuestions.length} pre-computed question(s)`);
    }

    const cleanedInput = this.stripClarificationBlocks(userInput);
    if (cleanedInput.length !== userInput.length) {
      console.log(`[Ambiguity Detector] Stripped stale CLARIFICATIONS block from input (${userInput.length} → ${cleanedInput.length} chars)`);
    }
    const truncatedInput = cleanedInput.length > 2000 ? cleanedInput.substring(0, 2000) + '...' : cleanedInput;
    const wordCount = cleanedInput.trim().split(/\s+/).length;
    const frameworkContext = this.getFrameworkGapContext(journeyType);

    const adaptiveInstruction = wordCount > 150
      ? 'The input is detailed. Only ask about critical gaps the frameworks cannot infer. 1-2 questions maximum.'
      : wordCount > 60
        ? 'The input has moderate detail. Ask about the most important missing dimensions. 2-3 questions maximum.'
        : 'The input is brief. Ask up to 3 questions to fill the most critical gaps for analysis.';

    const prompt = `You are conducting a strategic intake interview. Your goal is to ask clarifying questions that will directly improve the quality of the downstream strategic analysis.

## Business Input to Analyze
"${truncatedInput}"

## Framework Context
${frameworkContext}

## Adaptive Guidance
Input is ${wordCount} words. ${adaptiveInstruction}

## Rules
1. SKIP any dimension the input already addresses clearly — do not re-ask what's obvious.
2. Each question should probe something the analysis frameworks NEED but the input doesn't provide.
3. Questions should feel like a senior consultant asking smart follow-ups, not a form with checkboxes.
4. Each option needs a label (up to 10 words) AND a description (1 sentence explaining what this choice implies for the analysis).
5. Provide 3-4 options per question. Options should be meaningfully distinct, not just synonyms.
6. If the input is already comprehensive enough for quality analysis, return no questions.

## Response Format
Return ONLY valid JSON:
{
  "hasAmbiguities": true,
  "questions": [
    {
      "id": "q1",
      "question": "What is the primary strategic trigger for this initiative?",
      "multiSelect": false,
      "options": [
        {
          "value": "revenue_decline",
          "label": "Revenue is declining",
          "description": "Analysis will focus on competitive threats and market shifts causing the decline."
        },
        {
          "value": "market_opportunity",
          "label": "New market opportunity identified",
          "description": "Analysis will focus on market sizing, entry barriers, and competitive positioning."
        },
        {
          "value": "operational_pressure",
          "label": "Operational costs are unsustainable",
          "description": "Analysis will focus on process optimization, automation, and cost restructuring."
        }
      ]
    }
  ],
  "reasoning": "Brief explanation of why these questions matter for the analysis."
}

If the input is clear enough: {"hasAmbiguities": false, "questions": [], "reasoning": "Input provides sufficient context for analysis."}`;

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a senior strategic consultant conducting an intake interview for a client engagement. Your questions should reveal the strategic context that analytical frameworks need to produce actionable insights — not classify the business into generic categories. Return ONLY valid JSON. Maximum 3 questions.',
        userMessage: prompt,
        maxTokens: 2048,
      });

      const parsed = parseAIJson(response.content, 'ambiguity detector');
      const result = ambiguityResponseSchema.parse(parsed);

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
          error: error instanceof Error ? error.message : String(error),
        };
      }
      throw error instanceof Error
        ? error
        : new Error('Ambiguity detection unavailable');
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
      const stripped = trimmed.replace(/^\*+\s*/, '').replace(/\s*\*+$/, '');
      if (/^clarifications:/i.test(stripped) || /^clarification_conflicts:/i.test(stripped)) {
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
