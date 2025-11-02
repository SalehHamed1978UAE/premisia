import { randomUUID } from 'crypto';
import { aiClients } from '../ai-clients.js';

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
}

export interface WhyTree {
  rootQuestion: string;
  branches: WhyNode[];
  maxDepth: number;
  sessionId: string;
}

interface BranchContext {
  selectedPath: string[];
  currentQuestion: string;
  depth: number;
}

export class WhysTreeGenerator {
  private readonly maxDepth = 5;

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
    const rootQuestion = await this.generateRootQuestion(input);
    
    // Don't generate any branches upfront - they'll be generated on-demand via expandBranch
    // This avoids the gpt-5 empty response issue and makes the system more responsive
    // Previously this generated Level 1 + Level 2 upfront, which was failing

    return {
      rootQuestion,
      branches: [], // Start with empty branches - user will expand to see options
      maxDepth: this.maxDepth,
      sessionId,
    };
  }

  async generateRootQuestion(input: string): Promise<string> {
    const response = await aiClients.callWithFallback({
      systemPrompt: 'You\'re a friendly strategic consultant helping someone think through their business challenge. You use the "5 Whys" technique - asking "why" to get to the heart of the matter.',
      userMessage: `Here's what they told you:
${input}

Let's start by asking a good "Why" question that gets to the core of what's going on. 

Write a question that:
- Feels natural and conversational (like you're talking to a friend)
- Gets at the real reason or purpose behind what they shared
- Opens the door for deeper exploration

Return a JSON object with the question:
{
  "question": "Why [phrase this naturally]?"
}`,
      maxTokens: 1000,
    });

    const parsed = this.extractJSON(response, 'generateRootQuestion');
    return parsed.question || response.content.trim();
  }

  async generateLevelInParallel(
    question: string,
    context: { input: string; history: Array<{ question: string; answer: string }> },
    depth: number,
    parentId?: string
  ): Promise<WhyNode[]> {
    const isLeaf = depth >= this.maxDepth;
    
    const response = await aiClients.callWithFallback({
      systemPrompt: 'You\'re a friendly business advisor helping someone figure out what\'s really going on with their business. Talk to them like a supportive friend who gets business stuff.',
      userMessage: `Alright, let's dig into this together! We're trying to understand the business reasons behind what's going on.

So here's the thing - we want to stay focused on business angles. That means looking at stuff like what's happening in the market, how customers are behaving, what the competition is doing, pricing dynamics, or resource constraints. Skip the cultural or social observations - those don't help us figure out the business logic here.

A few quick examples of what I'm looking for:
- "The market's growing 40% yearly with only 3 main players" ✓
- "This solves a problem that costs businesses $50K each year" ✓
- "Competitors don't have this feature yet - you've got a 6-month window" ✓
- "Cultural norms around hierarchy affect decisions" ✗ (too cultural, not business-focused)

What they told us originally:
${context.input}

The question we're asking now:
${question}

${context.history.length > 0 ? `Here's the path we've explored so far:\n${context.history.map((step, i) => `${i + 1}. Q: ${step.question}\n   A: ${step.answer}`).join('\n\n')}` : ''}

We're at step ${depth} of ${this.maxDepth}.

Give me 3-4 different answers to this "why" question - all focused on business reasons.

For each answer, I want you to help them evaluate whether this is the right path:

Supporting evidence (2-3 points): What makes this explanation make sense? Give concrete reasons - data, market signals, economic factors, whatever backs this up.

Counter-arguments (2-3 points): What might poke holes in this explanation? Are there other ways to look at it? What suggests this might not be the real reason?

Something to consider (1 sentence): A neutral observation that helps them compare this option to the others. Start with "Consider: [something insightful]"

**CRITICAL: The next_question field**
This is where you create the follow-up question IF they choose this option. The next question MUST directly interrogate THIS SPECIFIC OPTION - not jump to a different topic.

Examples of CORRECT next questions:
- If option is "Traditional cafes have lower operational complexity" → "Why do traditional cafes have lower operational complexity?"
- If option is "The market is growing 40% yearly" → "Why is the market growing 40% yearly?"
- If option is "Customers prefer premium experiences" → "Why do customers prefer premium experiences?"

Examples of WRONG next questions (these jump to unrelated topics):
- If option is "Traditional cafes have lower operational complexity" → "What specific aspects of Dubai's tourist traffic patterns..." ✗ (completely different topic!)
- If option is "The market is growing" → "How does competition affect pricing?" ✗ (didn't ask WHY it's growing)

The next question must always be: "Why [this exact option statement]?" - Keep the logical thread tight!

Remember - we're not at the final answer yet. We're just helping them figure out which path feels most accurate so they can keep digging.

CRITICAL: You MUST return your response in valid JSON format. Return ONLY valid JSON (no markdown, no extra text). Here is the exact JSON structure to use:

{
  "branches": [
    {
      "option": "Clear explanation in everyday language",
      "next_question": "Why [directly ask about THIS option - must interrogate this specific claim]?",
      "supporting_evidence": [
        "Specific, concrete reason this makes sense",
        "Another solid piece of evidence",
        "Third point if relevant"
      ],
      "counter_arguments": [
        "Specific reason this might not be accurate",
        "Alternative explanation or contradicting evidence",
        "Third counter-point if relevant"
      ],
      "consideration": "Neutral one-sentence insight to help them compare"
    }
  ]
}`,
      maxTokens: 2000,
    });

    const parsed = this.extractJSON(response, 'generateLevelInParallel');

    // Log the AI prompt context for debugging custom input issues
    if (context.history.length > 0) {
      console.log(`[generateLevelInParallel] Depth ${depth} - Q&A history sent to AI:`, context.history);
    }

    const nodes: WhyNode[] = parsed.branches.map((branch: { 
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
