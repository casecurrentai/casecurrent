import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { createHmac } from 'crypto';
import { generateVoicePromptInstructions } from '../../voice/DisfluencyController';

const OPENAI_REALTIME_URL =
  'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';
const TOKEN_MAX_AGE_SECONDS = 600;
const LOG_FRAME_INTERVAL = 100;
const START_TIMEOUT_MS = 5000;

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
  let openAiFrameCount = 0;
  let callSid: string | null = null;
  let responseInProgress = false;
  let speechStartTime: number | null = null;

  const secret = process.env.STREAM_TOKEN_SECRET;

  const startTimeout = setTimeout(() => {
    if (!authenticated) {
      console.log(JSON.stringify({ event: 'ws_close', requestId, code: 1008, reason: 'No start event received' }));
      twilioWs.close(1008, 'No start event received');
    }
  }, START_TIMEOUT_MS);

  const maskCallSid = (sid: string | null) => sid ? `****${sid.slice(-8)}` : null;

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
      console.log('[PROMPT_ACTIVE] using AVERY_INLINE_PROMPT (streamHandler.ts)');

      const sessionUpdate = {
        type: 'session.update',
        session: {
          modalities: ['audio', 'text'],
          instructions: `YOU ARE AVERY — THE FIRM'S VIRTUAL ASSISTANT (LEGAL INTAKE)

Identity & scope
- You are Avery, the firm's virtual assistant for legal intake.
- Your job is to welcome callers, gather accurate intake details efficiently, and route the matter to the firm.
- You are not a lawyer and you do not provide legal advice.
- Never claim to be human, a paralegal, or an attorney.

Voice & presence (Gentle Advocate baseline)
- Always warm, steady, and reassuring. Calm confidence. "I've got you" energy.
- Short sentences. One question at a time. No jargon.
- Be proactive: lead with clear questions and gentle structure.
- If the caller is upset, acknowledge briefly (1 sentence), stabilize (1 sentence), then continue intake (next question).
- Keep everything easy and light without minimizing the situation.

Opening (verbatim)
1) "I'm Avery, the firm's virtual assistant."
2) "Is this for a new case today, or are you already a client of the firm?"

If NEW CASE (standard flow)
A) Contact safety capture: "In case we get cut off, what's the best callback number and email?"
B) Name: "Great. Can I get your first and last name?"
C) Quick summary: "Thanks—briefly, what happened, and when did it happen?"
D) Timeline: "Got it. Walk me through what happened step-by-step, starting right before the incident."

Core qualifiers (ask only what fits the matter; keep it clean)
- Where did it happen? (city/state)
- Who was involved? (other party, business, agency)
- Injuries/damages? Any medical treatment? (if injury-related)
- Police report? (if incident-related)
- Insurance involved? Claim number? (if relevant)
- Any deadlines/court dates? (if urgency cues)

RECAP: "Here's what I have so far: [timeline in 1–2 sentences]. If anything's off, correct me—otherwise I'll send this to the team now."

CLOSING: "Thank you. I'm sending this to the team now."

Hard rules
- No legal advice, predictions, guarantees, or strategy.
- If asked for legal advice: "I can't advise on that, but I can collect details and schedule a consultation."
- If emergency/immediate danger: "Call 911." Do not continue intake until safe.
${generateVoicePromptInstructions()}`,
          voice: 'marin',
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
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
                modalities: ['audio', 'text'],
                instructions: 'Greet the caller warmly and ask how you can help them today with their legal matter.',
              },
            }));
          }
        } else if (message.type === 'response.created') {
          responseInProgress = true;
        } else if (message.type === 'response.done') {
          responseInProgress = false;
        } else if (message.type === 'input_audio_buffer.speech_stopped') {
          speechStartTime = null;
          if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          }
        } else if (message.type === 'response.audio.delta' || message.type === 'response.output_audio.delta') {
          const audioBase64 = message.delta;
          if (audioBase64 && streamSid && twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.send(JSON.stringify({ event: 'media', streamSid, media: { payload: audioBase64 } }));
            openAiFrameCount++;
            if (openAiFrameCount % LOG_FRAME_INTERVAL === 0) {
              console.log(JSON.stringify({ event: 'audio_to_twilio', requestId, frames: openAiFrameCount }));
            }
          }
        } else if (message.type === 'input_audio_buffer.speech_started') {
          speechStartTime = Date.now();
          if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
          }
          if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.send(JSON.stringify({ type: 'response.cancel' }));
          }
        } else if (message.type === 'response.audio_transcript.done') {
          console.log(JSON.stringify({ event: 'ai_transcript', requestId, text: message.transcript?.substring(0, 80) }));
        } else if (message.type === 'conversation.item.input_audio_transcription.completed') {
          console.log(JSON.stringify({ event: 'user_transcript', requestId, text: message.transcript?.substring(0, 80) }));
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
        console.log(JSON.stringify({ 
          event: 'twilio_start', 
          requestId, 
          callSid: maskCallSid(callSid),
          paramKeys: Object.keys(customParams || {}),
        }));

        if (!validateAuth(customParams)) {
          console.log(JSON.stringify({ event: 'ws_close', requestId, callSid: maskCallSid(callSid), code: 1008, reason: 'Unauthorized' }));
          twilioWs.close(1008, 'Unauthorized');
          return;
        }

        authenticated = true;
        console.log(JSON.stringify({ event: 'stream_authenticated', requestId, callSid: maskCallSid(callSid) }));
        
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
          } else {
            pendingTwilioAudio.push(audioPayload);
          }
        }
      } else if (message.event === 'mark') {
        // Mark event - no action needed
      } else if (message.event === 'stop') {
        console.log(JSON.stringify({ event: 'twilio_stop', requestId, callSid: maskCallSid(callSid) }));
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
      openAiFrameCount,
    }));
    
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
