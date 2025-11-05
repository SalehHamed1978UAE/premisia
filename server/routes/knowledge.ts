import { Router, Request, Response } from 'express';
import { db } from '../db';
import { journeySessions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { isKnowledgeGraphEnabled, isNeo4jConfigured } from '../config';

const router = Router();

/**
 * Query parameter schema for knowledge endpoints
 */
const sessionIdQuerySchema = z.object({
  sessionId: z.string().uuid('Session ID must be a valid UUID'),
});

/**
 * GET /api/knowledge/similar-strategies?sessionId={id}
 * 
 * Returns similar strategic journeys based on location, industry, and root cause
 * Requires authentication
 * Returns empty array if Neo4j not configured
 */
router.get('/similar-strategies', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Validate query parameter
    const validation = sessionIdQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID',
        details: validation.error.errors,
      });
    }
    
    const { sessionId } = validation.data;
    
    // Check feature flag and Neo4j configuration
    if (!isKnowledgeGraphEnabled() || !isNeo4jConfigured()) {
      console.log('[KG API] Knowledge Graph disabled or not configured, returning empty results');
      return res.json({
        success: true,
        similarJourneys: [],
        message: 'Knowledge Graph not available',
      });
    }
    
    // Look up journey session from database
    const [journeySession] = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.id, sessionId))
      .limit(1);
    
    if (!journeySession) {
      return res.status(404).json({
        success: false,
        error: 'Journey session not found',
      });
    }
    
    // Import knowledge graph service
    const kgService = await import('../services/knowledge-graph-service');
    
    // Extract location/industry from accumulated context if available
    // This is a simplified approach - in production, we'd want to properly parse the context
    const context = journeySession.accumulatedContext as any;
    const locationId = context?.locationId;
    const industryId = context?.industryId;
    const rootCause = context?.insights?.primaryRootCause || context?.insights?.rootCauses?.[0];
    
    // Call getSimilarJourneys with context data
    const similarJourneys = await kgService.getSimilarJourneys({
      locationId,
      industryId,
      rootCause,
      limit: 3, // Top 3 similar journeys
    });
    
    const duration = Date.now() - startTime;
    console.log(`[KG API] Similar strategies query completed in ${duration}ms, found ${similarJourneys.length} results`);
    
    res.json({
      success: true,
      similarJourneys,
      metadata: {
        sessionId,
        queryTime: duration,
        filters: {
          locationId,
          industryId,
          rootCause: rootCause ? '(root cause matched)' : undefined,
        },
      },
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[KG API] Error fetching similar strategies (${duration}ms):`, error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch similar strategies',
      message: error.message,
    });
  }
});

/**
 * GET /api/knowledge/incentives?sessionId={id}
 * 
 * Returns applicable incentives based on jurisdiction and industry
 * Requires authentication
 * Returns empty array if Neo4j not configured
 */
router.get('/incentives', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Validate query parameter
    const validation = sessionIdQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID',
        details: validation.error.errors,
      });
    }
    
    const { sessionId } = validation.data;
    
    // Check feature flag and Neo4j configuration
    if (!isKnowledgeGraphEnabled() || !isNeo4jConfigured()) {
      console.log('[KG API] Knowledge Graph disabled or not configured, returning empty results');
      return res.json({
        success: true,
        incentives: [],
        message: 'Knowledge Graph not available',
      });
    }
    
    // Look up journey session from database
    const [journeySession] = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.id, sessionId))
      .limit(1);
    
    if (!journeySession) {
      return res.status(404).json({
        success: false,
        error: 'Journey session not found',
      });
    }
    
    // Import knowledge graph service
    const kgService = await import('../services/knowledge-graph-service');
    
    // Extract jurisdiction and industry from accumulated context if available
    const context = journeySession.accumulatedContext as any;
    const jurisdictionId = context?.jurisdictionId;
    const industryId = context?.industryId;
    const locationId = context?.locationId;
    
    // Call getAvailableIncentives with context data
    const incentives = await kgService.getAvailableIncentives({
      locationId,
      industryId,
      jurisdictionId,
      limit: 10, // Top 10 applicable incentives
    });
    
    const duration = Date.now() - startTime;
    console.log(`[KG API] Incentives query completed in ${duration}ms, found ${incentives.length} results`);
    
    res.json({
      success: true,
      incentives,
      metadata: {
        sessionId,
        queryTime: duration,
        filters: {
          jurisdictionId,
          industryId,
          locationId,
        },
      },
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[KG API] Error fetching incentives (${duration}ms):`, error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch incentives',
      message: error.message,
    });
  }
});

/**
 * GET /api/knowledge/insights/:sessionId
 * 
 * Aggregator endpoint that returns all knowledge graph insights for a session
 * Includes similar strategies, incentives, and regulations
 * Respects consent flags - returns empty arrays if consentPeerShare is false
 */
router.get('/insights/:sessionId', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { sessionId } = req.params;
    
    // Validate session ID format
    if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format',
      });
    }
    
    // Check feature flag and Neo4j configuration
    if (!isKnowledgeGraphEnabled() || !isNeo4jConfigured()) {
      console.log('[KG API] Knowledge Graph disabled or not configured, returning empty insights');
      return res.json({
        success: true,
        similarStrategies: [],
        incentives: [],
        regulations: [],
        message: 'Knowledge Graph not available',
      });
    }
    
    // Look up journey session from database
    const [journeySession] = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.id, sessionId))
      .limit(1);
    
    if (!journeySession) {
      return res.status(404).json({
        success: false,
        error: 'Journey session not found',
      });
    }
    
    // Check consent - if user hasn't consented to peer sharing, return empty insights
    const context = journeySession.accumulatedContext as any;
    const consentPeerShare = context?.consentPeerShare ?? false;
    
    if (!consentPeerShare) {
      console.log(`[KG API] Session ${sessionId} has not consented to peer sharing, returning empty insights`);
      return res.json({
        success: true,
        hasConsent: false,
        similarStrategies: [],
        incentives: [],
        regulations: [],
        dataClassification: 'private',
        message: 'User has not consented to peer sharing',
      });
    }
    
    // Import knowledge graph service
    const kgService = await import('../services/knowledge-graph-service');
    
    // Get all insights using the aggregator function
    const insights = await kgService.getInsightsForSession(sessionId, {
      locationId: context?.locationId,
      industryId: context?.industryId,
      jurisdictionId: context?.jurisdictionId,
      rootCause: context?.insights?.primaryRootCause || context?.insights?.rootCauses?.[0],
    });
    
    const duration = Date.now() - startTime;
    console.log(`[KG API] Insights query completed in ${duration}ms`);
    
    res.json({
      success: true,
      hasConsent: true,
      ...insights,
      dataClassification: 'aggregate',
      metadata: {
        sessionId,
        queryTime: duration,
        consentPeerShare: true,
      },
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[KG API] Error fetching insights (${duration}ms):`, error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch knowledge graph insights',
      message: error.message,
    });
  }
});

export default router;
