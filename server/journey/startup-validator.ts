/**
 * Startup Validator
 * 
 * Validates the entire journey system at server startup.
 * FAILS the server if any required components are missing.
 * 
 * This ensures we never ship broken journeys that would fail at runtime.
 */

import { frameworkRegistry } from './framework-executor-registry';
import { getAvailableJourneys, getJourney } from './journey-registry';
import type { JourneyType } from '@shared/journey-types';

// ─────────────────────────────────────────────────────────────────────────────
// BRIDGE REGISTRY (Simple registry of available bridges)
// ─────────────────────────────────────────────────────────────────────────────

const registeredBridges = new Set<string>();

/**
 * Register a bridge (call this when defining bridges)
 */
export function registerBridge(fromModule: string, toModule: string): void {
  const bridgeId = `${fromModule}_to_${toModule}`;
  registeredBridges.add(bridgeId);
  console.log(`[Bridge Registry] ✓ Registered bridge: ${bridgeId}`);
}

/**
 * Check if a bridge exists
 */
export function hasBridge(fromModule: string, toModule: string): boolean {
  return registeredBridges.has(`${fromModule}_to_${toModule}`);
}

/**
 * Get all registered bridges
 */
export function getRegisteredBridges(): string[] {
  return Array.from(registeredBridges);
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION RESULT
// ─────────────────────────────────────────────────────────────────────────────

export interface StartupValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    journeysChecked: number;
    executorsRegistered: number;
    bridgesRegistered: number;
    missingExecutors: string[];
    missingBridges: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN BRIDGE REQUIREMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Define which module pairs REQUIRE bridges for proper data flow.
 * These are cognitive transformations, not just data passing.
 */
const REQUIRED_BRIDGES: Array<{ from: string; to: string; journeyTypes: JourneyType[] }> = [
  // Market Entry Journey: PESTLE → Porter's → SWOT
  { from: 'pestle', to: 'porters', journeyTypes: ['market_entry', 'competitive_strategy'] },
  { from: 'porters', to: 'swot', journeyTypes: ['market_entry', 'competitive_strategy'] },
  
  // BMI Journey: Five Whys → BMC
  { from: 'five_whys', to: 'bmc', journeyTypes: ['business_model_innovation'] },
  
  // SWOT → Decisions (for all journeys that use SWOT)
  { from: 'swot', to: 'strategic_decisions', journeyTypes: ['market_entry', 'competitive_strategy'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN VALIDATION FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate the entire journey system.
 * Call this at server startup AFTER registering all executors and bridges.
 * 
 * @throws Error if validation fails (prevents server from starting)
 */
export function validateJourneySystem(options: { 
  throwOnError?: boolean;
  logOutput?: boolean;
} = {}): StartupValidationResult {
  const { throwOnError = true, logOutput = true } = options;
  
  if (logOutput) {
    console.log('\n[Startup Validator] ════════════════════════════════════════════');
    console.log('[Startup Validator] Validating journey system...\n');
  }
  
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingExecutors: string[] = [];
  const missingBridges: string[] = [];
  
  const availableJourneys = getAvailableJourneys();
  const registeredFrameworks = new Set(frameworkRegistry.getRegisteredFrameworks());
  
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Check all journeys have their required executors
  // ─────────────────────────────────────────────────────────────────────────
  
  if (logOutput) {
    console.log('[Startup Validator] Checking executor registration...');
  }
  
  for (const journey of availableJourneys) {
    for (const framework of journey.frameworks) {
      if (!registeredFrameworks.has(framework)) {
        const error = `Journey "${journey.name}" (${journey.type}) requires executor "${framework}" which is not registered`;
        errors.push(error);
        if (!missingExecutors.includes(framework)) {
          missingExecutors.push(framework);
        }
      }
    }
  }
  
  if (missingExecutors.length === 0 && logOutput) {
    console.log(`[Startup Validator] ✓ All ${availableJourneys.length} journey(s) have registered executors`);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 2. Check bridges exist for required module pairs
  // ─────────────────────────────────────────────────────────────────────────
  
  if (logOutput) {
    console.log('[Startup Validator] Checking bridge registration...');
  }
  
  for (const bridgeReq of REQUIRED_BRIDGES) {
    // Check if any active journey needs this bridge
    const needsBridge = availableJourneys.some(j => 
      bridgeReq.journeyTypes.includes(j.type as JourneyType) &&
      j.frameworks.includes(bridgeReq.from as any) &&
      j.frameworks.includes(bridgeReq.to as any)
    );
    
    if (needsBridge && !hasBridge(bridgeReq.from, bridgeReq.to)) {
      const bridgeId = `${bridgeReq.from}_to_${bridgeReq.to}`;
      warnings.push(`Missing bridge ${bridgeId} required for journeys: ${bridgeReq.journeyTypes.join(', ')}`);
      if (!missingBridges.includes(bridgeId)) {
        missingBridges.push(bridgeId);
      }
    }
  }
  
  // Also check sequential modules in each journey
  for (const journey of availableJourneys) {
    for (let i = 0; i < journey.frameworks.length - 1; i++) {
      const from = journey.frameworks[i];
      const to = journey.frameworks[i + 1];
      
      // Check if there's a dependency relationship
      const dependency = journey.dependencies?.find(d => d.from === from && d.to === to);
      if (dependency && !hasBridge(from, to)) {
        const bridgeId = `${from}_to_${to}`;
        const warning = `Journey "${journey.name}" has dependency ${from} → ${to} but no bridge registered`;
        if (!warnings.includes(warning)) {
          warnings.push(warning);
        }
        if (!missingBridges.includes(bridgeId)) {
          missingBridges.push(bridgeId);
        }
      }
    }
  }
  
  if (missingBridges.length === 0 && logOutput) {
    console.log(`[Startup Validator] ✓ All required bridges registered (${registeredBridges.size} total)`);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 3. Validate journey definitions
  // ─────────────────────────────────────────────────────────────────────────
  
  if (logOutput) {
    console.log('[Startup Validator] Validating journey definitions...');
  }
  
  for (const journey of availableJourneys) {
    // Check for empty framework lists
    if (!journey.frameworks || journey.frameworks.length === 0) {
      errors.push(`Journey "${journey.name}" has no frameworks defined`);
    }
    
    // Check for missing dependencies array (should at least be empty)
    if (journey.dependencies === undefined) {
      warnings.push(`Journey "${journey.name}" has no dependencies array defined`);
    }
    
    // Check for missing summary builder
    if (!journey.summaryBuilder) {
      warnings.push(`Journey "${journey.name}" has no summaryBuilder defined`);
    }
  }
  
  if (logOutput) {
    console.log(`[Startup Validator] ✓ Journey definitions validated`);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 4. Build result
  // ─────────────────────────────────────────────────────────────────────────
  
  const result: StartupValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      journeysChecked: availableJourneys.length,
      executorsRegistered: registeredFrameworks.size,
      bridgesRegistered: registeredBridges.size,
      missingExecutors,
      missingBridges,
    },
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // 5. Output results
  // ─────────────────────────────────────────────────────────────────────────
  
  if (logOutput) {
    console.log('\n[Startup Validator] ────────────────────────────────────────────');
    console.log(`[Startup Validator] Summary:`);
    console.log(`  Journeys checked: ${result.summary.journeysChecked}`);
    console.log(`  Executors registered: ${result.summary.executorsRegistered}`);
    console.log(`  Bridges registered: ${result.summary.bridgesRegistered}`);
    
    if (warnings.length > 0) {
      console.log('\n[Startup Validator] ⚠️ Warnings:');
      warnings.forEach(w => console.log(`  - ${w}`));
    }
    
    if (errors.length > 0) {
      console.error('\n[Startup Validator] ❌ ERRORS:');
      errors.forEach(e => console.error(`  - ${e}`));
    }
    
    console.log('[Startup Validator] ════════════════════════════════════════════\n');
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 6. Throw if errors and throwOnError is true
  // ─────────────────────────────────────────────────────────────────────────
  
  if (!result.valid && throwOnError) {
    throw new Error(
      `STARTUP ERROR: Journey system validation failed with ${errors.length} error(s):\n` +
      errors.map(e => `  - ${e}`).join('\n') +
      '\n\nFix these issues before the server can start.'
    );
  }
  
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER ALL BRIDGES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register all known bridges.
 * Call this after importing bridge modules.
 */
export function registerAllBridges(): void {
  console.log('[Startup Validator] Registering bridges...');
  
  // Five Whys → BMC (existing)
  registerBridge('five_whys', 'bmc');
  
  // PESTLE → Porter's (Market Entry)
  registerBridge('pestle', 'porters');
  
  // Porter's → SWOT (Market Entry)
  registerBridge('porters', 'swot');
  
  // Five Whys → SWOT (Crisis Recovery)
  registerBridge('five_whys', 'swot');
  
  // SWOT → BMC (Crisis Recovery)
  registerBridge('swot', 'bmc');
  
  // Porter's → BMC (Competitive Strategy)
  registerBridge('porters', 'bmc');
  
  // BMC → Blue Ocean (Competitive Strategy)
  registerBridge('bmc', 'blue_ocean');
  
  // PESTLE → BMC (Digital Transformation)
  registerBridge('pestle', 'bmc');
  
  // BMC → Ansoff (Digital Transformation)
  registerBridge('bmc', 'ansoff');
  
  console.log(`[Startup Validator] ✓ Registered ${registeredBridges.size} bridge(s)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Validate single journey
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a single journey (useful for runtime checks)
 */
export function validateSingleJourney(journeyType: JourneyType): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const journey = getJourney(journeyType);
    const registeredFrameworks = new Set(frameworkRegistry.getRegisteredFrameworks());
    
    // Check executors
    for (const framework of journey.frameworks) {
      if (!registeredFrameworks.has(framework)) {
        errors.push(`Missing executor for framework: ${framework}`);
      }
    }
    
    // Check bridges
    for (let i = 0; i < journey.frameworks.length - 1; i++) {
      const from = journey.frameworks[i];
      const to = journey.frameworks[i + 1];
      
      const dependency = journey.dependencies?.find(d => d.from === from && d.to === to);
      if (dependency && !hasBridge(from, to)) {
        warnings.push(`Missing bridge: ${from} → ${to}`);
      }
    }
    
    return { valid: errors.length === 0, errors, warnings };
  } catch (error) {
    return {
      valid: false,
      errors: [`Journey "${journeyType}" not found or invalid`],
      warnings: [],
    };
  }
}
