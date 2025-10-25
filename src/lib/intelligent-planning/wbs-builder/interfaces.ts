/**
 * Core interfaces for the WBS Builder modular architecture
 * Provides contracts for all components in the pipeline
 */

import { PlanningContext } from '../types';

/**
 * Initiative type classification for pattern matching
 */
export type InitiativeType = 
  | 'business_launch'         // Opening physical businesses (coffee shop, restaurant)
  | 'software_development'    // Building software products (SaaS, platforms)
  | 'digital_transformation'  // Digitizing existing businesses
  | 'market_expansion'        // Entering new markets
  | 'product_launch'          // Launching new products
  | 'general';                // Fallback for unclassified

/**
 * Technology's role in the business
 */
export type TechnologyRole = 
  | 'core_product'          // Technology IS the product (SaaS)
  | 'operational_tool'      // Technology supports operations (POS system)
  | 'minimal';              // Minimal technology needs

/**
 * Business intent analysis result
 */
export interface BusinessIntent {
  initiativeType: InitiativeType;
  technologyRole: TechnologyRole;
  businessModel: string;
  primaryValueCreation: string;
  isPhysical: boolean;
  isDigital: boolean;
  confidence: number;
}

/**
 * Work stream category with effort proportion
 */
export interface WorkStreamCategory {
  category: string;
  weight: number;           // Percentage of total effort (0-100)
  priority: 'critical' | 'high' | 'medium' | 'low';
  description?: string;
}

/**
 * Pattern for generating work streams based on initiative type
 */
export interface WorkStreamPattern {
  initiativeType: InitiativeType;
  streams: WorkStreamCategory[];
  totalWeight?: number;      // Should sum to ~100
}

/**
 * Generated work stream with deliverables
 */
export interface WorkStream {
  id: string;
  name: string;
  category: string;
  description: string;
  proportionalEffort: number;  // Percentage
  priority: 'critical' | 'high' | 'medium' | 'low';
  deliverables: string[];
  dependencies: string[];
  confidence: number;
}

/**
 * Complete WBS output
 */
export interface WBS {
  intent: BusinessIntent;
  pattern: WorkStreamPattern;
  workstreams: WorkStream[];
  confidence: number;
  validationReport: ValidationResult;
}

/**
 * Validation result from semantic validator
 */
export interface ValidationResult {
  isValid: boolean;
  coherenceScore: number;      // 0-1
  issues: ValidationIssue[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Individual validation issue
 */
export interface ValidationIssue {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  affectedStreams: string[];
}

/**
 * Input for business analysis stage
 */
export interface AnalysisInput {
  insights: any;
  context: PlanningContext;
}

/**
 * Input for optimization stage
 */
export interface OptimizationInput {
  pattern: WorkStreamPattern;
  context: PlanningContext;
  insights: any;
}

/**
 * Input for validation stage
 */
export interface ValidationInput {
  objective: string;
  context: PlanningContext;
  workstreams: WorkStream[];
}

/**
 * Generic pipeline stage interface
 */
export interface IPipelineStage<TIn = any, TOut = any> {
  name: string;
  process(input: TIn): Promise<TOut>;
  validate?(input: TIn): Promise<boolean>;
}

/**
 * Business analyzer - understands what the business actually does
 */
export interface IAnalyzer extends IPipelineStage<AnalysisInput, BusinessIntent> {}

/**
 * Pattern provider - selects appropriate work breakdown pattern
 */
export interface IPatternProvider extends IPipelineStage<BusinessIntent, WorkStreamPattern> {}

/**
 * Stream optimizer - converts pattern weights into concrete workstreams
 */
export interface IOptimizer extends IPipelineStage<OptimizationInput, WorkStream[]> {}

/**
 * Semantic validator - ensures workstreams match business intent
 */
export interface IValidator extends IPipelineStage<ValidationInput, ValidationResult> {}

/**
 * Pattern plugin - extensible pattern for different initiative types
 */
export interface IPatternPlugin {
  type: InitiativeType;
  name: string;
  analyze(context: BusinessIntent): Promise<WorkStreamPattern>;
  validate(streams: WorkStream[]): Promise<boolean>;
}

/**
 * Main WBS Builder interface
 */
export interface IWBSBuilder {
  buildWBS(insights: any, context: PlanningContext): Promise<WBS>;
}

/**
 * LLM Provider interface for WBS Builder
 */
export interface ILLMProvider {
  generateStructured<T>(request: {
    prompt: string;
    schema: any;
  }): Promise<T>;
}
