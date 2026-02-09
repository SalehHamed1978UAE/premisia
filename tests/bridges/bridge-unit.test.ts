/**
 * Unit Tests for Journey Bridges
 * 
 * These tests don't require database - they test pure transformation logic.
 * Run with: npx vitest run tests/bridges/bridge-unit.test.ts --no-setup
 */

import { describe, it, expect } from 'vitest';

// Import bridge functions directly (avoiding db imports)
// We'll inline the transformation logic for isolated testing

// ============================================================================
// PESTLE → Porter's Bridge Logic (copied from bridge file for isolation)
// ============================================================================

interface PESTLEToPortersEnhancement {
  regulatoryBarriers: Array<{
    factor: string;
    severity: 'high' | 'medium' | 'low';
    interpretation: string;
    source: string;
  }>;
  buyerPowerIndicators: Array<{
    factor: string;
    direction: 'increases' | 'decreases';
    interpretation: string;
  }>;
  substituteEnablers: Array<{
    factor: string;
    substituteType: string;
    interpretation: string;
  }>;
  supplierPowerFactors: Array<{
    factor: string;
    direction: 'increases' | 'decreases';
    interpretation: string;
  }>;
  growthSignals: Array<{
    factor: string;
    growthRate: string | null;
    implication: string;
  }>;
  pestleScope: string;
  pestleConfidence: string;
}

function transformPESTLEToPorters(pestleOutput: any): PESTLEToPortersEnhancement {
  const result: PESTLEToPortersEnhancement = {
    regulatoryBarriers: [],
    buyerPowerIndicators: [],
    substituteEnablers: [],
    supplierPowerFactors: [],
    growthSignals: [],
    pestleScope: pestleOutput?.scope || '',
    pestleConfidence: pestleOutput?.confidenceLevel || 'medium',
  };
  
  if (!pestleOutput?.factors) return result;
  
  const factors = pestleOutput.factors;
  
  // Legal factors → Entry barriers
  if (factors.legal && Array.isArray(factors.legal)) {
    for (const f of factors.legal) {
      const lower = (f.factor || '').toLowerCase();
      if (lower.includes('license') || lower.includes('regulation') || lower.includes('permit') || lower.includes('compliance')) {
        result.regulatoryBarriers.push({
          factor: f.factor,
          severity: f.magnitude || 'medium',
          interpretation: `Legal requirement "${f.factor}" creates regulatory barrier to entry`,
          source: 'PESTLE Legal',
        });
      }
    }
  }
  
  // Economic factors → Buyer power & growth signals
  if (factors.economic && Array.isArray(factors.economic)) {
    for (const f of factors.economic) {
      const lower = (f.factor || '').toLowerCase();
      
      if (lower.includes('income') || lower.includes('spending') || lower.includes('disposable') || lower.includes('purchasing')) {
        result.buyerPowerIndicators.push({
          factor: f.factor,
          direction: f.impact === 'opportunity' ? 'decreases' : 'increases',
          interpretation: `Economic factor "${f.factor}" affects buyer price sensitivity`,
        });
      }
      
      if (lower.includes('growth') || lower.includes('market size') || lower.includes('expansion')) {
        const growthMatch = (f.evidence || '').match(/(\d+(?:\.\d+)?)\s*%/);
        result.growthSignals.push({
          factor: f.factor,
          growthRate: growthMatch ? growthMatch[1] + '%' : null,
          implication: f.impact === 'opportunity' 
            ? 'Growing market attracts new entrants, may reduce rivalry intensity'
            : 'Stagnant market intensifies rivalry for market share',
        });
      }
    }
  }
  
  // Technological factors → Substitutes
  if (factors.technological && Array.isArray(factors.technological)) {
    for (const f of factors.technological) {
      const lower = (f.factor || '').toLowerCase();
      if (lower.includes('platform') || lower.includes('online') || lower.includes('digital') || lower.includes('app') || lower.includes('e-commerce')) {
        result.substituteEnablers.push({
          factor: f.factor,
          substituteType: 'digital_channel',
          interpretation: `Technology "${f.factor}" enables alternative channels and substitutes`,
        });
      }
    }
  }
  
  // Political factors → Supplier power
  if (factors.political && Array.isArray(factors.political)) {
    for (const f of factors.political) {
      const lower = (f.factor || '').toLowerCase();
      if (lower.includes('trade') || lower.includes('import') || lower.includes('tariff') || lower.includes('agreement')) {
        result.supplierPowerFactors.push({
          factor: f.factor,
          direction: f.impact === 'opportunity' ? 'decreases' : 'increases',
          interpretation: `Trade policy "${f.factor}" affects supplier access and options`,
        });
      }
    }
  }
  
  return result;
}

// ============================================================================
// Porter's → SWOT Bridge Logic (copied from bridge file for isolation)
// ============================================================================

interface DerivedItem {
  item: string;
  description: string;
  magnitude: 'high' | 'medium' | 'low';
  sourceAnalysis: 'pestle' | 'porters' | 'combined';
  sourceReference: string;
  priority: number;
  priorityRationale: string;
}

interface PortersToSWOTEnhancement {
  derivedOpportunities: DerivedItem[];
  derivedThreats: DerivedItem[];
  pestleFactorsUsed: string[];
  porterForcesUsed: string[];
  competitorInsights: {
    namedCompetitors: string[];
    competitorStrengths: string[];
    competitorWeaknesses: string[];
  };
  marketContext: {
    attractivenessScore: number;
    assessment: string;
    rationale: string;
  };
}

function getForceScore(force: any): number {
  if (typeof force === 'number') return force;
  if (force?.score) return force.score;
  return 5;
}

function getForceLevel(force: any): string {
  if (force?.level) return force.level;
  const score = getForceScore(force);
  if (score <= 2) return 'very_low';
  if (score <= 4) return 'low';
  if (score <= 6) return 'medium';
  if (score <= 8) return 'high';
  return 'very_high';
}

function transformPortersToSWOT(portersOutput: any, pestleOutput: any): PortersToSWOTEnhancement {
  const opportunities: DerivedItem[] = [];
  const threats: DerivedItem[] = [];
  const porterForcesUsed: string[] = [];
  const pestleFactorsUsed: string[] = [];
  
  const forces = portersOutput?.forces || portersOutput?.portersResults;
  
  if (forces) {
    // Threat of New Entrants
    const newEntrants = forces.threatOfNewEntrants;
    if (newEntrants) {
      const level = getForceLevel(newEntrants);
      const score = getForceScore(newEntrants);
      
      if (level === 'very_low' || level === 'low') {
        opportunities.push({
          item: 'Protected market position',
          description: `Low threat of new entrants (${score}/10) means high barriers protect market position.`,
          magnitude: 'high',
          sourceAnalysis: 'porters',
          sourceReference: `Porter's Threat of New Entrants: ${score}/10 (${level})`,
          priority: 1,
          priorityRationale: 'High barriers create sustainable competitive advantage',
        });
        porterForcesUsed.push('threatOfNewEntrants');
      } else if (level === 'very_high' || level === 'high') {
        threats.push({
          item: 'Vulnerable to new competitors',
          description: `High threat of new entrants (${score}/10) means low barriers allow easy entry.`,
          magnitude: 'high',
          sourceAnalysis: 'porters',
          sourceReference: `Porter's Threat of New Entrants: ${score}/10 (${level})`,
          priority: 1,
          priorityRationale: 'Low barriers require rapid differentiation',
        });
        porterForcesUsed.push('threatOfNewEntrants');
      }
    }
    
    // Buyer Power
    const buyerPower = forces.buyerPower || forces.bargainingPowerOfBuyers;
    if (buyerPower) {
      const level = getForceLevel(buyerPower);
      const score = getForceScore(buyerPower);
      
      if (level === 'very_low' || level === 'low') {
        opportunities.push({
          item: 'Premium pricing sustainable',
          description: `Low buyer power (${score}/10) means customers have limited alternatives.`,
          magnitude: 'high',
          sourceAnalysis: 'porters',
          sourceReference: `Porter's Buyer Power: ${score}/10 (${level})`,
          priority: 2,
          priorityRationale: 'Pricing flexibility enables margin expansion',
        });
        porterForcesUsed.push('buyerPower');
      }
    }
    
    // Competitive Rivalry
    const rivalry = forces.competitiveRivalry;
    if (rivalry) {
      const level = getForceLevel(rivalry);
      const score = getForceScore(rivalry);
      
      if (level === 'very_low' || level === 'low') {
        opportunities.push({
          item: 'First-mover opportunity',
          description: `Low rivalry (${score}/10) means limited direct competition.`,
          magnitude: 'high',
          sourceAnalysis: 'porters',
          sourceReference: `Porter's Competitive Rivalry: ${score}/10 (${level})`,
          priority: 1,
          priorityRationale: 'Low competition enables rapid market capture',
        });
        porterForcesUsed.push('competitiveRivalry');
      }
    }
    
    // Supplier Power
    const supplierPower = forces.supplierPower || forces.bargainingPowerOfSuppliers;
    if (supplierPower) {
      const level = getForceLevel(supplierPower);
      const score = getForceScore(supplierPower);
      
      if (level === 'very_high' || level === 'high') {
        threats.push({
          item: 'Supplier dependency risk',
          description: `High supplier power (${score}/10) means limited options.`,
          magnitude: 'high',
          sourceAnalysis: 'porters',
          sourceReference: `Porter's Supplier Power: ${score}/10 (${level})`,
          priority: 2,
          priorityRationale: 'Supply chain vulnerability requires mitigation',
        });
        porterForcesUsed.push('supplierPower');
      }
    }
  }
  
  // Add PESTLE O/T
  if (pestleOutput?.opportunities && Array.isArray(pestleOutput.opportunities)) {
    for (const o of pestleOutput.opportunities.slice(0, 2)) {
      opportunities.push({
        item: o.opportunity || o.item,
        description: o.description || '',
        magnitude: o.magnitude || 'medium',
        sourceAnalysis: 'pestle',
        sourceReference: 'PESTLE Analysis',
        priority: 3,
        priorityRationale: 'Macro-environmental opportunity',
      });
      pestleFactorsUsed.push(o.opportunity || o.item);
    }
  }
  
  if (pestleOutput?.threats && Array.isArray(pestleOutput.threats)) {
    for (const t of pestleOutput.threats.slice(0, 2)) {
      threats.push({
        item: t.threat || t.item,
        description: t.description || '',
        magnitude: t.magnitude || 'medium',
        sourceAnalysis: 'pestle',
        sourceReference: 'PESTLE Analysis',
        priority: 3,
        priorityRationale: 'Macro-environmental threat',
      });
      pestleFactorsUsed.push(t.threat || t.item);
    }
  }
  
  return {
    derivedOpportunities: opportunities.slice(0, 5),
    derivedThreats: threats.slice(0, 5),
    pestleFactorsUsed: Array.from(new Set(pestleFactorsUsed)),
    porterForcesUsed: Array.from(new Set(porterForcesUsed)),
    competitorInsights: {
      namedCompetitors: portersOutput?.competitorsIdentified || [],
      competitorStrengths: [],
      competitorWeaknesses: [],
    },
    marketContext: {
      attractivenessScore: portersOutput?.overallAttractiveness?.score || 5,
      assessment: portersOutput?.overallAttractiveness?.assessment || 'moderate',
      rationale: portersOutput?.overallAttractiveness?.rationale || '',
    },
  };
}

// ============================================================================
// TESTS
// ============================================================================

const mockPESTLEOutput = {
  scope: 'UAE market for premium sneaker retail targeting collectors',
  confidenceLevel: 'medium',
  factors: {
    political: [
      { factor: 'UAE-US trade agreement supports imports', impact: 'opportunity', magnitude: 'medium' },
    ],
    economic: [
      { factor: 'High disposable income in Abu Dhabi', impact: 'opportunity', magnitude: 'high', evidence: 'GDP per capita $63,000' },
      { factor: 'Market growth 8% YoY', impact: 'opportunity', magnitude: 'high', evidence: '8% growth rate' },
    ],
    social: [
      { factor: 'Growing sneakerhead culture', impact: 'opportunity', magnitude: 'high' },
    ],
    technological: [
      { factor: 'Online resale platforms growing', impact: 'threat', magnitude: 'high' },
    ],
    legal: [
      { factor: 'DED retail license required', impact: 'threat', magnitude: 'high' },
    ],
    environmental: [],
  },
  opportunities: [
    { opportunity: 'Growing market', description: 'Strong demand', magnitude: 'high' },
  ],
  threats: [
    { threat: 'Online competition', description: 'StockX growing', magnitude: 'high' },
  ],
};

const mockPortersOutput = {
  forces: {
    threatOfNewEntrants: { score: 4, level: 'low' },
    supplierPower: { score: 7, level: 'high' },
    buyerPower: { score: 3, level: 'low' },
    threatOfSubstitutes: { score: 6, level: 'medium' },
    competitiveRivalry: { score: 4, level: 'low' },
  },
  overallAttractiveness: { score: 7, assessment: 'attractive', rationale: 'Good market' },
  competitorsIdentified: ['Foot Locker UAE', 'Nike Store'],
};

describe('PESTLE → Porter\'s Bridge', () => {
  it('should extract regulatory barriers from Legal factors', () => {
    const result = transformPESTLEToPorters(mockPESTLEOutput);
    
    expect(result.regulatoryBarriers.length).toBe(1);
    expect(result.regulatoryBarriers[0].factor).toContain('license');
    expect(result.regulatoryBarriers[0].severity).toBe('high');
  });

  it('should extract buyer power indicators from Economic factors', () => {
    const result = transformPESTLEToPorters(mockPESTLEOutput);
    
    expect(result.buyerPowerIndicators.length).toBe(1);
    expect(result.buyerPowerIndicators[0].factor).toContain('income');
    expect(result.buyerPowerIndicators[0].direction).toBe('decreases');
  });

  it('should extract growth signals with rates', () => {
    const result = transformPESTLEToPorters(mockPESTLEOutput);
    
    expect(result.growthSignals.length).toBe(1);
    expect(result.growthSignals[0].growthRate).toBe('8%');
  });

  it('should extract substitute enablers from Technological factors', () => {
    const result = transformPESTLEToPorters(mockPESTLEOutput);
    
    expect(result.substituteEnablers.length).toBe(1);
    expect(result.substituteEnablers[0].factor).toContain('Online');
  });

  it('should handle empty input gracefully', () => {
    const result = transformPESTLEToPorters({});
    
    expect(result.regulatoryBarriers).toEqual([]);
    expect(result.buyerPowerIndicators).toEqual([]);
  });
});

describe('Porter\'s → SWOT Bridge', () => {
  it('should derive opportunities from low forces', () => {
    const result = transformPortersToSWOT(mockPortersOutput, mockPESTLEOutput);
    
    expect(result.derivedOpportunities.length).toBeGreaterThan(0);
    
    const entryOpp = result.derivedOpportunities.find(o => o.item.includes('Protected'));
    expect(entryOpp).toBeDefined();
    expect(entryOpp?.sourceAnalysis).toBe('porters');
  });

  it('should derive threats from high forces', () => {
    const result = transformPortersToSWOT(mockPortersOutput, mockPESTLEOutput);
    
    const supplierThreat = result.derivedThreats.find(t => t.item.includes('Supplier'));
    expect(supplierThreat).toBeDefined();
  });

  it('should include PESTLE O/T', () => {
    const result = transformPortersToSWOT(mockPortersOutput, mockPESTLEOutput);
    
    const pestleOpp = result.derivedOpportunities.find(o => o.sourceAnalysis === 'pestle');
    expect(pestleOpp).toBeDefined();
    
    const pestleThreat = result.derivedThreats.find(t => t.sourceAnalysis === 'pestle');
    expect(pestleThreat).toBeDefined();
  });

  it('should track which forces were used', () => {
    const result = transformPortersToSWOT(mockPortersOutput, mockPESTLEOutput);
    
    expect(result.porterForcesUsed).toContain('threatOfNewEntrants');
    expect(result.porterForcesUsed).toContain('buyerPower');
  });

  it('should include competitor insights', () => {
    const result = transformPortersToSWOT(mockPortersOutput, mockPESTLEOutput);
    
    expect(result.competitorInsights.namedCompetitors).toContain('Foot Locker UAE');
  });

  it('should include market attractiveness', () => {
    const result = transformPortersToSWOT(mockPortersOutput, mockPESTLEOutput);
    
    expect(result.marketContext.attractivenessScore).toBe(7);
    expect(result.marketContext.assessment).toBe('attractive');
  });

  it('should limit to 5 items each', () => {
    const result = transformPortersToSWOT(mockPortersOutput, mockPESTLEOutput);
    
    expect(result.derivedOpportunities.length).toBeLessThanOrEqual(5);
    expect(result.derivedThreats.length).toBeLessThanOrEqual(5);
  });

  it('should handle missing inputs gracefully', () => {
    const result = transformPortersToSWOT({}, undefined);
    
    expect(result.derivedOpportunities).toBeDefined();
    expect(result.derivedThreats).toBeDefined();
  });
});
