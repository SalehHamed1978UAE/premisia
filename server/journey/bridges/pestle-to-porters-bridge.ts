/**
 * PESTLE → Porter's Bridge
 * 
 * Transforms PESTLE analysis into context for Porter's Five Forces.
 * This is a COGNITIVE bridge, not just data mapping.
 * 
 * Key transformations:
 * - Legal/regulatory factors → Entry barriers
 * - Economic conditions → Buyer power context
 * - Technological trends → Substitute threats
 * - Political/trade factors → Supplier power context
 */

import { z } from 'zod';
import type { BridgeContract, BridgeContext, InterpretationRule, BridgeValidationResult } from '@shared/contracts/bridge.contract';
import { PESTLEOutputSchema, type PESTLEOutput, type PESTLEFactor } from '@shared/contracts/pestle.schema';

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT SCHEMA (What we pass to Porter's)
// ─────────────────────────────────────────────────────────────────────────────

export const PESTLEToPortersEnhancementSchema = z.object({
  // Raw PESTLE output for reference
  pestleOutput: PESTLEOutputSchema,
  
  // Interpreted context for each force
  forceContext: z.object({
    threatOfNewEntrants: z.object({
      regulatoryBarriers: z.array(z.object({
        barrier: z.string(),
        severity: z.enum(['high', 'medium', 'low']),
        interpretation: z.string(),
        sourceFactor: z.string(),
      })),
      capitalIntensity: z.object({
        level: z.enum(['high', 'medium', 'low']).optional(),
        interpretation: z.string().optional(),
      }).optional(),
      growthSignal: z.object({
        hasGrowth: z.boolean(),
        growthRate: z.string().optional(),
        interpretation: z.string(),
        sources: z.array(z.string()),
      }).optional(),
    }),
    
    supplierPower: z.object({
      tradeRestrictions: z.array(z.object({
        restriction: z.string(),
        impact: z.string(),
        sourceFactor: z.string(),
      })),
      supplierConcentration: z.object({
        level: z.enum(['high', 'medium', 'low']).optional(),
        interpretation: z.string().optional(),
      }).optional(),
    }),
    
    buyerPower: z.object({
      economicConditions: z.array(z.object({
        condition: z.string(),
        impactOnPriceSensitivity: z.enum(['increases', 'decreases', 'neutral']),
        interpretation: z.string(),
        sourceFactor: z.string(),
      })),
      demographicTrends: z.array(z.object({
        trend: z.string(),
        implication: z.string(),
        sourceFactor: z.string(),
      })),
    }),
    
    threatOfSubstitutes: z.object({
      techEnablers: z.array(z.object({
        enabler: z.string(),
        substituteType: z.string(),
        interpretation: z.string(),
        sourceFactor: z.string(),
      })),
      socialTrends: z.array(z.object({
        trend: z.string(),
        substituteImplication: z.string(),
        sourceFactor: z.string(),
      })),
    }),
    
    competitiveRivalry: z.object({
      marketGrowthContext: z.object({
        growth: z.enum(['growing', 'stable', 'declining']).optional(),
        interpretation: z.string().optional(),
      }).optional(),
      regulatoryImpact: z.object({
        impact: z.string().optional(),
        interpretation: z.string().optional(),
      }).optional(),
    }),
  }),
  
  // Summary of transformations for traceability
  transformationSummary: z.array(z.object({
    pestleFactorId: z.string(),
    pestleFactor: z.string(),
    affectedForce: z.string(),
    transformation: z.string(),
  })),
});

export type PESTLEToPortersEnhancement = z.infer<typeof PESTLEToPortersEnhancementSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// INTERPRETATION RULES
// ─────────────────────────────────────────────────────────────────────────────

const interpretationRules: InterpretationRule[] = [
  {
    id: 'legal_to_entry_barriers',
    description: 'Legal/regulatory factors become entry barriers',
    sourceField: 'factors.legal',
    targetField: 'forceContext.threatOfNewEntrants.regulatoryBarriers',
    
    transform: (value: unknown, ctx: BridgeContext): unknown => {
      const legalFactors = value as PESTLEFactor[];
      return legalFactors
        .filter(f => f.magnitude === 'high' || f.magnitude === 'medium')
        .map(f => ({
          barrier: f.factor,
          severity: f.magnitude,
          interpretation: `PESTLE Legal factor "${f.factor}" creates regulatory barrier to entry`,
          sourceFactor: f.id,
        }));
    },
    
    interpretation: 'High-impact legal requirements become barriers that deter new entrants',
    
    example: {
      source: { id: 'L-1', factor: 'UAE requires DED retail license', magnitude: 'high' },
      target: { barrier: 'DED retail license requirement', severity: 'high' },
      explanation: 'Licensing requirement becomes high-severity entry barrier',
    },
  },
  
  {
    id: 'economic_growth_to_entrants',
    description: 'Market growth increases threat of new entrants',
    sourceField: 'factors.economic',
    targetField: 'forceContext.threatOfNewEntrants.growthSignal',
    
    transform: (value: unknown, ctx: BridgeContext): unknown => {
      const economicFactors = value as PESTLEFactor[];
      const growthFactors = economicFactors.filter(f => 
        f.factor.toLowerCase().includes('growth') && f.impact === 'opportunity'
      );
      
      if (growthFactors.length === 0) return null;
      
      // Try to extract growth rate
      let growthRate: string | undefined;
      for (const f of growthFactors) {
        const match = f.evidence?.match(/(\d+(?:\.\d+)?%)/);
        if (match) {
          growthRate = match[1];
          break;
        }
      }
      
      return {
        hasGrowth: true,
        growthRate,
        interpretation: 'Growing market attracts new entrants - INCREASES threat',
        sources: growthFactors.map(f => f.factor),
      };
    },
    
    interpretation: 'Market growth signals attract competition, increasing new entrant threat',
    
    example: {
      source: { factor: 'UAE sneaker market grew 8.3% YoY', impact: 'opportunity' },
      target: { hasGrowth: true, interpretation: 'Growing market attracts entrants' },
      explanation: 'PESTLE opportunity becomes Porter threat signal',
    },
  },
  
  {
    id: 'political_to_supplier_power',
    description: 'Trade policies affect supplier landscape',
    sourceField: 'factors.political',
    targetField: 'forceContext.supplierPower.tradeRestrictions',
    
    transform: (value: unknown, ctx: BridgeContext): unknown => {
      const politicalFactors = value as PESTLEFactor[];
      return politicalFactors
        .filter(f => 
          f.factor.toLowerCase().includes('trade') ||
          f.factor.toLowerCase().includes('import') ||
          f.factor.toLowerCase().includes('tariff')
        )
        .map(f => ({
          restriction: f.factor,
          impact: f.impact === 'threat' 
            ? 'Increases supplier power by limiting alternatives' 
            : 'Decreases supplier power by enabling more options',
          sourceFactor: f.id,
        }));
    },
    
    interpretation: 'Trade policies affect supplier landscape. Import restrictions = higher supplier power',
    
    example: {
      source: { factor: 'Import restrictions on footwear', impact: 'threat' },
      target: { restriction: 'Import restrictions', impact: 'Increases supplier power' },
      explanation: 'Trade barrier limits supplier alternatives, increasing their power',
    },
  },
  
  {
    id: 'economic_to_buyer_power',
    description: 'Economic conditions affect buyer price sensitivity',
    sourceField: 'factors.economic',
    targetField: 'forceContext.buyerPower.economicConditions',
    
    transform: (value: unknown, ctx: BridgeContext): unknown => {
      const economicFactors = value as PESTLEFactor[];
      return economicFactors
        .filter(f => 
          f.factor.toLowerCase().includes('income') ||
          f.factor.toLowerCase().includes('spending') ||
          f.factor.toLowerCase().includes('disposable') ||
          f.factor.toLowerCase().includes('inflation')
        )
        .map(f => {
          // Determine impact on price sensitivity
          let impactOnPriceSensitivity: 'increases' | 'decreases' | 'neutral';
          if (f.factor.toLowerCase().includes('high income') || 
              f.factor.toLowerCase().includes('disposable income') ||
              (f.impact === 'opportunity' && f.factor.toLowerCase().includes('spending'))) {
            impactOnPriceSensitivity = 'decreases'; // High income = less price sensitive
          } else if (f.factor.toLowerCase().includes('inflation') ||
                     f.impact === 'threat') {
            impactOnPriceSensitivity = 'increases'; // Inflation = more price sensitive
          } else {
            impactOnPriceSensitivity = 'neutral';
          }
          
          return {
            condition: f.factor,
            impactOnPriceSensitivity,
            interpretation: impactOnPriceSensitivity === 'increases' 
              ? 'Economic condition increases buyer price sensitivity → higher buyer power'
              : impactOnPriceSensitivity === 'decreases'
              ? 'Economic condition decreases buyer price sensitivity → lower buyer power'
              : 'Economic condition has neutral impact on buyer power',
            sourceFactor: f.id,
          };
        });
    },
    
    interpretation: 'Economic conditions affect buyer price sensitivity. High income = lower buyer power',
    
    example: {
      source: { factor: 'High disposable income in UAE', impact: 'opportunity' },
      target: { impactOnPriceSensitivity: 'decreases' },
      explanation: 'Affluent buyers are less price sensitive, reducing their power',
    },
  },
  
  {
    id: 'social_to_buyer_trends',
    description: 'Social trends affect buyer behavior',
    sourceField: 'factors.social',
    targetField: 'forceContext.buyerPower.demographicTrends',
    
    transform: (value: unknown, ctx: BridgeContext): unknown => {
      const socialFactors = value as PESTLEFactor[];
      return socialFactors.map(f => ({
        trend: f.factor,
        implication: f.implication,
        sourceFactor: f.id,
      }));
    },
    
    interpretation: 'Social/demographic trends shape buyer preferences and power',
    
    example: {
      source: { factor: 'Growing sneakerhead culture in Gulf' },
      target: { trend: 'Growing sneakerhead culture', implication: 'Creates premium willingness to pay' },
      explanation: 'Cultural trend reduces buyer price sensitivity for authentic products',
    },
  },
  
  {
    id: 'tech_to_substitutes',
    description: 'Technology trends enable substitute threats',
    sourceField: 'factors.technological',
    targetField: 'forceContext.threatOfSubstitutes.techEnablers',
    
    transform: (value: unknown, ctx: BridgeContext): unknown => {
      const techFactors = value as PESTLEFactor[];
      return techFactors
        .filter(f => 
          f.factor.toLowerCase().includes('platform') ||
          f.factor.toLowerCase().includes('online') ||
          f.factor.toLowerCase().includes('digital') ||
          f.factor.toLowerCase().includes('app') ||
          f.factor.toLowerCase().includes('e-commerce')
        )
        .map(f => {
          // Infer substitute type
          let substituteType = 'alternative channel';
          if (f.factor.toLowerCase().includes('platform')) {
            substituteType = 'platform competitor';
          } else if (f.factor.toLowerCase().includes('app')) {
            substituteType = 'mobile-first competitor';
          }
          
          return {
            enabler: f.factor,
            substituteType,
            interpretation: `Technology "${f.factor}" enables alternative channels/substitutes`,
            sourceFactor: f.id,
          };
        });
    },
    
    interpretation: 'Digital/platform technologies enable substitute products and channels',
    
    example: {
      source: { factor: 'Online resale platforms growing (StockX, GOAT)' },
      target: { enabler: 'Online resale platforms', substituteType: 'platform competitor' },
      explanation: 'Platform tech becomes substitute threat',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFORM FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

async function transform(
  from: PESTLEOutput,
  context: BridgeContext
): Promise<PESTLEToPortersEnhancement> {
  const transformationSummary: PESTLEToPortersEnhancement['transformationSummary'] = [];
  
  // Apply legal → entry barriers
  const regulatoryBarriers = interpretationRules[0].transform(from.factors.legal, context) as any[] || [];
  for (const barrier of regulatoryBarriers) {
    transformationSummary.push({
      pestleFactorId: barrier.sourceFactor,
      pestleFactor: barrier.barrier,
      affectedForce: 'threatOfNewEntrants',
      transformation: 'Legal factor → entry barrier',
    });
  }
  
  // Apply economic growth → entrants
  const growthSignal = interpretationRules[1].transform(from.factors.economic, context) as any;
  if (growthSignal) {
    for (const source of growthSignal.sources || []) {
      transformationSummary.push({
        pestleFactorId: 'economic',
        pestleFactor: source,
        affectedForce: 'threatOfNewEntrants',
        transformation: 'Market growth → attracts entrants',
      });
    }
  }
  
  // Apply political → supplier power
  const tradeRestrictions = interpretationRules[2].transform(from.factors.political, context) as any[] || [];
  for (const restriction of tradeRestrictions) {
    transformationSummary.push({
      pestleFactorId: restriction.sourceFactor,
      pestleFactor: restriction.restriction,
      affectedForce: 'supplierPower',
      transformation: 'Trade policy → supplier power context',
    });
  }
  
  // Apply economic → buyer power
  const economicConditions = interpretationRules[3].transform(from.factors.economic, context) as any[] || [];
  for (const condition of economicConditions) {
    transformationSummary.push({
      pestleFactorId: condition.sourceFactor,
      pestleFactor: condition.condition,
      affectedForce: 'buyerPower',
      transformation: `Economic condition → ${condition.impactOnPriceSensitivity} price sensitivity`,
    });
  }
  
  // Apply social → buyer trends
  const demographicTrends = interpretationRules[4].transform(from.factors.social, context) as any[] || [];
  for (const trend of demographicTrends) {
    transformationSummary.push({
      pestleFactorId: trend.sourceFactor,
      pestleFactor: trend.trend,
      affectedForce: 'buyerPower',
      transformation: 'Social trend → buyer preference',
    });
  }
  
  // Apply tech → substitutes
  const techEnablers = interpretationRules[5].transform(from.factors.technological, context) as any[] || [];
  for (const enabler of techEnablers) {
    transformationSummary.push({
      pestleFactorId: enabler.sourceFactor,
      pestleFactor: enabler.enabler,
      affectedForce: 'threatOfSubstitutes',
      transformation: `Technology → enables ${enabler.substituteType}`,
    });
  }
  
  return {
    pestleOutput: from,
    forceContext: {
      threatOfNewEntrants: {
        regulatoryBarriers,
        growthSignal: growthSignal || undefined,
      },
      supplierPower: {
        tradeRestrictions,
      },
      buyerPower: {
        economicConditions,
        demographicTrends,
      },
      threatOfSubstitutes: {
        techEnablers,
        socialTrends: [],
      },
      competitiveRivalry: {},
    },
    transformationSummary,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATE FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

function validate(from: PESTLEOutput, to: PESTLEToPortersEnhancement): BridgeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check that PESTLE had content
  const totalFactors = 
    from.factors.political.length +
    from.factors.economic.length +
    from.factors.social.length +
    from.factors.technological.length +
    from.factors.legal.length +
    from.factors.environmental.length;
  
  if (totalFactors === 0) {
    errors.push('PESTLE output has no factors to transform');
  }
  
  // Check that we produced some transformations
  if (to.transformationSummary.length === 0) {
    warnings.push('No transformations were applied - Porter\'s analysis may lack PESTLE context');
  }
  
  // Check each force got some context
  const forces = ['threatOfNewEntrants', 'supplierPower', 'buyerPower', 'threatOfSubstitutes'];
  for (const force of forces) {
    const hasContext = to.transformationSummary.some(t => t.affectedForce === force);
    if (!hasContext) {
      warnings.push(`No PESTLE context mapped to ${force}`);
    }
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

export const PESTLEToPortersBridge: BridgeContract<PESTLEOutput, PESTLEToPortersEnhancement> = {
  id: 'pestle_to_porters',
  fromModule: 'pestle',
  toModule: 'porters',
  description: 'Transforms PESTLE macro-environmental factors into Porter\'s Five Forces context',
  
  fromSchema: PESTLEOutputSchema,
  toSchema: PESTLEToPortersEnhancementSchema,
  
  transform,
  interpretationRules,
  validate,
};

/**
 * Apply the PESTLE to Porter's bridge
 * Convenience function for use in journey orchestrator
 */
export function applyPESTLEToPortersBridge(
  pestleOutput: PESTLEOutput,
  positioning: any
): Promise<PESTLEToPortersEnhancement> {
  return PESTLEToPortersBridge.transform(pestleOutput, {
    positioning,
    allPriorOutputs: { pestle: pestleOutput },
  });
}
