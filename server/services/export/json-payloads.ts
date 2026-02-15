import type { FullExportPackage } from '../../types/interfaces';
import type { WBSRow } from './wbs-exporter';
import { getJourney } from '../../journey/journey-registry';
import { normalizeWhysPathSteps } from '../../utils/whys-path';
import { deriveConstraintMode, shouldEnforceConstraints } from '../../intelligence/epm/constraint-policy';

type StrategyPayload = FullExportPackage['strategy'];
type EpmPayload = NonNullable<FullExportPackage['epm']>;
type EpmPayloadContext = {
  exportMeta?: FullExportPackage['metadata'];
  strategyVersion?: any;
  userInput?: string | null;
  clarifications?: StrategyPayload['clarifications'] | null;
  initiativeType?: string | null;
  constraintMode?: 'auto' | 'discovery' | 'constrained' | null;
  programName?: string | null;
  wbsRows?: WBSRow[] | null;
  // Sprint 6: Five Whys data from strategy
  whysPath?: Array<{ question: string; answer: string }> | null;
  rootCause?: string | null;
  fiveWhysTree?: any | null;
};

const FRAMEWORK_ALIASES: Record<string, string> = {
  five_whys: 'five_whys',
  fivewhys: 'five_whys',
  bmc: 'bmc',
  bmc_research: 'bmc',
  porters: 'porters',
  porters_analysis: 'porters',
  pestle: 'pestle',
  swot: 'swot',
  ansoff: 'ansoff',
  blue_ocean: 'blue_ocean',
  blueocean: 'blue_ocean',
  segment_discovery: 'segment_discovery',
  competitive_positioning: 'competitive_positioning',
  ocean_strategy: 'ocean_strategy',
  bcg_matrix: 'bcg_matrix',
  value_chain: 'value_chain',
  vrio: 'vrio',
  scenario_planning: 'scenario_planning',
  jobs_to_be_done: 'jobs_to_be_done',
  okr_generator: 'okr_generator',
};

function parseMaybeJson<T = any>(value: any): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeFrameworkName(value: string): string | null {
  const key = value.toLowerCase().replace(/[\s-]+/g, '_');
  return FRAMEWORK_ALIASES[key] || null;
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
}

function normalizeFrameworkList(values: any[]): string[] {
  return uniqueNonEmpty(
    values.map((value: any) => (typeof value === 'string' ? normalizeFrameworkName(value) : null))
  );
}

function deriveAuthoritativeFrameworks(strategy: StrategyPayload): string[] {
  const journeySession = strategy.journeySession || {};

  const journeyType = typeof journeySession.journeyType === 'string'
    ? journeySession.journeyType
    : null;
  if (journeyType) {
    try {
      const journey = getJourney(journeyType as any);
      if (journey && Array.isArray(journey.frameworks)) {
        const fromJourney = normalizeFrameworkList(journey.frameworks);
        if (fromJourney.length > 0) return fromJourney;
      }
    } catch {
      // Fall through to metadata fallback.
    }
  }

  const metadata = parseMaybeJson<Record<string, any>>(journeySession.metadata) || {};
  const fromMetadata = Array.isArray(metadata.frameworks)
    ? normalizeFrameworkList(metadata.frameworks)
    : [];
  if (fromMetadata.length > 0) return fromMetadata;

  return [];
}

function deriveFrameworks(
  strategy: StrategyPayload,
  analysisData: Record<string, any>,
): string[] {
  const authoritative = deriveAuthoritativeFrameworks(strategy);
  if (authoritative.length > 0) {
    return authoritative;
  }

  const fromAnalysisArray = Array.isArray(analysisData.frameworks)
    ? normalizeFrameworkList(analysisData.frameworks)
    : [];

  const fromJourneySession = Array.isArray(strategy.journeySession?.completedFrameworks)
    ? normalizeFrameworkList(strategy.journeySession?.completedFrameworks)
    : [];

  if (fromJourneySession.length > 0) return fromJourneySession;
  if (fromAnalysisArray.length > 0) return fromAnalysisArray;

  return [];
}

function getFiveWhys(analysisData: Record<string, any>): Record<string, any> {
  const fromSnake = parseMaybeJson<Record<string, any>>(analysisData.five_whys);
  if (fromSnake) return fromSnake;

  const fromCamel = parseMaybeJson<Record<string, any>>(analysisData.fiveWhys);
  if (fromCamel) return fromCamel;

  return {};
}

function deriveWhysPath(
  strategy: StrategyPayload,
  fiveWhys: Record<string, any>,
): any[] {
  const nestedParsed = parseMaybeJson<any[]>(fiveWhys.whysPath);
  const nestedNormalized = normalizeWhysPathSteps(Array.isArray(nestedParsed) ? nestedParsed : []);
  if (nestedNormalized.length > 0) return nestedNormalized;

  const topLevel = Array.isArray(strategy.whysPath) ? normalizeWhysPathSteps(strategy.whysPath) : [];
  return topLevel;
}

function deriveRootCause(
  fiveWhys: Record<string, any>,
  analysisData: Record<string, any>,
): string | null {
  const candidates = [
    analysisData.root_cause,
    analysisData.rootCause,
    fiveWhys.root_cause,
    fiveWhys.rootCause,
    fiveWhys.primaryRootCause,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return null;
}

function deriveStrategicImplications(
  fiveWhys: Record<string, any>,
  analysisData: Record<string, any>,
): string[] {
  const candidates = [
    analysisData.strategic_implications,
    analysisData.strategicImplications,
    fiveWhys.strategic_implications,
    fiveWhys.strategicImplications,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((v) => typeof v === 'string' && v.trim().length > 0);
    }
  }

  return [];
}

function deriveResources(resourcePlan: any): any[] {
  if (!resourcePlan || typeof resourcePlan !== 'object') return [];

  const internal = Array.isArray(resourcePlan.internalTeam)
    ? resourcePlan.internalTeam.map((resource: any) => ({
        ...resource,
        resourceType: 'internal',
      }))
    : [];

  const external = Array.isArray(resourcePlan.externalResources)
    ? resourcePlan.externalResources.map((resource: any) => ({
        ...resource,
        resourceType: 'external',
      }))
    : [];

  return [...internal, ...external];
}

function deriveRiskList(riskRegister: any): any[] {
  if (!riskRegister) return [];
  if (Array.isArray(riskRegister)) return riskRegister;
  if (Array.isArray(riskRegister.risks)) return riskRegister.risks;
  return [];
}

function deriveBenefitList(benefitsRealization: any): any[] {
  if (!benefitsRealization) return [];
  if (Array.isArray(benefitsRealization)) return benefitsRealization;
  if (Array.isArray(benefitsRealization.benefits)) return benefitsRealization.benefits;
  return [];
}

function formatBenefitId(value: number): string {
  return `BEN-${String(value).padStart(2, '0')}`;
}

function normalizeBenefitId(raw: any, fallbackIndex?: number): string | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return formatBenefitId(raw);
  if (typeof raw === 'string') {
    const match = raw.match(/(\d+)/);
    if (match) return formatBenefitId(Number(match[1]));
  }
  if (typeof fallbackIndex === 'number') return formatBenefitId(fallbackIndex);
  return null;
}

function normalizeBenefits(benefitsRaw: any[]): { benefits: any[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  const benefits = benefitsRaw.map((benefit, idx) => {
    const rawId = benefit?.id ?? benefit?.benefitId ?? benefit?.benefit_id;
    const normalizedId = normalizeBenefitId(rawId, idx + 1) ?? `BEN-${idx + 1}`;
    if (typeof rawId === 'string') {
      idMap.set(rawId, normalizedId);
    }
    return {
      ...benefit,
      id: normalizedId,
    };
  });
  return { benefits, idMap };
}

function normalizeKpis(kpisData: any, benefitIdMap: Map<string, string>): any {
  if (!kpisData) return null;
  const list = Array.isArray(kpisData?.kpis)
    ? kpisData.kpis
    : (Array.isArray(kpisData) ? kpisData : []);
  if (!Array.isArray(list)) return kpisData;

  const normalizedList = list.map((kpi: any) => {
    const linked = Array.isArray(kpi?.linkedBenefitIds) ? kpi.linkedBenefitIds : [];
    const normalizedLinked = linked.map((id: any) => {
      if (typeof id !== 'string') return id;
      return benefitIdMap.get(id) ?? normalizeBenefitId(id) ?? id;
    });
    return {
      ...kpi,
      linkedBenefitIds: normalizedLinked,
    };
  });

  if (Array.isArray(kpisData?.kpis)) {
    return { ...kpisData, kpis: normalizedList };
  }
  return normalizedList;
}

function computeLongestDependencyChain(workstreams: any[]): string[] {
  if (!Array.isArray(workstreams) || workstreams.length === 0) return [];

  const byId = new Map<string, any>();
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const ws of workstreams) {
    if (typeof ws?.id !== 'string') continue;
    byId.set(ws.id, ws);
    inDegree.set(ws.id, 0);
    dependents.set(ws.id, []);
  }

  for (const ws of workstreams) {
    if (typeof ws?.id !== 'string') continue;
    for (const depId of ws.dependencies || []) {
      if (!byId.has(depId)) continue;
      inDegree.set(ws.id, (inDegree.get(ws.id) || 0) + 1);
      dependents.get(depId)?.push(ws.id);
    }
  }

  const queue: string[] = [];
  inDegree.forEach((degree, id) => {
    if (degree === 0) queue.push(id);
  });

  const topo: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    topo.push(id);
    for (const dependentId of dependents.get(id) || []) {
      const next = (inDegree.get(dependentId) || 0) - 1;
      inDegree.set(dependentId, next);
      if (next === 0) queue.push(dependentId);
    }
  }

  if (topo.length !== byId.size) return [];

  const scoreById = new Map<string, number>();
  const predecessorById = new Map<string, string | null>();

  for (const id of topo) {
    const ws = byId.get(id);
    const startMonth = Number(ws?.startMonth ?? 0);
    const endMonth = Number(ws?.endMonth ?? startMonth);
    const duration = Math.max(1, endMonth - startMonth + 1);

    let bestPred: string | null = null;
    let bestScore = 0;

    for (const depId of ws.dependencies || []) {
      const depScore = scoreById.get(depId);
      if (depScore === undefined) continue;
      if (depScore > bestScore) {
        bestScore = depScore;
        bestPred = depId;
      }
    }

    scoreById.set(id, duration + bestScore);
    predecessorById.set(id, bestPred);
  }

  let bestId: string | null = null;
  let best = -1;
  scoreById.forEach((score, id) => {
    if (score > best) {
      best = score;
      bestId = id;
    }
  });

  if (!bestId) return [];

  const path: string[] = [];
  let cursor: string | null = bestId;
  while (cursor) {
    path.push(cursor);
    cursor = predecessorById.get(cursor) || null;
  }

  return path.reverse();
}

function normalizeTimeline(program: any, workstreams: any[]): any {
  const timeline = parseMaybeJson<any>(program.timeline) || {};
  const maxWorkstreamEnd = workstreams.reduce(
    (max, ws) => Math.max(max, Number(ws?.endMonth) || 0),
    0
  );
  const totalMonths = Math.max(Number(timeline.totalMonths) || 0, maxWorkstreamEnd);

  const phases = Array.isArray(timeline.phases) ? [...timeline.phases] : [];
  const phaseMaxEnd = phases.reduce((max: number, phase: any) => {
    return Math.max(max, Number(phase?.endMonth) || 0);
  }, 0);

  if (maxWorkstreamEnd > 0 && phases.length > 0 && phaseMaxEnd < maxWorkstreamEnd) {
    const last = phases[phases.length - 1];
    phases[phases.length - 1] = {
      ...last,
      endMonth: maxWorkstreamEnd,
    };
  } else if (maxWorkstreamEnd > 0 && phases.length === 0) {
    phases.push({
      phase: 1,
      name: 'Execution',
      startMonth: 0,
      endMonth: maxWorkstreamEnd,
      description: 'Program execution',
      keyMilestones: [],
      workstreamIds: workstreams
        .map((ws) => ws?.id)
        .filter((id): id is string => typeof id === 'string'),
    });
  }

  const longestChain = computeLongestDependencyChain(workstreams);
  const criticalPath = longestChain.length > 0
    ? longestChain
    : (Array.isArray(timeline.criticalPath) ? timeline.criticalPath : []);

  return {
    ...timeline,
    totalMonths,
    phases,
    criticalPath,
  };
}

function buildDeliverableLookup(workstreams: any[]): Record<string, { workstreamId?: string; startMonth?: number; endMonth?: number }> {
  const lookup: Record<string, { workstreamId?: string; startMonth?: number; endMonth?: number }> = {};
  workstreams.forEach((ws: any) => {
    const wsId = ws.id;
    const wsStart = ws.startMonth;
    const wsEnd = ws.endMonth;
    (ws.deliverables || []).forEach((d: any) => {
      const taskId = d.id || d.taskId || d.name;
      if (!taskId) return;
      const dueMonth = d.dueMonth ?? d.due_month;
      lookup[taskId] = {
        workstreamId: wsId,
        startMonth: wsStart,
        endMonth: dueMonth ?? wsEnd ?? wsStart,
      };
    });
  });
  return lookup;
}

function parseTaskIdWorkstream(taskId?: string): string | null {
  if (!taskId) return null;
  const match = taskId.match(/^(WS\d+)/i);
  return match ? match[1] : null;
}

function monthOffset(from: Date, base: Date): number {
  const delta = from.getTime() - base.getTime();
  return Math.max(0, Math.round(delta / (1000 * 60 * 60 * 24 * 30)));
}

function normalizeAssignments(assignments: any[], workstreams: any[]): any[] {
  if (!Array.isArray(assignments)) return [];

  const deliverableLookup = buildDeliverableLookup(workstreams);
  const minAssignedFrom = assignments
    .map((a) => a.assignedFrom || a.assigned_from)
    .filter(Boolean)
    .map((d: any) => new Date(d))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return assignments.map((assignment) => {
    const taskId = assignment.taskId || assignment.task_id;
    const lookup = taskId ? deliverableLookup[taskId] || {} : {};
    const existingWorkstreamId = assignment.workstreamId || assignment.workstream_id;
    const existingStartMonth = assignment.startMonth ?? assignment.start_month;
    const existingEndMonth = assignment.endMonth ?? assignment.end_month;

    let workstreamId = existingWorkstreamId || lookup.workstreamId || parseTaskIdWorkstream(taskId);
    let startMonth = existingStartMonth ?? lookup.startMonth;
    let endMonth = existingEndMonth ?? lookup.endMonth;

    const assignedFrom = assignment.assignedFrom || assignment.assigned_from;
    const assignedTo = assignment.assignedTo || assignment.assigned_to;
    if ((startMonth === undefined || endMonth === undefined) && assignedFrom && assignedTo && minAssignedFrom) {
      const startDate = new Date(assignedFrom);
      const endDate = new Date(assignedTo);
      startMonth = startMonth ?? monthOffset(startDate, minAssignedFrom);
      endMonth = endMonth ?? monthOffset(endDate, minAssignedFrom);
    }

    return {
      ...assignment,
      workstreamId: workstreamId ?? null,
      startMonth: startMonth ?? null,
      endMonth: endMonth ?? null,
    };
  });
}

export function buildStrategyJsonPayload(strategy: StrategyPayload): Record<string, any> {
  const parsedAnalysisData = parseMaybeJson<Record<string, any>>(strategy.strategyVersion?.analysisData) || {};
  const fiveWhys = getFiveWhys(parsedAnalysisData);
  const frameworks = deriveFrameworks(strategy, parsedAnalysisData);
  const whysPath = deriveWhysPath(strategy, fiveWhys);
  const rootCause = deriveRootCause(fiveWhys, parsedAnalysisData);
  const strategicImplications = deriveStrategicImplications(fiveWhys, parsedAnalysisData);

  return {
    ...strategy,
    strategyVersion: strategy.strategyVersion
      ? {
          ...strategy.strategyVersion,
          analysisData: parsedAnalysisData,
        }
      : strategy.strategyVersion,
    frameworks,
    whysPath,
    rootCause,
    strategicImplications,
  };
}

export function buildEpmJsonPayload(
  epm: EpmPayload,
  context: EpmPayloadContext = {}
): Record<string, any> {
  const program = epm.program || {};
  const workstreams = parseMaybeJson<any[]>(program.workstreams) || [];
  const timeline = normalizeTimeline(program, workstreams);
  const hasTimelineData = (
    (Array.isArray(timeline?.phases) && timeline.phases.length > 0) ||
    (Number.isFinite(timeline?.totalMonths) && timeline.totalMonths > 0)
  );
  const timelineValue = hasTimelineData ? timeline : null;
  const resourcePlan = parseMaybeJson<any>(program.resourcePlan);
  const riskRegister = parseMaybeJson<any>(program.riskRegister);
  const benefitsRealization = parseMaybeJson<any>(program.benefitsRealization);
  const stageGates = parseMaybeJson<any>(program.stageGates);
  const financialPlan = parseMaybeJson<any>(program.financialPlan);
  const kpis = parseMaybeJson<any>(program.kpis);
  const programId = program.id ?? context.exportMeta?.programId ?? null;
  const constraintsFromVersion = context.strategyVersion
    ? {
        costMin: context.strategyVersion.costMin ?? null,
        costMax: context.strategyVersion.costMax ?? null,
        teamSizeMin: context.strategyVersion.teamSizeMin ?? null,
        teamSizeMax: context.strategyVersion.teamSizeMax ?? null,
        timelineMonths: context.strategyVersion.timelineMonths ?? null,
        inputSummary: context.strategyVersion.inputSummary ?? null,
      }
    : null;
  const rawFallbackConstraints = (program as any).constraints ?? (epm as any).constraints ?? epm.metadata?.constraints ?? null;
  const constraintsFromProgram = rawFallbackConstraints
    ? {
        costMin: rawFallbackConstraints.costMin ?? rawFallbackConstraints.budget?.min ?? null,
        costMax: rawFallbackConstraints.costMax ?? rawFallbackConstraints.budget?.max ?? null,
        teamSizeMin: rawFallbackConstraints.teamSizeMin ?? null,
        teamSizeMax: rawFallbackConstraints.teamSizeMax ?? null,
        timelineMonths: rawFallbackConstraints.timelineMonths ?? rawFallbackConstraints.timeline?.max ?? rawFallbackConstraints.timeline?.min ?? null,
        inputSummary: context.strategyVersion?.inputSummary ?? null,
      }
    : null;
  const resolvedConstraints = constraintsFromVersion ?? constraintsFromProgram ?? null;
  const hasAnyResolvedConstraint = Boolean(
    resolvedConstraints &&
    (
      resolvedConstraints.costMin != null ||
      resolvedConstraints.costMax != null ||
      resolvedConstraints.teamSizeMin != null ||
      resolvedConstraints.teamSizeMax != null ||
      resolvedConstraints.timelineMonths != null
    )
  );
  const effectiveConstraintMode = deriveConstraintMode(context.constraintMode, hasAnyResolvedConstraint);
  const constraints = shouldEnforceConstraints(effectiveConstraintMode) ? resolvedConstraints : null;
  const constraintHints = shouldEnforceConstraints(effectiveConstraintMode) ? null : resolvedConstraints;
  const wbs = Array.isArray(context.wbsRows) ? context.wbsRows : [];

  const normalizedBenefitData = normalizeBenefits(deriveBenefitList(benefitsRealization));
  const normalizedBenefits = normalizedBenefitData.benefits;
  const normalizedKpis = normalizeKpis(kpis, normalizedBenefitData.idMap);
  const normalizedBenefitsRealization = benefitsRealization
    ? (Array.isArray(benefitsRealization)
      ? normalizedBenefits
      : { ...benefitsRealization, benefits: normalizedBenefits })
    : benefitsRealization;

  const structuredUserInput = {
    raw: context.userInput ?? null,
    summary: context.strategyVersion?.inputSummary ?? null,
    constraints,
    constraintMode: effectiveConstraintMode,
    clarifications: context.clarifications ?? null,
    initiativeType: context.initiativeType ?? null,
  };
  const totalDuration = Number.isFinite(timelineValue?.totalMonths)
    ? timelineValue?.totalMonths
    : (Number.isFinite(program.totalDuration) ? program.totalDuration : null);
  const totalBudget = Number.isFinite(financialPlan?.totalBudget)
    ? financialPlan?.totalBudget
    : (Number.isFinite(program.totalBudget) ? program.totalBudget : null);

  const startDateRaw = program.startDate || timelineValue?.startDate || null;
  const startDateParsed = startDateRaw ? new Date(startDateRaw) : null;
  let startDate = startDateParsed && !Number.isNaN(startDateParsed.getTime()) ? startDateParsed : null;

  // Fallback: use generatedAt as program start proxy when no explicit start date
  if (!startDate) {
    const generatedAt = (epm as any).metadata?.generatedAt || context.exportMeta?.exportedAt;
    if (generatedAt) {
      const d = new Date(generatedAt);
      if (!Number.isNaN(d.getTime())) startDate = d;
    }
  }

  const endDateRaw = program.endDate || timelineValue?.endDate || null;
  let endDateParsed = endDateRaw ? new Date(endDateRaw) : null;
  endDateParsed = endDateParsed && !Number.isNaN(endDateParsed.getTime()) ? endDateParsed : null;

  if (!endDateParsed && startDate && Number.isFinite(totalDuration) && totalDuration !== null) {
    endDateParsed = addMonths(startDate, totalDuration);
  }

  const normalizedProgram = {
    ...program,
    id: programId ?? program.id,
    workstreams,
    timeline: timelineValue,
    resourcePlan,
    riskRegister,
    financialPlan,
    benefitsRealization: normalizedBenefitsRealization,
    stageGates: stageGates || program.stageGates,
    kpis: normalizedKpis || program.kpis,
    totalDuration: totalDuration ?? null,
    totalBudget: totalBudget ?? null,
    startDate: startDate ? startDate.toISOString() : null,
    endDate: endDateParsed ? endDateParsed.toISOString() : null,
  };

  if (normalizedProgram.totalDuration !== null && timelineValue?.totalMonths !== null && normalizedProgram.totalDuration !== timelineValue?.totalMonths) {
    console.warn(`[Export] Program totalDuration (${normalizedProgram.totalDuration}) != timeline.totalMonths (${timelineValue?.totalMonths})`);
  }

  if (normalizedProgram.totalBudget !== null && financialPlan?.totalBudget !== null && normalizedProgram.totalBudget !== financialPlan.totalBudget) {
    console.warn(`[Export] Program totalBudget (${normalizedProgram.totalBudget}) != financialPlan.totalBudget (${financialPlan.totalBudget})`);
  }

  const assignments = normalizeAssignments(epm.assignments || [], workstreams);

  // ─── Compute budget/timeline violation flags ───
  const costMax = Number(constraints?.costMax);
  const costMin = Number(constraints?.costMin);
  const constraintTimeline = Number(constraints?.timelineMonths);
  const hasBudgetViolation = Number.isFinite(totalBudget) && Number.isFinite(costMax) && costMax > 0 && (totalBudget as number) > costMax;
  const budgetHeadroom = (Number.isFinite(totalBudget) && Number.isFinite(costMax) && costMax > 0)
    ? costMax - (totalBudget as number)
    : null;

  // Enrich financialPlan with violation data
  if (financialPlan && hasBudgetViolation) {
    financialPlan.budgetViolation = true;
    financialPlan.budgetHeadroom = budgetHeadroom;
  } else if (financialPlan && budgetHeadroom !== null) {
    financialPlan.budgetViolation = false;
    financialPlan.budgetHeadroom = budgetHeadroom;
  }

  // Sprint 6: Bidirectional check — catch programs both longer AND shorter than constraint
  const _tlDiff = Number.isFinite(totalDuration) && Number.isFinite(constraintTimeline) && constraintTimeline > 0
    ? Math.abs((totalDuration as number) - constraintTimeline)
    : 0;
  const hasTimelineViolation = _tlDiff > 1 && (_tlDiff / constraintTimeline) * 100 > 10;
  if (timelineValue) {
    (timelineValue as any).timelineViolation = hasTimelineViolation;
  }

  // ─── Compute requiresApproval (replaces passthrough) ───
  const baseApproval = (epm as any).requiresApproval ?? (program as any).requiresApproval ?? {};
  const computedApproval: Record<string, boolean> = typeof baseApproval === 'object' && baseApproval !== null ? { ...baseApproval } : {};
  if (hasBudgetViolation) {
    computedApproval.budget = true;
  }
  if (hasTimelineViolation) {
    computedApproval.timeline = true;
  }
  // Preserve clarifications flag from upstream
  if (context.clarifications && (context.clarifications as any).conflicts && (context.clarifications as any).conflicts.length > 0) {
    computedApproval.clarifications = true;
  }
  const requiresApproval = Object.keys(computedApproval).length > 0 ? computedApproval : null;
  const metadata = {
    ...(epm.metadata || {}),
    programId: epm.metadata?.programId ?? programId ?? null,
    strategyVersionId: epm.metadata?.strategyVersionId ?? program.strategyVersionId ?? null,
    userId: epm.metadata?.userId ?? program.userId ?? null,
    status: epm.metadata?.status ?? program.status ?? null,
    createdAt: epm.metadata?.createdAt ?? program.createdAt ?? null,
    updatedAt: epm.metadata?.updatedAt ?? program.updatedAt ?? null,
    sessionId: epm.metadata?.sessionId ?? context.exportMeta?.sessionId ?? context.strategyVersion?.sessionId ?? null,
    generatedAt: epm.metadata?.generatedAt ?? context.exportMeta?.exportedAt ?? null,
    programName: context.programName || (epm as any).metadata?.programName || null,
    constraintMode: effectiveConstraintMode,
    constraintHints,
    constraints,
  };

  return {
    ...epm,
    timeline: timelineValue,
    constraints,
    constraintMode: effectiveConstraintMode,
    wbs,
    requiresApproval,
    metadata,
    programId: programId ?? null,
    programName: context.programName || (epm as any).metadata?.programName || null,
    program: normalizedProgram,
    workstreams,
    resourcePlan,
    resources: deriveResources(resourcePlan),
    financialPlan,
    riskRegister,
    risks: deriveRiskList(riskRegister),
    benefitsRealization: normalizedBenefitsRealization,
    benefits: normalizedBenefits,
    kpis: normalizedKpis || null,
    stageGates: stageGates || program.stageGates || null,
    assignments,
    userInput: context.userInput ?? null,
    userInputStructured: structuredUserInput,
    // Sprint 6: Five Whys data from strategy
    whysPath: context.whysPath ?? null,
    rootCause: context.rootCause ?? null,
    fiveWhysTree: context.fiveWhysTree ?? null,
  };
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}
