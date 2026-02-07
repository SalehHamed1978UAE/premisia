import type { FullExportPackage } from '../../types/interfaces';

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

function deriveFrameworks(
  strategy: StrategyPayload,
  analysisData: Record<string, any>,
): string[] {
  // AUTHORITATIVE: Use journey definition if available
  const journeyType = strategy.journeySession?.journeyType;
  if (journeyType) {
    // Import journey registry to get authoritative framework list
    const { journeyRegistry } = require('../../journey/journey-registry');
    const journeyDef = journeyRegistry.getJourney(journeyType);
    if (journeyDef && journeyDef.frameworks) {
      // Return ONLY the frameworks defined for this journey
      return journeyDef.frameworks;
    }
  }

  // FALLBACK: If no journey definition, derive from data (old behavior)
  const fromAnalysisArray = Array.isArray(analysisData.frameworks)
    ? analysisData.frameworks
        .map((f: any) => (typeof f === 'string' ? normalizeFrameworkName(f) : null))
    : [];

  const fromAnalysisKeys = Object.keys(analysisData)
    .map((k) => normalizeFrameworkName(k));

  const fromJourneySession = Array.isArray(strategy.journeySession?.completedFrameworks)
    ? strategy.journeySession?.completedFrameworks
        .map((f: any) => (typeof f === 'string' ? normalizeFrameworkName(f) : null))
    : [];

  return uniqueNonEmpty([
    ...fromAnalysisArray,
    ...fromJourneySession,
    ...fromAnalysisKeys,
  ]);
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

  if (topLevel.length === 0) return nested;
  if (nested.length === 0) return topLevel;

  // Prefer the richer path for downstream automation:
  // 1) longer path wins, 2) if equal length, prefer steps with structured answer data.
  if (nested.length > topLevel.length) return nested;
  if (topLevel.length > nested.length) return topLevel;

  const structuredScore = (path: any[]) =>
    path.reduce((score, step) => {
      if (!step || typeof step !== 'object') return score;
      let s = score;
      if (typeof step.answer === 'string' && step.answer.trim().length > 0) s += 3;
      if (typeof step.question === 'string' && step.question.trim().length > 0) s += 2;
      if (typeof step.option === 'string' && step.option.trim().length > 0) s += 1;
      return s;
    }, 0);

  return structuredScore(nested) > structuredScore(topLevel) ? nested : topLevel;
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
  const workstreams = parseMaybeJson<any[]>(program.workstreams) || [];
  const resourcePlan = parseMaybeJson<any>(program.resourcePlan);
  const riskRegister = parseMaybeJson<any>(program.riskRegister);
  const benefitsRealization = parseMaybeJson<any>(program.benefitsRealization);

  return {
    ...epm,
    workstreams,
    resourcePlan,
    resources: deriveResources(resourcePlan),
    riskRegister,
    risks: deriveRiskList(riskRegister),
    benefitsRealization,
    benefits: deriveBenefitList(benefitsRealization),
  };
}
