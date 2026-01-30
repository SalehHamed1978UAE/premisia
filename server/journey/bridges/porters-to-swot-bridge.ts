/**
 * Porter's Five Forces → SWOT Bridge
 * 
 * Transforms Porter's competitive analysis + PESTLE context into
 * derived Opportunities and Threats for SWOT analysis.
 * 
 * Key transformations:
 * - Low forces = Opportunities (favorable competitive conditions)
 * - High forces = Threats (competitive pressure)
 * - PESTLE context strengthens O/T derivation
 */

import type { StrategicContext } from '@shared/journey-types';

/**
 * Derived O/T item for SWOT
 */
interface DerivedItem {
  item: string;
  description: string;
  magnitude: 'high' | 'medium' | 'low';
  sourceAnalysis: 'pestle' | 'porters' | 'combined';
  sourceReference: string;
  priority: number;
  priorityRationale: string;
}

/**
 * Enhanced context for SWOT analysis based on Porter's findings
 */
export interface PortersToSWOTEnhancement {
  // Opportunities derived from low forces
  derivedOpportunities: DerivedItem[];
  
  // Threats derived from high forces
  derivedThreats: DerivedItem[];
  
  // PESTLE factors used
  pestleFactorsUsed: string[];
  
  // Porter forces used
  porterForcesUsed: string[];
  
  // Competitor insights
  competitorInsights: {
    namedCompetitors: string[];
    competitorStrengths: string[];
    competitorWeaknesses: string[];
  };
  
  // Market attractiveness context
  marketContext: {
    attractivenessScore: number;
    assessment: string;
    rationale: string;
  };
}

/**
 * Map force level to magnitude
 */
function getLevelMagnitude(level: string): 'high' | 'medium' | 'low' {
  if (level === 'very_low' || level === 'low') return 'high'; // Low threat = high opportunity
  if (level === 'very_high' || level === 'high') return 'high'; // High threat = high threat
  return 'medium';
}

/**
 * Get force score from output (handles various formats)
 */
function getForceScore(force: any): number {
  if (typeof force === 'number') return force;
  if (force?.score) return force.score;
  return 5;
}

/**
 * Get force level from output
 */
function getForceLevel(force: any): string {
  if (force?.level) return force.level;
  const score = getForceScore(force);
  if (score <= 2) return 'very_low';
  if (score <= 4) return 'low';
  if (score <= 6) return 'medium';
  if (score <= 8) return 'high';
  return 'very_high';
}

/**
 * Transform Porter's output into SWOT context
 */
function transformPortersToSWOT(
  portersOutput: any,
  pestleOutput: any | undefined
): PortersToSWOTEnhancement {
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
          description: `Low threat of new entrants (${score}/10) means high barriers protect market position once established. First-mover advantage is defensible.`,
          magnitude: getLevelMagnitude(level),
          sourceAnalysis: 'porters',
          sourceReference: `Porter's Threat of New Entrants: ${score}/10 (${level})`,
          priority: level === 'very_low' ? 1 : 2,
          priorityRationale: 'High barriers create sustainable competitive advantage',
        });
        porterForcesUsed.push('threatOfNewEntrants');
      } else if (level === 'very_high' || level === 'high') {
        threats.push({
          item: 'Vulnerable to new competitors',
          description: `High threat of new entrants (${score}/10) means low barriers allow competitors to easily enter. Market position vulnerable to disruption.`,
          magnitude: getLevelMagnitude(level),
          sourceAnalysis: 'porters',
          sourceReference: `Porter's Threat of New Entrants: ${score}/10 (${level})`,
          priority: level === 'very_high' ? 1 : 2,
          priorityRationale: 'Low barriers require rapid differentiation',
        });
        porterForcesUsed.push('threatOfNewEntrants');
      }
    }
    
    // Supplier Power
    const supplierPower = forces.supplierPower || forces.bargainingPowerOfSuppliers;
    if (supplierPower) {
      const level = getForceLevel(supplierPower);
      const score = getForceScore(supplierPower);
      
      if (level === 'very_low' || level === 'low') {
        opportunities.push({
          item: 'Favorable supplier negotiations',
          description: `Low supplier power (${score}/10) means multiple options available. Favorable negotiating position for cost optimization.`,
          magnitude: getLevelMagnitude(level),
          sourceAnalysis: 'porters',
          sourceReference: `Porter's Supplier Power: ${score}/10 (${level})`,
          priority: 3,
          priorityRationale: 'Cost advantages from supplier competition',
        });
        porterForcesUsed.push('supplierPower');
      } else if (level === 'very_high' || level === 'high') {
        threats.push({
          item: 'Supplier dependency risk',
          description: `High supplier power (${score}/10) means limited options. Vulnerable to price increases and supply constraints.`,
          magnitude: getLevelMagnitude(level),
          sourceAnalysis: 'porters',
          sourceReference: `Porter's Supplier Power: ${score}/10 (${level})`,
          priority: 2,
          priorityRationale: 'Supply chain vulnerability requires mitigation',
        });
        porterForcesUsed.push('supplierPower');
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
          description: `Low buyer power (${score}/10) means customers have limited alternatives. Premium pricing sustainable without significant pushback.`,
          magnitude: getLevelMagnitude(level),
          sourceAnalysis: 'porters',
          sourceReference: `Porter's Buyer Power: ${score}/10 (${level})`,
          priority: 2,
          priorityRationale: 'Pricing flexibility enables margin expansion',
        });
        porterForcesUsed.push('buyerPower');
      } else if (level === 'very_high' || level === 'high') {
        threats.push({
          item: 'Price pressure from buyers',
          description: `High buyer power (${score}/10) means customers have many alternatives. Price pressure and commoditization risk.`,
          magnitude: getLevelMagnitude(level),
          sourceAnalysis: 'porters',
          sourceReference: `Porter's Buyer Power: ${score}/10 (${level})`,
          priority: 2,
          priorityRationale: 'Margin pressure requires differentiation',
        });
        porterForcesUsed.push('buyerPower');
      }
    }
    
    // Threat of Substitutes
    const substitutes = forces.threatOfSubstitutes;
    if (substitutes) {
      const level = getForceLevel(substitutes);
      const score = getForceScore(substitutes);
      
      if (level === 'very_low' || level === 'low') {
        opportunities.push({
          item: 'Unique value proposition',
          description: `Low substitute threat (${score}/10) means few alternatives solve the same problem. Value proposition is defensible.`,
          magnitude: getLevelMagnitude(level),
          sourceAnalysis: 'porters',
          sourceReference: `Porter's Threat of Substitutes: ${score}/10 (${level})`,
          priority: 2,
          priorityRationale: 'Limited alternatives strengthen market position',
        });
        porterForcesUsed.push('threatOfSubstitutes');
      } else if (level === 'very_high' || level === 'high') {
        threats.push({
          item: 'Strong substitute competition',
          description: `High substitute threat (${score}/10) means alternative solutions compete for same customers. Must clearly differentiate.`,
          magnitude: getLevelMagnitude(level),
          sourceAnalysis: 'porters',
          sourceReference: `Porter's Threat of Substitutes: ${score}/10 (${level})`,
          priority: 2,
          priorityRationale: 'Substitutes require clear differentiation strategy',
        });
        porterForcesUsed.push('threatOfSubstitutes');
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
          description: `Low rivalry (${score}/10) means limited direct competition. Market share available for capture without aggressive price wars.`,
          magnitude: getLevelMagnitude(level),
          sourceAnalysis: 'porters',
          sourceReference: `Porter's Competitive Rivalry: ${score}/10 (${level})`,
          priority: 1,
          priorityRationale: 'Low competition enables rapid market capture',
        });
        porterForcesUsed.push('competitiveRivalry');
      } else if (level === 'very_high' || level === 'high') {
        threats.push({
          item: 'Intense competitive pressure',
          description: `High rivalry (${score}/10) means many competitors fighting for same customers. Margin pressure from price wars.`,
          magnitude: getLevelMagnitude(level),
          sourceAnalysis: 'porters',
          sourceReference: `Porter's Competitive Rivalry: ${score}/10 (${level})`,
          priority: 1,
          priorityRationale: 'Competition requires strategic positioning',
        });
        porterForcesUsed.push('competitiveRivalry');
      }
    }
  }
  
  // Add PESTLE-derived O/T if available
  if (pestleOutput?.opportunities && Array.isArray(pestleOutput.opportunities)) {
    for (const o of pestleOutput.opportunities.slice(0, 3)) {
      opportunities.push({
        item: o.opportunity || o.item,
        description: o.description || '',
        magnitude: o.magnitude || 'medium',
        sourceAnalysis: 'pestle',
        sourceReference: 'PESTLE Analysis',
        priority: 3,
        priorityRationale: 'Macro-environmental opportunity',
      });
    }
    pestleFactorsUsed.push(...pestleOutput.opportunities.map((o: any) => o.opportunity || o.item));
  }
  
  if (pestleOutput?.threats && Array.isArray(pestleOutput.threats)) {
    for (const t of pestleOutput.threats.slice(0, 3)) {
      threats.push({
        item: t.threat || t.item,
        description: t.description || '',
        magnitude: t.magnitude || 'medium',
        sourceAnalysis: 'pestle',
        sourceReference: 'PESTLE Analysis',
        priority: 3,
        priorityRationale: 'Macro-environmental threat',
      });
    }
    pestleFactorsUsed.push(...pestleOutput.threats.map((t: any) => t.threat || t.item));
  }
  
  // Sort by priority
  opportunities.sort((a, b) => a.priority - b.priority);
  threats.sort((a, b) => a.priority - b.priority);
  
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

/**
 * Apply the Porter's → SWOT bridge
 */
export function applyPortersToSWOTBridge(
  portersOutput: any,
  pestleOutput: any | undefined,
  positioning: any
): Promise<PortersToSWOTEnhancement> {
  const enhancement = transformPortersToSWOT(portersOutput, pestleOutput);
  
  console.log('[Porter\'s→SWOT Bridge] Transformation complete:', {
    derivedOpportunities: enhancement.derivedOpportunities.length,
    derivedThreats: enhancement.derivedThreats.length,
    pestleFactorsUsed: enhancement.pestleFactorsUsed.length,
    porterForcesUsed: enhancement.porterForcesUsed.length,
    competitors: enhancement.competitorInsights.namedCompetitors.length,
  });
  
  return Promise.resolve(enhancement);
}

/**
 * Format derived O/T as text for SWOT prompt
 */
export function formatPortersContextForSWOT(enhancement: PortersToSWOTEnhancement): string {
  const sections: string[] = [];
  
  if (enhancement.derivedOpportunities.length > 0) {
    sections.push('**Derived Opportunities (from Porter\'s + PESTLE):**');
    for (const o of enhancement.derivedOpportunities) {
      sections.push(`- [${o.sourceAnalysis.toUpperCase()}] ${o.item} (${o.magnitude})`);
      sections.push(`  Source: ${o.sourceReference}`);
    }
  }
  
  if (enhancement.derivedThreats.length > 0) {
    sections.push('\n**Derived Threats (from Porter\'s + PESTLE):**');
    for (const t of enhancement.derivedThreats) {
      sections.push(`- [${t.sourceAnalysis.toUpperCase()}] ${t.item} (${t.magnitude})`);
      sections.push(`  Source: ${t.sourceReference}`);
    }
  }
  
  if (enhancement.competitorInsights.namedCompetitors.length > 0) {
    sections.push('\n**Competitors Identified:**');
    sections.push(enhancement.competitorInsights.namedCompetitors.join(', '));
  }
  
  sections.push(`\n**Market Attractiveness:** ${enhancement.marketContext.attractivenessScore}/10 (${enhancement.marketContext.assessment})`);
  
  return sections.join('\n');
}
