/**
 * Framework Result Types
 * Discriminated unions for all strategic framework outputs
 */

import type { FrameworkName } from './journey-types';

// Re-export for convenience
export type { FrameworkName } from './journey-types';

/**
 * Base Framework Result
 */
export interface BaseFrameworkResult {
  framework: FrameworkName;
  executedAt?: string;
  confidence?: number;
}

/**
 * Business Model Canvas Result
 */
export interface BMCBlock {
  blockName: string;
  description: string;
  keyFindings: string[];
  confidence: number;
  strategicImplications: string[];
  identifiedGaps: string[];
  researchQueries: string[];
}

export interface BMCFrameworkResult extends BaseFrameworkResult {
  framework: 'bmc';
  blocks: BMCBlock[];
  overallConfidence: number;
  viability: string;
  keyInsights: string[];
  criticalGaps: string[];
  consistencyChecks: string[];
  recommendations: string[];
  contradictions?: any[];
  sources?: Array<{
    url: string;
    title: string;
    relevance_score: number;
  }>;
}

/**
 * Porter's Five Forces Result
 */
export interface PorterForce {
  level: string;
  factors: string[] | Array<{ factor: string; citations?: string[] }>;
  strategic_response: string;
  confidence?: 'high' | 'medium' | 'low';
  insufficientData?: boolean;
}

export interface PortersFrameworkResult extends BaseFrameworkResult {
  framework: 'porters';
  competitive_rivalry: PorterForce;
  supplier_power: PorterForce;
  buyer_power: PorterForce;
  threat_of_substitution: PorterForce;
  threat_of_new_entry: PorterForce;
  overall_attractiveness: string;
  key_strategic_priorities?: string[];
  confidenceScore?: number;
  confidenceExplanation?: string;
  citations?: Array<{
    url: string;
    title: string;
    relevance_score: number;
  }>;
  recommendations?: Array<{
    text: string;
    rationale: string;
    citations: string[];
  }>;
}

/**
 * Five Whys Result
 */
export interface FiveWhysFrameworkResult extends BaseFrameworkResult {
  framework: 'five_whys';
  problem_statement: string;
  why_1: { question: string; answer: string };
  why_2: { question: string; answer: string };
  why_3: { question: string; answer: string };
  why_4: { question: string; answer: string };
  why_5: { question: string; answer: string };
  root_cause: string;
  strategic_implications: string[];
}

/**
 * PESTLE Analysis Result (Future)
 */
export interface PESTLEFrameworkResult extends BaseFrameworkResult {
  framework: 'pestle';
  political: string[];
  economic: string[];
  social: string[];
  technological: string[];
  legal: string[];
  environmental: string[];
  keyTrends?: string[];
  strategicImplications?: string[];
}

/**
 * SWOT Analysis Result (Future)
 */
export interface SWOTFrameworkResult extends BaseFrameworkResult {
  framework: 'swot';
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  strategicRecommendations?: string[];
}

/**
 * Discriminated Union of All Framework Results
 */
export type FrameworkResult = 
  | BMCFrameworkResult
  | PortersFrameworkResult
  | FiveWhysFrameworkResult
  | PESTLEFrameworkResult
  | SWOTFrameworkResult;

/**
 * Version Analysis Container
 * Contains all framework results for a strategy version
 */
export interface VersionAnalysis {
  frameworks: FrameworkResult[];
  executiveSummary?: string;
  recommendedApproaches?: string[];
  recommendedMarket?: string;
  research?: {
    findings?: any;
    sources?: any[];
    validation?: any[];
  };
}

/**
 * Framework Metadata
 */
export interface FrameworkMetadata {
  name: FrameworkName;
  displayName: string;
  description: string;
  icon: string;
  estimatedDuration: string;
}

/**
 * Framework metadata registry
 */
export const FRAMEWORK_METADATA: Record<FrameworkName, FrameworkMetadata> = {
  five_whys: {
    name: 'five_whys',
    displayName: 'Five Whys',
    description: 'Root cause analysis through iterative questioning',
    icon: '🎯',
    estimatedDuration: '2-3 minutes',
  },
  bmc: {
    name: 'bmc',
    displayName: 'Business Model Canvas',
    description: 'Comprehensive business model design and validation',
    icon: '📊',
    estimatedDuration: '5-7 minutes',
  },
  porters: {
    name: 'porters',
    displayName: "Porter's Five Forces",
    description: 'Industry competitive dynamics analysis',
    icon: '⚔️',
    estimatedDuration: '4-6 minutes',
  },
  pestle: {
    name: 'pestle',
    displayName: 'PESTLE Analysis',
    description: 'External macro-environmental factors',
    icon: '🌍',
    estimatedDuration: '5-7 minutes',
  },
  swot: {
    name: 'swot',
    displayName: 'SWOT Analysis',
    description: 'Strengths, weaknesses, opportunities, and threats',
    icon: '📈',
    estimatedDuration: '3-5 minutes',
  },
  ansoff: {
    name: 'ansoff',
    displayName: 'Ansoff Matrix',
    description: 'Growth strategy matrix for market/product expansion',
    icon: '📐',
    estimatedDuration: '3-4 minutes',
  },
  blue_ocean: {
    name: 'blue_ocean',
    displayName: 'Blue Ocean Strategy',
    description: 'Value innovation and uncontested market space',
    icon: '🌊',
    estimatedDuration: '6-8 minutes',
  },
};
