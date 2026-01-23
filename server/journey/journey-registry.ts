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
