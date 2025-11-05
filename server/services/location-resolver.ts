import { RequestThrottler } from '../utils/request-throttler.js';

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
  multiSelect: boolean;
  options: Array<{
    value: string;
    label: string;
    description: string;
    metadata: LocationCandidate;
  }>;
  allowManualEntry: boolean;
  manualEntryPlaceholder?: string;
}

interface NGram {
  text: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Location Resolver Service - Geocoder-First Approach
 * 
 * Uses n-gram generation and geocoder confidence as the primary filter
 * instead of pattern matching. Queries OpenStreetMap Nominatim API
 * for all n-grams and filters by importance threshold (≥0.6).
 */
export class LocationResolverService {
  private readonly NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
  private readonly USER_AGENT = 'StrategicPlanningApp/1.0 (strategic-planning-contact@example.com)';
  private readonly IMPORTANCE_THRESHOLD = 0.6;
  
  private cache: Map<string, LocationCandidate[]>;
  private throttler: RequestThrottler;

  constructor() {
    this.cache = new Map();
    this.throttler = new RequestThrottler({
      maxConcurrent: 1,
      delayBetweenBatches: 1000, // 1 second for Nominatim
      maxRetries: 3,
      initialRetryDelay: 1000
    });
  }

  /**
   * Generate n-grams (1-4 words) with span tracking
   * Extracts alphabetic tokens treating punctuation as boundaries
   * Requires at least 3 alphabetic characters (not counting spaces)
   */
  private generateNGrams(text: string): NGram[] {
    const ngrams: NGram[] = [];
    
    // Extract alphabetic tokens with their positions
    const tokenPattern = /[A-Za-z]+/g;
    const tokens: Array<{ word: string; index: number }> = [];
    
    let match;
    while ((match = tokenPattern.exec(text)) !== null) {
      tokens.push({
        word: match[0],
        index: match.index
      });
    }
    
    // Generate n-grams of length 1-4
    for (let i = 0; i < tokens.length; i++) {
      for (let len = 1; len <= 4 && i + len <= tokens.length; len++) {
        const slice = tokens.slice(i, i + len);
        const ngramText = slice.map(t => t.word).join(' ');
        
        // Count alphabetic characters (excluding spaces)
        const alphaCount = ngramText.replace(/[^a-zA-Z]/g, '').length;
        if (alphaCount < 3) {
          continue;
        }
        
        const startIndex = slice[0].index;
        const lastToken = slice[slice.length - 1];
        const endIndex = lastToken.index + lastToken.word.length;
        
        ngrams.push({
          text: ngramText,
          startIndex,
          endIndex
        });
      }
    }
    
    console.log(`[LocationResolver] Generated ${ngrams.length} n-grams (≥3 alpha chars, alphabetic tokens only)`);
    
    return ngrams;
  }

  /**
   * Simple title case conversion
   */
  private toTitleCase(text: string): string {
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Geocode a single query (no rate limiting - handled by throttler)
   */
  private async geocode(query: string): Promise<LocationCandidate[]> {
    // Check cache first
    const cacheKey = query.toLowerCase();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const searchParams = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '5',
        'accept-language': 'en',
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
          confidence: this.calculateConfidence(importance),
          importance,
          rawQuery: query,
        };
      });

      // Cache the result
      this.cache.set(cacheKey, candidates);

      return candidates;
    } catch (error) {
      console.error(`[LocationResolver] Error geocoding "${query}":`, error);
      return [];
    }
  }

  /**
   * Calculate confidence score based on Nominatim importance
   */
  private calculateConfidence(importance: number): 'high' | 'medium' | 'low' {
    if (importance > 0.6) return 'high';
    if (importance > 0.3) return 'medium';
    return 'low';
  }

  /**
   * Merge overlapping n-gram hits, keeping the best candidate per span
   */
  private mergeOverlapping(hits: Array<{ ngram: NGram; candidate: LocationCandidate }>): LocationCandidate[] {
    if (hits.length === 0) return [];

    // Sort by start index
    const sorted = hits.sort((a, b) => a.ngram.startIndex - b.ngram.startIndex);
    
    const merged: LocationCandidate[] = [];
    let i = 0;
    
    while (i < sorted.length) {
      let best = sorted[i];
      let j = i + 1;
      
      // Find all overlapping candidates
      while (j < sorted.length && sorted[j].ngram.startIndex < best.ngram.endIndex) {
        // Keep the one with higher importance
        if (sorted[j].candidate.importance > best.candidate.importance) {
          best = sorted[j];
        } else if (sorted[j].candidate.importance === best.candidate.importance) {
          // Tie-breaker: prefer longer phrase
          if (sorted[j].ngram.text.length > best.ngram.text.length) {
            best = sorted[j];
          }
        }
        j++;
      }
      
      merged.push(best.candidate);
      i = j;
    }

    // Deduplicate by display name
    const unique = new Map<string, LocationCandidate>();
    for (const candidate of merged) {
      const key = candidate.displayName.toLowerCase();
      if (!unique.has(key) || candidate.importance > unique.get(key)!.importance) {
        unique.set(key, candidate);
      }
    }
    
    return Array.from(unique.values());
  }

  /**
   * Main API: Extract and resolve locations using geocoder-first approach
   */
  async extractAndResolveLocations(text: string): Promise<LocationCandidate[]> {
    try {
      console.log(`[LocationResolver] Starting geocoder-first extraction for text:`, text);

      // Step 1: Generate n-grams
      const ngrams = this.generateNGrams(text);
      
      if (ngrams.length === 0) {
        console.log(`[LocationResolver] No valid n-grams generated`);
        return [];
      }

      // Step 2: Geocode all n-grams (with throttling and caching)
      const tasks = ngrams.map(ngram => async () => {
        // Try raw query
        let candidates = await this.geocode(ngram.text);
        
        // If failed, try title-cased
        if (candidates.length === 0) {
          const titleCased = this.toTitleCase(ngram.text);
          if (titleCased !== ngram.text) {
            candidates = await this.geocode(titleCased);
          }
        }
        
        return { ngram, candidates };
      });

      // Provide fallback for failed tasks to prevent blocking the entire flow
      const results = await this.throttler.throttleAll(
        tasks,
        (taskIndex) => ({ ngram: ngrams[taskIndex], candidates: [] })
      );
      
      // Step 3: Filter by importance threshold (≥0.6)
      const strongHits = results.flatMap(({ ngram, candidates }) =>
        candidates
          .filter(c => c.importance >= this.IMPORTANCE_THRESHOLD)
          .map(c => ({ ngram, candidate: c }))
      );

      console.log(`[LocationResolver] Found ${strongHits.length} strong hits (importance ≥ ${this.IMPORTANCE_THRESHOLD})`);

      // Step 4: Merge overlapping candidates
      const locations = this.mergeOverlapping(strongHits);
      
      console.log(`[LocationResolver] Final result: ${locations.length} locations`);
      return locations;
    } catch (error: any) {
      console.error('[LocationResolver] extractAndResolveLocations failed completely, returning empty array:', error.message);
      return [];
    }
  }

  /**
   * Resolve a single place name (legacy compatibility)
   */
  async resolveSingle(placeName: string): Promise<{
    needsClarification: boolean;
    autoResolved?: LocationCandidate;
    question?: GeographicQuestion;
  }> {
    const candidates = await this.geocode(placeName);

    if (candidates.length === 0) {
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
   * Resolve all place names in text (legacy compatibility - now uses extractAndResolveLocations)
   */
  async resolveAll(text: string): Promise<{
    autoResolved: LocationCandidate[];
    questions: GeographicQuestion[];
  }> {
    try {
      const locations = await this.extractAndResolveLocations(text);
      
      console.log(`[LocationResolver] resolveAll found ${locations.length} high-confidence locations`);
      
      // Only show disambiguation UI if 2+ distinct high-confidence candidates
      if (locations.length >= 2) {
        // Create a single question asking which location(s) they mean
        const question: GeographicQuestion = {
          id: 'geo_multiple_locations',
          question: `We found multiple locations in your input. Which one(s) are relevant?`,
          rawQuery: text,
          multiSelect: true,  // Allow selecting multiple
          options: locations.map((candidate, idx) => ({
            value: `location_${idx}`,
            label: this.formatLocationLabel(candidate),
            description: this.formatLocationDescription(candidate),
            metadata: candidate,
          })),
          allowManualEntry: true,
          manualEntryPlaceholder: 'Type the full city + country (e.g., "Madinat al Riyadh, Saudi Arabia")',
        };
        
        return {
          autoResolved: [],
          questions: [question]
        };
      }
      
      // 0 or 1 location - auto-resolve
      return {
        autoResolved: locations,
        questions: []
      };
    } catch (error: any) {
      console.error('[LocationResolver] resolveAll failed, returning empty result:', error.message);
      return {
        autoResolved: [],
        questions: []
      };
    }
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
      allowManualEntry: true,
      manualEntryPlaceholder: 'Type the full city + country (e.g., "Madinat al Riyadh, Saudi Arabia")',
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
