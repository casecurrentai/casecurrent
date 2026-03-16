/**
 * Turn interpretation engine — structured pre-mutation analysis of caller turns.
 *
 * Handles:
 *   interpretTurn()              — produce a TurnInterpretation for a caller utterance
 *   matchAnswerToLastQuestion()  — determine if the utterance answers the last question asked
 *
 * These functions are pure — no LLM, no state mutation.
 * They run BEFORE slot merging so the interpretation context is available for proposal gating.
 *
 * Design note:
 *   The interpretation is intentionally coarse-grained. It detects broad categories
 *   (direct/partial/ambiguous/nonresponsive/correction/confirmation) rather than
 *   fine-grained semantics. Caller intent drives proposal gating — not extraction accuracy.
 */

import { ConversationState, TurnInterpretation, ExtractedFieldProposal, StateSlot } from '../types';
import { interpretAffirmation, detectCorrectionSignal } from './affirmation';

// ──────────────────────────────────────────────────────────────────
// Distress detection
// ──────────────────────────────────────────────────────────────────

const DISTRESS_RE =
  /\b(crying|sobbing|scared|terrified|devastated|desperate|panicking|suicidal|harm myself|hurt myself|can't cope|breaking down|falling apart|overwhelmed|traumatized|shaking|can't breathe)\b/i;

function detectDistress(utterance: string): boolean {
  return DISTRESS_RE.test(utterance);
}

// ──────────────────────────────────────────────────────────────────
// Relevance detection
// ──────────────────────────────────────────────────────────────────

/**
 * Rough check for intake-relevant content.
 * Returns true when the utterance is purely social/irrelevant (no legal/personal matter content).
 * Conservative — when in doubt, return false (content is relevant).
 */
const IRRELEVANT_RE =
  /^(hi|hello|hey|thanks|thank you|ok|okay|sure|um|uh|hmm|right|got it|i see|understood|sounds good|great|good|yes|no|yeah|nope|bye|goodbye|talk to you soon|have a good day)\.?$/i;

function isIrrelevantContent(utterance: string): boolean {
  const trimmed = utterance.trim();
  // Short purely-social phrases are irrelevant
  return IRRELEVANT_RE.test(trimmed) && trimmed.split(/\s+/).length <= 5;
}

// ──────────────────────────────────────────────────────────────────
// Answer quality assessment
// ──────────────────────────────────────────────────────────────────

const PARTIAL_ANSWER_RE =
  /\b(i think|maybe|not sure|probably|possibly|approximately|around|roughly|sort of|kind of|i believe|i guess|i suppose)\b/i;

const MIN_SUBSTANTIVE_WORDS = 3;

/**
 * Assess the answer quality relative to the last question asked.
 *
 * Quality hierarchy:
 *   confirmation — caller confirmed an existing value (yes/that's right)
 *   correction   — caller explicitly corrected prior information
 *   direct       — clear, substantive, unhedged answer
 *   partial      — answer present but hedged or incomplete
 *   ambiguous    — unclear answer
 *   nonresponsive — answer does not address the question
 */
function assessAnswerQuality(
  utterance: string,
  answeredQuestion: boolean,
  correctionSignal: boolean,
  affirmations: { yes: boolean; no: boolean; uncertain: boolean },
  lastQuestion: string | null,
  hasActiveConfirmationTarget: boolean,
): TurnInterpretation['answerQuality'] {
  // Correction takes priority — explicit intent to revise
  if (correctionSignal) return 'correction';

  // Confirmation — caller affirmed in the context of a pending question or confirmation target
  if (affirmations.yes && (lastQuestion !== null || hasActiveConfirmationTarget)) return 'confirmation';

  // No answer to the question
  if (!answeredQuestion) return 'nonresponsive';

  const words = utterance.trim().split(/\s+/);
  if (words.length < MIN_SUBSTANTIVE_WORDS) return 'ambiguous';

  // Hedged answer — partial signal
  if (PARTIAL_ANSWER_RE.test(utterance)) return 'partial';

  return 'direct';
}

// ──────────────────────────────────────────────────────────────────
// Answer-to-question matching
// ──────────────────────────────────────────────────────────────────

/**
 * Determine whether the caller's utterance addresses the last question asked.
 *
 * Strategy:
 *   - No last question → always true (volunteered info)
 *   - Correction/affirmation signals → true (addresses the topic by responding to it)
 *   - Turn slots match the asked field → true
 *   - Utterance is substantive (> threshold words) → true (may be answering obliquely)
 *   - Very short utterance with no extracted content → false (likely off-topic or confused)
 */
export function matchAnswerToLastQuestion(
  lastQuestionAsked: string | null,
  extractedContent: Record<string, StateSlot>,
  rawTurnText: string,
): boolean {
  // No prior question — everything is volunteered
  if (!lastQuestionAsked) return true;

  const words = rawTurnText.trim().split(/\s+/).filter(Boolean);

  // Affirmation/correction is always a response to the prior question
  const aff = interpretAffirmation(rawTurnText);
  if (aff.yes || aff.no || aff.uncertain) return true;
  if (detectCorrectionSignal(rawTurnText)) return true;

  // Turn extracted the field being asked about
  if (extractedContent[lastQuestionAsked]) return true;

  // Substantive response — generous assumption that it's answering
  if (words.length >= 4) return true;

  // Short response with nothing extracted — probably nonresponsive
  return false;
}

// ──────────────────────────────────────────────────────────────────
// Main interpreter
// ──────────────────────────────────────────────────────────────────

/**
 * Produce a structured TurnInterpretation for a single caller turn.
 *
 * This runs BEFORE state mutation. The interpretation drives:
 *   - Field proposal generation (buildFieldProposals)
 *   - Confirmation queue draining (YES → confirmField, NO → rejectFieldValue)
 *   - Repair trigger selection
 *   - Audit trail via lastTurnInterpretation
 *
 * @param utterance       Raw caller utterance
 * @param lastQuestion    The slot key of the last question asked (or null)
 * @param state           Current conversation state (read-only)
 * @param turnSlots       Slots extracted from this turn by extractTurnSlots
 * @param turnNumber      Current turn count (used for sourceTurn on proposals)
 */
export function interpretTurn(
  utterance: string,
  lastQuestion: string | null,
  state: ConversationState,
  turnSlots: Record<string, StateSlot>,
  turnNumber: number,
): TurnInterpretation {
  const notes: string[] = [];

  // ── Signal detection ──────────────────────────────────────────
  const affirmations = interpretAffirmation(utterance);
  const correctionSignals = detectCorrectionSignal(utterance);
  const distressSignals = detectDistress(utterance);
  const irrelevantContent = isIrrelevantContent(utterance);

  // ── Answer matching ───────────────────────────────────────────
  const answeredLastQuestion = matchAnswerToLastQuestion(lastQuestion, turnSlots, utterance);

  // ── Answer quality ────────────────────────────────────────────
  const hasActiveConfirmationTarget = (state.confirmationQueue?.length ?? 0) > 0;
  const answerQuality = assessAnswerQuality(
    utterance,
    answeredLastQuestion,
    correctionSignals,
    affirmations,
    lastQuestion,
    hasActiveConfirmationTarget,
  );

  // ── Notes ─────────────────────────────────────────────────────
  if (correctionSignals) notes.push('correction_signal_detected');
  if (distressSignals) notes.push('distress_signal_detected');
  if (irrelevantContent) notes.push('irrelevant_content');
  if (!answeredLastQuestion && lastQuestion) {
    notes.push(`nonresponsive_to:${lastQuestion}`);
  }
  if (affirmations.yes && state.confirmationQueue?.length > 0) {
    notes.push(`affirmed_confirmation_target:${state.confirmationQueue[0]}`);
  }
  if (affirmations.no && state.confirmationQueue?.length > 0) {
    notes.push(`rejected_confirmation_target:${state.confirmationQueue[0]}`);
  }

  // ── Build field proposals from extracted slots ─────────────────
  const detectedFields: ExtractedFieldProposal[] = buildFieldProposalsFromSlots(
    turnSlots,
    lastQuestion,
    correctionSignals,
    affirmations,
    answerQuality,
    state,
    turnNumber,
  );

  return {
    answeredLastQuestion,
    targetField: lastQuestion,
    answerQuality,
    detectedFields,
    affirmations,
    correctionSignals,
    distressSignals,
    irrelevantContent,
    notes,
  };
}

// ──────────────────────────────────────────────────────────────────
// Field proposal construction (inline — called only from interpretTurn)
// ──────────────────────────────────────────────────────────────────

/**
 * Map extracted turn slots to typed ExtractedFieldProposals.
 *
 * Evidence type assignment:
 *   correction    — correctionSignals flag is set
 *   confirmation  — YES affirmation + field matches confirmationQueue[0]
 *   direct_answer — extracted field matches the lastQuestion asked
 *   volunteered   — extracted field not directly requested
 *   inferred      — low confidence (< 0.55) not matching lastQuestion
 *
 * Gate flags:
 *   shouldApplyDirectly  — true for direct_answer(≥0.65), correction, confirmation, volunteered(≥0.70)
 *   requiresConfirmation — true for correction, confidence < 0.60, inferred
 */
function buildFieldProposalsFromSlots(
  turnSlots: Record<string, StateSlot>,
  lastQuestion: string | null,
  correctionSignals: boolean,
  affirmations: { yes: boolean; no: boolean; uncertain: boolean },
  answerQuality: TurnInterpretation['answerQuality'],
  state: ConversationState,
  turnNumber: number,
): ExtractedFieldProposal[] {
  const proposals: ExtractedFieldProposal[] = [];
  const confirmTarget = state.confirmationQueue?.[0] ?? null;

  for (const [fieldKey, slot] of Object.entries(turnSlots)) {
    if (!slot.value) continue;

    // Determine evidence type
    let evidenceType: ExtractedFieldProposal['evidenceType'];

    if (correctionSignals) {
      evidenceType = 'correction';
    } else if (
      affirmations.yes &&
      confirmTarget === fieldKey
    ) {
      evidenceType = 'confirmation';
    } else if (fieldKey === lastQuestion) {
      evidenceType = 'direct_answer';
    } else if (slot.confidence < 0.55 && fieldKey !== lastQuestion) {
      evidenceType = 'inferred';
    } else {
      evidenceType = 'volunteered';
    }

    // Gate flags
    const shouldApplyDirectly =
      evidenceType === 'correction' ||
      evidenceType === 'confirmation' ||
      (evidenceType === 'direct_answer' && slot.confidence >= 0.65) ||
      (evidenceType === 'volunteered' && slot.confidence >= 0.70);

    const requiresConfirmation =
      evidenceType === 'correction' ||
      evidenceType === 'inferred' ||
      slot.confidence < 0.60;

    proposals.push({
      fieldKey,
      rawValue: slot.value,
      normalizedValue: slot.value,
      sourceTurn: turnNumber,
      evidenceType,
      confidenceScore: slot.confidence,
      shouldApplyDirectly,
      requiresConfirmation,
    });
  }

  // Special case: NO affirmation toward the confirmation target — no slot extracted but it's a rejection
  if (affirmations.no && confirmTarget && !turnSlots[confirmTarget]) {
    // We don't produce a proposal here — the rejection is handled downstream
    // by rejectFieldValue() in applyFieldProposalsToState
  }

  return proposals;
}
