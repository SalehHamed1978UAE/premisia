import { aiClients } from './ai-clients.js';
class GeoNamesService {
    circuitBreaker = {
        failures: 0,
        lastFailureTime: 0,
        isOpen: false,
    };
    rateLimit = {
        requests: [],
        currentMinute: Math.floor(Date.now() / 60000),
    };
    telemetry = {
        geoNamesCalls: 0,
        geoNamesFailures: 0,
        llmFallbacks: 0,
        circuitOpenCount: 0,
        rateLimitHits: 0,
    };
    // Circuit breaker thresholds
    FAILURE_THRESHOLD = 3;
    CIRCUIT_TIMEOUT = 60000; // 1 minute
    RATE_LIMIT = 30; // 30 requests per minute
    /**
     * Check if circuit breaker is open
     */
    isCircuitOpen() {
        if (!this.circuitBreaker.isOpen)
            return false;
        const now = Date.now();
        if (now - this.circuitBreaker.lastFailureTime > this.CIRCUIT_TIMEOUT) {
            // Reset circuit breaker after timeout
            this.circuitBreaker.isOpen = false;
            this.circuitBreaker.failures = 0;
            return false;
        }
        return true;
    }
    /**
     * Record GeoNames failure and potentially open circuit
     */
    recordGeoNamesFailure() {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailureTime = Date.now();
        this.telemetry.geoNamesFailures++;
        if (this.circuitBreaker.failures >= this.FAILURE_THRESHOLD) {
            this.circuitBreaker.isOpen = true;
            this.telemetry.circuitOpenCount++;
            console.warn('[GeoNames] Circuit breaker opened after 3 failures');
        }
    }
    /**
     * Check rate limit and apply throttling
     */
    async checkRateLimit() {
        const currentMinute = Math.floor(Date.now() / 60000);
        if (currentMinute !== this.rateLimit.currentMinute) {
            // New minute, reset counter
            this.rateLimit.currentMinute = currentMinute;
            this.rateLimit.requests = [];
        }
        if (this.rateLimit.requests.length >= this.RATE_LIMIT) {
            // Rate limit exceeded, apply exponential backoff
            this.telemetry.rateLimitHits++;
            const backoffTime = Math.min(1000 * Math.pow(2, this.telemetry.rateLimitHits), 30000);
            console.warn(`[GeoNames] Rate limit hit, backing off for ${backoffTime}ms`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
        this.rateLimit.requests.push(Date.now());
    }
    /**
     * Determine geographic scope based on specificity
     */
    determineScope(result) {
        if (result.city && result.cityGeoNameId)
            return 'local';
        if (result.region && result.regionISO)
            return 'regional';
        if (result.country && result.countryISO2)
            return 'national';
        return 'international';
    }
    /**
     * Geocode using GeoNames API
     */
    async geocodeWithGeoNames(locationText) {
        const username = process.env.GEONAMES_USERNAME;
        if (!username) {
            throw new Error('GEONAMES_USERNAME not configured');
        }
        await this.checkRateLimit();
        this.telemetry.geoNamesCalls++;
        // Search for location
        const searchResponse = await fetch(`http://api.geonames.org/searchJSON?q=${encodeURIComponent(locationText)}&maxRows=1&username=${username}`);
        if (!searchResponse.ok) {
            throw new Error(`GeoNames search failed: ${searchResponse.statusText}`);
        }
        const searchData = await searchResponse.json();
        if (!searchData.geonames || searchData.geonames.length === 0) {
            throw new Error('No results from GeoNames');
        }
        const place = searchData.geonames[0];
        const result = {
            country: place.countryName,
            countryISO2: place.countryCode,
        };
        // Get administrative division if available
        if (place.adminName1) {
            result.region = place.adminName1;
            result.regionISO = place.adminCode1;
        }
        // Check if it's a city
        if (place.fcl === 'P' || place.fcode?.startsWith('PPL')) {
            result.city = place.name;
            result.cityGeoNameId = place.geonameId?.toString();
        }
        return result;
    }
    /**
     * Fallback geocoding using LLM
     */
    async geocodeWithLLM(locationText) {
        this.telemetry.llmFallbacks++;
        const systemPrompt = `You are a geography expert. Extract geographic information from location descriptions. Always respond in JSON format.`;
        const userMessage = `Extract geographic information from this location description: "${locationText}"

Respond with a JSON object in this exact format:
{
  "country": "full country name",
  "countryISO2": "2-letter ISO country code",
  "region": "state/province name (optional)",
  "regionISO": "state/province code (optional)",
  "city": "city name (optional)",
  "cityGeoNameId": "geonames ID if known (optional)"
}

If the location is vague or international, only provide country-level information.
If you cannot determine the location, use null for unknown fields.`;
        const { content } = await aiClients.callWithFallback({
            systemPrompt,
            userMessage,
            maxTokens: 500,
        }, 'openai');
        // Parse JSON response
        try {
            const parsed = JSON.parse(content);
            const result = {};
            if (parsed.country && parsed.countryISO2) {
                result.country = parsed.country;
                result.countryISO2 = parsed.countryISO2;
            }
            if (parsed.region) {
                result.region = parsed.region;
                result.regionISO = parsed.regionISO || undefined;
            }
            if (parsed.city) {
                result.city = parsed.city;
                result.cityGeoNameId = parsed.cityGeoNameId || undefined;
            }
            return result;
        }
        catch (error) {
            console.error('[GeoNames] Failed to parse LLM geocoding response:', error);
            // Return minimal international scope
            return {};
        }
    }
    /**
     * Reset circuit breaker on successful GeoNames call
     */
    resetCircuitBreaker() {
        if (this.circuitBreaker.failures > 0 || this.circuitBreaker.isOpen) {
            console.log('[GeoNames] Circuit breaker reset after successful call');
        }
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.lastFailureTime = 0;
    }
    /**
     * Main geocoding method with circuit breaker and fallback
     */
    async geocode(locationText) {
        let result = {};
        let provider = 'geonames';
        // Try GeoNames first if circuit is closed and API key exists
        if (!this.isCircuitOpen() && process.env.GEONAMES_USERNAME) {
            try {
                result = await this.geocodeWithGeoNames(locationText);
                // Reset circuit breaker on success
                this.resetCircuitBreaker();
            }
            catch (error) {
                console.error('[GeoNames] API failed:', error);
                this.recordGeoNamesFailure();
                // Fallback to LLM
                provider = 'llm';
                result = await this.geocodeWithLLM(locationText);
            }
        }
        else {
            // Circuit is open or no GeoNames username, use LLM directly
            provider = 'llm';
            result = await this.geocodeWithLLM(locationText);
        }
        // Determine scope
        const scope = this.determineScope(result);
        // Build Geography object
        const geography = {
            country: result.country || 'International',
            countryISO2: result.countryISO2 || 'XX',
            region: result.region,
            regionISO: result.regionISO,
            city: result.city,
            cityGeoNameId: result.cityGeoNameId,
            scope,
        };
        return geography;
    }
    /**
     * Batch geocode multiple locations efficiently
     */
    async geocodeBatch(locations) {
        const results = [];
        for (const location of locations) {
            try {
                const geography = await this.geocode(location);
                results.push(geography);
            }
            catch (error) {
                console.error(`[GeoNames] Batch geocoding failed for "${location}":`, error);
                // Add fallback international geography
                results.push({
                    country: 'International',
                    countryISO2: 'XX',
                    scope: 'international',
                });
            }
        }
        return results;
    }
    /**
     * Get geocoding telemetry
     */
    getTelemetry() {
        return { ...this.telemetry };
    }
    /**
     * Reset telemetry (useful for testing)
     */
    resetTelemetry() {
        this.telemetry = {
            geoNamesCalls: 0,
            geoNamesFailures: 0,
            llmFallbacks: 0,
            circuitOpenCount: 0,
            rateLimitHits: 0,
        };
    }
}
export const geoNamesService = new GeoNamesService();
//# sourceMappingURL=geonames-service.js.map