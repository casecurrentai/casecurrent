/**
 * Tests for vapiClient.ts artifact normalization.
 * These are pure unit tests — no DB or network required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVapiCallArtifact } from '../services/vapiClient';

describe('normalizeVapiCallArtifact', () => {
  it('normalizes a full Vapi end-of-call payload', () => {
    const raw = {
      durationSeconds: 120,
      endedReason: 'customer-ended-call',
      recordingUrl: 'https://storage.vapi.ai/recordings/abc.mp3',
      summary: 'Caller was involved in a rear-end collision.',
      artifact: {
        transcript: [
          { role: 'assistant', transcript: 'Hello, how can I help you?', start: 0, end: 3 },
          { role: 'user', transcript: 'I was in a car accident.', start: 3, end: 7 },
        ],
        recordingUrl: 'https://storage.vapi.ai/recordings/abc.mp3',
        messages: [
          { role: 'assistant', content: 'Hello, how can I help you?', time: 0 },
          { role: 'user', content: 'I was in a car accident.', time: 3 },
        ],
      },
      analysis: {
        summary: 'Caller was involved in a rear-end collision.',
        structuredData: {
          incidentType: 'rear-end collision',
          injuryDescription: 'neck pain',
        },
      },
    };

    const result = normalizeVapiCallArtifact(raw);

    assert.equal(result.durationSec, 120);
    assert.equal(result.endedReason, 'customer-ended-call');
    assert.equal(result.recordingUrl, 'https://storage.vapi.ai/recordings/abc.mp3');
    assert.equal(result.summary, 'Caller was involved in a rear-end collision.');
    assert.equal(result.transcript.length, 2);
    assert.equal(result.transcript[0].role, 'assistant');
    assert.equal(result.transcript[1].transcript, 'I was in a car accident.');
    assert.deepEqual(result.structuredData, {
      incidentType: 'rear-end collision',
      injuryDescription: 'neck pain',
    });
    assert.ok(result.fetchedAt, 'fetchedAt should be set');
    assert.ok(result.expiresAt, 'expiresAt should be set');
    const fetchedAt = new Date(result.fetchedAt);
    const expiresAt = new Date(result.expiresAt);
    assert.ok(expiresAt > fetchedAt, 'expiresAt should be after fetchedAt');
  });

  it('falls back to raw messages when transcript array is missing', () => {
    const raw = {
      durationSeconds: 60,
      artifact: {
        messages: [
          { role: 'assistant', content: 'Hi there!', time: 0 },
          { role: 'user', content: 'I need help.', time: 2 },
        ],
      },
    };

    const result = normalizeVapiCallArtifact(raw);
    assert.equal(result.transcript.length, 2);
    assert.equal(result.transcript[0].transcript, 'Hi there!');
  });

  it('wraps plain-text transcript string as single utterance', () => {
    const raw = {
      transcript: 'User: I was in a crash. AI: I can help.',
      durationSeconds: 45,
    };

    const result = normalizeVapiCallArtifact(raw);
    assert.equal(result.transcript.length, 1);
    assert.equal(result.transcript[0].role, 'assistant');
    assert.ok(result.transcript[0].transcript.includes('I was in a crash'));
  });

  it('handles completely empty payload gracefully', () => {
    const result = normalizeVapiCallArtifact({});
    assert.equal(result.transcript.length, 0);
    assert.equal(result.recordingUrl, null);
    assert.equal(result.durationSec, null);
    assert.equal(result.summary, null);
    assert.equal(result.structuredData, null);
    assert.equal(result.endedReason, null);
  });

  it('returns valid ISO timestamps for fetchedAt and expiresAt', () => {
    const before = new Date();
    const result = normalizeVapiCallArtifact({});
    const after = new Date();

    const fetchedAt = new Date(result.fetchedAt);
    const expiresAt = new Date(result.expiresAt);

    assert.ok(fetchedAt >= before, 'fetchedAt should be >= before');
    assert.ok(fetchedAt <= after, 'fetchedAt should be <= after');
    assert.ok(expiresAt > fetchedAt, 'expiresAt should be in the future');
  });
});
