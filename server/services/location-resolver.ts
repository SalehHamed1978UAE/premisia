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

  // Geographic keywords that indicate a place name
  private readonly GEO_KEYWORDS = [
    'in', 'at', 'from', 'located', 'based', 'opening', 'launching',
    'city', 'town', 'state', 'province', 'country', 'region', 'area',
    'market', 'location', 'territory', 'district'
  ];

  // Common place name patterns
  private readonly PLACE_PATTERNS = [
    // "in [place]" - case insensitive for place name
    /\b(?:in|at|from|based in|located in|opening in|launching in|expanding to)\s+([a-zA-Z][a-zA-Z\s,'-]+?)(?:\s+(?:market|area|region|city|town|state|country|district)|\b)/gi,
    
    // "[place] market/area/region" 
    /\b([a-zA-Z][a-zA-Z\s,'-]{2,}?)\s+(?:market|area|region|territory|district)\b/gi,
  ];

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
   * Extract potential place names from text
   */
  private extractPlaceNames(text: string): string[] {
    const candidates = new Set<string>();

    console.log(`[LocationResolver] Input text:`, text);

    for (let i = 0; i < this.PLACE_PATTERNS.length; i++) {
      const pattern = this.PLACE_PATTERNS[i];
      console.log(`[LocationResolver] Testing pattern ${i + 1}/${this.PLACE_PATTERNS.length}`);
      const matches = Array.from(text.matchAll(pattern));
      console.log(`[LocationResolver] Matches found:`, matches.length);
      for (const match of matches) {
        const placeName = match[1]?.trim();
        if (placeName && this.isLikelyPlaceName(placeName)) {
          console.log(`[LocationResolver] Added candidate: "${placeName}"`);
          candidates.add(placeName);
        } else if (placeName) {
          console.log(`[LocationResolver] Rejected candidate: "${placeName}" (failed isLikelyPlaceName)`);
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
    
    // Filter out common words that aren't places
    const excludedWords = [
      'the', 'this', 'that', 'there', 'these', 'those',
      'we', 'our', 'my', 'your', 'their', 'his', 'her',
      'business', 'model', 'canvas', 'innovation',
      'strategy', 'plan', 'analysis', 'report', 'company',
      'industry', 'sector', 'customer', 'product'
    ];

    if (excludedWords.includes(trimmed.toLowerCase())) {
      return false;
    }

    // Should be 2-50 characters
    if (trimmed.length < 2 || trimmed.length > 50) {
      return false;
    }

    // Must contain at least some letters
    if (!/[a-zA-Z]/.test(trimmed)) {
      return false;
    }

    return true;
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
