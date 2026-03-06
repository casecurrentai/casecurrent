/**
 * Server-side Vapi API client.
 *
 * Uses VAPI_API_KEY from environment (never exposed to the browser).
 * Provides retried fetches for call artifacts: full call object, transcript,
 * recording URL, summary.
 *
 * Vapi REST docs: https://docs.vapi.ai/api-reference/calls/get
 */

const VAPI_API_BASE = 'https://api.vapi.ai';
const ARTIFACT_TTL_HOURS = parseFloat(process.env.VAPI_ARTIFACT_TTL_HOURS || '6');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VapiTranscriptWord {
  word: string;
  start?: number;
  end?: number;
  punctuated_word?: string;
}

export interface VapiTranscriptUtterance {
  role: 'user' | 'bot' | 'assistant' | 'system' | string;
  transcript: string;
  start?: number;
  end?: number;
  words?: VapiTranscriptWord[];
}

export interface VapiCallArtifact {
  /** Speaker-attributed transcript turns */
  transcript: VapiTranscriptUtterance[];
  /** Recording URL (if available) */
  recordingUrl: string | null;
  /** Stereo recording URL (if available) */
  stereoRecordingUrl: string | null;
  /** Duration in seconds */
  durationSec: number | null;
  /** AI-generated summary */
  summary: string | null;
  /** Structured data extracted by Vapi analysis */
  structuredData: Record<string, unknown> | null;
  /** Call outcome label */
  endedReason: string | null;
  /** Raw messages array (role + content) */
  messages: Array<{ role: string; content: string; time?: number }>;
  /** Vapi analysis block */
  analysis: Record<string, unknown> | null;
  /** When this was fetched */
  fetchedAt: string;
  /** When this cache entry expires */
  expiresAt: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getApiKey(): string | null {
  return process.env.VAPI_API_KEY || process.env.VAPI_PRIVATE_KEY || null;
}

async function fetchWithRetry(
  url: string,
  opts: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 429 || res.status >= 500) {
        const backoffMs = Math.min(200 * 2 ** (attempt - 1), 3000);
        await new Promise((r) => setTimeout(r, backoffMs));
        lastErr = new Error(`Vapi HTTP ${res.status} on attempt ${attempt}`);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        const backoffMs = Math.min(200 * 2 ** (attempt - 1), 3000);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }
  throw lastErr;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a Vapi call object by its Vapi call ID.
 * Returns null if the API key is missing, call not found, or on error.
 */
export async function fetchVapiCall(vapiCallId: string): Promise<Record<string, unknown> | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[vapiClient] VAPI_API_KEY not set — artifact fetch skipped');
    return null;
  }

  try {
    const res = await fetchWithRetry(
      `${VAPI_API_BASE}/call/${encodeURIComponent(vapiCallId)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (res.status === 404) {
      console.log(`[vapiClient] Call ${vapiCallId} not found in Vapi`);
      return null;
    }
    if (!res.ok) {
      console.warn(`[vapiClient] Vapi GET /call/${vapiCallId} status=${res.status}`);
      return null;
    }

    const data = await res.json();
    return data as Record<string, unknown>;
  } catch (err: any) {
    console.warn(`[vapiClient] fetchVapiCall error: ${err?.message || err}`);
    return null;
  }
}

/**
 * Normalize a raw Vapi call object into a stable VapiCallArtifact.
 * This is the canonical shape stored in call_artifact_cache.
 */
export function normalizeVapiCallArtifact(raw: Record<string, unknown>): VapiCallArtifact {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ARTIFACT_TTL_HOURS * 60 * 60 * 1000);

  // Transcript — may be a string, array of utterances, or in artifact sub-object
  const artifact = (raw.artifact || {}) as Record<string, unknown>;
  const analysis = (raw.analysis || null) as Record<string, unknown> | null;

  let transcript: VapiTranscriptUtterance[] = [];

  const rawTranscript = artifact.transcript ?? raw.transcript;
  if (typeof rawTranscript === 'string' && rawTranscript.trim()) {
    // Plain-text transcript — wrap as single bot utterance
    transcript = [{ role: 'assistant', transcript: rawTranscript.trim() }];
  } else if (Array.isArray(rawTranscript)) {
    transcript = rawTranscript.map((t: any) => ({
      role: t.role ?? t.speaker ?? 'unknown',
      transcript: t.transcript ?? t.text ?? t.content ?? '',
      start: t.start ?? t.timeInCallSecs ?? undefined,
      end: t.end ?? undefined,
      words: t.words ?? undefined,
    }));
  }

  // Fall back to messages array if no transcript
  const rawMessages = (artifact.messages ?? raw.messages ?? []) as any[];
  if (transcript.length === 0 && rawMessages.length > 0) {
    transcript = rawMessages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role ?? 'unknown',
        transcript: m.content ?? m.message ?? '',
        start: m.time ?? undefined,
      }));
  }

  const recordingUrl = (artifact.recordingUrl ?? raw.recordingUrl ?? null) as string | null;
  const stereoRecordingUrl = (artifact.stereoRecordingUrl ?? raw.stereoRecordingUrl ?? null) as string | null;
  const durationSec = (raw.durationSeconds ?? raw.duration ?? null) as number | null;
  const summary = (analysis?.summary ?? raw.summary ?? null) as string | null;
  const structuredData = (analysis?.structuredData ?? null) as Record<string, unknown> | null;
  const endedReason = (raw.endedReason ?? null) as string | null;
  const messages = rawMessages.map((m: any) => ({
    role: m.role ?? 'unknown',
    content: m.content ?? m.message ?? '',
    time: m.time ?? undefined,
  }));

  return {
    transcript,
    recordingUrl,
    stereoRecordingUrl,
    durationSec,
    summary,
    structuredData,
    endedReason,
    messages,
    analysis: analysis ?? null,
    fetchedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export { ARTIFACT_TTL_HOURS };
