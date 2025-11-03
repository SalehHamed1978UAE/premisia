import { RequestThrottler } from '../utils/request-throttler';

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
  private readonly throttler: RequestThrottler;
  private cache: Map<string, LocationCandidate[]>;

  // Geographic keywords that indicate a place name
  private readonly GEO_KEYWORDS = [
    'in', 'at', 'from', 'located', 'based', 'opening', 'launching',
    'city', 'town', 'state', 'province', 'country', 'region', 'area',
    'market', 'location', 'territory', 'district'
  ];

  // Common place name patterns
  private readonly PLACE_PATTERNS = [
    // "in Portland" or "in Portland, Oregon"
    /\b(?:in|at|from|based in|located in|opening in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)*)/g,
    // "Portland market" or "Portland, Oregon market"
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)?)\s+(?:market|area|region|territory)/g,
    // Standalone capitalized place names (more aggressive)
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g,
  ];

  constructor() {
    // Nominatim requires max 1 request per second
    this.throttler = new RequestThrottler(1000);
    this.cache = new Map();
  }

  /**
   * Extract potential place names from text
   */
  private extractPlaceNames(text: string): string[] {
    const candidates = new Set<string>();

    for (const pattern of this.PLACE_PATTERNS) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const placeName = match[1]?.trim();
        if (placeName && this.isLikelyPlaceName(placeName)) {
          candidates.add(placeName);
        }
      }
    }

    return Array.from(candidates);
  }

  /**
   * Check if a candidate string is likely a place name
   */
  private isLikelyPlaceName(candidate: string): boolean {
    // Filter out common words that aren't places
    const excludedWords = [
      'The', 'This', 'That', 'There', 'These', 'Those',
      'We', 'Our', 'My', 'Your', 'Their',
      'Business', 'Model', 'Canvas', 'Innovation',
      'Strategy', 'Plan', 'Analysis', 'Report'
    ];

    if (excludedWords.includes(candidate)) {
      return false;
    }

    // Must be capitalized
    if (!/^[A-Z]/.test(candidate)) {
      return false;
    }

    // Should be 2-50 characters
    if (candidate.length < 2 || candidate.length > 50) {
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
    await this.throttler.throttle();

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

    if (candidates.length === 1 && candidates[0].confidence === 'high') {
      // Single high-confidence match - auto-resolve
      console.log(`[LocationResolver] Auto-resolved: ${placeName} → ${candidates[0].displayName}`);
      return {
        needsClarification: false,
        autoResolved: candidates[0],
      };
    }

    // Multiple candidates or low confidence - need clarification
    return {
      needsClarification: true,
      question: this.createGeographicQuestion(placeName, candidates),
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
      return { autoResolved: [], questions: [] };
    }

    console.log(`[LocationResolver] Extracted ${placeNames.length} potential place names:`, placeNames);

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
