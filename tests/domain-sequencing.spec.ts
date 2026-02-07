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
  it('moves compliance earlier for restaurant-like plans and removes blocking construction dependency', () => {
    const workstreams: Workstream[] = [
      ws('WS001', 'Cafe Construction and Fit-Out', 2, 4),
      ws('WS002', 'Food Safety Compliance and Licensing', 6, 8, ['WS001']),
      ws('WS003', 'Restaurant Technology and POS Setup', 0, 1),
      ws('WS004', 'Staff Hiring and Training', 1, 2),
    ];

    const updated = enforceDomainSequencing(workstreams, 'Open a Thai cafe in Dubai mall');

    const compliance = updated.find((item) => item.id === 'WS002')!;
    const tech = updated.find((item) => item.id === 'WS003')!;
    const staff = updated.find((item) => item.id === 'WS004')!;

    expect(compliance.startMonth).toBe(4);
    expect(compliance.endMonth).toBe(6);
    expect(compliance.dependencies).toEqual([]);
    expect(compliance.deliverables[0].dueMonth).toBe(6);
    expect(tech.startMonth).toBe(2);
    expect(staff.startMonth).toBe(2);
  });

  it('does not modify non-restaurant plans', () => {
    const workstreams: Workstream[] = [
      ws('WS001', 'Cloud platform migration', 0, 2),
      ws('WS002', 'Security compliance', 4, 6, ['WS001']),
    ];

    const updated = enforceDomainSequencing(workstreams, 'Migrate enterprise ERP to cloud');
    expect(updated).toEqual(workstreams);
  });
});
