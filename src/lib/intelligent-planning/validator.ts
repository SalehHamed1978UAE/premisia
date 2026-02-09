/**
 * @module planning/validators/llm-validator
 * LLM-based intelligent schedule validation and rationalization
 */

import { Schedule, ValidationResult, ValidationIssue, ScheduleScore } from './types';
import { IValidator, LLMProvider, RationalizationReport, RiskAssessment, Opportunity } from './interfaces';

export class LLMValidator implements IValidator {
  constructor(private llm: LLMProvider) {}
  
  /**
   * Main validation - uses LLM to deeply analyze the schedule
   */
  async validate(schedule: Schedule): Promise<ValidationResult> {
    // Get multiple perspectives on the schedule
    const [
      logicalAnalysis,
      dependencyAnalysis,
      resourceAnalysis,
      riskAnalysis,
      timelineAnalysis
    ] = await Promise.all([
      this.analyzeLogicalCoherence(schedule),
      this.analyzeDependencies(schedule),
      this.analyzeResourceAllocation(schedule),
      this.analyzeRisks(schedule),
      this.analyzeTimeline(schedule)
    ]);
    
    // Combine all issues
    const allIssues = [
      ...logicalAnalysis.issues,
      ...dependencyAnalysis.issues,
      ...resourceAnalysis.issues,
      ...riskAnalysis.issues,
      ...timelineAnalysis.issues
    ];
    
    // Calculate comprehensive score
    const score = this.calculateScore(
      logicalAnalysis.score,
      dependencyAnalysis.score,
      resourceAnalysis.score,
      riskAnalysis.score,
      timelineAnalysis.score
    );
    
    // Generate suggestions using LLM
    const suggestions = await this.generateSuggestions(schedule, allIssues);
    
    return {
      isValid: allIssues.filter(i => i.severity === 'critical').length === 0,
      issues: allIssues,
      score,
      suggestions
    };
  }
  
  /**
   * Deep rationalization - explains WHY the schedule makes sense (or doesn't)
   */
  async rationalize(schedule: Schedule): Promise<RationalizationReport> {
    const prompt = `
    Perform a deep rationalization analysis of this project schedule.
    
    Schedule Overview:
    - Total Duration: ${schedule.totalDuration} months
    - Number of Tasks: ${schedule.tasks.length}
    - Critical Path Length: ${schedule.criticalPath.length}
    - Start Date: ${schedule.startDate}
    - End Date: ${schedule.endDate}
    
    Task Details:
    ${JSON.stringify(schedule.tasks.map(t => ({
      name: t.name,
      duration: t.endDate.getTime() - t.startDate.getTime(),
      dependencies: t.dependencies,
      isCritical: t.isCritical,
      slack: t.slack
    })), null, 2)}
    
    Provide a comprehensive analysis covering:
    
    1. LOGICAL COHERENCE
    - Does the sequence of tasks make business/technical sense?
    - Are there any logical gaps or contradictions?
    - Rate coherence 0-100
    
    2. HIDDEN ASSUMPTIONS
    - What unstated assumptions is this schedule making?
    - Which assumptions are risky?
    - What could invalidate these assumptions?
    
    3. RISK ANALYSIS
    - What are the top 5 risks in this schedule?
    - For each risk: likelihood, impact, and mitigation strategy
    
    4. OPPORTUNITIES
    - Where could we compress the timeline?
    - What tasks could be parallelized?
    - Where might we be over-conservative?
    
    5. CRITICAL INSIGHTS
    - What patterns do you see that humans might miss?
    - Any red flags or concerns?
    - What would an experienced PM say about this?
    
    6. REASONING CHAIN
    - Step through the logic of why this schedule is structured this way
    - Explain the cause-and-effect relationships
    - Identify any circular reasoning or flawed logic
    
    Return as structured JSON.
    `;
    
    const response = await this.llm.generateStructured<RationalizationReport>({
      prompt,
      schema: {
        type: 'object',
        properties: {
          logicalCoherence: { type: 'number', minimum: 0, maximum: 100 },
          reasoning: { type: 'array', items: { type: 'string' } },
          assumptions: { type: 'array', items: { type: 'string' } },
          risks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                likelihood: { enum: ['low', 'medium', 'high'] },
                impact: { enum: ['low', 'medium', 'high'] },
                mitigation: { type: 'string' }
              }
            }
          },
          opportunities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                benefit: { type: 'string' },
                effort: { enum: ['low', 'medium', 'high'] },
                recommendation: { type: 'string' }
              }
            }
          },
          criticalInsights: { type: 'array', items: { type: 'string' } }
        }
      }
    });
    
    return response;
  }
  
  /**
   * Analyze logical coherence using LLM reasoning
   */
  private async analyzeLogicalCoherence(schedule: Schedule): Promise<{
    issues: ValidationIssue[];
    score: number;
  }> {
    const prompt = `
    Analyze the logical coherence of this task sequence:
    
    ${schedule.tasks.map(t => 
      `${t.name}: ${t.startDate.toLocaleDateString()} to ${t.endDate.toLocaleDateString()}, depends on: ${t.dependencies.join(', ') || 'none'}`
    ).join('\n')}
    
    Check for:
    1. Tasks that should logically depend on each other but don't
    2. Dependencies that don't make business sense
    3. Missing tasks (gaps in the logical flow)
    4. Redundant or unnecessary tasks
    5. Tasks in wrong sequence
    
    Return issues found and a coherence score (0-100).
    `;
    
    const response = await this.llm.generateStructured<{
      issues: Array<{
        type: string;
        message: string;
        severity: 'critical' | 'warning' | 'info';
        affectedTasks: string[];
        suggestedFix?: string;
      }>;
      coherenceScore: number;
    }>({
      prompt,
      schema: {
        type: 'object',
        properties: {
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                message: { type: 'string' },
                severity: { enum: ['critical', 'warning', 'info'] },
                affectedTasks: { type: 'array', items: { type: 'string' } },
                suggestedFix: { type: 'string' }
              }
            }
          },
          coherenceScore: { type: 'number', minimum: 0, maximum: 100 }
        }
      }
    });
    
    return {
      issues: response.issues,
      score: response.coherenceScore
    };
  }
  
  /**
   * Analyze dependencies for logical flaws
   */
  private async analyzeDependencies(schedule: Schedule): Promise<{
    issues: ValidationIssue[];
    score: number;
  }> {
    const prompt = `
    Analyze the dependency structure of this schedule.
    
    Tasks and their dependencies:
    ${JSON.stringify(schedule.tasks.map(t => ({
      id: t.id,
      name: t.name,
      dependencies: t.dependencies
    })), null, 2)}
    
    Check for:
    1. Circular dependencies
    2. Unnecessary dependencies (tasks that could be parallel)
    3. Missing critical dependencies
    4. Dependency chains that are too long
    5. Single points of failure
    
    Score the dependency structure (0-100) and list issues.
    `;
    
    const response = await this.llm.generateStructured<{
      issues: ValidationIssue[];
      score: number;
    }>({ prompt, schema: this.getValidationSchema() });
    
    return response;
  }
  
  /**
   * Generate intelligent suggestions based on issues found
   */
  private async generateSuggestions(
    schedule: Schedule,
    issues: ValidationIssue[]
  ): Promise<string[]> {
    if (issues.length === 0) {
      return ['Schedule appears well-optimized. Consider adding buffer time for critical tasks.'];
    }
    
    const prompt = `
    Based on these schedule issues, provide actionable suggestions:
    
    Issues:
    ${issues.map(i => `- ${i.severity}: ${i.message}`).join('\n')}
    
    Schedule context:
    - Duration: ${schedule.totalDuration} months
    - Critical path: ${schedule.criticalPath.length} tasks
    - Total tasks: ${schedule.tasks.length}
    
    Provide 3-5 specific, actionable suggestions to improve this schedule.
    Focus on practical fixes that maintain project goals.
    `;
    
    const response = await this.llm.generate(prompt);
    
    // Parse suggestions from response
    const suggestions = response
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./))
      .map(line => line.replace(/^[-\d.]\s*/, '').trim())
      .filter(s => s.length > 0);
    
    return suggestions.length > 0 
      ? suggestions 
      : ['Review critical path for optimization opportunities'];
  }
  
  private calculateScore(...scores: number[]): ScheduleScore {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    return {
      feasibility: scores[0] || 0,
      efficiency: scores[1] || 0,
      riskLevel: 100 - (scores[2] || 0), // Invert risk score
      resourceUtilization: scores[3] || 0,
      overall: avg
    };
  }
  
  private getValidationSchema() {
    return {
      type: 'object',
      properties: {
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              severity: { enum: ['critical', 'warning', 'info'] },
              type: { type: 'string' },
              message: { type: 'string' },
              affectedTasks: { type: 'array', items: { type: 'string' } },
              suggestedFix: { type: 'string' }
            }
          }
        },
        score: { type: 'number', minimum: 0, maximum: 100 }
      }
    };
  }
  
  // Stub implementations for other analysis methods
  private async analyzeResourceAllocation(schedule: Schedule) {
    // Would analyze resource allocation patterns
    return { issues: [], score: 75 };
  }
  
  private async analyzeRisks(schedule: Schedule) {
    // Would identify and assess risks
    return { issues: [], score: 70 };
  }
  
  private async analyzeTimeline(schedule: Schedule) {
    // Would check timeline feasibility
    return { issues: [], score: 80 };
  }
}

export function createValidator(llm: LLMProvider): IValidator {
  return new LLMValidator(llm);
}
