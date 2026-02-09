/**
 * Unit Tests for PESTLE → Porter's Bridge
 */

import { describe, it, expect } from 'vitest';
import { 
  applyPESTLEToPortersBridge,
  formatPESTLEContextForPorters,
  type PESTLEToPortersEnhancement
} from '../../server/journey/bridges/pestle-to-porters-bridge';

// Mock PESTLE output matching real structure
const mockPESTLEOutput = {
  scope: 'UAE market for premium sneaker retail targeting collectors',
  confidenceLevel: 'medium',
  factors: {
    political: [
      {
        category: 'P',
        factor: 'UAE-US trade relations support luxury goods imports',
        description: 'Strong bilateral trade, no tariffs on footwear',
        impact: 'opportunity',
        magnitude: 'medium',
        implication: 'Reliable access to US-manufactured limited editions',
        evidence: 'UAE-US bilateral trade reached $28B in 2023',
        confidence: 'verified',
      },
    ],
    economic: [
      {
        category: 'E',
        factor: 'High disposable income among target demographic',
        description: 'Abu Dhabi has highest per capita in UAE at $63,000',
        impact: 'opportunity',
        magnitude: 'high',
        implication: 'Target segment has purchasing power for premium sneakers',
        evidence: 'Abu Dhabi GDP per capita $63,000',
        confidence: 'verified',
      },
      {
        category: 'E',
        factor: 'UAE sneaker market growing 8% YoY',
        description: 'Athletic footwear market expanding rapidly',
        impact: 'opportunity',
        magnitude: 'high',
        implication: 'Growing market indicates strong demand',
        evidence: 'Market research shows 8% growth',
        confidence: 'researched',
      },
    ],
    social: [
      {
        category: 'S',
        factor: 'Growing sneakerhead culture in UAE',
        description: 'Young professionals adopting sneaker collecting as hobby',
        impact: 'opportunity',
        magnitude: 'high',
        implication: 'Strong community potential for collectors',
        evidence: 'Social media sneaker groups growing',
        confidence: 'researched',
      },
    ],
    technological: [
      {
        category: 'T',
        factor: 'Online resale platforms (StockX, GOAT) growing',
        description: 'Digital platforms enable alternative purchasing channels',
        impact: 'threat',
        magnitude: 'high',
        implication: 'Must differentiate from online alternatives',
        evidence: 'StockX UAE traffic up 40%',
        confidence: 'researched',
      },
    ],
    legal: [
      {
        category: 'L',
        factor: 'UAE requires DED retail license with local sponsor',
        description: 'Complex licensing requirements for retail operations',
        impact: 'threat',
        magnitude: 'high',
        implication: 'Budget AED 15-20K and factor into timeline',
        evidence: 'DED licensing requirements',
        confidence: 'verified',
      },
      {
        category: 'L',
        factor: 'Import regulations require product registration',
        description: 'Footwear imports need compliance documentation',
        impact: 'threat',
        magnitude: 'medium',
        implication: 'Additional compliance overhead',
        evidence: 'UAE customs regulations',
        confidence: 'verified',
      },
    ],
    environmental: [
      {
        category: 'Env',
        factor: 'UAE sustainability targets increasing',
        description: 'Growing focus on sustainable products',
        impact: 'neutral',
        magnitude: 'low',
        implication: 'Consider sustainable sourcing options',
        evidence: 'UAE net zero 2050 commitment',
        confidence: 'verified',
      },
    ],
  },
  prioritizedFactors: [],
  opportunities: [
    { opportunity: 'High disposable income', description: 'Target segment wealthy', magnitude: 'high' },
  ],
  threats: [
    { threat: 'Online competition', description: 'StockX/GOAT growing', magnitude: 'high' },
  ],
  researchGaps: [],
  assumptions: [],
};

describe('PESTLE → Porter\'s Bridge', () => {
  describe('applyPESTLEToPortersBridge', () => {
    it('should transform PESTLE output to Porter\'s context', async () => {
      const result = await applyPESTLEToPortersBridge(mockPESTLEOutput, {});
      
      expect(result).toBeDefined();
      expect(result.pestleScope).toBe('UAE market for premium sneaker retail targeting collectors');
      expect(result.pestleConfidence).toBe('medium');
    });

    it('should extract regulatory barriers from Legal factors', async () => {
      const result = await applyPESTLEToPortersBridge(mockPESTLEOutput, {});
      
      expect(result.regulatoryBarriers.length).toBeGreaterThan(0);
      
      const licenseBarrier = result.regulatoryBarriers.find(b => 
        b.factor.includes('DED retail license')
      );
      expect(licenseBarrier).toBeDefined();
      expect(licenseBarrier?.severity).toBe('high');
      expect(licenseBarrier?.source).toBe('PESTLE Legal');
    });

    it('should extract buyer power indicators from Economic factors', async () => {
      const result = await applyPESTLEToPortersBridge(mockPESTLEOutput, {});
      
      expect(result.buyerPowerIndicators.length).toBeGreaterThan(0);
      
      const incomeIndicator = result.buyerPowerIndicators.find(b =>
        b.factor.includes('disposable income')
      );
      expect(incomeIndicator).toBeDefined();
      expect(incomeIndicator?.direction).toBe('decreases'); // High income = lower buyer power
    });

    it('should extract substitute enablers from Technological factors', async () => {
      const result = await applyPESTLEToPortersBridge(mockPESTLEOutput, {});
      
      expect(result.substituteEnablers.length).toBeGreaterThan(0);
      
      const platformEnabler = result.substituteEnablers.find(s =>
        s.factor.includes('Online resale platforms')
      );
      expect(platformEnabler).toBeDefined();
      expect(platformEnabler?.substituteType).toBe('digital_channel');
    });

    it('should extract growth signals from Economic factors', async () => {
      const result = await applyPESTLEToPortersBridge(mockPESTLEOutput, {});
      
      expect(result.growthSignals.length).toBeGreaterThan(0);
      
      const growthSignal = result.growthSignals.find(g =>
        g.factor.includes('growing')
      );
      expect(growthSignal).toBeDefined();
      expect(growthSignal?.growthRate).toBe('8%');
    });

    it('should handle empty PESTLE output gracefully', async () => {
      const result = await applyPESTLEToPortersBridge({}, {});
      
      expect(result.regulatoryBarriers).toEqual([]);
      expect(result.buyerPowerIndicators).toEqual([]);
      expect(result.substituteEnablers).toEqual([]);
      expect(result.growthSignals).toEqual([]);
    });

    it('should handle null factors gracefully', async () => {
      const result = await applyPESTLEToPortersBridge({ factors: null }, {});
      
      expect(result.regulatoryBarriers).toEqual([]);
    });
  });

  describe('formatPESTLEContextForPorters', () => {
    it('should format enhancement as readable text', async () => {
      const enhancement = await applyPESTLEToPortersBridge(mockPESTLEOutput, {});
      const formatted = formatPESTLEContextForPorters(enhancement);
      
      expect(formatted).toContain('Regulatory Barriers');
      expect(formatted).toContain('Buyer Power Indicators');
      expect(formatted).toContain('Substitute Enablers');
    });

    it('should include severity and direction indicators', async () => {
      const enhancement = await applyPESTLEToPortersBridge(mockPESTLEOutput, {});
      const formatted = formatPESTLEContextForPorters(enhancement);
      
      expect(formatted).toContain('[high]');
      expect(formatted).toContain('decreases');
    });
  });
});
