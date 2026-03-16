/**
 * Contextual reference builder.
 *
 * Generates brief, natural references to already-captured caller information.
 * Used when Avery is confirming, repairing, or handing off — so it sounds
 * aware of prior context rather than starting fresh every turn.
 *
 * Firing rules:
 *   confirm  — read back the field value: "I have your phone number as 555-123-4567."
 *   repair   — reference what was said: "You mentioned the date as 'last week' — let me clarify."
 *   handoff  — brief summary: "your name: Jane, your phone: 555-123-4567"
 *   ask      — NOT used (avoids constant recaps)
 *   emergency — NOT used (no time for context)
 *
 * Pure function — no side effects, no LLM calls.
 */

import type { ConversationState, ResponsePolicy } from '../types';

// ──────────────────────────────────────────────────────────────────
// Field display config
// ──────────────────────────────────────────────────────────────────

interface FieldDisplayConfig {
  label: string;
  format?: (value: unknown) => string;
}

const FIELD_DISPLAY: Record<string, FieldDisplayConfig> = {
  caller_name:           { label: 'your name' },
  callback_number: {
    label: 'your phone number',
    format: (v) => {
      if (typeof v !== 'string') return String(v);
      const digits = v.replace(/^\+1/, '').replace(/\D/g, '');
      return digits.length === 10
        ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
        : v;
    },
  },
  email:                 { label: 'your email' },
  incident_date:         { label: 'the date of the incident' },
  injury_type:           { label: 'the type of injury' },
  employer_name:         { label: 'your employer' },
  opposing_party:        { label: 'the other party' },
  short_matter_summary:  { label: 'your situation' },
  custody_status:        { label: 'the custody status' },
  charges_known:         { label: 'the charges' },
  family_matter_category: { label: 'the type of family matter' },
  deceased_or_living:    { label: 'the estate situation' },
  arrest_date:           { label: 'the arrest date' },
  court_date:            { label: 'the court date' },
};

function formatValue(fieldKey: string, value: unknown): string {
  const cfg = FIELD_DISPLAY[fieldKey];
  if (cfg?.format) return cfg.format(value);
  return typeof value === 'string' ? value : String(value);
}

export function fieldLabel(fieldKey: string): string {
  return FIELD_DISPLAY[fieldKey]?.label ?? fieldKey.replace(/_/g, ' ');
}

// ──────────────────────────────────────────────────────────────────
// Handoff summary
// ──────────────────────────────────────────────────────────────────

// Top fields to include in a handoff summary, in priority order
const HANDOFF_SUMMARY_FIELDS = [
  'caller_name',
  'callback_number',
  'short_matter_summary',
  'incident_date',
];

/**
 * Build a brief contextual summary for handoff / completion turns.
 * Lists the top 2 captured fields so Avery sounds informed.
 * Returns null when nothing has been captured yet.
 */
export function buildHandoffSummary(state: ConversationState): string | null {
  const captured: string[] = [];

  for (const key of HANDOFF_SUMMARY_FIELDS) {
    const slot = state.slots[key];
    if (slot?.value && !slot.conflictFlag) {
      const formatted = formatValue(key, slot.value);
      captured.push(`${fieldLabel(key)}: ${formatted}`);
    }
    if (captured.length >= 2) break; // Keep it brief — two fields maximum
  }

  return captured.length > 0 ? captured.join(', ') : null;
}

// ──────────────────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────────────────

/**
 * Build a contextual reference appropriate for the current response mode.
 *
 * @param state        Conversation state (read-only)
 * @param targetField  Field targeted this turn (null for stage-level)
 * @param mode         Response mode from ResponsePolicy
 * @returns            Brief reference string, or null if not applicable
 */
export function buildContextualReference(
  state: ConversationState,
  targetField: string | null,
  mode: ResponsePolicy['mode'],
): string | null {
  switch (mode) {
    case 'confirm': {
      // "I have your phone number as 555-123-4567."
      if (!targetField) return null;
      const slot = state.slots[targetField];
      if (!slot?.value) return null;
      const formatted = formatValue(targetField, slot.value);
      const label = fieldLabel(targetField);
      return `I have ${label} as ${formatted}.`;
    }

    case 'repair': {
      // "You mentioned the date of the incident as 'last week' — let me clarify."
      if (!targetField) return null;
      const slot = state.slots[targetField];
      if (!slot?.value) return null;
      const formatted = formatValue(targetField, slot.value);
      const label = fieldLabel(targetField);
      return `You mentioned ${label} as "${formatted}" — let me clarify.`;
    }

    case 'handoff': {
      return buildHandoffSummary(state);
    }

    // ask, emergency, complete — no contextual reference
    default:
      return null;
  }
}
