/**
 * Next-question selector.
 *
 * Chooses the single highest-value question to ask next, based on:
 * - Current intake stage
 * - Matter type
 * - Missing required fields (from state)
 * - Urgency level (urgent fields get priority)
 * - Agent mode (demo vs production)
 * - What is already gathered
 *
 * Returns exactly one question per call — never compound questions.
 * Deterministic: same state → same question.
 *
 * Reuses: ConversationState, IntakeStage from types/index.ts
 */

import { ConversationState, NextQuestionDecision, IntakeReadiness } from '../types';

export interface NextQuestion {
  /** The slot key being targeted, or null for stage-level questions. */
  slotKey: string | null;
  /** The question text to present to the caller. */
  question: string;
  /** Debug rationale — explains why this question was selected. */
  rationale: string;
}

// ──────────────────────────────────────────────────────────────────
// Question bank by slot key
// ──────────────────────────────────────────────────────────────────

const SLOT_QUESTIONS: Record<string, string> = {
  // Universal
  caller_name: "Can I start with your name?",
  callback_number: "What's the best phone number to reach you?",
  email: "Do you have an email address I can note down?",
  preferred_contact_method: "What's the best way to follow up with you — phone, email, or text?",
  short_matter_summary: "Can you briefly describe the situation you're dealing with?",
  opposing_party: "Do you know the name of the other party involved?",
  represented_already: "Are you currently working with another attorney on this matter?",
  incident_date: "Do you know approximately when this happened?",
  incident_location: "Where did this take place?",
  urgency_notes: "Are there any upcoming court dates or filing deadlines I should be aware of?",

  // Personal injury
  injury_type: "What type of injuries did you sustain?",
  medical_treatment: "Have you received any medical treatment or seen a doctor?",
  insurance_involved: "Do you know the other party's insurance carrier?",
  police_report: "Was a police report filed?",
  vehicle_involved: "Was this a motor vehicle accident?",

  // Employment
  employer_name: "What's the name of your employer?",
  job_status: "Are you still employed there, or were you terminated?",
  discrimination_or_retaliation:
    "Was this a situation involving discrimination, harassment, or retaliation?",
  termination_date: "When did this happen?",

  // Family
  family_matter_category:
    "Is this regarding a divorce, child custody, support, or another family matter?",
  children_involved: "Are there any minor children involved?",
  court_dates: "Do you have any upcoming court dates already scheduled?",

  // Criminal
  charges_known: "Do you know what charges were filed?",
  arrest_date: "When did the arrest take place?",
  custody_status: "Is the person currently in custody?",
  court_date: "Is there an arraignment or court date already scheduled?",

  // Estate
  deceased_or_living:
    "Is this estate planning for yourself, or has someone recently passed away?",
  will_exists: "Is there a will involved?",
  probate_status: "Has probate been opened?",
};

// Stage-level questions (no specific slot — drive the conversation forward)
const STAGE_QUESTIONS: Partial<Record<string, string>> = {
  opening:
    "Hello, I'm Avery. I help with legal intake at this firm. How can I help you today?",
  intent_detection:
    "Can you tell me a bit about what brings you to us today?",
  matter_classification:
    "To make sure I connect you with the right team — can you tell me more about the situation?",
  eligibility_screening:
    "I want to make sure we can help with your situation. Can you share a bit more about what happened?",
  conflict_check_prep:
    "Before we wrap up, do you know the full name of any other parties involved?",
  appointment_or_transfer:
    "Based on what you've shared, I'd like to connect you with one of our attorneys. Would you like to schedule a free consultation?",
  wrap_up:
    "Thank you for calling. Is there anything else I can help you with today?",
};

// Slots that are considered "urgent" — should be asked first when urgency is high/critical
const URGENT_PRIORITY_SLOTS = new Set([
  'court_date',
  'custody_status',
  'charges_known',
  'arrest_date',
  'urgency_notes',
]);

// ──────────────────────────────────────────────────────────────────
// 3C: Repair strategies that indicate active repair mode
// ──────────────────────────────────────────────────────────────────

const ACTIVE_REPAIR_STRATEGIES = new Set([
  'reassure_then_ask',
  'summarize_and_confirm',
  'offer_examples',
  'slow_down',
]);

// ──────────────────────────────────────────────────────────────────
// Main selector
// ──────────────────────────────────────────────────────────────────

/**
 * Select the highest-value next question for Avery to ask.
 *
 * Priority:
 *   1. Stage-level question for opening / intent_detection
 *   2. Urgent-priority missing slot when urgency is high/critical
 *   3. caller_name first (personalization)
 *   4. First missing required field for the matter type
 *   5. callback_number if not yet gathered
 *   6. Stage-level fallback
 */
export function selectNextQuestion(state: ConversationState): NextQuestion {
  const {
    intakeStage,
    matterType,
    missingRequiredFields,
    urgencyLevel,
    agentMode,
    slots,
  } = state;

  // ── Demo mode: just get contact ────────────────────────────────
  if (agentMode === 'demo') {
    if (!slots['callback_number']?.value) {
      return {
        slotKey: 'callback_number',
        question: SLOT_QUESTIONS['callback_number'],
        rationale: 'demo_mode: capture contact info',
      };
    }
    return {
      slotKey: null,
      question: "Is there anything else about CaseCurrent you'd like to know?",
      rationale: 'demo_mode: contact captured, open Q&A',
    };
  }

  // ── Terminal stage ─────────────────────────────────────────────
  if (intakeStage === 'wrap_up') {
    return {
      slotKey: null,
      question: STAGE_QUESTIONS['wrap_up']!,
      rationale: 'terminal stage',
    };
  }

  // ── Stages with fixed stage-level questions ────────────────────
  if (intakeStage === 'opening') {
    return {
      slotKey: null,
      question: STAGE_QUESTIONS['opening']!,
      rationale: 'opening stage — greet and open',
    };
  }

  if (intakeStage === 'intent_detection') {
    return {
      slotKey: null,
      question: STAGE_QUESTIONS['intent_detection']!,
      rationale: 'intent_detection — understand reason for call',
    };
  }

  if (intakeStage === 'matter_classification') {
    return {
      slotKey: null,
      question: STAGE_QUESTIONS['matter_classification']!,
      rationale: `matter_classification: matterType=${matterType}`,
    };
  }

  if (intakeStage === 'eligibility_screening') {
    return {
      slotKey: null,
      question: STAGE_QUESTIONS['eligibility_screening']!,
      rationale: 'eligibility_screening stage',
    };
  }

  // ── Contact capture ────────────────────────────────────────────
  if (intakeStage === 'contact_capture') {
    if (!slots['callback_number']?.value) {
      return {
        slotKey: 'callback_number',
        question: SLOT_QUESTIONS['callback_number'],
        rationale: 'contact_capture: need phone',
      };
    }
    if (!slots['email']?.value) {
      return {
        slotKey: 'email',
        question: SLOT_QUESTIONS['email'],
        rationale: 'contact_capture: need email',
      };
    }
    // Contact captured — planner should have advanced stage
    return {
      slotKey: null,
      question: STAGE_QUESTIONS['conflict_check_prep']!,
      rationale: 'contact_capture: contact gathered, moving forward',
    };
  }

  // ── Conflict check ─────────────────────────────────────────────
  if (intakeStage === 'conflict_check_prep') {
    if (!slots['opposing_party']?.value) {
      return {
        slotKey: 'opposing_party',
        question: SLOT_QUESTIONS['opposing_party'],
        rationale: 'conflict_check_prep: need opposing party name',
      };
    }
    return {
      slotKey: null,
      question: STAGE_QUESTIONS['conflict_check_prep']!,
      rationale: 'conflict_check_prep: opposing party gathered',
    };
  }

  // ── Appointment / transfer ─────────────────────────────────────
  if (intakeStage === 'appointment_or_transfer') {
    return {
      slotKey: null,
      question: STAGE_QUESTIONS['appointment_or_transfer']!,
      rationale: 'appointment_or_transfer stage',
    };
  }

  // ── Fact collection: choose from missing required fields ───────
  if (missingRequiredFields.length > 0) {
    // High/critical urgency: ask urgent-priority fields first
    if (urgencyLevel === 'critical' || urgencyLevel === 'high') {
      const urgentMissing = missingRequiredFields.find((f) => URGENT_PRIORITY_SLOTS.has(f));
      if (urgentMissing) {
        return {
          slotKey: urgentMissing,
          question:
            SLOT_QUESTIONS[urgentMissing] ??
            `Can you tell me about ${urgentMissing.replace(/_/g, ' ')}?`,
          rationale: `urgent_priority: ${urgentMissing} (urgency=${urgencyLevel})`,
        };
      }
    }

    // Ask caller_name first for personalization (if not yet known)
    if (missingRequiredFields.includes('caller_name')) {
      return {
        slotKey: 'caller_name',
        question: SLOT_QUESTIONS['caller_name'],
        rationale: 'missing_required: caller_name (personalization)',
      };
    }

    // Take the first missing required field
    const first = missingRequiredFields[0];
    return {
      slotKey: first,
      question:
        SLOT_QUESTIONS[first] ?? `Can you tell me about ${first.replace(/_/g, ' ')}?`,
      rationale: `missing_required: ${first}`,
    };
  }

  // ── All required fields filled — capture contact if missing ────
  if (!slots['callback_number']?.value) {
    return {
      slotKey: 'callback_number',
      question: SLOT_QUESTIONS['callback_number'],
      rationale: 'required_filled: capturing phone for follow-up',
    };
  }

  // ── Fallback: stage-level question ────────────────────────────
  const stageQ = STAGE_QUESTIONS[intakeStage];
  return {
    slotKey: null,
    question:
      stageQ ??
      "Is there anything else you'd like to share before I connect you with one of our attorneys?",
    rationale: `stage_fallback: ${intakeStage}`,
  };
}

// ──────────────────────────────────────────────────────────────────
// 3C: Structured decision converter
// ──────────────────────────────────────────────────────────────────

/**
 * Convert a NextQuestion + conversation context into a NextQuestionDecision.
 *
 * The decision type is determined deterministically:
 *   escalate → escalation policy triggered (highest priority)
 *   complete → wrap_up stage or intake completed
 *   repair   → active repair strategy AND same field as lastQuestionAsked
 *   confirm  → field has a value but low confidence (< 0.60)
 *   ask      → normal question progression
 *
 * This output drives ResponsePlan generation without any LLM involvement.
 */
export function nextQuestionToDecision(
  nextQuestion: NextQuestion,
  state: ConversationState,
  readiness: IntakeReadiness,
  escalationNeeded: boolean,
): NextQuestionDecision {
  // ── Escalation: highest priority override ──────────────────────
  if (escalationNeeded) {
    return {
      type: 'escalate',
      targetField: null,
      objective: 'transfer_to_human',
      rationale: 'escalation policy triggered',
      repairStrategy: null,
    };
  }

  // ── Completed ──────────────────────────────────────────────────
  if (readiness === 'completed' || state.intakeStage === 'wrap_up') {
    return {
      type: 'complete',
      targetField: null,
      objective: 'end_conversation',
      rationale: 'intake completed and conversation wrapped up',
      repairStrategy: null,
    };
  }

  // ── Repair mode: active repair strategy + same field targeted ──
  // We are in repair when the repair strategy is non-trivial AND
  // we are still asking about the same field that failed last turn.
  const isRepairActive = ACTIVE_REPAIR_STRATEGIES.has(state.repairStrategy);
  const isSameField =
    nextQuestion.slotKey !== null &&
    nextQuestion.slotKey === state.lastQuestionAsked;

  if (isRepairActive && isSameField) {
    return {
      type: 'repair',
      targetField: nextQuestion.slotKey,
      objective: nextQuestion.slotKey
        ? `repair_field:${nextQuestion.slotKey}`
        : 'repair_conversation',
      rationale: `${state.repairStrategy} on ${nextQuestion.slotKey ?? 'previous_question'}`,
      repairStrategy: state.repairStrategy,
    };
  }

  // ── 3D: Drain confirmation queue first ────────────────────────
  // The confirmation queue (computed by field-memory) takes priority over normal
  // question progression. Any field in the queue — whether conflicting or low-confidence
  // required — must be confirmed before moving on.
  if (state.confirmationQueue && state.confirmationQueue.length > 0) {
    const topField = state.confirmationQueue[0];
    const slot = state.slots[topField];
    const conflictNote = slot?.conflictFlag
      ? 'conflicting values detected'
      : `low confidence (${slot?.confidence?.toFixed(2) ?? '?'})`;
    return {
      type: 'confirm',
      targetField: topField,
      objective: `confirm_field:${topField}`,
      rationale: `confirmation queue: "${topField}" requires verification (${conflictNote})`,
      repairStrategy: null,
    };
  }

  // ── Fallback confirm: field has a value but confidence is low ──
  // Do not re-ask for missing fields as confirmations.
  if (nextQuestion.slotKey) {
    const existingSlot = state.slots[nextQuestion.slotKey];
    if (
      existingSlot?.value !== null &&
      existingSlot?.value !== undefined &&
      existingSlot.confidence > 0 &&
      existingSlot.confidence < 0.60
    ) {
      return {
        type: 'confirm',
        targetField: nextQuestion.slotKey,
        objective: `confirm_field:${nextQuestion.slotKey}`,
        rationale: `low field confidence (${existingSlot.confidence.toFixed(2)}) — verify with caller`,
        repairStrategy: null,
      };
    }
  }

  // ── Normal ask ────────────────────────────────────────────────
  return {
    type: 'ask',
    targetField: nextQuestion.slotKey,
    objective: nextQuestion.slotKey
      ? `collect_field:${nextQuestion.slotKey}`
      : `stage_action:${state.intakeStage}`,
    rationale: nextQuestion.rationale,
    repairStrategy: null,
  };
}
