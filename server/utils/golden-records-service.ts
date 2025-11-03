import { db } from '../db';
import { journeySessions, strategyVersions, strategicUnderstanding, epmPrograms } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getJourneySession, getStrategicUnderstanding } from '../services/secure-data-service';
import { sanitizeGoldenRecordStep } from './golden-record-sanitizer';
import type { JourneyType } from '@shared/journey-types';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Golden Records Service
 * Shared utilities for capturing, comparing, and managing golden records
 */

export interface GoldenRecordStep {
  stepName: string;
  frameworkType?: string;
  expectedUrl?: string;
  screenshotPath?: string;
  requestPayload?: any;
  responsePayload?: any;
  dbSnapshot?: any;
  observations?: string;
  completedAt?: Date;
}

export interface GoldenRecordData {
  journeyType: JourneyType;
  sessionId: string;
  understandingId: string;
  versionNumber: number;
  steps: GoldenRecordStep[];
  metadata: {
    userInput?: string;
    initiativeType?: string;
    completedAt?: Date;
    frameworks?: string[];
  };
}

/**
 * Fetch journey session data for golden record capture
 */
export async function fetchJourneySessionData(sessionId: string): Promise<GoldenRecordData | null> {
  const session = await getJourneySession(sessionId);
  
  if (!session || !session.id || !session.understandingId) {
    console.error(`[Golden Records] Journey session not found or missing understandingId: ${sessionId}`);
    return null;
  }

  // Fetch the strategic understanding
  const understanding = await getStrategicUnderstanding(session.understandingId);
  
  if (!understanding) {
    console.error(`[Golden Records] Strategic understanding not found: ${session.understandingId}`);
    return null;
  }

  // Fetch strategy versions linked to this session
  const versions = await db
    .select()
    .from(strategyVersions)
    .where(eq(strategyVersions.sessionId, sessionId))
    .orderBy(desc(strategyVersions.versionNumber));

  // Fetch EPM program if exists
  const epmProgram = versions.length > 0 
    ? await db
        .select()
        .from(epmPrograms)
        .where(eq(epmPrograms.strategyVersionId, versions[0].id))
        .limit(1)
    : [];

  // Build steps from journey data
  const steps: GoldenRecordStep[] = [];
  
  // Add framework steps based on completed frameworks
  if (session.completedFrameworks && session.completedFrameworks.length > 0) {
    for (const framework of session.completedFrameworks) {
      steps.push({
        stepName: `${framework}_analysis`,
        frameworkType: framework,
        completedAt: session.completedAt || undefined,
        observations: `Completed ${framework} framework analysis`,
      });
    }
  }

  // Add strategy version step if exists
  if (versions.length > 0) {
    steps.push({
      stepName: 'strategy_version_created',
      responsePayload: {
        versionNumber: versions[0].versionNumber,
        status: versions[0].status,
      },
      completedAt: versions[0].createdAt || undefined,
      observations: `Strategy version ${versions[0].versionNumber} created`,
    });
  }

  // Add EPM generation step if exists
  if (epmProgram.length > 0) {
    steps.push({
      stepName: 'epm_generated',
      responsePayload: {
        programId: epmProgram[0].id,
        status: epmProgram[0].status,
        workstreamCount: Array.isArray(epmProgram[0].workstreams) 
          ? epmProgram[0].workstreams.length 
          : 0,
      },
      completedAt: epmProgram[0].createdAt || undefined,
      observations: 'EPM program generated successfully',
    });
  }

  return {
    journeyType: session.journeyType as JourneyType,
    sessionId: session.id,
    understandingId: session.understandingId,
    versionNumber: session.versionNumber || 1,
    steps,
    metadata: {
      userInput: understanding.userInput,
      initiativeType: understanding.initiativeType || undefined,
      completedAt: session.completedAt || undefined,
      frameworks: session.completedFrameworks || [],
    },
  };
}

/**
 * Fetch strategy version data for golden record capture
 */
export async function fetchStrategyVersionData(strategyVersionId: string): Promise<GoldenRecordData | null> {
  const [version] = await db
    .select()
    .from(strategyVersions)
    .where(eq(strategyVersions.id, strategyVersionId))
    .limit(1);
  
  if (!version) {
    console.error(`[Golden Records] Strategy version not found: ${strategyVersionId}`);
    return null;
  }

  // Fetch the journey session
  return fetchJourneySessionData(version.sessionId);
}

/**
 * Sanitize golden record data before storage
 */
export async function sanitizeGoldenRecordData(data: GoldenRecordData): Promise<GoldenRecordData> {
  const sanitizedSteps = await Promise.all(
    data.steps.map(step => sanitizeGoldenRecordStep(step))
  );

  return {
    ...data,
    steps: sanitizedSteps,
    metadata: {
      ...data.metadata,
      // Remove sensitive user input, keep only summary info
      userInput: undefined,
    },
  };
}

/**
 * Save golden record to local file system
 */
export async function saveGoldenRecordToFile(
  data: GoldenRecordData,
  notes?: string
): Promise<string> {
  const outputDir = join(process.cwd(), 'scripts', 'output', 'golden-records', data.journeyType);
  
  // Create directory if it doesn't exist
  await mkdir(outputDir, { recursive: true });

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `v${data.versionNumber}_${timestamp}.json`;
  const filepath = join(outputDir, filename);

  // Prepare output data
  const output = {
    ...data,
    notes,
    capturedAt: new Date().toISOString(),
  };

  // Write to file
  await writeFile(filepath, JSON.stringify(output, null, 2), 'utf-8');
  
  console.log(`[Golden Records] Saved to: ${filepath}`);
  return filepath;
}

/**
 * Compare two golden record steps
 */
export function compareSteps(step1: GoldenRecordStep, step2: GoldenRecordStep): {
  match: boolean;
  differences: string[];
} {
  const differences: string[] = [];

  if (step1.stepName !== step2.stepName) {
    differences.push(`Step name mismatch: "${step1.stepName}" vs "${step2.stepName}"`);
  }

  if (step1.frameworkType !== step2.frameworkType) {
    differences.push(`Framework type mismatch: "${step1.frameworkType}" vs "${step2.frameworkType}"`);
  }

  // Compare response payloads structurally (ignoring dynamic values like IDs and timestamps)
  if (step1.responsePayload && step2.responsePayload) {
    const keys1 = Object.keys(step1.responsePayload);
    const keys2 = Object.keys(step2.responsePayload);
    
    const missingKeys = keys1.filter(k => !keys2.includes(k));
    const extraKeys = keys2.filter(k => !keys1.includes(k));
    
    if (missingKeys.length > 0) {
      differences.push(`Missing keys in step2: ${missingKeys.join(', ')}`);
    }
    
    if (extraKeys.length > 0) {
      differences.push(`Extra keys in step2: ${extraKeys.join(', ')}`);
    }
  } else if (step1.responsePayload || step2.responsePayload) {
    differences.push('Response payload presence mismatch');
  }

  return {
    match: differences.length === 0,
    differences,
  };
}

/**
 * Generate diff summary between two golden records
 */
export function generateDiffSummary(
  baseline: GoldenRecordData,
  current: GoldenRecordData
): {
  match: boolean;
  added: string[];
  removed: string[];
  modified: Array<{ step: string; differences: string[] }>;
  summary: string;
} {
  const baselineSteps = baseline.steps.map(s => s.stepName);
  const currentSteps = current.steps.map(s => s.stepName);

  const added = currentSteps.filter(s => !baselineSteps.includes(s));
  const removed = baselineSteps.filter(s => !currentSteps.includes(s));
  const modified: Array<{ step: string; differences: string[] }> = [];

  // Compare common steps
  const commonSteps = baselineSteps.filter(s => currentSteps.includes(s));
  
  for (const stepName of commonSteps) {
    const step1 = baseline.steps.find(s => s.stepName === stepName)!;
    const step2 = current.steps.find(s => s.stepName === stepName)!;
    
    const comparison = compareSteps(step1, step2);
    
    if (!comparison.match) {
      modified.push({
        step: stepName,
        differences: comparison.differences,
      });
    }
  }

  const match = added.length === 0 && removed.length === 0 && modified.length === 0;

  let summary = match 
    ? '✓ Journey matches golden record' 
    : '✗ Journey differs from golden record';

  if (!match) {
    summary += '\n';
    if (added.length > 0) {
      summary += `\n  Added steps: ${added.join(', ')}`;
    }
    if (removed.length > 0) {
      summary += `\n  Removed steps: ${removed.length}`;
    }
    if (modified.length > 0) {
      summary += `\n  Modified steps: ${modified.map(m => m.step).join(', ')}`;
    }
  }

  return {
    match,
    added,
    removed,
    modified,
    summary,
  };
}

/**
 * Prepare golden record data for admin API storage
 */
export function prepareGoldenRecordForAPI(
  data: GoldenRecordData,
  notes?: string,
  promoteAsCurrent: boolean = false,
  parentVersion?: number
): {
  journeyType: JourneyType;
  notes?: string;
  steps: any[];
  metadata: any;
  promoteAsCurrent: boolean;
  parentVersion?: number;
} {
  return {
    journeyType: data.journeyType,
    notes,
    steps: data.steps,
    metadata: {
      ...data.metadata,
      versionNumber: data.versionNumber,
      sessionId: data.sessionId,
      understandingId: data.understandingId,
    },
    promoteAsCurrent,
    parentVersion,
  };
}
