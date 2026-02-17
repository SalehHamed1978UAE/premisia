import type { DomainCode, Workstream } from '../types';

export type WorkstreamTheme =
  | 'performance'
  | 'integration'
  | 'talent'
  | 'marketing'
  | 'compliance'
  | 'operations'
  | 'general';

export interface ThemeAnalysis {
  theme: WorkstreamTheme;
  score: number;
  runnerUp: number;
}

const THEME_KEYWORDS: Record<Exclude<WorkstreamTheme, 'general'>, string[]> = {
  performance: [
    'performance',
    'scalability',
    'load',
    'latency',
    'throughput',
    'refactor',
    'optimization',
    'benchmark',
    'capacity',
    'reliability',
  ],
  integration: [
    'api',
    'integration',
    'connector',
    'interoperability',
    'interface',
    'sync',
    'workday',
    'sap',
    'adapter',
    'pipeline',
  ],
  talent: [
    'talent',
    'acquisition',
    'enablement',
    'hiring',
    'recruit',
    'onboarding',
    'training',
    'workforce',
    'people',
    'hr',
    'employee',
    'manager',
  ],
  marketing: [
    'market',
    'segmentation',
    'positioning',
    'go-to-market',
    'gtm',
    'campaign',
    'messaging',
    'sales',
    'channel',
    'demand',
    'lead',
  ],
  compliance: [
    'compliance',
    'regulatory',
    'policy',
    'privacy',
    'audit',
    'ethics',
    'governance',
    'soc2',
    'gdpr',
    'control',
    'risk',
  ],
  operations: [
    'operations',
    'release',
    'deployment',
    'stabilization',
    'runbook',
    'support',
    'handoff',
    'monitoring',
    'incident',
    'hardening',
  ],
};

const DECISION_IMPLEMENTATION_PREFIX = /^decision implementation:/i;
const LIFECYCLE_PREFIXES = [
  /^pilot operations hardening/i,
  /^scale readiness/i,
  /^deployment & operational stabilization/i,
];

const CANONICAL_NAMES: Record<Exclude<WorkstreamTheme, 'general'>, string> = {
  performance: 'Performance & Scalability Engineering',
  integration: 'API & Integration Engineering',
  talent: 'Talent Acquisition & Team Enablement',
  marketing: 'Market Positioning & Go-to-Market',
  compliance: 'Regulatory Compliance & Risk Controls',
  operations: 'Operations & Release Management',
};

const DOMAIN_CANONICAL_NAMES: Partial<Record<DomainCode, Partial<Record<Exclude<WorkstreamTheme, 'general'>, string>>>> = {
  ports_logistics: {
    performance: 'Operational Efficiency & Reliability',
    integration: 'Systems Integration & Data Backbone',
    talent: 'Talent & Capability Enablement',
    marketing: 'Market & Commercial Strategy',
    compliance: 'Regulatory Compliance & Risk Controls',
    operations: 'Execution & Operational Governance',
  },
};

function normalize(text: string): string {
  return text.toLowerCase();
}

function scoreTheme(text: string, theme: Exclude<WorkstreamTheme, 'general'>): number {
  const blob = normalize(text);
  return THEME_KEYWORDS[theme].reduce((sum, keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'g');
    const matches = blob.match(re);
    return sum + (matches?.length || 0);
  }, 0);
}

function analyzeText(text: string): ThemeAnalysis {
  const scored = (Object.keys(THEME_KEYWORDS) as Array<Exclude<WorkstreamTheme, 'general'>>)
    .map((theme) => ({ theme, score: scoreTheme(text, theme) }))
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const runnerUp = scored[1]?.score || 0;
  if (!top || top.score <= 0) {
    return { theme: 'general', score: 0, runnerUp: 0 };
  }

  return {
    theme: top.theme,
    score: top.score,
    runnerUp,
  };
}

export function analyzeWorkstreamDeclaredTheme(workstream: Workstream): ThemeAnalysis {
  const text = `${workstream.name || ''} ${workstream.description || ''}`;
  return analyzeText(text);
}

export function analyzeWorkstreamDeliverableTheme(workstream: Workstream): ThemeAnalysis {
  const text = (workstream.deliverables || [])
    .map((deliverable) => `${deliverable.name || ''} ${deliverable.description || ''}`)
    .join(' ');
  return analyzeText(text);
}

export function getCanonicalWorkstreamName(theme: WorkstreamTheme, domainCode?: DomainCode): string | null {
  if (theme === 'general') return null;
  if (domainCode) {
    const domainNames = DOMAIN_CANONICAL_NAMES[domainCode];
    const domainCanonical = domainNames?.[theme as Exclude<WorkstreamTheme, 'general'>];
    if (domainCanonical) return domainCanonical;
  }
  return CANONICAL_NAMES[theme];
}

export function isSemanticRepairCandidate(workstream: Workstream): boolean {
  const name = (workstream.name || '').trim();
  if (!name) return false;
  if (DECISION_IMPLEMENTATION_PREFIX.test(name)) return false;
  if (LIFECYCLE_PREFIXES.some((re) => re.test(name))) return false;
  return true;
}
