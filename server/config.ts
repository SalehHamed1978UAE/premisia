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
 * @returns true if FEATURE_KNOWLEDGE_GRAPH env var is set to 'true' AND required DB extensions exist
 */
export function isKnowledgeGraphEnabled(): boolean {
  if (process.env.FEATURE_KNOWLEDGE_GRAPH !== 'true') {
    return false;
  }
  
  // Also check if pg_trgm extension is available (required for PostgreSQL insights)
  try {
    const { getExtensionStatus } = require('./db-init');
    const status = getExtensionStatus();
    
    // If extensions haven't been checked yet, assume enabled (will fail gracefully later)
    if (!status) {
      return true;
    }
    
    // Require pg_trgm for knowledge graph features
    return status.pg_trgm === true;
  } catch {
    // If db-init module isn't loaded yet, assume enabled
    return true;
  }
}

/**
 * Check if Neo4j is properly configured
 * @returns true if NEO4J_URI and NEO4J_PASSWORD are set
 */
export function isNeo4jConfigured(): boolean {
  return Boolean(process.env.NEO4J_URI && process.env.NEO4J_PASSWORD);
}

/**
 * Check if cross-journey EPM domain resilience is enabled.
 *
 * Enables:
 * - Domain profile propagation through EPM generation
 * - Domain-aware role skill injection guards
 * - Timeline utilization coverage safeguards
 * - Additional quality gates for lexicon/timeline consistency
 */
export function isEPMDomainResilienceEnabled(): boolean {
  const raw = process.env.EPM_DOMAIN_RESILIENCE_V1;
  if (raw === undefined) {
    // Default-on for safety: disable explicitly with EPM_DOMAIN_RESILIENCE_V1=false if needed.
    return true;
  }
  return raw === 'true';
}
