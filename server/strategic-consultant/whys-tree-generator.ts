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

  private extractJSON(response: { content: string; provider: string; model: string }, context: string): any {
    console.log(`[WhysTreeGenerator] ${context} - AI provider:`, response.provider, 'model:', response.model);
    console.log(`[WhysTreeGenerator] ${context} - Response length:`, response.content.length);
    console.log(`[WhysTreeGenerator] ${context} - Response preview:`, response.content.substring(0, 200));
    
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
      throw new Error(`Failed to extract JSON from ${response.provider} ${context}. Response was: ${response.content.substring(0, 300)}`);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[WhysTreeGenerator] ${context} - Successfully parsed JSON`);
      return parsed;
    } catch (parseError: any) {
      console.error(`[WhysTreeGenerator] ${context} - JSON parse error:`, parseError.message);
      console.error(`[WhysTreeGenerator] ${context} - Attempted to parse:`, jsonMatch[0].substring(0, 300));
      throw new Error(`Failed to parse JSON from ${response.provider} ${context}: ${parseError.message}`);
    }
  }

  async generateTree(input: string, sessionId: string): Promise<WhyTree> {
    const rootQuestion = await this.generateRootQuestion(input);
    
    const level1Branches = await this.generateLevelInParallel(
      rootQuestion,
      { input, previousAnswers: [] },
      1
    );

    const level2BranchesPromises = level1Branches.map(level1Node =>
      this.generateLevelInParallel(
        level1Node.question,
        { input, previousAnswers: [level1Node.option] },
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
    context: { input: string; previousAnswers: string[] },
    depth: number,
    parentId?: string
  ): Promise<WhyNode[]> {
    const isLeaf = depth >= this.maxDepth;
    
    const response = await aiClients.callWithFallback({
      systemPrompt: 'You\'re helping someone figure out the real business reasons behind what\'s happening. Keep it conversational, clear, and focused on actual business strategy - not cultural stuff.',
      userMessage: `Alright, let's dig into this together! We're trying to understand the business reasons behind what's going on.

IMPORTANT: Stick to real business strategy. Here's what I mean:

✅ Talk about things like:
- What's happening in the market (competitors, pricing, growth)
- How the product fits what customers need
- What it costs to get and keep customers
- Resource constraints and how things are run
- What makes this business different from others
- The money side - what's driving costs and revenue

❌ Skip the cultural/social stuff like:
- Cultural norms and traditions
- Organizational culture observations
- Social behavior patterns
- Any anthropological analysis

Quick examples to show what I mean:
✅ "The market's growing 40% yearly with only 3 main players"
✅ "This solves a problem that costs businesses $50K each year"
✅ "Competitors don't have this feature yet - you've got a 6-month window"
❌ "Cultural norms around hierarchy affect decisions" - nope, too cultural

What they told us originally:
${context.input}

The question we're asking now:
${question}

${context.previousAnswers.length > 0 ? `Here's the path we've taken so far:\n${context.previousAnswers.map((a, i) => `${i + 1}. ${a}`).join('\n')}` : ''}

We're at step ${depth} of ${this.maxDepth}.

Give me 3-4 different answers to this "why" question. Make each one about real business reasons.

For each option, help them decide if it's the right path by providing:

1. WHY THIS MAKES SENSE (2-3 points):
   - What data or reasoning supports this explanation?
   - Why does this answer make business sense?
   - What market signals or economic factors back this up?

2. WHY THIS MIGHT NOT BE IT (2-3 points):
   - What evidence might contradict this?
   - What other explanations could be more accurate?
   - What factors suggest a different path might be better?

3. SOMETHING TO THINK ABOUT (1 sentence):
   - A neutral observation to help them compare this option to the others
   - Start with "Consider: [something useful]"

Remember: These aren't the final root causes yet - we're still working our way down. Help them evaluate: "Is this explanation accurate? Should I go down this road?"

Return ONLY valid JSON (no markdown, no extra text):

{
  "branches": [
    {
      "option": "Clear explanation in plain language",
      "next_question": "The next why question if they pick this",
      "supporting_evidence": [
        "Specific reason this makes sense (be concrete, not vague)",
        "Another solid indicator",
        "Third piece of evidence if you've got one"
      ],
      "counter_arguments": [
        "Specific reason this might not be right",
        "Alternative explanation or contradicting evidence",
        "Third counter-point if relevant"
      ],
      "consideration": "Neutral one-liner to help them compare options"
    }
  ]
}`,
      maxTokens: 2000,
    });

    const parsed = this.extractJSON(response, 'generateLevelInParallel');

    // Log the AI prompt context for debugging custom input issues
    if (context.previousAnswers.length > 0) {
      console.log(`[generateLevelInParallel] Depth ${depth} - Previous answers sent to AI:`, context.previousAnswers);
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
    selectedPath: string[],
    input: string,
    sessionId: string,
    currentDepth: number,
    parentQuestion: string
  ): Promise<WhyNode[]> {
    if (currentDepth >= this.maxDepth) {
      throw new Error('Cannot expand beyond maximum depth');
    }

    const nextDepth = currentDepth + 1;
    const branches = await this.generateLevelInParallel(
      parentQuestion,
      { input, previousAnswers: selectedPath },
      nextDepth,
      nodeId
    );

    return branches;
  }

  async generateCustomBranches(
    customOption: string,
    selectedPath: string[],
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

    // Generate a follow-up question based on the custom option
    const nextQuestion = `Why is this? (${customOption})`;
    
    const nextDepth = currentDepth + 1;
    // FIX: selectedPath already contains the custom option (added by frontend before API call)
    // Don't add it again - that causes duplication and confuses the AI
    const branches = await this.generateLevelInParallel(
      nextQuestion,
      { input, previousAnswers: selectedPath },
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
    let previousAnswers: string[] = [];

    for (let depth = 1; depth <= Math.min(selectedOptions.length + 1, this.maxDepth); depth++) {
      const branches = await this.generateLevelInParallel(
        currentQuestion,
        { input, previousAnswers },
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
        currentQuestion = selectedNode.question;
        previousAnswers.push(selectedNode.option);
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
      .map((node, i) => `Level ${node.depth}: ${node.option}`)
      .join('\n');

    const response = await aiClients.callWithFallback({
      systemPrompt: 'You\'re helping someone understand what their 5 Whys analysis revealed. Explain it clearly in everyday language, like you\'re talking to a friend.',
      userMessage: `Here's what they started with:
${input}

And here's the path we took to get to the bottom of it:
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
        systemPrompt: 'Check if this root cause is about real business factors or if it is just a cultural observation.',
        userMessage: `Root cause they found: "${rootCauseText}"

Good root causes talk about business stuff like:
- What's happening in the market (competitors, pricing, how you stand out)
- Customer behavior (loyalty, how much it costs to get them, why they stick around)
- Product/service features (what makes it different, quality, what it does)
- How things run (efficiency, costs, what resources you have)
- Technology and innovation (what gives you an edge)
- The money side (unit economics, how you make revenue)
- Sales and marketing (how you get customers, conversion rates)

Not-so-good root causes are just about culture:
- Cultural norms without business impact ("people prefer tea because of tradition")
- Geographic or ethnic stereotypes
- Social traditions without business logic
- Organizational culture without explaining how it affects operations
- Observations about behavior patterns without business context

Examples:
✅ GOOD: "Customer loyalty creates a competitive advantage through brand recognition"
✅ GOOD: "Premium pricing works because you're positioned as high-end"
✅ GOOD: "The market's crowded, so you need to stand out"
❌ NOT BUSINESS-FOCUSED: "Cultural hierarchy affects how people communicate"
❌ NOT BUSINESS-FOCUSED: "Traditional values about face-saving"

Respond with ONLY valid JSON:
{
  "isValid": true or false,
  "reason": "quick explanation in one sentence"
}`,
        maxTokens: 500,
      });

      const validation = this.extractJSON(response, 'validateRootCause');

      return {
        valid: validation.isValid,
        message: validation.isValid ? undefined : 
          `Hmm, this looks more like a cultural observation than a business root cause. ${validation.reason} Try exploring a different branch that focuses on market dynamics, competition, or how your product fits what customers need.`
      };
    } catch (error) {
      console.error('LLM validation failed, allowing root cause through:', error);
      return { valid: true };
    }
  }
}
