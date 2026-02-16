#!/usr/bin/env node

/**
 * Replay EPM synthesis from an exported strategy.json and validate output.
 *
 * Purpose:
 * - Run fast local EPM iterations without replaying full UI journey.
 * - Reproduce BMI/EPM export quality issues deterministically.
 *
 * Usage:
 *   npx tsx scripts/epm-replay-validate.ts \
 *     --strategy /tmp/run/data/strategy.json \
 *     --out /tmp/epm-replay
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  BMCAnalyzer,
  EPMSynthesizer,
  PESTLEAnalyzer,
  PortersAnalyzer,
  normalizeSWOT,
} from '../server/intelligence';
import type { BMCResults, StrategyInsights } from '../server/intelligence/types';
import { normalizeStrategicDecisions } from '../server/utils/decision-selection';
import { createOpenAIProvider } from '../src/lib/intelligent-planning/llm-provider';
import { buildEpmJsonPayload } from '../server/services/export/json-payloads';
import { validateExportAcceptance } from '../server/services/export/acceptance-gates';
import {
  generateAssignmentsCsv,
  generateBenefitsCsv,
  generateResourcesCsv,
  generateRisksCsv,
  generateWorkstreamsCsv,
} from '../server/services/export/csv-exporter';
import { EPMPackageValidator } from './validate-export-package';

type JsonRecord = Record<string, any>;

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

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

function firstString(value: any, fallback = ''): string {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return fallback;
}

function toStringList(value: any): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const action = firstString(item.action);
          const rationale = firstString(item.rationale);
          if (action && rationale) return `${action} - ${rationale}`;
          return action || rationale || firstString(item.description) || firstString(item.message);
        }
        return '';
      })
      .filter((item) => item.length > 0);
  }

  if (value && typeof value === 'object') {
    const action = firstString(value.action);
    const rationale = firstString(value.rationale);
    if (action && rationale) return [`${action} - ${rationale}`];
    const text = action || rationale || firstString(value.description) || firstString(value.message);
    return text ? [text] : [];
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }

  return [];
}

function getBmcBlockDescription(blocks: any[], blockName: string, blockType?: string): string {
  const normalizedName = blockName.toLowerCase();
  const normalizedType = (blockType || '').toLowerCase();

  for (const block of blocks) {
    const candidateName = firstString(block?.blockName).toLowerCase();
    const candidateType = firstString(block?.blockType).toLowerCase();
    if (candidateName === normalizedName) return firstString(block?.description);
    if (normalizedType && candidateType === normalizedType) return firstString(block?.description);
  }

  return '';
}

function buildBmcResults(bmc: JsonRecord): BMCResults {
  const blocks = Array.isArray(bmc.blocks) ? bmc.blocks : [];
  const recommendations = toStringList(bmc.recommendations);
  const contradictions = toStringList(bmc.contradictions);
  const keyInsights = toStringList(bmc.keyInsights);

  return {
    customerSegments: getBmcBlockDescription(blocks, 'Customer Segments', 'customer_segments'),
    valuePropositions: getBmcBlockDescription(blocks, 'Value Propositions', 'value_propositions'),
    channels: getBmcBlockDescription(blocks, 'Channels', 'channels'),
    customerRelationships: getBmcBlockDescription(blocks, 'Customer Relationships', 'customer_relationships'),
    revenueStreams: getBmcBlockDescription(blocks, 'Revenue Streams', 'revenue_streams'),
    keyActivities: getBmcBlockDescription(blocks, 'Key Activities', 'key_activities'),
    keyResources: getBmcBlockDescription(blocks, 'Key Resources', 'key_resources'),
    keyPartnerships: getBmcBlockDescription(blocks, 'Key Partnerships', 'key_partnerships'),
    costStructure: getBmcBlockDescription(blocks, 'Cost Structure', 'cost_structure'),
    contradictions,
    recommendations,
    executiveSummary: keyInsights.join(' ').trim(),
  };
}

async function buildInsights(strategy: JsonRecord): Promise<StrategyInsights> {
  const analysisData = parseMaybeJson<JsonRecord>(strategy?.strategyVersion?.analysisData) || {};

  const bmcData = parseMaybeJson<JsonRecord>(analysisData.bmc);
  if (bmcData) {
    const bmcAnalyzer = new BMCAnalyzer();
    return bmcAnalyzer.analyze(buildBmcResults(bmcData));
  }

  const swotData =
    parseMaybeJson<JsonRecord>(analysisData.swot?.data?.output) ||
    parseMaybeJson<JsonRecord>(analysisData.swot?.output) ||
    parseMaybeJson<JsonRecord>(analysisData.swot);
  if (swotData?.strengths) {
    return normalizeSWOT(swotData);
  }

  const portersData =
    parseMaybeJson<JsonRecord>(analysisData.porters?.data?.portersResults) ||
    parseMaybeJson<JsonRecord>(analysisData.porters?.portersResults) ||
    parseMaybeJson<JsonRecord>(analysisData.porters_analysis);
  if (portersData) {
    const portersAnalyzer = new PortersAnalyzer();
    return portersAnalyzer.analyze(portersData as any);
  }

  const pestleData =
    parseMaybeJson<JsonRecord>(analysisData.pestle?.data?.pestleResults) ||
    parseMaybeJson<JsonRecord>(analysisData.pestle?.pestleResults) ||
    parseMaybeJson<JsonRecord>(analysisData.pestle);
  if (pestleData) {
    const pestleAnalyzer = new PESTLEAnalyzer();
    return pestleAnalyzer.analyze(pestleData as any);
  }

  throw new Error('No supported framework data found in strategyVersion.analysisData');
}

function buildDecisionsContext(strategy: JsonRecord): any {
  const strategyVersion = strategy?.strategyVersion || {};
  const parsedDecisionsData = parseMaybeJson<JsonRecord>(strategyVersion?.decisionsData) || {};
  const normalized = normalizeStrategicDecisions(parsedDecisionsData, strategyVersion?.selectedDecisions);

  const decisionFlow = Array.isArray(parsedDecisionsData.decision_flow) ? parsedDecisionsData.decision_flow : [];
  const prioritizedOrder = decisionFlow
    .map((entry: any) => firstString(entry?.decisionId || entry?.decision_id || entry?.id))
    .filter((value: string) => value.length > 0);

  const clarificationConflicts = Array.isArray(strategy?.clarifications?.conflicts)
    ? strategy.clarifications.conflicts
    : [];

  const costMin = Number(strategyVersion.costMin);
  const costMax = Number(strategyVersion.costMax);
  const timelineMonths = Number(strategyVersion.timelineMonths);

  const budgetRange = Number.isFinite(costMax) && costMax > 0
    ? {
        min: Number.isFinite(costMin) && costMin > 0 ? costMin : costMax,
        max: costMax,
      }
    : undefined;

  const timelineRange = Number.isFinite(timelineMonths) && timelineMonths > 0
    ? { min: timelineMonths, max: timelineMonths }
    : undefined;

  return {
    timelineUrgency: 'Strategic',
    sessionId: firstString(strategyVersion.sessionId) || firstString(strategy?.understanding?.sessionId),
    prioritizedOrder,
    clarificationConflicts,
    budgetRange,
    timelineRange,
    decisions: normalized.decisions,
    selectedDecisions: normalized.selectedDecisions,
    decisionsData: parsedDecisionsData,
    constraintMode: budgetRange || timelineRange ? 'constrained' : 'discovery',
  };
}

function buildNamingContext(strategy: JsonRecord, decisionsContext: any): JsonRecord {
  const title = firstString(strategy?.understanding?.title);
  const analysisData = parseMaybeJson<JsonRecord>(strategy?.strategyVersion?.analysisData) || {};
  const bmc = parseMaybeJson<JsonRecord>(analysisData.bmc) || {};

  return {
    journeyTitle: title,
    businessName: title,
    businessSector: firstString(strategy?.understanding?.initiativeType),
    framework: 'bmc',
    bmcKeyInsights: toStringList(bmc.keyInsights),
    bmcRecommendations: toStringList(bmc.recommendations),
    selectedDecisions: decisionsContext?.selectedDecisions || null,
    decisionsData: decisionsContext?.decisionsData || null,
  };
}

function computeStrictScore(
  validatorScore: number,
  validatorWarnings: number,
  acceptanceCritical: number,
  acceptanceWarnings: number
): number {
  const penalty =
    (acceptanceCritical * 20) +
    (acceptanceWarnings * 4) +
    (validatorWarnings * 2);
  return Math.max(0, Math.min(100, validatorScore - penalty));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const strategyPath = args.strategy;
  const outDir = args.out || '/tmp/epm-replay';
  const model = args.model || process.env.EPM_REPLAY_MODEL || 'gpt-5.2';

  if (!strategyPath) {
    console.error('Usage: npx tsx scripts/epm-replay-validate.ts --strategy <path-to-strategy.json> [--out <dir>]');
    process.exit(1);
  }

  await fs.mkdir(outDir, { recursive: true });

  const strategyRaw = await fs.readFile(strategyPath, 'utf-8');
  const strategy = JSON.parse(strategyRaw);

  const insights = await buildInsights(strategy);
  const decisionsContext = buildDecisionsContext(strategy);
  const namingContext = buildNamingContext(strategy, decisionsContext);
  const initiativeType =
    firstString(strategy?.understanding?.initiativeType) ||
    firstString(strategy?.strategyVersion?.marketContext) ||
    'general';

  console.log('[Replay] Starting EPM synthesis...');
  console.log('[Replay] Insight framework:', insights.frameworkType);
  console.log('[Replay] Insight count:', insights.insights.length);
  console.log('[Replay] Initiative type:', initiativeType);
  console.log('[Replay] Model:', model);

  const llm = createOpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY || '',
    model,
  });
  const synthesizer = new EPMSynthesizer(llm);
  const epmProgram = await synthesizer.synthesize(
    insights,
    decisionsContext,
    namingContext,
    { initiativeType }
  );

  const programId = firstString(epmProgram?.id) || 'replay-program';
  const assignments = await synthesizer.generateAssignments(epmProgram as any, programId);

  const epmPayload = buildEpmJsonPayload(
    {
      program: epmProgram as any,
      assignments,
    } as any,
    {
      strategyVersion: strategy?.strategyVersion || null,
      userInput: firstString(strategy?.understanding?.userInput) || null,
      clarifications: strategy?.clarifications || null,
      initiativeType: firstString(strategy?.understanding?.initiativeType) || null,
      constraintMode: decisionsContext?.constraintMode || null,
      programName: firstString(epmProgram?.programName) || null,
      whysPath: Array.isArray(strategy?.whysPath) ? strategy.whysPath : null,
      rootCause: firstString(strategy?.rootCause) || null,
      fiveWhysTree: strategy?.fiveWhysTree || null,
    }
  );

  const epmPath = path.join(outDir, 'epm.generated.json');
  const replaySummaryPath = path.join(outDir, 'replay-summary.json');
  await fs.writeFile(epmPath, JSON.stringify(epmPayload, null, 2), 'utf-8');

  const validator = new EPMPackageValidator();
  const validatorResult = validator.validate(epmPath);

  const assignmentsCsv = generateAssignmentsCsv(epmPayload.assignments || [], epmPayload.workstreams || []);
  const workstreamsCsv = generateWorkstreamsCsv(epmPayload.workstreams || []);
  const resourcesCsv = generateResourcesCsv(epmPayload.resourcePlan || {}, epmPayload.assignments || []);
  const risksCsv = generateRisksCsv(epmPayload.riskRegister || {});
  const benefitsCsv = generateBenefitsCsv(epmPayload.benefitsRealization || {});

  const acceptanceReport = validateExportAcceptance({
    strategyJson: strategyRaw,
    epmJson: JSON.stringify(epmPayload),
    assignmentsCsv,
    workstreamsCsv,
    resourcesCsv,
    risksCsv,
    benefitsCsv,
  });

  const strictScore = computeStrictScore(
    validatorResult.score,
    validatorResult.warnings.length,
    acceptanceReport.criticalIssues.length,
    acceptanceReport.warnings.length
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    input: { strategyPath, outDir },
    strictScore,
    validator: {
      passed: validatorResult.passed,
      score: validatorResult.score,
      criticalIssues: validatorResult.criticalIssues,
      warnings: validatorResult.warnings,
    },
    acceptance: acceptanceReport,
    quickMetrics: {
      workstreams: Array.isArray(epmPayload.workstreams) ? epmPayload.workstreams.length : 0,
      timelineMonths: epmPayload?.timeline?.totalMonths ?? null,
      totalBudget: epmPayload?.financialPlan?.totalBudget ?? null,
      stageGates: Array.isArray(epmPayload?.stageGates?.gates) ? epmPayload.stageGates.gates.length : 0,
    },
  };

  await fs.writeFile(replaySummaryPath, JSON.stringify(summary, null, 2), 'utf-8');

  console.log('\n[Replay] Output files:');
  console.log(`  - ${epmPath}`);
  console.log(`  - ${replaySummaryPath}`);
  console.log('\n[Replay] Summary:');
  console.log(`  - strictScore: ${strictScore}`);
  console.log(`  - validator passed: ${validatorResult.passed}`);
  console.log(`  - validator warnings: ${validatorResult.warnings.length}`);
  console.log(`  - acceptance passed: ${acceptanceReport.passed}`);
  console.log(`  - acceptance critical issues: ${acceptanceReport.criticalIssues.length}`);
  console.log(`  - acceptance warnings: ${acceptanceReport.warnings.length}`);

  if (!acceptanceReport.passed || !validatorResult.passed) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error('[Replay] Failed:', error);
  process.exit(1);
});
