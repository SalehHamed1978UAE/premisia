import { describe, it, expect } from 'vitest';
import { normalizeFTE, normalizeResourceFTEs } from '../../server/intelligence/normalizers/fte-normalizer';

describe('normalizeFTE', () => {
  it('should convert 100 to 1.0', () => {
    expect(normalizeFTE(100)).toBe(1.0);
  });

  it('should convert 80 to 0.8', () => {
    expect(normalizeFTE(80)).toBe(0.8);
  });

  it('should convert 75 to 0.75', () => {
    expect(normalizeFTE(75)).toBe(0.75);
  });

  it('should convert 50 to 0.5', () => {
    expect(normalizeFTE(50)).toBe(0.5);
  });

  it('should keep 0.75 unchanged', () => {
    expect(normalizeFTE(0.75)).toBe(0.75);
  });

  it('should keep 1.0 unchanged', () => {
    expect(normalizeFTE(1.0)).toBe(1.0);
  });

  it('should keep 0.5 unchanged', () => {
    expect(normalizeFTE(0.5)).toBe(0.5);
  });

  it('should clamp values > 1.0 but <= 10 to 1.0', () => {
    expect(normalizeFTE(5)).toBe(1.0);
    expect(normalizeFTE(2.5)).toBe(1.0);
  });

  it('should clamp negative values to 0', () => {
    expect(normalizeFTE(-1)).toBe(0);
    expect(normalizeFTE(-0.5)).toBe(0);
  });

  it('should handle edge case of exactly 10', () => {
    expect(normalizeFTE(10)).toBe(1.0);
  });

  it('should handle edge case just above 10', () => {
    expect(normalizeFTE(11)).toBe(0.11);
  });
});

describe('normalizeResourceFTEs', () => {
  it('should normalize resources with percentage FTE values', () => {
    const resources = [
      { role: 'Project Manager', fteAllocation: 100 },
      { role: 'Developer', fteAllocation: 75 },
      { role: 'Designer', fteAllocation: 50 },
    ];

    const { normalized, fixes, hasIssues } = normalizeResourceFTEs(resources);

    expect(normalized[0].fteAllocation).toBe(1.0);
    expect(normalized[1].fteAllocation).toBe(0.75);
    expect(normalized[2].fteAllocation).toBe(0.5);
    expect(hasIssues).toBe(true);
    expect(fixes.length).toBe(3);
  });

  it('should preserve already-normalized resources', () => {
    const resources = [
      { role: 'Analyst', fteAllocation: 1.0 },
      { role: 'Consultant', fteAllocation: 0.5 },
    ];

    const { normalized, fixes, hasIssues } = normalizeResourceFTEs(resources);

    expect(normalized[0].fteAllocation).toBe(1.0);
    expect(normalized[1].fteAllocation).toBe(0.5);
    expect(hasIssues).toBe(false);
    expect(fixes.length).toBe(0);
  });

  it('should preserve additional properties on resources', () => {
    const resources = [
      { role: 'Manager', fteAllocation: 100, department: 'IT', level: 'Senior' },
    ];

    const { normalized } = normalizeResourceFTEs(resources);

    expect((normalized[0] as any).department).toBe('IT');
    expect((normalized[0] as any).level).toBe('Senior');
    expect(normalized[0].fteAllocation).toBe(1.0);
  });

  it('should generate descriptive fix messages', () => {
    const resources = [
      { role: 'Lead Developer', fteAllocation: 80 },
    ];

    const { fixes } = normalizeResourceFTEs(resources);

    expect(fixes[0]).toContain('Lead Developer');
    expect(fixes[0]).toContain('80');
    expect(fixes[0]).toContain('0.8');
  });

  it('should handle empty array', () => {
    const { normalized, fixes, hasIssues } = normalizeResourceFTEs([]);

    expect(normalized.length).toBe(0);
    expect(fixes.length).toBe(0);
    expect(hasIssues).toBe(false);
  });
});
