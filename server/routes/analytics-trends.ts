import { Router } from 'express';
import { prisma } from '../db';
import { flexAuthMiddleware, type AuthenticatedRequest } from '../auth';
import { getDailyTrends } from '../analytics/trends';

const router = Router();

// GET /v1/analytics/pi-dashboard/trends — Daily trend data for sparklines
router.get('/v1/analytics/pi-dashboard/trends', flexAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 30));
    const trends = await getDailyTrends(prisma, user.orgId, days);
    res.json(trends);
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({ error: 'Failed to get trends' });
  }
});

export default router;
