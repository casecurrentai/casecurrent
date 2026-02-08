import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware, type AuthenticatedRequest } from '../auth';
import { getCaseSummary } from '../analytics/caseSummary';

const router = Router();

// GET /v1/leads/:leadId/summary — Aggregated case summary
router.get('/v1/leads/:leadId/summary', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { leadId } = req.params;

    const summary = await getCaseSummary(prisma, user.orgId, leadId);
    res.json(summary);
  } catch (error: any) {
    if (error.message === 'Lead not found') {
      return res.status(404).json({ error: 'Lead not found' });
    }
    console.error('Case summary error:', error);
    res.status(500).json({ error: 'Failed to get case summary' });
  }
});

export default router;
