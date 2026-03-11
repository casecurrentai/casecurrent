/**
 * Context-aware missing required fields calculation.
 *
 * Which fields are "required" depends on:
 * - agentMode (demo vs production)
 * - callerIntent (existing clients need less discovery)
 * - matterType (drives matter-specific required slots)
 * - What is already filled in state.slots
 *
 * Reuses: getRequiredSlots from Prompt 1 slot-definitions.ts
 */

import { ConversationState } from '../types';
import { getRequiredSlots } from './slot-definitions';

/**
 * Returns slot keys that are required in this context but not yet filled.
 * Pure function — no side effects.
 */
export function recomputeMissingFields(state: ConversationState): string[] {
  const { matterType, callerIntent, agentMode, slots } = state;

  const isFilled = (key: string) => {
    const s = slots[key];
    return s?.value !== null && s?.value !== undefined;
  };

  // ── Demo mode: only need contact info ──────────────────────────
  if (agentMode === 'demo') {
    return ['callback_number'].filter((k) => !isFilled(k));
  }

  // ── Non-intake callers: no intake required ──────────────────────
  if (
    callerIntent === 'wrong_number' ||
    callerIntent === 'opposing_party' ||
    callerIntent === 'vendor'
  ) {
    return [];
  }

  // ── Existing clients: lightweight — just need identity ──────────
  if (callerIntent === 'existing_client') {
    return ['caller_name', 'callback_number'].filter((k) => !isFilled(k));
  }

  // ── Unknown matter type: ask for the bare minimum first ─────────
  // We don't know which matter-specific fields apply yet.
  if (matterType === 'unknown') {
    return ['short_matter_summary'].filter((k) => !isFilled(k));
  }

  // ── New case in production: full matter-specific required set ────
  return getRequiredSlots(matterType).filter((k) => !isFilled(k));
}
