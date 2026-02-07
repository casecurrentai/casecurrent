import { Router } from 'express';
import { prisma } from '../db';
import { authMiddleware, type AuthenticatedRequest } from '../auth';
import { summarizeCall } from '../ai/summarize';

const router = Router();

// POST /v1/ai/summarize/:callId — Summarize a call using LLM
router.post('/v1/ai/summarize/:callId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { callId } = req.params;

    const call = await prisma.call.findFirst({
      where: { id: callId, orgId: user.orgId },
      include: {
        interaction: {
          include: { lead: true },
        },
      },
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    if (!call.transcriptText) {
      return res.status(400).json({ error: 'No transcript available. Run transcription first.' });
    }

    // Get intake data from lead if available
    const intakeData = (call.interaction?.lead?.intakeData as Record<string, unknown>) ?? null;

    const summary = await summarizeCall(call.transcriptText, intakeData);

    await prisma.call.update({
      where: { id: callId },
      data: {
        aiSummary: JSON.stringify(summary),
        aiFlags: {
          sentiment: summary.sentiment,
          keyMoments: summary.keyMoments,
          completeness: summary.completeness,
          provider: process.env.OPENAI_API_KEY ? 'openai' : 'rule-based',
          model: process.env.OPENAI_API_KEY ? 'gpt-4o-mini' : 'rule-based-v1',
          processedAt: new Date().toISOString(),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        orgId: user.orgId,
        actorUserId: user.userId,
        actorType: 'user',
        action: 'ai.summarize',
        entityType: 'call',
        entityId: callId,
        details: { provider: process.env.OPENAI_API_KEY ? 'openai' : 'rule-based' },
      },
    });

    console.log(`[AI PIPELINE] summarization completed for call ${callId}`);
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Summarization error:', error);
    res.status(500).json({ error: 'Failed to summarize' });
  }
});

export default router;
