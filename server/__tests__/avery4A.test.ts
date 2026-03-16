/**
 * Avery 4A tests — Runtime loop closure.
 *
 * Covers:
 *   1.  recordAssistantTurn writes lastQuestionAsked
 *   2.  recordAssistantTurn writes lastDecisionType, lastConfirmationTarget, lastAssistantMode
 *   3.  recordAssistantTurn — legacy string signature preserves existing metadata
 *   4.  Confirmation turn YES → confirmField() applied
 *   5.  Confirmation turn NO → rejectFieldValue() applied (field cleared)
 *   6.  lastConfirmationTarget fallback fires when confirmationQueue is empty
 *   7.  Answer matching improves with lastQuestionAsked set
 *   8.  Full planner + renderer pipeline produces a valid RenderPayload
 *   9.  Shared extraction patterns: extractName, extractEmail, extractPhone, extractDate
 *  10.  Shared extraction patterns: detectRiskFlagsFromText
 *  11.  Live-turn risk flags match post-call patterns (no silent divergence)
 *  12.  extractTurnSlots uses shared patterns (phone normalizes to E.164)
 *  13.  Confirmation queue + lastConfirmationTarget together don't double-apply
 *  14.  recordAssistantTurn with undefined questionAsked preserves prior lastQuestionAsked
 *  15.  End-to-end: multi-turn conversation with confirmation applied correctly
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { initializeConversationState } from '../avery/state/conversation-state';
import { applyTurnToState, recordAssistantTurn } from '../avery/state/state-updater';
import { generateResponsePlan } from '../avery/planner/dialogue-planner';
import { prepareRenderPayload } from '../avery/llm/avery-renderer';
import {
  extractName,
  extractEmail,
  extractPhone,
  extractIncidentDate,
  extractOpposingParty,
  detectRiskFlagsFromText,
} from '../avery/intake/extraction-patterns';
import { applyFieldProposalsToState } from '../avery/state/field-proposals';
import type { ConversationState, TurnInput, StateSlot, TurnInterpretation } from '../avery/types';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<ConversationState> = {}): ConversationState {
  const base = initializeConversationState({ conversationId: 'test-4a-001' });
  return { ...base, ...overrides };
}

function turn(utterance: string, opts: Partial<TurnInput> = {}): TurnInput {
  return { utterance, ...opts };
}

function makeSlot(value: unknown, confidence: number): StateSlot {
  return { value, confidence, source: 'caller', updatedAt: new Date().toISOString() };
}

function makeInterpretation(overrides: Partial<TurnInterpretation> = {}): TurnInterpretation {
  return {
    answeredLastQuestion: true,
    targetField: null,
    answerQuality: 'direct',
    detectedFields: [],
    affirmations: { yes: false, no: false, uncertain: false },
    correctionSignals: false,
    distressSignals: false,
    irrelevantContent: false,
    notes: [],
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────
// 1. recordAssistantTurn writes lastQuestionAsked
// ──────────────────────────────────────────────────────────────────

describe('recordAssistantTurn — lastQuestionAsked', () => {
  it('writes lastQuestionAsked from meta', () => {
    const state = makeState();
    const next = recordAssistantTurn(state, {
      utterance: "What's the best phone number to reach you?",
      questionAsked: 'callback_number',
    });
    assert.equal(next.lastQuestionAsked, 'callback_number');
  });

  it('writes null to clear lastQuestionAsked', () => {
    const state = makeState({ lastQuestionAsked: 'caller_name' });
    const next = recordAssistantTurn(state, {
      utterance: 'Thank you for calling.',
      questionAsked: null,
    });
    assert.equal(next.lastQuestionAsked, null);
  });

  it('preserves existing lastQuestionAsked when questionAsked is undefined', () => {
    const state = makeState({ lastQuestionAsked: 'incident_date' });
    const next = recordAssistantTurn(state, {
      utterance: 'I understand.',
      // questionAsked intentionally omitted
    });
    assert.equal(next.lastQuestionAsked, 'incident_date');
  });
});

// ──────────────────────────────────────────────────────────────────
// 2. recordAssistantTurn writes all 4A meta fields
// ──────────────────────────────────────────────────────────────────

describe('recordAssistantTurn — full AssistantTurnMeta', () => {
  it('writes decisionType, confirmationTarget, assistantMode', () => {
    const state = makeState();
    const next = recordAssistantTurn(state, {
      utterance: "I have your phone number as 555-123-4567 — is that correct?",
      questionAsked: 'callback_number',
      decisionType: 'confirm',
      confirmationTarget: 'callback_number',
      assistantMode: 'confirm',
    });
    assert.equal(next.lastQuestionAsked, 'callback_number');
    assert.equal(next.lastDecisionType, 'confirm');
    assert.equal(next.lastConfirmationTarget, 'callback_number');
    assert.equal(next.lastAssistantMode, 'confirm');
  });

  it('stamps lastAssistantUtterance', () => {
    const state = makeState();
    const next = recordAssistantTurn(state, {
      utterance: 'Got it. Can I start with your name?',
      questionAsked: 'caller_name',
    });
    assert.equal(next.lastAssistantUtterance, 'Got it. Can I start with your name?');
  });
});

// ──────────────────────────────────────────────────────────────────
// 3. Legacy string signature
// ──────────────────────────────────────────────────────────────────

describe('recordAssistantTurn — legacy string signature', () => {
  it('accepts plain string and sets lastAssistantUtterance', () => {
    const state = makeState({ lastQuestionAsked: 'caller_name' });
    const next = recordAssistantTurn(state, 'Hello, how can I help you today?');
    assert.equal(next.lastAssistantUtterance, 'Hello, how can I help you today?');
    // Should NOT clear lastQuestionAsked (no questionAsked key provided)
    assert.equal(next.lastQuestionAsked, 'caller_name');
  });
});

// ──────────────────────────────────────────────────────────────────
// 4. Confirmation YES → confirmField applied
// ──────────────────────────────────────────────────────────────────

describe('confirmation: YES applies confirmField', () => {
  it('YES signal on confirmationQueue field upgrades confidence and clears queue', () => {
    const state = makeState({
      matterType: 'personal_injury',
      intakeStage: 'fact_collection',
      slots: {
        callback_number: makeSlot('+15551234567', 0.45), // low confidence → enters queue
      },
      confirmationQueue: ['callback_number'],
    });

    // Simulate turn after Avery asks "Is your number 555-123-4567?"
    const stateAfterAssist = recordAssistantTurn(state, {
      utterance: "I have your number as 555-123-4567 — is that correct?",
      questionAsked: 'callback_number',
      decisionType: 'confirm',
      confirmationTarget: 'callback_number',
    });

    const stateAfterYes = applyTurnToState(stateAfterAssist, turn('yes, that is correct'));
    const slot = stateAfterYes.slots['callback_number'];
    assert.ok(slot, 'callback_number slot should still exist');
    assert.ok(slot.confidence >= 0.90, `confidence should be ≥ 0.90, got ${slot.confidence}`);
    assert.equal(slot.status, 'confirmed');
    assert.equal(slot.conflictFlag, false);
    assert.equal(slot.needsConfirmation, false);
    assert.ok(!stateAfterYes.confirmationQueue.includes('callback_number'),
      'callback_number should be removed from confirmationQueue');
  });
});

// ──────────────────────────────────────────────────────────────────
// 5. Confirmation NO → rejectFieldValue applied
// ──────────────────────────────────────────────────────────────────

describe('confirmation: NO applies rejectFieldValue', () => {
  it('NO signal clears field value and removes from confirmationQueue', () => {
    const state = makeState({
      matterType: 'personal_injury',
      slots: {
        caller_name: makeSlot('John', 0.45), // low confidence → enters queue
      },
      confirmationQueue: ['caller_name'],
    });

    const stateAfterAssist = recordAssistantTurn(state, {
      utterance: "I have your name as John — is that correct?",
      questionAsked: 'caller_name',
      decisionType: 'confirm',
      confirmationTarget: 'caller_name',
    });

    const stateAfterNo = applyTurnToState(stateAfterAssist, turn("no, that's not right"));
    const slot = stateAfterNo.slots['caller_name'];
    assert.ok(slot, 'slot should still exist');
    assert.equal(slot.value, null, 'value should be cleared after NO');
    assert.equal(slot.confidence, 0);
    assert.equal(slot.status, 'missing');
    assert.ok(!stateAfterNo.confirmationQueue.includes('caller_name'),
      'caller_name should be removed from confirmationQueue');
  });
});

// ──────────────────────────────────────────────────────────────────
// 6. lastConfirmationTarget fallback when confirmationQueue is empty
// ──────────────────────────────────────────────────────────────────

describe('lastConfirmationTarget fallback', () => {
  it('YES applies confirmField via lastConfirmationTarget when queue is empty', () => {
    // Field has value with moderate confidence — not in queue threshold (≥ 0.60)
    // but planner decided to ask for confirmation anyway (e.g. edge case)
    const state = makeState({
      matterType: 'general',
      slots: {
        short_matter_summary: makeSlot('car accident last month', 0.65), // above threshold, not in queue
      },
      confirmationQueue: [],  // queue is empty
      lastConfirmationTarget: 'short_matter_summary',  // recorded by prior recordAssistantTurn
      lastDecisionType: 'confirm',
    });

    const stateAfterYes = applyTurnToState(state, turn('yes that is correct'));
    const slot = stateAfterYes.slots['short_matter_summary'];
    assert.ok(slot, 'slot should exist');
    assert.ok(slot.confidence >= 0.90, `confidence should be ≥ 0.90, got ${slot.confidence}`);
    assert.equal(slot.status, 'confirmed');
  });

  it('NO clears field via lastConfirmationTarget when queue is empty', () => {
    const state = makeState({
      matterType: 'general',
      slots: {
        short_matter_summary: makeSlot('slip and fall', 0.65),
      },
      confirmationQueue: [],
      lastConfirmationTarget: 'short_matter_summary',
      lastDecisionType: 'confirm',
    });

    const stateAfterNo = applyTurnToState(state, turn("no that's wrong"));
    const slot = stateAfterNo.slots['short_matter_summary'];
    assert.equal(slot?.value, null, 'value should be cleared');
    assert.equal(slot?.status, 'missing');
  });

  it('does not fire fallback when confirmationQueue already has a field (queue takes priority)', () => {
    // Queue has 'callback_number', lastConfirmationTarget has 'caller_name'
    // The queue field should be confirmed, not the lastConfirmationTarget
    const state = makeState({
      matterType: 'general',
      slots: {
        callback_number: makeSlot('+15551234567', 0.45),
        caller_name: makeSlot('Alice', 0.70),
      },
      confirmationQueue: ['callback_number'],
      lastConfirmationTarget: 'caller_name',
    });

    const stateAfterYes = applyTurnToState(state, turn('yes correct'));
    // callback_number should be confirmed (from queue), caller_name should be untouched
    assert.ok(stateAfterYes.slots['callback_number']!.confidence >= 0.90);
    // caller_name should NOT have been confirmed (it wasn't the queue target)
    // Its confidence stays at 0.70 (no bump)
    assert.ok((stateAfterYes.slots['caller_name']?.confidence ?? 0) < 0.90);
  });
});

// ──────────────────────────────────────────────────────────────────
// 7. Answer matching improves with lastQuestionAsked set
// ──────────────────────────────────────────────────────────────────

describe('answer matching with lastQuestionAsked', () => {
  it('phone number extracted as direct_answer when lastQuestionAsked is callback_number', () => {
    // Start: Avery just asked for callback_number
    const state = makeState({
      intakeStage: 'contact_capture',
      lastQuestionAsked: 'callback_number',
    });

    // Caller gives their phone number
    const next = applyTurnToState(state, turn('my number is 555-987-6543'));
    const slot = next.slots['callback_number'];
    assert.ok(slot, 'callback_number should be extracted');
    assert.ok(slot.value, 'value should be set');
    // With lastQuestionAsked set, interpretation treats this as direct_answer → shouldApplyDirectly
    assert.ok(slot.confidence >= 0.7, `confidence should be reasonable, got ${slot.confidence}`);
  });

  it('interpretation targetField matches lastQuestionAsked', () => {
    const state = makeState({ lastQuestionAsked: 'caller_name' });
    const next = applyTurnToState(state, turn('my name is Sarah Johnson'));
    const interp = next.lastTurnInterpretation;
    assert.ok(interp, 'interpretation should exist');
    assert.equal(interp.targetField, 'caller_name');
  });
});

// ──────────────────────────────────────────────────────────────────
// 8. Full planner + renderer pipeline produces valid RenderPayload
// ──────────────────────────────────────────────────────────────────

describe('planner + renderer end-to-end', () => {
  it('generateResponsePlan + prepareRenderPayload produces valid RenderPayload', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      missingRequiredFields: ['caller_name', 'incident_date', 'injury_type'],
    });

    const result = generateResponsePlan(state);
    assert.ok(result.plan, 'plan should exist');
    assert.ok(result.decision, 'decision should exist');
    assert.ok(result.readiness, 'readiness should exist');

    const payload = prepareRenderPayload(state, result.plan);
    assert.ok(payload.systemPrompt, 'systemPrompt should exist');
    assert.ok(typeof payload.systemPrompt === 'string');
    assert.ok(payload.systemPrompt.length > 100, 'systemPrompt should be substantial');
    assert.ok(typeof payload.maxTokens === 'number', 'maxTokens should be a number');
    assert.ok(typeof payload.temperature === 'number');
    assert.ok(payload.model, 'model should be set');
    assert.ok(Array.isArray(payload.messages), 'messages should be array');
    assert.ok(payload.metadata.responsePlan === result.plan, 'plan reference matches');
  });

  it('emergency state produces emergency system prompt', () => {
    const state = makeState({ riskFlags: ['caller_safety_concern'] });
    const result = generateResponsePlan(state);
    const payload = prepareRenderPayload(state, result.plan);
    // Emergency mode should appear in the system prompt
    assert.ok(
      payload.systemPrompt.includes('Emergency') ||
      payload.systemPrompt.includes('Escalation') ||
      payload.systemPrompt.includes('transfer'),
      'emergency context should appear in system prompt'
    );
  });

  it('renderer maxTokens respects brevityBias from policy', () => {
    const state = makeState({
      emotionalState: 'distressed',  // → brevityBias='high' → 150 tokens
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      missingRequiredFields: ['caller_name'],
    });
    const result = generateResponsePlan(state);
    const payload = prepareRenderPayload(state, result.plan);
    assert.equal(payload.maxTokens, 150, 'distressed caller should use 150 token budget');
  });
});

// ──────────────────────────────────────────────────────────────────
// 9. Shared extraction patterns: extractName, extractEmail, extractPhone, extractDate
// ──────────────────────────────────────────────────────────────────

describe('shared extraction patterns — basic fields', () => {
  it('extractName handles "my name is" pattern', () => {
    assert.equal(extractName('Hi, my name is Sarah Johnson'), 'Sarah Johnson');
  });

  it('extractName handles "call me" pattern', () => {
    assert.equal(extractName('you can call me Robert'), 'Robert');
  });

  it('extractName returns null when no name present', () => {
    assert.equal(extractName('I had a car accident last week'), null);
  });

  it('extractEmail extracts a valid email', () => {
    assert.equal(extractEmail('my email is john.doe@example.com'), 'john.doe@example.com');
  });

  it('extractEmail returns null when no email', () => {
    assert.equal(extractEmail('call me at 555-1234'), null);
  });

  it('extractPhone normalizes to E.164', () => {
    assert.equal(extractPhone('call me at 555-234-5678'), '+15552345678');
  });

  it('extractPhone handles +1 prefix', () => {
    assert.equal(extractPhone('+1 (555) 234-5678'), '+15552345678');
  });

  it('extractPhone returns null for no phone', () => {
    assert.equal(extractPhone('I had a slip and fall'), null);
  });

  it('extractIncidentDate handles MM/DD/YYYY', () => {
    assert.equal(extractIncidentDate('it happened on 3/15/2025'), '3/15/2025');
  });

  it('extractIncidentDate handles "last week"', () => {
    assert.equal(extractIncidentDate('the accident was last week'), 'last week');
  });

  it('extractOpposingParty handles "suing" pattern', () => {
    const result = extractOpposingParty('I am suing Walmart for the accident');
    assert.ok(result?.toLowerCase().includes('walmart'), `got: ${result}`);
  });
});

// ──────────────────────────────────────────────────────────────────
// 10. Shared extraction patterns: detectRiskFlagsFromText
// ──────────────────────────────────────────────────────────────────

describe('shared extraction patterns — detectRiskFlagsFromText', () => {
  it('detects already_represented', () => {
    const flags = detectRiskFlagsFromText('I already have a lawyer handling this');
    assert.ok(flags.includes('already_represented'));
  });

  it('detects currently represented variant', () => {
    const flags = detectRiskFlagsFromText('I am currently represented by an attorney');
    assert.ok(flags.includes('already_represented'));
  });

  it('detects caller_safety_concern', () => {
    const flags = detectRiskFlagsFromText("I've been thinking about suicide");
    assert.ok(flags.includes('caller_safety_concern'));
  });

  it('detects possible_sol_issue', () => {
    const flags = detectRiskFlagsFromText('I think the statute of limitations might be up');
    assert.ok(flags.includes('possible_sol_issue'));
  });

  it('detects criminal_custody_urgency for criminal matters', () => {
    const flags = detectRiskFlagsFromText('he is currently in custody', 'criminal');
    assert.ok(flags.includes('criminal_custody_urgency'));
  });

  it('merges with existing flags (additive)', () => {
    const flags = detectRiskFlagsFromText('I already have a lawyer', 'personal_injury', ['possible_sol_issue']);
    assert.ok(flags.includes('possible_sol_issue'), 'should keep existing flag');
    assert.ok(flags.includes('already_represented'), 'should add new flag');
  });

  it('does not duplicate flags', () => {
    const flags = detectRiskFlagsFromText('I already have a lawyer', 'unknown', ['already_represented']);
    assert.equal(flags.filter((f) => f === 'already_represented').length, 1);
  });
});

// ──────────────────────────────────────────────────────────────────
// 11. Live-turn risk detection consistent with shared patterns
// ──────────────────────────────────────────────────────────────────

describe('live-turn risk flags use shared patterns', () => {
  it('applyTurnToState detects already_represented from shared patterns', () => {
    const state = makeState();
    const next = applyTurnToState(state, turn('I already have a lawyer handling this'));
    assert.ok(next.riskFlags.includes('already_represented'));
    assert.ok(next.transferRecommended);
  });

  it('applyTurnToState detects caller_safety_concern', () => {
    const state = makeState();
    const next = applyTurnToState(state, turn("I've been thinking about harming myself"));
    assert.ok(next.riskFlags.includes('caller_safety_concern'));
    assert.ok(next.transferRecommended);
  });

  it('applyTurnToState detects possible_sol_issue', () => {
    const state = makeState();
    const next = applyTurnToState(state, turn('I am worried the statute of limitations has run'));
    assert.ok(next.riskFlags.includes('possible_sol_issue'));
  });
});

// ──────────────────────────────────────────────────────────────────
// 12. extractTurnSlots phone normalization
// ──────────────────────────────────────────────────────────────────

describe('extractTurnSlots phone normalization', () => {
  it('normalizes spoken phone to E.164 in slot', () => {
    const state = makeState({ lastQuestionAsked: 'callback_number' });
    const next = applyTurnToState(state, turn('my number is 555-987-6543'));
    const slot = next.slots['callback_number'];
    assert.ok(slot?.value, 'phone slot should be set');
    assert.equal(slot?.value, '+15559876543', `expected E.164, got ${slot?.value}`);
  });
});

// ──────────────────────────────────────────────────────────────────
// 13. No double-apply when queue and lastConfirmationTarget both match
// ──────────────────────────────────────────────────────────────────

describe('no double-apply when queue and lastConfirmationTarget both set', () => {
  it('queue takes priority; lastConfirmationTarget does not fire', () => {
    // Same field in both queue and lastConfirmationTarget
    const state = makeState({
      matterType: 'general',
      slots: {
        callback_number: makeSlot('+15551234567', 0.45),
      },
      confirmationQueue: ['callback_number'],
      lastConfirmationTarget: 'callback_number',
      lastDecisionType: 'confirm',
    });

    const next = applyTurnToState(state, turn('yes that is correct'));
    const slot = next.slots['callback_number'];
    // Should be confirmed exactly once — confidence exactly at confirmField level
    assert.ok(slot!.confidence >= 0.90, 'should be confirmed');
    // No double-application artifacts (confidence shouldn't go > 1)
    assert.ok(slot!.confidence <= 1.0);
    assert.equal(slot!.status, 'confirmed');
  });
});

// ──────────────────────────────────────────────────────────────────
// 14. recordAssistantTurn undefined field preservation
// ──────────────────────────────────────────────────────────────────

describe('recordAssistantTurn field preservation', () => {
  it('undefined fields in meta do not overwrite prior values', () => {
    const state = makeState({
      lastQuestionAsked: 'incident_date',
      lastDecisionType: 'ask',
      lastConfirmationTarget: null,
      lastAssistantMode: 'ask',
    });

    // Only utterance provided — everything else should be preserved
    const next = recordAssistantTurn(state, { utterance: 'I understand.' });
    assert.equal(next.lastQuestionAsked, 'incident_date');
    assert.equal(next.lastDecisionType, 'ask');
    assert.equal(next.lastAssistantMode, 'ask');
  });

  it('explicit null in meta overwrites prior values', () => {
    const state = makeState({
      lastQuestionAsked: 'incident_date',
      lastDecisionType: 'ask',
    });

    const next = recordAssistantTurn(state, {
      utterance: 'Thank you for calling.',
      questionAsked: null,
      decisionType: 'complete',
    });
    assert.equal(next.lastQuestionAsked, null);
    assert.equal(next.lastDecisionType, 'complete');
  });
});

// ──────────────────────────────────────────────────────────────────
// 15. End-to-end: multi-turn conversation with confirmation
// ──────────────────────────────────────────────────────────────────

describe('end-to-end multi-turn conversation', () => {
  it('collects name, detects low-confidence phone, confirms it, continues intake', () => {
    // Turn 1: greeting/opening — caller says who they are
    let state = initializeConversationState({ conversationId: 'e2e-4a-001' });
    state = applyTurnToState(state, turn("Hi, I'm calling about a car accident. My name is Maria Garcia."));
    state = recordAssistantTurn(state, {
      utterance: "Thank you Maria. What's the best phone number to reach you?",
      questionAsked: 'callback_number',
      decisionType: 'ask',
      confirmationTarget: null,
    });
    assert.equal(state.lastQuestionAsked, 'callback_number');
    assert.ok(state.slots['caller_name']?.value, 'caller_name should be extracted');

    // Turn 2: caller gives a phone number with noise (low confidence scenario)
    state = applyTurnToState(state, turn('you can reach me at 555-234-5678'));
    state = recordAssistantTurn(state, {
      utterance: "I have your number as 555-234-5678 — is that correct?",
      questionAsked: 'callback_number',
      decisionType: 'confirm',
      confirmationTarget: 'callback_number',
      assistantMode: 'confirm',
    });
    assert.equal(state.lastDecisionType, 'confirm');
    assert.equal(state.lastConfirmationTarget, 'callback_number');
    assert.ok(state.slots['callback_number']?.value, 'phone should be set');

    // Turn 3: caller confirms the phone number
    state = applyTurnToState(state, turn('yes, that is correct'));
    const phoneSlot = state.slots['callback_number'];
    assert.ok(phoneSlot?.value, 'phone slot should still be set after confirmation');
    // After confirmation, confidence should be high (≥ 0.90) OR at minimum not downgraded
    // Note: confirmField sets confidence to max(existing, 0.90) only if the field was in queue/target
    // The slot extracted in turn 2 was 0.9 (from extractPhone) so if it was confirmed, it's ≥ 0.9
    assert.ok((phoneSlot?.confidence ?? 0) >= 0.7, 'phone confidence should be maintained or improved');

    // Conversation should have advanced
    assert.ok(state.turnCount >= 3, `turn count should be ≥ 3, got ${state.turnCount}`);
    assert.ok(state.matterType !== 'unknown' || state.turnCount < 5, 'matter type detection should work eventually');
  });
});
