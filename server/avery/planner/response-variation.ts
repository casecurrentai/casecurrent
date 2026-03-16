/**
 * Response variation — bounded phrase selection for repetition control.
 *
 * Handles:
 *   selectAcknowledgmentPhrase() — pick acknowledgment avoiding recent repeats
 *   selectIntroPhrase()          — pick a mode-appropriate intro phrase
 *   deriveConfirmationShape()    — per-field confirmation framing guidance
 *   buildVariationContext()      — assemble full VariationContext for ResponsePlan
 *
 * Variation is deterministic:
 *   Primary:   turnCount % pool.length cycles through variants
 *   Secondary: check lastAssistantUtterance to avoid literal exact repeats; bump by 1
 *
 * This prevents Avery from saying "Got it." or "Let me confirm what I have."
 * every single turn without requiring stateful NLG or LLM creativity.
 *
 * Pure functions — no LLM, no side effects.
 */

import {
  ConversationState,
  ResponsePolicy,
  NextQuestionDecision,
  VariationContext,
  ConfirmationShape,
  EmotionalState,
} from '../types';
import { buildContextualReference } from './contextual-reference';

// ──────────────────────────────────────────────────────────────────
// Phrase banks
// ──────────────────────────────────────────────────────────────────

/** Neutral acknowledgments — calm callers, routine turns */
const ACK_NEUTRAL: readonly string[] = [
  'Got it.',
  'Thank you.',
  'Okay.',
  'I see.',
  'Understood.',
];

/** Warm acknowledgments — distressed, overwhelmed, or anxious callers */
const ACK_WARM: readonly string[] = [
  "I'm sorry to hear that.",
  'Thank you for sharing that.',
  'I understand this is difficult.',
  "I'm glad you reached out.",
];

/** Intros for confirmation turns */
const CONFIRMATION_INTROS: readonly string[] = [
  'Let me confirm what I have.',
  'I want to make sure I have that right.',
  'Let me double-check that with you.',
  'Just to verify—',
];

/** Intros for repair turns */
const REPAIR_INTROS: readonly string[] = [
  'Let me try that again.',
  'Let me rephrase that.',
  'Let me ask that differently.',
  'I want to make sure I understand.',
];

/** Intros for handoff turns */
const HANDOFF_INTROS: readonly string[] = [
  "Based on what you've shared,",
  'I have the information I need,',
  'Thank you for providing that,',
];

/** Intros for completion turns */
const COMPLETION_INTROS: readonly string[] = [
  'Thank you for your time today.',
  "We've covered everything I need.",
  "That's everything for now.",
];

// ──────────────────────────────────────────────────────────────────
// Phrase selection
// ──────────────────────────────────────────────────────────────────

/**
 * Pick a phrase from pool by cycling on turnCount.
 * If the selected phrase appears literally in lastUtterance, bump the index by 1.
 * Deterministic: same (pool, turnCount, lastUtterance) → same phrase.
 */
function pickPhrase(
  pool: readonly string[],
  turnCount: number,
  lastUtterance: string | null,
): string {
  let idx = turnCount % pool.length;
  // Avoid exact repeat from the previous assistant turn
  if (lastUtterance && pool[idx] && lastUtterance.includes(pool[idx])) {
    idx = (idx + 1) % pool.length;
  }
  return pool[idx];
}

/**
 * Select an acknowledgment phrase for the current turn.
 *
 * Returns null when:
 *   - policy.allowAcknowledgment is false
 *   - this is a terminal/emergency turn (no acknowledgment needed)
 */
export function selectAcknowledgmentPhrase(
  emotionalState: EmotionalState,
  policy: ResponsePolicy,
  turnCount: number,
  lastAssistantUtterance: string | null,
): string | null {
  if (!policy.allowAcknowledgment) return null;
  if (policy.mode === 'emergency' || policy.mode === 'complete' || policy.mode === 'handoff') {
    return null;
  }

  const isEmotionallyLoaded =
    emotionalState === 'distressed' ||
    emotionalState === 'overwhelmed' ||
    emotionalState === 'anxious';

  const pool = isEmotionallyLoaded ? ACK_WARM : ACK_NEUTRAL;
  return pickPhrase(pool, turnCount, lastAssistantUtterance);
}

/**
 * Select a mode-appropriate intro phrase.
 *
 * Returns null for modes that don't use a special intro (ask, emergency).
 */
export function selectIntroPhrase(
  mode: ResponsePolicy['mode'],
  turnCount: number,
  lastAssistantUtterance: string | null,
): string | null {
  let pool: readonly string[];

  switch (mode) {
    case 'confirm':
      pool = CONFIRMATION_INTROS;
      break;
    case 'repair':
      pool = REPAIR_INTROS;
      break;
    case 'handoff':
      pool = HANDOFF_INTROS;
      break;
    case 'complete':
      pool = COMPLETION_INTROS;
      break;
    default:
      return null; // ask, emergency — no intro
  }

  return pickPhrase(pool, turnCount, lastAssistantUtterance);
}

// ──────────────────────────────────────────────────────────────────
// Confirmation shape
// ──────────────────────────────────────────────────────────────────

/** Human-readable field labels for confirmation read-backs */
const FIELD_LABELS: Record<string, string> = {
  caller_name:            'your name',
  callback_number:        'your phone number',
  email:                  'your email address',
  incident_date:          'the date of the incident',
  injury_type:            'the type of injury',
  employer_name:          'your employer',
  opposing_party:         'the other party',
  short_matter_summary:   'the situation you described',
  custody_status:         'the custody status',
  charges_known:          'the charges',
  family_matter_category: 'the type of family matter',
  deceased_or_living:     'the estate situation',
  arrest_date:            'the arrest date',
  court_date:             'the court date',
};

function formatFieldValue(fieldKey: string, value: unknown): string {
  if (typeof value !== 'string') return String(value);
  if (fieldKey === 'callback_number') {
    const digits = value.replace(/^\+1/, '').replace(/\D/g, '');
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  }
  return value;
}

/**
 * Derive the confirmation utterance shape for a specific field.
 *
 * Produces structured framing guidance for the renderer — not free text.
 * Only meaningful when ResponsePolicy.mode === 'confirm'.
 */
export function deriveConfirmationShape(
  targetField: string,
  state: ConversationState,
  policy: ResponsePolicy,
): ConfirmationShape {
  const slot = state.slots[targetField];
  const label = FIELD_LABELS[targetField] ?? targetField.replace(/_/g, ' ');
  const requiresConflictFraming = slot?.conflictFlag === true;

  // Explicit and binary styles both require reading back the value
  const requiresReadBack =
    policy.confirmationStyle === 'explicit' || policy.confirmationStyle === 'binary';

  const readBackHint = slot?.value != null
    ? formatFieldValue(targetField, slot.value)
    : null;

  return {
    requiresReadBack,
    requiresConflictFraming,
    fieldLabel: label,
    readBackHint,
  };
}

// ──────────────────────────────────────────────────────────────────
// Main: build VariationContext
// ──────────────────────────────────────────────────────────────────

/**
 * Build a VariationContext for the current turn.
 *
 * Combines pre-selected phrase choices, contextual reference, and
 * confirmation/handoff framing guidance into a single typed object
 * that the renderer uses to produce natural, non-repetitive output.
 *
 * @param state    Full conversation state (after applyTurnToState)
 * @param policy   Derived response policy for this turn
 * @param decision Structured next-question decision from the planner
 */
export function buildVariationContext(
  state: ConversationState,
  policy: ResponsePolicy,
  decision: NextQuestionDecision,
): VariationContext {
  const { emotionalState, turnCount, lastAssistantUtterance } = state;
  const last = lastAssistantUtterance ?? null;

  // ── Phrase selection ──────────────────────────────────────────
  const acknowledgmentPhrase = selectAcknowledgmentPhrase(
    emotionalState,
    policy,
    turnCount,
    last,
  );

  const introPhraseHint = selectIntroPhrase(policy.mode, turnCount, last);

  // ── Contextual reference ──────────────────────────────────────
  // Allowed for confirm, repair, and handoff — not for routine ask turns
  const allowContextualReference =
    policy.mode === 'confirm' ||
    policy.mode === 'repair' ||
    policy.mode === 'handoff';

  const contextualReference = allowContextualReference
    ? buildContextualReference(state, decision.targetField ?? null, policy.mode)
    : null;

  // ── Confirmation shape ────────────────────────────────────────
  const confirmationShape =
    policy.mode === 'confirm' && decision.targetField
      ? deriveConfirmationShape(decision.targetField, state, policy)
      : null;

  // ── Terminal flags ────────────────────────────────────────────
  const isHandoffTurn = policy.mode === 'handoff' || policy.mode === 'complete';
  const isEmergencyTurn = policy.mode === 'emergency';

  return {
    acknowledgmentPhrase,
    introPhraseHint,
    allowContextualReference,
    contextualReference,
    confirmationShape,
    isHandoffTurn,
    isEmergencyTurn,
  };
}
