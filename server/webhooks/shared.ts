import { PrismaClient } from '../../apps/api/src/generated/prisma';

export function normalizeE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (digits.startsWith('1') && digits.length > 11) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

export function maskPhone(phone: string | null): string {
  if (!phone) return 'null';
  if (phone.length <= 4) return '****';
  return `****${phone.slice(-4)}`;
}

export async function checkIdempotency(
  prisma: PrismaClient,
  provider: string,
  externalId: string,
  eventType: string,
  payload: unknown
): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({
      data: {
        provider,
        externalId,
        eventType,
        payload: payload as any,
      },
    });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return false;
    }
    throw err;
  }
}

/**
 * Roll back an idempotency record inserted by checkIdempotency.
 * Call this in the catch block when the subsequent DB work failed, so the
 * next webhook delivery can be retried from scratch.
 * Never throws — a rollback failure is non-fatal; the operation will still
 * be recorded as failed in IngestionOutcome.
 */
export async function rollbackIdempotency(
  prisma: PrismaClient,
  provider: string,
  externalId: string,
  eventType: string,
): Promise<void> {
  try {
    await prisma.webhookEvent.deleteMany({
      where: { provider, externalId, eventType },
    });
  } catch (err: any) {
    console.log(JSON.stringify({
      tag: 'idempotency_rollback_error',
      provider,
      externalId,
      eventType,
      error: err?.message || String(err),
    }));
  }
}

export async function lookupFirmByNumber(
  prisma: PrismaClient,
  calledNumber: string
): Promise<{ orgId: string; phoneNumberId: string } | null> {
  const normalized = normalizeE164(calledNumber);
  if (!normalized) return null;

  const phoneNumber = await prisma.phoneNumber.findFirst({
    where: {
      e164: normalized,
      inboundEnabled: true,
    },
    select: { id: true, orgId: true },
  });

  if (!phoneNumber) {
    return null;
  }

  return { orgId: phoneNumber.orgId, phoneNumberId: phoneNumber.id };
}

export function extractDisplayName(data: Record<string, unknown>): string | null {
  const nameFields = ['callerName', 'caller_name', 'name', 'fullName', 'full_name'];
  for (const field of nameFields) {
    if (data[field] && typeof data[field] === 'string') {
      return data[field] as string;
    }
  }
  if (data.caller && typeof data.caller === 'object') {
    const caller = data.caller as Record<string, unknown>;
    if (caller.name && typeof caller.name === 'string') return caller.name;
    if (caller.fullName && typeof caller.fullName === 'string') return caller.fullName;
  }
  return null;
}
