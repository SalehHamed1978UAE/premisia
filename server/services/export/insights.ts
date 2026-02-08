import type { FullExportPackage } from '../../types/interfaces';
import {
  normalizeWhysPath,
  normalizeWhysPathForReport,
  pickCanonicalWhysPath,
  pickRootCause,
} from './whys-utils';

type ExportInsights = {
  whysPath?: Array<any>;
  rootCauses?: string[];
  strategicImplications?: string[];
  bmcBlocks?: Record<string, any>;
  bmcContradictions?: any[];
  businessModelGaps?: any[];
};

const BLOCK_TYPE_MAP: Record<string, string> = {
  customer_segments: 'customerSegments',
  value_propositions: 'valuePropositions',
  channels: 'channels',
  customer_relationships: 'customerRelationships',
  revenue_streams: 'revenueStreams',
  key_resources: 'keyResources',
  key_activities: 'keyActivities',
  key_partners: 'keyPartnerships',
  key_partnerships: 'keyPartnerships',
  cost_structure: 'costStructure',
};

const normalizeKey = (value?: string) =>
  (value || '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

const buildBmcBlocksFromList = (blocks: any[]): Record<string, any> => {
  const output: Record<string, any> = {};
  blocks.forEach((block: any) => {
    const typeKey = BLOCK_TYPE_MAP[normalizeKey(block.blockType)] || BLOCK_TYPE_MAP[normalizeKey(block.blockName)];
    if (!typeKey) return;
    const items: string[] = [];
    if (block.description) items.push(block.description);
    if (Array.isArray(block.findings)) {
      block.findings.slice(0, 4).forEach((f: any) => {
        if (typeof f === 'string') items.push(f);
        else if (f.fact) items.push(f.fact);
      });
    }
    if (block.strategicImplications) items.push(block.strategicImplications);
    if (items.length > 0) {
      output[typeKey] = items;
    }
  });
  return output;
};

export const deriveInsights = (pkg: FullExportPackage, parseField: (v: any) => any): ExportInsights => {
  const insights: ExportInsights = {};
  let contextWhysPath: any[] = [];

  const j = pkg.strategy.journeySession;
  if (j?.accumulatedContext) {
    const context = parseField(j.accumulatedContext);
    if (context?.insights && typeof context.insights === 'object') {
      Object.assign(insights, context.insights);
      if (Array.isArray(context.insights.whysPath)) {
        contextWhysPath = context.insights.whysPath;
      }
    }
  }

  const sv = pkg.strategy.strategyVersion as any;
  const analysisData = sv ? parseField(sv.analysisData) : null;

  const five = analysisData?.five_whys || analysisData?.fiveWhys;
  const canonicalWhysPath = pickCanonicalWhysPath([
    pkg.strategy.whysPath,
    contextWhysPath,
    five?.whysPath,
  ]);
  if (canonicalWhysPath.length > 0) {
    insights.whysPath = normalizeWhysPathForReport(canonicalWhysPath);
  } else if (Array.isArray(insights.whysPath)) {
    const normalizedContextPath = normalizeWhysPath(insights.whysPath);
    insights.whysPath = normalizeWhysPathForReport(normalizedContextPath);
  }

  const rootCause = pickRootCause(canonicalWhysPath, [
    ...(Array.isArray(insights.rootCauses) ? insights.rootCauses : []),
    analysisData?.root_cause,
    analysisData?.rootCause,
    five?.root_cause,
    five?.rootCause,
  ]);
  if (rootCause) {
    insights.rootCauses = [rootCause];
  }

  if (five && !insights.strategicImplications && Array.isArray(five.strategic_implications)) {
    insights.strategicImplications = five.strategic_implications;
  }

  const bmc = analysisData?.bmc;
  if (!insights.bmcBlocks && bmc) {
    if (Array.isArray(bmc.blocks)) {
      const blocks = buildBmcBlocksFromList(bmc.blocks);
      if (Object.keys(blocks).length > 0) insights.bmcBlocks = blocks;
    } else if (bmc.blocks && typeof bmc.blocks === 'object') {
      insights.bmcBlocks = bmc.blocks;
    } else if (bmc.customerSegments || bmc.valuePropositions) {
      insights.bmcBlocks = bmc;
    }

    if (!insights.bmcContradictions && Array.isArray(bmc.contradictions)) {
      insights.bmcContradictions = bmc.contradictions;
    }
    if (!insights.businessModelGaps && Array.isArray(bmc.criticalGaps)) {
      insights.businessModelGaps = bmc.criticalGaps;
    }
  }

  return insights;
};
