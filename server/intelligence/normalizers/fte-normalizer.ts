export function normalizeFTE(value: number): number {
  if (value > 10) return Math.round((value / 100) * 100) / 100;
  if (value > 1.0) return 1.0;
  if (value < 0) return 0;
  return Math.round(value * 100) / 100;
}

export function normalizeResourceFTEs(
  resources: Array<{ role: string; fteAllocation: number; [key: string]: any }>
) {
  const fixes: string[] = [];
  const normalized = resources.map(r => {
    const fixed = normalizeFTE(r.fteAllocation);
    if (r.fteAllocation !== fixed) {
      fixes.push(`${r.role}: ${r.fteAllocation} → ${fixed}`);
    }
    return { ...r, fteAllocation: fixed };
  });
  return { normalized, fixes, hasIssues: fixes.length > 0 };
}
