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

import { ConversationState, TurnInput, StateSlot, NextQuestionDecision, ResponsePolicy } from '../types';
import { classifyMatter } from '../intake/matter-classifier';
import { detectIntent } from '../intake/intent-detector';
import { detectUrgency } from '../intake/urgency-detector';
import { detectEmotionalState } from '../intake/emotional-state-detector';
import { mergeSlotEvidence, syncCallerNameFromSlots } from './conversation-state';
import {
  extractName,
  extractEmail,
  extractPhone,
  extractIncidentDate,
  extractOpposingParty,
  extractEmployer,
  detectRiskFlagsFromText,
} from '../intake/extraction-patterns';
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

  // ── Name (uses shared patterns from extraction-patterns.ts) ───
  const name = extractName(utterance);
  if (name) slots['caller_name'] = makeSlot(name, 0.8);

  // ── Email ─────────────────────────────────────────────────────
  const email = extractEmail(utterance);
  if (email) slots['email'] = makeSlot(email, 0.95);

  // ── Phone (spoken or typed) ───────────────────────────────────
  const phone = extractPhone(utterance);
  if (phone) {
    slots['callback_number'] = makeSlot(phone, 0.9);
  } else if (callerPhone && !slots['callback_number']) {
    slots['callback_number'] = makeSlot(callerPhone, 0.95);
  }

  // ── Incident date ─────────────────────────────────────────────
  const date = extractIncidentDate(utterance);
  if (date) slots['incident_date'] = makeSlot(date, 0.7);

  // ── Opposing party ────────────────────────────────────────────
  const opposing = extractOpposingParty(utterance);
  if (opposing) slots['opposing_party'] = makeSlot(opposing, 0.6);

  // ── Employer (employment matters) ─────────────────────────────
  const employer = extractEmployer(utterance);
  if (employer) slots['employer_name'] = makeSlot(employer, 0.65);

  return slots;
}

// Risk flag detection uses shared patterns from extraction-patterns.ts

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

  // 10. Update risk flags and transfer recommendation (shared patterns from extraction-patterns.ts)
  const updatedRiskFlags = detectRiskFlagsFromText(utt, s.matterType, s.riskFlags);
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

// ──────────────────────────────────────────────────────────────────
// Assistant-turn metadata (4A)
// ──────────────────────────────────────────────────────────────────

/**
 * Metadata about what the assistant did on the most recent turn.
 *
 * Used by the next applyTurnToState call to:
 *   - match the caller's answer to the correct slot (lastQuestionAsked)
 *   - apply confirmField() / rejectFieldValue() for YES/NO signals
 *     even when the field is not in the confirmation queue
 */
export interface AssistantTurnMeta {
  /** Avery's response text. */
  utterance: string;
  /** Slot key that Avery asked about (from plan.collectSlots[0] or decision.targetField). */
  questionAsked?: string | null;
  /** Decision type the planner issued (ask / confirm / repair / escalate / complete). */
  decisionType?: NextQuestionDecision['type'] | null;
  /** Field being confirmed if decisionType === 'confirm'. */
  confirmationTarget?: string | null;
  /** Response policy mode that was active for this turn. */
  assistantMode?: ResponsePolicy['mode'] | null;
}

/**
 * Record Avery's last response utterance and turn-targeting metadata in state.
 * Call this after the response is delivered, before the next caller turn.
 *
 * Accepts either a plain utterance string (legacy / test usage) or a full
 * AssistantTurnMeta object.
 */
export function recordAssistantTurn(
  state: ConversationState,
  metaOrUtterance: AssistantTurnMeta | string,
): ConversationState {
  const meta: AssistantTurnMeta =
    typeof metaOrUtterance === 'string'
      ? { utterance: metaOrUtterance }
      : metaOrUtterance;

  return {
    ...state,
    lastAssistantUtterance: meta.utterance,
    lastQuestionAsked: meta.questionAsked !== undefined
      ? meta.questionAsked
      : state.lastQuestionAsked,
    lastDecisionType: meta.decisionType !== undefined
      ? meta.decisionType
      : state.lastDecisionType,
    lastConfirmationTarget: meta.confirmationTarget !== undefined
      ? meta.confirmationTarget
      : state.lastConfirmationTarget,
    lastAssistantMode: meta.assistantMode !== undefined
      ? meta.assistantMode
      : state.lastAssistantMode,
    updatedAt: new Date().toISOString(),
  };
}
