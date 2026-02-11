import type { PrismaClient } from '../../apps/api/src/generated/prisma';

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

interface KeyMoment {
  timestamp: string | null;
  text: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  callId?: string;
}

interface CompletenessField {
  field: string;
  status: 'captured' | 'missing' | 'partial';
}

export interface CaseSummaryResponse {
  snapshot: string | null;
  keyMoments: KeyMoment[];
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  completeness: CompletenessField[];
  lastSummarizedAt: string | null;
}

export async function getCaseSummary(
  prisma: PrismaClient,
  orgId: string,
  leadId: string,
): Promise<CaseSummaryResponse> {
  // Fetch lead with all calls
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, orgId },
    include: {
      calls: {
        orderBy: { startedAt: 'desc' },
      },
    },
  });

  if (!lead) {
    throw new Error('Lead not found');
  }

  // Collect all calls from lead
  const allCalls = lead.calls;

  // Find the best summary from calls (most recent with aiSummary)
  let snapshot: string | null = null;
  let sentiment: 'positive' | 'neutral' | 'negative' | null = null;
  let keyMoments: KeyMoment[] = [];
  let lastSummarizedAt: string | null = null;

  for (const call of allCalls) {
    if (!call.aiSummary) continue;

    // Try parsing structured summary (from new summarize module)
    try {
      const parsed = JSON.parse(call.aiSummary);
      if (parsed.snapshot) {
        snapshot = snapshot || parsed.snapshot;
        sentiment = sentiment || parsed.sentiment || null;
        lastSummarizedAt = lastSummarizedAt || (call.updatedAt?.toISOString() ?? null);

        if (Array.isArray(parsed.keyMoments)) {
          keyMoments.push(
            ...parsed.keyMoments.map((m: any) => ({
              timestamp: m.timestamp || null,
              text: m.text || '',
              sentiment: m.sentiment || 'neutral',
              callId: call.id,
            })),
          );
        }
      }
    } catch {
      // Legacy string summary (from intake extraction)
      if (!snapshot && call.aiSummary.length > 10) {
        snapshot = call.aiSummary;
      }
    }

    // Extract sentiment/key moments from aiFlags if available
    const flags = call.aiFlags as Record<string, unknown> | null;
    if (flags) {
      if (!sentiment && flags.sentiment) {
        sentiment = flags.sentiment as 'positive' | 'neutral' | 'negative';
      }
      if (Array.isArray(flags.keyMoments) && keyMoments.length === 0) {
        keyMoments.push(
          ...flags.keyMoments.map((m: any) => ({
            timestamp: m.timestamp || null,
            text: m.text || '',
            sentiment: m.sentiment || 'neutral',
            callId: call.id,
          })),
        );
      }
      if (!lastSummarizedAt && flags.processedAt) {
        lastSummarizedAt = flags.processedAt as string;
      }
    }
  }

  // Fall back to lead's intakeData summary if no call summary
  if (!snapshot) {
    const intakeData = lead.intakeData as Record<string, unknown> | null;
    if (intakeData?.summary && typeof intakeData.summary === 'string') {
      snapshot = intakeData.summary;
    }
  }

  // Compute completeness from intakeData
  const intakeData = lead.intakeData as Record<string, unknown> | null;
  const completeness = computeCompleteness(intakeData);

  return {
    snapshot,
    keyMoments: keyMoments.slice(0, 10),
    sentiment,
    completeness,
    lastSummarizedAt,
  };
}

function computeCompleteness(intakeData: Record<string, unknown> | null): CompletenessField[] {
  if (!intakeData) {
    return PI_REQUIRED_FIELDS.map((field) => ({ field, status: 'missing' as const }));
  }

  return PI_REQUIRED_FIELDS.map((field) => {
    let value: unknown = intakeData[field];

    // Check nested caller object
    if (!value && field === 'callerName') {
      const caller = intakeData.caller as Record<string, unknown> | undefined;
      value = caller?.fullName || caller?.firstName;
    }
    if (!value && field === 'phone') {
      const caller = intakeData.caller as Record<string, unknown> | undefined;
      value = caller?.phone || intakeData.phoneNumber || intakeData.from;
    }
    if (!value && field === 'incidentLocation') {
      value = intakeData.location;
    }
    if (!value && field === 'injuryDescription') {
      value = intakeData.summary;
    }

    if (value && typeof value === 'string' && value.trim()) {
      return { field, status: 'captured' as const };
    }

    // Check keyFacts array for partial matches
    const keyFacts = intakeData.keyFacts;
    if (Array.isArray(keyFacts)) {
      const hints: Record<string, RegExp> = {
        medicalTreatment: /medical|hospital|doctor|treatment|surgery/i,
        insuranceInfo: /insurance|policy|coverage|claim/i,
        atFault: /fault|liability|responsible|other driver/i,
      };
      if (hints[field] && keyFacts.some((f) => typeof f === 'string' && hints[field].test(f))) {
        return { field, status: 'partial' as const };
      }
    }

    return { field, status: 'missing' as const };
  });
}
