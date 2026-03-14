/**
 * Intake readiness evaluator.
 *
 * Determines how complete the intake is, independent of escalation policy.
 * Sits between state update and ResponsePlan generation.
 *
 * States:
 *   incomplete            — required fields still missing, conflicting, or untrustworthy
 *   minimum_viable_intake — contactable + enough to route (callback-worthy)
 *   ready_for_handoff     — all required fields captured with sufficient quality
 *   completed             — conversation wrapped up (wrap_up stage)
 *
 * 3D: Readiness now requires DATA QUALITY, not just data presence.
 * A field counts as "satisfied" only when:
 *   - it has a non-null value
 *   - it is NOT flagged as conflicting
 *   - its confidence meets REQUIRED_FIELD_CONFIDENCE_THRESHOLD (≥ 0.60)
 *
 * This prevents conflicting or ambiguous required fields from falsely
 * reporting the intake as ready for handoff.
 *
 * Pure function — no side effects, no LLM calls.
 * Deterministic: same state → same readiness.
 */

import { ConversationState, IntakeReadiness } from '../types';
import { getIntakeRequirements } from '../state/intake-requirements';
import { REQUIRED_FIELD_CONFIDENCE_THRESHOLD } from '../state/field-memory';

/**
 * Evaluate intake readiness from the current conversation state.
 */
export function evaluateIntakeReadiness(state: ConversationState): IntakeReadiness {
  const { agentMode, matterType, intakeStage, slots, callerIntent } = state;

  // ── Terminal stage ──────────────────────────────────────────────
  if (intakeStage === 'wrap_up') {
    return 'completed';
  }

  // ── Demo mode: just a contact number (presence only, no quality gate) ──
  if (agentMode === 'demo') {
    return slots['callback_number']?.value ? 'ready_for_handoff' : 'incomplete';
  }

  // ── Non-intake callers need no intake ──────────────────────────
  if (
    callerIntent === 'wrong_number' ||
    callerIntent === 'opposing_party' ||
    callerIntent === 'vendor'
  ) {
    return 'completed';
  }

  /**
   * 3D: Quality-aware field check.
   * A field is satisfied only when:
   *   - value is non-null / non-undefined
   *   - conflictFlag is NOT set (contradictory data)
   *   - confidence meets the required threshold (≥ 0.60)
   */
  const isQualified = (key: string): boolean => {
    const slot = slots[key];
    if (!slot?.value) return false;
    if (slot.conflictFlag) return false;
    if (slot.confidence < REQUIRED_FIELD_CONFIDENCE_THRESHOLD) return false;
    return true;
  };

  /**
   * Minimum viable check uses presence-only (isFilled) because
   * the point of minimum_viable_intake is: "we can at least call them back".
   * We don't need perfect data for a callback to be possible.
   */
  const isFilled = (key: string): boolean => {
    const s = slots[key];
    return s?.value !== null && s?.value !== undefined;
  };

  const req = getIntakeRequirements(matterType);

  // ── All required fields qualified → ready for handoff ──────────
  if (req.required.every(isQualified)) {
    return 'ready_for_handoff';
  }

  // ── Minimum viable subset present → safe to escalate if needed ─
  if (req.minimumViable.every(isFilled)) {
    return 'minimum_viable_intake';
  }

  return 'incomplete';
}
