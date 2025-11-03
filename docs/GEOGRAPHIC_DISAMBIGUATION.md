# Geographic Disambiguation System

## Overview

The Geographic Disambiguation system automatically detects and resolves ambiguous place names in user input during the journey intake flow. It uses the OpenStreetMap Nominatim API to geocode location references and helps users clarify which specific location they mean when multiple possibilities exist.

## Architecture

### Components

1. **LocationResolver Service** (`server/services/location-resolver.ts`)
   - Extracts place names from text using regex pattern matching
   - Queries Nominatim API for geocoding candidates
   - Implements rate limiting (1 request per second)
   - Returns confidence scores for matches
   - Caches results to avoid redundant API calls

2. **Locations Database Table** (`shared/schema.ts`)
   - Stores resolved geographic locations
   - Includes coordinates, country codes, and administrative levels
   - Links to user journeys for context

3. **Integration Points**
   - `server/routes/strategic-consultant.ts`: Hooks into `/check-ambiguities` endpoint
   - `server/services/ambiguity-detector.ts`: Accepts pre-computed geographic questions
   - `server/storage.ts`: Provides CRUD operations for locations

### Data Flow

```
User Input
    ↓
1. Place Name Detection (regex)
    ↓
2. Nominatim API Query (with rate limiting)
    ↓
3. Confidence Scoring
    ↓
4. Decision Point:
   - High confidence (≥0.85) → Auto-resolve, store location
   - Low confidence (<0.85) → Generate clarification question
    ↓
5. Merge with other ambiguities
    ↓
6. Present to user via ClarificationModal
    ↓
7. Store user's selection
```

## Nominatim API Usage

### Endpoint

```
https://nominatim.openstreetmap.org/search
```

### Query Parameters

- `q`: Search query (place name)
- `format`: Response format (json)
- `limit`: Maximum results (5)
- `addressdetails`: Include address breakdown (1)

### Required Headers

```typescript
{
  'User-Agent': 'QGentic-Premisia/1.0 (Enterprise Strategic Planning Platform)'
}
```

**Important**: Nominatim requires a descriptive User-Agent header per their [usage policy](https://operations.osmfoundation.org/policies/nominatim/).

### Rate Limiting

Nominatim enforces a strict **1 request per second** limit. Our implementation uses a token bucket algorithm to respect this:

```typescript
class RateLimiter {
  private lastRequestTime: number = 0;
  private minInterval: number = 1000; // 1 second

  async wait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
}
```

### Caching Strategy

Results are cached in-memory for the lifetime of the service to avoid redundant API calls:

```typescript
private cache = new Map<string, NominatimResult[]>();

// Cache key format: "placeName"
// Cache invalidation: Service restart (acceptable for MVP)
```

## Place Name Detection

The system uses a regex-based approach to identify potential geographic references:

```typescript
const placePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:in|near|around|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
```

This pattern matches phrases like:
- "startup in Portland"
- "restaurant near Seattle"
- "office at San Francisco"

### Future Enhancements

For production, consider:
- Named Entity Recognition (NER) using models like spaCy or BERT
- Context-aware extraction (e.g., "Portland" in tech context → likely Oregon)
- Multi-language support

## Confidence Scoring

Confidence scores determine whether to auto-resolve or ask for clarification:

| Score | Meaning | Action |
|-------|---------|--------|
| ≥0.85 | High confidence | Auto-resolve, store location |
| 0.50-0.84 | Medium confidence | Ask for clarification |
| <0.50 | Low confidence | Ask for clarification |

### Score Calculation

```typescript
function calculateConfidence(results: NominatimResult[]): number {
  if (results.length === 0) return 0;
  if (results.length === 1) return 0.95;
  
  // If top 2 results are very close in importance, confidence is lower
  const importanceGap = results[0].importance - results[1].importance;
  return Math.min(0.95, 0.5 + importanceGap * 2);
}
```

## Database Schema

### Locations Table

```typescript
export const locations = pgTable('locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  rawQuery: text('raw_query').notNull(),
  displayName: text('display_name').notNull(),
  lat: text('lat').notNull(),
  lon: text('lon').notNull(),
  countryCode: varchar('country_code', { length: 2 }),
  adminLevels: jsonb('admin_levels'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Field Descriptions

- **id**: UUID primary key
- **rawQuery**: Original search term (e.g., "Portland")
- **displayName**: Full resolved name (e.g., "Portland, Multnomah County, Oregon, United States")
- **lat/lon**: Geographic coordinates as strings (decimal degrees)
- **countryCode**: ISO 3166-1 alpha-2 code (e.g., "US", "GB")
- **adminLevels**: JSONB object with state, county, etc.
  ```json
  {
    "state": "Oregon",
    "county": "Multnomah County",
    "city": "Portland"
  }
  ```

## API Integration

### Check Ambiguities Endpoint

```typescript
POST /api/strategic-consultant/check-ambiguities
```

**Flow**:
1. Extract place names from user input
2. Query Nominatim for each place name
3. Auto-resolve high-confidence matches
4. Generate questions for ambiguous matches
5. Merge with other ambiguity types (from AI detector)
6. Return combined result

**Example Response**:
```json
{
  "hasAmbiguities": true,
  "questions": [
    {
      "id": "geo_Portland",
      "question": "Which Portland do you mean?",
      "options": [
        {
          "value": "portland_or",
          "label": "Portland, Oregon, USA",
          "metadata": {
            "lat": "45.5202",
            "lon": "-122.6742",
            "countryCode": "US"
          }
        },
        {
          "value": "portland_me",
          "label": "Portland, Maine, USA",
          "metadata": {
            "lat": "43.6591",
            "lon": "-70.2568",
            "countryCode": "US"
          }
        }
      ]
    }
  ]
}
```

## Error Handling

### Network Errors

```typescript
try {
  const results = await this.queryNominatim(placeName);
} catch (error) {
  console.error('[LocationResolver] Nominatim API error:', error);
  return { questions: [], autoResolved: [] }; // Fail gracefully
}
```

### Rate Limit Exceeded

If Nominatim returns 429 (Too Many Requests):
- Our rate limiter prevents this
- If it happens, wait 2 seconds and retry once
- If retry fails, log error and continue without geographic resolution

### No Results

If Nominatim returns no results:
- Silently skip (may not be a real place name)
- Do not generate clarification question
- Log for monitoring purposes

## Usage Examples

### Example 1: Single High-Confidence Match

**Input**: "I want to open a restaurant in Tokyo"

**Process**:
1. Detect: "Tokyo"
2. Query Nominatim: Returns 1 result (Tokyo, Japan)
3. Confidence: 0.95 (high)
4. Action: Auto-resolve and store

**Result**: No clarification needed, location stored automatically

### Example 2: Multiple Matches

**Input**: "We're expanding our startup to Portland"

**Process**:
1. Detect: "Portland"
2. Query Nominatim: Returns 5+ results
3. Top candidates: Portland OR (importance 0.78), Portland ME (importance 0.62)
4. Confidence: 0.54 (medium, small gap)
5. Action: Generate clarification question

**Result**: User sees dropdown with options

### Example 3: No Match

**Input**: "Building a SaaS platform for enterprises"

**Process**:
1. No geographic patterns detected
2. Skip location resolution entirely

**Result**: Proceed directly to other ambiguity checks

## Testing

### Manual Testing

1. Test high-confidence resolution:
   ```
   Input: "opening a café in Paris"
   Expected: Auto-resolves to Paris, France
   ```

2. Test ambiguous location:
   ```
   Input: "expanding to Springfield"
   Expected: Shows multiple Springfield options
   ```

3. Test rate limiting:
   ```
   Input with 5 place names in rapid succession
   Expected: 5+ seconds total processing time (1 req/sec)
   ```

### Automated Testing

```typescript
// tests/location-resolver.test.ts
describe('LocationResolver', () => {
  it('should auto-resolve unambiguous locations', async () => {
    const result = await locationResolver.resolveSingle('Tokyo');
    expect(result.autoResolved).toHaveLength(1);
    expect(result.questions).toHaveLength(0);
  });

  it('should generate questions for ambiguous locations', async () => {
    const result = await locationResolver.resolveSingle('Portland');
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].options.length).toBeGreaterThan(1);
  });
});
```

## Performance Considerations

### Latency

- Nominatim average response time: 200-500ms
- Rate limiting adds 1s between requests
- For input with 3 place names: ~3 seconds
- Caching eliminates delays for repeated queries

### Optimization Ideas

1. **Parallel Requests**: Use multiple Nominatim instances (requires permission)
2. **Preloading**: Cache common cities on service startup
3. **Debouncing**: Group rapid requests together
4. **Self-Hosted**: Run own Nominatim instance for better control

## Maintenance

### Monitoring

Track these metrics:
- API success rate
- Average response time
- Cache hit rate
- Number of auto-resolutions vs. clarifications

### Updates

- Review Nominatim usage policy quarterly
- Update User-Agent string for major version changes
- Monitor for API changes or deprecations

## References

- [Nominatim Documentation](https://nominatim.org/release-docs/latest/)
- [Usage Policy](https://operations.osmfoundation.org/policies/nominatim/)
- [OpenStreetMap Terms](https://wiki.osmfoundation.org/wiki/Terms_of_Use)

## Future Enhancements

1. **Reverse Geocoding**: Convert coordinates to place names
2. **Proximity Filtering**: Prefer locations near user's region
3. **Context Learning**: Remember user's typical regions
4. **Multilingual Support**: Handle non-English place names
5. **Batch Processing**: Process multiple inputs efficiently
6. **Analytics**: Track which locations are most commonly ambiguous
