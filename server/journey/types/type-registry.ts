/**
 * Type Registry - Defines all module input/output schemas
 * Used for validation and transformation between modules
 */

export interface TypeSchema {
  id: string;
  name: string;
  description: string;
  jsonSchema: any;
  category: 'input' | 'output' | 'intermediate';
}

export const TYPE_REGISTRY: Record<string, TypeSchema> = {
  'business_context': {
    id: 'business_context',
    name: 'Business Context',
    description: 'Raw business description and context',
    category: 'input',
    jsonSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        industry: { type: 'string' },
        scale: { type: 'string' },
        geography: { type: 'string' },
      },
      required: ['description'],
    },
  },

  'bmc_output': {
    id: 'bmc_output',
    name: 'Business Model Canvas',
    description: 'Complete BMC with all 9 building blocks',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        valuePropositions: { type: 'array' },
        customerSegments: { type: 'array' },
        channels: { type: 'array' },
        customerRelationships: { type: 'array' },
        revenueStreams: { type: 'array' },
        keyResources: { type: 'array' },
        keyActivities: { type: 'array' },
        keyPartners: { type: 'array' },
        costStructure: { type: 'array' },
      },
    },
  },

  'swot_output': {
    id: 'swot_output',
    name: 'SWOT Analysis',
    description: 'Strengths, Weaknesses, Opportunities, Threats with strategies',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        strengths: { type: 'array' },
        weaknesses: { type: 'array' },
        opportunities: { type: 'array' },
        threats: { type: 'array' },
        strategicOptions: { type: 'object' },
      },
    },
  },

  'pestle_output': {
    id: 'pestle_output',
    name: 'PESTLE Analysis',
    description: 'Macro-environmental analysis',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        political: { type: 'array' },
        economic: { type: 'array' },
        social: { type: 'array' },
        technological: { type: 'array' },
        legal: { type: 'array' },
        environmental: { type: 'array' },
      },
    },
  },

  'segment_output': {
    id: 'segment_output',
    name: 'Segment Discovery Output',
    description: 'Discovered customer segments with profiles',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        segments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              size: { type: 'string' },
              characteristics: { type: 'array' },
            },
          },
        },
        recommendation: { type: 'object' },
      },
    },
  },

  'porters_output': {
    id: 'porters_output',
    name: "Porter's Five Forces",
    description: 'Competitive analysis with force ratings',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        competitiveRivalry: { type: 'object' },
        supplierPower: { type: 'object' },
        buyerPower: { type: 'object' },
        threatOfSubstitution: { type: 'object' },
        threatOfNewEntry: { type: 'object' },
      },
    },
  },

  'ansoff_output': {
    id: 'ansoff_output',
    name: 'Ansoff Matrix',
    description: 'Growth strategy recommendations',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        marketPenetration: { type: 'object' },
        marketDevelopment: { type: 'object' },
        productDevelopment: { type: 'object' },
        diversification: { type: 'object' },
        recommendation: { type: 'object' },
      },
    },
  },

  'jtbd_output': {
    id: 'jtbd_output',
    name: 'Jobs To Be Done',
    description: 'Customer jobs and opportunities',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        coreJobs: { type: 'array' },
        relatedJobs: { type: 'array' },
        opportunities: { type: 'object' },
      },
    },
  },

  'value_chain_output': {
    id: 'value_chain_output',
    name: 'Value Chain Analysis',
    description: 'Primary and support activities analysis',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        primaryActivities: { type: 'array' },
        supportActivities: { type: 'array' },
        valueDrivers: { type: 'array' },
      },
    },
  },

  'vrio_output': {
    id: 'vrio_output',
    name: 'VRIO Analysis',
    description: 'Resource-based competitive advantage analysis',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        resources: { type: 'array' },
        sustainableAdvantages: { type: 'array' },
      },
    },
  },

  'blue_ocean_output': {
    id: 'blue_ocean_output',
    name: 'Blue Ocean Strategy',
    description: 'Market creation strategy canvas',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        eliminate: { type: 'array' },
        reduce: { type: 'array' },
        raise: { type: 'array' },
        create: { type: 'array' },
        strategyCanvas: { type: 'object' },
      },
    },
  },

  'bcg_output': {
    id: 'bcg_output',
    name: 'BCG Matrix',
    description: 'Product portfolio analysis',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        stars: { type: 'array' },
        cashCows: { type: 'array' },
        questionMarks: { type: 'array' },
        dogs: { type: 'array' },
      },
    },
  },

  'scenario_output': {
    id: 'scenario_output',
    name: 'Scenario Planning',
    description: 'Future scenario analysis',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        scenarios: { type: 'array' },
        implications: { type: 'object' },
        recommendations: { type: 'array' },
      },
    },
  },

  'okr_output': {
    id: 'okr_output',
    name: 'OKR Output',
    description: 'Objectives and Key Results',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        objectives: { type: 'array' },
        alignment: { type: 'object' },
      },
    },
  },

  'epm_output': {
    id: 'epm_output',
    name: 'Execution Plan',
    description: 'Complete execution plan with workstreams and milestones',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        workstreams: { type: 'array' },
        milestones: { type: 'array' },
        timeline: { type: 'object' },
        budget: { type: 'object' },
      },
    },
  },
};

export function getTypeSchema(typeId: string): TypeSchema | null {
  return TYPE_REGISTRY[typeId] || null;
}

export function isValidType(typeId: string): boolean {
  return typeId in TYPE_REGISTRY;
}

export function getAllTypes(): TypeSchema[] {
  return Object.values(TYPE_REGISTRY);
}

export function getTypesByCategory(category: 'input' | 'output' | 'intermediate'): TypeSchema[] {
  return Object.values(TYPE_REGISTRY).filter(t => t.category === category);
}
