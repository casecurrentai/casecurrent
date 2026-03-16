/**
 * Repair trigger engine — semantic repair need detection.
 *
 * Determines whether the caller's most recent response requires repair,
 * and if so, which repair type to apply.
 *
 * Trigger reasons (semantic conditions):
 *   no_answer        — caller said nothing useful for the targeted field
 *   partial_answer   — caller gave an incomplete or hedged answer
 *   ambiguous_answer — answer extracted but confidence is low
 *   conflicting_answer — answer contradicts prior high-confidence data
 *   unrelated_answer — caller went off-topic (substantial reply, no target slot)
 *   caller_confusion — caller expressed confusion or asked for clarification
 *   none             — answer was satisfactory
 *
 * Repair types (tactical question reformulation):
 *   rephrase            — restate the question more simply
 *   narrow_question     — ask a more specific sub-question
 *   confirm_value       — read back extracted value and ask caller to confirm
 *   split_question      — break compound question into single simple parts
 *   provide_example     — give a concrete example to guide the caller
 *   defer_optional_field — skip optional field if caller seems stuck
 *   none                — no repair
 *
 * Pure function — deterministic, no LLM, no side effects.
 */

import { ConversationState, RepairTriggerType } from '../types';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export type RepairTriggerReason =
  | 'no_answer'
  | 'partial_answer'
  | 'ambiguous_answer'
  | 'conflicting_answer'
  | 'unrelated_answer'
  | 'caller_confusion'
  | 'none';

export interface RepairDecision {
  /** True when repair is needed this turn. */
  needed: boolean;
  /** The field being targeted for repair (null for stage-level repairs). */
  targetField: string | null;
  /** Tactical repair type — drives question reformulation in the renderer. */
  repairType: RepairTriggerType;
  /** Semantic reason that triggered repair. */
  triggerReason: RepairTriggerReason;
  /** Human-readable rationale for debugging. */
  rationale: string;
}

const NO_REPAIR: RepairDecision = {
  needed: false,
  targetField: null,
  repairType: 'none',
  triggerReason: 'none',
  rationale: 'answer was satisfactory',
};

// ──────────────────────────────────────────────────────────────────
// Detection patterns
// ──────────────────────────────────────────────────────────────────

/** Caller is expressing confusion or asking for clarification. */
const CONFUSION_RE =
  /\b(what do you mean|i don'?t understand|what'?s that|what is that|i'?m confused|could you (repeat|explain)|i don'?t know what you'?re asking|not sure what you mean|huh|what\?)\b/i;

/** Partial/hedged answer indicators (vague, uncertain, approximate). */
const PARTIAL_INDICATORS_RE =
  /\b(i think|maybe|not sure|approximately|sort of|kind of|around|roughly|probably|i believe|i'm not certain)\b/i;

/** Minimum word count to classify an utterance as "substantive". */
const SUBSTANTIVE_WORD_THRESHOLD = 8;

/** Maximum word count for a "very short / no answer" utterance. */
const SHORT_ANSWER_THRESHOLD = 5;

// ──────────────────────────────────────────────────────────────────
// Main function
// ──────────────────────────────────────────────────────────────────

/**
 * Determine whether the current turn requires repair.
 *
 * @param lastQuestionAsked  Slot key asked in the previous Avery turn (null if stage-level)
 * @param utterance          What the caller said this turn
 * @param state              Conversation state AFTER applyTurnToState() has run
 */
export function determineRepairNeed(
  lastQuestionAsked: string | null,
  utterance: string,
  state: ConversationState,
): RepairDecision {
  // No prior question asked — repair not applicable
  if (!lastQuestionAsked) return NO_REPAIR;

  const trimmed = utterance.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const targetSlot = state.slots[lastQuestionAsked];

  // ── 1. Caller confusion ───────────────────────────────────────
  if (state.emotionalState === 'confused' || CONFUSION_RE.test(trimmed)) {
    return {
      needed: true,
      targetField: lastQuestionAsked,
      repairType: 'provide_example',
      triggerReason: 'caller_confusion',
      rationale: `Caller appears confused about "${lastQuestionAsked}"`,
    };
  }

  // ── 2. Conflicting answer ─────────────────────────────────────
  if (targetSlot?.conflictFlag === true) {
    return {
      needed: true,
      targetField: lastQuestionAsked,
      repairType: 'confirm_value',
      triggerReason: 'conflicting_answer',
      rationale: `Conflicting values for "${lastQuestionAsked}" — need caller to confirm which is correct`,
    };
  }

  // ── 3. No answer: very short + no slot extracted ──────────────
  if (wordCount <= SHORT_ANSWER_THRESHOLD && !targetSlot?.value) {
    return {
      needed: true,
      targetField: lastQuestionAsked,
      repairType: 'rephrase',
      triggerReason: 'no_answer',
      rationale: `Short utterance (${wordCount} word${wordCount === 1 ? '' : 's'}) with no value extracted for "${lastQuestionAsked}"`,
    };
  }

  // ── 4. Ambiguous / partial answer ────────────────────────────
  if (targetSlot?.value && (targetSlot.confidence ?? 0) < 0.50) {
    const isPartial = PARTIAL_INDICATORS_RE.test(trimmed);
    return {
      needed: true,
      targetField: lastQuestionAsked,
      repairType: isPartial ? 'narrow_question' : 'confirm_value',
      triggerReason: isPartial ? 'partial_answer' : 'ambiguous_answer',
      rationale: `"${lastQuestionAsked}" extracted with low confidence (${(targetSlot.confidence ?? 0).toFixed(2)})${isPartial ? ' — partial/hedged language detected' : ''}`,
    };
  }

  // ── 5. Unrelated answer: substantial reply but no target slot ─
  if (wordCount >= SUBSTANTIVE_WORD_THRESHOLD && !targetSlot?.value) {
    return {
      needed: true,
      targetField: lastQuestionAsked,
      repairType: 'rephrase',
      triggerReason: 'unrelated_answer',
      rationale: `Caller gave a ${wordCount}-word reply but "${lastQuestionAsked}" was not captured — may be off-topic`,
    };
  }

  // ── No repair needed ─────────────────────────────────────────
  return NO_REPAIR;
}
