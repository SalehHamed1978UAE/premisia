/**
 * Canonical Five Whys Service
 *
 * This service ensures there is ONE authoritative Five Whys artifact
 * that all systems read from and write to.
 *
 * PRINCIPLE: Single Source of Truth
 * - No more tree in one place, path in another
 * - No more reconciliation needed
 * - Everything lives together
 */

import { db } from '../../db';
import { strategyVersions, frameworkInsights } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { FiveWhysResult, StrategicFocus } from '../schemas/five-whys-result';

export interface CanonicalFiveWhys {
  // Core Five Whys data
  problemStatement: string;
  tree: any; // Full tree with chosen path marked
  chosenPath: string[]; // User-selected path
  rootCause: string;
  strategicImplications: string[];
  recommendedActions: string[];

  // Strategic focus for BMC
  strategicFocus: StrategicFocus;

  // Summary for downstream use
  summary: string;

  // Metadata
  metadata: {
    generatedAt: string;
    finalizedAt?: string;
    treeVersion: number;
    isFinalized: boolean;
    confidence: number;
  };
}

/**
 * Create the canonical Five Whys artifact when user finalizes
 * This becomes THE source of truth
 */
export async function createCanonicalArtifact(
  sessionId: string,
  versionNumber: number,
  input: string,
  tree: any,
  chosenPath: string[],
  rootCause: string,
  strategicImplications: string[],
  recommendedActions: string[],
  strategicFocus: StrategicFocus
): Promise<CanonicalFiveWhys> {

  // Mark the chosen path in the tree
  const markedTree = markChosenPathInTree(tree, chosenPath);

  // Generate summary from chosen path
  const summary = generateSummary(chosenPath, rootCause, strategicImplications);

  // Create the canonical artifact
  const canonical: CanonicalFiveWhys = {
    problemStatement: input,
    tree: markedTree,
    chosenPath,
    rootCause,
    strategicImplications,
    recommendedActions,
    strategicFocus,
    summary,
    metadata: {
      generatedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
      treeVersion: 1,
      isFinalized: true,
      confidence: calculateConfidence(chosenPath, strategicImplications)
    }
  };

  // Store in analysisData as THE canonical source
  await storeCanonicalArtifact(sessionId, versionNumber, canonical);

  return canonical;
}

/**
 * Store the canonical artifact as the single source of truth
 */
async function storeCanonicalArtifact(
  sessionId: string,
  versionNumber: number,
  canonical: CanonicalFiveWhys
): Promise<void> {

  // Get the strategy version
  const [version] = await db
    .select()
    .from(strategyVersions)
    .where(and(
      eq(strategyVersions.sessionId, sessionId),
      eq(strategyVersions.versionNumber, versionNumber)
    ))
    .limit(1);

  if (!version) {
    throw new Error(`Strategy version ${versionNumber} not found for session ${sessionId}`);
  }

  // Get existing analysis data
  const existingData = typeof version.analysisData === 'string'
    ? JSON.parse(version.analysisData as any)
    : version.analysisData || {};

  // Store the canonical artifact
  const updatedData = {
    ...existingData,
    five_whys_canonical: canonical, // THE canonical source
    // Keep backward compatibility
    five_whys: {
      problem_statement: canonical.problemStatement,
      tree: canonical.tree,
      whysPath: canonical.chosenPath,
      root_cause: canonical.rootCause,
      strategic_implications: canonical.strategicImplications,
      recommendedActions: canonical.recommendedActions,
      strategicFocus: canonical.strategicFocus,
      summary: canonical.summary
    }
  };

  // Update the strategy version
  await db.update(strategyVersions)
    .set({
      analysisData: updatedData,
      updatedAt: new Date()
    })
    .where(eq(strategyVersions.id, version.id));

  console.log('[Canonical Five Whys] Stored canonical artifact for session', sessionId);
}

/**
 * Retrieve the canonical Five Whys artifact
 * This is the ONLY function that should be used to get Five Whys data
 */
export async function getCanonicalArtifact(
  sessionId: string
): Promise<CanonicalFiveWhys | null> {

  // Get the latest version
  const [version] = await db
    .select()
    .from(strategyVersions)
    .where(and(
      eq(strategyVersions.sessionId, sessionId),
      eq(strategyVersions.status, 'active')
    ))
    .orderBy(desc(strategyVersions.versionNumber))
    .limit(1);

  if (!version?.analysisData) {
    return null;
  }

  const data = typeof version.analysisData === 'string'
    ? JSON.parse(version.analysisData as any)
    : version.analysisData;

  // Check for canonical artifact first
  if (data.five_whys_canonical) {
    return data.five_whys_canonical;
  }

  // Fallback to legacy format and convert
  if (data.five_whys) {
    return convertLegacyToCanonical(data.five_whys);
  }

  return null;
}

/**
 * Mark the chosen path in the tree
 */
function markChosenPathInTree(tree: any, chosenPath: string[]): any {
  if (!tree || !chosenPath || chosenPath.length === 0) {
    return tree;
  }

  // Deep clone the tree
  const markedTree = JSON.parse(JSON.stringify(tree));

  // Normalize text for matching
  const normalizeText = (text: string): string => {
    return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  };

  const normalizedPath = chosenPath.map(step => normalizeText(step));

  // Mark nodes recursively
  const markNode = (node: any, depth: number): boolean => {
    if (!node || depth >= normalizedPath.length) return false;

    const nodeText = normalizeText(
      node.option || node.answer || node.label || node.question || ''
    );

    const pathStep = normalizedPath[depth];
    const isMatch = nodeText.length > 0 && (
      nodeText === pathStep ||
      nodeText.includes(pathStep) ||
      pathStep.includes(nodeText)
    );

    if (isMatch) {
      node.isChosen = true;
      node.chosenDepth = depth;

      if (Array.isArray(node.branches)) {
        for (const branch of node.branches) {
          if (markNode(branch, depth + 1)) {
            return true;
          }
        }
      }
      return true;
    }

    return false;
  };

  // Start marking from root
  if (Array.isArray(markedTree.branches)) {
    for (const branch of markedTree.branches) {
      markNode(branch, 0);
    }
  }

  return markedTree;
}

/**
 * Generate a 1-2 sentence summary from the chosen path
 */
function generateSummary(
  chosenPath: string[],
  rootCause: string,
  strategicImplications: string[]
): string {

  // Extract key elements
  const firstWhy = chosenPath[0] || '';
  const coreInsight = strategicImplications[0] || '';

  // Create a concise summary
  if (rootCause && coreInsight) {
    return `Root cause analysis reveals that ${rootCause.toLowerCase()}, which means ${coreInsight.toLowerCase()}.`;
  } else if (rootCause) {
    return `The fundamental issue is ${rootCause.toLowerCase()}, requiring targeted solutions at this level.`;
  } else if (chosenPath.length > 0) {
    return `Analysis traces from "${firstWhy}" through ${chosenPath.length} levels to identify core constraints.`;
  } else {
    return 'Five Whys analysis completed to identify root causes and strategic implications.';
  }
}

/**
 * Calculate confidence score based on path depth and implications
 */
function calculateConfidence(
  chosenPath: string[],
  strategicImplications: string[]
): number {

  let confidence = 0.5; // Base confidence

  // Add confidence for path depth (deeper = more thorough)
  confidence += Math.min(0.3, chosenPath.length * 0.06);

  // Add confidence for strategic implications
  confidence += Math.min(0.2, strategicImplications.length * 0.05);

  return Math.min(1.0, confidence);
}

/**
 * Convert legacy Five Whys format to canonical
 */
function convertLegacyToCanonical(legacy: any): CanonicalFiveWhys {
  return {
    problemStatement: legacy.problem_statement || '',
    tree: legacy.tree || { branches: [] },
    chosenPath: legacy.whysPath || [],
    rootCause: legacy.root_cause || '',
    strategicImplications: legacy.strategic_implications || [],
    recommendedActions: legacy.recommendedActions || [],
    strategicFocus: legacy.strategicFocus || {
      problemStatement: '',
      constraints: [],
      successMetrics: [],
      researchPriorities: {
        customerSegments: [],
        channels: [],
        valuePropositions: []
      }
    },
    summary: legacy.summary || '',
    metadata: {
      generatedAt: new Date().toISOString(),
      finalizedAt: undefined,
      treeVersion: 1,
      isFinalized: false,
      confidence: 0.5
    }
  };
}

/**
 * Update canonical artifact with user edits
 */
export async function updateCanonicalArtifact(
  sessionId: string,
  updates: Partial<CanonicalFiveWhys>
): Promise<void> {

  const existing = await getCanonicalArtifact(sessionId);
  if (!existing) {
    throw new Error('No canonical Five Whys artifact found to update');
  }

  const updated = {
    ...existing,
    ...updates,
    metadata: {
      ...existing.metadata,
      ...updates.metadata,
      finalizedAt: new Date().toISOString()
    }
  };

  // Store the update
  const [version] = await db
    .select()
    .from(strategyVersions)
    .where(and(
      eq(strategyVersions.sessionId, sessionId),
      eq(strategyVersions.status, 'active')
    ))
    .orderBy(desc(strategyVersions.versionNumber))
    .limit(1);

  if (version) {
    await storeCanonicalArtifact(sessionId, version.versionNumber, updated);
  }
}