/**
 * Strategic Context Accumulator
 * Manages the accumulation of insights as frameworks execute in sequence
 */

import { StrategicContext, FrameworkResult, JourneyType, JourneyStatus } from '@shared/journey-types';
import { StrategicUnderstanding } from '@shared/schema';

/**
 * Initialize a new Strategic Context from an understanding record
 */
export function initializeContext(
  understanding: StrategicUnderstanding,
  journeyType: JourneyType
): StrategicContext {
  return {
    understandingId: understanding.id,
    sessionId: understanding.sessionId,
    userInput: understanding.userInput,
    journeyType,
    currentFrameworkIndex: 0,
    completedFrameworks: [],
    insights: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'initializing',
  };
}

/**
 * Add a framework result to the context
 * This merges the framework's output into the accumulated insights
 */
export function addFrameworkResult(
  context: StrategicContext,
  result: FrameworkResult
): StrategicContext {
  const updatedContext: StrategicContext = {
    ...context,
    currentFrameworkIndex: context.currentFrameworkIndex + 1,
    completedFrameworks: [...context.completedFrameworks, result.frameworkName],
    updatedAt: new Date(),
  };

  // Merge framework-specific insights
  switch (result.frameworkName) {
    case 'five_whys':
      updatedContext.insights = {
        ...updatedContext.insights,
        rootCauses: result.data.rootCauses || [result.data.rootCause],
        whysPath: result.data.whysPath || result.data.selectedPath,
        strategicImplications: result.data.strategicImplications || [],
      };
      break;

    case 'bmc':
      updatedContext.insights = {
        ...updatedContext.insights,
        businessModelGaps: result.data.criticalGaps || [],
        bmcBlocks: result.data.blocks || {},
        bmcContradictions: result.data.contradictions || [],
      };
      break;

    case 'porters':
      updatedContext.insights = {
        ...updatedContext.insights,
        portersForces: result.data.forces || {},
        competitivePressures: result.data.pressures || [],
      };
      break;

    case 'pestle':
      updatedContext.insights = {
        ...updatedContext.insights,
        trendFactors: result.data.factors || {},
        externalForces: result.data.forces || [],
      };
      break;

    default:
      // For unimplemented frameworks, store raw data
      updatedContext.insights = {
        ...updatedContext.insights,
        [`${result.frameworkName}_data`]: result.data,
      };
  }

  return updatedContext;
}

/**
 * Update the market research in the context
 * This allows frameworks to share research findings
 */
export function addMarketResearch(
  context: StrategicContext,
  research: {
    sources?: any[];
    keyFindings?: string[];
    contradictions?: any[];
  }
): StrategicContext {
  return {
    ...context,
    marketResearch: {
      sources: [
        ...(context.marketResearch?.sources || []),
        ...(research.sources || []),
      ],
      keyFindings: [
        ...(context.marketResearch?.keyFindings || []),
        ...(research.keyFindings || []),
      ],
      contradictions: [
        ...(context.marketResearch?.contradictions || []),
        ...(research.contradictions || []),
      ],
    },
    updatedAt: new Date(),
  };
}

/**
 * Mark the journey as complete and add final decisions
 */
export function finalizeContext(
  context: StrategicContext,
  decisions: {
    recommended?: string[];
    alternatives?: string[];
    rejected?: string[];
  }
): StrategicContext {
  return {
    ...context,
    decisions,
    status: 'completed' as JourneyStatus,
    updatedAt: new Date(),
  };
}

/**
 * Extract critical risks and opportunities from accumulated insights
 */
export function synthesizeCriticalItems(context: StrategicContext): {
  risks: string[];
  opportunities: string[];
  constraints: string[];
} {
  const risks: string[] = [];
  const opportunities: string[] = [];
  const constraints: string[] = [];

  // Extract from business model gaps
  if (context.insights.businessModelGaps) {
    context.insights.businessModelGaps.forEach((gap) => {
      if (typeof gap === 'string') {
        risks.push(gap);
      }
    });
  }

  // Extract from competitive pressures
  if (context.insights.competitivePressures) {
    context.insights.competitivePressures.forEach((pressure) => {
      risks.push(pressure);
    });
  }

  // Extract from root causes (these are constraints)
  if (context.insights.rootCauses) {
    context.insights.rootCauses.forEach((cause) => {
      constraints.push(cause);
    });
  }

  // Extract from PESTLE external forces
  if (context.insights.externalForces) {
    context.insights.externalForces.forEach((force) => {
      // Categorize based on keywords (simple heuristic)
      if (force.toLowerCase().includes('opportunity') || force.toLowerCase().includes('growth')) {
        opportunities.push(force);
      } else if (force.toLowerCase().includes('threat') || force.toLowerCase().includes('risk')) {
        risks.push(force);
      }
    });
  }

  return { risks, opportunities, constraints };
}

/**
 * Get a read-only copy of the current context
 */
export function getContext(context: StrategicContext): Readonly<StrategicContext> {
  return Object.freeze({ ...context });
}
