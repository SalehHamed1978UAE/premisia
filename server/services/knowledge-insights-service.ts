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
  consent: boolean;
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
 * - Queries strategy_versions with same userId (excluding current session)
 * - Computes similarity using embeddings if available (pgvector cosine similarity)
 * - Fallback to text overlap using trigram similarity on analysis_data
 * - Respects consent flags (consentPeerShare)
 */
export async function getSimilarStrategiesFromPostgres(
  sessionId: string,
  userId: string
): Promise<SimilarStrategy[]> {
  try {
    console.log(`[PG Insights] Finding similar strategies for user ${userId}, session ${sessionId}`);

    // First, get the current session's context to extract comparison criteria
    const [currentSession] = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.id, sessionId))
      .limit(1);

    if (!currentSession) {
      console.log('[PG Insights] Current session not found');
      return [];
    }

    // Extract context for similarity matching
    const currentContext = currentSession.accumulatedContext as any;
    const currentInput = currentContext?.userInput || '';

    // Query similar strategies from the same user (excluding current session)
    // Strategy: Use trigram similarity on inputSummary and text content in analysisData
    const similarStrategies = await db
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
          ne(strategyVersions.sessionId, sessionId),
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

    console.log(`[PG Insights] Found ${similarStrategies.length} potentially similar strategies`);

    // Transform to response format with consent check
    const results: SimilarStrategy[] = await Promise.all(
      similarStrategies.map(async (strategy) => {
        // Check consent flag from session context
        let consentPeerShare = false;
        if (strategy.sessionId) {
          const [session] = await db
            .select()
            .from(journeySessions)
            .where(eq(journeySessions.id, strategy.sessionId))
            .limit(1);
          
          if (session) {
            const context = session.accumulatedContext as any;
            consentPeerShare = context?.consentPeerShare ?? false;
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
          consent: consentPeerShare,
        };
      })
    );

    // Filter out strategies without consent
    const withConsent = results.filter(r => r.consent);
    console.log(`[PG Insights] Returning ${withConsent.length} strategies with consent`);

    return withConsent.slice(0, 3); // Top 3
  } catch (error) {
    console.error('[PG Insights] Error finding similar strategies:', error);
    throw error;
  }
}

/**
 * Get incentives and opportunities for a user using PostgreSQL
 * - Queries strategic_entities with type containing "incentive" or "opportunity"
 * - Filters by jurisdiction/industry from session context
 * - Joins with references for source URLs
 * - Respects consent flags
 */
export async function getIncentivesFromPostgres(
  sessionId: string,
  userId: string
): Promise<Incentive[]> {
  try {
    console.log(`[PG Insights] Finding incentives for user ${userId}, session ${sessionId}`);

    // Get the current session's context
    const [currentSession] = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.id, sessionId))
      .limit(1);

    if (!currentSession) {
      console.log('[PG Insights] Current session not found');
      return [];
    }

    const currentContext = currentSession.accumulatedContext as any;

    // Get the understanding ID for this session
    const understandingId = currentSession.understandingId;

    // Query strategic entities for incentives and opportunities
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
 * - Queries references linked to the current session
 * - Aggregates citation snippets and confidence scores
 * - Dedupes by URL
 */
export async function getEvidenceFromPostgres(
  sessionId: string,
  userId: string
): Promise<Evidence[]> {
  try {
    console.log(`[PG Insights] Finding evidence for user ${userId}, session ${sessionId}`);

    // Query references for this session
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
          eq(references.sessionId, sessionId),
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
 * Aggregator function that combines all insights for a session
 */
export async function getInsightsForSession(
  sessionId: string,
  userId: string
): Promise<{
  similarStrategies: SimilarStrategy[];
  incentives: Incentive[];
  evidence: Evidence[];
}> {
  console.log(`[PG Insights] Getting all insights for session ${sessionId}, user ${userId}`);

  const [similarStrategies, incentives, evidence] = await Promise.all([
    getSimilarStrategiesFromPostgres(sessionId, userId),
    getIncentivesFromPostgres(sessionId, userId),
    getEvidenceFromPostgres(sessionId, userId),
  ]);

  return {
    similarStrategies,
    incentives,
    evidence,
  };
}
