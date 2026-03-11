/**
 * Urgency detector — measures how time-sensitive the legal matter is.
 *
 * IMPORTANT: Urgency is a separate dimension from emotional state.
 * A caller can be calm and still have a critical deadline (e.g., court tomorrow).
 * A caller can be distressed but have a low-urgency matter (e.g., ongoing divorce).
 *
 * Levels:
 *   critical — imminent deadline (today/tomorrow) or active custody situation
 *   high     — near-term deadline this week or statute of limitations concern
 *   medium   — upcoming deadline, ongoing treatment, or clear time pressure
 *   low      — no explicit deadline signals detected
 */

import { UrgencyLevel } from '../types';

const CRITICAL_SIGNALS: string[] = [
  'court tomorrow',
  'hearing tomorrow',
  'court today',
  'hearing today',
  'court in the morning',
  'arraignment tomorrow',
  'deadline is today',
  'deadline is tomorrow',
  'expires today',
  'expires tomorrow',
  'statute of limitations expires',
  'statute runs',
  'in jail right now',
  'currently in custody',
  'emergency hearing',
  'need help tonight',
  'happening right now',
];

const HIGH_SIGNALS: string[] = [
  'court date',
  'court next week',
  'hearing next week',
  'deadline',
  'statute of limitations',
  'time limit',
  'urgent',
  'as soon as possible',
  'asap',
  'this week',
  'expires soon',
  'running out of time',
  'time is running',
  'need to file soon',
  'before friday',
  'before monday',
  'custody hearing',
  'arraignment',
  'sentencing',
];

const MEDIUM_SIGNALS: string[] = [
  'next month',
  'in a few weeks',
  'soon',
  'still in hospital',
  'still receiving treatment',
  'still seeing doctors',
  'waiting for surgery',
  'ongoing medical',
  'still out of work',
  'currently unable to work',
];

export interface UrgencyDetection {
  urgencyLevel: UrgencyLevel;
  confidence: number; // 0–1
  signals: string[];
}

/**
 * Detect urgency level from transcript.
 * Checks from most urgent to least to return the highest applicable level.
 */
export function detectUrgency(transcript: string): UrgencyDetection {
  const lower = transcript.toLowerCase();

  const critMatches = CRITICAL_SIGNALS.filter((s) => lower.includes(s));
  if (critMatches.length > 0) {
    return { urgencyLevel: 'critical', confidence: 0.9, signals: critMatches };
  }

  const highMatches = HIGH_SIGNALS.filter((s) => lower.includes(s));
  if (highMatches.length > 0) {
    const confidence = Math.min(0.9, 0.6 + highMatches.length * 0.1);
    return { urgencyLevel: 'high', confidence, signals: highMatches };
  }

  const medMatches = MEDIUM_SIGNALS.filter((s) => lower.includes(s));
  if (medMatches.length > 0) {
    return { urgencyLevel: 'medium', confidence: 0.65, signals: medMatches };
  }

  return { urgencyLevel: 'low', confidence: 0.5, signals: [] };
}
