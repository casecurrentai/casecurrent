/**
 * Intent detector — determines why the caller is calling.
 *
 * Distinguishes new case inquiries from existing clients, opposing parties,
 * vendors, wrong numbers, and demo/testing calls.
 *
 * Order of checks matters: more distinctive signals are checked first.
 */

import { CallerIntent } from '../types';

// ──────────────────────────────────────────────────────────────────
// Signal word lists
// ──────────────────────────────────────────────────────────────────

const WRONG_NUMBER: string[] = [
  'wrong number',
  'not the right number',
  'looking for someone else',
  'different number',
  'meant to call',
  'accidentally called',
];

const DEMO: string[] = [
  'this is a demo',
  'just a demo',
  'test call',
  "i'm testing",
  "i am testing",
  'just testing',
  "i'm a developer",
  'i am a developer',
  'evaluating the system',
  'checking if this works',
  "this is avery",
];

const VENDOR: string[] = [
  "i'm calling to offer",
  'we offer legal',
  'marketing services',
  'software solution',
  'vendor calling',
  'partner program',
  'our company provides',
  'we can help your firm',
  'i represent a company',
];

const OPPOSING_PARTY: string[] = [
  "i'm the opposing counsel",
  'i represent the other party',
  'your client owes',
  'i am the defendant',
  'serving you with',
  'opposing counsel',
  "i'm calling about a claim against",
];

const EXISTING_CLIENT: string[] = [
  'my case number',
  'my file number',
  'already working with',
  'you already have my case',
  'my attorney there',
  'my lawyer there',
  'follow up on my case',
  'update on my case',
  'status of my case',
  'last time i called',
  'i called before',
  'i spoke with',
  'previously discussed',
  'ongoing case',
  'my retainer',
  'i signed with you',
];

export interface IntentDetection {
  callerIntent: CallerIntent;
  confidence: number; // 0–1
  signals: string[];
}

/**
 * Detect caller intent from the full call transcript.
 * Returns 'new_case' with moderate confidence as the default when
 * no distinguishing signals are found.
 */
export function detectIntent(transcript: string): IntentDetection {
  const lower = transcript.toLowerCase();

  const findMatches = (signals: string[]) =>
    signals.filter((s) => lower.includes(s));

  // Wrong number is very high confidence when signaled
  const wrongMatches = findMatches(WRONG_NUMBER);
  if (wrongMatches.length > 0) {
    return { callerIntent: 'wrong_number', confidence: 0.95, signals: wrongMatches };
  }

  // Demo calls typically have explicit markers
  const demoMatches = findMatches(DEMO);
  if (demoMatches.length > 0) {
    return { callerIntent: 'demo', confidence: 0.85, signals: demoMatches };
  }

  // Opposing party language is distinctive
  const opposingMatches = findMatches(OPPOSING_PARTY);
  if (opposingMatches.length > 0) {
    return { callerIntent: 'opposing_party', confidence: 0.9, signals: opposingMatches };
  }

  // Vendor requires multiple signals to avoid false positives on "we" language
  const vendorMatches = findMatches(VENDOR);
  if (vendorMatches.length >= 2) {
    return { callerIntent: 'vendor', confidence: 0.8, signals: vendorMatches };
  }

  // Existing client: two or more signals required to reduce false positives
  const existingMatches = findMatches(EXISTING_CLIENT);
  if (existingMatches.length >= 2) {
    return { callerIntent: 'existing_client', confidence: 0.75, signals: existingMatches };
  }
  if (existingMatches.length === 1) {
    return { callerIntent: 'existing_client', confidence: 0.5, signals: existingMatches };
  }

  // Default: new case inquiry
  return { callerIntent: 'new_case', confidence: 0.55, signals: [] };
}
