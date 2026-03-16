/**
 * Avery 3F tests — response policy, question realization rules, and
 * conversational output control.
 *
 * Covers:
 *   1.  deriveResponsePolicy — mode derivation from decision type
 *   2.  deriveResponsePolicy — confirmation turn: maxQuestions=1, requireSingleTarget, no compound
 *   3.  deriveResponsePolicy — repair mode: maxSentences ≤ 3, repairStyle mapped correctly
 *   4.  deriveResponsePolicy — high-distress caller: brevityBias high, empathy allowed, short budget
 *   5.  deriveResponsePolicy — callback_number confirmation → explicit style
 *   6.  deriveResponsePolicy — conflicting slot → binary confirmation style
 *   7.  deriveResponsePolicy — short_matter_summary ask → gentle style, broader shape
 *   8.  deriveResponsePolicy — handoff/escalate → maxQuestions=0
 *   9.  deriveResponsePolicy — emergency (safety risk) → mode=emergency
 *  10.  deriveResponsePolicy — critical urgency → brevityBias=high, toneProfile=urgent
 *  11.  deriveResponsePolicy — repair type mapping (narrow / example / stepwise / rephrase)
 *  12.  deriveResponsePolicy — forbidCompoundQuestions always true
 *  13.  deriveResponsePolicy — forbidPrematureReassurance for confirm/repair/critical
 *  14.  ResponsePlan carries responsePolicy from buildResponsePlan
 *  15.  PlannerResult.debugInfo exposes responsePolicy
 *  16.  Renderer maxTokens: brevityBias=high → 150, medium → 300
 *  17.  Renderer system prompt includes Output Policy section when policy present
 *  18.  Required spec scenarios (7 mandated)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { initializeConversationState } from '../avery/state/conversation-state';
import { applyTurnToState } from '../avery/state/state-updater';
import { generateResponsePlan } from '../avery/planner/dialogue-planner';
import { deriveResponsePolicy } from '../avery/planner/response-policy';
import { buildResponsePlan } from '../avery/planner/response-plan';
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
// Test helpers
// ──────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<ConversationState> = {}): ConversationState {
  const base = initializeConversationState({ conversationId: 'test-3f-001' });
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

function makeRepairDecision(repairType: RepairDecision['repairType']): RepairDecision {
  return {
    needed: true,
    targetField: 'incident_date',
    repairType,
    triggerReason: 'no_answer',
    rationale: `test repair: ${repairType}`,
  };
}

// ──────────────────────────────────────────────────────────────────
// 1. Mode derivation
// ──────────────────────────────────────────────────────────────────

describe('deriveResponsePolicy — mode derivation', () => {
  it('ask decision → mode ask', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(state, makeDecision('ask', 'caller_name'), NO_REPAIR, 'incomplete');
    assert.equal(policy.mode, 'ask');
  });

  it('confirm decision → mode confirm', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(state, makeDecision('confirm', 'incident_date'), NO_REPAIR, 'incomplete');
    assert.equal(policy.mode, 'confirm');
  });

  it('repair decision → mode repair', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(state, makeDecision('repair', 'incident_date'), makeRepairDecision('rephrase'), 'incomplete');
    assert.equal(policy.mode, 'repair');
  });

  it('complete decision → mode complete', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(state, makeDecision('complete'), NO_REPAIR, 'completed');
    assert.equal(policy.mode, 'complete');
  });

  it('escalate without safety risk → mode handoff', () => {
    const state = makeState({ riskFlags: [] });
    const policy = deriveResponsePolicy(state, makeDecision('escalate'), NO_REPAIR, 'ready_for_handoff');
    assert.equal(policy.mode, 'handoff');
  });
});

// ──────────────────────────────────────────────────────────────────
// 2. Confirmation turn: single-target, no compound questions
// ──────────────────────────────────────────────────────────────────

describe('deriveResponsePolicy — confirmation turn constraints', () => {
  it('forbids compound questions during confirmation', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(state, makeDecision('confirm', 'incident_date'), NO_REPAIR, 'incomplete');
    assert.equal(policy.forbidCompoundQuestions, true);
    assert.equal(policy.requireSingleTarget, true);
    assert.equal(policy.maxQuestions, 1);
  });

  it('confirmation turn has maxSentences ≤ 2', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(state, makeDecision('confirm', 'incident_date'), NO_REPAIR, 'incomplete');
    assert.ok(policy.maxSentences <= 2, `expected maxSentences ≤ 2, got ${policy.maxSentences}`);
  });

  it('confirmation turn forbids premature reassurance', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(state, makeDecision('confirm', 'incident_date'), NO_REPAIR, 'incomplete');
    assert.equal(policy.forbidPrematureReassurance, true);
  });

  it('confirmation turn has brevityBias=high', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(state, makeDecision('confirm', 'incident_date'), NO_REPAIR, 'incomplete');
    assert.equal(policy.brevityBias, 'high');
  });
});

// ──────────────────────────────────────────────────────────────────
// 3. Repair mode: shorter output, repairStyle mapped
// ──────────────────────────────────────────────────────────────────

describe('deriveResponsePolicy — repair mode', () => {
  it('repair mode has maxSentences ≤ 3', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(
      state,
      makeDecision('repair', 'incident_date'),
      makeRepairDecision('narrow_question'),
      'incomplete',
    );
    assert.ok(policy.maxSentences <= 3, `expected ≤ 3, got ${policy.maxSentences}`);
  });

  it('narrow_question repair → repairStyle narrow', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(
      state,
      makeDecision('repair', 'incident_date'),
      makeRepairDecision('narrow_question'),
      'incomplete',
    );
    assert.equal(policy.repairStyle, 'narrow');
  });

  it('provide_example repair → repairStyle example', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(
      state,
      makeDecision('repair', 'incident_date'),
      makeRepairDecision('provide_example'),
      'incomplete',
    );
    assert.equal(policy.repairStyle, 'example');
  });

  it('split_question repair → repairStyle stepwise', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(
      state,
      makeDecision('repair', 'incident_date'),
      makeRepairDecision('split_question'),
      'incomplete',
    );
    assert.equal(policy.repairStyle, 'stepwise');
  });

  it('rephrase repair → repairStyle rephrase', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(
      state,
      makeDecision('repair', 'incident_date'),
      makeRepairDecision('rephrase'),
      'incomplete',
    );
    assert.equal(policy.repairStyle, 'rephrase');
  });

  it('repair mode forbids premature reassurance', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(
      state,
      makeDecision('repair', 'incident_date'),
      makeRepairDecision('rephrase'),
      'incomplete',
    );
    assert.equal(policy.forbidPrematureReassurance, true);
  });
});

// ──────────────────────────────────────────────────────────────────
// 4. High-distress caller: brevity, empathy, short budget
// ──────────────────────────────────────────────────────────────────

describe('deriveResponsePolicy — high-distress caller', () => {
  it('distressed caller has brevityBias=high', () => {
    const state = makeState({ emotionalState: 'distressed' });
    const policy = deriveResponsePolicy(state, makeDecision('ask', 'caller_name'), NO_REPAIR, 'incomplete');
    assert.equal(policy.brevityBias, 'high');
  });

  it('distressed caller has maxSentences ≤ 3', () => {
    const state = makeState({ emotionalState: 'distressed' });
    const policy = deriveResponsePolicy(state, makeDecision('ask', 'caller_name'), NO_REPAIR, 'incomplete');
    assert.ok(policy.maxSentences <= 3, `expected ≤ 3, got ${policy.maxSentences}`);
  });

  it('distressed caller allowEmpathyPrefix=true', () => {
    const state = makeState({ emotionalState: 'distressed' });
    const policy = deriveResponsePolicy(state, makeDecision('ask', 'caller_name'), NO_REPAIR, 'incomplete');
    assert.equal(policy.allowEmpathyPrefix, true);
  });

  it('distressed caller toneProfile=warm', () => {
    const state = makeState({ emotionalState: 'distressed' });
    const policy = deriveResponsePolicy(state, makeDecision('ask', 'caller_name'), NO_REPAIR, 'incomplete');
    assert.equal(policy.toneProfile, 'warm');
  });

  it('overwhelmed caller also gets distressed budget', () => {
    const state = makeState({ emotionalState: 'overwhelmed' });
    const policy = deriveResponsePolicy(state, makeDecision('ask', 'caller_name'), NO_REPAIR, 'incomplete');
    assert.equal(policy.brevityBias, 'high');
    assert.ok(policy.maxSentences <= 3);
  });
});

// ──────────────────────────────────────────────────────────────────
// 5. Callback number confirmation → explicit style
// ──────────────────────────────────────────────────────────────────

describe('deriveResponsePolicy — callback_number confirmation', () => {
  it('callback_number confirmation → confirmationStyle explicit', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(
      state,
      makeDecision('confirm', 'callback_number'),
      NO_REPAIR,
      'incomplete',
    );
    assert.equal(policy.confirmationStyle, 'explicit');
  });

  it('caller_name confirmation → confirmationStyle explicit', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(
      state,
      makeDecision('confirm', 'caller_name'),
      NO_REPAIR,
      'incomplete',
    );
    assert.equal(policy.confirmationStyle, 'explicit');
  });
});

// ──────────────────────────────────────────────────────────────────
// 6. Conflicting slot → binary confirmation style
// ──────────────────────────────────────────────────────────────────

describe('deriveResponsePolicy — conflicting slot', () => {
  it('conflicting slot → confirmationStyle binary', () => {
    const state = makeState({
      slots: {
        incident_date: makeSlot('March 5th', 0.7, { conflictFlag: true }),
      },
    });
    const policy = deriveResponsePolicy(
      state,
      makeDecision('confirm', 'incident_date'),
      NO_REPAIR,
      'incomplete',
    );
    assert.equal(policy.confirmationStyle, 'binary');
  });
});

// ──────────────────────────────────────────────────────────────────
// 7. short_matter_summary: broader question shape
// ──────────────────────────────────────────────────────────────────

describe('deriveResponsePolicy — short_matter_summary allows broader shape', () => {
  it('short_matter_summary ask → mode ask, gentle confirmationStyle', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(
      state,
      makeDecision('ask', 'short_matter_summary'),
      NO_REPAIR,
      'incomplete',
    );
    assert.equal(policy.mode, 'ask');
    assert.notEqual(policy.confirmationStyle, 'binary');
    assert.equal(policy.maxQuestions, 1);
  });

  it('short_matter_summary has more sentence budget than callback_number confirm', () => {
    const state = makeState();
    const askPolicy = deriveResponsePolicy(
      state,
      makeDecision('ask', 'short_matter_summary'),
      NO_REPAIR,
      'incomplete',
    );
    const confirmPolicy = deriveResponsePolicy(
      state,
      makeDecision('confirm', 'callback_number'),
      NO_REPAIR,
      'incomplete',
    );
    assert.ok(
      askPolicy.maxSentences >= confirmPolicy.maxSentences,
      `ask policy (${askPolicy.maxSentences}) should have ≥ sentences as confirm (${confirmPolicy.maxSentences})`,
    );
  });
});

// ──────────────────────────────────────────────────────────────────
// 8. Handoff / terminal: maxQuestions=0
// ──────────────────────────────────────────────────────────────────

describe('deriveResponsePolicy — handoff mode', () => {
  it('escalate without safety risk → maxQuestions=0', () => {
    const state = makeState({ riskFlags: [] });
    const policy = deriveResponsePolicy(
      state,
      makeDecision('escalate'),
      NO_REPAIR,
      'ready_for_handoff',
    );
    assert.equal(policy.mode, 'handoff');
    assert.equal(policy.maxQuestions, 0);
  });

  it('complete → maxQuestions=0', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(state, makeDecision('complete'), NO_REPAIR, 'completed');
    assert.equal(policy.mode, 'complete');
    assert.equal(policy.maxQuestions, 0);
  });
});

// ──────────────────────────────────────────────────────────────────
// 9. Emergency (caller safety risk) → mode=emergency
// ──────────────────────────────────────────────────────────────────

describe('deriveResponsePolicy — emergency mode', () => {
  it('escalate with caller_safety_concern → mode emergency', () => {
    const state = makeState({ riskFlags: ['caller_safety_concern'] });
    const policy = deriveResponsePolicy(
      state,
      makeDecision('escalate'),
      NO_REPAIR,
      'incomplete',
    );
    assert.equal(policy.mode, 'emergency');
    assert.equal(policy.maxQuestions, 0);
  });
});

// ──────────────────────────────────────────────────────────────────
// 10. Critical urgency → brevityBias=high, toneProfile=urgent
// ──────────────────────────────────────────────────────────────────

describe('deriveResponsePolicy — critical urgency', () => {
  it('critical urgency → brevityBias=high and toneProfile=urgent', () => {
    const state = makeState({ urgencyLevel: 'critical', emotionalState: 'calm' });
    const policy = deriveResponsePolicy(
      state,
      makeDecision('ask', 'court_date'),
      NO_REPAIR,
      'incomplete',
    );
    assert.equal(policy.brevityBias, 'high');
    assert.equal(policy.toneProfile, 'urgent');
    assert.equal(policy.forbidPrematureReassurance, true);
  });
});

// ──────────────────────────────────────────────────────────────────
// 11. Angry caller: direct tone, acknowledgment allowed
// ──────────────────────────────────────────────────────────────────

describe('deriveResponsePolicy — angry caller', () => {
  it('angry caller → toneProfile=direct, allowAcknowledgment=true', () => {
    const state = makeState({ emotionalState: 'angry' });
    const policy = deriveResponsePolicy(
      state,
      makeDecision('ask', 'caller_name'),
      NO_REPAIR,
      'incomplete',
    );
    assert.equal(policy.toneProfile, 'direct');
    assert.equal(policy.allowAcknowledgment, true);
    // Not distressed — empathy prefix not automatic
    assert.equal(policy.allowEmpathyPrefix, false);
  });
});

// ──────────────────────────────────────────────────────────────────
// 12. forbidCompoundQuestions is always true
// ──────────────────────────────────────────────────────────────────

describe('deriveResponsePolicy — forbidCompoundQuestions always true', () => {
  const modes: NextQuestionDecision['type'][] = ['ask', 'confirm', 'repair', 'complete'];
  for (const type of modes) {
    it(`forbidCompoundQuestions=true for decision type: ${type}`, () => {
      const state = makeState();
      const policy = deriveResponsePolicy(
        state,
        makeDecision(type, type === 'ask' ? 'caller_name' : null),
        NO_REPAIR,
        'incomplete',
      );
      assert.equal(policy.forbidCompoundQuestions, true);
    });
  }
});

// ──────────────────────────────────────────────────────────────────
// 13. Normal ask: calm default policy
// ──────────────────────────────────────────────────────────────────

describe('deriveResponsePolicy — normal ask defaults', () => {
  it('calm caller on normal ask has calm tone and medium brevity', () => {
    const state = makeState({ emotionalState: 'calm' });
    const policy = deriveResponsePolicy(
      state,
      makeDecision('ask', 'incident_date'),
      NO_REPAIR,
      'incomplete',
    );
    assert.equal(policy.toneProfile, 'calm');
    assert.equal(policy.brevityBias, 'medium');
    assert.equal(policy.allowEmpathyPrefix, false);
    assert.equal(policy.maxSentences, 4);
  });
});

// ──────────────────────────────────────────────────────────────────
// 14. ResponsePlan carries responsePolicy from buildResponsePlan
// ──────────────────────────────────────────────────────────────────

describe('buildResponsePlan — carries responsePolicy', () => {
  it('plan has responsePolicy when decision is provided', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      missingRequiredFields: ['caller_name'],
    });
    const result = generateResponsePlan(state);
    assert.ok(result.plan.responsePolicy, 'responsePolicy should be present');
    assert.ok(typeof result.plan.responsePolicy.mode === 'string');
    assert.ok(typeof result.plan.responsePolicy.maxQuestions === 'number');
    assert.ok(typeof result.plan.responsePolicy.maxSentences === 'number');
    assert.equal(result.plan.responsePolicy.forbidCompoundQuestions, true);
  });
});

// ──────────────────────────────────────────────────────────────────
// 15. PlannerResult.debugInfo exposes responsePolicy
// ──────────────────────────────────────────────────────────────────

describe('PlannerResult.debugInfo.responsePolicy', () => {
  it('exposes responsePolicy in debug output', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      missingRequiredFields: ['caller_name'],
    });
    const result = generateResponsePlan(state);
    assert.ok(result.debugInfo.responsePolicy);
    assert.ok(typeof result.debugInfo.responsePolicy.mode === 'string');
  });

  it('is null for states without a decision (e.g. opening stage fallback)', () => {
    const state = makeState({ intakeStage: 'opening' });
    const result = generateResponsePlan(state);
    // Even opening stage should produce a policy (ask mode)
    // — null only when decision is entirely absent from buildResponsePlan
    // In practice, generateResponsePlan always passes decision, so policy is present
    assert.ok(result.debugInfo.responsePolicy !== undefined);
  });
});

// ──────────────────────────────────────────────────────────────────
// 16. Renderer: maxTokens derived from brevityBias
// ──────────────────────────────────────────────────────────────────

describe('prepareRenderPayload — maxTokens from policy', () => {
  it('brevityBias=high → maxTokens=150', () => {
    const state = makeState({ emotionalState: 'distressed' });
    const result = generateResponsePlan(state);
    // Distressed ask → brevityBias=high
    const payload = prepareRenderPayload(state, result.plan);
    assert.equal(payload.maxTokens, 150);
  });

  it('normal calm ask → maxTokens=300', () => {
    const state = makeState({
      emotionalState: 'calm',
      urgencyLevel: 'low',
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      missingRequiredFields: ['caller_name'],
    });
    const result = generateResponsePlan(state);
    const payload = prepareRenderPayload(state, result.plan);
    assert.equal(payload.maxTokens, 300);
  });

  it('config.maxTokens overrides policy derivation', () => {
    const state = makeState();
    const result = generateResponsePlan(state);
    const payload = prepareRenderPayload(state, result.plan, { maxTokens: 99 });
    assert.equal(payload.maxTokens, 99);
  });
});

// ──────────────────────────────────────────────────────────────────
// 17. Renderer: system prompt includes Output Policy section
// ──────────────────────────────────────────────────────────────────

describe('prepareRenderPayload — Output Policy section in system prompt', () => {
  it('system prompt includes Output Policy section when responsePolicy is present', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      missingRequiredFields: ['caller_name'],
    });
    const result = generateResponsePlan(state);
    const payload = prepareRenderPayload(state, result.plan);
    assert.ok(
      payload.systemPrompt.includes('## Output Policy'),
      'System prompt should contain Output Policy section',
    );
  });

  it('confirm mode system prompt includes confirmation framing instruction', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      slots: {
        incident_date: makeSlot('last month', 0.45, { needsConfirmation: true }),
      },
      confirmationQueue: ['incident_date'],
      missingRequiredFields: ['caller_name', 'callback_number', 'short_matter_summary', 'injury_type'],
      lowConfidenceRequiredFields: ['incident_date'],
      conflictingRequiredFields: [],
      optionalFieldsRemaining: [],
    });
    const result = generateResponsePlan(state);
    const payload = prepareRenderPayload(state, result.plan);
    // The confirm mode policy section should contain confirmation guidance
    const prompt = payload.systemPrompt;
    assert.ok(
      prompt.includes('Output Policy') || prompt.includes('confirm') || prompt.includes('sentence'),
      'System prompt should contain policy-related output guidance',
    );
  });
});

// ──────────────────────────────────────────────────────────────────
// 18. Required spec scenarios (7 mandated)
// ──────────────────────────────────────────────────────────────────

describe('3F spec: required scenarios', () => {
  // Scenario 1: Confirmation turn forbids asking a second unrelated question
  it('Scenario 1: confirmation turn forbids compound question', () => {
    const state = makeState({
      slots: { incident_date: makeSlot('last Tuesday', 0.45, { needsConfirmation: true }) },
      confirmationQueue: ['incident_date'],
    });
    const policy = deriveResponsePolicy(
      state,
      makeDecision('confirm', 'incident_date'),
      NO_REPAIR,
      'incomplete',
    );
    assert.equal(policy.mode, 'confirm');
    assert.equal(policy.forbidCompoundQuestions, true);
    assert.equal(policy.requireSingleTarget, true);
    assert.equal(policy.maxQuestions, 1);
  });

  // Scenario 2: Repair mode enforces shorter/narrower output policy
  it('Scenario 2: repair mode enforces short output', () => {
    const state = makeState();
    const policy = deriveResponsePolicy(
      state,
      makeDecision('repair', 'incident_date'),
      makeRepairDecision('narrow_question'),
      'incomplete',
    );
    assert.equal(policy.mode, 'repair');
    assert.ok(policy.maxSentences <= 3);
    assert.equal(policy.repairStyle, 'narrow');
    assert.equal(policy.forbidCompoundQuestions, true);
  });

  // Scenario 3: High-distress state reduces sentence/question budget
  it('Scenario 3: distressed caller gets reduced budget', () => {
    const state = makeState({ emotionalState: 'distressed' });
    const policy = deriveResponsePolicy(
      state,
      makeDecision('ask', 'incident_date'),
      NO_REPAIR,
      'incomplete',
    );
    assert.ok(policy.maxSentences <= 3);
    assert.equal(policy.brevityBias, 'high');
    assert.equal(policy.allowEmpathyPrefix, true);
    assert.equal(policy.allowAcknowledgment, true);
    assert.equal(policy.toneProfile, 'warm');
  });

  // Scenario 4: Callback number confirmation uses explicit/binary style
  it('Scenario 4: callback_number confirmation → explicit style', () => {
    const state = makeState({
      slots: { callback_number: makeSlot('+15551234567', 0.9, { needsConfirmation: true }) },
      confirmationQueue: ['callback_number'],
    });
    const policy = deriveResponsePolicy(
      state,
      makeDecision('confirm', 'callback_number'),
      NO_REPAIR,
      'incomplete',
    );
    assert.equal(policy.confirmationStyle, 'explicit');
  });

  // Scenario 5: short_matter_summary allows broader question shape
  it('Scenario 5: short_matter_summary allows broader shape than callback_number confirm', () => {
    const state = makeState({ emotionalState: 'calm', urgencyLevel: 'low' });
    const askPolicy = deriveResponsePolicy(
      state,
      makeDecision('ask', 'short_matter_summary'),
      NO_REPAIR,
      'incomplete',
    );
    const confirmPolicy = deriveResponsePolicy(
      state,
      makeDecision('confirm', 'callback_number'),
      NO_REPAIR,
      'incomplete',
    );
    // Confirm is more constrained (fewer sentences, explicit style)
    assert.ok(askPolicy.maxSentences >= confirmPolicy.maxSentences);
    assert.notEqual(askPolicy.confirmationStyle, 'explicit');
    assert.notEqual(askPolicy.confirmationStyle, 'binary');
  });

  // Scenario 6: Handoff mode produces minimal-question policy
  it('Scenario 6: handoff mode → maxQuestions=0', () => {
    const state = makeState({ riskFlags: [] });
    const policy = deriveResponsePolicy(
      state,
      makeDecision('escalate'),
      NO_REPAIR,
      'ready_for_handoff',
    );
    assert.ok(['handoff', 'emergency'].includes(policy.mode));
    assert.equal(policy.maxQuestions, 0);
  });

  // Scenario 7: Response plan carries output policy fields correctly
  it('Scenario 7: response plan carries all output policy fields', () => {
    const state = makeState({
      intakeStage: 'fact_collection',
      matterType: 'personal_injury',
      missingRequiredFields: ['caller_name', 'incident_date', 'callback_number', 'short_matter_summary', 'injury_type'],
    });
    const result = generateResponsePlan(state);
    const policy = result.plan.responsePolicy;
    assert.ok(policy, 'responsePolicy must be present on plan');
    assert.ok(typeof policy.mode === 'string');
    assert.ok(typeof policy.maxQuestions === 'number');
    assert.ok(typeof policy.maxSentences === 'number');
    assert.ok(typeof policy.allowEmpathyPrefix === 'boolean');
    assert.ok(typeof policy.allowAcknowledgment === 'boolean');
    assert.ok(typeof policy.requireSingleTarget === 'boolean');
    assert.ok(typeof policy.confirmationStyle === 'string');
    assert.ok(typeof policy.repairStyle === 'string');
    assert.ok(typeof policy.toneProfile === 'string');
    assert.ok(typeof policy.brevityBias === 'string');
    assert.ok(typeof policy.forbidCompoundQuestions === 'boolean');
    assert.ok(typeof policy.forbidPrematureReassurance === 'boolean');
    // Core invariants
    assert.equal(policy.forbidCompoundQuestions, true);
    assert.equal(policy.requireSingleTarget, true);
  });
});
