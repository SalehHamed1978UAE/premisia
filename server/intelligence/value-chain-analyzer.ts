/**
 * Value Chain Analyzer
 * Analyzes Porter's Value Chain to identify sources of competitive advantage
 * Examines primary and support activities
 */

import { aiClients } from '../ai-clients';

export interface ValueChainInput {
  businessContext: string;
  industry: string;
  portersOutput?: any;
  competitivePositionData?: any;
  operationsData?: any;
}

export interface Activity {
  name: string;
  description: string;
  costPercentage?: number;
  valueCreation: 'high' | 'medium' | 'low';
  competitivePosition: 'advantage' | 'neutral' | 'disadvantage';
  keyDrivers: string[];
  improvementOpportunities: string[];
  benchmarkVsIndustry: string;
}

export interface ValueChainOutput {
  primaryActivities: {
    inboundLogistics: Activity;
    operations: Activity;
    outboundLogistics: Activity;
    marketing: Activity;
    service: Activity;
    summary: {
      totalCostPercentage: number;
      valueCreationScore: number;
      description: string;
    };
  };
  supportActivities: {
    firmInfrastructure: Activity;
    humanResources: Activity;
    technologyDevelopment: Activity;
    procurement: Activity;
    summary: {
      totalCostPercentage: number;
      valueCreationScore: number;
      description: string;
    };
  };
  valueDrivers: {
    driver: string;
    impact: 'high' | 'medium' | 'low';
    currentPerformance: string;
    improvementPotential: string;
  }[];
  costDrivers: {
    driver: string;
    currentCostImpact: 'high' | 'medium' | 'low';
    optimizationOpportunity: string;
    estimatedSavings?: string;
  }[];
  competitiveAdvantages: {
    source: string;
    location: string;
    type: 'cost' | 'differentiation' | 'both';
    sustainability: 'sustainable' | 'temporary';
    defensibility: 'high' | 'medium' | 'low';
    description: string;
  }[];
  linkages: {
    description: string;
    example: string;
    valueCreation: string;
  }[];
  strategicOpportunities: {
    opportunity: string;
    activities: string[];
    potentialImpact: string;
    implementationComplexity: 'high' | 'medium' | 'low';
  }[];
  priorityActions: string[];
  confidence: number;
  metadata: {
    industryAnalyzed: string;
    inputSources: string[];
    generatedAt: string;
  };
}

export class ValueChainAnalyzer {
  async analyze(input: ValueChainInput): Promise<ValueChainOutput> {
    console.log('[ValueChain Analyzer] Starting analysis...');

    const contextParts: string[] = [input.businessContext];
    const inputSources: string[] = ['business_context'];

    contextParts.push(`Industry: ${input.industry}`);

    if (input.portersOutput) {
      contextParts.push(`Porter's Five Forces: ${JSON.stringify(input.portersOutput)}`);
      inputSources.push('porters');
    }

    if (input.competitivePositionData) {
      contextParts.push(`Competitive Position Data: ${JSON.stringify(input.competitivePositionData)}`);
      inputSources.push('competitive');
    }

    if (input.operationsData) {
      contextParts.push(`Operations Data: ${JSON.stringify(input.operationsData)}`);
      inputSources.push('operations');
    }

    const prompt = `
Perform a comprehensive Value Chain analysis for this business:

${contextParts.join('\n\n')}

Analyze the business's value chain across all activities:

1. PRIMARY ACTIVITIES (directly involved in creating and delivering value)

   A. INBOUND LOGISTICS
      - How are raw materials/inputs sourced?
      - Quality and reliability of supply
      - Cost efficiency
      - Competitive position vs industry

   B. OPERATIONS
      - Manufacturing/service delivery processes
      - Efficiency and quality metrics
      - Technology utilization
      - Competitive advantages/disadvantages

   C. OUTBOUND LOGISTICS
      - Distribution and delivery methods
      - Speed and reliability
      - Customer experience
      - Cost effectiveness

   D. MARKETING & SALES
      - Brand positioning and messaging
      - Sales channels and effectiveness
      - Customer acquisition costs
      - Market reach and penetration

   E. SERVICE
      - Post-purchase support quality
      - Warranty and returns handling
      - Customer satisfaction
      - Differentiation through service

   For each activity, provide: description, cost %, value creation (high/medium/low), competitive position (advantage/neutral/disadvantage), key drivers, improvement opportunities, and industry benchmark comparison.

2. SUPPORT ACTIVITIES (enable primary activities to function)

   A. FIRM INFRASTRUCTURE
      - Management and governance
      - Financial systems
      - Quality control
      - Organizational structure

   B. HUMAN RESOURCES
      - Recruitment and training
      - Employee motivation
      - Compensation strategy
      - Skill development

   C. TECHNOLOGY DEVELOPMENT
      - R&D investment
      - Process improvements
      - Digital capabilities
      - Innovation focus

   D. PROCUREMENT
      - Supplier relationships
      - Purchasing efficiency
      - Strategic sourcing
      - Supplier quality

   For each activity, provide same details as primary activities.

3. VALUE DRIVERS (what creates value in the business)
   - Driver name
   - Impact level: high/medium/low
   - Current performance description
   - Improvement potential

4. COST DRIVERS (what creates costs in the business)
   - Cost driver name
   - Current cost impact: high/medium/low
   - Optimization opportunity description
   - Estimated savings potential

5. COMPETITIVE ADVANTAGES
   For each advantage (2-4):
   - Source/description
   - Which value chain location(s)
   - Type: cost/differentiation/both
   - Sustainability: sustainable/temporary
   - Defensibility: high/medium/low

6. LINKAGES (connections between activities that create value)
   - 2-3 important linkages
   - Example of the linkage
   - Value creation from this linkage

7. STRATEGIC OPPORTUNITIES (ways to improve the value chain)
   For each opportunity:
   - Clear opportunity description
   - Which activities are involved
   - Potential impact
   - Implementation complexity

8. PRIORITY ACTIONS: Top 3-5 value chain improvement actions

Return as JSON:
{
  "primaryActivities": {
    "inboundLogistics": {"name": "", "description": "", "costPercentage": 10, "valueCreation": "high", "competitivePosition": "advantage", "keyDrivers": [], "improvementOpportunities": [], "benchmarkVsIndustry": ""},
    "operations": {"name": "", "description": "", "costPercentage": 30, "valueCreation": "high", "competitivePosition": "advantage", "keyDrivers": [], "improvementOpportunities": [], "benchmarkVsIndustry": ""},
    "outboundLogistics": {"name": "", "description": "", "costPercentage": 8, "valueCreation": "medium", "competitivePosition": "neutral", "keyDrivers": [], "improvementOpportunities": [], "benchmarkVsIndustry": ""},
    "marketing": {"name": "", "description": "", "costPercentage": 15, "valueCreation": "high", "competitivePosition": "advantage", "keyDrivers": [], "improvementOpportunities": [], "benchmarkVsIndustry": ""},
    "service": {"name": "", "description": "", "costPercentage": 5, "valueCreation": "medium", "competitivePosition": "neutral", "keyDrivers": [], "improvementOpportunities": [], "benchmarkVsIndustry": ""},
    "summary": {"totalCostPercentage": 68, "valueCreationScore": 8, "description": ""}
  },
  "supportActivities": {
    "firmInfrastructure": {"name": "", "description": "", "costPercentage": 5, "valueCreation": "medium", "competitivePosition": "neutral", "keyDrivers": [], "improvementOpportunities": [], "benchmarkVsIndustry": ""},
    "humanResources": {"name": "", "description": "", "costPercentage": 10, "valueCreation": "high", "competitivePosition": "advantage", "keyDrivers": [], "improvementOpportunities": [], "benchmarkVsIndustry": ""},
    "technologyDevelopment": {"name": "", "description": "", "costPercentage": 8, "valueCreation": "high", "competitivePosition": "advantage", "keyDrivers": [], "improvementOpportunities": [], "benchmarkVsIndustry": ""},
    "procurement": {"name": "", "description": "", "costPercentage": 9, "valueCreation": "medium", "competitivePosition": "neutral", "keyDrivers": [], "improvementOpportunities": [], "benchmarkVsIndustry": ""},
    "summary": {"totalCostPercentage": 32, "valueCreationScore": 7, "description": ""}
  },
  "valueDrivers": [{"driver": "", "impact": "high", "currentPerformance": "", "improvementPotential": ""}],
  "costDrivers": [{"driver": "", "currentCostImpact": "high", "optimizationOpportunity": "", "estimatedSavings": ""}],
  "competitiveAdvantages": [{"source": "", "location": "", "type": "cost", "sustainability": "sustainable", "defensibility": "high", "description": ""}],
  "linkages": [{"description": "", "example": "", "valueCreation": ""}],
  "strategicOpportunities": [{"opportunity": "", "activities": [], "potentialImpact": "", "implementationComplexity": "medium"}],
  "priorityActions": []
}
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a value chain analyst specializing in Porter\'s Value Chain framework. Return only valid JSON.',
        userMessage: prompt,
        maxTokens: 4000,
      });

      const result = JSON.parse(response.content);

      console.log('[ValueChain Analyzer] Analysis complete');
      console.log(`  Value Drivers: ${result.valueDrivers?.length || 0}`);
      console.log(`  Cost Drivers: ${result.costDrivers?.length || 0}`);
      console.log(`  Competitive Advantages: ${result.competitiveAdvantages?.length || 0}`);
      console.log(`  Linkages: ${result.linkages?.length || 0}`);

      return {
        ...result,
        confidence: this.calculateConfidence(result, inputSources),
        metadata: {
          industryAnalyzed: input.industry,
          inputSources,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[ValueChain Analyzer] Analysis failed:', error);
      throw error;
    }
  }

  private calculateConfidence(result: any, inputSources: string[]): number {
    let confidence = 0.6;

    confidence += inputSources.length * 0.05;

    if (result.primaryActivities && Object.keys(result.primaryActivities).length >= 5) confidence += 0.1;
    if (result.supportActivities && Object.keys(result.supportActivities).length >= 4) confidence += 0.05;
    if (result.competitiveAdvantages?.length >= 2) confidence += 0.1;
    if (result.strategicOpportunities?.length >= 2) confidence += 0.05;

    return Math.min(0.95, confidence);
  }
}

export const valueChainAnalyzer = new ValueChainAnalyzer();
