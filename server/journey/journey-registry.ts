/**
 * Journey Registry
 * Defines the 6 pre-planned strategic journeys with their framework sequences
 */

import { JourneyDefinition, JourneyType } from '@shared/journey-types';

export const JOURNEYS: Record<JourneyType, JourneyDefinition> = {
  /**
   * Business Model Innovation Journey
   * For rethinking business models, revenue streams, and value creation
   * AVAILABLE: Strategic Understanding → Five Whys → BMC → Strategic Decisions → Prioritization → EPM (complete workflow)
   */
  business_model_innovation: {
    type: 'business_model_innovation',
    name: 'Business Model Innovation',
    description: 'Reimagine your business model by identifying root causes of problems, then designing innovative value propositions, revenue streams, and partnerships',
    frameworks: ['five_whys', 'bmc'],
    pageSequence: [
      '/strategic-consultant/input',
      '/strategic-consultant/whys-tree/:understandingId',
      '/strategic-consultant/research/:sessionId',
      '/bmc/results/:sessionId/:versionNumber',
      '/strategy-workspace/decisions/:sessionId/:versionNumber',
      '/strategy-workspace/prioritization/:sessionId/:versionNumber',
    ],
    estimatedDuration: '30-35 minutes',
    available: true, // FULLY IMPLEMENTED - includes input & decisions workflow
    summaryBuilder: 'fiveWhysBmc',
    defaultReadiness: {
      minReferences: 0,
      minEntities: 0,
    },
    insightsConfig: {
      requiresFiveWhys: true,
      requiresBmc: true,
    },
    dependencies: [
      { from: 'five_whys', to: 'bmc' },
    ],
  },

  /**
   * Market Entry Strategy Journey
   * For entering new markets or launching new products
   * NOT YET IMPLEMENTED: Placeholder only
   */
  market_entry: {
    type: 'market_entry',
    name: 'Market Entry Strategy',
    description: 'Analyze market dynamics, competitive forces, and trends to craft a successful market entry plan',
    frameworks: ['pestle', 'porters', 'swot'],
    estimatedDuration: '15-20 minutes',
    available: false, // Placeholder - not implemented
    summaryBuilder: 'pestlePorters',
    defaultReadiness: {
      minReferences: 3,
      minEntities: 5,
    },
    insightsConfig: {},
    dependencies: [],
  },

  /**
   * Competitive Strategy Journey
   * For competitive positioning and differentiation
   * NOT YET IMPLEMENTED: Placeholder only
   */
  competitive_strategy: {
    type: 'competitive_strategy',
    name: 'Competitive Strategy',
    description: 'Understand competitive forces, identify strategic gaps, and develop differentiation strategies',
    frameworks: ['porters', 'bmc', 'blue_ocean'],
    estimatedDuration: '15-22 minutes',
    available: false, // Placeholder - not implemented
    summaryBuilder: 'portersBmc',
    defaultReadiness: {
      minReferences: 3,
      minEntities: 5,
    },
    insightsConfig: {
      requiresBmc: true,
    },
    dependencies: [
      { from: 'porters', to: 'bmc' },
    ],
  },

  /**
   * Digital Transformation Journey
   * For technology-driven change initiatives
   * NOT YET IMPLEMENTED: Placeholder only
   */
  digital_transformation: {
    type: 'digital_transformation',
    name: 'Digital Transformation',
    description: 'Navigate digital disruption by analyzing tech trends, redesigning operating models, and planning growth',
    frameworks: ['pestle', 'bmc', 'ansoff'],
    estimatedDuration: '18-25 minutes',
    available: false, // Placeholder - not implemented
    summaryBuilder: 'pestleBmc',
    defaultReadiness: {
      minReferences: 3,
      minEntities: 5,
    },
    insightsConfig: {
      requiresBmc: true,
    },
    dependencies: [
      { from: 'pestle', to: 'bmc' },
    ],
  },

  /**
   * Crisis Recovery Journey
   * For turnaround and crisis management
   * NOT YET IMPLEMENTED: Placeholder only
   */
  crisis_recovery: {
    type: 'crisis_recovery',
    name: 'Crisis Recovery',
    description: 'Diagnose root causes of crisis, assess internal strengths/weaknesses, and rebuild business model',
    frameworks: ['five_whys', 'swot', 'bmc'],
    estimatedDuration: '14-20 minutes',
    available: false, // Placeholder - not implemented
    summaryBuilder: 'fiveWhysSwot',
    defaultReadiness: {
      minReferences: 2,
      minEntities: 4,
    },
    insightsConfig: {
      requiresFiveWhys: true,
    },
    dependencies: [
      { from: 'five_whys', to: 'swot' },
    ],
  },

  /**
   * Growth Strategy Journey
   * For expansion and scaling strategies
   * NOT YET IMPLEMENTED: Placeholder only
   */
  growth_strategy: {
    type: 'growth_strategy',
    name: 'Growth Strategy',
    description: 'Explore growth opportunities through market trends, expansion options, and business model optimization',
    frameworks: ['pestle', 'ansoff', 'bmc'],
    estimatedDuration: '16-23 minutes',
    available: false, // Placeholder - not implemented
    summaryBuilder: 'pestleAnsoff',
    defaultReadiness: {
      minReferences: 3,
      minEntities: 5,
    },
    insightsConfig: {},
    dependencies: [
      { from: 'pestle', to: 'ansoff' },
    ],
  },
};

/**
 * Get a journey definition by type
 */
export function getJourney(type: JourneyType): JourneyDefinition {
  return JOURNEYS[type];
}

/**
 * Get all available (implemented) journeys
 */
export function getAvailableJourneys(): JourneyDefinition[] {
  return Object.values(JOURNEYS).filter(j => j.available);
}

/**
 * Get all journeys (including unavailable placeholders)
 */
export function getAllJourneys(): JourneyDefinition[] {
  return Object.values(JOURNEYS);
}

/**
 * Check if a journey is available
 */
export function isJourneyAvailable(type: JourneyType): boolean {
  return JOURNEYS[type]?.available ?? false;
}

/**
 * Get the next page in a journey's page sequence
 * @param journeyType The journey type
 * @param currentPagePattern The current page pattern (e.g., '/strategic-consultant/research/:sessionId')
 * @param params Parameters to substitute into the next page URL
 * @returns The next page URL with parameters substituted, or null if at end
 */
export function getNextPage(
  journeyType: JourneyType,
  currentPagePattern: string,
  params: Record<string, string | number>
): string | null {
  const journey = JOURNEYS[journeyType];
  if (!journey || !journey.pageSequence) {
    return null;
  }

  const currentIndex = journey.pageSequence.findIndex(page => {
    // Match patterns by comparing the base path structure
    const pageBase = page.split('/').map(seg => seg.startsWith(':') ? ':param' : seg).join('/');
    const currentBase = currentPagePattern.split('/').map(seg => seg.startsWith(':') ? ':param' : seg).join('/');
    return pageBase === currentBase;
  });

  if (currentIndex === -1 || currentIndex >= journey.pageSequence.length - 1) {
    return null;
  }

  const nextPagePattern = journey.pageSequence[currentIndex + 1];
  
  // Substitute parameters into the next page URL
  let nextUrl = nextPagePattern;
  for (const [key, value] of Object.entries(params)) {
    nextUrl = nextUrl.replace(`:${key}`, String(value));
  }

  return nextUrl;
}

/**
 * Journey Registry object for convenient access to all journey functions
 */
export const journeyRegistry = {
  getJourney,
  getAvailableJourneys,
  getAllJourneys,
  isJourneyAvailable,
  getNextPage,
  JOURNEYS,
};
