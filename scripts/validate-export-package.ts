#!/usr/bin/env node

/**
 * EPM Export Package Validator
 *
 * This validation gate prevents bad EPM outputs from being exported.
 * It implements the 10-point validation checklist to ensure quality.
 *
 * Usage:
 *   ts-node scripts/validate-export-package.ts <path-to-epm-package.json>
 *
 * Exit codes:
 *   0 - Validation passed
 *   1 - Validation failed
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
}

interface EPMPackage {
  workstreams?: any[];
  timeline?: any;
  resources?: any;
  resourcePlan?: any;
  financialPlan?: any;
  stageGates?: any[];
  metadata?: any;
  risks?: any[];
  benefits?: any[];
  kpis?: any[];
  userInput?: any;
  userInputStructured?: {
    raw?: string | null;
    summary?: string | null;
    constraints?: {
      costMin?: number | null;
      costMax?: number | null;
      teamSizeMin?: number | null;
      teamSizeMax?: number | null;
      timelineMonths?: number | null;
      inputSummary?: string | null;
    } | null;
    clarifications?: any[] | null;
    initiativeType?: string | null;
  };
  requiresApproval?: boolean;
  executiveSummary?: any;
}

class EPMPackageValidator {
  private errors: string[] = [];
  private warnings: string[] = [];
  private score = 100;

  /**
   * Main validation entry point
   */
  validate(packagePath: string): ValidationResult {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                     EPM EXPORT PACKAGE VALIDATOR                            ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    if (!fs.existsSync(packagePath)) {
      this.errors.push(`Package file not found: ${packagePath}`);
      return this.getResult();
    }

    let epmPackage: EPMPackage;
    try {
      const content = fs.readFileSync(packagePath, 'utf-8');
      epmPackage = JSON.parse(content);
    } catch (error: any) {
      this.errors.push(`Failed to parse package: ${error.message}`);
      return this.getResult();
    }

    // Run all validation checks
    console.log('📋 Running validation checks...\n');

    this.check1_WorkstreamsExist(epmPackage);
    this.check2_TimelineValidity(epmPackage);
    this.check3_DependencyIntegrity(epmPackage);
    this.check4_ResourceAllocation(epmPackage);
    this.check5_MilestoneSequencing(epmPackage);
    this.check6_ProgressCalculation(epmPackage);
    this.check7_DomainKnowledge(epmPackage);
    this.check8_DataCompleteness(epmPackage);
    this.check9_LogicalCoherence(epmPackage);
    this.check10_ExportReadiness(epmPackage);

    // NEW: Agent-2 Quality Enhancement Checks
    this.check11_ResourceOverallocation(epmPackage);
    this.check12_KPICompleteness(epmPackage);
    this.check13_GenericDeliverables(epmPackage);
    this.check14_RiskCoverage(epmPackage);
    this.check15_BudgetConsistency(epmPackage);

    return this.getResult();
  }

  /**
   * Check 1: Workstreams exist and have valid structure
   */
  private check1_WorkstreamsExist(pkg: EPMPackage): void {
    console.log('✓ Check 1: Workstream Structure');

    if (!pkg.workstreams || !Array.isArray(pkg.workstreams)) {
      this.addError('No workstreams found in package', 20);
      return;
    }

    if (pkg.workstreams.length === 0) {
      this.addError('Workstreams array is empty', 20);
      return;
    }

    pkg.workstreams.forEach((ws, idx) => {
      if (!ws.id) this.addError(`Workstream ${idx + 1} missing ID`, 5);
      if (!ws.name) this.addError(`Workstream ${idx + 1} missing name`, 5);
      if (!ws.deliverables || ws.deliverables.length === 0) {
        this.addWarning(`Workstream "${ws.name || idx}" has no deliverables`);
      }
    });
  }

  /**
   * Check 2: Timeline validity
   */
  private check2_TimelineValidity(pkg: EPMPackage): void {
    console.log('✓ Check 2: Timeline Validity');

    if (!pkg.workstreams) return;

    pkg.workstreams.forEach(ws => {
      // Check for zero timelines (the bug we found)
      if (ws.startMonth === 0 && ws.endMonth === 0) {
        this.addError(`Workstream "${ws.name}" has invalid timeline (all zeros)`, 15);
      }

      // Check timeline logic
      if (ws.startMonth > ws.endMonth) {
        this.addError(`Workstream "${ws.name}" ends before it starts`, 10);
      }

      // Check deliverable timelines
      if (ws.deliverables) {
        ws.deliverables.forEach((d: any) => {
          if (d.dueMonth === 0) {
            this.addError(`Deliverable "${d.name}" has invalid due month (0)`, 5);
          }
          if (d.dueMonth < ws.startMonth || d.dueMonth > ws.endMonth) {
            this.addWarning(`Deliverable "${d.name}" due outside workstream timeline`);
          }
        });
      }
    });
  }

  /**
   * Check 3: Dependency integrity
   */
  private check3_DependencyIntegrity(pkg: EPMPackage): void {
    console.log('✓ Check 3: Dependency Integrity');

    if (!pkg.workstreams) return;

    const wsIds = new Set(pkg.workstreams.map(ws => ws.id));

    pkg.workstreams.forEach(ws => {
      if (ws.dependencies && ws.dependencies.length > 0) {
        ws.dependencies.forEach((depId: string) => {
          if (!wsIds.has(depId)) {
            this.addError(`Workstream "${ws.name}" depends on non-existent workstream "${depId}"`, 10);
          }
        });

        // Check for circular dependencies
        if (this.hasCircularDependency(ws.id, pkg.workstreams)) {
          this.addError(`Circular dependency detected involving "${ws.name}"`, 15);
        }
      }
    });
  }

  /**
   * Check 4: Resource allocation
   */
  private check4_ResourceAllocation(pkg: EPMPackage): void {
    console.log('✓ Check 4: Resource Allocation');

    // Check financial plan (NEW schema location)
    const financialPlan = pkg.financialPlan;
    if (!financialPlan || !financialPlan.totalBudget || financialPlan.totalBudget === 0) {
      this.addWarning('No budget allocated in financial plan');
    }

    // Check resource allocations
    const resourcePlan = pkg.resourcePlan;
    const resources = pkg.resources;

    if (!resourcePlan && !resources) {
      this.addWarning('No resource plan found');
      return;
    }

    // Validate internal team allocations
    const internalTeam = resourcePlan?.internalTeam || [];
    const externalResources = resourcePlan?.externalResources || [];
    const totalResources = internalTeam.length + externalResources.length;

    if (totalResources === 0 && (!resources || resources.length === 0)) {
      this.addWarning('No resource allocations defined');
    }
  }

  /**
   * Check 5: Milestone sequencing
   */
  private check5_MilestoneSequencing(pkg: EPMPackage): void {
    console.log('✓ Check 5: Milestone Sequencing');

    const rawStageGates = pkg.stageGates as any;
    const stageGatesList = Array.isArray(rawStageGates)
      ? rawStageGates
      : (Array.isArray(rawStageGates?.gates) ? rawStageGates.gates : null);

    if (!stageGatesList || stageGatesList.length === 0) {
      this.addWarning('No stage gates/milestones defined');
      return;
    }

    // Check milestone ordering
    const sorted = [...stageGatesList].sort((a, b) => a.month - b.month);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].month === sorted[i + 1].month) {
        this.addWarning(`Multiple milestones at month ${sorted[i].month}`);
      }
    }
  }

  /**
   * Check 6: Progress calculation (detect LLM hallucinations)
   */
  private check6_ProgressCalculation(pkg: EPMPackage): void {
    console.log('✓ Check 6: Progress Calculation');

    // Check if descriptions contain percentage values (likely hallucinated)
    const percentageRegex = /\b\d{1,3}%\s*(complete|progress|done)/gi;

    pkg.workstreams?.forEach(ws => {
      if (ws.description && percentageRegex.test(ws.description)) {
        this.addError(`Workstream "${ws.name}" contains hallucinated progress percentage`, 10);
      }

      ws.deliverables?.forEach((d: any) => {
        if (d.description && percentageRegex.test(d.description)) {
          this.addError(`Deliverable "${d.name}" contains hallucinated progress percentage`, 5);
        }
      });
    });
  }

  /**
   * Check 7: Domain knowledge (restaurant-specific for this example)
   */
  private check7_DomainKnowledge(pkg: EPMPackage): void {
    console.log('✓ Check 7: Domain Knowledge Validation');

    // Check for restaurant-specific requirements if applicable
    const isRestaurant = pkg.metadata?.domain === 'restaurant' ||
                        pkg.metadata?.businessType?.toLowerCase().includes('restaurant');

    if (isRestaurant) {
      const requiredPhases = ['permits', 'construction', 'equipment', 'staffing', 'training'];
      const foundPhases = new Set<string>();

      pkg.workstreams?.forEach(ws => {
        const wsLower = ws.name.toLowerCase();
        requiredPhases.forEach(phase => {
          if (wsLower.includes(phase)) foundPhases.add(phase);
        });
      });

      const missing = requiredPhases.filter(p => !foundPhases.has(p));
      if (missing.length > 0) {
        this.addWarning(`Restaurant project missing critical phases: ${missing.join(', ')}`);
      }
    }
  }

  /**
   * Check 8: Data completeness
   */
  private check8_DataCompleteness(pkg: EPMPackage): void {
    console.log('✓ Check 8: Data Completeness');

    // Check for empty or placeholder values
    const placeholderPatterns = [
      /^(tbd|tba|todo|xxx|placeholder|temp|test)/i,
      /^to be (determined|defined|decided)/i,
      /^\[.*\]$/,  // Bracketed placeholders
      /^<.*>$/,    // Angle bracket placeholders
    ];

    pkg.workstreams?.forEach(ws => {
      placeholderPatterns.forEach(pattern => {
        if (pattern.test(ws.name)) {
          this.addError(`Workstream contains placeholder text: "${ws.name}"`, 5);
        }
        if (ws.description && pattern.test(ws.description)) {
          this.addWarning(`Workstream "${ws.name}" description contains placeholder text`);
        }
      });
    });
  }

  /**
   * Check 9: Logical coherence
   */
  private check9_LogicalCoherence(pkg: EPMPackage): void {
    console.log('✓ Check 9: Logical Coherence');

    if (!pkg.workstreams) return;

    // Check that dependent workstreams start after their dependencies
    pkg.workstreams.forEach(ws => {
      if (ws.dependencies && ws.dependencies.length > 0) {
        ws.dependencies.forEach((depId: string) => {
          const dep = pkg.workstreams?.find(w => w.id === depId);
          if (dep && dep.endMonth >= ws.startMonth) {
            this.addWarning(
              `Workstream "${ws.name}" may start before dependency "${dep.name}" completes`
            );
          }
        });
      }
    });

    // Check for reasonable project duration
    const maxEnd = Math.max(...pkg.workstreams.map(ws => ws.endMonth || 0));
    if (maxEnd > 36) {
      this.addWarning(`Project duration exceeds 3 years (${maxEnd} months)`);
    }
    if (maxEnd < 3) {
      this.addWarning(`Project duration seems too short (${maxEnd} months)`);
    }
  }

  /**
   * Check 10: Export readiness
   */
  private check10_ExportReadiness(pkg: EPMPackage): void {
    console.log('✓ Check 10: Export Readiness');

    // Final checks before allowing export
    if (!pkg.metadata) {
      this.addError('Missing metadata', 5);
    }

    if (!pkg.metadata?.sessionId) {
      this.addError('Missing session ID in metadata', 5);
    }

    if (!pkg.metadata?.generatedAt) {
      this.addWarning('Missing generation timestamp');
    }

    // Check minimum viable content
    const wsCount = pkg.workstreams?.length || 0;
    const deliverableCount = pkg.workstreams?.reduce(
      (sum, ws) => sum + (ws.deliverables?.length || 0), 0
    ) || 0;

    if (wsCount < 3) {
      this.addError(`Insufficient workstreams (${wsCount} < 3)`, 10);
    }

    if (deliverableCount < wsCount * 2) {
      this.addWarning(`Low deliverable count (${deliverableCount} for ${wsCount} workstreams)`);
    }
  }

  /**
   * Check 11: Resource Overallocation (Agent-2 Enhancement)
   * Detects impossible resource schedules where resources are allocated >100%
   */
  private check11_ResourceOverallocation(pkg: EPMPackage): void {
    console.log('✓ Check 11: Resource Overallocation');

    const resourcePlan = pkg.resourcePlan || pkg.resources;
    if (!resourcePlan) {
      this.addWarning('No resource plan found for overallocation check');
      return;
    }

    // Check internal team resources
    const internalResources = resourcePlan.internalTeam || [];
    internalResources.forEach((resource: any) => {
      const allocation = resource.totalAllocation || resource.allocation;
      if (allocation && allocation > 100) {
        this.addError(
          `Resource "${resource.role || resource.name}" overallocated at ${allocation}% (>100%)`,
          15
        );
      }
    });

    // Check external resources if present
    const externalResources = resourcePlan.externalResources || [];
    externalResources.forEach((resource: any) => {
      const allocation = resource.totalAllocation || resource.allocation;
      if (allocation && allocation > 100) {
        this.addWarning(
          `External resource "${resource.type || resource.name}" overallocated at ${allocation}%`
        );
      }
    });
  }

  /**
   * Check 12: KPI Completeness (Agent-2 Enhancement)
   * Ensures KPIs are complete sentences with defined baselines and metrics
   */
  private check12_KPICompleteness(pkg: EPMPackage): void {
    console.log('✓ Check 12: KPI Completeness');

    const kpis = pkg.kpis || [];
    if (kpis.length === 0) {
      this.addWarning('No KPIs defined in package');
      return;
    }

    kpis.forEach((kpi: any, idx: number) => {
      const name = kpi.name || kpi.kpi || '';

      // Check for truncated KPIs (ends with "to", "from", "by", etc.)
      if (name.match(/\s+(to|from|by|for|with)$/i)) {
        this.addError(`KPI ${idx + 1} appears truncated: "${name}"`, 10);
      }

      // Check for too-short KPIs (< 10 chars)
      if (name.length < 10) {
        this.addWarning(`KPI ${idx + 1} is very short: "${name}"`);
      }

      // Check for undefined baseline references
      const target = kpi.target || '';
      if (target.toLowerCase().includes('baseline') && !target.match(/from\s+[\d.]+/i)) {
        this.addWarning(`KPI ${idx + 1} references undefined baseline: "${target}"`);
      }

      // Check for vague percentage targets without metrics
      if (target.match(/^\+?\d+%/) && !name.match(/(revenue|cost|time|quality|satisfaction|adoption)/i)) {
        this.addWarning(`KPI ${idx + 1} has percentage target but unclear metric: "${name}"`);
      }
    });
  }

  /**
   * Check 13: Generic Deliverables (Agent-2 Enhancement)
   * Detects template language and non-specific deliverable descriptions
   */
  private check13_GenericDeliverables(pkg: EPMPackage): void {
    console.log('✓ Check 13: Generic Deliverables');

    if (!pkg.workstreams || pkg.workstreams.length === 0) {
      return; // Already caught by check1
    }

    const genericPatterns = [
      /^decision\s+execution\s+plan$/i,
      /^implementation\s+roadmap$/i,
      /^resource\s+alignment$/i,
      /^a\s+(comprehensive|detailed|strategic)\s+(document|plan|report|strategy)/i,
      /^(develop|create|implement|build|design|establish)\s+\w+\s*$/i,
    ];

    const vagueWords = ['various', 'several', 'appropriate', 'relevant', 'multiple'];

    pkg.workstreams.forEach((ws: any) => {
      const deliverables = ws.deliverables || [];

      deliverables.forEach((d: any, idx: number) => {
        const name = (d.name || d.deliverable || '').trim();
        const description = (d.description || '').trim();

        // Check against generic patterns
        for (const pattern of genericPatterns) {
          if (name.match(pattern)) {
            this.addWarning(
              `Generic deliverable in ${ws.name || ws.id}: "${name}"`
            );
            break;
          }
        }

        // Check for vague words
        for (const vague of vagueWords) {
          if (name.toLowerCase().includes(vague) || description.toLowerCase().includes(vague)) {
            this.addWarning(
              `Vague language in deliverable "${name}": contains "${vague}"`
            );
            break;
          }
        }

        // Check for very short deliverables without specifics
        if (name.length < 10 && !name.match(/\d/)) {
          this.addWarning(`Very short deliverable without specifics: "${name}"`);
        }
      });
    });
  }

  /**
   * Check 14: Risk Coverage (Agent-2 Enhancement)
   * Ensures minimum risk coverage and mitigation quality
   */
  private check14_RiskCoverage(pkg: EPMPackage): void {
    console.log('✓ Check 14: Risk Coverage');

    const risks = pkg.risks || [];
    const wsCount = pkg.workstreams?.length || 0;

    // Minimum risk threshold: at least 1 risk per 2 workstreams
    const minRisks = Math.ceil(wsCount / 2);
    if (risks.length < minRisks) {
      this.addWarning(`Low risk coverage: ${risks.length} risks for ${wsCount} workstreams (expected ≥${minRisks})`);
    }

    // Check mitigation quality
    const genericMitigations = [
      /^monitor\s+(closely|regularly)/i,
      /^regular\s+(reviews|meetings)/i,
      /^develop\s+\w+\s+strategy$/i,
      /^implement\s+\w+\s+plan$/i,
    ];

    const mitigationTexts = new Map<string, string[]>();

    risks.forEach((risk: any, idx: number) => {
      const mitigation = (risk.mitigation || risk.mitigationStrategy || '').trim();

      // Check for generic mitigations
      for (const pattern of genericMitigations) {
        if (mitigation.match(pattern)) {
          this.addWarning(`Generic mitigation for risk ${idx + 1}: "${mitigation}"`);
          break;
        }
      }

      // Check for duplicate/copy-pasted mitigations
      if (mitigation.length > 20) {
        const existing = mitigationTexts.get(mitigation);
        if (existing) {
          existing.push(`Risk ${idx + 1}`);
        } else {
          mitigationTexts.set(mitigation, [`Risk ${idx + 1}`]);
        }
      }
    });

    // Report duplicates
    for (const [mitigation, riskIds] of mitigationTexts.entries()) {
      if (riskIds.length > 1) {
        this.addWarning(
          `Duplicate mitigation across ${riskIds.join(', ')}: "${mitigation.substring(0, 50)}..."`
        );
      }
    }
  }

  /**
   * Check 15: Budget Consistency (Agent-2 Enhancement)
   * Validates EPM budget matches user input constraints
   */
  private check15_BudgetConsistency(pkg: EPMPackage): void {
    console.log('✓ Check 15: Budget Consistency');

    const financialPlan = pkg.financialPlan;
    if (!financialPlan) {
      this.addWarning('No financial plan found for budget consistency check');
      return;
    }

    const epmBudget = financialPlan.totalBudget || financialPlan.total;
    if (!epmBudget) {
      this.addWarning('EPM budget not defined in financial plan');
      return;
    }

    // Extract budget constraints from structured user input (NEW)
    const constraints = pkg.userInputStructured?.constraints || pkg.metadata?.constraints;
    let userBudgetMin = constraints?.costMin;
    let userBudgetMax = constraints?.costMax;

    // Fallback: try to extract from legacy userInput field
    if (!userBudgetMin && !userBudgetMax) {
      const userInput = pkg.userInput || pkg.executiveSummary;
      if (userInput?.budget) {
        userBudgetMin = userInput.budget;
        userBudgetMax = userInput.budget;
      } else if (typeof userInput === 'string') {
        const budgetMatch = userInput.match(/\$?([\d.]+)\s*(m|million|k|thousand)/i);
        if (budgetMatch) {
          const amount = parseFloat(budgetMatch[1]);
          const unit = budgetMatch[2].toLowerCase();
          const parsed = unit.startsWith('m') ? amount * 1000000 : amount * 1000;
          userBudgetMin = parsed;
          userBudgetMax = parsed;
        }
      }
    }

    // Validate against constraints
    if (userBudgetMin && epmBudget < userBudgetMin * 0.7) {
      this.addError(
        `EPM budget ($${(epmBudget / 1000000).toFixed(2)}M) significantly below minimum constraint ($${(userBudgetMin / 1000000).toFixed(2)}M)`,
        10
      );
    }

    if (userBudgetMax && epmBudget > userBudgetMax * 1.2) {
      this.addWarning(
        `EPM budget ($${(epmBudget / 1000000).toFixed(2)}M) exceeds maximum constraint ($${(userBudgetMax / 1000000).toFixed(2)}M) by ${(((epmBudget / userBudgetMax) - 1) * 100).toFixed(0)}%`
      );
    }

    // Check if EPM is within specified range
    if (userBudgetMin && userBudgetMax && (epmBudget < userBudgetMin || epmBudget > userBudgetMax)) {
      this.addWarning(
        `EPM budget ($${(epmBudget / 1000000).toFixed(2)}M) outside constraint range ($${(userBudgetMin / 1000000).toFixed(2)}M - $${(userBudgetMax / 1000000).toFixed(2)}M)`
      );
    }
  }

  /**
   * Helper: Check for circular dependencies
   */
  private hasCircularDependency(wsId: string, workstreams: any[], visited = new Set<string>()): boolean {
    if (visited.has(wsId)) return true;
    visited.add(wsId);

    const ws = workstreams.find(w => w.id === wsId);
    if (!ws || !ws.dependencies) return false;

    for (const depId of ws.dependencies) {
      if (this.hasCircularDependency(depId, workstreams, new Set(visited))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add error and deduct from score
   */
  private addError(message: string, penalty: number): void {
    this.errors.push(message);
    this.score = Math.max(0, this.score - penalty);
    console.log(`  ❌ ERROR: ${message} (-${penalty} points)`);
  }

  /**
   * Add warning (no score penalty)
   */
  private addWarning(message: string): void {
    this.warnings.push(message);
    console.log(`  ⚠️  WARNING: ${message}`);
  }

  /**
   * Get validation result
   */
  private getResult(): ValidationResult {
    const isValid = this.errors.length === 0 && this.score >= 70;

    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                           VALIDATION RESULTS                                ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝');
    console.log(`\n📊 Quality Score: ${this.score}/100`);
    console.log(`✅ Valid for Export: ${isValid ? 'YES' : 'NO'}`);
    console.log(`❌ Errors: ${this.errors.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);

    if (this.errors.length > 0) {
      console.log('\n🔴 ERRORS FOUND:');
      this.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n🟡 WARNINGS:');
      this.warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
    }

    if (!isValid) {
      console.log('\n❌ EXPORT BLOCKED: Package does not meet quality standards');
      console.log('Fix the errors above and re-run validation.');
    } else if (this.warnings.length > 0) {
      console.log('\n✅ EXPORT ALLOWED: Package meets minimum standards');
      console.log('Consider addressing warnings for better quality.');
    } else {
      console.log('\n✅ EXCELLENT: Package passes all quality checks!');
    }

    return {
      isValid,
      errors: this.errors,
      warnings: this.warnings,
      score: this.score
    };
  }
}

// CLI execution (ESM-safe)
const isMain = (() => {
  try {
    const entry = process.argv[1];
    if (!entry) return false;
    const current = fileURLToPath(import.meta.url);
    return path.resolve(entry) === path.resolve(current);
  } catch {
    return false;
  }
})();

if (isMain) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: ts-node scripts/validate-export-package.ts <path-to-epm-package.json>');
    process.exit(1);
  }

  const validator = new EPMPackageValidator();
  const result = validator.validate(args[0]);

  // Exit with appropriate code
  process.exit(result.isValid ? 0 : 1);
}

export { EPMPackageValidator };
export type { ValidationResult };
