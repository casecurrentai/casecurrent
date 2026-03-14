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

import { ConversationState, ResponsePlan, NextQuestionDecision, IntakeReadiness } from '../types';
import { evaluateEscalation, EscalationDecision } from './escalation-policy';
import { deriveStyle } from './style-policy';
import { selectNextQuestion, nextQuestionToDecision, NextQuestion } from './question-selector';
import { buildResponsePlan } from './response-plan';
import { evaluateIntakeReadiness } from './readiness';
import { determineRepairNeed, RepairDecision } from '../state/repair-decision';

export interface PlannerResult {
  /** The structured response plan for this turn. */
  plan: ResponsePlan;
  /** True if the planner recommends immediate or scheduled escalation. */
  escalate: boolean;
  /** Transfer routing hint (on_call_attorney, staff, etc.), or null. */
  transferTarget: string | null;
  /** 3C: Structured question decision — type, objective, rationale, repair. */
  decision: NextQuestionDecision;
  /** 3C: Intake readiness — how complete the current intake is. */
  readiness: IntakeReadiness;
  /** 3D: Semantic repair analysis for the last caller turn. */
  repairDecision: RepairDecision;
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
    decisionType: string;
    readiness: string;
    repairNeeded: boolean;
    repairType: string;
    confirmationQueue: string[];
    conversationPhase: string;
    /** 3E: Structured interpretation of the last caller turn. */
    lastTurnInterpretation: import('../types').TurnInterpretation | null;
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

  // 4. 3C: Evaluate intake readiness
  const readiness: IntakeReadiness = evaluateIntakeReadiness(state);

  // 5. 3C: Convert to structured decision
  const decision: NextQuestionDecision = nextQuestionToDecision(
    nextQuestion,
    state,
    readiness,
    escalation.shouldEscalate,
  );

  // 6. 3D: Semantic repair analysis for the last caller turn
  const repairDecision: RepairDecision = determineRepairNeed(
    state.lastQuestionAsked ?? null,
    state.lastUserUtterance ?? '',
    state,
  );

  // 7. Assemble ResponsePlan (passes decision + readiness for 3C fields)
  const plan = buildResponsePlan({ state, nextQuestion, escalation, style, decision, readiness });

  return {
    plan,
    escalate: escalation.shouldEscalate,
    transferTarget: escalation.transferTarget,
    decision,
    readiness,
    repairDecision,
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
      decisionType: decision.type,
      readiness,
      repairNeeded: repairDecision.needed,
      repairType: repairDecision.repairType,
      confirmationQueue: state.confirmationQueue ?? [],
      conversationPhase: state.conversationPhase ?? 'unknown',
      lastTurnInterpretation: state.lastTurnInterpretation ?? null,
    },
  };
}

// Re-export for convenient single-import usage
export type { EscalationDecision, NextQuestion };
export { evaluateIntakeReadiness } from './readiness';
