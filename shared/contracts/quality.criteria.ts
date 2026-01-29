/**
 * Quality Criteria
 * Based on MODULE_FACTORY_SPECIFICATION.md Part 4
 * 
 * Universal quality criteria that apply to all modules.
 */

// =============================================================================
// QUALITY CRITERION INTERFACE
// =============================================================================

export interface QualityCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;  // 0-1, all weights sum to 1
  
  rubric: {
    score1to3: string;
    score4to6: string;
    score7to8: string;
    score9to10: string;
  };
  
  redFlags: string[];
}

// =============================================================================
// UNIVERSAL QUALITY CRITERIA
// =============================================================================

export const UNIVERSAL_QUALITY_CRITERIA: QualityCriterion[] = [
  {
    id: 'specificity',
    name: 'Specificity',
    description: 'Output is specific to THIS business, market, and context',
    weight: 0.25,
    rubric: {
      score1to3: 'Generic output that could apply to any business',
      score4to6: 'Industry-specific but not business-specific',
      score7to8: 'Business-specific with some generic elements',
      score9to10: 'Highly specific to this exact business and context',
    },
    redFlags: [
      'Uses generic phrases like "the company" instead of business name',
      'Analysis could apply to any business in the sector',
      'No reference to specific geography or market',
    ],
  },
  {
    id: 'evidence',
    name: 'Evidence Quality',
    description: 'Claims are supported by research and citations',
    weight: 0.20,
    rubric: {
      score1to3: 'No citations, pure speculation',
      score4to6: 'Some citations but mostly general knowledge',
      score7to8: 'Most claims cited with credible sources',
      score9to10: 'All claims cited with recent, authoritative sources',
    },
    redFlags: [
      'Claims without any supporting evidence',
      'Only uses sources older than 2 years',
      'Cites unreliable or biased sources',
    ],
  },
  {
    id: 'actionability',
    name: 'Actionability',
    description: 'Output leads to clear, specific actions',
    weight: 0.25,
    rubric: {
      score1to3: 'Pure analysis with no action implications',
      score4to6: 'Some general recommendations',
      score7to8: 'Clear actions but lacking specifics',
      score9to10: 'Specific actions with owners, timelines, resources',
    },
    redFlags: [
      'Ends with "monitor this" without specifics',
      'Recommendations too vague to implement',
      'No connection between analysis and actions',
    ],
  },
  {
    id: 'consistency',
    name: 'Internal Consistency',
    description: 'Output is logically consistent with prior analysis',
    weight: 0.15,
    rubric: {
      score1to3: 'Contradicts prior module outputs',
      score4to6: 'Loosely connected to prior analysis',
      score7to8: 'References prior analysis appropriately',
      score9to10: 'Seamlessly builds on prior analysis with explicit connections',
    },
    redFlags: [
      'Ignores insights from previous modules',
      'Contradicts findings from earlier analysis',
      'No traceability to source analysis',
    ],
  },
  {
    id: 'completeness',
    name: 'Completeness',
    description: 'All required aspects are covered adequately',
    weight: 0.15,
    rubric: {
      score1to3: 'Major aspects missing',
      score4to6: 'Covers basics but thin in areas',
      score7to8: 'Good coverage with minor gaps',
      score9to10: 'Comprehensive coverage of all aspects',
    },
    redFlags: [
      'Empty or missing sections',
      'One-line items where depth expected',
      'Skips required categories entirely',
    ],
  },
];

// =============================================================================
// QUALITY SCORING HELPERS
// =============================================================================

export interface QualityScore {
  criterion: string;
  score: number;
  rationale: string;
  weight: number;
}

export interface QualityAssessment {
  overallScore: number;
  details: QualityScore[];
  redFlagsFound: string[];
  recommendation: 'accept' | 'review' | 'reject';
}

/**
 * Calculate overall quality score from individual criterion scores
 */
export function calculateOverallScore(scores: QualityScore[]): number {
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const score of scores) {
    weightedSum += score.score * score.weight;
    totalWeight += score.weight;
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Get recommendation based on score
 */
export function getRecommendation(score: number): 'accept' | 'review' | 'reject' {
  if (score >= 7) return 'accept';
  if (score >= 5) return 'review';
  return 'reject';
}

/**
 * Assess quality of an output against criteria
 */
export function assessQuality(
  output: Record<string, unknown>,
  criteria: QualityCriterion[],
  scoringFn: (criterion: QualityCriterion, output: Record<string, unknown>) => { score: number; rationale: string }
): QualityAssessment {
  const details: QualityScore[] = [];
  const redFlagsFound: string[] = [];
  
  for (const criterion of criteria) {
    const { score, rationale } = scoringFn(criterion, output);
    details.push({
      criterion: criterion.name,
      score,
      rationale,
      weight: criterion.weight,
    });
    
    // Check for red flags
    if (score < 5) {
      redFlagsFound.push(...criterion.redFlags.slice(0, 2));
    }
  }
  
  const overallScore = calculateOverallScore(details);
  
  return {
    overallScore,
    details,
    redFlagsFound: [...new Set(redFlagsFound)], // Dedupe
    recommendation: getRecommendation(overallScore),
  };
}

// =============================================================================
// MODULE-SPECIFIC CRITERIA GETTERS
// =============================================================================

import { PESTLEQualityRubric } from './pestle.schema';
import { PortersQualityRubric } from './porters.schema';
import { SWOTQualityRubric } from './swot.schema';
import { FiveWhysQualityRubric } from './five-whys.schema';
import { BMCQualityRubric } from './bmc.schema';

export function getModuleQualityCriteria(moduleId: string): QualityCriterion[] {
  // Start with universal criteria
  const criteria = [...UNIVERSAL_QUALITY_CRITERIA];
  
  // Add module-specific criteria
  switch (moduleId) {
    case 'pestle':
      // Convert rubric to criteria format
      criteria.push({
        id: 'pestle_specificity',
        name: 'PESTLE Specificity',
        description: PESTLEQualityRubric.specificity.description,
        weight: 0.2,
        rubric: {
          score1to3: PESTLEQualityRubric.specificity.scoring.poor,
          score4to6: PESTLEQualityRubric.specificity.scoring.average,
          score7to8: PESTLEQualityRubric.specificity.scoring.good,
          score9to10: PESTLEQualityRubric.specificity.scoring.excellent,
        },
        redFlags: ['Generic analysis', 'Missing business name in factors'],
      });
      break;
      
    case 'porters':
      criteria.push({
        id: 'porters_pestle_integration',
        name: 'PESTLE Integration',
        description: PortersQualityRubric.pestleIntegration.description,
        weight: 0.2,
        rubric: {
          score1to3: PortersQualityRubric.pestleIntegration.scoring.poor,
          score4to6: PortersQualityRubric.pestleIntegration.scoring.average,
          score7to8: PortersQualityRubric.pestleIntegration.scoring.good,
          score9to10: PortersQualityRubric.pestleIntegration.scoring.excellent,
        },
        redFlags: ['No PESTLE references', 'Forces analyzed in isolation'],
      });
      break;
      
    case 'swot':
      criteria.push({
        id: 'swot_ot_traceability',
        name: 'O/T Traceability',
        description: SWOTQualityRubric.otTraceability.description,
        weight: 0.2,
        rubric: {
          score1to3: SWOTQualityRubric.otTraceability.scoring.poor,
          score4to6: SWOTQualityRubric.otTraceability.scoring.average,
          score7to8: SWOTQualityRubric.otTraceability.scoring.good,
          score9to10: SWOTQualityRubric.otTraceability.scoring.excellent,
        },
        redFlags: ['O/T not traced to PESTLE/Porter\'s', 'Generic O/T statements'],
      });
      break;
      
    case 'five_whys':
      criteria.push({
        id: 'five_whys_business_focus',
        name: 'Business Focus',
        description: FiveWhysQualityRubric.businessFocus.description,
        weight: 0.2,
        rubric: {
          score1to3: FiveWhysQualityRubric.businessFocus.scoring.poor,
          score4to6: FiveWhysQualityRubric.businessFocus.scoring.average,
          score7to8: FiveWhysQualityRubric.businessFocus.scoring.good,
          score9to10: FiveWhysQualityRubric.businessFocus.scoring.excellent,
        },
        redFlags: ['Drifts into life philosophy', 'Generic success factors'],
      });
      break;
      
    case 'bmc':
      criteria.push({
        id: 'bmc_five_whys_integration',
        name: 'Five Whys Integration',
        description: BMCQualityRubric.fiveWhysIntegration.description,
        weight: 0.2,
        rubric: {
          score1to3: BMCQualityRubric.fiveWhysIntegration.scoring.poor,
          score4to6: BMCQualityRubric.fiveWhysIntegration.scoring.average,
          score7to8: BMCQualityRubric.fiveWhysIntegration.scoring.good,
          score9to10: BMCQualityRubric.fiveWhysIntegration.scoring.excellent,
        },
        redFlags: ['Canvas ignores Five Whys assumptions', 'No assumption addressing'],
      });
      break;
  }
  
  return criteria;
}
