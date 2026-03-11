/**
 * Post-call analysis orchestrator.
 *
 * Runs after the existing webhook handler has already:
 *   - Correlated the payload to a Call record
 *   - Updated Call.transcriptText / Call.aiSummary / Call.recordingUrl
 *   - Updated Lead.intakeData with provider-extracted_data
 *
 * This module adds the Avery intelligence layer on top:
 *   1. Run extraction pipeline on normalized data
 *   2. Persist structured results to Call.aiFlags + Call.structuredData
 *   3. Sync Lead record with improved data
 *
 * Does NOT re-write transcript or summary — only the Avery analysis layer.
 * Never throws — returns persisted=false on any error so the webhook can still respond 200.
 */

import { PrismaClient } from '../../../apps/api/src/generated/prisma';
import { NormalizedPostCallData, ExtractionResult } from '../types';
import { runExtractionPipeline } from '../intake/extraction';
import { syncLeadFromExtraction } from './lead-sync';
import { logAveryEvent } from './event-log';

export interface PostCallAnalysisResult {
  extraction: ExtractionResult;
  callId: string;
  leadId: string;
  persisted: boolean;
}

// Fallback extraction result used when the pipeline throws unexpectedly
function fallbackExtraction(summary: string | null): ExtractionResult {
  return {
    callerIntent: 'unknown',
    matterType: 'unknown',
    emotionalState: 'unknown',
    urgencyLevel: 'low',
    slots: {},
    confidenceScore: 0,
    intakeSummary: summary ?? '',
    riskFlags: [],
    transferRecommended: false,
    missingRequiredFields: [],
    turnCount: 0,
  };
}

/**
 * Run the full Avery post-call analysis pipeline.
 *
 * @param prisma               - Prisma client
 * @param callId               - ID of the correlated Call record
 * @param leadId               - ID of the associated Lead
 * @param orgId                - Organization ID for scoping
 * @param normalized           - Normalized post-call data from normalizeElevenLabsPostCallPayload
 * @param existingAiFlags      - Current Call.aiFlags (will be merged, not replaced)
 * @param existingIntakeData   - Current Lead.intakeData (will be merged, not replaced)
 * @param existingDisplayName  - Current Lead.displayName (used to decide if name update is safe)
 */
export async function runPostCallAnalysis(
  prisma: PrismaClient,
  callId: string,
  leadId: string,
  orgId: string,
  normalized: NormalizedPostCallData,
  existingAiFlags: Record<string, unknown>,
  existingIntakeData: Record<string, unknown>,
  existingDisplayName: string | null | undefined,
): Promise<PostCallAnalysisResult> {
  const startMs = Date.now();

  logAveryEvent({
    type: 'extraction_started',
    conversationId: normalized.conversationId,
    callId,
    leadId,
    orgId,
  });

  // ── Step 1: Run extraction pipeline ──────────────────────────────
  let extraction: ExtractionResult;
  try {
    extraction = runExtractionPipeline(normalized);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logAveryEvent({
      type: 'webhook_failed',
      conversationId: normalized.conversationId,
      callId,
      leadId,
      orgId,
      error: `extraction_pipeline_error: ${message}`,
    });
    return {
      extraction: fallbackExtraction(normalized.summary),
      callId,
      leadId,
      persisted: false,
    };
  }

  logAveryEvent({
    type: 'extraction_completed',
    conversationId: normalized.conversationId,
    callId,
    leadId,
    orgId,
    durationMs: Date.now() - startMs,
    details: {
      matterType: extraction.matterType,
      callerIntent: extraction.callerIntent,
      urgencyLevel: extraction.urgencyLevel,
      emotionalState: extraction.emotionalState,
      confidenceScore: extraction.confidenceScore,
      riskFlagCount: extraction.riskFlags.length,
      turnCount: extraction.turnCount,
      transferRecommended: extraction.transferRecommended,
    },
  });

  // ── Step 2: Persist to Call.aiFlags + Call.structuredData ─────────
  //
  // aiFlags gets flat summary fields for fast dashboard queries.
  // structuredData gets the full ExtractionResult for detailed views.
  const updatedAiFlags: Record<string, unknown> = {
    ...existingAiFlags,
    avery_matter_type: extraction.matterType,
    avery_caller_intent: extraction.callerIntent,
    avery_emotional_state: extraction.emotionalState,
    avery_urgency_level: extraction.urgencyLevel,
    avery_confidence: extraction.confidenceScore,
    avery_risk_flags: extraction.riskFlags,
    avery_transfer_recommended: extraction.transferRecommended,
    avery_missing_fields: extraction.missingRequiredFields,
    avery_turn_count: extraction.turnCount,
    avery_analyzed_at: new Date().toISOString(),
  };

  const structuredData = {
    avery_extraction: extraction,
    avery_normalized_meta: {
      provider: normalized.provider,
      conversationId: normalized.conversationId,
      durationMs: normalized.durationMs,
      language: normalized.language,
      disconnectionReason: normalized.disconnectionReason,
      transcriptEntryCount: normalized.transcriptEntries.length,
      analyzedAt: new Date().toISOString(),
    },
  };

  logAveryEvent({ type: 'persistence_started', callId, leadId, orgId });

  try {
    await prisma.call.update({
      where: { id: callId },
      data: {
        aiFlags: updatedAiFlags as any,
        structuredData: structuredData as any,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logAveryEvent({
      type: 'webhook_failed',
      callId,
      leadId,
      orgId,
      error: `call_update_error: ${message}`,
    });
    // Still try to sync the lead even if Call update failed
  }

  logAveryEvent({
    type: 'persistence_completed',
    callId,
    leadId,
    orgId,
    durationMs: Date.now() - startMs,
  });

  // ── Step 3: Sync Lead record ──────────────────────────────────────
  await syncLeadFromExtraction(
    prisma,
    leadId,
    orgId,
    extraction,
    existingIntakeData,
    existingDisplayName,
  );

  logAveryEvent({
    type: 'postcall_analysis_completed',
    conversationId: normalized.conversationId,
    callId,
    leadId,
    orgId,
    durationMs: Date.now() - startMs,
  });

  return { extraction, callId, leadId, persisted: true };
}
