/**
 * Bridge Contract
 * Based on MODULE_FACTORY_SPECIFICATION.md Part 3
 * 
 * Bridges are NOT just data transformation. They perform cognitive interpretation.
 * Each bridge transforms one module's output for the next module's consumption.
 */

import { z } from 'zod';
import { Positioning } from './common.schemas';

// =============================================================================
// BRIDGE CONTEXT
// =============================================================================

export interface BridgeContext {
  positioning: Positioning;
  allPriorOutputs: Record<string, unknown>;
  sessionId: string;
  journeyType: string;
}

// =============================================================================
// VALIDATION RESULT
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

// =============================================================================
// INTERPRETATION RULE
// =============================================================================

/**
 * An interpretation rule defines how to transform one piece of data cognitively
 */
export interface InterpretationRule {
  id: string;
  description: string;
  
  /** Source field path (e.g., 'factors.legal') */
  sourceField: string;
  
  /** Target field path (e.g., 'forceContext.threatOfNewEntrants') */
  targetField: string;
  
  /** Human-readable explanation of the transformation logic */
  interpretation: string;
  
  /** Example transformation */
  example: {
    source: unknown;
    target: unknown;
    explanation: string;
  };
}

// =============================================================================
// BRIDGE CONTRACT
// =============================================================================

/**
 * The contract every bridge must fulfill
 */
export interface BridgeContract<TFrom, TTo> {
  // ─────────────────────────────────────────────────────────────────────────
  // IDENTITY
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Unique identifier (e.g., 'pestle_to_porters') */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Source module ID */
  fromModule: string;
  
  /** Target module ID */
  toModule: string;
  
  /** Description of what this bridge does */
  description: string;

  // ─────────────────────────────────────────────────────────────────────────
  // CONTRACTS
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Schema for source output */
  fromSchema: z.ZodSchema<TFrom>;
  
  /** Schema for produced input enhancement */
  toSchema: z.ZodSchema<TTo>;

  // ─────────────────────────────────────────────────────────────────────────
  // TRANSFORMATION
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Transform source output to target input enhancement */
  transform: (from: TFrom, context: BridgeContext) => Promise<TTo>;
  
  /** Interpretation rules for this bridge */
  interpretationRules: InterpretationRule[];

  // ─────────────────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Validate the source output before transformation */
  validateSource: (from: TFrom) => ValidationResult;
  
  /** Validate the transformed output */
  validateTransformation: (from: TFrom, to: TTo) => ValidationResult;
}

// =============================================================================
// BRIDGE REGISTRY
// =============================================================================

const bridgeRegistry = new Map<string, BridgeContract<any, any>>();

/**
 * Register a bridge
 */
export function registerBridge<TFrom, TTo>(bridge: BridgeContract<TFrom, TTo>): void {
  const key = `${bridge.fromModule}_to_${bridge.toModule}`;
  bridgeRegistry.set(key, bridge);
  console.log(`[Bridge Registry] Registered bridge: ${bridge.id} (${bridge.fromModule} → ${bridge.toModule})`);
}

/**
 * Get a bridge by source and target module
 */
export function getBridge<TFrom, TTo>(
  fromModule: string,
  toModule: string
): BridgeContract<TFrom, TTo> | undefined {
  const key = `${fromModule}_to_${toModule}`;
  return bridgeRegistry.get(key);
}

/**
 * List all registered bridges
 */
export function listBridges(): { id: string; from: string; to: string }[] {
  return Array.from(bridgeRegistry.values()).map(b => ({
    id: b.id,
    from: b.fromModule,
    to: b.toModule,
  }));
}

/**
 * Check if a bridge exists
 */
export function hasBridge(fromModule: string, toModule: string): boolean {
  const key = `${fromModule}_to_${toModule}`;
  return bridgeRegistry.has(key);
}

// =============================================================================
// HELPER: Create a bridge with defaults
// =============================================================================

export function createBridge<TFrom, TTo>(
  config: Partial<BridgeContract<TFrom, TTo>> &
    Pick<BridgeContract<TFrom, TTo>, 'id' | 'fromModule' | 'toModule' | 'fromSchema' | 'toSchema' | 'transform'>
): BridgeContract<TFrom, TTo> {
  return {
    name: config.name || `${config.fromModule} → ${config.toModule}`,
    description: config.description || `Transforms ${config.fromModule} output for ${config.toModule}`,
    interpretationRules: config.interpretationRules || [],
    
    validateSource: config.validateSource || ((from) => {
      const result = config.fromSchema.safeParse(from);
      return {
        valid: result.success,
        errors: result.success ? undefined : [result.error.message],
      };
    }),
    
    validateTransformation: config.validateTransformation || (() => ({
      valid: true,
    })),
    
    ...config,
  };
}
