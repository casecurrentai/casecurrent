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

import { ConversationState, StateSlot, StateSlotStatus } from '../types';
import { getRequiredSlots } from './slot-definitions';

// ──────────────────────────────────────────────────────────────────
// 3C: Field-level confidence helpers
// ──────────────────────────────────────────────────────────────────

/** Result of per-field confidence scoring. */
export interface FieldConfidenceResult {
  score: number;
  status: StateSlotStatus;
}

/**
 * Vague temporal phrases that indicate low confidence for date-type fields.
 * "I think it was Tuesday... maybe Wednesday" → ambiguous.
 */
const VAGUE_DATE_RE =
  /\b(a while ago|some time ago|recently|not sure|maybe|i think|probably|around|sometime|last year|few months|don't remember)\b/i;

/**
 * Score the confidence of a single extracted slot.
 *
 * Rules-based — does not invoke the LLM.
 *
 * Score thresholds:
 *   ≥ 0.80 → confirmed  (direct, explicit answer)
 *   ≥ 0.60 → likely     (plausible, no contradiction)
 *   ≥ 0.35 → ambiguous  (vague, hedged, or low-signal)
 *   <  0.35 → ambiguous (present but very uncertain)
 *   absent  → missing
 */
export function scoreFieldConfidence(
  fieldKey: string,
  slot: StateSlot | undefined,
): FieldConfidenceResult {
  if (!slot || slot.value === null || slot.value === undefined) {
    return { score: 0, status: 'missing' };
  }

  let score = slot.confidence;

  // Date fields: penalize vague temporal phrases
  const isDateField =
    fieldKey === 'incident_date' ||
    fieldKey === 'arrest_date' ||
    fieldKey === 'termination_date' ||
    fieldKey === 'court_date' ||
    fieldKey === 'court_dates' ||
    fieldKey.endsWith('_date');

  if (isDateField && typeof slot.value === 'string' && VAGUE_DATE_RE.test(slot.value)) {
    score = Math.max(score - 0.25, 0.15);
  }

  // Map numeric score to status
  let status: StateSlotStatus;
  if (score >= 0.80) {
    status = 'confirmed';
  } else if (score >= 0.60) {
    status = 'likely';
  } else {
    status = 'ambiguous';
  }

  return { score: parseFloat(score.toFixed(2)), status };
}

/**
 * Detect a semantic conflict between an existing slot value and an incoming candidate.
 *
 * Returns true only when:
 * - both have non-null, meaningfully different values
 * - both have confidence ≥ 0.50 (so we aren't flagging noise vs. signal)
 */
export function detectFieldConflict(existing: StateSlot, incoming: StateSlot): boolean {
  if (!existing.value || !incoming.value) return false;
  if (existing.value === incoming.value) return false;

  const a = String(existing.value).toLowerCase().trim();
  const b = String(incoming.value).toLowerCase().trim();
  if (a === b) return false;

  return existing.confidence >= 0.50 && incoming.confidence >= 0.50;
}

/**
 * Normalize a raw extracted field value to a clean, canonical string.
 *
 * - Trims and collapses whitespace for all fields
 * - Phone numbers: strips non-digit characters (preserves leading +)
 */
export function normalizeExtractedField(fieldKey: string, rawValue: string): string {
  const trimmed = rawValue.trim().replace(/\s+/g, ' ');

  if (fieldKey === 'callback_number' || fieldKey === 'contact_phone') {
    // Keep leading + for E.164 numbers; strip everything else non-numeric
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    return hasPlus ? `+${digits}` : digits;
  }

  return trimmed;
}

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
