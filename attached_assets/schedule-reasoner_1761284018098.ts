/**
 * @module planning/reasoning/schedule-reasoner
 * LLM-powered schedule analysis and rationalization
 * This is where the actual intelligence lives
 */

import { Schedule, Task, ScheduledTask, Constraint, ValidationIssue } from '../types';
import { LLMProvider } from '../llm/interfaces';

export interface IScheduleReasoner {
  analyze(schedule: Schedule): Promise<ScheduleAnalysis>;
  rationalize(schedule: Schedule, constraints: Constraint[]): Promise<RationalizedSchedule>;
  identifyIssues(schedule: Schedule): Promise<LogicalIssue[]>;
  suggestImprovements(schedule: Schedule, issues: LogicalIssue[]): Promise<Improvement[]>;
  explainCriticalPath(schedule: Schedule): Promise<CriticalPathExplanation>;
}

export interface ScheduleAnalysis {
  summary: string;
  feasibility: FeasibilityAssessment;
  risks: RiskAssessment[];
  bottlenecks: Bottleneck[];
  opportunities: Opportunity[];
  concerns: string[];
  recommendations: string[];
}

export interface RationalizedSchedule extends Schedule {
  reasoning: ScheduleReasoning;
  adjustments: RationalAdjustment[];
  confidenceScore: number;
}

export interface ScheduleReasoning {
  rationale: string;
  assumptions: string[];
  dependencies: DependencyReasoning[];
  sequencing: SequenceReasoning[];
  resourceLogic: ResourceReasoning;
  riskMitigation: string[];
}

export interface LogicalIssue {
  type: 'dependency' | 'sequence' | 'resource' | 'timeline' | 'risk';
  severity: 'critical' | 'major' | 'minor';
  description: string;
  affectedTasks: string[];
  reasoning: string;
  suggestedFix: string;
}

export class ScheduleReasoner implements IScheduleReasoner {
  constructor(private llm: LLMProvider) {}

  /**
   * Comprehensive schedule analysis using LLM intelligence
   */
  async analyze(schedule: Schedule): Promise<ScheduleAnalysis> {
    const prompt = `
    Analyze this project schedule with deep reasoning:

    Schedule Overview:
    - Total Duration: ${schedule.totalDuration} months
    - Number of Tasks: ${schedule.tasks.length}
    - Critical Path Length: ${schedule.criticalPath.length}
    - Start Date: ${schedule.startDate}
    - End Date: ${schedule.endDate}

    Tasks:
    ${JSON.stringify(schedule.tasks.map(t => ({
      name: t.name,
      duration: t.endDate.getTime() - t.startDate.getTime(),
      dependencies: t.dependencies,
      slack: t.slack,
      critical: t.isCritical
    })), null, 2)}

    Provide a comprehensive analysis including:

    1. FEASIBILITY ASSESSMENT
    - Is this schedule actually achievable?
    - What are the key assumptions being made?
    - Where are the logical weak points?

    2. RISK IDENTIFICATION
    - What could go wrong?
    - Which tasks are most vulnerable?
    - What are the cascade effects of delays?

    3. BOTTLENECK ANALYSIS
    - Where will work pile up?
    - Which resources will be overloaded?
    - What are the constraint points?

    4. IMPROVEMENT OPPORTUNITIES
    - What could be parallelized?
    - What could be compressed?
    - What could be resequenced?

    5. CRITICAL CONCERNS
    - What doesn't make logical sense?
    - What dependencies seem wrong?
    - What timelines are unrealistic?

    Use your understanding of project management, logical sequencing, and real-world constraints.
    Be specific and actionable in your recommendations.
    `;

    const analysis = await this.llm.generateStructured<ScheduleAnalysis>({
      prompt,
      schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          feasibility: {
            type: 'object',
            properties: {
              score: { type: 'number' },
              reasoning: { type: 'string' },
              assumptions: { type: 'array', items: { type: 'string' } },
              weakPoints: { type: 'array', items: { type: 'string' } }
            }
          },
          risks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                risk: { type: 'string' },
                probability: { type: 'string' },
                impact: { type: 'string' },
                mitigation: { type: 'string' }
              }
            }
          },
          bottlenecks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                location: { type: 'string' },
                cause: { type: 'string' },
                impact: { type: 'string' },
                solution: { type: 'string' }
              }
            }
          },
          opportunities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                opportunity: { type: 'string' },
                benefit: { type: 'string' },
                implementation: { type: 'string' }
              }
            }
          },
          concerns: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    return analysis;
  }

  /**
   * Rationalize a schedule - make it make logical sense
   */
  async rationalize(
    schedule: Schedule,
    constraints: Constraint[]
  ): Promise<RationalizedSchedule> {
    
    // First, identify what doesn't make sense
    const issues = await this.identifyIssues(schedule);
    
    // Then reason about how to fix it
    const prompt = `
    This schedule has logical issues that need to be rationalized:

    Current Schedule:
    ${JSON.stringify(schedule, null, 2)}

    Issues Found:
    ${JSON.stringify(issues, null, 2)}

    Constraints to Respect:
    ${JSON.stringify(constraints, null, 2)}

    Your task is to RATIONALIZE this schedule:
    
    1. Fix illogical dependencies
       - If B depends on A, B must start after A ends
       - Remove circular dependencies
       - Add missing logical dependencies

    2. Fix impossible timelines
       - Adjust durations to be realistic
       - Add buffer time for uncertainty
       - Account for resource availability

    3. Fix resource conflicts
       - Don't schedule parallel work for same team
       - Respect resource capacity limits
       - Level resource usage

    4. Explain your reasoning
       - Why each change makes sense
       - What assumptions you're making
       - How confidence is affected

    Return a rationalized schedule with clear reasoning for every adjustment.
    `;

    const response = await this.llm.generateStructured<{
      adjustments: RationalAdjustment[];
      reasoning: ScheduleReasoning;
      confidence: number;
    }>({
      prompt,
      schema: {
        type: 'object',
        properties: {
          adjustments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                taskId: { type: 'string' },
                field: { type: 'string' },
                oldValue: { type: 'any' },
                newValue: { type: 'any' },
                reason: { type: 'string' }
              }
            }
          },
          reasoning: {
            type: 'object',
            properties: {
              rationale: { type: 'string' },
              assumptions: { type: 'array', items: { type: 'string' } },
              dependencies: { type: 'array' },
              sequencing: { type: 'array' },
              resourceLogic: { type: 'object' },
              riskMitigation: { type: 'array', items: { type: 'string' } }
            }
          },
          confidence: { type: 'number' }
        }
      }
    });

    // Apply the adjustments
    const rationalizedSchedule = this.applyAdjustments(schedule, response.adjustments);

    return {
      ...rationalizedSchedule,
      reasoning: response.reasoning,
      adjustments: response.adjustments,
      confidenceScore: response.confidence
    };
  }

  /**
   * Identify logical issues in a schedule
   */
  async identifyIssues(schedule: Schedule): Promise<LogicalIssue[]> {
    const prompt = `
    Examine this schedule for logical issues:

    ${JSON.stringify(schedule, null, 2)}

    Look for:
    
    1. DEPENDENCY ISSUES
    - Circular dependencies (A→B→C→A)
    - Missing dependencies (things that obviously need prerequisites)
    - Illogical dependencies (things that don't actually depend on each other)
    - Backwards dependencies (successor before predecessor)

    2. SEQUENCE ISSUES
    - Tasks in wrong order
    - Phases that overlap incorrectly
    - Critical path that doesn't make sense
    - Parallel work that should be sequential

    3. RESOURCE ISSUES
    - Same resource assigned to parallel tasks
    - Overallocation (more work than capacity)
    - Skills mismatch (wrong resource for task)
    - Resource unavailability during task

    4. TIMELINE ISSUES
    - Unrealistic durations (too short/long)
    - No buffer time for risks
    - Impossible deadlines
    - Ignored external dependencies

    5. RISK ISSUES
    - All high-risk work at same time
    - No contingency planning
    - Single points of failure
    - Cascade failure risks

    For each issue, explain:
    - WHY it's a problem
    - WHAT will happen if not fixed
    - HOW to fix it

    Be specific about which tasks are affected.
    `;

    const issues = await this.llm.generateStructured<LogicalIssue[]>({
      prompt,
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { 
              enum: ['dependency', 'sequence', 'resource', 'timeline', 'risk'] 
            },
            severity: { 
              enum: ['critical', 'major', 'minor'] 
            },
            description: { type: 'string' },
            affectedTasks: { 
              type: 'array', 
              items: { type: 'string' } 
            },
            reasoning: { type: 'string' },
            suggestedFix: { type: 'string' }
          }
        }
      }
    });

    return issues;
  }

  /**
   * Suggest specific improvements based on issues
   */
  async suggestImprovements(
    schedule: Schedule,
    issues: LogicalIssue[]
  ): Promise<Improvement[]> {
    const prompt = `
    Given these issues in the schedule:
    ${JSON.stringify(issues, null, 2)}

    Current Schedule:
    ${JSON.stringify(schedule, null, 2)}

    Suggest specific, actionable improvements:

    For each issue, provide:
    1. A concrete change to make
    2. Expected benefit
    3. Any trade-offs
    4. Implementation steps
    5. Success metrics

    Focus on:
    - Quick wins (easy fixes with big impact)
    - Critical fixes (must-do to avoid failure)
    - Optimization opportunities (nice-to-have improvements)

    Be specific: "Move Task X from Month 3 to Month 4" not "Adjust timeline"
    `;

    const improvements = await this.llm.generateStructured<Improvement[]>({
      prompt,
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            category: { 
              enum: ['quick-win', 'critical', 'optimization'] 
            },
            change: {
              type: 'object',
              properties: {
                taskId: { type: 'string' },
                field: { type: 'string' },
                from: { type: 'any' },
                to: { type: 'any' }
              }
            },
            benefit: { type: 'string' },
            tradeoff: { type: 'string' },
            steps: { 
              type: 'array', 
              items: { type: 'string' } 
            },
            metrics: { 
              type: 'array', 
              items: { type: 'string' } 
            }
          }
        }
      }
    });

    return improvements;
  }

  /**
   * Explain the critical path in human terms
   */
  async explainCriticalPath(schedule: Schedule): Promise<CriticalPathExplanation> {
    const criticalTasks = schedule.tasks.filter(t => 
      schedule.criticalPath.includes(t.id)
    );

    const prompt = `
    Explain this critical path in clear, business terms:

    Critical Tasks:
    ${JSON.stringify(criticalTasks, null, 2)}

    Total Duration: ${schedule.totalDuration} months

    Provide:
    1. A clear narrative of why this is the critical path
    2. What makes each task critical
    3. The domino effect if any task is delayed
    4. Opportunities to shorten the path
    5. Risks to watch for

    Write for a business audience, not technical.
    Focus on the "why" and "so what" not just the "what".
    `;

    const explanation = await this.llm.generateStructured<CriticalPathExplanation>({
      prompt,
      schema: {
        type: 'object',
        properties: {
          narrative: { type: 'string' },
          criticalTasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                taskId: { type: 'string' },
                whyCritical: { type: 'string' },
                impact: { type: 'string' }
              }
            }
          },
          dominoEffects: { 
            type: 'array', 
            items: { type: 'string' } 
          },
          shorteningOpportunities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                approach: { type: 'string' },
                timeSaved: { type: 'string' },
                risk: { type: 'string' }
              }
            }
          },
          watchPoints: { 
            type: 'array', 
            items: { type: 'string' } 
          }
        }
      }
    });

    return explanation;
  }

  /**
   * Apply adjustments to create new schedule
   */
  private applyAdjustments(
    schedule: Schedule,
    adjustments: RationalAdjustment[]
  ): Schedule {
    const adjusted = { ...schedule };
    const tasks = [...schedule.tasks];

    for (const adjustment of adjustments) {
      const taskIndex = tasks.findIndex(t => t.id === adjustment.taskId);
      if (taskIndex === -1) continue;

      const task = { ...tasks[taskIndex] };
      
      // Apply the adjustment based on field type
      switch (adjustment.field) {
        case 'startDate':
          task.startDate = new Date(adjustment.newValue);
          break;
        case 'endDate':
          task.endDate = new Date(adjustment.newValue);
          break;
        case 'dependencies':
          task.dependencies = adjustment.newValue;
          break;
        case 'duration':
          const duration = adjustment.newValue;
          task.endDate = new Date(
            task.startDate.getTime() + duration * 24 * 60 * 60 * 1000
          );
          break;
      }

      tasks[taskIndex] = task;
    }

    adjusted.tasks = tasks;
    return adjusted;
  }
}

// Supporting types
interface FeasibilityAssessment {
  score: number;
  reasoning: string;
  assumptions: string[];
  weakPoints: string[];
}

interface RiskAssessment {
  risk: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

interface Bottleneck {
  location: string;
  cause: string;
  impact: string;
  solution: string;
}

interface Opportunity {
  opportunity: string;
  benefit: string;
  implementation: string;
}

interface DependencyReasoning {
  from: string;
  to: string;
  rationale: string;
  type: string;
}

interface SequenceReasoning {
  taskId: string;
  position: number;
  reasoning: string;
}

interface ResourceReasoning {
  strategy: string;
  allocations: any[];
  conflicts: any[];
  optimizations: string[];
}

interface RationalAdjustment {
  taskId: string;
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

interface Improvement {
  id: string;
  title: string;
  description: string;
  category: 'quick-win' | 'critical' | 'optimization';
  change: any;
  benefit: string;
  tradeoff: string;
  steps: string[];
  metrics: string[];
}

interface CriticalPathExplanation {
  narrative: string;
  criticalTasks: Array<{
    taskId: string;
    whyCritical: string;
    impact: string;
  }>;
  dominoEffects: string[];
  shorteningOpportunities: Array<{
    approach: string;
    timeSaved: string;
    risk: string;
  }>;
  watchPoints: string[];
}

export function createScheduleReasoner(llm: LLMProvider): IScheduleReasoner {
  return new ScheduleReasoner(llm);
}
