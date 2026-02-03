import { randomUUID } from 'crypto';
import { aiClients } from '../ai-clients.js';
import {
  orchestrateAnalysis,
  OrchestrationResult,
  isContextFoundryConfigured
} from '../services/grounded-analysis-service';
import type { ContextBundle } from '../services/context-foundry-client';
import { FIVE_WHYS_SYSTEM_PROMPT } from '../../shared/contracts/five-whys.schema.js';

// =============================================================================
// MODULE-LEVEL CACHE (persists across requests)
// =============================================================================
const SESSION_BRANCH_CACHE = new Map<string, WhyNode[]>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const CACHE_METADATA = new Map<string, { timestamp: number }>();

// Cleanup stale cache entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, meta] of CACHE_METADATA.entries()) {
    if (now - meta.timestamp > CACHE_TTL) {
      SESSION_BRANCH_CACHE.delete(key);
      CACHE_METADATA.delete(key);
      console.log(`[Cache] Cleaned up stale entry: ${key}`);
    }
  }
}, 5 * 60 * 1000);

export interface WhyNode {
  id: string;
  question: string;
  option: string;
  depth: number;
  branches?: WhyNode[];
  isLeaf: boolean;
  parentId?: string;
  isCustom?: boolean;
  supporting_evidence: string[];
  counter_arguments: string[];
  consideration: string;
  isVerified?: boolean;
  verificationSource?: string;
}

export interface GroundingMetadata {
  isGrounded: boolean;
  confidence: number;
  confirmedEntities: Array<{ name: string; type: string; confidence: number }>;
  relationships: Array<{ source: string; type: string; target: string }>;
  flaggedAssumptions: string[];
  externalClaimsForWebSearch: string[];
}

export interface WhyTree {
  rootQuestion: string;
  branches: WhyNode[];
  maxDepth: number;
  sessionId: string;
  groundingMetadata?: GroundingMetadata;
}

interface BranchContext {
  selectedPath: string[];
  currentQuestion: string;
  depth: number;
}

export class WhysTreeGenerator {
  private readonly maxDepth = 5;
  private groundingContext: OrchestrationResult | null = null;
  private cfContextPrompt: string = '';

  /**
   * Build a context prompt section from Context Foundry data
   */
  private buildCFContextPrompt(orchestration: OrchestrationResult): string {
    const sections: string[] = [];
    
    if (orchestration.cfContext && orchestration.cfContext.isGrounded) {
      sections.push(`\n## Verified Organizational Context (from Knowledge Graph)`);
      sections.push(`**Confidence: ${Math.round(orchestration.cfContext.confidence * 100)}%**`);
      
      if (orchestration.cfContext.confirmedEntities.length > 0) {
        sections.push(`\n### Confirmed Entities - USE THESE FACTS:`);
        for (const entity of orchestration.cfContext.confirmedEntities.slice(0, 10)) {
          sections.push(`- ${entity.type}: **${entity.name}** (${Math.round(entity.confidence * 100)}% confidence)`);
        }
      }

      if (orchestration.cfContext.inferredRelationships.length > 0) {
        sections.push(`\n### Known Relationships - USE THESE FACTS:`);
        for (const rel of orchestration.cfContext.inferredRelationships.slice(0, 10)) {
          sections.push(`- ${rel.sourceEntity} → ${rel.relationshipType} → ${rel.targetEntity}`);
        }
      }

      if (orchestration.cfContext.answer) {
        sections.push(`\n### Context Foundry Analysis:`);
        sections.push(orchestration.cfContext.answer);
      }
      
      sections.push(`\n**IMPORTANT: Reference these verified entities and relationships in your analysis. Mark any claims NOT from this list as [ASSUMED].**`);
    }

    if (orchestration.flaggedAssumptions.length > 0) {
      sections.push(`\n## ⚠️ Flagged Assumptions (unverified claims):`);
      for (const assumption of orchestration.flaggedAssumptions.slice(0, 5)) {
        sections.push(`- ${assumption}`);
      }
    }

    return sections.join('\n');
  }

  private extractJSON(response: { content: string; provider: string; model: string }, context: string, fallback?: any): any {
    console.log(`[WhysTreeGenerator] ${context} - AI provider:`, response.provider, 'model:', response.model);
    console.log(`[WhysTreeGenerator] ${context} - Response length:`, response.content.length);
    console.log(`[WhysTreeGenerator] ${context} - Response preview:`, response.content.substring(0, 200));
    
    // Handle empty or whitespace-only responses
    if (!response.content || response.content.trim().length === 0) {
      console.warn(`[WhysTreeGenerator] ${context} - Empty response from ${response.provider}, using fallback`);
      if (fallback) return fallback;
      throw new Error(`Empty response from ${response.provider} ${context}`);
    }
    
    let cleanedContent = response.content.trim();
    
    const codeBlockMatch = cleanedContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      console.log(`[WhysTreeGenerator] ${context} - Extracted from code block`);
      cleanedContent = codeBlockMatch[1];
    }

    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[WhysTreeGenerator] ${context} - Failed to extract JSON from AI response`);
      console.error(`[WhysTreeGenerator] ${context} - Provider:`, response.provider);
      console.error(`[WhysTreeGenerator] ${context} - Full response:`, response.content);
      if (fallback) {
        console.warn(`[WhysTreeGenerator] ${context} - Using fallback value`);
        return fallback;
      }
      throw new Error(`Failed to extract JSON from ${response.provider} ${context}. Response was: ${response.content.substring(0, 300)}`);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[WhysTreeGenerator] ${context} - Successfully parsed JSON`);
      return parsed;
    } catch (parseError: any) {
      console.error(`[WhysTreeGenerator] ${context} - JSON parse error:`, parseError.message);
      console.error(`[WhysTreeGenerator] ${context} - Attempted to parse:`, jsonMatch[0].substring(0, 300));
      if (fallback) {
        console.warn(`[WhysTreeGenerator] ${context} - Using fallback value due to parse error`);
        return fallback;
      }
      throw new Error(`Failed to parse JSON from ${response.provider} ${context}: ${parseError.message}`);
    }
  }

  async generateTree(input: string, sessionId: string): Promise<WhyTree> {
    // Step 1: Query Context Foundry for grounding BEFORE any AI calls
    let groundingMetadata: GroundingMetadata | undefined;
    
    if (isContextFoundryConfigured()) {
      try {
        console.log('[WhysTreeGenerator] Querying Context Foundry for grounding...');
        this.groundingContext = await orchestrateAnalysis(input, 'five_whys');
        this.cfContextPrompt = this.buildCFContextPrompt(this.groundingContext);
        
        console.log(`[WhysTreeGenerator] CF grounding result: isGrounded=${this.groundingContext.cfContext?.isGrounded}, entities=${this.groundingContext.cfContext?.confirmedEntities?.length || 0}, relationships=${this.groundingContext.cfContext?.inferredRelationships?.length || 0}`);
        
        // Build metadata for output
        if (this.groundingContext.cfContext) {
          groundingMetadata = {
            isGrounded: this.groundingContext.cfContext.isGrounded,
            confidence: this.groundingContext.cfContext.confidence,
            confirmedEntities: this.groundingContext.cfContext.confirmedEntities.map(e => ({
              name: e.name,
              type: e.type,
              confidence: e.confidence
            })),
            relationships: this.groundingContext.cfContext.inferredRelationships.map(r => ({
              source: r.sourceEntity,
              type: r.relationshipType,
              target: r.targetEntity
            })),
            flaggedAssumptions: this.groundingContext.flaggedAssumptions,
            externalClaimsForWebSearch: this.groundingContext.externalClaimsForWebSearch
          };
        }
      } catch (error) {
        console.warn('[WhysTreeGenerator] Context Foundry grounding failed, proceeding without:', error);
        this.groundingContext = null;
        this.cfContextPrompt = '';
      }
    } else {
      console.log('[WhysTreeGenerator] Context Foundry not configured, proceeding without grounding');
      // Explicitly reset to prevent stale data from previous runs
      this.groundingContext = null;
      this.cfContextPrompt = '';
    }
    
    const rootQuestion = await this.generateRootQuestion(input);
    
    const level1Branches = await this.generateLevelInParallel(
      rootQuestion,
      { input, history: [] },
      1
    );

    const level2BranchesPromises = level1Branches.map(level1Node =>
      this.generateLevelInParallel(
        level1Node.question,
        { input, history: [{ question: rootQuestion, answer: level1Node.option }] },
        2,
        level1Node.id
      ).then(level2Branches => {
        level1Node.branches = level2Branches;
        return level1Node;
      })
    );

    const level1WithLevel2 = await Promise.all(level2BranchesPromises);

    return {
      rootQuestion,
      branches: level1WithLevel2,
      maxDepth: this.maxDepth,
      sessionId,
      groundingMetadata,
    };
  }

  async generateRootQuestion(input: string): Promise<string> {
    // Build system prompt with CF context if available
    let systemPrompt = FIVE_WHYS_SYSTEM_PROMPT;

    if (this.cfContextPrompt) {
      systemPrompt += `\n\nYou have access to verified organizational data. Use specific entity names and relationships from this data when forming your questions.`;
    }

    let userMessage = `Business challenge: ${input}
${this.cfContextPrompt}

Generate the opening question for this Five Whys analysis.

The question must:
- Focus on a critical business success factor (customer value, competitive advantage, market opportunity, or business viability)
- Be specific and interrogative (not vague or philosophical)
- Lead directly toward business mechanisms and evidence
${this.cfContextPrompt ? '- Reference specific entities or relationships from the verified context above when relevant' : ''}

GOOD examples:
- "Why would customers choose your solution over existing alternatives?"
- "Why can't competitors easily replicate this advantage?"
- "Why would this business model generate sustainable revenue?"

BAD examples:
- "Why do you want to start a business?" (too philosophical)
- "Why is this important to you?" (personal, not business-focused)

Return JSON:
{
  "question": "Why [specific business mechanism]?"
}`;

    const response = await aiClients.callWithFallback({
      systemPrompt,
      userMessage,
      maxTokens: 1000,
    });

    const parsed = this.extractJSON(response, 'generateRootQuestion');
    return parsed.question || response.content.trim();
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const words1 = new Set(normalize(text1).split(/\s+/));
    const words2 = new Set(normalize(text2).split(/\s+/));
    
    const words1Array = Array.from(words1);
    const words2Array = Array.from(words2);
    
    const intersection = new Set(words1Array.filter(word => words2.has(word)));
    const union = new Set([...words1Array, ...words2Array]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private validateAnswerQuality(option: string, question: string): { valid: boolean; reason?: string } {
    const normalizedOption = option.toLowerCase().trim();
    const normalizedQuestion = question.toLowerCase().trim();

    if (option.length < 15) {
      return { valid: false, reason: 'Answer too short (less than 15 characters)' };
    }

    const similarity = this.calculateTextSimilarity(option, question);
    if (similarity > 0.7) {
      return { valid: false, reason: `Answer is too similar to question (${Math.round(similarity * 100)}% similarity)` };
    }

    const questionWords = normalizedQuestion.replace(/^why\s+/i, '').replace(/\?$/, '').split(/\s+/);
    const optionWords = normalizedOption.split(/\s+/);
    
    if (optionWords.length > 5) {
      const consecutiveMatches = questionWords.filter(word => 
        word.length > 3 && normalizedOption.includes(word)
      ).length;
      
      if (consecutiveMatches > questionWords.length * 0.6) {
        return { valid: false, reason: 'Answer repeats too many words from question' };
      }
    }

    const startsWithQuestion = normalizedOption.startsWith(normalizedQuestion.replace(/^why\s+/i, '').replace(/\?$/, '').substring(0, 30));
    if (startsWithQuestion) {
      return { valid: false, reason: 'Answer starts by repeating the question' };
    }

    return { valid: true };
  }

  async generateLevelInParallel(
    question: string,
    context: { input: string; history: Array<{ question: string; answer: string }> },
    depth: number,
    parentId?: string
  ): Promise<WhyNode[]> {
    const isLeaf = depth >= this.maxDepth;
    const maxRetries = 3;

    // Build enhanced system prompt
    let systemPrompt = `${FIVE_WHYS_SYSTEM_PROMPT}

CRITICAL: Every "why" answer must include:
1. MECHANISM: What drives this (cause → effect relationship)
2. OBSERVABLE SIGNAL: What data would prove this
3. DISCONFIRMING SIGNAL: What would falsify this claim

BUSINESS DOMAINS ONLY:
- Market dynamics, Customer behavior, Competition, Economics
- Distribution, Regulation, Resources

ANTI-PATTERNS (Reject):
✗ "You think/feel" ✗ "Because it's important" ✗ "Because it's new"`;

    if (this.cfContextPrompt) {
      systemPrompt += '\n\nIMPORTANT: You have verified organizational data available. When making claims about the organization\'s systems, services, or relationships, use the specific entity names and facts provided. Mark claims as [VERIFIED] when they match the provided context, or [ASSUMED] when they go beyond it.';
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const response = await aiClients.callWithFallback({
        systemPrompt,
        userMessage: `Business challenge: ${context.input}
${this.cfContextPrompt}

Current question: ${question}

${context.history.length > 0 ? `Path so far:\n${context.history.map((step, i) => `${i + 1}. Q: ${step.question}\n   A: ${step.answer}`).join('\n\n')}` : ''}

Depth: ${depth}/${this.maxDepth}

Generate exactly 3 possible answers explaining WHY.

EACH ANSWER REQUIRES:
- MECHANISM: Causal relationship (X → Y through Z)
- OBSERVABLE SIGNAL: Specific evidence/data
- DISCONFIRMING SIGNAL: What would prove this wrong
- BUSINESS LENS: Tie to market/customer/competition/economics

NO vague statements. Use specific numbers when possible.
NO invented facts unless marked [ASSUMPTION].

EXAMPLES:
✓ "Customer acquisition cost ($450/customer) exceeds customer lifetime value ($280) due to 60% annual churn"
✓ "UAE regulatory framework requires AED 50K minimum capital + DFSA license (6-month approval process)"
✓ "Market leader (40% share) has locked 80% of enterprise customers into 3-year contracts"
${this.cfContextPrompt ? '✓ "API Gateway (verified entity) handles 2M requests/day and has 3 dependent services that cascade on failure"' : ''}

✗ "Because it's important to customers" (no mechanism, no signal)
✗ "The market is growing" (no numbers, no evidence)
✗ "People value authenticity" (vague, untestable)

**CRITICAL: next_question must interrogate THIS answer**
If answer is "Traditional cafes have 40% lower operational overhead due to simpler supply chains"
→ next_question: "Why do traditional cafes have lower operational overhead?"
NOT: "What are customer preferences in Dubai?" (different topic!)

Return JSON:
{
  "branches": [
    {
      "option": "Mechanism explaining why (cause → effect)",
      "next_question": "Why [interrogate this specific answer]?",
      "supporting_evidence": ["Observable signal 1", "Observable signal 2"],
      "counter_arguments": ["Disconfirming signal 1", "Disconfirming signal 2"],
      "consideration": "Neutral comparison insight"
    }
  ]
}`,
        maxTokens: 2000,
      });

      const parsed = this.extractJSON(response, 'generateLevelInParallel');

      if (context.history.length > 0) {
        console.log(`[generateLevelInParallel] Depth ${depth} - Q&A history sent to AI:`, context.history);
      }

      const validBranches: typeof parsed.branches = [];
      const invalidBranches: Array<{ option: string; reason: string }> = [];

      for (const branch of parsed.branches) {
        const qualityCheck = this.validateAnswerQuality(branch.option, question);
        
        if (qualityCheck.valid) {
          validBranches.push(branch);
        } else {
          invalidBranches.push({ option: branch.option, reason: qualityCheck.reason || 'Unknown' });
          console.warn(`[Quality Control] Rejected answer (attempt ${attempt}/${maxRetries}): "${branch.option}" - Reason: ${qualityCheck.reason}`);
        }
      }

      if (validBranches.length >= 3) {
        console.log(`[Quality Control] ✓ Generated ${validBranches.length} valid answers on attempt ${attempt}/${maxRetries}`);
        
        const nodes: WhyNode[] = validBranches.map((branch: { 
          option: string; 
          next_question: string;
          supporting_evidence: string[];
          counter_arguments: string[];
          consideration: string;
        }) => ({
          id: randomUUID(),
          question: branch.next_question,
          option: branch.option,
          depth,
          isLeaf,
          parentId,
          branches: isLeaf ? undefined : [],
          supporting_evidence: branch.supporting_evidence || [],
          counter_arguments: branch.counter_arguments || [],
          consideration: branch.consideration || '',
        }));

        return nodes;
      }

      if (attempt < maxRetries) {
        console.log(`[Quality Control] Only ${validBranches.length} valid answers. Retrying... (attempt ${attempt + 1}/${maxRetries})`);
        if (invalidBranches.length > 0) {
          console.log(`[Quality Control] Rejected answers:`, invalidBranches);
        }
      } else {
        console.warn(`[Quality Control] Failed to generate 3+ valid answers after ${maxRetries} attempts. Using best available (${validBranches.length} valid answers)`);
        
        if (validBranches.length === 0) {
          throw new Error(`Failed to generate any valid answers after ${maxRetries} attempts. All answers were circular or too similar to the question.`);
        }

        const nodes: WhyNode[] = validBranches.map((branch: { 
          option: string; 
          next_question: string;
          supporting_evidence: string[];
          counter_arguments: string[];
          consideration: string;
        }) => ({
          id: randomUUID(),
          question: branch.next_question,
          option: branch.option,
          depth,
          isLeaf,
          parentId,
          branches: isLeaf ? undefined : [],
          supporting_evidence: branch.supporting_evidence || [],
          counter_arguments: branch.counter_arguments || [],
          consideration: branch.consideration || '',
        }));

        return nodes;
      }
    }

    throw new Error('Unexpected error in generateLevelInParallel - should not reach here');
  }

  async expandBranch(
    nodeId: string,
    selectedPath: string[] | Array<{ question: string; answer: string }>,
    input: string,
    sessionId: string,
    currentDepth: number,
    parentQuestion: string
  ): Promise<WhyNode[]> {
    if (currentDepth >= this.maxDepth) {
      throw new Error('Cannot expand beyond maximum depth');
    }

    // Convert old format (string[]) to new format for backward compatibility
    const history: Array<{ question: string; answer: string }> =
      Array.isArray(selectedPath) && selectedPath.length > 0 && typeof selectedPath[0] === 'string'
        ? (selectedPath as string[]).map((answer, idx) => ({
            question: `Step ${idx + 1}`, // Placeholder for old format
            answer
          }))
        : selectedPath as Array<{ question: string; answer: string }>;

    const nextDepth = currentDepth + 1;
    const branches = await this.generateLevelInParallel(
      parentQuestion,
      { input, history },
      nextDepth,
      nodeId
    );

    return branches;
  }

  // =============================================================================
  // CACHE METHODS
  // =============================================================================

  getCachedBranches(sessionId: string, nodeId: string, depth: number): WhyNode[] | null {
    const cacheKey = `${sessionId}:${nodeId}:${depth}`;
    const cached = SESSION_BRANCH_CACHE.get(cacheKey);

    if (cached) {
      console.log(`[Cache HIT] ${cacheKey}`);
      return cached;
    }

    return null;
  }

  private setCachedBranches(sessionId: string, nodeId: string, depth: number, branches: WhyNode[]): void {
    const cacheKey = `${sessionId}:${nodeId}:${depth}`;
    SESSION_BRANCH_CACHE.set(cacheKey, branches);
    CACHE_METADATA.set(cacheKey, { timestamp: Date.now() });
    console.log(`[Cache SET] ${cacheKey} - ${branches.length} branches`);
  }

  // =============================================================================
  // PREFETCH METHODS
  // =============================================================================

  async expandBranchWithPrefetch(
    nodeId: string,
    selectedPath: Array<{ question: string; answer: string }>,
    input: string,
    sessionId: string,
    currentDepth: number,
    parentQuestion: string,
    allSiblings?: Array<{ id: string; question: string; option: string; depth: number }>
  ): Promise<{ expandedBranches: WhyNode[]; prefetchPromises?: Promise<void>[] }> {

    // Check cache first
    const cached = this.getCachedBranches(sessionId, nodeId, currentDepth);
    if (cached) {
      return { expandedBranches: cached };
    }

    // Expand the selected branch
    const expandedBranches = await this.expandBranch(
      nodeId,
      selectedPath,
      input,
      sessionId,
      currentDepth,
      parentQuestion
    );

    // Cache the result
    this.setCachedBranches(sessionId, nodeId, currentDepth, expandedBranches);

    let prefetchPromises: Promise<void>[] = [];

    // ONLY prefetch if depth <= 3 and we have siblings
    if (allSiblings && allSiblings.length > 1 && currentDepth <= 3 && currentDepth < this.maxDepth - 1) {
      const otherSiblings = allSiblings.filter(s => s.id !== nodeId);

      console.log(`[Prefetch START] Session ${sessionId}, depth ${currentDepth}, prefetching ${otherSiblings.length} siblings`);

      prefetchPromises = otherSiblings.map(sibling =>
        this.prefetchBranch(sibling, input, selectedPath, currentDepth, sessionId)
          .catch(err => {
            console.warn(`[Prefetch FAILED] Node ${sibling.id}:`, err.message);
          })
      );

      // Don't await - let them run in background
      Promise.allSettled(prefetchPromises).then(() => {
        console.log(`[Prefetch COMPLETE] Session ${sessionId}, depth ${currentDepth}`);
      });
    }

    return { expandedBranches, prefetchPromises };
  }

  private async prefetchBranch(
    sibling: { id: string; question: string; option: string; depth: number },
    input: string,
    selectedPath: Array<{ question: string; answer: string }>,
    currentDepth: number,
    sessionId: string
  ): Promise<void> {
    // Check if already cached
    const cached = this.getCachedBranches(sessionId, sibling.id, currentDepth);
    if (cached) {
      console.log(`[Prefetch SKIP] ${sibling.id} - already cached`);
      return;
    }

    // Build hypothetical path if user had selected this sibling instead
    const hypotheticalPath = [...selectedPath, { question: sibling.question, answer: sibling.option }];

    try {
      const nextDepth = currentDepth + 1;
      const branches = await this.generateLevelInParallel(
        sibling.question,
        { input, history: hypotheticalPath },
        nextDepth,
        sibling.id
      );

      // Cache the result
      this.setCachedBranches(sessionId, sibling.id, currentDepth, branches);

      console.log(`[Prefetch SUCCESS] Node ${sibling.id} - cached ${branches.length} branches`);
    } catch (error: any) {
      console.error(`[Prefetch ERROR] Node ${sibling.id}:`, error.message);
      throw error;
    }
  }

  async generateCustomBranches(
    customOption: string,
    selectedPath: string[] | Array<{ question: string; answer: string }>,
    input: string,
    sessionId: string,
    currentDepth: number
  ): Promise<WhyNode[]> {
    if (currentDepth >= this.maxDepth) {
      throw new Error('Cannot expand beyond maximum depth');
    }

    console.log('[generateCustomBranches] Received selectedPath:', selectedPath);
    console.log('[generateCustomBranches] Received customOption:', customOption);
    console.log('[generateCustomBranches] Custom option already in path - using selectedPath directly');

    // Convert old format (string[]) to new format for backward compatibility
    const history: Array<{ question: string; answer: string }> = 
      Array.isArray(selectedPath) && selectedPath.length > 0 && typeof selectedPath[0] === 'string'
        ? (selectedPath as string[]).map((answer, idx) => ({ 
            question: `Step ${idx + 1}`, // Placeholder for old format
            answer 
          }))
        : selectedPath as Array<{ question: string; answer: string }>;

    // Generate a follow-up question based on the custom option
    const nextQuestion = `Why is this? (${customOption})`;
    
    const nextDepth = currentDepth + 1;
    // FIX: selectedPath already contains the custom option (added by frontend before API call)
    // Don't add it again - that causes duplication and confuses the AI
    const branches = await this.generateLevelInParallel(
      nextQuestion,
      { input, history },
      nextDepth
    );

    return branches;
  }

  async generateFullPath(
    input: string,
    sessionId: string,
    selectedOptions: string[]
  ): Promise<WhyNode[]> {
    if (selectedOptions.length === 0) {
      throw new Error('At least one selected option is required');
    }

    const rootQuestion = await this.generateRootQuestion(input);
    const path: WhyNode[] = [];
    let currentQuestion = rootQuestion;
    let history: Array<{ question: string; answer: string }> = [];

    for (let depth = 1; depth <= Math.min(selectedOptions.length + 1, this.maxDepth); depth++) {
      const branches = await this.generateLevelInParallel(
        currentQuestion,
        { input, history },
        depth,
        path.length > 0 ? path[path.length - 1].id : undefined
      );

      if (depth <= selectedOptions.length) {
        const selectedOption = selectedOptions[depth - 1];
        const selectedNode = branches.find(b => b.option === selectedOption);
        
        if (!selectedNode) {
          throw new Error(`Selected option not found at depth ${depth}`);
        }

        path.push(selectedNode);
        history.push({ question: currentQuestion, answer: selectedNode.option });
        currentQuestion = selectedNode.question;
      } else {
        path.push(...branches);
        break;
      }
    }

    return path;
  }

  extractRootCause(path: WhyNode[]): string {
    if (path.length === 0) {
      return 'No path analyzed';
    }

    const finalNode = path[path.length - 1];
    return `After ${path.length} levels of analysis, the root cause appears to be: ${finalNode.option}`;
  }

  async analyzePathInsights(
    input: string,
    path: WhyNode[]
  ): Promise<{ root_cause: string; strategic_implications: string[]; recommended_actions: string[] }> {
    const pathDescription = path
      .map((node, i) => `Level ${node.depth}:\n  Q: ${node.question}\n  A: ${node.option}`)
      .join('\n\n');

    const response = await aiClients.callWithFallback({
      systemPrompt: 'You\'re helping someone understand what their 5 Whys analysis revealed. Explain it clearly in everyday language, like you\'re talking to a friend.',
      userMessage: `Here's what they started with:
${input}

And here's the path we took to get to the bottom of it (showing the question asked and answer selected at each level):
${pathDescription}

Okay, time to wrap this up! Based on everything we uncovered, I need you to:

1. Sum up the real core issue we found (the root cause)
2. Explain what this means for their business (3-5 implications - keep them practical)
3. Suggest what they should actually do about it (3-5 concrete actions)

Write this in a friendly, conversational way. No corporate jargon - just clear, helpful advice.

Return ONLY valid JSON (no markdown, no extra text):

{
  "root_cause": "Clear, plain-language explanation of the real issue",
  "strategic_implications": [
    "What this means for your business (be specific)",
    "Another implication (keep it real)",
    "Third one if relevant"
  ],
  "recommended_actions": [
    "Something concrete you can do",
    "Another practical step",
    "Third action if you've got one"
  ]
}`,
      maxTokens: 2000,
    });

    return this.extractJSON(response, 'analyzePathInsights');
  }

  async validateRootCause(rootCauseText: string): Promise<{ valid: boolean; message?: string }> {
    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a safety check for harmful stereotypes. Be VERY permissive - only flag obvious ethnic, racial, or national stereotypes. When in doubt, approve it.',
        userMessage: `Does this root cause contain an ethnic, racial, or national stereotype? "${rootCauseText}"

Default to VALID unless it's an OBVIOUS stereotype like:
❌ "Asian cultures avoid confrontation"
❌ "Western executives take more risks than Eastern ones"  
❌ "Middle Eastern business culture prioritizes relationships over contracts"

Everything else is VALID, including:
✓ Psychological patterns (fear, risk aversion, blame, reputation concerns)
✓ Organizational behavior (bureaucracy, hierarchy, decision paralysis)
✓ Market/business dynamics (any analysis of markets, customers, competition, pricing)
✓ Industry patterns (sales cycles, buyer conservatism, proof requirements)
✓ Resource/capability issues (gaps, constraints, skills, expertise)

When in doubt → mark as valid. Only flag EXPLICIT stereotypes about ethnic/racial/national groups.

Respond with ONLY valid JSON:
{
  "isValid": true or false,
  "reason": "why it's a stereotype OR why it's valid"
}`,
        maxTokens: 300,
      });

      const validation = this.extractJSON(response, 'validateRootCause');
      
      console.log(`[validateRootCause] AI validation result: ${validation.isValid ? 'valid' : 'invalid'} - "${rootCauseText}"`);

      return {
        valid: validation.isValid,
        message: validation.isValid ? undefined : 
          `I'm not convinced this gets to the business side of things yet. ${validation.reason} Maybe try a different branch - look for signals about what's happening with customers, the market, or your competitive position?`
      };
    } catch (error) {
      console.error('LLM validation failed, allowing root cause through:', error);
      return { valid: true };
    }
  }
}
