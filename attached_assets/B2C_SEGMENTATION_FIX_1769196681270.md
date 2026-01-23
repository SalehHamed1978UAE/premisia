# B2C Segmentation Fix: Context-Aware Consumer Segments

**Date:** January 23, 2026
**Priority:** HIGH
**Problem:** Marketing Consultant returns irrelevant B2C segments (e.g., "Night shift workers" for a restaurant)

---

## Overview

The segmentation engine needs to be context-aware so that B2C segments are relevant to the user's actual business. We'll implement:

1. **Context keyword extraction** - Extract key terms from the offering description
2. **Context-aware gene prompts** - Inject keywords into prompts to constrain LLM output
3. **Generic B2C dimensions** - Use flexible dimensions that work for any consumer business
4. **Relevance filter** - Post-scoring filter to drop irrelevant segments

---

## Step 1: Add Context Keyword Extraction

**File:** `server/services/segment-discovery-engine.ts`

Add this helper function near the top of the file (after the imports):

```typescript
// Context keyword extraction for B2C segmentation
function extractContextKeywords(description: string): string[] {
  // Normalize text
  const normalized = description.toLowerCase();

  // Common stopwords to filter out
  const stopwords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
    'because', 'until', 'while', 'although', 'though', 'after', 'before',
    'that', 'this', 'these', 'those', 'what', 'which', 'who', 'whom',
    'i', 'we', 'you', 'he', 'she', 'it', 'they', 'me', 'us', 'him', 'her',
    'them', 'my', 'our', 'your', 'his', 'its', 'their', 'mine', 'ours',
    'yours', 'hers', 'theirs', 'also', 'want', 'planning', 'plan', 'looking',
    'built', 'building', 'launch', 'launching', 'create', 'creating'
  ]);

  // Extract words and bigrams
  const words = normalized
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopwords.has(word));

  // Count word frequencies
  const wordCounts = new Map<string, number>();
  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  }

  // Extract bigrams (two-word phrases)
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    bigrams.push(bigram);
  }

  // Prioritize domain-specific keywords
  const domainKeywords = [
    'restaurant', 'cafe', 'coffee', 'food', 'dining', 'cuisine', 'menu',
    'retail', 'store', 'shop', 'boutique', 'fashion', 'clothing',
    'salon', 'spa', 'beauty', 'wellness', 'fitness', 'gym',
    'hotel', 'hospitality', 'accommodation',
    'premium', 'luxury', 'affordable', 'budget', 'high-end', 'upscale',
    'fusion', 'traditional', 'modern', 'authentic', 'artisan', 'craft',
    'local', 'organic', 'sustainable', 'eco-friendly',
    'family', 'kids', 'children', 'adults', 'seniors', 'professionals',
    'delivery', 'takeout', 'dine-in', 'catering', 'events'
  ];

  // Build keyword list with priorities
  const keywords: string[] = [];

  // Add matching domain keywords first
  for (const keyword of domainKeywords) {
    if (normalized.includes(keyword) && !keywords.includes(keyword)) {
      keywords.push(keyword);
    }
  }

  // Add frequent words
  const sortedWords = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  for (const word of sortedWords) {
    if (!keywords.includes(word) && keywords.length < 10) {
      keywords.push(word);
    }
  }

  // Add relevant bigrams
  for (const bigram of bigrams) {
    if (keywords.length < 12 && !keywords.some(k => bigram.includes(k))) {
      keywords.push(bigram);
    }
  }

  // Extract location if present (common patterns)
  const locationPatterns = [
    /in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
    /(?:abu dhabi|dubai|riyadh|jeddah|doha|kuwait|muscat|bahrain)/gi
  ];

  for (const pattern of locationPatterns) {
    const matches = description.match(pattern);
    if (matches) {
      for (const match of matches) {
        const location = match.replace(/^in\s+/i, '').trim();
        if (location.length > 2 && !keywords.includes(location.toLowerCase())) {
          keywords.push(location.toLowerCase());
        }
      }
    }
  }

  console.log(`[SegmentDiscoveryEngine] Extracted context keywords: ${keywords.slice(0, 8).join(', ')}`);
  return keywords.slice(0, 8); // Return top 8 keywords
}
```

---

## Step 2: Update DiscoveryContext Interface

**File:** `server/services/segment-discovery-engine.ts`

Update the `DiscoveryContext` interface to include context keywords:

```typescript
export interface DiscoveryContext {
  offeringDescription: string;
  offeringType: string;
  stage: string;
  gtmConstraint: string;
  salesMotion: string;
  existingHypothesis?: string;
  contextKeywords?: string[]; // ADD THIS LINE
}
```

---

## Step 3: Update the B2C Gene Library Prompt

**File:** `server/services/segment-discovery-engine.ts`

Replace the `generateB2CGeneLibrary` method with this context-aware version:

```typescript
// B2C/Consumer Gene Library Generation (context-aware)
private async generateB2CGeneLibrary(context: DiscoveryContext): Promise<B2CGeneLibrary> {
  // Extract context keywords if not already provided
  const keywords = context.contextKeywords || extractContextKeywords(context.offeringDescription);

  const prompt = `You are a customer segmentation expert for CONSUMER-FACING businesses.

BUSINESS CONTEXT:
- Description: ${context.offeringDescription}
- Type: ${context.offeringType}
- Stage: ${context.stage}

CONTEXT KEYWORDS (segments MUST relate to these):
${JSON.stringify(keywords)}

CRITICAL INSTRUCTION: All generated segment options MUST be directly relevant to the context keywords above. Do NOT include generic segments that don't relate to this specific business.

For example, if keywords include "restaurant" and "Chinese fusion", generate dining-related segments. If keywords include "skincare" and "organic", generate beauty/wellness segments.

Generate a COMPREHENSIVE gene library with 25-35 options per dimension for CONSUMER segments.

DIMENSIONS TO POPULATE:

1. visit_occasion - WHY would someone use this business? (Must relate to context keywords)
   Generate occasions specific to: ${keywords.slice(0, 3).join(', ')}
   Examples for restaurants: business lunch, date night, family celebration, quick meal
   Examples for retail: gift shopping, self-treat, seasonal purchase, replacement need
   Examples for services: regular maintenance, special event prep, self-care routine

2. demographic_profile - WHO are the customers? (Consider the business context)
   Include age groups, income levels, life stages, occupations relevant to this business
   Examples: "Young professionals 25-35", "Affluent families with children", "Retired couples"

3. psychographic_profile - WHAT do they value? (Aligned with business positioning)
   Consider: lifestyle, values, preferences that match the business type
   Examples: "Quality-focused foodie", "Health-conscious consumer", "Convenience-seeker"

4. geographic_zone - WHERE do customers come from?
   Consider proximity, work vs home location, specific areas mentioned in context
   ${keywords.some(k => k.includes('abu dhabi') || k.includes('dubai')) ?
     'Include relevant UAE locations: ADGM area, Saadiyat, Corniche, Marina, Downtown, etc.' :
     'Include: immediate neighborhood, same district, across town, tourists/visitors'}

5. discovery_channel - HOW do they find this business?
   Digital: Instagram, TikTok, Google, Zomato/Yelp, food blogs, review sites
   Social: word of mouth, colleague/friend recommendation, influencer
   Location: walk-by traffic, visible signage, mall location
   Must be relevant to the business type in the context keywords

6. price_sensitivity - WHAT is their spending comfort?
   Budget-focused, Value-seeker, Quality-first, Premium/luxury
   Align with the positioning suggested in context keywords

7. visit_frequency - HOW OFTEN do they visit/purchase?
   Daily, Multiple times per week, Weekly, Monthly, Occasionally, Special occasions only
   Must make sense for this type of business

8. group_composition - WHO do they come with?
   Solo, Couple, Small group (3-4), Large group (5+), Family with children, Business group
   Relevant to the business context

REQUIREMENTS:
- Generate 25-35 alleles per dimension
- EVERY option must be plausible for someone interested in: ${keywords.slice(0, 4).join(', ')}
- Do NOT include segments unrelated to the context (e.g., no "night shift workers" for a restaurant)
- Think about REAL people who would actually be customers of this specific business
- Consider the local market if a location is mentioned

Return ONLY valid JSON with this structure:
{
  "dimensions": {
    "visit_occasion": ["Occasion 1", "Occasion 2", ... 25-35 options],
    "demographic_profile": ["Profile 1", "Profile 2", ... 25-35 options],
    "psychographic_profile": ["Profile 1", "Profile 2", ... 25-35 options],
    "geographic_zone": ["Zone 1", "Zone 2", ... 25-35 options],
    "discovery_channel": ["Channel 1", "Channel 2", ... 25-35 options],
    "price_sensitivity": ["Sensitivity 1", "Sensitivity 2", ... 25-35 options],
    "visit_frequency": ["Frequency 1", "Frequency 2", ... 25-35 options],
    "group_composition": ["Composition 1", "Composition 2", ... 25-35 options]
  }
}`;

  return withRetry(async () => {
    const response = await withTimeout(
      this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
      }),
      AI_TIMEOUT_LONG_MS,
      'generateB2CGeneLibrary'
    );

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const library = JSON.parse(jsonMatch[0]) as B2CGeneLibrary;

    // Log dimension counts for debugging
    const counts = Object.entries(library.dimensions).map(([dim, alleles]) =>
      `${dim}: ${(alleles as string[]).length}`
    ).join(', ');
    console.log(`[SegmentDiscoveryEngine] B2C Gene library dimensions: ${counts}`);

    return library;
  }, 'generateB2CGeneLibrary');
}
```

---

## Step 4: Update B2C Gene Interfaces

**File:** `server/services/segment-discovery-engine.ts`

Update the B2CGeneLibrary and B2CGenes interfaces to use generic names:

```typescript
// B2C/Consumer Gene Library (for any consumer-facing business)
export interface B2CGeneLibrary {
  dimensions: {
    visit_occasion: string[];
    demographic_profile: string[];
    psychographic_profile: string[];
    geographic_zone: string[];
    discovery_channel: string[];
    price_sensitivity: string[];
    visit_frequency: string[];
    group_composition: string[];
  };
}

// B2C Consumer Genome genes
export interface B2CGenes {
  visit_occasion: string;
  demographic_profile: string;
  psychographic_profile: string;
  geographic_zone: string;
  discovery_channel: string;
  price_sensitivity: string;
  visit_frequency: string;
  group_composition: string;
}
```

**Note:** Also update any references from `dining_occasion` → `visit_occasion`, `dining_frequency` → `visit_frequency`, `party_composition` → `group_composition` throughout the file.

---

## Step 5: Add Relevance Filter

**File:** `server/services/segment-discovery-engine.ts`

Add this relevance filter function:

```typescript
// Relevance filter for B2C segments
function filterByRelevance(
  genomes: Genome[],
  contextKeywords: string[],
  threshold: number = 1
): { filtered: Genome[]; pruned: number } {
  const keywordsLower = contextKeywords.map(k => k.toLowerCase());

  const filtered = genomes.filter(genome => {
    if (!isB2CGenes(genome.genes)) return true; // Don't filter B2B

    // Create a text representation of the genome
    const genomeText = Object.values(genome.genes).join(' ').toLowerCase();

    // Count keyword matches
    let matches = 0;
    for (const keyword of keywordsLower) {
      // Check for partial matches (e.g., "restaurant" matches "restaurant-goers")
      if (genomeText.includes(keyword) || keyword.split(' ').some(k => genomeText.includes(k))) {
        matches++;
      }
    }

    // Also check narrative reason if available
    if (genome.narrativeReason) {
      const narrativeLower = genome.narrativeReason.toLowerCase();
      for (const keyword of keywordsLower) {
        if (narrativeLower.includes(keyword)) {
          matches++;
        }
      }
    }

    return matches >= threshold;
  });

  const pruned = genomes.length - filtered.length;
  if (pruned > 0) {
    console.log(`[SegmentDiscoveryEngine] Filtered ${pruned} genomes for low relevance (threshold: ${threshold} keyword matches)`);
  }

  return { filtered, pruned };
}
```

---

## Step 6: Apply Relevance Filter in runDiscovery

**File:** `server/services/segment-discovery-engine.ts`

Update the `runDiscovery` method to extract keywords and apply the filter:

```typescript
async runDiscovery(
  context: DiscoveryContext,
  onProgress: (step: string, progress: number) => void
): Promise<{
  geneLibrary: GeneLibrary;
  genomes: Genome[];
  synthesis: SegmentSynthesis;
}> {
  console.log('[SegmentDiscoveryEngine] Starting discovery for:', context.offeringType);
  console.log('[SegmentDiscoveryEngine] Business description:', context.offeringDescription.substring(0, 100) + '...');

  // Extract context keywords for B2C filtering
  const contextKeywords = extractContextKeywords(context.offeringDescription);
  context.contextKeywords = contextKeywords;
  console.log('[SegmentDiscoveryEngine] Context keywords:', contextKeywords.join(', '));

  onProgress('Generating gene library', 10);
  const geneLibrary = await this.generateGeneLibrary(context);
  const isB2CMode = isB2CGeneLibrary(geneLibrary);
  console.log(`[SegmentDiscoveryEngine] Mode: ${isB2CMode ? 'B2C (Consumer)' : 'B2B (Product/SaaS)'}`);
  console.log('[SegmentDiscoveryEngine] Gene library generated:', Object.keys(geneLibrary.dimensions).length, 'dimensions');

  onProgress('Creating segment combinations', 30);
  const genomes = await this.generateGenomes(geneLibrary, context, 100);
  console.log('[SegmentDiscoveryEngine] Generated', genomes.length, 'genomes');

  onProgress('Scoring segments', 50);
  const scoredGenomes = await this.scoreGenomes(genomes, context);
  console.log('[SegmentDiscoveryEngine] Scored genomes, top score:', scoredGenomes[0]?.fitness.totalScore);

  // Apply relevance filter for B2C segments
  let filteredGenomes = scoredGenomes;
  if (isB2CMode && contextKeywords.length > 0) {
    onProgress('Filtering for relevance', 60);
    const { filtered, pruned } = filterByRelevance(scoredGenomes, contextKeywords, 1);
    filteredGenomes = filtered;

    // If we filtered too many, lower the threshold
    if (filteredGenomes.length < 20) {
      console.log('[SegmentDiscoveryEngine] Too few segments after filtering, using all scored genomes');
      filteredGenomes = scoredGenomes;
    }
  }

  onProgress('Stress testing top candidates', 70);
  const top20 = filteredGenomes.slice(0, 20);
  const testedGenomes = await this.stressTest(top20);
  console.log('[SegmentDiscoveryEngine] Stress tested top 20');

  // Merge stress-tested genomes with remaining scored genomes
  const finalGenomes = [
    ...testedGenomes,
    ...filteredGenomes.slice(20),
  ];

  onProgress('Synthesizing recommendations', 90);
  const synthesis = await this.synthesize(finalGenomes, context);
  console.log('[SegmentDiscoveryEngine] Synthesis complete, beachhead:', synthesis.beachhead.genome.id);

  onProgress('Complete', 100);

  return {
    geneLibrary,
    genomes: finalGenomes,
    synthesis,
  };
}
```

---

## Step 7: Update B2C Genome Generation Batch

**File:** `server/services/segment-discovery-engine.ts`

Update the `generateB2CGenomeBatch` method to include context keywords:

```typescript
private async generateB2CGenomeBatch(
  geneLibrary: B2CGeneLibrary,
  context: DiscoveryContext,
  count: number,
  batchIndex: number
): Promise<Genome[]> {
  const focusAreas = [
    'high-frequency regular customers who will become loyal patrons',
    'special occasion customers with high spend potential',
    'underserved demographic groups in the local market',
    'diverse combinations exploring different customer journeys'
  ];

  const keywords = context.contextKeywords || [];

  const prompt = `You are a customer segmentation expert creating CONSUMER segment combinations.

BUSINESS CONTEXT:
- Description: ${context.offeringDescription}
- Type: ${context.offeringType}
- Stage: ${context.stage}

CONTEXT KEYWORDS (all segments must relate to these):
${JSON.stringify(keywords)}

GENE LIBRARY (available options for each dimension):
${JSON.stringify(geneLibrary.dimensions, null, 2)}

YOUR FOCUS: Generate ${count} unique CONSUMER segment combinations focusing on ${focusAreas[batchIndex]}.

BATCH ID: ${batchIndex + 1} of 4 - Use IDs starting with genome_${String(batchIndex * count + 1).padStart(3, '0')}.

CRITICAL: These are REAL PEOPLE who would be customers of a business described as: "${context.offeringDescription.substring(0, 150)}"

Each segment must be someone who would plausibly be interested in this specific offering.

REQUIREMENTS:
- Create realistic customer profiles that would actually visit/buy from this business
- Each genome is a specific combination of one option from each dimension
- Consider which combinations make logical sense together
- DO NOT create segments unrelated to the context keywords

Return ONLY valid JSON array with exactly ${count} genomes:
[
  {
    "id": "genome_${String(batchIndex * count + 1).padStart(3, '0')}",
    "genes": {
      "visit_occasion": "one option from the library",
      "demographic_profile": "one option from the library",
      "psychographic_profile": "one option from the library",
      "geographic_zone": "one option from the library",
      "discovery_channel": "one option from the library",
      "price_sensitivity": "one option from the library",
      "visit_frequency": "one option from the library",
      "group_composition": "one option from the library"
    }
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
      `generateB2CGenomeBatch-${batchIndex}`
    );

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }

    const genomes = JSON.parse(jsonMatch[0]) as Array<{ id: string; genes: B2CGenes }>;

    return genomes.map((g, idx) => ({
      id: g.id || `genome_${String(batchIndex * count + idx + 1).padStart(3, '0')}`,
      genes: g.genes,
      fitness: {
        occasionFrequency: 0,
        spendPotential: 0,
        reachability: 0,
        competitionDensity: 0,
        conceptFit: 0,
        loyaltyPotential: 0,
        geographicMatch: 0,
        channelAccessibility: 0,
        totalScore: 0,
      } as B2CFitness,
      narrativeReason: '',
    }));
  }, `generateB2CGenomeBatch-${batchIndex}`);
}
```

---

## Step 8: Update Type Guards and Hash Function

**File:** `server/services/segment-discovery-engine.ts`

Update the type guard and hash function for the renamed fields:

```typescript
// Type guard for B2C genes
export function isB2CGenes(genes: B2BGenes | B2CGenes): genes is B2CGenes {
  return 'visit_occasion' in genes;
}

// Update getCanonicalGenomeHash for B2C
private getCanonicalGenomeHash(genes: Genome['genes']): string {
  if (isB2CGenes(genes)) {
    const orderedKeys: (keyof B2CGenes)[] = [
      'visit_occasion',
      'demographic_profile',
      'psychographic_profile',
      'geographic_zone',
      'discovery_channel',
      'price_sensitivity',
      'visit_frequency',
      'group_composition'
    ];
    return orderedKeys.map(key => genes[key]).join('|');
  }

  // B2B genes
  const orderedKeys: (keyof B2BGenes)[] = [
    'industry_vertical',
    'company_size',
    'decision_maker',
    'purchase_trigger',
    'tech_adoption',
    'buying_process',
    'budget_authority',
    'urgency_profile'
  ];
  return orderedKeys.map(key => (genes as B2BGenes)[key]).join('|');
}
```

---

## Verification Checklist

After implementing, test with these scenarios:

### Test 1: Chinese Fusion Restaurant
```
Input: "Premium Chinese fusion restaurant blending Cantonese and Sichuan cuisine in Abu Dhabi"
```

**Expected logs:**
```
[SegmentDiscoveryEngine] Context keywords: restaurant, chinese, fusion, cuisine, abu dhabi, premium, cantonese, sichuan
[SegmentDiscoveryEngine] Mode: B2C (Consumer)
[SegmentDiscoveryEngine] Filtered X genomes for low relevance
```

**Expected segments:**
- "ADGM finance professionals, business lunch with clients, weekly, quality-first"
- "Affluent expat couples, date night, premium spenders, Instagram discovery"
- "Emirati families, weekend celebration, quality-focused, word of mouth"

**NOT expected:**
- "Night shift workers with circadian rhythm disruption"
- "Blockchain developers"
- "Mobile pet grooming freelancers"

### Test 2: Kids Educational Toys (different B2C)
```
Input: "Educational STEM toys for children ages 5-12"
```

**Expected segments:**
- "Parents of elementary school kids, birthday gift shopping, quality-focused"
- "Grandparents, special occasion gifting, premium spenders"
- "Teachers/educators, classroom supplies, bulk purchasing"

### Test 3: B2B Software (should be unchanged)
```
Input: "AI-powered document management for law firms"
```

**Expected:** B2B mode with industry_vertical, decision_maker, etc.

---

## Summary of Changes

| File | Changes |
|------|---------|
| `segment-discovery-engine.ts` | Add `extractContextKeywords()` function |
| `segment-discovery-engine.ts` | Update `DiscoveryContext` interface with `contextKeywords` |
| `segment-discovery-engine.ts` | Rename B2C dimensions: `dining_*` → `visit_*`, `party_composition` → `group_composition` |
| `segment-discovery-engine.ts` | Update `generateB2CGeneLibrary` to inject context keywords |
| `segment-discovery-engine.ts` | Add `filterByRelevance()` function |
| `segment-discovery-engine.ts` | Update `runDiscovery` to extract keywords and apply filter |
| `segment-discovery-engine.ts` | Update `generateB2CGenomeBatch` with context awareness |
| `segment-discovery-engine.ts` | Update type guards for renamed fields |

---

## Quick Reference: Find & Replace

To update field names throughout the file:

```
dining_occasion → visit_occasion
dining_frequency → visit_frequency
party_composition → group_composition
```

Make sure to update:
- Interface definitions
- Type guards (`isB2CGenes`)
- Hash function (`getCanonicalGenomeHash`)
- Genome batch generation prompts
- Scoring batch prompts
- Stress test prompts
