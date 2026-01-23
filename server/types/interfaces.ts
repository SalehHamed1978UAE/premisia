/**
 * Base Interfaces for Modular Service Architecture
 * 
 * These interfaces define contracts for exporters and analyzers,
 * enabling consistent implementations and dependency injection.
 */

import type { Response } from 'express';
import type { EPMProgram } from './epm';

export type { EPMProgram };

/**
 * Export request containing all necessary data for generating exports
 */
export interface ExportRequest {
  sessionId: string;
  versionNumber?: number;
  programId?: string;
  userId: string;
}

/**
 * Full export package containing all strategic and EPM data
 */
export interface FullExportPackage {
  metadata: {
    exportedAt: string;
    sessionId: string;
    versionNumber?: number;
    programId?: string;
    exportedBy: string;
  };
  strategy: {
    understanding?: any;
    journeySession?: any;
    strategyVersion?: any;
    decisions?: any[];
    fiveWhysTree?: any;
    whysPath?: any[];
    clarifications?: {
      questions?: any[];
      answers?: Record<string, string>;
    };
  };
  epm?: {
    program?: any;
    assignments?: any[];
  };
}

/**
 * Export result from an exporter
 */
export interface ExportResult {
  filename: string;
  content: Buffer | string;
  mimeType: string;
  success: boolean;
  error?: string;
}

/**
 * Base interface for all exporters
 */
export interface IExporter {
  readonly name: string;
  readonly format: string;
  readonly mimeType: string;
  
  /**
   * Generate export from the package data
   */
  export(pkg: FullExportPackage): Promise<ExportResult>;
  
  /**
   * Check if this exporter is available in the current environment
   */
  isAvailable(): boolean;
}

/**
 * Strategy insights used for EPM synthesis
 */
export interface StrategyInsights {
  frameworkType: string;
  frameworkRunId?: string;
  insights: StrategyInsight[];
  marketContext?: {
    industry?: string;
    region?: string;
    competitors?: string[];
  };
  overallConfidence?: number;
}

export interface StrategyInsight {
  type: string;
  content: string;
  confidence: number;
  source?: string;
  metadata?: Record<string, any>;
}

/**
 * User context for EPM synthesis
 */
export interface UserContext {
  userId: string;
  sessionId?: string;
  organizationId?: string;
  preferences?: Record<string, any>;
}

/**
 * Synthesis result from EPM synthesizer
 */
export interface SynthesisResult {
  program: EPMProgram;
  success: boolean;
  confidence: number;
  warnings?: string[];
  errors?: string[];
}

/**
 * Synthesis options
 */
export interface SynthesisOptions {
  forceIntelligentPlanning?: boolean;
  onProgress?: (event: any) => void;
  initiativeType?: string;
}

/**
 * Base interface for EPM synthesizers
 */
export interface IEPMSynthesizer {
  /**
   * Synthesize a complete EPM program from strategic insights
   */
  synthesize(
    insights: StrategyInsights,
    userContext?: UserContext,
    namingContext?: any,
    options?: SynthesisOptions
  ): Promise<EPMProgram>;
}

/**
 * Base interface for workstream generators
 */
export interface IWorkstreamGenerator {
  generate(insights: StrategyInsights, userContext?: UserContext): Promise<any[]>;
}

/**
 * Base interface for timeline calculators
 */
export interface ITimelineCalculator {
  calculate(
    insights: StrategyInsights,
    workstreams: any[],
    userContext?: UserContext
  ): Promise<any>;
}

/**
 * Base interface for resource allocators
 */
export interface IResourceAllocator {
  allocate(
    insights: StrategyInsights,
    workstreams: any[],
    userContext?: UserContext,
    initiativeType?: string
  ): Promise<any>;
}

/**
 * Validation result from EPM validator
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  corrections: string[];
}

/**
 * Base interface for EPM validators
 */
export interface IEPMValidator {
  validate(
    workstreams: any[],
    timeline: any,
    stageGates: any
  ): ValidationResult;
}

/**
 * Context builder result
 */
export interface PlanningContext {
  business: {
    name: string;
    type: string;
    industry: string;
    description: string;
    scale: 'smb' | 'mid_market' | 'enterprise';
    initiativeType?: string;
  };
  strategic: {
    insights: StrategyInsights;
    constraints: string[];
    objectives: string[];
  };
  execution: {
    timeline: { min: number; max: number };
    budget?: { min: number; max: number };
    resources: any[];
  };
  meta: {
    journeyType: string;
    confidence: number;
    version: string;
  };
}

/**
 * Base interface for context builders
 */
export interface IContextBuilder {
  fromJourneyInsights(
    insights: StrategyInsights,
    journeyType?: string,
    sessionId?: string
  ): Promise<PlanningContext>;
}

/**
 * Service registration keys for DI container
 */
export const ServiceKeys = {
  // Exporters
  MARKDOWN_EXPORTER: 'exporter:markdown',
  HTML_EXPORTER: 'exporter:html',
  PDF_EXPORTER: 'exporter:pdf',
  DOCX_EXPORTER: 'exporter:docx',
  CSV_EXPORTER: 'exporter:csv',
  EXPORT_ORCHESTRATOR: 'exporter:orchestrator',
  
  // EPM Components
  EPM_SYNTHESIZER: 'epm:synthesizer',
  CONTEXT_BUILDER: 'epm:context-builder',
  WORKSTREAM_GENERATOR: 'epm:workstream-generator',
  TIMELINE_CALCULATOR: 'epm:timeline-calculator',
  RESOURCE_ALLOCATOR: 'epm:resource-allocator',
  EPM_VALIDATOR: 'epm:validator',
  
  // Other services
  SSE_PROGRESS_MANAGER: 'service:sse-progress',
} as const;
