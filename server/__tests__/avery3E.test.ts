/**
 * Avery 3E tests — turn interpretation, evidence-aware extraction,
 * answer matching, and confirmation signals.
 *
 * Covers:
 *   1.  interpretAffirmation — yes/no/uncertain detection
 *   2.  detectCorrectionSignal — correction language detection
 *   3.  matchAnswerToLastQuestion — answer-to-question matching
 *   4.  interpretTurn — full turn interpretation (all quality categories)
 *   5.  buildFieldProposalsFromSlots — evidence type assignment and gate flags
 *   6.  applyFieldProposalsToState — YES affirm → confirmField, NO affirm → rejectFieldValue
 *   7.  applyFieldProposalsToState — correction bypasses conflict detection
 *   8.  applyFieldProposalsToState — inferred proposals fill-if-empty only
 *   9.  rejectFieldValue — field cleared, removed from queue
 *  10.  End-to-end: direct answer captured with correct evidence type
 *  11.  End-to-end: volunteered field captured mid-conversation
 *  12.  End-to-end: correction overwrites without conflict flag
 *  13.  End-to-end: YES confirmation promotes field to confirmed status
 *  14.  End-to-end: NO rejection clears field and re-queues it as missing
 *  15.  End-to-end: nonresponsive turn does not corrupt state
 *  16.  PlannerResult exposes lastTurnInterpretation in debugInfo
 *  17.  Required spec scenarios (8 mandated)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { initializeConversationState } from '../avery/state/conversation-state';
import { applyTurnToState } from '../avery/state/state-updater';
import { interpretAffirmation, detectCorrectionSignal } from '../avery/state/affirmation';
import { matchAnswerToLastQuestion, interpretTurn } from '../avery/state/turn-interpretation';
import { applyFieldProposalsToState } from '../avery/state/field-proposals';
import { rejectFieldValue, confirmField } from '../avery/state/field-memory';
import { generateResponsePlan } from '../avery/planner/dialogue-planner';
import type {
  ConversationState,
  StateSlot,
  TurnInput,
  ExtractedFieldProposal,
  TurnInterpretation,
} from '../avery/types';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<ConversationState> = {}): ConversationState {
  const base = initializeConversationState({ conversationId: 'test-3e-001' });
  return { ...base, ...overrides };
}

function makeSlot(value: unknown, confidence: number, extra: Partial<StateSlot> = {}): StateSlot {
  return {
    value,
    confidence,
    source: 'caller',
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

function makeTurn(utterance: string, extra: Partial<TurnInput> = {}): TurnInput {
  return { utterance, ...extra };
}

// ──────────────────────────────────────────────────────────────────
// 1. interpretAffirmation
// ──────────────────────────────────────────────────────────────────

describe('interpretAffirmation', () => {
  it('detects yes signals', () => {
    const r = interpretAffirmation('Yes, that is correct');
    assert.equal(r.yes, true);
    assert.equal(r.no, false);
  });

  it('detects no signals', () => {
    const r = interpretAffirmation('No, that is wrong');
    assert.equal(r.no, true);
    assert.equal(r.yes, false);
  });

  it('detects uncertain signals', () => {
    const r = interpretAffirmation('Maybe, I am not sure');
    assert.equal(r.uncertain, true);
    assert.equal(r.yes, false);
    assert.equal(r.no, false);
  });

  it('detects yeah as yes', () => {
    assert.equal(interpretAffirmation('yeah that sounds right').yes, true);
  });

  it('detects nope as no', () => {
    assert.equal(interpretAffirmation('nope').no, true);
  });

  it('returns all false for neutral content', () => {
    const r = interpretAffirmation('My name is John Smith');
    assert.equal(r.yes, false);
    assert.equal(r.no, false);
    assert.equal(r.uncertain, false);
  });

  it('handles both yes and uncertain (hedged affirmation)', () => {
    const r = interpretAffirmation('yes, maybe, I think so');
    assert.equal(r.yes, true);
    assert.equal(r.uncertain, true);
  });
});

// ──────────────────────────────────────────────────────────────────
// 2. detectCorrectionSignal
// ──────────────────────────────────────────────────────────────────

describe('detectCorrectionSignal', () => {
  it('detects "no actually"', () => {
    assert.equal(detectCorrectionSignal('no actually my number is 555-999-1234'), true);
  });

  it('detects "wait"', () => {
    assert.equal(detectCorrectionSignal('wait I meant last Tuesday not Monday'), true);
  });

  it('detects "scratch that"', () => {
    assert.equal(detectCorrectionSignal('scratch that — the incident was on January 15th'), true);
  });

  it('detects "I misspoke"', () => {
    assert.equal(detectCorrectionSignal('I misspoke, the date was March 3rd'), true);
  });

  it('detects "I meant"', () => {
    assert.equal(detectCorrectionSignal('I meant to say the accident happened in February'), true);
  });

  it('returns false for plain affirmative', () => {
    assert.equal(detectCorrectionSignal('Yes, that is correct'), false);
  });

  it('returns false for substantive answer', () => {
    assert.equal(detectCorrectionSignal('My name is John and I was injured on March 5th'), false);
  });
});

// ──────────────────────────────────────────────────────────────────
// 3. matchAnswerToLastQuestion
// ──────────────────────────────────────────────────────────────────

describe('matchAnswerToLastQuestion', () => {
  it('returns true when no prior question (volunteered info)', () => {
    assert.equal(matchAnswerToLastQuestion(null, {}, 'My name is Jane'), true);
  });

  it('returns true when extracted slots contain the asked field', () => {
    const slots = { caller_name: makeSlot('Jane Doe', 0.8) };
    assert.equal(matchAnswerToLastQuestion('caller_name', slots, 'My name is Jane Doe'), true);
  });

  it('returns true for affirmation (yes) regardless of extracted content', () => {
    assert.equal(matchAnswerToLastQuestion('caller_name', {}, 'Yes'), true);
  });

  it('returns true for negation (no)', () => {
    assert.equal(matchAnswerToLastQuestion('caller_name', {}, 'No, actually'), true);
  });

  it('returns true for a substantive response (≥ 4 words)', () => {
    assert.equal(
      matchAnswerToLastQuestion('incident_date', {}, 'It was sometime last winter'),
      true,
    );
  });

  it('returns false for very short non-affirmative utterance with no extracted content', () => {
    assert.equal(matchAnswerToLastQuestion('incident_date', {}, 'Um'), false);
  });
});

// ──────────────────────────────────────────────────────────────────
// 4. interpretTurn — answer quality categories
// ──────────────────────────────────────────────────────────────────

describe('interpretTurn — answer quality', () => {
  const baseSlots = { caller_name: makeSlot('Jane Doe', 0.8) };

  it('classifies a direct answer as "direct"', () => {
    const state = makeState({ lastQuestionAsked: 'caller_name' });
    const result = interpretTurn('My name is Jane Doe', 'caller_name', state, baseSlots, 1);
    assert.equal(result.answerQuality, 'direct');
    assert.equal(result.answeredLastQuestion, true);
  });

  it('classifies correction language as "correction"', () => {
    const state = makeState({ lastQuestionAsked: 'caller_name' });
    const result = interpretTurn(
      'Wait, I meant to say Jane Smith not Jane Doe',
      'caller_name',
      state,
      baseSlots,
      1,
    );
    assert.equal(result.answerQuality, 'correction');
    assert.equal(result.correctionSignals, true);
  });

  it('classifies YES affirmation as "confirmation"', () => {
    const state = makeState({
      lastQuestionAsked: 'caller_name',
      confirmationQueue: ['caller_name'],
      slots: { caller_name: makeSlot('Jane Doe', 0.55) },
    });
    const result = interpretTurn('Yes, that is correct', 'caller_name', state, {}, 2);
    assert.equal(result.answerQuality, 'confirmation');
    assert.equal(result.affirmations.yes, true);
  });

  it('classifies a hedged response as "partial"', () => {
    const state = makeState({ lastQuestionAsked: 'incident_date' });
    const dateSlots = { incident_date: makeSlot('last month', 0.5) };
    const result = interpretTurn(
      'I think it was maybe last month',
      'incident_date',
      state,
      dateSlots,
      1,
    );
    assert.equal(result.answerQuality, 'partial');
  });

  it('classifies an off-topic very short utterance as "nonresponsive"', () => {
    const state = makeState({ lastQuestionAsked: 'incident_date' });
    const result = interpretTurn('Um', 'incident_date', state, {}, 1);
    assert.equal(result.answerQuality, 'nonresponsive');
  });

  it('detects distress signals', () => {
    const state = makeState();
    const result = interpretTurn(
      'I am crying and sobbing, I am devastated by this whole situation',
      null,
      state,
      {},
      1,
    );
    assert.equal(result.distressSignals, true);
  });

  it('classifies pure social utterance as irrelevant', () => {
    const state = makeState();
    const result = interpretTurn('Hi', null, state, {}, 1);
    assert.equal(result.irrelevantContent, true);
  });
});

// ──────────────────────────────────────────────────────────────────
// 5. Evidence type assignment in field proposals
// ──────────────────────────────────────────────────────────────────

describe('interpretTurn — evidence type assignment', () => {
  it('assigns direct_answer when extracted field matches lastQuestion', () => {
    const slots = { caller_name: makeSlot('John Smith', 0.8) };
    const state = makeState({ lastQuestionAsked: 'caller_name' });
    const result = interpretTurn('My name is John Smith', 'caller_name', state, slots, 1);
    const nameProposal = result.detectedFields.find((p) => p.fieldKey === 'caller_name');
    assert.ok(nameProposal);
    assert.equal(nameProposal.evidenceType, 'direct_answer');
    assert.equal(nameProposal.shouldApplyDirectly, true);
  });

  it('assigns volunteered when extracted field does not match lastQuestion', () => {
    const slots = { email: makeSlot('jane@example.com', 0.95) };
    const state = makeState({ lastQuestionAsked: 'caller_name' });
    const result = interpretTurn(
      'You can reach me at jane@example.com',
      'caller_name',
      state,
      slots,
      1,
    );
    const emailProposal = result.detectedFields.find((p) => p.fieldKey === 'email');
    assert.ok(emailProposal);
    assert.equal(emailProposal.evidenceType, 'volunteered');
    assert.equal(emailProposal.shouldApplyDirectly, true); // confidence 0.95 ≥ 0.70
  });

  it('assigns correction evidence type when correction signal present', () => {
    const slots = { callback_number: makeSlot('+15559991234', 0.9) };
    const state = makeState({ lastQuestionAsked: 'callback_number' });
    const result = interpretTurn(
      'no actually my number is 555-999-1234',
      'callback_number',
      state,
      slots,
      1,
    );
    const proposal = result.detectedFields.find((p) => p.fieldKey === 'callback_number');
    assert.ok(proposal);
    assert.equal(proposal.evidenceType, 'correction');
    assert.equal(proposal.requiresConfirmation, true);
  });

  it('assigns inferred for low-confidence unasked field', () => {
    const slots = { opposing_party: makeSlot('Acme Corp', 0.4) }; // confidence < 0.55
    const state = makeState({ lastQuestionAsked: 'caller_name' });
    const result = interpretTurn(
      'My name is John, I was in an accident',
      'caller_name',
      state,
      slots,
      1,
    );
    const proposal = result.detectedFields.find((p) => p.fieldKey === 'opposing_party');
    assert.ok(proposal);
    assert.equal(proposal.evidenceType, 'inferred');
    assert.equal(proposal.shouldApplyDirectly, false);
    assert.equal(proposal.requiresConfirmation, true);
  });
});

// ──────────────────────────────────────────────────────────────────
// 6. applyFieldProposalsToState — YES affirmation
// ──────────────────────────────────────────────────────────────────

describe('applyFieldProposalsToState — YES affirmation', () => {
  it('confirms the top of the confirmation queue when caller says yes', () => {
    const state = makeState({
      slots: { caller_name: makeSlot('Jane Doe', 0.55, { needsConfirmation: true }) },
      confirmationQueue: ['caller_name'],
      lowConfidenceRequiredFields: ['caller_name'],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    const interpretation: TurnInterpretation = {
      answeredLastQuestion: true,
      targetField: 'caller_name',
      answerQuality: 'confirmation',
      detectedFields: [],
      affirmations: { yes: true, no: false, uncertain: false },
      correctionSignals: false,
      distressSignals: false,
      irrelevantContent: false,
      notes: [],
    };
    const updated = applyFieldProposalsToState(state, [], interpretation);
    const slot = updated.slots['caller_name'];
    assert.ok(slot);
    assert.ok(slot.confidence >= 0.90, `expected ≥ 0.90, got ${slot.confidence}`);
    assert.equal(slot.status, 'confirmed');
    assert.equal(updated.confirmationQueue.includes('caller_name'), false);
  });
});

// ──────────────────────────────────────────────────────────────────
// 7. applyFieldProposalsToState — NO affirmation (rejection)
// ──────────────────────────────────────────────────────────────────

describe('applyFieldProposalsToState — NO affirmation', () => {
  it('rejects the top confirmation queue field when caller says no', () => {
    const state = makeState({
      slots: {
        caller_name: makeSlot('Wrong Name', 0.55, { needsConfirmation: true }),
        callback_number: makeSlot('+15551234567', 0.9),
      },
      confirmationQueue: ['caller_name'],
      lowConfidenceRequiredFields: ['caller_name'],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    const interpretation: TurnInterpretation = {
      answeredLastQuestion: true,
      targetField: 'caller_name',
      answerQuality: 'nonresponsive',
      detectedFields: [],
      affirmations: { yes: false, no: true, uncertain: false },
      correctionSignals: false,
      distressSignals: false,
      irrelevantContent: false,
      notes: [],
    };
    const updated = applyFieldProposalsToState(state, [], interpretation);
    const slot = updated.slots['caller_name'];
    assert.ok(slot);
    assert.equal(slot.value, null);
    assert.equal(slot.confidence, 0);
    assert.equal(slot.status, 'missing');
    assert.equal(updated.confirmationQueue.includes('caller_name'), false);
  });
});

// ──────────────────────────────────────────────────────────────────
// 8. applyFieldProposalsToState — correction bypasses conflict detection
// ──────────────────────────────────────────────────────────────────

describe('applyFieldProposalsToState — correction overwrite', () => {
  it('overwrites existing high-confidence slot without conflict flag', () => {
    const state = makeState({
      slots: {
        callback_number: makeSlot('+15551110000', 0.90),
      },
      confirmationQueue: [],
      lowConfidenceRequiredFields: [],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    const correctionProposal: ExtractedFieldProposal = {
      fieldKey: 'callback_number',
      rawValue: '+15559991234',
      normalizedValue: '+15559991234',
      sourceTurn: 2,
      evidenceType: 'correction',
      confidenceScore: 0.9,
      shouldApplyDirectly: true,
      requiresConfirmation: true,
    };
    const interpretation: TurnInterpretation = {
      answeredLastQuestion: true,
      targetField: 'callback_number',
      answerQuality: 'correction',
      detectedFields: [correctionProposal],
      affirmations: { yes: false, no: false, uncertain: false },
      correctionSignals: true,
      distressSignals: false,
      irrelevantContent: false,
      notes: [],
    };
    const updated = applyFieldProposalsToState(state, [correctionProposal], interpretation);
    const slot = updated.slots['callback_number'];
    assert.ok(slot);
    assert.equal(slot.value, '+15559991234');
    // Conflict flag should NOT be set (correction bypasses conflict detection)
    assert.notEqual(slot.conflictFlag, true);
    // Should require confirmation since it's a correction
    assert.equal(slot.needsConfirmation, true);
  });
});

// ──────────────────────────────────────────────────────────────────
// 9. rejectFieldValue
// ──────────────────────────────────────────────────────────────────

describe('rejectFieldValue', () => {
  it('clears field value and removes from confirmation queue', () => {
    const state = makeState({
      slots: {
        caller_name: makeSlot('Wrong Name', 0.55, { needsConfirmation: true }),
      },
      confirmationQueue: ['caller_name'],
      lowConfidenceRequiredFields: ['caller_name'],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    const updated = rejectFieldValue(state, 'caller_name');
    assert.equal(updated.slots['caller_name'].value, null);
    assert.equal(updated.slots['caller_name'].confidence, 0);
    assert.equal(updated.slots['caller_name'].status, 'missing');
    assert.equal(updated.confirmationQueue.includes('caller_name'), false);
    assert.equal(updated.lowConfidenceRequiredFields.includes('caller_name'), false);
  });

  it('is a no-op when field does not exist', () => {
    const state = makeState({
      confirmationQueue: [],
      lowConfidenceRequiredFields: [],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    const updated = rejectFieldValue(state, 'nonexistent_field');
    assert.deepEqual(updated.slots, state.slots);
  });
});

// ──────────────────────────────────────────────────────────────────
// 10. End-to-end: direct answer captured with correct evidence type
// ──────────────────────────────────────────────────────────────────

describe('end-to-end: direct answer', () => {
  it('captures caller name when directly asked', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      lastQuestionAsked: 'caller_name',
      missingRequiredFields: ['caller_name', 'callback_number', 'incident_date', 'short_matter_summary', 'injury_type'],
      confirmationQueue: [],
      lowConfidenceRequiredFields: [],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    const updated = applyTurnToState(state, makeTurn('My name is Sarah Johnson'));
    assert.ok(updated.slots['caller_name']?.value);
    assert.equal(updated.slots['caller_name']?.value, 'Sarah Johnson');
    // Turn interpretation should be stored
    assert.ok(updated.lastTurnInterpretation);
    assert.equal(updated.lastTurnInterpretation.answerQuality, 'direct');
  });
});

// ──────────────────────────────────────────────────────────────────
// 11. End-to-end: volunteered field captured mid-conversation
// ──────────────────────────────────────────────────────────────────

describe('end-to-end: volunteered field', () => {
  it('captures email volunteered while answering name question', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      lastQuestionAsked: 'caller_name',
      missingRequiredFields: ['caller_name', 'callback_number', 'incident_date', 'short_matter_summary', 'injury_type'],
      confirmationQueue: [],
      lowConfidenceRequiredFields: [],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    const updated = applyTurnToState(
      state,
      makeTurn('My name is Tom and you can email me at tom@example.com'),
    );
    assert.ok(updated.slots['caller_name']?.value);
    assert.ok(updated.slots['email']?.value);
    assert.equal(updated.slots['email']?.value, 'tom@example.com');
    // Email was volunteered (not the lastQuestion)
    const interpretation = updated.lastTurnInterpretation;
    assert.ok(interpretation);
    const emailProposal = interpretation.detectedFields.find((p) => p.fieldKey === 'email');
    assert.ok(emailProposal);
    assert.equal(emailProposal.evidenceType, 'volunteered');
  });
});

// ──────────────────────────────────────────────────────────────────
// 12. End-to-end: correction overwrites without conflict flag
// ──────────────────────────────────────────────────────────────────

describe('end-to-end: correction overwrite', () => {
  it('correction signal overwrites phone without marking it conflicting', () => {
    // First turn: give a phone number
    let state = makeState({
      intakeStage: 'contact_capture',
      matterType: 'personal_injury',
      lastQuestionAsked: 'callback_number',
      missingRequiredFields: ['callback_number'],
      confirmationQueue: [],
      lowConfidenceRequiredFields: [],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    state = applyTurnToState(state, makeTurn('My number is 555-111-0000'));
    assert.ok(state.slots['callback_number']?.value);

    // Second turn: correct the number
    state = { ...state, lastQuestionAsked: 'callback_number' };
    state = applyTurnToState(
      state,
      makeTurn('no actually my number is 555-999-1234'),
    );

    const slot = state.slots['callback_number'];
    assert.ok(slot);
    // Conflict flag should NOT be set — it was a correction, not a conflict
    assert.notEqual(slot.conflictFlag, true);
    const interpretation = state.lastTurnInterpretation;
    assert.ok(interpretation);
    assert.equal(interpretation.correctionSignals, true);
    assert.equal(interpretation.answerQuality, 'correction');
  });
});

// ──────────────────────────────────────────────────────────────────
// 13. End-to-end: YES confirmation promotes field to confirmed status
// ──────────────────────────────────────────────────────────────────

describe('end-to-end: YES confirmation promotes status', () => {
  it('caller says yes to confirmation queue → field becomes confirmed', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      lastQuestionAsked: 'incident_date',
      slots: {
        incident_date: makeSlot('last month', 0.45, { needsConfirmation: true }),
      },
      confirmationQueue: ['incident_date'],
      missingRequiredFields: ['caller_name', 'callback_number', 'short_matter_summary', 'injury_type'],
      lowConfidenceRequiredFields: ['incident_date'],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    const updated = applyTurnToState(state, makeTurn('Yes, that is correct'));
    const slot = updated.slots['incident_date'];
    assert.ok(slot);
    assert.ok(slot.confidence >= 0.90, `expected ≥ 0.90, got ${slot.confidence}`);
    assert.equal(slot.status, 'confirmed');
    assert.equal(updated.confirmationQueue.includes('incident_date'), false);
  });
});

// ──────────────────────────────────────────────────────────────────
// 14. End-to-end: NO rejection clears field
// ──────────────────────────────────────────────────────────────────

describe('end-to-end: NO rejection clears field', () => {
  it('caller says no → field value cleared and removed from queue', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      lastQuestionAsked: 'caller_name',
      slots: {
        caller_name: makeSlot('Wrong Name', 0.55, { needsConfirmation: true }),
      },
      confirmationQueue: ['caller_name'],
      missingRequiredFields: ['callback_number', 'incident_date', 'short_matter_summary', 'injury_type'],
      lowConfidenceRequiredFields: ['caller_name'],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    const updated = applyTurnToState(state, makeTurn('No, that is not right'));
    const slot = updated.slots['caller_name'];
    assert.ok(slot);
    assert.equal(slot.value, null);
    assert.equal(updated.confirmationQueue.includes('caller_name'), false);
  });
});

// ──────────────────────────────────────────────────────────────────
// 15. End-to-end: nonresponsive turn does not corrupt state
// ──────────────────────────────────────────────────────────────────

describe('end-to-end: nonresponsive turn', () => {
  it('a vague off-topic utterance does not overwrite existing confirmed data', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      lastQuestionAsked: 'incident_date',
      slots: {
        caller_name: makeSlot('Alice Smith', 0.90, { status: 'confirmed' }),
      },
      confirmationQueue: [],
      missingRequiredFields: ['incident_date', 'callback_number', 'short_matter_summary', 'injury_type'],
      lowConfidenceRequiredFields: [],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    const updated = applyTurnToState(state, makeTurn('Um'));
    // Existing confirmed data preserved
    assert.equal(updated.slots['caller_name']?.value, 'Alice Smith');
    assert.equal(updated.slots['caller_name']?.status, 'confirmed');
    // Turn interpretation recorded
    const interp = updated.lastTurnInterpretation;
    assert.ok(interp);
    assert.equal(interp.answeredLastQuestion, false);
    assert.equal(interp.answerQuality, 'nonresponsive');
  });
});

// ──────────────────────────────────────────────────────────────────
// 16. PlannerResult exposes lastTurnInterpretation in debugInfo
// ──────────────────────────────────────────────────────────────────

describe('PlannerResult.debugInfo.lastTurnInterpretation', () => {
  it('exposes lastTurnInterpretation in planner debug output', () => {
    // Build a state with a known interpretation
    let state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      lastQuestionAsked: 'caller_name',
      missingRequiredFields: ['caller_name', 'callback_number', 'incident_date', 'short_matter_summary', 'injury_type'],
      confirmationQueue: [],
      lowConfidenceRequiredFields: [],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    state = applyTurnToState(state, makeTurn('My name is Grace Lee'));
    const result = generateResponsePlan(state);
    assert.ok(result.debugInfo.lastTurnInterpretation);
    assert.equal(typeof result.debugInfo.lastTurnInterpretation.answerQuality, 'string');
  });

  it('is null when no turn has been processed yet', () => {
    const state = makeState({
      intakeStage: 'opening',
      confirmationQueue: [],
      lowConfidenceRequiredFields: [],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    const result = generateResponsePlan(state);
    assert.equal(result.debugInfo.lastTurnInterpretation, null);
  });
});

// ──────────────────────────────────────────────────────────────────
// 17. Required spec scenarios (8 mandated)
// ──────────────────────────────────────────────────────────────────

describe('3E spec: required scenarios', () => {
  // Scenario 1: Direct answer to question → detects as direct_answer evidence
  it('Scenario 1: direct answer to lastQuestion gets direct_answer evidence type', () => {
    const slots = { callback_number: makeSlot('+15551234567', 0.9) };
    const state = makeState({ lastQuestionAsked: 'callback_number', confirmationQueue: [] });
    const result = interpretTurn('My number is 555-123-4567', 'callback_number', state, slots, 1);
    const proposal = result.detectedFields.find((p) => p.fieldKey === 'callback_number');
    assert.ok(proposal);
    assert.equal(proposal.evidenceType, 'direct_answer');
    assert.equal(result.answeredLastQuestion, true);
    assert.equal(result.answerQuality, 'direct');
  });

  // Scenario 2: Volunteered data (not answering the asked question) → volunteered
  it('Scenario 2: volunteered field while answering different question', () => {
    const slots = { email: makeSlot('test@example.com', 0.95) };
    const state = makeState({ lastQuestionAsked: 'caller_name', confirmationQueue: [] });
    const result = interpretTurn(
      'You can reach me at test@example.com',
      'caller_name',
      state,
      slots,
      1,
    );
    const proposal = result.detectedFields.find((p) => p.fieldKey === 'email');
    assert.ok(proposal);
    assert.equal(proposal.evidenceType, 'volunteered');
  });

  // Scenario 3: Correction signal → correction evidence type, no conflict flag
  it('Scenario 3: correction signal → correction evidence, correction flag on interpretation', () => {
    const slots = { incident_date: makeSlot('March 5th', 0.8) };
    const state = makeState({ lastQuestionAsked: 'incident_date', confirmationQueue: [] });
    const result = interpretTurn(
      'wait, I meant to say March 5th not February',
      'incident_date',
      state,
      slots,
      2,
    );
    assert.equal(result.correctionSignals, true);
    assert.equal(result.answerQuality, 'correction');
    const proposal = result.detectedFields.find((p) => p.fieldKey === 'incident_date');
    assert.ok(proposal);
    assert.equal(proposal.evidenceType, 'correction');
  });

  // Scenario 4: YES affirmation with confirmation queue → confirmation evidence
  it('Scenario 4: YES affirmation toward confirmation queue target', () => {
    const state = makeState({
      confirmationQueue: ['incident_date'],
      slots: { incident_date: makeSlot('March 5th', 0.5, { needsConfirmation: true }) },
    });
    const result = interpretTurn('yes that is correct', null, state, {}, 3);
    assert.equal(result.affirmations.yes, true);
    assert.equal(result.answerQuality, 'confirmation');
    assert.ok(result.notes.some((n) => n.startsWith('affirmed_confirmation_target')));
  });

  // Scenario 5: NO affirmation with confirmation queue → rejection note
  it('Scenario 5: NO affirmation toward confirmation queue target', () => {
    const state = makeState({
      confirmationQueue: ['caller_name'],
      slots: { caller_name: makeSlot('Wrong Name', 0.55, { needsConfirmation: true }) },
    });
    const result = interpretTurn('no that is not right', null, state, {}, 2);
    assert.equal(result.affirmations.no, true);
    assert.ok(result.notes.some((n) => n.startsWith('rejected_confirmation_target')));
  });

  // Scenario 6: Low-confidence unasked field → inferred, shouldApplyDirectly=false
  it('Scenario 6: low-confidence unasked field gets inferred type with shouldApplyDirectly=false', () => {
    const slots = { opposing_party: makeSlot('Big Corp', 0.3) }; // low confidence
    const state = makeState({ lastQuestionAsked: 'caller_name', confirmationQueue: [] });
    const result = interpretTurn('I work for Big Corp', 'caller_name', state, slots, 1);
    const proposal = result.detectedFields.find((p) => p.fieldKey === 'opposing_party');
    assert.ok(proposal);
    assert.equal(proposal.evidenceType, 'inferred');
    assert.equal(proposal.shouldApplyDirectly, false);
    assert.equal(proposal.requiresConfirmation, true);
  });

  // Scenario 7: Inferred proposal only fills if field is empty
  it('Scenario 7: inferred proposal does not overwrite existing slot', () => {
    const state = makeState({
      slots: {
        opposing_party: makeSlot('Existing Corp', 0.85),
      },
      confirmationQueue: [],
      lowConfidenceRequiredFields: [],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    const inferredProposal: ExtractedFieldProposal = {
      fieldKey: 'opposing_party',
      rawValue: 'Different Corp',
      normalizedValue: 'Different Corp',
      sourceTurn: 2,
      evidenceType: 'inferred',
      confidenceScore: 0.3,
      shouldApplyDirectly: false,
      requiresConfirmation: true,
    };
    const interpretation: TurnInterpretation = {
      answeredLastQuestion: false,
      targetField: null,
      answerQuality: 'nonresponsive',
      detectedFields: [inferredProposal],
      affirmations: { yes: false, no: false, uncertain: false },
      correctionSignals: false,
      distressSignals: false,
      irrelevantContent: false,
      notes: [],
    };
    const updated = applyFieldProposalsToState(state, [inferredProposal], interpretation);
    // Inferred should NOT overwrite existing
    assert.equal(updated.slots['opposing_party']?.value, 'Existing Corp');
  });

  // Scenario 8: lastTurnInterpretation is stored on state after applyTurnToState
  it('Scenario 8: lastTurnInterpretation is stored on state after each turn', () => {
    let state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      lastQuestionAsked: 'caller_name',
      missingRequiredFields: ['caller_name', 'callback_number', 'incident_date', 'short_matter_summary', 'injury_type'],
      confirmationQueue: [],
      lowConfidenceRequiredFields: [],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    assert.equal(state.lastTurnInterpretation, undefined);

    state = applyTurnToState(state, makeTurn('My name is Marco Polo'));
    assert.ok(state.lastTurnInterpretation);
    assert.ok(typeof state.lastTurnInterpretation.answerQuality === 'string');
    assert.ok(Array.isArray(state.lastTurnInterpretation.detectedFields));
    assert.ok(Array.isArray(state.lastTurnInterpretation.notes));

    // Second turn: interpretation is updated
    state = applyTurnToState(state, makeTurn('I was in a car accident'));
    assert.ok(state.lastTurnInterpretation);
    assert.notEqual(state.lastTurnInterpretation.notes, undefined);
  });
});
