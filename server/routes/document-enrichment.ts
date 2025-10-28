import { Router, type Request, type Response } from 'express';
import { backgroundJobService } from '../services/background-job-service';
import { isAuthenticated } from '../replitAuth';

const router = Router();

/**
 * GET /api/document-enrichment/notifications
 * Get completed document enrichment jobs for the current user
 */
router.get('/notifications', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get completed enrichment jobs from the last 24 hours
    const allJobs = await backgroundJobService.getRecentJobs(userId, 50);
    
    // Filter for completed document_enrichment jobs only
    const enrichmentJobs = allJobs.filter(
      job => job.jobType === 'document_enrichment' && 
             job.status === 'completed' &&
             job.resultData &&
             !(job.resultData as any).ignored
    );

    // Transform to notification format
    const notifications = enrichmentJobs.map(job => {
      const resultData = job.resultData as any;
      return {
        id: job.id,
        understandingId: resultData.understandingId,
        entityCount: resultData.entityCount || 0,
        fileName: resultData.fileName || 'document',
        completedAt: job.completedAt || job.updatedAt,
      };
    });

    res.json({ jobs: notifications });
  } catch (error: any) {
    console.error('[Document Enrichment] Error fetching notifications:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
  }
});

export default router;
