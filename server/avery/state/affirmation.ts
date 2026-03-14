/**
 * Affirmation and correction signal detection.
 *
 * Handles:
 *   interpretAffirmation()    — detect yes / no / uncertain signals in an utterance
 *   detectCorrectionSignal()  — detect explicit correction language
 *
 * These are pure pattern-matching functions — no LLM, no state mutation.
 * Deterministic: same input → same output.
 *
 * Design note:
 *   A bare "yes" or "no" is only meaningful when tied to an active confirmation
 *   target or a recently asked question. The interpretation layer (turn-interpretation.ts)
 *   is responsible for contextualizing these signals. These functions only detect
 *   the presence of the signals, not their semantic meaning in context.
 */

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export interface AffirmationResult {
  yes: boolean;
  no: boolean;
  uncertain: boolean;
}

// ──────────────────────────────────────────────────────────────────
// Patterns
// ──────────────────────────────────────────────────────────────────

/**
 * Affirmative signals — caller is agreeing or confirming.
 * Ordered from most specific to least.
 *
 * NOTE: "sure" and "right" are intentionally excluded as standalone alternatives.
 * - "sure" → false-positive in "not sure" (UNCERTAIN signal)
 * - "right" → false-positive in "not right" / "that is not right" (NO signal)
 * Both are already covered by multi-word phrases: "that's right", "that is right".
 */
const YES_RE =
  /\b(yes|yeah|yep|yup|correct|that'?s right|that is right|confirmed|affirmative|exactly|definitely|absolutely|indeed|uh-?huh|that'?s correct|that is correct|sounds good|that works|perfect|great|ok yes|okay yes|yes that'?s|yes it is|yes it'?s)\b/i;

/**
 * Negative signals — caller is denying, rejecting, or correcting.
 */
const NO_RE =
  /\b(no|nope|nah|wrong|that'?s wrong|that is wrong|incorrect|not right|not correct|negative|no that'?s not|no it'?s not|that'?s not right|that is not right|no it is not|that'?s incorrect|actually no|no actually)\b/i;

/**
 * Uncertain / hedged signals — caller is neither fully agreeing nor disagreeing.
 */
const UNCERTAIN_RE =
  /\b(maybe|i think so|not sure|i guess|possibly|kind of|sort of|i hope so|i believe so|i suppose|more or less|approximately)\b/i;

/**
 * Correction language — caller is explicitly correcting prior information.
 * Distinct from a conflict detected by field-memory (which is structural).
 * This is semantic: caller is saying "I said X but it should be Y".
 */
const CORRECTION_RE =
  /\b(no actually|actually no|wait|sorry|correction|let me correct|i meant|i mean to say|not that|that was wrong|that'?s incorrect|that'?s my old|my old|i misspoke|scratch that|disregard that|let me rephrase|i meant to say|i need to correct|i was wrong about|actually it'?s|actually it is|actually the|wait no|hang on|let me fix that|that'?s not|not X but)\b/i;

// ──────────────────────────────────────────────────────────────────
// Functions
// ──────────────────────────────────────────────────────────────────

/**
 * Detect affirmation signals in a caller utterance.
 *
 * Returns three independent booleans — a turn can theoretically have
 * both `yes` and `uncertain` if the caller hedges ("yes, maybe").
 * The caller layer should prioritize: yes > no > uncertain.
 */
export function interpretAffirmation(utterance: string): AffirmationResult {
  const text = utterance.trim();
  return {
    yes: YES_RE.test(text),
    no: NO_RE.test(text),
    uncertain: UNCERTAIN_RE.test(text),
  };
}

/**
 * Detect explicit correction signals in a caller utterance.
 *
 * A correction signal indicates the caller is intentionally revising a prior value,
 * not just mentioning a different number or date (which would be a conflict).
 *
 * Examples that return true:
 *   "no actually, my number is 555-999"
 *   "wait, I meant last Tuesday not Monday"
 *   "sorry, that's my old address"
 *   "scratch that — the date was January 15th"
 *
 * Caller intent drives merge behavior: corrections should overwrite existing values
 * (with confirmation), while conflicts (no signal) should be flagged.
 */
export function detectCorrectionSignal(utterance: string): boolean {
  return CORRECTION_RE.test(utterance.trim());
}
