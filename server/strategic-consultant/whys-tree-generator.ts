import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';

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
  private anthropic: Anthropic;
  private readonly maxDepth = 5;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
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
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: `You are a strategic consultant analyzing a business problem or opportunity using the "5 Whys" technique.

INPUT:
${input}

Generate a clear, strategic root question that frames this as a "Why" question to begin the 5 Whys analysis. The question should be:
- Focused on understanding the fundamental purpose or problem
- Open-ended to encourage deep exploration
- Strategic in nature (not tactical)

Return ONLY the question text, no JSON, no explanation, no quotes. Just the question.

Example: "Why is there a need to enter the renewable energy market?"`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n')
      .trim();

    return textContent;
  }

  async generateLevelInParallel(
    question: string,
    context: { input: string; previousAnswers: string[] },
    depth: number,
    parentId?: string
  ): Promise<WhyNode[]> {
    const isLeaf = depth >= this.maxDepth;
    
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: `You are a strategic business consultant performing a 5 Whys root cause analysis for BUSINESS STRATEGY.

STRICT REQUIREMENT: Use ONLY business strategy reasoning. Cultural/anthropological analysis is FORBIDDEN.

FORBIDDEN TOPICS (DO NOT USE):
- Cultural dynamics, hierarchical respect, face-saving, indirect communication
- Power imbalances, organizational culture theory
- Cultural identity, traditions, or anthropological concepts
- Social norms, cultural preferences, or societal behavior patterns
- Traditional values or cultural accommodation strategies

REQUIRED TOPICS (MUST USE):
- Market saturation and competitive positioning
- Product-market fit and feature differentiation
- Pricing pressure and customer acquisition costs
- Resource constraints and go-to-market strategy
- Market dynamics and competitive advantage
- Sales cycle efficiency and conversion metrics
- Customer churn and retention economics
- Competitive moats and barriers to entry

Each "Why?" must explore BUSINESS LOGIC:
- Why does this business decision make competitive sense?
- What market conditions drive this strategy?
- How does this create competitive advantage?
- What are the economic/resource constraints?
- What customer pain points drive demand?
- What are the unit economics or financial drivers?

EXAMPLES OF CORRECT BUSINESS REASONING:
✅ "Market shows 40% YoY growth with only 3 established players"
✅ "Addresses unmet need costing customers $50K annually per enterprise"
✅ "Competitors lack this feature, creating 6-month differentiation window"
✅ "Customer acquisition cost is $12K but competitor average is $45K"
✅ "Current product serves 10-50 employees, but enterprise needs 500+ employee features"

EXAMPLES OF FORBIDDEN CULTURAL REASONING:
❌ "Cultural norms require respect for hierarchy"
❌ "Face-saving is important in this culture"
❌ "Indirect communication preferences affect feedback"
❌ "Power distance influences decision-making processes"
❌ "Traditional organizational structures prioritize loyalty"

Your analysis path should explain COMPETITIVE STRATEGY, not cultural accommodation.

FINAL VALIDATION: Before generating each option, verify:
- Does this explain a BUSINESS competitive dynamic? ✅
- Does this mention cultural norms or traditions? ❌

If any option explores cultural behavior instead of business strategy, regenerate it with business logic.

ORIGINAL INPUT:
${context.input}

CURRENT QUESTION:
${question}

${context.previousAnswers.length > 0 ? `PREVIOUS ANSWERS IN THIS PATH:\n${context.previousAnswers.map((a, i) => `${i + 1}. ${a}`).join('\n')}` : ''}

CURRENT DEPTH: ${depth} of ${this.maxDepth}

Generate 3-4 distinct, business-focused answers to this question. Each answer must follow BUSINESS REASONING only.

For each option you generate, provide evidence to help the user evaluate if this causal explanation is accurate:

1. SUPPORTING EVIDENCE (2-3 bullet points):
   - Data, metrics, or reasoning why this causal explanation is valid
   - Why this answer to "Why?" makes business sense
   - Market signals, competitive indicators, or economic factors supporting this path

2. COUNTER-ARGUMENTS (2-3 bullet points):
   - Data, metrics, or reasoning why this explanation might NOT be accurate
   - Alternative explanations or contradicting evidence
   - Factors that suggest a different causal path might be more relevant

3. CONSIDERATION (1 sentence):
   - Neutral observation to help user decide if this causal path is worth exploring deeper
   - Frame as "Consider: [insight that helps compare this option to alternatives]"

IMPORTANT: These are causal explanations at intermediate levels, not root causes yet. Help the user evaluate: "Is this WHY accurate? Should I explore this branch?"

Return ONLY valid JSON with this exact structure (no markdown, no explanation):

{
  "branches": [
    {
      "option": "Clear, business-focused causal statement",
      "next_question": "The next Why? question if user selects this",
      "supporting_evidence": [
        "Specific metric, data point, or business reasoning (not generic)",
        "Another concrete indicator supporting this explanation",
        "Third piece of evidence if relevant"
      ],
      "counter_arguments": [
        "Specific evidence that challenges this explanation",
        "Alternative perspective or contradicting data",
        "Third counter-point if relevant"
      ],
      "consideration": "Neutral one-sentence insight comparing trade-offs or noting what this path reveals"
    }
  ]
}`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from branch generation response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

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

    // Generate a follow-up question based on the custom option
    const nextQuestion = `Why is this? (${customOption})`;
    
    const nextDepth = currentDepth + 1;
    const branches = await this.generateLevelInParallel(
      nextQuestion,
      { input, previousAnswers: [...selectedPath, customOption] },
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

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are a strategic consultant synthesizing insights from a "5 Whys" analysis.

ORIGINAL INPUT:
${input}

ANALYSIS PATH:
${pathDescription}

Based on this analysis path, provide:
1. A clear statement of the root cause identified
2. 3-5 strategic implications
3. 3-5 recommended actions to address the root cause

Return ONLY valid JSON with this exact structure (no markdown, no explanation):

{
  "root_cause": "Clear statement of the fundamental root cause",
  "strategic_implications": [
    "First strategic implication",
    "Second strategic implication",
    "Third strategic implication"
  ],
  "recommended_actions": [
    "First recommended action",
    "Second recommended action",
    "Third recommended action"
  ]
}`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from path insights response');
    }

    return JSON.parse(jsonMatch[0]);
  }

  async validateRootCause(rootCauseText: string): Promise<{ valid: boolean; message?: string }> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: `Determine if this root cause addresses BUSINESS/OPERATIONAL factors or merely describes CULTURAL observations.

Root cause: "${rootCauseText}"

VALID root causes address:
- Market dynamics, competition, pricing power, competitive moats
- Customer behavior, customer loyalty, brand loyalty, acquisition costs
- Product/service differentiation, quality, features
- Operational efficiency, cost structures, resource constraints
- Technology capabilities, innovation, competitive advantage
- Financial models, unit economics, retention economics
- Go-to-market strategy, sales efficiency, conversion metrics

INVALID root causes that are just cultural observations:
- Cultural norms without business impact (e.g., "people prefer tea because of tradition")
- Geographic or ethnic stereotypes
- Social traditions as endpoints without business logic
- Organizational culture without operational link
- Anthropological observations about behavior patterns

EXAMPLES:
✅ VALID: "Customer loyalty creates competitive moats through brand differentiation"
✅ VALID: "Premium positioning justifies higher costs through pricing power"
✅ VALID: "Market saturation drives need for differentiation"
❌ INVALID: "Cultural preference for hierarchy affects communication"
❌ INVALID: "Traditional values prioritize face-saving"

Respond with ONLY valid JSON in this exact format:
{
  "isValid": true or false,
  "reason": "brief explanation in one sentence"
}`,
          },
        ],
      });

      const textContent = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as Anthropic.TextBlock).text)
        .join('\n');

      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Failed to extract JSON from validation response, allowing root cause through');
        return { valid: true };
      }

      const validation = JSON.parse(jsonMatch[0]);

      return {
        valid: validation.isValid,
        message: validation.isValid ? undefined : 
          `This appears to be a cultural observation rather than a business root cause. ${validation.reason} Consider exploring a different branch that focuses on market dynamics, competitive positioning, or product-market fit.`
      };
    } catch (error) {
      console.error('LLM validation failed, allowing root cause through:', error);
      return { valid: true };
    }
  }
}
