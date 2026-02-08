import type { Workstream } from '../types';

const STAGE_PATTERNS: Array<{ stage: number; pattern: RegExp }> = [
  { stage: 0, pattern: /discover|research|analysis|assess|diagnos|requirement|planning|plan|scope|governance|compliance|legal|permit|approval|design|architecture|procurement/i },
  { stage: 1, pattern: /build|develop|implementation|implement|configure|configuration|setup|construction|integrat|migration|infrastructure/i },
  { stage: 2, pattern: /test|qa|validation|pilot|train|training|recruit|hiring|onboard|enablement/i },
  { stage: 3, pattern: /launch|go[\s-]?live|rollout|deploy|activation|marketing|sales|operations|execution/i },
  { stage: 4, pattern: /optimi[sz]|scale|stabil|continuous improvement|hypercare/i },
];

function inferStage(workstream: Workstream): number {
  const text = `${workstream.name || ''} ${workstream.description || ''}`;
  for (const matcher of STAGE_PATTERNS) {
    if (matcher.pattern.test(text)) return matcher.stage;
  }
  return 2;
}

function clampDueMonth(dueMonth: number, startMonth: number, endMonth: number): number {
  if (!Number.isFinite(dueMonth)) return endMonth;
  return Math.min(endMonth, Math.max(startMonth, dueMonth));
}

function normalizeWorkstream(workstream: Workstream): Workstream {
  const startMonth = Math.max(1, Number.isFinite(workstream.startMonth) ? workstream.startMonth : 1);
  const endMonthRaw = Number.isFinite(workstream.endMonth) ? workstream.endMonth : startMonth;
  const endMonth = Math.max(startMonth, endMonthRaw);
  const dependencies = Array.isArray(workstream.dependencies)
    ? [...new Set(workstream.dependencies.filter((depId) => typeof depId === 'string' && depId !== workstream.id))]
    : [];

  return {
    ...workstream,
    startMonth,
    endMonth,
    dependencies,
  };
}

function applyStageOrderAdjustments(workstreams: Workstream[], stageById: Map<string, number>): Workstream[] {
  const earliestStartByStage = new Map<number, number>();
  for (const ws of workstreams) {
    const stage = stageById.get(ws.id) || 0;
    const current = earliestStartByStage.get(stage);
    earliestStartByStage.set(stage, current === undefined ? ws.startMonth : Math.min(current, ws.startMonth));
  }

  const stageShift = new Map<number, number>();
  for (let stage = 0; stage <= 4; stage += 1) {
    stageShift.set(stage, 0);
  }

  for (let stage = 0; stage < 4; stage += 1) {
    const currentStart = earliestStartByStage.get(stage);
    const nextStart = earliestStartByStage.get(stage + 1);
    if (currentStart === undefined || nextStart === undefined) continue;
    if (currentStart > nextStart) {
      const existing = stageShift.get(stage) || 0;
      stageShift.set(stage, Math.max(existing, currentStart - nextStart));
    }
  }

  return workstreams.map((ws) => {
    const stage = stageById.get(ws.id) || 0;
    const shift = stageShift.get(stage) || 0;
    if (shift <= 0) return ws;

    const duration = Math.max(1, ws.endMonth - ws.startMonth);
    const startMonth = Math.max(1, ws.startMonth - shift);
    const endMonth = startMonth + duration;

    return {
      ...ws,
      startMonth,
      endMonth,
      deliverables: Array.isArray(ws.deliverables)
        ? ws.deliverables.map((deliverable) => ({
            ...deliverable,
            dueMonth: clampDueMonth(deliverable.dueMonth, startMonth, endMonth),
          }))
        : [],
    };
  });
}

export function enforceDomainSequencing(
  workstreams: Workstream[],
  _contextText = ''
): Workstream[] {
  if (!Array.isArray(workstreams) || workstreams.length === 0) return workstreams;

  const normalized = workstreams.map(normalizeWorkstream);
  const byId = new Map(normalized.map((ws) => [ws.id, ws]));
  const stageById = new Map(normalized.map((ws) => [ws.id, inferStage(ws)]));

  const sanitized = normalized.map((ws) => {
    const wsStage = stageById.get(ws.id) || 0;
    const dependencies = (ws.dependencies || []).filter((depId) => {
      const dep = byId.get(depId);
      if (!dep) return false;
      const depStage = stageById.get(depId) || 0;
      return depStage <= wsStage;
    });

    return {
      ...ws,
      dependencies: [...new Set(dependencies)],
    };
  });

  const staged = applyStageOrderAdjustments(sanitized, stageById);
  return staged;
}

export function inferSequencingStage(name: string, description = ''): number {
  return inferStage({
    id: 'temp',
    name,
    description,
    deliverables: [],
    startMonth: 0,
    endMonth: 0,
    dependencies: [],
    confidence: 1,
  });
}
