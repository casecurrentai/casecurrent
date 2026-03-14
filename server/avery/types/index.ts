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

// ── 3C additions ──────────────────────────────────────────────────

/** Per-field confidence status derived from score and context signals. */
export type StateSlotStatus =
  | "confirmed"    // score ≥ 0.80 — direct, unambiguous answer
  | "likely"       // score ≥ 0.60 — plausible but not verified
  | "ambiguous"    // score < 0.60 — vague, hedged, or uncertain
  | "conflicting"  // contradicts a prior value with meaningful confidence
  | "missing";     // no value extracted

/**
 * Readiness of the current intake for handoff or callback.
 * Distinct from escalation (which is policy-driven).
 */
export type IntakeReadiness =
  | "incomplete"           // required fields still missing
  | "minimum_viable_intake" // contactable + enough to route — caller can be called back
  | "ready_for_handoff"    // all required fields captured
  | "completed";           // conversation wrapped up

/**
 * Structured decision from nextQuestionSelector — drives ResponsePlan generation.
 * This is the contract between the selector and the plan builder.
 */
export interface NextQuestionDecision {
  /** The high-level action type for this turn. */
  type: "ask" | "repair" | "confirm" | "escalate" | "complete";
  /** Slot/field being targeted, or null for stage-level actions. */
  targetField?: string | null;
  /** Machine-readable objective (e.g. "collect_field:caller_name"). */
  objective: string;
  /** Debug rationale explaining why this decision was made. */
  rationale: string;
  /** Active repair strategy when type is "repair". */
  repairStrategy?: RepairStrategy | null;
}

// ── 3D additions ──────────────────────────────────────────────────

/**
 * Meta-lifecycle phase overlaying IntakeStage.
 * Distinguishes repair and confirmation meta-states that IntakeStage doesn't capture.
 */
export type ConversationPhase =
  | "greeting"
  | "intent_detection"
  | "active_intake"
  | "clarification"       // repair / re-ask in progress
  | "confirmation"        // awaiting caller confirmation of ambiguous/conflicting data
  | "ready_for_escalation"
  | "completed";

/** Tactical repair type for question reformulation. */
export type RepairTriggerType =
  | "none"
  | "rephrase"
  | "narrow_question"
  | "confirm_value"
  | "split_question"
  | "provide_example"
  | "defer_optional_field";

/** Resolution action when updating a field with a potentially conflicting value. */
export type FieldUpdateAction =
  | "accept_new_value"
  | "retain_existing_value"
  | "mark_conflict_require_confirmation"
  | "downgrade_confidence";

// ── 3E additions ──────────────────────────────────────────────────

/**
 * How a field value was derived — used to weight confidence and control merging.
 * direct_answer  — caller explicitly answered the question asked for this field
 * volunteered    — caller mentioned this without being asked
 * correction     — caller explicitly correcting a prior value
 * confirmation   — caller confirmed an existing value (yes/that's right)
 * inferred       — deduced indirectly, low confidence
 */
export type EvidenceType =
  | "direct_answer"
  | "volunteered"
  | "correction"
  | "confirmation"
  | "inferred";

/** A proposed field update from a single turn — reviewed before state mutation. */
export interface ExtractedFieldProposal {
  fieldKey: string;
  rawValue: unknown;
  normalizedValue: unknown;
  /** Turn number this proposal originated from. */
  sourceTurn: number;
  evidenceType: EvidenceType;
  confidenceScore: number;
  /** True when this proposal should be written directly to state. */
  shouldApplyDirectly: boolean;
  /** True when the field needs caller confirmation before being trusted. */
  requiresConfirmation: boolean;
}

/**
 * Structured interpretation of a single caller turn, produced BEFORE state mutation.
 * Describes what the caller did rather than what data was extracted.
 */
export interface TurnInterpretation {
  /** Whether the caller's response addressed the last question asked. */
  answeredLastQuestion: boolean;
  /** The field being targeted by the last question (null for stage-level). */
  targetField: string | null;
  /** Qualitative assessment of the answer. */
  answerQuality: "direct" | "partial" | "ambiguous" | "nonresponsive" | "correction" | "confirmation";
  /** Proposed field extractions from this turn. */
  detectedFields: ExtractedFieldProposal[];
  /** Affirmation signals detected in this turn. */
  affirmations: { yes: boolean; no: boolean; uncertain: boolean };
  /** True when explicit correction language was detected. */
  correctionSignals: boolean;
  /** True when distress signals detected. */
  distressSignals: boolean;
  /** True when turn appears to contain no relevant intake content. */
  irrelevantContent: boolean;
  /** Debug notes. */
  notes: string[];
}

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
  /** 3C: Field-level confidence status derived from score + context. */
  status?: StateSlotStatus;
  /** 3D: True when this field must be explicitly re-confirmed by the caller. */
  needsConfirmation?: boolean;
  /** 3D: True when this field contradicts a prior high-confidence value. */
  conflictFlag?: boolean;
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
  /** 3C: The slot key most recently asked about, for repair-mode detection. */
  lastQuestionAsked?: string | null;
  /** 3C: Intake readiness evaluated after each turn. */
  readiness?: IntakeReadiness;
  /** 3D: Meta-lifecycle phase (overlay on intakeStage). */
  conversationPhase?: ConversationPhase;
  /** 3D: Priority-ordered fields awaiting explicit caller confirmation. */
  confirmationQueue: string[];
  /** 3D: Required fields with a value but confidence below the handoff threshold. */
  lowConfidenceRequiredFields: string[];
  /** 3D: Required fields flagged as conflicting (contradictory data). */
  conflictingRequiredFields: string[];
  /** 3D: Optional fields from intake requirements not yet captured. */
  optionalFieldsRemaining: string[];
  /** 3E: Structured interpretation of the most recent caller turn. */
  lastTurnInterpretation?: TurnInterpretation;
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
  /** 3C: Field being confirmed when decision type is "confirm". */
  confirmationTarget?: string;
  /** 3C: True when intake is sufficient for handoff or completed. */
  escalationReady?: boolean;
  /** 3C: Human-readable notes about field confidence issues. */
  confidenceNotes?: string[];
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
