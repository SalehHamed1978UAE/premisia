import { db } from './db.ts';
import { strategicEntities, strategicUnderstanding } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getStrategicUnderstanding } from './services/secure-data-service';

export interface DomainContext {
  industry?: string;
  geography?: string;
  language?: string;
  regulatory?: string[];
  context: string[];
  assumptions: string[];
}

class DomainExtractionService {
  /**
   * Extract domain context from strategic understanding
   */
  async extractDomain(understandingId: string): Promise<DomainContext> {
    // Get strategic understanding using secure service
    const understandingData = await getStrategicUnderstanding(understandingId);

    if (!understandingData) {
      throw new Error(`Strategic understanding ${understandingId} not found`);
    }

    // Get entities for this understanding
    const entities = await db
      .select()
      .from(strategicEntities)
      .where(eq(strategicEntities.understandingId, understandingId));

    // Extract domain information from entities and context
    const domain: DomainContext = {
      industry: undefined,
      geography: undefined,
      language: 'en',
      regulatory: [],
      context: [],
      assumptions: [],
    };

    // Extract from understanding company context
    if (understandingData.companyContext) {
      const context = understandingData.companyContext as Record<string, any>;
      if (context.industry) domain.industry = context.industry;
      if (context.geography) domain.geography = context.geography;
      if (context.language) domain.language = context.language;
      if (context.regulatory && Array.isArray(context.regulatory)) {
        domain.regulatory = context.regulatory;
      }
    }

    // Extract from entities
    for (const entity of entities) {
      // Add to assumptions if explicit or implicit
      if (entity.type === 'explicit_assumption' || entity.type === 'implicit_implication') {
        domain.assumptions.push(entity.claim);
      }

      // Extract domain info from entity metadata
      if (entity.metadata) {
        const entityMeta = entity.metadata as Record<string, any>;
        
        // Industry extraction
        if (entityMeta.industry && !domain.industry) {
          domain.industry = entityMeta.industry;
        }

        // Geography extraction
        if (entityMeta.geography && !domain.geography) {
          domain.geography = entityMeta.geography;
        }

        // Language extraction (check multiple possible nested fields + arrays)
        if (domain.language === 'en') {
          let lang = entityMeta.language || 
                    entityMeta.originalLanguage || 
                    entityMeta.sourceMetadata?.language ||
                    entityMeta.source?.metadata?.language;
          
          // Check if evidence is an object with originalLanguage
          if (!lang && entityMeta.evidence && !Array.isArray(entityMeta.evidence)) {
            lang = entityMeta.evidence.originalLanguage || 
                   entityMeta.evidence.source?.metadata?.language;
          }
          
          // Check if evidence is an array and traverse it
          if (!lang && Array.isArray(entityMeta.evidence)) {
            for (const ev of entityMeta.evidence) {
              if (ev.originalLanguage || ev.source?.metadata?.language) {
                lang = ev.originalLanguage || ev.source?.metadata?.language;
                break;
              }
            }
          }
          
          // Check if sources is an array and traverse it
          if (!lang && Array.isArray(entityMeta.sources)) {
            for (const src of entityMeta.sources) {
              if (src.metadata?.language || src.originalLanguage) {
                lang = src.metadata?.language || src.originalLanguage;
                break;
              }
            }
          }
          
          if (lang && lang !== 'unknown') {
            domain.language = lang;
          }
        }

        // Regulatory context
        if (entityMeta.regulatory && domain.regulatory) {
          if (Array.isArray(entityMeta.regulatory)) {
            domain.regulatory.push(...entityMeta.regulatory);
          } else {
            domain.regulatory.push(entityMeta.regulatory);
          }
        }

        // General context
        if (entityMeta.context) {
          if (Array.isArray(entityMeta.context)) {
            domain.context.push(...entityMeta.context);
          } else {
            domain.context.push(entityMeta.context);
          }
        }
      }

      // Add entity source/evidence to context
      if (entity.source) {
        domain.context.push(entity.source);
      }
    }

    // Deduplicate arrays
    domain.regulatory = [...Array.from(new Set(domain.regulatory))];
    domain.context = [...Array.from(new Set(domain.context))];
    domain.assumptions = [...Array.from(new Set(domain.assumptions))];

    // Infer industry/geography from entities if not explicitly set
    if (!domain.industry) {
      domain.industry = this.inferIndustry(entities);
    }

    if (!domain.geography) {
      domain.geography = this.inferGeography(entities);
    }

    return domain;
  }

  /**
   * Infer industry from entity claims
   */
  private inferIndustry(entities: any[]): string | undefined {
    const industryKeywords: Record<string, string[]> = {
      'technology': ['software', 'ai', 'machine learning', 'saas', 'cloud', 'digital', 'tech', 'platform'],
      'finance': ['banking', 'financial', 'investment', 'fintech', 'trading', 'insurance', 'lending'],
      'healthcare': ['health', 'medical', 'pharmaceutical', 'hospital', 'patient', 'clinical', 'biotech'],
      'retail': ['retail', 'ecommerce', 'shopping', 'consumer', 'store', 'marketplace'],
      'manufacturing': ['manufacturing', 'production', 'factory', 'assembly', 'industrial', 'supply chain'],
      'energy': ['energy', 'oil', 'gas', 'renewable', 'solar', 'wind', 'power', 'utilities'],
    };

    const claimsText = entities
      .map(e => e.claim?.toLowerCase() || '')
      .join(' ');

    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      for (const keyword of keywords) {
        if (claimsText.includes(keyword)) {
          return industry;
        }
      }
    }

    return undefined;
  }

  /**
   * Infer geography from entity claims
   */
  private inferGeography(entities: any[]): string | undefined {
    const geographyKeywords: Record<string, string[]> = {
      'US': ['united states', 'america', 'us ', 'american', 'usa'],
      'GB': ['united kingdom', 'uk', 'britain', 'british', 'england', 'scotland'],
      'DE': ['germany', 'german', 'deutschland'],
      'FR': ['france', 'french', 'français'],
      'CN': ['china', 'chinese'],
      'IN': ['india', 'indian'],
      'JP': ['japan', 'japanese'],
      'global': ['global', 'worldwide', 'international'],
    };

    const claimsText = entities
      .map(e => e.claim?.toLowerCase() || '')
      .join(' ');

    for (const [geography, keywords] of Object.entries(geographyKeywords)) {
      for (const keyword of keywords) {
        if (claimsText.includes(keyword)) {
          return geography;
        }
      }
    }

    return undefined;
  }

  /**
   * Get domain summary as text for LLM prompts
   */
  getDomainSummary(domain: DomainContext): string {
    const parts: string[] = [];

    if (domain.industry) {
      parts.push(`Industry: ${domain.industry}`);
    }

    if (domain.geography) {
      parts.push(`Geography: ${domain.geography}`);
    }

    if (domain.language && domain.language !== 'en') {
      parts.push(`Language: ${domain.language}`);
    }

    if (domain.regulatory && domain.regulatory.length > 0) {
      parts.push(`Regulatory Context: ${domain.regulatory.join(', ')}`);
    }

    if (domain.assumptions.length > 0) {
      parts.push(`Key Assumptions: ${domain.assumptions.slice(0, 5).join('; ')}`);
    }

    return parts.join('\n');
  }
}

export const domainExtractionService = new DomainExtractionService();
