/**
 * Five Whys → BMC Bridge
 * Transforms Five Whys analysis results into Business Model Canvas input constraints
 * 
 * This bridge connects the Five Whys framework output to the BMC framework input,
 * ensuring the root causes identified flow into the business model design.
 */

import { StrategicContext } from '@shared/journey-types';
import { whysPathToText } from '../../utils/whys-path';

export interface WhysToBMCBridgeInput {
  rootCauses: string[];
  whysPath: any[];
  strategicImplications: string[];
  userInput: string;
}

export interface BMCDesignConstraints {
  problemsToSolve: string[];              // Root causes as problems the BMC must address
  mustHaveCapabilities: string[];         // Capabilities required based on root causes
  designPrinciples: string[];             // Principles derived from strategic implications
  contextualBackground: string;           // Background for BMC analysis
}

/**
 * Transform Five Whys results into BMC design constraints
 */
export function transformWhysToBMC(input: WhysToBMCBridgeInput): BMCDesignConstraints {
  const { rootCauses, whysPath, strategicImplications, userInput } = input;
  const whysText = whysPathToText(whysPath);

  // Convert root causes into problems the business model must solve
  const problemsToSolve = rootCauses.map(cause => {
    // Frame each root cause as a problem statement
    if (cause.toLowerCase().startsWith('the ') || cause.toLowerCase().startsWith('we ')) {
      return cause; // Already well-formed
    }
    return `The business model must address: ${cause}`;
  });

  // Extract must-have capabilities from the analysis path
  const mustHaveCapabilities = extractCapabilities(whysText, strategicImplications);

  // Convert strategic implications into design principles
  const designPrinciples = strategicImplications.map(implication => {
    // Convert implications into actionable design guidance
    if (implication.toLowerCase().includes('must')) {
      return implication;
    }
    return `Design principle: ${implication}`;
  });

  // Build contextual background combining user input and analysis
  const contextualBackground = `
Original Challenge: ${userInput}

Root Cause Analysis:
${whysText.map((why, i) => `Level ${i + 1}: ${why}`).join('\n')}

Identified Root Causes:
${rootCauses.map((cause, i) => `${i + 1}. ${cause}`).join('\n')}

Strategic Implications:
${strategicImplications.map((impl, i) => `${i + 1}. ${impl}`).join('\n')}
`.trim();

  return {
    problemsToSolve,
    mustHaveCapabilities,
    designPrinciples,
    contextualBackground,
  };
}

/**
 * Extract capabilities required based on the Why path and implications
 */
function extractCapabilities(whysPath: string[], implications: string[]): string[] {
  const capabilities: string[] = [];

  // Analyze the Why path for capability keywords
  const capabilityKeywords = [
    'differentiate', 'compete', 'scale', 'deliver', 'provide',
    'support', 'enable', 'improve', 'optimize', 'measure',
    'integrate', 'automate', 'customize', 'localize'
  ];

  for (const why of whysPath) {
    const lowerWhy = why.toLowerCase();
    for (const keyword of capabilityKeywords) {
      if (lowerWhy.includes(keyword)) {
        // Extract the capability context
        const sentences = why.split(/[.!?]/);
        for (const sentence of sentences) {
          if (sentence.toLowerCase().includes(keyword)) {
            capabilities.push(`Must be able to: ${sentence.trim()}`);
            break;
          }
        }
      }
    }
  }

  // Extract from implications
  for (const implication of implications) {
    const lowerImpl = implication.toLowerCase();
    if (lowerImpl.includes('need') || lowerImpl.includes('require') || lowerImpl.includes('must')) {
      capabilities.push(implication);
    }
  }

  // Deduplicate and limit to top 5 most important
  return Array.from(new Set(capabilities)).slice(0, 5);
}

/**
 * Apply the bridge transformation to a Strategic Context
 */
export function applyWhysToBMCBridge(context: StrategicContext): {
  context: StrategicContext;
  bmcConstraints: BMCDesignConstraints;
} {
  // Extract Five Whys results from context
  const rootCauses = context.insights.rootCauses || [];
  const whysPath = context.insights.whysPath || [];
  const strategicImplications = context.insights.strategicImplications || [];

  // Transform to BMC constraints
  const bmcConstraints = transformWhysToBMC({
    rootCauses,
    whysPath,
    strategicImplications,
    userInput: context.userInput,
  });

  // Enrich context with FULL BMC preparation metadata
  const enrichedContext: StrategicContext = {
    ...context,
    insights: {
      ...context.insights,
      // Store ALL BMC constraints for BMC executor to use
      bmcDesignConstraints: {
        problemsToSolve: bmcConstraints.problemsToSolve,
        mustHaveCapabilities: bmcConstraints.mustHaveCapabilities,
        designPrinciples: bmcConstraints.designPrinciples,
        contextualBackground: bmcConstraints.contextualBackground,
      },
    },
  };

  return {
    context: enrichedContext,
    bmcConstraints,
  };
}
