import { Router } from 'express';
import { generateFullPassExport, loadExportData, generateExcelWorkbook, generatePdfFromHtml, generateUiStyledHtml, findChromiumExecutable } from '../services/export-service';
import { db } from '../db';
import { strategicUnderstanding, epmPrograms, strategyVersions } from '@shared/schema';
import { eq, or } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/exports/full-pass
 * Download a complete export bundle (ZIP) containing Markdown, PDF, DOCX, JSON, and CSV files
 * 
 * Query params:
 * - sessionId: Required - The strategic session ID
 * - versionNumber: Optional - Strategy version number (defaults to latest)
 * - programId: Optional - EPM program ID to include in export
 */
router.get('/full-pass', async (req, res) => {
  try {
    let { sessionId, versionNumber, programId } = req.query;
    const userId = (req.user as any)?.claims?.sub;

    console.log('[Export] Request received:', { sessionId, versionNumber, programId, userId });

    // Authentication check
    if (!userId) {
      console.log('[Export] Authentication failed - no userId');
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Validation - require either sessionId or programId
    if (!sessionId && !programId) {
      console.log('[Export] Validation failed - neither sessionId nor programId provided');
      res.status(400).json({ error: 'sessionId or programId is required' });
      return;
    }

    // Track if ownership was already verified via program
    let ownershipVerifiedViaProgram = false;

    // If no sessionId but we have programId, derive sessionId from program
    if (!sessionId && programId) {
      console.log('[Export] Deriving sessionId from programId:', programId);
      
      const [program] = await db.select()
        .from(epmPrograms)
        .where(eq(epmPrograms.id, programId as string))
        .limit(1);

      if (!program) {
        console.log('[Export] Program not found:', programId);
        res.status(404).json({ error: 'EPM program not found' });
        return;
      }

      // Verify ownership first
      if (program.userId !== userId) {
        console.log('[Export] Program ownership check failed:', { programUserId: program.userId, requestUserId: userId });
        res.status(403).json({ error: 'You do not have permission to access this program' });
        return;
      }

      // Ownership verified via program - no need to check again via strategy_versions
      ownershipVerifiedViaProgram = true;
      console.log('[Export] Ownership verified via program');

      // Get strategy version to find sessionId
      const [version] = await db.select()
        .from(strategyVersions)
        .where(eq(strategyVersions.id, program.strategyVersionId))
        .limit(1);

      if (!version) {
        console.log('[Export] Strategy version not found for program:', program.strategyVersionId);
        res.status(404).json({ error: 'Strategy version not found for this program' });
        return;
      }

      sessionId = version.sessionId as string;
      versionNumber = version.versionNumber.toString();
      console.log('[Export] Derived sessionId and versionNumber:', { sessionId, versionNumber });
    }

    // Ensure sessionId is string type
    if (typeof sessionId !== 'string') {
      console.log('[Export] Invalid sessionId type:', typeof sessionId);
      res.status(400).json({ error: 'Invalid sessionId' });
      return;
    }

    // Ownership verification - Check if user owns the strategic understanding via strategy version
    // Custom journeys use understandingId (strategic_understanding.id) as sessionId,
    // while standard journeys use strategic_understanding.session_id
    console.log('[Export] Checking strategic understanding for sessionId:', sessionId);
    const [understanding] = await db.select()
      .from(strategicUnderstanding)
      .where(or(
        eq(strategicUnderstanding.id, sessionId),
        eq(strategicUnderstanding.sessionId, sessionId)
      ))
      .limit(1);

    if (!understanding) {
      console.log('[Export] Strategic session not found for sessionId:', sessionId);
      res.status(404).json({ error: 'Strategic session not found' });
      return;
    }

    // Verify ownership through strategy version userId (skip if already verified via program)
    if (!ownershipVerifiedViaProgram) {
      // Use the understanding.id for lookup since custom journeys use understandingId as sessionId
      console.log('[Export] Verifying ownership for sessionId:', sessionId);
      const ownershipCheck = await db.select({ userId: strategyVersions.userId })
        .from(strategyVersions)
        .where(or(
          eq(strategyVersions.sessionId, sessionId),
          eq(strategyVersions.sessionId, understanding.id)
        ))
        .limit(1);

      if (!ownershipCheck || ownershipCheck.length === 0) {
        console.log('[Export] No strategy versions found for sessionId:', sessionId);
        res.status(404).json({ error: 'No strategy versions found for this session' });
        return;
      }

      if (ownershipCheck[0].userId !== userId) {
        console.log('[Export] Ownership check failed:', { versionUserId: ownershipCheck[0].userId, requestUserId: userId });
        res.status(403).json({ error: 'You do not have permission to access this strategic session' });
        return;
      }

      console.log('[Export] Ownership verified for user:', userId);
    }
    
    // If programId is provided and wasn't already checked, verify ownership
    if (programId && sessionId === req.query.sessionId) {
      console.log('[Export] Verifying program ownership for programId:', programId);
      const [program] = await db.select()
        .from(epmPrograms)
        .where(eq(epmPrograms.id, programId as string))
        .limit(1);

      if (!program) {
        console.log('[Export] Program not found:', programId);
        res.status(404).json({ error: 'EPM program not found' });
        return;
      }

      if (program.userId !== userId) {
        console.log('[Export] Program ownership check failed:', { programUserId: program.userId, requestUserId: userId });
        res.status(403).json({ error: 'You do not have permission to access this program' });
        return;
      }
    }

    // Helper function to sanitize filename
    const sanitizeFilename = (title: string): string => {
      return title
        .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .trim()
        .substring(0, 100); // Limit length to 100 chars
    };

    // Get title for filename from strategic understanding
    let exportTitle = 'Qgentic Export';
    try {
      if (understanding && understanding.title) {
        exportTitle = sanitizeFilename(understanding.title);
        console.log('[Export] Using understanding title for filename:', exportTitle);
      }
    } catch (err) {
      console.warn('[Export] Failed to get title, using default:', err);
    }

    // Generate filename with human-readable title
    const versionStr = versionNumber ? ` v${versionNumber}` : '';
    const filename = `${exportTitle}${versionStr}.zip`;

    console.log('[Export] Starting export generation:', { sessionId, versionNumber, programId, filename });

    // Set response headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Generate and stream the export
    await generateFullPassExport(
      {
        sessionId: sessionId as string,
        versionNumber: versionNumber ? parseInt(versionNumber as string, 10) : undefined,
        programId: programId as string | undefined,
        userId,
      },
      res
    );

    console.log('[Export] Export generation completed successfully');

  } catch (error) {
    console.error('[Export] Error generating full-pass export:', error);
    console.error('[Export] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Check if headers have already been sent
    if (!res.headersSent) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate export';
      console.log('[Export] Sending error response:', errorMessage);
      res.status(500).json({ error: errorMessage });
    } else {
      // If streaming has started, we can't send JSON error
      console.log('[Export] Headers already sent, ending response');
      res.end();
    }
  }
});

/**
 * GET /api/exports/excel
 * Download Excel workbook with 8 sheets (Summary, WBS, Schedule, Resources, Budget, RACI, Risks, Assumptions)
 */
router.get('/excel', async (req, res) => {
  try {
    const { sessionId, programId } = req.query;
    const userId = (req.user as any)?.claims?.sub;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!sessionId && !programId) {
      res.status(400).json({ error: 'sessionId or programId is required' });
      return;
    }

    const resolvedSessionId = await resolveSessionId(sessionId as string, programId as string, userId, res);
    if (!resolvedSessionId) return;

    const exportPackage = await loadExportData(resolvedSessionId, undefined, programId as string, userId);
    const excelBuffer = await generateExcelWorkbook(exportPackage);

    const filename = `epm-program-${resolvedSessionId.substring(0, 8)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('[Export] Excel export error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Excel export failed' });
  }
});

/**
 * GET /api/exports/pdf
 * Download PDF report with executive summary
 */
router.get('/pdf', async (req, res) => {
  try {
    const { sessionId, programId } = req.query;
    const userId = (req.user as any)?.claims?.sub;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!sessionId && !programId) {
      res.status(400).json({ error: 'sessionId or programId is required' });
      return;
    }

    const chromiumPath = findChromiumExecutable();
    if (!chromiumPath) {
      res.status(503).json({ error: 'PDF generation unavailable - Chromium not installed' });
      return;
    }

    const resolvedSessionId = await resolveSessionId(sessionId as string, programId as string, userId, res);
    if (!resolvedSessionId) return;

    const exportPackage = await loadExportData(resolvedSessionId, undefined, programId as string, userId);
    const html = generateUiStyledHtml(exportPackage);
    const pdfBuffer = await generatePdfFromHtml(html);

    const filename = `strategic-report-${resolvedSessionId.substring(0, 8)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[Export] PDF export error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'PDF export failed' });
  }
});

async function resolveSessionId(
  sessionId: string | undefined,
  programId: string | undefined,
  userId: string,
  res: any
): Promise<string | null> {
  if (sessionId) {
    const [understanding] = await db.select()
      .from(strategicUnderstanding)
      .where(or(
        eq(strategicUnderstanding.id, sessionId),
        eq(strategicUnderstanding.sessionId, sessionId)
      ))
      .limit(1);

    if (!understanding) {
      res.status(404).json({ error: 'Strategic session not found' });
      return null;
    }

    const [ownership] = await db.select({ userId: strategyVersions.userId })
      .from(strategyVersions)
      .where(or(
        eq(strategyVersions.sessionId, sessionId),
        eq(strategyVersions.sessionId, understanding.id)
      ))
      .limit(1);

    if (!ownership || ownership.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return null;
    }

    return sessionId;
  }

  if (programId) {
    const [program] = await db.select()
      .from(epmPrograms)
      .where(eq(epmPrograms.id, programId))
      .limit(1);

    if (!program) {
      res.status(404).json({ error: 'EPM program not found' });
      return null;
    }

    if (program.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return null;
    }

    const [version] = await db.select()
      .from(strategyVersions)
      .where(eq(strategyVersions.id, program.strategyVersionId))
      .limit(1);

    return version?.sessionId || null;
  }

  return null;
}

export default router;
