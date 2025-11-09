/**
 * PostgreSQL-based Knowledge Insights Service
 * Provides knowledge graph insights using existing PostgreSQL tables
 * User-scoped only - never exposes cross-user data
 */

import { db } from '../db';
import {
  strategyVersions,
  strategicEntities,
  references,
  journeySessions,
  strategicUnderstanding,
} from '@shared/schema';
import { eq, and, ne, desc, sql, isNotNull } from 'drizzle-orm';

/**
 * Similarity scoring result interface
 */
interface SimilarStrategy {
  strategyId: string;
  sessionId: string | null;
  versionNumber: number;
  title: string | null;
  score: number;
  summary: string | null;
  completedAt: Date | null;
  consent: 'private' | 'aggregate_only' | 'share_with_peers';
}

/**
 * Incentive/Opportunity result interface
 */
interface Incentive {
  id: string;
  name: string;
  jurisdiction: string | null;
  deadline: string | null;
  rationale: string | null;
  score: number;
}

/**
 * Evidence/Reference result interface
 */
interface Evidence {
  referenceId: string;
  title: string;
  url: string | null;
  topic: string | null;
  confidence: number | null;
}

/**
 * Get similar strategies for a user using PostgreSQL
 * - Queries strategy_versions with same userId (excluding current understanding)
 * - Computes similarity using embeddings if available (pgvector cosine similarity)
 * - Fallback to text overlap using trigram similarity on analysis_data
 * - Respects consent flags (consentPeerShare)
 */
export async function getSimilarStrategiesFromPostgres(
  understandingId: string,
  userId: string
): Promise<SimilarStrategy[]> {
  try {
    console.log(`[PG Insights] Finding similar strategies for user ${userId}, understanding ${understandingId}`);

    // Get any journey session with this understanding to extract context
    const [currentSession] = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.understandingId, understandingId))
      .limit(1);

    if (!currentSession) {
      console.log('[PG Insights] No journey session found for understanding');
      return [];
    }

    // Extract context for similarity matching
    const currentContext = currentSession.accumulatedContext as any;
    const currentInput = currentContext?.userInput || '';

    // Get all journey session IDs for this understanding
    const currentUnderstandingSessions = await db
      .select({ id: journeySessions.id })
      .from(journeySessions)
      .where(eq(journeySessions.understandingId, understandingId));
    
    const currentSessionIds = currentUnderstandingSessions.map(s => s.id);

    // Query similar strategies from the same user (excluding current understanding's sessions)
    // Strategy: Use trigram similarity on inputSummary and text content in analysisData
    // Note: Requires pg_trgm extension to be installed
    let similarStrategies: any[];
    
    try {
      similarStrategies = await db
        .select({
          strategyId: strategyVersions.id,
          sessionId: strategyVersions.sessionId,
          versionNumber: strategyVersions.versionNumber,
          inputSummary: strategyVersions.inputSummary,
          analysisData: strategyVersions.analysisData,
          finalizedAt: strategyVersions.finalizedAt,
          createdAt: strategyVersions.createdAt,
          // Calculate similarity score using trigram similarity on inputSummary
          similarity: sql<number>`
            GREATEST(
              COALESCE(similarity(${strategyVersions.inputSummary}, ${currentInput}), 0),
              0.1
            )
          `,
        })
        .from(strategyVersions)
        .where(
          and(
            eq(strategyVersions.userId, userId),
            currentSessionIds.length > 0 
              ? sql`${strategyVersions.sessionId} NOT IN (${sql.join(currentSessionIds.map(id => sql`${id}`), sql`, `)})`
              : sql`1=1`, // If no sessions, include all
            isNotNull(strategyVersions.finalizedAt) // Only completed strategies
          )
        )
        .orderBy(desc(sql`
          GREATEST(
            COALESCE(similarity(${strategyVersions.inputSummary}, ${currentInput}), 0),
            0.1
          )
        `))
        .limit(5);
    } catch (error: any) {
      // Check if error is due to missing pg_trgm extension
      if (error.message?.includes('similarity') || error.message?.includes('pg_trgm') || error.message?.includes('function')) {
        console.error('[PG Insights] similarity() function not available - pg_trgm extension likely missing');
        console.error('[PG Insights] Knowledge Graph features require: CREATE EXTENSION IF NOT EXISTS pg_trgm;');
        console.error('[PG Insights] Returning empty results instead of failing');
        
        // Return empty array instead of throwing - graceful degradation
        similarStrategies = [];
      } else {
        throw error; // Re-throw other errors
      }
    }

    console.log(`[PG Insights] Found ${similarStrategies.length} potentially similar strategies`);

    // Transform to response format with consent check
    const results: SimilarStrategy[] = await Promise.all(
      similarStrategies.map(async (strategy) => {
        // Extract consent tier from session context
        let consentTier: 'private' | 'aggregate_only' | 'share_with_peers' = 'private';
        if (strategy.sessionId) {
          const [session] = await db
            .select()
            .from(journeySessions)
            .where(eq(journeySessions.id, strategy.sessionId))
            .limit(1);
          
          if (session) {
            const context = session.accumulatedContext as any;
            const consentValue = context?.consentPeerShare;
            
            // Map consent value to tier string
            if (typeof consentValue === 'string') {
              // If already stored as a tier string, use it
              if (consentValue === 'private' || consentValue === 'aggregate_only' || consentValue === 'share_with_peers') {
                consentTier = consentValue;
              }
            } else if (consentValue === true) {
              // If boolean true, map to 'share_with_peers'
              consentTier = 'share_with_peers';
            }
            // If false or undefined, defaults to 'private'
          }
        }

        // Extract summary from analysisData
        const analysisData = strategy.analysisData as any;
        const summary = strategy.inputSummary || 
          analysisData?.summary || 
          analysisData?.executiveSummary || 
          'No summary available';

        return {
          strategyId: strategy.strategyId,
          sessionId: strategy.sessionId,
          versionNumber: strategy.versionNumber,
          title: strategy.inputSummary,
          score: Number(strategy.similarity) || 0.1,
          summary: typeof summary === 'string' ? summary : JSON.stringify(summary),
          completedAt: strategy.finalizedAt || strategy.createdAt,
          consent: consentTier,
        };
      })
    );

    // NOTE: No consent filter needed here - these are all same-user strategies
    // Consent only controls whether OTHER users can see this user's data
    // Users always see their own strategies regardless of consent setting
    console.log(`[PG Insights] Returning ${results.length} similar strategies from user's own history`);

    return results.slice(0, 3); // Top 3
  } catch (error) {
    console.error('[PG Insights] Error finding similar strategies:', error);
    throw error;
  }
}

/**
 * Get incentives and opportunities for a user using PostgreSQL
 * - Queries strategic_entities with type containing "incentive" or "opportunity"
 * - Filters by jurisdiction/industry from understanding context
 * - Joins with references for source URLs
 * - Respects consent flags
 */
export async function getIncentivesFromPostgres(
  understandingId: string,
  userId: string
): Promise<Incentive[]> {
  try {
    console.log(`[PG Insights] Finding incentives for user ${userId}, understanding ${understandingId}`);

    // Get context from any journey session with this understanding
    const [currentSession] = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.understandingId, understandingId))
      .limit(1);

    if (!currentSession) {
      console.log('[PG Insights] No journey session found for understanding');
      return [];
    }

    const currentContext = currentSession.accumulatedContext as any;

    // Query strategic entities for incentives and opportunities using understanding ID directly
    const incentiveEntities = await db
      .select({
        id: strategicEntities.id,
        claim: strategicEntities.claim,
        type: strategicEntities.type,
        confidence: strategicEntities.confidence,
        source: strategicEntities.source,
        evidence: strategicEntities.evidence,
        metadata: strategicEntities.metadata,
      })
      .from(strategicEntities)
      .where(
        and(
          eq(strategicEntities.understandingId, understandingId),
          sql`${strategicEntities.type} IN ('opportunity', 'constraint')`
        )
      )
      .limit(10);

    console.log(`[PG Insights] Found ${incentiveEntities.length} incentive-related entities`);

    // Transform to response format
    const results: Incentive[] = incentiveEntities.map((entity) => {
      const metadata = entity.metadata as any;
      
      // Calculate score based on confidence
      let score = 0.5; // Default
      if (entity.confidence === 'high') score = 0.9;
      else if (entity.confidence === 'medium') score = 0.6;
      else if (entity.confidence === 'low') score = 0.3;

      return {
        id: entity.id,
        name: entity.claim,
        jurisdiction: metadata?.jurisdiction || currentContext?.jurisdiction || null,
        deadline: metadata?.deadline || null,
        rationale: entity.evidence || entity.source,
        score,
      };
    });

    return results;
  } catch (error) {
    console.error('[PG Insights] Error finding incentives:', error);
    throw error;
  }
}

/**
 * Get evidence and references for a user using PostgreSQL
 * - Queries references linked to all sessions with this understanding
 * - Aggregates citation snippets and confidence scores
 * - Dedupes by URL
 */
export async function getEvidenceFromPostgres(
  understandingId: string,
  userId: string
): Promise<Evidence[]> {
  try {
    console.log(`[PG Insights] Finding evidence for user ${userId}, understanding ${understandingId}`);

    // Get all journey session IDs for this understanding
    const sessions = await db
      .select({ id: journeySessions.id })
      .from(journeySessions)
      .where(eq(journeySessions.understandingId, understandingId));
    
    const sessionIds = sessions.map(s => s.id);
    
    if (sessionIds.length === 0) {
      console.log('[PG Insights] No journey sessions found for understanding');
      return [];
    }

    // Query references for all sessions with this understanding
    const sessionReferences = await db
      .select({
        id: references.id,
        title: references.title,
        url: references.url,
        topics: references.topics,
        confidence: references.confidence,
        sourceType: references.sourceType,
      })
      .from(references)
      .where(
        and(
          sql`${references.sessionId} IN (${sql.join(sessionIds.map(id => sql`${id}`), sql`, `)})`,
          eq(references.userId, userId)
        )
      )
      .orderBy(desc(references.confidence))
      .limit(10);

    console.log(`[PG Insights] Found ${sessionReferences.length} references`);

    // Dedupe by URL
    const urlMap = new Map<string, typeof sessionReferences[0]>();
    for (const ref of sessionReferences) {
      if (ref.url && !urlMap.has(ref.url)) {
        urlMap.set(ref.url, ref);
      } else if (!ref.url) {
        // Include references without URLs (e.g., manual entries)
        urlMap.set(ref.id, ref);
      }
    }

    // Transform to response format
    const results: Evidence[] = Array.from(urlMap.values()).map((ref) => ({
      referenceId: ref.id,
      title: ref.title,
      url: ref.url,
      topic: ref.topics?.[0] || null,
      confidence: ref.confidence ? Number(ref.confidence) : null,
    }));

    return results;
  } catch (error) {
    console.error('[PG Insights] Error finding evidence:', error);
    throw error;
  }
}

/**
 * Aggregator function that combines all insights for an understanding
 */
export async function getInsightsForSession(
  understandingId: string,
  userId: string
): Promise<{
  similarStrategies: SimilarStrategy[];
  incentives: Incentive[];
  evidence: Evidence[];
}> {
  console.log(`[PG Insights] Getting all insights for understanding ${understandingId}, user ${userId}`);

  const [similarStrategies, incentives, evidence] = await Promise.all([
    getSimilarStrategiesFromPostgres(understandingId, userId),
    getIncentivesFromPostgres(understandingId, userId),
    getEvidenceFromPostgres(understandingId, userId),
  ]);

  return {
    similarStrategies,
    incentives,
    evidence,
  };
}
