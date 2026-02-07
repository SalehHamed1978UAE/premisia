import { getJourney } from '../../journey/journey-registry';
import { qualityGateRunner } from '../../intelligence/epm/validators/quality-gate-runner';

type Severity = 'critical' | 'warning';

export interface AcceptanceIssue {
  severity: Severity;
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ExportAcceptanceReport {
  passed: boolean;
  criticalIssues: AcceptanceIssue[];
  warnings: AcceptanceIssue[];
}

interface ExportAcceptanceInput {
  strategyJson: string;
  epmJson: string | null;
  assignmentsCsv?: string | null;
  workstreamsCsv?: string | null;
  resourcesCsv?: string | null;
  risksCsv?: string | null;
  benefitsCsv?: string | null;
}

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

function normalizeFramework(value: string): string | null {
  const key = value.toLowerCase().replace(/[\s-]+/g, '_');
  return FRAMEWORK_ALIASES[key] || null;
}

function normalizeFrameworkList(values: any[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = normalizeFramework(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

function parseJson(value: any): any | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function splitCsvRecords(csv: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];

    if (ch === '"') {
      const next = csv[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && csv[i + 1] === '\n') i += 1;
      records.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.length > 0 || csv.endsWith('\n') || csv.endsWith('\r')) {
    records.push(current);
  }

  return records.filter((record) => record.trim().length > 0);
}

function countCsvRows(csv: string | null | undefined): number {
  if (!csv || csv.trim().length === 0) return 0;
  const records = splitCsvRecords(csv);
  if (records.length === 0) return 0;
  return Math.max(0, records.length - 1);
}

function deriveExpectedFrameworks(strategyData: any): string[] {
  const journeySession = strategyData?.journeySession || {};
  const metadata = parseJson(journeySession.metadata) || {};

  if (Array.isArray(metadata.frameworks)) {
    return normalizeFrameworkList(metadata.frameworks);
  }

  const journeyType = typeof journeySession.journeyType === 'string'
    ? journeySession.journeyType
    : null;
  if (!journeyType) return [];

  try {
    const journey = getJourney(journeyType as any);
    if (!journey || !Array.isArray(journey.frameworks)) return [];
    return normalizeFrameworkList(journey.frameworks);
  } catch {
    return [];
  }
}

function arraysEqualStrict(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => b[index] === value);
}

function normalizeCriticalPathToIds(criticalPath: any[], workstreams: any[]): string[] {
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();

  for (const ws of workstreams) {
    const id = typeof ws.id === 'string' ? ws.id : null;
    const name = typeof ws.name === 'string' ? ws.name : null;
    if (!id) continue;
    byId.set(id.toLowerCase(), id);
    if (name) byName.set(name.toLowerCase(), id);
  }

  const normalized: string[] = [];
  for (const item of criticalPath) {
    if (typeof item !== 'string') continue;
    const key = item.toLowerCase();
    const matched = byId.get(key) || byName.get(key);
    if (matched) normalized.push(matched);
  }

  return normalized;
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

export function validateExportAcceptance(input: ExportAcceptanceInput): ExportAcceptanceReport {
  const criticalIssues: AcceptanceIssue[] = [];
  const warnings: AcceptanceIssue[] = [];

  const strategyData = parseJson(input.strategyJson);
  if (!strategyData) {
    return {
      passed: false,
      criticalIssues: [{
        severity: 'critical',
        code: 'INVALID_STRATEGY_JSON',
        message: 'strategy.json is not valid JSON',
      }],
      warnings,
    };
  }

  const expectedFrameworks = deriveExpectedFrameworks(strategyData);
  const actualFrameworks = normalizeFrameworkList(Array.isArray(strategyData.frameworks) ? strategyData.frameworks : []);
  if (expectedFrameworks.length > 0 && !arraysEqualStrict(actualFrameworks, expectedFrameworks)) {
    criticalIssues.push({
      severity: 'critical',
      code: 'FRAMEWORK_MISMATCH',
      message: 'Exported frameworks do not match journey definition exactly',
      details: {
        expected: expectedFrameworks,
        actual: actualFrameworks,
      },
    });
  }

  if (!input.epmJson) {
    warnings.push({
      severity: 'warning',
      code: 'NO_EPM_JSON',
      message: 'EPM JSON not present; EPM acceptance gates skipped',
    });
    return { passed: criticalIssues.length === 0, criticalIssues, warnings };
  }

  const epmData = parseJson(input.epmJson);
  if (!epmData) {
    criticalIssues.push({
      severity: 'critical',
      code: 'INVALID_EPM_JSON',
      message: 'epm.json is not valid JSON',
    });
    return { passed: false, criticalIssues, warnings };
  }

  if (!epmData.program || typeof epmData.program !== 'object') {
    criticalIssues.push({
      severity: 'critical',
      code: 'MISSING_EPM_PROGRAM',
      message: 'epm.json is missing `program` section',
    });
  }

  const requiredArraySections = ['assignments', 'workstreams', 'resources', 'risks', 'benefits'] as const;
  for (const section of requiredArraySections) {
    if (!Array.isArray(epmData[section])) {
      criticalIssues.push({
        severity: 'critical',
        code: 'MISSING_EPM_SECTION',
        message: `epm.json is missing required array section: ${section}`,
      });
    }
  }

  const countChecks: Array<{ name: string; jsonCount: number; csv: string | null | undefined }> = [
    { name: 'assignments', jsonCount: Array.isArray(epmData.assignments) ? epmData.assignments.length : 0, csv: input.assignmentsCsv },
    { name: 'workstreams', jsonCount: Array.isArray(epmData.workstreams) ? epmData.workstreams.length : 0, csv: input.workstreamsCsv },
    { name: 'resources', jsonCount: Array.isArray(epmData.resources) ? epmData.resources.length : 0, csv: input.resourcesCsv },
    { name: 'risks', jsonCount: Array.isArray(epmData.risks) ? epmData.risks.length : 0, csv: input.risksCsv },
    { name: 'benefits', jsonCount: Array.isArray(epmData.benefits) ? epmData.benefits.length : 0, csv: input.benefitsCsv },
  ];

  for (const check of countChecks) {
    const csvRows = countCsvRows(check.csv);
    if (!check.csv && check.jsonCount > 0) {
      criticalIssues.push({
        severity: 'critical',
        code: 'CSV_MISSING',
        message: `${check.name}.csv missing while epm.json has ${check.jsonCount} rows`,
      });
      continue;
    }
    if (check.csv && csvRows !== check.jsonCount) {
      criticalIssues.push({
        severity: 'critical',
        code: 'CSV_JSON_COUNT_MISMATCH',
        message: `${check.name} count mismatch between epm.json and CSV`,
        details: { jsonCount: check.jsonCount, csvRows },
      });
    }
  }

  const workstreams = Array.isArray(epmData.workstreams) ? epmData.workstreams : [];
  const byId = new Map<string, any>();
  for (const ws of workstreams) {
    if (typeof ws?.id === 'string') byId.set(ws.id, ws);
  }

  for (const ws of workstreams) {
    const wsId = typeof ws?.id === 'string' ? ws.id : '(unknown)';
    const wsName = typeof ws?.name === 'string' ? ws.name : wsId;
    const startMonth = Number(ws?.startMonth);
    const endMonth = Number(ws?.endMonth);

    if (!Number.isFinite(startMonth) || !Number.isFinite(endMonth) || endMonth < startMonth) {
      criticalIssues.push({
        severity: 'critical',
        code: 'INVALID_TIMELINE_RANGE',
        message: `Workstream "${wsName}" has invalid start/end months`,
      });
      continue;
    }

    for (const depId of ws.dependencies || []) {
      const dep = byId.get(depId);
      if (!dep) {
        criticalIssues.push({
          severity: 'critical',
          code: 'INVALID_DEPENDENCY_REFERENCE',
          message: `Workstream "${wsName}" depends on missing workstream "${depId}"`,
        });
        continue;
      }

      const depEnd = Number(dep.endMonth);
      if (Number.isFinite(depEnd) && depEnd >= startMonth) {
        criticalIssues.push({
          severity: 'critical',
          code: 'INVALID_DEPENDENCY_TIMING',
          message: `Workstream "${wsName}" starts before dependency "${dep.name || depId}" ends`,
          details: { startMonth, dependencyEndMonth: depEnd },
        });
      }
    }
  }

  const timeline = parseJson(epmData.program?.timeline) || epmData.program?.timeline || {};
  const stageGates = parseJson(epmData.program?.stageGates) || epmData.program?.stageGates || { gates: [] };
  const hasDependencies = workstreams.some((ws: any) => Array.isArray(ws.dependencies) && ws.dependencies.length > 0);
  const expectedCriticalPath = computeLongestDependencyChain(workstreams);
  const actualCriticalPath = normalizeCriticalPathToIds(Array.isArray(timeline?.criticalPath) ? timeline.criticalPath : [], workstreams);

  if (hasDependencies && actualCriticalPath.length < 2) {
    criticalIssues.push({
      severity: 'critical',
      code: 'CRITICAL_PATH_INCOMPLETE',
      message: 'Critical path does not include the dependency chain',
      details: { expected: expectedCriticalPath, actual: actualCriticalPath },
    });
  } else if (expectedCriticalPath.length > 0 && !arraysEqualStrict(actualCriticalPath, expectedCriticalPath)) {
    criticalIssues.push({
      severity: 'critical',
      code: 'CRITICAL_PATH_MISMATCH',
      message: 'Critical path does not match the longest dependency chain',
      details: { expected: expectedCriticalPath, actual: actualCriticalPath },
    });
  }

  if (Array.isArray(workstreams) && workstreams.length > 0 && timeline && stageGates) {
    const report = qualityGateRunner.runQualityGate(
      JSON.parse(JSON.stringify(workstreams)),
      JSON.parse(JSON.stringify(timeline)),
      JSON.parse(JSON.stringify(stageGates)),
      strategyData?.understanding?.initiativeType || strategyData?.understanding?.userInput || ''
    );

    if (report.errorCount > 0) {
      criticalIssues.push({
        severity: 'critical',
        code: 'VALIDATOR_CRITICAL_ISSUES',
        message: `Quality gate found ${report.errorCount} error-level issues`,
      });
    }
  }

  return {
    passed: criticalIssues.length === 0,
    criticalIssues,
    warnings,
  };
}
