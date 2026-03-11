/**
 * Emotional state detector — classifies the caller's affective state from transcript.
 *
 * IMPORTANT: Emotional state is separate from urgency.
 * A caller can be distressed without having an urgent matter,
 * or calm while describing a time-critical situation.
 *
 * The state engine uses emotional state to adjust Avery's tone and repair strategy.
 * High-distress or safety-risk states can trigger a transfer recommendation.
 *
 * Patterns are checked in priority order: more severe states first.
 */

import { EmotionalState } from '../types';

// Each entry: [state, signal phrases]
// Longer/more specific phrases reduce false positives.
const EMOTIONAL_PATTERNS: [EmotionalState, string[]][] = [
  [
    'distressed',
    [
      'crying',
      'sobbing',
      'i am devastated',
      "i'm devastated",
      'lost everything',
      "can't take it anymore",
      'i cannot take it',
      'i feel hopeless',
      'breaking down',
      'falling apart',
      'i have nowhere to turn',
      'completely lost',
      'suicid',
      'harm myself',
      'hurt myself',
    ],
  ],
  [
    'angry',
    [
      'furious',
      'outraged',
      "i'm so angry",
      'i am so angry',
      'i am livid',
      "i'm livid",
      'this is ridiculous',
      'this is unacceptable',
      'they ruined my life',
      'i want to sue them',
      'they need to pay',
      'this is wrong',
    ],
  ],
  [
    'overwhelmed',
    [
      'i am overwhelmed',
      "i'm overwhelmed",
      "don't know where to start",
      'too much to handle',
      'too much going on',
      "can't handle this",
      "can't deal with this",
      'everything is falling apart',
      "don't know what to do",
      "i don't know where to begin",
    ],
  ],
  [
    'anxious',
    [
      'i am scared',
      "i'm scared",
      'i am afraid',
      "i'm afraid",
      "i'm worried",
      'i am worried',
      'i am nervous',
      "i'm nervous",
      "i'm panicking",
      'i am panicking',
      'terrified',
      'what will happen to me',
      'what if i',
    ],
  ],
  [
    'confused',
    [
      'i am confused',
      "i'm confused",
      "i don't understand",
      'i do not understand',
      'what does that mean',
      'can you explain',
      'what happens next',
      'i have no idea',
      "i'm not sure what",
      'i am not sure what',
      'totally lost',
    ],
  ],
  [
    'urgent',
    [
      'i need help right now',
      'this is urgent',
      'please hurry',
      'i need someone immediately',
      'right away please',
    ],
  ],
  [
    'calm',
    [
      'no rush',
      'just wanted to ask',
      'just wondering',
      'just checking',
      'whenever you are available',
      'at your convenience',
      'not an emergency',
    ],
  ],
];

export interface EmotionalStateDetection {
  emotionalState: EmotionalState;
  confidence: number; // 0–1
  signals: string[];
}

/**
 * Detect the caller's emotional state from the transcript.
 * Returns 'unknown' if no patterns match with sufficient confidence.
 */
export function detectEmotionalState(transcript: string): EmotionalStateDetection {
  const lower = transcript.toLowerCase();

  for (const [state, signals] of EMOTIONAL_PATTERNS) {
    const matched = signals.filter((s) => lower.includes(s));
    if (matched.length > 0) {
      // Confidence scales with number of matched signals
      const confidence = Math.min(0.95, 0.55 + matched.length * 0.15);
      return { emotionalState: state, confidence, signals: matched };
    }
  }

  return { emotionalState: 'unknown', confidence: 0.3, signals: [] };
}
