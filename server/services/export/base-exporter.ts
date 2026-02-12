import { getStrategicUnderstandingBySession } from '../secure-data-service';
import { db } from '../../db';
import { storage } from '../../storage';
import {
  journeySessions,
  epmPrograms,
  taskAssignments,
  strategyDecisions,
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { IExporter, ExportResult, FullExportPackage, ExportRequest } from '../../types/interfaces';
import { buildLinearWhysTree, normalizeWhysPathSteps } from '../../utils/whys-path';
import { ambiguityDetector } from '../ambiguity-detector';

export type { ExportRequest, FullExportPackage, ExportResult, IExporter };

function extractClarificationFallback(understanding: any): { lines: string[]; conflicts: string[] } {
  const lines: string[] = [];
  const conflicts: string[] = [];

  const metadata = typeof understanding?.strategyMetadata === 'string'
    ? (() => {
        try { return JSON.parse(understanding.strategyMetadata); } catch { return null; }
      })()
    : understanding?.strategyMetadata;
  if (metadata?.clarificationConflicts && Array.isArray(metadata.clarificationConflicts)) {
    metadata.clarificationConflicts.forEach((item: any) => {
      if (typeof item === 'string' && item.trim()) {
        conflicts.push(item.trim());
      }
    });
  }

  const companyContext = typeof understanding?.companyContext === 'string'
    ? (() => {
        try { return JSON.parse(understanding.companyContext); } catch { return null; }
      })()
    : understanding?.companyContext;

  if (companyContext?.clarifications && typeof companyContext.clarifications === 'object') {
    Object.values(companyContext.clarifications).forEach((value) => {
      if (typeof value === 'string' && value.trim()) {
        lines.push(value.trim());
      }
    });
  }

  const inputText = typeof understanding?.userInput === 'string' ? understanding.userInput : '';
  const inputLines = extractBulletBlock(inputText, /^clarifications:/i);
  inputLines.forEach((line) => lines.push(line));
  const conflictLines = extractBulletBlock(inputText, /^clarification_conflicts:/i);
  conflictLines.forEach((line) => conflicts.push(line));

  return { lines, conflicts };
}

export abstract class BaseExporter implements IExporter {
  abstract readonly name: string;
  abstract readonly format: string;
  abstract readonly mimeType: string;

  abstract export(pkg: FullExportPackage): Promise<ExportResult>;

  isAvailable(): boolean {
    return true;
  }

  protected parseField(field: any): any {
    if (!field) return null;
    if (typeof field === 'object') return field;
    try {
      return JSON.parse(field);
    } catch (err) {
      console.warn('[Export] Failed to parse JSONB field:', err);
      return null;
    }
  }
}

export function escapeCsvField(field: string | null | undefined): string {
  if (field === null || field === undefined) {
    return '';
  }
  const str = field.toString();
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseInlineBullets(value: string): string[] {
  if (!value) {
    return [];
  }
  const parts = value.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [value.trim()];
}

function extractBulletBlock(inputText: string, headerRegex: RegExp): string[] {
  if (!inputText) {
    return [];
  }
  const lines = inputText.split('\n');
  const collected: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (headerRegex.test(trimmed)) {
      inBlock = true;
      const afterHeader = trimmed.replace(headerRegex, '').trim();
      if (afterHeader) {
        collected.push(...parseInlineBullets(afterHeader));
      }
      continue;
    }

    if (!inBlock) {
      continue;
    }

    if (trimmed === '') {
      continue;
    }

    if (/^[A-Z_][A-Z0-9_ ]*:\s*$/i.test(trimmed)) {
      inBlock = false;
      continue;
    }

    if (/^\s*-\s+/.test(trimmed)) {
      collected.push(trimmed.replace(/^\s*-\s+/, '').trim());
      continue;
    }

    inBlock = false;
  }

  return collected.filter(Boolean);
}

function extractClarificationFallbackFromText(inputText: string): { lines: string[]; conflicts: string[] } {
  const lines = extractBulletBlock(inputText, /^clarifications:/i);
  const conflicts = extractBulletBlock(inputText, /^clarification_conflicts:/i);
  // Also extract mid-line inline clarifications
  const inlineLines = extractInlineClarifications(inputText);
  inlineLines.forEach((l) => { if (!lines.includes(l)) lines.push(l); });
  return { lines, conflicts };
}

function extractInlineClarifications(inputText: string): string[] {
  if (!inputText) return [];
  const collected: string[] = [];
  const lines = inputText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip lines that START with CLARIFICATIONS: (handled by extractBulletBlock)
    if (/^clarifications:/i.test(trimmed)) continue;
    // Look for mid-line CLARIFICATIONS: (e.g., "...text CLARIFICATIONS: We want...")
    const match = trimmed.match(/\bCLARIFICATIONS:\s*(.+)/i);
    if (match && match[1]) {
      const inlineText = match[1].trim();
      const sentences = inlineText.split(/\.\s+/).map((s) => s.trim().replace(/\.$/, '')).filter(Boolean);
      sentences.forEach((s) => collected.push(s));
    }
  }
  return collected;
}

export async function loadExportData(
  sessionId: string,
  versionNumber: number | undefined,
  programId: string | undefined,
  userId: string
): Promise<FullExportPackage> {
  console.log('[Export Service] loadExportData - Loading strategic understanding for sessionId:', sessionId);
  const understanding = await getStrategicUnderstandingBySession(sessionId);
  console.log('[Export Service] loadExportData - Understanding loaded:', understanding ? 'Yes' : 'No');
  
  if (understanding?.userInput) {
    const isEncrypted = understanding.userInput.includes(':') && understanding.userInput.split(':').length === 3;
    console.log('[Export Service] userInput encryption status:', {
      isEncrypted,
      firstChars: understanding.userInput.substring(0, 50),
      length: understanding.userInput.length
    });
  }

  console.log('[Export Service] loadExportData - Loading journey session...');
  const [journeySession] = await db.select()
    .from(journeySessions)
    .where(eq(journeySessions.understandingId, understanding?.id || sessionId))
    .limit(1);
  console.log('[Export Service] loadExportData - Journey session loaded:', journeySession ? 'Yes' : 'No');

  console.log('[Export Service] loadExportData - Loading strategy version. Requested version:', versionNumber);
  let strategyVersion;
  if (versionNumber !== undefined) {
    strategyVersion = await storage.getStrategyVersion(sessionId, versionNumber);
    console.log('[Export Service] loadExportData - Loaded specific version:', versionNumber);
  } else {
    const versions = await storage.getStrategyVersionsBySession(sessionId);
    strategyVersion = versions[0];
    console.log('[Export Service] loadExportData - Loaded latest version:', strategyVersion?.versionNumber);
  }

  let epmProgram;
  let assignments: any[] = [];
  
  if (programId) {
    [epmProgram] = await db.select()
      .from(epmPrograms)
      .where(eq(epmPrograms.id, programId))
      .limit(1);

    if (epmProgram) {
      assignments = await db.select()
        .from(taskAssignments)
        .where(eq(taskAssignments.epmProgramId, programId));
    }
  }

  if (assignments.length > 0) {
    assignments = assignments.map(a => ({
      ...a,
      owner: a.owner || a.resourceName || a.resourceRole || null,
    }));
  }

  console.log('[Export Service] loadExportData - Using canonical Five Whys from analysisData...');
  let fiveWhysTree: any;
  let whysPath: Array<{ question: string; answer: string }> = [];
  if (strategyVersion?.analysisData) {
    const analysisData = typeof strategyVersion.analysisData === 'string'
      ? JSON.parse(strategyVersion.analysisData as any)
      : strategyVersion.analysisData;
    const fiveWhys = analysisData?.five_whys || analysisData?.fiveWhys;
    if (fiveWhys?.whysPath && Array.isArray(fiveWhys.whysPath)) {
      whysPath = normalizeWhysPathSteps(fiveWhys.whysPath);
      console.log('[Export Service] Five Whys path loaded from analysisData:', whysPath.length);
    } else {
      whysPath = [];
    }
    if (fiveWhys?.tree) {
      fiveWhysTree = fiveWhys.tree;
    } else if (whysPath.length > 0) {
      fiveWhysTree = buildLinearWhysTree(whysPath);
    }
  }

  console.log('[Export Service] loadExportData - Fetching clarifications from strategic understanding...');
  let clarifications;
  let requiresApproval;
  if (understanding) {
    const fallback = extractClarificationFallbackFromText(understanding.userInput || '');
    const metadata = typeof (understanding as any).strategyMetadata === 'string'
      ? JSON.parse((understanding as any).strategyMetadata)
      : (understanding as any).strategyMetadata;
    
    console.log('[Export Service] strategyMetadata keys:', metadata ? Object.keys(metadata) : 'null');
    
    let questions = null;
    let answers = null;
    let conflicts: string[] = [];
    
    if (metadata?.clarificationQuestions) {
      questions = metadata.clarificationQuestions;
      console.log('[Export Service] Found clarificationQuestions in metadata');
    }
    
    if (!questions && metadata?.clarificationContext?.questions) {
      questions = metadata.clarificationContext.questions;
      console.log('[Export Service] Found clarificationContext.questions in metadata');
    }
    
    if (!questions && metadata?.questions) {
      questions = metadata.questions;
      console.log('[Export Service] Found questions in metadata');
    }
    
    if (metadata?.clarificationsProvided) {
      answers = metadata.clarificationsProvided;
      console.log('[Export Service] Found clarificationsProvided');
    } else if (metadata?.clarificationContext?.answers) {
      answers = metadata.clarificationContext.answers;
      console.log('[Export Service] Found clarificationContext.answers');
    } else if (metadata?.answers) {
      answers = metadata.answers;
      console.log('[Export Service] Found answers');
    }

    if (Array.isArray(metadata?.clarificationConflicts)) {
      conflicts = metadata.clarificationConflicts;
    } else if (Array.isArray(metadata?.clarificationContext?.conflicts)) {
      conflicts = metadata.clarificationContext.conflicts;
    } else if (fallback.conflicts.length > 0) {
      conflicts = fallback.conflicts;
    }

    // Export-time conflict detection: if no conflicts from metadata, scan full text
    if (conflicts.length === 0 && fallback.lines.length > 0) {
      const detected = ambiguityDetector.detectClarificationConflicts(fallback.lines);
      if (detected.length > 0) {
        conflicts = detected;
        console.log('[Export Service] Detected conflicts from clarification lines:', detected.length);
      }
    }

    if (metadata?.requiresApproval) {
      if (typeof metadata.requiresApproval === 'object') {
        requiresApproval = { ...metadata.requiresApproval };
      } else {
        // Convert legacy boolean to object form
        requiresApproval = {};
      }
    }
    if (conflicts.length > 0) {
      requiresApproval = { ...(requiresApproval || {}), clarifications: true };
    }
    
    if (questions && answers) {
      clarifications = {
        questions: Array.isArray(questions) ? questions : [],
        answers: typeof answers === 'object' ? answers : {},
        lines: fallback.lines.length > 0 ? fallback.lines : undefined,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
      };
      console.log('[Export Service] Clarifications loaded:', clarifications.questions?.length || 0, 'questions');
    } else if (conflicts.length > 0 || fallback.lines.length > 0) {
      clarifications = {
        lines: fallback.lines.length > 0 ? fallback.lines : undefined,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
      };
      console.log('[Export Service] Clarification conflicts loaded without questions:', conflicts.length);
    } else {
      const fallback = extractClarificationFallback(understanding);
      if (fallback.lines.length > 0 || fallback.conflicts.length > 0) {
        clarifications = {
          lines: fallback.lines,
          conflicts: fallback.conflicts.length > 0 ? fallback.conflicts : undefined,
        };
        console.log('[Export Service] Clarifications loaded from fallback:', fallback.lines.length);
      } else {
        console.log('[Export Service] No clarifications found. Questions:', !!questions, 'Answers:', !!answers);
      }
    }
  }

  // Fetch strategic decisions from strategy_decisions table
  console.log('[Export Service] loadExportData - Fetching strategic decisions...');
  let decisions: any[] = [];
  if (strategyVersion?.id) {
    const decisionRows = await db.select()
      .from(strategyDecisions)
      .where(eq(strategyDecisions.strategyVersionId, strategyVersion.id))
      .orderBy(desc(strategyDecisions.createdAt));
    
    decisions = decisionRows.map(d => ({
      id: d.id,
      primaryCustomerSegment: d.primaryCustomerSegment,
      revenueModel: d.revenueModel,
      channelPriorities: d.channelPriorities,
      partnershipStrategy: d.partnershipStrategy,
      riskTolerance: d.riskTolerance,
      investmentCapacityMin: d.investmentCapacityMin,
      investmentCapacityMax: d.investmentCapacityMax,
      timelinePreference: d.timelinePreference,
      successMetricsPriority: d.successMetricsPriority,
      validatedAssumptions: d.validatedAssumptions,
      concerns: d.concerns,
      topPriorities: d.topPriorities,
      goDecision: d.goDecision,
      decisionRationale: d.decisionRationale,
      createdAt: d.createdAt,
    }));
    console.log('[Export Service] Strategic decisions loaded:', decisions.length);
  }

  // Fallback: use decisionsData from strategyVersion if no decisions persisted
  if (decisions.length === 0 && strategyVersion?.decisionsData) {
    const decisionsData = typeof strategyVersion.decisionsData === 'string'
      ? JSON.parse(strategyVersion.decisionsData as any)
      : strategyVersion.decisionsData;
    const rawDecisions = Array.isArray(decisionsData?.decisions) ? decisionsData.decisions : [];
    if (rawDecisions.length > 0) {
      decisions = rawDecisions.map((d: any, idx: number) => {
        const recommended = Array.isArray(d.options) ? d.options.find((o: any) => o.recommended) : null;
        return {
          id: d.id || `decision_${idx + 1}`,
          type: d.title || d.question || 'Decision',
          value: recommended?.label || (d.options && d.options[0]?.label) || d.title || 'Not specified',
          rationale: recommended?.reasoning || d.context || '',
          options: d.options || [],
          question: d.question || '',
        };
      });
      console.log('[Export Service] Strategic decisions loaded from decisionsData:', decisions.length);
    }
  }

  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      sessionId,
      versionNumber: versionNumber ?? strategyVersion?.versionNumber,
      programId,
      exportedBy: userId,
    },
    strategy: {
      understanding,
      journeySession,
      strategyVersion,
      decisions,
      fiveWhysTree,
      whysPath,
      clarifications,
      requiresApproval,
    },
    epm: epmProgram ? {
      program: epmProgram,
      assignments,
    } : undefined,
  };
}
