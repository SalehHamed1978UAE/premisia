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

export type { ExportRequest, FullExportPackage, ExportResult, IExporter };

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
  if (understanding) {
    const metadata = typeof (understanding as any).strategyMetadata === 'string'
      ? JSON.parse((understanding as any).strategyMetadata)
      : (understanding as any).strategyMetadata;
    
    console.log('[Export Service] strategyMetadata keys:', metadata ? Object.keys(metadata) : 'null');
    
    let questions = null;
    let answers = null;
    
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
    
    if (questions && answers) {
      clarifications = {
        questions: Array.isArray(questions) ? questions : [],
        answers: typeof answers === 'object' ? answers : {},
      };
      console.log('[Export Service] Clarifications loaded:', clarifications.questions?.length || 0, 'questions');
    } else {
      console.log('[Export Service] No clarifications found. Questions:', !!questions, 'Answers:', !!answers);
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
    },
    epm: epmProgram ? {
      program: epmProgram,
      assignments,
    } : undefined,
  };
}
