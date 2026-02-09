export type WhysPathStep = {
  question?: string;
  answer?: string;
  option?: string;
  label?: string;
  why?: string;
  depth?: number;
};

export const normalizeWhysPathSteps = (path: any[]): Array<{ question: string; answer: string }> => {
  if (!Array.isArray(path)) return [];

  return path
    .map((step, idx) => {
      if (typeof step === 'string') {
        return { question: `Why ${idx + 1}?`, answer: step };
      }

      if (step && typeof step === 'object') {
        const answer =
          (typeof step.answer === 'string' && step.answer) ||
          (typeof step.option === 'string' && step.option) ||
          (typeof step.label === 'string' && step.label) ||
          (typeof step.why === 'string' && step.why) ||
          '';

        const question =
          (typeof step.question === 'string' && step.question) ||
          (typeof step.prompt === 'string' && step.prompt) ||
          `Why ${idx + 1}?`;

        if (!answer) return null;
        return { question, answer };
      }

      return null;
    })
    .filter((step): step is { question: string; answer: string } => Boolean(step));
};

export const whysPathToText = (path: any[]): string[] =>
  normalizeWhysPathSteps(path).map((step) => step.answer).filter(Boolean);

export const buildLinearWhysTree = (path: any[]): any | null => {
  const steps = normalizeWhysPathSteps(path);
  if (steps.length === 0) return null;

  const rootQuestion = steps[0].question || 'Why?';
  const tree: any = {
    rootQuestion,
    branches: [],
    maxDepth: steps.length,
  };

  let currentBranches = tree.branches;
  steps.forEach((step, idx) => {
    const nextQuestion = steps[idx + 1]?.question || undefined;
    const node: any = {
      id: `path-${idx + 1}`,
      option: step.answer,
      question: nextQuestion,
      branches: [],
    };
    currentBranches.push(node);
    currentBranches = node.branches;
  });

  return tree;
};
