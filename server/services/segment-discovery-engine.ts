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

export type SegmentationMode = 'b2b' | 'b2c';

export interface B2BGeneLibrary {
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

export interface B2CGeneLibrary {
  dimensions: {
    demographic_segment: string[];
    psychographic_profile: string[];
    lifestyle_context: string[];
    purchase_occasion: string[];
    channel_preference: string[];
    price_sensitivity: string[];
    brand_relationship: string[];
    usage_frequency: string[];
  };
}

export type GeneLibrary = B2BGeneLibrary | B2CGeneLibrary;

export interface B2BGenes {
  industry_vertical: string;
  company_size: string;
  decision_maker: string;
  purchase_trigger: string;
  tech_adoption: string;
  buying_process: string;
  budget_authority: string;
  urgency_profile: string;
}

export interface B2CGenes {
  demographic_segment: string;
  psychographic_profile: string;
  lifestyle_context: string;
  purchase_occasion: string;
  channel_preference: string;
  price_sensitivity: string;
  brand_relationship: string;
  usage_frequency: string;
}

export interface Genome {
  id: string;
  genes: B2BGenes | B2CGenes;
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
  segmentationMode?: SegmentationMode;
  contextKeywords?: string[];
}

export function detectSegmentationMode(offeringType: string): SegmentationMode {
  const b2cTypes = ['b2c_software', 'physical_product', 'content_education'];
  return b2cTypes.includes(offeringType) ? 'b2c' : 'b2b';
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'shall', 'can', 'need', 'dare', 'ought', 'used', 'i', 'we', 'you', 'he', 'she',
  'it', 'they', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'am', 'my', 'your', 'our', 'their', 'its', 'his', 'her', 'about', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further',
  'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 'just', 'also', 'now', 'being', 'over', 'any', 'both'
]);

export function extractContextKeywords(description: string): string[] {
  const text = description.toLowerCase();
  
  const nounPhrasePatterns = [
    /(?:premium|luxury|affordable|innovative|traditional|modern|artisan|gourmet|authentic|organic|sustainable|local|global|digital|mobile|online|physical)\s+[a-z]+(?:\s+[a-z]+)?/gi,
    /[a-z]+(?:\s+[a-z]+)?\s+(?:restaurant|cafe|shop|store|service|platform|app|software|product|solution|business|company|brand|agency)/gi,
    /(?:chinese|italian|mexican|indian|japanese|french|thai|mediterranean|american|asian|european|middle eastern|african)\s+(?:food|cuisine|restaurant|fusion|cooking|dishes)/gi,
  ];
  
  const extractedPhrases: string[] = [];
  for (const pattern of nounPhrasePatterns) {
    const matches = text.match(pattern) || [];
    extractedPhrases.push(...matches.map(m => m.trim()));
  }
  
  const words = text
    .replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !STOPWORDS.has(word));
  
  const wordFreq = new Map<string, number>();
  for (const word of words) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  }
  
  const sortedWords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 10);
  
  const allKeywords = Array.from(new Set([...extractedPhrases, ...sortedWords]));
  
  return allKeywords.slice(0, 8);
}

export class SegmentDiscoveryEngine {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  private getB2BGeneLibraryPrompt(context: DiscoveryContext): string {
    return `You are a market segmentation expert specializing in discovering SURPRISING, NON-OBVIOUS B2B customer segments. Your job is to surface segments that founders would never think of on their own.

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
  }

  private getB2CGeneLibraryPrompt(context: DiscoveryContext): string {
    const keywords = context.contextKeywords || [];
    const keywordsSection = keywords.length > 0 
      ? `\nCONTEXT_KEYWORDS: ${JSON.stringify(keywords)}\n\nCRITICAL CONSTRAINT: ALL generated segments MUST directly tie to the context keywords above. Every dimension option should be relevant to "${keywords.join(', ')}". Do NOT include generic segments unrelated to this specific offering.`
      : '';
    
    return `You are a consumer market segmentation expert specializing in discovering SURPRISING, NON-OBVIOUS B2C customer segments. Your job is to surface consumer segments that founders would never think of on their own.
${keywordsSection}

OFFERING CONTEXT:
- Description: ${context.offeringDescription}
- Type: ${context.offeringType}
- Stage: ${context.stage}
- GTM Constraint: ${context.gtmConstraint}
- Sales Motion: ${context.salesMotion}
${context.existingHypothesis ? `- Existing Hypothesis: ${context.existingHypothesis}` : ''}

Generate a COMPREHENSIVE gene library with 50+ options per dimension. The goal is DIVERSITY and DISCOVERY - push beyond the obvious, BUT all options must be relevant to this specific offering.

KEY PRINCIPLE: "Who has this need but nobody's serving them well?"

DIMENSIONS TO POPULATE (50+ alleles each):

1. demographic_segment - WHO they are:
   - Age groups (Gen Z, Millennials, Gen X, Boomers, Silent Gen)
   - Life stages (students, new grads, young professionals, new parents, empty nesters, retirees)
   - Family composition (singles, couples, young families, multi-generational households)
   - Income levels (budget-conscious, middle-income, affluent, ultra-high-net-worth)
   - Geographic (urban, suburban, rural, coastal, heartland)
   - Cultural backgrounds (immigrants, expats, multicultural families)
   - Education levels (high school, college, graduate, trade school)
   - Occupation types (blue collar, white collar, gig workers, stay-at-home parents)
   Include UNUSUAL demographics that might have the underlying need.

2. psychographic_profile - HOW they think:
   - Values-driven (eco-conscious, health-focused, family-first, career-driven)
   - Risk tolerance (adventurous, cautious, moderate)
   - Social orientation (introverts, extroverts, ambiverts)
   - Decision style (impulsive, analytical, emotional, social proof seekers)
   - Status orientation (aspirational, practical, luxury seekers, minimalists)
   - Tech relationship (digital natives, tech-curious, tech-resistant)
   - Health consciousness (wellness obsessed, health aware, health indifferent)
   - Environmental stance (activists, concerned, indifferent, skeptics)

3. lifestyle_context - HOW they live:
   - Living situations (renters, homeowners, apartment dwellers, mobile living)
   - Daily routines (9-5 workers, shift workers, remote workers, freelancers)
   - Hobbies and interests (sports, gaming, crafts, travel, cooking, fitness)
   - Social activities (social butterflies, homebodies, community volunteers)
   - Pet owners (dogs, cats, exotic pets, multiple pets)
   - Dietary preferences (vegan, keto, gluten-free, foodie, convenience eaters)
   - Fitness levels (athletes, gym-goers, casual exercisers, sedentary)
   - Entertainment preferences (streamers, readers, outdoor enthusiasts, gamers)

4. purchase_occasion - WHEN they buy:
   - Life events (weddings, babies, moving, graduation, retirement)
   - Seasonal triggers (holidays, back-to-school, summer, New Year's resolutions)
   - Emotional states (stress relief, celebration, self-care, boredom)
   - Problem triggers (something broke, ran out, discovered need)
   - Social triggers (gift giving, keeping up with friends, recommendations)
   - Habitual purchases (routine replenishment, subscriptions)
   - Impulse moments (browsing, waiting, commuting)
   - Discovery moments (saw on social media, heard from friend, saw in store)

5. channel_preference - WHERE they shop:
   - E-commerce (Amazon, DTC brands, marketplaces)
   - Social commerce (Instagram, TikTok Shop, Facebook Marketplace)
   - Physical retail (big box, boutique, convenience stores)
   - Subscription services (monthly boxes, auto-replenishment)
   - Local/artisan (farmers markets, craft fairs, local shops)
   - Discount/value (outlet stores, warehouse clubs, dollar stores)
   - Specialty channels (niche online communities, enthusiast sites)
   - Hybrid (BOPIS, curbside, showrooming)

6. price_sensitivity - HOW they value money:
   - Premium seekers (quality over price, status purchases)
   - Value optimizers (best bang for buck, comparison shoppers)
   - Deal hunters (coupon clippers, wait for sales, cashback obsessed)
   - Budget constrained (paycheck-to-paycheck, student budgets)
   - Situational spenders (splurge on passions, scrimp elsewhere)
   - Subscription tolerant (willing to pay recurring for convenience)
   - Free trial seekers (convert with experience, not price)
   - Investment mindset (pay more for durability/longevity)

7. brand_relationship - HOW they connect with brands:
   - Brand loyal (stick with what works, resistant to change)
   - Brand curious (open to trying new things, variety seekers)
   - Brand agnostic (commodity buyers, private label fans)
   - Brand advocates (influencers, reviewers, word-of-mouth drivers)
   - Brand skeptics (anti-corporate, prefer indie/local)
   - Community seekers (join brand communities, attend events)
   - Cause-aligned (support brands matching their values)
   - Convenience-driven (whatever is easiest, lowest friction)

8. usage_frequency - HOW often they engage:
   - Daily users (habitual, part of routine)
   - Weekly users (regular but not daily)
   - Occasional users (monthly, seasonal)
   - One-time/rare users (major purchases, special occasions)
   - Binge users (heavy use periods followed by breaks)
   - Trial users (trying before committing)
   - Power users (heavy usage, advanced features)
   - Light users (minimal engagement, basic features only)

MUTATION REQUIREMENT:
For each dimension, include 5-10 "MUTATION" options - consumer types that seem like UNLIKELY or COUNTERINTUITIVE fits at first glance but might have the underlying need. These are often where the best insights come from.

REQUIREMENTS:
- Generate 50+ alleles per dimension
- Include obvious consumer segments but PRIORITIZE non-obvious ones
- Force diversity - no dimension should be dominated by one category
- Include the mutation options explicitly
- Think about underserved consumer segments that are overlooked

Return ONLY valid JSON with this structure:
{
  "dimensions": {
    "demographic_segment": ["Segment 1", "Segment 2", ... 50+ options],
    "psychographic_profile": ["Profile 1", "Profile 2", ... 50+ options],
    "lifestyle_context": ["Context 1", "Context 2", ... 50+ options],
    "purchase_occasion": ["Occasion 1", "Occasion 2", ... 50+ options],
    "channel_preference": ["Channel 1", "Channel 2", ... 50+ options],
    "price_sensitivity": ["Sensitivity 1", "Sensitivity 2", ... 50+ options],
    "brand_relationship": ["Relationship 1", "Relationship 2", ... 50+ options],
    "usage_frequency": ["Frequency 1", "Frequency 2", ... 50+ options]
  }
}`;
  }

  async generateGeneLibrary(context: DiscoveryContext): Promise<GeneLibrary> {
    const mode = context.segmentationMode || detectSegmentationMode(context.offeringType);
    const prompt = mode === 'b2c' 
      ? this.getB2CGeneLibraryPrompt(context) 
      : this.getB2BGeneLibraryPrompt(context);
    
    console.log(`[SegmentDiscoveryEngine] Using ${mode.toUpperCase()} segmentation mode for: ${context.offeringType}`);
    console.log(`[SegmentDiscoveryEngine] Prompt type: ${mode === 'b2c' ? 'B2C Consumer Segments' : 'B2B Business Segments'}`);
    console.log(`[SegmentDiscoveryEngine] Prompt preview: ${prompt.substring(0, 150).replace(/\n/g, ' ')}...`);

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
    const mode = context.segmentationMode || detectSegmentationMode(context.offeringType);
    
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
    const diversityCounts = new Map<string, number>();
    const MAX_GENOMES_PER_KEY = 3;
    const uniqueGenomes: Genome[] = [];
    let duplicatesRemoved = 0;
    let diversityFiltered = 0;
    
    // Determine diversity key based on mode
    const diversityKey = mode === 'b2c' ? 'demographic_segment' : 'decision_maker';
    
    for (const genome of allGenomes) {
      // Canonical hash for deduplication
      const hash = this.getCanonicalGenomeHash(genome.genes);
      if (seen.has(hash)) {
        duplicatesRemoved++;
        continue;
      }
      
      // Diversity constraint: max 3 genomes per key dimension
      const keyValue = (genome.genes as any)[diversityKey] as string | undefined;
      
      // Guard: skip genomes missing the diversity key (mode mismatch protection)
      if (!keyValue) {
        console.warn(`[SegmentDiscoveryEngine] Skipping genome with missing ${diversityKey} key`);
        continue;
      }
      
      const currentCount = diversityCounts.get(keyValue) || 0;
      if (currentCount >= MAX_GENOMES_PER_KEY) {
        diversityFiltered++;
        continue;
      }
      
      seen.add(hash);
      diversityCounts.set(keyValue, currentCount + 1);
      uniqueGenomes.push({
        ...genome,
        id: `genome_${String(uniqueGenomes.length + 1).padStart(3, '0')}`,
      });
    }

    console.log(`[SegmentDiscoveryEngine] Generated ${uniqueGenomes.length} unique genomes (${duplicatesRemoved} duplicates, ${diversityFiltered} filtered by diversity constraint)`);
    console.log(`[SegmentDiscoveryEngine] Diversity: ${diversityCounts.size} unique ${diversityKey} values`);
    
    // Ensure we have at least 'count' genomes (or as many as we could generate)
    if (uniqueGenomes.length < count) {
      console.log(`[SegmentDiscoveryEngine] Warning: Only ${uniqueGenomes.length} unique genomes available (requested ${count})`);
    }
    
    return uniqueGenomes.slice(0, count);
  }

  private getCanonicalGenomeHash(genes: Genome['genes']): string {
    // Create canonical hash with explicit key ordering per mode
    // Check which mode by looking for dimension keys present
    const isB2C = 'demographic_segment' in genes;
    
    if (isB2C) {
      const b2cKeys: (keyof B2CGenes)[] = [
        'demographic_segment',
        'psychographic_profile',
        'lifestyle_context',
        'purchase_occasion',
        'channel_preference',
        'price_sensitivity',
        'brand_relationship',
        'usage_frequency'
      ];
      return b2cKeys.map(key => (genes as B2CGenes)[key]).join('|');
    }
    
    // B2B mode
    const b2bKeys: (keyof B2BGenes)[] = [
      'industry_vertical',
      'company_size', 
      'decision_maker',
      'purchase_trigger',
      'tech_adoption',
      'buying_process',
      'budget_authority',
      'urgency_profile'
    ];
    return b2bKeys.map(key => (genes as B2BGenes)[key]).join('|');
  }

  private getGenomeExampleForMode(mode: SegmentationMode, batchIndex: number, count: number): string {
    if (mode === 'b2c') {
      return `[
  {
    "id": "genome_${String(batchIndex * count + 1).padStart(3, '0')}",
    "genes": {
      "demographic_segment": "one allele from the library",
      "psychographic_profile": "one allele from the library",
      "lifestyle_context": "one allele from the library",
      "purchase_occasion": "one allele from the library",
      "channel_preference": "one allele from the library",
      "price_sensitivity": "one allele from the library",
      "brand_relationship": "one allele from the library",
      "usage_frequency": "one allele from the library"
    }
  },
  ...
]`;
    }
    return `[
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
  }

  private async generateGenomeBatch(
    geneLibrary: GeneLibrary, 
    context: DiscoveryContext, 
    count: number, 
    batchIndex: number
  ): Promise<Genome[]> {
    const mode = context.segmentationMode || detectSegmentationMode(context.offeringType);
    const segmentType = mode === 'b2c' ? 'consumer' : 'business';
    
    const focusAreas = [
      'high-potential obvious segments that are most likely to succeed',
      'non-obvious but promising niche segments with unique opportunities',
      'edge cases and challenging segments to stress-test assumptions',
      'diverse combinations exploring the full gene space'
    ];

    const prompt = `You are a ${segmentType} market strategist creating segment combinations for discovery.

OFFERING CONTEXT:
- Description: ${context.offeringDescription}
- Type: ${context.offeringType}
- Stage: ${context.stage}
- GTM Constraint: ${context.gtmConstraint}
- Sales Motion: ${context.salesMotion}

GENE LIBRARY (available alleles for each dimension):
${JSON.stringify(geneLibrary.dimensions, null, 2)}

YOUR FOCUS: Generate ${count} unique ${segmentType} segment combinations focusing on ${focusAreas[batchIndex]}.

BATCH ID: ${batchIndex + 1} of 4 - Use IDs starting with genome_${String(batchIndex * count + 1).padStart(3, '0')}.

REQUIREMENTS:
- Create STRATEGICALLY interesting combinations for your focus area
- Each genome is a specific combination of one allele from each dimension
- Consider which combinations make logical sense together
- Ensure variety within your focus area

Return ONLY valid JSON array with exactly ${count} genomes:
${this.getGenomeExampleForMode(mode, batchIndex, count)}`;

    return withRetry(async () => {
      const response = await withTimeout(
        this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
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

  private getScoringCriteriaForMode(mode: SegmentationMode): string {
    if (mode === 'b2c') {
      return `Score each consumer segment on these 8 criteria (1-5 scale each, 40 points max total):

1. painIntensity (1-5): How intense is the need/desire this consumer segment experiences?
2. accessToDecisionMaker (1-5): How easy is it to reach and acquire these consumers?
3. purchasePowerMatch (1-5): Does their spending ability match your pricing?
4. competitionSaturation (1-5): How uncrowded is this segment? (5 = very uncrowded/good)
5. productFit (1-5): How well does your offering fit their needs and lifestyle?
6. urgencyAlignment (1-5): How urgent is their purchase intent?
7. scalePotential (1-5): Can you scale to reach more consumers in this segment?
8. gtmEfficiency (1-5): Can you efficiently market to this segment given your constraints?`;
    }
    return `Score each business segment on these 8 criteria (1-5 scale each, 40 points max total):

1. painIntensity (1-5): How intense is the pain this segment experiences?
2. accessToDecisionMaker (1-5): How easy is it to reach the decision maker?
3. purchasePowerMatch (1-5): Does their budget match your pricing?
4. competitionSaturation (1-5): How uncrowded is this segment? (5 = very uncrowded/good)
5. productFit (1-5): How well does your offering fit their needs?
6. urgencyAlignment (1-5): How urgent is their need?
7. scalePotential (1-5): Can you scale in this segment?
8. gtmEfficiency (1-5): Can you efficiently reach this segment given your constraints?`;
  }

  private async scoreBatch(genomes: Genome[], context: DiscoveryContext): Promise<Genome[]> {
    const mode = context.segmentationMode || detectSegmentationMode(context.offeringType);
    const segmentType = mode === 'b2c' ? 'consumer' : 'business';
    
    const prompt = `You are a rigorous ${segmentType} market analyst scoring segment viability.

OFFERING CONTEXT:
- Description: ${context.offeringDescription}
- Type: ${context.offeringType}
- Stage: ${context.stage}
- GTM Constraint: ${context.gtmConstraint}
- Sales Motion: ${context.salesMotion}

GENOMES TO SCORE:
${JSON.stringify(genomes.map(g => ({ id: g.id, genes: g.genes })), null, 2)}

${this.getScoringCriteriaForMode(mode)}

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
          model: 'claude-sonnet-4-20250514',
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
            model: 'claude-sonnet-4-20250514',
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
