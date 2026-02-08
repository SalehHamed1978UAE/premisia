/**
 * Standardized Five Whys Result Schema
 *
 * This is the SINGLE SOURCE OF TRUTH for Five Whys output
 * that feeds into subsequent journey steps
 */

export interface FiveWhysResult {
  // The complete analysis tree with all branches
  tree: FiveWhysTree;

  // The user's chosen path through the tree
  chosenPath: WhyStep[];

  // The identified root cause from the chosen path
  rootCause: string;

  // Strategic implications derived from the root cause
  strategicImplications: string[];

  // Recommended actions to address the root cause
  recommendedActions: string[];

  // The strategic focus statement for BMC research
  strategicFocus: StrategicFocus;

  // Metadata
  metadata: {
    generatedAt: string;
    finalizedAt?: string;
    confidence: number;
    userValidated: boolean;
  };
}

export interface WhyStep {
  level: number; // 1-5
  question: string;
  answer: string;
  supportingEvidence?: string[];
}

export interface StrategicFocus {
  /**
   * One-sentence summary of what the business needs to solve
   * This becomes the PRIMARY INPUT to BMC research
   */
  problemStatement: string;

  /**
   * Key constraints identified through Five Whys
   * BMC should research solutions that work within these constraints
   */
  constraints: string[];

  /**
   * Success metrics derived from the root cause
   * BMC value props should address these metrics
   */
  successMetrics: string[];

  /**
   * Market research priorities for BMC
   * Tells BMC what specific aspects to investigate
   */
  researchPriorities: {
    customerSegments: string[];  // Who has this problem most acutely?
    channels: string[];          // How to reach them given the root cause?
    valuePropositions: string[]; // What solutions address this root cause?
  };
}

export interface FiveWhysTree {
  question: string;
  branches: TreeBranch[];
}

export interface TreeBranch {
  option: string;
  isChosen?: boolean;  // Marks the chosen path in the tree
  supportingEvidence?: string[];
  counterArguments?: string[];
  branches?: TreeBranch[];  // Sub-branches for deeper levels
}

/**
 * Transform Five Whys Result into BMC Research Context
 */
export function createBMCContext(fiveWhysResult: FiveWhysResult): BMCResearchContext {
  return {
    strategicFocus: fiveWhysResult.strategicFocus.problemStatement,
    constraints: fiveWhysResult.strategicFocus.constraints,
    rootCause: fiveWhysResult.rootCause,
    successMetrics: fiveWhysResult.strategicFocus.successMetrics,
    researchDirectives: {
      // BMC should specifically research these areas
      customerSegments: `Focus on segments that experience: ${fiveWhysResult.rootCause}`,
      valuePropositions: `Solutions that directly address: ${fiveWhysResult.rootCause}`,
      channels: `Distribution methods that overcome: ${fiveWhysResult.strategicFocus.constraints.join(', ')}`,
      revenueStreams: `Pricing models that align with: ${fiveWhysResult.strategicFocus.successMetrics.join(', ')}`,
    }
  };
}

export interface BMCResearchContext {
  strategicFocus: string;
  constraints: string[];
  rootCause: string;
  successMetrics: string[];
  researchDirectives: {
    customerSegments: string;
    valuePropositions: string;
    channels: string;
    revenueStreams: string;
  };
}

/**
 * Example of how this flows:
 *
 * Five Whys discovers: "Mixed crop portfolio strategy needed for cash flow"
 * ↓
 * Strategic Focus: "Design growing operations that balance quick-turn crops with premium varieties"
 * ↓
 * BMC Research Directives:
 * - Customer Segments: "Find buyers who value crop variety and consistent supply"
 * - Value Props: "Research portfolio mixes that optimize revenue per growing cycle"
 * - Channels: "Identify distribution that handles mixed harvest schedules"
 * ↓
 * EPM Workstreams: Implement the specific portfolio strategy discovered
 */