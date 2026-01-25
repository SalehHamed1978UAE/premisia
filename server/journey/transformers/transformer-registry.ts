/**
 * Transformer Registry - Converts between module output types
 * When Module A outputs type X and Module B expects type Y,
 * find and apply the appropriate transformer
 */

export interface Transformer {
  sourceType: string;
  targetType: string;
  name: string;
  transform: (source: any, context?: any) => any;
}

const bmcToSwotTransformer: Transformer = {
  sourceType: 'bmc_output',
  targetType: 'swot_input',
  name: 'BMC → SWOT Input',
  transform: (bmc: any) => ({
    businessContext: `Value Props: ${bmc.valuePropositions?.join(', ')}. ` +
      `Segments: ${bmc.customerSegments?.join(', ')}. ` +
      `Key Resources: ${bmc.keyResources?.join(', ')}`,
    bmcOutput: bmc,
  }),
};

const bmcToAnsoffTransformer: Transformer = {
  sourceType: 'bmc_output',
  targetType: 'ansoff_input',
  name: 'BMC → Ansoff Input',
  transform: (bmc: any) => ({
    businessContext: `Business with ${bmc.valuePropositions?.length || 0} value propositions`,
    currentProducts: bmc.valuePropositions || [],
    currentMarkets: bmc.customerSegments || [],
  }),
};

const bmcToTextTransformer: Transformer = {
  sourceType: 'bmc_output',
  targetType: 'business_context',
  name: 'BMC → Text Context',
  transform: (bmc: any) => ({
    description: `Value Propositions: ${bmc.valuePropositions?.join(', ')}. ` +
      `Customer Segments: ${bmc.customerSegments?.join(', ')}. ` +
      `Channels: ${bmc.channels?.join(', ')}. ` +
      `Revenue Streams: ${bmc.revenueStreams?.join(', ')}.`,
  }),
};

const swotToAnsoffTransformer: Transformer = {
  sourceType: 'swot_output',
  targetType: 'ansoff_input',
  name: 'SWOT → Ansoff Input',
  transform: (swot: any) => ({
    businessContext: `Strengths: ${swot.strengths?.map((s: any) => s.factor || s).join(', ')}. ` +
      `Opportunities: ${swot.opportunities?.map((o: any) => o.factor || o).join(', ')}`,
    swotOutput: swot,
  }),
};

const swotToStrategyTransformer: Transformer = {
  sourceType: 'swot_output',
  targetType: 'strategy_context',
  name: 'SWOT → Strategy Context',
  transform: (swot: any) => ({
    strengths: swot.strengths?.map((s: any) => s.factor || s) || [],
    weaknesses: swot.weaknesses?.map((w: any) => w.factor || w) || [],
    opportunities: swot.opportunities?.map((o: any) => o.factor || o) || [],
    threats: swot.threats?.map((t: any) => t.factor || t) || [],
    strategicOptions: swot.strategicOptions || {},
  }),
};

const swotToTextTransformer: Transformer = {
  sourceType: 'swot_output',
  targetType: 'business_context',
  name: 'SWOT → Text Context',
  transform: (swot: any) => ({
    description: `Strengths: ${swot.strengths?.map((s: any) => s.factor || s).join(', ')}. ` +
      `Weaknesses: ${swot.weaknesses?.map((w: any) => w.factor || w).join(', ')}. ` +
      `Opportunities: ${swot.opportunities?.map((o: any) => o.factor || o).join(', ')}. ` +
      `Threats: ${swot.threats?.map((t: any) => t.factor || t).join(', ')}.`,
  }),
};

const segmentsToJTBDTransformer: Transformer = {
  sourceType: 'segment_output',
  targetType: 'jtbd_input',
  name: 'Segments → JTBD Input',
  transform: (segments: any) => ({
    businessContext: `Target segments: ${segments.segments?.map((s: any) => s.name).join(', ')}`,
    targetSegments: segments.segments,
  }),
};

const segmentsToTextTransformer: Transformer = {
  sourceType: 'segment_output',
  targetType: 'business_context',
  name: 'Segments → Text Context',
  transform: (segments: any) => ({
    description: `Target customer segments: ${segments.segments?.map((s: any) => 
      `${s.name} (${s.description || 'No description'})`).join('; ')}`,
  }),
};

const portersToSwotTransformer: Transformer = {
  sourceType: 'porters_output',
  targetType: 'swot_input',
  name: "Porter's → SWOT Input",
  transform: (porters: any) => ({
    businessContext: `Industry analysis shows competitive rivalry is ${porters.competitiveRivalry?.intensity || 'unknown'}`,
    portersOutput: porters,
  }),
};

const portersToTextTransformer: Transformer = {
  sourceType: 'porters_output',
  targetType: 'business_context',
  name: "Porter's → Text Context",
  transform: (porters: any) => ({
    description: `Competitive landscape: Rivalry (${porters.competitiveRivalry?.intensity || 'N/A'}), ` +
      `Supplier Power (${porters.supplierPower?.intensity || 'N/A'}), ` +
      `Buyer Power (${porters.buyerPower?.intensity || 'N/A'}), ` +
      `Substitutes (${porters.threatOfSubstitution?.intensity || 'N/A'}), ` +
      `New Entrants (${porters.threatOfNewEntry?.intensity || 'N/A'})`,
  }),
};

const pestleToSwotTransformer: Transformer = {
  sourceType: 'pestle_output',
  targetType: 'swot_input',
  name: 'PESTLE → SWOT Input',
  transform: (pestle: any) => ({
    businessContext: `Macro environment: ${pestle.summary?.keyOpportunities?.join(', ') || 'Various factors identified'}`,
    pestleOutput: pestle,
  }),
};

const pestleToTextTransformer: Transformer = {
  sourceType: 'pestle_output',
  targetType: 'business_context',
  name: 'PESTLE → Text Context',
  transform: (pestle: any) => ({
    description: `Macro environment factors: Political (${pestle.political?.length || 0} factors), ` +
      `Economic (${pestle.economic?.length || 0} factors), Social (${pestle.social?.length || 0} factors), ` +
      `Technological (${pestle.technological?.length || 0} factors), Legal (${pestle.legal?.length || 0} factors), ` +
      `Environmental (${pestle.environmental?.length || 0} factors)`,
  }),
};

const ansoffToTextTransformer: Transformer = {
  sourceType: 'ansoff_output',
  targetType: 'business_context',
  name: 'Ansoff → Text Context',
  transform: (ansoff: any) => ({
    description: `Growth strategy recommendation: ${ansoff.recommendation?.primaryStrategy || 'Not specified'}. ` +
      `Market Penetration score: ${ansoff.marketPenetration?.score || 'N/A'}, ` +
      `Market Development score: ${ansoff.marketDevelopment?.score || 'N/A'}, ` +
      `Product Development score: ${ansoff.productDevelopment?.score || 'N/A'}, ` +
      `Diversification score: ${ansoff.diversification?.score || 'N/A'}`,
  }),
};

const jtbdToTextTransformer: Transformer = {
  sourceType: 'jtbd_output',
  targetType: 'business_context',
  name: 'JTBD → Text Context',
  transform: (jtbd: any) => ({
    description: `Core jobs to be done: ${jtbd.coreJobs?.map((j: any) => j.job || j).join(', ')}. ` +
      `Key opportunities: ${jtbd.opportunities?.topOpportunities?.join(', ') || 'Not specified'}`,
  }),
};

const TRANSFORMERS: Record<string, Record<string, Transformer>> = {
  'bmc_output': {
    'swot_input': bmcToSwotTransformer,
    'ansoff_input': bmcToAnsoffTransformer,
    'business_context': bmcToTextTransformer,
  },
  'swot_output': {
    'ansoff_input': swotToAnsoffTransformer,
    'strategy_context': swotToStrategyTransformer,
    'business_context': swotToTextTransformer,
  },
  'segment_output': {
    'jtbd_input': segmentsToJTBDTransformer,
    'business_context': segmentsToTextTransformer,
  },
  'porters_output': {
    'swot_input': portersToSwotTransformer,
    'business_context': portersToTextTransformer,
  },
  'pestle_output': {
    'swot_input': pestleToSwotTransformer,
    'business_context': pestleToTextTransformer,
  },
  'ansoff_output': {
    'business_context': ansoffToTextTransformer,
  },
  'jtbd_output': {
    'business_context': jtbdToTextTransformer,
  },
};

export function getTransformer(sourceType: string, targetType: string): Transformer | null {
  if (sourceType === targetType) return null;

  if (TRANSFORMERS[sourceType]?.[targetType]) {
    return TRANSFORMERS[sourceType][targetType];
  }

  if (TRANSFORMERS[sourceType]?.['business_context']) {
    console.log(`[Transformer] No direct path ${sourceType} → ${targetType}, using text fallback`);
    return TRANSFORMERS[sourceType]['business_context'];
  }

  return null;
}

export function transformData(
  data: any,
  sourceType: string,
  targetType: string,
  context?: any
): any {
  const transformer = getTransformer(sourceType, targetType);

  if (!transformer) {
    return data;
  }

  console.log(`[Transformer] Applying: ${transformer.name}`);
  return transformer.transform(data, context);
}

export function canTransform(sourceType: string, targetType: string): boolean {
  if (sourceType === targetType) return true;
  return getTransformer(sourceType, targetType) !== null;
}

export function listAvailableTransformations(): Array<{ from: string; to: string; name: string }> {
  const transformations: Array<{ from: string; to: string; name: string }> = [];
  
  for (const [source, targets] of Object.entries(TRANSFORMERS)) {
    for (const [target, transformer] of Object.entries(targets)) {
      transformations.push({
        from: source,
        to: target,
        name: transformer.name,
      });
    }
  }
  
  return transformations;
}
