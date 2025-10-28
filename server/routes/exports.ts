import { Router } from 'express';
import { generateFullPassExport } from '../services/export-service';
import { db } from '../db';
import { strategicUnderstanding, epmPrograms, strategyVersions } from '@shared/schema';
import { eq } from 'drizzle-orm';

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
    const { sessionId, versionNumber, programId } = req.query;
    const userId = (req.user as any)?.id;

    // Authentication check
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Validation
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    // Ownership verification - Check if user owns the strategic understanding via strategy version
    const [understanding] = await db.select()
      .from(strategicUnderstanding)
      .where(eq(strategicUnderstanding.sessionId, sessionId))
      .limit(1);

    if (!understanding) {
      res.status(404).json({ error: 'Strategic session not found' });
      return;
    }

    // Verify ownership through strategy version userId
    const ownershipCheck = await db.select({ userId: strategyVersions.userId })
      .from(strategyVersions)
      .where(eq(strategyVersions.sessionId, sessionId))
      .limit(1);

    if (!ownershipCheck || ownershipCheck.length === 0) {
      res.status(404).json({ error: 'No strategy versions found for this session' });
      return;
    }

    if (ownershipCheck[0].userId !== userId) {
      res.status(403).json({ error: 'You do not have permission to access this strategic session' });
      return;
    }
    
    // If programId is provided, verify ownership
    if (programId) {
      const [program] = await db.select()
        .from(epmPrograms)
        .where(eq(epmPrograms.id, programId as string))
        .limit(1);

      if (!program) {
        res.status(404).json({ error: 'EPM program not found' });
        return;
      }

      if (program.userId !== userId) {
        res.status(403).json({ error: 'You do not have permission to access this program' });
        return;
      }
    }

    // Generate filename
    const versionStr = versionNumber ? `-v${versionNumber}` : '-latest';
    const filename = `qgentic-export-${sessionId}${versionStr}.zip`;

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

  } catch (error) {
    console.error('[Export] Error generating full-pass export:', error);
    
    // Check if headers have already been sent
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate export' });
    } else {
      // If streaming has started, we can't send JSON error
      // Just end the response
      res.end();
    }
  }
});

export default router;
