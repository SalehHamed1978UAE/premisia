import type { FullExportPackage } from '../../types/interfaces';
import { getJourney } from '../../journey/journey-registry';
import { enforceDomainSequencing } from '../../intelligence/epm/domain-sequencing';

type StrategyPayload = FullExportPackage['strategy'];
type EpmPayload = NonNullable<FullExportPackage['epm']>;

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
  const topLevel = Array.isArray(strategy.whysPath) ? strategy.whysPath : [];
  const nestedParsed = parseMaybeJson<any[]>(fiveWhys.whysPath);
  const nested = Array.isArray(nestedParsed) ? nestedParsed : [];

  // Canonical source-of-truth rule:
  // 1) prefer strategy.whysPath (user-selected/finalized path from framework insights),
  // 2) fall back to analysisData.five_whys.whysPath for legacy sessions.
  if (topLevel.length > 0) return topLevel;
  return nested;
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

export function buildEpmJsonPayload(epm: EpmPayload): Record<string, any> {
  const program = epm.program || {};
  const rawWorkstreams = parseMaybeJson<any[]>(program.workstreams) || [];
  const workstreams = enforceDomainSequencing(rawWorkstreams as any[]);
  const timeline = normalizeTimeline(program, workstreams);
  const resourcePlan = parseMaybeJson<any>(program.resourcePlan);
  const riskRegister = parseMaybeJson<any>(program.riskRegister);
  const benefitsRealization = parseMaybeJson<any>(program.benefitsRealization);
  const stageGates = parseMaybeJson<any>(program.stageGates);
  const normalizedProgram = {
    ...program,
    workstreams,
    timeline,
    resourcePlan,
    riskRegister,
    benefitsRealization,
    stageGates: stageGates || program.stageGates,
  };

  return {
    ...epm,
    program: normalizedProgram,
    workstreams,
    resourcePlan,
    resources: deriveResources(resourcePlan),
    riskRegister,
    risks: deriveRiskList(riskRegister),
    benefitsRealization,
    benefits: deriveBenefitList(benefitsRealization),
  };
}
