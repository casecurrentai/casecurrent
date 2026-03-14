/**
 * Field memory management for the Avery conversation runtime.
 *
 * Handles:
 * - Conflict-aware slot updates (resolveFieldUpdate, mergeWithConflictDetection)
 * - Slot status enrichment (enrichSlotsWithStatus)
 * - Confirmation queue computation (recomputeConfirmationQueue)
 * - Derived field quality sets (low-confidence, conflicting, optional remaining)
 * - Explicit confirmation stamping (confirmField)
 *
 * All functions are pure — no side effects, no LLM calls.
 * Deterministic: same state → same output.
 */

import {
  ConversationState,
  StateSlot,
  FieldUpdateAction,
} from '../types';
import { getIntakeRequirements } from './intake-requirements';
import { scoreFieldConfidence, detectFieldConflict } from './confidence';

// ──────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────

/**
 * Minimum confidence for a required field to count as "satisfied" for readiness.
 * Fields below this threshold go into lowConfidenceRequiredFields.
 */
export const REQUIRED_FIELD_CONFIDENCE_THRESHOLD = 0.60;

/**
 * Confirmation priority — lower number = higher priority in the confirmation queue.
 * Fields not listed get DEFAULT_PRIORITY.
 */
const CONFIRMATION_PRIORITY: Record<string, number> = {
  callback_number: 1,
  incident_date: 2,
  caller_name: 3,
  charges_known: 4,
  custody_status: 4,
  employer_name: 4,
  family_matter_category: 4,
  deceased_or_living: 4,
  short_matter_summary: 5,
  injury_type: 5,
  opposing_party: 6,
};

const DEFAULT_PRIORITY = 10;

// ──────────────────────────────────────────────────────────────────
// Conflict-aware field update
// ──────────────────────────────────────────────────────────────────

export interface FieldUpdateResult {
  action: FieldUpdateAction;
  updatedSlot: StateSlot;
  conflictDetected: boolean;
}

/**
 * Resolve how to update a single field given an existing slot and an incoming candidate.
 *
 * Decision tree:
 *   1. No existing value → accept unconditionally
 *   2. Conflict detected (both high-confidence, different values) → keep existing, mark conflict
 *   3. Incoming confidence is much higher (> 0.15 margin) → accept new
 *   4. Incoming is low-quality noise (< 0.40) vs good existing (≥ 0.60) → retain existing
 *   5. Incoming confidence > existing → accept new
 *   6. Default → retain existing
 */
export function resolveFieldUpdate(
  _fieldKey: string,
  existing: StateSlot | undefined,
  incoming: StateSlot,
): FieldUpdateResult {
  // No existing value — accept unconditionally
  if (!existing || existing.value === null || existing.value === undefined) {
    return { action: 'accept_new_value', updatedSlot: incoming, conflictDetected: false };
  }

  // Semantic conflict: both have high-confidence but different values
  if (detectFieldConflict(existing, incoming)) {
    return {
      action: 'mark_conflict_require_confirmation',
      updatedSlot: {
        ...existing,
        conflictFlag: true,
        needsConfirmation: true,
      },
      conflictDetected: true,
    };
  }

  // Incoming is clearly a better signal
  if (incoming.confidence > existing.confidence + 0.15) {
    return { action: 'accept_new_value', updatedSlot: incoming, conflictDetected: false };
  }

  // Incoming is noisy — don't overwrite good existing data
  if (incoming.confidence < 0.40 && existing.confidence >= REQUIRED_FIELD_CONFIDENCE_THRESHOLD) {
    return { action: 'retain_existing_value', updatedSlot: existing, conflictDetected: false };
  }

  // Standard higher-confidence-wins
  if (incoming.confidence > existing.confidence) {
    return { action: 'accept_new_value', updatedSlot: incoming, conflictDetected: false };
  }

  return { action: 'retain_existing_value', updatedSlot: existing, conflictDetected: false };
}

// ──────────────────────────────────────────────────────────────────
// Conflict-aware slot merge
// ──────────────────────────────────────────────────────────────────

export interface MergeResult {
  slots: Record<string, StateSlot>;
  conflictedFields: string[];
}

/**
 * Merge incoming turn slots into existing slots with conflict detection.
 *
 * Replaces the simple confidence-wins merge for the live turn pipeline.
 * High-confidence existing values are protected; contradictions are flagged
 * instead of being silently overwritten.
 */
export function mergeWithConflictDetection(
  existing: Record<string, StateSlot>,
  incoming: Record<string, StateSlot>,
): MergeResult {
  const merged: Record<string, StateSlot> = { ...existing };
  const conflictedFields: string[] = [];

  for (const [key, incomingSlot] of Object.entries(incoming)) {
    const result = resolveFieldUpdate(key, merged[key], incomingSlot);
    merged[key] = result.updatedSlot;
    if (result.conflictDetected) {
      conflictedFields.push(key);
    }
  }

  return { slots: merged, conflictedFields };
}

// ──────────────────────────────────────────────────────────────────
// Slot status enrichment
// ──────────────────────────────────────────────────────────────────

/**
 * Enrich all slots with computed status (confirmed/likely/ambiguous/conflicting/missing).
 *
 * - Slots with conflictFlag get status 'conflicting' regardless of confidence score.
 * - All others get status derived from scoreFieldConfidence().
 *
 * Pure — returns a new slot map, original is not mutated.
 */
export function enrichSlotsWithStatus(
  slots: Record<string, StateSlot>,
): Record<string, StateSlot> {
  const enriched: Record<string, StateSlot> = {};

  for (const [key, slot] of Object.entries(slots)) {
    if (slot.conflictFlag) {
      enriched[key] = { ...slot, status: 'conflicting' };
    } else {
      const { status } = scoreFieldConfidence(key, slot);
      enriched[key] = { ...slot, status };
    }
  }

  return enriched;
}

// ──────────────────────────────────────────────────────────────────
// Confirmation queue
// ──────────────────────────────────────────────────────────────────

/**
 * Compute the priority-ordered confirmation queue.
 *
 * A field enters the queue when ANY of these are true:
 *   - slot.conflictFlag === true (contradictory data — must resolve)
 *   - slot.needsConfirmation === true (explicitly flagged)
 *   - field is required AND confidence < REQUIRED_FIELD_CONFIDENCE_THRESHOLD
 *
 * The queue is sorted by CONFIRMATION_PRIORITY (lower = asked first).
 */
export function recomputeConfirmationQueue(state: ConversationState): string[] {
  const { slots, matterType, callerIntent, agentMode } = state;

  // Non-intake callers and demo mode don't need confirmation
  if (
    agentMode === 'demo' ||
    callerIntent === 'wrong_number' ||
    callerIntent === 'opposing_party' ||
    callerIntent === 'vendor'
  ) {
    return [];
  }

  const req = getIntakeRequirements(matterType);
  const requiredSet = new Set(req.required);
  const queue: string[] = [];

  for (const [key, slot] of Object.entries(slots)) {
    if (!slot.value) continue; // missing fields are not in the confirmation queue

    const shouldConfirm =
      slot.conflictFlag === true ||
      slot.needsConfirmation === true ||
      (requiredSet.has(key) && slot.confidence < REQUIRED_FIELD_CONFIDENCE_THRESHOLD);

    if (shouldConfirm) {
      queue.push(key);
    }
  }

  // Sort by priority (lower number = higher priority)
  queue.sort(
    (a, b) =>
      (CONFIRMATION_PRIORITY[a] ?? DEFAULT_PRIORITY) -
      (CONFIRMATION_PRIORITY[b] ?? DEFAULT_PRIORITY),
  );

  return queue;
}

// ──────────────────────────────────────────────────────────────────
// Derived field quality sets
// ──────────────────────────────────────────────────────────────────

/**
 * Required fields that have a value but insufficient confidence for handoff.
 * These are present (not in missingRequiredFields) but not trusted enough.
 */
export function recomputeLowConfidenceRequiredFields(state: ConversationState): string[] {
  const { slots, matterType } = state;
  const req = getIntakeRequirements(matterType);

  return req.required.filter((key) => {
    const slot = slots[key];
    return (
      slot?.value !== null &&
      slot?.value !== undefined &&
      !slot.conflictFlag &&
      slot.confidence < REQUIRED_FIELD_CONFIDENCE_THRESHOLD
    );
  });
}

/**
 * Required fields that have been flagged as conflicting.
 * These cannot be relied upon until the caller resolves the conflict.
 */
export function recomputeConflictingRequiredFields(state: ConversationState): string[] {
  const { slots, matterType } = state;
  const req = getIntakeRequirements(matterType);

  return req.required.filter((key) => slots[key]?.conflictFlag === true);
}

/**
 * Optional fields from the intake requirements that haven't been captured yet.
 * Used to drive optional enrichment questions after required fields are filled.
 */
export function recomputeOptionalFieldsRemaining(state: ConversationState): string[] {
  const { slots, matterType } = state;
  const req = getIntakeRequirements(matterType);

  return req.optional.filter((key) => !slots[key]?.value);
}

// ──────────────────────────────────────────────────────────────────
// Explicit confirmation
// ──────────────────────────────────────────────────────────────────

/**
 * Mark a field as explicitly confirmed by the caller.
 *
 * Effects:
 * - Upgrades confidence to at least 0.90
 * - Sets status to 'confirmed'
 * - Clears conflictFlag and needsConfirmation
 * - Removes the field from the confirmation queue
 *
 * Call this when the caller explicitly confirms a previously ambiguous or
 * conflicting value (e.g., "Yes, that's correct" in response to a confirm-type turn).
 */
export function confirmField(state: ConversationState, fieldKey: string): ConversationState {
  const existingSlot = state.slots[fieldKey];
  if (!existingSlot) return state;

  const confirmedSlot: StateSlot = {
    ...existingSlot,
    confidence: Math.max(existingSlot.confidence, 0.90),
    status: 'confirmed',
    conflictFlag: false,
    needsConfirmation: false,
  };

  return {
    ...state,
    slots: { ...state.slots, [fieldKey]: confirmedSlot },
    confirmationQueue: state.confirmationQueue.filter((k) => k !== fieldKey),
    conflictingRequiredFields: state.conflictingRequiredFields.filter((k) => k !== fieldKey),
    lowConfidenceRequiredFields: state.lowConfidenceRequiredFields.filter(
      (k) => k !== fieldKey,
    ),
  };
}

/**
 * Reject/clear a field value when the caller says NO to a confirmation prompt.
 *
 * Effects:
 * - Clears the field value (sets to null) and resets confidence to 0
 * - Sets status to 'missing'
 * - Clears conflictFlag and needsConfirmation
 * - Removes the field from the confirmation queue and all derived field sets
 *
 * Call this when the caller explicitly rejects the currently confirmed value
 * (e.g., "No, that's not right" in response to a confirm-type turn).
 * The caller must then supply the correct value in a subsequent turn.
 */
export function rejectFieldValue(state: ConversationState, fieldKey: string): ConversationState {
  const existingSlot = state.slots[fieldKey];
  if (!existingSlot) return state;

  const rejectedSlot: StateSlot = {
    ...existingSlot,
    value: null,
    confidence: 0,
    status: 'missing',
    conflictFlag: false,
    needsConfirmation: false,
  };

  return {
    ...state,
    slots: { ...state.slots, [fieldKey]: rejectedSlot },
    confirmationQueue: state.confirmationQueue.filter((k) => k !== fieldKey),
    conflictingRequiredFields: state.conflictingRequiredFields.filter((k) => k !== fieldKey),
    lowConfidenceRequiredFields: state.lowConfidenceRequiredFields.filter((k) => k !== fieldKey),
  };
}
