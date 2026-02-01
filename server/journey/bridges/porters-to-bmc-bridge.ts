/**
 * Porter's Five Forces → BMC Bridge
 * 
 * Transforms Porter's competitive analysis into BMC framework inputs.
 * 
 * Key transformations:
 * - Competitive rivalry → Value Proposition differentiation needs
 * - Buyer power → Customer Segments focus
 * - Supplier power → Key Partnerships constraints
 * - Entry barriers → Key Activities for defense
 * - Substitutes → Revenue Streams diversification
 */

import type { StrategicContext } from '@shared/journey-types';

export interface PortersToBmcEnhancement {
  valuePropositionHints: Array<{
    hint: string;
    rationale: string;
    source: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  customerSegmentInsights: Array<{
    segment: string;
    buyerPowerLevel: string;
    implication: string;
  }>;
  keyPartnershipConstraints: Array<{
    constraint: string;
    supplierPowerContext: string;
    mitigation: string;
  }>;
  keyActivityRecommendations: Array<{
    activity: string;
    rationale: string;
    defensibility: string;
  }>;
  revenueStreamRisks: Array<{
    risk: string;
    substitutesThreat: string;
    recommendation: string;
  }>;
  competitiveContext: string;
  industryAttractivenessScore: number;
}

/**
 * Transform Porter's output into BMC context
 */
export function transformPortersToBmc(rawPortersOutput: any, context?: StrategicContext): PortersToBmcEnhancement {
  const portersOutput = normalizePortersOutput(rawPortersOutput);

  const result: PortersToBmcEnhancement = {
    valuePropositionHints: [],
    customerSegmentInsights: [],
    keyPartnershipConstraints: [],
    keyActivityRecommendations: [],
    revenueStreamRisks: [],
    competitiveContext: '',
    industryAttractivenessScore: 5,
  };

  if (!portersOutput) return result;

  const forces = portersOutput.portersResults || portersOutput;
  let totalScore = 0;
  let scoreCount = 0;

  // Competitive Rivalry → Value Proposition differentiation
  if (forces.competitiveRivalry || forces.competitive_rivalry) {
    const rivalry = forces.competitiveRivalry || forces.competitive_rivalry;
    const score = rivalry.score || rivalry.intensity || 5;
    totalScore += score;
    scoreCount++;

    if (score >= 7) {
      result.valuePropositionHints.push({
        hint: 'Strong differentiation required',
        rationale: `High competitive rivalry (${score}/10) demands unique value proposition`,
        source: 'Porter\'s Competitive Rivalry',
        priority: 'high',
      });
    }

    const competitors = rivalry.competitors || rivalry.keyCompetitors || [];
    if (competitors.length > 0) {
      result.valuePropositionHints.push({
        hint: 'Competitive positioning clarity needed',
        rationale: `${competitors.length} identified competitors require clear differentiation strategy`,
        source: 'Porter\'s Analysis',
        priority: 'medium',
      });
    }
  }

  // Buyer Power → Customer Segments
  if (forces.bargainingPowerOfBuyers || forces.buyer_power) {
    const buyerPower = forces.bargainingPowerOfBuyers || forces.buyer_power;
    const score = buyerPower.score || buyerPower.level || 5;
    totalScore += score;
    scoreCount++;

    const powerLevel = score >= 7 ? 'high' : score >= 4 ? 'moderate' : 'low';
    
    result.customerSegmentInsights.push({
      segment: 'Primary customer base',
      buyerPowerLevel: powerLevel,
      implication: score >= 7 
        ? 'Focus on customer retention and switching cost creation' 
        : 'Opportunity for premium pricing with value demonstration',
    });

    if (buyerPower.factors || buyerPower.drivers) {
      const factors = buyerPower.factors || buyerPower.drivers || [];
      for (const f of factors.slice(0, 2)) {
        const factor = typeof f === 'string' ? f : (f.factor || f.driver || f.name || '');
        if (factor) {
          result.customerSegmentInsights.push({
            segment: 'Buyer behavior',
            buyerPowerLevel: powerLevel,
            implication: `Consider: ${factor}`,
          });
        }
      }
    }
  }

  // Supplier Power → Key Partnerships
  if (forces.bargainingPowerOfSuppliers || forces.supplier_power) {
    const supplierPower = forces.bargainingPowerOfSuppliers || forces.supplier_power;
    const score = supplierPower.score || supplierPower.level || 5;
    totalScore += score;
    scoreCount++;

    if (score >= 6) {
      result.keyPartnershipConstraints.push({
        constraint: 'Supplier dependency risk',
        supplierPowerContext: `Supplier power is ${score >= 7 ? 'high' : 'moderate'} (${score}/10)`,
        mitigation: 'Diversify supplier base and build strategic partnerships',
      });
    }

    const analysis = supplierPower.analysis || supplierPower.description || '';
    if (analysis) {
      result.keyPartnershipConstraints.push({
        constraint: 'Supply chain optimization needed',
        supplierPowerContext: analysis.substring(0, 150),
        mitigation: 'Develop backup suppliers and negotiate favorable terms',
      });
    }
  }

  // Threat of New Entrants → Key Activities (barriers to maintain)
  if (forces.threatOfNewEntrants || forces.new_entrants) {
    const entrants = forces.threatOfNewEntrants || forces.new_entrants;
    const score = entrants.score || entrants.threatLevel || 5;
    totalScore += score;
    scoreCount++;

    const barriers = entrants.barriers || entrants.entryBarriers || [];
    for (const b of barriers.slice(0, 3)) {
      const barrier = typeof b === 'string' ? b : (b.barrier || b.name || b.factor || '');
      if (barrier) {
        result.keyActivityRecommendations.push({
          activity: `Strengthen: ${barrier}`,
          rationale: 'Maintain competitive moat',
          defensibility: score >= 7 ? 'low (high threat)' : 'moderate',
        });
      }
    }

    if (score >= 7) {
      result.keyActivityRecommendations.push({
        activity: 'Build proprietary capabilities',
        rationale: `High new entrant threat (${score}/10) requires defensible advantages`,
        defensibility: 'critical',
      });
    }
  }

  // Threat of Substitutes → Revenue Stream risks
  if (forces.threatOfSubstitutes || forces.substitutes) {
    const substitutes = forces.threatOfSubstitutes || forces.substitutes;
    const score = substitutes.score || substitutes.threatLevel || 5;
    totalScore += score;
    scoreCount++;

    if (score >= 6) {
      result.revenueStreamRisks.push({
        risk: 'Substitute product threat',
        substitutesThreat: `Substitutes pose ${score >= 7 ? 'high' : 'moderate'} risk (${score}/10)`,
        recommendation: 'Diversify revenue streams and increase switching costs',
      });
    }

    const substitutesAnalysis = substitutes.analysis || substitutes.description || '';
    if (substitutesAnalysis.toLowerCase().includes('digital') || substitutesAnalysis.toLowerCase().includes('online')) {
      result.revenueStreamRisks.push({
        risk: 'Digital disruption potential',
        substitutesThreat: 'Technology-enabled substitutes identified',
        recommendation: 'Consider digital revenue streams and hybrid offerings',
      });
    }
  }

  // Calculate industry attractiveness (lower is more attractive)
  result.industryAttractivenessScore = scoreCount > 0 
    ? Math.round((50 - (totalScore / scoreCount) * 5) / 10)  // Convert to 1-5 scale
    : 3;

  // Build competitive context summary
  result.competitiveContext = buildCompetitiveContext(forces, result.industryAttractivenessScore);

  console.log(`[Bridge] porters-to-bmc: Generated ${result.valuePropositionHints.length} VP hints, ${result.keyActivityRecommendations.length} activity recommendations`);

  return result;
}

/**
 * Normalize various Porter's output formats
 */
function normalizePortersOutput(raw: any): any {
  if (!raw) return null;

  if (raw.data?.output) return raw.data.output;
  if (raw.data?.portersResults) return raw.data;
  if (raw.output?.portersResults) return raw.output;
  if (raw.portersResults) return raw;
  if (raw.data) return raw.data;
  if (raw.output) return raw.output;

  return raw;
}

/**
 * Build competitive context summary for BMC
 */
function buildCompetitiveContext(forces: any, attractiveness: number): string {
  const sections: string[] = [];
  
  sections.push(`Industry Attractiveness: ${attractiveness}/5`);
  
  if (forces.competitiveRivalry?.score >= 7) {
    sections.push('- High competitive intensity requires strong differentiation');
  }
  if (forces.threatOfNewEntrants?.score >= 7) {
    sections.push('- Low entry barriers necessitate defensible moats');
  }
  if (forces.threatOfSubstitutes?.score >= 7) {
    sections.push('- Substitute threats require value lock-in strategies');
  }
  
  return sections.join('\n');
}

/**
 * Format Porter's context as text for inclusion in BMC prompt
 */
export function formatPortersContextForBmc(enhancement: PortersToBmcEnhancement): string {
  const sections: string[] = [];
  
  sections.push('**Competitive Context from Porter\'s Analysis:**');
  sections.push(enhancement.competitiveContext);
  
  if (enhancement.valuePropositionHints.length > 0) {
    sections.push('\n**Value Proposition Guidance:**');
    for (const hint of enhancement.valuePropositionHints) {
      sections.push(`- [${hint.priority}] ${hint.hint}: ${hint.rationale}`);
    }
  }
  
  if (enhancement.keyActivityRecommendations.length > 0) {
    sections.push('\n**Recommended Key Activities:**');
    for (const rec of enhancement.keyActivityRecommendations) {
      sections.push(`- ${rec.activity} (${rec.defensibility})`);
    }
  }
  
  return sections.join('\n');
}

export default { transformPortersToBmc, formatPortersContextForBmc };
