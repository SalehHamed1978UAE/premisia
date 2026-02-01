/**
 * Five Whys → SWOT Bridge
 * 
 * Transforms Five Whys root cause analysis into SWOT framework inputs.
 * 
 * Key transformations:
 * - Root causes → Weaknesses (internal problems identified)
 * - Counter-measures → Potential Strengths (if organization can address)
 * - External root causes → Threats
 * - Opportunities from fixing root causes → Opportunities
 */

import type { StrategicContext } from '@shared/journey-types';

export interface WhysToSwotEnhancement {
  suggestedWeaknesses: Array<{
    name: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
    source: string;
  }>;
  suggestedStrengths: Array<{
    name: string;
    description: string;
    source: string;
  }>;
  suggestedThreats: Array<{
    name: string;
    description: string;
    source: string;
  }>;
  suggestedOpportunities: Array<{
    name: string;
    description: string;
    source: string;
  }>;
  rootCauseContext: string;
  fiveWhysConfidence: string;
}

/**
 * Transform Five Whys output into SWOT context
 */
export function transformWhysToSwot(rawWhysOutput: any, context?: StrategicContext): WhysToSwotEnhancement {
  const whysOutput = normalizeWhysOutput(rawWhysOutput);

  const result: WhysToSwotEnhancement = {
    suggestedWeaknesses: [],
    suggestedStrengths: [],
    suggestedThreats: [],
    suggestedOpportunities: [],
    rootCauseContext: '',
    fiveWhysConfidence: 'medium',
  };

  if (!whysOutput) return result;

  const rootCauses = whysOutput.rootCauses || whysOutput.root_causes || [];
  const counterMeasures = whysOutput.counterMeasures || whysOutput.counter_measures || whysOutput.countermeasures || [];
  const whysPath = whysOutput.whysPath || whysOutput.whys_path || whysOutput.analysis_path || [];

  // Root causes become weaknesses (internal problems identified)
  for (const rc of rootCauses) {
    const cause = typeof rc === 'string' ? rc : (rc.cause || rc.title || rc.name || '');
    const explanation = typeof rc === 'string' ? '' : (rc.explanation || rc.description || '');
    const depth = typeof rc === 'object' ? (rc.depth || 3) : 3;

    if (cause) {
      // Determine if internal or external
      const isExternal = isExternalCause(cause, explanation);

      if (isExternal) {
        result.suggestedThreats.push({
          name: cause,
          description: `External factor identified through root cause analysis: ${explanation}`,
          source: 'Five Whys Analysis',
        });
      } else {
        result.suggestedWeaknesses.push({
          name: cause,
          description: `Root cause identified: ${explanation}`,
          severity: depth >= 4 ? 'high' : depth >= 2 ? 'medium' : 'low',
          source: 'Five Whys Analysis',
        });
      }
    }
  }

  // Counter-measures become potential strengths
  for (const cm of counterMeasures) {
    const action = typeof cm === 'string' ? cm : (cm.action || cm.title || cm.name || '');
    const rationale = typeof cm === 'string' ? '' : (cm.rationale || cm.description || '');

    if (action) {
      result.suggestedStrengths.push({
        name: action,
        description: `Proposed solution capability: ${rationale}`,
        source: 'Five Whys Counter-measures',
      });

      // Each counter-measure also implies an opportunity
      result.suggestedOpportunities.push({
        name: `Implement: ${action}`,
        description: `Opportunity to address root cause and gain competitive advantage`,
        source: 'Five Whys Counter-measures',
      });
    }
  }

  // Build context summary
  result.rootCauseContext = buildRootCauseContext(whysPath, rootCauses);
  result.fiveWhysConfidence = whysOutput.confidence || 'medium';

  console.log(`[Bridge] whys-to-swot: Transformed ${rootCauses.length} root causes → ${result.suggestedWeaknesses.length} weaknesses, ${result.suggestedThreats.length} threats`);

  return result;
}

/**
 * Normalize various Five Whys output formats
 */
function normalizeWhysOutput(raw: any): any {
  if (!raw) return null;

  // Handle wrapped output
  if (raw.data?.output) return raw.data.output;
  if (raw.output) return raw.output;
  if (raw.data) return raw.data;

  return raw;
}

/**
 * Determine if a root cause is external (market, regulatory, competitor) or internal
 */
function isExternalCause(cause: string, explanation: string): boolean {
  const combined = `${cause} ${explanation}`.toLowerCase();
  const externalKeywords = [
    'market', 'competitor', 'regulation', 'government', 'economic', 'industry',
    'external', 'supply chain', 'vendor', 'customer demand', 'technology shift',
    'legislation', 'policy', 'political', 'environmental', 'social trend'
  ];

  return externalKeywords.some(keyword => combined.includes(keyword));
}

/**
 * Build context summary from whys path
 */
function buildRootCauseContext(whysPath: any[], rootCauses: any[]): string {
  const pathSummary = Array.isArray(whysPath) 
    ? whysPath.slice(0, 5).map((w, i) => {
        const text = typeof w === 'string' ? w : (w.why || w.question || w.text || '');
        return `Why ${i + 1}: ${text}`;
      }).join('\n')
    : '';

  const causesSummary = rootCauses.slice(0, 3).map((rc, i) => {
    const cause = typeof rc === 'string' ? rc : (rc.cause || rc.title || '');
    return `${i + 1}. ${cause}`;
  }).join('\n');

  return `Five Whys Analysis Summary:\n${pathSummary}\n\nRoot Causes Identified:\n${causesSummary}`;
}

export default { transformWhysToSwot };
