/**
 * Repair strategy selection.
 *
 * Chooses how Avery should adapt its conversational behavior based on
 * signals in the current state. Checked in priority order — most severe
 * signals are handled first.
 *
 * Strategies (from Prompt 1 types):
 *   clarify              — ask for clarification on a specific point
 *   slow_down            — let caller finish, reduce pace
 *   reassure_then_ask    — acknowledge distress before asking
 *   summarize_and_confirm — recap known facts before asking
 *   offer_examples       — give a concrete example to guide caller
 *   handoff              — transfer to human staff
 */

import { ConversationState, RepairStrategy } from '../types';

/**
 * Select the appropriate repair strategy for the current conversation state.
 * Returns a RepairStrategy value — always returns one, never throws.
 */
export function selectRepairStrategy(state: ConversationState): RepairStrategy {
  const {
    emotionalState,
    urgencyLevel,
    confidenceScore,
    interruptionCount,
    silenceEvents,
    transferRecommended,
    riskFlags,
    matterType,
    turnCount,
  } = state;

  // ── Highest priority: transfer/safety ──────────────────────────
  if (riskFlags.includes('caller_safety_concern') || transferRecommended) {
    return 'handoff';
  }

  // ── Emotional state — most severe states drive repair ──────────

  // Distressed or overwhelmed: reassure before asking anything
  if (emotionalState === 'distressed' || emotionalState === 'overwhelmed') {
    return 'reassure_then_ask';
  }

  // Angry: keep it controlled, summarize to re-anchor
  if (emotionalState === 'angry') {
    return 'summarize_and_confirm';
  }

  // Confused: summarize if we have enough to summarize, else offer examples
  if (emotionalState === 'confused') {
    return confidenceScore >= 0.35 ? 'summarize_and_confirm' : 'offer_examples';
  }

  // ── Disruption signals ─────────────────────────────────────────

  // Repeated interruptions: back off, let caller speak
  if (interruptionCount >= 3) {
    return 'slow_down';
  }

  // Multiple silences: caller may be uncertain — give them an example
  if (silenceEvents >= 3) {
    return 'offer_examples';
  }

  // ── Confidence / clarity signals ──────────────────────────────

  // Very low confidence after several turns: need to clarify what's happening
  if (confidenceScore < 0.25 && turnCount >= 3 && matterType !== 'unknown') {
    return 'clarify';
  }

  // Matter type still unknown after 4+ turns: summarize what we do know
  if (matterType === 'unknown' && turnCount >= 4) {
    return 'summarize_and_confirm';
  }

  // ── Default ────────────────────────────────────────────────────
  // Neutral baseline — proceed with a clarifying question
  return 'clarify';
}
