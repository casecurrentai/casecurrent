/**
 * ElevenLabs post-call payload normalizer.
 *
 * Converts the raw ElevenLabs webhook payload into the provider-agnostic
 * NormalizedPostCallData type defined in avery/types.
 *
 * Defensive: safe to call with partial or malformed payloads.
 * The webhook handler should call this before passing data downstream.
 */

import { NormalizedPostCallData, NormalizedTranscriptEntry } from '../types';

interface RawTranscriptEntry {
  role?: string;
  speaker?: string;
  message?: string;
  text?: string;
  content?: string;
  timestamp?: string | number;
  time?: number;
  timeInCallSecs?: number;
  start_time?: number;
  [key: string]: unknown;
}

function normalizeRole(raw: string | undefined): 'agent' | 'user' | 'unknown' {
  if (!raw) return 'unknown';
  const r = raw.toLowerCase();
  if (r === 'agent' || r === 'assistant' || r === 'bot' || r === 'system') return 'agent';
  if (r === 'user' || r === 'caller' || r === 'human') return 'user';
  return 'unknown';
}

function normalizeTranscriptEntries(raw: unknown): NormalizedTranscriptEntry[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((entry): entry is RawTranscriptEntry => entry !== null && typeof entry === 'object')
    .map((entry) => {
      const role = normalizeRole(
        typeof entry.role === 'string'
          ? entry.role
          : typeof entry.speaker === 'string'
            ? entry.speaker
            : undefined,
      );

      const message = String(
        entry.message ?? entry.text ?? entry.content ?? '',
      );

      let timeInCallSecs: number | null = null;
      if (typeof entry.timeInCallSecs === 'number') timeInCallSecs = entry.timeInCallSecs;
      else if (typeof entry.time === 'number') timeInCallSecs = entry.time;
      else if (typeof entry.start_time === 'number') timeInCallSecs = entry.start_time;
      else if (typeof entry.timestamp === 'number') timeInCallSecs = entry.timestamp;

      return { role, message, timeInCallSecs };
    });
}

/**
 * Normalize a raw ElevenLabs post-call webhook payload into a provider-agnostic
 * NormalizedPostCallData structure.
 *
 * @param raw - The raw parsed JSON body from the ElevenLabs webhook
 */
export function normalizeElevenLabsPostCallPayload(
  raw: Record<string, unknown>,
): NormalizedPostCallData {
  // conversation_id is the primary identifier — always required
  const conversationId = typeof raw.conversation_id === 'string' ? raw.conversation_id : '';

  // Duration
  const durationSec =
    typeof raw.duration_seconds === 'number' ? raw.duration_seconds : null;
  const durationMs = durationSec !== null ? Math.round(durationSec * 1000) : null;

  // Timestamps
  const startedAt = typeof raw.started_at === 'string' ? raw.started_at : null;
  let endedAt: string | null = null;
  if (typeof raw.ended_at === 'string') {
    endedAt = raw.ended_at;
  } else if (startedAt && durationMs !== null) {
    // Derive ended_at from start + duration if available
    try {
      const startMs = new Date(startedAt).getTime();
      if (!isNaN(startMs)) {
        endedAt = new Date(startMs + durationMs).toISOString();
      }
    } catch {
      // Leave endedAt as null
    }
  }

  // Transcript
  const transcriptText =
    typeof raw.transcript === 'string' && raw.transcript.trim().length > 0
      ? raw.transcript
      : null;
  const transcriptEntries = normalizeTranscriptEntries(raw.transcript_json);

  // Analysis object (ElevenLabs may include analysis.summary, analysis.language, etc.)
  let analysis: Record<string, unknown> | null = null;
  if (raw.analysis !== null && typeof raw.analysis === 'object' && !Array.isArray(raw.analysis)) {
    analysis = raw.analysis as Record<string, unknown>;
  }

  // Summary: prefer top-level summary, fall back to analysis.summary
  const summary =
    typeof raw.summary === 'string' && raw.summary.trim().length > 0
      ? raw.summary
      : typeof analysis?.summary === 'string'
        ? analysis.summary
        : null;

  // Language: top-level → analysis.language → null
  const language =
    typeof raw.language === 'string'
      ? raw.language
      : typeof analysis?.language === 'string'
        ? analysis.language
        : null;

  // Caller / callee identification
  const callerPhone =
    typeof raw.caller_id === 'string' && raw.caller_id.trim().length > 0
      ? raw.caller_id
      : null;
  const calleePhone =
    typeof raw.called_number === 'string' && raw.called_number.trim().length > 0
      ? raw.called_number
      : null;

  // Provider-extracted data (ElevenLabs may include its own extracted_data)
  const extractedData: Record<string, unknown> =
    raw.extracted_data !== null &&
    typeof raw.extracted_data === 'object' &&
    !Array.isArray(raw.extracted_data)
      ? (raw.extracted_data as Record<string, unknown>)
      : {};

  // Metadata: call-level fields that are useful but not first-class
  const metadata: Record<string, unknown> = {};
  if (raw.call_sid) metadata.call_sid = raw.call_sid;
  if (raw.client_data) metadata.client_data = raw.client_data;
  if (raw.outcome) metadata.outcome = raw.outcome;

  return {
    provider: 'elevenlabs',
    conversationId,
    callId: null, // will be set after correlation in webhook handler
    startedAt,
    endedAt,
    durationMs,
    transcriptText,
    transcriptEntries,
    summary,
    analysis,
    callerPhone,
    calleePhone,
    language,
    recordingUrl:
      typeof raw.recording_url === 'string' && raw.recording_url.trim().length > 0
        ? raw.recording_url
        : null,
    disconnectionReason:
      typeof raw.outcome === 'string' ? raw.outcome : null,
    extractedData,
    metadata,
    rawPayload: raw,
  };
}
