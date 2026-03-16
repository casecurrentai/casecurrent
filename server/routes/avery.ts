/**
 * Avery live-turn endpoint — closes the runtime loop.
 *
 * POST /v1/avery/turn
 *   Executes one full Avery turn cycle:
 *     1. Initialize or load session state
 *     2. Apply caller utterance to state (applyTurnToState)
 *     3. Generate response plan (generateResponsePlan)
 *     4. Prepare render payload (prepareRenderPayload)
 *     5. Call LLM to generate Avery's response
 *     6. Record assistant turn metadata (recordAssistantTurn)
 *     7. Persist state, return response
 *
 * POST /v1/avery/session/:conversationId
 *   Initialize a new session (before the first turn).
 *
 * GET /v1/avery/session/:conversationId
 *   Return current state snapshot for debugging.
 *
 * Session storage: in-memory Map with 2-hour TTL.
 * TODO: replace with DB-backed session store for multi-instance deployments.
 *
 * LLM priority:
 *   1. Anthropic Claude (ANTHROPIC_API_KEY)
 *   2. OpenAI (OPENAI_API_KEY)
 *   3. Rule-based fallback (plan.askFor text directly)
 */

import { Router } from 'express';
import { initializeConversationState } from '../avery/state/conversation-state';
import { applyTurnToState, recordAssistantTurn } from '../avery/state/state-updater';
import { generateResponsePlan } from '../avery/planner/dialogue-planner';
import { prepareRenderPayload, type RenderPayload } from '../avery/llm/avery-renderer';
import type { ConversationState } from '../avery/types';

const router = Router();

// ──────────────────────────────────────────────────────────────────
// In-memory session store
// ──────────────────────────────────────────────────────────────────

interface SessionEntry {
  state: ConversationState;
  lastAccessedAt: number;
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const sessions = new Map<string, SessionEntry>();

function getSession(conversationId: string): ConversationState | null {
  const entry = sessions.get(conversationId);
  if (!entry) return null;
  if (Date.now() - entry.lastAccessedAt > SESSION_TTL_MS) {
    sessions.delete(conversationId);
    return null;
  }
  return entry.state;
}

function setSession(state: ConversationState): void {
  sessions.set(state.conversationId, {
    state,
    lastAccessedAt: Date.now(),
  });
}

// ──────────────────────────────────────────────────────────────────
// LLM call helper
// ──────────────────────────────────────────────────────────────────

/**
 * Execute an LLM call using the prepared RenderPayload.
 *
 * Priority: Anthropic → OpenAI → rule-based fallback (plan.askFor).
 */
async function callLLMWithPayload(
  payload: RenderPayload,
  fallbackText: string,
): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // ── 1. Anthropic (primary — matches renderer design) ──────────
  if (anthropicKey) {
    try {
      const body = {
        model: payload.model,
        max_tokens: payload.maxTokens,
        temperature: payload.temperature,
        system: payload.systemPrompt,
        messages: payload.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        throw new Error(`Anthropic API error: ${resp.status}`);
      }

      const data = await resp.json() as {
        content?: { type: string; text: string }[];
      };
      const text = data.content?.find((c) => c.type === 'text')?.text;
      if (text) return text.trim();
      throw new Error('Empty content in Anthropic response');
    } catch (err) {
      console.error('[Avery/LLM] Anthropic error, falling through:', (err as Error).message);
    }
  }

  // ── 2. OpenAI fallback ─────────────────────────────────────────
  if (openaiKey) {
    try {
      const messages = [
        { role: 'system', content: payload.systemPrompt },
        ...payload.messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: payload.maxTokens,
          temperature: payload.temperature,
        }),
      });

      if (!resp.ok) throw new Error(`OpenAI error: ${resp.status}`);
      const data = await resp.json() as {
        choices?: { message?: { content?: string } }[];
      };
      const text = data.choices?.[0]?.message?.content;
      if (text) return text.trim();
      throw new Error('Empty content in OpenAI response');
    } catch (err) {
      console.error('[Avery/LLM] OpenAI error, falling through:', (err as Error).message);
    }
  }

  // ── 3. Rule-based fallback ────────────────────────────────────
  console.warn('[Avery/LLM] No LLM configured — using plan fallback text');
  return fallbackText;
}

// ──────────────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────────────

/**
 * POST /v1/avery/session
 * Initialize a new Avery session before the first turn.
 */
router.post('/v1/avery/session', (req, res) => {
  const { conversationId, callId, agentMode, callerPhone, language } = req.body ?? {};

  if (!conversationId || typeof conversationId !== 'string') {
    return res.status(400).json({ error: 'conversationId required' });
  }

  if (sessions.has(conversationId)) {
    return res.status(409).json({ error: 'Session already exists', conversationId });
  }

  const state = initializeConversationState({
    conversationId,
    callId: callId ?? null,
    agentMode: agentMode === 'demo' ? 'demo' : 'production',
    callerPhone: callerPhone ?? null,
    language: language ?? 'en',
  });

  setSession(state);
  res.status(201).json({ conversationId, stage: state.intakeStage, created: true });
});

/**
 * GET /v1/avery/session/:conversationId
 * Return current state for debugging. Not for production client use.
 */
router.get('/v1/avery/session/:conversationId', (req, res) => {
  const state = getSession(req.params.conversationId);
  if (!state) return res.status(404).json({ error: 'Session not found or expired' });
  res.json({ conversationId: state.conversationId, state });
});

/**
 * POST /v1/avery/turn
 * Execute one full Avery turn.
 */
router.post('/v1/avery/turn', async (req, res) => {
  const {
    conversationId,
    utterance,
    isSilence,
    isInterruption,
    init,
  } = req.body ?? {};

  if (!conversationId || typeof conversationId !== 'string') {
    return res.status(400).json({ error: 'conversationId required' });
  }

  // Resolve or initialize state
  let state = getSession(conversationId);

  if (!state) {
    if (init) {
      // Auto-initialize on first turn if init params are provided
      state = initializeConversationState({
        conversationId,
        callId: init.callId ?? null,
        agentMode: init.agentMode === 'demo' ? 'demo' : 'production',
        callerPhone: init.callerPhone ?? null,
        language: init.language ?? 'en',
      });
    } else {
      return res.status(404).json({ error: 'Session not found. POST /v1/avery/session first, or include init params.' });
    }
  }

  if (typeof utterance !== 'string' && !isSilence) {
    return res.status(400).json({ error: 'utterance required (or set isSilence: true)' });
  }

  try {
    // ── Step 1: Apply caller turn to state ──────────────────────
    const updatedState = applyTurnToState(state, {
      utterance: utterance ?? '',
      isSilence: isSilence === true,
      isInterruption: isInterruption === true,
    });

    // ── Step 2: Generate response plan ──────────────────────────
    const plannerResult = generateResponsePlan(updatedState);

    // ── Step 3: Prepare LLM render payload ──────────────────────
    const renderPayload = prepareRenderPayload(updatedState, plannerResult.plan);

    // ── Step 4: Determine fallback text (rule-based) ─────────────
    const fallbackText =
      plannerResult.plan.askFor ??
      plannerResult.plan.acknowledge ??
      'Let me ask you a few questions to help connect you with the right attorney.';

    // ── Step 5: Call LLM ─────────────────────────────────────────
    const responseText = await callLLMWithPayload(renderPayload, fallbackText);

    // ── Step 6: Record assistant turn metadata ───────────────────
    const questionAsked =
      plannerResult.plan.collectSlots[0] ??
      (plannerResult.decision.type !== 'escalate' && plannerResult.decision.type !== 'complete'
        ? plannerResult.decision.targetField
        : null) ??
      null;

    const confirmationTarget =
      plannerResult.plan.confirmationTarget ??
      (plannerResult.decision.type === 'confirm' ? plannerResult.decision.targetField : null) ??
      null;

    const finalState = recordAssistantTurn(updatedState, {
      utterance: responseText,
      questionAsked,
      decisionType: plannerResult.decision.type,
      confirmationTarget,
      assistantMode: plannerResult.plan.responsePolicy?.mode ?? null,
    });

    // ── Step 7: Persist state ────────────────────────────────────
    setSession(finalState);

    // ── Step 8: Respond ──────────────────────────────────────────
    res.json({
      conversationId,
      response: responseText,
      readiness: plannerResult.readiness,
      stage: finalState.intakeStage,
      phase: finalState.conversationPhase,
      decisionType: plannerResult.decision.type,
      escalate: plannerResult.escalate,
      transferTarget: plannerResult.transferTarget,
      turnCount: finalState.turnCount,
      debug: process.env.NODE_ENV !== 'production' ? plannerResult.debugInfo : undefined,
    });
  } catch (err) {
    console.error('[Avery/Turn] error:', (err as Error).message);
    res.status(500).json({ error: 'Turn processing failed' });
  }
});

export default router;
