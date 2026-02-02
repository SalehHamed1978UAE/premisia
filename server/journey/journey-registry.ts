/**
 * Journey Registry
 * Defines the 6 pre-planned strategic journeys with their framework sequences
 * 
 * NOTE: This registry now supports config-based journeys via the module system.
 * Config-based journeys are checked first, with hard-coded definitions as fallback.
 */

import { JourneyDefinition, JourneyType, FrameworkName } from '@shared/journey-types';
import { moduleRegistry } from '../modules/registry';
import type { JourneyConfig } from '../modules/journey-config';

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
   * AVAILABLE: Strategic Research → PESTLE → Porter's → SWOT → Strategic Decisions → Prioritization → EPM
   */
  market_entry: {
    type: 'market_entry',
    name: 'Market Entry Strategy',
    description: 'Analyze market dynamics, competitive forces, and trends to craft a successful market entry plan',
    frameworks: ['pestle', 'porters', 'swot'],
    pageSequence: [
      '/strategic-consultant/input',
      '/strategic-consultant/pestle-results/:sessionId/:versionNumber',   // Step 1: PESTLE analysis
      '/strategic-consultant/porters-results/:sessionId/:versionNumber',  // Step 2: Porter's Five Forces
      '/strategic-consultant/swot-results/:sessionId/:versionNumber',     // Step 3: SWOT analysis
      '/strategy-workspace/decisions/:sessionId/:versionNumber',          // Step 4: Strategic decisions
      '/strategy-workspace/prioritization/:sessionId/:versionNumber',     // Step 5: Prioritization
    ],
    estimatedDuration: '15-20 minutes',
    available: true, // FULLY IMPLEMENTED - Sequential PESTLE → Porter's → SWOT workflow
    summaryBuilder: 'pestlePorters',
    defaultReadiness: {
      minReferences: 0,
      minEntities: 0,
    },
    insightsConfig: {},
    dependencies: [
      { from: 'pestle', to: 'porters' },
      { from: 'porters', to: 'swot' },
    ],
  },

  /**
   * Competitive Strategy Journey
   * For competitive positioning and differentiation
   * IMPLEMENTED: Porter's → BMC → Blue Ocean sequential workflow
   */
  competitive_strategy: {
    type: 'competitive_strategy',
    name: 'Competitive Strategy',
    description: 'Understand competitive forces, identify strategic gaps, and develop differentiation strategies',
    frameworks: ['porters', 'bmc', 'blue_ocean'],
    pageSequence: [
      '/strategic-consultant/input',
      '/strategic-consultant/porters-results/:sessionId/:versionNumber',  // Step 1: Porter's Five Forces
      '/strategic-consultant/research/:sessionId',                        // Step 2: BMC analysis
      '/strategic-consultant/framework-insight/:sessionId',               // Step 3: Blue Ocean Strategy
      '/strategy-workspace/decisions/:sessionId/:versionNumber',          // Step 4: Strategic decisions
      '/strategy-workspace/prioritization/:sessionId/:versionNumber',     // Step 5: Prioritization
    ],
    estimatedDuration: '15-22 minutes',
    available: true, // IMPLEMENTED - Porter's → BMC → Blue Ocean workflow
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
      { from: 'bmc', to: 'blue_ocean' },
    ],
  },

  /**
   * Digital Transformation Journey
   * For technology-driven change initiatives
   * IMPLEMENTED: PESTLE → BMC → Ansoff sequential workflow
   */
  digital_transformation: {
    type: 'digital_transformation',
    name: 'Digital Transformation',
    description: 'Navigate digital disruption by analyzing tech trends, redesigning operating models, and planning growth',
    frameworks: ['pestle', 'bmc', 'ansoff'],
    pageSequence: [
      '/strategic-consultant/input',
      '/strategic-consultant/pestle-results/:sessionId/:versionNumber',  // Step 1: PESTLE analysis
      '/strategic-consultant/research/:sessionId',                       // Step 2: BMC analysis
      '/strategic-consultant/framework-insight/:sessionId',              // Step 3: Ansoff Matrix
      '/strategy-workspace/decisions/:sessionId/:versionNumber',         // Step 4: Strategic decisions
      '/strategy-workspace/prioritization/:sessionId/:versionNumber',    // Step 5: Prioritization
    ],
    estimatedDuration: '18-25 minutes',
    available: true, // IMPLEMENTED - PESTLE → BMC → Ansoff workflow
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
      { from: 'bmc', to: 'ansoff' },
    ],
  },

  /**
   * Crisis Recovery Journey
   * For turnaround and crisis management
   * IMPLEMENTED: Five Whys → SWOT → BMC sequential workflow
   */
  crisis_recovery: {
    type: 'crisis_recovery',
    name: 'Crisis Recovery',
    description: 'Diagnose root causes of crisis, assess internal strengths/weaknesses, and rebuild business model',
    frameworks: ['five_whys', 'swot', 'bmc'],
    pageSequence: [
      '/strategic-consultant/input',
      '/strategic-consultant/whys-tree/:understandingId',          // Step 1: Five Whys analysis
      '/strategic-consultant/swot-results/:sessionId/:versionNumber', // Step 2: SWOT analysis
      '/strategic-consultant/research/:sessionId',                  // Step 3: BMC analysis
      '/strategy-workspace/decisions/:sessionId/:versionNumber',    // Step 4: Strategic decisions
      '/strategy-workspace/prioritization/:sessionId/:versionNumber', // Step 5: Prioritization
    ],
    estimatedDuration: '14-20 minutes',
    available: true, // IMPLEMENTED - Five Whys → SWOT → BMC workflow
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
      { from: 'swot', to: 'bmc' },
    ],
  },

  /**
   * Growth Strategy Journey
   * For expansion and scaling strategies
   * IMPLEMENTED: PESTLE → Ansoff → BMC sequential workflow
   */
  growth_strategy: {
    type: 'growth_strategy',
    name: 'Growth Strategy',
    description: 'Explore growth opportunities through market trends, expansion options, and business model optimization',
    frameworks: ['pestle', 'ansoff', 'bmc'],
    pageSequence: [
      '/strategic-consultant/input',
      '/strategic-consultant/pestle-results/:sessionId/:versionNumber',  // Step 1: PESTLE analysis
      '/strategic-consultant/framework-insight/:sessionId',              // Step 2: Ansoff Matrix
      '/strategic-consultant/research/:sessionId',                       // Step 3: BMC analysis
      '/strategy-workspace/decisions/:sessionId/:versionNumber',         // Step 4: Strategic decisions
      '/strategy-workspace/prioritization/:sessionId/:versionNumber',    // Step 5: Prioritization
    ],
    estimatedDuration: '16-23 minutes',
    available: true, // IMPLEMENTED - PESTLE → Ansoff → BMC workflow
    summaryBuilder: 'pestleAnsoff',
    defaultReadiness: {
      minReferences: 3,
      minEntities: 5,
    },
    insightsConfig: {},
    dependencies: [
      { from: 'pestle', to: 'ansoff' },
      { from: 'ansoff', to: 'bmc' },
    ],
  },

  /**
   * Market Segmentation Discovery Journey (Marketing Consultant)
   * For discovering and validating ideal customer segments
   * AVAILABLE: Uses genetic algorithm-inspired exploration
   */
  market_segmentation: {
    type: 'market_segmentation',
    name: 'Market Segmentation Discovery',
    description: 'Discover and validate your ideal customer segments using genetic algorithm-inspired exploration with 100 segment genomes',
    frameworks: ['segment_discovery'],
    pageSequence: [
      '/marketing-consultant',
      '/marketing-consultant/classification',
      '/marketing-consultant/discovery',
      '/marketing-consultant/results',
    ],
    estimatedDuration: '3-5 minutes',
    available: true, // FULLY IMPLEMENTED via Marketing Consultant
    summaryBuilder: 'segmentDiscovery',
    defaultReadiness: {
      minReferences: 0, // No external research needed
      minEntities: 0,
    },
    insightsConfig: {
      requiresFiveWhys: false,
      requiresBmc: false,
    },
    dependencies: [], // No dependencies on other frameworks
  },

  /**
   * Custom Journey (Wizard-Created)
   * Dynamic journey with custom framework sequence stored in session metadata
   */
  custom: {
    type: 'custom',
    name: 'Custom Journey',
    description: 'User-created journey with custom framework sequence',
    frameworks: [], // Frameworks are loaded from session metadata at runtime
    pageSequence: [], // Dynamic based on frameworks
    estimatedDuration: 'Varies',
    available: true,
    summaryBuilder: 'custom',
    defaultReadiness: {
      minReferences: 0,
      minEntities: 0,
    },
    insightsConfig: {},
    dependencies: [],
  },
};

/**
 * Convert a JourneyConfig to JourneyDefinition for backward compatibility
 */
function configToDefinition(config: JourneyConfig): JourneyDefinition {
  const frameworkMap: Record<string, FrameworkName> = {
    'five-whys-analyzer': 'five_whys',
    'bmc-analyzer': 'bmc',
    'porters-analyzer': 'porters',
    'pestle-analyzer': 'pestle',
  };
  
  const frameworks = config.modules
    .map(m => frameworkMap[m.moduleId])
    .filter((f): f is FrameworkName => f !== undefined);
  
  return {
    type: config.id as JourneyType,
    name: config.name,
    description: config.description,
    frameworks,
    pageSequence: config.pageSequence.map(p => p.path),
    estimatedDuration: config.estimatedDuration || '20-30 minutes',
    available: config.available,
    summaryBuilder: config.summaryBuilder || 'default',
    defaultReadiness: {
      minReferences: config.defaultReadiness?.minReferences ?? 0,
      minEntities: config.defaultReadiness?.minEntities ?? 0,
    },
    insightsConfig: {
      requiresFiveWhys: config.insightsConfig?.requiresFiveWhys,
      requiresBmc: config.insightsConfig?.requiresBmc,
    },
    dependencies: config.transitions
      .filter(t => t.from && t.to)
      .map(t => ({
        from: frameworkMap[t.from] || t.from as FrameworkName,
        to: frameworkMap[t.to] || t.to as FrameworkName,
      })),
  };
}

/**
 * Get a journey definition by type
 * Tries config-based journey first, falls back to hard-coded definition
 */
export function getJourney(type: JourneyType): JourneyDefinition {
  const configJourney = moduleRegistry.getJourney(type);
  if (configJourney) {
    console.log(`[JourneyRegistry] Using config-based journey: ${type}`);
    return configToDefinition(configJourney);
  }
  
  return JOURNEYS[type];
}

/**
 * Get all available (implemented) journeys
 * Merges config-based and hard-coded journeys, config takes precedence
 */
export function getAvailableJourneys(): JourneyDefinition[] {
  const configJourneys = moduleRegistry.listAvailableJourneys();
  const configIds = new Set(configJourneys.map(j => j.id));
  
  const fromConfig = configJourneys.map(configToDefinition);
  
  const fromHardcoded = Object.values(JOURNEYS)
    .filter(j => j.available && !configIds.has(j.type));
  
  return [...fromConfig, ...fromHardcoded];
}

/**
 * Get all journeys (including unavailable placeholders)
 */
export function getAllJourneys(): JourneyDefinition[] {
  const configJourneys = moduleRegistry.listJourneys();
  const configIds = new Set(configJourneys.map(j => j.id));
  
  const fromConfig = configJourneys.map(configToDefinition);
  
  const fromHardcoded = Object.values(JOURNEYS)
    .filter(j => !configIds.has(j.type));
  
  return [...fromConfig, ...fromHardcoded];
}

/**
 * Check if a journey is available
 */
export function isJourneyAvailable(type: JourneyType): boolean {
  const configJourney = moduleRegistry.getJourney(type);
  if (configJourney) {
    return configJourney.available;
  }
  return JOURNEYS[type]?.available ?? false;
}

/**
 * Get journey config if it exists (for modules that need raw config access)
 */
export function getJourneyConfig(id: string): JourneyConfig | undefined {
  return moduleRegistry.getJourney(id);
}

/**
 * Journey Registry object for convenient access to all journey functions
 */
export const journeyRegistry = {
  getJourney,
  getAvailableJourneys,
  getAllJourneys,
  isJourneyAvailable,
  getJourneyConfig,
  JOURNEYS,
};
