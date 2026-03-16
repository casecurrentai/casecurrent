/**
 * Response policy derivation — output-shape contract for the renderer.
 *
 * Handles:
 *   deriveResponsePolicy() — produce a ResponsePolicy for a single turn
 *
 * The ResponsePolicy is deterministic: same state + same decision → same policy.
 * It lives between the planner and the renderer, bounding:
 *   - how many questions are allowed
 *   - how many sentences are allowed
 *   - what tone and framing to use
 *   - whether empathy, examples, or explicit confirmation are required
 *
 * Pure function — no LLM, no side effects.
 *
 * Design notes:
 *   forbidCompoundQuestions is ALWAYS true — Avery never asks two things in one turn.
 *   maxQuestions is 0 for terminal turns (handoff / complete / emergency).
 *   brevityBias 'high' → renderer should target ≤ 150 tokens output.
 *   brevityBias 'medium' → renderer should target ≤ 300 tokens output.
 */

import {
  ConversationState,
  NextQuestionDecision,
  IntakeReadiness,
  ResponsePolicy,
} from '../types';
import type { RepairDecision } from '../state/repair-decision';

// ──────────────────────────────────────────────────────────────────
// Main derivation
// ──────────────────────────────────────────────────────────────────

/**
 * Derive a ResponsePolicy from the current conversation context.
 *
 * @param state          Full conversation state (after applyTurnToState)
 * @param decision       Structured next-question decision from the planner
 * @param repairDecision Semantic repair analysis for the last caller turn
 * @param readiness      Current intake readiness evaluation
 */
export function deriveResponsePolicy(
  state: ConversationState,
  decision: NextQuestionDecision,
  repairDecision: RepairDecision,
  readiness: IntakeReadiness,
): ResponsePolicy {
  const { emotionalState, urgencyLevel, riskFlags, slots } = state;

  // ── Mode ──────────────────────────────────────────────────────
  const mode = deriveMode(decision, riskFlags);

  // ── Emotional context shorthands ─────────────────────────────
  const isDistressed = emotionalState === 'distressed' || emotionalState === 'overwhelmed';
  const isAffectedEmotionally =
    isDistressed || emotionalState === 'anxious' || emotionalState === 'angry';

  // ── maxQuestions ──────────────────────────────────────────────
  // Terminal modes never ask new questions.
  const maxQuestions =
    mode === 'handoff' || mode === 'complete' || mode === 'emergency' ? 0 : 1;

  // ── maxSentences ──────────────────────────────────────────────
  const maxSentences = deriveMaxSentences(mode, isDistressed);

  // ── Empathy / acknowledgment ──────────────────────────────────
  const allowEmpathyPrefix = isDistressed || emotionalState === 'anxious';
  const allowAcknowledgment = isAffectedEmotionally;

  // ── requireSingleTarget ───────────────────────────────────────
  // Always true — Avery never asks about multiple fields in one turn.
  const requireSingleTarget = true;

  // ── confirmationStyle ─────────────────────────────────────────
  const confirmationStyle = deriveConfirmationStyle(decision, slots);

  // ── repairStyle ───────────────────────────────────────────────
  const repairStyle = deriveRepairStyle(repairDecision);

  // ── toneProfile ───────────────────────────────────────────────
  const toneProfile = deriveToneProfile(emotionalState, urgencyLevel);

  // ── brevityBias ───────────────────────────────────────────────
  const brevityBias: ResponsePolicy['brevityBias'] =
    isDistressed || mode === 'confirm' || urgencyLevel === 'critical' ? 'high' : 'medium';

  // ── forbidCompoundQuestions ───────────────────────────────────
  // Always true — this is Avery's core output discipline.
  const forbidCompoundQuestions = true;

  // ── forbidPrematureReassurance ────────────────────────────────
  const forbidPrematureReassurance =
    mode === 'confirm' || mode === 'repair' || urgencyLevel === 'critical';

  return {
    mode,
    maxQuestions,
    maxSentences,
    allowEmpathyPrefix,
    allowAcknowledgment,
    requireSingleTarget,
    confirmationStyle,
    repairStyle,
    toneProfile,
    brevityBias,
    forbidCompoundQuestions,
    forbidPrematureReassurance,
  };
}

// ──────────────────────────────────────────────────────────────────
// Private helpers
// ──────────────────────────────────────────────────────────────────

function deriveMode(
  decision: NextQuestionDecision,
  riskFlags: string[],
): ResponsePolicy['mode'] {
  switch (decision.type) {
    case 'escalate':
      return riskFlags.includes('caller_safety_concern') ? 'emergency' : 'handoff';
    case 'complete':
      return 'complete';
    case 'repair':
      return 'repair';
    case 'confirm':
      return 'confirm';
    default:
      return 'ask';
  }
}

function deriveMaxSentences(
  mode: ResponsePolicy['mode'],
  isDistressed: boolean,
): number {
  // Distressed callers need space — keep it brief regardless of mode
  if (isDistressed) return 3;

  switch (mode) {
    case 'confirm':
      return 2; // One read-back + one yes/no ask
    case 'repair':
      return 3; // Brief acknowledgment + rephrased ask (+ example if needed)
    case 'complete':
    case 'handoff':
    case 'emergency':
      return 2; // Concise closing or transfer
    default:
      return 4; // Normal collection turn
  }
}

function deriveConfirmationStyle(
  decision: NextQuestionDecision,
  slots: ConversationState['slots'],
): ResponsePolicy['confirmationStyle'] {
  const { targetField } = decision;

  // Critical contact fields require an explicit read-back + confirm
  if (targetField === 'callback_number' || targetField === 'caller_name') {
    return 'explicit';
  }

  // Conflicting values need a binary resolution (caller must pick one)
  if (targetField && slots[targetField]?.conflictFlag) {
    return 'binary';
  }

  return 'gentle';
}

function deriveRepairStyle(
  repairDecision: RepairDecision,
): ResponsePolicy['repairStyle'] {
  switch (repairDecision.repairType) {
    case 'narrow_question':
      return 'narrow';
    case 'provide_example':
      return 'example';
    case 'split_question':
      return 'stepwise';
    default:
      // rephrase, confirm_value, defer_optional_field, none → rephrase
      return 'rephrase';
  }
}

function deriveToneProfile(
  emotionalState: ConversationState['emotionalState'],
  urgencyLevel: ConversationState['urgencyLevel'],
): ResponsePolicy['toneProfile'] {
  if (emotionalState === 'distressed' || emotionalState === 'overwhelmed' || emotionalState === 'anxious') {
    return 'warm';
  }
  if (emotionalState === 'angry') {
    return 'direct';
  }
  if (urgencyLevel === 'critical') {
    return 'urgent';
  }
  return 'calm';
}
