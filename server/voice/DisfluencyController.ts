/**
 * DisfluencyController
 *
 * Adds controlled, natural-sounding speech disfluencies (um, uh, so, like)
 * to assistant responses to make them sound more human and casual.
 *
 * Safety guarantees:
 * - Max 1 filler per turn (configurable)
 * - Never inserts fillers in blocked contexts (numbers, dates, legal disclaimers, etc.)
 * - Respects caller emotional state (reduces/disables for upset callers)
 * - Only inserts at safe boundaries (turn start, sentence boundaries)
 */

export interface DisfluencyConfig {
  enabled: boolean;
  probability: number; // 0-1, default 0.12 (12%)
  maxPerTurn: number; // default 1
  style: 'light' | 'none' | 'casual';
}

export interface DisfluencyResult {
  text: string;
  eligible: boolean;
  reason: string;
  insertedToken: string | null;
  probabilityUsed: number;
}

const LIGHT_FILLERS = ['Um, ', 'Uh, ', 'So, ', 'Well, '];
const CASUAL_FILLERS = ['Um, ', 'Uh, ', 'So, ', 'Like, ', 'Well, ', 'Yeah—so, ', 'Right, '];

const BLOCKED_PATTERNS = [
  // Phone numbers
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/,
  /\+1?\s?\d{10,11}/,
  // Dates
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(st|nd|rd|th)?,?\s*\d{4}?\b/i,
  /\b\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\b/i,
  // Dollar amounts
  /\$\d+([,.]?\d+)*/,
  /\b\d+\s*(dollars?|cents?)\b/i,
  // Percentages
  /\b\d+(\.\d+)?%/,
  /\b\d+(\.\d+)?\s*percent\b/i,
  // Addresses
  /\b\d+\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)\b/i,
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  // URLs
  /https?:\/\/[^\s]+/,
  /www\.[^\s]+/,
  // Legal disclaimers / instructions
  /\bby law\b/i,
  /\blegal(ly)?\b/i,
  /\bdisclaimer\b/i,
  /\bterms (of|and) (service|conditions)\b/i,
  /\bprivacy policy\b/i,
  /\bclick\b/i,
  /\bgo to\b/i,
  /\btype\b/i,
  /\benter\b/i,
  /\bsubmit\b/i,
  /\bpress\b/i,
  /\bselect\b/i,
  /\bcase number\b/i,
  /\bclaim number\b/i,
  /\bdocket\b/i,
  /\bstatute\b/i,
  /\bcourt date\b/i,
  /\bhearing\b/i,
  /\bfiling deadline\b/i,
];

const URGENT_TONE_PATTERNS = [
  /\bi('m| am)\s+(so\s+)?(upset|angry|frustrated|furious|mad)\b/i,
  /\bthis is\s+(an\s+)?emergency\b/i,
  /\bi need (help|this) (now|immediately|right now|urgently)\b/i,
  /\bcall 911\b/i,
  /\bimmediate danger\b/i,
  /\bhurry\b/i,
  /\basap\b/i,
];

export function getConfig(): DisfluencyConfig {
  const enabled = process.env.DISFLUENCY_ENABLED !== 'false';
  const probability = parseFloat(process.env.DISFLUENCY_PROB || '0.12');
  const maxPerTurn = parseInt(process.env.DISFLUENCY_MAX_PER_TURN || '1', 10);
  const style = (process.env.DISFLUENCY_STYLE as DisfluencyConfig['style']) || 'light';

  return {
    enabled: enabled && style !== 'none',
    probability: isNaN(probability) ? 0.12 : Math.max(0, Math.min(1, probability)),
    maxPerTurn: isNaN(maxPerTurn) ? 1 : Math.max(0, maxPerTurn),
    style: ['light', 'none', 'casual'].includes(style) ? style : 'light',
  };
}

function hasBlockedContent(text: string): { blocked: boolean; pattern?: string } {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, pattern: pattern.source };
    }
  }
  return { blocked: false };
}

function hasUrgentTone(userMessage?: string): boolean {
  if (!userMessage) return false;
  return URGENT_TONE_PATTERNS.some((pattern) => pattern.test(userMessage));
}

function selectFiller(style: DisfluencyConfig['style']): string {
  const fillers = style === 'casual' ? CASUAL_FILLERS : LIGHT_FILLERS;
  return fillers[Math.floor(Math.random() * fillers.length)];
}

function insertFillerAtBoundary(text: string, filler: string): string {
  const trimmed = text.trimStart();
  const leadingWhitespace = text.slice(0, text.length - trimmed.length);
  return leadingWhitespace + filler + trimmed;
}

export function applyDisfluency(
  text: string,
  userMessage?: string,
  config?: DisfluencyConfig
): DisfluencyResult {
  const cfg = config || getConfig();

  if (!cfg.enabled) {
    return {
      text,
      eligible: false,
      reason: 'disabled',
      insertedToken: null,
      probabilityUsed: 0,
    };
  }

  if (cfg.maxPerTurn <= 0) {
    return {
      text,
      eligible: false,
      reason: 'max_per_turn_zero',
      insertedToken: null,
      probabilityUsed: cfg.probability,
    };
  }

  const blockedCheck = hasBlockedContent(text);
  if (blockedCheck.blocked) {
    const result: DisfluencyResult = {
      text,
      eligible: false,
      reason: `blocked_content:${blockedCheck.pattern}`,
      insertedToken: null,
      probabilityUsed: cfg.probability,
    };
    logDebug(result);
    return result;
  }

  if (hasUrgentTone(userMessage)) {
    const result: DisfluencyResult = {
      text,
      eligible: false,
      reason: 'urgent_tone',
      insertedToken: null,
      probabilityUsed: 0,
    };
    logDebug(result);
    return result;
  }

  if (text.trim().length < 10) {
    const result: DisfluencyResult = {
      text,
      eligible: false,
      reason: 'text_too_short',
      insertedToken: null,
      probabilityUsed: cfg.probability,
    };
    logDebug(result);
    return result;
  }

  const roll = Math.random();
  if (roll >= cfg.probability) {
    const result: DisfluencyResult = {
      text,
      eligible: true,
      reason: 'probability_miss',
      insertedToken: null,
      probabilityUsed: cfg.probability,
    };
    logDebug(result);
    return result;
  }

  const filler = selectFiller(cfg.style);
  const modifiedText = insertFillerAtBoundary(text, filler);

  const result: DisfluencyResult = {
    text: modifiedText,
    eligible: true,
    reason: 'inserted',
    insertedToken: filler.trim(),
    probabilityUsed: cfg.probability,
  };
  logDebug(result);
  return result;
}

function logDebug(result: DisfluencyResult): void {
  console.log(
    `[Disfluency] eligible=${result.eligible} reason="${result.reason}" ` +
      `inserted="${result.insertedToken || ''}" prob=${result.probabilityUsed.toFixed(2)}`
  );
}

export function generateVoicePromptInstructions(): string {
  const cfg = getConfig();

  if (!cfg.enabled || cfg.style === 'none') {
    return '';
  }

  const styleDesc = cfg.style === 'casual' ? 'light, occasional' : 'very rare, subtle';
  const fillers = cfg.style === 'casual' ? 'um, uh, so, like, well' : 'um, uh, so, well';
  const maxPct = Math.round(cfg.probability * 100);

  return `
NATURAL SPEECH DISFLUENCIES (${styleDesc})
- Occasionally (about ${maxPct}% of turns, max 1 per response) use light fillers: "${fillers}"
- Use them ONLY at safe moments:
  - Before answering complex questions (a "thinking" moment)
  - When transitioning topics ("So, ...")
  - When acknowledging + pivoting ("Yeah—so, ...")
- NEVER use fillers:
  - In the middle of phone numbers, dates, addresses, dollar amounts, percentages, names, emails, or URLs
  - During legal disclaimers, instructions ("click", "go to", "type"), or action steps
  - When the caller sounds upset, urgent, or distressed
  - More than once per response
- If uncertain, skip the filler entirely—clarity trumps naturalness.
`;
}

export class DisfluencyTracker {
  private lastFillerTime = 0;
  private fillerCountThisTurn = 0;
  private minIntervalMs = 12000;

  reset(): void {
    this.fillerCountThisTurn = 0;
  }

  canInsert(config: DisfluencyConfig): boolean {
    if (!config.enabled) return false;
    if (this.fillerCountThisTurn >= config.maxPerTurn) return false;

    const now = Date.now();
    if (now - this.lastFillerTime < this.minIntervalMs) return false;

    return true;
  }

  recordInsertion(): void {
    this.lastFillerTime = Date.now();
    this.fillerCountThisTurn++;
  }
}
