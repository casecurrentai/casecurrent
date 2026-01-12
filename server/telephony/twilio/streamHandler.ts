import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { createHmac } from 'crypto';

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

export function verifyStreamToken(
  secret: string,
  timestamp: number,
  token: string
): boolean {
  const expected = generateStreamToken(secret, timestamp);
  return token === expected;
}

export function handleTwilioMediaStream(twilioWs: WebSocket, req: IncomingMessage): void {
  const requestId = Math.random().toString(36).substring(2, 10).toUpperCase();
  const url = new URL(req.url || '', `wss://${req.headers.host}`);
  const tsParam = url.searchParams.get('ts');
  const tokenParam = url.searchParams.get('token');
  const callSidParam = url.searchParams.get('callSid');

  console.log(`[TwilioStream] [${requestId}] New connection from ${req.socket.remoteAddress}`);
  console.log(`[TwilioStream] [${requestId}] URL: ${req.url}`);

  const bypassAuth = process.env.BYPASS_STREAM_AUTH === 'true';
  const secret = process.env.STREAM_TOKEN_SECRET;
  
  if (bypassAuth) {
    console.log(`[TwilioStream] [${requestId}] AUTH BYPASSED url=${req.url}`);
  } else if (secret && tsParam && tokenParam) {
    const ts = parseInt(tsParam, 10);
    const now = Math.floor(Date.now() / 1000);

    if (Math.abs(now - ts) > TOKEN_MAX_AGE_SECONDS) {
      console.log(`[TwilioStream] [${requestId}] Token expired: ts=${ts} now=${now}`);
      console.log(`[TwilioStream] [${requestId}] CLOSING ws code=1008 reason="Token expired" url=${req.url}`);
      twilioWs.close(1008, 'Token expired');
      return;
    }

    if (!verifyStreamToken(secret, ts, tokenParam)) {
      console.log(`[TwilioStream] [${requestId}] Invalid token`);
      console.log(`[TwilioStream] [${requestId}] CLOSING ws code=1008 reason="Invalid token" url=${req.url}`);
      twilioWs.close(1008, 'Invalid token');
      return;
    }

    console.log(`[TwilioStream] [${requestId}] Token verified successfully`);
  } else if (secret) {
    console.log(
      `[TwilioStream] [${requestId}] Missing token params, but secret configured - rejecting`
    );
    console.log(`[TwilioStream] [${requestId}] CLOSING ws code=1008 reason="Missing authentication" url=${req.url}`);
    twilioWs.close(1008, 'Missing authentication');
    return;
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

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    console.error(`[TwilioStream] [${requestId}] OPENAI_API_KEY not set`);
    console.log(`[TwilioStream] [${requestId}] CLOSING ws code=1011 reason="Server misconfigured" url=${req.url}`);
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
        instructions: `You are a friendly legal intake assistant for a law firm. Your job is to:
1. Greet the caller warmly
2. Ask about their legal matter
3. Collect their name and contact information
4. Note key details about their situation
5. Let them know someone will follow up

Be professional, empathetic, and concise. Do not provide legal advice.`,
        voice: 'alloy',
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
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
      } else if (message.type === 'response.done') {
        console.log(`[TwilioStream] [${requestId}] Response completed`);
      } else if (message.type === 'input_audio_buffer.speech_stopped') {
        console.log(`[TwilioStream] [${requestId}] User speech stopped - committing audio`);
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
        console.log(`[TwilioStream] [${requestId}] Audio buffer committed - triggering response`);
        // Request a new response after user audio is committed
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.send(
            JSON.stringify({
              type: 'response.create',
            })
          );
          console.log(`[TwilioStream] [${requestId}] Sent response.create after commit`);
        }
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
        console.log(`[TwilioStream] [${requestId}] Speech started - barge-in detected`);
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
      console.log(`[TwilioStream] [${requestId}] CLOSING ws code=1000 reason="OpenAI connection closed" url=${req.url}`);
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
    if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
      openAiWs.close(1000, 'Twilio connection closed');
    }
  });

  twilioWs.on('error', (err) => {
    console.error(`[TwilioStream] [${requestId}] Twilio WebSocket error:`, err);
  });
}
