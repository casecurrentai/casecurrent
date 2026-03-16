/**
 * Shared extraction patterns — canonical regex and helper functions used by
 * both the live-turn pipeline (state-updater.ts) and the post-call extraction
 * pipeline (extraction.ts).
 *
 * Keeping patterns in one place prevents the two paths from silently diverging
 * over time. Both paths import from here instead of maintaining local copies.
 *
 * All functions are pure — no LLM, no side effects.
 */

import { MatterType } from '../types';

// ──────────────────────────────────────────────────────────────────
// Name
// ──────────────────────────────────────────────────────────────────

export const NAME_PATTERNS: readonly RegExp[] = [
  /(?:my name is|this is|i'm|i am|name's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  /(?:first name is|first name)\s+([A-Z][a-z]+)/i,
  /(?:last name is|last name)\s+([A-Z][a-z]+)/i,
  /(?:call me|you can call me)\s+([A-Z][a-z]+)/i,
];

export function extractName(text: string): string | null {
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────
// Email
// ──────────────────────────────────────────────────────────────────

export const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export function extractEmail(text: string): string | null {
  const match = text.match(EMAIL_RE);
  return match ? match[0] : null;
}

// ──────────────────────────────────────────────────────────────────
// Phone
// ──────────────────────────────────────────────────────────────────

/**
 * Match spoken or typed phone numbers.
 * Handles: 555-234-5678, (555) 234-5678, +1 555 234 5678, etc.
 */
export const PHONE_RE =
  /\b(\+?1?\s*[-.]?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/;

/**
 * Normalize a raw phone match to E.164 format (+1XXXXXXXXXX).
 * Returns null if fewer than 10 digits.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

export function extractPhone(text: string): string | null {
  const match = text.match(PHONE_RE);
  if (!match) return null;
  return normalizePhone(match[1]);
}

// ──────────────────────────────────────────────────────────────────
// Incident / event date
// ──────────────────────────────────────────────────────────────────

export const DATE_PATTERNS: readonly RegExp[] = [
  /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{0,4}/i,
  /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
  /(last\s+week|last\s+month|yesterday|two\s+weeks\s+ago|a\s+week\s+ago|a\s+few\s+days\s+ago|few\s+days\s+ago)/i,
  /(this\s+past|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
];

export function extractIncidentDate(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────
// Opposing party
// ──────────────────────────────────────────────────────────────────

export const OPPOSING_PARTY_PATTERNS: readonly RegExp[] = [
  /(?:against|versus|vs\.?|suing)\s+([A-Z][a-zA-Z\s&,\.]{1,40})/i,
  /(?:the other driver|the other party|the defendant|the plaintiff|my employer|the insurance company|the landlord)\s+(?:is|was|named)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
];

export function extractOpposingParty(text: string): string | null {
  for (const pattern of OPPOSING_PARTY_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────
// Employer
// ──────────────────────────────────────────────────────────────────

export const EMPLOYER_PATTERNS: readonly RegExp[] = [
  /(?:work(?:ed)?\s+(?:at|for)|employed\s+(?:at|by)|company\s+(?:is|was))\s+([A-Z][a-zA-Z\s&,\.]{2,40})/i,
];

export function extractEmployer(text: string): string | null {
  for (const pattern of EMPLOYER_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────
// Risk flags
// ──────────────────────────────────────────────────────────────────

/**
 * Canonical risk flag detection — shared between live-turn and post-call paths.
 *
 * Each entry defines a flag key and the phrases/conditions that trigger it.
 * Uses lowercase match on the full text for simplicity and consistency.
 */
export interface RiskFlagRule {
  flag: string;
  test: (lower: string, matterType?: string) => boolean;
}

export const RISK_FLAG_RULES: readonly RiskFlagRule[] = [
  {
    flag: 'already_represented',
    test: (lower) =>
      lower.includes('already have a lawyer') ||
      lower.includes('already have an attorney') ||
      lower.includes('already hired') ||
      lower.includes('i have representation') ||
      lower.includes('currently represented'),
  },
  {
    flag: 'caller_safety_concern',
    test: (lower) =>
      lower.includes('suicid') ||
      lower.includes('harm myself') ||
      lower.includes('harming myself') ||
      lower.includes('hurt myself') ||
      lower.includes('end my life'),
  },
  {
    flag: 'possible_sol_issue',
    test: (lower) =>
      (lower.includes('statute') && lower.includes('limit')) ||
      lower.includes('time barred') ||
      lower.includes('time has run') ||
      lower.includes('time limit'),
  },
  {
    flag: 'criminal_custody_urgency',
    test: (lower, matterType) =>
      (lower.includes('in custody') ||
        lower.includes('in jail') ||
        (lower.includes('arraignment') && lower.includes('arrest'))) &&
      // Only flag as criminal urgency for criminal matters or unknown
      (matterType === 'criminal' || matterType === 'unknown' || !matterType),
  },
  {
    flag: 'potential_conflict_of_interest',
    test: (lower) =>
      lower.includes('conflict of interest') ||
      lower.includes('other side') ||
      lower.includes('you represent'),
  },
];

/**
 * Detect risk flags from raw text.
 * Returns the unique set of flag keys triggered.
 * Merges with any existing flags (additive — never removes flags within a call).
 */
export function detectRiskFlagsFromText(
  text: string,
  matterType?: MatterType | string,
  existingFlags: string[] = [],
): string[] {
  const lower = text.toLowerCase();
  const flags = new Set(existingFlags);

  for (const rule of RISK_FLAG_RULES) {
    if (rule.test(lower, matterType)) {
      flags.add(rule.flag);
    }
  }

  return Array.from(flags);
}
