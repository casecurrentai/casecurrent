import type { PrismaClient } from '../../apps/api/src/generated/prisma';

export interface DailyCount {
  date: string; // YYYY-MM-DD
  newLeads: number;
  calls: number;
  qualified: number;
  signed: number;
}

export interface TrendsResponse {
  dailyCounts: DailyCount[];
  periodStart: string;
  periodEnd: string;
}

export async function getDailyTrends(
  prisma: PrismaClient,
  orgId: string,
  days: number = 30,
): Promise<TrendsResponse> {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setHours(23, 59, 59, 999);

  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - days);
  periodStart.setHours(0, 0, 0, 0);

  // Fetch all leads in the period
  const leads = await prisma.lead.findMany({
    where: {
      orgId,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    select: {
      id: true,
      createdAt: true,
      score: true,
      retainerSignedAt: true,
    },
  });

  // Fetch all calls in the period
  const calls = await prisma.call.findMany({
    where: {
      orgId,
      direction: 'inbound',
      startedAt: { gte: periodStart, lte: periodEnd },
    },
    select: {
      id: true,
      startedAt: true,
    },
  });

  // Build a map of dates → counts
  const dateMap = new Map<string, DailyCount>();

  // Initialize all dates in range
  for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    dateMap.set(key, { date: key, newLeads: 0, calls: 0, qualified: 0, signed: 0 });
  }

  // Count leads per day
  for (const lead of leads) {
    const key = lead.createdAt.toISOString().slice(0, 10);
    const entry = dateMap.get(key);
    if (entry) {
      entry.newLeads++;
      if (lead.score != null && lead.score >= 50) {
        entry.qualified++;
      }
      if (lead.retainerSignedAt) {
        // Count signing on the day it was signed, not created
        const signKey = lead.retainerSignedAt.toISOString().slice(0, 10);
        const signEntry = dateMap.get(signKey);
        if (signEntry) signEntry.signed++;
      }
    }
  }

  // Count calls per day
  for (const call of calls) {
    if (call.startedAt) {
      const key = call.startedAt.toISOString().slice(0, 10);
      const entry = dateMap.get(key);
      if (entry) entry.calls++;
    }
  }

  // Sort by date ascending
  const dailyCounts = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    dailyCounts,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}
