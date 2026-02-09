import { Router } from 'express';
import { db } from '../db';
import { storage } from '../storage';
import { strategicUnderstanding, frameworkInsights, strategicEntities, strategyVersions, journeySessions, epmPrograms, references, strategyDecisions } from '@shared/schema';
import { eq, desc, sql, inArray, and } from 'drizzle-orm';
import { getStrategicUnderstanding } from '../services/secure-data-service';
import { decryptKMS } from '../utils/kms-encryption';
import { whysPathToText } from '../utils/whys-path';

const router = Router();

router.get('/statements', async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Join with journeySessions to filter by userId (matches dashboard logic)
    const rawStatements = await db
      .selectDistinct({
        understandingId: strategicUnderstanding.id,
        sessionId: strategicUnderstanding.sessionId,
        statement: strategicUnderstanding.userInput,
        title: strategicUnderstanding.title,
        createdAt: strategicUnderstanding.createdAt,
      })
      .from(strategicUnderstanding)
      .innerJoin(journeySessions, eq(strategicUnderstanding.id, journeySessions.understandingId))
      .where(and(
        eq(journeySessions.userId, userId),
        eq(strategicUnderstanding.archived, false)
      ))
      .orderBy(desc(strategicUnderstanding.createdAt));
    
    // Decrypt userInput for each statement
    const statements = await Promise.all(
      rawStatements.map(async stmt => ({
        ...stmt,
        statement: (await decryptKMS(stmt.statement)) || stmt.statement,
      }))
    );

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

        // Get new analyses from strategyVersions (decrypted via storage layer)
        const newAnalyses = await storage.getStrategyVersionsBySession(stmt.sessionId);

        const analysisSummary: Record<string, { count: number; latestVersion: string }> = {};
        let latestActivity: Date = stmt.createdAt || new Date();
        
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

          // Check for Five Whys (support both new nested structure and old root-level structure)
          const fiveWhysData = data?.five_whys || (data?.rootCause && data?.framework === 'five_whys' ? data : null);
          if (fiveWhysData && (fiveWhysData.rootCause || fiveWhysData.whysPath)) {
            const framework = 'Five Whys';
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }

          // Check for Porter's Five Forces (both key formats: 'porters_five_forces' and 'porters')
          const portersData = data?.porters_five_forces || data?.porters;
          if (portersData) {
            const framework = "Porter's Five Forces";
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }

          // Check for SWOT analysis (Market Entry journey)
          const swotData = data?.swot?.data?.output || data?.swot?.output || data?.swot;
          if (swotData?.strengths || swotData?.weaknesses || swotData?.opportunities || swotData?.threats) {
            const framework = 'SWOT';
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }

          // Check for PESTLE analysis (new format in strategyVersions)
          const pestleData = data?.pestle?.data?.pestleResults || data?.pestle?.pestleResults || data?.pestle;
          if (pestleData?.political || pestleData?.economic || pestleData?.social ||
              pestleData?.technological || pestleData?.legal || pestleData?.environmental) {
            const framework = 'PESTLE';
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }

          // Check for Ansoff Matrix analysis
          const ansoffData = data?.ansoff?.output || data?.ansoff;
          if (ansoffData?.marketPenetration || ansoffData?.marketDevelopment ||
              ansoffData?.productDevelopment || ansoffData?.diversification) {
            const framework = 'Ansoff Matrix';
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }

          // Check for Blue Ocean Strategy analysis
          const blueOceanData = data?.blue_ocean?.output || data?.blue_ocean ||
                                data?.ocean_strategy?.output || data?.ocean_strategy;
          if (blueOceanData?.eliminateFactors || blueOceanData?.reduceFactors ||
              blueOceanData?.raiseFactors || blueOceanData?.createFactors ||
              blueOceanData?.strategyCanvas) {
            const framework = 'Blue Ocean';
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }

          // Check for VRIO analysis
          const vrioData = data?.vrio?.output || data?.vrio;
          if (vrioData?.resources || vrioData?.capabilities || vrioData?.analysis) {
            const framework = 'VRIO';
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }

          // Check for BCG Matrix analysis
          const bcgData = data?.bcg?.output || data?.bcg || data?.bcg_matrix;
          if (bcgData?.stars || bcgData?.cashCows || bcgData?.questionMarks || bcgData?.dogs ||
              bcgData?.products || bcgData?.portfolio) {
            const framework = 'BCG Matrix';
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }

          // Check for Value Chain analysis
          const valueChainData = data?.value_chain?.output || data?.value_chain || data?.valueChain;
          if (valueChainData?.primaryActivities || valueChainData?.supportActivities ||
              valueChainData?.inboundLogistics || valueChainData?.operations) {
            const framework = 'Value Chain';
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }

          // Check for Ocean Strategy analysis
          const oceanStrategyData = data?.ocean_strategy?.output || data?.ocean_strategy;
          if (oceanStrategyData?.strategicMoves || oceanStrategyData?.valueInnovation ||
              oceanStrategyData?.marketCreation) {
            const framework = 'Ocean Strategy';
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }

          // Check for JTBD (Jobs to Be Done) analysis
          const jtbdData = data?.jtbd?.output || data?.jtbd || data?.jobs_to_be_done;
          if (jtbdData?.jobs || jtbdData?.outcomes || jtbdData?.customerJobs) {
            const framework = 'Jobs to Be Done';
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }

          // Check for Competitive Positioning analysis
          const compPosData = data?.competitive_positioning?.output || data?.competitive_positioning;
          if (compPosData?.positioning || compPosData?.competitors || compPosData?.differentiators) {
            const framework = 'Competitive Positioning';
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }

          // Check for Scenario Planning analysis
          const scenarioData = data?.scenario_planning?.output || data?.scenario_planning;
          if (scenarioData?.scenarios || scenarioData?.drivers || scenarioData?.implications) {
            const framework = 'Scenario Planning';
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }

          // Check for OKR Generator analysis
          const okrData = data?.okr_generator?.output || data?.okr_generator || data?.okr;
          if (okrData?.objectives || okrData?.keyResults || okrData?.okrs) {
            const framework = 'OKR';
            if (!analysisSummary[framework]) {
              analysisSummary[framework] = { count: 0, latestVersion: `v${version.versionNumber}` };
            }
            analysisSummary[framework].count++;
            if (version.createdAt && version.createdAt > latestActivity) {
              latestActivity = version.createdAt;
            }
          }

          // Check for Strategic Decisions (user selections from AI-generated options)
          const selectedDecisions = version.selectedDecisions as Record<string, string> | null;
          if (selectedDecisions && typeof selectedDecisions === 'object' && Object.keys(selectedDecisions).length > 0) {
            const framework = 'Strategic Decisions';
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

    // Use the decryption service to get decrypted data
    const understanding = await getStrategicUnderstanding(understandingId);

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

    // Query new Strategy Workspace analyses from strategyVersions table (decrypted)
    // Find all versions associated with this understanding's session
    const newAnalyses = await storage.getStrategyVersionsBySession(understanding.sessionId);

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

      // Check for Five Whys analysis (support both new nested and old root-level structure)
      const fiveWhysData = analysisData?.five_whys || (analysisData?.rootCause && analysisData?.framework === 'five_whys' ? analysisData : null);
      if (fiveWhysData && (fiveWhysData.rootCause || fiveWhysData.whysPath)) {
        const framework = 'Five Whys';
        
        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }

        const rootCause = fiveWhysData.rootCause || '';
        const summary = rootCause.substring(0, 200) + (rootCause.length > 200 ? '...' : '');
        const keyFindings: string[] = [];
        
        // Extract key findings from whysPath
        if (fiveWhysData.whysPath && Array.isArray(fiveWhysData.whysPath)) {
          keyFindings.push(...whysPathToText(fiveWhysData.whysPath).slice(0, 3));
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

      // Check for Porter's Five Forces analysis (both key formats: 'porters_five_forces' and 'porters')
      const portersData = analysisData?.porters_five_forces || analysisData?.porters;
      if (portersData) {
        const framework = "Porter's Five Forces";

        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }

        let summary = '';
        let keyFindings: string[] = [];

        // Extract insights from Porter's forces (check multiple data structures)
        const forces = portersData.forces || portersData.data?.forces;
        if (forces && Array.isArray(forces)) {
          const allImplications = forces
            .map((force: any) => force.strategicImplication || force.analysis)
            .filter(Boolean);

          if (allImplications.length > 0) {
            summary = allImplications.slice(0, 2).join(' ').substring(0, 200) + '...';
            keyFindings = allImplications.slice(0, 3);
          }
        }

        // Also try overall analysis if forces not found
        if (!summary && portersData.overallAttractiveness?.summary) {
          summary = portersData.overallAttractiveness.summary.substring(0, 200);
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

      // Check for SWOT analysis (Market Entry journey)
      const swotData = analysisData?.swot?.data?.output ||
                       analysisData?.swot?.output ||
                       analysisData?.swot;
      if (swotData?.strengths || swotData?.weaknesses || swotData?.opportunities || swotData?.threats) {
        const framework = 'SWOT';

        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }

        let summary = '';
        const keyFindings: string[] = [];

        // Extract key findings from SWOT quadrants
        if (swotData.strengths && Array.isArray(swotData.strengths)) {
          const topStrength = swotData.strengths[0];
          if (topStrength?.name) keyFindings.push(`Strength: ${topStrength.name}`);
        }
        if (swotData.opportunities && Array.isArray(swotData.opportunities)) {
          const topOpp = swotData.opportunities[0];
          if (topOpp?.name) keyFindings.push(`Opportunity: ${topOpp.name}`);
        }
        if (swotData.threats && Array.isArray(swotData.threats)) {
          const topThreat = swotData.threats[0];
          if (topThreat?.name) keyFindings.push(`Threat: ${topThreat.name}`);
        }

        if (keyFindings.length > 0) {
          summary = keyFindings.join('; ').substring(0, 200);
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

      // Check for PESTLE analysis (new format in strategyVersions)
      const pestleData = analysisData?.pestle?.data?.pestleResults ||
                         analysisData?.pestle?.pestleResults ||
                         analysisData?.pestle;
      if (pestleData?.political || pestleData?.economic || pestleData?.social ||
          pestleData?.technological || pestleData?.legal || pestleData?.environmental) {
        const framework = 'PESTLE';

        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }

        let summary = '';
        const keyFindings: string[] = [];

        // Extract key trends from each factor
        const factors = ['political', 'economic', 'social', 'technological', 'legal', 'environmental'];
        for (const factor of factors) {
          const factorData = pestleData[factor];
          if (factorData?.trends && Array.isArray(factorData.trends) && factorData.trends.length > 0) {
            const trend = factorData.trends[0];
            if (trend?.description) {
              keyFindings.push(`${factor.charAt(0).toUpperCase() + factor.slice(1)}: ${trend.description.substring(0, 50)}`);
            }
          }
        }

        if (keyFindings.length > 0) {
          summary = keyFindings.slice(0, 2).join('; ').substring(0, 200);
        }

        groupedAnalyses[framework].push({
          id: version.id,
          frameworkName: framework,
          version: `v${version.versionNumber}`,
          versionNumber: version.versionNumber,
          createdAt: version.createdAt,
          summary,
          keyFindings: keyFindings.slice(0, 3),
        });
      }

      // Check for Ansoff Matrix analysis
      const ansoffData = analysisData?.ansoff?.output || analysisData?.ansoff;
      if (ansoffData?.marketPenetration || ansoffData?.marketDevelopment ||
          ansoffData?.productDevelopment || ansoffData?.diversification) {
        const framework = 'Ansoff Matrix';
        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }
        let summary = '';
        const keyFindings: string[] = [];
        if (ansoffData.recommendation?.primaryStrategy) {
          summary = `Recommended: ${ansoffData.recommendation.primaryStrategy}`;
          keyFindings.push(summary);
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

      // Check for Blue Ocean Strategy analysis
      const blueOceanData = analysisData?.blue_ocean?.output || analysisData?.blue_ocean ||
                            analysisData?.ocean_strategy?.output || analysisData?.ocean_strategy;
      if (blueOceanData?.eliminateFactors || blueOceanData?.reduceFactors ||
          blueOceanData?.raiseFactors || blueOceanData?.createFactors ||
          blueOceanData?.strategyCanvas || blueOceanData?.strategicMoves) {
        const framework = 'Blue Ocean';
        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }
        let summary = '';
        const keyFindings: string[] = [];
        if (blueOceanData.createFactors?.length) {
          keyFindings.push(`Create: ${blueOceanData.createFactors[0]?.factor || blueOceanData.createFactors[0]}`);
        }
        if (blueOceanData.eliminateFactors?.length) {
          keyFindings.push(`Eliminate: ${blueOceanData.eliminateFactors[0]?.factor || blueOceanData.eliminateFactors[0]}`);
        }
        if (keyFindings.length > 0) {
          summary = keyFindings.join('; ').substring(0, 200);
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

      // Check for VRIO analysis
      const vrioData = analysisData?.vrio?.output || analysisData?.vrio;
      if (vrioData?.resources || vrioData?.capabilities || vrioData?.analysis) {
        const framework = 'VRIO';
        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }
        let summary = '';
        const keyFindings: string[] = [];
        const resources = vrioData.resources || vrioData.analysis || [];
        if (Array.isArray(resources) && resources.length > 0) {
          const sustained = resources.filter((r: any) => r.sustainedAdvantage || r.competitiveAdvantage === 'sustained');
          if (sustained.length > 0) {
            keyFindings.push(`Sustained advantages: ${sustained.length}`);
          }
        }
        if (keyFindings.length > 0) {
          summary = keyFindings.join('; ').substring(0, 200);
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

      // Check for BCG Matrix analysis
      const bcgData = analysisData?.bcg_matrix?.output || analysisData?.bcg_matrix || analysisData?.bcg;
      if (bcgData?.stars || bcgData?.cashCows || bcgData?.questionMarks || bcgData?.dogs ||
          bcgData?.products || bcgData?.portfolio) {
        const framework = 'BCG Matrix';
        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }
        let summary = '';
        const keyFindings: string[] = [];
        if (bcgData.stars?.length) keyFindings.push(`Stars: ${bcgData.stars.length}`);
        if (bcgData.cashCows?.length) keyFindings.push(`Cash Cows: ${bcgData.cashCows.length}`);
        if (keyFindings.length > 0) {
          summary = keyFindings.join(', ').substring(0, 200);
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

      // Check for Value Chain analysis
      const valueChainData = analysisData?.value_chain?.output || analysisData?.value_chain || analysisData?.valueChain;
      if (valueChainData?.primaryActivities || valueChainData?.supportActivities ||
          valueChainData?.inboundLogistics || valueChainData?.operations) {
        const framework = 'Value Chain';
        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }
        let summary = '';
        const keyFindings: string[] = [];
        if (valueChainData.primaryActivities?.length) {
          keyFindings.push(`Primary activities: ${valueChainData.primaryActivities.length}`);
        }
        if (valueChainData.supportActivities?.length) {
          keyFindings.push(`Support activities: ${valueChainData.supportActivities.length}`);
        }
        if (keyFindings.length > 0) {
          summary = keyFindings.join(', ').substring(0, 200);
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

      // Check for JTBD (Jobs to Be Done) analysis
      const jtbdData = analysisData?.jtbd?.output || analysisData?.jtbd || analysisData?.jobs_to_be_done;
      if (jtbdData?.jobs || jtbdData?.outcomes || jtbdData?.customerJobs) {
        const framework = 'Jobs to Be Done';
        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }
        let summary = '';
        const keyFindings: string[] = [];
        const jobs = jtbdData.jobs || jtbdData.customerJobs || [];
        if (Array.isArray(jobs) && jobs.length > 0) {
          keyFindings.push(`Jobs identified: ${jobs.length}`);
          if (jobs[0]?.job || jobs[0]?.description) {
            keyFindings.push(jobs[0].job || jobs[0].description);
          }
        }
        if (keyFindings.length > 0) {
          summary = keyFindings[0].substring(0, 200);
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

      // Check for Competitive Positioning analysis
      const compPosData = analysisData?.competitive_positioning?.output || analysisData?.competitive_positioning;
      if (compPosData?.positioning || compPosData?.competitors || compPosData?.differentiators) {
        const framework = 'Competitive Positioning';
        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }
        let summary = '';
        const keyFindings: string[] = [];
        if (compPosData.positioning) {
          keyFindings.push(`Position: ${compPosData.positioning}`);
        }
        if (compPosData.differentiators?.length) {
          keyFindings.push(`Differentiators: ${compPosData.differentiators.length}`);
        }
        if (keyFindings.length > 0) {
          summary = keyFindings.join('; ').substring(0, 200);
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

      // Check for Scenario Planning analysis
      const scenarioData = analysisData?.scenario_planning?.output || analysisData?.scenario_planning;
      if (scenarioData?.scenarios || scenarioData?.drivers || scenarioData?.implications) {
        const framework = 'Scenario Planning';
        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }
        let summary = '';
        const keyFindings: string[] = [];
        if (scenarioData.scenarios?.length) {
          keyFindings.push(`Scenarios: ${scenarioData.scenarios.length}`);
        }
        if (scenarioData.drivers?.length) {
          keyFindings.push(`Key drivers: ${scenarioData.drivers.length}`);
        }
        if (keyFindings.length > 0) {
          summary = keyFindings.join(', ').substring(0, 200);
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

      // Check for OKR Generator analysis
      const okrData = analysisData?.okr_generator?.output || analysisData?.okr_generator || analysisData?.okr;
      if (okrData?.objectives || okrData?.keyResults || okrData?.okrs) {
        const framework = 'OKR';
        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }
        let summary = '';
        const keyFindings: string[] = [];
        const objectives = okrData.objectives || okrData.okrs || [];
        if (Array.isArray(objectives) && objectives.length > 0) {
          keyFindings.push(`Objectives: ${objectives.length}`);
        }
        if (keyFindings.length > 0) {
          summary = keyFindings.join(', ').substring(0, 200);
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

      // Check for Strategic Decisions (user selections from AI-generated options)
      const selectedDecisions = version.selectedDecisions as Record<string, string> | null;
      if (selectedDecisions && typeof selectedDecisions === 'object' && Object.keys(selectedDecisions).length > 0) {
        const framework = 'Strategic Decisions';
        if (!groupedAnalyses[framework]) {
          groupedAnalyses[framework] = [];
        }
        const decisionCount = Object.keys(selectedDecisions).length;
        const summary = `${decisionCount} strategic decision${decisionCount !== 1 ? 's' : ''} made`;
        const keyFindings = Object.entries(selectedDecisions).slice(0, 3).map(([key, value]) =>
          `${key}: ${value}`.substring(0, 100)
        );
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

// Get deletion preview - shows what will be deleted
router.get('/:id/deletion-preview', async (req, res) => {
  try {
    const understandingId = req.params.id;

    // Get understanding with sessionId
    const [understanding] = await db
      .select({ sessionId: strategicUnderstanding.sessionId })
      .from(strategicUnderstanding)
      .where(eq(strategicUnderstanding.id, understandingId));

    if (!understanding) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const sessionId = understanding.sessionId;

    // Count journey sessions
    const [journeyCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(journeySessions)
      .where(eq(journeySessions.understandingId, understandingId));

    // Count strategy versions
    const [versionCount] = sessionId
      ? await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(strategyVersions)
          .where(eq(strategyVersions.sessionId, sessionId))
      : [{ count: 0 }];

    // Count EPM programs (via strategy versions)
    const [epmCount] = sessionId
      ? await db
          .select({ count: sql<number>`COUNT(DISTINCT ${epmPrograms.id})` })
          .from(epmPrograms)
          .innerJoin(strategyVersions, eq(epmPrograms.strategyVersionId, strategyVersions.id))
          .where(eq(strategyVersions.sessionId, sessionId))
      : [{ count: 0 }];

    // Count references
    const [refCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(references)
      .where(eq(references.understandingId, understandingId));

    res.json({
      journeys: journeyCount?.count || 0,
      versions: versionCount?.count || 0,
      epmPrograms: epmCount?.count || 0,
      references: refCount?.count || 0,
    });
  } catch (error) {
    console.error('Error fetching deletion preview:', error);
    res.status(500).json({ error: 'Failed to fetch deletion preview' });
  }
});

// Batch operations
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid request: ids array is required' });
    }

    // Get sessionIds for these understandings before deletion
    const understandings = await db
      .select({ sessionId: strategicUnderstanding.sessionId })
      .from(strategicUnderstanding)
      .where(inArray(strategicUnderstanding.id, ids));
    
    const sessionIds = understandings
      .map(u => u.sessionId)
      .filter((id): id is string => id !== null);

    // CASCADE DELETE in proper order:
    // 1. Delete journey_sessions (references understanding_id with CASCADE)
    await db.delete(journeySessions).where(inArray(journeySessions.understandingId, ids));

    // 2. Delete references (references understanding_id with CASCADE)
    await db.delete(references).where(inArray(references.understandingId, ids));

    // 3. Delete old framework insights
    await db.delete(frameworkInsights).where(inArray(frameworkInsights.understandingId, ids));

    // 4. Delete strategic entities and relationships (CASCADE handles relationships)
    await db.delete(strategicEntities).where(inArray(strategicEntities.understandingId, ids));

    // 5. Delete strategy versions and their dependencies
    if (sessionIds.length > 0) {
      // Get all strategy version IDs
      const versions = await db
        .select({ id: strategyVersions.id })
        .from(strategyVersions)
        .where(inArray(strategyVersions.sessionId, sessionIds));
      
      const versionIds = versions.map(v => v.id);

      if (versionIds.length > 0) {
        // First, clear foreign key references
        await db
          .update(strategyVersions)
          .set({ convertedProgramId: null })
          .where(inArray(strategyVersions.id, versionIds));

        // Delete EPM programs (CASCADE from strategy_versions)
        await db.delete(epmPrograms).where(inArray(epmPrograms.strategyVersionId, versionIds));
        
        // Delete strategy decisions (CASCADE from strategy_versions)
        await db.delete(strategyDecisions).where(inArray(strategyDecisions.strategyVersionId, versionIds));
      }

      // Delete strategy versions
      await db.delete(strategyVersions).where(inArray(strategyVersions.sessionId, sessionIds));
    }
    
    // 6. Finally delete the strategic understanding root
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

    // Get the sessionIds for these understandings
    const understandings = await db
      .select({ sessionId: strategicUnderstanding.sessionId })
      .from(strategicUnderstanding)
      .where(inArray(strategicUnderstanding.id, ids));
    
    const sessionIds = understandings
      .map(u => u.sessionId)
      .filter((id): id is string => id !== null);

    // Archive the strategic understanding records
    await db
      .update(strategicUnderstanding)
      .set({ archived: archive, updatedAt: new Date() })
      .where(inArray(strategicUnderstanding.id, ids));

    // CASCADE: Archive all related strategyVersions
    if (sessionIds.length > 0) {
      await db
        .update(strategyVersions)
        .set({ archived: archive, updatedAt: new Date() })
        .where(inArray(strategyVersions.sessionId, sessionIds));
    }

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

        const versions = await storage.getStrategyVersionsBySession(stmt.sessionId);

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
