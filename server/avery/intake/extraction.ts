/**
 * Avery extraction pipeline — composes sub-detectors into a single ExtractionResult.
 *
 * Pure function: no DB side effects.
 * Designed to be called from persistence/postcall-analysis.ts after normalization.
 *
 * Sub-pipeline:
 *   1. classifyMatter      — what kind of case is this?
 *   2. detectIntent        — why is the caller calling?
 *   3. detectUrgency       — how time-sensitive is this?
 *   4. detectEmotionalState — how is the caller feeling?
 *   5. Extract slot values from transcript (name, email, date, opposing party)
 *   6. Compute risk flags
 *   7. Compute confidence score and missing required fields
 *   8. Build intake summary
 */

import {
  ExtractionResult,
  NormalizedPostCallData,
  NormalizedTranscriptEntry,
  StateSlot,
  MatterType,
} from '../types';
import { classifyMatter } from './matter-classifier';
import { detectIntent } from './intent-detector';
import { detectUrgency } from './urgency-detector';
import { detectEmotionalState } from './emotional-state-detector';
import { getRequiredSlots } from '../state/slot-definitions';
import {
  extractName,
  extractEmail,
  extractIncidentDate,
  extractOpposingParty,
  detectRiskFlagsFromText,
} from './extraction-patterns';

// Text extraction helpers are imported from extraction-patterns.ts (shared with live-turn pipeline)

// ──────────────────────────────────────────────────────────────────
// Slot builder
// ──────────────────────────────────────────────────────────────────

function slot<T>(
  value: T | null,
  confidence: number,
  source: StateSlot['source'],
): StateSlot<T> {
  return { value, confidence, source, updatedAt: new Date().toISOString() };
}

// Risk flag detection is handled by detectRiskFlagsFromText from extraction-patterns.ts

// ──────────────────────────────────────────────────────────────────
// Intake summary builder
// ──────────────────────────────────────────────────────────────────

function buildIntakeSummary(
  transcript: string,
  matterType: MatterType,
  callerName: string | null,
  urgencyLevel: string,
  providerSummary: string | null,
): string {
  // Prefer the provider-generated summary if available
  if (providerSummary && providerSummary.trim().length > 20) {
    return providerSummary.slice(0, 600);
  }

  const namePrefix = callerName ? `${callerName} contacted the firm` : 'Caller contacted the firm';
  const matterLabel = matterType === 'unknown' ? 'legal' : matterType.replace(/_/g, ' ');
  const base = `${namePrefix} regarding a ${matterLabel} matter.`;

  // Pull first substantive user statement about the situation
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 20);
  const contextSentence = sentences.find((s) => {
    const l = s.toLowerCase();
    return (
      l.includes('accident') ||
      l.includes('injur') ||
      l.includes('fired') ||
      l.includes('arrested') ||
      l.includes('divorce') ||
      l.includes('estate') ||
      l.includes('need help') ||
      l.includes('looking for')
    );
  });

  const context = contextSentence ? ` ${contextSentence.trim()}.` : '';
  const urgencyNote =
    urgencyLevel === 'critical' || urgencyLevel === 'high'
      ? ' Matter appears time-sensitive.'
      : '';

  return (base + context + urgencyNote).slice(0, 600);
}

// ──────────────────────────────────────────────────────────────────
// Turn count
// ──────────────────────────────────────────────────────────────────

function countUserTurns(entries: NormalizedTranscriptEntry[]): number {
  return entries.filter((e) => e.role === 'user').length;
}

// ──────────────────────────────────────────────────────────────────
// Main pipeline
// ──────────────────────────────────────────────────────────────────

/**
 * Run the full Avery extraction pipeline on normalized post-call data.
 * Pure function — no DB side effects.
 */
export function runExtractionPipeline(data: NormalizedPostCallData): ExtractionResult {
  // Flatten transcript to a single string for pattern matching
  const transcriptFull =
    data.transcriptText ||
    data.transcriptEntries.map((e) => e.message).join(' ');

  // Run all sub-detectors
  const matterResult = classifyMatter(transcriptFull);
  const intentResult = detectIntent(transcriptFull);
  const urgencyResult = detectUrgency(transcriptFull);
  const emotionalResult = detectEmotionalState(transcriptFull);

  // Extract field values (using shared patterns from extraction-patterns.ts)
  const callerName = extractName(transcriptFull);
  const email = extractEmail(transcriptFull);
  const incidentDate = extractIncidentDate(transcriptFull);
  const opposingParty = extractOpposingParty(transcriptFull);

  // Risk flags (using shared patterns from extraction-patterns.ts)
  const riskFlags = detectRiskFlagsFromText(transcriptFull, matterResult.matterType);

  // Build slot map
  const slots: Record<string, StateSlot> = {
    caller_name: slot(callerName, callerName ? 0.8 : 0.05, 'caller'),
    callback_number: slot(data.callerPhone, data.callerPhone ? 0.95 : 0, 'system'),
    email: slot(email, email ? 0.9 : 0.05, 'caller'),
    incident_date: slot(incidentDate, incidentDate ? 0.7 : 0.05, 'caller'),
    opposing_party: slot(opposingParty, opposingParty ? 0.6 : 0.05, 'caller'),
    short_matter_summary: slot(data.summary, data.summary ? 0.85 : 0.05, 'system'),
  };

  // Missing required fields for this matter type
  const required = getRequiredSlots(matterResult.matterType);
  const missingRequiredFields = required.filter((key) => !slots[key]?.value);

  // Overall confidence: weighted average of sub-detector confidences
  const confidenceScore = parseFloat(
    (
      (matterResult.confidence +
        intentResult.confidence +
        urgencyResult.confidence +
        emotionalResult.confidence) /
      4
    ).toFixed(2),
  );

  const turnCount = countUserTurns(data.transcriptEntries);

  const intakeSummary = buildIntakeSummary(
    transcriptFull,
    matterResult.matterType,
    callerName,
    urgencyResult.urgencyLevel,
    data.summary,
  );

  // Transfer is recommended for specific high-priority risk flags
  const transferRecommended =
    riskFlags.includes('caller_safety_concern') ||
    riskFlags.includes('criminal_custody_urgency') ||
    riskFlags.includes('already_represented');

  return {
    callerIntent: intentResult.callerIntent,
    matterType: matterResult.matterType,
    emotionalState: emotionalResult.emotionalState,
    urgencyLevel: urgencyResult.urgencyLevel,
    slots,
    confidenceScore,
    intakeSummary,
    riskFlags,
    transferRecommended,
    missingRequiredFields,
    turnCount,
  };
}
