/**
 * ResponsePlan builder.
 *
 * Takes state, question selection, escalation decision, and style parameters
 * and assembles a clean ResponsePlan (defined in types/index.ts).
 *
 * The ResponsePlan is the structured contract between the planner and
 * the renderer — it describes WHAT Avery should do next, not HOW the
 * LLM should word it (that's the renderer's job).
 *
 * Reuses: ResponsePlan, RepairStrategy, StyleParams from types/index.ts
 */

import { ConversationState, ResponsePlan } from '../types';
import type { NextQuestion } from './question-selector';
import type { EscalationDecision } from './escalation-policy';
import type { StyleParams } from '../types';

export interface BuildResponsePlanParams {
  state: ConversationState;
  nextQuestion: NextQuestion;
  escalation: EscalationDecision;
  style: StyleParams;
}

// ──────────────────────────────────────────────────────────────────
// Acknowledgment text by emotional state
// ──────────────────────────────────────────────────────────────────

const ACKNOWLEDGMENTS: Partial<Record<string, string>> = {
  distressed: "I'm really sorry to hear you're going through this.",
  overwhelmed:
    "I understand this feels like a lot right now. I'm here to help you through it step by step.",
  anxious: "I understand you're worried — we'll work through this together.",
  angry:
    "I hear your frustration, and I want to make sure we address your situation properly.",
  confused: "Let me see if I can make this a bit clearer for you.",
};

// ──────────────────────────────────────────────────────────────────
// Builder
// ──────────────────────────────────────────────────────────────────

/**
 * Build a ResponsePlan from state, question, escalation, and style.
 * Pure function — no side effects.
 */
export function buildResponsePlan(params: BuildResponsePlanParams): ResponsePlan {
  const { state, nextQuestion, escalation, style } = params;
  const { repairStrategy, emotionalState, matterType, intakeStage, urgencyLevel, callerName } =
    state;

  // ── Next objective ─────────────────────────────────────────────
  let nextObjective: string;
  if (escalation.shouldEscalate) {
    nextObjective =
      escalation.urgency === 'immediate' ? 'escalate_immediately' : 'recommend_escalation';
  } else if (nextQuestion.slotKey) {
    nextObjective = `collect_slot:${nextQuestion.slotKey}`;
  } else {
    nextObjective = `stage_action:${intakeStage}`;
  }

  // ── Acknowledgment ────────────────────────────────────────────
  const acknowledge = ACKNOWLEDGMENTS[emotionalState];

  // ── Summarize (repair strategies that need a recap) ───────────
  let summarize: string | undefined;
  if (
    repairStrategy === 'summarize_and_confirm' ||
    (repairStrategy === 'clarify' && state.turnCount >= 5 && matterType !== 'unknown')
  ) {
    const parts: string[] = [];
    if (callerName) parts.push(`you're ${callerName}`);
    if (matterType !== 'unknown') {
      parts.push(`calling about a ${matterType.replace(/_/g, ' ')} matter`);
    }
    const dateSlot = state.slots['incident_date']?.value;
    if (dateSlot) parts.push(`incident date around ${dateSlot}`);
    if (parts.length >= 2) {
      summarize = `Just to confirm what I have so far: ${parts.join(', ')}.`;
    }
  }

  // ── Constraints ───────────────────────────────────────────────
  const constraints: string[] = [
    'Do not provide legal advice or express opinions on the merits of the case',
    'Do not make commitments about outcomes or compensation',
    'Ask only one question at a time',
  ];
  if (state.agentMode === 'demo') {
    constraints.push('This is a product demonstration — focus on CaseCurrent capabilities');
  }

  // ── Guidance ──────────────────────────────────────────────────
  const guidance: string[] = [];

  if (style.pace === 'slow') {
    guidance.push('Speak slowly and clearly — do not rush the caller');
  }
  if (style.warmth === 'high') {
    guidance.push('Lead with empathy before transitioning to the question');
  }
  if (repairStrategy === 'offer_examples') {
    guidance.push(
      'Offer a concrete example to help the caller understand what information to share',
    );
  }
  if (repairStrategy === 'summarize_and_confirm') {
    guidance.push('Recap what you know before asking the next question');
  }
  if (repairStrategy === 'slow_down') {
    guidance.push('Pause and let the caller finish speaking before responding');
  }
  if (urgencyLevel === 'critical') {
    guidance.push('This matter is time-sensitive — move efficiently toward scheduling or transfer');
  }
  if (escalation.shouldEscalate) {
    guidance.push(`Escalation needed: ${escalation.reason ?? 'see escalation policy'}`);
  }
  if (nextQuestion.slotKey) {
    guidance.push(
      `Target: collect "${nextQuestion.slotKey}" — rationale: ${nextQuestion.rationale}`,
    );
  }

  // ── Transfer / end conversation ───────────────────────────────
  const shouldEnd = intakeStage === 'wrap_up';
  const transferTarget =
    escalation.transferTarget ?? state.transferTarget ?? undefined;

  return {
    nextObjective,
    askFor: nextQuestion.question,
    acknowledge,
    summarize,
    style,
    constraints,
    guidance,
    repairStrategy,
    collectSlots: nextQuestion.slotKey ? [nextQuestion.slotKey] : [],
    transferTarget: transferTarget ?? undefined,
    endConversation: shouldEnd,
  };
}
