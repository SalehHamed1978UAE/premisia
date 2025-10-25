/**
 * Stream Optimizer - Converts pattern weights into concrete workstreams
 * Generates deliverables, dependencies, and detailed descriptions
 */

import { IOptimizer, OptimizationInput, WorkStream, ILLMProvider } from '../interfaces';

export class StreamOptimizer implements IOptimizer {
  name = 'StreamOptimizer';
  
  constructor(private llm: ILLMProvider) {}
  
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
- Type: ${context.business.type}
- Scale: ${context.business.scale}
- Description: ${context.business.description}

Generate:
1. A clear, actionable name (e.g., "Location Scouting & Lease Negotiation" not just "Physical Infrastructure")
2. A detailed description of what this workstream entails
3. 3-5 key deliverables (concrete outputs)

The deliverables should be specific and measurable.

Example for "physical_infrastructure" in a coffee shop:
Name: "Location Scouting & Buildout"
Description: "Secure commercial location, negotiate lease, complete buildout and equipment installation"
Deliverables:
- Signed commercial lease agreement
- Completed buildout and renovations
- Equipment installed and operational
- Health department inspection passed
- Insurance policies in place

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
    
    return {
      id: `WS${String(index + 1).padStart(3, '0')}`,
      name: result.name,
      category: category.category,
      description: result.description,
      proportionalEffort: category.weight,
      priority: category.priority,
      deliverables: result.deliverables,
      dependencies: [],  // Will be filled by generateDependencies
      confidence: 0.85
    };
  }
  
  /**
   * Generate logical dependencies between workstreams
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
    
    const depResult = await this.llm.generateStructured<{
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
    
    return result;
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
