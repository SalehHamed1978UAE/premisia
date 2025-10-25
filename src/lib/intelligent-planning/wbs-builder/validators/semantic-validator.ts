/**
 * Semantic Validator - Ensures workstreams match business intent
 * Uses LLM to validate semantic coherence
 */

import { IValidator, ValidationInput, ValidationResult, ValidationIssue, ILLMProvider } from '../interfaces';

export class SemanticValidator implements IValidator {
  name = 'SemanticValidator';
  
  constructor(private llm: ILLMProvider) {}
  
  /**
   * Validate semantic coherence of work streams against business objective
   */
  async process(input: ValidationInput): Promise<ValidationResult> {
    console.log(`[${this.name}] Validating semantic coherence...`);
    
    const prompt = this.buildValidationPrompt(input);
    
    const result = await this.llm.generateStructured<ValidationResult>({
      prompt,
      schema: {
        type: 'object',
        properties: {
          isValid: { type: 'boolean' },
          coherenceScore: { type: 'number', minimum: 0, maximum: 1 },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
                message: { type: 'string' },
                affectedStreams: { type: 'array', items: { type: 'string' } }
              },
              required: ['severity', 'message', 'affectedStreams']
            }
          },
          warnings: { type: 'array', items: { type: 'string' } },
          suggestions: { type: 'array', items: { type: 'string' } }
        },
        required: ['isValid', 'coherenceScore', 'issues', 'warnings', 'suggestions']
      }
    });
    
    console.log(`[${this.name}] Coherence score: ${(result.coherenceScore * 100).toFixed(1)}%`);
    console.log(`[${this.name}] Critical issues: ${result.issues.filter(i => i.severity === 'critical').length}`);
    console.log(`[${this.name}] Warnings: ${result.warnings.length}`);
    
    return result;
  }
  
  /**
   * Build validation prompt
   */
  private buildValidationPrompt(input: ValidationInput): string {
    const { objective, context, workstreams } = input;
    
    return `
You are validating the semantic coherence of a work breakdown structure.

=== ORIGINAL BUSINESS OBJECTIVE ===
${objective}

Business: ${context.business.name}
Type: ${context.business.type}
Scale: ${context.business.scale}
Description: ${context.business.description}

=== GENERATED WORK STREAMS ===
${workstreams.map((ws, i) => `
${i + 1}. ${ws.name} (${ws.proportionalEffort.toFixed(1)}% effort)
   Category: ${ws.category}
   Priority: ${ws.priority}
   Description: ${ws.description}
`).join('\n')}

=== YOUR TASK ===

Validate semantic coherence by checking:

1. **Intent-Stream Alignment**
   - Do the workstreams match the business objective?
   - Are they addressing the right problem?
   
   Example MISMATCH:
   - Objective: "Open a coffee shop"
   - Workstream: "Platform Development" (60% effort)
   - Issue: Coffee shops don't build platforms, they serve coffee
   
   Example MATCH:
   - Objective: "Open a coffee shop"
   - Workstream: "Location & Buildout" (35% effort)
   - Valid: Physical business needs physical infrastructure

2. **Effort Proportions**
   - Are effort allocations reasonable for this business type?
   
   Red flags:
   - Coffee shop with 60% technology effort
   - SaaS platform with 60% physical infrastructure effort
   - Retail store with 50% software development effort
   
   Green flags:
   - Physical business: 30-40% infrastructure, 10% technology
   - Software business: 55-65% technology, 5% infrastructure
   - Service business: 25-35% human resources

3. **Missing Critical Streams**
   - Are any essential work streams missing?
   
   Examples:
   - Physical business without location/permits
   - Any business without operations/hiring
   - Software business without technology platform

4. **Inappropriate Streams**
   - Are there work streams that don't make sense?
   
   Examples:
   - "Software Platform Development" for a physical coffee shop
   - "Retail Buildout" for a SaaS product
   - "Manufacturing Setup" for a consulting service

Return a ValidationResult with:
- isValid: true if semantically coherent, false if major mismatches
- coherenceScore: 0-1 score of how well streams match objective
- issues: List critical/warning issues found
- warnings: General concerns (but not blocking)
- suggestions: How to improve the work breakdown

Be strict but fair. A score above 0.8 is excellent, 0.6-0.8 is acceptable, below 0.6 indicates problems.
    `.trim();
  }
  
  /**
   * Optional: Validate input before processing
   */
  async validate(input: ValidationInput): Promise<boolean> {
    if (!input.objective || !input.workstreams || input.workstreams.length === 0) {
      console.error(`[${this.name}] Invalid input: missing objective or workstreams`);
      return false;
    }
    return true;
  }
}
