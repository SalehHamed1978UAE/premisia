import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { WhysTreeGenerator } from '../../strategic-consultant-legacy/whys-tree-generator';

/**
 * Five Whys Framework Executor
 *
 * CRITICAL: This executor ONLY returns user-finalized data.
 * It NEVER generates fake paths (Source B eliminated).
 *
 * The user MUST complete Five Whys through the UI before BMC can run.
 */
export class FiveWhysExecutor implements FrameworkExecutor {
  name = 'five_whys' as const;
  private generator = new WhysTreeGenerator();

  async execute(context: StrategicContext): Promise<any> {
    console.log('[FiveWhys Executor] Starting Five Whys analysis...');

    // Generate the complete Five Whys tree for UI display
    const whysTree = await this.generator.generateTree(
      context.userInput,
      context.sessionId
    );

    console.log(`[FiveWhys Executor] Generated tree with ${whysTree.branches.length} root branches`);

    // CRITICAL: Only use user-finalized data, NEVER generate fake paths
    let whysPath: string[] = [];
    let rootCauses: string[] = [];
    let strategicImplications: string[] = [];
    let strategicFocus = null;

    try {
      // Import necessary modules
      const { db } = await import('../../db.js');
      const { strategyVersions } = await import('@shared/schema.js');
      const { eq, and, desc } = await import('drizzle-orm');

      // Get the user-finalized path from storage
      const [latestVersion] = await db
        .select()
        .from(strategyVersions)
        .where(and(
          eq(strategyVersions.sessionId, context.sessionId),
          eq(strategyVersions.status, 'active')
        ))
        .orderBy(desc(strategyVersions.versionNumber))
        .limit(1);

      if (latestVersion?.analysisData) {
        const analysisData = typeof latestVersion.analysisData === 'string'
          ? JSON.parse(latestVersion.analysisData as any)
          : latestVersion.analysisData;

        const fiveWhys = analysisData?.five_whys;

        if (fiveWhys?.whysPath && Array.isArray(fiveWhys.whysPath) && fiveWhys.whysPath.length > 0) {
          console.log('[FiveWhys Executor] ✓ Found user-finalized path');

          // Use REAL user data
          whysPath = fiveWhys.whysPath;
          rootCauses = [fiveWhys.root_cause || whysPath[whysPath.length - 1]];
          strategicImplications = fiveWhys.strategic_implications || [];
          strategicFocus = fiveWhys.strategicFocus;
        } else {
          console.log('[FiveWhys Executor] ⚠️ No finalized path - user must complete Five Whys first');
        }
      }
    } catch (error) {
      console.error('[FiveWhys Executor] Error checking for finalized path:', error);
    }

    // Return the tree and REAL user data (or empty if not finalized)
    return {
      tree: whysTree,
      whysPath,
      rootCauses,
      strategicImplications,
      strategicFocus,
      // Flag to indicate if Five Whys is actually complete
      isFinalized: whysPath.length > 0
    };
  }
}

/**
 * REMOVED METHODS (Source B - fake path generation):
 *
 * These methods were creating fake data and should NEVER have existed:
 * - findDeepestAnswer(): Generated fake root causes from random branches
 * - extractCanonicalPathFromTree(): Made up a path by following first/best branches
 * - chooseBestNode(): Arbitrarily picked branches based on scoring
 * - scoreNode(): Scored nodes for fake selection
 * - computeBranchDepth(): Helper for fake scoring
 * - extractNodeText(): Helper for fake path extraction
 * - normalizePath(): Was sometimes used but not needed now
 *
 * THE RULE: The executor returns ONLY what the user selected, NEVER generated data.
 */