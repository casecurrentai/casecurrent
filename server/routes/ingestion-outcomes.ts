import { Router } from 'express';
import { prisma } from '../db';
import { flexAuthMiddleware, type AuthenticatedRequest } from '../auth';

const router = Router();

// GET /v1/admin/ingestion-outcomes — paginated list, filterable by provider and status
router.get('/v1/admin/ingestion-outcomes', flexAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const provider = req.query.provider as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const where: Record<string, unknown> = {};
    if (provider) where.provider = provider;
    if (status) where.status = status;

    const [rows, total] = await Promise.all([
      prisma.ingestionOutcome.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          provider: true,
          eventType: true,
          externalId: true,
          orgId: true,
          status: true,
          errorCode: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      prisma.ingestionOutcome.count({ where }),
    ]);

    res.json({ rows, total, limit, offset });
  } catch (err: any) {
    console.error('[IngestionOutcomes] list error:', err?.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /v1/admin/ingestion-outcomes/summary — grouped counts by provider+status (default last 24h)
router.get('/v1/admin/ingestion-outcomes/summary', flexAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours as string) || 24, 168);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const rows = await prisma.ingestionOutcome.groupBy({
      by: ['provider', 'status'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
    });

    const summary = rows.map((r) => ({
      provider: r.provider,
      status: r.status,
      count: r._count.id,
    }));

    res.json({ since: since.toISOString(), hours, summary });
  } catch (err: any) {
    console.error('[IngestionOutcomes] summary error:', err?.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /v1/admin/ingestion-outcomes/:id — full detail with payload
router.get('/v1/admin/ingestion-outcomes/:id', flexAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const outcome = await prisma.ingestionOutcome.findUnique({
      where: { id: req.params.id },
    });

    if (!outcome) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.json(outcome);
  } catch (err: any) {
    console.error('[IngestionOutcomes] detail error:', err?.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
