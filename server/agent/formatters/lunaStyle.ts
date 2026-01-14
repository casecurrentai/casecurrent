/**
 * Luna-Style Speech Formatter
 * 
 * Transforms AI response text into warm, human-like speech patterns
 * that sound natural when spoken by the OpenAI Realtime voice model.
 * 
 * ARCHITECTURE NOTE:
 * With OpenAI Realtime Voice API, the model generates speech directly from
 * its completions. We cannot intercept text before TTS without implementing
 * a complex "server-steered" pattern (capture → cancel → format → resend).
 * 
 * Therefore, Luna-style behavior is controlled through:
 * 1. System prompt (server/agent/prompt.ts) - PRIMARY control mechanism
 * 2. Instructions in response.create calls (server/openai/realtime.ts)
 * 3. This formatter for:
 *    - Any text WE directly compose and send to be spoken
 *    - Post-hoc validation of transcripts
 *    - Testing and documentation
 * 
 * Key behaviors:
 * - Short sentences with natural rhythm
 * - Empathy-first responses for emotional situations
 * - Rising intonation on questions via repeat-back phrasing
 * - Gentle confirmations with spelling/number verification
 * - Calm transitions for transfers
 */

export interface LunaStyleContext {
  callerName?: string;
  isEmergency?: boolean;
  isTransfer?: boolean;
  previousTopic?: string;
}

const EMERGENCY_KEYWORDS = [
  'hospital', 'emergency', 'hurt', 'injured', 'accident', 'pain',
  'bleeding', 'died', 'death', 'dying', 'surgery', 'icu', 'ambulance',
  'arrested', 'jail', 'custody', 'crisis', 'scared', 'afraid'
];

const SERIOUS_KEYWORDS = [
  'fired', 'evicted', 'divorce', 'custody', 'foreclosure', 'bankrupt',
  'discrimination', 'harassment', 'assault', 'abuse', 'threatening'
];

/**
 * Detects if text contains emergency or serious situation keywords
 */
function detectSeriousSituation(text: string): { isEmergency: boolean; isSeriou: boolean; keyword?: string } {
  const lower = text.toLowerCase();
  
  for (const keyword of EMERGENCY_KEYWORDS) {
    if (lower.includes(keyword)) {
      return { isEmergency: true, isSeriou: true, keyword };
    }
  }
  
  for (const keyword of SERIOUS_KEYWORDS) {
    if (lower.includes(keyword)) {
      return { isEmergency: false, isSeriou: true, keyword };
    }
  }
  
  return { isEmergency: false, isSeriou: false };
}

/**
 * Shortens long sentences by breaking at safe points
 */
function shortenCadence(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const result: string[] = [];
  
  for (const sentence of sentences) {
    if (sentence.length > 100) {
      const parts = sentence.split(/,\s+(?=[A-Z]|and\s|but\s|so\s|then\s)/i);
      if (parts.length > 1) {
        result.push(...parts.map((p, i) => {
          const trimmed = p.trim();
          if (i < parts.length - 1 && !trimmed.endsWith('.') && !trimmed.endsWith('?') && !trimmed.endsWith('!')) {
            return trimmed + '.';
          }
          return trimmed;
        }));
      } else {
        result.push(sentence);
      }
    } else {
      result.push(sentence);
    }
  }
  
  return result.join(' ');
}

/**
 * Ensures questions end with proper punctuation and pacing
 */
function formatQuestions(text: string): string {
  return text
    .replace(/\b(can I|could I|may I|what is|what's|where is|how can|would you|do you|are you|is that)\b[^?.!]*(?<![?.!])$/gim, match => {
      return match.trim() + '?';
    });
}

/**
 * Adds confirmation phrasing for phone numbers and spellings
 */
function formatConfirmations(text: string): string {
  return text
    .replace(/(?:your (?:phone )?number is|that's|that is)\s*([+\d\-\(\)\s]{10,})/gi, 
      (_, number) => `Just to confirm... that's ${formatPhoneForSpeech(number)}?`)
    .replace(/(?:spelled|spelling)\s*([A-Z\-]+)/gi,
      (_, letters) => `Just to confirm... that's ${letters.split('').join('-')}?`);
}

/**
 * Formats phone numbers for natural speech
 */
function formatPhoneForSpeech(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}... ${digits.slice(3, 6)}... ${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `${digits.slice(1, 4)}... ${digits.slice(4, 7)}... ${digits.slice(7)}`;
  }
  return phone;
}

/**
 * Adds transfer pacing for warm handoffs
 */
function formatTransfer(text: string): string {
  const transferIndicators = [
    'transfer', 'connect', 'put you through', 'hand you off', 'speak with'
  ];
  
  const lower = text.toLowerCase();
  if (transferIndicators.some(ind => lower.includes(ind))) {
    return text
      .replace(/I'm going to (transfer|connect) you/gi, 
        "Okay. I'm going to $1 you with an attorney now.")
      .replace(/(please hold|hold on|one moment)/gi, 
        "It might take a minute. Please hold... someone will be with you shortly.");
  }
  
  return text;
}

/**
 * Adds empathetic micro-responses for serious situations
 */
function addEmpathy(text: string, context: LunaStyleContext): string {
  const { isEmergency, isSeriou, keyword } = detectSeriousSituation(text);
  
  if (!isEmergency && !isSeriou) {
    return text;
  }
  
  const name = context.callerName;
  const namePrefix = name ? `${name}. ` : '';
  
  const sentences = text.split(/(?<=[.!?])\s+/);
  const result: string[] = [];
  let empathyAdded = false;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const { isEmergency: sentenceEmergency, isSeriou: sentenceSerious } = detectSeriousSituation(sentence);
    
    if ((sentenceEmergency || sentenceSerious) && !empathyAdded) {
      if (sentenceEmergency) {
        result.push(`Oh no, ${namePrefix}I'm so sorry to hear that.`);
        result.push('Are you okay?');
      } else {
        result.push(`I'm sorry, ${namePrefix}that sounds really difficult.`);
      }
      empathyAdded = true;
      result.push(sentence);
    } else {
      result.push(sentence);
    }
  }
  
  return result.join(' ');
}

/**
 * Creates repeat-back questions for important facts
 */
function createRepeatBackQuestions(text: string): string {
  const locationPattern = /(?:I'm|I am|we're|we are)\s+(?:at|in)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/gi;
  
  return text.replace(locationPattern, (match, location) => {
    const { isEmergency } = detectSeriousSituation(location);
    if (isEmergency) {
      return `${match}. And you're at the ${location}?`;
    }
    return match;
  });
}

/**
 * Main formatter function - transforms text for Luna-style voice delivery
 */
export function formatForVoice(text: string, context: LunaStyleContext = {}): string {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  let formatted = text;
  
  formatted = shortenCadence(formatted);
  formatted = formatQuestions(formatted);
  formatted = formatConfirmations(formatted);
  formatted = addEmpathy(formatted, context);
  formatted = createRepeatBackQuestions(formatted);
  
  if (context.isTransfer) {
    formatted = formatTransfer(formatted);
  }
  
  formatted = formatted
    .replace(/\s+/g, ' ')
    .replace(/\.\s*\./g, '.')
    .replace(/\?\s*\?/g, '?')
    .trim();
  
  return formatted;
}

/**
 * Validates that text has no filler words (um, uh, etc.)
 * This is a check rather than a transform - the AI should not be producing these
 */
export function hasFillerWords(text: string): boolean {
  const fillers = /\b(um|uh|er|ah|like,|you know,)\b/gi;
  return fillers.test(text);
}

/**
 * Quick validation that text follows Luna style guidelines
 */
export function validateLunaStyle(text: string): { 
  valid: boolean; 
  issues: string[] 
} {
  const issues: string[] = [];
  
  if (hasFillerWords(text)) {
    issues.push('Contains filler words (um, uh, etc.)');
  }
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  const longSentences = sentences.filter(s => s.trim().length > 150);
  if (longSentences.length > 0) {
    issues.push(`Has ${longSentences.length} sentences over 150 characters`);
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

export default formatForVoice;
