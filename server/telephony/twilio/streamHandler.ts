import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { createHmac } from 'crypto';
import { generateVoicePromptInstructions } from '../../voice/DisfluencyController';
import { streamTTS, logTTSConfig, isTTSAvailable } from '../../tts/elevenlabs';
import { prisma } from '../../db';

// Phone number masking for logs
function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '(none)';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return '****' + digits.slice(-4);
}

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
  let ttsFrameCount = 0;
  let callSid: string | null = null;
  let responseInProgress = false;
  let speechStartTime: number | null = null;

  // ElevenLabs TTS state
  let pendingText = '';
  let currentResponseId: string | null = null;
  let lastSpokenResponseId: string | null = null;
  let ttsAbortController: AbortController | null = null;
  let ttsSpeaking = false;

  const secret = process.env.STREAM_TOKEN_SECRET;

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
      }
    } finally {
      clearTimeout(timeoutId);
      ttsSpeaking = false;
      ttsAbortController = null;
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
                instructions: 'Greet the caller warmly and ask how you can help them today with their legal matter.',
              },
            }));
          }
        } else if (message.type === 'response.created') {
          responseInProgress = true;
          // Track response ID for text buffering
          currentResponseId = message.response?.id || null;
          pendingText = '';  // Reset text buffer for new response
          console.log(JSON.stringify({ event: 'response_started', requestId, responseId: currentResponseId }));
        } else if (message.type === 'response.text.delta' || message.type === 'response.output_text.delta' || message.type === 'response.content_part.delta') {
          // Accumulate text deltas for TTS
          const textDelta = message.delta?.text || message.delta || '';
          if (textDelta) {
            pendingText += textDelta;
          }
        } else if (message.type === 'response.done') {
          responseInProgress = false;
          const responseId = message.response?.id || currentResponseId;
          
          // Speak the accumulated text via ElevenLabs TTS
          if (pendingText && pendingText.trim() && responseId !== lastSpokenResponseId) {
            lastSpokenResponseId = responseId;
            const textToSpeak = pendingText.trim();
            pendingText = '';
            
            console.log(JSON.stringify({ 
              event: 'tts_trigger', 
              requestId, 
              responseId,
              text_length: textToSpeak.length,
              text_preview: textToSpeak.substring(0, 80),
            }));
            
            // Speak via ElevenLabs TTS (async, don't await)
            speakElevenLabs(textToSpeak, responseId).catch((err) => {
              console.error(JSON.stringify({ event: 'tts_speak_error', requestId, error: err.message }));
            });
          } else {
            pendingText = '';
          }
        } else if (message.type === 'input_audio_buffer.speech_stopped') {
          speechStartTime = null;
          if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          }
        } else if (message.type === 'input_audio_buffer.speech_started') {
          // BARGE-IN: Caller started speaking - interrupt everything
          speechStartTime = Date.now();
          console.log(JSON.stringify({ event: 'barge_in', requestId, ttsSpeaking }));
          
          // 1. Clear Twilio audio buffer
          if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
          }
          // 2. Cancel OpenAI response
          if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.send(JSON.stringify({ type: 'response.cancel' }));
          }
          // 3. Abort ElevenLabs TTS
          if (ttsAbortController) {
            ttsAbortController.abort();
            ttsAbortController = null;
          }
          // 4. Clear pending text buffer
          pendingText = '';
          currentResponseId = null;
          ttsSpeaking = false;
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
        (async () => {
          try {
            // Resolve orgId and phoneNumberId from customParameters or lookup by phone number
            let orgId = paramOrgId;
            let phoneNumberId = paramPhoneNumberId;
            
            if (!orgId && paramTo) {
              // Normalize to E.164 and lookup
              const digitsOnly = paramTo.replace(/\D/g, '');
              const candidates: string[] = [paramTo];
              if (digitsOnly) candidates.push('+' + digitsOnly);
              if (digitsOnly.length === 10) candidates.push('+1' + digitsOnly);
              
              const phoneNumber = await prisma.phoneNumber.findFirst({
                where: { e164: { in: candidates }, inboundEnabled: true },
              });
              
              if (phoneNumber) {
                orgId = phoneNumber.orgId;
                phoneNumberId = phoneNumber.id; // Capture phoneNumberId from lookup
                console.log(JSON.stringify({ 
                  tag: '[TENANT_HIT]', 
                  requestId, 
                  orgId, 
                  phoneNumberId: phoneNumber.id,
                  to: maskPhone(paramTo),
                }));
              } else {
                console.log(JSON.stringify({ 
                  tag: '[TENANT_MISS]', 
                  requestId, 
                  to: maskPhone(paramTo),
                  candidates: candidates.length,
                }));
              }
            } else if (orgId) {
              console.log(JSON.stringify({ 
                tag: '[TENANT_HIT]', 
                requestId, 
                orgId,
                phoneNumberId,
                source: 'customParameters',
              }));
            }
            
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
            
            // Find or create contact for the caller
            let contact = null;
            if (fromE164) {
              contact = await prisma.contact.findFirst({
                where: { orgId, primaryPhone: fromE164 },
              });
              
              if (!contact) {
                contact = await prisma.contact.create({
                  data: {
                    orgId,
                    primaryPhone: fromE164,
                    name: 'Unknown Caller',
                  },
                });
              }
            } else {
              // Create a placeholder contact if no phone
              contact = await prisma.contact.create({
                data: {
                  orgId,
                  name: 'Unknown Caller',
                },
              });
            }
            
            // Create lead with status in_progress
            const lead = await prisma.lead.create({
              data: {
                orgId,
                contactId: contact.id,
                status: 'in_progress',
                source: 'phone',
                summary: `Inbound call from ${maskPhone(paramFrom)}`,
              },
            });
            
            // Create interaction for the call
            const interaction = await prisma.interaction.create({
              data: {
                orgId,
                leadId: lead.id,
                channel: 'call',
                status: 'active',
                startedAt: new Date(),
              },
            });
            
            // Create call record if we have phoneNumberId
            if (phoneNumberId && toE164) {
              await prisma.call.create({
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
            
            console.log(JSON.stringify({ 
              tag: '[LEAD_CREATED]', 
              requestId, 
              leadId: lead.id,
              orgId,
              contactId: contact?.id || null,
              callSid: maskCallSid(callSid),
            }));
          } catch (err: any) {
            console.error(JSON.stringify({ 
              event: 'lead_creation_error', 
              requestId, 
              error: err?.message || String(err),
            }));
          }
        })();
        
        // Log TTS configuration for diagnostics
        logTTSConfig();
        
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
      ttsFrameCount,
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
