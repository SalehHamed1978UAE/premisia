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
  const normalized = normalizeConstraintMode(requestedMode);
  if (normalized) return normalized;
  return hasExplicitConstraint ? 'constrained' : 'auto';
}

export function shouldUseTextConstraintFallback(mode: ConstraintMode | undefined): boolean {
  return !mode || mode === 'auto';
}

export function shouldEnforceConstraints(mode: ConstraintMode | undefined): boolean {
  return mode !== 'discovery';
}
