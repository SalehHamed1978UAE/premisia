import { WhysTreeGenerator } from '../../strategic-consultant/whys-tree-generator';
/**
 * Five Whys Framework Executor
 * Generates root cause analysis using the Five Whys technique
 */
export class FiveWhysExecutor {
    name = 'five_whys';
    generator = new WhysTreeGenerator();
    async execute(context) {
        console.log('[FiveWhys Executor] Starting Five Whys analysis...');
        // Generate the complete Five Whys tree
        const whysTree = await this.generator.generateTree(context.userInput, context.sessionId);
        console.log(`[FiveWhys Executor] Generated tree with ${whysTree.branches.length} root branches`);
        // Extract root causes and paths from the tree
        const rootCauses = [];
        const whysPath = [whysTree.rootQuestion];
        // Extract from each branch
        if (whysTree.branches && whysTree.branches.length > 0) {
            let currentLevel = whysTree.branches;
            // Traverse the first branch to build a complete path
            while (currentLevel && currentLevel.length > 0) {
                const node = currentLevel[0];
                whysPath.push(node.question);
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
        const strategicImplications = rootCauses.map(cause => `Strategic implication: The business model must address ${cause}`);
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
    findDeepestAnswer(branch) {
        if (!branch.branches || branch.branches.length === 0) {
            return branch.option || branch.question;
        }
        for (const childBranch of branch.branches) {
            const deepest = this.findDeepestAnswer(childBranch);
            if (deepest)
                return deepest;
        }
        return null;
    }
}
//# sourceMappingURL=five-whys-executor.js.map