import Anthropic from '@anthropic-ai/sdk';

const AI_TIMEOUT_MS = 90000; // 90 second timeout for standard AI calls
const AI_TIMEOUT_LONG_MS = 180000; // 180 second timeout for large AI calls (gene library)
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // Start with 1 second backoff

// Helper to wrap promise with timeout
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`AI operation '${operation}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

// Retry with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.log(`[SegmentDiscoveryEngine] ${operation} attempt ${attempt} failed, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
  }
  
  console.error(`[SegmentDiscoveryEngine] ${operation} failed after ${maxRetries} attempts`);
  throw lastError;
}

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
    const prompt = `You are a market segmentation expert specializing in discovering SURPRISING, NON-OBVIOUS customer segments. Your job is to surface segments that founders would never think of on their own.

OFFERING CONTEXT:
- Description: ${context.offeringDescription}
- Type: ${context.offeringType}
- Stage: ${context.stage}
- GTM Constraint: ${context.gtmConstraint}
- Sales Motion: ${context.salesMotion}
${context.existingHypothesis ? `- Existing Hypothesis: ${context.existingHypothesis}` : ''}

Generate a COMPREHENSIVE gene library with 50+ options per dimension. The goal is DIVERSITY and DISCOVERY - push beyond the obvious.

KEY PRINCIPLE: "Who has this problem but nobody's building for them?"

DIMENSIONS TO POPULATE (50+ alleles each):

1. industry_vertical - FORCE DIVERSITY across:
   - Professional services (consulting, legal, accounting)
   - Creative industries (film, music, gaming, art)
   - Industrial/manufacturing (factories, logistics, construction)
   - Agriculture/farming (farms, ranches, agricultural suppliers)
   - Healthcare (hospitals, clinics, caregiving, wellness)
   - Education (schools, tutoring, training, e-learning)
   - Government/public sector (municipalities, agencies)
   - Non-profit/religious (churches, charities, foundations)
   - Consumer services (retail, hospitality, food service)
   - Sports/fitness (gyms, teams, coaches, athletes)
   - Trade/skilled labor (electricians, plumbers, mechanics)
   - Entertainment/media (streamers, podcasters, influencers)
   - Hobbyist communities (collectors, crafters, enthusiasts)
   Include UNUSUAL industries that might have the underlying need.

2. company_size - Full spectrum from individuals to enterprises:
   - Solo practitioners, freelancers, one-person businesses
   - Micro-businesses (2-5 people)
   - Small businesses (6-50)
   - Mid-market (51-500)
   - Enterprise (500+)
   - Also include: community groups, volunteer organizations, family businesses, creator collectives

3. decision_maker - INCLUDE NON-OBVIOUS ROLES:
   Obvious: CEO, CTO, VP Engineering, Head of Marketing, Product Manager
   NON-OBVIOUS (include these!): 
   - Farmers, ranchers, farm managers
   - Game masters, dungeon masters, community moderators
   - Pastors, clergy, religious leaders
   - Coaches (sports, life, business)
   - Tradespeople (electricians, plumbers, contractors)
   - Caregivers, home health aides
   - Teachers, tutors, trainers
   - Artists, musicians, performers
   - Hobbyist leaders, club organizers
   - Parents, family caregivers
   - Volunteers, community organizers
   - Retirees with side projects
   Be SPECIFIC with titles, not generic.

4. purchase_trigger - Events that create urgency:
   - Pain events (failure, loss, crisis)
   - Growth mandates (scaling, expanding)
   - Budget cycles (fiscal year, grants)
   - Life events (new job, new baby, retirement)
   - Seasonal needs (harvest, holidays, tax season)
   - Compliance requirements
   - Competitive pressure
   - Technology shifts

5. tech_adoption - Technology comfort levels:
   - Innovators (bleeding edge)
   - Early adopters (try new things)
   - Pragmatists (proven solutions)
   - Late majority (when others do)
   - Skeptics (only when forced)
   - Tech-resistant but high-need

6. buying_process - How decisions get made:
   - Impulse/immediate (personal card)
   - Self-serve research
   - Peer recommendation required
   - Family/partner approval
   - Team consensus
   - Committee/board approval
   - Procurement process
   - Grant-funded
   - Crowdfunded/community-funded

7. budget_authority - Who controls spending:
   - Personal funds/credit card
   - Household budget
   - Small discretionary budget
   - Department budget
   - C-suite approval
   - Board approval
   - External funding (grants, investors)
   - Community/membership dues

8. urgency_profile - Need intensity:
   - Burning platform (crisis mode)
   - Active search (shopping now)
   - Planning ahead (6-12 months)
   - Nice to have (if budget allows)
   - Exploring options (no timeline)
   - Recurring/seasonal need

MUTATION REQUIREMENT:
For each dimension, include 5-10 "MUTATION" options - roles, industries, or contexts that seem like UNLIKELY or COUNTERINTUITIVE fits at first glance but might have the underlying need. These are often where the best insights come from.

Example mutations:
- A D&D game master who needs project management tools to run campaigns
- A farmer who needs analytics to track crop yields
- A church group that needs team collaboration software
- A hobbyist collector who needs inventory management

REQUIREMENTS:
- Generate 50+ alleles per dimension
- Include obvious segments but PRIORITIZE non-obvious ones
- Force diversity - no dimension should be dominated by one category
- Include the mutation options explicitly
- Think about underserved segments that are overlooked

Return ONLY valid JSON with this structure:
{
  "dimensions": {
    "industry_vertical": ["Industry 1", "Industry 2", ... 50+ options],
    "company_size": ["Size 1", "Size 2", ... 50+ options],
    "decision_maker": ["Role 1", "Role 2", ... 50+ options],
    "purchase_trigger": ["Trigger 1", "Trigger 2", ... 50+ options],
    "tech_adoption": ["Profile 1", "Profile 2", ... 50+ options],
    "buying_process": ["Process 1", "Process 2", ... 50+ options],
    "budget_authority": ["Authority 1", "Authority 2", ... 50+ options],
    "urgency_profile": ["Profile 1", "Profile 2", ... 50+ options]
  }
}`;

    return withRetry(async () => {
      const response = await withTimeout(
        this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 16000,
          messages: [{ role: 'user', content: prompt }],
        }),
        AI_TIMEOUT_LONG_MS, // Longer timeout for large gene library generation
        'generateGeneLibrary'
      );

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const library = JSON.parse(jsonMatch[0]) as GeneLibrary;
      
      // Log dimension counts for debugging
      const counts = Object.entries(library.dimensions).map(([dim, alleles]) => 
        `${dim}: ${alleles.length}`
      ).join(', ');
      console.log(`[SegmentDiscoveryEngine] Gene library dimensions: ${counts}`);
      
      return library;
    }, 'generateGeneLibrary');
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
    
    // Flatten and apply diversity constraints
    const allGenomes = batchResults.flat();
    const seen = new Set<string>();
    const roleCounts = new Map<string, number>();
    const MAX_GENOMES_PER_ROLE = 3;
    const uniqueGenomes: Genome[] = [];
    let duplicatesRemoved = 0;
    let roleConstraintFiltered = 0;
    
    for (const genome of allGenomes) {
      // Canonical hash with sorted keys for reliable deduplication
      const hash = this.getCanonicalGenomeHash(genome.genes);
      if (seen.has(hash)) {
        duplicatesRemoved++;
        continue;
      }
      
      // Diversity constraint: max 3 genomes per decision_maker role
      const role = genome.genes.decision_maker;
      const currentRoleCount = roleCounts.get(role) || 0;
      if (currentRoleCount >= MAX_GENOMES_PER_ROLE) {
        roleConstraintFiltered++;
        continue;
      }
      
      seen.add(hash);
      roleCounts.set(role, currentRoleCount + 1);
      uniqueGenomes.push({
        ...genome,
        id: `genome_${String(uniqueGenomes.length + 1).padStart(3, '0')}`,
      });
    }

    console.log(`[SegmentDiscoveryEngine] Generated ${uniqueGenomes.length} unique genomes (${duplicatesRemoved} duplicates, ${roleConstraintFiltered} filtered by role constraint)`);
    console.log(`[SegmentDiscoveryEngine] Role diversity: ${roleCounts.size} unique decision_maker roles`);
    
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

    return withRetry(async () => {
      const response = await withTimeout(
        this.anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022', // FAST model for batch genome generation
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
        }),
        AI_TIMEOUT_MS,
        `generateGenomeBatch-${batchIndex}`
      );

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
    }, `generateGenomeBatch-${batchIndex}`);
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

  async scoreGenomesWithProgress(
    genomes: Genome[], 
    context: DiscoveryContext,
    onProgress: (step: string, progress: number) => void,
    startTime: number,
    ttfurLogged: boolean,
    setTtfurLogged: (logged: boolean) => void
  ): Promise<Genome[]> {
    const batchSize = 25;
    const batches: Genome[][] = [];

    for (let i = 0; i < genomes.length; i += batchSize) {
      batches.push(genomes.slice(i, i + batchSize));
    }

    const scoredBatches: Genome[][] = [];
    let scoredCount = 0;
    const totalGenomes = genomes.length;

    // Process batches in parallel but emit progress after each completes
    const batchPromises = batches.map((batch, batchIndex) => 
      this.scoreBatch(batch, context).then(result => {
        scoredCount += result.length;
        scoredBatches[batchIndex] = result;
        
        // Emit partial_scores after each batch completes
        const partialData = {
          scored: result.map(g => ({
            id: g.id,
            genes: g.genes,
            score: g.fitness.totalScore,
            narrative: g.narrativeReason
          })),
          progress: `${scoredCount}/${totalGenomes} segments scored`,
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          elapsed: Date.now() - startTime
        };
        
        onProgress('partial_scores:' + JSON.stringify(partialData), Math.round((scoredCount / totalGenomes) * 20) + 50);
        
        // Log TTFUR on first partial event
        if (!ttfurLogged) {
          const ttfur = Date.now() - startTime;
          console.log(`[Performance] TTFUR: ${(ttfur/1000).toFixed(1)}s`);
          setTtfurLogged(true);
        }
        
        return result;
      })
    );

    await Promise.all(batchPromises);

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

    return withRetry(async () => {
      const response = await withTimeout(
        this.anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022', // FAST model for scoring batches
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
        }),
        AI_TIMEOUT_MS,
        'scoreBatch'
      );

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
    }, 'scoreBatch');
  }

  async stressTest(topGenomes: Genome[]): Promise<Genome[]> {
    // Split into 4 parallel batches for faster stress testing
    const batchSize = Math.ceil(topGenomes.length / 4);
    const batches: Genome[][] = [];
    for (let i = 0; i < topGenomes.length; i += batchSize) {
      batches.push(topGenomes.slice(i, i + batchSize));
    }

    console.log(`[SegmentDiscoveryEngine] Starting ${batches.length} parallel stress test batches of ${batchSize} each`);
    
    const batchPromises = batches.map(batch => this.stressTestBatch(batch));
    const batchResults = await Promise.all(batchPromises);
    
    // Flatten and re-sort by score
    const allTested = batchResults.flat();
    return allTested.sort((a, b) => b.fitness.totalScore - a.fitness.totalScore);
  }

  private async stressTestBatch(genomes: Genome[]): Promise<Genome[]> {
    const prompt = `You are a critical market strategist stress-testing segment candidates.

TOP SEGMENT CANDIDATES:
${JSON.stringify(genomes.map(g => ({
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
      return await withRetry(async () => {
        const response = await withTimeout(
          this.anthropic.messages.create({
            model: 'claude-3-5-haiku-20241022', // FAST model for stress testing
            max_tokens: 4000,
            messages: [{ role: 'user', content: prompt }],
          }),
          AI_TIMEOUT_MS,
          'stressTestBatch'
        );

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

        return genomes.map(genome => {
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
        });
      }, 'stressTestBatch');
    } catch (error) {
      console.error('[SegmentDiscoveryEngine] Error in stress test batch (after retries):', error);
      return genomes;
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

    return withRetry(async () => {
      const response = await withTimeout(
        this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
        AI_TIMEOUT_MS,
        'synthesize'
      );

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
    }, 'synthesize');
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
    
    // Timing instrumentation
    const timings: Record<string, number> = {};
    const discoveryStartTime = Date.now();
    let ttfurLogged = false;
    
    const time = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      const start = Date.now();
      const result = await fn();
      timings[name] = Date.now() - start;
      console.log(`[SegmentDiscovery Timing] ${name}: ${timings[name]}ms (${(timings[name]/1000).toFixed(1)}s)`);
      return result;
    };

    // Helper to count unique roles
    const countUniqueRoles = (genomes: Genome[]): number => {
      const roles = new Set(genomes.map(g => g.genes.decision_maker));
      return roles.size;
    };

    onProgress('Generating gene library', 10);
    const geneLibrary = await time('generateGeneLibrary', () => 
      this.generateGeneLibrary(context));
    console.log('[SegmentDiscoveryEngine] Gene library generated:', Object.keys(geneLibrary.dimensions).length, 'dimensions');

    onProgress('Creating segment combinations', 30);
    const genomes = await time('generateGenomes', () => 
      this.generateGenomes(geneLibrary, context, 100));
    console.log('[SegmentDiscoveryEngine] Generated', genomes.length, 'genomes');

    onProgress('Scoring segments', 50);
    const scoredGenomes = await time('scoreGenomes', () => 
      this.scoreGenomesWithProgress(genomes, context, onProgress, discoveryStartTime, ttfurLogged, (logged) => { ttfurLogged = logged; }));
    console.log('[SegmentDiscoveryEngine] Scored genomes, top score:', scoredGenomes[0]?.fitness.totalScore);

    // Emit intermediate_results after scoring completes
    const intermediateData = {
      topGenomes: scoredGenomes.slice(0, 20).map(g => ({
        id: g.id,
        genes: g.genes,
        score: g.fitness.totalScore,
        narrative: g.narrativeReason
      })),
      stats: {
        totalSegments: scoredGenomes.length,
        uniqueRoles: countUniqueRoles(scoredGenomes),
        currentStage: 'stress_testing',
        stagesCompleted: 3,
        totalStages: 5
      },
      ttfur: Date.now() - discoveryStartTime
    };
    onProgress('intermediate_results:' + JSON.stringify(intermediateData), 60);
    
    // Log TTFUR on first intermediate event
    if (!ttfurLogged) {
      const ttfur = Date.now() - discoveryStartTime;
      console.log(`[Performance] TTFUR: ${(ttfur/1000).toFixed(1)}s`);
      ttfurLogged = true;
    }

    onProgress('Stress testing top candidates', 70);
    const top20 = scoredGenomes.slice(0, 20);
    let testedGenomes: Genome[];
    try {
      testedGenomes = await time('stressTest', () => 
        this.stressTest(top20));
      console.log('[SegmentDiscoveryEngine] Stress tested top 20');
    } catch (error: any) {
      console.error('[SegmentDiscoveryEngine] Stress test failed:', error.message);
      onProgress('stage_error:' + JSON.stringify({
        failedStage: 'stress_testing',
        error: error.message,
        preserveResults: true
      }), -1);
      // Use un-stressed genomes and continue
      testedGenomes = top20;
    }

    // Merge stress-tested genomes with remaining scored genomes
    const finalGenomes = [
      ...testedGenomes,
      ...scoredGenomes.slice(20),
    ];

    onProgress('Synthesizing recommendations', 90);
    let synthesis: SegmentSynthesis;
    try {
      synthesis = await time('synthesize', () => 
        this.synthesize(finalGenomes, context));
      console.log('[SegmentDiscoveryEngine] Synthesis complete, beachhead:', synthesis.beachhead.genome.id);
    } catch (error: any) {
      console.error('[SegmentDiscoveryEngine] Synthesis failed:', error.message);
      onProgress('stage_error:' + JSON.stringify({
        failedStage: 'synthesis',
        error: error.message,
        preserveResults: true
      }), -1);
      // Create minimal synthesis from available data
      synthesis = {
        beachhead: {
          genome: finalGenomes[0],
          rationale: 'Unable to complete full synthesis due to error. This is the highest-scoring segment.',
          validationPlan: ['Contact 5 potential customers in this segment', 'Validate problem-solution fit', 'Test pricing sensitivity'],
        },
        backupSegments: finalGenomes.slice(1, 4),
        neverList: [],
        strategicInsights: ['Synthesis incomplete - manual review recommended'],
      };
    }

    // Print timing summary
    const totalTime = Date.now() - discoveryStartTime;
    console.log('\n[SegmentDiscovery] ═══════════════════════════════════════');
    console.log('[SegmentDiscovery] TIMING SUMMARY');
    console.log('[SegmentDiscovery] ═══════════════════════════════════════');
    Object.entries(timings).forEach(([name, ms]) => {
      const pct = ((ms / totalTime) * 100).toFixed(1);
      console.log(`[SegmentDiscovery] ${name.padEnd(25)} ${(ms/1000).toFixed(1)}s (${pct}%)`);
    });
    console.log('[SegmentDiscovery] ───────────────────────────────────────');
    console.log(`[SegmentDiscovery] TOTAL: ${(totalTime/1000).toFixed(1)}s`);
    console.log('[SegmentDiscovery] ═══════════════════════════════════════');
    console.log(`[Performance] Total: ${(totalTime/1000).toFixed(1)}s | TTFUR: ${ttfurLogged ? 'logged' : 'N/A'}\n`);

    onProgress('Complete', 100);

    return {
      geneLibrary,
      genomes: finalGenomes,
      synthesis,
    };
  }
}

export const segmentDiscoveryEngine = new SegmentDiscoveryEngine();
