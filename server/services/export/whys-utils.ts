type WhyStepObject = Record<string, any>;

function normalizeText(value: any): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function toAnswerText(step: any): string {
  if (typeof step === 'string') return normalizeText(step);
  if (!step || typeof step !== 'object') return '';

  const node = step as WhyStepObject;
  const candidates = [
    node.answer,
    node.option,
    node.label,
    node.why,
    node.reason,
    node.text,
    node.value,
    node.question,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (normalized.length > 0) return normalized;
  }

  return '';
}

export function normalizeWhysPath(path: any): string[] {
  if (!Array.isArray(path)) return [];

  // Handle canonical format (Q/A objects)
  if (path.length > 0 && path[0]?.answer !== undefined) {
    return path
      .map((step) => step.answer || '')
      .filter((step) => step.length > 0);
  }

  // Handle legacy format (strings or other objects)
  return path
    .map((step) => toAnswerText(step))
    .filter((step) => step.length > 0);
}

export function pickCanonicalWhysPath(candidates: any[]): string[] {
  const normalized = candidates
    .map((candidate) => normalizeWhysPath(candidate))
    .filter((candidate) => candidate.length > 0);

  if (normalized.length === 0) return [];

  const complete = normalized.filter((candidate) => candidate.length >= 4);
  const pool = complete.length > 0 ? complete : normalized;

  return pool.reduce((best, candidate) => {
    if (candidate.length > best.length) return candidate;
    return best;
  }, pool[0]);
}

export function normalizeWhysPathForReport(path: any): Array<{ question: string; answer: string }> {
  // If already in canonical format with questions, use directly
  if (Array.isArray(path) && path.length > 0 && path[0]?.question) {
    return path.map((step: any) => ({
      question: step.question || `Why ${step.depth + 1}?`,
      answer: step.answer || ''
    }));
  }

  // Legacy format: array of strings (answers only)
  const answers = normalizeWhysPath(path);
  return answers.map((answer, index) => ({
    question: `Why ${index + 1}?`, // Placeholder for legacy format
    answer,
  }));
}

export function pickRootCause(canonicalWhysPath: string[], rootCandidates: any[]): string | null {
  if (canonicalWhysPath.length > 0) {
    return canonicalWhysPath[canonicalWhysPath.length - 1];
  }

  for (const candidate of rootCandidates) {
    const normalized = normalizeText(candidate);
    if (normalized.length > 0) return normalized;
  }

  return null;
}
