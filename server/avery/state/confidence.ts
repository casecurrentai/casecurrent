/**
 * Confidence scoring for conversation state.
 *
 * Overall confidence is a weighted function of:
 * - Whether we have a matter type classification at all
 * - How many required slots for that matter type are filled
 * - High-value universal slots (name, phone, date, opposing party)
 * - Penalty signals: risk flags, interruptions, silence
 *
 * Returns a value 0–1.
 *
 * Reuses: getRequiredSlots from Prompt 1 slot-definitions.ts
 */

import { ConversationState } from '../types';
import { getRequiredSlots } from './slot-definitions';

/**
 * Recompute the overall confidence score from the current conversation state.
 * Pure function — reads state only, no side effects.
 */
export function recomputeConfidence(state: ConversationState): number {
  const { matterType, slots, riskFlags, interruptionCount, silenceEvents } = state;

  // No matter type → very low confidence ceiling
  if (matterType === 'unknown') {
    // Small credit for having basic contact info
    const hasPhone = !!slots['callback_number']?.value;
    const hasName = !!slots['caller_name']?.value;
    return parseFloat((0.05 + (hasPhone ? 0.05 : 0) + (hasName ? 0.05 : 0)).toFixed(2));
  }

  // Base: having a matter type is the biggest single confidence signal
  let score = 0.35;

  // Required slot completeness: up to +0.40 points
  const required = getRequiredSlots(matterType);
  if (required.length > 0) {
    const filled = required.filter(
      (key) => slots[key]?.value !== null && slots[key]?.value !== undefined,
    );
    score += (filled.length / required.length) * 0.40;
  }

  // High-value universal slots: up to +0.20 points
  if (slots['caller_name']?.value) score += 0.05;
  if (slots['callback_number']?.value) score += 0.07;
  if (slots['incident_date']?.value) score += 0.04;
  if (slots['opposing_party']?.value) score += 0.04;

  // Penalties
  if (riskFlags.includes('already_represented')) score -= 0.10;
  if (riskFlags.includes('possible_sol_issue')) score -= 0.05;
  if (interruptionCount >= 4) score -= 0.05;
  if (silenceEvents >= 4) score -= 0.05;

  return parseFloat(Math.max(0, Math.min(1, score)).toFixed(2));
}
