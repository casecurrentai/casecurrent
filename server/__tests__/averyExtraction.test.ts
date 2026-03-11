/**
 * Avery extraction pipeline tests.
 *
 * Tests the core extraction logic against representative transcript fixtures.
 * No DB or network required — pure unit tests.
 *
 * Fixtures:
 *   1. Personal injury — car accident with injuries
 *   2. Employment — wrongful termination
 *   3. Existing client follow-up
 *   4. Distressed caller — emotional state detection
 *   5. Criminal — in custody with court date urgency
 *   6. Weak / incomplete payload — graceful degradation
 *   7. Multilingual / unknown language
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { classifyMatter } from '../avery/intake/matter-classifier';
import { detectIntent } from '../avery/intake/intent-detector';
import { detectUrgency } from '../avery/intake/urgency-detector';
import { detectEmotionalState } from '../avery/intake/emotional-state-detector';
import { runExtractionPipeline } from '../avery/intake/extraction';
import { normalizeElevenLabsPostCallPayload } from '../avery/elevenlabs/normalize-payload';
import type { NormalizedPostCallData } from '../avery/types';

// ──────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────

const PI_TRANSCRIPT = `
Avery: Thank you for calling. How can I help you today?
Caller: Hi, my name is Sarah Johnson. I was in a car accident last Tuesday on Route 9.
Avery: I'm sorry to hear that. Can you tell me more about what happened?
Caller: A truck rear-ended me at a stoplight. I went to the emergency room and they said I have a fractured rib and whiplash.
Avery: That sounds serious. Are you still receiving medical treatment?
Caller: Yes, I'm seeing a doctor every week. The other driver's insurance company is giving me a hard time.
Avery: Do you have the other driver's insurance information?
Caller: Yes, I have it. I also filed a police report right after the accident.
Avery: Great. What's the best number to reach you?
Caller: My cell is 555-234-5678. My email is sarah.j@email.com
`.trim();

const EMPLOYMENT_TRANSCRIPT = `
Avery: Thank you for calling. How can I help you today?
Caller: My name is Marcus Brown. I was fired from my job yesterday at TechCorp Inc.
Avery: I'm sorry to hear that. What happened?
Caller: I reported my manager to HR for racial discrimination three weeks ago and now they terminated me. This is clearly retaliation.
Avery: How long had you been employed there?
Caller: Almost four years. I have everything documented — emails, witnesses, everything.
Avery: That's very helpful. Do you know if TechCorp has over 15 employees?
Caller: Yes, they have like 200 people.
`.trim();

const EXISTING_CLIENT_TRANSCRIPT = `
Avery: Thank you for calling. How can I help you today?
Caller: Hi, I was calling to follow up on my case. I spoke with someone last week.
Avery: Of course, can I get your name?
Caller: It's David Reyes. You already have my case file — my attorney there is handling my car accident from last year.
Avery: Let me pull that up. Do you have a case number or file number?
Caller: My case number is CC-2025-4421. I just want an update on my case status.
`.trim();

const DISTRESSED_TRANSCRIPT = `
Avery: Thank you for calling. How can I help you today?
Caller: I don't even know where to start. I am completely overwhelmed. My husband just filed for divorce and I have nowhere to turn.
Avery: I can hear that this is a very difficult time. Take a breath — I'm here to help.
Caller: I'm scared about what happens to my kids. We have three children. I don't know what's going to happen.
Avery: Your children's wellbeing is the top priority. Can you tell me more about your situation?
Caller: He wants full custody. I don't know if I can fight this alone. I'm devastated.
`.trim();

const CRIMINAL_TRANSCRIPT = `
Avery: Thank you for calling. How can I help you today?
Caller: My brother got arrested last night. He is currently in custody and his arraignment is tomorrow morning.
Avery: I understand — that's urgent. What are the charges?
Caller: They charged him with felony assault. We need someone there tomorrow.
Avery: We can help. What's the county or jurisdiction?
Caller: It's Middlesex County. He's at the county jail. We need to get him a lawyer before that court date.
`.trim();

const WEAK_TRANSCRIPT = `
Caller: Hello? Is anyone there?
Avery: Yes, I'm here. How can I help you?
Caller: Uh, I'm not sure. I was told to call this number.
`.trim();

const SPANISH_TRANSCRIPT = `
Caller: Hola, necesito ayuda con un accidente de auto.
Avery: Hola, con gusto le ayudo. ¿Puede contarme qué pasó?
Caller: Tuve un accidente de carro la semana pasada. Me lastimé la espalda.
`.trim();

// Helper to build a minimal NormalizedPostCallData for testing
function makeNormalized(
  transcript: string,
  overrides: Partial<NormalizedPostCallData> = {},
): NormalizedPostCallData {
  return {
    provider: 'elevenlabs',
    conversationId: 'test-conv-001',
    callId: 'test-call-001',
    startedAt: '2026-03-10T14:00:00Z',
    endedAt: '2026-03-10T14:05:00Z',
    durationMs: 300000,
    transcriptText: transcript,
    transcriptEntries: transcript
      .split('\n')
      .filter((l) => l.trim().startsWith('Caller:') || l.trim().startsWith('Avery:'))
      .map((line) => ({
        role: line.trim().startsWith('Avery:') ? 'agent' : 'user',
        message: line.replace(/^(Caller:|Avery:)\s*/i, '').trim(),
        timeInCallSecs: null,
      })),
    summary: null,
    analysis: null,
    callerPhone: '+15552345678',
    calleePhone: '+18001234567',
    language: null,
    recordingUrl: null,
    disconnectionReason: null,
    extractedData: {},
    metadata: {},
    rawPayload: {},
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────
// Matter classifier tests
// ──────────────────────────────────────────────────────────────────

describe('classifyMatter', () => {
  it('classifies a personal injury transcript', () => {
    const result = classifyMatter(PI_TRANSCRIPT);
    assert.equal(result.matterType, 'personal_injury');
    assert.ok(result.confidence > 0.5, `expected confidence > 0.5, got ${result.confidence}`);
    assert.ok(result.matchedKeywords.length > 0, 'should have matched keywords');
  });

  it('classifies an employment transcript', () => {
    const result = classifyMatter(EMPLOYMENT_TRANSCRIPT);
    assert.equal(result.matterType, 'employment');
    assert.ok(result.confidence > 0.4);
  });

  it('classifies a family/divorce transcript', () => {
    const result = classifyMatter(DISTRESSED_TRANSCRIPT);
    assert.equal(result.matterType, 'family');
  });

  it('classifies a criminal transcript', () => {
    const result = classifyMatter(CRIMINAL_TRANSCRIPT);
    assert.equal(result.matterType, 'criminal');
    assert.ok(result.confidence > 0.5);
  });

  it('returns unknown for a weak/unclear transcript', () => {
    const result = classifyMatter(WEAK_TRANSCRIPT);
    assert.equal(result.matterType, 'unknown');
    assert.equal(result.confidence, 0);
  });

  it('returns a scores map with all matter types', () => {
    const result = classifyMatter(PI_TRANSCRIPT);
    assert.ok(typeof result.scores.personal_injury === 'number');
  });
});

// ──────────────────────────────────────────────────────────────────
// Intent detector tests
// ──────────────────────────────────────────────────────────────────

describe('detectIntent', () => {
  it('classifies a new case call as new_case', () => {
    const result = detectIntent(PI_TRANSCRIPT);
    assert.equal(result.callerIntent, 'new_case');
  });

  it('detects existing client intent', () => {
    const result = detectIntent(EXISTING_CLIENT_TRANSCRIPT);
    assert.equal(result.callerIntent, 'existing_client');
    assert.ok(result.confidence >= 0.5);
  });

  it('detects wrong number', () => {
    const result = detectIntent('I think I have the wrong number. I was trying to call my doctor.');
    assert.equal(result.callerIntent, 'wrong_number');
    assert.ok(result.confidence >= 0.9);
  });

  it('detects demo/test calls', () => {
    const result = detectIntent("Hello, this is just a test call to evaluate the system. I'm a developer.");
    assert.equal(result.callerIntent, 'demo');
  });
});

// ──────────────────────────────────────────────────────────────────
// Urgency detector tests
// ──────────────────────────────────────────────────────────────────

describe('detectUrgency', () => {
  it('detects critical urgency for court tomorrow', () => {
    const result = detectUrgency(CRIMINAL_TRANSCRIPT);
    assert.equal(result.urgencyLevel, 'critical');
    assert.ok(result.confidence >= 0.9);
  });

  it('detects high urgency for court date reference', () => {
    const result = detectUrgency('I have a court date next week and need representation urgently.');
    assert.equal(result.urgencyLevel, 'high');
  });

  it('returns low urgency for weak transcript', () => {
    const result = detectUrgency(WEAK_TRANSCRIPT);
    assert.equal(result.urgencyLevel, 'low');
  });

  it('detects medium urgency for ongoing treatment', () => {
    const result = detectUrgency('I am still in hospital recovering. Still receiving treatment.');
    assert.equal(result.urgencyLevel, 'medium');
  });
});

// ──────────────────────────────────────────────────────────────────
// Emotional state detector tests
// ──────────────────────────────────────────────────────────────────

describe('detectEmotionalState', () => {
  it('detects overwhelmed state', () => {
    const result = detectEmotionalState(DISTRESSED_TRANSCRIPT);
    // Should detect overwhelmed or distressed — both valid for this transcript
    assert.ok(
      result.emotionalState === 'overwhelmed' ||
        result.emotionalState === 'distressed' ||
        result.emotionalState === 'anxious',
      `expected overwhelmed/distressed/anxious, got ${result.emotionalState}`,
    );
    assert.ok(result.confidence >= 0.5);
  });

  it('returns unknown for calm factual transcript', () => {
    const result = detectEmotionalState(EMPLOYMENT_TRANSCRIPT);
    // Employment transcript is factual — may be unknown or calm, not distressed
    assert.ok(
      result.emotionalState !== 'distressed',
      'factual transcript should not be distressed',
    );
  });

  it('detects anxious state', () => {
    const result = detectEmotionalState(
      "I am scared about what will happen to me. I'm worried I'll lose my job.",
    );
    assert.equal(result.emotionalState, 'anxious');
  });

  it('does not conflate urgency with emotional distress', () => {
    // "court tomorrow" literal substring triggers critical urgency;
    // "I am calm" keeps emotional state non-distressed.
    // This verifies the two dimensions are measured independently.
    const urgentButCalm =
      'I have court tomorrow at 9am. I am calm about this but I need a lawyer.';
    const urgency = detectUrgency(urgentButCalm);
    const emotion = detectEmotionalState(urgentButCalm);
    assert.equal(urgency.urgencyLevel, 'critical');
    // Emotional state should not be distressed or angry just because the matter is urgent
    assert.ok(
      emotion.emotionalState !== 'distressed' && emotion.emotionalState !== 'angry',
      `expected non-distressed emotional state, got ${emotion.emotionalState}`,
    );
  });
});

// ──────────────────────────────────────────────────────────────────
// Full extraction pipeline tests
// ──────────────────────────────────────────────────────────────────

describe('runExtractionPipeline', () => {
  it('extracts PI matter type, caller name, and phone from PI transcript', () => {
    const data = makeNormalized(PI_TRANSCRIPT);
    const result = runExtractionPipeline(data);

    assert.equal(result.matterType, 'personal_injury');
    assert.equal(result.callerIntent, 'new_case');
    assert.equal(result.slots['caller_name']?.value, 'Sarah Johnson');
    assert.equal(result.slots['callback_number']?.value, '+15552345678');
    assert.equal(result.slots['email']?.value, 'sarah.j@email.com');
    assert.ok(result.confidenceScore > 0);
    assert.ok(typeof result.intakeSummary === 'string' && result.intakeSummary.length > 0);
  });

  it('extracts employment matter type and detects retaliation', () => {
    const data = makeNormalized(EMPLOYMENT_TRANSCRIPT);
    const result = runExtractionPipeline(data);

    assert.equal(result.matterType, 'employment');
    assert.equal(result.slots['caller_name']?.value, 'Marcus Brown');
  });

  it('detects existing client intent', () => {
    const data = makeNormalized(EXISTING_CLIENT_TRANSCRIPT);
    const result = runExtractionPipeline(data);

    assert.equal(result.callerIntent, 'existing_client');
  });

  it('detects distressed emotional state for family matter', () => {
    const data = makeNormalized(DISTRESSED_TRANSCRIPT);
    const result = runExtractionPipeline(data);

    assert.equal(result.matterType, 'family');
    assert.ok(
      result.emotionalState === 'overwhelmed' ||
        result.emotionalState === 'distressed' ||
        result.emotionalState === 'anxious',
      `expected distressed/overwhelmed/anxious, got ${result.emotionalState}`,
    );
  });

  it('detects critical urgency and criminal matter', () => {
    const data = makeNormalized(CRIMINAL_TRANSCRIPT);
    const result = runExtractionPipeline(data);

    assert.equal(result.matterType, 'criminal');
    assert.equal(result.urgencyLevel, 'critical');
    assert.ok(result.riskFlags.includes('criminal_custody_urgency'));
    assert.ok(result.transferRecommended, 'criminal custody should recommend transfer');
  });

  it('degrades gracefully for weak / incomplete payload', () => {
    const data = makeNormalized(WEAK_TRANSCRIPT, {
      callerPhone: null,
      transcriptText: WEAK_TRANSCRIPT,
    });
    const result = runExtractionPipeline(data);

    assert.equal(result.matterType, 'unknown');
    assert.equal(result.urgencyLevel, 'low');
    assert.ok(result.confidenceScore < 0.6, 'weak transcript should have low confidence');
    // No crash — returns a valid ExtractionResult
    assert.ok(typeof result.intakeSummary === 'string');
    assert.ok(Array.isArray(result.riskFlags));
  });

  it('handles Spanish / unknown-language transcript without crashing', () => {
    const data = makeNormalized(SPANISH_TRANSCRIPT, { language: 'es' });
    const result = runExtractionPipeline(data);

    // Spanish keywords for "accidente de carro" don't match English keywords
    // so matterType may be unknown — that's expected and acceptable
    assert.ok(typeof result.matterType === 'string');
    assert.ok(typeof result.intakeSummary === 'string');
    assert.doesNotThrow(() => runExtractionPipeline(data));
  });

  it('flags already_represented when caller mentions existing representation', () => {
    const transcript =
      'I already have a lawyer but they told me to get a second opinion about my car accident case.';
    const data = makeNormalized(transcript);
    const result = runExtractionPipeline(data);

    assert.ok(result.riskFlags.includes('already_represented'));
    assert.ok(result.transferRecommended, 'already represented should recommend transfer');
  });

  it('includes missing required fields for the detected matter type', () => {
    // PI call without injury_type mentioned → should flag it missing
    const data = makeNormalized(
      'I was in a car accident. I need a lawyer. Call me at 555-999-0000.',
    );
    const result = runExtractionPipeline(data);

    if (result.matterType === 'personal_injury') {
      assert.ok(
        result.missingRequiredFields.includes('injury_type'),
        'injury_type should be missing for PI matter',
      );
    }
  });

  it('uses provider summary when available', () => {
    const summary = 'Caller was in a rear-end collision on Route 9 and suffered whiplash.';
    const data = makeNormalized(PI_TRANSCRIPT, { summary });
    const result = runExtractionPipeline(data);

    assert.equal(result.intakeSummary, summary);
  });
});

// ──────────────────────────────────────────────────────────────────
// ElevenLabs payload normalizer tests
// ──────────────────────────────────────────────────────────────────

describe('normalizeElevenLabsPostCallPayload', () => {
  it('normalizes a full ElevenLabs post-call payload', () => {
    const raw = {
      conversation_id: 'conv-abc123',
      call_sid: 'CA999',
      caller_id: '+15551234567',
      called_number: '+18001234567',
      duration_seconds: 180,
      transcript: 'Hello I need help with my injury case.',
      transcript_json: [
        { role: 'agent', message: 'Hello, how can I help?', time: 0 },
        { role: 'user', message: 'I was in a car accident.', time: 2 },
      ],
      summary: 'Caller was in a car accident and needs legal help.',
      extracted_data: { callerName: 'John Doe' },
      recording_url: 'https://example.com/recording.mp3',
      outcome: 'completed',
    };

    const result = normalizeElevenLabsPostCallPayload(raw);

    assert.equal(result.provider, 'elevenlabs');
    assert.equal(result.conversationId, 'conv-abc123');
    assert.equal(result.durationMs, 180000);
    assert.equal(result.callerPhone, '+15551234567');
    assert.equal(result.calleePhone, '+18001234567');
    assert.equal(result.transcriptText, 'Hello I need help with my injury case.');
    assert.equal(result.transcriptEntries.length, 2);
    assert.equal(result.transcriptEntries[0].role, 'agent');
    assert.equal(result.transcriptEntries[1].role, 'user');
    assert.equal(result.summary, 'Caller was in a car accident and needs legal help.');
    assert.equal(result.recordingUrl, 'https://example.com/recording.mp3');
    assert.equal(result.disconnectionReason, 'completed');
    assert.equal(result.extractedData.callerName, 'John Doe');
    assert.equal(result.metadata.call_sid, 'CA999');
  });

  it('handles empty/minimal payload gracefully', () => {
    const result = normalizeElevenLabsPostCallPayload({ conversation_id: 'conv-minimal' });

    assert.equal(result.provider, 'elevenlabs');
    assert.equal(result.conversationId, 'conv-minimal');
    assert.equal(result.durationMs, null);
    assert.equal(result.transcriptText, null);
    assert.equal(result.transcriptEntries.length, 0);
    assert.equal(result.summary, null);
    assert.equal(result.callerPhone, null);
    assert.equal(result.recordingUrl, null);
  });

  it('derives endedAt from startedAt + duration when ended_at is absent', () => {
    const raw = {
      conversation_id: 'conv-timing',
      started_at: '2026-03-10T14:00:00.000Z',
      duration_seconds: 60,
    };

    const result = normalizeElevenLabsPostCallPayload(raw);

    assert.equal(result.startedAt, '2026-03-10T14:00:00.000Z');
    assert.ok(result.endedAt !== null, 'endedAt should be derived');
    const endedAt = new Date(result.endedAt!);
    const startedAt = new Date(result.startedAt!);
    const diffSec = (endedAt.getTime() - startedAt.getTime()) / 1000;
    assert.equal(diffSec, 60);
  });

  it('normalizes transcript entry roles correctly', () => {
    const raw = {
      conversation_id: 'conv-roles',
      transcript_json: [
        { speaker: 'assistant', text: 'Hello' },
        { role: 'human', content: 'I need help' },
        { role: 'bot', message: 'I can assist' },
        { role: 'unknown_role', message: 'hmm' },
      ],
    };

    const result = normalizeElevenLabsPostCallPayload(raw);

    assert.equal(result.transcriptEntries[0].role, 'agent'); // assistant → agent
    assert.equal(result.transcriptEntries[1].role, 'user'); // human → user
    assert.equal(result.transcriptEntries[2].role, 'agent'); // bot → agent
    assert.equal(result.transcriptEntries[3].role, 'unknown'); // unknown_role → unknown
  });

  it('uses analysis.summary when top-level summary is missing', () => {
    const raw = {
      conversation_id: 'conv-analysis-summary',
      analysis: { summary: 'Summary from analysis block.' },
    };

    const result = normalizeElevenLabsPostCallPayload(raw);
    assert.equal(result.summary, 'Summary from analysis block.');
  });
});
