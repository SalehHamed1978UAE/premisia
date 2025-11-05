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
 * Includes similar strategies, incentives, and evidence
 * Respects consent flags - returns empty arrays if consentPeerShare is false
 * 
 * IMPLEMENTATION: PostgreSQL-first with Neo4j fallback
 * - Primary: PostgreSQL queries on strategy_versions, strategic_entities, references
 * - Fallback: Neo4j if PostgreSQL fails and Neo4j is configured
 */
router.get('/insights/:sessionId', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { sessionId } = req.params;
    
    // Check feature flag
    if (!isKnowledgeGraphEnabled()) {
      console.log('[KG API] Knowledge Graph feature disabled, returning empty insights');
      return res.json({
        success: true,
        similarStrategies: [],
        incentives: [],
        evidence: [],
        message: 'Knowledge Graph feature disabled',
      });
    }
    
    // Get authenticated user
    const userId = (req as any).user?.claims?.sub || (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    // Determine if this is a journey session ID or understanding ID
    let understandingId: string;
    let journeySession: any;
    
    if (sessionId.startsWith('session-')) {
      // Journey session ID format - look up journey session to get understanding ID
      console.log(`[KG API] Received journey session ID: ${sessionId}`);
      
      const [session] = await db
        .select()
        .from(journeySessions)
        .where(eq(journeySessions.id, sessionId))
        .limit(1);
      
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Journey session not found',
        });
      }
      
      if (!session.understandingId) {
        return res.status(404).json({
          success: false,
          error: 'Journey session has no understanding',
        });
      }
      
      // Verify userId
      if (session.userId !== userId) {
        console.log(`[KG API] Access denied: user ${userId} attempted to access session ${sessionId} owned by ${session.userId}`);
        return res.status(403).json({
          success: false,
          error: 'Access denied: session does not belong to authenticated user',
        });
      }
      
      journeySession = session;
      understandingId = session.understandingId;
      console.log(`[KG API] Resolved journey session ${sessionId} to understanding ${understandingId}`);
      
    } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
      // UUID format - treat as understanding ID (backward compatible)
      // Need to verify userId by looking up any journey session with this understanding
      console.log(`[KG API] Received UUID, treating as understanding ID: ${sessionId}`);
      
      const [session] = await db
        .select()
        .from(journeySessions)
        .where(eq(journeySessions.understandingId, sessionId))
        .limit(1);
      
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Understanding session not found',
        });
      }
      
      // Verify userId
      if (session.userId !== userId) {
        console.log(`[KG API] Access denied: user ${userId} attempted to access understanding ${sessionId} owned by ${session.userId}`);
        return res.status(403).json({
          success: false,
          error: 'Access denied: understanding does not belong to authenticated user',
        });
      }
      
      journeySession = session;
      understandingId = sessionId;
      
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format',
      });
    }
    
    // Check consent - if user hasn't consented to peer sharing, return empty insights
    // Default to false for privacy-safe behavior (require explicit opt-in)
    const context = journeySession.accumulatedContext as any;
    const consentPeerShare = context?.consentPeerShare ?? false;
    
    if (!consentPeerShare) {
      console.log(`[KG API] Session has not consented to peer sharing, returning empty insights`);
      return res.json({
        success: true,
        hasConsent: false,
        similarStrategies: [],
        incentives: [],
        evidence: [],
        dataClassification: 'private',
        message: 'User has not consented to peer sharing',
      });
    }
    
    // TRY POSTGRESQL FIRST
    let insights: any;
    let dataSource = 'postgresql';
    
    try {
      console.log(`[KG API] Attempting PostgreSQL-based insights for understanding ${understandingId}`);
      const pgService = await import('../services/knowledge-insights-service');
      
      insights = await pgService.getInsightsForSession(understandingId, userId);
      
      const duration = Date.now() - startTime;
      console.log(`[KG API] ✓ PostgreSQL insights query completed in ${duration}ms`);
      console.log(`[KG API]   - Similar strategies: ${insights.similarStrategies?.length || 0}`);
      console.log(`[KG API]   - Incentives: ${insights.incentives?.length || 0}`);
      console.log(`[KG API]   - Evidence: ${insights.evidence?.length || 0}`);
      
    } catch (pgError: any) {
      console.error(`[KG API] PostgreSQL insights failed:`, pgError.message);
      
      // FALLBACK TO NEO4J if available
      if (isNeo4jConfigured()) {
        try {
          console.log(`[KG API] Falling back to Neo4j for understanding ${understandingId}`);
          const kgService = await import('../services/knowledge-graph-service');
          
          const neo4jInsights = await kgService.getInsightsForSession(understandingId, {
            locationId: context?.locationId,
            industryId: context?.industryId,
            jurisdictionId: context?.jurisdictionId,
            rootCause: context?.insights?.primaryRootCause || context?.insights?.rootCauses?.[0],
          });
          
          // Transform Neo4j results to match PostgreSQL format
          insights = {
            similarStrategies: neo4jInsights.similarStrategies || [],
            incentives: neo4jInsights.incentives || [],
            evidence: [], // Neo4j doesn't return evidence in same format
          };
          
          dataSource = 'neo4j';
          console.log(`[KG API] ✓ Neo4j fallback successful`);
          
        } catch (neo4jError: any) {
          console.error(`[KG API] Neo4j fallback also failed:`, neo4jError.message);
          throw pgError; // Re-throw original PostgreSQL error
        }
      } else {
        console.log(`[KG API] Neo4j not configured, cannot fallback`);
        throw pgError; // Re-throw if no fallback available
      }
    }
    
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      hasConsent: true,
      similarStrategies: insights.similarStrategies || [],
      incentives: insights.incentives || [],
      evidence: insights.evidence || [],
      dataClassification: 'user-scoped',
      metadata: {
        sessionId,
        understandingId,
        userId,
        queryTime: duration,
        dataSource,
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
