import { Router } from 'express';
import { db } from '../db';
import { strategicUnderstanding, frameworkInsights } from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

const router = Router();

router.get('/statements', async (req, res) => {
  try {
    const statements = await db
      .select({
        understandingId: strategicUnderstanding.id,
        sessionId: strategicUnderstanding.sessionId,
        statement: strategicUnderstanding.userInput,
        title: strategicUnderstanding.title,
        createdAt: strategicUnderstanding.createdAt,
      })
      .from(strategicUnderstanding)
      .orderBy(desc(strategicUnderstanding.createdAt));

    const enrichedStatements = await Promise.all(
      statements.map(async (stmt) => {
        const analyses = await db
          .select({
            frameworkName: frameworkInsights.frameworkName,
            frameworkVersion: frameworkInsights.frameworkVersion,
            createdAt: frameworkInsights.createdAt,
          })
          .from(frameworkInsights)
          .where(eq(frameworkInsights.understandingId, stmt.understandingId))
          .orderBy(desc(frameworkInsights.createdAt));

        const analysisSummary: Record<string, { count: number; latestVersion: string }> = {};
        
        analyses.forEach((analysis) => {
          const framework = analysis.frameworkName;
          if (!analysisSummary[framework]) {
            analysisSummary[framework] = {
              count: 0,
              latestVersion: analysis.frameworkVersion || '1.0',
            };
          }
          analysisSummary[framework].count++;
        });

        return {
          understandingId: stmt.understandingId,
          sessionId: stmt.sessionId,
          statement: stmt.statement,
          title: stmt.title,
          createdAt: stmt.createdAt,
          analyses: analysisSummary,
          totalAnalyses: analyses.length,
          lastActivity: analyses[0]?.createdAt || stmt.createdAt,
        };
      })
    );

    res.json(enrichedStatements);
  } catch (error) {
    console.error('Error fetching statements:', error);
    res.status(500).json({ error: 'Failed to fetch statements' });
  }
});

router.get('/statements/:understandingId', async (req, res) => {
  try {
    const { understandingId } = req.params;

    const [understanding] = await db
      .select()
      .from(strategicUnderstanding)
      .where(eq(strategicUnderstanding.id, understandingId));

    if (!understanding) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    const analyses = await db
      .select({
        id: frameworkInsights.id,
        frameworkName: frameworkInsights.frameworkName,
        frameworkVersion: frameworkInsights.frameworkVersion,
        insights: frameworkInsights.insights,
        telemetry: frameworkInsights.telemetry,
        createdAt: frameworkInsights.createdAt,
      })
      .from(frameworkInsights)
      .where(eq(frameworkInsights.understandingId, understandingId))
      .orderBy(desc(frameworkInsights.createdAt));

    const groupedAnalyses: Record<string, any[]> = {};
    
    analyses.forEach((analysis) => {
      const framework = analysis.frameworkName;
      if (!groupedAnalyses[framework]) {
        groupedAnalyses[framework] = [];
      }

      let summary = '';
      let keyFindings: string[] = [];

      if (framework === 'PESTLE' && analysis.insights) {
        const insights = analysis.insights as any;
        if (insights.synthesis?.executiveSummary) {
          summary = insights.synthesis.executiveSummary.substring(0, 200) + '...';
        }
        if (insights.synthesis?.keyFindings) {
          keyFindings = insights.synthesis.keyFindings.slice(0, 3);
        }
      }

      groupedAnalyses[framework].push({
        id: analysis.id,
        frameworkName: analysis.frameworkName,
        version: analysis.frameworkVersion || '1.0',
        createdAt: analysis.createdAt,
        duration: (analysis.telemetry as any)?.totalLatencyMs,
        summary,
        keyFindings,
      });
    });

    res.json({
      understandingId: understanding.id,
      sessionId: understanding.sessionId,
      statement: understanding.userInput,
      title: understanding.title,
      companyContext: understanding.companyContext,
      createdAt: understanding.createdAt,
      analyses: groupedAnalyses,
    });
  } catch (error) {
    console.error('Error fetching statement detail:', error);
    res.status(500).json({ error: 'Failed to fetch statement detail' });
  }
});

export default router;
