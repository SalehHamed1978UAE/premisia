import { getJourney } from '../../journey/journey-registry';
import { qualityGateRunner } from '../../intelligence/epm/validators/quality-gate-runner';
import { deriveConstraintMode, shouldEnforceConstraints } from '../../intelligence/epm/constraint-policy';
import { hasBudgetConstraintSignal } from '../../intelligence/epm/constraint-utils';
import { normalizeStrategicDecisions } from '../../utils/decision-selection';

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

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/[\u2026…]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface SelectedDecisionRecord {
  decisionId?: string;
  selectedOptionId?: string;
  label: string;
}

function deriveSelectedDecisions(strategyData: any): SelectedDecisionRecord[] {
  const strategyVersion = strategyData?.strategyVersion || {};
  const normalizedFromVersion = normalizeStrategicDecisions(
    strategyVersion?.decisionsData,
    strategyVersion?.selectedDecisions
  );
  const normalizedTopLevel = normalizeStrategicDecisions(
    strategyData?.decisions,
    strategyVersion?.selectedDecisions
  );

  const decisionCandidates = normalizedFromVersion.decisions.length > 0
    ? normalizedFromVersion.decisions
    : normalizedTopLevel.decisions;

  const selected: SelectedDecisionRecord[] = [];
  for (const decision of decisionCandidates) {
    const options = Array.isArray(decision?.options) ? decision.options : [];
    const selectedOption = options.find((option: any) => option?.id === decision?.selectedOptionId);
    const label = selectedOption?.label || selectedOption?.name || null;
    if (typeof label === 'string' && label.trim().length > 0) {
      selected.push({
        decisionId: typeof decision?.id === 'string' ? decision.id : undefined,
        selectedOptionId: typeof decision?.selectedOptionId === 'string' ? decision.selectedOptionId : undefined,
        label: label.trim(),
      });
    }
  }
  return selected;
}

function extractDecisionLink(workstream: any): { decisionId?: string; selectedOptionId?: string } {
  const metadata = workstream?.metadata;
  if (!metadata || typeof metadata !== 'object') return {};

  const decisionIdCandidates = [
    metadata.decisionId,
    metadata.decision_id,
    metadata.decisionLink?.decisionId,
    metadata.decisionLink?.decision_id,
  ];
  const selectedOptionCandidates = [
    metadata.selectedOptionId,
    metadata.selected_option_id,
    metadata.decisionLink?.selectedOptionId,
    metadata.decisionLink?.selected_option_id,
  ];

  const decisionId = decisionIdCandidates.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );
  const selectedOptionId = selectedOptionCandidates.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );

  return { decisionId, selectedOptionId };
}

function hasLabelMatch(workstreams: any[], label: string): boolean {
  const labelNorm = normalizeText(label);
  if (!labelNorm) return false;
  const labelTokens = labelNorm.split(' ').filter((token) => token.length >= 4);
  const decisionWorkstreams = workstreams.filter((workstream) =>
    normalizeText(workstream?.name || '').includes('decision implementation')
  );
  const candidatePool = decisionWorkstreams.length > 0 ? decisionWorkstreams : workstreams;

  return candidatePool.some((workstream) => {
    const deliverableText = Array.isArray(workstream?.deliverables)
      ? workstream.deliverables.map((d: any) => `${d?.name || ''} ${d?.description || ''}`).join(' ')
      : '';
    const haystack = decisionWorkstreams.length > 0
      ? normalizeText(`${workstream?.name || ''}`)
      : normalizeText(`${workstream?.name || ''} ${workstream?.description || ''} ${deliverableText}`);
    if (!haystack) return false;
    if (haystack.includes(labelNorm)) return true;
    const prefixTokenCount = Math.min(5, labelTokens.length);
    const labelPrefix = labelTokens.slice(0, prefixTokenCount).join(' ');
    if (labelPrefix && haystack.includes(labelPrefix)) return true;
    const matched = labelTokens.filter((token) => haystack.includes(token));
    if (labelTokens.length >= 5) {
      return matched.length >= 3 && (matched.length / labelTokens.length) >= 0.75;
    }
    return matched.length >= Math.max(2, Math.ceil(labelTokens.length * 0.75));
  });
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
  const assignments = Array.isArray(epmData.assignments) ? epmData.assignments : [];
  const byId = new Map<string, any>();
  for (const ws of workstreams) {
    if (typeof ws?.id === 'string') byId.set(ws.id, ws);
  }

  // Ensure assignment task IDs align to canonical deliverable IDs across files.
  // This protects downstream systems (CSV/Jira/MS Project) that join by task ID.
  if (workstreams.length > 0 && assignments.length > 0) {
    const deliverableIds = new Set<string>();
    for (const ws of workstreams) {
      for (const deliverable of ws?.deliverables || []) {
        if (!deliverable) continue;
        const idCandidate = typeof deliverable === 'string'
          ? ''
          : (typeof deliverable?.id === 'string' ? deliverable.id : (typeof deliverable?.taskId === 'string' ? deliverable.taskId : ''));
        const normalized = idCandidate.trim();
        if (normalized.length > 0) {
          deliverableIds.add(normalized);
        }
      }
    }

    const assignmentTaskIds = new Set<string>();
    for (const assignment of assignments) {
      const idCandidate = typeof assignment?.taskId === 'string'
        ? assignment.taskId
        : (typeof assignment?.task_id === 'string' ? assignment.task_id : '');
      const normalized = idCandidate.trim();
      if (normalized.length > 0) {
        assignmentTaskIds.add(normalized);
      }
    }

    if (deliverableIds.size > 0 && assignmentTaskIds.size > 0) {
      const missingAssignmentIds = Array.from(deliverableIds).filter((id) => !assignmentTaskIds.has(id));
      const orphanAssignmentIds = Array.from(assignmentTaskIds).filter((id) => !deliverableIds.has(id));
      if (missingAssignmentIds.length > 0 || orphanAssignmentIds.length > 0) {
        criticalIssues.push({
          severity: 'critical',
          code: 'DELIVERABLE_ID_LINKAGE_MISMATCH',
          message: 'Assignment task IDs are not fully aligned with workstream deliverable IDs',
          details: {
            deliverableCount: deliverableIds.size,
            assignmentTaskCount: assignmentTaskIds.size,
            missingAssignmentIds: missingAssignmentIds.slice(0, 12),
            orphanAssignmentIds: orphanAssignmentIds.slice(0, 12),
          },
        });
      }
    }
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

  if (totalMonths >= 18 && maxWorkstreamEnd > 0) {
    const coverageRatio = (maxWorkstreamEnd + 1) / totalMonths;
    if (coverageRatio < 0.7) {
      criticalIssues.push({
        severity: 'critical',
        code: 'TIMELINE_UNDER_UTILIZATION_CRITICAL',
        message: `Workstreams cover only ${(coverageRatio * 100).toFixed(1)}% of timeline (${maxWorkstreamEnd + 1}/${totalMonths} months)`,
        details: { coverageRatio, maxWorkstreamEnd, totalMonths },
      });
    }
  }

  if (Array.isArray(timeline?.phases) && timeline.phases.length > 0) {
    for (const phase of timeline.phases) {
      const phaseStart = Number(phase?.startMonth || 0);
      const phaseEnd = Number(phase?.endMonth || phaseStart);
      const hasCompletingWorkstream = workstreams.some((ws: any) => {
        const wsEnd = Number(ws?.endMonth);
        return Number.isFinite(wsEnd) && wsEnd >= phaseStart && wsEnd <= phaseEnd;
      });
      if (!hasCompletingWorkstream) {
        warnings.push({
          severity: 'warning',
          code: 'PHASE_WITHOUT_COMPLETION_WORKSTREAM',
          message: `Phase "${phase?.name || 'Unnamed'}" has no workstream completing within its window (M${phaseStart}-M${phaseEnd})`,
          details: { phase: phase?.name, phaseStart, phaseEnd },
        });
      }
    }
  }

  const syntheticGateDeliverables = (Array.isArray(stageGates?.gates) ? stageGates.gates : [])
    .flatMap((gate: any) => (Array.isArray(gate?.deliverables) ? gate.deliverables : []))
    .filter((value: any) => typeof value === 'string' && value.toLowerCase().includes('completion review package'));
  if (syntheticGateDeliverables.length > 0) {
    warnings.push({
      severity: 'warning',
      code: 'STAGE_GATE_SYNTHETIC_DELIVERABLE',
      message: `Stage gates include ${syntheticGateDeliverables.length} synthetic completion placeholder deliverable(s)`,
      details: { sample: syntheticGateDeliverables.slice(0, 8) },
    });
  }

  const selectedDecisions = deriveSelectedDecisions(strategyData);
  if (selectedDecisions.length > 0 && workstreams.length > 0) {
    const links = workstreams.map((workstream: any) => extractDecisionLink(workstream));
    const missingLabels = selectedDecisions
      .filter((decision: SelectedDecisionRecord) => {
        const linkMatch = links.some((link: { decisionId?: string; selectedOptionId?: string }) =>
          (decision.selectedOptionId && link.selectedOptionId === decision.selectedOptionId) ||
          (decision.decisionId && link.decisionId === decision.decisionId)
        );
        if (linkMatch) return false;
        return !hasLabelMatch(workstreams, decision.label);
      })
      .map((decision: SelectedDecisionRecord) => decision.label);
    if (missingLabels.length > 0) {
      criticalIssues.push({
        severity: 'critical',
        code: 'DECISION_IMPLEMENTATION_MISMATCH',
        message: 'Selected strategic decisions are not reflected in generated workstreams',
        details: { missingDecisionLabels: missingLabels },
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

  if (Array.isArray(workstreams) && workstreams.length > 0 && timeline && stageGates) {
    const report = qualityGateRunner.runQualityGate(
      JSON.parse(JSON.stringify(workstreams)),
      JSON.parse(JSON.stringify(timeline)),
      JSON.parse(JSON.stringify(stageGates)),
      strategyData?.understanding?.initiativeType || strategyData?.understanding?.userInput || ''
    );

    // Map ALL validator results to individual AcceptanceIssues (Item E fix)
    // Previously only checked report.errorCount > 0 with one generic message,
    // discarding validator-specific details (codes, workstreamIds, suggestions).
    for (const result of report.validatorResults) {
      for (const issue of result.issues) {
        const acceptanceIssue: AcceptanceIssue = {
          severity: issue.severity === 'error' ? 'critical' : 'warning',
          code: issue.code,
          message: `[${result.validatorName}] ${issue.message}`,
          details: {
            validatorName: result.validatorName,
            originalSeverity: issue.severity,
            ...(issue.workstreamId && { workstreamId: issue.workstreamId }),
            ...(issue.field && { field: issue.field }),
            ...(issue.suggestion && { suggestion: issue.suggestion }),
          },
        };

        if (issue.severity === 'error') {
          criticalIssues.push(acceptanceIssue);
        } else {
          // 'warning' and 'info' issues go to warnings (non-gate-blocking)
          warnings.push(acceptanceIssue);
        }
      }
    }

    console.log(
      `[AcceptanceGates] Quality gate: ${report.validatorResults.length} validators, ` +
      `${report.totalIssues} issues (${report.errorCount} errors, ${report.warningCount} warnings, ${report.infoCount} info)`
    );
  }

  // ─── Budget & Timeline Constraint Enforcement ───
  const explicitConstraintMode = epmData.userInputStructured?.constraintMode || epmData.metadata?.constraintMode;
  const constraints = epmData.constraints || epmData.program?.constraints || epmData.metadata?.constraints || null;
  const hasAnyConstraint = Boolean(
    constraints &&
    (
      constraints.costMin != null ||
      constraints.costMax != null ||
      constraints.teamSizeMin != null ||
      constraints.teamSizeMax != null ||
      constraints.timelineMonths != null
    )
  );
  const effectiveConstraintMode = deriveConstraintMode(explicitConstraintMode, hasAnyConstraint);
  const enforceConstraints = shouldEnforceConstraints(effectiveConstraintMode);
  const understandingInput = typeof strategyData?.understanding?.userInput === 'string'
    ? strategyData.understanding.userInput
    : (typeof epmData?.userInputStructured?.raw === 'string' ? epmData.userInputStructured.raw : '');
  const hasBudgetSignalInInput = hasBudgetConstraintSignal(understandingInput || '');

  if (effectiveConstraintMode === 'discovery' && hasBudgetSignalInInput) {
    criticalIssues.push({
      severity: 'critical',
      code: 'DISCOVERY_MODE_BUDGET_SIGNAL_MISMATCH',
      message: 'Budget intent detected in strategic input while export remains in discovery mode',
      details: {
        constraintMode: effectiveConstraintMode,
      },
    });
  }

  const financialPlan = parseJson(epmData.program?.financialPlan) || epmData.financialPlan || null;
  const totalBudget = Number(financialPlan?.totalBudget ?? epmData.program?.totalBudget);
  const costMax = Number(constraints?.costMax);

  if (enforceConstraints && Number.isFinite(totalBudget) && Number.isFinite(costMax) && costMax > 0 && totalBudget > costMax) {
    const overage = totalBudget - costMax;
    const overagePercent = ((overage / costMax) * 100).toFixed(1);
    criticalIssues.push({
      severity: 'critical',
      code: 'BUDGET_CONSTRAINT_VIOLATION',
      message: `Total budget ($${totalBudget.toLocaleString()}) exceeds cost constraint ($${costMax.toLocaleString()}) by $${overage.toLocaleString()} (${overagePercent}%)`,
      details: { totalBudget, costMax, overage, overagePercent },
    });
  }

  const timelineObj = parseJson(epmData.program?.timeline) || epmData.timeline || {};
  const programTotalMonths = Number(timelineObj?.totalMonths ?? epmData.program?.totalDuration);
  const constraintTimelineMonths = Number(constraints?.timelineMonths);

  if (enforceConstraints && Number.isFinite(programTotalMonths) && Number.isFinite(constraintTimelineMonths) && constraintTimelineMonths > 0) {
    // Flag if program duration is less than half the requested timeline (indicates incomplete scope)
    if (programTotalMonths < constraintTimelineMonths * 0.5) {
      warnings.push({
        severity: 'warning',
        code: 'TIMELINE_SCOPE_MISMATCH',
        message: `Program duration (${programTotalMonths} months) covers less than half the requested timeline (${constraintTimelineMonths} months). The full scope may not be planned.`,
        details: { programTotalMonths, constraintTimelineMonths },
      });
    }
    // Flag if program exceeds timeline constraint
    if (programTotalMonths > constraintTimelineMonths) {
      criticalIssues.push({
        severity: 'critical',
        code: 'TIMELINE_CONSTRAINT_VIOLATION',
        message: `Program duration (${programTotalMonths} months) exceeds timeline constraint (${constraintTimelineMonths} months)`,
        details: { programTotalMonths, constraintTimelineMonths },
      });
    }
  }

  // ─── requiresApproval Check ───
  const requiresApproval = epmData.requiresApproval;
  if (enforceConstraints && Number.isFinite(totalBudget) && Number.isFinite(costMax) && totalBudget > costMax) {
    if (!requiresApproval || requiresApproval.budget !== true) {
      criticalIssues.push({
        severity: 'critical',
        code: 'MISSING_APPROVAL_GATE',
        message: 'Budget exceeds constraint but requiresApproval.budget is not set',
        details: { requiresApproval },
      });
    }
  }

  const wbsRows = Array.isArray(epmData.wbs) ? epmData.wbs : [];
  if (wbsRows.length > 0) {
    const placeholderNames = new Set([
      'tbd',
      'placeholder',
      'decision execution plan',
      'implementation roadmap',
      'resource alignment',
    ]);
    const placeholders: Array<{ wbs_code?: string; task_name?: string }> = [];
    for (const row of wbsRows) {
      const taskName = typeof row?.task_name === 'string' ? row.task_name.trim() : '';
      if (!taskName) continue;
      const normalized = taskName.toLowerCase();
      if (placeholderNames.has(normalized)) {
        placeholders.push({ wbs_code: row?.wbs_code, task_name: row?.task_name });
      }
    }
    if (placeholders.length > 0) {
      warnings.push({
        severity: 'warning',
        code: 'WBS_PLACEHOLDER_TASK',
        message: `WBS contains ${placeholders.length} placeholder task name(s)`,
        details: { placeholders },
      });
    }
  }

  return {
    passed: criticalIssues.length === 0,
    criticalIssues,
    warnings,
  };
}
