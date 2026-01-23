import { Router, Request, Response } from 'express';
import { db } from '../db';
import { journeySessions, strategicUnderstanding, epmPrograms, strategyVersions, references } from '@shared/schema';
import { eq, and, or, desc, sql, inArray } from 'drizzle-orm';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.claims.sub;
    
    const strategies = await db
      .select({
        id: strategicUnderstanding.id,
        title: strategicUnderstanding.title,
        initiativeType: strategicUnderstanding.initiativeType,
        initiativeDescription: strategicUnderstanding.initiativeDescription,
        strategyMetadata: strategicUnderstanding.strategyMetadata,
        createdAt: strategicUnderstanding.createdAt,
        updatedAt: strategicUnderstanding.updatedAt,
        journeyCount: sql<number>`COUNT(DISTINCT ${journeySessions.id})`,
        latestJourneyStatus: sql<string>`MAX(${journeySessions.status})`,
        latestJourneyUpdated: sql<Date>`MAX(${journeySessions.updatedAt})`,
      })
      .from(strategicUnderstanding)
      .innerJoin(
        journeySessions,
        and(
          eq(strategicUnderstanding.id, journeySessions.understandingId),
          eq(journeySessions.userId, userId)
        )
      )
      .where(eq(strategicUnderstanding.archived, false))
      .groupBy(strategicUnderstanding.id)
      .orderBy(desc(strategicUnderstanding.updatedAt));

    const serializedStrategies = strategies.map(s => ({
      ...s,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
      updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
      latestJourneyUpdated: s.latestJourneyUpdated instanceof Date ? s.latestJourneyUpdated.toISOString() : s.latestJourneyUpdated,
    }));

    res.json(serializedStrategies);
  } catch (error) {
    console.error("Error fetching strategies:", error);
    res.status(500).json({ message: "Failed to fetch strategies" });
  }
});

router.get('/latest-understanding', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.claims.sub;
    
    const [latestStrategy] = await db
      .select({
        understandingId: strategicUnderstanding.id,
      })
      .from(strategicUnderstanding)
      .innerJoin(
        journeySessions,
        and(
          eq(strategicUnderstanding.id, journeySessions.understandingId),
          eq(journeySessions.userId, userId)
        )
      )
      .where(eq(strategicUnderstanding.archived, false))
      .groupBy(strategicUnderstanding.id)
      .orderBy(desc(strategicUnderstanding.updatedAt))
      .limit(1);

    res.json({ understandingId: latestStrategy?.understandingId || null });
  } catch (error) {
    console.error("Error fetching latest understanding:", error);
    res.status(500).json({ message: "Failed to fetch latest understanding" });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.claims.sub;
    const strategyId = req.params.id;

    const [ownershipCheck] = await db
      .select()
      .from(journeySessions)
      .where(
        and(
          eq(journeySessions.understandingId, strategyId),
          eq(journeySessions.userId, userId)
        )
      )
      .limit(1);

    if (!ownershipCheck) {
      return res.status(404).json({ message: "Strategy not found" });
    }

    const { getStrategicUnderstanding } = await import('../services/secure-data-service');
    const understanding = await getStrategicUnderstanding(strategyId);
    
    if (!understanding) {
      return res.status(404).json({ message: "Strategy not found" });
    }

    const sessions = await db
      .select()
      .from(journeySessions)
      .where(
        and(
          eq(journeySessions.understandingId, strategyId),
          eq(journeySessions.userId, userId)
        )
      )
      .orderBy(desc(journeySessions.versionNumber));

    const sessionIds = new Set<string>();
    if (understanding.sessionId) {
      sessionIds.add(understanding.sessionId);
    }
    sessions.forEach(session => sessionIds.add(session.id));
    const sessionIdList = Array.from(sessionIds);

    const programs = sessionIdList.length > 0
      ? await db
          .select({
            id: epmPrograms.id,
            userId: epmPrograms.userId,
            frameworkType: epmPrograms.frameworkType,
            status: epmPrograms.status,
            createdAt: epmPrograms.createdAt,
            strategyVersionId: epmPrograms.strategyVersionId,
          })
          .from(epmPrograms)
          .innerJoin(
            strategyVersions,
            eq(epmPrograms.strategyVersionId, strategyVersions.id)
          )
          .where(
            and(
              inArray(strategyVersions.sessionId, sessionIdList),
              eq(epmPrograms.userId, userId)
            )
          )
      : [];

    const [refCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(references)
      .where(
        and(
          eq(references.understandingId, strategyId),
          eq(references.userId, userId)
        )
      );

    res.json({
      understanding,
      sessions,
      programs,
      referenceCount: refCount?.count || 0,
    });
  } catch (error) {
    console.error("Error fetching strategy detail:", error);
    res.status(500).json({ message: "Failed to fetch strategy detail" });
  }
});

router.get('/:id/references', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.claims.sub;
    const strategyId = req.params.id;

    const [understandingData] = await db
      .select()
      .from(strategicUnderstanding)
      .leftJoin(
        journeySessions,
        eq(strategicUnderstanding.id, journeySessions.understandingId)
      )
      .where(
        and(
          eq(strategicUnderstanding.id, strategyId),
          eq(journeySessions.userId, userId)
        )
      );

    if (!understandingData) {
      return res.status(404).json({ message: "Strategy not found" });
    }

    const strategyReferences = await db
      .select()
      .from(references)
      .where(
        and(
          eq(references.userId, userId),
          or(
            eq(references.understandingId, strategyId),
            sql`${references.sessionId} IN (
              SELECT id FROM ${journeySessions} WHERE ${journeySessions.understandingId} = ${strategyId} AND ${journeySessions.userId} = ${userId}
            )`,
            sql`${references.programId} IN (
              SELECT ${epmPrograms.id} FROM ${epmPrograms}
              INNER JOIN ${strategyVersions} ON ${epmPrograms.id} = ${strategyVersions.convertedProgramId}
              INNER JOIN ${journeySessions} ON ${strategyVersions.sessionId} = ${journeySessions.id}
              WHERE ${journeySessions.understandingId} = ${strategyId} AND ${epmPrograms.userId} = ${userId}
            )`
          )
        )
      )
      .orderBy(desc(references.confidence), desc(references.createdAt));

    res.json(strategyReferences);
  } catch (error) {
    console.error("Error fetching strategy references:", error);
    res.status(500).json({ message: "Failed to fetch strategy references" });
  }
});

export default router;
