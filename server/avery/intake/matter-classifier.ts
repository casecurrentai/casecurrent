/**
 * Matter classifier — derives legal matter type from transcript text.
 *
 * Heuristic keyword scoring. Deliberately simple for first pass.
 * Future improvement: replace or augment with an LLM classification call
 * using the existing OpenAI client pattern (see server/intake/extractIntake.ts).
 */

import { MatterType } from '../types';

// Keywords associated with each matter type.
// Longer phrases are preferred because they reduce false positives.
const MATTER_KEYWORDS: Record<Exclude<MatterType, 'general' | 'unknown'>, string[]> = {
  personal_injury: [
    'car accident', 'auto accident', 'vehicle accident', 'truck accident',
    'motorcycle accident', 'pedestrian accident', 'slip and fall', 'slip fall',
    'rear-end', 'rear end', 'collision', 'crash',
    'injury', 'injured', 'hurt', 'hurting',
    'hospital', 'emergency room', 'er visit', 'ambulance',
    'surgery', 'surgery needed', 'medical treatment', 'doctor visit',
    'pain', 'chronic pain', 'broken bone', 'fracture', 'whiplash',
    'missed work', 'cannot work', 'disability',
  ],
  employment: [
    'fired', 'terminated', 'laid off', 'wrongful termination',
    'discrimination', 'racial discrimination', 'age discrimination', 'gender discrimination',
    'sexual harassment', 'harassment at work', 'hostile work environment',
    'retaliation', 'whistleblower',
    'unpaid wages', 'overtime', 'wage theft', 'minimum wage',
    'eeoc', 'employment attorney', 'my employer',
  ],
  family: [
    'divorce', 'getting divorced', 'want a divorce',
    'custody', 'child custody', 'joint custody', 'sole custody',
    'child support', 'spousal support', 'alimony',
    'visitation', 'parenting plan', 'parenting time',
    'separation', 'legal separation',
    'adoption', 'restraining order', 'protective order', 'domestic violence',
    'paternity', 'guardianship',
  ],
  criminal: [
    'arrested', 'got arrested', 'police arrested',
    'charged', 'criminal charges', 'felony', 'misdemeanor',
    'dui', 'dwi', 'drunk driving',
    'drug charges', 'drug possession', 'drug trafficking',
    'assault', 'battery', 'domestic assault',
    'theft', 'robbery', 'burglary',
    'in jail', 'in prison', 'custody', 'bail', 'bond',
    'court date', 'arraignment', 'indictment', 'probation', 'parole',
    'public defender', 'criminal defense',
  ],
  estate: [
    'probate', 'estate', 'inheritance',
    'will', 'last will', 'testamentary',
    'trust', 'living trust', 'irrevocable trust',
    'executor', 'administrator', 'beneficiary',
    'power of attorney', 'healthcare directive', 'living will',
    'deceased', 'passed away', 'died', 'death',
    'asset distribution', 'heir',
  ],
};

export interface MatterClassification {
  matterType: MatterType;
  confidence: number; // 0–1
  matchedKeywords: string[];
  scores: Partial<Record<MatterType, number>>;
}

/**
 * Classify the matter type from transcript text using keyword scoring.
 * Returns 'unknown' if no keywords match.
 */
export function classifyMatter(transcript: string): MatterClassification {
  const lower = transcript.toLowerCase();
  const scores: Partial<Record<MatterType, number>> = {};
  let maxScore = 0;
  let best: MatterType = 'unknown';
  const bestKeywords: string[] = [];

  for (const [type, keywords] of Object.entries(MATTER_KEYWORDS) as [
    Exclude<MatterType, 'general' | 'unknown'>,
    string[],
  ][]) {
    const matched = keywords.filter((k) => lower.includes(k));
    const score = matched.length;
    scores[type] = score;

    if (score > maxScore) {
      maxScore = score;
      best = type;
      bestKeywords.splice(0, bestKeywords.length, ...matched);
    }
  }

  // Confidence increases with number of keyword matches, capping at 0.95.
  // 0 matches → unknown (0.0 confidence)
  // 1 match   → 0.40
  // 2 matches → 0.55
  // 3 matches → 0.70
  // 4+ matches → 0.80–0.95
  const confidence =
    maxScore === 0 ? 0 : Math.min(0.95, 0.4 + (maxScore - 1) * 0.15);

  return {
    matterType: maxScore === 0 ? 'unknown' : best,
    confidence,
    matchedKeywords: bestKeywords.slice(0, 10),
    scores,
  };
}
