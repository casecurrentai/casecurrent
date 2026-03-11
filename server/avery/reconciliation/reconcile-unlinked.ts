/**
 * Reconciliation of parked ElevenLabs post-call payloads.
 *
 * When the post-call webhook fires before the Call row exists (race condition),
 * the payload is parked in `unlinked_post_calls` and given a 202 response.
 * This module re-attempts correlation and applies the full post-call pipeline
 * (call update + lead update + Avery analysis) once the Call row exists.
 *
 * Idempotency:
 *  - Records with resolvedAt != null are skipped.
 *  - Calls that already have avery_analyzed_at in aiFlags are skipped.
 *  - retryCount + lastRetryAt are updated on every attempt (matched or not).
 *
 * Never throws — errors are logged per-record and the batch continues.
 */

import { PrismaClient } from '../../../apps/api/src/generated/prisma';
import { normalizeElevenLabsPostCallPayload } from '../elevenlabs/normalize-payload';
import { runPostCallAnalysis } from '../persistence/postcall-analysis';
import { logAveryEvent } from '../persistence/event-log';
import { extractDisplayName } from '../../webhooks/shared';

// ─── Correlation (mirrors elevenlabs.ts findCallByCorrelation) ─────────────────

async function findCallForParkedPayload(
  prisma: PrismaClient,
  payload: Record<string, unknown>,
): Promise<{ call: any; correlationMethod: string } | null> {
  const clientData = payload.client_data as Record<string, unknown> | undefined;

  if (clientData?.interactionId) {
    const call = await prisma.call.findFirst({
      where: { interactionId: clientData.interactionId as string },
      include: { lead: true },
    });
    if (call) return { call, correlationMethod: 'clientData.interactionId' };
  }

  if (clientData?.callSid) {
    const call = await prisma.call.findFirst({
      where: { twilioCallSid: clientData.callSid as string },
      include: { lead: true },
    });
    if (call) return { call, correlationMethod: 'clientData.callSid' };
  }

  if (payload.conversation_id) {
    const call = await prisma.call.findFirst({
      where: { elevenLabsId: payload.conversation_id as string },
      include: { lead: true },
    });
    if (call) return { call, correlationMethod: 'conversation_id' };
  }

  if (payload.call_sid) {
    const call = await prisma.call.findFirst({
      where: { twilioCallSid: payload.call_sid as string },
      include: { lead: true },
    });
    if (call) return { call, correlationMethod: 'call_sid' };
  }

  return null;
}

// ─── Transcript normalizer (mirrors elevenlabs.ts normalizeTranscript) ─────────

interface NormalizedTranscriptEntry {
  role: string;
  message: string;
  timeInCallSecs: number | null;
}

function normalizeTranscript(
  raw: Array<Record<string, unknown>> | undefined,
): NormalizedTranscriptEntry[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const role = (entry.role || entry.speaker || 'unknown') as string;
    const message = (entry.message || entry.text || entry.content || '') as string;
    let timeInCallSecs: number | null = null;
    if (typeof entry.timeInCallSecs === 'number') timeInCallSecs = entry.timeInCallSecs;
    else if (typeof entry.time === 'number') timeInCallSecs = entry.time;
    else if (typeof entry.start_time === 'number') timeInCallSecs = entry.start_time;
    else if (typeof entry.timestamp === 'number') timeInCallSecs = entry.timestamp;
    return { role: String(role), message: String(message), timeInCallSecs };
  });
}

// ─── Apply post-call payload to an existing Call row ─────────────────────────

async function applyParkedPayload(
  prisma: PrismaClient,
  call: any,
  payload: Record<string, unknown>,
  parkedId: string,
): Promise<void> {
  const conversationId = payload.conversation_id as string | undefined;
  const transcript = payload.transcript as string | undefined;
  const transcriptJson = payload.transcript_json as Array<Record<string, unknown>> | undefined;
  const summary = payload.summary as string | undefined;
  const recordingUrl = payload.recording_url as string | undefined;
  const outcome = payload.outcome as string | undefined;
  const endedAt = payload.ended_at as string | undefined;
  const durationSeconds = payload.duration_seconds as number | undefined;
  const extractedData = payload.extracted_data as Record<string, unknown> | undefined;

  const normalizedTranscript = normalizeTranscript(transcriptJson);
  const existingAiFlags = (call.aiFlags as Record<string, unknown>) || {};
  const updatedAiFlags: Record<string, unknown> = { ...existingAiFlags };
  if (outcome) updatedAiFlags.aiOutcomeGuess = outcome;

  const callUpdateData: Record<string, unknown> = {
    endedAt: endedAt ? new Date(endedAt) : (call.endedAt || new Date()),
    transcriptText: transcript || call.transcriptText,
    aiSummary: summary || call.aiSummary,
    recordingUrl: recordingUrl || call.recordingUrl,
    aiFlags: updatedAiFlags,
    callOutcome: call.callOutcome || 'connected',
  };

  if (normalizedTranscript.length > 0) {
    callUpdateData.transcriptJson = normalizedTranscript;
  }
  if (durationSeconds && !call.durationSeconds) {
    callUpdateData.durationSeconds = durationSeconds;
  }
  if (!call.elevenLabsId && conversationId) {
    callUpdateData.elevenLabsId = conversationId;
  }

  await prisma.call.update({ where: { id: call.id }, data: callUpdateData });

  if (call.interactionId) {
    await prisma.interaction.update({
      where: { id: call.interactionId },
      data: { endedAt: new Date(), status: 'completed' },
    }).catch(() => { /* interaction may not exist — non-fatal */ });
  }

  const existingIntakeData = (call.lead.intakeData as Record<string, unknown>) || {};

  if (extractedData && Object.keys(extractedData).length > 0) {
    const mergedIntakeData = { ...existingIntakeData, ...extractedData };
    await prisma.lead.update({
      where: { id: call.leadId },
      data: {
        intakeData: mergedIntakeData as any,
        lastActivityAt: new Date(),
        displayName: extractDisplayName(extractedData) || call.lead.displayName,
        summary: summary || call.lead.summary,
      },
    });
  } else {
    await prisma.lead.update({
      where: { id: call.leadId },
      data: {
        lastActivityAt: new Date(),
        summary: summary || call.lead.summary,
      },
    });
  }

  // Run Avery pipeline
  const averyNormalized = normalizeElevenLabsPostCallPayload(payload);
  averyNormalized.callId = call.id;
  const leadIntakeForAvery = extractedData
    ? { ...existingIntakeData, ...extractedData }
    : existingIntakeData;

  await runPostCallAnalysis(
    prisma,
    call.id,
    call.leadId,
    call.orgId,
    averyNormalized,
    updatedAiFlags,
    leadIntakeForAvery,
    call.lead.displayName,
  );

  // Mark parked record as resolved
  await (prisma as any).unlinkedPostCall.update({
    where: { id: parkedId },
    data: {
      resolvedCallId: call.id,
      resolvedAt: new Date(),
      lastRetryAt: new Date(),
      retryCount: { increment: 1 },
    },
  });

  console.log(JSON.stringify({
    tag: '[AVERY_RECONCILE_APPLIED]',
    parkedId,
    callId: call.id,
    leadId: call.leadId,
    orgId: call.orgId,
    conversationId,
  }));
}

// ─── Public entrypoint ────────────────────────────────────────────────────────

export interface ReconcileResult {
  attempted: number;
  matched: number;
  alreadyResolved: number;
  failed: number;
}

/**
 * Reconcile unlinked parked ElevenLabs post-call payloads.
 *
 * Reads up to `maxBatch` unresolved records, attempts correlation,
 * and applies the post-call pipeline if a Call row now exists.
 *
 * Safe to call repeatedly — idempotent by design.
 */
export async function reconcileUnlinkedPostCalls(
  prisma: PrismaClient,
  opts: { maxBatch?: number } = {},
): Promise<ReconcileResult> {
  const maxBatch = opts.maxBatch ?? 20;
  const result: ReconcileResult = { attempted: 0, matched: 0, alreadyResolved: 0, failed: 0 };

  let parked: any[] = [];
  try {
    parked = await (prisma as any).unlinkedPostCall.findMany({
      where: {
        provider: 'elevenlabs',
        resolvedAt: null,
      },
      orderBy: { receivedAt: 'asc' },
      take: maxBatch,
    });
  } catch (err: unknown) {
    console.error(JSON.stringify({
      tag: '[AVERY_RECONCILE_LOAD_ERROR]',
      error: err instanceof Error ? err.message : String(err),
    }));
    return result;
  }

  console.log(JSON.stringify({
    tag: '[AVERY_RECONCILE_START]',
    pendingCount: parked.length,
    maxBatch,
  }));

  for (const record of parked) {
    result.attempted++;
    const payload = record.rawPayloadJson as Record<string, unknown>;
    const conversationId = record.elevenLabsConvId ?? payload.conversation_id;

    try {
      const correlationResult = await findCallForParkedPayload(prisma, payload);

      if (!correlationResult) {
        // Still no matching call — update retry metadata and move on
        await (prisma as any).unlinkedPostCall.update({
          where: { id: record.id },
          data: {
            lastRetryAt: new Date(),
            retryCount: { increment: 1 },
          },
        });
        console.log(JSON.stringify({
          tag: '[AVERY_RECONCILE_NO_MATCH]',
          parkedId: record.id,
          conversationId,
          retryCount: record.retryCount + 1,
        }));
        continue;
      }

      const { call, correlationMethod } = correlationResult;

      // Idempotency: skip if Avery already ran on this call
      const existingFlags = (call.aiFlags as Record<string, unknown>) || {};
      if (existingFlags.avery_analyzed_at) {
        await (prisma as any).unlinkedPostCall.update({
          where: { id: record.id },
          data: {
            resolvedCallId: call.id,
            resolvedAt: new Date(),
            lastRetryAt: new Date(),
          },
        });
        result.alreadyResolved++;
        console.log(JSON.stringify({
          tag: '[AVERY_RECONCILE_ALREADY_PROCESSED]',
          parkedId: record.id,
          callId: call.id,
          conversationId,
        }));
        continue;
      }

      console.log(JSON.stringify({
        tag: '[AVERY_RECONCILE_MATCHED]',
        parkedId: record.id,
        callId: call.id,
        leadId: call.leadId,
        correlationMethod,
        conversationId,
      }));

      logAveryEvent({
        type: 'postcall_received',
        conversationId: conversationId as string,
        callId: call.id,
        leadId: call.leadId,
        orgId: call.orgId,
        details: { source: 'reconciliation', parkedId: record.id, correlationMethod },
      });

      await applyParkedPayload(prisma, call, payload, record.id);
      result.matched++;
    } catch (err: unknown) {
      result.failed++;
      console.error(JSON.stringify({
        tag: '[AVERY_RECONCILE_ERROR]',
        parkedId: record.id,
        conversationId,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  console.log(JSON.stringify({
    tag: '[AVERY_RECONCILE_DONE]',
    ...result,
  }));

  return result;
}
