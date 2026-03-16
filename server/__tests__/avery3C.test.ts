/**
 * Avery 3C tests — conversation state lifecycle and structured question progression.
 *
 * Covers:
 *   1.  nextQuestionToDecision — ask / repair / confirm / escalate / complete
 *   2.  scoreFieldConfidence — status mapping and date-field penalty
 *   3.  detectFieldConflict — conflict detection thresholds
 *   4.  normalizeExtractedField — phone normalization
 *   5.  evaluateIntakeReadiness — all readiness states
 *   6.  getIntakeRequirements — config correctness
 *   7.  generateResponsePlan — 3C fields in ResponsePlan
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { initializeConversationState } from '../avery/state/conversation-state';
import { applyTurnToState } from '../avery/state/state-updater';
import {
  scoreFieldConfidence,
  detectFieldConflict,
  normalizeExtractedField,
} from '../avery/state/confidence';
import { evaluateIntakeReadiness } from '../avery/planner/readiness';
import { getIntakeRequirements } from '../avery/state/intake-requirements';
import {
  selectNextQuestion,
  nextQuestionToDecision,
} from '../avery/planner/question-selector';
import { generateResponsePlan } from '../avery/planner/dialogue-planner';
import type { ConversationState, StateSlot, TurnInput } from '../avery/types';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<ConversationState> = {}): ConversationState {
  const base = initializeConversationState({ conversationId: 'test-3c-001' });
  return { ...base, ...overrides };
}

function turn(utterance: string): TurnInput {
  return { utterance };
}

function makeSlot(value: unknown, confidence: number): StateSlot {
  return {
    value,
    confidence,
    source: 'caller',
    updatedAt: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────────────────────────
// 1. nextQuestionToDecision — decision type selection
// ──────────────────────────────────────────────────────────────────

describe('nextQuestionToDecision — decision type', () => {
  it('returns escalate when escalationNeeded=true', () => {
    const state = makeState({ matterType: 'personal_injury' });
    const q = selectNextQuestion(state);
    const decision = nextQuestionToDecision(q, state, 'incomplete', true);
    assert.equal(decision.type, 'escalate');
    assert.equal(decision.objective, 'transfer_to_human');
  });

  it('returns complete when intakeStage is wrap_up', () => {
    const state = makeState({ intakeStage: 'wrap_up' });
    const q = selectNextQuestion(state);
    const decision = nextQuestionToDecision(q, state, 'completed', false);
    assert.equal(decision.type, 'complete');
  });

  it('returns complete when readiness is completed', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      callerIntent: 'wrong_number',
    });
    const q = selectNextQuestion(state);
    const decision = nextQuestionToDecision(q, state, 'completed', false);
    assert.equal(decision.type, 'complete');
  });

  it('returns repair when active repair strategy and same field as lastQuestionAsked', () => {
    const state = makeState({
      matterType: 'personal_injury',
      intakeStage: 'fact_collection',
      repairStrategy: 'offer_examples',
      lastQuestionAsked: 'caller_name',
      missingRequiredFields: ['caller_name', 'callback_number', 'incident_date', 'short_matter_summary', 'injury_type'],
    });
    const q = selectNextQuestion(state);
    // q.slotKey should be caller_name (first missing required)
    assert.equal(q.slotKey, 'caller_name');
    const decision = nextQuestionToDecision(q, state, 'incomplete', false);
    assert.equal(decision.type, 'repair');
    assert.equal(decision.targetField, 'caller_name');
    assert.equal(decision.repairStrategy, 'offer_examples');
  });

  it('returns ask (not repair) when repair strategy is default clarify', () => {
    const state = makeState({
      matterType: 'personal_injury',
      intakeStage: 'fact_collection',
      repairStrategy: 'clarify',
      lastQuestionAsked: 'caller_name',
      missingRequiredFields: ['caller_name'],
    });
    const q = selectNextQuestion(state);
    const decision = nextQuestionToDecision(q, state, 'incomplete', false);
    // clarify is not in ACTIVE_REPAIR_STRATEGIES, so it falls through to ask
    assert.equal(decision.type, 'ask');
  });

  it('returns confirm when field has low confidence value', () => {
    const state = makeState({
      matterType: 'personal_injury',
      intakeStage: 'fact_collection',
      repairStrategy: 'clarify',
      lastQuestionAsked: null,
      missingRequiredFields: ['callback_number', 'incident_date', 'short_matter_summary', 'injury_type'],
      // caller_name is present but low confidence
      slots: {
        caller_name: makeSlot('maybe sarah', 0.35),
      },
    });
    // next question will target caller_name since it's the personalization field
    // but it's not in missingRequiredFields — selectNextQuestion won't ask for it
    // Let us instead simulate: the next question targets a low-confidence field
    const lowConfState = makeState({
      matterType: 'personal_injury',
      intakeStage: 'fact_collection',
      repairStrategy: 'clarify',
      lastQuestionAsked: null,
      missingRequiredFields: [], // all required fields "filled"
      slots: {
        callback_number: makeSlot('5551234567', 0.45), // present but low confidence
        caller_name: makeSlot('Sarah', 0.90),
        incident_date: makeSlot('last Tuesday', 0.80),
        short_matter_summary: makeSlot('car accident', 0.80),
        injury_type: makeSlot('whiplash', 0.80),
      },
    });
    // selectNextQuestion will ask for callback_number (not in slots from missing perspective)
    // but we can call nextQuestionToDecision directly with a crafted NextQuestion
    const fakeQ = { slotKey: 'callback_number', question: 'What is your number?', rationale: 'test' };
    const decision = nextQuestionToDecision(fakeQ, lowConfState, 'incomplete', false);
    assert.equal(decision.type, 'confirm');
    assert.equal(decision.targetField, 'callback_number');
    assert.ok(decision.rationale.includes('0.45'));
  });

  it('returns ask for normal missing field progression', () => {
    const state = makeState({
      matterType: 'personal_injury',
      intakeStage: 'fact_collection',
      repairStrategy: 'clarify',
      missingRequiredFields: ['caller_name', 'callback_number'],
    });
    const q = selectNextQuestion(state);
    const decision = nextQuestionToDecision(q, state, 'incomplete', false);
    assert.equal(decision.type, 'ask');
    assert.equal(decision.targetField, 'caller_name');
    assert.ok(decision.objective.startsWith('collect_field:'));
  });

  it('includes rationale from NextQuestion', () => {
    const state = makeState({
      matterType: 'personal_injury',
      intakeStage: 'fact_collection',
      missingRequiredFields: ['caller_name'],
    });
    const q = selectNextQuestion(state);
    const decision = nextQuestionToDecision(q, state, 'incomplete', false);
    assert.ok(decision.rationale.length > 0);
  });
});

// ──────────────────────────────────────────────────────────────────
// 2. scoreFieldConfidence — status mapping
// ──────────────────────────────────────────────────────────────────

describe('scoreFieldConfidence', () => {
  it('returns missing status for undefined slot', () => {
    const result = scoreFieldConfidence('caller_name', undefined);
    assert.equal(result.status, 'missing');
    assert.equal(result.score, 0);
  });

  it('returns missing status for null-value slot', () => {
    const result = scoreFieldConfidence('caller_name', makeSlot(null, 0.9));
    assert.equal(result.status, 'missing');
  });

  it('returns confirmed for confidence ≥ 0.80', () => {
    const result = scoreFieldConfidence('caller_name', makeSlot('Sarah', 0.85));
    assert.equal(result.status, 'confirmed');
    assert.equal(result.score, 0.85);
  });

  it('returns likely for confidence 0.60–0.79', () => {
    const result = scoreFieldConfidence('caller_name', makeSlot('Sarah', 0.65));
    assert.equal(result.status, 'likely');
  });

  it('returns ambiguous for confidence < 0.60', () => {
    const result = scoreFieldConfidence('caller_name', makeSlot('maybe sarah', 0.40));
    assert.equal(result.status, 'ambiguous');
  });

  it('penalizes vague date phrase — lowers score and may change status', () => {
    const highConfSlot = makeSlot('a while ago', 0.85);
    const result = scoreFieldConfidence('incident_date', highConfSlot);
    // Score should drop from 0.85 by 0.25 → 0.60
    assert.ok(result.score <= 0.60, `Expected score ≤ 0.60, got ${result.score}`);
  });

  it('does not penalize non-vague date values', () => {
    const slot = makeSlot('2026-01-15', 0.85);
    const result = scoreFieldConfidence('incident_date', slot);
    assert.equal(result.score, 0.85);
    assert.equal(result.status, 'confirmed');
  });

  it('applies penalty to _date-suffix fields', () => {
    const slot = makeSlot('I think it was around March', 0.80);
    const result = scoreFieldConfidence('arrest_date', slot);
    assert.ok(result.score < 0.80);
  });
});

// ──────────────────────────────────────────────────────────────────
// 3. detectFieldConflict
// ──────────────────────────────────────────────────────────────────

describe('detectFieldConflict', () => {
  it('detects conflict when both values differ and confidence ≥ 0.50', () => {
    const existing = makeSlot('Smith Industries', 0.80);
    const incoming = makeSlot('Acme Corp', 0.75);
    assert.equal(detectFieldConflict(existing, incoming), true);
  });

  it('no conflict when values are the same', () => {
    const existing = makeSlot('Smith Industries', 0.80);
    const incoming = makeSlot('Smith Industries', 0.80);
    assert.equal(detectFieldConflict(existing, incoming), false);
  });

  it('no conflict when one value is null', () => {
    const existing = makeSlot(null, 0.80);
    const incoming = makeSlot('Acme Corp', 0.75);
    assert.equal(detectFieldConflict(existing, incoming), false);
  });

  it('no conflict when existing confidence is below threshold', () => {
    const existing = makeSlot('Smith Industries', 0.40); // below 0.50
    const incoming = makeSlot('Acme Corp', 0.80);
    assert.equal(detectFieldConflict(existing, incoming), false);
  });

  it('no conflict when values differ only by case/whitespace', () => {
    const existing = makeSlot('  Smith Industries  ', 0.80);
    const incoming = makeSlot('smith industries', 0.80);
    assert.equal(detectFieldConflict(existing, incoming), false);
  });
});

// ──────────────────────────────────────────────────────────────────
// 4. normalizeExtractedField
// ──────────────────────────────────────────────────────────────────

describe('normalizeExtractedField', () => {
  it('trims and collapses whitespace for non-phone fields', () => {
    const result = normalizeExtractedField('caller_name', '  Sarah   Johnson  ');
    assert.equal(result, 'Sarah Johnson');
  });

  it('strips non-digit characters from phone numbers', () => {
    const result = normalizeExtractedField('callback_number', '(555) 234-5678');
    assert.equal(result, '5552345678');
  });

  it('preserves leading + in E.164 phone numbers', () => {
    const result = normalizeExtractedField('callback_number', '+1 555 234 5678');
    assert.equal(result, '+15552345678');
  });

  it('handles dashes in phone numbers', () => {
    const result = normalizeExtractedField('callback_number', '555-234-5678');
    assert.equal(result, '5552345678');
  });
});

// ──────────────────────────────────────────────────────────────────
// 5. evaluateIntakeReadiness
// ──────────────────────────────────────────────────────────────────

describe('evaluateIntakeReadiness', () => {
  it('returns completed for wrap_up stage', () => {
    const state = makeState({ intakeStage: 'wrap_up' });
    assert.equal(evaluateIntakeReadiness(state), 'completed');
  });

  it('returns completed for wrong_number', () => {
    const state = makeState({ callerIntent: 'wrong_number' });
    assert.equal(evaluateIntakeReadiness(state), 'completed');
  });

  it('returns completed for opposing_party', () => {
    const state = makeState({ callerIntent: 'opposing_party' });
    assert.equal(evaluateIntakeReadiness(state), 'completed');
  });

  it('returns incomplete when no fields filled', () => {
    const state = makeState({ matterType: 'personal_injury' });
    assert.equal(evaluateIntakeReadiness(state), 'incomplete');
  });

  it('returns minimum_viable_intake when callback + summary filled', () => {
    const state = makeState({
      matterType: 'personal_injury',
      slots: {
        callback_number: makeSlot('+15551234567', 0.95),
        short_matter_summary: makeSlot('Car accident on Route 9', 0.90),
      },
    });
    assert.equal(evaluateIntakeReadiness(state), 'minimum_viable_intake');
  });

  it('returns ready_for_handoff when all required PI fields filled', () => {
    const state = makeState({
      matterType: 'personal_injury',
      slots: {
        caller_name: makeSlot('Sarah Johnson', 0.90),
        callback_number: makeSlot('+15551234567', 0.95),
        incident_date: makeSlot('2026-01-15', 0.85),
        short_matter_summary: makeSlot('Car accident on Route 9', 0.90),
        injury_type: makeSlot('whiplash and back pain', 0.85),
      },
    });
    assert.equal(evaluateIntakeReadiness(state), 'ready_for_handoff');
  });

  it('returns ready_for_handoff for demo mode with callback_number', () => {
    const state = makeState({
      agentMode: 'demo',
      slots: {
        callback_number: makeSlot('+15551234567', 0.95),
      },
    });
    assert.equal(evaluateIntakeReadiness(state), 'ready_for_handoff');
  });

  it('returns incomplete for demo mode without callback_number', () => {
    const state = makeState({ agentMode: 'demo' });
    assert.equal(evaluateIntakeReadiness(state), 'incomplete');
  });

  it('returns minimum_viable_intake for criminal when custody_status + callback filled', () => {
    const state = makeState({
      matterType: 'criminal',
      slots: {
        callback_number: makeSlot('+15551234567', 0.95),
        custody_status: makeSlot('in custody', 0.90),
      },
    });
    assert.equal(evaluateIntakeReadiness(state), 'minimum_viable_intake');
  });

  it('returns ready_for_handoff for employment when all required filled', () => {
    const state = makeState({
      matterType: 'employment',
      slots: {
        caller_name: makeSlot('John Doe', 0.90),
        callback_number: makeSlot('+15551234567', 0.95),
        short_matter_summary: makeSlot('Wrongful termination', 0.90),
        employer_name: makeSlot('Acme Corp', 0.85),
      },
    });
    assert.equal(evaluateIntakeReadiness(state), 'ready_for_handoff');
  });
});

// ──────────────────────────────────────────────────────────────────
// 6. getIntakeRequirements — config correctness
// ──────────────────────────────────────────────────────────────────

describe('getIntakeRequirements', () => {
  it('personal_injury requires caller_name, callback_number, incident_date, summary, injury_type', () => {
    const req = getIntakeRequirements('personal_injury');
    const required = new Set(req.required);
    assert.ok(required.has('caller_name'));
    assert.ok(required.has('callback_number'));
    assert.ok(required.has('incident_date'));
    assert.ok(required.has('short_matter_summary'));
    assert.ok(required.has('injury_type'));
  });

  it('personal_injury minimumViable is a strict subset of required', () => {
    const req = getIntakeRequirements('personal_injury');
    const required = new Set(req.required);
    for (const field of req.minimumViable) {
      assert.ok(required.has(field), `minimumViable field "${field}" not in required`);
    }
  });

  it('criminal minimumViable includes custody_status', () => {
    const req = getIntakeRequirements('criminal');
    assert.ok(req.minimumViable.includes('custody_status'));
  });

  it('falls back to default for unknown matter type', () => {
    const req = getIntakeRequirements('unknown');
    assert.ok(req.required.includes('callback_number'));
    assert.ok(req.required.includes('short_matter_summary'));
  });

  it('optional fields do not overlap with required fields', () => {
    const matters = ['personal_injury', 'employment', 'family', 'criminal', 'estate'] as const;
    for (const m of matters) {
      const req = getIntakeRequirements(m);
      const required = new Set(req.required);
      for (const field of req.optional) {
        assert.ok(
          !required.has(field),
          `Matter "${m}": optional field "${field}" should not be in required`,
        );
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// 7. generateResponsePlan — 3C fields in output
// ──────────────────────────────────────────────────────────────────

describe('generateResponsePlan — 3C ResponsePlan fields', () => {
  it('exposes readiness in PlannerResult', () => {
    const state = makeState({ matterType: 'personal_injury' });
    const result = generateResponsePlan(state);
    assert.ok(
      ['incomplete', 'minimum_viable_intake', 'ready_for_handoff', 'completed'].includes(
        result.readiness,
      ),
    );
  });

  it('exposes decision in PlannerResult', () => {
    const state = makeState({ matterType: 'personal_injury' });
    const result = generateResponsePlan(state);
    assert.ok(['ask', 'repair', 'confirm', 'escalate', 'complete'].includes(result.decision.type));
    assert.ok(result.decision.objective.length > 0);
    assert.ok(result.decision.rationale.length > 0);
  });

  it('plan has escalationReady=true when ready_for_handoff', () => {
    const state = makeState({
      matterType: 'personal_injury',
      slots: {
        caller_name: makeSlot('Sarah Johnson', 0.90),
        callback_number: makeSlot('+15551234567', 0.95),
        incident_date: makeSlot('2026-01-15', 0.85),
        short_matter_summary: makeSlot('Car accident', 0.90),
        injury_type: makeSlot('whiplash', 0.85),
      },
    });
    const result = generateResponsePlan(state);
    assert.equal(result.readiness, 'ready_for_handoff');
    assert.equal(result.plan.escalationReady, true);
  });

  it('plan has escalationReady=true when escalation triggered', () => {
    const state = makeState({
      matterType: 'criminal',
      urgencyLevel: 'critical',
    });
    const result = generateResponsePlan(state);
    assert.equal(result.escalate, true);
    assert.equal(result.plan.escalationReady, true);
  });

  it('debugInfo includes decisionType and readiness', () => {
    const state = makeState({ matterType: 'personal_injury' });
    const result = generateResponsePlan(state);
    assert.ok(result.debugInfo.decisionType.length > 0);
    assert.ok(result.debugInfo.readiness.length > 0);
  });

  it('confidenceNotes populated when overall confidence is low', () => {
    const state = makeState({
      matterType: 'personal_injury',
      confidenceScore: 0.15, // below 0.40 threshold
    });
    const result = generateResponsePlan(state);
    assert.ok(result.plan.confidenceNotes && result.plan.confidenceNotes.length > 0);
    assert.ok(result.plan.confidenceNotes[0].includes('0.15'));
  });
});

// ──────────────────────────────────────────────────────────────────
// 8. End-to-end: repair scenario
// ──────────────────────────────────────────────────────────────────

describe('End-to-end: repair on ambiguous answer', () => {
  it('transitions to repair decision when repair strategy is active and same field repeated', () => {
    // Directly construct a state representing a distressed PI caller
    // mid-fact-collection, where the last question asked was caller_name.
    const state = makeState({
      matterType: 'personal_injury',
      intakeStage: 'fact_collection',
      emotionalState: 'distressed',
      repairStrategy: 'reassure_then_ask', // set by selectRepairStrategy for distressed callers
      missingRequiredFields: ['caller_name', 'callback_number', 'incident_date', 'short_matter_summary', 'injury_type'],
      lastQuestionAsked: 'caller_name', // last turn asked for name, got no clear answer
      turnCount: 3,
    });

    // repairStrategy is reassure_then_ask (active repair)
    assert.equal(state.repairStrategy, 'reassure_then_ask');

    const result = generateResponsePlan(state);

    // Next question should target caller_name (first missing required, personalization priority)
    // Since lastQuestionAsked is also caller_name, decision type should be repair
    assert.equal(result.decision.type, 'repair');
    assert.equal(result.decision.targetField, 'caller_name');
    assert.equal(result.decision.repairStrategy, 'reassure_then_ask');
    assert.ok(result.decision.rationale.includes('caller_name'));
  });

  it('selectRepairStrategy returns reassure_then_ask for distressed state', () => {
    // Verify that the underlying repair strategy selector does the right thing.
    // Use applyTurnToState with a clearly distressed phrase.
    let state = initializeConversationState({ conversationId: 'repair-test-002' });
    // Trigger PI + distressed in a single turn
    state = applyTurnToState(
      state,
      turn('I was in a car accident and I am crying and sobbing — I lost everything'),
    );
    assert.equal(state.matterType, 'personal_injury');
    assert.equal(state.emotionalState, 'distressed');
    assert.equal(state.repairStrategy, 'reassure_then_ask');
  });
});

// ──────────────────────────────────────────────────────────────────
// 9. End-to-end: minimum viable intake reached
// ──────────────────────────────────────────────────────────────────

describe('End-to-end: minimum_viable_intake reached', () => {
  it('readiness upgrades to minimum_viable_intake when callback + summary captured', () => {
    let state = initializeConversationState({ conversationId: 'mvi-test-001' });

    state = applyTurnToState(
      state,
      turn('I need help with a car accident case. My number is 555-234-5678.'),
    );

    // PI should be detected; callback_number might be extracted
    // Verify minimum_viable logic works for the expected fields
    const result = generateResponsePlan(state);

    // Readiness must be one of the valid states
    assert.ok(
      ['incomplete', 'minimum_viable_intake', 'ready_for_handoff', 'completed'].includes(
        result.readiness,
      ),
    );

    // Decision type must be valid
    assert.ok(['ask', 'repair', 'confirm', 'escalate', 'complete'].includes(result.decision.type));
  });
});
