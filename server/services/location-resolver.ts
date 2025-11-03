export interface LocationCandidate {
  displayName: string;
  lat: number;
  lon: number;
  countryCode: string;
  adminLevels: {
    state?: string;
    county?: string;
    city?: string;
    country?: string;
  };
  confidence: 'high' | 'medium' | 'low';
  importance: number;
  rawQuery: string;
}

export interface GeographicQuestion {
  id: string;
  question: string;
  rawQuery: string;
  multiSelect: false;
  options: Array<{
    value: string;
    label: string;
    description: string;
    metadata: LocationCandidate;
  }>;
}

/**
 * Location Resolver Service
 * 
 * Extracts place names from text and resolves them using OpenStreetMap Nominatim API
 * Implements rate limiting (max 1 req/sec) and caching
 */
export class LocationResolverService {
  private readonly NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
  private readonly USER_AGENT = 'StrategicPlanningApp/1.0 (strategic-planning-contact@example.com)';
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second for Nominatim
  private lastRequestTime: number = 0;
  private cache: Map<string, LocationCandidate[]>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Simple rate limiter - waits to ensure 1 second between requests
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`[LocationResolver] Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Extract potential place names from text using hybrid approach:
   * 1. Keyword-driven patterns (case-insensitive) - reliable for contextual extraction
   * 2. Title-case normalization for capitalized detection
   */
  private extractPlaceNames(text: string): string[] {
    const candidates = new Set<string>();

    console.log(`[LocationResolver] Input text:`, text);

    // Step 1: Keyword-driven patterns (case-insensitive, reliable)
    const keywordPattern = /\b(?:in|at|from|based in|located in|opening in|launching in|expanding to)\s+([a-zA-Z][a-zA-Z\s,'-]+?)(?=\s+(?:market|area|region|city|town|targeting|to|for|with)|\b)/gi;
    const marketPattern = /\b([a-zA-Z][a-zA-Z\s,'-]{2,30}?)\s+(?:market|area|region|territory|district)\b/gi;
    
    [keywordPattern, marketPattern].forEach((pattern, idx) => {
      const matches = Array.from(text.matchAll(pattern));
      console.log(`[LocationResolver] Keyword pattern ${idx + 1} found ${matches.length} matches`);
      matches.forEach(match => {
        const placeName = match[1]?.trim().replace(/[^\w\s,'-]/g, '').trim();
        if (placeName && this.isLikelyPlaceName(placeName)) {
          console.log(`[LocationResolver] Added from keyword pattern: "${placeName}"`);
          candidates.add(placeName);
        }
      });
    });

    // Step 2: Title-case normalization for capitalized detection
    // Split text into words and try normalizing to Title Case
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      // Try sequences of 1, 2, 3, and 4 words
      for (let len = 1; len <= 4 && i + len <= words.length; len++) {
        const sequence = words.slice(i, i + len).join(' ');
        const cleaned = sequence.replace(/[^\w\s,'-]/g, '').trim();
        
        if (!cleaned) continue;

        // Check if already capitalized
        if (/^[A-Z]/.test(cleaned)) {
          if (this.isLikelyPlaceName(cleaned)) {
            console.log(`[LocationResolver] Added capitalized: "${cleaned}"`);
            candidates.add(cleaned);
          }
          continue;
        }

        // For lowercase sequences, normalize to Title Case
        const titleCased = this.toTitleCaseWithWhitelist(cleaned);
        
        if (titleCased && this.isLikelyPlaceName(titleCased)) {
          console.log(`[LocationResolver] Added title-cased: "${cleaned}" -> "${titleCased}"`);
          candidates.add(titleCased);
        }
      }
    }

    const placeNames = Array.from(candidates);
    console.log(`[LocationResolver] Extracted ${placeNames.length} potential place names:`, placeNames);

    return placeNames;
  }

  /**
   * Check if a candidate string is likely a place name
   */
  private isLikelyPlaceName(candidate: string): boolean {
    const trimmed = candidate.trim();
    
    // Must be 2-50 characters
    if (trimmed.length < 2 || trimmed.length > 50) {
      return false;
    }

    // Must contain at least some letters
    if (!/[a-zA-Z]/.test(trimmed)) {
      return false;
    }

    const words = trimmed.toLowerCase().split(/\s+/);
    
    // Limit to 1-5 words
    if (words.length > 5) {
      console.log(`[LocationResolver] Rejected (too many words): "${trimmed}"`);
      return false;
    }

    // Reject standalone connectors/articles
    const connectors = ['of', 'the', 'a', 'an', 'al', 'el', 'la', 'los', 'las', 'de', 'del', 'y', 'e', 'i'];
    if (words.length === 1 && connectors.includes(words[0])) {
      console.log(`[LocationResolver] Rejected (standalone connector): "${trimmed}"`);
      return false;
    }

    // Exclude common non-place words
    const excludedWords = [
      'this', 'that', 'there', 'these', 'those',
      'we', 'our', 'my', 'your', 'their', 'his', 'her', 'its',
      'business', 'model', 'canvas', 'innovation', 'company',
      'strategy', 'plan', 'analysis', 'report', 'product',
      'industry', 'sector', 'customer', 'service',
      'is', 'are', 'was', 'were', 'will', 'would', 'can', 'could',
      'should', 'be', 'been', 'being', 'have', 'has', 'had',
      'to', 'for', 'and', 'or', 'but', 'with', 'from', 'by',
      'target', 'great', 'good', 'best', 'old', 'first', 'last',
      'focuses', 'growth', 'operating', 'design'
    ];

    // Check each word - if ANY word is excluded, reject
    for (const word of words) {
      if (excludedWords.includes(word)) {
        console.log(`[LocationResolver] Rejected (excluded word "${word}"): "${trimmed}"`);
        return false;
      }
    }

    return true;
  }

  /**
   * Convert to Title Case, keeping connectors/articles lowercase
   * Only accepts sequences with valid location tokens
   */
  private toTitleCaseWithWhitelist(text: string): string | null {
    const words = text.toLowerCase().split(/\s+/);
    
    // Single words: just capitalize
    if (words.length === 1) {
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    // Whitelist of allowed lowercase connectors/articles
    const connectorWhitelist = [
      'al', 'el', 'la', 'los', 'las', 'de', 'del', 'dos', 'von', 'van', 'le',
      'san', 'santa', 'santo', 'saint', 'st', 'da', 'di', 'du',
      'of', 'the', 'a', 'an', 'y', 'e', 'i', 'und', 'et'
    ];

    // Check each word
    for (const word of words) {
      // Skip very short words that are connectors
      if (word.length < 2) {
        console.log(`[LocationResolver] Rejected title-case (single letter): "${text}"`);
        return null;
      }

      // Word must be connector (allowed lowercase) or 3+ chars
      const isConnector = connectorWhitelist.includes(word);
      const isValidLength = word.length >= 3;
      
      if (!isConnector && !isValidLength) {
        console.log(`[LocationResolver] Rejected title-case (invalid word "${word}"): "${text}"`);
        return null;
      }
    }

    // Convert to Title Case, keeping connectors lowercase
    const titleCased = words.map(word => {
      if (connectorWhitelist.includes(word)) {
        return word; // Keep connectors lowercase
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');

    console.log(`[LocationResolver] Title-cased: "${text}" -> "${titleCased}"`);
    return titleCased;
  }

  /**
   * Query Nominatim API for a place name
   */
  private async queryNominatim(query: string): Promise<LocationCandidate[]> {
    // Check cache first
    const cacheKey = query.toLowerCase();
    if (this.cache.has(cacheKey)) {
      console.log(`[LocationResolver] Cache hit for: ${query}`);
      return this.cache.get(cacheKey)!;
    }

    console.log(`[LocationResolver] Querying Nominatim for: ${query}`);

    // Rate limit to 1 req/sec
    await this.waitForRateLimit();

    try {
      const searchParams = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '5',
      });

      const response = await fetch(
        `${this.NOMINATIM_BASE_URL}/search?${searchParams}`,
        {
          headers: {
            'User-Agent': this.USER_AGENT,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const results = await response.json();

      const candidates: LocationCandidate[] = results.map((result: any) => {
        const importance = parseFloat(result.importance) || 0;
        
        return {
          displayName: result.display_name,
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
          countryCode: result.address?.country_code?.toUpperCase() || 'XX',
          adminLevels: {
            country: result.address?.country,
            state: result.address?.state,
            county: result.address?.county,
            city: result.address?.city || result.address?.town || result.address?.village,
          },
          confidence: this.calculateConfidence(importance, result.type),
          importance,
          rawQuery: query,
        };
      });

      // Cache results
      this.cache.set(cacheKey, candidates);

      console.log(`[LocationResolver] Found ${candidates.length} candidates for: ${query}`);
      return candidates;
    } catch (error) {
      console.error(`[LocationResolver] Error querying Nominatim:`, error);
      return [];
    }
  }

  /**
   * Calculate confidence score based on Nominatim importance and type
   */
  private calculateConfidence(
    importance: number,
    type: string
  ): 'high' | 'medium' | 'low' {
    // High importance (major cities, countries)
    if (importance > 0.6) return 'high';
    
    // Medium importance (smaller cities, regions)
    if (importance > 0.3) return 'medium';
    
    // Low importance (neighborhoods, small places)
    return 'low';
  }

  /**
   * Resolve a single place name
   */
  async resolveSingle(placeName: string): Promise<{
    needsClarification: boolean;
    autoResolved?: LocationCandidate;
    question?: GeographicQuestion;
  }> {
    const candidates = await this.queryNominatim(placeName);

    if (candidates.length === 0) {
      // No results found
      return { needsClarification: false };
    }

    // ALWAYS ask for clarification if there are multiple candidates
    if (candidates.length > 1) {
      console.log(`[LocationResolver] Multiple candidates (${candidates.length}) for: ${placeName} - asking for clarification`);
      return {
        needsClarification: true,
        question: this.createGeographicQuestion(placeName, candidates),
      };
    }

    // Single candidate - auto-resolve only if high confidence (importance >= 0.85)
    const candidate = candidates[0];
    if (candidate.importance >= 0.85) {
      console.log(`[LocationResolver] Auto-resolved: ${placeName} → ${candidate.displayName} (importance: ${candidate.importance})`);
      return {
        needsClarification: false,
        autoResolved: candidate,
      };
    }

    // Single candidate but low confidence - still ask
    console.log(`[LocationResolver] Low confidence (${candidate.importance}) for: ${placeName} - asking for clarification`);
    return {
      needsClarification: true,
      question: this.createGeographicQuestion(placeName, [candidate]),
    };
  }

  /**
   * Resolve all place names in text
   */
  async resolveAll(text: string): Promise<{
    autoResolved: LocationCandidate[];
    questions: GeographicQuestion[];
  }> {
    const placeNames = this.extractPlaceNames(text);
    
    if (placeNames.length === 0) {
      console.log(`[LocationResolver] No place names found in text`);
      return { autoResolved: [], questions: [] };
    }

    const autoResolved: LocationCandidate[] = [];
    const questions: GeographicQuestion[] = [];

    for (const placeName of placeNames) {
      const result = await this.resolveSingle(placeName);
      
      if (result.autoResolved) {
        autoResolved.push(result.autoResolved);
      } else if (result.question) {
        questions.push(result.question);
      }
    }

    return { autoResolved, questions };
  }

  /**
   * Create a clarification question for ambiguous location
   */
  private createGeographicQuestion(
    placeName: string,
    candidates: LocationCandidate[]
  ): GeographicQuestion {
    // Take top 3 most relevant candidates
    const topCandidates = candidates
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 3);

    return {
      id: `geo_${placeName.toLowerCase().replace(/\s+/g, '_')}`,
      question: `Which "${placeName}" do you mean?`,
      rawQuery: placeName,
      multiSelect: false,
      options: topCandidates.map((candidate, idx) => ({
        value: `location_${idx}`,
        label: this.formatLocationLabel(candidate),
        description: this.formatLocationDescription(candidate),
        metadata: candidate,
      })),
    };
  }

  /**
   * Format location for display label
   */
  private formatLocationLabel(candidate: LocationCandidate): string {
    const parts: string[] = [];
    
    if (candidate.adminLevels.city) {
      parts.push(candidate.adminLevels.city);
    }
    
    if (candidate.adminLevels.state) {
      parts.push(candidate.adminLevels.state);
    }
    
    if (candidate.adminLevels.country) {
      parts.push(candidate.adminLevels.country);
    }

    return parts.join(', ') || candidate.displayName.split(',').slice(0, 2).join(',');
  }

  /**
   * Format location description with coordinates
   */
  private formatLocationDescription(candidate: LocationCandidate): string {
    const parts: string[] = [];
    
    if (candidate.adminLevels.county) {
      parts.push(candidate.adminLevels.county);
    }
    
    parts.push(`${candidate.countryCode}`);
    parts.push(`(${candidate.lat.toFixed(4)}, ${candidate.lon.toFixed(4)})`);

    return parts.join(' • ');
  }

  /**
   * Clear cache (for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const locationResolver = new LocationResolverService();
