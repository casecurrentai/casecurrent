/**
 * Vapi number extraction + normalization.
 *
 * Handles every known Vapi payload shape for both
 * PSTN (inboundPhoneCall) and web calls (webCall).
 */

// ─────────────────────────────────────────────
// A) extractCandidate — try ordered paths
// ─────────────────────────────────────────────

export interface CandidateResult {
  value: string | null;
  matchedPath: string | null;
}

/**
 * Walk a list of dot-paths against `obj`, returning the first truthy string.
 */
export function extractCandidate(
  obj: Record<string, unknown>,
  pathList: string[],
): CandidateResult {
  for (const path of pathList) {
    const parts = path.split('.');
    let cur: unknown = obj;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === 'string' && cur.length > 0) {
      return { value: cur, matchedPath: path };
    }
  }
  return { value: null, matchedPath: null };
}

// ─────────────────────────────────────────────
// B) normalizeE164
// ─────────────────────────────────────────────

export interface NormalizedNumber {
  raw: string | null;
  digits: string;
  e164: string | null;
}

export function normalizeE164(raw: string | null | undefined): NormalizedNumber {
  if (!raw) return { raw: null, digits: '', e164: null };
  const digits = raw.replace(/\D/g, '');
  let e164: string | null;
  if (digits.length === 10) {
    e164 = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    e164 = `+${digits}`;
  } else if (digits.length > 0) {
    e164 = `+${digits}`;
  } else {
    e164 = null;
  }
  return { raw, digits, e164 };
}

// ─────────────────────────────────────────────
// C) getCallNumbers — unified extraction
// ─────────────────────────────────────────────

const TO_PATHS = [
  'phoneNumber.number',
  'phoneNumber.phoneNumber',
  'phoneNumberNumber',
  'to',
  'destination',
];

const FROM_PATHS = [
  'customer.number',
  'customer.phoneNumber',
  'from',
];

export interface CallNumbers {
  callId: string | null;
  callType: string;
  toRaw: string | null;
  fromRaw: string | null;
  toNorm: NormalizedNumber;
  fromNorm: NormalizedNumber;
  toMatchedPath: string | null;
  fromMatchedPath: string | null;
}

export function getCallNumbers(body: Record<string, unknown>): CallNumbers {
  // Locate call object — Vapi nests it under message.call or call or top-level
  const message = (body.message ?? body) as Record<string, unknown>;
  const call = (message.call ?? body.call ?? body) as Record<string, unknown>;

  const callId = (call.id ?? (message.call ? (message.call as Record<string, unknown>).id : null) ?? null) as string | null;
  const callType = ((call.type as string) ?? 'unknown');

  // Extract TO (dialed number)
  const toCandidate = extractCandidate(call, TO_PATHS);
  // Fallback: also check body-level 'to'
  const toResult = toCandidate.value
    ? toCandidate
    : extractCandidate(body, ['to']);

  // Extract FROM (caller number)
  const fromCandidate = extractCandidate(call, FROM_PATHS);
  const fromResult = fromCandidate.value
    ? fromCandidate
    : extractCandidate(body, ['from']);

  return {
    callId,
    callType,
    toRaw: toResult.value,
    fromRaw: fromResult.value,
    toNorm: normalizeE164(toResult.value),
    fromNorm: normalizeE164(fromResult.value),
    toMatchedPath: toResult.matchedPath,
    fromMatchedPath: fromResult.matchedPath,
  };
}
