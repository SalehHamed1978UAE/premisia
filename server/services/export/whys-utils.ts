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

function isCanonicalStep(step: any): boolean {
  return !!(
    step &&
    typeof step === 'object' &&
    typeof step.question === 'string' &&
    step.question.trim().length > 0 &&
    typeof step.answer === 'string' &&
    step.answer.trim().length > 0
  );
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

export function preserveCanonicalWhysPath(path: any): any[] {
  if (!Array.isArray(path)) return [];

  // If already in canonical format with questions, preserve it
  if (path.length > 0 && path[0]?.question && path[0]?.answer) {
    console.log('[Export Service] Preserving canonical format with questions');
    return path.filter(step => step && step.answer);
  }

  // If legacy string format, return as is (will use placeholders)
  if (path.length > 0 && typeof path[0] === 'string') {
    console.log('[Export Service] Legacy string format detected, returning as string array');
    return path.filter(step => step && step.trim().length > 0);
  }

  // If mixed or other format, try to preserve what we can
  return path.map((step, index) => {
    if (typeof step === 'string') {
      return step;
    } else if (step && typeof step === 'object') {
      // If it has both question and answer, preserve the canonical format
      if (step.question && step.answer) {
        return {
          question: step.question,
          answer: step.answer,
          depth: step.depth !== undefined ? step.depth : index,
        };
      }
      // Otherwise, try to extract answer as string
      return toAnswerText(step);
    }
    return null;
  }).filter(step => step !== null);
}

function scoreCanonicalPath(path: any[]): number {
  const canonicalSteps = path.filter((step) => isCanonicalStep(step)).length;
  return canonicalSteps * 100 + path.length;
}

export function pickCanonicalWhysPath(candidates: any[]): any[] {
  const preserved = candidates
    .map((candidate) => preserveCanonicalWhysPath(candidate))
    .filter((candidate) => Array.isArray(candidate) && candidate.length > 0);

  const canonical = preserved.filter((candidate) => candidate.some((step) => isCanonicalStep(step)));
  if (canonical.length > 0) {
    const canonicalComplete = canonical.filter((candidate) => candidate.length >= 4);
    const pool = canonicalComplete.length > 0 ? canonicalComplete : canonical;
    return pool.reduce((best, candidate) => {
      if (scoreCanonicalPath(candidate) > scoreCanonicalPath(best)) return candidate;
      return best;
    }, pool[0]);
  }

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

// New function that preserves canonical format with questions
export function pickCanonicalWhysPathWithQuestions(candidates: any[]): any[] {
  // First, find candidates that have the canonical format with questions
  const canonicalCandidates = candidates.filter((candidate) => {
    return Array.isArray(candidate) &&
           candidate.length > 0 &&
           candidate[0]?.question &&
           candidate[0]?.answer;
  });

  // If we have canonical format candidates, pick the best one
  if (canonicalCandidates.length > 0) {
    // Prefer longer paths (more complete analysis)
    const complete = canonicalCandidates.filter((candidate) => candidate.length >= 4);
    const pool = complete.length > 0 ? complete : canonicalCandidates;

    return pool.reduce((best, candidate) => {
      if (candidate.length > best.length) return candidate;
      return best;
    }, pool[0]);
  }

  // Fallback: Try to reconstruct canonical format from string arrays
  const normalized = candidates
    .filter((candidate) => Array.isArray(candidate) && candidate.length > 0);

  if (normalized.length === 0) return [];

  // Pick the best string array
  const bestStringArray = normalized.reduce((best, candidate) => {
    const bestLength = Array.isArray(best) ? best.length : 0;
    const candidateLength = Array.isArray(candidate) ? candidate.length : 0;
    return candidateLength > bestLength ? candidate : best;
  }, normalized[0]);

  // If it's already canonical, return it
  if (bestStringArray[0]?.question) {
    return bestStringArray;
  }

  // If it's strings, convert to canonical with placeholders (last resort)
  if (typeof bestStringArray[0] === 'string') {
    return bestStringArray.map((answer: string, index: number) => ({
      question: `Why ${index + 1}?`,
      answer,
      depth: index
    }));
  }

  return [];
}

export function normalizeWhysPathForReport(path: any): Array<{ question: string; answer: string }> {
  // If already in canonical format with questions, use directly
  if (Array.isArray(path) && path.length > 0 && path[0]?.question) {
    return path.map((step: any, index: number) => ({
      question: step.question || `Why ${index + 1}?`,
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

export function pickRootCause(canonicalWhysPath: any[], rootCandidates: any[]): string | null {
  if (canonicalWhysPath.length > 0) {
    const lastStep = canonicalWhysPath[canonicalWhysPath.length - 1];
    const fromPath = toAnswerText(lastStep);
    if (fromPath.length > 0) return fromPath;
  }

  for (const candidate of rootCandidates) {
    const normalized = normalizeText(candidate);
    if (normalized.length > 0) return normalized;
  }

  return null;
}
