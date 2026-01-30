/**
 * Unit Tests for Porter's → SWOT Bridge
 */

import { describe, it, expect } from 'vitest';
import { 
  applyPortersToSWOTBridge,
  formatPortersContextForSWOT,
  type PortersToSWOTEnhancement
} from '../../server/journey/bridges/porters-to-swot-bridge';

// Mock Porter's output matching real structure
const mockPortersOutput = {
  industryDefinition: 'Premium sneaker retail in Abu Dhabi, UAE',
  forces: {
    threatOfNewEntrants: {
      force: 'Threat of New Entrants',
      score: 4,
      level: 'low',
      drivers: ['High licensing requirements', 'Capital requirements'],
      evidence: ['DED license needed', 'Inventory investment $200K+'],
      pestleReferences: ['PESTLE Legal L-1'],
      strategicResponse: 'Establish quickly to benefit from barriers',
    },
    supplierPower: {
      force: 'Supplier Power',
      score: 7,
      level: 'high',
      drivers: ['Limited authorized distributors', 'Nike controls supply'],
      evidence: ['Only 3 authorized sneaker distributors in UAE'],
      pestleReferences: ['PESTLE Political P-1'],
      strategicResponse: 'Diversify supplier relationships',
    },
    buyerPower: {
      force: 'Buyer Power',
      score: 3,
      level: 'low',
      drivers: ['Collectors are passionate', 'Limited alternatives locally'],
      evidence: ['High disposable income', 'Strong sneakerhead community'],
      pestleReferences: ['PESTLE Economic E-1', 'PESTLE Social S-1'],
      strategicResponse: 'Maintain premium positioning',
    },
    threatOfSubstitutes: {
      force: 'Threat of Substitutes',
      score: 6,
      level: 'medium',
      drivers: ['Online resale platforms', 'Direct brand purchases'],
      evidence: ['StockX growing 40% in UAE'],
      pestleReferences: ['PESTLE Technological T-1'],
      strategicResponse: 'Differentiate with authentication and experience',
    },
    competitiveRivalry: {
      force: 'Competitive Rivalry',
      score: 4,
      level: 'low',
      drivers: ['No premium sneaker specialist in Abu Dhabi'],
      evidence: ['Competitors focus on mainstream footwear'],
      pestleReferences: [],
      strategicResponse: 'First-mover advantage',
    },
  },
  overallAttractiveness: {
    score: 7,
    assessment: 'attractive',
    rationale: 'Low rivalry and buyer power offset high supplier power',
  },
  strategicImplications: [
    'Establish supplier relationships early',
    'Focus on collector community building',
  ],
  pestleConnections: [
    {
      pestleFactor: 'DED retail license requirement',
      pestleCategory: 'L',
      affectedForce: 'threatOfNewEntrants',
      howItAffects: 'Creates regulatory barrier',
      direction: 'decreases',
    },
  ],
  competitorsIdentified: ['Foot Locker UAE', 'Sun & Sand Sports', 'Nike Store'],
  suppliersIdentified: ['Nike MEA', 'Adidas Gulf'],
  substitutesIdentified: ['StockX', 'GOAT', 'Nike.com'],
};

const mockPESTLEOutput = {
  opportunities: [
    { opportunity: 'Growing sneaker culture', description: 'Community expanding', magnitude: 'high' },
    { opportunity: 'High disposable income', description: 'Wealthy target market', magnitude: 'high' },
  ],
  threats: [
    { threat: 'Online competition', description: 'StockX/GOAT growing', magnitude: 'high' },
    { threat: 'Import regulations', description: 'Compliance overhead', magnitude: 'medium' },
  ],
};

describe('Porter\'s → SWOT Bridge', () => {
  describe('applyPortersToSWOTBridge', () => {
    it('should transform Porter\'s output to SWOT context', async () => {
      const result = await applyPortersToSWOTBridge(mockPortersOutput, mockPESTLEOutput, {});
      
      expect(result).toBeDefined();
      expect(result.derivedOpportunities.length).toBeGreaterThan(0);
      expect(result.derivedThreats.length).toBeGreaterThan(0);
    });

    it('should derive opportunities from low forces', async () => {
      const result = await applyPortersToSWOTBridge(mockPortersOutput, mockPESTLEOutput, {});
      
      // Low threat of new entrants = opportunity
      const entryOpp = result.derivedOpportunities.find(o =>
        o.item.includes('Protected market') || o.sourceReference.includes('New Entrants')
      );
      expect(entryOpp).toBeDefined();
      expect(entryOpp?.sourceAnalysis).toBe('porters');
      
      // Low buyer power = opportunity
      const buyerOpp = result.derivedOpportunities.find(o =>
        o.item.includes('Premium pricing') || o.sourceReference.includes('Buyer Power')
      );
      expect(buyerOpp).toBeDefined();
      
      // Low rivalry = opportunity
      const rivalryOpp = result.derivedOpportunities.find(o =>
        o.item.includes('First-mover') || o.sourceReference.includes('Rivalry')
      );
      expect(rivalryOpp).toBeDefined();
    });

    it('should derive threats from high forces', async () => {
      const result = await applyPortersToSWOTBridge(mockPortersOutput, mockPESTLEOutput, {});
      
      // High supplier power = threat
      const supplierThreat = result.derivedThreats.find(t =>
        t.item.includes('Supplier') || t.sourceReference.includes('Supplier Power')
      );
      expect(supplierThreat).toBeDefined();
      expect(supplierThreat?.sourceAnalysis).toBe('porters');
    });

    it('should include PESTLE-derived O/T', async () => {
      const result = await applyPortersToSWOTBridge(mockPortersOutput, mockPESTLEOutput, {});
      
      // Should include PESTLE opportunities
      const pestleOpp = result.derivedOpportunities.find(o =>
        o.sourceAnalysis === 'pestle'
      );
      expect(pestleOpp).toBeDefined();
      
      // Should include PESTLE threats
      const pestleThreat = result.derivedThreats.find(t =>
        t.sourceAnalysis === 'pestle'
      );
      expect(pestleThreat).toBeDefined();
    });

    it('should include source references for traceability', async () => {
      const result = await applyPortersToSWOTBridge(mockPortersOutput, mockPESTLEOutput, {});
      
      for (const opp of result.derivedOpportunities) {
        expect(opp.sourceReference).toBeDefined();
        expect(opp.sourceReference.length).toBeGreaterThan(0);
      }
      
      for (const threat of result.derivedThreats) {
        expect(threat.sourceReference).toBeDefined();
        expect(threat.sourceReference.length).toBeGreaterThan(0);
      }
    });

    it('should track which forces were used', async () => {
      const result = await applyPortersToSWOTBridge(mockPortersOutput, mockPESTLEOutput, {});
      
      expect(result.porterForcesUsed.length).toBeGreaterThan(0);
      expect(result.porterForcesUsed).toContain('threatOfNewEntrants');
      expect(result.porterForcesUsed).toContain('buyerPower');
    });

    it('should include competitor insights', async () => {
      const result = await applyPortersToSWOTBridge(mockPortersOutput, mockPESTLEOutput, {});
      
      expect(result.competitorInsights.namedCompetitors).toContain('Foot Locker UAE');
      expect(result.competitorInsights.namedCompetitors).toContain('Nike Store');
    });

    it('should include market attractiveness context', async () => {
      const result = await applyPortersToSWOTBridge(mockPortersOutput, mockPESTLEOutput, {});
      
      expect(result.marketContext.attractivenessScore).toBe(7);
      expect(result.marketContext.assessment).toBe('attractive');
    });

    it('should prioritize derived O/T', async () => {
      const result = await applyPortersToSWOTBridge(mockPortersOutput, mockPESTLEOutput, {});
      
      // Check opportunities are sorted by priority
      for (let i = 1; i < result.derivedOpportunities.length; i++) {
        expect(result.derivedOpportunities[i].priority).toBeGreaterThanOrEqual(
          result.derivedOpportunities[i - 1].priority
        );
      }
    });

    it('should limit to 5 O/T each', async () => {
      const result = await applyPortersToSWOTBridge(mockPortersOutput, mockPESTLEOutput, {});
      
      expect(result.derivedOpportunities.length).toBeLessThanOrEqual(5);
      expect(result.derivedThreats.length).toBeLessThanOrEqual(5);
    });

    it('should handle missing Porter\'s output gracefully', async () => {
      const result = await applyPortersToSWOTBridge({}, undefined, {});
      
      expect(result.derivedOpportunities).toBeDefined();
      expect(result.derivedThreats).toBeDefined();
    });

    it('should handle missing PESTLE output gracefully', async () => {
      const result = await applyPortersToSWOTBridge(mockPortersOutput, undefined, {});
      
      expect(result.derivedOpportunities.length).toBeGreaterThan(0);
      expect(result.pestleFactorsUsed.length).toBe(0);
    });
  });

  describe('formatPortersContextForSWOT', () => {
    it('should format enhancement as readable text', async () => {
      const enhancement = await applyPortersToSWOTBridge(mockPortersOutput, mockPESTLEOutput, {});
      const formatted = formatPortersContextForSWOT(enhancement);
      
      expect(formatted).toContain('Derived Opportunities');
      expect(formatted).toContain('Derived Threats');
      expect(formatted).toContain('Market Attractiveness');
    });

    it('should include source analysis tags', async () => {
      const enhancement = await applyPortersToSWOTBridge(mockPortersOutput, mockPESTLEOutput, {});
      const formatted = formatPortersContextForSWOT(enhancement);
      
      expect(formatted).toContain('[PORTERS]');
      expect(formatted).toContain('[PESTLE]');
    });

    it('should include competitors if present', async () => {
      const enhancement = await applyPortersToSWOTBridge(mockPortersOutput, mockPESTLEOutput, {});
      const formatted = formatPortersContextForSWOT(enhancement);
      
      expect(formatted).toContain('Competitors Identified');
      expect(formatted).toContain('Foot Locker UAE');
    });
  });
});
