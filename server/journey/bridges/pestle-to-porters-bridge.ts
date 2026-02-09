/**
 * PESTLE → Porter's Five Forces Bridge
 * 
 * Cognitive transformation of PESTLE macro-environmental factors
 * into context that shapes Porter's Five Forces analysis.
 * 
 * Key transformations:
 * - Legal/regulatory factors → Entry barriers
 * - Economic conditions → Buyer power context
 * - Technological trends → Substitute threats
 * - Political/trade factors → Supplier power context
 */

import type { StrategicContext } from '@shared/journey-types';
import { normalizePESTLEOutput } from './output-normalizer';

/**
 * Enhanced context for Porter's analysis based on PESTLE findings
 */
export interface PESTLEToPortersEnhancement {
  // Regulatory barriers from Legal factors
  regulatoryBarriers: Array<{
    factor: string;
    severity: 'high' | 'medium' | 'low';
    interpretation: string;
    source: string;
  }>;
  
  // Economic indicators for buyer power
  buyerPowerIndicators: Array<{
    factor: string;
    direction: 'increases' | 'decreases';
    interpretation: string;
  }>;
  
  // Technology factors enabling substitutes
  substituteEnablers: Array<{
    factor: string;
    substituteType: string;
    interpretation: string;
  }>;
  
  // Trade/political factors for supplier power
  supplierPowerFactors: Array<{
    factor: string;
    direction: 'increases' | 'decreases';
    interpretation: string;
  }>;
  
  // Market growth signals affecting rivalry
  growthSignals: Array<{
    factor: string;
    growthRate: string | null;
    implication: string;
  }>;
  
  // Raw PESTLE reference
  pestleScope: string;
  pestleConfidence: string;
}

/**
 * Transform PESTLE output into Porter's context
 */
function transformPESTLEToPorters(rawPestleOutput: any): PESTLEToPortersEnhancement {
  // Normalize output to handle various wrapper shapes
  const pestleOutput = normalizePESTLEOutput(rawPestleOutput);

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
      
      // Spending/income affects buyer power
      if (lower.includes('income') || lower.includes('spending') || lower.includes('disposable') || lower.includes('purchasing')) {
        result.buyerPowerIndicators.push({
          factor: f.factor,
          direction: f.impact === 'opportunity' ? 'decreases' : 'increases',
          interpretation: `Economic factor "${f.factor}" affects buyer price sensitivity`,
        });
      }
      
      // Growth signals
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
  
  // Social factors → Buyer power
  if (factors.social && Array.isArray(factors.social)) {
    for (const f of factors.social) {
      const lower = (f.factor || '').toLowerCase();
      if (lower.includes('trend') || lower.includes('culture') || lower.includes('community') || lower.includes('lifestyle')) {
        result.buyerPowerIndicators.push({
          factor: f.factor,
          direction: f.impact === 'opportunity' ? 'decreases' : 'increases',
          interpretation: `Social trend "${f.factor}" affects buyer preferences and loyalty`,
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

/**
 * Apply the PESTLE → Porter's bridge to a strategic context
 * Returns enhanced context with bridge output stored for Porter's executor
 */
export function applyPESTLEToPortersBridge(
  pestleOutput: any,
  positioning: any
): Promise<PESTLEToPortersEnhancement> {
  const enhancement = transformPESTLEToPorters(pestleOutput);
  
  console.log('[PESTLE→Porter\'s Bridge] Transformation complete:', {
    regulatoryBarriers: enhancement.regulatoryBarriers.length,
    buyerPowerIndicators: enhancement.buyerPowerIndicators.length,
    substituteEnablers: enhancement.substituteEnablers.length,
    supplierPowerFactors: enhancement.supplierPowerFactors.length,
    growthSignals: enhancement.growthSignals.length,
  });
  
  return Promise.resolve(enhancement);
}

/**
 * Format PESTLE context as text for inclusion in Porter's prompt
 */
export function formatPESTLEContextForPorters(enhancement: PESTLEToPortersEnhancement): string {
  const sections: string[] = [];
  
  if (enhancement.regulatoryBarriers.length > 0) {
    sections.push('**Regulatory Barriers (from PESTLE Legal):**');
    for (const rb of enhancement.regulatoryBarriers) {
      sections.push(`- ${rb.factor} [${rb.severity}]: ${rb.interpretation}`);
    }
  }
  
  if (enhancement.buyerPowerIndicators.length > 0) {
    sections.push('\n**Buyer Power Indicators (from PESTLE Economic/Social):**');
    for (const bp of enhancement.buyerPowerIndicators) {
      sections.push(`- ${bp.factor} → ${bp.direction} buyer power: ${bp.interpretation}`);
    }
  }
  
  if (enhancement.substituteEnablers.length > 0) {
    sections.push('\n**Substitute Enablers (from PESTLE Technological):**');
    for (const se of enhancement.substituteEnablers) {
      sections.push(`- ${se.factor} [${se.substituteType}]: ${se.interpretation}`);
    }
  }
  
  if (enhancement.supplierPowerFactors.length > 0) {
    sections.push('\n**Supplier Power Factors (from PESTLE Political):**');
    for (const sp of enhancement.supplierPowerFactors) {
      sections.push(`- ${sp.factor} → ${sp.direction} supplier power: ${sp.interpretation}`);
    }
  }
  
  if (enhancement.growthSignals.length > 0) {
    sections.push('\n**Market Growth Signals (from PESTLE Economic):**');
    for (const gs of enhancement.growthSignals) {
      const rate = gs.growthRate ? ` (${gs.growthRate})` : '';
      sections.push(`- ${gs.factor}${rate}: ${gs.implication}`);
    }
  }
  
  return sections.join('\n');
}
