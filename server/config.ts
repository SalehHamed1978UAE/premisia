/**
 * Server Configuration
 * Centralized configuration and feature flags
 */

/**
 * Check if Journey Registry V2 features are enabled
 * This includes:
 * - Journey summaries saved/loaded from completed runs
 * - Dynamic readiness thresholds from journey registry
 * - Summary display in Journey Launcher modal
 * 
 * When false (default), uses legacy behavior:
 * - No summary operations
 * - Hardcoded readiness thresholds
 * - No summary display in UI
 * 
 * @returns true if FEATURE_JOURNEY_REGISTRY_V2 env var is set to 'true'
 */
export function isJourneyRegistryV2Enabled(): boolean {
  return process.env.FEATURE_JOURNEY_REGISTRY_V2 === 'true';
}

/**
 * Check if Knowledge Graph (Neo4j) features are enabled
 * This includes:
 * - Pushing golden records to Neo4j after JSON persistence
 * - Similar strategies recommendations
 * - Applicable incentives lookup
 * 
 * When false (default), knowledge graph operations are skipped
 * 
 * @returns true if FEATURE_KNOWLEDGE_GRAPH env var is set to 'true'
 */
export function isKnowledgeGraphEnabled(): boolean {
  return process.env.FEATURE_KNOWLEDGE_GRAPH === 'true';
}

/**
 * Check if Neo4j is properly configured
 * @returns true if NEO4J_URI and NEO4J_PASSWORD are set
 */
export function isNeo4jConfigured(): boolean {
  return Boolean(process.env.NEO4J_URI && process.env.NEO4J_PASSWORD);
}
