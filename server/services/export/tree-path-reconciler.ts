/**
 * Utility to reconcile Five Whys tree with chosen path
 * Marks the chosen path nodes in the tree for consistent export
 */

/**
 * Mark the chosen path in the Five Whys tree
 * @param tree Original Five Whys tree
 * @param chosenPath Array of chosen answer strings
 * @returns Tree with chosen path marked
 */
export function markChosenPathInTree(tree: any, chosenPath: any[]): any {
  if (!tree || !Array.isArray(chosenPath) || chosenPath.length === 0) {
    return tree;
  }

  // Deep clone the tree to avoid mutations
  const markedTree = JSON.parse(JSON.stringify(tree));

  // Normalize text for matching
  const normalizeText = (text: string): string => {
    return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  };

  // Normalize the chosen path - handle both string[] and canonical format
  const normalizedPath = chosenPath.map(step => {
    if (typeof step === 'string') {
      return { answer: normalizeText(step), question: null };
    } else if (step?.answer !== undefined) {
      return {
        answer: normalizeText(step.answer || ''),
        question: step.question ? normalizeText(step.question) : null
      };
    }
    return { answer: '', question: null };
  });

  // Recursive function to mark nodes
  const markNode = (node: any, depth: number, parentQuestion?: string): boolean => {
    if (!node || depth >= normalizedPath.length) return false;

    const nodeText = normalizeText(
      node.option || node.answer || node.label || ''
    );
    const nodeQuestion = normalizeText(node.question || '');

    // Check if this node matches the current path step
    const pathStep = normalizedPath[depth];

    // Match by answer text
    const answerMatch = nodeText.length > 0 && pathStep.answer && (
      nodeText === pathStep.answer ||
      nodeText.includes(pathStep.answer) ||
      pathStep.answer.includes(nodeText)
    );

    // If we have a question in the path, try to match it too for better accuracy
    const questionMatch = !pathStep.question ||
      (parentQuestion && normalizeText(parentQuestion).includes(pathStep.question)) ||
      nodeQuestion.includes(pathStep.question || '');

    const isMatch = answerMatch && questionMatch;

    if (isMatch) {
      // Mark this node as chosen
      node.isChosen = true;
      node.chosenDepth = depth;

      // Continue marking in children
      if (Array.isArray(node.branches) && node.branches.length > 0) {
        // Pass the current node's question as parent question to children
        const childQuestion = node.nextQuestion || node.question || nodeText;
        for (const branch of node.branches) {
          if (markNode(branch, depth + 1, childQuestion)) {
            return true; // Path continues through this branch
          }
        }
      }
      return true; // This node is part of the path
    }

    return false; // This node is not part of the path
  };

  // Start marking from root branches
  if (Array.isArray(markedTree.branches)) {
    for (const branch of markedTree.branches) {
      markNode(branch, 0);
    }
  }

  return markedTree;
}

/**
 * Extract the canonical path from a tree based on chosen markers
 * @param tree Tree with chosen nodes marked
 * @returns Array of chosen answer strings
 */
export function extractChosenPathFromTree(tree: any): string[] {
  if (!tree || !tree.branches) return [];

  const path: string[] = [];

  const extractFromNode = (node: any): boolean => {
    if (!node) return false;

    if (node.isChosen) {
      const text = node.option || node.answer || node.label || node.question || '';
      if (text) path.push(text);

      // Continue to chosen children
      if (Array.isArray(node.branches)) {
        for (const branch of node.branches) {
          if (extractFromNode(branch)) {
            return true;
          }
        }
      }
      return true;
    }
    return false;
  };

  // Start extraction from root branches
  if (Array.isArray(tree.branches)) {
    for (const branch of tree.branches) {
      if (extractFromNode(branch)) {
        break; // Found the chosen path
      }
    }
  }

  return path;
}

/**
 * Reconcile tree and path to ensure consistency
 * @param tree Original tree
 * @param chosenPath User's chosen path
 * @returns Reconciled tree with chosen path marked
 */
export function reconcileTreeWithPath(tree: any, chosenPath: any[]): any {
  if (!chosenPath || chosenPath.length === 0) {
    return tree; // No path to reconcile
  }

  // Pass the path as-is to markChosenPathInTree, which now handles both formats
  return markChosenPathInTree(tree, chosenPath);
}