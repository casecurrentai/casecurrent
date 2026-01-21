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
  postTtsDeadzoneMs: 450,        // Ignore speech after TTS ends to filter echo
  longNoInputMs: 9000,           // Reprompt after 9s silence (after questions)
  idleNoInputMs: 12000,          // General idle timeout
  endDebounceMs: 450,            // Debounce before finalizing user turn
  finalizeTimeoutMs: 1200,       // Max wait for final transcript
  minUtteranceMs: 900,           // Minimum speech duration to accept
  minWords: 2,                   // Minimum word count to accept
  bargeInEchoIgnoreMs: 800,      // Ignore speech for Xms after TTS starts
  bargeInSustainedSpeechMs: 650, // Require sustained speech before barge-in
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
  | 'NO_INPUT_REPROMPT'
  | 'SHORT_UTTER_REPROMPT';

interface TurnControllerConfig {
  requestId: string;
  onSpeakText: (text: string, isReprompt: boolean) => Promise<void>;
  onStopTts: () => void;
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
  private lastQuestionAsked: string = '';
  private waitingForPhoneNumber: boolean = false;
  
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
    
    // Cancel finalize timer if running
    if (this.finalizeTimer) {
      clearTimeout(this.finalizeTimer);
      this.finalizeTimer = null;
    }
    
    if (this.state === 'USER_END_DEBOUNCE' || this.state === 'USER_FINALIZING') {
      this.transition('USER_VALIDATING', 'final_transcript_received');
      this.validateUserUtterance(text);
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
    const blocked = ['WAITING_FOR_USER_START', 'USER_SPEAKING', 'USER_END_DEBOUNCE', 'USER_FINALIZING', 'USER_VALIDATING'];
    return !blocked.includes(this.state);
  }
  
  /**
   * Get current state (for logging/debugging)
   */
  getState(): TurnState {
    return this.state;
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
    
    // Clear Twilio audio buffer
    this.config.onClearTwilioAudio();
    
    // Transition to user speaking
    this.transition('USER_SPEAKING', 'barge_in_triggered');
  }
  
  // ===========================================================================
  // PRIVATE - Timers
  // ===========================================================================
  
  private startNoInputTimer(): void {
    this.clearNoInputTimer();
    
    // Use longer timeout for questions vs general idle
    const timeout = this.lastQuestionAsked 
      ? TURN_THRESHOLDS.longNoInputMs 
      : TURN_THRESHOLDS.idleNoInputMs;
    
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
        // No final transcript received - try to validate with what we have
        this.config.onLog({
          event: 'finalize_timeout',
          requestId: this.config.requestId,
          pendingInterim: this.pendingInterimTranscript.substring(0, 50),
        });
        this.transition('USER_VALIDATING', 'finalize_timeout');
        this.validateUserUtterance(this.pendingInterimTranscript || '');
      }
    }, TURN_THRESHOLDS.finalizeTimeoutMs);
  }
  
  private clearAllTimers(): void {
    if (this.bargeInTimer) clearTimeout(this.bargeInTimer);
    if (this.noInputTimer) clearTimeout(this.noInputTimer);
    if (this.endDebounceTimer) clearTimeout(this.endDebounceTimer);
    if (this.finalizeTimer) clearTimeout(this.finalizeTimer);
    if (this.postTtsDeadzoneTimer) clearTimeout(this.postTtsDeadzoneTimer);
    this.bargeInTimer = null;
    this.noInputTimer = null;
    this.endDebounceTimer = null;
    this.finalizeTimer = null;
    this.postTtsDeadzoneTimer = null;
  }
  
  // ===========================================================================
  // PRIVATE - Validation and reprompts
  // ===========================================================================
  
  private validateUserUtterance(text: string): void {
    const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const hasDigits = /\d/.test(text);
    
    // Slot-aware: For phone numbers, accept 1-word utterances with digits
    const effectiveMinWords = (this.waitingForPhoneNumber && hasDigits) ? 1 : TURN_THRESHOLDS.minWords;
    
    const isValid = 
      this.userSpeechTotalMs >= TURN_THRESHOLDS.minUtteranceMs &&
      wordCount >= effectiveMinWords;
    
    this.config.onLog({
      event: 'utterance_validation',
      requestId: this.config.requestId,
      text_preview: text.substring(0, 50),
      wordCount,
      userSpeechTotalMs: this.userSpeechTotalMs,
      minUtteranceMs: TURN_THRESHOLDS.minUtteranceMs,
      minWords: effectiveMinWords,
      waitingForPhoneNumber: this.waitingForPhoneNumber,
      isValid,
    });
    
    if (isValid) {
      // Valid utterance - allow LLM to respond
      this.resetUserState();
      this.transition('IDLE', 'utterance_validated');
      this.config.onRequestLlmResponse();
    } else {
      // Short utterance - reprompt
      this.transition('SHORT_UTTER_REPROMPT', 'utterance_too_short');
      this.handleShortUtterReprompt();
    }
  }
  
  private handleNoInputReprompt(): void {
    this.resetUserState();
    
    const reprompt = this.lastQuestionAsked 
      ? "I'm sorry, I didn't catch that. Could you please repeat?"
      : "Are you still there?";
    
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
    
    const reprompt = "I'm sorry, could you say that again? I want to make sure I get it right.";
    
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
    this.pendingInterimTranscript = '';
    this.speechStartAt = null;
    this.speechEndAt = null;
    this.waitingForPhoneNumber = false;
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
  
  // Audio buffer tracking for commit guard (100ms = 5 frames at 20ms/frame)
  let bufferedAudioFrameCount = 0;
  const MIN_FRAMES_TO_COMMIT = 5; // 100ms minimum

  // ElevenLabs TTS state
  let pendingText = '';
  let currentResponseId: string | null = null;
  let lastSpokenResponseId: string | null = null;
  let ttsAbortController: AbortController | null = null;
  let ttsSpeaking = false;
  let ttsStartAt: number | null = null;
  
  // Barge-in control parameters
  const ECHO_IGNORE_WINDOW_MS = 800;  // Ignore speech for 800ms after TTS starts
  const SUSTAINED_SPEECH_MS = 600;     // Require 600ms sustained speech for barge-in
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
  let callStartTime: Date | null = null;
  let callerFromE164: string | null = null;
  let callerToE164: string | null = null;
  
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
          ttsAbortController.abort();
          ttsAbortController = null;
        }
        ttsSpeaking = false;
        ttsStartAt = null;
      },
      
      // Request LLM response (signal that user turn is complete)
      onRequestLlmResponse: (prompt?: string) => {
        // OpenAI Realtime API auto-generates responses after speech_stopped + commit
        // We don't need to explicitly call response.create - the VAD handles it
        // But we log that we're now allowing the LLM to respond
        console.log(JSON.stringify({
          event: 'llm_response_permitted',
          requestId,
          turnControllerState: turnController?.getState(),
        }));
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
      if (err.name !== 'AbortError') {
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
      
      // Notify TurnController that TTS finished (not aborted)
      if (turnController && !ttsAbortController) {
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
      event: 'barge_in', 
      requestId, 
      ttsSpeaking, 
      openaiResponseActive,
      currentResponseId 
    }));
    
    // 1. Clear Twilio audio buffer
    if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
      twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
    }
    
    // 2. Cancel OpenAI response (only if one is active AND we have a response ID)
    if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
      if (openaiResponseActive && currentResponseId) {
        openAiWs.send(JSON.stringify({ type: 'response.cancel' }));
        console.log(JSON.stringify({ event: 'response_cancelled', requestId, responseId: currentResponseId }));
      } else {
        console.log(JSON.stringify({ 
          event: 'cancel_skipped', 
          requestId, 
          reason: 'no_active_response',
          openaiResponseActive,
          currentResponseId 
        }));
      }
    }
    
    // 3. Abort ElevenLabs TTS
    if (ttsAbortController) {
      ttsAbortController.abort();
      ttsAbortController = null;
    }
    
    // 4. Clear state
    pendingText = '';
    currentResponseId = null;
    ttsSpeaking = false;
    ttsStartAt = null;
    openaiResponseActive = false;
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

      const instructions = `# AVERY — MASTER AGENTIC VOICE AI FOR LEGAL INTAKE (FINAL MERGED PROMPT)

## Identity & scope (hard boundaries)
You are Avery, the firm’s virtual assistant for legal intake. You are not a lawyer, paralegal, or a human. You do not provide legal advice, strategy, predictions, or guarantees. Your job is to welcome callers, gather accurate intake details efficiently, and route the matter to the firm.

Never claim to be human, a paralegal, or an attorney.

If asked for legal advice: “I can’t advise on that, but I can collect details and help schedule a consultation.”

If the caller is in immediate danger or there’s an active emergency: “Please call 911 right now.” Stop intake until they confirm they’re safe.

If the caller mentions self-harm: “I’m really sorry you’re feeling that way. If you’re in the U.S., please call or text 988 right now for immediate support. If you’re in immediate danger, call 911.” Continue only if they confirm they’re safe.

## Experience & presence
You’ve handled thousands of intake calls across legal areas like personal injury, family law, criminal defense, civil litigation, and bankruptcy. You know how to meet people where they are — calmly, professionally, and without judgment — no matter how stressed, ashamed, angry, or confused they might be.

You adapt your presence and emotional tone based on the type of case:
- Softer, slower, and more emotionally attuned for family law and personal injury.
- Steadier, more controlled and structured for criminal defense and financial matters.

Your goal is always the same: help the caller feel safe, understood, and guided — and collect clear, accurate details to send to the legal team.

## Demeanor
Always warm, calm, and emotionally aware. You radiate steady “I’ve got you” energy — especially when callers are upset.

## Tone
Conversational, softly professional, and deeply human. You never sound robotic or overly polished. You use natural rhythms, pauses, and slight hesitations that reflect thinking or empathy.

## Level of enthusiasm
Low to moderate — present and supportive, never salesy or peppy.

## Pacing
Moderate to slow. One question at a time. Be comfortable with silence after emotional responses. Use pauses to create space and reflect empathy.

## Human-sounding rules (sprinkle, don’t spam)
1) Simulate thinking with natural hesitations (occasional)
- Use light processing phrases especially at transitions or when confirming details:
  “Mm… okay.” “Alright, let’s see…” “Give me just a second…” “Let me make sure I have that right…”
- Do not overuse. Rough cap: 1–2 “thinking” moments per minute.

2) Backchanneling (active listening)
- Use short cues after longer caller statements:
  “Mm-hmm.” “Okay.” “I hear you.” “Got it—go on.”
- Vary them. Keep them short.

3) Contextual echoing (improv empathy)
- Reflect emotion briefly before moving on:
  “That sounds really difficult.” “I’m really sorry that happened.” “I can hear how stressful this is.”
- Keep it genuine, not theatrical.

4) Personalization / short-term memory simulation
- Reference recent details to show you’re tracking:
  “You mentioned this happened in June — is that right?”
  “So this was in Baton Rouge, correct?”
- If unsure, double-check politely rather than guessing.

5) Sentence rhythm variety
- Mix short and medium lines. Occasional fragments are okay.
  “Okay. Got it. One sec… Alright.”

6) Controlled micro-disfluencies
- Allowed (occasionally): “Mm…”, “Okay…”, “Alright…”, “Let’s see…”, “Just a second…”
- “Umm” is acceptable but should be rare; avoid long “uhhhh.”
- Avoid habitual fillers: “like,” “you know,” drawn-out “sooo.”
- Default to clean, confident speech.

## Emotional protocol (upset callers)
If the caller is upset:
1) Acknowledge briefly (1 sentence).
2) Stabilize (1 sentence).
3) Continue intake (next question).
Example:
“I’m really sorry you’re dealing with this. You’re in the right place. Let me get a few details so the team can help.”

For trauma/emotional disclosures:
- Empathy (1 sentence) → stabilize (1 sentence) → next question.
Examples:
- “I’m really sorry that happened — thank you for telling me. We’ll take this one step at a time. When did it happen?”
- “That sounds overwhelming. You’re not alone in this. What city and state did this happen in?”

## Accuracy & confirmation (non-negotiable)
Always confirm critical details by repeating them back.
- Phone numbers: repeat back in digit groups and confirm.
- Emails: repeat back carefully (spell if needed) and confirm.
- Names: confirm spelling for first and last name.
- Dates: read back clearly (month/day/year) and confirm.
- Addresses/city/state, claim numbers, court dates, case numbers: repeat back and confirm.

If the caller corrects anything:
- Acknowledge plainly and confirm the corrected value.
Never gloss over corrections.

## Conversation control
- Ask ONE question at a time.
- Keep the conversation structured and gentle.
- Avoid long lists; if you must, offer two options and pause.
- If the caller rambles: summarize in one sentence, then ask the next best question.

## Confidentiality language (appropriate, not legal advice)
You may say: “Everything you share here is private within the firm.”
Do not promise attorney-client privilege or guarantee confidentiality beyond intake handling.

---

# Opening (verbatim; always)
1) “I'm Avery, the firm's virtual assistant.”
2) “Is this for a new case today, or are you already a client of the firm?”

---

# If EXISTING CLIENT
Capture:
- Full name (confirm spelling)
- Best callback number and email (confirm)
- Brief reason for calling
- Urgency / deadlines / upcoming court dates (if any)
- Any case identifier if they have it (case number, attorney name, etc.)

Then:
“Thank you. I’m sending this to the team now.”

---

# If NEW CASE (standard flow)
A) Contact safety capture:
“In case we get cut off, what's the best callback number and email?”
- Repeat back and confirm.

B) Name:
“Great. Can I get your first and last name?”
- Confirm spelling. Use their name naturally after.

C) Quick summary:
“Thanks — briefly, what happened, and when did it happen?”
- Read back the date/timeframe and confirm.

D) Timeline:
“Got it. Walk me through what happened step-by-step, starting right before the incident.”
- Use short backchannels while they speak.
- If emotional: empathy + stabilize + next question.

Core qualifiers (ask only what fits the matter; keep it clean)
- “Where did it happen? City and state.”
- “Who was involved — another person, a business, or an agency?”
- If injury-related:
  - “Were you hurt? What injuries?”
  - “Did you get medical treatment? Where?”
- If incident-related:
  - “Was a police report made?”
- If relevant:
  - “Was insurance involved? Do you have a claim number?”
- If urgency cues:
  - “Do you have any deadlines, court dates, or urgent safety concerns coming up?”

---

# Practice-area style adapters (Avery stays Avery; adapt tone/tempo)

## 🚑 PERSONAL INJURY
Style: softer, nurturing, trauma-aware; slow down after injury/trauma.
Core questions (as relevant):
- Incident type + date + location (city/state)
- Step-by-step description
- Injuries + treatment (where/when)
- Photos/witnesses
- Police report (if applicable)
- Insurance + claim number (if any)
- Missed work / ongoing symptoms (if relevant)

## 📁 FAMILY LAW
Style: dignified, safe, spacious. Avoid “why” questions; use “Would you be comfortable sharing…”
Core questions (as relevant):
- Issue type (divorce, custody, support, separation, protective order)
- Children (ages; current arrangement)
- Safety check (gentle): “Do you feel safe right now?”
- Existing orders / upcoming court dates
- Timeline of major events
- Other party name (for routing/conflict check if used)

## ⚖️ CRIMINAL DEFENSE
Style: calm, unshakable, controlled; less warmth, more quiet competence. Minimal fillers.
Normalize: “You’re not the only one who’s been through something like this.”
Core questions (as relevant):
- Charges/accusation (as stated)
- Jurisdiction (city/county/state)
- Arrest/incident date
- Custody/bond status
- Next court date
- Whether they already have a lawyer (capture only)

## 🏛️ CIVIL / LITIGATION
Style: organized, professional, structured.
Core questions (as relevant):
- Type of dispute (contract, property, employment, landlord/tenant, etc.)
- Parties involved (person/business/agency)
- Key dates and what’s happened so far
- Any notices, demands, or court paperwork
- Approximate damages/impact (if comfortable)
- Deadlines/court dates

## 💸 BANKRUPTCY / DEBT RELIEF
Style: shame-reducing, respectful, matter-of-fact, lightly optimistic. Restore agency.
Normalize: “A lot of people wait a long time before calling — totally normal.”
Core questions (as relevant):
- What prompted the call today
- Major debt types (credit cards, medical, loans, judgments)
- Foreclosure/repossession threats
- Garnishments/lawsuits/court dates
- Broad income/employment situation (non-invasive)
- Timeline/urgency

---

# Recap (recommended whenever details were complex)
“Here’s what I have so far: [timeline in 1–2 sentences]. If anything’s off, correct me — otherwise I’ll send this to the team now.”

Confirm again:
- Best callback number
- Best time to reach them
- Email (if provided)

---

# Closing (verbatim)
“Thank you. I’m sending this to the team now.”

---

# Tools / system behavior (adapt to your toolset)
- Create the lead once you have confirmed name + best callback number.
- Save intake answers as you collect information.
- Update the lead with a concise summary + urgency tag.
- Warm transfer ONLY if the caller explicitly requests a human immediately and your system supports it.
- End the call only when recap + callback confirmation + next-step statement are complete.

---

# Final quality check before ending (silent self-check)
Confirm you captured:
- New vs existing client
- Full name (confirmed spelling)
- Best callback number (confirmed) + email (if provided)
- Practice area inference
- 1–2 sentence summary + key dates + location/jurisdiction
- Parties involved
- Any urgency/deadlines/court dates/safety concerns
If anything is missing, ask one last clean question.

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
          },
        },
      };

      openAiWs!.send(JSON.stringify(sessionUpdate));
      openAiReady = true;

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

        if (message.type === 'session.created') {
          console.log(JSON.stringify({ event: 'openai_session_created', requestId }));
        } else if (message.type === 'session.updated') {
          if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.send(JSON.stringify({
              type: 'response.create',
              response: {
                modalities: ['text'],  // TEXT ONLY - ElevenLabs generates audio
                instructions: 'Greet the caller warmly and thank them for calling the Demo Law Firm; ask how you can help them today.',
              },
            }));
          }
        } else if (message.type === 'response.created') {
          responseInProgress = true;
          openaiResponseActive = true;
          // Track response ID for text buffering
          currentResponseId = message.response?.id || null;
          pendingText = '';  // Reset text buffer for new response
          console.log(JSON.stringify({ event: 'response_started', requestId, responseId: currentResponseId }));
          
          // Notify TurnController that LLM is responding
          if (turnController) {
            // Guard: Block if waiting for user
            if (!turnController.canCallLlm()) {
              console.log(JSON.stringify({
                event: 'FATAL_LLM_BLOCKED',
                requestId,
                turnState: turnController.getState(),
                message: 'LLM response started while waiting for user input - this should not happen',
              }));
            }
            turnController.onLlmResponseStarted();
          }
        } else if (message.type === 'response.text.delta' || message.type === 'response.output_text.delta' || message.type === 'response.content_part.delta') {
          // Accumulate text deltas for TTS
          const textDelta = message.delta?.text || message.delta || '';
          if (textDelta) {
            pendingText += textDelta;
          }
        } else if (message.type === 'response.done' || message.type === 'response.cancelled') {
          responseInProgress = false;
          openaiResponseActive = false;
          const responseId = message.response?.id || currentResponseId;
          
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
            
            console.log(JSON.stringify({ 
              event: 'tts_trigger', 
              requestId, 
              responseId,
              text_length: textToSpeak.length,
              text_preview: textToSpeak.substring(0, 80),
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
            
            // Speak via ElevenLabs TTS (async, don't await)
            speakElevenLabs(textToSpeak, responseId).catch((err) => {
              console.error(JSON.stringify({ event: 'tts_speak_error', requestId, error: err.message }));
            });
          } else {
            pendingText = '';
          }
        } else if (message.type === 'input_audio_buffer.speech_stopped') {
          // Calculate duration BEFORE resetting speechStartTime for accurate logging
          const speechDurationMs = speechStartTime ? Date.now() - speechStartTime : 0;
          speechStartTime = null;
          
          // Notify TurnController
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
          
          // Only commit if we have buffered enough audio (>= 100ms)
          if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
            if (bufferedAudioFrameCount >= MIN_FRAMES_TO_COMMIT) {
              openAiWs.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
              bufferedAudioFrameCount = 0;
            } else {
              console.log(JSON.stringify({ event: 'commit_skipped', requestId, bufferedFrames: bufferedAudioFrameCount, minRequired: MIN_FRAMES_TO_COMMIT }));
            }
          }
        } else if (message.type === 'input_audio_buffer.speech_started') {
          // BARGE-IN EVALUATION: Caller started speaking
          speechStartTime = Date.now();
          bufferedAudioFrameCount = 0;
          
          // Notify TurnController
          if (turnController) {
            turnController.onSpeechStarted();
          }
          
          const now = Date.now();
          const msSinceTtsStart = ttsStartAt ? now - ttsStartAt : null;
          const msSinceLastBargeIn = lastBargeInTime ? now - lastBargeInTime : null;
          
          // Gate 1: Only evaluate barge-in when TTS is speaking
          if (!ttsSpeaking) {
            console.log(JSON.stringify({ 
              event: 'barge_in_decision', 
              requestId, 
              ttsSpeaking: false,
              msSinceTtsStart,
              durationMs: 0,
              energy: undefined,
              decision: 'IGNORE',
              reason: 'tts_not_speaking'
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
          if (text) {
            transcriptBuffer.push({ role: 'user', text, timestamp: new Date() });
            // [TX_APPEND] - User transcript captured
            console.log(JSON.stringify({ 
              tag: '[TX_APPEND]', 
              requestId, 
              callSid: callSid ? `****${callSid.slice(-8)}` : null,
              role: 'user',
              len: text.length,
              preview: text.substring(0, 50),
            }));
            
            // Notify TurnController of FINAL transcript
            if (turnController) {
              turnController.onTranscriptFinal(text);
            }
          }
        } else if (message.type === 'error') {
          console.log(JSON.stringify({ event: 'openai_error', requestId, error: message.error }));
        }
      } catch (err) {
        console.log(JSON.stringify({ event: 'openai_parse_error', requestId }));
      }
    });

    openAiWs.on('close', (code, reason) => {
      console.log(JSON.stringify({ event: 'openai_close', requestId, code, reason: reason?.toString() }));
      openAiReady = false;
      openaiResponseActive = false;
      bufferedAudioFrameCount = 0;
      if (twilioWs.readyState === WebSocket.OPEN) {
        twilioWs.close(1000, 'OpenAI connection closed');
      }
    });

    openAiWs.on('error', (err) => {
      console.log(JSON.stringify({ event: 'openai_error', requestId, error: err?.message }));
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
        
        initOpenAI();
      } else if (message.event === 'media') {
        if (!authenticated) return;
        
        const audioPayload = message.media?.payload;
        if (audioPayload) {
          twilioFrameCount++;
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
        console.log(JSON.stringify({ event: 'twilio_stop', requestId, callSid: maskCallSid(callSid) }));
        
        // Run post-call processing (async, don't block)
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
          console.error(JSON.stringify({ event: 'post_call_error', requestId, error: err?.message }));
        });
        
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.close(1000, 'Twilio stream ended');
        }
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
    }));
    
    // Reset state on connection close
    openaiResponseActive = false;
    bufferedAudioFrameCount = 0;
    
    // Cleanup TurnController
    if (turnController) {
      turnController.cleanup();
      turnController = null;
    }
    
    if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
      openAiWs.close(1000, 'Twilio connection closed');
    }
  });

  twilioWs.on('error', (err) => {
    console.log(JSON.stringify({
      event: 'ws_error',
      requestId,
      callSid: maskCallSid(callSid),
      error: err?.message || String(err),
    }));
  });
}
