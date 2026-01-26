/**
 * Strategic Journey Types
 * Defines the core interfaces for multi-framework strategic analysis journeys
 */

/**
 * Strategic Context - The accumulating envelope of insights across frameworks
 * This context flows through the entire journey, getting enriched by each framework
 */
export interface StrategicContext {
  // Core identification
  understandingId: string;
  sessionId: string;
  userInput: string;
  
  // Journey metadata
  journeyType: JourneyType;
  currentFrameworkIndex: number;
  completedFrameworks: string[];
  
  // Accumulated insights from all frameworks
  insights: {
    // Five Whys results
    rootCauses?: string[];
    whysPath?: string[];
    strategicImplications?: string[];
    
    // BMC results
    businessModelGaps?: string[];
    bmcBlocks?: Record<string, any>;
    bmcContradictions?: any[];
    
    // Porter's results  
    portersForces?: Record<string, any>;
    competitivePressures?: string[];
    
    // PESTLE results
    trendFactors?: Record<string, any>;
    externalForces?: string[];
    
    // Cross-framework synthesis
    criticalRisks?: string[];
    keyOpportunities?: string[];
    strategicConstraints?: string[];
    
    // Bridge outputs - passed between frameworks
    bmcDesignConstraints?: {
      problemsToSolve: string[];
      mustHaveCapabilities: string[];
      designPrinciples: string[];
      contextualBackground: string;
    };
  };
  
  // Shared market research (reused across frameworks)
  marketResearch?: {
    sources?: any[];
    keyFindings?: string[];
    contradictions?: any[];
  };
  
  // Final decisions (generated after all frameworks complete)
  decisions?: {
    recommended?: string[];
    alternatives?: string[];
    rejected?: string[];
  };
  
  // Baseline summary from previous journey (for follow-on runs)
  baselineSummary?: JourneySummary;
  
  // Marketing Consultant context (for segment discovery)
  marketingContext?: {
    offeringType?: string;           // b2b_saas, physical_product, etc.
    stage?: string;                  // idea_stage, launched, growth, etc.
    gtmConstraint?: string;          // small_team, bootstrapped, etc.
    salesMotion?: string;            // self_serve, sales_led, etc.
    existingHypothesis?: string;     // Optional existing target segment idea
  };
  
  // Progress callback for real-time updates
  onProgress?: (step: string, progress: number) => void;
  
  // Journey execution metadata
  createdAt: Date;
  updatedAt: Date;
  status: JourneyStatus;
}

/**
 * Journey Status - Tracks where we are in the journey execution
 */
export type JourneyStatus = 
  | 'initializing'      // Just created, not started yet
  | 'in_progress'       // Currently executing frameworks
  | 'paused'            // User paused the journey
  | 'completed'         // All frameworks executed, decisions generated
  | 'failed';           // Journey execution failed

/**
 * Journey Types - The 7 pre-planned strategic journeys
 */
export type JourneyType =
  | 'market_entry'              // Market Entry Strategy
  | 'business_model_innovation' // Business Model Innovation
  | 'competitive_strategy'      // Competitive Strategy
  | 'digital_transformation'    // Digital Transformation
  | 'crisis_recovery'           // Crisis Recovery
  | 'growth_strategy'           // Growth Strategy
  | 'market_segmentation'       // Market Segmentation Discovery (Marketing Consultant)
  | 'custom';                   // Custom wizard-created journeys

/**
 * Framework Names - Individual strategic analysis frameworks
 * Core (implemented): five_whys, bmc, segment_discovery
 * Competitive & Market: porters, pestle, swot, competitive_positioning
 * Growth & Innovation: ansoff, blue_ocean, ocean_strategy, bcg_matrix
 * Internal Analysis: value_chain, vrio
 * Future Planning: scenario_planning
 * Customer & Product: jobs_to_be_done
 * Execution: okr_generator
 */
export type FrameworkName =
  // Core (implemented)
  | 'five_whys'               // Root cause analysis
  | 'bmc'                     // Business Model Canvas
  | 'segment_discovery'       // Marketing Consultant segment discovery
  // Competitive & Market Analysis
  | 'porters'                 // Porter's Five Forces
  | 'pestle'                  // PESTLE analysis
  | 'swot'                    // SWOT analysis
  | 'competitive_positioning' // Competitive positioning maps
  // Growth & Innovation Strategy
  | 'ansoff'                  // Ansoff Matrix
  | 'blue_ocean'              // Blue Ocean Strategy
  | 'ocean_strategy'          // Ocean Strategy Mapping (Red, Blue, Green, White)
  | 'bcg_matrix'              // BCG Growth-Share Matrix
  // Internal Analysis
  | 'value_chain'             // Value Chain Analysis
  | 'vrio'                    // VRIO Analysis
  // Future Planning
  | 'scenario_planning'       // Scenario Planning
  // Customer & Product
  | 'jobs_to_be_done'         // Jobs To Be Done framework
  // Execution
  | 'okr_generator';          // OKR Generator

/**
 * Journey Definition - Defines which frameworks run in which order
 */
export interface JourneyDefinition {
  type: JourneyType;
  name: string;
  description: string;
  frameworks: FrameworkName[];
  pageSequence?: string[];    // Optional: Interactive pages for this journey
  estimatedDuration: string;  // e.g., "10-15 minutes"
  available: boolean;          // Whether this journey is implemented
  summaryBuilder: string;     // Which summarization routine to use (e.g., 'fiveWhysBmc', 'pestlePorters')
  defaultReadiness: {         // Readiness thresholds for this journey
    minReferences: number;
    minEntities: number;
  };
  insightsConfig: {           // Framework-specific configuration requirements
    requiresFiveWhys?: boolean;
    requiresBmc?: boolean;
  };
  dependencies: Array<{       // Framework dependencies defining data flow
    from: FrameworkName;
    to: FrameworkName;
  }>;
}

/**
 * Framework Result - Output from a single framework execution
 */
export interface FrameworkResult {
  frameworkName: FrameworkName;
  executedAt: Date;
  duration: number; // milliseconds
  data: any;        // Framework-specific output
  errors?: string[];
}

/**
 * Journey Progress - Real-time progress information for UI
 */
export interface JourneyProgress {
  currentFramework: FrameworkName;
  frameworkIndex: number;
  totalFrameworks: number;
  percentComplete: number;
  status: string;
  estimatedTimeRemaining?: string;
  userInputRequired?: boolean;
  redirectUrl?: string;
}

/**
 * Journey Summary - Compact summary of completed journey for follow-on runs
 * This is stored encrypted in the journey_sessions.summary field
 */
export interface JourneySummary {
  journeyType: JourneyType;
  completedAt: string;
  versionNumber: number;
  keyInsights: string[];
  frameworks: {
    [frameworkName: string]: any;
  };
  strategicImplications: string[];
}

// =============================================================================
// Journey Builder Types (User-Composable Framework System)
// =============================================================================

/**
 * Journey Builder Step - A single framework step in a custom journey
 */
export interface JourneyStep {
  id: string;
  frameworkKey: string;
  name: string;
  description?: string;
  required: boolean;
  skippable: boolean;
  dependsOn?: string[]; // IDs of steps that must complete first
  estimatedDuration?: number; // minutes
  order: number;
}

/**
 * Journey Builder Template - Pre-defined or custom journey blueprint
 */
export interface JourneyTemplate {
  id: string;
  name: string;
  description?: string;
  isSystemTemplate: boolean;
  createdBy?: string;
  steps: JourneyStep[];
  category?: string;
  tags?: string[];
  estimatedDuration?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  usageCount: number;
  version: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Journey Instance - Active execution of a journey template
 */
export interface UserJourney {
  id: string;
  userId: string;
  sessionId: string;
  templateId?: string;
  name: string;
  steps: JourneyStep[];
  currentStepIndex: number;
  status: 'in_progress' | 'completed' | 'paused' | 'abandoned';
  completedSteps: string[]; // Step IDs
  stepResults: Record<string, any>; // Step ID -> result data
  journeyContext: Record<string, any>; // Shared context across steps
  startedAt: Date;
  completedAt?: Date;
  lastActivityAt: Date;
}

/**
 * Framework Registry Entry - User-selectable framework definition
 */
export interface Framework {
  id: string;
  frameworkKey: string;
  name: string;
  description?: string;
  category?: string;
  estimatedDuration?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  requiredInputs: string[];
  providedOutputs: string[];
  isActive: boolean;
  version: string;
  processorPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Journey Validation Result - Information completeness check for EPM
 */
export interface ValidationResult {
  isValid: boolean;
  hasRequiredInfo: boolean;
  missingInformation: string[];
  warnings: string[];
  recommendations: string[];
  informationCollected: string[];
}
