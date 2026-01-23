/**
 * BMC SSE Regression Test - Stream Contract Stability
 * 
 * This test validates the SSE event structure emitted by the BMC research
 * streaming endpoint to prevent silent frontend breakage.
 * 
 * Endpoint: GET /api/strategic-consultant/bmc-research/stream/:sessionId
 * 
 * Prerequisites:
 * - Development server must be running on http://localhost:5000
 * - Run `npm run dev` in a separate terminal before running these tests
 * 
 * Expected SSE Events:
 * 1. context: { type, message, progress }
 * 2. query: { type, query, purpose, queryType, progress }
 * 3. synthesis: { type, block, message, progress }
 * 4. progress: { type, message, progress }
 * 5. debug: { type, debugInput }
 * 6. complete: { type, data: { findings, searchQueriesUsed, versionNumber, sourcesAnalyzed, timeElapsed, nextUrl } }
 * 7. error: { type, error }
 * 
 * Critical Field: nextUrl must match pattern "/strategy-workspace/decisions/{sessionId}/{versionNumber}"
 * This ensures frontend can navigate to the correct decision page after BMC research completes.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../server/db';
import { strategicUnderstanding, journeySessions } from '../shared/schema';
import { eq } from 'drizzle-orm';
import {
  createTestUser,
  createTestUnderstanding,
  createTestJourneySession,
  type TestUser,
  type TestUnderstanding,
  type TestJourneySession
} from './fixtures';
import { cleanupTestData } from './test-db-setup';
import http from 'http';

interface SSEEvent {
  type: string;
  [key: string]: any;
}

/**
 * Parse SSE data from response stream
 * SSE format: "data: {JSON}\n\n"
 */
function parseSSEEvents(rawData: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = rawData.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const jsonStr = line.substring(6); // Remove "data: " prefix
        const event = JSON.parse(jsonStr);
        events.push(event);
      } catch (error) {
        console.warn('Failed to parse SSE event:', line);
      }
    }
  }
  
  return events;
}

/**
 * Consume SSE stream from the endpoint
 */
function consumeSSEStream(sessionId: string, timeout: number = 30000): Promise<SSEEvent[]> {
  return new Promise((resolve, reject) => {
    const events: SSEEvent[] = [];
    let rawData = '';
    
    const timeoutHandle = setTimeout(() => {
      req.destroy();
      reject(new Error('SSE stream timeout'));
    }, timeout);
    
    const req = http.get(
      `http://localhost:5000/api/strategic-consultant/bmc-research/stream/${sessionId}`,
      (res) => {
        if (res.statusCode !== 200) {
          clearTimeout(timeoutHandle);
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }
        
        res.on('data', (chunk) => {
          rawData += chunk.toString();
          
          // Check if we received the complete event (stream ended)
          const parsedEvents = parseSSEEvents(rawData);
          const hasComplete = parsedEvents.some(e => e.type === 'complete');
          const hasError = parsedEvents.some(e => e.type === 'error');
          
          if (hasComplete || hasError) {
            clearTimeout(timeoutHandle);
            req.destroy();
            resolve(parsedEvents);
          }
        });
        
        res.on('end', () => {
          clearTimeout(timeoutHandle);
          resolve(parseSSEEvents(rawData));
        });
        
        res.on('error', (error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        });
      }
    );
    
    req.on('error', (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });
  });
}

describe('BMC SSE Regression - Stream Contract Stability', () => {
  let testUser: TestUser;
  let testUnderstanding: TestUnderstanding;
  let testJourneySession: TestJourneySession;
  let mockBMCResearcher: any;
  
  beforeAll(async () => {
    // Clean up any leftover test data
    await cleanupTestData();
    
    // Create shared test user
    testUser = await createTestUser({ id: 'test-user-bmc-sse' });
  });
  
  afterAll(async () => {
    // Clean up all test data
    await cleanupTestData();
  });
  
  beforeEach(async () => {
    // Create test data for each test
    testUnderstanding = await createTestUnderstanding({
      userInput: 'Launch a subscription-based meal planning app targeting busy professionals in urban areas',
      title: 'Test Meal Planning App BMC',
    });
    
    testJourneySession = await createTestJourneySession(
      testUnderstanding.id,
      testUser.id,
      'business_model_innovation',
      {
        status: 'in_progress',
        versionNumber: 1,
      }
    );
    
    // Mock BMCResearcher to avoid actual AI calls
    const { BMCResearcher } = await import('../server/strategic-consultant/bmc-researcher');
    
    mockBMCResearcher = vi.spyOn(BMCResearcher.prototype, 'conductBMCResearch').mockImplementation(
      async (input: string, sessionId?: string, sink?: any) => {
        // Simulate streaming events
        if (sink) {
          // Emit context event
          sink.emitContext(input.slice(0, 200));
          
          // Emit query events
          sink.emitQuery('meal planning market size', 'Research target market', 'market_size');
          sink.emitQuery('subscription pricing models', 'Analyze revenue streams', 'pricing');
          
          // Emit synthesis events
          sink.emitSynthesis('customer_segments', 'Analyzing customer segments');
          sink.emitSynthesis('value_propositions', 'Synthesizing value propositions');
          
          // Emit progress events
          sink.emitProgress('Conducting market research...', 40);
          sink.emitProgress('Analyzing competitive landscape...', 60);
          sink.emitProgress('Synthesizing findings...', 80);
        }
        
        // Return mock BMC research result
        return {
          blocks: [
            {
              blockType: 'customer_segments' as any,
              blockName: 'Customer Segments',
              description: 'Target customer groups',
              findings: [
                {
                  fact: 'Busy professionals aged 25-45',
                  citation: 'https://example.com/market-research',
                  confidence: 'high' as const,
                }
              ],
              confidence: 'strong' as const,
              strategicImplications: 'Focus on time-saving features',
              gaps: [],
              researchQueries: ['meal planning market size'],
            },
            {
              blockType: 'value_propositions' as any,
              blockName: 'Value Propositions',
              description: 'Unique value offered',
              findings: [
                {
                  fact: 'Save 5+ hours per week on meal planning',
                  citation: 'https://example.com/time-savings',
                  confidence: 'high' as const,
                }
              ],
              confidence: 'moderate' as const,
              strategicImplications: 'Emphasize time savings in marketing',
              gaps: [],
              researchQueries: ['meal planning benefits'],
            }
          ],
          sources: [
            {
              url: 'https://example.com/market-research',
              title: 'Market Research Report',
              relevance_score: 0.9,
              snippet: 'Urban professionals value convenience',
            }
          ],
          references: [
            {
              title: 'Market Research Report',
              url: 'https://example.com/market-research',
              sourceType: 'article',
              description: 'Urban professionals value convenience',
              topics: ['business model canvas', 'customer segments'],
              confidence: 0.85, // Reference confidence is numeric, not "high" | "medium" | "low"
              snippet: 'Urban professionals value convenience',
              origin: 'web_search',
            }
          ],
          overallConfidence: 0.82,
          viability: 'High viability with strong market demand',
          keyInsights: [
            'Target market has strong demand for time-saving solutions',
            'Subscription model aligns with customer preferences',
          ],
          criticalGaps: [],
          consistencyChecks: [],
          recommendations: [
            'Focus initial marketing on time savings benefit',
            'Consider tiered pricing for different user segments',
          ],
          assumptions: [],
          contradictions: [],
        };
      }
    );
  });
  
  afterEach(async () => {
    // Clean up test-specific data
    if (testJourneySession) {
      await db.delete(journeySessions).where(eq(journeySessions.id, testJourneySession.id));
    }
    if (testUnderstanding) {
      await db.delete(strategicUnderstanding).where(eq(strategicUnderstanding.id, testUnderstanding.id));
    }
    
    // Restore mocks
    vi.restoreAllMocks();
  });
  
  it('should emit all expected event types with correct structure', async () => {
    // Consume the SSE stream
    const events = await consumeSSEStream(testJourneySession.id, 30000);
    
    // Verify we received events
    expect(events.length).toBeGreaterThan(0);
    
    // Verify all events have a type field
    for (const event of events) {
      expect(event).toHaveProperty('type');
      expect(typeof event.type).toBe('string');
    }
    
    // Extract event types
    const eventTypes = events.map(e => e.type);
    
    // Verify expected event types are present
    expect(eventTypes).toContain('progress'); // Initial progress message
    expect(eventTypes).toContain('debug');    // Debug input
    
    // If mock executed successfully, we should see complete event
    const hasComplete = eventTypes.includes('complete');
    const hasError = eventTypes.includes('error');
    
    // Either complete or error should be present, but not both
    expect(hasComplete || hasError).toBe(true);
    
    // Validate event type is one of the allowed types
    const validTypes = ['context', 'query', 'synthesis', 'progress', 'debug', 'complete', 'error'];
    for (const event of events) {
      expect(validTypes).toContain(event.type);
    }
  }, 35000);
  
  it('should emit progress events with numeric progress and message', async () => {
    const events = await consumeSSEStream(testJourneySession.id, 30000);
    
    // Filter progress events
    const progressEvents = events.filter(e => e.type === 'progress');
    
    // Should have at least the initial progress event
    expect(progressEvents.length).toBeGreaterThan(0);
    
    // Validate each progress event structure
    for (const event of progressEvents) {
      expect(event).toHaveProperty('message');
      expect(typeof event.message).toBe('string');
      expect(event.message.length).toBeGreaterThan(0);
      
      expect(event).toHaveProperty('progress');
      expect(typeof event.progress).toBe('number');
      expect(event.progress).toBeGreaterThanOrEqual(0);
      expect(event.progress).toBeLessThanOrEqual(100);
    }
  }, 35000);
  
  it('should emit debug event with debugInput field', async () => {
    const events = await consumeSSEStream(testJourneySession.id, 30000);
    
    // Filter debug events
    const debugEvents = events.filter(e => e.type === 'debug');
    
    // Should have at least one debug event (sent at start of stream)
    expect(debugEvents.length).toBeGreaterThan(0);
    
    // Validate debug event structure
    for (const event of debugEvents) {
      expect(event).toHaveProperty('debugInput');
      expect(typeof event.debugInput).toBe('string');
    }
  }, 35000);
  
  it('should emit complete event with valid nextUrl and full payload', async () => {
    const events = await consumeSSEStream(testJourneySession.id, 30000);
    
    // Filter complete events
    const completeEvents = events.filter(e => e.type === 'complete');
    
    // Should have exactly one complete event
    expect(completeEvents.length).toBe(1);
    
    const completeEvent = completeEvents[0];
    
    // Validate complete event has data field
    expect(completeEvent).toHaveProperty('data');
    expect(typeof completeEvent.data).toBe('object');
    expect(completeEvent.data).not.toBeNull();
    
    const data = completeEvent.data;
    
    // Validate ALL required fields in complete.data
    
    // 1. Validate findings (must be array)
    expect(data).toHaveProperty('findings');
    expect(Array.isArray(data.findings)).toBe(true);
    
    // 2. Validate references (must be array)
    expect(data).toHaveProperty('references');
    expect(Array.isArray(data.references)).toBe(true);
    
    // 3. Validate versionNumber (must be positive number)
    expect(data).toHaveProperty('versionNumber');
    expect(typeof data.versionNumber).toBe('number');
    expect(data.versionNumber).toBeGreaterThan(0);
    
    // 4. Validate sessionId (must be non-empty string)
    expect(data).toHaveProperty('sessionId');
    expect(typeof data.sessionId).toBe('string');
    expect(data.sessionId.length).toBeGreaterThan(0);
    
    // 5. Validate timeElapsed (must be non-empty string)
    expect(data).toHaveProperty('timeElapsed');
    expect(typeof data.timeElapsed).toBe('string');
    expect(data.timeElapsed.length).toBeGreaterThan(0);
    
    // 6. Validate searchQueriesUsed (must be array)
    expect(data).toHaveProperty('searchQueriesUsed');
    expect(Array.isArray(data.searchQueriesUsed)).toBe(true);
    
    // 7. Validate sourcesAnalyzed (must be number)
    expect(data).toHaveProperty('sourcesAnalyzed');
    expect(typeof data.sourcesAnalyzed).toBe('number');
    expect(data.sourcesAnalyzed).toBeGreaterThanOrEqual(0);
    
    // 8. CRITICAL: Validate nextUrl field and pattern
    expect(data).toHaveProperty('nextUrl');
    expect(typeof data.nextUrl).toBe('string');
    
    // nextUrl must match pattern: /strategy-workspace/decisions/{sessionId}/{versionNumber}
    const expectedPattern = new RegExp(`^/strategy-workspace/decisions/[^/]+/\\d+$`);
    expect(data.nextUrl).toMatch(expectedPattern);
    
    // Verify it contains the session ID
    expect(data.nextUrl).toContain(testJourneySession.id);
    
    // Verify it contains the version number
    expect(data.nextUrl).toContain(data.versionNumber.toString());
    
    // Exact format check
    const expectedUrl = `/strategy-workspace/decisions/${testJourneySession.id}/${data.versionNumber}`;
    expect(data.nextUrl).toBe(expectedUrl);
  }, 35000);
  
  it('should emit context events with correct structure', async () => {
    const events = await consumeSSEStream(testJourneySession.id, 30000);
    
    // Filter context events (emitted by sink.emitContext)
    const contextEvents = events.filter(e => e.type === 'context');
    
    // REQUIRE at least one context event (fail if backend stops emitting them)
    expect(contextEvents.length).toBeGreaterThan(0);
    
    // Validate each context event structure
    for (const event of contextEvents) {
      expect(event).toHaveProperty('message');
      expect(typeof event.message).toBe('string');
      
      expect(event).toHaveProperty('progress');
      expect(typeof event.progress).toBe('number');
    }
  }, 35000);
  
  it('should emit query events with required fields', async () => {
    const events = await consumeSSEStream(testJourneySession.id, 30000);
    
    // Filter query events
    const queryEvents = events.filter(e => e.type === 'query');
    
    // REQUIRE at least one query event (fail if backend stops emitting them)
    expect(queryEvents.length).toBeGreaterThan(0);
    
    // Validate each query event structure
    for (const event of queryEvents) {
      expect(event).toHaveProperty('query');
      expect(typeof event.query).toBe('string');
      
      expect(event).toHaveProperty('purpose');
      expect(typeof event.purpose).toBe('string');
      
      expect(event).toHaveProperty('queryType');
      expect(typeof event.queryType).toBe('string');
      
      expect(event).toHaveProperty('progress');
      expect(typeof event.progress).toBe('number');
    }
  }, 35000);
  
  it('should emit synthesis events with block and message', async () => {
    const events = await consumeSSEStream(testJourneySession.id, 30000);
    
    // Filter synthesis events
    const synthesisEvents = events.filter(e => e.type === 'synthesis');
    
    // REQUIRE at least one synthesis event (fail if backend stops emitting them)
    expect(synthesisEvents.length).toBeGreaterThan(0);
    
    // Validate each synthesis event structure
    for (const event of synthesisEvents) {
      expect(event).toHaveProperty('block');
      expect(typeof event.block).toBe('string');
      
      expect(event).toHaveProperty('message');
      expect(typeof event.message).toBe('string');
      
      expect(event).toHaveProperty('progress');
      expect(typeof event.progress).toBe('number');
    }
  }, 35000);
  
  it('should NOT emit events with invalid types', async () => {
    const events = await consumeSSEStream(testJourneySession.id, 30000);
    
    const validTypes = ['context', 'query', 'synthesis', 'progress', 'debug', 'complete', 'error'];
    const invalidEvents = events.filter(e => !validTypes.includes(e.type));
    
    // Should have zero invalid events
    expect(invalidEvents.length).toBe(0);
  }, 35000);
  
  it('should complete the stream (end with complete or error event)', async () => {
    const events = await consumeSSEStream(testJourneySession.id, 30000);
    
    // Should have at least one event
    expect(events.length).toBeGreaterThan(0);
    
    // Last event should be either complete or error
    const lastEvent = events[events.length - 1];
    expect(['complete', 'error']).toContain(lastEvent.type);
  }, 35000);
});
