/**
 * EPM Submodules - Modular components for EPM synthesis
 * 
 * This module re-exports all EPM component generators:
 * - ContextBuilder: Infers business context from insights
 * - EPMValidator: Validates and auto-corrects EPM data
 * - TimelineCalculator: Generates timelines and phases
 * - WorkstreamGenerator: Creates workstreams from insights
 * - ResourceAllocator: Handles resource planning
 * - Various generators for EPM components
 */

export { ContextBuilder, default as ContextBuilderDefault } from './context-builder';
export { EPMValidator, default as EPMValidatorDefault } from './validator';
export { TimelineCalculator, default as TimelineCalculatorDefault } from './timeline-calculator';
export { WorkstreamGenerator, default as WorkstreamGeneratorDefault } from './workstream-generator';
export { ResourceAllocator, default as ResourceAllocatorDefault } from './resource-allocator';
export { AssignmentGenerator, default as AssignmentGeneratorDefault } from './assignment-generator';
export { RoleInferenceService, normalizeRole, ensureResourceExists, inferSkillsFromCategory } from './role-inference';

export {
  ExecutiveSummaryGenerator,
  FinancialPlanGenerator,
  BenefitsGenerator,
  RiskGenerator,
  StageGateGenerator,
  KPIGenerator,
  StakeholderGenerator,
  GovernanceGenerator,
  QAPlanGenerator,
  ProcurementGenerator,
  ExitStrategyGenerator,
  ProgramNameGenerator,
} from './generators';

export type {
  StrategyInsights,
  StrategyInsight,
  Workstream,
  Deliverable,
  Timeline,
  TimelinePhase,
  ResourcePlan,
  ResourceAllocation,
  ExternalResource,
  RiskRegister,
  Risk,
  StageGates,
  BenefitsRealization,
  Benefit,
  ExecutiveSummary,
  FinancialPlan,
  KPIs,
  StakeholderMap,
  Governance,
  QAPlan,
  Procurement,
  ExitStrategy,
} from '../types';

export type { UserContext } from '../../types/interfaces';
