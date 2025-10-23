import { Router } from 'express';
import { db } from '../db';
import { strategicUnderstanding, frameworkInsights, strategicEntities, strategyVersions } from '@shared/schema';
import { eq, desc, sql, inArray } from 'drizzle-orm';

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
        // Get old PESTLE analyses from frameworkInsights
        const oldAnalyses = await db
          .select({
            frameworkName: frameworkInsights.frameworkName,
            frameworkVersion: frameworkInsights.frameworkVersion,
            createdAt: frameworkInsights.createdAt,
          })
          .from(frameworkInsights)
          .where(eq(frameworkInsights.understandingId, stmt.understandingId))
          .orderBy(desc(frameworkInsights.createdAt));

        // Get new analyses from strategyVersions
        const newAnalyses = await db
          .select({
            versionNumber: strategyVersions.versionNumber,
            analysisData: strategyVersions.analysisData,
            createdAt: strategyVersions.createdAt,
          })
          .from(strategyVersions)
          .where(eq(strategyVersions.sessionId, stmt.sessionId))
          .orderBy(desc(strategyVersions.createdAt));

        const analysisSummary: Record<string, { count: number; latestVersion: string }> = {};
        let latestActivity: Date = stmt.createdAt;
        
        // Process old analyses
        oldAnalyses.forEach((analysis) => {
          const framework = analysis.frameworkName;
          if (!analysisSummary[framework]) {
            analysisSummary[framework] = {
              count: 0,
              latestVersion: analysis.frameworkVersion || '1.0',
            };
          }
          analysisSummary[framework].count++;
          if (analysis.createdAt && analysis.createdAt > latestActivity) {
            latestActivity = analysis.createdAt;
          }
        });

        // Process new analyses from strategy versions
        newAnalyses.forEach((version) => {
          const data = version.analysisData as any;
          
          // Check for BMC
          if (data?.bmc_research) {
            const framework = 'Business Model Canvas';
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }
          
          // Check for Five Whys (rootCause at top level indicates Five Whys)
          if (data?.rootCause && data?.framework === 'five_whys') {
            const framework = 'Five Whys';
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }
          
          // Check for Porter's Five Forces
          if (data?.porters_five_forces) {
            const framework = "Porter's Five Forces";
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }
        });

        const totalAnalyses = oldAnalyses.length + newAnalyses.length;

        return {
          understandingId: stmt.understandingId,
          sessionId: stmt.sessionId,
          statement: stmt.statement,
          title: stmt.title,
          createdAt: stmt.createdAt,
          analyses: analysisSummary,
          totalAnalyses,
          lastActivity: latestActivity,
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

    // Process new Strategy Workspace analyses (BMC, Five Whys, Porter's)
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

        // Extract insights from BMC blocks
        if (bmcData.blocks && Array.isArray(bmcData.blocks)) {
          const allImplications = bmcData.blocks
            .map((block: any) => block.strategicImplications)
            .filter(Boolean);
          
          if (allImplications.length > 0) {
            summary = allImplications.slice(0, 2).join(' ').substring(0, 200) + '...';
            keyFindings = allImplications.slice(0, 3);
          }
        }

        groupedAnalyses[framework].push({
          id: version.id,
          frameworkName: framework,
          version: `v${version.versionNumber}`,
          versionNumber: version.versionNumber,
          createdAt: version.createdAt,
          summary,
          keyFindings,
        });
      }

      // Check for Five Whys analysis (rootCause at top level)
      if (analysisData?.rootCause && analysisData?.framework === 'five_whys') {
        const framework = 'Five Whys';
        
        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }

        const summary = analysisData.rootCause.substring(0, 200) + (analysisData.rootCause.length > 200 ? '...' : '');
        const keyFindings: string[] = [];
        
        // Extract key findings from whysPath
        if (analysisData.whysPath && Array.isArray(analysisData.whysPath)) {
          keyFindings.push(...analysisData.whysPath.slice(0, 3));
        }

        groupedAnalyses[framework].push({
          id: version.id,
          frameworkName: framework,
          version: `v${version.versionNumber}`,
          versionNumber: version.versionNumber,
          createdAt: version.createdAt,
          summary,
          keyFindings,
        });
      }

      // Check for Porter's Five Forces analysis
      if (analysisData?.porters_five_forces) {
        const portersData = analysisData.porters_five_forces;
        const framework = "Porter's Five Forces";
        
        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }

        let summary = '';
        let keyFindings: string[] = [];

        // Extract insights from Porter's forces
        if (portersData.forces && Array.isArray(portersData.forces)) {
          const allImplications = portersData.forces
            .map((force: any) => force.strategicImplication)
            .filter(Boolean);
          
          if (allImplications.length > 0) {
            summary = allImplications.slice(0, 2).join(' ').substring(0, 200) + '...';
            keyFindings = allImplications.slice(0, 3);
          }
        }

        groupedAnalyses[framework].push({
          id: version.id,
          frameworkName: framework,
          version: `v${version.versionNumber}`,
          versionNumber: version.versionNumber,
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

// Batch operations
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid request: ids array is required' });
    }

    // Delete all related data for each understanding
    await db.delete(frameworkInsights).where(inArray(frameworkInsights.understandingId, ids));
    await db.delete(strategicEntities).where(inArray(strategicEntities.understandingId, ids));
    await db.delete(strategicUnderstanding).where(inArray(strategicUnderstanding.id, ids));

    res.json({ success: true, count: ids.length });
  } catch (error) {
    console.error('Error batch deleting statements:', error);
    res.status(500).json({ error: 'Failed to delete statements' });
  }
});

router.post('/batch-archive', async (req, res) => {
  try {
    const { ids, archive = true } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid request: ids array is required' });
    }

    await db
      .update(strategicUnderstanding)
      .set({ archived: archive, updatedAt: new Date() })
      .where(inArray(strategicUnderstanding.id, ids));

    res.json({ success: true, count: ids.length, archived: archive });
  } catch (error) {
    console.error('Error batch archiving statements:', error);
    res.status(500).json({ error: 'Failed to archive statements' });
  }
});

router.post('/batch-export', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid request: ids array is required' });
    }

    const statements = await db
      .select()
      .from(strategicUnderstanding)
      .where(inArray(strategicUnderstanding.id, ids));

    const exportData = await Promise.all(
      statements.map(async (stmt) => {
        const analyses = await db
          .select()
          .from(frameworkInsights)
          .where(eq(frameworkInsights.understandingId, stmt.id));

        const versions = await db
          .select()
          .from(strategyVersions)
          .where(eq(strategyVersions.sessionId, stmt.sessionId));

        return {
          statement: stmt,
          oldAnalyses: analyses,
          newAnalyses: versions,
        };
      })
    );

    res.json({ success: true, data: exportData });
  } catch (error) {
    console.error('Error batch exporting statements:', error);
    res.status(500).json({ error: 'Failed to export statements' });
  }
});

export default router;
