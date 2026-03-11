/**
 * Dialogue planner — the main entry point for turn-by-turn response planning.
 *
 * Takes a ConversationState (already updated via applyTurnToState) and
 * returns a PlannerResult with the ResponsePlan and escalation decision.
 *
 * Pipeline:
 *   1. evaluateEscalation  — should we transfer?
 *   2. deriveStyle         — how should we sound?
 *   3. selectNextQuestion  — what should we ask?
 *   4. buildResponsePlan   — assemble the ResponsePlan
 *
 * Reuses all Prompt 1 types; reuses Prompt 2 sub-modules.
 */

import { ConversationState, ResponsePlan } from '../types';
import { evaluateEscalation, EscalationDecision } from './escalation-policy';
import { deriveStyle } from './style-policy';
import { selectNextQuestion, NextQuestion } from './question-selector';
import { buildResponsePlan } from './response-plan';

export interface PlannerResult {
  /** The structured response plan for this turn. */
  plan: ResponsePlan;
  /** True if the planner recommends immediate or scheduled escalation. */
  escalate: boolean;
  /** Transfer routing hint (on_call_attorney, staff, etc.), or null. */
  transferTarget: string | null;
  /** Debug information for inspectability and logging. */
  debugInfo: {
    stage: string;
    matterType: string;
    urgencyLevel: string;
    emotionalState: string;
    repairStrategy: string;
    nextQuestion: string;
    nextQuestionSlot: string | null;
    confidenceScore: number;
    missingFields: string[];
    escalationUrgency: string;
  };
}

/**
 * Generate a ResponsePlan from the current conversation state.
 *
 * This function is pure — it reads state but does not mutate it.
 * Call applyTurnToState() first to update state from the caller's utterance,
 * then call generateResponsePlan() to decide what to do next.
 */
export function generateResponsePlan(state: ConversationState): PlannerResult {
  // 1. Escalation check — highest priority override
  const escalation: EscalationDecision = evaluateEscalation(state);

  // 2. Derive style from state
  const style = deriveStyle(state);

  // 3. Select next question
  const nextQuestion: NextQuestion = selectNextQuestion(state);

  // 4. Assemble ResponsePlan
  const plan = buildResponsePlan({ state, nextQuestion, escalation, style });

  return {
    plan,
    escalate: escalation.shouldEscalate,
    transferTarget: escalation.transferTarget,
    debugInfo: {
      stage: state.intakeStage,
      matterType: state.matterType,
      urgencyLevel: state.urgencyLevel,
      emotionalState: state.emotionalState,
      repairStrategy: state.repairStrategy,
      nextQuestion: nextQuestion.question,
      nextQuestionSlot: nextQuestion.slotKey,
      confidenceScore: state.confidenceScore,
      missingFields: state.missingRequiredFields,
      escalationUrgency: escalation.urgency,
    },
  };
}

// Re-export for convenient single-import usage
export type { EscalationDecision, NextQuestion };
