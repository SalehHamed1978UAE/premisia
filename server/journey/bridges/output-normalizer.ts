/**
 * Output Normalizer - Defensive data extraction for bridge functions
 *
 * Architecture Spec Section 6.2: Universal Rule
 * ALWAYS extract .output, handle both wrapped and direct formats
 *
 * Framework results can come in various shapes:
 * - Direct: { strengths: [...], weaknesses: [...] }
 * - Wrapped: { output: { strengths: [...], weaknesses: [...] } }
 * - Double-wrapped: { data: { output: { strengths: [...] } } }
 */

/**
 * Normalize PESTLE output from various shapes
 */
export function normalizePESTLEOutput(raw: any): any {
  if (!raw) return null;

  // Check for nested output structures
  const data = raw?.data?.output ||
               raw?.data?.pestleResults ||
               raw?.output?.pestleResults ||
               raw?.output ||
               raw?.pestleResults ||
               raw;

  // Validate we have the expected shape
  if (data?.factors || data?.political || data?.economic) {
    return data;
  }

  // Try to extract factors from alternative structures
  const factors = data?.factors || {
    political: data?.political || [],
    economic: data?.economic || [],
    social: data?.social || [],
    technological: data?.technological || [],
    legal: data?.legal || [],
    environmental: data?.environmental || [],
  };

  return {
    ...data,
    factors,
  };
}

/**
 * Normalize Porter's output from various shapes
 */
export function normalizePortersOutput(raw: any): any {
  if (!raw) return null;

  // Check for nested output structures
  const data = raw?.data?.output ||
               raw?.data?.portersResults ||
               raw?.output?.portersResults ||
               raw?.output ||
               raw?.portersResults ||
               raw;

  // Validate we have the expected shape
  if (data?.forces || data?.threatOfNewEntrants || data?.competitiveRivalry) {
    // If forces are at top level, wrap them
    if (data?.threatOfNewEntrants && !data?.forces) {
      return {
        ...data,
        forces: {
          threatOfNewEntrants: data.threatOfNewEntrants,
          supplierPower: data.supplierPower || data.bargainingPowerOfSuppliers,
          buyerPower: data.buyerPower || data.bargainingPowerOfBuyers,
          threatOfSubstitutes: data.threatOfSubstitutes,
          competitiveRivalry: data.competitiveRivalry,
        },
      };
    }
    return data;
  }

  return data;
}

/**
 * Normalize SWOT output from various shapes
 */
export function normalizeSWOTOutput(raw: any): any {
  if (!raw) return null;

  // Check for nested output structures
  const data = raw?.data?.output ||
               raw?.output?.swotResults ||
               raw?.output ||
               raw?.swotResults ||
               raw;

  // Validate we have the expected shape
  if (data?.strengths || data?.weaknesses || data?.opportunities || data?.threats) {
    return {
      strengths: data.strengths || [],
      weaknesses: data.weaknesses || [],
      opportunities: data.opportunities || [],
      threats: data.threats || [],
      strategicOptions: data.strategicOptions || data.crossReference || {},
      priorityActions: data.priorityActions || [],
    };
  }

  return data;
}

/**
 * Normalize BMC output from various shapes
 */
export function normalizeBMCOutput(raw: any): any {
  if (!raw) return null;

  // Check for nested output structures
  const data = raw?.data?.output ||
               raw?.output?.bmcResults ||
               raw?.output ||
               raw?.bmcResults ||
               raw;

  // Validate we have the expected shape
  if (data?.blocks || data?.canvas || data?.customerSegments) {
    return data;
  }

  return data;
}

/**
 * Normalize Five Whys output from various shapes
 */
export function normalizeFiveWhysOutput(raw: any): any {
  if (!raw) return null;

  // Check for nested output structures
  const data = raw?.data?.output ||
               raw?.output?.fiveWhysResults ||
               raw?.output ||
               raw?.fiveWhysResults ||
               raw;

  // Validate we have the expected shape
  if (data?.rootCauses || data?.rootCause || data?.whysPath) {
    return {
      rootCauses: data.rootCauses || (data.rootCause ? [data.rootCause] : []),
      whysPath: data.whysPath || data.selectedPath || [],
      strategicImplications: data.strategicImplications || [],
    };
  }

  return data;
}

/**
 * Generic normalizer that tries to find the actual data in various wrappers
 */
export function normalizeFrameworkOutput(raw: any, frameworkName?: string): any {
  if (!raw) return null;

  // Try common wrapper patterns
  const candidates = [
    raw?.data?.output,
    raw?.output,
    raw?.data,
    raw,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      // Check if this looks like actual data (has more than just wrapper properties)
      const keys = Object.keys(candidate);
      const wrapperKeys = ['data', 'output', 'framework', 'frameworkName', 'status'];
      const dataKeys = keys.filter(k => !wrapperKeys.includes(k));

      if (dataKeys.length > 0) {
        return candidate;
      }
    }
  }

  return raw;
}

export default {
  normalizePESTLEOutput,
  normalizePortersOutput,
  normalizeSWOTOutput,
  normalizeBMCOutput,
  normalizeFiveWhysOutput,
  normalizeFrameworkOutput,
};
