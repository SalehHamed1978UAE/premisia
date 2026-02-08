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
  reportMarkdown?: string | null;
  reportHtml?: string | null;
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

function splitCsvFields(record: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < record.length; i += 1) {
    const ch = record[i];
    if (ch === '"') {
      const next = record[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  fields.push(current);
  return fields.map((value) => value.trim());
}

function parseCsvTable(csv: string | null | undefined): Array<Record<string, string>> {
  if (!csv || csv.trim().length === 0) return [];
  const records = splitCsvRecords(csv);
  if (records.length < 2) return [];

  const header = splitCsvFields(records[0]);
  const rows: Array<Record<string, string>> = [];

  for (const record of records.slice(1)) {
    const values = splitCsvFields(record);
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i += 1) {
      const key = header[i];
      row[key] = values[i] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

function normalizeColumnName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function pickColumn(row: Record<string, string>, candidates: string[]): string | null {
  const normalizedMap = new Map<string, string>();
  for (const [key, value] of Object.entries(row)) {
    normalizedMap.set(normalizeColumnName(key), value);
  }

  for (const candidate of candidates) {
    const hit = normalizedMap.get(normalizeColumnName(candidate));
    if (hit !== undefined && hit !== null && `${hit}`.trim().length > 0) {
      return hit;
    }
  }

  return null;
}

function parseMonthValue(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);

  const monthMatch = trimmed.match(/month\s*(-?\d+)/i);
  if (monthMatch) return Number(monthMatch[1]);

  return null;
}

function containsPlaceholderCorruption(value: string): boolean {
  return /\bundefined\b|\[object Object\]|\bNaN\b/.test(value);
}

function isAnswerLikeWhyStep(step: any): boolean {
  if (typeof step === 'string') {
    return !/^why\b/i.test(step.trim());
  }

  if (!step || typeof step !== 'object') return false;

  if (typeof step.answer === 'string' && step.answer.trim().length > 0) return true;
  if (typeof step.option === 'string' && step.option.trim().length > 0 && !/^why\b/i.test(step.option.trim())) {
    return true;
  }
  if (typeof step.value === 'string' && step.value.trim().length > 0 && !/^why\b/i.test(step.value.trim())) {
    return true;
  }

  return false;
}

function normalizeWhyStepForComparison(step: any): string {
  const value = typeof step === 'string'
    ? step
    : (step?.answer || step?.option || step?.label || step?.value || step?.why || step?.question || '');
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeWhyPathForComparison(path: any[]): string[] {
  return path
    .map((step) => normalizeWhyStepForComparison(step))
    .filter((value) => value.length > 0);
}

function areWhyPathsEquivalent(left: any[], right: any[]): boolean {
  const a = normalizeWhyPathForComparison(left);
  const b = normalizeWhyPathForComparison(right);
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

type StrategyDomain = 'food_service' | 'technology' | 'retail' | 'generic';

function inferStrategyDomain(strategyData: any): StrategyDomain {
  const text = [
    strategyData?.understanding?.title,
    strategyData?.understanding?.initiativeDescription,
    strategyData?.understanding?.userInput,
    strategyData?.strategyVersion?.inputSummary,
  ]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();

  if (/(restaurant|cafe|food|culinary|dining|menu|kitchen|hospitality)/.test(text)) return 'food_service';
  if (/(retail|store|e-?commerce|shopping)/.test(text)) return 'retail';
  if (/(ai|saas|software|technology|tech|platform|automation|agentic)/.test(text)) return 'technology';
  return 'generic';
}

function collectResourceSkillCorpus(resources: any[]): string {
  return resources
    .flatMap((resource: any) => {
      const fragments: string[] = [];
      if (Array.isArray(resource?.skills)) fragments.push(resource.skills.join(' '));
      if (typeof resource?.skills === 'string') fragments.push(resource.skills);
      if (typeof resource?.requirements === 'string') fragments.push(resource.requirements);
      if (typeof resource?.description === 'string') fragments.push(resource.description);
      if (typeof resource?.justification === 'string') fragments.push(resource.justification);
      return fragments;
    })
    .join(' ')
    .toLowerCase();
}

function extractMarkdownTreeChosenPath(markdown: string | null | undefined): string[] {
  if (!markdown) return [];
  const matches = markdown.matchAll(/\*\*([^*]+)\*\*\s*✓\s*\(Chosen path\)/g);
  return Array.from(matches, (match) => match[1]?.trim() || '').filter((value) => value.length > 0);
}

function extractMarkdownSummaryPath(markdown: string | null | undefined): string[] {
  if (!markdown) return [];
  const sectionSplit = markdown.split('## Five Whys - Chosen Path Summary');
  if (sectionSplit.length < 2) return [];
  const summary = sectionSplit[1];
  const answerMatches = summary.matchAll(/\*\*Answer:\*\*\s*(.+)/g);
  return Array.from(answerMatches, (match) => (match[1] || '').trim()).filter((value) => value.length > 0);
}

function deriveExpectedFrameworks(strategyData: any): string[] {
  const journeySession = strategyData?.journeySession || {};
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

  const metadata = parseJson(journeySession.metadata) || {};
  if (Array.isArray(metadata.frameworks)) {
    return normalizeFrameworkList(metadata.frameworks);
  }

  return [];
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

function inferWorkstreamStage(workstream: any): number {
  const text = `${workstream?.name || ''} ${workstream?.description || ''}`;
  if (/discover|research|analysis|assess|diagnos|requirement|planning|plan|scope|governance|compliance|legal|permit|approval|design|architecture|procurement/i.test(text)) {
    return 0;
  }
  if (/build|develop|implementation|implement|configure|configuration|setup|construction|integrat|migration|infrastructure/i.test(text)) {
    return 1;
  }
  if (/test|qa|validation|pilot|train|training|recruit|hiring|onboard|enablement/i.test(text)) {
    return 2;
  }
  if (/launch|go[\s-]?live|rollout|deploy|activation|marketing|sales|operations|execution/i.test(text)) {
    return 3;
  }
  if (/optimi[sz]|scale|stabil|continuous improvement|hypercare/i.test(text)) {
    return 4;
  }
  return 2;
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

  const includesFiveWhys = expectedFrameworks.includes('five_whys') || actualFrameworks.includes('five_whys');
  if (includesFiveWhys) {
    const whysPath = Array.isArray(strategyData.whysPath) ? strategyData.whysPath : [];
    if (whysPath.length < 4) {
      criticalIssues.push({
        severity: 'critical',
        code: 'WHYS_PATH_INCOMPLETE',
        message: 'whysPath must include at least 4 steps for Five Whys journeys',
        details: { length: whysPath.length },
      });
    } else {
      const answerLikeCount = whysPath.filter((step: any) => isAnswerLikeWhyStep(step)).length;
      if (answerLikeCount < Math.ceil(whysPath.length / 2)) {
        criticalIssues.push({
          severity: 'critical',
          code: 'WHYS_PATH_QUESTION_HEAVY',
          message: 'whysPath appears question-heavy; expected mostly answer/root-cause statements',
          details: { length: whysPath.length, answerLikeCount },
        });
      }
    }

    const parsedAnalysisData = parseJson(strategyData?.strategyVersion?.analysisData) || strategyData?.strategyVersion?.analysisData || {};
    const fiveWhysData = parsedAnalysisData?.five_whys || parsedAnalysisData?.fiveWhys || {};
    const nestedWhysPath = Array.isArray(fiveWhysData?.whysPath) ? fiveWhysData.whysPath : [];
    if (whysPath.length > 0 && nestedWhysPath.length > 0 && !areWhyPathsEquivalent(whysPath, nestedWhysPath)) {
      criticalIssues.push({
        severity: 'critical',
        code: 'WHYS_PATH_SOURCE_MISMATCH',
        message: 'Five Whys path diverges across sources; expected one canonical chosen path',
        details: {
          topLevelLength: whysPath.length,
          nestedLength: nestedWhysPath.length,
          topLevelPreview: normalizeWhyPathForComparison(whysPath).slice(0, 2),
          nestedPreview: normalizeWhyPathForComparison(nestedWhysPath).slice(0, 2),
        },
      });
    }

    const treePathFromReport = extractMarkdownTreeChosenPath(input.reportMarkdown);
    const summaryPathFromReport = extractMarkdownSummaryPath(input.reportMarkdown);
    if (treePathFromReport.length > 0 && summaryPathFromReport.length > 0) {
      const compareCount = Math.min(treePathFromReport.length, summaryPathFromReport.length, 4);
      const treeSlice = treePathFromReport.slice(0, compareCount);
      const summarySlice = summaryPathFromReport.slice(0, compareCount);
      if (!areWhyPathsEquivalent(treeSlice, summarySlice)) {
        criticalIssues.push({
          severity: 'critical',
          code: 'REPORT_WHYS_PATH_MISMATCH',
          message: 'Report tree chosen-path markers diverge from chosen-path summary',
          details: {
            treePreview: normalizeWhyPathForComparison(treeSlice),
            summaryPreview: normalizeWhyPathForComparison(summarySlice),
          },
        });
      }
    }
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

  const strategyDomain = inferStrategyDomain(strategyData);
  const resources = Array.isArray(epmData.resources) ? epmData.resources : [];
  const resourceSkillCorpus = collectResourceSkillCorpus(resources);
  if (strategyDomain === 'technology' && resourceSkillCorpus.length > 0) {
    const leakedTerms = [
      /\bfood safety\b/i,
      /\bhealth inspection\b/i,
      /\bhaccp\b/i,
      /\bmenu\b/i,
      /\bkitchen\b/i,
      /\bchef\b/i,
      /\bcafe\b/i,
      /\brestaurant\b/i,
      /\bpos systems?\b/i,
    ].filter((pattern) => pattern.test(resourceSkillCorpus))
      .map((pattern) => pattern.source.replace(/\\b/g, ''));

    if (leakedTerms.length > 0) {
      criticalIssues.push({
        severity: 'critical',
        code: 'DOMAIN_SKILL_LEAKAGE',
        message: 'Resource skills include cross-domain terms inconsistent with technology program context',
        details: {
          domain: strategyDomain,
          leakedTerms: leakedTerms.slice(0, 5),
        },
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

    if (startMonth === 0 && endMonth === 0) {
      criticalIssues.push({
        severity: 'critical',
        code: 'ZERO_TIMELINE',
        message: `Workstream "${wsName}" has startMonth=0 and endMonth=0`,
      });
    }

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
  const maxWorkstreamEnd = workstreams.reduce(
    (max: number, ws: any) => Math.max(max, Number(ws?.endMonth) || 0),
    0
  );
  const phaseMaxEnd = Array.isArray(timeline?.phases)
    ? timeline.phases.reduce(
        (max: number, phase: any) => Math.max(max, Number(phase?.endMonth) || 0),
        0
      )
    : 0;
  const totalMonths = Number(timeline?.totalMonths) || 0;
  if (totalMonths > 0 && phaseMaxEnd > 0 && totalMonths !== phaseMaxEnd) {
    criticalIssues.push({
      severity: 'critical',
      code: 'TIMELINE_TOTALMONTHS_MISMATCH',
      message: 'timeline.totalMonths must match the end month of the last phase',
      details: {
        totalMonths,
        phaseMaxEnd,
      },
    });
  }
  if (maxWorkstreamEnd > 0 && (phaseMaxEnd < maxWorkstreamEnd || totalMonths < maxWorkstreamEnd)) {
    criticalIssues.push({
      severity: 'critical',
      code: 'TIMELINE_PHASE_COVERAGE',
      message: 'Timeline phases/total months do not cover full workstream span',
      details: {
        totalMonths,
        phaseMaxEnd,
        maxWorkstreamEnd,
      },
    });
  }

  const dependentWorkstreams = workstreams.filter((ws: any) => Array.isArray(ws.dependencies) && ws.dependencies.length > 0).length;
  const dependencyRatio = workstreams.length > 0 ? dependentWorkstreams / workstreams.length : 0;
  if (workstreams.length > 0 && !(dependencyRatio >= 0.4 || dependentWorkstreams >= 2)) {
    const issue: AcceptanceIssue = {
      severity: workstreams.length >= 8 ? 'critical' : 'warning',
      code: 'DEPENDENCY_RICHNESS_LOW',
      message: 'Dependency graph is too sparse for a realistic execution plan',
      details: { workstreamCount: workstreams.length, dependentWorkstreams, dependencyRatio },
    };
    if (issue.severity === 'critical') {
      criticalIssues.push(issue);
    } else {
      warnings.push(issue);
    }
  }

  // Generic sequencing integrity checks (domain-agnostic).
  const workstreamById = new Map<string, any>();
  const stageById = new Map<string, number>();
  for (const ws of workstreams) {
    if (typeof ws?.id !== 'string') continue;
    workstreamById.set(ws.id, ws);
    stageById.set(ws.id, inferWorkstreamStage(ws));
  }

  const stageInversions: Array<{ workstreamId: string; dependencyId: string; workstreamStage: number; dependencyStage: number }> = [];
  for (const ws of workstreams) {
    if (typeof ws?.id !== 'string') continue;
    const wsStage = stageById.get(ws.id) ?? 2;
    for (const depId of Array.isArray(ws?.dependencies) ? ws.dependencies : []) {
      if (typeof depId !== 'string') continue;
      if (!workstreamById.has(depId)) continue;
      const depStage = stageById.get(depId) ?? 2;
      if (depStage > wsStage) {
        stageInversions.push({
          workstreamId: ws.id,
          dependencyId: depId,
          workstreamStage: wsStage,
          dependencyStage: depStage,
        });
      }
    }
  }

  if (stageInversions.length > 0) {
    criticalIssues.push({
      severity: 'critical',
      code: 'SEQUENCING_DEPENDENCY_INVERSION',
      message: 'Workstream depends on a task that appears to be in a later execution stage',
      details: {
        inversions: stageInversions.slice(0, 10),
        total: stageInversions.length,
      },
    });
  }

  // Validate assignment month ranges against workstream bounds when month columns are present in CSV.
  const assignmentRows = parseCsvTable(input.assignmentsCsv || null);
  if (assignmentRows.length > 0) {
    const csvWorkstreamRanges = new Map<string, { start: number; end: number }>();
    const workstreamRows = parseCsvTable(input.workstreamsCsv || null);
    for (const row of workstreamRows) {
      const wsId = pickColumn(row, ['Workstream ID', 'workstreamId', 'id']);
      const start = parseMonthValue(pickColumn(row, ['Start Date', 'Start Month']));
      const end = parseMonthValue(pickColumn(row, ['End Date', 'End Month']));
      if (wsId && start !== null && end !== null) {
        csvWorkstreamRanges.set(wsId, { start, end });
      }
    }

    if (csvWorkstreamRanges.size === 0) {
      for (const ws of workstreams) {
        if (typeof ws?.id !== 'string') continue;
        const start = Number(ws?.startMonth);
        const end = Number(ws?.endMonth);
        if (Number.isFinite(start) && Number.isFinite(end)) {
          csvWorkstreamRanges.set(ws.id, { start, end });
        }
      }
    }

    let assignmentRangeViolations = 0;
    for (const row of assignmentRows) {
      const wsId = pickColumn(row, ['Workstream ID', 'workstreamId']);
      const start = parseMonthValue(pickColumn(row, ['Start Month', 'Start Date']));
      const end = parseMonthValue(pickColumn(row, ['End Month', 'End Date']));
      if (!wsId || start === null || end === null) continue;
      const wsRange = csvWorkstreamRanges.get(wsId);
      if (!wsRange) continue;

      if (start < wsRange.start || end > wsRange.end || end < start) {
        assignmentRangeViolations += 1;
      }
    }

    if (assignmentRangeViolations > 0) {
      criticalIssues.push({
        severity: 'critical',
        code: 'ASSIGNMENT_RANGE_INVALID',
        message: 'Assignment months fall outside their workstream ranges',
        details: { violations: assignmentRangeViolations },
      });
    }
  }

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

  const usesProgressField = workstreams.some((ws: any) => ws?.progress !== undefined);
  const hasConfidenceField = workstreams.every((ws: any) => ws?.confidence !== undefined);
  if (usesProgressField) {
    warnings.push({
      severity: 'warning',
      code: 'PROGRESS_SEMANTICS_UNCLEAR',
      message: 'Workstreams include progress values without explicit date-based validation context',
    });
  }
  if (!hasConfidenceField) {
    warnings.push({
      severity: 'warning',
      code: 'CONFIDENCE_FIELD_MISSING',
      message: 'One or more workstreams are missing confidence values',
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

  const textArtifacts = [
    input.strategyJson,
    input.epmJson || '',
    input.assignmentsCsv || '',
    input.workstreamsCsv || '',
    input.resourcesCsv || '',
    input.risksCsv || '',
    input.benefitsCsv || '',
    input.reportMarkdown || '',
    input.reportHtml || '',
  ];
  if (textArtifacts.some((value) => containsPlaceholderCorruption(value))) {
    criticalIssues.push({
      severity: 'critical',
      code: 'PLACEHOLDER_CORRUPTION',
      message: 'Export contains placeholder/corruption tokens (undefined, [object Object], or NaN)',
    });
  }

  return {
    passed: criticalIssues.length === 0,
    criticalIssues,
    warnings,
  };
}
