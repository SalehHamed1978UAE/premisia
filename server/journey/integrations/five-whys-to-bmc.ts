/**
 * Five Whys → BMC Integration
 *
 * Ensures Five Whys root cause analysis actually drives BMC research
 * Instead of BMC starting from scratch
 */

import type { FiveWhysResult, StrategicFocus } from '../schemas/five-whys-result';

/**
 * Generate strategic focus from Five Whys chosen path
 * This becomes the PRIMARY directive for BMC research
 */
export function generateStrategicFocus(
  userInput: string,
  chosenPath: string[],
  rootCause: string,
  strategicImplications: string[]
): StrategicFocus {

  // Extract the core problem from root cause
  const problemStatement = createProblemStatement(rootCause, strategicImplications);

  // Identify constraints from the why chain
  const constraints = extractConstraints(chosenPath);

  // Define success metrics based on what needs to be solved
  const successMetrics = deriveSuccessMetrics(rootCause, strategicImplications);

  // Generate specific research priorities for BMC
  const researchPriorities = generateResearchPriorities(rootCause, constraints);

  return {
    problemStatement,
    constraints,
    successMetrics,
    researchPriorities
  };
}

/**
 * Create a clear problem statement that BMC must solve
 */
function createProblemStatement(rootCause: string, implications: string[]): string {
  // For vertical farming example:
  // Root: "Mixed crop portfolio strategy where faster-growing microgreens subsidize longer-cycle herbs"
  // Problem: "Design a business model that balances quick-turn crops with premium varieties for consistent cash flow"

  const cashFlowMention = implications.find(i => i.toLowerCase().includes('cash flow'));
  const timingMention = implications.find(i => i.toLowerCase().includes('timing'));

  if (rootCause.includes('crop portfolio') || rootCause.includes('mixed crop')) {
    return `Design a business model that balances quick-turn crops with premium varieties to manage cash flow volatility`;
  }

  if (cashFlowMention) {
    return `Create a business model that addresses: ${cashFlowMention.slice(0, 150)}`;
  }

  // Generic fallback
  return `Develop a sustainable business model that directly solves: ${rootCause.slice(0, 150)}`;
}

/**
 * Extract operational constraints from the why chain
 */
function extractConstraints(chosenPath: string[]): string[] {
  const constraints: string[] = [];

  for (const step of chosenPath) {
    // Look for cost constraints
    if (step.includes('$') || step.includes('cost') || step.includes('expense')) {
      const match = step.match(/\$[\d,]+(?:-\$?[\d,]+)?(?:\s+per\s+\w+)?/g);
      if (match) {
        constraints.push(`Cost constraint: ${match[0]}`);
      }
    }

    // Look for time constraints
    if (step.includes('day') || step.includes('week') || step.includes('month')) {
      const match = step.match(/\d+(?:-\d+)?\s+(?:day|week|month)s?/g);
      if (match) {
        constraints.push(`Time constraint: ${match[0]}`);
      }
    }

    // Look for volume/capacity constraints
    if (step.includes('pound') || step.includes('sqft') || step.includes('facility')) {
      const match = step.match(/\d+(?:-\d+)?\s+(?:pounds?|sqft|square\s+feet)/g);
      if (match) {
        constraints.push(`Capacity constraint: ${match[0]}`);
      }
    }
  }

  // Add default constraints if none found
  if (constraints.length === 0) {
    constraints.push('Must be operationally feasible with limited initial capital');
    constraints.push('Must achieve positive cash flow within reasonable timeframe');
  }

  return constraints;
}

/**
 * Derive success metrics from the root cause
 */
function deriveSuccessMetrics(rootCause: string, implications: string[]): string[] {
  const metrics: string[] = [];

  // Cash flow metrics
  if (rootCause.includes('cash flow') || implications.some(i => i.includes('cash flow'))) {
    metrics.push('Days to positive cash flow');
    metrics.push('Cash flow volatility index');
  }

  // Revenue cycle metrics
  if (rootCause.includes('cycle') || rootCause.includes('turnover')) {
    metrics.push('Average revenue cycle time');
    metrics.push('Revenue per growth cycle');
  }

  // Efficiency metrics
  if (rootCause.includes('waste') || rootCause.includes('spoilage')) {
    metrics.push('Waste reduction percentage');
    metrics.push('Inventory turnover rate');
  }

  // Utilization metrics
  if (rootCause.includes('space') || rootCause.includes('facility')) {
    metrics.push('Revenue per square foot');
    metrics.push('Facility utilization rate');
  }

  // Add generic metrics if needed
  if (metrics.length < 2) {
    metrics.push('Customer acquisition cost');
    metrics.push('Monthly recurring revenue growth');
  }

  return metrics;
}

/**
 * Generate specific research priorities for BMC blocks
 */
function generateResearchPriorities(
  rootCause: string,
  constraints: string[]
): {
  customerSegments: string[];
  channels: string[];
  valuePropositions: string[];
} {
  const priorities = {
    customerSegments: [] as string[],
    channels: [] as string[],
    valuePropositions: [] as string[]
  };

  // For vertical farming example
  if (rootCause.includes('crop portfolio') || rootCause.includes('mixed crop')) {
    priorities.customerSegments = [
      'Buyers who need consistent supply despite harvest cycles',
      'Customers willing to commit to subscription/forward contracts',
      'Premium buyers who value crop variety over single-crop suppliers'
    ];

    priorities.channels = [
      'Direct B2B relationships with commitment agreements',
      'Subscription delivery models that smooth demand',
      'Pre-order systems that align with harvest schedules'
    ];

    priorities.valuePropositions = [
      'Guaranteed availability through portfolio diversification',
      'Premium quality from optimized growing conditions',
      'Price stability through mixed margin management'
    ];
  }
  // For cash flow focused businesses
  else if (rootCause.includes('cash flow')) {
    priorities.customerSegments = [
      'Customers with predictable purchase patterns',
      'Segments willing to pay upfront or on subscription',
      'High-frequency buyers who smooth revenue'
    ];

    priorities.channels = [
      'Channels with quick payment terms',
      'Direct sales to reduce intermediary delays',
      'Digital channels with instant payment processing'
    ];

    priorities.valuePropositions = [
      'Solutions that customers will pay premium for',
      'Services that generate recurring revenue',
      'Products with high margin and quick turnover'
    ];
  }
  // Generic fallback
  else {
    priorities.customerSegments = [
      'Segments experiencing the identified root problem most acutely',
      'Early adopters willing to try new solutions',
      'Customers with budget to pay for problem resolution'
    ];

    priorities.channels = [
      'Channels that minimize customer acquisition cost',
      'Distribution methods aligned with target segment preferences',
      'Scalable channels that grow with the business'
    ];

    priorities.valuePropositions = [
      'Direct solution to the root cause identified',
      'Differentiated approach compared to existing alternatives',
      'Clear ROI that justifies customer investment'
    ];
  }

  return priorities;
}

/**
 * Create BMC research prompt enhanced with Five Whys insights
 */
export function createEnhancedBMCPrompt(
  originalInput: string,
  strategicFocus: StrategicFocus
): string {
  return `
STRATEGIC CONTEXT FROM ROOT CAUSE ANALYSIS:
Problem to Solve: ${strategicFocus.problemStatement}
Key Constraints: ${strategicFocus.constraints.join('; ')}
Success Metrics: ${strategicFocus.successMetrics.join(', ')}

BUSINESS CONCEPT:
${originalInput}

RESEARCH PRIORITIES:
1. Customer Segments: Focus on ${strategicFocus.researchPriorities.customerSegments[0]}
2. Value Propositions: Research ${strategicFocus.researchPriorities.valuePropositions[0]}
3. Channels: Investigate ${strategicFocus.researchPriorities.channels[0]}

Generate a Business Model Canvas that specifically addresses the identified root cause and works within the discovered constraints. Every block should connect back to solving the core problem.
`;
}