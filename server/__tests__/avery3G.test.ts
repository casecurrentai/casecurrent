/**
 * Avery 3G tests — repetition control, confirmation/handoff realization,
 * and conversational variety within guardrails.
 *
 * Covers:
 *   1.  selectAcknowledgmentPhrase — warm pool for distressed/anxious callers
 *   2.  selectAcknowledgmentPhrase — neutral pool for calm callers
 *   3.  selectAcknowledgmentPhrase — null when allowAcknowledgment=false
 *   4.  selectAcknowledgmentPhrase — null for terminal modes (handoff/complete/emergency)
 *   5.  selectAcknowledgmentPhrase — cycles through pool (no repeat when last utterance matches)
 *   6.  selectIntroPhrase — correct pool by mode (confirm/repair/handoff/complete)
 *   7.  selectIntroPhrase — null for ask and emergency modes
 *   8.  selectIntroPhrase — avoids literal repeat from last utterance
 *   9.  deriveConfirmationShape — callback_number explicit read-back required
 *  10.  deriveConfirmationShape — conflicting field → requiresConflictFraming=true
 *  11.  deriveConfirmationShape — gentle field → requiresReadBack=false
 *  12.  deriveConfirmationShape — formats phone number in readBackHint
 *  13.  buildContextualReference — confirm mode returns "I have X as Y"
 *  14.  buildContextualReference — repair mode returns "You mentioned X as Y"
 *  15.  buildContextualReference — handoff returns brief field summary
 *  16.  buildContextualReference — null for ask and emergency modes
 *  17.  buildHandoffSummary — lists top 2 captured fields with labels
 *  18.  buildHandoffSummary — null when nothing captured
 *  19.  buildVariationContext — full shape for confirm turn
 *  20.  buildVariationContext — allowContextualReference true for confirm/repair/handoff
 *  21.  buildVariationContext — allowContextualReference false for ask
 *  22.  buildVariationContext — isHandoffTurn/isEmergencyTurn flags set correctly
 *  23.  ResponsePlan carries variationContext from generateResponsePlan
 *  24.  PlannerResult.debugInfo exposes variationContext
 *  25.  Renderer system prompt includes Variation Guidance section
 *  26.  Renderer emergency mode produces direct framing
 *  27.  Renderer handoff mode signals no new questions
 *  28.  Required spec scenarios (7 mandated)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { initializeConversationState } from '../avery/state/conversation-state';
import { applyTurnToState } from '../avery/state/state-updater';
import { generateResponsePlan } from '../avery/planner/dialogue-planner';
import {
  selectAcknowledgmentPhrase,
  selectIntroPhrase,
  deriveConfirmationShape,
  buildVariationContext,
} from '../avery/planner/response-variation';
import {
  buildContextualReference,
  buildHandoffSummary,
} from '../avery/planner/contextual-reference';
import { deriveResponsePolicy } from '../avery/planner/response-policy';
import { prepareRenderPayload } from '../avery/llm/avery-renderer';
import type {
  ConversationState,
  StateSlot,
  TurnInput,
  NextQuestionDecision,
  IntakeReadiness,
  ResponsePolicy,
} from '../avery/types';
import type { RepairDecision } from '../avery/state/repair-decision';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<ConversationState> = {}): ConversationState {
  const base = initializeConversationState({ conversationId: 'test-3g-001' });
  return {
    ...base,
    confirmationQueue: [],
    lowConfidenceRequiredFields: [],
    conflictingRequiredFields: [],
    optionalFieldsRemaining: [],
    ...overrides,
  };
}

function makeSlot(value: unknown, confidence: number, extra: Partial<StateSlot> = {}): StateSlot {
  return { value, confidence, source: 'caller', updatedAt: new Date().toISOString(), ...extra };
}

function makeTurn(utterance: string, extra: Partial<TurnInput> = {}): TurnInput {
  return { utterance, ...extra };
}

function makeDecision(
  type: NextQuestionDecision['type'],
  targetField: string | null = null,
): NextQuestionDecision {
  return {
    type,
    targetField,
    objective: `${type}:${targetField ?? 'none'}`,
    rationale: 'test',
    repairStrategy: null,
  };
}

const NO_REPAIR: RepairDecision = {
  needed: false,
  targetField: null,
  repairType: 'none',
  triggerReason: 'none',
  rationale: 'no repair needed',
};

function policyFor(
  state: ConversationState,
  type: NextQuestionDecision['type'],
  targetField: string | null = null,
): ResponsePolicy {
  return deriveResponsePolicy(state, makeDecision(type, targetField), NO_REPAIR, 'incomplete');
}

// ──────────────────────────────────────────────────────────────────
// 1–5. selectAcknowledgmentPhrase
// ──────────────────────────────────────────────────────────────────

describe('selectAcknowledgmentPhrase — warm pool for emotional callers', () => {
  it('distressed caller gets warm acknowledgment', () => {
    const state = makeState({ emotionalState: 'distressed' });
    const policy = policyFor(state, 'ask', 'caller_name');
    // Make an allowAcknowledgment-true policy manually (distressed → allowAcknowledgment=true)
    const warmPolicy: ResponsePolicy = { ...policy, allowAcknowledgment: true };
    const phrase = selectAcknowledgmentPhrase('distressed', warmPolicy, 1, null);
    assert.ok(phrase, 'Should return a phrase');
    // Warm pool phrases include empathy language
    const WARM_PHRASES = ["I'm sorry to hear that.", 'Thank you for sharing that.', 'I understand this is difficult.', "I'm glad you reached out."];
    assert.ok(WARM_PHRASES.includes(phrase), `Expected warm phrase, got: "${phrase}"`);
  });

  it('anxious caller gets warm acknowledgment', () => {
    const policy: ResponsePolicy = { ...policyFor(makeState(), 'ask'), allowAcknowledgment: true };
    const phrase = selectAcknowledgmentPhrase('anxious', policy, 0, null);
    const WARM = ["I'm sorry to hear that.", 'Thank you for sharing that.', 'I understand this is difficult.', "I'm glad you reached out."];
    assert.ok(phrase && WARM.includes(phrase));
  });

  it('calm caller gets neutral acknowledgment', () => {
    const policy: ResponsePolicy = { ...policyFor(makeState(), 'ask'), allowAcknowledgment: true };
    const phrase = selectAcknowledgmentPhrase('calm', policy, 0, null);
    const NEUTRAL = ['Got it.', 'Thank you.', 'Okay.', 'I see.', 'Understood.'];
    assert.ok(phrase && NEUTRAL.includes(phrase), `Expected neutral phrase, got: "${phrase}"`);
  });
});

describe('selectAcknowledgmentPhrase — returns null when not allowed', () => {
  it('returns null when allowAcknowledgment=false', () => {
    const policy: ResponsePolicy = { ...policyFor(makeState(), 'ask'), allowAcknowledgment: false };
    assert.equal(selectAcknowledgmentPhrase('calm', policy, 0, null), null);
  });

  it('returns null for handoff mode', () => {
    const policy: ResponsePolicy = { ...policyFor(makeState(), 'ask'), mode: 'handoff', allowAcknowledgment: true };
    assert.equal(selectAcknowledgmentPhrase('calm', policy, 0, null), null);
  });

  it('returns null for emergency mode', () => {
    const policy: ResponsePolicy = { ...policyFor(makeState(), 'ask'), mode: 'emergency', allowAcknowledgment: true };
    assert.equal(selectAcknowledgmentPhrase('calm', policy, 0, null), null);
  });
});

describe('selectAcknowledgmentPhrase — repetition avoidance', () => {
  it('avoids exact repeat from last assistant utterance', () => {
    const policy: ResponsePolicy = { ...policyFor(makeState(), 'ask'), allowAcknowledgment: true };

    // Get which phrase would be selected at turn 0
    const firstPhrase = selectAcknowledgmentPhrase('calm', policy, 0, null);
    assert.ok(firstPhrase);

    // Now simulate that phrase appearing in last utterance — should bump to next
    const secondPhrase = selectAcknowledgmentPhrase('calm', policy, 0, firstPhrase);
    assert.ok(secondPhrase);
    assert.notEqual(firstPhrase, secondPhrase);
  });

  it('cycles through variants across turns', () => {
    const policy: ResponsePolicy = { ...policyFor(makeState(), 'ask'), allowAcknowledgment: true };
    const phrases = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const p = selectAcknowledgmentPhrase('calm', policy, i, null);
      if (p) phrases.add(p);
    }
    // Should have used at least 2 different phrases across 5 turns
    assert.ok(phrases.size >= 2, `Expected phrase variety, got: ${[...phrases].join(', ')}`);
  });
});

// ──────────────────────────────────────────────────────────────────
// 6–8. selectIntroPhrase
// ──────────────────────────────────────────────────────────────────

describe('selectIntroPhrase — mode-correct pools', () => {
  it('confirm mode → confirmation intro', () => {
    const phrase = selectIntroPhrase('confirm', 0, null);
    const CONFIRM_INTROS = ['Let me confirm what I have.', 'I want to make sure I have that right.', 'Let me double-check that with you.', 'Just to verify—'];
    assert.ok(phrase && CONFIRM_INTROS.includes(phrase), `Got: "${phrase}"`);
  });

  it('repair mode → repair intro', () => {
    const phrase = selectIntroPhrase('repair', 0, null);
    const REPAIR_INTROS = ['Let me try that again.', 'Let me rephrase that.', 'Let me ask that differently.', 'I want to make sure I understand.'];
    assert.ok(phrase && REPAIR_INTROS.includes(phrase), `Got: "${phrase}"`);
  });

  it('handoff mode → handoff intro', () => {
    const phrase = selectIntroPhrase('handoff', 0, null);
    const HANDOFF_INTROS = ["Based on what you've shared,", 'I have the information I need,', 'Thank you for providing that,'];
    assert.ok(phrase && HANDOFF_INTROS.includes(phrase), `Got: "${phrase}"`);
  });

  it('complete mode → completion intro', () => {
    const phrase = selectIntroPhrase('complete', 0, null);
    const COMPLETE_INTROS = ['Thank you for your time today.', "We've covered everything I need.", "That's everything for now."];
    assert.ok(phrase && COMPLETE_INTROS.includes(phrase), `Got: "${phrase}"`);
  });

  it('ask mode → null (no special intro)', () => {
    assert.equal(selectIntroPhrase('ask', 0, null), null);
  });

  it('emergency mode → null', () => {
    assert.equal(selectIntroPhrase('emergency', 0, null), null);
  });

  it('avoids exact repeat from last utterance', () => {
    const first = selectIntroPhrase('confirm', 0, null);
    assert.ok(first);
    const second = selectIntroPhrase('confirm', 0, first);
    assert.ok(second);
    assert.notEqual(first, second);
  });
});

// ──────────────────────────────────────────────────────────────────
// 9–12. deriveConfirmationShape
// ──────────────────────────────────────────────────────────────────

describe('deriveConfirmationShape', () => {
  it('callback_number with explicit policy → requiresReadBack=true', () => {
    const state = makeState({
      slots: { callback_number: makeSlot('+15551234567', 0.9) },
    });
    const policy = policyFor(state, 'confirm', 'callback_number');
    const shape = deriveConfirmationShape('callback_number', state, policy);
    assert.equal(shape.requiresReadBack, true);
    assert.equal(shape.fieldLabel, 'your phone number');
  });

  it('callback_number formats phone in readBackHint', () => {
    const state = makeState({
      slots: { callback_number: makeSlot('+15551234567', 0.9) },
    });
    const policy = policyFor(state, 'confirm', 'callback_number');
    const shape = deriveConfirmationShape('callback_number', state, policy);
    assert.equal(shape.readBackHint, '555-123-4567');
  });

  it('conflicting field → requiresConflictFraming=true', () => {
    const state = makeState({
      slots: { incident_date: makeSlot('March 5th', 0.7, { conflictFlag: true }) },
    });
    const policy = policyFor(state, 'confirm', 'incident_date');
    const shape = deriveConfirmationShape('incident_date', state, policy);
    assert.equal(shape.requiresConflictFraming, true);
  });

  it('gentle policy field → requiresReadBack=false', () => {
    const state = makeState({
      slots: { incident_date: makeSlot('last week', 0.45, { needsConfirmation: true }) },
    });
    // incident_date with gentle policy (no explicit/binary style)
    const policy: ResponsePolicy = {
      ...policyFor(state, 'confirm', 'incident_date'),
      confirmationStyle: 'gentle',
    };
    const shape = deriveConfirmationShape('incident_date', state, policy);
    assert.equal(shape.requiresReadBack, false);
    assert.equal(shape.requiresConflictFraming, false);
  });

  it('field with no slot value → readBackHint=null', () => {
    const state = makeState();
    const policy = policyFor(state, 'confirm', 'incident_date');
    const shape = deriveConfirmationShape('incident_date', state, policy);
    assert.equal(shape.readBackHint, null);
  });
});

// ──────────────────────────────────────────────────────────────────
// 13–16. buildContextualReference
// ──────────────────────────────────────────────────────────────────

describe('buildContextualReference — confirm mode', () => {
  it('confirm mode returns "I have X as Y"', () => {
    const state = makeState({
      slots: { callback_number: makeSlot('+15551234567', 0.9) },
    });
    const ref = buildContextualReference(state, 'callback_number', 'confirm');
    assert.ok(ref);
    assert.ok(ref.includes('I have'));
    assert.ok(ref.includes('555-123-4567'));
  });

  it('confirm mode with caller_name', () => {
    const state = makeState({
      slots: { caller_name: makeSlot('Jane Doe', 0.8) },
    });
    const ref = buildContextualReference(state, 'caller_name', 'confirm');
    assert.ok(ref?.includes('Jane Doe'));
    assert.ok(ref?.includes('your name'));
  });

  it('confirm mode returns null if no slot value', () => {
    const state = makeState();
    const ref = buildContextualReference(state, 'incident_date', 'confirm');
    assert.equal(ref, null);
  });
});

describe('buildContextualReference — repair mode', () => {
  it('repair mode returns "You mentioned X as Y"', () => {
    const state = makeState({
      slots: { incident_date: makeSlot('last week', 0.4) },
    });
    const ref = buildContextualReference(state, 'incident_date', 'repair');
    assert.ok(ref);
    assert.ok(ref.includes('You mentioned'));
    assert.ok(ref.includes('last week'));
  });
});

describe('buildContextualReference — handoff mode', () => {
  it('handoff returns brief summary of captured fields', () => {
    const state = makeState({
      slots: {
        caller_name: makeSlot('Alice Smith', 0.9),
        callback_number: makeSlot('+15551234567', 0.9),
      },
    });
    const ref = buildContextualReference(state, null, 'handoff');
    assert.ok(ref);
    assert.ok(ref.includes('Alice Smith'));
  });

  it('handoff returns null when nothing captured', () => {
    const state = makeState();
    const ref = buildContextualReference(state, null, 'handoff');
    assert.equal(ref, null);
  });
});

describe('buildContextualReference — ask/emergency return null', () => {
  it('ask mode returns null', () => {
    const state = makeState({ slots: { caller_name: makeSlot('John', 0.8) } });
    assert.equal(buildContextualReference(state, 'caller_name', 'ask'), null);
  });

  it('emergency mode returns null', () => {
    const state = makeState({ slots: { caller_name: makeSlot('John', 0.8) } });
    assert.equal(buildContextualReference(state, 'caller_name', 'emergency'), null);
  });
});

// ──────────────────────────────────────────────────────────────────
// 17–18. buildHandoffSummary
// ──────────────────────────────────────────────────────────────────

describe('buildHandoffSummary', () => {
  it('lists top 2 captured fields with labels', () => {
    const state = makeState({
      slots: {
        caller_name: makeSlot('Bob Jones', 0.9),
        callback_number: makeSlot('+15559998888', 0.9),
        incident_date: makeSlot('March 10th', 0.7),
      },
    });
    const summary = buildHandoffSummary(state);
    assert.ok(summary);
    assert.ok(summary.includes('Bob Jones'));
    // Should include at most 2 fields (name + phone)
    assert.ok(!summary.includes('March 10th'), 'Should cap at 2 fields');
  });

  it('returns null when nothing captured', () => {
    const state = makeState();
    assert.equal(buildHandoffSummary(state), null);
  });

  it('skips conflicting slots', () => {
    const state = makeState({
      slots: {
        caller_name: makeSlot('Bad Name', 0.7, { conflictFlag: true }),
        callback_number: makeSlot('+15551234567', 0.9),
      },
    });
    const summary = buildHandoffSummary(state);
    // Should use callback_number (not conflicting) but skip caller_name
    assert.ok(summary);
    assert.ok(!summary.includes('Bad Name'));
    assert.ok(summary.includes('555-123-4567'));
  });
});

// ──────────────────────────────────────────────────────────────────
// 19–22. buildVariationContext
// ──────────────────────────────────────────────────────────────────

describe('buildVariationContext — confirm turn', () => {
  it('confirm turn has confirmationShape when targetField present', () => {
    const state = makeState({
      slots: { callback_number: makeSlot('+15551234567', 0.9, { needsConfirmation: true }) },
      confirmationQueue: ['callback_number'],
    });
    const policy = policyFor(state, 'confirm', 'callback_number');
    const ctx = buildVariationContext(state, policy, makeDecision('confirm', 'callback_number'));
    assert.ok(ctx.confirmationShape);
    assert.equal(ctx.confirmationShape.fieldLabel, 'your phone number');
    assert.ok(ctx.allowContextualReference);
  });

  it('confirm turn sets contextualReference when field has value', () => {
    const state = makeState({
      slots: { caller_name: makeSlot('Jane Doe', 0.7) },
    });
    const policy = policyFor(state, 'confirm', 'caller_name');
    const ctx = buildVariationContext(state, policy, makeDecision('confirm', 'caller_name'));
    assert.ok(ctx.contextualReference);
    assert.ok(ctx.contextualReference.includes('Jane Doe'));
  });
});

describe('buildVariationContext — allowContextualReference by mode', () => {
  it('true for confirm', () => {
    const state = makeState();
    const policy = policyFor(state, 'confirm', 'incident_date');
    const ctx = buildVariationContext(state, policy, makeDecision('confirm', 'incident_date'));
    assert.equal(ctx.allowContextualReference, true);
  });

  it('true for repair', () => {
    const state = makeState();
    const policy: ResponsePolicy = { ...policyFor(state, 'repair', 'incident_date'), mode: 'repair' };
    const ctx = buildVariationContext(state, policy, makeDecision('repair', 'incident_date'));
    assert.equal(ctx.allowContextualReference, true);
  });

  it('true for handoff', () => {
    const state = makeState();
    const policy: ResponsePolicy = { ...policyFor(state, 'escalate'), mode: 'handoff' };
    const ctx = buildVariationContext(state, policy, makeDecision('escalate'));
    assert.equal(ctx.allowContextualReference, true);
  });

  it('false for ask', () => {
    const state = makeState();
    const policy = policyFor(state, 'ask', 'caller_name');
    const ctx = buildVariationContext(state, policy, makeDecision('ask', 'caller_name'));
    assert.equal(ctx.allowContextualReference, false);
  });
});

describe('buildVariationContext — terminal flags', () => {
  it('isHandoffTurn=true for handoff mode', () => {
    const state = makeState();
    const policy: ResponsePolicy = { ...policyFor(state, 'escalate'), mode: 'handoff', maxQuestions: 0 };
    const ctx = buildVariationContext(state, policy, makeDecision('escalate'));
    assert.equal(ctx.isHandoffTurn, true);
    assert.equal(ctx.isEmergencyTurn, false);
  });

  it('isHandoffTurn=true for complete mode', () => {
    const state = makeState();
    const policy: ResponsePolicy = { ...policyFor(state, 'complete'), mode: 'complete', maxQuestions: 0 };
    const ctx = buildVariationContext(state, policy, makeDecision('complete'));
    assert.equal(ctx.isHandoffTurn, true);
  });

  it('isEmergencyTurn=true for emergency mode', () => {
    const state = makeState({ riskFlags: ['caller_safety_concern'] });
    const policy: ResponsePolicy = { ...policyFor(state, 'escalate'), mode: 'emergency', maxQuestions: 0 };
    const ctx = buildVariationContext(state, policy, makeDecision('escalate'));
    assert.equal(ctx.isEmergencyTurn, true);
    assert.equal(ctx.isHandoffTurn, false);
  });
});

// ──────────────────────────────────────────────────────────────────
// 23–24. ResponsePlan and debugInfo carry variationContext
// ──────────────────────────────────────────────────────────────────

describe('ResponsePlan carries variationContext', () => {
  it('plan.variationContext is present after generateResponsePlan', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      missingRequiredFields: ['caller_name', 'callback_number'],
    });
    const result = generateResponsePlan(state);
    assert.ok(result.plan.variationContext, 'variationContext should be present');
    assert.ok(typeof result.plan.variationContext.isHandoffTurn === 'boolean');
    assert.ok(typeof result.plan.variationContext.isEmergencyTurn === 'boolean');
    assert.ok(typeof result.plan.variationContext.allowContextualReference === 'boolean');
  });

  it('debugInfo exposes variationContext', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      missingRequiredFields: ['caller_name'],
    });
    const result = generateResponsePlan(state);
    assert.ok(result.debugInfo.variationContext);
  });
});

// ──────────────────────────────────────────────────────────────────
// 25–27. Renderer system prompt sections
// ──────────────────────────────────────────────────────────────────

describe('prepareRenderPayload — Variation Guidance section', () => {
  it('system prompt includes Variation Guidance section', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      missingRequiredFields: ['caller_name'],
    });
    const result = generateResponsePlan(state);
    const payload = prepareRenderPayload(state, result.plan);
    assert.ok(
      payload.systemPrompt.includes('## Variation Guidance'),
      'Should have Variation Guidance section',
    );
  });

  it('emergency mode system prompt is direct and action-first', () => {
    const state = makeState({ riskFlags: ['caller_safety_concern'] });
    const result = generateResponsePlan(state);
    // If policy is emergency, variation guidance says direct/action-first
    if (result.plan.variationContext?.isEmergencyTurn) {
      const payload = prepareRenderPayload(state, result.plan);
      assert.ok(payload.systemPrompt.includes('Emergency') || payload.systemPrompt.includes('direct'));
    }
    // Non-emergency just verify structure is present
    assert.ok(result.plan.variationContext !== undefined);
  });

  it('handoff turn variation guidance forbids new questions', () => {
    // Build a state that drives escalation
    let state = makeState({
      riskFlags: ['already_represented'],
      transferRecommended: true,
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
    });
    const result = generateResponsePlan(state);
    const payload = prepareRenderPayload(state, result.plan);
    const prompt = payload.systemPrompt;

    // If this is a handoff turn, the variation section should say "do not ask new questions"
    if (result.plan.variationContext?.isHandoffTurn) {
      assert.ok(
        prompt.includes('do not ask any new questions') || prompt.includes('handoff'),
        'Handoff variation guidance should forbid new questions',
      );
    }
    // Always: output policy should exist
    assert.ok(prompt.includes('## Output Policy'));
  });
});

// ──────────────────────────────────────────────────────────────────
// 28. Required spec scenarios (7 mandated)
// ──────────────────────────────────────────────────────────────────

describe('3G spec: required scenarios', () => {
  // Scenario 1: Repeated acknowledgment phrase is avoided
  it('Scenario 1: repeated acknowledgment phrase is avoided', () => {
    const policy: ResponsePolicy = {
      ...policyFor(makeState(), 'ask'),
      allowAcknowledgment: true,
      mode: 'ask',
    };
    const firstPhrase = selectAcknowledgmentPhrase('calm', policy, 0, null);
    assert.ok(firstPhrase);
    // Simulate last utterance contained this exact phrase
    const secondPhrase = selectAcknowledgmentPhrase('calm', policy, 0, `Okay. ${firstPhrase} How can I help?`);
    assert.ok(secondPhrase);
    assert.notEqual(
      firstPhrase,
      secondPhrase,
      'Should not repeat same phrase when it appears in last utterance',
    );
  });

  // Scenario 2: Callback number confirmation requires explicit read-back
  it('Scenario 2: callback_number confirmation requires explicit read-back guidance', () => {
    const state = makeState({
      slots: { callback_number: makeSlot('+15551234567', 0.9, { needsConfirmation: true }) },
      confirmationQueue: ['callback_number'],
    });
    const policy = policyFor(state, 'confirm', 'callback_number');
    const shape = deriveConfirmationShape('callback_number', state, policy);
    assert.equal(shape.requiresReadBack, true);
    assert.ok(shape.readBackHint?.includes('555-123-4567'));
    assert.equal(shape.fieldLabel, 'your phone number');
  });

  // Scenario 3: Conflicting field → conflict-resolution framing
  it('Scenario 3: conflicting field confirmation includes conflict-resolution framing', () => {
    const state = makeState({
      slots: {
        incident_date: makeSlot('March 5th', 0.7, { conflictFlag: true }),
      },
    });
    const policy = policyFor(state, 'confirm', 'incident_date');
    const shape = deriveConfirmationShape('incident_date', state, policy);
    assert.equal(shape.requiresConflictFraming, true);
    assert.equal(shape.fieldLabel, 'the date of the incident');
  });

  // Scenario 4: Handoff mode forbids new question behavior
  it('Scenario 4: handoff mode variationContext.isHandoffTurn=true, maxQuestions=0', () => {
    const state = makeState({ riskFlags: [] });
    const policy = deriveResponsePolicy(state, makeDecision('escalate'), NO_REPAIR, 'ready_for_handoff');
    assert.equal(policy.mode, 'handoff');
    assert.equal(policy.maxQuestions, 0);
    const ctx = buildVariationContext(state, policy, makeDecision('escalate'));
    assert.equal(ctx.isHandoffTurn, true);
    assert.equal(ctx.isEmergencyTurn, false);
  });

  // Scenario 5: Emergency mode produces urgent minimal guidance
  it('Scenario 5: emergency mode isEmergencyTurn=true, direct framing in renderer', () => {
    const state = makeState({ riskFlags: ['caller_safety_concern'] });
    const policy = deriveResponsePolicy(state, makeDecision('escalate'), NO_REPAIR, 'incomplete');
    assert.equal(policy.mode, 'emergency');
    assert.equal(policy.maxQuestions, 0);
    const ctx = buildVariationContext(state, policy, makeDecision('escalate'));
    assert.equal(ctx.isEmergencyTurn, true);
    assert.equal(ctx.introPhraseHint, null); // emergency has no intro
    assert.equal(ctx.acknowledgmentPhrase, null); // emergency has no acknowledgment
  });

  // Scenario 6: Contextual reference allowed for confirmation but not routine ask
  it('Scenario 6: contextual reference allowed for confirm, not for ask', () => {
    const state = makeState({
      slots: { caller_name: makeSlot('Sarah Lee', 0.8) },
    });

    const confirmPolicy = policyFor(state, 'confirm', 'caller_name');
    const confirmCtx = buildVariationContext(state, confirmPolicy, makeDecision('confirm', 'caller_name'));
    assert.equal(confirmCtx.allowContextualReference, true);
    assert.ok(confirmCtx.contextualReference?.includes('Sarah Lee'));

    const askPolicy = policyFor(state, 'ask', 'incident_date');
    const askCtx = buildVariationContext(state, askPolicy, makeDecision('ask', 'incident_date'));
    assert.equal(askCtx.allowContextualReference, false);
    assert.equal(askCtx.contextualReference, null);
  });

  // Scenario 7: Response plan carries variation/context guidance correctly
  it('Scenario 7: response plan carries variationContext with all required fields', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      missingRequiredFields: ['caller_name', 'callback_number', 'incident_date', 'short_matter_summary', 'injury_type'],
    });
    const result = generateResponsePlan(state);
    const ctx = result.plan.variationContext;
    assert.ok(ctx, 'variationContext must be present on plan');
    assert.ok(typeof ctx.acknowledgmentPhrase === 'string' || ctx.acknowledgmentPhrase === null);
    assert.ok(typeof ctx.introPhraseHint === 'string' || ctx.introPhraseHint === null);
    assert.ok(typeof ctx.allowContextualReference === 'boolean');
    assert.ok(typeof ctx.contextualReference === 'string' || ctx.contextualReference === null);
    assert.ok(typeof ctx.isHandoffTurn === 'boolean');
    assert.ok(typeof ctx.isEmergencyTurn === 'boolean');
    // Normal intake ask: should not be handoff or emergency
    assert.equal(ctx.isHandoffTurn, false);
    assert.equal(ctx.isEmergencyTurn, false);
  });
});
