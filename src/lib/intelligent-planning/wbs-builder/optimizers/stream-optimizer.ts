/**
 * Stream Optimizer - Converts pattern weights into concrete workstreams
 * Generates deliverables, dependencies, and detailed descriptions
 * 
 * Reliability improvements (Jan 2026):
 * - Uses gpt-4o-mini for dependency linkage (fast, cheap, deterministic)
 * - Falls back to basic sequential dependencies if LLM fails
 * - Preserves workstreams even when dependency generation fails
 */

import { IOptimizer, OptimizationInput, WorkStream, ILLMProvider } from '../interfaces';
import { MODEL_CONFIG, OpenAIProvider } from '../../llm-provider';

export class StreamOptimizer implements IOptimizer {
  name = 'StreamOptimizer';
  private onProgress?: (current: number, total: number, name: string) => void;
  
  constructor(private llm: ILLMProvider, onProgress?: (current: number, total: number, name: string) => void) {
    this.onProgress = onProgress;
  }
  
  /**
   * Infer basic sequential dependencies when LLM dependency generation fails
   * Preserves original workstream order while adding sensible dependency chains
   */
  private inferBasicDependencies(workstreams: WorkStream[]): WorkStream[] {
    console.log(`[${this.name}] Inferring basic sequential dependencies for ${workstreams.length} workstreams`);
    
    // Determine execution priority based on category
    // Legal/compliance first, then infrastructure, then operations, etc.
    const priorityOrder = ['legal_compliance', 'physical_infrastructure', 'technology_systems', 'human_resources', 'operations', 'marketing_sales'];
    
    const getPriority = (category: string): number => {
      const idx = priorityOrder.indexOf(category);
      return idx === -1 ? 99 : idx;
    };
    
    // Create a sorted list for dependency computation (don't modify original order)
    const sortedByPriority = [...workstreams].sort((a, b) => getPriority(a.category) - getPriority(b.category));
    
    // Build a map: workstream ID -> the ID it depends on (based on priority order)
    const dependencyMap = new Map<string, string[]>();
    sortedByPriority.forEach((ws, i) => {
      dependencyMap.set(ws.id, i === 0 ? [] : [sortedByPriority[i - 1].id]);
    });
    
    // Return workstreams in ORIGINAL order, but with computed dependencies
    return workstreams.map(ws => ({
      ...ws,
      dependencies: dependencyMap.get(ws.id) || []
    }));
  }
  
  /**
   * Convert pattern weights into concrete workstreams with deliverables
   */
  async process(input: OptimizationInput): Promise<WorkStream[]> {
    const { pattern, context, insights } = input;
    
    console.log(`[${this.name}] Optimizing ${pattern.streams.length} work stream categories...`);
    
    const workstreams: WorkStream[] = [];
    
    // Generate concrete workstream for each category
    for (let i = 0; i < pattern.streams.length; i++) {
      const streamCategory = pattern.streams[i];
      
      console.log(`[${this.name}] Generating workstream ${i + 1}/${pattern.streams.length}: ${streamCategory.category}`);
      
      const workstream = await this.generateWorkstream(streamCategory, context, insights, i);
      workstreams.push(workstream);
      
      // Emit progress after each workstream is generated
      if (this.onProgress) {
        this.onProgress(i + 1, pattern.streams.length, workstream.name);
      }
    }
    
    // Generate dependencies between workstreams
    const workstreamsWithDeps = await this.generateDependencies(workstreams, context);
    
    console.log(`[${this.name}] Generated ${workstreamsWithDeps.length} workstreams with dependencies`);
    
    return workstreamsWithDeps;
  }
  
  /**
   * Generate a concrete workstream from category
   */
  private async generateWorkstream(
    category: any,
    context: any,
    insights: any,
    index: number
  ): Promise<WorkStream> {
    const prompt = `
Generate a concrete workstream for this category:

Category: ${category.category}
Effort Allocation: ${category.weight.toFixed(1)}%
Priority: ${category.priority}

Business Context:
- Name: ${context.business.name}
- Industry: ${context.business.industry || context.business.type}
- Type: ${context.business.type}
- Scale: ${context.business.scale}
- Description: ${context.business.description}

CRITICAL: Generate content SPECIFICALLY for the "${context.business.industry || context.business.type}" industry.
Do NOT use generic examples or copy from other industries.
All deliverables must be relevant to ${context.business.name} in the ${context.business.industry || context.business.type} sector.

Generate:
1. A clear, actionable name (e.g., "Location Scouting & Lease Negotiation" not just "Physical Infrastructure")
2. A detailed description of what this workstream entails for THIS specific business
3. 3-5 key deliverables (concrete outputs specific to ${context.business.industry || context.business.type})

The deliverables should be specific, measurable, and industry-appropriate.

Return as JSON object with name, description, and deliverables array.
    `.trim();
    
    const result = await this.llm.generateStructured<{
      name: string;
      description: string;
      deliverables: string[];
    }>({
      prompt,
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          deliverables: {
            type: 'array',
            items: { type: 'string' },
            minItems: 3,
            maxItems: 5
          }
        },
        required: ['name', 'description', 'deliverables']
      }
    });
    
    // Calculate confidence based on priority and effort allocation
    const priorityConfidence: Record<string, number> = {
      'critical': 0.95,
      'high': 0.90,
      'medium': 0.85,
      'low': 0.80
    };
    const baseConfidence = priorityConfidence[category.priority] || 0.85;
    // Adjust confidence based on effort weight (higher effort = more certain about need)
    const effortBonus = Math.min(category.weight / 100 * 0.05, 0.05);
    const confidence = Math.min(baseConfidence + effortBonus, 0.98);
    
    return {
      id: `WS${String(index + 1).padStart(3, '0')}`,
      name: result.name,
      category: category.category,
      description: result.description,
      proportionalEffort: category.weight,
      priority: category.priority,
      deliverables: result.deliverables,
      dependencies: [],  // Will be filled by generateDependencies
      confidence: parseFloat(confidence.toFixed(2))
    };
  }
  
  /**
   * Generate logical dependencies between workstreams
   * Uses gpt-4o-mini for fast, cheap dependency inference
   * Falls back to basic sequential dependencies if LLM fails
   */
  private async generateDependencies(
    workstreams: WorkStream[],
    context: any
  ): Promise<WorkStream[]> {
    const prompt = `
Analyze these workstreams and determine logical dependencies:

${workstreams.map((ws, i) => `
${i + 1}. ${ws.name} (ID: ${ws.id})
   Category: ${ws.category}
   Deliverables: ${ws.deliverables.join(', ')}
`).join('\n')}

For each workstream, determine what other workstreams must complete BEFORE it can start.

Common dependency patterns:
- Legal/compliance often comes first (can't operate without permits)
- Physical infrastructure before operations (need location before opening)
- Hiring before operations (need staff before launching)
- Technology systems can often run in parallel with physical work
- Marketing can start early but ramp up near launch

Return array of objects with:
- workstreamId: The ID of the workstream
- dependsOn: Array of IDs this workstream depends on (can be empty)

Only include dependencies where one MUST finish before another starts.
Don't create circular dependencies.
    `.trim();
    
    try {
      // Use gpt-4o-mini for dependency linkage (deterministic, fast, cheap)
      // This prevents the 4-minute burn from gpt-5 empty responses
      let dependencyLLM = this.llm;
      
      // If this is an OpenAIProvider, switch to the cheaper model
      if (this.llm instanceof OpenAIProvider) {
        console.log(`[${this.name}] Switching to ${MODEL_CONFIG.dependencyLinkage} for dependency generation`);
        dependencyLLM = (this.llm as OpenAIProvider).withModel(MODEL_CONFIG.dependencyLinkage);
      }
      
      const depResult = await dependencyLLM.generateStructured<{
        dependencies: Array<{
          workstreamId: string;
          dependsOn: string[];
        }>;
      }>({
        prompt,
        schema: {
          type: 'object',
          properties: {
            dependencies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  workstreamId: { type: 'string' },
                  dependsOn: { type: 'array', items: { type: 'string' } }
                },
                required: ['workstreamId', 'dependsOn']
              }
            }
          },
          required: ['dependencies']
        }
      });
      
      // Apply dependencies to workstreams
      const result = workstreams.map(ws => {
        const dep = depResult.dependencies.find(d => d.workstreamId === ws.id);
        if (dep) {
          return { ...ws, dependencies: dep.dependsOn };
        }
        return ws;
      });
      
      console.log(`[${this.name}] Successfully generated AI-based dependencies`);
      return result;
    } catch (error: any) {
      // Fall back to basic sequential dependencies - don't lose the workstreams!
      console.warn(`[${this.name}] Dependency generation failed: ${error.message}`);
      console.warn(`[${this.name}] Falling back to basic sequential dependencies`);
      return this.inferBasicDependencies(workstreams);
    }
  }
  
  /**
   * Optional: Validate input before processing
   */
  async validate(input: OptimizationInput): Promise<boolean> {
    if (!input.pattern || !input.pattern.streams || input.pattern.streams.length === 0) {
      console.error(`[${this.name}] Invalid input: missing pattern or streams`);
      return false;
    }
    return true;
  }
}
