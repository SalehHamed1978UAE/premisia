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
          content: `You are a strategic consultant conducting a "5 Whys" analysis. Generate 3-4 distinct causal explanations.

ORIGINAL INPUT:
${context.input}

CURRENT QUESTION:
${question}

${context.previousAnswers.length > 0 ? `PREVIOUS ANSWERS IN THIS PATH:\n${context.previousAnswers.map((a, i) => `${i + 1}. ${a}`).join('\n')}` : ''}

CURRENT DEPTH: ${depth} of ${this.maxDepth}

Generate 3-4 distinct, strategic answers to this question. Each answer should:
- Provide a different causal explanation or perspective
- Be concise but meaningful (1-2 sentences)
- Lead naturally to a deeper "why" question at the next level
- Represent genuinely different strategic directions

For EACH answer, also generate the natural follow-up "Why" question that would come next.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):

{
  "branches": [
    {
      "option": "First answer explaining one causal factor",
      "next_question": "Why question that naturally follows from this answer"
    },
    {
      "option": "Second answer explaining a different causal factor",
      "next_question": "Why question that naturally follows from this answer"
    },
    {
      "option": "Third answer explaining another causal factor",
      "next_question": "Why question that naturally follows from this answer"
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

    const nodes: WhyNode[] = parsed.branches.map((branch: { option: string; next_question: string }) => ({
      id: randomUUID(),
      question: branch.next_question,
      option: branch.option,
      depth,
      isLeaf,
      parentId,
      branches: isLeaf ? undefined : [],
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
}
