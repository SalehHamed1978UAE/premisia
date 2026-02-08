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
    
    // Extract root causes and paths from the tree
    const rootCauses: string[] = [];
    const whysPath: string[] = [];
    
    // Extract from each branch
    if (whysTree.branches && whysTree.branches.length > 0) {
      let currentLevel = whysTree.branches;
      
      // Traverse the first branch to build a complete path
      while (currentLevel && currentLevel.length > 0) {
        const node = currentLevel[0];
        const stepText = node.option || (node as any).answer || node.question || '';
        if (typeof stepText === 'string' && stepText.trim().length > 0) {
          whysPath.push(stepText);
        }
        
        // If we're at a leaf node (deepest level), this is a root cause
        if (!node.branches || node.branches.length === 0) {
          rootCauses.push(node.option || node.question);
        }
        
        currentLevel = node.branches || [];
      }
      
      // Collect root causes from other branches
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
    };
  }

  /**
   * Find the deepest answer in a branch (recursive helper)
   */
  private findDeepestAnswer(branch: any): string | null {
    if (!branch.branches || branch.branches.length === 0) {
      return branch.option || branch.question;
    }
    
    for (const childBranch of branch.branches) {
      const deepest = this.findDeepestAnswer(childBranch);
      if (deepest) return deepest;
    }
    
    return null;
  }
}
