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
    
    // Extract business context for duration calibration
    const context = strategy.context;
    const businessType = context?.business?.type || 'general_business';
    const businessScale = context?.business?.scale || 'mid_market';
    const initiativeType = context?.business?.initiativeType;
    const timelineMin = context?.execution?.timeline?.min || 12;
    const timelineMax = context?.execution?.timeline?.max || 24;
    const businessName = context?.business?.name || 'the business';
    
    // Build initiative-specific guidance
    const initiativeGuidance = this.getInitiativeGuidance(initiativeType);
    
    const prompt = `
    Analyze this business strategy and decompose it into executable project tasks.
    
    === CRITICAL BUSINESS CONTEXT ===
    Business: ${businessName}
    Type: ${businessType}
    Scale: ${businessScale}
    ${initiativeType ? `Initiative Type: ${initiativeType}` : ''}
    Expected Timeline: ${timelineMin}-${timelineMax} months
    
    IMPORTANT: This is a ${businessScale} business. Generate task durations appropriate for this scale:
    - SMB (small/medium business): Tasks in days/weeks, total project ${timelineMin}-${timelineMax} months
    - Mid-market: Tasks in weeks, total project ${timelineMin}-${timelineMax} months  
    - Enterprise: Tasks in weeks/months, total project ${timelineMin}-${timelineMax} months
    
    The TOTAL timeline across all tasks should fit within ${timelineMin}-${timelineMax} months.
    
    ${initiativeGuidance}
    ===================================
    
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
   * Get initiative-specific guidance for task generation
   * Ensures AI generates contextually appropriate tasks
   */
  private getInitiativeGuidance(initiativeType?: string): string {
    if (!initiativeType) return '';
    
    const guidanceMap: Record<string, string> = {
      physical_business_launch: `
    ⚠️ PHYSICAL BUSINESS CONTEXT:
    This is launching a physical location (store, restaurant, office, etc.).
    Focus tasks on:
    - Real estate: Site selection, lease negotiation, buildout/renovation
    - Licenses/permits: Health permits, business licenses, inspections
    - Physical setup: Furniture, equipment, signage, utilities
    - Staffing: Hiring, training, scheduling (baristas, servers, sales staff - NOT software engineers)
    - Inventory: Supplier contracts, initial stock, POS systems
    - Grand opening: Marketing, soft launch, opening event
    Typical duration: 4-12 months for SMB, longer for chains`,
      
      software_development: `
    ⚠️ SOFTWARE DEVELOPMENT CONTEXT:
    This is building a software product/platform/app.
    Focus tasks on:
    - Technical setup: Dev environment, CI/CD, infrastructure, repositories
    - Design: UI/UX, system architecture, database design, API design
    - Development: Sprint planning, feature implementation, code reviews
    - Staffing: Developers, QA engineers, DevOps, product managers (NOT baristas or retail staff)
    - Testing: Unit tests, integration tests, UAT, performance testing
    - Deployment: Beta launch, production deployment, monitoring
    Typical duration: 3-12 months for MVP, longer for enterprise systems`,
      
      digital_transformation: `
    ⚠️ DIGITAL TRANSFORMATION CONTEXT:
    This is modernizing an existing business with digital capabilities.
    Focus tasks on:
    - Assessment: Current state analysis, gap identification, requirements
    - Platform selection: Evaluate solutions (e.g., e-commerce, CRM, ERP)
    - Integration: Connect new systems with existing processes/data
    - Change management: Staff training, process redesign, adoption campaigns
    - Staffing: Mix of domain experts and technical implementers
    - Rollout: Phased deployment, parallel operations, cutover
    Typical duration: 6-18 months depending on scope`,
      
      market_expansion: `
    ⚠️ MARKET EXPANSION CONTEXT:
    This is entering new markets/regions with existing offerings.
    Focus tasks on:
    - Market research: Customer analysis, competitive landscape, regulations
    - Localization: Product/service adaptation, pricing, messaging
    - Market entry: Distribution channels, partnerships, local presence
    - Compliance: Legal entity, tax registration, regulatory approvals
    - Staffing: Local teams, regional managers, support staff
    - Launch: Go-to-market strategy, marketing campaigns, customer acquisition
    Typical duration: 6-12 months per new market`,
      
      product_launch: `
    ⚠️ PRODUCT LAUNCH CONTEXT:
    This is introducing a new product to existing/new markets.
    Focus tasks on:
    - Product development: Design, prototyping, testing, refinement
    - Production: Manufacturing setup, supply chain, quality control
    - Marketing: Positioning, campaigns, sales materials, PR
    - Sales enablement: Training, pricing, distribution channels
    - Launch execution: Soft launch, phased rollout, full launch
    Typical duration: 3-9 months from concept to launch`,
      
      service_launch: `
    ⚠️ SERVICE LAUNCH CONTEXT:
    This is introducing new service offerings.
    Focus tasks on:
    - Service design: Process definition, delivery model, quality standards
    - Capability building: Training, certifications, tools/systems
    - Operations: Scheduling, resource allocation, quality monitoring
    - Staffing: Service delivery team, support roles
    - Marketing: Service packaging, pricing, sales collateral
    Typical duration: 2-6 months depending on complexity`,
      
      process_improvement: `
    ⚠️ PROCESS IMPROVEMENT CONTEXT:
    This is optimizing existing operations/workflows.
    Focus tasks on:
    - Analysis: Current state mapping, bottleneck identification, metrics
    - Design: Future state design, efficiency gains, change impact
    - Implementation: Process redesign, system changes, automation
    - Change management: Training, communication, adoption tracking
    - Validation: Metrics monitoring, continuous improvement
    Typical duration: 2-6 months for focused improvements`,
      
      other: ``
    };
    
    return guidanceMap[initiativeType] || '';
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
