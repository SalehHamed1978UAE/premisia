import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { WhysTreeGenerator } from '../../strategic-consultant-legacy/whys-tree-generator';

/**
 * Five Whys Framework Executor
 * Generates root cause analysis using the Five Whys technique
 */
export class FiveWhysExecutor implements FrameworkExecutor {
  name = 'five_whys' as const;
  private generator = new WhysTreeGenerator();

  async execute(context: StrategicContext): Promise<any> {
    console.log('[FiveWhys Executor] Starting Five Whys analysis...');

    // Generate the complete Five Whys tree
    const whysTree = await this.generator.generateTree(
      context.userInput,
      context.sessionId
    );

    console.log(`[FiveWhys Executor] Generated tree with ${whysTree.branches.length} root branches`);

    // CRITICAL FIX: Check if user has already finalized a path
    // This ensures BMC gets the user-selected path, not auto-generated
    let whysPath: string[] = [];
    let strategicFocus = null;

    try {
      // Import necessary modules
      const { db } = await import('../../db.js');
      const { strategyVersions } = await import('@shared/schema.js');
      const { eq, and, desc } = await import('drizzle-orm');

      // Try to get the finalized path from storage
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

        const finalizedPath = analysisData?.five_whys?.whysPath;
        const finalizedFocus = analysisData?.five_whys?.strategicFocus;

        if (Array.isArray(finalizedPath) && finalizedPath.length > 0) {
          console.log('[FiveWhys Executor] Found user-finalized path, using it for BMC bridge');
          whysPath = finalizedPath;
          strategicFocus = finalizedFocus;
        }
      }
    } catch (error) {
      console.log('[FiveWhys Executor] Could not check for finalized path:', error);
    }

    // If no finalized path, use auto-generated path as fallback
    if (whysPath.length === 0) {
      console.log('[FiveWhys Executor] No finalized path found, using auto-generated best path');
      const selectedPath = this.normalizePath(context?.insights?.whysPath);
      whysPath = selectedPath.length > 0
        ? selectedPath
        : this.extractCanonicalPathFromTree(whysTree);
    }

    const rootCauses: string[] = [];
    if (whysPath.length > 0) {
      rootCauses.push(whysPath[whysPath.length - 1]);
    }
    if (whysTree.branches && whysTree.branches.length > 0) {
      for (const branch of whysTree.branches) {
        const deepestAnswer = this.findDeepestAnswer(branch);
        if (deepestAnswer && !rootCauses.includes(deepestAnswer)) {
          rootCauses.push(deepestAnswer);
        }
      }
    }
    
    // Generate strategic implications from root causes
    const strategicImplications = rootCauses.map(cause => 
      `Strategic implication: The business model must address ${cause}`
    );
    
    return {
      rootCauses: rootCauses.length > 0 ? rootCauses : ['No root causes identified'],
      whysPath,
      strategicImplications,
      tree: whysTree,
      strategicFocus, // Include strategic focus for BMC bridge
    };
  }

  /**
   * Find the deepest answer in a branch (recursive helper)
   */
  private findDeepestAnswer(branch: any): string | null {
    if (!branch.branches || branch.branches.length === 0) {
      const text = this.extractNodeText(branch);
      return text || null;
    }
    
    for (const childBranch of branch.branches) {
      const deepest = this.findDeepestAnswer(childBranch);
      if (deepest) return deepest;
    }
    
    return null;
  }

  private normalizePath(path: any): string[] {
    if (!Array.isArray(path)) return [];
    return path
      .map((step) => {
        if (typeof step === 'string') return step.trim();
        if (!step || typeof step !== 'object') return '';
        return String(
          step.answer
          || step.option
          || step.label
          || step.reason
          || step.text
          || step.question
          || ''
        ).trim();
      })
      .filter((step) => step.length > 0);
  }

  private extractNodeText(node: any): string {
    if (!node || typeof node !== 'object') return '';
    const value = node.option || node.answer || node.label || node.reason || node.text || node.question || '';
    return String(value).trim();
  }

  private computeBranchDepth(node: any): number {
    if (!node?.branches || !Array.isArray(node.branches) || node.branches.length === 0) return 1;
    return 1 + Math.max(...node.branches.map((branch: any) => this.computeBranchDepth(branch)));
  }

  private scoreNode(node: any): number {
    const text = this.extractNodeText(node).toLowerCase();
    let score = this.computeBranchDepth(node) * 100;

    const evidenceCount = Array.isArray(node?.supporting_evidence) ? node.supporting_evidence.length : 0;
    score += Math.min(10, evidenceCount);

    if (node?.isVerified) score += 5;
    if (text.length >= 12) score += 2;
    if (!/^why\b/.test(text)) score += 2;

    return score;
  }

  private chooseBestNode(nodes: any[]): any | null {
    if (!Array.isArray(nodes) || nodes.length === 0) return null;
    return nodes
      .slice()
      .sort((a, b) => this.scoreNode(b) - this.scoreNode(a))[0] || null;
  }

  private extractCanonicalPathFromTree(whysTree: any): string[] {
    if (!whysTree?.branches || !Array.isArray(whysTree.branches) || whysTree.branches.length === 0) {
      return [];
    }

    const path: string[] = [];
    let currentLevel = whysTree.branches;
    let depth = 0;

    while (Array.isArray(currentLevel) && currentLevel.length > 0 && depth < 5) {
      const node = this.chooseBestNode(currentLevel);
      if (!node) break;

      const step = this.extractNodeText(node);
      if (step.length > 0) path.push(step);

      currentLevel = Array.isArray(node.branches) ? node.branches : [];
      depth += 1;
    }

    return path;
  }
}
