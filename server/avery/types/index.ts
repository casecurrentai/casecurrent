/**
 * Canonical typed contracts for the Avery voice-agent architecture.
 *
 * ElevenLabs is the voice runtime shell.
 * CaseCurrent is the system of record and intelligence layer.
 *
 * These types are the shared language between the ingestion pipeline,
 * extraction engine, state machine, and future real-time planner.
 */

// ──────────────────────────────────────────────────────────────────
// Domain enumerations
// ──────────────────────────────────────────────────────────────────

export type MatterType =
  | "personal_injury"
  | "employment"
  | "family"
  | "criminal"
  | "estate"
  | "general"
  | "unknown";

export type EmotionalState =
  | "calm"
  | "anxious"
  | "distressed"
  | "angry"
  | "confused"
  | "urgent"
  | "overwhelmed"
  | "unknown";

/** Urgency is a distinct dimension from emotional state. A caller can be calm but have a critical deadline. */
export type UrgencyLevel = "low" | "medium" | "high" | "critical";

export type IntakeStage =
  | "opening"
  | "intent_detection"
  | "matter_classification"
  | "eligibility_screening"
  | "fact_collection"
  | "contact_capture"
  | "conflict_check_prep"
  | "appointment_or_transfer"
  | "wrap_up";

export type RepairStrategy =
  | "clarify"
  | "slow_down"
  | "reassure_then_ask"
  | "summarize_and_confirm"
  | "offer_examples"
  | "handoff";

export type CallerIntent =
  | "new_case"
  | "existing_client"
  | "opposing_party"
  | "vendor"
  | "wrong_number"
  | "demo"
  | "unknown";

// ──────────────────────────────────────────────────────────────────
// Slot and state types
// ──────────────────────────────────────────────────────────────────

/** A single extracted data point with provenance and confidence. */
export interface StateSlot<T = unknown> {
  value: T | null;
  /** Confidence 0–1 */
  confidence: number;
  source: "caller" | "crm" | "inferred" | "system";
  updatedAt: string; // ISO 8601
}

/** Full conversation state snapshot — the system of record for one call. */
export interface ConversationState {
  conversationId: string;
  callId?: string;
  agentMode: "demo" | "production";
  callerName?: string | null;
  phone?: string | null;
  email?: string | null;
  language: string;
  callerIntent: CallerIntent;
  matterType: MatterType;
  emotionalState: EmotionalState;
  urgencyLevel: UrgencyLevel;
  intakeStage: IntakeStage;
  repairStrategy: RepairStrategy;
  slots: Record<string, StateSlot>;
  goalsCompleted: string[];
  missingRequiredFields: string[];
  /** Overall confidence 0–1 */
  confidenceScore: number;
  riskFlags: string[];
  transferRecommended: boolean;
  transferTarget?: string | null;
  interruptionCount: number;
  silenceEvents: number;
  turnCount: number;
  summarySoFar: string;
  lastUserUtterance?: string | null;
  lastAssistantUtterance?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ──────────────────────────────────────────────────────────────────
// Conversational style parameters
// ──────────────────────────────────────────────────────────────────

/**
 * Conversational style controls derived from state.
 * Drives tone, pacing, and directness in Avery's responses.
 */
export interface StyleParams {
  warmth: "low" | "medium" | "high";
  pace: "fast" | "medium" | "slow";
  directness: "low" | "medium" | "high";
}

// ──────────────────────────────────────────────────────────────────
// Live turn-by-turn types
// ──────────────────────────────────────────────────────────────────

/** Input for a single caller turn in the live state engine. */
export interface TurnInput {
  /** What the caller said. Empty string for silence events. */
  utterance: string;
  /** True when this is a silence event (no speech from caller). */
  isSilence?: boolean;
  /** True when the caller interrupted Avery mid-response. */
  isInterruption?: boolean;
}

/**
 * Structured response plan produced by the dialogue planner each turn.
 * The renderer uses this to generate actual LLM input.
 */
export interface ResponsePlan {
  /** High-level objective for this response (e.g. "collect_slot:caller_name"). */
  nextObjective: string;
  /** The question Avery should ask next. */
  askFor?: string;
  /** Empathetic acknowledgment to prepend (when emotional state warrants it). */
  acknowledge?: string;
  /** Summary of known facts to confirm with caller (for repair). */
  summarize?: string;
  /** Conversational style for this turn. */
  style: StyleParams;
  /** Hard constraints on response content (no legal advice, one question only, etc.). */
  constraints: string[];
  /** Soft guidance for this specific turn. */
  guidance: string[];
  /** Active repair strategy. */
  repairStrategy: RepairStrategy | null;
  /** Slots being targeted this turn. */
  collectSlots: string[];
  /** If set, Avery should invoke this tool. */
  toolToCall?: string;
  /** Arguments for toolToCall. */
  toolArguments?: Record<string, unknown>;
  /** Transfer target if escalation is needed. */
  transferTarget?: string;
  /** True when this is the wrap_up / end-of-conversation turn. */
  endConversation?: boolean;
}

// ──────────────────────────────────────────────────────────────────
// Provider-agnostic normalized payload
// ──────────────────────────────────────────────────────────────────

/** Normalized transcript entry — provider-agnostic. */
export interface NormalizedTranscriptEntry {
  role: "agent" | "user" | "unknown";
  message: string;
  timeInCallSecs: number | null;
}

/**
 * Provider-agnostic normalized post-call data.
 * Downstream logic should use this type, not raw provider payloads.
 */
export interface NormalizedPostCallData {
  provider: "elevenlabs" | "vapi" | "twilio" | "unknown";
  conversationId: string;
  callId?: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  transcriptText: string | null;
  transcriptEntries: NormalizedTranscriptEntry[];
  summary: string | null;
  analysis: Record<string, unknown> | null;
  callerPhone: string | null;
  calleePhone: string | null;
  language: string | null;
  recordingUrl: string | null;
  disconnectionReason: string | null;
  extractedData: Record<string, unknown>;
  metadata: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
}

// ──────────────────────────────────────────────────────────────────
// Extraction pipeline output
// ──────────────────────────────────────────────────────────────────

/** Result of the Avery extraction pipeline — pure, no side effects. */
export interface ExtractionResult {
  callerIntent: CallerIntent;
  matterType: MatterType;
  emotionalState: EmotionalState;
  urgencyLevel: UrgencyLevel;
  slots: Record<string, StateSlot>;
  confidenceScore: number;
  intakeSummary: string;
  riskFlags: string[];
  transferRecommended: boolean;
  missingRequiredFields: string[];
  turnCount: number;
}
