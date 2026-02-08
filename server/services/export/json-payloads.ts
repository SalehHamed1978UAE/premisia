import type { FullExportPackage } from '../../types/interfaces';
import { getJourney } from '../../journey/journey-registry';
import { enforceDomainSequencing } from '../../intelligence/epm/domain-sequencing';

type StrategyPayload = FullExportPackage['strategy'];
type EpmPayload = NonNullable<FullExportPackage['epm']>;
type StrategyDomain = 'food_service' | 'technology' | 'retail' | 'professional_services' | 'generic';

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

  // Canonical source-of-truth rule with resilience:
  // 1) prefer finalized top-level path when complete (>=4),
  // 2) otherwise fall back to nested complete path (legacy compatibility),
  // 3) if neither is complete, choose the richer available path.
  if (topLevel.length >= 4) return topLevel;
  if (nested.length >= 4) return nested;
  if (topLevel.length >= nested.length) return topLevel;
  return nested;
}

function deriveRootCause(
  fiveWhys: Record<string, any>,
  analysisData: Record<string, any>,
  canonicalWhysPath: any[],
): string | null {
  const finalPathStep = canonicalWhysPath[canonicalWhysPath.length - 1];

  // Handle string format (legacy)
  if (typeof finalPathStep === 'string' && finalPathStep.trim().length > 0) {
    return finalPathStep;
  }

  // Handle object format (canonical)
  if (finalPathStep && typeof finalPathStep === 'object') {
    const answer = finalPathStep.answer || finalPathStep.option || finalPathStep.label || '';
    if (answer && answer.trim().length > 0) {
      return answer;
    }
  }

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

function inferStrategyDomain(strategy?: StrategyPayload): StrategyDomain {
  if (!strategy) return 'generic';
  const initiativeType = String(strategy?.understanding?.initiativeType || '').toLowerCase();
  const text = [
    strategy?.understanding?.title,
    strategy?.understanding?.initiativeDescription,
    strategy?.understanding?.userInput,
    strategy?.strategyVersion?.inputSummary,
    initiativeType,
  ]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();

  if (/(service_launch|consult(ing|ancy)?|agency|professional services|implementation service|advisory)/.test(text)) {
    return 'professional_services';
  }
  if (/(restaurant|cafe|food|culinary|dining|menu|kitchen|hospitality)/.test(text)) return 'food_service';
  if (/(retail|store|e-?commerce|shopping)/.test(text)) return 'retail';
  if (/(software_development|saas_platform|saas|software product|application development|product platform|platform product|technology platform)/.test(text)) {
    return 'technology';
  }
  return 'generic';
}

function normalizeSkillsForDomain(skills: any, domain: StrategyDomain): any {
  if (!Array.isArray(skills)) return skills;
  const normalized = skills
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value: string) => value.trim());

  if (domain !== 'technology' && domain !== 'professional_services') return normalized;

  const isLeaked = (value: string) =>
    /\bfood safety\b|\bhealth inspection\b|\bhaccp\b|\bmenu\b|\bkitchen\b|\bchef\b|\bcafe\b|\brestaurant\b|\bpos systems?\b/i.test(value);

  const isProductBuildOnly = (value: string) =>
    /\bsoftware architecture\b|\bplatform engineering\b|\bproduct engineering\b/i.test(value);

  const filtered = normalized.filter((value) =>
    !isLeaked(value) && (domain !== 'professional_services' || !isProductBuildOnly(value))
  );
  if (filtered.length > 0) return filtered;

  if (domain === 'professional_services') {
    return ['client delivery', 'implementation planning', 'change management'];
  }

  return ['platform engineering', 'systems integration', 'delivery management'];
}

function sanitizeResourcePlanForDomain(resourcePlan: any, domain: StrategyDomain): any {
  if (!resourcePlan || typeof resourcePlan !== 'object') return resourcePlan;

  const normalizeList = (items: any[]) =>
    items.map((item: any) => ({
      ...item,
      skills: normalizeSkillsForDomain(item?.skills, domain),
    }));

  return {
    ...resourcePlan,
    internalTeam: Array.isArray(resourcePlan.internalTeam) ? normalizeList(resourcePlan.internalTeam) : resourcePlan.internalTeam,
    externalResources: Array.isArray(resourcePlan.externalResources) ? normalizeList(resourcePlan.externalResources) : resourcePlan.externalResources,
  };
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
      startMonth: 1,
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

function normalizeWorkstreamsForExport(workstreams: any[]): any[] {
  return workstreams.map((ws: any) => {
    const rawStart = Number(ws?.startMonth);
    const rawEnd = Number(ws?.endMonth);
    const startMonth = Math.max(1, Number.isFinite(rawStart) ? rawStart : 1);
    const endMonth = Math.max(startMonth, Number.isFinite(rawEnd) ? rawEnd : startMonth);

    const deliverables = Array.isArray(ws?.deliverables)
      ? ws.deliverables.map((deliverable: any) => {
          const due = Number(deliverable?.dueMonth);
          const dueMonth = Number.isFinite(due)
            ? Math.min(endMonth, Math.max(startMonth, due))
            : endMonth;
          return {
            ...deliverable,
            dueMonth,
          };
        })
      : ws?.deliverables;

    return {
      ...ws,
      startMonth,
      endMonth,
      deliverables,
    };
  });
}

export function buildStrategyJsonPayload(strategy: StrategyPayload): Record<string, any> {
  const parsedAnalysisData = parseMaybeJson<Record<string, any>>(strategy.strategyVersion?.analysisData) || {};
  const fiveWhys = getFiveWhys(parsedAnalysisData);
  const frameworks = deriveFrameworks(strategy, parsedAnalysisData);
  const whysPath = deriveWhysPath(strategy, fiveWhys);
  const rootCause = deriveRootCause(fiveWhys, parsedAnalysisData, whysPath);
  const strategicImplications = deriveStrategicImplications(fiveWhys, parsedAnalysisData);

  // For JSON export, we need to handle both canonical and legacy formats
  // Check if whysPath is already in a clean format
  let exportWhysPath = whysPath;
  let isCanonicalFormat = false;

  // Check if we have canonical format with questions
  if (whysPath.length > 0 && whysPath[0]?.question && whysPath[0]?.answer) {
    isCanonicalFormat = true;
    // Keep canonical format for better data preservation
    exportWhysPath = whysPath.map((step: any) => ({
      question: step.question || `Why ${step.depth || 1}?`,
      answer: step.answer || '',
      depth: step.depth
    }));
  } else if (whysPath.length > 0 && typeof whysPath[0] !== 'string') {
    // If we have objects but not proper canonical format, normalize to strings
    exportWhysPath = whysPath.map((step: any) => {
      if (typeof step === 'string') return step;
      if (step && typeof step === 'object') {
        return step.answer || step.option || step.label || '';
      }
      return '';
    }).filter((s: string) => s.length > 0);
  }

  // Auto-heal legacy mismatch: keep nested paths aligned
  const canonicalizedAnalysisData = { ...parsedAnalysisData };
  const nestedFiveWhysRaw = parseMaybeJson<Record<string, any>>(canonicalizedAnalysisData.five_whys);
  const nestedFiveWhys = nestedFiveWhysRaw || {};
  const camelFiveWhysRaw = parseMaybeJson<Record<string, any>>(canonicalizedAnalysisData.fiveWhys);
  const camelFiveWhys = camelFiveWhysRaw || {};

  if (exportWhysPath.length > 0) {
    canonicalizedAnalysisData.five_whys = {
      ...nestedFiveWhys,
      whysPath: exportWhysPath,
    };
    canonicalizedAnalysisData.fiveWhys = {
      ...camelFiveWhys,
      whysPath: exportWhysPath,
    };
  }

  return {
    ...strategy,
    strategyVersion: strategy.strategyVersion
      ? {
          ...strategy.strategyVersion,
          analysisData: canonicalizedAnalysisData,
        }
      : strategy.strategyVersion,
    frameworks,
    whysPath: exportWhysPath,
    rootCause,
    strategicImplications,
  };
}

export function buildEpmJsonPayload(epm: EpmPayload, strategy?: StrategyPayload): Record<string, any> {
  const program = epm.program || {};
  const domain = inferStrategyDomain(strategy);
  const rawWorkstreams = parseMaybeJson<any[]>(program.workstreams) || [];
  const sequencedWorkstreams = enforceDomainSequencing(rawWorkstreams as any[]);
  const workstreams = normalizeWorkstreamsForExport(sequencedWorkstreams as any[]);
  const timeline = normalizeTimeline(program, workstreams);
  const rawResourcePlan = parseMaybeJson<any>(program.resourcePlan);
  const resourcePlan = sanitizeResourcePlanForDomain(rawResourcePlan, domain);
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
