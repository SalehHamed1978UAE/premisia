/**
 * Porter's + PESTLE → SWOT Bridge
 * 
 * Transforms Porter's Five Forces (with PESTLE context) into SWOT Opportunities and Threats.
 * This bridge implements the cognitive mapping table from the spec:
 * 
 * - Low forces → Opportunities
 * - High forces → Threats
 * - Combined with PESTLE factors for complete O/T derivation
 */

import { z } from 'zod';
import type { BridgeContract, BridgeContext, InterpretationRule, BridgeValidationResult } from '@shared/contracts/bridge.contract';
import { PortersOutputSchema, type PortersOutput } from '@shared/contracts/porters.schema';
import { type PESTLEOutput } from '@shared/contracts/pestle.schema';

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT SCHEMA (What we pass to SWOT)
// ─────────────────────────────────────────────────────────────────────────────

export const PortersToSWOTEnhancementSchema = z.object({
  // Raw outputs for reference
  portersOutput: PortersOutputSchema,
  pestleOutput: z.unknown().optional(), // Will be included if available
  
  // Derived opportunities (from weak forces + favorable PESTLE)
  derivedOpportunities: z.array(z.object({
    id: z.string(),
    description: z.string(),
    source: z.enum(['porters_force', 'pestle_factor', 'combined']),
    sourceDetails: z.object({
      portersForce: z.string().optional(),
      portersLevel: z.string().optional(),
      pestleFactorId: z.string().optional(),
      pestleFactor: z.string().optional(),
    }),
    magnitude: z.enum(['high', 'medium', 'low']),
    rationale: z.string(),
  })),
  
  // Derived threats (from strong forces + unfavorable PESTLE)
  derivedThreats: z.array(z.object({
    id: z.string(),
    description: z.string(),
    source: z.enum(['porters_force', 'pestle_factor', 'combined']),
    sourceDetails: z.object({
      portersForce: z.string().optional(),
      portersLevel: z.string().optional(),
      pestleFactorId: z.string().optional(),
      pestleFactor: z.string().optional(),
    }),
    magnitude: z.enum(['high', 'medium', 'low']),
    likelihood: z.enum(['high', 'medium', 'low']).optional(),
    rationale: z.string(),
  })),
  
  // Competitor insights for S/W context
  competitorInsights: z.object({
    weaknesses: z.array(z.object({
      competitor: z.string(),
      weakness: z.string(),
      opportunityImplication: z.string(),
    })),
    strengths: z.array(z.object({
      competitor: z.string(),
      strength: z.string(),
      threatImplication: z.string(),
    })),
  }),
  
  // Transformation summary
  transformationSummary: z.array(z.object({
    sourceType: z.string(),
    sourceItem: z.string(),
    targetType: z.enum(['opportunity', 'threat']),
    transformation: z.string(),
  })),
});

export type PortersToSWOTEnhancement = z.infer<typeof PortersToSWOTEnhancementSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// INTERPRETATION RULES
// ─────────────────────────────────────────────────────────────────────────────

const interpretationRules: InterpretationRule[] = [
  {
    id: 'low_force_to_opportunity',
    description: 'Low competitive forces become opportunities',
    sourceField: 'forces',
    targetField: 'derivedOpportunities',
    
    transform: (value: unknown, ctx: BridgeContext): unknown => {
      const forces = value as PortersOutput['forces'];
      const opportunities: any[] = [];
      let idCounter = 1;
      
      const forceMapping = [
        { key: 'threatOfNewEntrants', name: 'Threat of New Entrants', lowOpportunity: 'Protected market position - high barriers deter new competitors' },
        { key: 'supplierPower', name: 'Supplier Power', lowOpportunity: 'Favorable supplier negotiations possible - multiple supplier options' },
        { key: 'buyerPower', name: 'Buyer Power', lowOpportunity: 'Premium pricing sustainable - buyers have limited alternatives or low price sensitivity' },
        { key: 'threatOfSubstitutes', name: 'Threat of Substitutes', lowOpportunity: 'Unique value proposition - limited alternatives strengthen position' },
        { key: 'competitiveRivalry', name: 'Competitive Rivalry', lowOpportunity: 'Market share available - less competitive pressure enables growth' },
      ];
      
      for (const mapping of forceMapping) {
        const force = forces[mapping.key as keyof typeof forces];
        if (force.level === 'low' || force.level === 'very_low') {
          opportunities.push({
            id: `O-P-${idCounter++}`,
            description: mapping.lowOpportunity,
            source: 'porters_force',
            sourceDetails: {
              portersForce: mapping.name,
              portersLevel: force.level,
            },
            magnitude: force.level === 'very_low' ? 'high' : 'medium',
            rationale: `${mapping.name} is ${force.level}, creating favorable competitive conditions`,
          });
        }
      }
      
      return opportunities;
    },
    
    interpretation: 'Weak competitive forces = opportunities. Low buyer power means easier pricing.',
    
    example: {
      source: { threatOfNewEntrants: { level: 'low' } },
      target: { description: 'Protected market position', magnitude: 'medium' },
      explanation: 'Low entry threat becomes protected market opportunity',
    },
  },
  
  {
    id: 'high_force_to_threat',
    description: 'High competitive forces become threats',
    sourceField: 'forces',
    targetField: 'derivedThreats',
    
    transform: (value: unknown, ctx: BridgeContext): unknown => {
      const forces = value as PortersOutput['forces'];
      const threats: any[] = [];
      let idCounter = 1;
      
      const forceMapping = [
        { key: 'threatOfNewEntrants', name: 'Threat of New Entrants', highThreat: 'Vulnerable to new competitors - low barriers enable market entry' },
        { key: 'supplierPower', name: 'Supplier Power', highThreat: 'Supplier dependency risk - limited options constrain negotiating power' },
        { key: 'buyerPower', name: 'Buyer Power', highThreat: 'Margin compression risk - buyers can demand lower prices or switch' },
        { key: 'threatOfSubstitutes', name: 'Threat of Substitutes', highThreat: 'Customer defection risk - alternatives compete for same customers' },
        { key: 'competitiveRivalry', name: 'Competitive Rivalry', highThreat: 'Competitive pressure on margins - price wars and marketing battles likely' },
      ];
      
      for (const mapping of forceMapping) {
        const force = forces[mapping.key as keyof typeof forces];
        if (force.level === 'high' || force.level === 'very_high') {
          threats.push({
            id: `T-P-${idCounter++}`,
            description: mapping.highThreat,
            source: 'porters_force',
            sourceDetails: {
              portersForce: mapping.name,
              portersLevel: force.level,
            },
            magnitude: force.level === 'very_high' ? 'high' : 'medium',
            likelihood: 'medium',
            rationale: `${mapping.name} is ${force.level}, creating challenging competitive conditions`,
          });
        }
      }
      
      return threats;
    },
    
    interpretation: 'Strong competitive forces = threats. High rivalry means margin pressure.',
    
    example: {
      source: { competitiveRivalry: { level: 'high' } },
      target: { description: 'Competitive pressure on margins', magnitude: 'medium' },
      explanation: 'High rivalry becomes margin pressure threat',
    },
  },
  
  {
    id: 'competitor_weakness_to_opportunity',
    description: 'Competitor weaknesses become opportunities',
    sourceField: 'competitorsIdentified',
    targetField: 'competitorInsights.weaknesses',
    
    transform: (value: unknown, ctx: BridgeContext): unknown => {
      const competitors = value as PortersOutput['competitorsIdentified'];
      const weaknesses: any[] = [];
      
      for (const competitor of competitors) {
        if (competitor.weaknesses && competitor.weaknesses.length > 0) {
          for (const weakness of competitor.weaknesses) {
            weaknesses.push({
              competitor: competitor.name,
              weakness,
              opportunityImplication: `${competitor.name}'s weakness in "${weakness}" creates opportunity to differentiate`,
            });
          }
        }
      }
      
      return weaknesses;
    },
    
    interpretation: 'Competitor weaknesses = market opportunities to exploit',
    
    example: {
      source: { name: 'Competitor X', weaknesses: ['Poor customer service'] },
      target: { opportunityImplication: 'Differentiate through superior service' },
      explanation: 'Competitor gap becomes differentiation opportunity',
    },
  },
  
  {
    id: 'competitor_strength_to_threat',
    description: 'Competitor strengths become threats',
    sourceField: 'competitorsIdentified',
    targetField: 'competitorInsights.strengths',
    
    transform: (value: unknown, ctx: BridgeContext): unknown => {
      const competitors = value as PortersOutput['competitorsIdentified'];
      const strengths: any[] = [];
      
      for (const competitor of competitors) {
        if (competitor.strengths && competitor.strengths.length > 0) {
          for (const strength of competitor.strengths) {
            strengths.push({
              competitor: competitor.name,
              strength,
              threatImplication: `${competitor.name}'s strength in "${strength}" poses competitive threat`,
            });
          }
        }
      }
      
      return strengths;
    },
    
    interpretation: 'Competitor strengths = threats to our position',
    
    example: {
      source: { name: 'Competitor X', strengths: ['Brand recognition'] },
      target: { threatImplication: 'Brand recognition poses competitive threat' },
      explanation: 'Competitor advantage becomes positional threat',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PESTLE TO O/T (Additional function for PESTLE integration)
// ─────────────────────────────────────────────────────────────────────────────

function derivePESTLEOpportunitiesAndThreats(pestleOutput: PESTLEOutput | undefined): {
  opportunities: PortersToSWOTEnhancement['derivedOpportunities'];
  threats: PortersToSWOTEnhancement['derivedThreats'];
} {
  if (!pestleOutput) {
    return { opportunities: [], threats: [] };
  }
  
  const opportunities: PortersToSWOTEnhancement['derivedOpportunities'] = [];
  const threats: PortersToSWOTEnhancement['derivedThreats'] = [];
  
  let oppCounter = 1;
  let threatCounter = 1;
  
  // Use prioritized factors and explicit O/T from PESTLE
  for (const opp of pestleOutput.opportunities || []) {
    opportunities.push({
      id: `O-PESTLE-${oppCounter++}`,
      description: opp.description,
      source: 'pestle_factor',
      sourceDetails: {
        pestleFactorId: opp.sourceFactors[0],
        pestleFactor: opp.description,
      },
      magnitude: opp.magnitude,
      rationale: `PESTLE identified favorable macro-environmental condition`,
    });
  }
  
  for (const threat of pestleOutput.threats || []) {
    threats.push({
      id: `T-PESTLE-${threatCounter++}`,
      description: threat.description,
      source: 'pestle_factor',
      sourceDetails: {
        pestleFactorId: threat.sourceFactors[0],
        pestleFactor: threat.description,
      },
      magnitude: threat.magnitude,
      likelihood: threat.likelihood || 'medium',
      rationale: `PESTLE identified unfavorable macro-environmental condition`,
    });
  }
  
  return { opportunities, threats };
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFORM FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

async function transform(
  from: PortersOutput,
  context: BridgeContext
): Promise<PortersToSWOTEnhancement> {
  const transformationSummary: PortersToSWOTEnhancement['transformationSummary'] = [];
  
  // Get PESTLE output from context if available
  const pestleOutput = context.allPriorOutputs.pestle as PESTLEOutput | undefined;
  
  // Apply Porter's forces → Opportunities (low forces)
  const portersOpportunities = interpretationRules[0].transform(from.forces, context) as any[];
  for (const opp of portersOpportunities) {
    transformationSummary.push({
      sourceType: 'Porter\'s Force',
      sourceItem: `${opp.sourceDetails.portersForce} (${opp.sourceDetails.portersLevel})`,
      targetType: 'opportunity',
      transformation: opp.description,
    });
  }
  
  // Apply Porter's forces → Threats (high forces)
  const portersThreats = interpretationRules[1].transform(from.forces, context) as any[];
  for (const threat of portersThreats) {
    transformationSummary.push({
      sourceType: 'Porter\'s Force',
      sourceItem: `${threat.sourceDetails.portersForce} (${threat.sourceDetails.portersLevel})`,
      targetType: 'threat',
      transformation: threat.description,
    });
  }
  
  // Apply competitor insights
  const competitorWeaknesses = interpretationRules[2].transform(from.competitorsIdentified, context) as any[];
  const competitorStrengths = interpretationRules[3].transform(from.competitorsIdentified, context) as any[];
  
  for (const weakness of competitorWeaknesses) {
    transformationSummary.push({
      sourceType: 'Competitor Weakness',
      sourceItem: `${weakness.competitor}: ${weakness.weakness}`,
      targetType: 'opportunity',
      transformation: weakness.opportunityImplication,
    });
  }
  
  for (const strength of competitorStrengths) {
    transformationSummary.push({
      sourceType: 'Competitor Strength',
      sourceItem: `${strength.competitor}: ${strength.strength}`,
      targetType: 'threat',
      transformation: strength.threatImplication,
    });
  }
  
  // Get PESTLE-derived O/T
  const { opportunities: pestleOpportunities, threats: pestleThreats } = 
    derivePESTLEOpportunitiesAndThreats(pestleOutput);
  
  for (const opp of pestleOpportunities) {
    transformationSummary.push({
      sourceType: 'PESTLE Factor',
      sourceItem: opp.sourceDetails.pestleFactor || 'Unknown',
      targetType: 'opportunity',
      transformation: opp.description,
    });
  }
  
  for (const threat of pestleThreats) {
    transformationSummary.push({
      sourceType: 'PESTLE Factor',
      sourceItem: threat.sourceDetails.pestleFactor || 'Unknown',
      targetType: 'threat',
      transformation: threat.description,
    });
  }
  
  return {
    portersOutput: from,
    pestleOutput: pestleOutput,
    derivedOpportunities: [...portersOpportunities, ...pestleOpportunities],
    derivedThreats: [...portersThreats, ...pestleThreats],
    competitorInsights: {
      weaknesses: competitorWeaknesses,
      strengths: competitorStrengths,
    },
    transformationSummary,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATE FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

function validate(from: PortersOutput, to: PortersToSWOTEnhancement): BridgeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check that we produced some O/T
  if (to.derivedOpportunities.length === 0) {
    warnings.push('No opportunities derived - all forces may be neutral or high');
  }
  
  if (to.derivedThreats.length === 0) {
    warnings.push('No threats derived - all forces may be neutral or low');
  }
  
  // Check that O/T have proper source attribution
  const missingSource = [
    ...to.derivedOpportunities.filter(o => !o.sourceDetails.portersForce && !o.sourceDetails.pestleFactorId),
    ...to.derivedThreats.filter(t => !t.sourceDetails.portersForce && !t.sourceDetails.pestleFactorId),
  ];
  
  if (missingSource.length > 0) {
    warnings.push(`${missingSource.length} O/T items missing source attribution`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    transformationCount: to.transformationSummary.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

export const PortersToSWOTBridge: BridgeContract<PortersOutput, PortersToSWOTEnhancement> = {
  id: 'porters_to_swot',
  fromModule: 'porters',
  toModule: 'swot',
  description: 'Transforms Porter\'s Five Forces (with PESTLE context) into SWOT Opportunities and Threats',
  
  fromSchema: PortersOutputSchema,
  toSchema: PortersToSWOTEnhancementSchema,
  
  transform,
  interpretationRules,
  validate,
};

/**
 * Apply the Porter's to SWOT bridge
 * Convenience function for use in journey orchestrator
 */
export function applyPortersToSWOTBridge(
  portersOutput: PortersOutput,
  pestleOutput: PESTLEOutput | undefined,
  positioning: any
): Promise<PortersToSWOTEnhancement> {
  return PortersToSWOTBridge.transform(portersOutput, {
    positioning,
    allPriorOutputs: { 
      porters: portersOutput,
      pestle: pestleOutput,
    },
  });
}
