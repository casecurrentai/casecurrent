import { PrismaClient } from '../../apps/api/src/generated/prisma';

export interface IngestionOutcomeParams {
  provider: string;
  eventType: string;
  externalId: string;
  orgId?: string | null;
  status: 'persisted' | 'failed' | 'skipped';
  errorCode?: string | null;
  errorMessage?: string | null;
  payload?: unknown;
}

const MAX_ERROR_MESSAGE_LENGTH = 2000;

/**
 * Record an ingestion outcome for observability and replay.
 * Never throws — logs meta-failure to structured JSON.
 * Only stores payload for non-persisted outcomes (failed/skipped).
 */
export async function recordIngestionOutcome(
  prisma: PrismaClient,
  params: IngestionOutcomeParams,
): Promise<void> {
  try {
    const errorMessage = params.errorMessage
      ? params.errorMessage.slice(0, MAX_ERROR_MESSAGE_LENGTH)
      : null;

    await prisma.ingestionOutcome.create({
      data: {
        provider: params.provider,
        eventType: params.eventType,
        externalId: params.externalId,
        orgId: params.orgId ?? null,
        status: params.status,
        errorCode: params.errorCode ?? null,
        errorMessage,
        payload: params.status !== 'persisted' ? (params.payload as any) ?? null : null,
      },
    });
  } catch (err: any) {
    console.log(JSON.stringify({
      tag: 'ingestion_outcome_write_error',
      provider: params.provider,
      eventType: params.eventType,
      externalId: params.externalId,
      status: params.status,
      error: err?.message || String(err),
    }));
  }
}
