import { PrismaClient } from '../../apps/api/src/generated/prisma';

interface FunnelStage {
  name: string;
  count: number;
  conversion: number | null;
  trend: number;
}

interface SpeedMetrics {
  medianMinutes: number | null;
  p90Minutes: number | null;
  within5Min: number;
  within15Min: number;
  within60Min: number;
  missedCallBacklog: number;
}

interface MissedCall {
  id: string;
  callId: string;
  leadId: string;
  contactName: string;
  phone: string;
  calledAt: string;
  waitingMinutes: number;
  resolved: boolean;
}

interface SourceROI {
  source: string;
  calls: number;
  qualified: number;
  signed: number;
  qualifiedRate: number;
  signedRate: number;
}

interface IntakeField {
  field: string;
  captured: number;
  total: number;
  percentage: number;
}

interface IntakeCompleteness {
  overallPercentage: number;
  fields: IntakeField[];
  dropOffStep: string | null;
}

export interface PIDashboardData {
  funnel: FunnelStage[];
  speed: SpeedMetrics;
  rescueQueue: MissedCall[];
  sourceROI: SourceROI[];
  intakeCompleteness: IntakeCompleteness;
  periodStart: string;
  periodEnd: string;
}

const PI_REQUIRED_FIELDS = [
  'callerName',
  'phone',
  'incidentDate',
  'incidentLocation',
  'injuryDescription',
  'atFault',
  'medicalTreatment',
  'insuranceInfo',
];

export async function getPIDashboardData(
  prisma: PrismaClient,
  orgId: string,
  days: number = 30
): Promise<PIDashboardData> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);

  const [
    funnel,
    speed,
    rescueQueue,
    sourceROI,
    intakeCompleteness,
  ] = await Promise.all([
    getFunnelData(prisma, orgId, periodStart, now, prevPeriodStart),
    getSpeedMetrics(prisma, orgId, periodStart, now),
    getRescueQueue(prisma, orgId),
    getSourceROI(prisma, orgId, periodStart, now),
    getIntakeCompleteness(prisma, orgId, periodStart, now),
  ]);

  return {
    funnel,
    speed,
    rescueQueue,
    sourceROI,
    intakeCompleteness,
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
  };
}

async function getFunnelData(
  prisma: PrismaClient,
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
  prevPeriodStart: Date
): Promise<FunnelStage[]> {
  const baseWhere = {
    orgId,
    createdAt: { gte: periodStart, lte: periodEnd },
  };

  const prevBaseWhere = {
    orgId,
    createdAt: { gte: prevPeriodStart, lt: periodStart },
  };

  const [
    inboundCalls,
    answeredCalls,
    qualifiedPI,
    consultScheduled,
    consultCompleted,
    retainerSent,
    retainerSigned,
    prevInboundCalls,
    prevAnsweredCalls,
    prevQualifiedPI,
    prevConsultScheduled,
    prevConsultCompleted,
    prevRetainerSent,
    prevRetainerSigned,
  ] = await Promise.all([
    prisma.call.count({
      where: { ...baseWhere, direction: 'inbound' },
    }),
    prisma.call.count({
      where: { ...baseWhere, direction: 'inbound', callOutcome: 'connected' },
    }),
    prisma.lead.count({
      where: {
        ...baseWhere,
        practiceArea: { name: { contains: 'Personal Injury', mode: 'insensitive' } },
        score: { gte: 50 },
      },
    }),
    prisma.lead.count({
      where: { ...baseWhere, consultScheduledAt: { not: null } },
    }),
    prisma.lead.count({
      where: { ...baseWhere, consultCompletedAt: { not: null } },
    }),
    prisma.lead.count({
      where: { ...baseWhere, retainerSentAt: { not: null } },
    }),
    prisma.lead.count({
      where: { ...baseWhere, retainerSignedAt: { not: null } },
    }),
    prisma.call.count({
      where: { ...prevBaseWhere, direction: 'inbound' },
    }),
    prisma.call.count({
      where: { ...prevBaseWhere, direction: 'inbound', callOutcome: 'connected' },
    }),
    prisma.lead.count({
      where: {
        ...prevBaseWhere,
        practiceArea: { name: { contains: 'Personal Injury', mode: 'insensitive' } },
        score: { gte: 50 },
      },
    }),
    prisma.lead.count({
      where: { ...prevBaseWhere, consultScheduledAt: { not: null } },
    }),
    prisma.lead.count({
      where: { ...prevBaseWhere, consultCompletedAt: { not: null } },
    }),
    prisma.lead.count({
      where: { ...prevBaseWhere, retainerSentAt: { not: null } },
    }),
    prisma.lead.count({
      where: { ...prevBaseWhere, retainerSignedAt: { not: null } },
    }),
  ]);

  const calcTrend = (current: number, prev: number): number => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 100);
  };

  const calcConversion = (current: number, prior: number): number | null => {
    if (prior === 0) return null;
    return Math.round((current / prior) * 100 * 10) / 10;
  };

  return [
    {
      name: 'Inbound Calls',
      count: inboundCalls,
      conversion: null,
      trend: calcTrend(inboundCalls, prevInboundCalls),
    },
    {
      name: 'Answered',
      count: answeredCalls,
      conversion: calcConversion(answeredCalls, inboundCalls),
      trend: calcTrend(answeredCalls, prevAnsweredCalls),
    },
    {
      name: 'Qualified PI',
      count: qualifiedPI,
      conversion: calcConversion(qualifiedPI, answeredCalls),
      trend: calcTrend(qualifiedPI, prevQualifiedPI),
    },
    {
      name: 'Consult Scheduled',
      count: consultScheduled,
      conversion: calcConversion(consultScheduled, qualifiedPI),
      trend: calcTrend(consultScheduled, prevConsultScheduled),
    },
    {
      name: 'Consult Completed',
      count: consultCompleted,
      conversion: calcConversion(consultCompleted, consultScheduled),
      trend: calcTrend(consultCompleted, prevConsultCompleted),
    },
    {
      name: 'Retainer Sent',
      count: retainerSent,
      conversion: calcConversion(retainerSent, consultCompleted),
      trend: calcTrend(retainerSent, prevRetainerSent),
    },
    {
      name: 'Retainer Signed',
      count: retainerSigned,
      conversion: calcConversion(retainerSigned, retainerSent),
      trend: calcTrend(retainerSigned, prevRetainerSigned),
    },
  ];
}

async function getSpeedMetrics(
  prisma: PrismaClient,
  orgId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<SpeedMetrics> {
  const leads = await prisma.lead.findMany({
    where: {
      orgId,
      createdAt: { gte: periodStart, lte: periodEnd },
      firstContactAt: { not: null },
    },
    select: {
      createdAt: true,
      firstContactAt: true,
    },
  });

  const responseTimesMinutes = leads
    .filter((l) => l.firstContactAt)
    .map((l) => {
      const diff = l.firstContactAt!.getTime() - l.createdAt.getTime();
      return diff / (1000 * 60);
    })
    .sort((a, b) => a - b);

  const total = responseTimesMinutes.length;
  const medianMinutes = total > 0 ? responseTimesMinutes[Math.floor(total / 2)] : null;
  const p90Minutes = total > 0 ? responseTimesMinutes[Math.floor(total * 0.9)] : null;

  const within5Min = total > 0 ? Math.round((responseTimesMinutes.filter((t) => t <= 5).length / total) * 100) : 0;
  const within15Min = total > 0 ? Math.round((responseTimesMinutes.filter((t) => t <= 15).length / total) * 100) : 0;
  const within60Min = total > 0 ? Math.round((responseTimesMinutes.filter((t) => t <= 60).length / total) * 100) : 0;

  const missedCallBacklog = await prisma.call.count({
    where: {
      orgId,
      direction: 'inbound',
      callOutcome: { in: ['no-answer', 'busy', 'voicemail'] },
      resolved: false,
    },
  });

  return {
    medianMinutes: medianMinutes !== null ? Math.round(medianMinutes * 10) / 10 : null,
    p90Minutes: p90Minutes !== null ? Math.round(p90Minutes * 10) / 10 : null,
    within5Min,
    within15Min,
    within60Min,
    missedCallBacklog,
  };
}

async function getRescueQueue(
  prisma: PrismaClient,
  orgId: string
): Promise<MissedCall[]> {
  const missedCalls = await prisma.call.findMany({
    where: {
      orgId,
      direction: 'inbound',
      OR: [
        { callOutcome: { in: ['no-answer', 'busy', 'voicemail'] } },
        {
          callOutcome: null,
          transcriptText: null,
          endedAt: { not: null },
        },
      ],
      resolved: false,
    },
    include: {
      lead: {
        include: {
          contact: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: 50,
  });

  const now = new Date();

  return missedCalls.map((call) => {
    const lead = call.lead as { displayName?: string | null; contact: { name: string } };
    return {
      id: call.id,
      callId: call.id,
      leadId: call.leadId,
      contactName: lead?.displayName || lead?.contact?.name || 'Unknown',
      phone: call.fromE164,
      calledAt: call.startedAt.toISOString(),
      waitingMinutes: Math.round((now.getTime() - call.startedAt.getTime()) / (1000 * 60)),
      resolved: call.resolved,
    };
  });
}

async function getSourceROI(
  prisma: PrismaClient,
  orgId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<SourceROI[]> {
  const leads = await prisma.lead.findMany({
    where: {
      orgId,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    select: {
      source: true,
      score: true,
      retainerSignedAt: true,
    },
  });

  const sourceMap = new Map<string, { calls: number; qualified: number; signed: number }>();

  for (const lead of leads) {
    const source = lead.source || 'unknown';
    if (!sourceMap.has(source)) {
      sourceMap.set(source, { calls: 0, qualified: 0, signed: 0 });
    }
    const stats = sourceMap.get(source)!;
    stats.calls++;
    if (lead.score && lead.score >= 50) {
      stats.qualified++;
    }
    if (lead.retainerSignedAt) {
      stats.signed++;
    }
  }

  const phoneNumbers = await prisma.phoneNumber.findMany({
    where: { orgId, sourceTag: { not: null } },
    select: { e164: true, sourceTag: true },
  });

  const phoneSourceMap = new Map<string, string>();
  for (const pn of phoneNumbers) {
    if (pn.sourceTag) {
      phoneSourceMap.set(pn.e164, pn.sourceTag);
    }
  }

  const calls = await prisma.call.findMany({
    where: {
      orgId,
      direction: 'inbound',
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    include: {
      phoneNumber: true,
      lead: {
        select: { score: true, retainerSignedAt: true },
      },
    },
  });

  for (const call of calls) {
    const source = call.phoneNumber?.sourceTag || 'phone';
    if (!sourceMap.has(source)) {
      sourceMap.set(source, { calls: 0, qualified: 0, signed: 0 });
    }
  }

  return Array.from(sourceMap.entries())
    .map(([source, stats]) => ({
      source,
      calls: stats.calls,
      qualified: stats.qualified,
      signed: stats.signed,
      qualifiedRate: stats.calls > 0 ? Math.round((stats.qualified / stats.calls) * 100) : 0,
      signedRate: stats.qualified > 0 ? Math.round((stats.signed / stats.qualified) * 100) : 0,
    }))
    .sort((a, b) => b.calls - a.calls);
}

// Helper to extract a field value from potentially nested intake data
function getIntakeFieldValue(data: Record<string, unknown>, field: string): unknown {
  // Direct flat field access
  if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
    return data[field];
  }
  
  // Nested structure fallback mappings - support both old and new field names
  const nestedMappings: Record<string, string[]> = {
    callerName: ['callerName', 'caller.fullName', 'caller.name'],
    phone: ['phone', 'phoneNumber', 'caller.phone'],
    incidentDate: ['incidentDate'],
    incidentLocation: ['incidentLocation', 'location'],
    injuryDescription: ['injuryDescription', 'summary'],
    atFault: ['atFault', 'atFaultParty', 'conflicts.opposingParty'],
    medicalTreatment: ['medicalTreatment'],
    insuranceInfo: ['insuranceInfo'],
  };
  
  const paths = nestedMappings[field] || [];
  for (const path of paths) {
    const parts = path.split('.');
    let value: unknown = data;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in (value as object)) {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  
  // Special handling for medicalTreatment and insuranceInfo from legacy keyFacts array
  const keyFacts = data.keyFacts as string[] | undefined;
  if (Array.isArray(keyFacts) && keyFacts.length > 0) {
    if (field === 'medicalTreatment') {
      const medicalFact = keyFacts.find((f: string) => 
        f.toLowerCase().includes('medical') || 
        f.toLowerCase().includes('treatment') ||
        f.toLowerCase().includes('hospital') ||
        f.toLowerCase().includes('doctor') ||
        f.toLowerCase().includes('surgery')
      );
      if (medicalFact) return medicalFact;
    }
    if (field === 'insuranceInfo') {
      const insuranceFact = keyFacts.find((f: string) => 
        f.toLowerCase().includes('insurance') ||
        f.toLowerCase().includes('claim')
      );
      if (insuranceFact) return insuranceFact;
    }
  }
  
  return null;
}

async function getIntakeCompleteness(
  prisma: PrismaClient,
  orgId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<IntakeCompleteness> {
  // Include ALL leads for intake completeness, not just PI (to show data for any calls)
  const leads = await prisma.lead.findMany({
    where: {
      orgId,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    select: {
      intakeData: true,
      intake: {
        select: { answers: true, completionStatus: true },
      },
      contact: {
        select: { primaryPhone: true, name: true },
      },
    },
  });

  const fieldCounts: Record<string, number> = {};
  PI_REQUIRED_FIELDS.forEach((f) => (fieldCounts[f] = 0));

  let totalLeads = leads.length;
  let completedIntakes = 0;

  for (const lead of leads) {
    const intakeData = (lead.intakeData as Record<string, unknown>) || {};
    const intakeAnswers = (lead.intake?.answers as Record<string, unknown>) || {};
    const combined = { ...intakeAnswers, ...intakeData };
    
    // Also check contact for phone/name
    if (!combined.phone && !combined['caller'] && lead.contact?.primaryPhone) {
      combined.phone = lead.contact.primaryPhone;
    }
    if (!combined.callerName && !combined['caller'] && lead.contact?.name && lead.contact.name !== 'Unknown Caller') {
      combined.callerName = lead.contact.name;
    }

    for (const field of PI_REQUIRED_FIELDS) {
      const value = getIntakeFieldValue(combined, field);
      if (value !== undefined && value !== null && value !== '') {
        fieldCounts[field]++;
      }
    }

    if (lead.intake?.completionStatus === 'complete') {
      completedIntakes++;
    }
  }

  const fields: IntakeField[] = PI_REQUIRED_FIELDS.map((field) => ({
    field,
    captured: fieldCounts[field],
    total: totalLeads,
    percentage: totalLeads > 0 ? Math.round((fieldCounts[field] / totalLeads) * 100) : 0,
  }));

  const sortedByCapture = [...fields].sort((a, b) => a.percentage - b.percentage);
  const dropOffStep = sortedByCapture.length > 0 && sortedByCapture[0].percentage < 100
    ? sortedByCapture[0].field
    : null;

  const totalCaptured = fields.reduce((sum, f) => sum + f.captured, 0);
  const totalPossible = totalLeads * PI_REQUIRED_FIELDS.length;
  const overallPercentage = totalPossible > 0 ? Math.round((totalCaptured / totalPossible) * 100) : 0;

  return {
    overallPercentage,
    fields,
    dropOffStep,
  };
}

export async function resolveMissedCall(
  prisma: PrismaClient,
  orgId: string,
  callId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const call = await prisma.call.findFirst({
    where: { id: callId, orgId },
  });

  if (!call) {
    return { success: false, error: 'Call not found' };
  }

  await prisma.call.update({
    where: { id: callId },
    data: {
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy: userId,
    },
  });

  return { success: true };
}
