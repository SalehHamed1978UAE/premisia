import { aiClients } from './ai-clients.js';
import type { DomainContext } from './domain-extraction-service.js';

// PESTLE domain enum
export type PESTLEDomain = 
  | 'POLITICAL' 
  | 'ECONOMIC' 
  | 'SOCIAL' 
  | 'TECHNOLOGICAL' 
  | 'LEGAL' 
  | 'ENVIRONMENTAL';

// Time horizon enum
export type TimeHorizon = 'short-term' | 'medium-term' | 'long-term';

// PESTLE claim structure
export interface PESTLEClaim {
  domain: PESTLEDomain;
  claim: string;
  timeHorizon: TimeHorizon;
  rationale?: string;
  sources?: string[]; // Will be populated by evidence extraction
}

// PESTLE factors grouped by domain
export interface PESTLEFactors {
  political: PESTLEClaim[];
  economic: PESTLEClaim[];
  social: PESTLEClaim[];
  technological: PESTLEClaim[];
  legal: PESTLEClaim[];
  environmental: PESTLEClaim[];
}

/**
 * Service for generating PESTLE claims using LLM
 * Evidence-first principle: LLM generates claims that will be validated against sources
 */
export class PESTLEClaimsService {
  /**
   * Generate PESTLE claims based on domain context
   */
  async generateClaims(domain: DomainContext): Promise<PESTLEFactors> {
    const userMessage = this.buildPESTLEPrompt(domain);
    
    const systemPrompt = `You are a strategic analyst specializing in PESTLE analysis. Your role is to identify macro-environmental factors that could impact businesses based on their industry, geography, and context.

IMPORTANT: You must output valid JSON only. No markdown, no code blocks, no explanations.

For each PESTLE domain, generate 2-4 specific, evidence-based claims about trends that could impact the business. Each claim must:
1. Be specific and actionable (not generic)
2. Be relevant to the industry and geography
3. Include a time horizon (short-term: 0-1 year, medium-term: 1-3 years, long-term: 3+ years)
4. Include rationale explaining the potential impact

PESTLE domains:
- POLITICAL: Government policies, political stability, trade regulations, tax policies
- ECONOMIC: Economic growth, inflation, exchange rates, unemployment, market conditions
- SOCIAL: Demographics, cultural trends, consumer behavior, lifestyle changes
- TECHNOLOGICAL: Innovation, automation, digital transformation, emerging technologies
- LEGAL: Laws, regulations, compliance requirements, intellectual property
- ENVIRONMENTAL: Climate change, sustainability, environmental regulations, resource availability

Output must be valid JSON in this exact structure:
{
  "political": [{"domain": "POLITICAL", "claim": "...", "timeHorizon": "short-term|medium-term|long-term", "rationale": "..."}],
  "economic": [...],
  "social": [...],
  "technological": [...],
  "legal": [...],
  "environmental": [...]
}`;
    
    try {
      const response = await aiClients.callWithFallback({
        systemPrompt,
        userMessage,
        maxTokens: 4096
      });

      // Parse LLM response
      const parsed = this.parsePESTLEResponse(response.content);
      
      return parsed;
    } catch (error) {
      console.error('Error generating PESTLE claims:', error);
      throw new Error('Failed to generate PESTLE claims');
    }
  }

  /**
   * Build prompt for PESTLE analysis based on domain context
   */
  private buildPESTLEPrompt(domain: DomainContext): string {
    let prompt = `Generate a PESTLE analysis for the following business context:\n\n`;
    
    if (domain.industry) {
      prompt += `Industry: ${domain.industry}\n`;
    }
    
    if (domain.geography) {
      prompt += `Geography: ${domain.geography}\n`;
    }
    
    if (domain.language && domain.language !== 'en') {
      prompt += `Primary Language/Market: ${domain.language}\n`;
    }
    
    if (domain.regulatory && domain.regulatory.length > 0) {
      prompt += `Regulatory Context: ${domain.regulatory.join(', ')}\n`;
    }
    
    if (domain.context && domain.context.length > 0) {
      prompt += `\nBusiness Context:\n${domain.context.slice(0, 5).map(c => `- ${c}`).join('\n')}\n`;
    }
    
    if (domain.assumptions && domain.assumptions.length > 0) {
      prompt += `\nCurrent Assumptions:\n${domain.assumptions.slice(0, 5).map(a => `- ${a}`).join('\n')}\n`;
    }
    
    prompt += `\nGenerate 2-4 specific, evidence-based claims for each PESTLE domain that could impact this business. Focus on trends that are:
1. Relevant to the specific industry and geography
2. Backed by observable market trends or policy changes
3. Actionable for strategic planning

Return valid JSON only. No markdown, no code blocks.`;
    
    return prompt;
  }

  /**
   * Parse LLM response into PESTLE factors
   */
  private parsePESTLEResponse(text: string): PESTLEFactors {
    try {
      // Remove markdown code blocks if present
      let cleanedText = text.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\n/, '').replace(/\n```$/, '');
      }
      
      const parsed = JSON.parse(cleanedText);
      
      // Validate structure
      const validatedFactors: PESTLEFactors = {
        political: this.validateClaims(parsed.political || [], 'POLITICAL'),
        economic: this.validateClaims(parsed.economic || [], 'ECONOMIC'),
        social: this.validateClaims(parsed.social || [], 'SOCIAL'),
        technological: this.validateClaims(parsed.technological || [], 'TECHNOLOGICAL'),
        legal: this.validateClaims(parsed.legal || [], 'LEGAL'),
        environmental: this.validateClaims(parsed.environmental || [], 'ENVIRONMENTAL')
      };
      
      return validatedFactors;
    } catch (error) {
      console.error('Error parsing PESTLE response:', error);
      console.error('Raw text:', text);
      throw new Error('Failed to parse PESTLE response');
    }
  }

  /**
   * Validate and normalize claims for a specific domain
   */
  private validateClaims(claims: any[], domain: PESTLEDomain): PESTLEClaim[] {
    if (!Array.isArray(claims)) {
      return [];
    }
    
    return claims
      .filter(c => c.claim && c.timeHorizon)
      .map(c => ({
        domain,
        claim: c.claim.trim(),
        timeHorizon: this.normalizeTimeHorizon(c.timeHorizon),
        rationale: c.rationale?.trim(),
        sources: []
      }));
  }

  /**
   * Normalize time horizon to valid enum value
   */
  private normalizeTimeHorizon(horizon: string): TimeHorizon {
    const normalized = horizon.toLowerCase().trim();
    if (normalized.includes('short')) return 'short-term';
    if (normalized.includes('medium') || normalized.includes('mid')) return 'medium-term';
    if (normalized.includes('long')) return 'long-term';
    return 'medium-term'; // Default fallback
  }

  /**
   * Convert PESTLE factors to flat array of claims
   */
  flattenClaims(factors: PESTLEFactors): PESTLEClaim[] {
    return [
      ...factors.political,
      ...factors.economic,
      ...factors.social,
      ...factors.technological,
      ...factors.legal,
      ...factors.environmental
    ];
  }

  /**
   * Group claims by domain
   */
  groupByDomain(claims: PESTLEClaim[]): PESTLEFactors {
    const factors: PESTLEFactors = {
      political: [],
      economic: [],
      social: [],
      technological: [],
      legal: [],
      environmental: []
    };
    
    for (const claim of claims) {
      switch (claim.domain) {
        case 'POLITICAL':
          factors.political.push(claim);
          break;
        case 'ECONOMIC':
          factors.economic.push(claim);
          break;
        case 'SOCIAL':
          factors.social.push(claim);
          break;
        case 'TECHNOLOGICAL':
          factors.technological.push(claim);
          break;
        case 'LEGAL':
          factors.legal.push(claim);
          break;
        case 'ENVIRONMENTAL':
          factors.environmental.push(claim);
          break;
      }
    }
    
    return factors;
  }
}

// Export singleton instance
export const pestleClaimsService = new PESTLEClaimsService();
