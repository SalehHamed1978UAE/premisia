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
