export type ConstraintMode = 'auto' | 'discovery' | 'constrained';

export function normalizeConstraintMode(value: unknown): ConstraintMode | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'auto' || normalized === 'discovery' || normalized === 'constrained') {
    return normalized;
  }
  return undefined;
}

export function deriveConstraintMode(
  requestedMode: unknown,
  hasExplicitConstraint: boolean,
): ConstraintMode {
  // Explicit constraints always win over requested discovery mode.
  // This prevents contradictory states like { mode: "discovery", budgetConstraint: {...} }.
  if (hasExplicitConstraint) return 'constrained';

  const normalized = normalizeConstraintMode(requestedMode);
  if (normalized) return normalized;
  return 'auto';
}

export function shouldUseTextConstraintFallback(mode: ConstraintMode | undefined): boolean {
  return !mode || mode === 'auto';
}

export function shouldEnforceConstraints(mode: ConstraintMode | undefined): boolean {
  return mode !== 'discovery';
}
