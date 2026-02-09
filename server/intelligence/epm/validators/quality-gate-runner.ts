import { ValidatorRegistry, QualityReport, validatorRegistry } from './validator-registry';
import { ValidatorContext } from './base-validator';
import { DependencyValidator } from './dependency-validator';
import { IndustryValidator } from './industry-validator';
import { CompletenessValidator } from './completeness-validator';
import type { Workstream, Timeline, StageGates } from '../../types';

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
    
    this.initialized = true;
    console.log('[QualityGateRunner] Initialized with validators:', this.registry.list().join(', '));
  }
  
  runQualityGate(
    workstreams: Workstream[],
    timeline: Timeline,
    stageGates: StageGates,
    businessContext?: string
  ): QualityReport {
    if (!this.initialized) {
      this.initialize();
    }
    
    const context: ValidatorContext = {
      workstreams,
      timeline,
      stageGates,
      businessContext,
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
    businessContext?: string
  ): QualityReport {
    if (!this.initialized) {
      this.initialize();
    }
    
    const context: ValidatorContext = {
      workstreams,
      timeline,
      stageGates,
      businessContext,
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
