import crypto from 'crypto';
import type { Finding, Source } from './market-researcher';

export type ValidationStrength = 'STRONG' | 'MODERATE' | 'WEAK';

export interface ValidationResult {
  claim: string;
  strength: ValidationStrength;
  sourceCount: number;
  recencyMonths: number;
  hasCounterEvidence: boolean;
  contradicts: boolean;
  details: string;
}

export interface CounterEvidence {
  found: boolean;
  contradicts: boolean;
  summary: string;
}

interface RecencyCheck {
  months: number;
  threshold: number;
  isRecent: boolean;
}

interface Claim {
  text: string;
  sources: string[];
  domain: string;
}

export class SourceValidator {
  private cache: Map<string, ValidationResult>;

  constructor() {
    this.cache = new Map();
  }

  async validateFindings(findings: Finding[], sources: Source[]): Promise<ValidationResult[]> {
    const claims = this.extractClaims(findings);
    
    const validationPromises = claims.map(async (claim) => {
      const cacheKey = this.generateFingerprint(claim.text);
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
      }
      
      const result = await this.validate(claim, sources);
      this.cache.set(cacheKey, result);
      return result;
    });

    return Promise.all(validationPromises);
  }

  private extractClaims(findings: Finding[]): Claim[] {
    const claims: Claim[] = [];

    for (const finding of findings) {
      const text = finding.fact;
      
      if (this.isValidatableClaim(text)) {
        claims.push({
          text,
          sources: [finding.citation],
          domain: this.detectDomain(text),
        });
      }
    }

    return claims;
  }

  private isValidatableClaim(text: string): boolean {
    const patterns = {
      quantitative: /\d+%|\d+\s*(million|billion|thousand)|\$\d+|(\d+)-(\d+)%/i,
      marketSizing: /market|revenue|growth|size|worth|valued at/i,
      competitive: /competitor|market share|dominant|leader|position/i,
      strategic: /should|recommend|must|critical|essential|key to success/i,
    };

    return Object.values(patterns).some(pattern => pattern.test(text));
  }

  private detectDomain(text: string): string {
    if (/\b(AI|machine learning|ML|artificial intelligence|GPT|LLM)\b/i.test(text)) {
      return 'AI';
    }
    if (/\b(market|revenue|sales|growth rate)\b/i.test(text)) {
      return 'market data';
    }
    if (/\b(regulation|compliance|law|legal|policy)\b/i.test(text)) {
      return 'regulation';
    }
    if (/\b(technology|software|platform|cloud|SaaS)\b/i.test(text)) {
      return 'technology';
    }
    return 'default';
  }

  private async validate(claim: Claim, allSources: Source[]): Promise<ValidationResult> {
    const [sourceCount, recency, counterEvidence] = await Promise.all([
      this.checkSourceCount(claim, allSources),
      this.checkRecency(claim),
      this.findCounterEvidence(claim),
    ]);

    const strength = this.calculateStrength(sourceCount, recency, counterEvidence);
    const details = this.buildDetails(sourceCount, recency, counterEvidence);

    return {
      claim: claim.text,
      strength,
      sourceCount,
      recencyMonths: recency.months,
      hasCounterEvidence: counterEvidence.found,
      contradicts: counterEvidence.contradicts,
      details,
    };
  }

  private async checkSourceCount(claim: Claim, allSources: Source[]): Promise<number> {
    const claimSources = new Set(claim.sources);
    
    for (const source of allSources) {
      const sourceText = `${source.title} ${source.url}`.toLowerCase();
      const claimKeywords = claim.text
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 4);
      
      const matchCount = claimKeywords.filter(kw => sourceText.includes(kw)).length;
      if (matchCount >= 3) {
        claimSources.add(source.url);
      }
    }

    return claimSources.size;
  }

  private async checkRecency(claim: Claim): Promise<RecencyCheck> {
    const recencyThresholds: Record<string, number> = {
      'AI': 6,
      'technology': 12,
      'market data': 18,
      'regulation': 12,
      'default': 24,
    };

    const threshold = recencyThresholds[claim.domain] || recencyThresholds['default'];
    
    const yearMatch = claim.text.match(/\b(202[0-5]|201[0-9])\b/);
    if (!yearMatch) {
      return {
        months: 999,
        threshold,
        isRecent: false,
      };
    }

    const year = parseInt(yearMatch[0]);
    const currentYear = new Date().getFullYear();
    const monthsSince = (currentYear - year) * 12;

    return {
      months: monthsSince,
      threshold,
      isRecent: monthsSince <= threshold,
    };
  }

  private async findCounterEvidence(claim: Claim): Promise<CounterEvidence> {
    try {
      const query = this.buildCounterQuery(claim.text);
      
      const response = await fetch('http://localhost:5000/api/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        return { found: false, contradicts: false, summary: 'No counter-evidence search performed' };
      }

      const data = await response.json();
      const results = data.organic || [];

      if (results.length === 0) {
        return { found: false, contradicts: false, summary: 'No counter-evidence found' };
      }

      const contradictory = results.some((r: any) => 
        /\b(however|but|contrary|actually|incorrect|debunked|myth)\b/i.test(r.snippet || '')
      );

      return {
        found: true,
        contradicts: contradictory,
        summary: results.slice(0, 2).map((r: any) => r.title).join('; '),
      };
    } catch (error) {
      console.error('Counter-evidence search failed:', error);
      return { found: false, contradicts: false, summary: 'Search error' };
    }
  }

  private buildCounterQuery(claimText: string): string {
    if (/\b(should|recommend|must|critical)\b/i.test(claimText)) {
      const action = claimText.match(/\b(adopt|implement|build|use|deploy)\s+(\w+)/i);
      if (action && action[2]) {
        return `risks of ${action[2]} alternatives criticism`;
      }
      return `${claimText.substring(0, 50)} risks alternatives`;
    }

    return `${claimText.substring(0, 60)} criticism rebuttal contrary evidence`;
  }

  private calculateStrength(
    sourceCount: number,
    recency: RecencyCheck,
    counterEvidence: CounterEvidence
  ): ValidationStrength {
    let score = 0;

    if (sourceCount >= 3) score += 40;
    else if (sourceCount === 2) score += 20;

    if (recency.isRecent) score += 30;
    else if (recency.months <= recency.threshold * 2) score += 15;

    if (counterEvidence.contradicts) score -= 30;

    if (score >= 50) return 'STRONG';
    if (score >= 25) return 'MODERATE';
    return 'WEAK';
  }

  private buildDetails(
    sourceCount: number,
    recency: RecencyCheck,
    counterEvidence: CounterEvidence
  ): string {
    const parts: string[] = [];
    
    parts.push(`Based on ${sourceCount} source${sourceCount !== 1 ? 's' : ''}`);
    
    if (recency.months < 999) {
      const years = Math.floor(recency.months / 12);
      if (years > 0) {
        parts.push(`published ~${years} year${years !== 1 ? 's' : ''} ago`);
      } else {
        parts.push('recent data');
      }
    } else {
      parts.push('publication date unclear');
    }
    
    if (counterEvidence.found) {
      if (counterEvidence.contradicts) {
        parts.push('⚠️ contradictory evidence found');
      } else {
        parts.push('counter-evidence reviewed');
      }
    }

    return parts.join(', ');
  }

  private generateFingerprint(text: string): string {
    const normalized = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    return crypto
      .createHash('md5')
      .update(normalized)
      .digest('hex')
      .substring(0, 16);
  }
}
