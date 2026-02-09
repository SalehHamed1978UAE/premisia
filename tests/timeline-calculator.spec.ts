import { describe, expect, it } from 'vitest';
import { TimelineCalculator } from '../server/intelligence/epm/timeline-calculator';
import type { Workstream } from '../server/intelligence/types';

function ws(
  id: string,
  startMonth: number,
  endMonth: number,
  dependencies: string[] = []
): Workstream {
  return {
    id,
    name: id,
    description: id,
    deliverables: [],
    startMonth,
    endMonth,
    dependencies,
    confidence: 0.9,
  };
}

describe('TimelineCalculator critical path', () => {
  it('returns the longest dependency chain, not a single workstream', () => {
    const calculator = new TimelineCalculator();
    const workstreams: Workstream[] = [
      ws('WS001', 0, 1, []),
      ws('WS002', 2, 4, ['WS001']),
      ws('WS003', 5, 6, ['WS002']),
      ws('WS004', 0, 5, []),
    ];

    const criticalPath = calculator.identifyCriticalPath(workstreams);
    expect(criticalPath).toEqual(['WS001', 'WS002', 'WS003']);
  });

  it('degrades gracefully on cyclic dependencies', () => {
    const calculator = new TimelineCalculator();
    const workstreams: Workstream[] = [
      ws('WS001', 0, 1, ['WS002']),
      ws('WS002', 0, 4, ['WS001']),
    ];

    const criticalPath = calculator.identifyCriticalPath(workstreams);
    expect(criticalPath.length).toBe(1);
    expect(['WS001', 'WS002']).toContain(criticalPath[0]);
  });

  it('uses workstream span to set total months and phase coverage', async () => {
    const calculator = new TimelineCalculator();
    const workstreams: Workstream[] = [
      ws('WS001', 0, 3, []),
      ws('WS002', 4, 8, ['WS001']),
      ws('WS003', 9, 13, ['WS002']),
    ];

    const timeline = await calculator.calculate(
      {
        frameworkType: 'test',
        insights: [],
        marketContext: { urgency: 'Normal' },
      } as any,
      workstreams
    );

    const phaseMaxEnd = timeline.phases.reduce((max, phase) => Math.max(max, phase.endMonth), 0);
    expect(timeline.totalMonths).toBeGreaterThanOrEqual(13);
    expect(phaseMaxEnd).toBeGreaterThanOrEqual(13);
  });
});
