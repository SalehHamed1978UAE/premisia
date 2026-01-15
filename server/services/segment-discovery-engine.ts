import Anthropic from '@anthropic-ai/sdk';

export interface GeneLibrary {
  dimensions: {
    industry_vertical: string[];
    company_size: string[];
    decision_maker: string[];
    purchase_trigger: string[];
    tech_adoption: string[];
    buying_process: string[];
    budget_authority: string[];
    urgency_profile: string[];
  };
}

export interface Genome {
  id: string;
  genes: {
    industry_vertical: string;
    company_size: string;
    decision_maker: string;
    purchase_trigger: string;
    tech_adoption: string;
    buying_process: string;
    budget_authority: string;
    urgency_profile: string;
  };
  fitness: {
    painIntensity: number;
    accessToDecisionMaker: number;
    purchasePowerMatch: number;
    competitionSaturation: number;
    productFit: number;
    urgencyAlignment: number;
    scalePotential: number;
    gtmEfficiency: number;
    totalScore: number;
  };
  narrativeReason: string;
}

export interface SegmentSynthesis {
  beachhead: {
    genome: Genome;
    rationale: string;
    validationPlan: string[];
  };
  backupSegments: Genome[];
  neverList: {
    genome: Genome;
    reason: string;
  }[];
  strategicInsights: string[];
}

export interface DiscoveryContext {
  offeringDescription: string;
  offeringType: string;
  stage: string;
  gtmConstraint: string;
  salesMotion: string;
  existingHypothesis?: string;
}

export class SegmentDiscoveryEngine {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  async generateGeneLibrary(context: DiscoveryContext): Promise<GeneLibrary> {
    const prompt = `You are a market segmentation expert. Generate a comprehensive gene library for segment discovery.

OFFERING CONTEXT:
- Description: ${context.offeringDescription}
- Type: ${context.offeringType}
- Stage: ${context.stage}
- GTM Constraint: ${context.gtmConstraint}
- Sales Motion: ${context.salesMotion}
${context.existingHypothesis ? `- Existing Hypothesis: ${context.existingHypothesis}` : ''}

Generate 5-10 specific, relevant alleles for each of the 8 dimensions below. Make them SPECIFIC to this offering, not generic.

DIMENSIONS TO POPULATE:
1. industry_vertical - Specific industries where this offering could succeed
2. company_size - Company sizes that match the offering (Solo/SMB/Mid-market/Enterprise/etc)
3. decision_maker - Specific roles who would buy this (be specific: VP Engineering, Head of Growth, etc)
4. purchase_trigger - Events that trigger a purchase (pain events, growth mandates, budget cycles, etc)
5. tech_adoption - Technology adoption profiles (Innovator, Early adopter, Pragmatist, Laggard)
6. buying_process - How they buy (Self-serve, Team decision, Procurement, etc)
7. budget_authority - Who controls the budget (Personal card, Team budget, Dept budget, C-suite approval)
8. urgency_profile - How urgent is their need (Burning platform, Active search, Nice to have, Exploring)

REQUIREMENTS:
- Each dimension should have 5-10 alleles
- Alleles should be SPECIFIC to this offering context
- Include both obvious and non-obvious segments
- Consider the GTM constraints when generating alleles

Return ONLY valid JSON with this structure:
{
  "dimensions": {
    "industry_vertical": ["Industry 1", "Industry 2", ...],
    "company_size": ["Size 1", "Size 2", ...],
    "decision_maker": ["Role 1", "Role 2", ...],
    "purchase_trigger": ["Trigger 1", "Trigger 2", ...],
    "tech_adoption": ["Profile 1", "Profile 2", ...],
    "buying_process": ["Process 1", "Process 2", ...],
    "budget_authority": ["Authority 1", "Authority 2", ...],
    "urgency_profile": ["Profile 1", "Profile 2", ...]
  }
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      return JSON.parse(jsonMatch[0]) as GeneLibrary;
    } catch (error) {
      console.error('[SegmentDiscoveryEngine] Error generating gene library:', error);
      throw error;
    }
  }

  async generateGenomes(geneLibrary: GeneLibrary, context: DiscoveryContext, count: number = 100): Promise<Genome[]> {
    // Split into 4 parallel batches for faster generation
    const batchSize = Math.ceil(count / 4);
    const batchCount = 4;
    
    const batchPromises = Array.from({ length: batchCount }, (_, batchIndex) => 
      this.generateGenomeBatch(geneLibrary, context, batchSize, batchIndex)
    );

    console.log(`[SegmentDiscoveryEngine] Starting ${batchCount} parallel genome batches of ${batchSize} each`);
    const batchResults = await Promise.all(batchPromises);
    
    // Flatten and deduplicate using canonical hash (sorted keys)
    const allGenomes = batchResults.flat();
    const seen = new Set<string>();
    const uniqueGenomes: Genome[] = [];
    
    for (const genome of allGenomes) {
      // Canonical hash with sorted keys for reliable deduplication
      const hash = this.getCanonicalGenomeHash(genome.genes);
      if (!seen.has(hash)) {
        seen.add(hash);
        uniqueGenomes.push({
          ...genome,
          id: `genome_${String(uniqueGenomes.length + 1).padStart(3, '0')}`,
        });
      }
    }

    console.log(`[SegmentDiscoveryEngine] Generated ${uniqueGenomes.length} unique genomes (${allGenomes.length - uniqueGenomes.length} duplicates removed)`);
    
    // Ensure we have at least 'count' genomes (or as many as we could generate)
    if (uniqueGenomes.length < count) {
      console.log(`[SegmentDiscoveryEngine] Warning: Only ${uniqueGenomes.length} unique genomes available (requested ${count})`);
    }
    
    return uniqueGenomes.slice(0, count);
  }

  private getCanonicalGenomeHash(genes: Genome['genes']): string {
    // Create canonical hash with explicit key ordering
    const orderedKeys: (keyof Genome['genes'])[] = [
      'industry_vertical',
      'company_size', 
      'decision_maker',
      'purchase_trigger',
      'tech_adoption',
      'buying_process',
      'budget_authority',
      'urgency_profile'
    ];
    return orderedKeys.map(key => genes[key]).join('|');
  }

  private async generateGenomeBatch(
    geneLibrary: GeneLibrary, 
    context: DiscoveryContext, 
    count: number, 
    batchIndex: number
  ): Promise<Genome[]> {
    const focusAreas = [
      'high-potential obvious segments that are most likely to succeed',
      'non-obvious but promising niche segments with unique opportunities',
      'edge cases and challenging segments to stress-test assumptions',
      'diverse combinations exploring the full gene space'
    ];

    const prompt = `You are a market strategist creating segment combinations for discovery.

OFFERING CONTEXT:
- Description: ${context.offeringDescription}
- Type: ${context.offeringType}
- Stage: ${context.stage}
- GTM Constraint: ${context.gtmConstraint}
- Sales Motion: ${context.salesMotion}

GENE LIBRARY (available alleles for each dimension):
${JSON.stringify(geneLibrary.dimensions, null, 2)}

YOUR FOCUS: Generate ${count} unique segment combinations focusing on ${focusAreas[batchIndex]}.

BATCH ID: ${batchIndex + 1} of 4 - Use IDs starting with genome_${String(batchIndex * count + 1).padStart(3, '0')}.

REQUIREMENTS:
- Create STRATEGICALLY interesting combinations for your focus area
- Each genome is a specific combination of one allele from each dimension
- Consider which combinations make logical sense together
- Ensure variety within your focus area

Return ONLY valid JSON array with exactly ${count} genomes:
[
  {
    "id": "genome_${String(batchIndex * count + 1).padStart(3, '0')}",
    "genes": {
      "industry_vertical": "one allele from the library",
      "company_size": "one allele from the library",
      "decision_maker": "one allele from the library",
      "purchase_trigger": "one allele from the library",
      "tech_adoption": "one allele from the library",
      "buying_process": "one allele from the library",
      "budget_authority": "one allele from the library",
      "urgency_profile": "one allele from the library"
    }
  },
  ...
]`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const genomes = JSON.parse(jsonMatch[0]) as Array<{ id: string; genes: Genome['genes'] }>;
      
      return genomes.map((g, idx) => ({
        id: g.id || `genome_${String(batchIndex * count + idx + 1).padStart(3, '0')}`,
        genes: g.genes,
        fitness: {
          painIntensity: 0,
          accessToDecisionMaker: 0,
          purchasePowerMatch: 0,
          competitionSaturation: 0,
          productFit: 0,
          urgencyAlignment: 0,
          scalePotential: 0,
          gtmEfficiency: 0,
          totalScore: 0,
        },
        narrativeReason: '',
      }));
    } catch (error) {
      console.error(`[SegmentDiscoveryEngine] Error generating genome batch ${batchIndex}:`, error);
      throw error;
    }
  }

  async scoreGenomes(genomes: Genome[], context: DiscoveryContext): Promise<Genome[]> {
    const batchSize = 25;
    const batches: Genome[][] = [];

    for (let i = 0; i < genomes.length; i += batchSize) {
      batches.push(genomes.slice(i, i + batchSize));
    }

    // Run all batches in parallel for much faster scoring
    const scoredBatches = await Promise.all(
      batches.map(batch => this.scoreBatch(batch, context))
    );

    const scoredGenomes = scoredBatches.flat();
    return scoredGenomes.sort((a, b) => b.fitness.totalScore - a.fitness.totalScore);
  }

  private async scoreBatch(genomes: Genome[], context: DiscoveryContext): Promise<Genome[]> {
    const prompt = `You are a rigorous market analyst scoring segment viability.

OFFERING CONTEXT:
- Description: ${context.offeringDescription}
- Type: ${context.offeringType}
- Stage: ${context.stage}
- GTM Constraint: ${context.gtmConstraint}
- Sales Motion: ${context.salesMotion}

GENOMES TO SCORE:
${JSON.stringify(genomes.map(g => ({ id: g.id, genes: g.genes })), null, 2)}

Score each genome on these 8 criteria (1-5 scale each, 40 points max total):

1. painIntensity (1-5): How intense is the pain this segment experiences?
2. accessToDecisionMaker (1-5): How easy is it to reach the decision maker?
3. purchasePowerMatch (1-5): Does their budget match your pricing?
4. competitionSaturation (1-5): How uncrowded is this segment? (5 = very uncrowded/good)
5. productFit (1-5): How well does your offering fit their needs?
6. urgencyAlignment (1-5): How urgent is their need?
7. scalePotential (1-5): Can you scale in this segment?
8. gtmEfficiency (1-5): Can you efficiently reach this segment given your constraints?

SCORING RULES:
- Be RIGOROUS and DIFFERENTIATED - don't give everything 3s and 4s
- Use the full 1-5 range
- Consider the stage and GTM constraints when scoring
- Provide a brief narrative reason explaining the score

Return ONLY valid JSON array:
[
  {
    "id": "genome_001",
    "fitness": {
      "painIntensity": 4,
      "accessToDecisionMaker": 3,
      "purchasePowerMatch": 5,
      "competitionSaturation": 2,
      "productFit": 4,
      "urgencyAlignment": 3,
      "scalePotential": 4,
      "gtmEfficiency": 3,
      "totalScore": 28
    },
    "narrativeReason": "Brief explanation of why this segment scores this way"
  },
  ...
]`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const scores = JSON.parse(jsonMatch[0]) as Array<{
        id: string;
        fitness: Genome['fitness'];
        narrativeReason: string;
      }>;

      const scoreMap = new Map(scores.map(s => [s.id, s]));

      return genomes.map(genome => {
        const score = scoreMap.get(genome.id);
        if (score) {
          const fitness = score.fitness;
          fitness.totalScore = 
            fitness.painIntensity +
            fitness.accessToDecisionMaker +
            fitness.purchasePowerMatch +
            fitness.competitionSaturation +
            fitness.productFit +
            fitness.urgencyAlignment +
            fitness.scalePotential +
            fitness.gtmEfficiency;
          
          return {
            ...genome,
            fitness,
            narrativeReason: score.narrativeReason,
          };
        }
        return genome;
      });
    } catch (error) {
      console.error('[SegmentDiscoveryEngine] Error scoring batch:', error);
      throw error;
    }
  }

  async stressTest(topGenomes: Genome[]): Promise<Genome[]> {
    const prompt = `You are a critical market strategist stress-testing segment candidates.

TOP SEGMENT CANDIDATES:
${JSON.stringify(topGenomes.map(g => ({
  id: g.id,
  genes: g.genes,
  totalScore: g.fitness.totalScore,
  narrativeReason: g.narrativeReason,
})), null, 2)}

For each segment, perform ADVERSARIAL TESTING:

1. Identify potential weaknesses or blind spots
2. Challenge the assumptions behind the scoring
3. Consider what could go wrong
4. Adjust scores if the stress test reveals issues
5. Add stress test findings to the narrative

Return ONLY valid JSON array with updated genomes:
[
  {
    "id": "genome_001",
    "fitness": {
      "painIntensity": 4,
      "accessToDecisionMaker": 3,
      "purchasePowerMatch": 5,
      "competitionSaturation": 2,
      "productFit": 4,
      "urgencyAlignment": 3,
      "scalePotential": 3,
      "gtmEfficiency": 3,
      "totalScore": 27
    },
    "narrativeReason": "Original narrative + STRESS TEST: Key risks identified...",
    "stressTestFindings": ["Finding 1", "Finding 2"]
  },
  ...
]`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const testedGenomes = JSON.parse(jsonMatch[0]) as Array<{
        id: string;
        fitness: Genome['fitness'];
        narrativeReason: string;
        stressTestFindings?: string[];
      }>;

      const testedMap = new Map(testedGenomes.map(g => [g.id, g]));

      return topGenomes.map(genome => {
        const tested = testedMap.get(genome.id);
        if (tested) {
          const fitness = tested.fitness;
          fitness.totalScore = 
            fitness.painIntensity +
            fitness.accessToDecisionMaker +
            fitness.purchasePowerMatch +
            fitness.competitionSaturation +
            fitness.productFit +
            fitness.urgencyAlignment +
            fitness.scalePotential +
            fitness.gtmEfficiency;

          return {
            ...genome,
            genes: genome.genes,
            fitness,
            narrativeReason: tested.narrativeReason,
          };
        }
        return genome;
      }).sort((a, b) => b.fitness.totalScore - a.fitness.totalScore);
    } catch (error) {
      console.error('[SegmentDiscoveryEngine] Error in stress test:', error);
      return topGenomes;
    }
  }

  async synthesize(genomes: Genome[], context: DiscoveryContext): Promise<SegmentSynthesis> {
    const top10 = genomes.slice(0, 10);
    const bottom5 = genomes.slice(-5);

    const prompt = `You are a strategic advisor synthesizing segment discovery findings.

OFFERING CONTEXT:
- Description: ${context.offeringDescription}
- Type: ${context.offeringType}
- Stage: ${context.stage}
- GTM Constraint: ${context.gtmConstraint}
- Sales Motion: ${context.salesMotion}

TOP 10 SEGMENTS (sorted by score):
${JSON.stringify(top10.map(g => ({
  id: g.id,
  genes: g.genes,
  totalScore: g.fitness.totalScore,
  fitness: g.fitness,
  narrativeReason: g.narrativeReason,
})), null, 2)}

BOTTOM 5 SEGMENTS (for never list consideration):
${JSON.stringify(bottom5.map(g => ({
  id: g.id,
  genes: g.genes,
  totalScore: g.fitness.totalScore,
  narrativeReason: g.narrativeReason,
})), null, 2)}

SYNTHESIS TASK:
1. Select the BEACHHEAD segment - your #1 recommendation with clear rationale
2. Provide a concrete validation plan (3-5 specific actions)
3. Select 2-3 BACKUP segments
4. Identify 2-3 segments for the NEVER LIST with reasons
5. Generate 3-5 strategic insights from this analysis

Return ONLY valid JSON:
{
  "beachhead": {
    "genomeId": "genome_xxx",
    "rationale": "Why this is the best beachhead segment...",
    "validationPlan": [
      "Specific action 1",
      "Specific action 2",
      "Specific action 3"
    ]
  },
  "backupSegmentIds": ["genome_xxx", "genome_yyy"],
  "neverList": [
    {
      "genomeId": "genome_zzz",
      "reason": "Why to avoid this segment..."
    }
  ],
  "strategicInsights": [
    "Insight 1 about the overall segment landscape",
    "Insight 2 about patterns observed",
    "Insight 3 about go-to-market implications"
  ]
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const result = JSON.parse(jsonMatch[0]) as {
        beachhead: {
          genomeId: string;
          rationale: string;
          validationPlan: string[];
        };
        backupSegmentIds: string[];
        neverList: Array<{ genomeId: string; reason: string }>;
        strategicInsights: string[];
      };

      const genomeMap = new Map(genomes.map(g => [g.id, g]));

      const beachheadGenome = genomeMap.get(result.beachhead.genomeId) || top10[0];
      const backupGenomes = result.backupSegmentIds
        .map(id => genomeMap.get(id))
        .filter((g): g is Genome => g !== undefined);
      
      const neverListItems = result.neverList.map(item => ({
        genome: genomeMap.get(item.genomeId) || bottom5[0],
        reason: item.reason,
      }));

      return {
        beachhead: {
          genome: beachheadGenome,
          rationale: result.beachhead.rationale,
          validationPlan: result.beachhead.validationPlan,
        },
        backupSegments: backupGenomes.length > 0 ? backupGenomes : top10.slice(1, 4),
        neverList: neverListItems,
        strategicInsights: result.strategicInsights,
      };
    } catch (error) {
      console.error('[SegmentDiscoveryEngine] Error in synthesis:', error);
      throw error;
    }
  }

  async runDiscovery(
    context: DiscoveryContext,
    onProgress: (step: string, progress: number) => void
  ): Promise<{
    geneLibrary: GeneLibrary;
    genomes: Genome[];
    synthesis: SegmentSynthesis;
  }> {
    console.log('[SegmentDiscoveryEngine] Starting discovery for:', context.offeringType);

    onProgress('Generating gene library', 10);
    const geneLibrary = await this.generateGeneLibrary(context);
    console.log('[SegmentDiscoveryEngine] Gene library generated:', Object.keys(geneLibrary.dimensions).length, 'dimensions');

    onProgress('Creating segment combinations', 30);
    const genomes = await this.generateGenomes(geneLibrary, context, 100);
    console.log('[SegmentDiscoveryEngine] Generated', genomes.length, 'genomes');

    onProgress('Scoring segments', 50);
    const scoredGenomes = await this.scoreGenomes(genomes, context);
    console.log('[SegmentDiscoveryEngine] Scored genomes, top score:', scoredGenomes[0]?.fitness.totalScore);

    onProgress('Stress testing top candidates', 70);
    const top20 = scoredGenomes.slice(0, 20);
    const testedGenomes = await this.stressTest(top20);
    console.log('[SegmentDiscoveryEngine] Stress tested top 20');

    // Merge stress-tested genomes with remaining scored genomes
    const finalGenomes = [
      ...testedGenomes,
      ...scoredGenomes.slice(20),
    ];

    onProgress('Synthesizing recommendations', 90);
    // Synthesize using stress-tested data for consistent rationales
    const synthesis = await this.synthesize(finalGenomes, context);
    console.log('[SegmentDiscoveryEngine] Synthesis complete, beachhead:', synthesis.beachhead.genome.id);

    onProgress('Complete', 100);

    return {
      geneLibrary,
      genomes: finalGenomes,
      synthesis,
    };
  }
}

export const segmentDiscoveryEngine = new SegmentDiscoveryEngine();
