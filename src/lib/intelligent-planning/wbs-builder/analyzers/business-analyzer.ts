/**
 * Business Analyzer - Understands business intent using LLM
 * Determines what is being created, technology's role, and value creation model
 */

import { IAnalyzer, AnalysisInput, BusinessIntent, InitiativeType, TechnologyRole, ILLMProvider } from '../interfaces';

export class BusinessAnalyzer implements IAnalyzer {
  name = 'BusinessAnalyzer';
  
  constructor(private llm: ILLMProvider) {}
  
  /**
   * Analyze business intent from strategic insights
   * STRATEGY-AWARE: Uses BMC strategic recommendations to override assumptions
   */
  async process(input: AnalysisInput): Promise<BusinessIntent> {
    const { insights, context, strategyProfile } = input;
    
    console.log(`[${this.name}] Analyzing business intent...`);
    console.log(`[${this.name}] Business: ${context.business.name}`);
    console.log(`[${this.name}] Type hint: ${context.business.type}`);
    
    if (strategyProfile) {
      console.log(`[${this.name}] STRATEGY OVERRIDE: Archetype=${strategyProfile.archetype}, Digital Intensity=${strategyProfile.digitalIntensity}%`);
    }
    
    const prompt = this.buildAnalysisPrompt(insights, context, strategyProfile);
    
    const result = await this.llm.generateStructured<BusinessIntent>({
      prompt,
      schema: {
        type: 'object',
        properties: {
          initiativeType: {
            type: 'string',
            enum: ['business_launch', 'software_development', 'digital_transformation', 'market_expansion', 'product_launch', 'general']
          },
          technologyRole: {
            type: 'string',
            enum: ['core_product', 'operational_tool', 'minimal']
          },
          businessModel: { type: 'string' },
          primaryValueCreation: { type: 'string' },
          isPhysical: { type: 'boolean' },
          isDigital: { type: 'boolean' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['initiativeType', 'technologyRole', 'businessModel', 'primaryValueCreation', 'isPhysical', 'isDigital', 'confidence']
      }
    });
    
    // Apply strategy profile overrides
    if (strategyProfile?.technologyRoleOverride) {
      console.log(`[${this.name}] Applying strategy tech role override: ${strategyProfile.technologyRoleOverride}`);
      result.technologyRole = strategyProfile.technologyRoleOverride;
    }
    
    console.log(`[${this.name}] Detected initiative type: ${result.initiativeType}`);
    console.log(`[${this.name}] Technology role: ${result.technologyRole}`);
    console.log(`[${this.name}] Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    
    return result;
  }
  
  /**
   * Build analysis prompt with business context
   * STRATEGY-AWARE: Includes BMC strategic recommendations
   */
  private buildAnalysisPrompt(insights: any, context: any, strategyProfile?: any): string {
    let strategySection = '';
    
    if (strategyProfile) {
      strategySection = `

=== STRATEGIC ANALYSIS (BMC RECOMMENDATIONS) ===
Digital Intensity: ${strategyProfile.digitalIntensity}%
Strategic Archetype: ${strategyProfile.archetype}
Platform Development Needed: ${strategyProfile.needsPlatform ? 'YES' : 'NO'}
Recommended Tech Role: ${strategyProfile.technologyRoleOverride || 'To be determined'}

CRITICAL: The BMC analysis has determined that this business should follow a ${strategyProfile.archetype} model.
This means the strategy RECOMMENDS ${strategyProfile.needsPlatform ? 'building platform/technology capabilities' : 'minimal technology focus'}.

You MUST respect the strategic recommendations above. If BMC says platform development is needed,
then technology is a strategic enabler regardless of the base business type.
`;
    }
    
    return `
You are analyzing a business initiative to understand its fundamental nature.

=== BUSINESS CONTEXT ===
Name: ${context.business.name}
Description: ${context.business.description}
Industry: ${context.business.industry}
Scale: ${context.business.scale}
${strategySection}
=== STRATEGIC INSIGHTS ===
${JSON.stringify(insights, null, 2)}

Your task: Determine the FUNDAMENTAL NATURE of what's being done, RESPECTING the strategic recommendations above.

Critical distinctions to make:

1. INITIATIVE TYPE:
   - business_launch: Opening/starting a NEW physical or service business (restaurant, coffee shop, retail store, service company)
   - software_development: Building SOFTWARE PRODUCTS (SaaS platform, mobile app, web application)
   - digital_transformation: Adding digital capabilities to EXISTING business
   - market_expansion: Expanding existing business to new markets
   - product_launch: Launching a new product line
   - general: Other/unclear initiatives

2. TECHNOLOGY'S ROLE:
   - core_product: Technology IS the product being sold (e.g., SaaS platform, mobile app)
   - operational_tool: Technology SUPPORTS the business (e.g., POS system in coffee shop, inventory system in retail)
   - minimal: Very little technology involved

3. VALUE CREATION:
   - What is the PRIMARY way this business creates value for customers?
   - Is it a physical product, a service, software, or combination?

=== CRITICAL REASONING ===

Example 1: "Open a coffee shop in Brooklyn"
- Initiative type: business_launch (opening a NEW business)
- Technology role: operational_tool (POS, inventory are tools, not the product)
- Is physical: true (physical location, equipment, inventory)
- Is digital: false (not selling software)
- Primary value: Selling coffee and food in a physical space

Example 2: "Build a project management SaaS platform"
- Initiative type: software_development (building software)
- Technology role: core_product (software IS what's being sold)
- Is physical: false (no physical location needed)
- Is digital: true (entirely digital product)
- Primary value: Software that helps teams manage projects

Example 3: "Add online ordering to existing restaurant"
- Initiative type: digital_transformation (adding digital to existing)
- Technology role: operational_tool (online ordering supports restaurant)
- Is physical: true (restaurant still serves physical food)
- Is digital: true (adding digital ordering)
- Primary value: Restaurant food + convenience of online ordering

=== YOUR ANALYSIS ===

Based on the context above, provide a structured BusinessIntent object.

IMPORTANT CHECKS:
- If opening a physical business (coffee shop, restaurant, retail), initiative type = business_launch
- If building software/platform/app, initiative type = software_development
- If software is mentioned but it's just USING software (not building it), technology role = operational_tool
- Be very careful not to confuse "using POS software" with "building software"

Return the BusinessIntent JSON object.
    `.trim();
  }
  
  /**
   * Optional: Validate input before processing
   */
  async validate(input: AnalysisInput): Promise<boolean> {
    if (!input.insights || !input.context) {
      console.error(`[${this.name}] Invalid input: missing insights or context`);
      return false;
    }
    return true;
  }
}
