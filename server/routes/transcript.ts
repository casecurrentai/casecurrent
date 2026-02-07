import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware, type AuthenticatedRequest } from '../auth';
import { getLeadTranscript } from '../analytics/transcript';

const router = Router();

// GET /v1/leads/:leadId/transcript — Speaker-attributed transcript
router.get('/v1/leads/:leadId/transcript', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { leadId } = req.params;
    const search = req.query.search as string | undefined;

    const transcript = await getLeadTranscript(prisma, user.orgId, leadId, search);
    res.json(transcript);
  } catch (error: any) {
    if (error.message === 'Lead not found') {
      return res.status(404).json({ error: 'Lead not found' });
    }
    console.error('Transcript error:', error);
    res.status(500).json({ error: 'Failed to get transcript' });
  }
});

export default router;
