/**
 * Per-turn state updater — the live conversation state engine.
 *
 * applyTurnToState() runs the full update pipeline for each caller turn:
 *   1. Track turn metadata (count, interruptions, silences)
 *   2. Update lastUserUtterance
 *   3. Run Prompt 1 detectors on the utterance
 *   4. Update classifications (intent, matter, emotion, urgency)
 *   5. Extract slot candidates from the utterance
 *   6. 3E: Interpret the turn (TurnInterpretation) — pre-mutation analysis
 *   7. 3E: Apply field proposals via evidence-aware gate
 *   8. Enrich slots with status flags
 *   9. Sync top-level callerName from slots
 *  10. Update risk flags
 *  11. Recompute missing required fields
 *  12. Recompute confidence score
 *  13. Determine next intake stage
 *  14. Select repair strategy
 *  15. Compute derived field quality sets
 *  16. Apply conversation phase transition
 *
 * recordAssistantTurn() stamps the last assistant utterance for context.
 *
 * Reuses Prompt 1 detectors:
 *   classifyMatter, detectIntent, detectUrgency, detectEmotionalState
 */

import { ConversationState, TurnInput, StateSlot } from '../types';
import { classifyMatter } from '../intake/matter-classifier';
import { detectIntent } from '../intake/intent-detector';
import { detectUrgency } from '../intake/urgency-detector';
import { detectEmotionalState } from '../intake/emotional-state-detector';
import { mergeSlotEvidence, syncCallerNameFromSlots } from './conversation-state';
import { recomputeConfidence } from './confidence';
import { recomputeMissingFields } from './missing-fields';
import { determineNextStage } from './state-machine';
import { selectRepairStrategy } from './repair-strategies';
import {
  enrichSlotsWithStatus,
  recomputeConfirmationQueue,
  recomputeLowConfidenceRequiredFields,
  recomputeConflictingRequiredFields,
  recomputeOptionalFieldsRemaining,
} from './field-memory';
import { transitionConversationState } from './state-transition';
import { interpretTurn } from './turn-interpretation';
import { applyFieldProposalsToState } from './field-proposals';

// Re-export TurnInput so callers can import from one place
export type { TurnInput };

// ──────────────────────────────────────────────────────────────────
// Urgency escalation order (never de-escalate within a call)
// ──────────────────────────────────────────────────────────────────

const URGENCY_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

// ──────────────────────────────────────────────────────────────────
// Light per-turn slot extraction
// (Full transcript extraction lives in extraction.ts — this handles single turns)
// ──────────────────────────────────────────────────────────────────

function makeSlot<T>(value: T | null, confidence: number): StateSlot<T> {
  return { value, confidence, source: 'caller', updatedAt: new Date().toISOString() };
}

function extractTurnSlots(
  utterance: string,
  callerPhone: string | null | undefined,
): Record<string, StateSlot> {
  const slots: Record<string, StateSlot> = {};

  // ── Name ──────────────────────────────────────────────────────
  const nameMatch = utterance.match(
    /(?:my name is|this is|i'm|i am|name's|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  );
  if (nameMatch?.[1]) {
    slots['caller_name'] = makeSlot(nameMatch[1].trim(), 0.8);
  }

  // ── Email ─────────────────────────────────────────────────────
  const emailMatch = utterance.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    slots['email'] = makeSlot(emailMatch[0], 0.95);
  }

  // ── Phone (spoken or typed) ───────────────────────────────────
  // Match patterns like: 555-234-5678, (555) 234-5678, +1 555 234 5678
  const phoneMatch = utterance.match(
    /\b(\+?1?\s*[-.]?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/,
  );
  if (phoneMatch) {
    const digits = phoneMatch[1].replace(/\D/g, '');
    if (digits.length >= 10) {
      const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`;
      slots['callback_number'] = makeSlot(e164, 0.9);
    }
  } else if (callerPhone && !slots['callback_number']) {
    // Fall back to inbound caller ID (already in state.slots from init, but include here for safety)
    slots['callback_number'] = makeSlot(callerPhone, 0.95);
  }

  // ── Incident date ─────────────────────────────────────────────
  const dateMatch = utterance.match(
    /(\d{1,2}\/\d{1,2}\/\d{2,4})|((january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{0,4})|(last\s+(week|month|year)|yesterday|two\s+(weeks|days)\s+ago)/i,
  );
  if (dateMatch) {
    slots['incident_date'] = makeSlot(dateMatch[0], 0.7);
  }

  // ── Opposing party ────────────────────────────────────────────
  const opposingMatch = utterance.match(
    /(?:against|versus|vs\.?|suing)\s+([A-Z][a-zA-Z\s&,\.]{1,40})/i,
  );
  if (opposingMatch?.[1]) {
    slots['opposing_party'] = makeSlot(opposingMatch[1].trim(), 0.6);
  }

  // ── Employer (employment matters) ─────────────────────────────
  const employerMatch = utterance.match(
    /(?:work(?:ed)?\s+(?:at|for)|employed\s+(?:at|by)|company\s+(?:is|was))\s+([A-Z][a-zA-Z\s&,\.]{2,40})/i,
  );
  if (employerMatch?.[1]) {
    slots['employer_name'] = makeSlot(employerMatch[1].trim(), 0.65);
  }

  return slots;
}

// ──────────────────────────────────────────────────────────────────
// Risk flag detection (per-turn)
// ──────────────────────────────────────────────────────────────────

function detectTurnRiskFlags(utterance: string, existing: string[]): string[] {
  const lower = utterance.toLowerCase();
  const flags = new Set(existing);

  if (
    lower.includes('already have a lawyer') ||
    lower.includes('already have an attorney') ||
    lower.includes('already hired') ||
    lower.includes('i have representation') ||
    lower.includes('currently represented')
  ) {
    flags.add('already_represented');
  }

  if (
    lower.includes('suicid') ||
    lower.includes('harm myself') ||
    lower.includes('hurt myself') ||
    lower.includes('end my life')
  ) {
    flags.add('caller_safety_concern');
  }

  if (
    (lower.includes('statute') && lower.includes('limit')) ||
    lower.includes('time barred') ||
    lower.includes('time has run')
  ) {
    flags.add('possible_sol_issue');
  }

  // Criminal custody situations are always time-sensitive
  if (
    lower.includes('in custody') ||
    lower.includes('in jail') ||
    (lower.includes('arraignment') && lower.includes('arrest'))
  ) {
    flags.add('criminal_custody_urgency');
  }

  return Array.from(flags);
}

// ──────────────────────────────────────────────────────────────────
// Main pipeline
// ──────────────────────────────────────────────────────────────────

/**
 * Apply a single caller turn to the conversation state.
 * Returns a new ConversationState — the original is never mutated.
 */
export function applyTurnToState(
  state: ConversationState,
  turn: TurnInput,
): ConversationState {
  const now = new Date().toISOString();

  // 1. Track turn metadata
  let s: ConversationState = {
    ...state,
    turnCount: state.turnCount + 1,
    lastUserUtterance: turn.utterance,
    updatedAt: now,
    interruptionCount: state.interruptionCount + (turn.isInterruption ? 1 : 0),
    silenceEvents: state.silenceEvents + (turn.isSilence ? 1 : 0),
  };

  // Silence events carry no utterance — skip detection, just update derived fields
  if (turn.isSilence || !turn.utterance.trim()) {
    const repairStrategy = selectRepairStrategy(s);
    const missingRequiredFields = recomputeMissingFields(s);
    const confidenceScore = recomputeConfidence(s);
    const silenceState = { ...s, repairStrategy, missingRequiredFields, confidenceScore };
    return transitionConversationState(silenceState);
  }

  const utt = turn.utterance;

  // 2. Run Prompt 1 detectors on this utterance
  const matterResult = classifyMatter(utt);
  const intentResult = detectIntent(utt);
  const urgencyResult = detectUrgency(utt);
  const emotionalResult = detectEmotionalState(utt);

  // 3. Update matter type (accept if better than current or current is unknown)
  if (
    matterResult.matterType !== 'unknown' &&
    (s.matterType === 'unknown' || matterResult.confidence > 0.4)
  ) {
    s = { ...s, matterType: matterResult.matterType };
  }

  // 4. Update caller intent (accept high-confidence specific intents; default new_case only if unknown)
  if (
    s.callerIntent === 'unknown' ||
    (intentResult.callerIntent !== 'new_case' && intentResult.confidence >= 0.65)
  ) {
    s = { ...s, callerIntent: intentResult.callerIntent };
  }

  // 5. Update emotional state (per-turn, always update if detected)
  if (emotionalResult.emotionalState !== 'unknown') {
    s = { ...s, emotionalState: emotionalResult.emotionalState };
  }

  // 6. Update urgency (only escalate, never de-escalate within a call)
  if ((URGENCY_RANK[urgencyResult.urgencyLevel] ?? 0) > (URGENCY_RANK[s.urgencyLevel] ?? 0)) {
    s = { ...s, urgencyLevel: urgencyResult.urgencyLevel };
  }

  // 7. Extract slot candidates from this turn
  const turnSlots = extractTurnSlots(utt, state.phone);

  // 7b. 3E: Interpret the turn — structured pre-mutation analysis
  const interpretation = interpretTurn(
    utt,
    s.lastQuestionAsked ?? null,
    s,
    turnSlots,
    s.turnCount,
  );
  s = { ...s, lastTurnInterpretation: interpretation };

  // 7c. 3E: Apply field proposals via evidence-aware gate
  // This handles: YES/NO affirmations, corrections (direct overwrite), direct/volunteered slots,
  // and inferred slots (fill-if-empty only). Replaces raw mergeWithConflictDetection.
  s = applyFieldProposalsToState(s, interpretation.detectedFields, interpretation);

  // 8b. Enrich all slots with computed status flags (3D)
  s = { ...s, slots: enrichSlotsWithStatus(s.slots) };

  // 9. Sync callerName from slots to top-level field
  s = syncCallerNameFromSlots(s);

  // 10. Update risk flags and transfer recommendation
  const updatedRiskFlags = detectTurnRiskFlags(utt, s.riskFlags);
  const transferRecommended =
    s.transferRecommended ||
    updatedRiskFlags.includes('caller_safety_concern') ||
    updatedRiskFlags.includes('already_represented');
  s = { ...s, riskFlags: updatedRiskFlags, transferRecommended };

  // 11. Recompute context-aware missing fields
  s = { ...s, missingRequiredFields: recomputeMissingFields(s) };

  // 12. Recompute confidence score
  s = { ...s, confidenceScore: recomputeConfidence(s) };

  // 13. Advance stage
  s = { ...s, intakeStage: determineNextStage(s) };

  // 14. Select repair strategy for this state
  s = { ...s, repairStrategy: selectRepairStrategy(s) };

  // 15. 3D: Compute derived field quality sets
  s = {
    ...s,
    confirmationQueue: recomputeConfirmationQueue(s),
    lowConfidenceRequiredFields: recomputeLowConfidenceRequiredFields(s),
    conflictingRequiredFields: recomputeConflictingRequiredFields(s),
    optionalFieldsRemaining: recomputeOptionalFieldsRemaining(s),
  };

  // 16. 3D: Apply conversation phase transition
  s = transitionConversationState(s);

  return s;
}

/**
 * Record Avery's last response utterance in state.
 * Call this after the response is delivered, before the next caller turn.
 */
export function recordAssistantTurn(
  state: ConversationState,
  utterance: string,
): ConversationState {
  return {
    ...state,
    lastAssistantUtterance: utterance,
    updatedAt: new Date().toISOString(),
  };
}
