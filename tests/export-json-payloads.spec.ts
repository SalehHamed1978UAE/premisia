import { describe, expect, it } from 'vitest';
import { buildEpmJsonPayload, buildStrategyJsonPayload } from '../server/services/export/json-payloads';

describe('Export JSON payload normalization', () => {
  it('normalizes strategy payload with canonical five-whys fields', () => {
    const payload = buildStrategyJsonPayload({
      understanding: { id: 'u1' },
      journeySession: {
        journeyType: 'business_model_innovation',
        completedFrameworks: ['five_whys', 'bmc'],
      },
      strategyVersion: {
        id: 'sv1',
        analysisData: {
          frameworks: [],
          five_whys: {
            root_cause: 'Low repeat visits due to poor in-store experience',
            whysPath: ['why 1', 'why 2', 'why 3', 'why 4'],
            strategic_implications: ['Fix store operations before paid growth'],
          },
        },
      },
      decisions: [],
      whysPath: [],
    });

    expect(payload.whysPath).toHaveLength(4);
    expect(payload.rootCause).toBe('Low repeat visits due to poor in-store experience');
    expect(payload.frameworks).toContain('five_whys');
    expect(payload.frameworks).toContain('bmc');
    expect(payload.strategicImplications).toEqual(['Fix store operations before paid growth']);
  });

  it('prefers the richer nested whysPath when top-level path is shorter', () => {
    const payload = buildStrategyJsonPayload({
      understanding: { id: 'u3' },
      journeySession: {
        journeyType: 'business_model_innovation',
        completedFrameworks: ['five_whys'],
      },
      strategyVersion: {
        id: 'sv3',
        analysisData: {
          five_whys: {
            root_cause: 'True root cause',
            whysPath: ['step 1', 'step 2', 'step 3', 'step 4'],
          },
        },
      },
      decisions: [],
      whysPath: ['question 1', 'question 2', 'question 3'],
    });

    expect(payload.whysPath).toHaveLength(4);
    expect(payload.whysPath).toEqual(['step 1', 'step 2', 'step 3', 'step 4']);
    expect(payload.rootCause).toBe('True root cause');
  });

  it('uses journey definition frameworks over analysisData key contamination', () => {
    const payload = buildStrategyJsonPayload({
      understanding: { id: 'u2' },
      journeySession: {
        journeyType: 'business_model_innovation',
        completedFrameworks: [],
      },
      strategyVersion: {
        id: 'sv2',
        analysisData: {
          frameworks: [],
          pestle: {},
          porters: {},
          swot: {},
        },
      },
      decisions: [],
    });

    expect(payload.frameworks).toEqual(['five_whys', 'bmc']);
  });

  it('uses journey definition frameworks over contaminated metadata frameworks', () => {
    const payload = buildStrategyJsonPayload({
      understanding: { id: 'u6' },
      journeySession: {
        journeyType: 'business_model_innovation',
        metadata: {
          frameworks: ['five_whys', 'bmc', 'porters'],
        },
      },
      strategyVersion: {
        id: 'sv6',
        analysisData: {
          frameworks: ['five_whys', 'bmc', 'porters'],
        },
      },
      decisions: [],
    });

    expect(payload.frameworks).toEqual(['five_whys', 'bmc']);
  });

  it('uses custom journey metadata frameworks when provided', () => {
    const payload = buildStrategyJsonPayload({
      understanding: { id: 'u4' },
      journeySession: {
        journeyType: 'custom',
        completedFrameworks: [],
        metadata: {
          frameworks: ['swot', 'ansoff'],
        },
      },
      strategyVersion: {
        id: 'sv4',
        analysisData: {
          frameworks: ['porters'],
        },
      },
      decisions: [],
    });

    expect(payload.frameworks).toEqual(['swot', 'ansoff']);
  });

  it('falls back to explicit frameworks array when no journey context exists', () => {
    const payload = buildStrategyJsonPayload({
      understanding: { id: 'u5' },
      journeySession: { completedFrameworks: [] },
      strategyVersion: {
        id: 'sv5',
        analysisData: {
          frameworks: ['pestle', 'swot'],
          porters_analysis: {},
        },
      },
      decisions: [],
    });

    expect(payload.frameworks).toEqual(['pestle', 'swot']);
  });

  it('adds normalized top-level EPM sections from program JSON fields', () => {
    const payload = buildEpmJsonPayload({
      program: {
        workstreams: JSON.stringify([{ id: 'WS001' }, { id: 'WS002' }]),
        resourcePlan: JSON.stringify({
          internalTeam: [{ role: 'Program Manager' }],
          externalResources: [{ type: 'Consultant' }],
        }),
        riskRegister: JSON.stringify({ risks: [{ id: 'R1' }] }),
        benefitsRealization: JSON.stringify({ benefits: [{ id: 'B1' }] }),
      },
      assignments: [{ id: 'A1' }],
    });

    expect(payload.workstreams).toHaveLength(2);
    expect(payload.resources).toHaveLength(2);
    expect(payload.risks).toHaveLength(1);
    expect(payload.benefits).toHaveLength(1);
    expect(payload.assignments).toHaveLength(1);
  });

  it('normalizes timeline coverage and critical path from workstream data', () => {
    const payload = buildEpmJsonPayload({
      program: {
        timeline: {
          totalMonths: 8,
          phases: [
            { phase: 1, name: 'P1', startMonth: 0, endMonth: 4 },
            { phase: 2, name: 'P2', startMonth: 5, endMonth: 8 },
          ],
          criticalPath: ['WS005'],
        },
        workstreams: [
          { id: 'WS001', startMonth: 0, endMonth: 3, dependencies: [] },
          { id: 'WS006', startMonth: 4, endMonth: 7, dependencies: ['WS001'] },
          { id: 'WS003', startMonth: 8, endMonth: 10, dependencies: ['WS006'] },
          { id: 'WS005', startMonth: 11, endMonth: 13, dependencies: ['WS003'] },
        ],
      },
      assignments: [],
    });

    const timeline = payload.program.timeline;
    expect(timeline.totalMonths).toBe(13);
    expect(timeline.phases[timeline.phases.length - 1].endMonth).toBe(13);
    expect(timeline.criticalPath).toEqual(['WS001', 'WS006', 'WS003', 'WS005']);
  });
});
