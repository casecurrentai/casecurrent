/**
 * Avery renderer — prepares LLM input from ConversationState and ResponsePlan.
 *
 * This module is a PREP layer only. It does not make LLM calls.
 * It produces a structured RenderPayload that any provider can consume.
 *
 * Separation of concerns:
 *   Planning (what to do next)     → planner/dialogue-planner.ts
 *   Rendering (how to encode it)   → this file
 *   Generation (actual LLM call)   → future server/routes/avery-live.ts
 *
 * The system prompt encodes: identity, stage context, style instructions,
 * constraints, guidance, and the specific next action.
 *
 * Reuses: ConversationState, ResponsePlan, MatterType, IntakeStage from types/index.ts
 */

import { ConversationState, ResponsePlan, MatterType, IntakeStage, RepairStrategy } from '../types';

// ──────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────

export interface RendererConfig {
  /** LLM model ID. Defaults to claude-sonnet-4-6. */
  model?: string;
  /** Temperature (0–1). Defaults to 0.3 for structured intake. */
  temperature?: number;
  /** Max output tokens. Defaults to 300 (short, focused responses). */
  maxTokens?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface RenderMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RenderPayload {
  model: string;
  systemPrompt: string;
  messages: RenderMessage[];
  tools: ToolDefinition[];
  temperature: number;
  maxTokens: number;
  stopSequences: string[];
  metadata: {
    conversationId: string;
    stage: IntakeStage;
    matterType: MatterType;
    urgencyLevel: string;
    repairStrategy: RepairStrategy | null;
    responsePlan: ResponsePlan;
  };
}

// ──────────────────────────────────────────────────────────────────
// Defaults
// ──────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 300;

// ──────────────────────────────────────────────────────────────────
// System prompt generation
// ──────────────────────────────────────────────────────────────────

function styleDescription(dimension: 'warmth' | 'pace' | 'directness', value: string): string {
  const map: Record<string, Record<string, string>> = {
    warmth: {
      low: 'professional and efficient tone',
      medium: 'warm and approachable tone',
      high: 'empathetic and supportive tone — lead with care',
    },
    pace: {
      fast: 'move quickly and efficiently — do not linger',
      medium: 'natural conversational pace',
      slow: 'speak slowly and clearly — give the caller time to process',
    },
    directness: {
      low: 'follow the caller\'s lead, soften transitions',
      medium: 'balanced — clear but not abrupt',
      high: 'direct and concise — lead the conversation forward',
    },
  };
  return map[dimension]?.[value] ?? value;
}

function buildSystemPrompt(state: ConversationState, plan: ResponsePlan): string {
  const { agentMode, matterType, intakeStage, callerName, urgencyLevel, conversationId } = state;

  const identity =
    agentMode === 'demo'
      ? [
          'You are Avery, an AI intake specialist for CaseCurrent.',
          'This is a product demonstration. Explain how CaseCurrent helps law firms with legal intake,',
          'answer questions about the product, and collect contact information for a follow-up.',
        ].join(' ')
      : [
          'You are Avery, a professional legal intake specialist.',
          'Your role is to gather information about a potential legal matter and route the caller',
          'to the right attorney. You are warm, professional, and thorough.',
          'You do not provide legal advice or predict outcomes.',
        ].join(' ');

  const styleLines = [
    `Warmth: ${plan.style.warmth} — ${styleDescription('warmth', plan.style.warmth)}`,
    `Pace: ${plan.style.pace} — ${styleDescription('pace', plan.style.pace)}`,
    `Directness: ${plan.style.directness} — ${styleDescription('directness', plan.style.directness)}`,
  ];

  const contextLines = [
    `Stage: ${intakeStage}`,
    `Matter: ${matterType !== 'unknown' ? matterType.replace(/_/g, ' ') : 'not yet identified'}`,
    `Urgency: ${urgencyLevel}`,
    callerName ? `Caller name: ${callerName}` : null,
    state.riskFlags.length > 0 ? `Risk flags: ${state.riskFlags.join(', ')}` : null,
  ].filter(Boolean);

  const constraintLines = plan.constraints.map((c) => `• ${c}`);
  const guidanceLines = plan.guidance.map((g) => `→ ${g}`);

  const nextActionSection = buildNextActionSection(plan);

  return [
    `# Avery Intake — Conversation ${conversationId}`,
    '',
    '## Identity',
    identity,
    '',
    '## Style',
    ...styleLines,
    '',
    '## Context',
    ...contextLines,
    '',
    '## Constraints',
    ...constraintLines,
    '',
    '## Guidance',
    ...(guidanceLines.length > 0 ? guidanceLines : ['→ Proceed naturally']),
    '',
    '## Next Action',
    ...nextActionSection,
  ].join('\n');
}

function buildNextActionSection(plan: ResponsePlan): string[] {
  if (plan.endConversation) {
    return ['Wrap up the conversation warmly. Thank the caller for their time.'];
  }

  if (plan.transferTarget) {
    return [
      `Transfer this caller to: ${plan.transferTarget}`,
      'Warm-transfer: briefly explain what the next person will help them with.',
    ];
  }

  const lines: string[] = [];

  if (plan.acknowledge) {
    lines.push(`First acknowledge: "${plan.acknowledge}"`);
  }
  if (plan.summarize) {
    lines.push(`Then summarize: "${plan.summarize}"`);
  }
  if (plan.askFor) {
    lines.push(`Then ask: "${plan.askFor}"`);
  }

  return lines.length > 0 ? lines : ['Continue the intake naturally.'];
}

// ──────────────────────────────────────────────────────────────────
// Message window (last known exchange)
// ──────────────────────────────────────────────────────────────────

function buildMessageWindow(state: ConversationState): RenderMessage[] {
  const messages: RenderMessage[] = [];

  // Include the most recent exchange as conversational context
  if (state.lastAssistantUtterance) {
    messages.push({ role: 'assistant', content: state.lastAssistantUtterance });
  }
  if (state.lastUserUtterance) {
    messages.push({ role: 'user', content: state.lastUserUtterance });
  }

  // Future: accept a full NormalizedTranscriptEntry[] array and window it

  return messages;
}

// ──────────────────────────────────────────────────────────────────
// Available tools (conditionally included by stage)
// ──────────────────────────────────────────────────────────────────

const ALL_TOOLS: Record<string, ToolDefinition> = {
  save_intake: {
    name: 'save_intake_data',
    description: 'Save collected intake information to the caller\'s lead record',
    parameters: {
      type: 'object',
      properties: {
        callerName: { type: 'string', description: 'Full name of the caller' },
        callbackNumber: { type: 'string', description: 'E.164 phone number' },
        email: { type: 'string', description: 'Email address' },
        matterSummary: { type: 'string', description: 'Brief description of the matter' },
        incidentDate: { type: 'string', description: 'Date of the incident' },
        urgencyNotes: { type: 'string', description: 'Deadlines or court dates mentioned' },
      },
    },
  },
  schedule: {
    name: 'schedule_consultation',
    description: 'Schedule a free consultation with an attorney',
    parameters: {
      type: 'object',
      required: ['callerName', 'callbackNumber'],
      properties: {
        callerName: { type: 'string' },
        callbackNumber: { type: 'string' },
        preferredTime: { type: 'string', description: 'Caller\'s preferred time or "flexible"' },
        matterType: { type: 'string' },
      },
    },
  },
  transfer: {
    name: 'transfer_to_staff',
    description: 'Transfer or route the caller to a staff member or attorney',
    parameters: {
      type: 'object',
      required: ['reason'],
      properties: {
        reason: { type: 'string', description: 'Why this transfer is needed' },
        targetRole: {
          type: 'string',
          enum: ['attorney', 'staff', 'case_manager'],
          description: 'Who should receive the transfer',
        },
        urgency: {
          type: 'string',
          enum: ['immediate', 'recommended', 'suggested'],
        },
      },
    },
  },
};

function selectTools(state: ConversationState): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  const { intakeStage, urgencyLevel } = state;

  // Save intake data during collection stages
  if (intakeStage === 'fact_collection' || intakeStage === 'contact_capture') {
    tools.push(ALL_TOOLS['save_intake']);
  }

  // Transfer and scheduling at terminal stages or high urgency
  if (
    intakeStage === 'appointment_or_transfer' ||
    urgencyLevel === 'critical' ||
    urgencyLevel === 'high'
  ) {
    tools.push(ALL_TOOLS['schedule']);
    tools.push(ALL_TOOLS['transfer']);
  }

  return tools;
}

// ──────────────────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────────────────

/**
 * Prepare a render payload for Avery's LLM response generation.
 *
 * @param state  - Current conversation state
 * @param plan   - ResponsePlan from the dialogue planner
 * @param config - Optional runtime configuration overrides
 */
export function prepareRenderPayload(
  state: ConversationState,
  plan: ResponsePlan,
  config: RendererConfig = {},
): RenderPayload {
  return {
    model: config.model ?? DEFAULT_MODEL,
    systemPrompt: buildSystemPrompt(state, plan),
    messages: buildMessageWindow(state),
    tools: selectTools(state),
    temperature: config.temperature ?? DEFAULT_TEMPERATURE,
    maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
    stopSequences: ['Human:', 'Caller:'],
    metadata: {
      conversationId: state.conversationId,
      stage: state.intakeStage,
      matterType: state.matterType,
      urgencyLevel: state.urgencyLevel,
      repairStrategy: state.repairStrategy,
      responsePlan: plan,
    },
  };
}
