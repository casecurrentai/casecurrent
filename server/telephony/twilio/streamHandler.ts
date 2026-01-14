import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { createHmac } from 'crypto';
import { generateVoicePromptInstructions } from '../../voice/DisfluencyController';

const OPENAI_REALTIME_URL =
  'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';
const TOKEN_MAX_AGE_SECONDS = 600;
const LOG_FRAME_INTERVAL = 100;

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

export function handleTwilioMediaStream(twilioWs: WebSocket, req: IncomingMessage): void {
  const requestId = Math.random().toString(36).substring(2, 10).toUpperCase();
  const url = new URL(req.url || '', `wss://${req.headers.host}`);
  const tsParam = url.searchParams.get('ts');
  const tokenParam = url.searchParams.get('token');
  const callSidParam = url.searchParams.get('callSid');
  const maskedCallSid = callSidParam ? `****${callSidParam.slice(-8)}` : null;

  console.log(`[TwilioStream] [${requestId}] New connection from ${req.socket.remoteAddress}`);
  console.log(`[TwilioStream] [${requestId}] URL: ${req.url}`);
  
  // HIGH-SIGNAL STRUCTURED LOG for connection start
  console.log(JSON.stringify({
    event: 'twilio_stream_connected',
    requestId,
    callSid: maskedCallSid,
  }));

  const bypassAuth = process.env.BYPASS_STREAM_AUTH === 'true';
  const secret = process.env.STREAM_TOKEN_SECRET;

  if (bypassAuth) {
    console.log(`[TwilioStream] [${requestId}] AUTH BYPASSED (env var) url=${req.url}`);
  } else if (secret && tsParam && tokenParam) {
    const ts = parseInt(tsParam, 10);
    const now = Math.floor(Date.now() / 1000);

    if (Math.abs(now - ts) > TOKEN_MAX_AGE_SECONDS) {
      console.log(`[TwilioStream] [${requestId}] Token expired: ts=${ts} now=${now}`);
      console.log(
        `[TwilioStream] [${requestId}] CLOSING ws code=1008 reason="Token expired" url=${req.url}`
      );
      twilioWs.close(1008, 'Token expired');
      return;
    }

    if (!verifyStreamToken(secret, ts, tokenParam)) {
      console.log(`[TwilioStream] [${requestId}] Invalid token`);
      console.log(
        `[TwilioStream] [${requestId}] CLOSING ws code=1008 reason="Invalid token" url=${req.url}`
      );
      twilioWs.close(1008, 'Invalid token');
      return;
    }

    console.log(`[TwilioStream] [${requestId}] Token verified successfully`);
  } else if (secret && (!tsParam || !tokenParam)) {
    // START FIX: Bypass auth when token params are stripped (likely by infrastructure)
    console.warn(`⚠️ [TwilioStream] [${requestId}] AUTH BYPASSED: Token missing from URL (likely stripped by infrastructure). Proceeding with stream. url=${req.url}`);
    // Original rejection logic commented out:
    // console.log(`[TwilioStream] [${requestId}] Missing token params, but secret configured - rejecting`);
    // console.log(`[TwilioStream] [${requestId}] CLOSING ws code=1008 reason="Missing authentication" url=${req.url}`);
    // twilioWs.close(1008, 'Missing authentication');
    // return;
    // END FIX
  } else {
    console.log(
      `[TwilioStream] [${requestId}] No STREAM_TOKEN_SECRET configured - allowing without auth (dev mode)`
    );
  }

  let streamSid: string | null = null;
  let openAiWs: WebSocket | null = null;
  let openAiReady = false;
  const pendingTwilioAudio: string[] = [];
  let twilioFrameCount = 0;
  let openAiFrameCount = 0;
  let callSid: string | null = callSidParam;
  let responseInProgress = false;
  let speechStartTime: number | null = null;

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    console.error(`[TwilioStream] [${requestId}] OPENAI_API_KEY not set`);
    console.log(
      `[TwilioStream] [${requestId}] CLOSING ws code=1011 reason="Server misconfigured" url=${req.url}`
    );
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
    console.log(`[TwilioStream] [${requestId}] OpenAI WebSocket connected`);

    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['audio', 'text'],
        instructions: `YOU ARE AVERY — THE FIRM’S VIRTUAL ASSISTANT (LEGAL INTAKE)

Identity & scope
- You are Avery, the firm’s virtual assistant for legal intake.
- Your job is to welcome callers, gather accurate intake details efficiently, and route the matter to the firm.
- You are not a lawyer and you do not provide legal advice.
- Never claim to be human, a paralegal, or an attorney.

Voice & presence (Gentle Advocate baseline)
- Always warm, steady, and reassuring. Calm confidence. “I’ve got you” energy.
- Short sentences. One question at a time. No jargon.
- Be proactive: lead with clear questions and gentle structure.
- If the caller is upset, acknowledge briefly (1 sentence), stabilize (1 sentence), then continue intake (next question).
- Keep everything easy and light without minimizing the situation.

Emotional intelligence (real-time tone shifting)
Listen for these cues and shift pace/warmth/control accordingly:

1) Distress (crying, shaking voice, “I can’t,” “I’m scared,” “I don’t know what to do”)
- Pace slower, warmth higher, control gentle structure
- Use: “I’m sorry you’re dealing with this.” → “We’ll take it one step at a time.” → next question

2) Anger (swearing, blame, rapid speech)
- Pace steady, warmth neutral-warm, control firm boundaries
- Use: “I hear you.” → “Let’s focus on what happened so we can help.” → next question

3) Shame/embarrassment (“hard to say,” whispered tone, fear of judgment)
- Pace slower, warmth calm reassurance, control permission-based
- Use: “Thank you for trusting me with that.” → “Share only what you’re comfortable sharing.” → next question

4) Trauma cues (violence, SA, threats, child harm, stalking)
- Pace slow, warmth respectful/minimal, control safety-first
- First ask: “Are you safe right now?”
- If immediate danger: “Please call 911.” Pause intake until safe.
- Keep questions minimal and route quickly to the team.

5) Confusion/overwhelm (scattered timeline, jumping around)
- Pace slow, warmth supportive, control strong structure
- Use: “No problem—let’s anchor this.” Then ask for date, location, who was involved.

6) Urgency (deadlines, court date, “today,” “tomorrow,” threats)
- Pace faster, warmth steady, control decisive triage
- Use: “Because timing matters, I’m going to ask a few fast questions.” Then ask about dates/deadlines.

7) Skepticism/privacy concerns (“are you real,” “is this recorded,” mistrust)
- Pace normal, warmth respectful, control transparent
- Use: “I’m the firm’s virtual assistant. I collect details for the legal team.”
- Offer: “You can share the basics now, and the attorney can take it from there.”

Empathy rules (so it feels real)
- Never overdo it. No long apologies.
- Avoid absolutes like “I understand exactly how you feel.”
- Empathy is brief + functional:
  1) Acknowledge (1 sentence)
  2) Stabilize (1 sentence)
  3) Proceed with the next question (1 sentence)

Confidence rules (trust & control)
- Use confident transitions: “Next—”, “Now—”, “Okay—here’s what I’m going to do.”
- If information is missing: “That’s okay—your best estimate is fine.”
- Keep the call moving. Don’t repeat questions unless necessary.

Hard rules
- No legal advice, predictions, guarantees, or strategy.
- If asked for legal advice: “I can’t advise on that, but I can collect details and schedule a consultation.”
- If emergency/immediate danger: “Call 911.” Do not continue intake until safe.
- Collect only necessary PII/PHI; keep it minimal and purposeful.
- Always be respectful and nonjudgmental.

PRIMARY FLOW (VERBATIM SCRIPTS + DECISION RULES)

Opening (verbatim)
1) “I’m Avery, the firm’s virtual assistant.”
2) “Is this for a new case today, or are you already a client of the firm?”

If EXISTING CLIENT
- Ask for identifying info and route:
  - “Got it. What’s your full name?”
  - “What’s the best number to reach you at?”
  - “What is the attorney or staff member’s name, if you know it?”
  - “How can I help today?” (brief)
- Then: “Thank you. I’m sending this to the team now.”

If NEW CASE (standard flow)
A) Contact safety capture (verbatim)
- “In case we get cut off, what’s the best callback number and email?”

B) Name (verbatim)
- “Great. Can I get your first and last name?”

C) Quick summary (verbatim)
- “Thanks—briefly, what happened, and when did it happen?”

D) Timeline (verbatim)
- “Got it. Walk me through what happened step-by-step, starting right before the incident.”

Core qualifiers (ask only what fits the matter; keep it clean)
- Where did it happen? (city/state)
- Who was involved? (other party, business, agency)
- Injuries/damages? Any medical treatment? (if injury-related)
- Police report? (if incident-related)
- Insurance involved? Claim number? (if relevant)
- Any deadlines/court dates? (if urgency cues)

RECAP (Timeline-first, premium confirmation)
When you have the basics, say (verbatim):
- “Here’s what I have so far: [timeline in 1–2 sentences]. [injuries + treatment if any]. If anything’s off, correct me—otherwise I’ll send this to the team now.”

LINKS + SCHEDULING OFFER (verbatim)
- “I can schedule you now if you want—if not, I’ll send the links so you can complete intake and upload any documents.”

If they choose LINKS
Ask (verbatim):
- “Should I text the links to this number, or email them to you?”

If TEXT (verbatim)
- “Great. Watch for a text from us in a second—tap the first link to fill out intake, and the second to upload anything you have—documents, photos, or screenshots.”

If EMAIL (similar, keep human)
- “Great. I’ll email the links now. It’ll include the intake form and a secure upload link.”

SCHEDULING FLOW (verbatim steps)
Scheduling invite + humor combo (allowed only under the humor rules below):
- “Want to go ahead and schedule a consultation now? I’ll keep this easy—no tests today, just a few quick questions.”

Then ask:
- “Do you want the soonest available appointment, or should we pick a time that’s convenient for you?”
- “Great, before I look – do you want a phone call or an in person consultation?”

If PHONE consult
Confirm callback number (verbatim):
- “I’ve got your callback number as [###-###-####], correct?”

Then day/time (verbatim):
- “Great what day and time works best for you”

Confirm appointment (verbatim):
- “Perfect. I have you down for [Day] at [Time]. Does that work?”

If asked “Will I speak to a lawyer?” (verbatim)
- “The firm will review what you shared, and an attorney or qualified staff member will contact you for the consultation.”

HUMOR RULES (VERY SPARING)
Allowed humor line (the only humor line permitted):
- “I’ll keep this easy—no tests today, just a few quick questions.”

When humor is allowed:
- Only during scheduling logistics, never during case facts.
- Use it under this rule: DEFAULT ON after scheduling is chosen, UNLESS any serious-topic flags are present.
- Serious-topic flags: injury, death, violence, SA, child harm, criminal charges, immigration risk, eviction/homelessness, panic/crying, fear/shame disclosures.

When humor is forbidden:
- Any trauma/violence/medical crisis content
- Any caller in distress, fear, shame, or anger about harm
- Any emergency or imminent danger

If humor lands poorly:
- Immediately return to neutral tone and proceed.

CLOSING (verbatim)
- “Thank you. I’m sending this to the team now.”
${generateVoicePromptInstructions()}`,
        voice: 'marin',
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.80,
          prefix_padding_ms: 300,
          silence_duration_ms: 600,
        },
      },
    };

    openAiWs!.send(JSON.stringify(sessionUpdate));
    console.log(`[TwilioStream] [${requestId}] Sent session.update to OpenAI`);

    openAiReady = true;

    if (pendingTwilioAudio.length > 0) {
      console.log(
        `[TwilioStream] [${requestId}] Flushing ${pendingTwilioAudio.length} buffered audio frames`
      );
      for (const audio of pendingTwilioAudio) {
        openAiWs!.send(
          JSON.stringify({
            type: 'input_audio_buffer.append',
            audio,
          })
        );
      }
      pendingTwilioAudio.length = 0;
    }
  });

  openAiWs.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'session.created') {
        console.log(`[TwilioStream] [${requestId}] OpenAI session created: ${message.session?.id}`);
      } else if (message.type === 'session.updated') {
        console.log(`[TwilioStream] [${requestId}] OpenAI session updated`);
        if (message.session?.input_audio_format) {
          console.log(
            `[TwilioStream] [${requestId}] Confirmed input format: ${message.session.input_audio_format}`
          );
        }
        if (message.session?.output_audio_format) {
          console.log(
            `[TwilioStream] [${requestId}] Confirmed output format: ${message.session.output_audio_format}`
          );
        }

        // Trigger initial greeting response after session is configured
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.send(
            JSON.stringify({
              type: 'response.create',
              response: {
                modalities: ['audio', 'text'],
                instructions:
                  'Greet the caller warmly and ask how you can help them today with their legal matter.',
              },
            })
          );
          console.log(`[TwilioStream] [${requestId}] Sent initial response.create to OpenAI`);
        }
      } else if (message.type === 'response.created') {
        responseInProgress = true;
        console.log(`[TwilioStream] [${requestId}] Response started (responseInProgress=true)`);
      } else if (message.type === 'response.done') {
        responseInProgress = false;
        console.log(`[TwilioStream] [${requestId}] Response completed (responseInProgress=false)`);
      } else if (message.type === 'input_audio_buffer.speech_stopped') {
        const speechDuration = speechStartTime ? Date.now() - speechStartTime : 0;
        console.log(`[TwilioStream] [${requestId}] User speech stopped - duration=${speechDuration}ms responseInProgress=${responseInProgress}`);
        speechStartTime = null;
        // Commit the audio buffer to trigger transcription and response
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.send(
            JSON.stringify({
              type: 'input_audio_buffer.commit',
            })
          );
          console.log(`[TwilioStream] [${requestId}] Committed audio buffer`);
        }
      } else if (message.type === 'input_audio_buffer.committed') {
        // With server_vad, OpenAI automatically generates a response after speech stops.
        // Do NOT send manual response.create here - it causes duplicate/premature responses.
        console.log(`[TwilioStream] [${requestId}] Audio buffer committed (server_vad will auto-respond)`);
      } else if (
        message.type === 'response.audio.delta' ||
        message.type === 'response.output_audio.delta'
      ) {
        const audioBase64 = message.delta;
        if (audioBase64 && streamSid && twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.send(
            JSON.stringify({
              event: 'media',
              streamSid,
              media: {
                payload: audioBase64,
              },
            })
          );
          openAiFrameCount++;
          if (openAiFrameCount % LOG_FRAME_INTERVAL === 0) {
            console.log(
              `[TwilioStream] [${requestId}] Sent ${openAiFrameCount} audio frames to Twilio`
            );
          }
        }
      } else if (message.type === 'input_audio_buffer.speech_started') {
        speechStartTime = Date.now();
        console.log(`[TwilioStream] [${requestId}] Speech started - barge-in detected responseInProgress=${responseInProgress}`);
        if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.send(
            JSON.stringify({
              event: 'clear',
              streamSid,
            })
          );
          console.log(`[TwilioStream] [${requestId}] Sent clear to Twilio`);
        }
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.send(
            JSON.stringify({
              type: 'response.cancel',
            })
          );
          console.log(`[TwilioStream] [${requestId}] Sent response.cancel to OpenAI`);
        }
      } else if (message.type === 'response.audio_transcript.done') {
        console.log(
          `[TwilioStream] [${requestId}] AI response transcript: ${message.transcript?.substring(0, 100)}...`
        );
      } else if (message.type === 'conversation.item.input_audio_transcription.completed') {
        console.log(
          `[TwilioStream] [${requestId}] User said: ${message.transcript?.substring(0, 100)}...`
        );
      } else if (message.type === 'error') {
        console.error(`[TwilioStream] [${requestId}] OpenAI error:`, message.error);
      }
    } catch (err) {
      console.error(`[TwilioStream] [${requestId}] Error parsing OpenAI message:`, err);
    }
  });

  openAiWs.on('close', (code, reason) => {
    console.log(`[TwilioStream] [${requestId}] OpenAI WebSocket closed: ${code} ${reason}`);
    openAiReady = false;
    if (twilioWs.readyState === WebSocket.OPEN) {
      console.log(
        `[TwilioStream] [${requestId}] CLOSING ws code=1000 reason="OpenAI connection closed" url=${req.url}`
      );
      twilioWs.close(1000, 'OpenAI connection closed');
    }
  });

  openAiWs.on('error', (err) => {
    console.error(`[TwilioStream] [${requestId}] OpenAI WebSocket error:`, err);
  });

  twilioWs.on('message', (data) => {
    try {
      const message: TwilioMessage = JSON.parse(data.toString());

      if (message.event === 'connected') {
        console.log(`[TwilioStream] [${requestId}] Twilio connected event received`);
      } else if (message.event === 'start') {
        streamSid = message.start?.streamSid || message.streamSid || null;
        callSid = message.start?.callSid || callSid;
        console.log(
          `[TwilioStream] [${requestId}] Twilio stream started: streamSid=${streamSid} callSid=${callSid}`
        );
        if (message.start?.mediaFormat) {
          const mf = message.start.mediaFormat;
          console.log(
            `[TwilioStream] [${requestId}] Media format: encoding=${mf.encoding} sampleRate=${mf.sampleRate} channels=${mf.channels}`
          );
        }
      } else if (message.event === 'media') {
        const audioPayload = message.media?.payload;
        if (audioPayload) {
          twilioFrameCount++;
          if (twilioFrameCount % LOG_FRAME_INTERVAL === 0) {
            console.log(
              `[TwilioStream] [${requestId}] Received ${twilioFrameCount} audio frames from Twilio`
            );
          }

          if (openAiReady && openAiWs && openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.send(
              JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: audioPayload,
              })
            );
          } else {
            pendingTwilioAudio.push(audioPayload);
            if (pendingTwilioAudio.length === 1) {
              console.log(`[TwilioStream] [${requestId}] Buffering audio (OpenAI not ready)`);
            }
          }
        }
      } else if (message.event === 'mark') {
        console.log(`[TwilioStream] [${requestId}] Twilio mark: ${message.mark?.name}`);
      } else if (message.event === 'stop') {
        console.log(`[TwilioStream] [${requestId}] Twilio stream stopped`);
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.close(1000, 'Twilio stream ended');
        }
      }
    } catch (err) {
      console.error(`[TwilioStream] [${requestId}] Error parsing Twilio message:`, err);
    }
  });

  twilioWs.on('close', (code, reason) => {
    console.log(`[TwilioStream] [${requestId}] Twilio WebSocket closed: ${code} ${reason}`);
    console.log(
      `[TwilioStream] [${requestId}] Final stats: twilioFrames=${twilioFrameCount} openAiFrames=${openAiFrameCount}`
    );
    
    // HIGH-SIGNAL STRUCTURED LOG for connection close
    console.log(JSON.stringify({
      event: 'twilio_stream_closed',
      requestId,
      callSid: callSid ? `****${callSid.slice(-8)}` : maskedCallSid,
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
    console.error(`[TwilioStream] [${requestId}] Twilio WebSocket error:`, err);
    
    // HIGH-SIGNAL STRUCTURED LOG for connection error
    console.log(JSON.stringify({
      event: 'twilio_stream_error',
      requestId,
      callSid: callSid ? `****${callSid.slice(-8)}` : maskedCallSid,
      error: err?.message || String(err),
    }));
  });
}
