/**
 * Conversation phase lifecycle — meta-state overlay.
 *
 * ConversationPhase is a lightweight overlay on top of IntakeStage.
 * It accounts for repair and confirmation states that IntakeStage doesn't distinguish.
 *
 * Phase derivation priority (highest → lowest):
 *   1. wrap_up stage            → completed
 *   2. appointment_or_transfer  → ready_for_escalation
 *   3. readiness ready_for_handoff → ready_for_escalation
 *   4. confirmationQueue.length > 0 → confirmation  (overrides active_intake)
 *   5. active repair strategy   → clarification     (overrides active_intake)
 *   6. opening stage            → greeting
 *   7. intent_detection stage   → intent_detection
 *   8. default                  → active_intake
 *
 * Pure function — deterministic, no side effects.
 */

import { ConversationState, ConversationPhase } from '../types';

// Repair strategies that place the conversation in "clarification" phase
const ACTIVE_REPAIR_STRATEGIES = new Set([
  'reassure_then_ask',
  'summarize_and_confirm',
  'offer_examples',
  'slow_down',
]);

/**
 * Derive the ConversationPhase from the current state.
 * Same state → same phase (deterministic).
 */
export function deriveConversationPhase(state: ConversationState): ConversationPhase {
  const { intakeStage, repairStrategy, confirmationQueue, readiness } = state;

  // Terminal
  if (intakeStage === 'wrap_up') return 'completed';

  // Ready for escalation / handoff
  if (intakeStage === 'appointment_or_transfer' || readiness === 'ready_for_handoff') {
    return 'ready_for_escalation';
  }

  // Confirmation needed — overrides active intake
  if ((confirmationQueue ?? []).length > 0) {
    return 'confirmation';
  }

  // Repair / clarification in progress — overrides active intake
  if (ACTIVE_REPAIR_STRATEGIES.has(repairStrategy)) {
    return 'clarification';
  }

  // Early stage mapping
  if (intakeStage === 'opening') return 'greeting';
  if (intakeStage === 'intent_detection') return 'intent_detection';

  // Default: in active intake flow
  return 'active_intake';
}

/**
 * Apply the conversation phase to state.
 * Returns a new ConversationState with conversationPhase set.
 * Pure — original state is not mutated.
 */
export function transitionConversationState(state: ConversationState): ConversationState {
  return {
    ...state,
    conversationPhase: deriveConversationPhase(state),
  };
}
