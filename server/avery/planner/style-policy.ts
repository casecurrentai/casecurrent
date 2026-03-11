/**
 * Style policy — maps conversation state to conversational style parameters.
 *
 * Produces StyleParams (defined in types/index.ts) that flow into ResponsePlan.style.
 *
 * Dimensions:
 *   warmth     — how empathetic/warm the response feels
 *   pace       — how quickly/densely information is delivered
 *   directness — how much Avery leads vs. follows the caller
 *
 * Key principle: emotional state and urgency affect different dimensions.
 *   - Distressed → high warmth, slow pace
 *   - Calm + critical deadline → medium warmth, fast pace
 *   - Confused → high warmth, slow pace, low directness
 *   - Angry → controlled directness, medium warmth (not cold, not slow)
 *
 * Reuses: StyleParams from types/index.ts
 */

import { ConversationState, StyleParams } from '../types';

/** Derive conversational style from current conversation state. */
export function deriveStyle(state: ConversationState): StyleParams {
  const { emotionalState, urgencyLevel, callerIntent, agentMode } = state;

  // Demo mode: friendly, informative, not rushed
  if (agentMode === 'demo') {
    return { warmth: 'high', pace: 'medium', directness: 'medium' };
  }

  // Non-intake callers: efficient and polite
  if (
    callerIntent === 'wrong_number' ||
    callerIntent === 'vendor' ||
    callerIntent === 'opposing_party'
  ) {
    return { warmth: 'medium', pace: 'fast', directness: 'high' };
  }

  // Existing client — warmer, moderate pace (they know us)
  if (callerIntent === 'existing_client') {
    return { warmth: 'high', pace: 'medium', directness: 'high' };
  }

  // ── Emotional state is the primary driver ──────────────────────

  switch (emotionalState) {
    case 'distressed':
      // Slow down, lead with warmth, ease into questions
      return { warmth: 'high', pace: 'slow', directness: 'low' };

    case 'overwhelmed':
      // Same as distressed — caller needs space
      return { warmth: 'high', pace: 'slow', directness: 'low' };

    case 'anxious':
      // Reassuring pace — not too fast, steady and warm
      return { warmth: 'high', pace: 'medium', directness: 'medium' };

    case 'angry':
      // Do not mirror anger — be controlled, direct, professional
      // Warmth medium (not cold), directness high (show competence)
      return { warmth: 'medium', pace: 'medium', directness: 'high' };

    case 'confused':
      // Slow down, high warmth, low directness — follow their pace
      return { warmth: 'high', pace: 'slow', directness: 'low' };

    case 'urgent':
      // They want quick action — match their energy
      return { warmth: 'medium', pace: 'fast', directness: 'high' };

    case 'calm':
      // Urgency still affects pace even for calm callers
      if (urgencyLevel === 'critical') {
        return { warmth: 'medium', pace: 'fast', directness: 'high' };
      }
      if (urgencyLevel === 'high') {
        return { warmth: 'medium', pace: 'medium', directness: 'high' };
      }
      return { warmth: 'medium', pace: 'medium', directness: 'high' };

    default:
      // Unknown emotional state: fall back to urgency-based style
      if (urgencyLevel === 'critical') {
        return { warmth: 'medium', pace: 'fast', directness: 'high' };
      }
      if (urgencyLevel === 'high') {
        return { warmth: 'medium', pace: 'medium', directness: 'high' };
      }
      return { warmth: 'medium', pace: 'medium', directness: 'medium' };
  }
}
