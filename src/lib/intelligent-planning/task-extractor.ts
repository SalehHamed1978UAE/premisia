/**
 * @module planning/extractors/llm-extractor
 * LLM-based intelligent task extraction from strategic inputs
 */

import { Task, Duration, ResourceRequirement, Deliverable } from './types';
import { ITaskExtractor, LLMProvider } from './interfaces';

export class LLMTaskExtractor implements ITaskExtractor {
  constructor(private llm: LLMProvider) {}
  
  /**
   * Main extraction - converts strategy into executable tasks
   */
  async extract(strategy: any): Promise<Task[]> {
    console.log('[Task Extractor] About to call LLM for task extraction...');
    
    const prompt = `
    Analyze this business strategy and decompose it into executable project tasks.
    
    Strategy Context:
    ${JSON.stringify(strategy, null, 2)}
    
    For each workstream or major initiative, create detailed tasks following this reasoning process:
    
    1. DECOMPOSITION LOGIC
    - What are the logical phases? (setup → execution → validation → deployment)
    - What must be built/created/established?
    - What decisions must be made?
    - What validations/approvals needed?
    
    2. DEPENDENCY REASONING
    For each task, think:
    - What information/artifacts does this task need as input?
    - What tasks produce those inputs?
    - What can be done in parallel vs sequential?
    - Are there external dependencies (permits, approvals, third parties)?
    
    3. DURATION ESTIMATION
    Consider:
    - Complexity (simple/medium/complex)
    - Uncertainty (well-understood vs exploratory)
    - Resource constraints (specialized skills needed?)
    - Historical patterns (similar tasks usually take X)
    
    Provide optimistic (if everything goes perfectly),
    likely (realistic expectation),
    and pessimistic (if complications arise) durations.
    
    4. RESOURCE REQUIREMENTS
    - What skills/expertise needed?
    - How many people?
    - Any special tools/systems?
    - External vendors/partners?
    
    5. DELIVERABLES
    - What concrete outputs?
    - What decisions documented?
    - What approvals obtained?
    - What systems deployed?
    
    CRITICAL: Think step-by-step about the logical sequence.
    Don't just list tasks - reason about their relationships.
    
    Example reasoning:
    "To launch the product, we need the platform built.
    To build the platform, we need architecture designed.
    To design architecture, we need requirements gathered.
    Requirements depend on market research being complete."
    
    Return as JSON array of Task objects with all fields populated.
    `;
    
    const response = await this.llm.generateStructured<{ tasks: Task[] }>({
      prompt,
      schema: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: this.getTaskSchema()
          }
        }
      }
    });
    
    console.log('[Task Extractor] LLM responded, parsing tasks...');
    console.log('[Task Extractor] Extracted', response.tasks?.length || 0, 'tasks');
    
    // Post-process to ensure consistency
    return this.postProcessTasks(response.tasks);
  }
  
  /**
   * Decompose a single workstream into subtasks
   */
  async decompose(workstream: any): Promise<Task[]> {
    const prompt = `
    Decompose this workstream into detailed subtasks using work breakdown structure (WBS) principles.
    
    Workstream:
    ${JSON.stringify(workstream, null, 2)}
    
    Apply WBS decomposition rules:
    1. Each task should be 8-80 hours of work (1-10 days)
    2. Each task should have clear start/end conditions
    3. Each task should produce a tangible deliverable
    4. No task should be just "manage" or "oversee"
    
    Think about:
    - Setup tasks (environment, tools, access)
    - Research/analysis tasks
    - Design/planning tasks  
    - Implementation/build tasks
    - Testing/validation tasks
    - Documentation tasks
    - Review/approval tasks
    - Deployment/rollout tasks
    - Training/handover tasks
    
    For each task, reason about:
    - Why is this task necessary?
    - What specific work is involved?
    - What makes it complete?
    - Who needs to be involved?
    
    Return detailed tasks with all attributes.
    `;
    
    const response = await this.llm.generateStructured<{ tasks: Task[] }>({
      prompt,
      schema: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: this.getTaskSchema()
          }
        }
      }
    });
    
    return response.tasks;
  }
  
  /**
   * Infer logical dependencies between tasks using reasoning
   */
  async inferDependencies(tasks: Task[]): Promise<Task[]> {
    const prompt = `
    Analyze these tasks and infer logical dependencies using project management reasoning.
    
    Tasks:
    ${JSON.stringify(tasks.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      deliverables: t.deliverables
    })), null, 2)}
    
    For each pair of tasks, reason:
    
    1. CAUSAL RELATIONSHIPS
    - Does task B need the output of task A?
    - Does task A create something task B consumes?
    - Must task A's decision be made before B can start?
    
    2. LOGICAL SEQUENCING
    - Design before build
    - Requirements before design
    - Build before test
    - Test before deploy
    - Training before handover
    
    3. RESOURCE CONSTRAINTS
    - Do these tasks need the same person/team?
    - Do they need the same system/environment?
    - Would parallel execution cause conflicts?
    
    4. EXTERNAL CONSTRAINTS
    - Regulatory approvals before certain activities
    - Vendor deliveries before integration
    - Customer signoffs before proceeding
    
    5. BEST PRACTICES
    - Risk mitigation (critical items first)
    - Fast feedback (validate early)
    - Progressive elaboration (detail emerges)
    
    For each task, provide a list of task IDs it depends on,
    with reasoning for why that dependency exists.
    
    Be conservative - only add dependencies that are truly necessary.
    Too many dependencies reduces parallelization opportunities.
    
    Return tasks with updated dependencies array.
    `;
    
    const response = await this.llm.generateStructured<{
      tasks: Array<{
        id: string;
        dependencies: string[];
        reasoning: string;
      }>
    }>({
      prompt,
      schema: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                dependencies: {
                  type: 'array',
                  items: { type: 'string' }
                },
                reasoning: { type: 'string' }
              }
            }
          }
        }
      }
    });
    
    // Update original tasks with inferred dependencies
    const dependencyMap = new Map(
      response.tasks.map(t => [t.id, t.dependencies])
    );
    
    return tasks.map(task => ({
      ...task,
      dependencies: dependencyMap.get(task.id) || task.dependencies
    }));
  }
  
  /**
   * Helper to generate task schema for structured output
   */
  private getTaskSchema() {
    return {
      type: 'object',
      required: ['id', 'name', 'duration', 'dependencies'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        duration: {
          type: 'object',
          properties: {
            optimistic: { type: 'number' },
            likely: { type: 'number' },
            pessimistic: { type: 'number' },
            unit: { enum: ['days', 'weeks', 'months'] }
          }
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' }
        },
        deliverables: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' }
            }
          }
        },
        requirements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              skill: { type: 'string' },
              quantity: { type: 'number' },
              duration: { type: 'number' }
            }
          }
        },
        complexity: { enum: ['low', 'medium', 'high'] },
        risk: { enum: ['low', 'medium', 'high'] }
      }
    };
  }
  
  /**
   * Post-process tasks to ensure consistency
   */
  private postProcessTasks(tasks: Task[]): Task[] {
    // Ensure all IDs are unique
    const usedIds = new Set<string>();
    const processedTasks = tasks.map(task => {
      let id = task.id;
      let counter = 1;
      while (usedIds.has(id)) {
        id = `${task.id}_${counter}`;
        counter++;
      }
      usedIds.add(id);
      
      return { ...task, id };
    });
    
    // Validate dependencies exist
    const validIds = new Set(processedTasks.map(t => t.id));
    processedTasks.forEach(task => {
      task.dependencies = task.dependencies.filter(dep => validIds.has(dep));
    });
    
    // Ensure no circular dependencies
    this.removeCircularDependencies(processedTasks);
    
    return processedTasks;
  }
  
  /**
   * Remove circular dependencies if any exist
   */
  private removeCircularDependencies(tasks: Task[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (taskId: string, taskMap: Map<string, Task>): boolean => {
      visited.add(taskId);
      recursionStack.add(taskId);
      
      const task = taskMap.get(taskId);
      if (!task) return false;
      
      for (const depId of task.dependencies) {
        if (!visited.has(depId)) {
          if (hasCycle(depId, taskMap)) return true;
        } else if (recursionStack.has(depId)) {
          // Found a cycle - remove this dependency
          task.dependencies = task.dependencies.filter(d => d !== depId);
          console.warn(`Removed circular dependency: ${taskId} -> ${depId}`);
          return true;
        }
      }
      
      recursionStack.delete(taskId);
      return false;
    };
    
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    
    for (const task of tasks) {
      if (!visited.has(task.id)) {
        hasCycle(task.id, taskMap);
      }
      visited.clear();
      recursionStack.clear();
    }
  }
}

export function createTaskExtractor(llm: LLMProvider): ITaskExtractor {
  return new LLMTaskExtractor(llm);
}
