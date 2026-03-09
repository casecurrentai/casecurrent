/**
 * Reconciliation job: resolve parked ElevenLabs post-call payloads.
 *
 * When an ElevenLabs post-call webhook arrives before the matching Call row
 * exists (race between Twilio voice webhook and ElevenLabs delivery), the
 * payload is stored in `unlinked_post_calls`. This job periodically retries
 * correlation and, when found, applies the transcript/summary update.
 *
 * Schedule: run every 60 seconds via setInterval (no external queue needed).
 * Max retries per record: 20 (covers ~20 minutes). After that, left as-is for
 * manual review via /v1/admin/ingestion-outcomes.
 */

import { PrismaClient } from '../../apps/api/src/generated/prisma';
import { recordIngestionOutcome } from '../webhooks/ingestion-outcome';

const MAX_RETRY_COUNT = 20;
const BATCH_SIZE = 20;

export async function reconcileUnlinkedPostCalls(prisma: PrismaClient): Promise<void> {
  let resolved = 0;
  let failed = 0;

  try {
    // Fetch unresolved records, oldest first, up to BATCH_SIZE
    const records = await (prisma as any).unlinkedPostCall.findMany({
      where: {
        resolvedAt: null,
        retryCount: { lt: MAX_RETRY_COUNT },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    if (records.length === 0) return;

    console.log(JSON.stringify({
      tag: '[RECONCILE_START]',
      batchSize: records.length,
    }));

    for (const record of records) {
      try {
        const call = await findCallForRecord(prisma, record);

        if (!call) {
          // Not yet resolvable — increment retry counter
          await (prisma as any).unlinkedPostCall.update({
            where: { id: record.id },
            data: { retryCount: { increment: 1 }, lastRetryAt: new Date() },
          });
          continue;
        }

        // Apply the parked post-call payload to the found Call
        const payload = record.rawPayloadJson as Record<string, unknown>;
        const transcript = (payload.transcript as string | undefined) || null;
        const summary    = (payload.summary    as string | undefined) || null;
        const recording  = (payload.recording_url as string | undefined) || null;
        const duration   = (payload.duration_seconds as number | undefined) || null;
        const outcome    = (payload.outcome as string | undefined) || null;

        const updateData: Record<string, unknown> = {
          transcriptText: transcript || call.transcriptText,
          aiSummary:      summary    || call.aiSummary,
          recordingUrl:   recording  || call.recordingUrl,
          callOutcome:    'connected',
          elevenLabsId:   record.elevenLabsConvId || call.elevenLabsId,
        };
        if (duration && !call.durationSeconds) updateData.durationSeconds = duration;
        if (outcome) updateData.aiFlags = { ...(call.aiFlags as object || {}), aiOutcomeGuess: outcome };

        await prisma.call.update({
          where: { id: call.id },
          data: updateData,
        });

        // Mark record resolved
        await (prisma as any).unlinkedPostCall.update({
          where: { id: record.id },
          data: {
            resolvedCallId: call.id,
            resolvedAt: new Date(),
            lastRetryAt: new Date(),
            retryCount: { increment: 1 },
          },
        });

        await recordIngestionOutcome(prisma, {
          provider: 'elevenlabs',
          eventType: 'post-call-reconciled',
          externalId: record.elevenLabsConvId || record.id,
          orgId: call.orgId,
          status: 'persisted',
        });

        console.log(JSON.stringify({
          tag: '[RECONCILE_RESOLVED]',
          unlinkedId: record.id,
          callId: call.id,
          elevenLabsConvId: record.elevenLabsConvId,
          twilioCallSid: record.twilioCallSid,
        }));

        resolved++;
      } catch (recordErr: any) {
        failed++;
        console.error(JSON.stringify({
          tag: '[RECONCILE_RECORD_ERROR]',
          unlinkedId: record.id,
          error: recordErr?.message || String(recordErr),
        }));
        // Increment retry count even on error so we don't spin on broken records
        await (prisma as any).unlinkedPostCall.update({
          where: { id: record.id },
          data: { retryCount: { increment: 1 }, lastRetryAt: new Date() },
        }).catch(() => {});
      }
    }

    if (resolved > 0 || failed > 0) {
      console.log(JSON.stringify({
        tag: '[RECONCILE_DONE]',
        resolved,
        failed,
        remaining: records.length - resolved - failed,
      }));
    }
  } catch (err: any) {
    console.error(JSON.stringify({
      tag: '[RECONCILE_ERROR]',
      error: err?.message || String(err),
    }));
  }
}

async function findCallForRecord(
  prisma: PrismaClient,
  record: {
    twilioCallSid: string | null;
    elevenLabsConvId: string | null;
    interactionId: string | null;
  }
): Promise<any | null> {
  // Priority: twilioCallSid > elevenLabsConvId > interactionId
  if (record.twilioCallSid) {
    const call = await prisma.call.findUnique({
      where: { twilioCallSid: record.twilioCallSid },
    });
    if (call) return call;
  }

  if (record.elevenLabsConvId) {
    const call = await prisma.call.findUnique({
      where: { elevenLabsId: record.elevenLabsConvId },
    });
    if (call) return call;
  }

  if (record.interactionId) {
    const call = await prisma.call.findFirst({
      where: { interactionId: record.interactionId },
    });
    if (call) return call;
  }

  return null;
}

/**
 * Start the reconciliation loop. Call once at server startup.
 * Returns a cleanup function to clear the interval.
 */
export function startReconciliationLoop(prisma: PrismaClient, intervalMs = 60_000): () => void {
  // Run once immediately (non-blocking), then on schedule
  reconcileUnlinkedPostCalls(prisma).catch(() => {});
  const id = setInterval(() => reconcileUnlinkedPostCalls(prisma).catch(() => {}), intervalMs);
  return () => clearInterval(id);
}
