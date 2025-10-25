/**
 * Pattern Provider - Selects appropriate work breakdown pattern
 * Uses registry for known patterns, falls back to LLM generation
 */

import { IPatternProvider, BusinessIntent, WorkStreamPattern, ILLMProvider } from '../interfaces';
import { PatternRegistry } from './pattern-registry';

export class PatternProvider implements IPatternProvider {
  name = 'PatternProvider';
  
  constructor(
    private registry: PatternRegistry,
    private llm: ILLMProvider
  ) {}
  
  /**
   * Provide work stream pattern based on business intent
   */
  async process(intent: BusinessIntent): Promise<WorkStreamPattern> {
    console.log(`[${this.name}] Selecting pattern for initiative type: ${intent.initiativeType}`);
    
    // Try to find registered pattern plugin
    const plugin = this.registry.getPattern(intent.initiativeType);
    
    if (plugin) {
      console.log(`[${this.name}] Using registered pattern plugin: ${plugin.name}`);
      const pattern = await plugin.analyze(intent);
      
      // Validate pattern
      const isValid = await this.validatePattern(pattern);
      if (!isValid) {
        console.warn(`[${this.name}] Pattern validation failed, falling back to LLM generation`);
        return await this.generatePatternFromLLM(intent);
      }
      
      return pattern;
    }
    
    // Fallback to LLM generation for unknown initiative types
    console.log(`[${this.name}] No registered pattern found, using LLM generation`);
    return await this.generatePatternFromLLM(intent);
  }
  
  /**
   * Generate pattern using LLM for unknown initiative types
   */
  private async generatePatternFromLLM(intent: BusinessIntent): Promise<WorkStreamPattern> {
    const prompt = `
Generate a work breakdown structure pattern for this business initiative:

Initiative Type: ${intent.initiativeType}
Technology Role: ${intent.technologyRole}
Business Model: ${intent.businessModel}
Primary Value Creation: ${intent.primaryValueCreation}
Is Physical: ${intent.isPhysical}
Is Digital: ${intent.isDigital}

Generate work stream categories with proportional effort allocations (as percentages).

Common work stream categories:
- physical_infrastructure: Location, equipment, buildout, facilities
- technology_systems: Software, platforms, IT systems
- operations: Day-to-day business processes, procedures
- human_resources: Hiring, training, org structure
- marketing_sales: Go-to-market, customer acquisition
- legal_compliance: Permits, licenses, regulatory compliance
- financial_management: Budgeting, accounting, funding
- supply_chain: Suppliers, inventory, logistics

Allocate percentages based on what makes sense for this initiative.
Total should sum to approximately 100%.

Return as WorkStreamPattern JSON object.
    `.trim();
    
    const pattern = await this.llm.generateStructured<WorkStreamPattern>({
      prompt,
      schema: {
        type: 'object',
        properties: {
          initiativeType: { type: 'string' },
          streams: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                weight: { type: 'number', minimum: 0, maximum: 100 },
                priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                description: { type: 'string' }
              },
              required: ['category', 'weight', 'priority']
            }
          }
        },
        required: ['initiativeType', 'streams']
      }
    });
    
    pattern.totalWeight = pattern.streams.reduce((sum, s) => sum + s.weight, 0);
    
    return pattern;
  }
  
  /**
   * Validate that pattern weights sum to approximately 100%
   */
  private async validatePattern(pattern: WorkStreamPattern): Promise<boolean> {
    const totalWeight = pattern.streams.reduce((sum, s) => sum + s.weight, 0);
    pattern.totalWeight = totalWeight;
    
    // Allow 5% tolerance
    const isValid = Math.abs(totalWeight - 100) <= 5;
    
    if (!isValid) {
      console.error(`[${this.name}] Pattern validation failed: total weight = ${totalWeight}%, expected ~100%`);
    }
    
    return isValid;
  }
  
  /**
   * Optional: Validate input before processing
   */
  async validate(intent: BusinessIntent): Promise<boolean> {
    if (!intent.initiativeType || !intent.technologyRole) {
      console.error(`[${this.name}] Invalid intent: missing required fields`);
      return false;
    }
    return true;
  }
}
