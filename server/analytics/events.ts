import { prisma } from '../db';
import type { Prisma } from '../db';

export type AnalyticsEventType =
  | 'lead.created'
  | 'lead.updated'
  | 'call.incoming'
  | 'call.completed'
  | 'sms.sent'
  | 'sms.received'
  | 'intake.link_generated'
  | 'experiment.exposure'
  | 'experiment.conversion';

export interface AnalyticsEventData {
  orgId: string;
  userId?: string;
  leadId?: string;
  practiceAreaId?: string;
  type: AnalyticsEventType;
  payload: Prisma.InputJsonValue;
}

export async function logAnalyticsEvent(data: AnalyticsEventData): Promise<string> {
  const event = await prisma.analyticsEvent.create({
    data: {
      orgId: data.orgId,
      userId: data.userId,
      leadId: data.leadId,
      practiceAreaId: data.practiceAreaId,
      type: data.type,
      payload: data.payload,
    },
  });
  return event.id;
}

export async function logAnalyticsEvents(events: AnalyticsEventData[]): Promise<number> {
  const result = await prisma.analyticsEvent.createMany({
    data: events.map((e) => ({
      orgId: e.orgId,
      userId: e.userId,
      leadId: e.leadId,
      practiceAreaId: e.practiceAreaId,
      type: e.type,
      payload: e.payload,
    })),
  });
  return result.count;
}

export interface AnalyticsQueryParams {
  orgId: string;
  startDate?: Date;
  endDate?: Date;
  types?: AnalyticsEventType[];
  practiceAreaId?: string;
  leadId?: string;
}

export async function queryAnalyticsEvents(params: AnalyticsQueryParams) {
  const where: Record<string, unknown> = { orgId: params.orgId };

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) (where.createdAt as Record<string, Date>).gte = params.startDate;
    if (params.endDate) (where.createdAt as Record<string, Date>).lte = params.endDate;
  }

  if (params.types && params.types.length > 0) {
    where.type = { in: params.types };
  }

  if (params.practiceAreaId) {
    where.practiceAreaId = params.practiceAreaId;
  }

  if (params.leadId) {
    where.leadId = params.leadId;
  }

  return prisma.analyticsEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

export async function countAnalyticsEvents(params: AnalyticsQueryParams) {
  const where: Record<string, unknown> = { orgId: params.orgId };

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) (where.createdAt as Record<string, Date>).gte = params.startDate;
    if (params.endDate) (where.createdAt as Record<string, Date>).lte = params.endDate;
  }

  if (params.types && params.types.length > 0) {
    where.type = { in: params.types };
  }

  if (params.practiceAreaId) {
    where.practiceAreaId = params.practiceAreaId;
  }

  return prisma.analyticsEvent.count({ where });
}

export async function getEventCountsByType(params: AnalyticsQueryParams) {
  const events = await queryAnalyticsEvents(params);
  const counts: Record<string, number> = {};

  for (const event of events) {
    counts[event.type] = (counts[event.type] || 0) + 1;
  }

  return counts;
}
