import { db } from './db.js';
import { authoritySources, authoritySourceIndustries, authoritySourceCountries, authoritySourceLanguages } from '../shared/schema.js';
import { eq, sql } from 'drizzle-orm';

interface AuthoritySeed {
  name: string;
  url?: string;
  industries: string[];
  countries: string[]; // ISO2 codes
  languages: string[];
  tier: 1 | 2 | 3;
}

// Pre-defined authority sources with geographic and industry coverage
const AUTHORITY_SEEDS: AuthoritySeed[] = [
  // Tier 1: High Authority - Global management consultancies and research firms
  {
    name: 'McKinsey & Company',
    url: 'https://www.mckinsey.com',
    industries: ['all'], // Global coverage across all industries
    countries: ['US', 'GB', 'DE', 'FR', 'JP', 'CN', 'IN', 'BR', 'AU', 'CA'],
    languages: ['en', 'de', 'fr', 'ja', 'zh', 'pt', 'es'],
    tier: 1,
  },
  {
    name: 'Boston Consulting Group',
    url: 'https://www.bcg.com',
    industries: ['all'],
    countries: ['US', 'GB', 'DE', 'FR', 'JP', 'CN', 'IN', 'BR', 'AU', 'CA'],
    languages: ['en', 'de', 'fr', 'ja', 'zh', 'pt', 'es'],
    tier: 1,
  },
  {
    name: 'Bain & Company',
    url: 'https://www.bain.com',
    industries: ['all'],
    countries: ['US', 'GB', 'DE', 'FR', 'JP', 'CN', 'IN', 'BR', 'AU'],
    languages: ['en', 'de', 'fr', 'ja', 'zh', 'pt'],
    tier: 1,
  },
  {
    name: 'Gartner',
    url: 'https://www.gartner.com',
    industries: ['technology', 'software', 'it', 'telecommunications', 'all'],
    countries: ['US', 'GB', 'DE', 'FR', 'JP', 'CN', 'IN', 'AU'],
    languages: ['en', 'de', 'fr', 'ja', 'zh'],
    tier: 1,
  },

  // Tier 2: Medium Authority - Reputable business publications
  {
    name: 'Harvard Business Review',
    url: 'https://hbr.org',
    industries: ['all'],
    countries: ['US', 'GB', 'CA', 'AU', 'IN'],
    languages: ['en'],
    tier: 2,
  },
  {
    name: 'Bloomberg',
    url: 'https://www.bloomberg.com',
    industries: ['finance', 'banking', 'investment', 'markets', 'economics', 'all'],
    countries: ['US', 'GB', 'DE', 'FR', 'JP', 'CN', 'HK', 'SG', 'IN'],
    languages: ['en', 'ja', 'zh'],
    tier: 2,
  },
  {
    name: 'The Wall Street Journal',
    url: 'https://www.wsj.com',
    industries: ['all'],
    countries: ['US', 'GB', 'CA'],
    languages: ['en'],
    tier: 2,
  },
  {
    name: 'Financial Times',
    url: 'https://www.ft.com',
    industries: ['finance', 'banking', 'economics', 'all'],
    countries: ['GB', 'US', 'DE', 'FR', 'HK', 'SG'],
    languages: ['en'],
    tier: 2,
  },

  // Tier 3: Lower Authority - Industry-specific sources
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com',
    industries: ['technology', 'software', 'startups', 'venture capital'],
    countries: ['US', 'GB', 'CA'],
    languages: ['en'],
    tier: 3,
  },
  {
    name: 'VentureBeat',
    url: 'https://venturebeat.com',
    industries: ['technology', 'ai', 'software', 'gaming'],
    countries: ['US', 'GB'],
    languages: ['en'],
    tier: 3,
  },
  {
    name: 'Industry Week',
    url: 'https://www.industryweek.com',
    industries: ['manufacturing', 'supply chain', 'operations'],
    countries: ['US', 'CA'],
    languages: ['en'],
    tier: 3,
  },
  {
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com',
    industries: ['technology', 'science', 'research', 'innovation'],
    countries: ['US', 'GB', 'CA'],
    languages: ['en'],
    tier: 3,
  },
];

class AuthorityRegistryService {
  private isSeeded = false;
  private seedPromise: Promise<void> | null = null;

  /**
   * Ensure authority sources are seeded (idempotent)
   */
  async ensureSeeded(): Promise<void> {
    // If already seeded, return immediately
    if (this.isSeeded) {
      return;
    }

    // If seeding is in progress, wait for it
    if (this.seedPromise) {
      return this.seedPromise;
    }

    // Start seeding process
    this.seedPromise = this.seedAuthorities();
    await this.seedPromise;
    this.isSeeded = true;
    this.seedPromise = null;
  }

  /**
   * Seed pre-defined authority sources (idempotent - only seeds missing authorities)
   */
  private async seedAuthorities(): Promise<void> {
    console.log('[AuthorityRegistry] Checking which authorities need seeding...');

    for (const seed of AUTHORITY_SEEDS) {
      try {
        // Upsert authority source (insert or update tier/url if exists)
        const [authority] = await db.insert(authoritySources)
          .values({
            name: seed.name,
            url: seed.url,
            tier: seed.tier,
          })
          .onConflictDoUpdate({
            target: authoritySources.name,
            set: {
              tier: seed.tier,
              url: seed.url,
            },
          })
          .returning();

        console.log(`[AuthorityRegistry] Upserted: ${seed.name} (Tier ${seed.tier})`);

        // Insert industries (skip if already exists)
        for (const industry of seed.industries) {
          await db.insert(authoritySourceIndustries)
            .values({
              authorityId: authority.id,
              industry,
            })
            .onConflictDoNothing();
        }

        // Insert countries (skip if already exists)
        for (const country of seed.countries) {
          await db.insert(authoritySourceCountries)
            .values({
              authorityId: authority.id,
              countryIso2: country,
            })
            .onConflictDoNothing();
        }

        // Insert languages (skip if already exists)
        for (const language of seed.languages) {
          await db.insert(authoritySourceLanguages)
            .values({
              authorityId: authority.id,
              language,
            })
            .onConflictDoNothing();
        }
      } catch (error) {
        console.error(`[AuthorityRegistry] Failed to seed ${seed.name}:`, error);
      }
    }

    console.log('[AuthorityRegistry] Authority seeding complete');
  }

  /**
   * Get all authority sources with their coverage
   */
  async getAllAuthorities() {
    await this.ensureSeeded();

    const authorities = await db.select().from(authoritySources);
    
    const result = [];
    
    for (const authority of authorities) {
      const industries = await db.select()
        .from(authoritySourceIndustries)
        .where(eq(authoritySourceIndustries.authorityId, authority.id));
      
      const countries = await db.select()
        .from(authoritySourceCountries)
        .where(eq(authoritySourceCountries.authorityId, authority.id));
      
      const languages = await db.select()
        .from(authoritySourceLanguages)
        .where(eq(authoritySourceLanguages.authorityId, authority.id));

      result.push({
        ...authority,
        industries: industries.map(i => i.industry),
        countries: countries.map(c => c.countryIso2),
        languages: languages.map(l => l.language),
      });
    }

    return result;
  }

  /**
   * Update hit count for an authority source
   */
  async recordHit(authorityId: string): Promise<void> {
    await db.update(authoritySources)
      .set({
        hits: sql`${authoritySources.hits} + 1`,
        lastSeen: new Date(),
      })
      .where(eq(authoritySources.id, authorityId));
  }

  /**
   * Update corroboration count for an authority source
   */
  async recordCorroboration(authorityId: string): Promise<void> {
    await db.update(authoritySources)
      .set({
        corroborations: sql`${authoritySources.corroborations} + 1`,
      })
      .where(eq(authoritySources.id, authorityId));
  }

  /**
   * Get authority statistics
   */
  async getStatistics() {
    await this.ensureSeeded();

    const stats = await db.select({
      totalAuthorities: sql<number>`count(*)`,
      totalHits: sql<number>`sum(${authoritySources.hits})`,
      totalCorroborations: sql<number>`sum(${authoritySources.corroborations})`,
    }).from(authoritySources);

    return stats[0];
  }

  /**
   * Calculate Levenshtein distance for fuzzy string matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  }

  /**
   * Calculate fuzzy match score (0-1, higher is better)
   */
  private fuzzyMatchScore(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    // Exact match
    if (s1 === s2) return 1;

    // Check if one contains the other
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;

    // Levenshtein distance based score
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    const score = 1 - distance / maxLength;

    return Math.max(0, score);
  }

  /**
   * Match document publisher to authority sources
   */
  async matchDocumentToAuthority(
    publisherName: string,
    countryISO?: string,
    industry?: string
  ): Promise<{
    authorityId: string;
    name: string;
    tier: number;
    matchScore: number;
    matchType: 'exact' | 'contains' | 'fuzzy' | 'none';
  } | null> {
    await this.ensureSeeded();

    const authorities = await this.getAllAuthorities();

    let bestMatch: {
      authorityId: string;
      name: string;
      tier: number;
      matchScore: number;
      matchType: 'exact' | 'contains' | 'fuzzy' | 'none';
    } | null = null;

    for (const authority of authorities) {
      // Calculate name match score
      const nameScore = this.fuzzyMatchScore(publisherName, authority.name);
      
      // Determine match type
      let matchType: 'exact' | 'contains' | 'fuzzy' | 'none' = 'none';
      if (nameScore === 1) {
        matchType = 'exact';
      } else if (nameScore >= 0.9) {
        matchType = 'contains';
      } else if (nameScore >= 0.7) {
        matchType = 'fuzzy';
      }

      // Skip if name match is too poor
      if (nameScore < 0.7) continue;

      // Check geographic coverage
      let geoBonus = 0;
      if (countryISO && authority.countries.includes(countryISO)) {
        geoBonus = 0.1;
      } else if (authority.countries.includes('XX') || authority.countries.length >= 5) {
        // Global coverage
        geoBonus = 0.05;
      }

      // Check industry coverage (exact match gets priority over 'all')
      let industryBonus = 0;
      if (industry) {
        const industryLower = industry.toLowerCase().trim();
        
        // Check for specific industry match first (higher bonus)
        const hasSpecificMatch = authority.industries.some(ind => {
          const authIndLower = ind.toLowerCase().trim();
          // Skip 'all' - we'll check it later
          if (authIndLower === 'all') return false;
          // Exact match or industry is a multi-word phrase containing the authority industry as whole word
          return authIndLower === industryLower || 
                 new RegExp(`\\b${authIndLower}\\b`).test(industryLower);
        });

        if (hasSpecificMatch) {
          industryBonus = 0.1; // Specific industry match
        } else if (authority.industries.includes('all')) {
          industryBonus = 0.05; // Global coverage fallback
        }
      }

      // Calculate final score (name match + geo + industry bonuses)
      const finalScore = Math.min(1, nameScore + geoBonus + industryBonus);

      // Update best match if this is better
      if (!bestMatch || finalScore > bestMatch.matchScore) {
        bestMatch = {
          authorityId: authority.id,
          name: authority.name,
          tier: authority.tier,
          matchScore: finalScore,
          matchType,
        };
      }
    }

    // Record hit if match found
    if (bestMatch && bestMatch.matchScore >= 0.7) {
      await this.recordHit(bestMatch.authorityId);
    }

    return bestMatch;
  }

  /**
   * Get authorities filtered by industry and geography
   */
  async getFilteredAuthorities(
    industryFilter?: string,
    countryFilter?: string
  ) {
    await this.ensureSeeded();

    const allAuthorities = await this.getAllAuthorities();

    // Filter by industry if provided
    let filtered = allAuthorities;
    if (industryFilter) {
      filtered = filtered.filter(auth => 
        auth.industries.includes('all') || 
        auth.industries.some(ind => ind.toLowerCase() === industryFilter.toLowerCase())
      );
    }

    // Filter by country if provided
    if (countryFilter) {
      filtered = filtered.filter(auth => 
        auth.countries.includes(countryFilter.toUpperCase())
      );
    }

    return filtered;
  }

  /**
   * Batch match multiple documents to authorities
   */
  async batchMatchDocuments(
    documents: Array<{
      publisher: string;
      countryISO?: string;
      industry?: string;
    }>
  ) {
    const matches = [];

    for (const doc of documents) {
      const match = await this.matchDocumentToAuthority(
        doc.publisher,
        doc.countryISO,
        doc.industry
      );
      matches.push(match);
    }

    return matches;
  }

  /**
   * Get source guidance for a specific domain
   * Returns recommended authorities with tier-based guidance
   */
  async getSourceGuidance(domain: {
    industry?: string;
    geography?: string;
    language?: string;
  }): Promise<{
    tier1Sources: Array<{ id: string; name: string; url: string }>;
    tier2Sources: Array<{ id: string; name: string; url: string }>;
    tier3Sources: Array<{ id: string; name: string; url: string }>;
    guidance: {
      minimumSourceCount: number;
      preferredTiers: number[];
      requireCorroboration: boolean;
      highAuthorityWhitelist: string[]; // Authority IDs that can stand alone
    };
  }> {
    await this.ensureSeeded();

    // Get filtered authorities by industry and geography
    const authorities = await this.getFilteredAuthorities(
      domain.industry,
      domain.geography
    );

    // Sort authorities by tier and hits (popularity)
    const sortedAuthorities = authorities.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier; // Lower tier number = higher priority
      return (b.hits || 0) - (a.hits || 0); // Higher hits = more popular
    });

    // Group by tier
    const tier1Sources = sortedAuthorities
      .filter(a => a.tier === 1)
      .map(a => ({ id: a.id, name: a.name, url: a.url }));

    const tier2Sources = sortedAuthorities
      .filter(a => a.tier === 2)
      .map(a => ({ id: a.id, name: a.name, url: a.url }));

    const tier3Sources = sortedAuthorities
      .filter(a => a.tier === 3)
      .map(a => ({ id: a.id, name: a.name, url: a.url }));

    // Build guidance
    const guidance = {
      minimumSourceCount: 2, // Evidence-first principle: 2+ source corroboration
      preferredTiers: [1, 2], // Prefer tier 1 and 2 sources
      requireCorroboration: true,
      highAuthorityWhitelist: tier1Sources.map(s => s.id), // Tier 1 can stand alone
    };

    return {
      tier1Sources,
      tier2Sources,
      tier3Sources,
      guidance,
    };
  }

  /**
   * Score a document against available authorities
   * Returns scored matches sorted by relevance
   */
  async scoreSource(
    document: {
      publisher: string;
      countryISO?: string;
      industry?: string;
    },
    authorities?: Array<{
      id: string;
      name: string;
      tier: number;
      countries: string[];
      industries: string[];
    }>
  ): Promise<{
    bestMatch: {
      authorityId: string;
      name: string;
      tier: number;
      matchScore: number;
      matchType: 'exact' | 'contains' | 'fuzzy' | 'none';
    } | null;
    allMatches: Array<{
      authorityId: string;
      name: string;
      tier: number;
      matchScore: number;
      matchType: 'exact' | 'contains' | 'fuzzy' | 'none';
    }>;
    isHighAuthority: boolean;
    requiresCorroboration: boolean;
  }> {
    await this.ensureSeeded();

    // Use provided authorities or get all
    const authoritiesToScore = authorities || await this.getAllAuthorities();

    const allMatches: Array<{
      authorityId: string;
      name: string;
      tier: number;
      matchScore: number;
      matchType: 'exact' | 'contains' | 'fuzzy' | 'none';
    }> = [];

    // Score against each authority
    for (const authority of authoritiesToScore) {
      const nameScore = this.fuzzyMatchScore(document.publisher, authority.name);

      // Geographic bonus
      let geoBonus = 0;
      if (document.countryISO && authority.countries.includes(document.countryISO)) {
        geoBonus = 0.1;
      } else if (authority.countries.includes('XX') || authority.countries.length >= 5) {
        geoBonus = 0.05;
      }

      // Industry bonus (specific match gets priority over 'all')
      let industryBonus = 0;
      if (document.industry) {
        const industryLower = document.industry.toLowerCase().trim();
        
        const hasSpecificMatch = authority.industries.some(ind => {
          const authIndLower = ind.toLowerCase().trim();
          if (authIndLower === 'all') return false;
          return authIndLower === industryLower || 
                 new RegExp(`\\b${authIndLower}\\b`).test(industryLower);
        });

        if (hasSpecificMatch) {
          industryBonus = 0.1;
        } else if (authority.industries.includes('all')) {
          industryBonus = 0.05;
        }
      }

      // Calculate final score BEFORE filtering
      const finalScore = Math.min(1, nameScore + geoBonus + industryBonus);

      // Skip only if final score is too low (allow geo/industry bonuses to lift weak name matches)
      if (finalScore < 0.5) continue;
      
      // Determine match type based on name score
      let matchType: 'exact' | 'contains' | 'fuzzy' | 'none' = 'none';
      if (nameScore === 1) {
        matchType = 'exact';
      } else if (nameScore >= 0.9) {
        matchType = 'contains';
      } else if (nameScore >= 0.7) {
        matchType = 'fuzzy';
      }

      allMatches.push({
        authorityId: authority.id,
        name: authority.name,
        tier: authority.tier,
        matchScore: finalScore,
        matchType,
      });
    }

    // Sort by score (descending) then by tier (ascending - lower is better)
    allMatches.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.tier - b.tier;
    });

    const bestMatch = allMatches.length > 0 ? allMatches[0] : null;

    // Track hit if match found
    if (bestMatch && bestMatch.matchScore >= 0.7) {
      await this.recordHit(bestMatch.authorityId);
    }

    return {
      bestMatch,
      allMatches,
      isHighAuthority: bestMatch ? bestMatch.tier === 1 : false,
      requiresCorroboration: bestMatch ? bestMatch.tier > 1 : true, // Tier 1 can stand alone
    };
  }
}

export const authorityRegistryService = new AuthorityRegistryService();
