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
}

export const authorityRegistryService = new AuthorityRegistryService();
