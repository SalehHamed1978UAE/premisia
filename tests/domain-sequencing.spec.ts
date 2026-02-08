import { describe, expect, it } from 'vitest';
import { enforceDomainSequencing } from '../server/intelligence/epm/domain-sequencing';
import type { Workstream } from '../server/intelligence/types';

function ws(
  id: string,
  name: string,
  startMonth: number,
  endMonth: number,
  dependencies: string[] = []
): Workstream {
  return {
    id,
    name,
    description: name,
    dependencies,
    startMonth,
    endMonth,
    confidence: 0.9,
    deliverables: [
      {
        id: `${id}-D1`,
        name: `${name} Deliverable`,
        description: `${name} Deliverable`,
        dueMonth: endMonth + 2,
        effort: '5 person-days',
      },
    ],
  };
}

describe('enforceDomainSequencing', () => {
  it('removes dependencies that point to later-stage workstreams', () => {
    const workstreams: Workstream[] = [
      ws('WS001', 'Core Platform Build', 1, 4),
      ws('WS002', 'Requirements Discovery and Analysis', 2, 3, ['WS001']),
      ws('WS003', 'Launch Readiness and Rollout', 5, 6, ['WS001']),
    ];

    const updated = enforceDomainSequencing(workstreams, 'Build SaaS workflow tooling');

    const discovery = updated.find((item) => item.id === 'WS002')!;
    const launch = updated.find((item) => item.id === 'WS003')!;

    expect(discovery.dependencies).toEqual([]);
    expect(discovery.startMonth).toBeLessThanOrEqual(launch.startMonth);
    expect(discovery.deliverables[0].dueMonth).toBeLessThanOrEqual(discovery.endMonth);
  });

  it('keeps already coherent dependency sequencing unchanged', () => {
    const workstreams: Workstream[] = [
      ws('WS001', 'Discovery and Requirements', 0, 1),
      ws('WS002', 'Implementation Build', 2, 4, ['WS001']),
    ];

    const updated = enforceDomainSequencing(workstreams, 'Migrate enterprise ERP to cloud');
    expect(updated).toHaveLength(2);
    expect(updated[0].id).toBe('WS001');
    expect(updated[1].id).toBe('WS002');
    expect(updated[1].dependencies).toEqual(['WS001']);
    expect(updated[0].startMonth).toBe(1);
    expect(updated[0].endMonth).toBe(1);
  });
});
