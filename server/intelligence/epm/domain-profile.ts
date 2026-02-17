import type { DomainCode, DomainProfile } from '../types';

interface DomainDefinition {
  code: DomainCode;
  industryLabel: string;
  signals: string[];
  preferredLexicon: string[];
  forbiddenLexicon: string[];
  regulatoryContext: string[];
}

const DOMAIN_DEFINITIONS: DomainDefinition[] = [
  {
    code: 'banking_fintech',
    industryLabel: 'Banking & Financial Services',
    signals: [
      'bank',
      'banking',
      'fintech',
      'kyc',
      'aml',
      'cbuae',
      'cbb',
      'sama',
      'temenos',
      'finastra',
      'suspicious activity reporting',
      'transaction monitoring',
      'financial crime',
      'data sovereignty',
    ],
    preferredLexicon: [
      'bank',
      'regulated financial institution',
      'kyc/aml controls',
      'transaction monitoring',
      'audit evidence',
      'regulatory compliance',
    ],
    forbiddenLexicon: [
      'food safety',
      'pos systems',
      'restaurant',
      'menu',
      'haccp',
      'technology / saas',
    ],
    regulatoryContext: ['UAE PDPL', 'CBUAE', 'CBB'],
  },
  {
    code: 'healthcare',
    industryLabel: 'Healthcare',
    signals: [
      'hospital',
      'clinical',
      'patient',
      'medical',
      'hipaa',
      'fhir',
      'ehr',
      'diagnosis',
      'pharmacy',
    ],
    preferredLexicon: [
      'patient safety',
      'clinical workflow',
      'care quality',
      'health data privacy',
    ],
    forbiddenLexicon: ['pos systems', 'restaurant', 'menu', 'haccp', 'kyc', 'aml'],
    regulatoryContext: ['HIPAA'],
  },
  {
    code: 'ports_logistics',
    industryLabel: 'Ports, Logistics & Maritime Operations',
    signals: [
      'ad ports',
      'ports group',
      'logistics',
      'maritime',
      'shipping',
      'terminal',
      'cargo',
      'fleet',
      'throughput',
      'bunker',
      'charter',
      'dry dock',
      'cost to serve',
      'yield management',
      'ebitda',
    ],
    preferredLexicon: [
      'operational efficiency',
      'port operations',
      'logistics optimization',
      'fleet reliability',
      'cost-to-serve governance',
      'commercial yield management',
    ],
    forbiddenLexicon: [
      'saas',
      'technology / saas',
      'site reliability engineering',
      'platform reliability',
      'api integration',
      'devops',
      'product roadmap',
    ],
    regulatoryContext: ['Port authority regulations', 'Maritime safety and compliance'],
  },
  {
    code: 'retail_food',
    industryLabel: 'Food & Beverage',
    signals: [
      'restaurant',
      'cafe',
      'coffee',
      'kitchen',
      'food',
      'beverage',
      'dining',
      'haccp',
      'health permit',
    ],
    preferredLexicon: [
      'food safety',
      'kitchen operations',
      'menu engineering',
      'guest experience',
    ],
    forbiddenLexicon: ['kyc', 'aml', 'cbuae', 'core banking'],
    regulatoryContext: ['Food safety and health inspections'],
  },
  {
    code: 'retail_general',
    industryLabel: 'Retail',
    signals: [
      'retail',
      'store',
      'merchandising',
      'inventory',
      'point of sale',
      'pos',
      'fulfillment',
    ],
    preferredLexicon: [
      'store operations',
      'inventory management',
      'customer conversion',
      'omnichannel',
    ],
    forbiddenLexicon: ['kyc', 'aml', 'cbuae', 'hipaa', 'clinical'],
    regulatoryContext: [],
  },
  {
    code: 'saas_technology',
    industryLabel: 'Technology / SaaS',
    signals: [
      'saas',
      'software',
      'platform',
      'api',
      'cloud',
      'product-led',
      'devops',
      'engineering',
    ],
    preferredLexicon: [
      'platform reliability',
      'product roadmap',
      'api integration',
      'release management',
    ],
    forbiddenLexicon: ['food safety', 'restaurant', 'haccp'],
    regulatoryContext: [],
  },
];

const GENERIC_DOMAIN: DomainDefinition = {
  code: 'general',
  industryLabel: 'General Business',
  signals: [],
  preferredLexicon: ['business operations', 'execution plan', 'delivery milestones'],
  forbiddenLexicon: [],
  regulatoryContext: [],
};

const GENERIC_INDUSTRY_PATTERN =
  /\b(technology\s*\/\s*saas|technology|saas|general business|software)\b/i;

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\s/+-]/g, ' ');
}

function inferDomainScore(text: string, definition: DomainDefinition): { score: number; evidence: string[] } {
  let score = 0;
  const evidence: string[] = [];

  for (const signal of definition.signals) {
    const escaped = signal
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+');
    const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    if (re.test(text)) {
      score += signal.length > 5 ? 2 : 1;
      evidence.push(signal);
    }
  }

  return { score, evidence };
}

function mapBusinessTypeBias(businessType?: string): Partial<Record<DomainCode, number>> {
  const type = (businessType || '').toLowerCase();
  if (!type) return {};

  if (type.includes('retail_food') || type.includes('food_beverage')) {
    return { retail_food: 3 };
  }
  if (type.includes('retail')) {
    return { retail_general: 3 };
  }
  if (
    type.includes('ports') ||
    type.includes('logistics') ||
    type.includes('maritime') ||
    type.includes('shipping')
  ) {
    return { ports_logistics: 3 };
  }
  if (type.includes('saas') || type.includes('software')) {
    return { saas_technology: 2 };
  }
  return {};
}

function findDefinition(code: DomainCode): DomainDefinition {
  return DOMAIN_DEFINITIONS.find((d) => d.code === code) || GENERIC_DOMAIN;
}

export function detectDomainProfile(params: {
  sourceText: string;
  businessType?: string;
  industryHint?: string;
}): DomainProfile {
  const text = normalizeText([params.sourceText, params.industryHint].filter(Boolean).join(' '));
  const bias = mapBusinessTypeBias(params.businessType);

  let best: DomainDefinition = GENERIC_DOMAIN;
  let bestScore = 0;
  let bestEvidence: string[] = [];

  for (const definition of DOMAIN_DEFINITIONS) {
    const { score, evidence } = inferDomainScore(text, definition);
    const weighted = score + (bias[definition.code] || 0);
    if (weighted > bestScore) {
      best = definition;
      bestScore = weighted;
      bestEvidence = evidence;
    }
  }

  if (bestScore <= 0) {
    best = GENERIC_DOMAIN;
  }

  const confidence = best.code === 'general'
    ? 0.55
    : Math.min(0.96, 0.62 + bestScore * 0.04);

  return {
    code: best.code,
    industryLabel: best.industryLabel,
    preferredLexicon: best.preferredLexicon,
    forbiddenLexicon: best.forbiddenLexicon,
    regulatoryContext: best.regulatoryContext,
    confidence,
    evidence: bestEvidence.slice(0, 8),
  };
}

export function resolveIndustryLabel(
  existingIndustry: string | undefined,
  profile: DomainProfile
): string {
  const existing = (existingIndustry || '').trim();
  if (!existing) {
    return profile.industryLabel;
  }

  // Keep explicit, domain-specific labels; replace only generic labels.
  if (!GENERIC_INDUSTRY_PATTERN.test(existing)) {
    return existing;
  }

  // For known domains, prefer domain label over generic "Technology / SaaS".
  if (profile.code !== 'general') {
    return profile.industryLabel;
  }

  return existing;
}

export function getDomainForbiddenTerms(profile?: DomainProfile): string[] {
  if (!profile) return [];
  return profile.forbiddenLexicon || [];
}

export function getDomainPreferredTerms(profile?: DomainProfile): string[] {
  if (!profile) return [];
  return profile.preferredLexicon || [];
}

export function isDomainTermForbidden(term: string, profile?: DomainProfile): boolean {
  if (!profile) return false;
  const lower = term.toLowerCase();
  return (profile.forbiddenLexicon || []).some((forbidden) =>
    lower.includes(forbidden.toLowerCase())
  );
}

export function getDomainDefinition(code: DomainCode): DomainProfile {
  const definition = findDefinition(code);
  return {
    code: definition.code,
    industryLabel: definition.industryLabel,
    preferredLexicon: definition.preferredLexicon,
    forbiddenLexicon: definition.forbiddenLexicon,
    regulatoryContext: definition.regulatoryContext,
    confidence: definition.code === 'general' ? 0.55 : 0.8,
    evidence: [],
  };
}
