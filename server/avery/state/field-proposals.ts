/**
 * Field proposal application — evidence-aware state mutation gate.
 *
 * Handles:
 *   applyFieldProposalsToState() — apply ExtractedFieldProposals to ConversationState
 *
 * This module sits between turn interpretation and state merging.
 * It enforces the evidence-type gating rules and handles:
 *   - YES affirmations → confirmField()
 *   - NO affirmations  → rejectFieldValue()
 *   - Correction proposals → direct overwrite (bypass conflict detection)
 *   - Direct/volunteered proposals → normal mergeWithConflictDetection
 *   - Inferred proposals → only apply if no existing value
 *
 * All functions are pure — same input → same output. No LLM, no side effects.
 */

import { ConversationState, ExtractedFieldProposal, StateSlot, TurnInterpretation } from '../types';
import { mergeWithConflictDetection } from './field-memory';
import { confirmField, rejectFieldValue } from './field-memory';

// ──────────────────────────────────────────────────────────────────
// Main application function
// ──────────────────────────────────────────────────────────────────

/**
 * Apply a set of field proposals to the conversation state.
 *
 * Processing order:
 *   1. YES affirmation + active confirmation queue → confirmField() on queue head
 *   2. NO affirmation + active confirmation queue → rejectFieldValue() on queue head
 *   3. Correction proposals → direct overwrite with needsConfirmation=true
 *   4. Direct/volunteered proposals → mergeWithConflictDetection
 *   5. Inferred proposals → only apply if field has no existing value
 *
 * @param state          Current conversation state (before slot mutation)
 * @param proposals      Proposals from buildFieldProposals / interpretTurn
 * @param interpretation Full turn interpretation (for affirmation signals)
 * @returns              New ConversationState with proposals applied
 */
export function applyFieldProposalsToState(
  state: ConversationState,
  proposals: ExtractedFieldProposal[],
  interpretation: TurnInterpretation,
): ConversationState {
  let s = state;

  // ── 1. Affirmation handling: drain confirmation queue ──────────
  if (s.confirmationQueue && s.confirmationQueue.length > 0) {
    const topField = s.confirmationQueue[0];

    if (interpretation.affirmations.yes) {
      // Caller confirmed the top-of-queue field
      s = confirmField(s, topField);
    } else if (interpretation.affirmations.no && !interpretation.correctionSignals) {
      // Caller rejected the top-of-queue field (no correction present)
      s = rejectFieldValue(s, topField);
    }
    // If correctionSignals is also set, the correction proposal below handles it

  // ── 1b. Fallback: use lastConfirmationTarget when queue is empty ─
  // Handles fields the planner asked to confirm that didn't independently
  // qualify for the confirmation queue (e.g. non-required optional fields,
  // or planner-driven confirm for fields at edge-case confidence levels).
  } else if (s.lastConfirmationTarget) {
    const fallbackField = s.lastConfirmationTarget;
    const slot = s.slots[fallbackField];
    // Only apply if the slot still has a value to confirm (not already cleared)
    if (slot?.value !== null && slot?.value !== undefined) {
      if (interpretation.affirmations.yes) {
        s = confirmField(s, fallbackField);
      } else if (interpretation.affirmations.no && !interpretation.correctionSignals) {
        s = rejectFieldValue(s, fallbackField);
      }
    }
  }

  // ── 2. Corrections: direct overwrite ──────────────────────────
  const corrections = proposals.filter((p) => p.evidenceType === 'correction');
  for (const proposal of corrections) {
    const correctionSlot: StateSlot = {
      value: proposal.normalizedValue,
      confidence: Math.max(proposal.confidenceScore, 0.70),
      source: 'caller',
      updatedAt: new Date().toISOString(),
      // Require confirmation since caller is overriding a prior value
      needsConfirmation: true,
      conflictFlag: false,
    };
    s = {
      ...s,
      slots: { ...s.slots, [proposal.fieldKey]: correctionSlot },
    };
  }

  // ── 3. Direct and volunteered proposals ───────────────────────
  const directProposals = proposals.filter(
    (p) =>
      p.shouldApplyDirectly &&
      p.evidenceType !== 'correction' &&
      p.evidenceType !== 'inferred',
  );

  if (directProposals.length > 0) {
    const incomingSlots: Record<string, StateSlot> = {};
    for (const proposal of directProposals) {
      incomingSlots[proposal.fieldKey] = {
        value: proposal.normalizedValue,
        confidence: proposal.confidenceScore,
        source: 'caller',
        updatedAt: new Date().toISOString(),
        needsConfirmation: proposal.requiresConfirmation,
      };
    }
    const { slots: mergedSlots } = mergeWithConflictDetection(s.slots, incomingSlots);
    s = { ...s, slots: mergedSlots };
  }

  // ── 4. Inferred proposals: only if field is empty ─────────────
  const inferredProposals = proposals.filter((p) => p.evidenceType === 'inferred');
  for (const proposal of inferredProposals) {
    const existing = s.slots[proposal.fieldKey];
    if (!existing?.value) {
      s = {
        ...s,
        slots: {
          ...s.slots,
          [proposal.fieldKey]: {
            value: proposal.normalizedValue,
            confidence: proposal.confidenceScore,
            source: 'caller',
            updatedAt: new Date().toISOString(),
            needsConfirmation: true,
          },
        },
      };
    }
  }

  return s;
}
