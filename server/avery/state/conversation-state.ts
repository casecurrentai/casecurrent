/**
 * Conversation state lifecycle utilities.
 *
 * Handles initialization and slot merging for ConversationState.
 * Does not run detectors — that responsibility belongs to state-updater.ts.
 *
 * Reuses types from Prompt 1: ConversationState, StateSlot (types/index.ts)
 */

import { ConversationState, StateSlot } from '../types';

// ──────────────────────────────────────────────────────────────────
// Initialization
// ──────────────────────────────────────────────────────────────────

export interface InitStateParams {
  conversationId: string;
  callId?: string | null;
  agentMode?: 'demo' | 'production';
  callerPhone?: string | null;
  language?: string;
}

/** Initialize a blank ConversationState at the start of a call. */
export function initializeConversationState(params: InitStateParams): ConversationState {
  const now = new Date().toISOString();

  // Pre-populate callback_number slot from inbound phone number if available
  const slots: Record<string, StateSlot> = {};
  if (params.callerPhone) {
    slots['callback_number'] = {
      value: params.callerPhone,
      confidence: 0.95,
      source: 'system',
      updatedAt: now,
    };
  }

  return {
    conversationId: params.conversationId,
    callId: params.callId ?? undefined,
    agentMode: params.agentMode ?? 'production',
    callerName: null,
    phone: params.callerPhone ?? null,
    email: null,
    language: params.language ?? 'en',
    callerIntent: 'unknown',
    matterType: 'unknown',
    emotionalState: 'unknown',
    urgencyLevel: 'low',
    intakeStage: 'opening',
    repairStrategy: 'clarify',
    slots,
    goalsCompleted: [],
    missingRequiredFields: [],
    confidenceScore: 0,
    riskFlags: [],
    transferRecommended: false,
    transferTarget: null,
    interruptionCount: 0,
    silenceEvents: 0,
    turnCount: 0,
    summarySoFar: '',
    lastUserUtterance: null,
    lastAssistantUtterance: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ──────────────────────────────────────────────────────────────────
// Slot merging
// ──────────────────────────────────────────────────────────────────

/**
 * Merge incoming slot evidence into existing slots.
 *
 * Rules:
 * - A new slot with a non-null value always beats an existing null-value slot.
 * - Otherwise, higher confidence wins.
 * - Never downgrades an existing slot.
 */
export function mergeSlotEvidence(
  existing: Record<string, StateSlot>,
  incoming: Record<string, StateSlot>,
): Record<string, StateSlot> {
  const merged: Record<string, StateSlot> = { ...existing };

  for (const [key, incomingSlot] of Object.entries(incoming)) {
    const existingSlot = merged[key];
    if (
      !existingSlot ||
      existingSlot.value === null ||
      incomingSlot.confidence > existingSlot.confidence
    ) {
      merged[key] = incomingSlot;
    }
  }

  return merged;
}

// ──────────────────────────────────────────────────────────────────
// Derived field sync
// ──────────────────────────────────────────────────────────────────

/**
 * If a caller_name slot was extracted with reasonable confidence,
 * sync it to the top-level callerName field (for use in personalized responses).
 */
export function syncCallerNameFromSlots(state: ConversationState): ConversationState {
  const nameSlot = state.slots['caller_name'];
  if (
    nameSlot &&
    nameSlot.value !== null &&
    typeof nameSlot.value === 'string' &&
    nameSlot.value.trim().length > 0 &&
    nameSlot.confidence >= 0.5 &&
    !state.callerName
  ) {
    return { ...state, callerName: nameSlot.value as string };
  }
  return state;
}
