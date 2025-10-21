import { Router } from 'express';
import { db } from '../db';
import { strategicUnderstanding, frameworkInsights, strategicEntities, strategyVersions } from '@shared/schema';
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

router.delete('/statements/:understandingId', async (req, res) => {
  try {
    const { understandingId } = req.params;

    // First check if the statement exists
    const [understanding] = await db
      .select()
      .from(strategicUnderstanding)
      .where(eq(strategicUnderstanding.id, understandingId));

    if (!understanding) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    // Delete all related framework insights
    await db
      .delete(frameworkInsights)
      .where(eq(frameworkInsights.understandingId, understandingId));

    // Delete all related strategic entities
    await db
      .delete(strategicEntities)
      .where(eq(strategicEntities.understandingId, understandingId));

    // Delete the strategic understanding record
    await db
      .delete(strategicUnderstanding)
      .where(eq(strategicUnderstanding.id, understandingId));

    res.json({ success: true, message: 'Statement and all analyses deleted successfully' });
  } catch (error) {
    console.error('Error deleting statement:', error);
    res.status(500).json({ error: 'Failed to delete statement' });
  }
});

router.delete('/analyses/:analysisId', async (req, res) => {
  try {
    const { analysisId } = req.params;

    // First check if the analysis exists
    const [analysis] = await db
      .select()
      .from(frameworkInsights)
      .where(eq(frameworkInsights.id, analysisId));

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    // Delete the analysis - this will cascade delete related data
    await db
      .delete(frameworkInsights)
      .where(eq(frameworkInsights.id, analysisId));

    res.json({ success: true, message: 'Analysis deleted successfully' });
  } catch (error) {
    console.error('Error deleting analysis:', error);
    res.status(500).json({ error: 'Failed to delete analysis' });
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

    // Query old PESTLE analyses from frameworkInsights table
    const oldAnalyses = await db
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

    // Query new Strategy Workspace analyses from strategyVersions table
    // Find all versions associated with this understanding's session
    const newAnalyses = await db
      .select({
        id: strategyVersions.id,
        versionNumber: strategyVersions.versionNumber,
        analysisData: strategyVersions.analysisData,
        createdAt: strategyVersions.createdAt,
      })
      .from(strategyVersions)
      .where(eq(strategyVersions.sessionId, understanding.sessionId))
      .orderBy(desc(strategyVersions.createdAt));

    const groupedAnalyses: Record<string, any[]> = {};
    
    // Process old PESTLE analyses
    oldAnalyses.forEach((analysis) => {
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

    // Process new Strategy Workspace analyses (BMC, Five Whys, etc.)
    newAnalyses.forEach((version) => {
      const analysisData = version.analysisData as any;
      
      // Check for BMC analysis
      if (analysisData?.bmc_research) {
        const bmcData = analysisData.bmc_research;
        const framework = 'Business Model Canvas';
        
        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }

        let summary = '';
        let keyFindings: string[] = [];

        if (bmcData.keyInsights && bmcData.keyInsights.length > 0) {
          summary = bmcData.keyInsights.slice(0, 2).join('. ').substring(0, 200) + '...';
          keyFindings = bmcData.keyInsights.slice(0, 3);
        }

        groupedAnalyses[framework].push({
          id: version.id,
          frameworkName: framework,
          version: `v${version.versionNumber}`,
          createdAt: version.createdAt,
          summary,
          keyFindings,
        });
      }

      // Check for Five Whys analysis
      if (analysisData?.five_whys) {
        const whysData = analysisData.five_whys;
        const framework = 'Five Whys';
        
        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }

        let summary = whysData.rootCause ? whysData.rootCause.substring(0, 200) + '...' : '';
        let keyFindings: string[] = whysData.keyRecommendations?.slice(0, 3) || [];

        groupedAnalyses[framework].push({
          id: version.id,
          frameworkName: framework,
          version: `v${version.versionNumber}`,
          createdAt: version.createdAt,
          summary,
          keyFindings,
        });
      }
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
