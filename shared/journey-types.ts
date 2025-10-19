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
 * Journey Types - The 6 pre-planned strategic journeys
 */
export type JourneyType =
  | 'market_entry'              // Market Entry Strategy
  | 'business_model_innovation' // Business Model Innovation
  | 'competitive_strategy'      // Competitive Strategy
  | 'digital_transformation'    // Digital Transformation
  | 'crisis_recovery'           // Crisis Recovery
  | 'growth_strategy';          // Growth Strategy

/**
 * Framework Names - Individual strategic analysis frameworks
 */
export type FrameworkName =
  | 'five_whys'          // Root cause analysis
  | 'bmc'                // Business Model Canvas
  | 'porters'            // Porter's Five Forces
  | 'pestle'             // PESTLE analysis
  | 'swot'               // SWOT (not yet implemented)
  | 'ansoff'             // Ansoff Matrix (not yet implemented)
  | 'blue_ocean';        // Blue Ocean Strategy (not yet implemented)

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
}
