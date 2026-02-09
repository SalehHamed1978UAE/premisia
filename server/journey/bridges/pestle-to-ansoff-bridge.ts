/**
 * PESTLE → Ansoff Matrix Bridge
 * 
 * Transforms PESTLE macro-environmental analysis into Ansoff Matrix inputs.
 * 
 * Key transformations:
 * - Economic growth indicators → Market Penetration opportunities
 * - Technological trends → Product Development enablers
 * - Social/demographic shifts → Market Development signals
 * - Political/regulatory changes → Diversification risks/opportunities
 */

import type { StrategicContext } from '@shared/journey-types';
import { normalizePESTLEOutput } from './output-normalizer';

export interface PestleToAnsoffEnhancement {
  marketPenetrationSignals: Array<{
    signal: string;
    factor: string;
    rationale: string;
    source: string;
  }>;
  marketDevelopmentOpportunities: Array<{
    opportunity: string;
    factor: string;
    targetMarket: string;
    riskLevel: 'high' | 'medium' | 'low';
  }>;
  productDevelopmentEnablers: Array<{
    enabler: string;
    factor: string;
    rationale: string;
    feasibility: 'high' | 'medium' | 'low';
  }>;
  diversificationIndicators: Array<{
    indicator: string;
    factor: string;
    direction: 'related' | 'unrelated';
    riskLevel: 'high' | 'medium' | 'low';
  }>;
  macroEnvironmentSummary: string;
  growthReadinessScore: number;
}

/**
 * Transform PESTLE output into Ansoff Matrix context
 */
export function transformPestleToAnsoff(rawPestleOutput: any, context?: StrategicContext): PestleToAnsoffEnhancement {
  const pestleOutput = normalizePESTLEOutput(rawPestleOutput);

  const result: PestleToAnsoffEnhancement = {
    marketPenetrationSignals: [],
    marketDevelopmentOpportunities: [],
    productDevelopmentEnablers: [],
    diversificationIndicators: [],
    macroEnvironmentSummary: '',
    growthReadinessScore: 3,
  };

  if (!pestleOutput?.factors) return result;

  const factors = pestleOutput.factors;
  let opportunityCount = 0;
  let threatCount = 0;

  // Economic factors → Market Penetration (growth signals)
  if (factors.economic && Array.isArray(factors.economic)) {
    for (const f of factors.economic.slice(0, 4)) {
      const factorText = f.factor || '';
      const lower = factorText.toLowerCase();
      
      if (f.impact === 'opportunity') opportunityCount++;
      else if (f.impact === 'threat') threatCount++;
      
      if (lower.includes('growth') || lower.includes('demand') || lower.includes('spending')) {
        result.marketPenetrationSignals.push({
          signal: 'Favorable economic conditions for market deepening',
          factor: factorText,
          rationale: 'Economic indicator supports increased market penetration',
          source: 'PESTLE Economic',
        });
      }
      
      if (lower.includes('emerging') || lower.includes('international') || lower.includes('export')) {
        result.marketDevelopmentOpportunities.push({
          opportunity: 'Geographic/market expansion',
          factor: factorText,
          targetMarket: 'Emerging or adjacent markets',
          riskLevel: f.impact === 'opportunity' ? 'medium' : 'high',
        });
      }
    }
  }

  // Social factors → Market Development (demographic shifts, new segments)
  if (factors.social && Array.isArray(factors.social)) {
    for (const f of factors.social.slice(0, 3)) {
      const factorText = f.factor || '';
      const lower = factorText.toLowerCase();
      
      if (f.impact === 'opportunity') opportunityCount++;
      else if (f.impact === 'threat') threatCount++;
      
      if (lower.includes('demographic') || lower.includes('population') || lower.includes('generation')) {
        result.marketDevelopmentOpportunities.push({
          opportunity: 'New demographic segments',
          factor: factorText,
          targetMarket: 'Underserved demographic groups',
          riskLevel: 'medium',
        });
      }
      
      if (lower.includes('trend') || lower.includes('lifestyle') || lower.includes('behavior')) {
        result.marketPenetrationSignals.push({
          signal: 'Social trend alignment opportunity',
          factor: factorText,
          rationale: 'Align messaging and offerings with evolving preferences',
          source: 'PESTLE Social',
        });
      }
    }
  }

  // Technological factors → Product Development
  if (factors.technological && Array.isArray(factors.technological)) {
    for (const f of factors.technological.slice(0, 4)) {
      const factorText = f.factor || '';
      const lower = factorText.toLowerCase();
      
      if (f.impact === 'opportunity') opportunityCount++;
      else if (f.impact === 'threat') threatCount++;
      
      result.productDevelopmentEnablers.push({
        enabler: factorText,
        factor: factorText,
        rationale: 'Technology factor enables new product/service capabilities',
        feasibility: f.impact === 'opportunity' ? 'high' : 'medium',
      });
      
      if (lower.includes('digital') || lower.includes('platform') || lower.includes('ai') || lower.includes('automation')) {
        result.diversificationIndicators.push({
          indicator: 'Technology-enabled diversification',
          factor: factorText,
          direction: 'related',
          riskLevel: 'medium',
        });
      }
    }
  }

  // Political/Legal factors → Diversification indicators (regulatory shifts)
  if (factors.political && Array.isArray(factors.political)) {
    for (const f of factors.political.slice(0, 2)) {
      const factorText = f.factor || '';
      
      if (f.impact === 'opportunity') opportunityCount++;
      else if (f.impact === 'threat') threatCount++;
      
      if (f.impact === 'opportunity') {
        result.marketDevelopmentOpportunities.push({
          opportunity: 'Policy-enabled market access',
          factor: factorText,
          targetMarket: 'Newly accessible markets',
          riskLevel: 'low',
        });
      } else if (f.impact === 'threat') {
        result.diversificationIndicators.push({
          indicator: 'Regulatory risk diversification',
          factor: factorText,
          direction: 'related',
          riskLevel: 'high',
        });
      }
    }
  }

  // Legal factors → Business constraints
  if (factors.legal && Array.isArray(factors.legal)) {
    for (const f of factors.legal.slice(0, 2)) {
      if (f.impact === 'opportunity') opportunityCount++;
      else if (f.impact === 'threat') threatCount++;
    }
  }

  // Environmental factors → Sustainability-driven opportunities
  if (factors.environmental && Array.isArray(factors.environmental)) {
    for (const f of factors.environmental.slice(0, 2)) {
      const factorText = f.factor || '';
      
      if (f.impact === 'opportunity') opportunityCount++;
      else if (f.impact === 'threat') threatCount++;
      
      if (f.impact === 'opportunity') {
        result.productDevelopmentEnablers.push({
          enabler: 'Sustainability-driven innovation',
          factor: factorText,
          rationale: 'Environmental trend creates product development opportunity',
          feasibility: 'medium',
        });
      }
    }
  }

  // Calculate growth readiness (1-5 scale)
  const netOpportunity = opportunityCount - (threatCount * 0.5);
  result.growthReadinessScore = Math.min(5, Math.max(1, Math.round(3 + netOpportunity / 3)));

  // Build macro summary
  result.macroEnvironmentSummary = buildMacroSummary(result);

  console.log(`[Bridge] pestle-to-ansoff: Generated ${result.marketPenetrationSignals.length} penetration, ${result.marketDevelopmentOpportunities.length} development, ${result.productDevelopmentEnablers.length} product, ${result.diversificationIndicators.length} diversification factors`);

  return result;
}

/**
 * Build macro environment summary
 */
function buildMacroSummary(enhancement: PestleToAnsoffEnhancement): string {
  const total = 
    enhancement.marketPenetrationSignals.length +
    enhancement.marketDevelopmentOpportunities.length +
    enhancement.productDevelopmentEnablers.length +
    enhancement.diversificationIndicators.length;
  
  return `Macro Environment Analysis: ${total} growth factors identified. Growth Readiness Score: ${enhancement.growthReadinessScore}/5.`;
}

/**
 * Format PESTLE context as text for inclusion in Ansoff prompt
 */
export function formatPestleContextForAnsoff(enhancement: PestleToAnsoffEnhancement): string {
  const sections: string[] = [];
  
  sections.push('**Macro-Environment Growth Context (from PESTLE):**');
  sections.push(enhancement.macroEnvironmentSummary);
  
  if (enhancement.marketPenetrationSignals.length > 0) {
    sections.push('\n**Market Penetration Signals:**');
    for (const s of enhancement.marketPenetrationSignals.slice(0, 3)) {
      sections.push(`- ${s.signal}: ${s.factor}`);
    }
  }
  
  if (enhancement.marketDevelopmentOpportunities.length > 0) {
    sections.push('\n**Market Development Opportunities:**');
    for (const o of enhancement.marketDevelopmentOpportunities.slice(0, 3)) {
      sections.push(`- ${o.opportunity} → ${o.targetMarket} [${o.riskLevel} risk]`);
    }
  }
  
  if (enhancement.productDevelopmentEnablers.length > 0) {
    sections.push('\n**Product Development Enablers:**');
    for (const e of enhancement.productDevelopmentEnablers.slice(0, 3)) {
      sections.push(`- ${e.enabler} [${e.feasibility} feasibility]`);
    }
  }
  
  if (enhancement.diversificationIndicators.length > 0) {
    sections.push('\n**Diversification Indicators:**');
    for (const d of enhancement.diversificationIndicators.slice(0, 2)) {
      sections.push(`- ${d.indicator} (${d.direction}) [${d.riskLevel} risk]`);
    }
  }
  
  return sections.join('\n');
}

export default { transformPestleToAnsoff, formatPestleContextForAnsoff };
