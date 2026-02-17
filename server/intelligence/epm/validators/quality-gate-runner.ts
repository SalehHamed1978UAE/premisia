import { ValidatorRegistry, QualityReport, validatorRegistry } from './validator-registry';
import { ValidatorContext } from './base-validator';
import { DependencyValidator } from './dependency-validator';
import { IndustryValidator } from './industry-validator';
import { CompletenessValidator } from './completeness-validator';
import { WBSTimelineValidator } from './wbs-timeline-validator';
import { DomainLexiconValidator } from './domain-lexicon-validator';
import { TimelineUtilizationValidator } from './timeline-utilization-validator';
import { WorkstreamSemanticAlignmentValidator } from './workstream-semantic-alignment-validator';
import { WorkstreamNameUniquenessValidator } from './workstream-name-uniqueness-validator';
import { KPIQualityValidator } from './kpi-quality-validator';
import type { Workstream, Timeline, StageGates, ResourcePlan, DomainProfile } from '../../types';
import type { KPI } from '../../types';

export class QualityGateRunner {
  private registry: ValidatorRegistry;
  private initialized = false;
  
  constructor(registry?: ValidatorRegistry) {
    this.registry = registry || validatorRegistry;
  }
  
  initialize(): void {
    if (this.initialized) return;

    this.registry.register(new DependencyValidator());
    this.registry.register(new IndustryValidator());
    this.registry.register(new CompletenessValidator());
    this.registry.register(new WBSTimelineValidator());
    this.registry.register(new DomainLexiconValidator());
    this.registry.register(new TimelineUtilizationValidator());
    this.registry.register(new WorkstreamSemanticAlignmentValidator());
    this.registry.register(new WorkstreamNameUniquenessValidator());
    this.registry.register(new KPIQualityValidator());

    this.initialized = true;
    console.log('[QualityGateRunner] Initialized with validators:', this.registry.list().join(', '));
  }
  
  runQualityGate(
    workstreams: Workstream[],
    timeline: Timeline,
    stageGates: StageGates,
    businessContext?: string,
    resourcePlan?: ResourcePlan,
    domainProfile?: DomainProfile,
    kpis?: KPI[]
  ): QualityReport {
    if (!this.initialized) {
      this.initialize();
    }
    
    const context: ValidatorContext = {
      workstreams,
      timeline,
      stageGates,
      businessContext,
      resourcePlan,
      domainProfile,
      kpis,
    };
    
    console.log('[QualityGateRunner] Running quality gate with', this.registry.list().length, 'validators');
    const report = this.registry.runAll(context);
    
    this.logReport(report);
    return report;
  }
  
  runSelectedValidators(
    workstreams: Workstream[],
    timeline: Timeline,
    stageGates: StageGates,
    validatorNames: string[],
    businessContext?: string,
    resourcePlan?: ResourcePlan,
    domainProfile?: DomainProfile,
    kpis?: KPI[]
  ): QualityReport {
    if (!this.initialized) {
      this.initialize();
    }
    
    const context: ValidatorContext = {
      workstreams,
      timeline,
      stageGates,
      businessContext,
      resourcePlan,
      domainProfile,
      kpis,
    };
    
    const report = this.registry.runSelected(context, validatorNames);
    this.logReport(report);
    return report;
  }
  
  private logReport(report: QualityReport): void {
    const status = report.overallPassed ? '✅ PASSED' : '❌ FAILED';
    console.log(`[QualityGateRunner] Quality Gate ${status}`);
    console.log(`  - Total issues: ${report.totalIssues} (${report.errorCount} errors, ${report.warningCount} warnings, ${report.infoCount} info)`);
    console.log(`  - Duration: ${report.durationMs}ms`);
    
    if (report.corrections.length > 0) {
      console.log(`  - Auto-corrections: ${report.corrections.length}`);
    }
    
    for (const result of report.validatorResults) {
      const icon = result.passed ? '✓' : '✗';
      console.log(`    ${icon} ${result.validatorName}: ${result.issues.length} issues`);
    }
  }
  
  getAvailableValidators(): string[] {
    if (!this.initialized) {
      this.initialize();
    }
    return this.registry.list();
  }
}

export const qualityGateRunner = new QualityGateRunner();
