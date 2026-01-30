import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { createHmac } from 'crypto';
import { generateVoicePromptInstructions } from '../../voice/DisfluencyController';
import { streamTTS, streamTTSWithFallback, logTTSConfig, logElevenLabsKeyStatus, isTTSAvailable } from '../../tts/elevenlabs';
import { prisma } from '../../db';
import { extractIntakeWithOpenAI, type IntakeExtraction } from '../../intake/extractIntake';

// Phone number masking for logs
function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '(none)';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return '****' + digits.slice(-4);
}

// Finalize-once guard: track callSids that have already been finalized
const finalizedCallSids = new Set<string>();
const FINALIZED_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Clean up old entries periodically
setInterval(() => {
  // Clear finalized cache older than TTL (we don't track timestamps, so just clear periodically)
  if (finalizedCallSids.size > 1000) {
    finalizedCallSids.clear();
  }
}, 30 * 60 * 1000); // Every 30 minutes

const OPENAI_REALTIME_URL =
  'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';
const TOKEN_MAX_AGE_SECONDS = 600;
const LOG_FRAME_INTERVAL = 100;
const START_TIMEOUT_MS = 5000;

// =============================================================================
// TURN STATE MACHINE - Legal Intake Tuned Thresholds
// =============================================================================
const TURN_THRESHOLDS = {
  postTtsDeadzoneMs: 400,        // Ignore speech after TTS ends to filter echo (was 700)
  longNoInputMs: 7000,           // Reprompt after 7s silence (was 9s)
  idleNoInputMs: 12000,          // General idle timeout
  endDebounceMs: 450,            // Debounce before finalizing user turn
  finalizeTimeoutMs: 1200,       // Max wait for final transcript
  transcriptGraceMs: 700,        // Wait for transcript after speech_stopped before deciding empty
  minUtteranceMs: 450,           // Minimum speech duration to accept (was 1200)
  minTranscriptLen: 8,           // Minimum transcript length (chars) to accept
  minWords: 2,                   // Minimum word count to accept
  bargeInEchoIgnoreMs: 800,      // Ignore speech for Xms after TTS starts
  bargeInSustainedSpeechMs: 600,  // Require sustained speech before barge-in
  bargeInCooldownMs: 800,        // Cooldown after barge-in triggers
} as const;

// Turn states for the state machine
type TurnState =
  | 'INIT'
  | 'IDLE'
  | 'ASSIST_PLANNING'
  | 'ASSIST_SPEAKING'
  | 'POST_TTS_DEADZONE'
  | 'WAITING_FOR_USER_START'
  | 'USER_SPEAKING'
  | 'USER_END_DEBOUNCE'
  | 'USER_FINALIZING'
  | 'USER_VALIDATING'
  | 'WAITING_FOR_FINAL_TRANSCRIPT'
  | 'NO_INPUT_REPROMPT'
  | 'SHORT_UTTER_REPROMPT'
  | 'TRANSCRIPT_MISSING_REPROMPT';

interface TurnControllerConfig {
  requestId: string;
  onSpeakText: (text: string, isReprompt: boolean) => Promise<void>;
  onStopTts: () => void;
  onCancelLlmResponse: () => void;
  onRequestLlmResponse: (prompt?: string) => void;
  onClearTwilioAudio: () => void;
  onLog: (data: Record<string, any>) => void;
}

/**
 * TurnController - Manages turn-taking state machine for voice conversations
 * 
 * Ensures correct "yield the floor" behavior:
 * - After Avery asks a question, system MUST wait for validated user response
 * - Phantom turns are prevented by requiring FINAL transcript + validation
 * - Barge-in is carefully gated to avoid echo triggers
 */
class TurnController {
  private state: TurnState = 'INIT';
  private config: TurnControllerConfig;
  
  // Timing state
  private ttsStartAt: number | null = null;
  private ttsEndAt: number | null = null;
  private speechStartAt: number | null = null;
  private speechEndAt: number | null = null;
  private lastBargeInAt: number | null = null;
  private userSpeechTotalMs: number = 0;
  
  // Timers
  private bargeInTimer: NodeJS.Timeout | null = null;
  private noInputTimer: NodeJS.Timeout | null = null;
  private endDebounceTimer: NodeJS.Timeout | null = null;
  private finalizeTimer: NodeJS.Timeout | null = null;
  private postTtsDeadzoneTimer: NodeJS.Timeout | null = null;
  
  // Transcript state
  private pendingInterimTranscript: string = '';
  private lastFinalTranscript: string = '';
  private transcriptFinalReceived: boolean = false;
  private lastQuestionAsked: string = '';
  private waitingForPhoneNumber: boolean = false;
  private transcriptWaitTimer: NodeJS.Timeout | null = null;

  // Latency tracking
  private turnAcceptedAt: number | null = null;
  
  constructor(config: TurnControllerConfig) {
    this.config = config;
    this.logTransition('INIT', 'INIT', 'controller_created');
  }
  
  // ===========================================================================
  // PUBLIC API - Event handlers called by streamHandler
  // ===========================================================================
  
  /**
   * Called when LLM starts generating a response
   */
  onLlmResponseStarted(): void {
    // Guard: Block LLM calls when waiting for user
    if (this.state === 'WAITING_FOR_USER_START') {
      this.logFatal('LLM_BLOCKED', 'Attempted to call LLM while WAITING_FOR_USER_START');
      return;
    }
    
    this.transition('ASSIST_PLANNING', 'llm_response_started');
  }
  
  /**
   * Called when TTS starts speaking
   */
  onTtsStarted(text: string): void {
    this.ttsStartAt = Date.now();
    this.clearNoInputTimer();
    
    // Detect if this is a question (ends with ?)
    if (text.trim().endsWith('?')) {
      this.lastQuestionAsked = text;
      // Detect phone number requests
      this.waitingForPhoneNumber = /phone|number|reach|call|callback/i.test(text);
    }
    
    this.transition('ASSIST_SPEAKING', 'tts_started');
  }
  
  /**
   * Called when TTS finishes speaking normally (not barged in)
   */
  onTtsFinished(): void {
    this.ttsEndAt = Date.now();
    
    // Enter deadzone to filter echo
    this.transition('POST_TTS_DEADZONE', 'tts_finished');
    
    // After deadzone, transition to waiting for user
    this.postTtsDeadzoneTimer = setTimeout(() => {
      this.postTtsDeadzoneTimer = null;
      if (this.state === 'POST_TTS_DEADZONE') {
        this.transition('WAITING_FOR_USER_START', 'deadzone_complete');
        this.startNoInputTimer();
      }
    }, TURN_THRESHOLDS.postTtsDeadzoneMs);
  }
  
  /**
   * Called when user speech is detected (from OpenAI VAD)
   */
  onSpeechStarted(): void {
    const now = Date.now();
    this.speechStartAt = now;
    
    // State-specific handling
    switch (this.state) {
      case 'ASSIST_SPEAKING':
        // Evaluate barge-in
        this.evaluateBargeIn(now);
        break;
        
      case 'POST_TTS_DEADZONE':
        // Ignore speech during deadzone (echo filtering)
        this.logDecision('IGNORE', 'speech_in_deadzone', { 
          msSinceTtsEnd: this.ttsEndAt ? now - this.ttsEndAt : null 
        });
        break;
        
      case 'WAITING_FOR_USER_START':
        // User started speaking - transition
        this.clearNoInputTimer();
        this.transition('USER_SPEAKING', 'user_speech_detected');
        break;
        
      case 'USER_END_DEBOUNCE':
        // User resumed speaking - cancel debounce
        if (this.endDebounceTimer) {
          clearTimeout(this.endDebounceTimer);
          this.endDebounceTimer = null;
        }
        this.transition('USER_SPEAKING', 'user_resumed_speaking');
        break;
        
      case 'USER_SPEAKING':
        // Already speaking, just update timing
        break;

      case 'IDLE':
        // Speech during IDLE (between turn acceptance and response.created).
        // Track it as user speaking so it isn't lost.
        this.transition('USER_SPEAKING', 'speech_during_idle');
        break;

      default:
        this.logDecision('IGNORE', 'speech_in_unexpected_state', { state: this.state });
    }
  }
  
  /**
   * Called when user speech ends (from OpenAI VAD)
   */
  onSpeechStopped(): void {
    const now = Date.now();
    const speechDuration = this.speechStartAt ? now - this.speechStartAt : 0;
    this.speechEndAt = now;
    this.userSpeechTotalMs += speechDuration;
    
    // Cancel pending barge-in timer
    if (this.bargeInTimer) {
      clearTimeout(this.bargeInTimer);
      this.bargeInTimer = null;
      this.logDecision('IGNORE', 'barge_in_cancelled_speech_stopped', { 
        speechDurationMs: speechDuration 
      });
    }
    
    // State-specific handling
    switch (this.state) {
      case 'USER_SPEAKING':
        // Start end-of-turn debounce
        this.transition('USER_END_DEBOUNCE', 'speech_stopped');
        this.startEndDebounceTimer();
        break;
        
      case 'ASSIST_SPEAKING':
        // Speech stopped during TTS (was evaluating barge-in) - ignore
        this.speechStartAt = null;
        break;
        
      default:
        // Reset for other states
        this.speechStartAt = null;
    }
  }
  
  /**
   * Called with interim transcript (UI/log only - DO NOT act on this)
   */
  onTranscriptInterim(text: string): void {
    this.pendingInterimTranscript = text;

    // Cancel reprompt timers when we get real interim text — speech is happening
    if (text.trim().length > 0 && this.noInputTimer) {
      clearTimeout(this.noInputTimer);
      this.noInputTimer = null;
      this.config.onLog({
        event: 'REPROMPT_CANCELED',
        requestId: this.config.requestId,
        reason: 'interim_transcript_arrived',
        text_preview: text.substring(0, 30),
      });
    }

    this.config.onLog({
      event: 'transcript_interim',
      requestId: this.config.requestId,
      state: this.state,
      text_preview: text.substring(0, 50),
      note: 'UI_ONLY_DO_NOT_ACT',
    });
  }
  
  /**
   * Called with final transcript - this is the ONLY transcript to act on
   */
  onTranscriptFinal(text: string): void {
    this.lastFinalTranscript = text;
    this.transcriptFinalReceived = true;

    // Cancel finalize timer if running
    if (this.finalizeTimer) {
      clearTimeout(this.finalizeTimer);
      this.finalizeTimer = null;
    }

    // Cancel transcript wait timer if running
    if (this.transcriptWaitTimer) {
      clearTimeout(this.transcriptWaitTimer);
      this.transcriptWaitTimer = null;
    }

    if (this.state === 'USER_END_DEBOUNCE' || this.state === 'USER_FINALIZING') {
      this.transition('USER_VALIDATING', 'final_transcript_received');
      this.validateUserUtterance(text);
    } else if (this.state === 'WAITING_FOR_FINAL_TRANSCRIPT') {
      // Transcript arrived while waiting — validate now
      this.config.onLog({
        event: 'TRANSCRIPT_ARRIVED_WHILE_WAITING',
        requestId: this.config.requestId,
        len: text.trim().length,
        preview: text.trim().substring(0, 40),
      });
      this.transition('USER_VALIDATING', 'transcript_arrived_after_wait');
      this.validateUserUtterance(text);
    } else if (this.state === 'ASSIST_SPEAKING' || this.state === 'POST_TTS_DEADZONE' || this.state === 'ASSIST_PLANNING') {
      // Transcript-based barge-in rescue: real speech arrived while assistant is talking
      const trimmed = text.trim();
      const charLen = trimmed.length;
      const wordCount = charLen > 0 ? trimmed.split(/\s+/).filter((w: string) => w.length > 0).length : 0;

      if (charLen >= 8 || wordCount >= 2) {
        this.config.onLog({
          event: 'DEADZONE_REAL_SPEECH',
          requestId: this.config.requestId,
          state: this.state,
          charLen,
          wordCount,
          preview: trimmed.substring(0, 40),
        });
        // Execute barge-in to stop TTS and cancel response
        this.config.onCancelLlmResponse();
        this.config.onStopTts();
        this.config.onClearTwilioAudio();
        this.forceUserSpeaking();
        // Validate the utterance directly
        this.transition('USER_VALIDATING', 'transcript_bargein_rescue');
        this.validateUserUtterance(text);
      } else {
        this.config.onLog({
          event: 'transcript_final_ignored',
          requestId: this.config.requestId,
          state: this.state,
          reason: 'too_short_for_bargein',
          charLen,
          wordCount,
        });
      }
    } else {
      this.config.onLog({
        event: 'transcript_final_ignored',
        requestId: this.config.requestId,
        state: this.state,
        reason: 'not_in_finalizing_state',
      });
    }
  }
  
  /**
   * Check if LLM calls are allowed in current state
   */
  canCallLlm(): boolean {
    const blocked = ['WAITING_FOR_USER_START', 'USER_SPEAKING', 'USER_END_DEBOUNCE', 'USER_FINALIZING', 'USER_VALIDATING', 'WAITING_FOR_FINAL_TRANSCRIPT'];
    return !blocked.includes(this.state);
  }
  
  /**
   * Get current state (for logging/debugging)
   */
  getState(): TurnState {
    return this.state;
  }

  getTurnAcceptedAt(): number | null {
    return this.turnAcceptedAt;
  }

  /**
   * Force transition to USER_SPEAKING from the standalone barge-in path.
   * This synchronises the TurnController when the outer executeBargeIn() fires
   * before the TurnController's own sustained-speech timer.
   */
  forceUserSpeaking(): void {
    this.transition('USER_SPEAKING', 'external_barge_in_sync');
  }

  /**
   * Clean up all timers
   */
  cleanup(): void {
    this.clearAllTimers();
  }
  
  // ===========================================================================
  // PRIVATE - State transitions
  // ===========================================================================
  
  private transition(newState: TurnState, reason: string): void {
    const oldState = this.state;
    this.state = newState;
    this.logTransition(oldState, newState, reason);
  }
  
  private logTransition(from: TurnState, to: TurnState, reason: string): void {
    this.config.onLog({
      event: 'turn_state_change',
      requestId: this.config.requestId,
      fromState: from,
      toState: to,
      reason,
      timestamp: new Date().toISOString(),
      stateData: {
        msSinceTtsStart: this.ttsStartAt ? Date.now() - this.ttsStartAt : null,
        userSpeechTotalMs: this.userSpeechTotalMs,
        transcriptFinalReceived: !!this.lastFinalTranscript,
        speechStartTime: this.speechStartAt,
        ttsStartTime: this.ttsStartAt,
        waitingForPhoneNumber: this.waitingForPhoneNumber,
      },
    });
  }
  
  private logDecision(decision: 'TRIGGER' | 'IGNORE', reason: string, extra: Record<string, any> = {}): void {
    this.config.onLog({
      event: 'barge_in_decision',
      requestId: this.config.requestId,
      state: this.state,
      decision,
      reason,
      msSinceTtsStart: this.ttsStartAt ? Date.now() - this.ttsStartAt : null,
      sustainedSpeechMs: this.speechStartAt ? Date.now() - this.speechStartAt : 0,
      userSpeechTotalMs: this.userSpeechTotalMs,
      ...extra,
    });
  }
  
  private logFatal(tag: string, message: string): void {
    const stack = new Error().stack;
    this.config.onLog({
      event: 'FATAL_TURN_VIOLATION',
      tag,
      requestId: this.config.requestId,
      state: this.state,
      message,
      stack: stack?.split('\n').slice(2, 5).join('\n'),
    });
  }
  
  // ===========================================================================
  // PRIVATE - Barge-in logic
  // ===========================================================================
  
  private evaluateBargeIn(now: number): void {
    const msSinceTtsStart = this.ttsStartAt ? now - this.ttsStartAt : null;
    const msSinceLastBargeIn = this.lastBargeInAt ? now - this.lastBargeInAt : null;
    
    // Gate 1: Must be in ASSIST_SPEAKING
    if (this.state !== 'ASSIST_SPEAKING') {
      this.logDecision('IGNORE', 'not_speaking', { state: this.state });
      return;
    }
    
    // Gate 2: Echo ignore window
    if (msSinceTtsStart !== null && msSinceTtsStart < TURN_THRESHOLDS.bargeInEchoIgnoreMs) {
      this.logDecision('IGNORE', 'echo_ignore_window', { msSinceTtsStart });
      return;
    }
    
    // Gate 3: Cooldown
    if (msSinceLastBargeIn !== null && msSinceLastBargeIn < TURN_THRESHOLDS.bargeInCooldownMs) {
      this.logDecision('IGNORE', 'cooldown_active', { msSinceLastBargeIn });
      return;
    }
    
    // Gate 4: Start sustained speech timer
    this.config.onLog({
      event: 'barge_in_timer_started',
      requestId: this.config.requestId,
      msSinceTtsStart,
      requiredMs: TURN_THRESHOLDS.bargeInSustainedSpeechMs,
    });
    
    const speechStartedAt = now;
    
    if (this.bargeInTimer) {
      clearTimeout(this.bargeInTimer);
    }
    
    this.bargeInTimer = setTimeout(() => {
      this.bargeInTimer = null;
      
      const actualDuration = Date.now() - speechStartedAt;
      
      // Gate 5: Check TTS still speaking
      if (this.state !== 'ASSIST_SPEAKING') {
        this.logDecision('IGNORE', 'tts_stopped_before_trigger', { actualDuration });
        return;
      }
      
      // Gate 6: Verify speech is still active
      if (!this.speechStartAt) {
        this.logDecision('IGNORE', 'speech_ended_before_trigger', { actualDuration });
        return;
      }
      
      // TRIGGER BARGE-IN
      this.logDecision('TRIGGER', 'sustained_speech_confirmed', { actualDuration });
      this.executeBargeIn();
      
    }, TURN_THRESHOLDS.bargeInSustainedSpeechMs);
  }
  
  private executeBargeIn(): void {
    this.lastBargeInAt = Date.now();

    // Stop TTS immediately
    this.config.onStopTts();

    // Cancel any in-flight OpenAI response so no new text queues
    this.config.onCancelLlmResponse();

    // Clear Twilio audio buffer
    this.config.onClearTwilioAudio();

    this.config.onLog({
      event: 'BARGE_IN_TRIGGERED',
      requestId: this.config.requestId,
      state: this.state,
    });

    // Transition to user speaking
    this.transition('USER_SPEAKING', 'barge_in_triggered');
  }
  
  // ===========================================================================
  // PRIVATE - Timers
  // ===========================================================================
  
  private startNoInputTimer(): void {
    this.clearNoInputTimer();

    const timeout = this.lastQuestionAsked
      ? TURN_THRESHOLDS.longNoInputMs
      : TURN_THRESHOLDS.idleNoInputMs;

    this.config.onLog({
      event: 'REPROMPT_SCHEDULED',
      requestId: this.config.requestId,
      delayMs: timeout,
      reason: this.lastQuestionAsked ? 'after_question' : 'idle',
    });

    this.noInputTimer = setTimeout(() => {
      this.noInputTimer = null;
      if (this.state === 'WAITING_FOR_USER_START') {
        this.transition('NO_INPUT_REPROMPT', 'no_input_timeout');
        this.handleNoInputReprompt();
      }
    }, timeout);
  }
  
  private clearNoInputTimer(): void {
    if (this.noInputTimer) {
      clearTimeout(this.noInputTimer);
      this.noInputTimer = null;
    }
  }
  
  private startEndDebounceTimer(): void {
    if (this.endDebounceTimer) {
      clearTimeout(this.endDebounceTimer);
    }
    
    this.endDebounceTimer = setTimeout(() => {
      this.endDebounceTimer = null;
      
      if (this.state === 'USER_END_DEBOUNCE') {
        this.transition('USER_FINALIZING', 'debounce_complete');
        this.startFinalizeTimer();
      }
    }, TURN_THRESHOLDS.endDebounceMs);
  }
  
  private startFinalizeTimer(): void {
    if (this.finalizeTimer) {
      clearTimeout(this.finalizeTimer);
    }
    
    this.finalizeTimer = setTimeout(() => {
      this.finalizeTimer = null;

      if (this.state === 'USER_FINALIZING') {
        if (this.transcriptFinalReceived && this.lastFinalTranscript) {
          // Final transcript already arrived — validate immediately
          this.transition('USER_VALIDATING', 'finalize_timeout_has_transcript');
          this.validateUserUtterance(this.lastFinalTranscript);
        } else if (this.pendingInterimTranscript && this.pendingInterimTranscript.trim().length >= TURN_THRESHOLDS.minTranscriptLen) {
          // Have a substantial interim transcript — validate with it
          this.config.onLog({
            event: 'finalize_timeout_using_interim',
            requestId: this.config.requestId,
            interimLen: this.pendingInterimTranscript.trim().length,
            preview: this.pendingInterimTranscript.trim().substring(0, 50),
          });
          this.transition('USER_VALIDATING', 'finalize_timeout_interim');
          this.validateUserUtterance(this.pendingInterimTranscript);
        } else {
          // No usable transcript yet — wait longer before giving up
          this.config.onLog({
            event: 'WAITING_FOR_TRANSCRIPT',
            requestId: this.config.requestId,
            transcriptFinalReceived: this.transcriptFinalReceived,
            interimLen: this.pendingInterimTranscript.trim().length,
            userSpeechTotalMs: this.userSpeechTotalMs,
          });
          this.transition('WAITING_FOR_FINAL_TRANSCRIPT', 'finalize_timeout_no_transcript');
          this.startTranscriptWaitTimer();
        }
      }
    }, TURN_THRESHOLDS.finalizeTimeoutMs);
  }
  
  private startTranscriptWaitTimer(): void {
    if (this.transcriptWaitTimer) {
      clearTimeout(this.transcriptWaitTimer);
    }

    const TRANSCRIPT_WAIT_MS = 2500; // Extra wait for Whisper transcription (was 700 — too short)

    this.transcriptWaitTimer = setTimeout(() => {
      this.transcriptWaitTimer = null;

      if (this.state !== 'WAITING_FOR_FINAL_TRANSCRIPT') return;

      // Still no final transcript — fall back to interim or reprompt
      if (this.pendingInterimTranscript && this.pendingInterimTranscript.trim().length > 0) {
        this.config.onLog({
          event: 'TRANSCRIPT_WAIT_TIMEOUT_USING_INTERIM',
          requestId: this.config.requestId,
          interimLen: this.pendingInterimTranscript.trim().length,
          preview: this.pendingInterimTranscript.trim().substring(0, 50),
        });
        this.transition('USER_VALIDATING', 'transcript_wait_timeout_interim');
        this.validateUserUtterance(this.pendingInterimTranscript);
      } else if (this.userSpeechTotalMs >= 700) {
        // Had real speech (>=700ms) but no transcript — TRANSCRIPT MISSING (not short utterance)
        this.config.onLog({
          event: 'TRANSCRIPT_MISSING',
          requestId: this.config.requestId,
          userSpeechTotalMs: this.userSpeechTotalMs,
        });
        this.transition('TRANSCRIPT_MISSING_REPROMPT', 'transcript_wait_timeout_missing');
        this.handleTranscriptMissingReprompt();
      } else if (this.userSpeechTotalMs >= TURN_THRESHOLDS.minUtteranceMs) {
        // Short but non-trivial utterance (450-700ms), no transcript — short utter
        this.config.onLog({
          event: 'TRANSCRIPT_WAIT_TIMEOUT_NO_TEXT',
          requestId: this.config.requestId,
          userSpeechTotalMs: this.userSpeechTotalMs,
        });
        this.transition('SHORT_UTTER_REPROMPT', 'transcript_wait_timeout_no_text');
        this.handleShortUtterReprompt();
      } else {
        // Very short speech (<450ms), no transcript — noise, return to waiting
        this.config.onLog({
          event: 'TRANSCRIPT_WAIT_TIMEOUT_NOISE',
          requestId: this.config.requestId,
          userSpeechTotalMs: this.userSpeechTotalMs,
        });
        this.resetUserState();
        this.transition('WAITING_FOR_USER_START', 'transcript_wait_timeout_noise');
        this.startNoInputTimer();
      }
    }, TRANSCRIPT_WAIT_MS);
  }

  private clearAllTimers(): void {
    if (this.bargeInTimer) clearTimeout(this.bargeInTimer);
    if (this.noInputTimer) clearTimeout(this.noInputTimer);
    if (this.endDebounceTimer) clearTimeout(this.endDebounceTimer);
    if (this.finalizeTimer) clearTimeout(this.finalizeTimer);
    if (this.postTtsDeadzoneTimer) clearTimeout(this.postTtsDeadzoneTimer);
    if (this.transcriptWaitTimer) clearTimeout(this.transcriptWaitTimer);
    this.bargeInTimer = null;
    this.noInputTimer = null;
    this.endDebounceTimer = null;
    this.finalizeTimer = null;
    this.postTtsDeadzoneTimer = null;
    this.transcriptWaitTimer = null;
  }
  
  // ===========================================================================
  // PRIVATE - Validation and reprompts
  // ===========================================================================
  
  private validateUserUtterance(text: string): void {
    const trimmed = text.trim();
    const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
    const hasDigits = /\d/.test(trimmed);
    const charLen = trimmed.length;

    // Slot-aware: phone numbers accept 1-word with digits
    const effectiveMinWords = (this.waitingForPhoneNumber && hasDigits) ? 1 : TURN_THRESHOLDS.minWords;
    const durationOk = this.userSpeechTotalMs >= TURN_THRESHOLDS.minUtteranceMs;
    const transcriptOk =
      charLen >= TURN_THRESHOLDS.minTranscriptLen ||
      wordCount >= effectiveMinWords;

    // If we got no transcript at all, treat as noise/incomplete even if
    // duration is high.  Prefer waiting over hallucinating.
    const hasAnyTranscript = charLen > 0;

    // Accept if transcript is meaningful, OR duration is meaningful AND
    // we got *some* transcript text.
    const isValid = transcriptOk || (durationOk && hasAnyTranscript);

    // Empty transcript => silently discard (no reprompt, no apology)
    const isNoise = !hasAnyTranscript || (!durationOk && charLen < 3);

    const turnAcceptedAt = isValid ? Date.now() : null;

    this.config.onLog({
      event: isValid ? 'USER_TURN_ACCEPTED' : 'USER_TURN_IGNORED',
      requestId: this.config.requestId,
      reason: isNoise ? 'noise' : (isValid ? (durationOk ? 'duration' : 'transcript') : (charLen < 3 ? 'empty_transcript' : 'too_short')),
      durationMs: this.userSpeechTotalMs,
      len: charLen,
      words: wordCount,
      preview: trimmed.substring(0, 50),
      transcriptFinalReceived: this.transcriptFinalReceived,
      t: turnAcceptedAt,
    });

    if (isValid) {
      // Valid utterance - allow LLM to respond
      this.turnAcceptedAt = turnAcceptedAt;
      this.resetUserState();
      this.transition('IDLE', 'utterance_validated');
      this.config.onRequestLlmResponse();
    } else if (isNoise) {
      // Noise / empty transcript: return to waiting silently — no apology
      this.resetUserState();
      this.transition('WAITING_FOR_USER_START', 'noise_discarded');
      this.startNoInputTimer();
    } else {
      // Short but non-trivial utterance - gentle reprompt without apology
      this.transition('SHORT_UTTER_REPROMPT', 'utterance_too_short');
      this.handleShortUtterReprompt();
    }
  }
  
  private handleNoInputReprompt(): void {
    this.resetUserState();

    // Gentle reprompt — NO apology. Apology is only allowed when a
    // validated turn produced garbled content (handled by OpenAI prompt).
    const reprompt = this.lastQuestionAsked
      ? "Take your time — I'm still here."
      : "Are you still there?";

    this.config.onLog({
      event: 'REPROMPT_FIRED',
      requestId: this.config.requestId,
      delayMs: TURN_THRESHOLDS.longNoInputMs,
      reason: 'no_input_timeout',
    });

    this.config.onSpeakText(reprompt, true).catch(err => {
      this.config.onLog({
        event: 'reprompt_error',
        requestId: this.config.requestId,
        error: err.message,
      });
    });
  }

  private handleShortUtterReprompt(): void {
    this.resetUserState();

    // Short but non-trivial utterance — gentle nudge, no apology
    const reprompt = "Could you say that one more time for me?";

    this.config.onLog({
      event: 'REPROMPT_FIRED',
      requestId: this.config.requestId,
      delayMs: 0,
      reason: 'short_utterance',
    });

    this.config.onSpeakText(reprompt, true).catch(err => {
      this.config.onLog({
        event: 'reprompt_error',
        requestId: this.config.requestId,
        error: err.message,
      });
    });
  }

  private handleTranscriptMissingReprompt(): void {
    this.resetUserState();

    // Real speech occurred but Whisper returned nothing — distinct from short utterance
    const reprompt = "Sorry — I didn't catch that. Could you repeat your last sentence?";

    this.config.onLog({
      event: 'REPROMPT_FIRED',
      requestId: this.config.requestId,
      delayMs: 0,
      reason: 'transcript_missing',
    });

    this.config.onSpeakText(reprompt, true).catch(err => {
      this.config.onLog({
        event: 'reprompt_error',
        requestId: this.config.requestId,
        error: err.message,
      });
    });
  }
  
  private resetUserState(): void {
    this.userSpeechTotalMs = 0;
    this.lastFinalTranscript = '';
    this.transcriptFinalReceived = false;
    this.pendingInterimTranscript = '';
    this.speechStartAt = null;
    this.speechEndAt = null;
    this.waitingForPhoneNumber = false;
    if (this.transcriptWaitTimer) {
      clearTimeout(this.transcriptWaitTimer);
      this.transcriptWaitTimer = null;
    }
  }
}

interface PostCallContext {
  requestId: string;
  callSid: string | null;
  leadId: string | null;
  contactId: string | null;
  orgId: string | null;
  callStartTime: Date | null;
  fromE164: string | null;
  toE164: string | null;
  transcriptBuffer: { role: 'ai' | 'user'; text: string; timestamp: Date }[];
}

async function processCallEnd(ctx: PostCallContext): Promise<void> {
  const { requestId, callSid, leadId, contactId, orgId, callStartTime, fromE164, toE164, transcriptBuffer } = ctx;
  const maskSid = (sid: string | null) => sid ? `****${sid.slice(-8)}` : null;
  
  // FINALIZE-ONCE GUARD: Prevent duplicate processing for the same callSid
  if (callSid && finalizedCallSids.has(callSid)) {
    console.log(JSON.stringify({ 
      tag: '[FINALIZE_SKIP]', 
      requestId, 
      callSid: maskSid(callSid),
      reason: 'already_finalized',
    }));
    return;
  }
  
  if (!leadId || !orgId) {
    console.log(JSON.stringify({ 
      tag: '[FINALIZE_SKIP]', 
      requestId, 
      callSid: maskSid(callSid),
      reason: 'no_lead_id',
    }));
    return;
  }
  
  // Mark as finalized immediately to prevent race conditions
  if (callSid) {
    finalizedCallSids.add(callSid);
  }
  
  // Compute transcript stats for diagnostics
  const userCount = transcriptBuffer.filter(t => t.role === 'user').length;
  const assistantCount = transcriptBuffer.filter(t => t.role === 'ai').length;
  const fullTextLen = transcriptBuffer.map(t => t.text).join('\n').length;
  const transcriptStats = { msgCount: transcriptBuffer.length, userCount, assistantCount, fullTextLen };
  
  // [FINALIZE_BEGIN] - Start of enrichment pipeline
  console.log(JSON.stringify({ 
    tag: '[FINALIZE_BEGIN]', 
    requestId, 
    callSid: maskSid(callSid),
    leadId,
    orgId,
    transcriptStats,
  }));
  
  const callEndTime = new Date();
  const durationSeconds = callStartTime 
    ? Math.round((callEndTime.getTime() - callStartTime.getTime()) / 1000)
    : null;
  
  let currentStep = 'call_update';
  try {
    // Step 1: Update Call status to completed
    if (callSid) {
      const updatedCall = await prisma.call.updateMany({
        where: { twilioCallSid: callSid },
        data: {
          endedAt: callEndTime,
          durationSeconds: durationSeconds,
          callOutcome: 'connected',
        },
      });
      
      console.log(JSON.stringify({ 
        tag: '[CALL_ENDED]', 
        requestId, 
        callSid: maskSid(callSid),
        durationSeconds,
        updatedCount: updatedCall.count,
      }));
    }
    
    // Step 2: Update Interaction status to completed
    await prisma.interaction.updateMany({
      where: { 
        leadId,
        channel: 'call',
        status: 'active',
      },
      data: {
        status: 'completed',
        endedAt: callEndTime,
      },
    });
    
    // Step 3: Build full transcript text
    currentStep = 'build_transcript';
    const fullTranscript = transcriptBuffer
      .map(t => `${t.role === 'ai' ? 'Avery' : 'Caller'}: ${t.text}`)
      .join('\n');
    
    // [TRANSCRIPT_UPSERT_OK] - Log transcript ready for processing
    console.log(JSON.stringify({ 
      tag: '[TRANSCRIPT_UPSERT_OK]', 
      requestId,
      callSid: maskSid(callSid),
      msgCount: transcriptBuffer.length,
      transcriptLength: fullTranscript.length,
    }));
    
    if (!fullTranscript || fullTranscript.length < 20) {
      console.log(JSON.stringify({ 
        tag: '[FINALIZE_SKIP]', 
        requestId, 
        callSid: maskSid(callSid),
        reason: 'transcript_too_short', 
        length: fullTranscript.length,
      }));
      return;
    }
    
    // Step 4: Extract intake data
    currentStep = 'extraction';
    console.log(JSON.stringify({ 
      tag: '[EXTRACT_BEGIN]', 
      requestId, 
      callSid: maskSid(callSid),
      transcriptLength: fullTranscript.length,
    }));
    
    const extraction: IntakeExtraction = await extractIntakeWithOpenAI(
      fullTranscript,
      fromE164,
      toE164,
      callSid,
      orgId
    );
    
    // [EXTRACT_OK] - Log extraction success with key fields
    console.log(JSON.stringify({ 
      tag: '[EXTRACT_OK]', 
      requestId,
      callSid: maskSid(callSid),
      keys: Object.keys(extraction),
      callerName: extraction.caller.fullName,
      practiceAreaGuess: extraction.practiceArea,
      score: extraction.score.value,
    }));
    
    // Step 5: Update Contact with name if detected
    currentStep = 'contact_update';
    if (contactId && extraction.caller.fullName && extraction.caller.fullName !== 'Unknown') {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          name: extraction.caller.fullName,
          firstName: extraction.caller.firstName,
          lastName: extraction.caller.lastName,
          primaryEmail: extraction.caller.email || undefined,
        },
      });
      
      console.log(JSON.stringify({ 
        tag: '[CONTACT_UPDATE_OK]', 
        requestId,
        contactId,
        name: extraction.caller.fullName,
      }));
    }
    
    // Step 6: Update Lead with extraction data
    // Store intakeData with FLAT field names matching dashboard expectations
    currentStep = 'lead_update';
    const flatIntakeData = {
      // Original nested extraction data
      ...extraction,
      // FLAT KEYS for dashboard compatibility
      callerName: extraction.caller.fullName,
      phoneNumber: extraction.caller.phone || fromE164,
      phone: extraction.caller.phone || fromE164, // Both for compatibility
      practiceAreaGuess: extraction.practiceArea,
      incidentDate: extraction.incidentDate,
      incidentLocation: extraction.location,
      injuryDescription: extraction.summary,
      atFaultParty: extraction.conflicts?.opposingParty,
      atFault: extraction.conflicts?.opposingParty, // Both for compatibility
      medicalTreatment: extraction.keyFacts?.find((f: string) => f.toLowerCase().includes('medical') || f.toLowerCase().includes('treatment') || f.toLowerCase().includes('hospital') || f.toLowerCase().includes('doctor')) || null,
      insuranceInfo: extraction.keyFacts?.find((f: string) => f.toLowerCase().includes('insurance') || f.toLowerCase().includes('claim')) || null,
    };
    
    // Compute populated fields for logging
    const populatedFields = Object.entries(flatIntakeData)
      .filter(([k, v]) => v !== null && v !== undefined && v !== '' && !['caller', 'score', 'conflicts', 'keyFacts'].includes(k))
      .map(([k]) => k);
    
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        displayName: extraction.caller.fullName || undefined,
        summary: extraction.summary,
        score: extraction.score.value,
        scoreLabel: extraction.score.label,
        scoreReasons: extraction.score.reasons,
        urgency: extraction.urgency,
        incidentDate: extraction.incidentDate ? new Date(extraction.incidentDate) : undefined,
        incidentLocation: extraction.location,
        intakeData: flatIntakeData as any,
        status: 'new',
      },
    });
    
    // [LEAD_UPDATE_OK] - Lead enrichment complete
    console.log(JSON.stringify({ 
      tag: '[LEAD_UPDATE_OK]', 
      requestId,
      callSid: maskSid(callSid),
      leadId,
      displayName: extraction.caller.fullName || null,
      practiceArea: extraction.practiceArea,
      score: extraction.score.value,
    }));
    
    // Step 7: Store transcript in Call record
    currentStep = 'transcript_store';
    if (callSid) {
      await prisma.call.updateMany({
        where: { twilioCallSid: callSid },
        data: {
          transcriptText: fullTranscript,
          transcriptJson: transcriptBuffer as any,
          aiSummary: extraction.summary,
        },
      });
    }
    
    // Step 8: Create or update Intake record
    currentStep = 'intake_upsert';
    await prisma.intake.upsert({
      where: { leadId },
      create: {
        orgId,
        leadId,
        answers: flatIntakeData as any,
        completionStatus: 'complete',
        completedAt: callEndTime,
      },
      update: {
        answers: flatIntakeData as any,
        completionStatus: 'complete',
        completedAt: callEndTime,
      },
    });
    
    // [INTAKE_UPSERT_OK] - Log with populated fields
    console.log(JSON.stringify({ 
      tag: '[INTAKE_UPSERT_OK]', 
      requestId,
      callSid: maskSid(callSid),
      leadId,
      populatedFields,
    }));
    
    // Step 9: Create or update Qualification record
    currentStep = 'qualification_upsert';
    await prisma.qualification.upsert({
      where: { leadId },
      create: {
        orgId,
        leadId,
        score: extraction.score.value,
        disposition: extraction.score.label === 'high' ? 'accept' : extraction.score.label === 'medium' ? 'review' : 'decline',
        reasons: extraction.score.reasons,
        confidence: 80,
      },
      update: {
        score: extraction.score.value,
        disposition: extraction.score.label === 'high' ? 'accept' : extraction.score.label === 'medium' ? 'review' : 'decline',
        reasons: extraction.score.reasons,
        confidence: 80,
      },
    });
    
    // [FINALIZE_DONE] - Complete enrichment pipeline success
    console.log(JSON.stringify({ 
      tag: '[FINALIZE_DONE]', 
      requestId, 
      callSid: maskSid(callSid),
      leadId,
      displayName: extraction.caller.fullName || null,
      score: extraction.score.value,
      tier: extraction.score.label,
      transcriptStats,
    }));
    
  } catch (err: any) {
    // [FINALIZE_ERROR] - Log error with step information
    console.error(JSON.stringify({ 
      tag: '[FINALIZE_ERROR]', 
      requestId,
      callSid: maskSid(callSid),
      leadId,
      step: currentStep,
      error: err?.message || String(err),
      stack: err?.stack?.split('\n').slice(0, 3).join(' | ') || null,
    }));
  }
}

interface TwilioMessage {
  event: string;
  sequenceNumber?: string;
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat?: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
    customParameters?: Record<string, string>;
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  mark?: {
    name: string;
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
}

export function generateStreamToken(secret: string, timestamp: number): string {
  return createHmac('sha256', secret).update(`${timestamp}`).digest('hex');
}

export function verifyStreamToken(secret: string, timestamp: number, token: string): boolean {
  const expected = generateStreamToken(secret, timestamp);
  return token === expected;
}

export function handleTwilioMediaStream(twilioWs: WebSocket, _req: IncomingMessage): void {
  const requestId = Math.random().toString(36).substring(2, 10).toUpperCase();
  
  console.log(JSON.stringify({ event: 'ws_connection_accepted', requestId }));

  let authenticated = false;
  let streamSid: string | null = null;
  let openAiWs: WebSocket | null = null;
  let openAiReady = false;
  const pendingTwilioAudio: string[] = [];
  let twilioFrameCount = 0;
  let ttsFrameCount = 0;
  let callSid: string | null = null;
  let responseInProgress = false;
  let speechStartTime: number | null = null;
  
  // OpenAI response state tracking for safe cancellation
  let openaiResponseActive = false;
  let initialGreetingSent = false;
  let openAiInitStarted = false;
  
  // Audio buffer tracking for commit guard (100ms = 5 frames at 20ms/frame)
  let bufferedAudioFrameCount = 0;
  const MIN_FRAMES_TO_COMMIT = 5; // 100ms minimum

  // ElevenLabs TTS state
  let pendingText = '';
  let currentResponseId: string | null = null;
  let activeResponseId: string | null = null;        // only the live response may produce output
  const squelchedResponseIds = new Set<string>();     // cancelled IDs whose deltas/done we ignore
  let lastSpokenResponseId: string | null = null;
  let firstDeltaAt: number | null = null;             // timestamp of first delta for latency tracking
  let ttsAbortController: AbortController | null = null;
  let ttsSpeaking = false;
  let ttsStartAt: number | null = null;
  
  // Barge-in control parameters
  const ECHO_IGNORE_WINDOW_MS = 800;  // Ignore speech for 800ms after TTS starts
  const SUSTAINED_SPEECH_MS = 400;     // Require 400ms sustained speech for barge-in (was 600)
  const SUSTAINED_SPEECH_WITH_ENERGY_MS = 450; // With high energy/confidence, only need 450ms
  const ENERGY_THRESHOLD = 0.60;
  const CONFIDENCE_THRESHOLD = 0.65;
  const BARGE_IN_COOLDOWN_MS = 800;    // 800ms cooldown after barge-in
  let bargeInTimer: NodeJS.Timeout | null = null;
  let lastBargeInTime: number | null = null;
  
  // Transcript and lead tracking for post-call processing
  const transcriptBuffer: { role: 'ai' | 'user'; text: string; timestamp: Date }[] = [];
  let createdLeadId: string | null = null;
  let createdContactId: string | null = null;
  let createdCallId: string | null = null;
  let createdOrgId: string | null = null;
  let orgName: string | null = null;
  let callStartTime: Date | null = null;
  let callerFromE164: string | null = null;
  let callerToE164: string | null = null;

  // Close-initiator instrumentation (Section A)
  const callStartedAt = Date.now();
  let lastAudioFromTwilioAt: number = Date.now();
  let lastOpenAIMsgAt: number = Date.now();
  let openAiPingInterval: NodeJS.Timeout | null = null;

  // OpenAI WS reconnect state (Section C)
  let openAiReconnectAttempt = 0;
  const OPENAI_MAX_RECONNECT = 3;
  const OPENAI_RECONNECT_BACKOFF = [500, 1000, 2000]; // ms
  let reconnecting = false;

  // Finalization scheduling with retry for lead-creation race
  const MAX_FINALIZE_RETRIES = 10;
  const FINALIZE_RETRY_MS = 500;
  let finalizeTimer: NodeJS.Timeout | null = null;
  let finalizeAttempt = 0;
  const scheduleFinalize = (source: 'twilio_stop' | 'twilio_close') => {
    if (finalizeTimer) return;
    const initialDelay = source === 'twilio_stop' ? 2000 : 3000;
    console.log(JSON.stringify({ event: 'finalize_scheduled', requestId, source }));
    const tryFinalize = () => {
      if (!createdLeadId || !createdOrgId) {
        finalizeAttempt++;
        if (finalizeAttempt < MAX_FINALIZE_RETRIES) {
          console.log(JSON.stringify({
            tag: '[FINALIZE_RETRY]',
            requestId,
            attempt: finalizeAttempt,
            maxRetries: MAX_FINALIZE_RETRIES,
            hasLeadId: !!createdLeadId,
            hasOrgId: !!createdOrgId,
          }));
          finalizeTimer = setTimeout(tryFinalize, FINALIZE_RETRY_MS);
          return;
        }
        console.log(JSON.stringify({
          tag: '[FINALIZE_RETRY_EXHAUSTED]',
          requestId,
          attempts: finalizeAttempt,
          hasLeadId: !!createdLeadId,
          hasOrgId: !!createdOrgId,
        }));
      }
      finalizeTimer = null;
      processCallEnd({
        requestId,
        callSid,
        leadId: createdLeadId,
        contactId: createdContactId,
        orgId: createdOrgId,
        callStartTime,
        fromE164: callerFromE164,
        toE164: callerToE164,
        transcriptBuffer: [...transcriptBuffer],
      }).catch(err => {
        console.error(JSON.stringify({ event: 'post_call_error', requestId, source, error: err?.message }));
      }).finally(() => {
        // Close OpenAI ONLY after finalization snapshot is taken
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.close(1000, `finalized:${source}`);
        }
      });
    };
    finalizeTimer = setTimeout(tryFinalize, initialDelay);
  };

  // 600ms fallback mechanism for first TTS response
  const FALLBACK_TIMEOUT_MS = 600;
  const FALLBACK_PHRASE = "Hi—one moment.";
  let firstTTSTriggerTime: number | null = null;
  let fallbackTimer: NodeJS.Timeout | null = null;
  let fallbackPlayed = false;
  let firstAudioFrameSent = false;

  const secret = process.env.STREAM_TOKEN_SECRET;
  
  // ==========================================================================
  // TurnController instance - manages turn-taking state machine
  // ==========================================================================
  let turnController: TurnController | null = null;
  
  function initTurnController(): void {
    turnController = new TurnController({
      requestId,
      
      // Speak text via ElevenLabs TTS
      onSpeakText: async (text: string, isReprompt: boolean) => {
        const responseId = `reprompt_${Date.now()}`;
        // Add to transcript buffer
        transcriptBuffer.push({ role: 'ai', text, timestamp: new Date() });
        console.log(JSON.stringify({
          tag: '[TX_APPEND]',
          requestId,
          role: 'assistant',
          len: text.length,
          isReprompt,
        }));
        await speakElevenLabs(text, responseId);
      },
      
      // Stop current TTS playback
      onStopTts: () => {
        if (ttsAbortController) {
          console.log(JSON.stringify({ event: 'TTS_ABORTED', requestId }));
          ttsAbortController.abort();
          ttsAbortController = null;
        }
        ttsSpeaking = false;
        ttsStartAt = null;
      },

      // Cancel in-flight OpenAI response (prevents queued text after barge-in)
      onCancelLlmResponse: () => {
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN && openaiResponseActive && currentResponseId) {
          squelchedResponseIds.add(currentResponseId);
          openAiWs.send(JSON.stringify({ type: 'response.cancel', response_id: currentResponseId }));
          console.log(JSON.stringify({ event: 'OPENAI_CANCEL_SENT', requestId, responseId: currentResponseId }));
        }
        pendingText = '';
        openaiResponseActive = false;
        activeResponseId = null;
        currentResponseId = null;
      },

      // Request LLM response (signal that user turn is complete)
      onRequestLlmResponse: (prompt?: string) => {
        // With create_response:false, server_vad no longer auto-creates responses.
        // We must explicitly send response.create after TurnController validates the turn.
        const now = Date.now();
        const turnAcceptedAt = turnController?.getTurnAcceptedAt();
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          console.log(JSON.stringify({
            event: 'LLM_RESPONSE_REQUESTED',
            requestId,
            turnControllerState: turnController?.getState(),
            t: now,
            msSinceTurnAccepted: turnAcceptedAt ? now - turnAcceptedAt : null,
          }));
          openAiWs.send(JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['text'],
            },
          }));
        } else {
          console.log(JSON.stringify({
            event: 'LLM_RESPONSE_REQUEST_FAILED',
            requestId,
            reason: 'openai_ws_not_ready',
            t: now,
          }));
        }
      },
      
      // Clear Twilio audio buffer
      onClearTwilioAudio: () => {
        if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
        }
      },
      
      // Structured logging
      onLog: (data: Record<string, any>) => {
        console.log(JSON.stringify(data));
      },
    });
  }

  const startTimeout = setTimeout(() => {
    if (!authenticated) {
      console.log(JSON.stringify({ event: 'ws_close', requestId, code: 1008, reason: 'No start event received' }));
      twilioWs.close(1008, 'No start event received');
    }
  }, START_TIMEOUT_MS);

  const maskCallSid = (sid: string | null) => sid ? `****${sid.slice(-8)}` : null;

  /**
   * Speak text via ElevenLabs TTS and stream audio to Twilio
   * 
   * IMPORTANT: Twilio Media Streams expects exactly 160-byte μ-law frames (20ms at 8kHz).
   * We buffer incoming TTS audio and emit properly-sized chunks.
   */
  const TWILIO_FRAME_SIZE = 160; // 20ms at 8kHz, 1 byte per sample in μ-law
  const TTS_TIMEOUT_MS = 30000; // 30 second timeout for TTS
  
  async function speakElevenLabs(text: string, responseId: string): Promise<void> {
    if (!isTTSAvailable()) {
      console.error(JSON.stringify({ event: 'tts_unavailable', requestId, responseId }));
      return;
    }

    // Abort any existing TTS stream
    if (ttsAbortController) {
      ttsAbortController.abort();
    }
    ttsAbortController = new AbortController();
    ttsSpeaking = true;
    ttsStartAt = Date.now();
    
    // Notify TurnController that TTS is starting
    if (turnController) {
      turnController.onTtsStarted(text);
    }

    // Track whether TTS was aborted (barge-in) vs completed normally
    let wasAborted = false;

    // Audio buffer for framing
    let audioBuffer = Buffer.alloc(0);

    // Timeout to prevent hanging calls if ElevenLabs stalls
    const timeoutId = setTimeout(() => {
      if (ttsAbortController) {
        console.warn(JSON.stringify({ event: 'tts_timeout', requestId, responseId, timeout_ms: TTS_TIMEOUT_MS }));
        ttsAbortController.abort();
      }
    }, TTS_TIMEOUT_MS);

    try {
      await streamTTS(
        text,
        { signal: ttsAbortController.signal, responseId },
        (chunk: Uint8Array) => {
          // Append incoming chunk to buffer
          audioBuffer = Buffer.concat([audioBuffer, Buffer.from(chunk)]);
          
          // Emit complete 160-byte frames to Twilio
          while (audioBuffer.length >= TWILIO_FRAME_SIZE) {
            const frame = audioBuffer.subarray(0, TWILIO_FRAME_SIZE);
            audioBuffer = audioBuffer.subarray(TWILIO_FRAME_SIZE);
            
            const audioBase64 = frame.toString('base64');
            if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
              twilioWs.send(JSON.stringify({ 
                event: 'media', 
                streamSid, 
                media: { payload: audioBase64 } 
              }));
              ttsFrameCount++;
              
              // Track first audio frame and cancel fallback timer
              if (!firstAudioFrameSent) {
                firstAudioFrameSent = true;
                if (fallbackTimer) {
                  clearTimeout(fallbackTimer);
                  fallbackTimer = null;
                  console.log(JSON.stringify({ 
                    tag: '[FALLBACK_CANCELLED]', 
                    requestId,
                    ms_since_tts_trigger: firstTTSTriggerTime ? Date.now() - firstTTSTriggerTime : null,
                    reason: 'first_audio_arrived',
                  }));
                }
              }
              
              if (ttsFrameCount % LOG_FRAME_INTERVAL === 0) {
                console.log(JSON.stringify({ event: 'tts_audio_to_twilio', requestId, frames: ttsFrameCount }));
              }
            }
          }
        }
      );

      // Flush any remaining bytes (pad with silence if needed)
      if (audioBuffer.length > 0 && streamSid && twilioWs.readyState === WebSocket.OPEN) {
        // Pad to 160 bytes with μ-law silence (0xFF)
        const finalFrame = Buffer.alloc(TWILIO_FRAME_SIZE, 0xFF);
        audioBuffer.copy(finalFrame);
        const audioBase64 = finalFrame.toString('base64');
        twilioWs.send(JSON.stringify({ 
          event: 'media', 
          streamSid, 
          media: { payload: audioBase64 } 
        }));
        ttsFrameCount++;
      }

      // Send mark event after TTS completes
      if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
        twilioWs.send(JSON.stringify({ 
          event: 'mark', 
          streamSid, 
          mark: { name: `tts_done_${responseId}` } 
        }));
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        wasAborted = true;
      } else {
        console.error(JSON.stringify({ event: 'tts_stream_error', requestId, responseId, error: err.message }));

        // TTS failed - trigger fallback if this was the first response and no audio sent yet
        if (!firstAudioFrameSent && !fallbackPlayed) {
          const msSinceTrigger = firstTTSTriggerTime ? Date.now() - firstTTSTriggerTime : null;
          console.log(JSON.stringify({
            tag: '[FALLBACK_SAY]',
            requestId,
            reason: 'tts_error',
            ms_since_tts_trigger: msSinceTrigger,
            error: err.message,
          }));
          fallbackPlayed = true;
          speakFallbackPhrase().catch(e => {
            console.error(JSON.stringify({ event: 'fallback_speak_error', requestId, error: e.message }));
          });
        }
      }
    } finally {
      clearTimeout(timeoutId);
      ttsSpeaking = false;
      ttsAbortController = null;

      // Only notify TurnController of normal completion — not on abort
      // (barge-in already transitioned to USER_SPEAKING)
      if (turnController && !wasAborted) {
        turnController.onTtsFinished();
      }
    }
  }
  
  /**
   * Speak fallback phrase via ElevenLabs fallback voice
   * Used when primary TTS fails or times out
   */
  async function speakFallbackPhrase(): Promise<void> {
    if (!isTTSAvailable()) {
      console.error(JSON.stringify({ event: 'fallback_tts_unavailable', requestId }));
      return;
    }
    
    const fallbackResponseId = `fallback_${Date.now()}`;
    let audioBuffer = Buffer.alloc(0);
    
    try {
      // Use streamTTSWithFallback to ensure we try both primary and fallback voices
      const result = await streamTTSWithFallback(
        FALLBACK_PHRASE,
        { responseId: fallbackResponseId },
        (chunk: Uint8Array) => {
          audioBuffer = Buffer.concat([audioBuffer, Buffer.from(chunk)]);
          
          while (audioBuffer.length >= TWILIO_FRAME_SIZE) {
            const frame = audioBuffer.subarray(0, TWILIO_FRAME_SIZE);
            audioBuffer = audioBuffer.subarray(TWILIO_FRAME_SIZE);
            
            const audioBase64 = frame.toString('base64');
            if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
              twilioWs.send(JSON.stringify({ 
                event: 'media', 
                streamSid, 
                media: { payload: audioBase64 } 
              }));
              ttsFrameCount++;
              
              // Mark first audio sent
              if (!firstAudioFrameSent) {
                firstAudioFrameSent = true;
              }
            }
          }
        }
      );
      
      // Flush remaining audio
      if (audioBuffer.length > 0 && streamSid && twilioWs.readyState === WebSocket.OPEN) {
        const finalFrame = Buffer.alloc(TWILIO_FRAME_SIZE, 0xFF);
        audioBuffer.copy(finalFrame);
        const audioBase64 = finalFrame.toString('base64');
        twilioWs.send(JSON.stringify({ 
          event: 'media', 
          streamSid, 
          media: { payload: audioBase64 } 
        }));
        ttsFrameCount++;
      }
      
      console.log(JSON.stringify({ 
        event: 'fallback_speak_complete', 
        requestId, 
        voiceUsed: result.voiceUsed,
        usedFallback: result.usedFallback,
        totalBytes: result.totalBytes,
      }));
      
      // If ElevenLabs returned 0 bytes, use Twilio Say as last resort
      if (result.totalBytes === 0 || !result.success) {
        console.log(JSON.stringify({ 
          event: 'twilio_say_fallback', 
          requestId,
          reason: result.success ? 'zero_bytes' : 'tts_failed',
        }));
        speakTwilioSay(FALLBACK_PHRASE);
      }
    } catch (err: any) {
      console.error(JSON.stringify({ event: 'fallback_speak_error', requestId, error: err.message }));
      // HARD FALLBACK: Use Twilio Say when all ElevenLabs options fail
      speakTwilioSay(FALLBACK_PHRASE);
    }
  }
  
  /**
   * Ultimate fallback: Use Twilio's native TTS via Media Stream 
   * This generates audio locally and sends it to the call when ElevenLabs is unavailable
   */
  function speakTwilioSay(text: string): void {
    console.log(JSON.stringify({ 
      event: 'twilio_say_initiated', 
      requestId,
      text_length: text.length,
    }));
    
    // Twilio media streams don't support direct <Say> injection
    // But we can send a "mark" event to signal the caller, or close and reopen
    // For now, log that we've hit the ultimate fallback
    // The TwiML fallback <Say> in the initial voice response is the safety net
    console.log(JSON.stringify({
      tag: '[ULTIMATE_FALLBACK]',
      requestId,
      message: 'ElevenLabs completely unavailable - caller will hear TwiML fallback or silence',
    }));
  }
  
  /**
   * Execute barge-in: Clear audio, cancel AI response, abort TTS
   */
  function executeBargeIn(): void {
    lastBargeInTime = Date.now();

    console.log(JSON.stringify({
      event: 'BARGE_IN_TRIGGERED',
      requestId,
      ttsSpeaking,
      openaiResponseActive,
      currentResponseId,
      turnState: turnController?.getState(),
    }));

    // 1. Clear Twilio audio buffer
    if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
      twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
    }

    // 2. Cancel OpenAI response (only if one is active AND we have a response ID)
    if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
      if (openaiResponseActive && currentResponseId) {
        squelchedResponseIds.add(currentResponseId);
        openAiWs.send(JSON.stringify({ type: 'response.cancel', response_id: currentResponseId }));
        console.log(JSON.stringify({ event: 'OPENAI_CANCEL_SENT', requestId, responseId: currentResponseId }));
      }
    }

    // 3. Abort ElevenLabs TTS
    if (ttsAbortController) {
      console.log(JSON.stringify({ event: 'TTS_ABORTED', requestId }));
      ttsAbortController.abort();
      ttsAbortController = null;
    }

    // 4. Clear state
    pendingText = '';
    activeResponseId = null;
    currentResponseId = null;
    ttsSpeaking = false;
    ttsStartAt = null;
    openaiResponseActive = false;

    // 5. Sync TurnController into USER_SPEAKING if it's still in ASSIST_SPEAKING
    if (turnController && turnController.getState() === 'ASSIST_SPEAKING') {
      turnController.forceUserSpeaking();
    }
  }

  function validateAuth(customParams: Record<string, string> | undefined): boolean {
    if (!secret) {
      console.log(JSON.stringify({ event: 'ws_auth', requestId, result: 'skipped_no_secret' }));
      return true;
    }

    const authToken = customParams?.auth_token;
    const tsParam = customParams?.ts;

    if (!authToken || !tsParam) {
      console.log(JSON.stringify({ event: 'ws_auth', requestId, result: 'missing_params', paramKeys: Object.keys(customParams || {}) }));
      return false;
    }

    const ts = parseInt(tsParam, 10);
    const now = Math.floor(Date.now() / 1000);

    if (Math.abs(now - ts) > TOKEN_MAX_AGE_SECONDS) {
      console.log(JSON.stringify({ event: 'ws_auth', requestId, result: 'token_expired', ts, now }));
      return false;
    }

    if (!verifyStreamToken(secret, ts, authToken)) {
      console.log(JSON.stringify({ event: 'ws_auth', requestId, result: 'invalid_token' }));
      return false;
    }

    console.log(JSON.stringify({ event: 'ws_auth', requestId, result: 'ok' }));
    return true;
  }

  function initOpenAI(): void {
    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      console.log(JSON.stringify({ event: 'ws_close', requestId, callSid: maskCallSid(callSid), code: 1011, reason: 'Server misconfigured' }));
      twilioWs.close(1011, 'Server misconfigured');
      return;
    }

    openAiWs = new WebSocket(OPENAI_REALTIME_URL, {
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    openAiWs.on('open', () => {
      console.log(JSON.stringify({ event: 'openai_connected', requestId, callSid: maskCallSid(callSid) }));

      const firmName = orgName || 'the firm';
      const instructions = `# AVERY — Legal Intake Voice AI for ${firmName}

## Identity & hard boundaries
You are Avery, the virtual intake assistant for ${firmName}. You are NOT a lawyer, paralegal, or human. You do not give legal advice, strategy, predictions, or guarantees.
Never claim to be human. If asked for legal advice: "I can't advise on that, but I can collect details and help schedule a consultation."
If caller is in immediate danger: "Please call 911 right now." Pause intake until they confirm safety.
If caller mentions self-harm: "I'm sorry you're feeling that way. Please call or text 988 for immediate support." Continue only after they confirm safety.

## Voice & demeanor
- Warm, calm, conversational — not robotic. Sound like a capable human receptionist.
- One question at a time. After asking, WAIT silently for the answer.
- Occasional light fillers are fine: "Mm-hmm", "Okay", "Got it", "Let me make sure I have that right." Cap at 1–2 per minute. Do not overuse.
- Adapt tone to case type: softer for family law/injury; steadier for criminal/financial.
- If caller is upset: one sentence of empathy, one sentence to stabilize, then next question. Do not stack empathy + question + apology.

## CRITICAL turn-taking rules
1. NEVER say "I didn't catch that", "I'm sorry I didn't hear you", or any apology about not hearing — unless the caller clearly attempted a long answer and the content was garbled. The system handles silence and noise automatically.
2. After asking a question, WAIT. Do not fill silence. Do not repeat the question. Do not apologize. The system will reprompt after extended silence if needed.
3. If the caller gives multiple details at once: acknowledge briefly, confirm the key item, then ask the next missing field.
4. If the caller interrupts you, stop immediately and listen.
5. Do NOT repeat the firm name after the opening greeting unless the caller asks who they reached.

## Conversation states (internal checklist — follow in order)

### State 1: GREETING
Your very first sentence MUST be: "Thank you for calling ${firmName}, this is Avery. How can I help you today?"
- If new case: proceed to State 2.
- If existing client: capture name, callback number, reason for calling, urgency, case identifier if known. Then go to State 5.

### State 2: CONTACT INFO
Collect and confirm each:
- Full name (confirm spelling if unclear)
- Best callback number (read back digit groups, confirm)
- Email address (read back, confirm; optional — skip if they decline)
"In case we get cut off, what's the best number to reach you?"

### State 3: CASE TYPE + SCOPE
"Can you briefly tell me what this is about?"
- Listen. Identify practice area from their response.
- If the matter is clearly outside the firm's areas, politely say: "That may be outside what this firm handles. I'd suggest contacting your local bar association for a referral."

### State 4: CASE DETAILS (structured capture)
Ask only what fits the matter. One question at a time.

Core fields to capture:
- incident_date: "When did this happen?"
- incident_location / jurisdiction: "Where did this happen — city and state?"
- parties_involved: "Who was involved — another person, a business, or an agency?"
- injuries / damages: "Were you hurt? What injuries?" / "What kind of damages are you dealing with?"
- medical_treatment: "Did you get medical treatment? Where?"
- police_report: "Was a police report filed?" (if relevant)
- insurance / claim_number: "Was insurance involved? Do you have a claim number?"
- urgency_deadlines: "Do you have any upcoming deadlines, court dates, or urgent safety concerns?"
- existing_attorney: "Do you currently have an attorney for this?" (if yes, note it)
- summary_short: After gathering details, compose a 1–2 sentence plain-language summary internally.

Practice-area adapters (tone only — questions stay the same pattern):
- Personal injury: softer, trauma-aware, slower after injury details
- Family law: dignified, avoid "why" questions, gentle safety check ("Do you feel safe right now?")
- Criminal defense: calm, controlled, minimal fillers, normalize ("You're not the only one who's been through this")
- Civil/litigation: organized, professional
- Bankruptcy: shame-reducing, matter-of-fact, restore agency

### State 5: SCHEDULING + NEXT STEPS
"Would you like to schedule a consultation with the team?"
- If yes: "What days and times generally work best for you?" Capture preferred_consult_times and timezone.
- Confirm preferred_contact_method: "Is phone or email better for reaching you?"
- "The team will follow up to confirm a time."

### State 6: FORMS / DOCUMENT DELIVERY
"I can have the firm send you an intake form — and if needed, a retainer for e-signature. Would you prefer that by text or email?"
- Capture forms_delivery_method (sms or email) and destination (phone or email address).
- "You'll receive a secure link shortly."

### State 7: RECAP + CLOSE
"Here's what I have: [1–2 sentence summary]. Does that sound right?"
- Confirm: callback number, best time to reach them, email if provided.
- "Thank you. I'm sending this to the team now. They'll be in touch."

## Accuracy & confirmation (non-negotiable)
Always confirm critical details by repeating them back:
- Phone numbers: read back in digit groups, confirm.
- Emails: spell back carefully, confirm.
- Names: confirm spelling.
- Dates: read back month/day/year, confirm.
If the caller corrects anything, acknowledge plainly and confirm the corrected value.

${generateVoicePromptInstructions()}`;

      console.log('[PROMPT_ACTIVE] AVERY_MASTER_PROMPT injected into session.update');
      console.log('[PROMPT_LEN]', instructions.length);

      // Use TEXT-ONLY output: ElevenLabs TTS will handle audio generation
      const sessionUpdate = {
        type: 'session.update',
        session: {
          modalities: ['text'],  // TEXT ONLY - ElevenLabs generates audio
          instructions,
          input_audio_format: 'g711_ulaw',  // Still receive audio from Twilio
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.80,
            prefix_padding_ms: 300,
            silence_duration_ms: 600,
            create_response: false,  // We send response.create manually after TurnController validates the turn
          },
        },
      };

      openAiWs!.send(JSON.stringify(sessionUpdate));
      openAiReady = true;
      openAiReconnectAttempt = 0; // Reset reconnect counter on successful connect
      reconnecting = false;

      // Keepalive ping every 25s to prevent OpenAI idle timeout (~270s)
      if (openAiPingInterval) clearInterval(openAiPingInterval);
      openAiPingInterval = setInterval(() => {
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.ping();
        }
      }, 25_000);

      if (pendingTwilioAudio.length > 0) {
        console.log(JSON.stringify({ event: 'flush_buffered_audio', requestId, count: pendingTwilioAudio.length }));
        for (const audio of pendingTwilioAudio) {
          openAiWs!.send(JSON.stringify({ type: 'input_audio_buffer.append', audio }));
          bufferedAudioFrameCount++;
        }
        pendingTwilioAudio.length = 0;
      }
    });

    openAiWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        lastOpenAIMsgAt = Date.now();

        if (message.type === 'session.created') {
          console.log(JSON.stringify({ event: 'openai_session_created', requestId }));
        } else if (message.type === 'session.updated') {
          // Send initial greeting once; uses session instructions (AVERY_MASTER_PROMPT)
          // so the greeting matches the org rather than a hardcoded firm name.
          if (!initialGreetingSent && openAiWs && openAiWs.readyState === WebSocket.OPEN) {
            initialGreetingSent = true;
            openAiWs.send(JSON.stringify({
              type: 'response.create',
              response: {
                modalities: ['text'],
              },
            }));
          }
        } else if (message.type === 'response.created') {
          const newResponseId = message.response?.id || null;

          // With create_response:false, responses only arrive when WE send
          // response.create (after validation) or for the initial greeting.
          // No canCallLlm() squelch needed — we control when responses are created.
          const responseCreatedAt = Date.now();
          responseInProgress = true;
          openaiResponseActive = true;
          currentResponseId = newResponseId;
          activeResponseId = newResponseId;
          pendingText = '';
          firstDeltaAt = null;
          const turnAccepted = turnController?.getTurnAcceptedAt();
          console.log(JSON.stringify({
            event: 'response_started',
            requestId,
            responseId: currentResponseId,
            turnState: turnController?.getState(),
            t: responseCreatedAt,
            msSinceTurnAccepted: turnAccepted ? responseCreatedAt - turnAccepted : null,
          }));

          if (turnController) {
            turnController.onLlmResponseStarted();
          }
        } else if (message.type === 'response.text.delta' || message.type === 'response.output_text.delta' || message.type === 'response.content_part.delta') {
          // Gate: ignore deltas from squelched or non-active responses
          // If deltaResponseId is null (some event formats omit it), allow through
          // as long as activeResponseId is set (we have an active response).
          const deltaResponseId = message.response_id || message.response?.id || null;
          if (deltaResponseId) {
            if (squelchedResponseIds.has(deltaResponseId) || deltaResponseId !== activeResponseId) {
              console.log(JSON.stringify({
                event: 'DELTA_IGNORED',
                requestId,
                responseId: deltaResponseId,
                activeResponseId,
                squelched: squelchedResponseIds.has(deltaResponseId),
              }));
              return;
            }
          } else if (!activeResponseId) {
            // No delta response ID AND no active response — drop
            console.log(JSON.stringify({
              event: 'DELTA_IGNORED',
              requestId,
              responseId: null,
              activeResponseId: null,
              reason: 'no_active_response',
            }));
            return;
          }

          // Accumulate text deltas for TTS
          const textDelta = message.delta?.text || message.delta || '';
          if (textDelta) {
            if (!firstDeltaAt) {
              firstDeltaAt = Date.now();
              const turnAccepted = turnController?.getTurnAcceptedAt();
              console.log(JSON.stringify({
                event: 'FIRST_DELTA',
                requestId,
                responseId: deltaResponseId,
                t: firstDeltaAt,
                msSinceTurnAccepted: turnAccepted ? firstDeltaAt - turnAccepted : null,
              }));
            }
            pendingText += textDelta;
          }
        } else if (message.type === 'response.done' || message.type === 'response.cancelled') {
          responseInProgress = false;
          openaiResponseActive = false;
          const responseId = message.response?.id || currentResponseId;

          // Gate: ignore done from squelched responses
          if (responseId && squelchedResponseIds.has(responseId)) {
            console.log(JSON.stringify({
              event: 'DONE_IGNORED',
              requestId,
              responseId,
              reason: 'squelched',
              pendingTextLen: pendingText.length,
            }));
            pendingText = '';
            currentResponseId = null;
            if (responseId === activeResponseId) {
              activeResponseId = null;
            }
            return;
          }

          // Clear active response since this one is done
          if (responseId === activeResponseId) {
            activeResponseId = null;
          }

          // Speak the accumulated text via ElevenLabs TTS
          if (pendingText && pendingText.trim() && responseId !== lastSpokenResponseId) {
            lastSpokenResponseId = responseId;
            const textToSpeak = pendingText.trim();
            pendingText = '';
            
            // CRITICAL FIX: Add AI text to transcript buffer for enrichment
            transcriptBuffer.push({ role: 'ai', text: textToSpeak, timestamp: new Date() });
            console.log(JSON.stringify({ 
              tag: '[TX_APPEND]', 
              requestId,
              callSid: callSid ? `****${callSid.slice(-8)}` : null,
              role: 'assistant',
              len: textToSpeak.length,
              preview: textToSpeak.substring(0, 50),
            }));
            
            const ttsTriggerAt = Date.now();
            const turnAccepted = turnController?.getTurnAcceptedAt();
            console.log(JSON.stringify({
              event: 'tts_trigger',
              requestId,
              responseId,
              text_length: textToSpeak.length,
              text_preview: textToSpeak.substring(0, 80),
            }));

            // One-line latency summary: how long from turn accepted → TTS trigger
            console.log(JSON.stringify({
              event: 'TURN_LATENCY_SUMMARY',
              requestId,
              responseId,
              turnAcceptedAt: turnAccepted,
              firstDeltaAt,
              ttsTriggerAt,
              ms_accepted_to_firstDelta: turnAccepted && firstDeltaAt ? firstDeltaAt - turnAccepted : null,
              ms_firstDelta_to_tts: firstDeltaAt ? ttsTriggerAt - firstDeltaAt : null,
              ms_accepted_to_tts: turnAccepted ? ttsTriggerAt - turnAccepted : null,
            }));
            
            // Start 600ms fallback timer only for first TTS trigger
            // This measures actual TTS startup latency, not OpenAI processing time
            if (!fallbackTimer && !firstAudioFrameSent && !fallbackPlayed) {
              firstTTSTriggerTime = Date.now();
              fallbackTimer = setTimeout(() => {
                if (!firstAudioFrameSent && !fallbackPlayed) {
                  const msSinceTrigger = firstTTSTriggerTime ? Date.now() - firstTTSTriggerTime : null;
                  console.log(JSON.stringify({ 
                    tag: '[FALLBACK_SAY]', 
                    requestId,
                    reason: 'tts_timeout',
                    ms_since_tts_trigger: msSinceTrigger,
                  }));
                  fallbackPlayed = true;
                  fallbackTimer = null;
                  speakFallbackPhrase().catch(e => {
                    console.error(JSON.stringify({ event: 'fallback_speak_error', requestId, error: e.message }));
                  });
                }
              }, FALLBACK_TIMEOUT_MS);
              console.log(JSON.stringify({ 
                event: 'fallback_timer_started', 
                requestId, 
                timeout_ms: FALLBACK_TIMEOUT_MS,
              }));
            }
            
            // Final squelch gate: re-check before speaking
            if (responseId && squelchedResponseIds.has(responseId)) {
              console.log(JSON.stringify({
                event: 'TTS_TRIGGER_SQUELCHED',
                requestId,
                responseId,
                text_length: textToSpeak.length,
              }));
            } else {
              // Speak via ElevenLabs TTS (async, don't await)
              speakElevenLabs(textToSpeak, responseId).catch((err) => {
                console.error(JSON.stringify({ event: 'tts_speak_error', requestId, error: err.message }));
              });
            }
          } else {
            pendingText = '';
          }
        } else if (message.type === 'input_audio_buffer.speech_stopped') {
          const speechDurationMs = speechStartTime ? Date.now() - speechStartTime : 0;
          speechStartTime = null;

          console.log(JSON.stringify({
            event: 'USER_SPEECH_STOP',
            requestId,
            durationMs: speechDurationMs,
            state: turnController?.getState(),
          }));

          if (turnController) {
            turnController.onSpeechStopped();
          }
          
          // Cancel pending barge-in timer if speech stopped before sustained threshold
          if (bargeInTimer) {
            clearTimeout(bargeInTimer);
            bargeInTimer = null;
            console.log(JSON.stringify({ 
              event: 'barge_in_decision', 
              requestId, 
              ttsSpeaking,
              msSinceTtsStart: ttsStartAt ? Date.now() - ttsStartAt : null,
              durationMs: speechDurationMs,
              energy: undefined,
              decision: 'IGNORE',
              reason: 'speech_stopped_before_sustained'
            }));
          }
          
          // server_vad auto-commits the audio buffer on speech_stopped.
          // Do NOT manually commit — double-commit causes input_audio_buffer_commit_empty errors.
          bufferedAudioFrameCount = 0;
        } else if (message.type === 'input_audio_buffer.speech_started') {
          speechStartTime = Date.now();
          bufferedAudioFrameCount = 0;

          console.log(JSON.stringify({
            event: 'USER_SPEECH_START',
            requestId,
            state: turnController?.getState(),
            ttsPlaying: ttsSpeaking,
            openaiResponseActive,
          }));
          
          // Notify TurnController
          if (turnController) {
            turnController.onSpeechStarted();
          }
          
          const now = Date.now();
          const msSinceTtsStart = ttsStartAt ? now - ttsStartAt : null;
          const msSinceLastBargeIn = lastBargeInTime ? now - lastBargeInTime : null;
          
          // Gate 1: Only evaluate barge-in when TTS is speaking
          if (!ttsSpeaking) {
            // TTS not playing, but if OpenAI is still generating text, cancel it
            // to prevent queued speech from playing after the user starts talking
            if (openaiResponseActive && currentResponseId && openAiWs && openAiWs.readyState === WebSocket.OPEN) {
              openAiWs.send(JSON.stringify({ type: 'response.cancel' }));
              console.log(JSON.stringify({
                event: 'OPENAI_CANCEL_SENT',
                requestId,
                responseId: currentResponseId,
                reason: 'user_speech_during_llm_generation',
              }));
              pendingText = '';
              openaiResponseActive = false;
              currentResponseId = null;
            }
            console.log(JSON.stringify({
              event: 'barge_in_decision',
              requestId,
              ttsSpeaking: false,
              msSinceTtsStart,
              durationMs: 0,
              decision: 'IGNORE',
              reason: 'tts_not_speaking',
              turnState: turnController?.getState(),
            }));
            // Don't start barge-in timer, just track speech for normal input
          }
          // Gate 2: Echo ignore window (800ms after TTS starts)
          else if (msSinceTtsStart !== null && msSinceTtsStart < ECHO_IGNORE_WINDOW_MS) {
            console.log(JSON.stringify({ 
              event: 'barge_in_decision', 
              requestId, 
              ttsSpeaking: true,
              msSinceTtsStart,
              durationMs: 0,
              energy: undefined,
              decision: 'IGNORE',
              reason: 'echo_ignore_window'
            }));
          }
          // Gate 3: Cooldown after previous barge-in
          else if (msSinceLastBargeIn !== null && msSinceLastBargeIn < BARGE_IN_COOLDOWN_MS) {
            console.log(JSON.stringify({ 
              event: 'barge_in_decision', 
              requestId, 
              ttsSpeaking: true,
              msSinceTtsStart,
              durationMs: 0,
              energy: undefined,
              decision: 'IGNORE',
              reason: 'cooldown_active',
              msSinceLastBargeIn
            }));
          }
          // Start sustained speech timer
          else {
            console.log(JSON.stringify({ 
              event: 'barge_in_timer_started', 
              requestId, 
              ttsSpeaking: true,
              msSinceTtsStart,
              requiredDurationMs: SUSTAINED_SPEECH_MS
            }));
            
            // Clear any existing timer
            if (bargeInTimer) {
              clearTimeout(bargeInTimer);
            }
            
            // Track speech start for sustained check
            const speechStartedAt = Date.now();
            
            // Start timer for sustained speech
            bargeInTimer = setTimeout(() => {
              bargeInTimer = null;
              
              const actualDuration = Date.now() - speechStartedAt;
              
              // Re-check conditions when timer fires
              if (!ttsSpeaking) {
                console.log(JSON.stringify({ 
                  event: 'barge_in_decision', 
                  requestId, 
                  ttsSpeaking: false,
                  msSinceTtsStart: ttsStartAt ? Date.now() - ttsStartAt : null,
                  durationMs: actualDuration,
                  speechStillActive: !!speechStartTime,
                  decision: 'IGNORE',
                  reason: 'tts_stopped_before_trigger'
                }));
                return;
              }
              
              // Verify speech is still active (speechStartTime is set)
              // This guards against race conditions where speech_stopped didn't cancel the timer in time
              if (!speechStartTime) {
                console.log(JSON.stringify({ 
                  event: 'barge_in_decision', 
                  requestId, 
                  ttsSpeaking: true,
                  msSinceTtsStart: ttsStartAt ? Date.now() - ttsStartAt : null,
                  durationMs: actualDuration,
                  speechStillActive: false,
                  decision: 'IGNORE',
                  reason: 'speech_ended_before_trigger'
                }));
                return;
              }
              
              // TRIGGER BARGE-IN - Speech sustained for full duration while TTS was speaking
              console.log(JSON.stringify({ 
                event: 'barge_in_decision', 
                requestId, 
                ttsSpeaking: true,
                msSinceTtsStart: ttsStartAt ? Date.now() - ttsStartAt : null,
                durationMs: actualDuration,
                speechStillActive: true,
                decision: 'TRIGGER',
                reason: 'sustained_speech_confirmed'
              }));
              
              executeBargeIn();
            }, SUSTAINED_SPEECH_MS);
          }
        } else if (message.type === 'response.audio_transcript.done') {
          // NOTE: This fires in AUDIO mode only. In TEXT mode, we capture from response.done above.
          const text = message.transcript || '';
          if (text) {
            // Avoid duplicate if already captured in response.done
            const alreadyCaptured = transcriptBuffer.some(t => t.role === 'ai' && t.text === text);
            if (!alreadyCaptured) {
              transcriptBuffer.push({ role: 'ai', text, timestamp: new Date() });
              console.log(JSON.stringify({ 
                tag: '[TX_APPEND]', 
                requestId, 
                callSid: callSid ? `****${callSid.slice(-8)}` : null,
                role: 'assistant',
                len: text.length,
                source: 'audio_transcript',
              }));
            }
          }
        } else if (message.type === 'conversation.item.input_audio_transcription.completed') {
          const text = message.transcript || '';
          const trimmed = text.trim();
          const words = trimmed.split(/\s+/).filter((w: string) => w.length > 0).length;
          console.log(JSON.stringify({
            event: 'USER_TRANSCRIPT',
            requestId,
            len: trimmed.length,
            words,
            preview: trimmed.substring(0, 60),
          }));
          if (text) {
            transcriptBuffer.push({ role: 'user', text, timestamp: new Date() });

            // Notify TurnController of FINAL transcript
            if (turnController) {
              turnController.onTranscriptFinal(text);
            }
          }
        } else if (message.type === 'error') {
          // Treat "cancel on non-active response" as benign — expected after squelch
          const errCode = message.error?.code || message.error?.type || '';
          const errMsg = typeof message.error?.message === 'string' ? message.error.message : '';
          if (errCode === 'response_cancel_not_active' || errMsg.includes('cancel')) {
            console.log(JSON.stringify({ event: 'CANCEL_BENIGN', requestId, error: message.error }));
          } else if (errCode === 'input_audio_buffer_commit_empty' || errMsg.includes('commit_empty') || errMsg.includes('buffer is empty')) {
            console.log(JSON.stringify({ event: 'COMMIT_EMPTY_BENIGN', requestId, error: message.error }));
          } else {
            console.log(JSON.stringify({ event: 'openai_error', requestId, error: message.error }));
          }
        }
      } catch (err) {
        console.log(JSON.stringify({ event: 'openai_parse_error', requestId }));
      }
    });

    openAiWs.on('close', (code, reason) => {
      const callAgeMs = Date.now() - callStartedAt;
      const msSinceLastTwilioAudio = Date.now() - lastAudioFromTwilioAt;
      const msSinceLastOpenAIMsg = Date.now() - lastOpenAIMsgAt;
      console.log(JSON.stringify({
        event: 'openai_close',
        requestId,
        code,
        reason: reason?.toString(),
        callAgeMs,
        msSinceLastTwilioAudio,
        msSinceLastOpenAIMsg,
      }));

      openAiReady = false;
      openaiResponseActive = false;
      bufferedAudioFrameCount = 0;

      // Clear keepalive on close
      if (openAiPingInterval) {
        clearInterval(openAiPingInterval);
        openAiPingInterval = null;
      }

      // Reconnect on abnormal closures (1006/1001) if Twilio is still alive
      const isAbnormal = code === 1006 || code === 1001;
      if (isAbnormal && twilioWs.readyState === WebSocket.OPEN && openAiReconnectAttempt < OPENAI_MAX_RECONNECT) {
        const delay = OPENAI_RECONNECT_BACKOFF[openAiReconnectAttempt] || 2000;
        openAiReconnectAttempt++;
        reconnecting = true;
        console.log(JSON.stringify({
          event: 'openai_reconnect_scheduled',
          requestId,
          attempt: openAiReconnectAttempt,
          maxAttempts: OPENAI_MAX_RECONNECT,
          delayMs: delay,
          code,
        }));

        // Send filler line on first reconnect attempt via ElevenLabs TTS
        if (openAiReconnectAttempt === 1) {
          const fillerId = `filler_reconnect_${Date.now()}`;
          speakElevenLabs('One moment…', fillerId).catch(() => {});
        }

        setTimeout(() => {
          if (twilioWs.readyState !== WebSocket.OPEN) {
            console.log(JSON.stringify({ event: 'openai_reconnect_aborted', requestId, reason: 'twilio_closed' }));
            return;
          }
          console.log(JSON.stringify({ event: 'openai_reconnect_attempt', requestId, attempt: openAiReconnectAttempt }));
          initOpenAI();
        }, delay);
      } else if (twilioWs.readyState === WebSocket.OPEN) {
        // Normal close or reconnect exhausted — end the call gracefully
        if (isAbnormal && openAiReconnectAttempt >= OPENAI_MAX_RECONNECT) {
          console.log(JSON.stringify({ event: 'openai_reconnect_exhausted', requestId, attempts: openAiReconnectAttempt }));
        }
        twilioWs.close(1000, 'OpenAI connection closed');
      }
    });

    openAiWs.on('error', (err) => {
      const callAgeMs = Date.now() - callStartedAt;
      console.log(JSON.stringify({ event: 'openai_error', requestId, error: err?.message, callAgeMs }));
    });
  }

  twilioWs.on('message', (data) => {
    try {
      const message: TwilioMessage = JSON.parse(data.toString());

      if (message.event === 'connected') {
        console.log(JSON.stringify({ event: 'twilio_connected', requestId }));
      } else if (message.event === 'start') {
        clearTimeout(startTimeout);
        streamSid = message.start?.streamSid || message.streamSid || null;
        callSid = message.start?.callSid || null;
        
        const customParams = message.start?.customParameters;
        const paramFrom = customParams?.from || null;
        const paramTo = customParams?.to || null;
        const paramOrgId = customParams?.orgId || null;
        const paramPhoneNumberId = customParams?.phoneNumberId || null;
        orgName = customParams?.orgName || null;
        
        // [INBOUND_STREAM_START] - Log immediately on stream start
        console.log(JSON.stringify({ 
          tag: '[INBOUND_STREAM_START]',
          requestId, 
          callSid: maskCallSid(callSid),
          from: maskPhone(paramFrom),
          to: maskPhone(paramTo),
          orgId: paramOrgId,
          phoneNumberId: paramPhoneNumberId,
          paramKeys: Object.keys(customParams || {}),
        }));

        if (!validateAuth(customParams)) {
          console.log(JSON.stringify({ event: 'ws_close', requestId, callSid: maskCallSid(callSid), code: 1008, reason: 'Unauthorized' }));
          twilioWs.close(1008, 'Unauthorized');
          return;
        }

        authenticated = true;
        console.log(JSON.stringify({ event: 'stream_authenticated', requestId, callSid: maskCallSid(callSid) }));
        
        // === Lead creation in stream handler ===
        // This ensures leads are created even if the initial webhook failed or was skipped
        // HARDENING: Always verify customParameters.orgId against DB - DB is authoritative
        (async () => {
          try {
            let finalOrgId: string | null = null;
            let phoneNumberId = paramPhoneNumberId;
            let source = 'unknown';
            
            // ALWAYS lookup by phone number to verify - DB is authoritative
            if (paramTo) {
              const digitsOnly = paramTo.replace(/\D/g, '');
              const candidates: string[] = [paramTo];
              if (digitsOnly) candidates.push('+' + digitsOnly);
              if (digitsOnly.length === 10) candidates.push('+1' + digitsOnly);
              
              const phoneNumber = await prisma.phoneNumber.findFirst({
                where: { e164: { in: candidates }, inboundEnabled: true },
              });
              
              if (phoneNumber) {
                const dbOrgId = phoneNumber.orgId;
                phoneNumberId = phoneNumber.id;
                
                // Check for conflict between customParameters and DB
                if (paramOrgId && paramOrgId !== dbOrgId) {
                  // CONFLICT: customParameters has wrong orgId - DB wins
                  console.log(JSON.stringify({ 
                    tag: '[TENANT_CONFLICT]', 
                    requestId,
                    claimed: paramOrgId,
                    db: dbOrgId,
                    to: maskPhone(paramTo),
                  }));
                  finalOrgId = dbOrgId;
                  source = 'DB_OVERRIDE';
                } else if (paramOrgId) {
                  // No conflict - customParameters matches DB
                  finalOrgId = dbOrgId;
                  source = 'TwiML';
                } else {
                  // No customParameters orgId - use DB
                  finalOrgId = dbOrgId;
                  source = 'DB_ONLY';
                }
                
                console.log(JSON.stringify({ 
                  tag: '[TENANT_HIT]', 
                  requestId, 
                  orgId: finalOrgId, 
                  phoneNumberId,
                  to: maskPhone(paramTo),
                  source,
                }));
              } else {
                console.log(JSON.stringify({ 
                  tag: '[TENANT_MISS]', 
                  requestId, 
                  to: maskPhone(paramTo),
                  candidates: candidates.length,
                }));
                // Fall back to customParameters orgId only if DB lookup fails
                if (paramOrgId) {
                  finalOrgId = paramOrgId;
                  source = 'customParameters_fallback';
                  console.log(JSON.stringify({ 
                    tag: '[TENANT_FALLBACK]', 
                    requestId, 
                    orgId: finalOrgId,
                    warning: 'phone_not_in_db_using_custom_params',
                  }));
                }
              }
            } else if (paramOrgId) {
              // No toNumber to lookup - use customParameters (unusual)
              finalOrgId = paramOrgId;
              source = 'customParameters_no_to';
              console.log(JSON.stringify({ 
                tag: '[TENANT_HIT]', 
                requestId, 
                orgId: finalOrgId,
                source,
              }));
            }
            
            const orgId = finalOrgId;
            
            if (!orgId || !callSid) {
              console.log(JSON.stringify({ 
                event: 'lead_creation_skipped', 
                requestId, 
                reason: !orgId ? 'no_org_id' : 'no_call_sid',
              }));
              return;
            }
            
            // Check if lead already exists for this callSid (idempotency)
            const existingCall = await prisma.call.findUnique({
              where: { twilioCallSid: callSid },
              include: { lead: true },
            });
            
            if (existingCall?.lead) {
              createdLeadId = existingCall.lead.id;
              createdContactId = existingCall.lead.contactId || null;
              createdOrgId = existingCall.lead.orgId;
              callStartTime = callStartTime || existingCall.startedAt || new Date();
              console.log(JSON.stringify({
                tag: '[LEAD_EXISTS]',
                requestId,
                leadId: existingCall.lead.id,
                orgId: existingCall.lead.orgId,
                callSid: maskCallSid(callSid),
              }));
              return;
            }
            
            // Normalize phone numbers to E.164
            const normalizedFrom = paramFrom?.replace(/\D/g, '') || '';
            const fromE164 = normalizedFrom.length === 10 ? '+1' + normalizedFrom : 
                            normalizedFrom.length === 11 && normalizedFrom.startsWith('1') ? '+' + normalizedFrom :
                            normalizedFrom ? '+' + normalizedFrom : null;
            
            const normalizedTo = paramTo?.replace(/\D/g, '') || '';
            const toE164 = normalizedTo.length === 10 ? '+1' + normalizedTo : 
                          normalizedTo.length === 11 && normalizedTo.startsWith('1') ? '+' + normalizedTo :
                          normalizedTo ? '+' + normalizedTo : paramTo;
            
            // Use transaction for atomic lead creation with step-level error logging
            let currentStep = 'contact';
            try {
              const result = await prisma.$transaction(async (tx) => {
                // Step 1: Find or create contact
                currentStep = 'contact';
                let contact = null;
                if (fromE164) {
                  contact = await tx.contact.findFirst({
                    where: { orgId, primaryPhone: fromE164 },
                  });
                  
                  if (!contact) {
                    contact = await tx.contact.create({
                      data: {
                        orgId,
                        primaryPhone: fromE164,
                        name: 'Unknown Caller',
                      },
                    });
                  }
                } else {
                  contact = await tx.contact.create({
                    data: {
                      orgId,
                      name: 'Unknown Caller',
                    },
                  });
                }
                
                // Step 2: Create lead
                currentStep = 'lead';
                const lead = await tx.lead.create({
                  data: {
                    orgId,
                    contactId: contact.id,
                    status: 'in_progress',
                    source: 'phone',
                    summary: `Inbound call from ${maskPhone(paramFrom)}`,
                  },
                });
                
                // Step 3: Create interaction
                currentStep = 'interaction';
                const interaction = await tx.interaction.create({
                  data: {
                    orgId,
                    leadId: lead.id,
                    channel: 'call',
                    status: 'active',
                    startedAt: new Date(),
                  },
                });
                
                // Step 4: Create call record
                currentStep = 'call';
                if (phoneNumberId && toE164) {
                  await tx.call.create({
                    data: {
                      orgId,
                      leadId: lead.id,
                      interactionId: interaction.id,
                      phoneNumberId,
                      direction: 'inbound',
                      provider: 'twilio',
                      twilioCallSid: callSid,
                      fromE164: fromE164 || 'unknown',
                      toE164: toE164,
                      startedAt: new Date(),
                    },
                  });
                }
                
                return { contact, lead, interaction };
              });
              
              // Store IDs for post-call processing
              createdLeadId = result.lead.id;
              createdContactId = result.contact?.id || null;
              createdOrgId = orgId;
              callStartTime = new Date();
              callerFromE164 = fromE164;
              callerToE164 = toE164;
              
              console.log(JSON.stringify({ 
                tag: '[LEAD_CREATED]', 
                requestId, 
                leadId: result.lead.id,
                orgId,
                contactId: result.contact?.id || null,
                callSid: maskCallSid(callSid),
              }));
            } catch (txErr: any) {
              console.error(JSON.stringify({ 
                tag: '[LEAD_CREATE_ERROR]', 
                requestId, 
                step: currentStep,
                error: txErr?.message || String(txErr),
              }));
              throw txErr;
            }
          } catch (err: any) {
            console.error(JSON.stringify({ 
              event: 'lead_creation_error', 
              requestId, 
              error: err?.message || String(err),
            }));
          }
        })();
        
        // Log ElevenLabs key status and TTS configuration for diagnostics
        logElevenLabsKeyStatus();
        logTTSConfig();
        
        // Initialize TurnController for turn-taking state machine
        initTurnController();
        
        if (!openAiInitStarted) {
          openAiInitStarted = true;
          initOpenAI();
        }
      } else if (message.event === 'media') {
        if (!authenticated) return;
        
        const audioPayload = message.media?.payload;
        if (audioPayload) {
          twilioFrameCount++;
          lastAudioFromTwilioAt = Date.now();
          if (twilioFrameCount % LOG_FRAME_INTERVAL === 0) {
            console.log(JSON.stringify({ event: 'audio_from_twilio', requestId, frames: twilioFrameCount }));
          }

          if (openAiReady && openAiWs && openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: audioPayload }));
            bufferedAudioFrameCount++;
          } else {
            pendingTwilioAudio.push(audioPayload);
          }
        }
      } else if (message.event === 'mark') {
        // Mark event - no action needed
      } else if (message.event === 'stop') {
        console.log(JSON.stringify({ event: 'twilio_stop', requestId, callSid: maskCallSid(callSid), callAgeMs: Date.now() - callStartedAt }));

        // Delay finalization to allow in-flight OpenAI transcriptions to land
        scheduleFinalize('twilio_stop');
      }
    } catch (err) {
      console.log(JSON.stringify({ event: 'twilio_parse_error', requestId }));
      twilioWs.close(1003, 'Bad JSON');
    }
  });

  twilioWs.on('close', (code, reason) => {
    clearTimeout(startTimeout);
    console.log(JSON.stringify({
      event: 'ws_close',
      requestId,
      callSid: maskCallSid(callSid),
      code,
      reason: reason?.toString() || null,
      twilioFrameCount,
      ttsFrameCount,
      callAgeMs: Date.now() - callStartedAt,
    }));

    // Clean up keepalive ping
    if (openAiPingInterval) {
      clearInterval(openAiPingInterval);
      openAiPingInterval = null;
    }

    // Reset state on connection close
    openaiResponseActive = false;
    bufferedAudioFrameCount = 0;
    
    // Cleanup TurnController
    if (turnController) {
      turnController.cleanup();
      turnController = null;
    }
    
    // Fallback: if stop never arrives, still finalize (processCallEnd has its own dedupe by callSid)
    scheduleFinalize('twilio_close');
  });

  twilioWs.on('error', (err) => {
    console.log(JSON.stringify({
      event: 'ws_error',
      requestId,
      callSid: maskCallSid(callSid),
      error: err?.message || String(err),
      callAgeMs: Date.now() - callStartedAt,
    }));
  });
}
