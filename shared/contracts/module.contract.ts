/**
 * Module Contract
 * Based on MODULE_FACTORY_SPECIFICATION.md Part 2
 * 
 * Every module MUST implement this interface.
 */

import { z } from 'zod';

// =============================================================================
// QUALITY CRITERION
// =============================================================================

export interface QualityCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;  // 0-1, all weights sum to 1
  
  rubric: {
    score1to3: string;
    score4to6: string;
    score7to8: string;
    score9to10: string;
  };
  
  redFlags: string[];
}

// =============================================================================
// RESEARCH QUERY
// =============================================================================

export interface ResearchQuery {
  query: string;
  purpose: string;
  requiredSourceTypes?: string[];
  maxAge?: string;
}

// =============================================================================
// EXECUTION CONTEXT
// =============================================================================

export interface ExecutionContext {
  sessionId: string;
  journeyId?: string;
  journeyType: string;
  
  // Positioning (ALWAYS present after positioning module runs)
  positioning?: z.infer<typeof import('./positioning.schema').PositioningOutputSchema>;
  
  // Prior module outputs (keyed by module ID)
  priorOutputs: Record<string, unknown>;
  
  // Research findings
  research?: {
    queries: string[];
    findings: unknown[];
    sources: { url?: string; title: string; date?: string; type?: string }[];
  };
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
// MODULE CONTRACT
// =============================================================================

/**
 * The contract every module must fulfill
 */
export interface ModuleContract<TInput, TOutput> {
  // ─────────────────────────────────────────────────────────────────────────
  // IDENTITY
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Unique identifier (e.g., 'pestle', 'porters', 'swot') */
  id: string;
  
  /** Human-readable name (e.g., 'PESTLE Analysis') */
  name: string;
  
  /** What this module does */
  description: string;
  
  /** Semantic version */
  version: string;
  
  /** Module category */
  category: 'positioning' | 'analysis' | 'synthesis' | 'decision' | 'execution';

  // ─────────────────────────────────────────────────────────────────────────
  // CONTRACTS
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Zod schema for input validation */
  inputSchema: z.ZodSchema<TInput>;
  
  /** Zod schema for output validation */
  outputSchema: z.ZodSchema<TOutput>;

  // ─────────────────────────────────────────────────────────────────────────
  // DEPENDENCIES
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Modules that MUST run before this one */
  requiredDependencies: string[];
  
  /** Modules that CAN enhance this one (but aren't required) */
  optionalDependencies: string[];

  // ─────────────────────────────────────────────────────────────────────────
  // EXECUTION
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Validate inputs before execution */
  validateInput: (input: unknown) => ValidationResult;
  
  /** Validate outputs after execution */
  validateOutput: (output: unknown) => ValidationResult;
  
  /** Execute the module */
  execute: (input: TInput, context: ExecutionContext) => Promise<TOutput>;

  // ─────────────────────────────────────────────────────────────────────────
  // QUALITY
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Criteria for scoring output quality */
  qualityCriteria: QualityCriterion[];
  
  /** Minimum acceptable quality score (1-10) */
  minimumQualityScore: number;
  
  /** Score the quality of an output */
  scoreQuality: (output: TOutput) => {
    overallScore: number;
    details: { criterion: string; score: number; rationale: string }[];
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PROMPTS
  // ─────────────────────────────────────────────────────────────────────────
  
  /** System prompt for LLM */
  systemPrompt: string;
  
  /** User prompt template with {{variables}} */
  userPromptTemplate: string;

  // ─────────────────────────────────────────────────────────────────────────
  // RESEARCH (optional)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Generate research queries from input */
  generateResearchQueries?: (input: TInput) => ResearchQuery[];
}

// =============================================================================
// BASE MODULE IMPLEMENTATION HELPER
// =============================================================================

/**
 * Helper to create a module with defaults
 */
export function createModule<TInput, TOutput>(
  config: Partial<ModuleContract<TInput, TOutput>> & 
    Pick<ModuleContract<TInput, TOutput>, 'id' | 'name' | 'inputSchema' | 'outputSchema' | 'execute'>
): ModuleContract<TInput, TOutput> {
  return {
    description: config.description || `${config.name} module`,
    version: config.version || '1.0.0',
    category: config.category || 'analysis',
    requiredDependencies: config.requiredDependencies || [],
    optionalDependencies: config.optionalDependencies || [],
    qualityCriteria: config.qualityCriteria || [],
    minimumQualityScore: config.minimumQualityScore || 6,
    systemPrompt: config.systemPrompt || '',
    userPromptTemplate: config.userPromptTemplate || '',
    
    validateInput: config.validateInput || ((input) => {
      const result = config.inputSchema.safeParse(input);
      return {
        valid: result.success,
        errors: result.success ? undefined : [result.error.message],
      };
    }),
    
    validateOutput: config.validateOutput || ((output) => {
      const result = config.outputSchema.safeParse(output);
      return {
        valid: result.success,
        errors: result.success ? undefined : [result.error.message],
      };
    }),
    
    scoreQuality: config.scoreQuality || (() => ({
      overallScore: 7,
      details: [],
    })),
    
    ...config,
  };
}
