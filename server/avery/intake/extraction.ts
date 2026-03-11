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

// ──────────────────────────────────────────────────────────────────
// Text extraction helpers
// ──────────────────────────────────────────────────────────────────

function extractNameFromTranscript(transcript: string): string | null {
  const patterns = [
    /(?:my name is|this is|i'm|i am|name's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:first name is|first name)\s+([A-Z][a-z]+)/i,
    /(?:last name is|last name)\s+([A-Z][a-z]+)/i,
    // "call me [Name]" pattern
    /(?:call me|you can call me)\s+([A-Z][a-z]+)/i,
  ];
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractEmailFromTranscript(transcript: string): string | null {
  const match = transcript.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}

function extractIncidentDateFromTranscript(transcript: string): string | null {
  const patterns: RegExp[] = [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{0,4}/i,
    /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
    /(last week|last month|yesterday|two weeks ago|a week ago|a few days ago|few days ago)/i,
    /(this past|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  ];
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) return match[0];
  }
  return null;
}

function extractOpposingParty(transcript: string): string | null {
  const patterns: RegExp[] = [
    /(?:against|versus|vs\.?|suing)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s+(?:Inc|LLC|Corp|Company|Co)\.?)?)/i,
    /(?:the other driver|the other party|the defendant|the plaintiff|my employer|the insurance company|the landlord)\s+(?:is|was|named)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

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

// ──────────────────────────────────────────────────────────────────
// Risk flags
// ──────────────────────────────────────────────────────────────────

function detectRiskFlags(transcript: string, matterType: MatterType): string[] {
  const lower = transcript.toLowerCase();
  const flags: string[] = [];

  // Already has representation — may be a conflict or we can't help
  if (
    lower.includes('already have a lawyer') ||
    lower.includes('already have an attorney') ||
    lower.includes('already hired') ||
    lower.includes('i have representation')
  ) {
    flags.push('already_represented');
  }

  // Statute of limitations might be an issue
  if (
    (lower.includes('statute') && lower.includes('limit')) ||
    lower.includes('time limit') ||
    lower.includes('time barred')
  ) {
    flags.push('possible_sol_issue');
  }

  // Potential conflict of interest
  if (
    lower.includes('conflict of interest') ||
    lower.includes('other side') ||
    lower.includes('you represent')
  ) {
    flags.push('potential_conflict_of_interest');
  }

  // Criminal custody — time-critical for bail/bond
  if (
    matterType === 'criminal' &&
    (lower.includes('in custody') || lower.includes('in jail') || lower.includes('arraignment'))
  ) {
    flags.push('criminal_custody_urgency');
  }

  // Caller safety concern — highest priority flag
  if (
    lower.includes('suicid') ||
    lower.includes('harm myself') ||
    lower.includes('hurt myself') ||
    lower.includes('end my life')
  ) {
    flags.push('caller_safety_concern');
  }

  return flags;
}

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

  // Extract field values
  const callerName = extractNameFromTranscript(transcriptFull);
  const email = extractEmailFromTranscript(transcriptFull);
  const incidentDate = extractIncidentDateFromTranscript(transcriptFull);
  const opposingParty = extractOpposingParty(transcriptFull);

  // Risk flags
  const riskFlags = detectRiskFlags(transcriptFull, matterResult.matterType);

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
