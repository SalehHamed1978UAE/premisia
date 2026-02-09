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
  const latestVersion = versions.length > 0 ? versions[0] : null;
  const epmProgramRow = epmProgram.length > 0 ? epmProgram[0] : null;
  const detectedFrameworks: string[] = [];

  // For BMI journeys, extract detailed framework steps by detecting actual data
  if (session.journeyType === 'business_model_innovation') {
    // Step 1: Five Whys - detect by checking if data exists
    const fiveWhysRootCauses = (session.accumulatedContext as any)?.insights?.rootCauses;
    const fiveWhysFromAnalysis = latestVersion?.analysisData?.five_whys;

    if (fiveWhysRootCauses || fiveWhysFromAnalysis) {
      steps.push({
        stepName: 'five_whys',
        frameworkType: 'five_whys',
        expectedUrl: `/strategic-consultant/whys-tree/${session.id}`,
        responsePayload: {
          rootCauses: fiveWhysRootCauses,
          rootCause: fiveWhysFromAnalysis?.root_cause,
        },
        observations: 'Five Whys completed',
        completedAt: session.completedAt ?? latestVersion?.createdAt ?? undefined,
      });
      detectedFrameworks.push('five_whys');
    }

    // Step 2: BMC Research - detect by checking if data exists
    if (latestVersion?.analysisData?.bmc_research) {
      steps.push({
        stepName: 'bmc_research',
        frameworkType: 'bmc',
        expectedUrl: `/strategic-consultant/research/${session.id}`,
        responsePayload: {
          keyInsights: latestVersion.analysisData.bmc_research.keyInsights,
          criticalGaps: latestVersion.analysisData.bmc_research.criticalGaps,
        },
        observations: 'BMC research stream completed',
        completedAt: latestVersion.updatedAt ?? latestVersion.createdAt ?? undefined,
      });
      detectedFrameworks.push('bmc');
    }

    // Step 3: Strategic Decisions - detect by checking if data exists
    if (latestVersion?.decisionsData?.decisions?.length) {
      steps.push({
        stepName: 'strategic_decisions',
        expectedUrl: `/strategy-workspace/decisions/${session.id}/${latestVersion.versionNumber}`,
        responsePayload: latestVersion.decisionsData.decisions.map((d: any) => ({
          id: d.id,
          title: d.title,
          options: d.options?.length ?? 0,
        })),
        observations: 'Decisions generated and ready for prioritization',
      });
    }

    // Step 4: Prioritization - detect by checking if data exists
    if (latestVersion?.selectedDecisions) {
      steps.push({
        stepName: 'prioritization',
        expectedUrl: `/strategy-workspace/prioritization/${session.id}/${latestVersion.versionNumber}`,
        responsePayload: latestVersion.selectedDecisions,
        observations: 'Prioritized initiatives saved',
      });
    }

    // Step 5: EPM Program - detect by checking if data exists
    if (epmProgramRow) {
      steps.push({
        stepName: 'epm_generation',
        expectedUrl: `/strategy-workspace/epm/${epmProgramRow.id}`,
        responsePayload: {
          programId: epmProgramRow.id,
          status: epmProgramRow.status,
          workstreams: Array.isArray(epmProgramRow.workstreams)
            ? epmProgramRow.workstreams.length
            : 0,
        },
        observations: 'EPM program generated successfully',
        completedAt: epmProgramRow.createdAt ?? undefined,
      });
    }
  } else {
    // Fallback for other journey types - use generic framework-based steps
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
    if (latestVersion) {
      steps.push({
        stepName: 'strategy_version_created',
        responsePayload: {
          versionNumber: latestVersion.versionNumber,
          status: latestVersion.status,
        },
        completedAt: latestVersion.createdAt || undefined,
        observations: `Strategy version ${latestVersion.versionNumber} created`,
      });
    }

    // Add EPM generation step if exists
    if (epmProgramRow) {
      steps.push({
        stepName: 'epm_generated',
        responsePayload: {
          programId: epmProgramRow.id,
          status: epmProgramRow.status,
          workstreamCount: Array.isArray(epmProgramRow.workstreams) 
            ? epmProgramRow.workstreams.length 
            : 0,
        },
        completedAt: epmProgramRow.createdAt || undefined,
        observations: 'EPM program generated successfully',
      });
    }
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
      frameworks: detectedFrameworks.length > 0 ? detectedFrameworks : (session.completedFrameworks || []),
    },
  };
}

/**
 * Check if a session ID is in legacy format (session-TIMESTAMP-ID)
 */
function isLegacySessionId(sessionId: string): boolean {
  return sessionId.startsWith('session-') && /session-\d+-/.test(sessionId);
}

/**
 * Fetch legacy session data from strategic_understanding table
 */
async function fetchLegacySessionData(version: any): Promise<GoldenRecordData | null> {
  const [understanding] = await db
    .select()
    .from(strategicUnderstanding)
    .where(eq(strategicUnderstanding.sessionId, version.sessionId))
    .limit(1);
  
  if (!understanding) {
    console.error(`[Golden Records] Strategic understanding not found for legacy session: ${version.sessionId}`);
    return null;
  }

  const epmProgram = await db
    .select()
    .from(epmPrograms)
    .where(eq(epmPrograms.strategyVersionId, version.id))
    .limit(1);

  const epmProgramRow = epmProgram.length > 0 ? epmProgram[0] : null;

  const steps: GoldenRecordStep[] = [];
  const detectedFrameworks: string[] = [];

  const fiveWhysData = version.analysisData?.five_whys;
  if (fiveWhysData) {
    steps.push({
      stepName: 'five_whys',
      frameworkType: 'five_whys',
      expectedUrl: `/strategic-consultant/whys-tree/${version.sessionId}`,
      responsePayload: {
        rootCause: fiveWhysData.root_cause,
        whyLevels: fiveWhysData.why_levels,
      },
      observations: 'Five Whys completed',
      completedAt: version.createdAt ?? undefined,
    });
    detectedFrameworks.push('five_whys');
  }

  const bmcResearch = version.analysisData?.bmc_research;
  if (bmcResearch) {
    steps.push({
      stepName: 'bmc_research',
      frameworkType: 'bmc',
      expectedUrl: `/strategic-consultant/research/${version.sessionId}`,
      responsePayload: {
        keyInsights: bmcResearch.keyInsights,
        criticalGaps: bmcResearch.criticalGaps,
      },
      observations: 'BMC research stream completed',
      completedAt: version.updatedAt ?? version.createdAt ?? undefined,
    });
    detectedFrameworks.push('bmc');
  }

  if (version.decisionsData?.decisions?.length) {
    steps.push({
      stepName: 'strategic_decisions',
      expectedUrl: `/strategy-workspace/decisions/${version.sessionId}/${version.versionNumber}`,
      responsePayload: version.decisionsData.decisions.map((d: any) => ({
        id: d.id,
        title: d.title,
        options: d.options?.length ?? 0,
      })),
      observations: 'Decisions generated and ready for prioritization',
    });
  }

  if (version.selectedDecisions) {
    steps.push({
      stepName: 'prioritization',
      expectedUrl: `/strategy-workspace/prioritization/${version.sessionId}/${version.versionNumber}`,
      responsePayload: version.selectedDecisions,
      observations: 'Prioritized initiatives saved',
    });
  }

  if (epmProgramRow) {
    steps.push({
      stepName: 'epm_generation',
      expectedUrl: `/strategy-workspace/epm/${epmProgramRow.id}`,
      responsePayload: {
        programId: epmProgramRow.id,
        status: epmProgramRow.status,
        workstreams: Array.isArray(epmProgramRow.workstreams)
          ? epmProgramRow.workstreams.length
          : 0,
      },
      observations: 'EPM program generated successfully',
      completedAt: epmProgramRow.createdAt ?? undefined,
    });
  }

  return {
    journeyType: 'business_model_innovation',
    sessionId: version.sessionId,
    understandingId: understanding.id,
    versionNumber: version.versionNumber || 1,
    steps,
    metadata: {
      userInput: understanding.userInput,
      initiativeType: understanding.initiativeType || undefined,
      completedAt: version.finalizedAt || version.updatedAt || undefined,
      frameworks: detectedFrameworks,
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

  if (isLegacySessionId(version.sessionId)) {
    console.log(`[Golden Records] Detected legacy session ID: ${version.sessionId}`);
    return fetchLegacySessionData(version);
  }

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

/**
 * Push golden record data to Knowledge Graph (Neo4j)
 * This function is called AFTER successful JSON persistence
 * 
 * Feature-flagged: Only runs if FEATURE_KNOWLEDGE_GRAPH=true and Neo4j is configured
 * Non-blocking: Never throws errors that would break journey capture
 */
export async function pushGoldenRecordToKnowledgeGraph(
  data: GoldenRecordData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Import config functions and knowledge graph service
    const { isKnowledgeGraphEnabled, isNeo4jConfigured } = await import('../config');
    
    // Check feature flag and Neo4j configuration
    if (!isKnowledgeGraphEnabled()) {
      console.log('[KG] Knowledge Graph feature disabled (FEATURE_KNOWLEDGE_GRAPH not set)');
      return { success: false, error: 'Feature disabled' };
    }
    
    if (!isNeo4jConfigured()) {
      console.log('[KG] Neo4j not configured (missing NEO4J_URI or NEO4J_PASSWORD)');
      return { success: false, error: 'Neo4j not configured' };
    }
    
    console.log(`[KG] Pushing golden record to Knowledge Graph: ${data.journeyType} v${data.versionNumber}`);
    
    // Import knowledge graph service functions
    const kgService = await import('../services/knowledge-graph-service');
    
    // STEP 1: Upsert Journey Session
    await kgService.upsertJourneySession({
      id: data.sessionId,
      journeyType: data.journeyType,
      versionNumber: data.versionNumber,
      locationId: undefined, // TODO: Extract from metadata if available
      jurisdictionId: undefined, // TODO: Extract from metadata if available
      industryId: undefined, // TODO: Extract from metadata if available
      consentAggregate: false,
      consentPeerShare: false,
      consentModelTrain: false,
      createdAt: data.metadata.completedAt?.toISOString() || new Date().toISOString(),
    });
    console.log(`[KG] ✓ Journey session upserted: ${data.sessionId}`);
    
    // STEP 2: Upsert Framework Outputs (Five Whys, BMC, etc.)
    for (const step of data.steps) {
      if (step.frameworkType && step.responsePayload) {
        const frameworkId = `${data.sessionId}-${step.frameworkType}`;
        
        await kgService.upsertFrameworkOutput({
          id: frameworkId,
          journeyId: data.sessionId,
          stepId: step.stepName,
          framework: step.frameworkType,
          data: step.responsePayload,
          confidence: 0.85, // Default confidence
          createdAt: step.completedAt?.toISOString() || new Date().toISOString(),
        });
        console.log(`[KG] ✓ Framework output upserted: ${step.frameworkType}`);
      }
    }
    
    // STEP 3: Upsert Decisions and Decision Options
    const decisionsStep = data.steps.find(s => s.stepName === 'strategic_decisions');
    if (decisionsStep?.responsePayload && Array.isArray(decisionsStep.responsePayload)) {
      for (const decision of decisionsStep.responsePayload) {
        const decisionId = decision.id || `${data.sessionId}-decision-${decision.title}`;
        
        // Upsert decision node
        await kgService.upsertDecision({
          id: decisionId,
          journeyId: data.sessionId,
          question: decision.title || 'Strategic Decision',
          selectedOptionId: undefined,
          createdAt: new Date().toISOString(),
        });
        console.log(`[KG] ✓ Decision upserted: ${decisionId}`);
        
        // Upsert decision options if available
        if (decision.options && Array.isArray(decision.options)) {
          const options = decision.options.map((opt: any, idx: number) => ({
            id: opt.id || `${decisionId}-option-${idx}`,
            decisionId,
            label: opt.label || opt.title || `Option ${idx + 1}`,
            isSelected: false,
            estimatedCost: opt.estimated_cost?.min,
            estimatedTimeline: opt.estimated_timeline_months?.toString(),
          }));
          
          await kgService.upsertDecisionOptions(options);
          console.log(`[KG] ✓ Decision options upserted: ${options.length} options`);
        }
      }
    }
    
    // STEP 4: Upsert EPM Program
    const epmStep = data.steps.find(s => s.stepName === 'epm_generation' || s.stepName === 'epm_generated');
    if (epmStep?.responsePayload?.programId) {
      await kgService.upsertProgram({
        id: epmStep.responsePayload.programId,
        journeyId: data.sessionId,
        status: epmStep.responsePayload.status || 'draft',
        workstreamCount: epmStep.responsePayload.workstreams || 0,
        timelineMonths: undefined,
        budget: undefined,
        locationId: undefined,
        createdAt: epmStep.completedAt?.toISOString() || new Date().toISOString(),
      });
      console.log(`[KG] ✓ EPM program upserted: ${epmStep.responsePayload.programId}`);
    }
    
    // STEP 5: Create Evidence Links (research citations)
    // Note: This would require extracting research references from the BMC research step
    // For now, we'll skip this as it requires more detailed research data extraction
    console.log('[KG] ⚠ Evidence links not yet implemented (requires research reference extraction)');
    
    // STEP 6 & 7: Link to Incentives and Regulations
    // These would require jurisdiction/industry context from the journey
    // For now, we'll skip these as they require ETL data to be loaded
    console.log('[KG] ⚠ Incentive/regulation linking not yet implemented (requires jurisdiction/industry context)');
    
    console.log(`[KG] ✅ Golden record pushed successfully to Knowledge Graph`);
    return { success: true };
    
  } catch (error: any) {
    // Log error but don't throw - golden record capture should succeed even if KG fails
    console.error('[KG] ❌ Error pushing to Knowledge Graph:', error.message);
    console.error('[KG] Stack:', error.stack);
    return { success: false, error: error.message };
  }
}
