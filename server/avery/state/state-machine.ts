/**
 * Intake stage state machine.
 *
 * Determines the next IntakeStage from the current ConversationState.
 * Transitions are NOT purely linear — they depend on intent, matter type,
 * urgency, confidence, agent mode, and slot completeness.
 *
 * Stage flow overview (production mode, new_case):
 *
 *   opening
 *     → intent_detection
 *     → matter_classification
 *     → eligibility_screening
 *     → fact_collection
 *     → contact_capture
 *     → conflict_check_prep
 *     → appointment_or_transfer
 *     → wrap_up
 *
 * Short-circuits:
 *   wrong_number / opposing_party / vendor → wrap_up
 *   caller_safety_concern                  → appointment_or_transfer (immediate)
 *   critical urgency + known matter        → appointment_or_transfer
 *   existing_client                        → contact_capture → appointment_or_transfer
 *   demo mode                              → simplified 3-stage flow
 *   already_represented                    → eligibility_screening → wrap_up
 */

import { ConversationState, IntakeStage, CallerIntent } from '../types';

const TERMINAL: IntakeStage = 'wrap_up';
const EXIT_INTENTS: CallerIntent[] = ['wrong_number', 'opposing_party', 'vendor'];

/**
 * Given the current state, return the IntakeStage that should be active next.
 * Call this after each turn update to advance the stage.
 */
export function determineNextStage(state: ConversationState): IntakeStage {
  const {
    intakeStage,
    callerIntent,
    matterType,
    urgencyLevel,
    riskFlags,
    agentMode,
    transferRecommended,
  } = state;

  // Terminal: never leave wrap_up
  if (intakeStage === 'wrap_up') return TERMINAL;

  // ── Safety: override everything ─────────────────────────────────
  if (riskFlags.includes('caller_safety_concern')) {
    return 'appointment_or_transfer';
  }

  // ── Transfer already decided ────────────────────────────────────
  if (transferRecommended && intakeStage !== 'appointment_or_transfer') {
    return 'appointment_or_transfer';
  }

  // ── Callers who skip intake entirely ────────────────────────────
  if (EXIT_INTENTS.includes(callerIntent)) {
    return TERMINAL;
  }

  // ── Demo mode: simplified flow ───────────────────────────────────
  if (agentMode === 'demo') {
    return _demoTransition(intakeStage);
  }

  // ── Existing client: direct routing ─────────────────────────────
  if (callerIntent === 'existing_client') {
    return _existingClientTransition(intakeStage, state);
  }

  // ── Critical urgency short-circuit ──────────────────────────────
  // If we know the matter type, jump straight to transfer/appointment
  if (urgencyLevel === 'critical' && matterType !== 'unknown') {
    if (
      intakeStage !== 'appointment_or_transfer' &&
      intakeStage !== 'wrap_up'
    ) {
      return 'appointment_or_transfer';
    }
  }

  // ── Normal production flow ───────────────────────────────────────
  return _productionTransition(state);
}

// ──────────────────────────────────────────────────────────────────
// Transition helpers
// ──────────────────────────────────────────────────────────────────

function _demoTransition(current: IntakeStage): IntakeStage {
  switch (current) {
    case 'opening':
      return 'matter_classification';
    case 'matter_classification':
      return 'contact_capture';
    case 'contact_capture':
      return TERMINAL;
    default:
      return TERMINAL;
  }
}

function _existingClientTransition(
  current: IntakeStage,
  state: ConversationState,
): IntakeStage {
  const hasName = !!state.slots['caller_name']?.value;
  const hasPhone = !!state.slots['callback_number']?.value;

  switch (current) {
    case 'opening':
    case 'intent_detection':
      return 'contact_capture';
    case 'contact_capture':
      return hasName && hasPhone ? 'appointment_or_transfer' : 'contact_capture';
    case 'appointment_or_transfer':
      return TERMINAL;
    default:
      return 'appointment_or_transfer';
  }
}

function _productionTransition(state: ConversationState): IntakeStage {
  const {
    intakeStage,
    callerIntent,
    matterType,
    confidenceScore,
    missingRequiredFields,
    riskFlags,
    slots,
    turnCount,
  } = state;

  switch (intakeStage) {
    case 'opening':
      return 'intent_detection';

    case 'intent_detection':
      // Stay until intent is identified, or advance after 2 turns
      if (callerIntent !== 'unknown' || turnCount >= 2) {
        return 'matter_classification';
      }
      return 'intent_detection';

    case 'matter_classification':
      // Need at least some confidence to move to screening
      if (matterType !== 'unknown' && confidenceScore >= 0.30) {
        return 'eligibility_screening';
      }
      // Safety valve: advance after 5 turns even if unclear
      if (turnCount >= 5) {
        return 'eligibility_screening';
      }
      return 'matter_classification';

    case 'eligibility_screening':
      // Already represented: intake complete (ineligible)
      if (riskFlags.includes('already_represented')) {
        return TERMINAL;
      }
      return 'fact_collection';

    case 'fact_collection': {
      // Stay until required fields are filled, or after turn 14 (safety valve)
      const done = missingRequiredFields.length === 0 || turnCount >= 14;
      if (done) {
        // Skip contact_capture if inbound phone already provides callback_number
        const hasPhone = !!slots['callback_number']?.value;
        return hasPhone ? 'conflict_check_prep' : 'contact_capture';
      }
      return 'fact_collection';
    }

    case 'contact_capture': {
      const hasContact =
        !!slots['callback_number']?.value || !!slots['email']?.value;
      return hasContact ? 'conflict_check_prep' : 'contact_capture';
    }

    case 'conflict_check_prep':
      return 'appointment_or_transfer';

    case 'appointment_or_transfer':
      return TERMINAL;

    default:
      return intakeStage; // unknown stage — stay put
  }
}
