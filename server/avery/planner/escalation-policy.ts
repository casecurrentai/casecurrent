/**
 * Escalation policy — evaluates whether Avery should escalate or transfer.
 *
 * Transfer scenarios (highest to lowest priority):
 *   1. Caller safety concern (immediate)
 *   2. Critical urgency (immediate)
 *   3. Caller explicitly requests to speak with a person (immediate)
 *   4. Already represented — possible referral or second opinion (recommended)
 *   5. Existing client with high urgency (recommended)
 *   6. High urgency — expedited consultation (suggested)
 *   7. Extreme distress after repair attempts (recommended)
 *   8. Prolonged confusion with low confidence (suggested)
 *   9. Persistent interruptions with insufficient intake progress (suggested)
 */

import { ConversationState } from '../types';

export interface EscalationDecision {
  shouldEscalate: boolean;
  /** How urgently escalation should happen. */
  urgency: 'immediate' | 'recommended' | 'suggested' | 'none';
  reason: string | null;
  /** Hint for routing: on_call_attorney, staff, case_manager, emergency_or_crisis, etc. */
  transferTarget: string | null;
}

const NO_ESCALATION: EscalationDecision = {
  shouldEscalate: false,
  urgency: 'none',
  reason: null,
  transferTarget: null,
};

// Pattern to detect when caller explicitly requests a person
const WANTS_PERSON_PATTERN =
  /(?:speak\s+(?:to|with)|talk\s+(?:to|with)|get\s+me|connect\s+me\s+(?:to|with)|transfer\s+me)\s+(?:to\s+)?(?:a\s+|an\s+|the\s+)?(?:person|human|lawyer|attorney|staff|representative|real\s+person|someone)/i;

/**
 * Evaluate whether the current conversation state requires escalation.
 * Returns an EscalationDecision. Never throws.
 */
export function evaluateEscalation(state: ConversationState): EscalationDecision {
  const {
    riskFlags,
    urgencyLevel,
    callerIntent,
    emotionalState,
    repairStrategy,
    turnCount,
    interruptionCount,
    matterType,
    lastUserUtterance,
    confidenceScore,
  } = state;

  // ── 1. Caller safety: highest priority ──────────────────────────
  if (riskFlags.includes('caller_safety_concern')) {
    return {
      shouldEscalate: true,
      urgency: 'immediate',
      reason: 'Caller expressed self-harm or safety concerns',
      transferTarget: 'emergency_or_crisis',
    };
  }

  // ── 2. Critical urgency + known matter ─────────────────────────
  if (urgencyLevel === 'critical') {
    return {
      shouldEscalate: true,
      urgency: 'immediate',
      reason: `Critical urgency — ${matterType !== 'unknown' ? matterType.replace(/_/g, ' ') : 'matter unknown'}`,
      transferTarget: 'on_call_attorney',
    };
  }

  // ── 3. Caller requests a person ────────────────────────────────
  if (lastUserUtterance && WANTS_PERSON_PATTERN.test(lastUserUtterance)) {
    return {
      shouldEscalate: true,
      urgency: 'immediate',
      reason: 'Caller requested to speak with a staff member or attorney',
      transferTarget: 'staff',
    };
  }

  // ── 4. Already represented ─────────────────────────────────────
  if (riskFlags.includes('already_represented')) {
    return {
      shouldEscalate: true,
      urgency: 'recommended',
      reason: 'Caller already has legal representation — possible referral',
      transferTarget: 'staff_referral',
    };
  }

  // ── 5. Existing client with high urgency ───────────────────────
  if (callerIntent === 'existing_client' && urgencyLevel === 'high') {
    return {
      shouldEscalate: true,
      urgency: 'recommended',
      reason: 'Existing client with high-urgency matter',
      transferTarget: 'case_manager',
    };
  }

  // ── 6. High urgency (general) ─────────────────────────────────
  if (urgencyLevel === 'high') {
    return {
      shouldEscalate: true,
      urgency: 'suggested',
      reason: 'High-urgency matter — expedited consultation recommended',
      transferTarget: 'intake_staff',
    };
  }

  // ── 7. Distressed caller whose repair strategy is handoff ──────
  if (emotionalState === 'distressed' && repairStrategy === 'handoff') {
    return {
      shouldEscalate: true,
      urgency: 'recommended',
      reason: 'Caller in distress — human support needed',
      transferTarget: 'staff',
    };
  }

  // ── 8. Prolonged confusion with low confidence ─────────────────
  if (emotionalState === 'confused' && turnCount >= 6 && confidenceScore < 0.30) {
    return {
      shouldEscalate: true,
      urgency: 'suggested',
      reason: 'Persistent confusion after multiple clarification attempts',
      transferTarget: 'staff',
    };
  }

  // ── 9. Repeated interruptions with insufficient progress ───────
  if (interruptionCount >= 5 && confidenceScore < 0.35) {
    return {
      shouldEscalate: true,
      urgency: 'suggested',
      reason: 'Repeated interruptions with insufficient intake progress',
      transferTarget: 'staff',
    };
  }

  return NO_ESCALATION;
}
