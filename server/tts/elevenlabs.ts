/**
 * ElevenLabs TTS Module for CaseCurrent
 * 
 * Streams TTS audio from ElevenLabs as μ-law 8kHz frames for Twilio Media Streams.
 * Uses the ElevenLabs streaming HTTP endpoint for low-latency audio generation.
 */

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

export interface TTSConfig {
  apiKey: string;
  voiceId: string;
  modelId: string;
  outputFormat: string;
}

export interface TTSStreamOptions {
  voiceId?: string;
  modelId?: string;
  outputFormat?: string;
  signal?: AbortSignal;
  responseId?: string;
}

// Default voice ID - "Hope - Professional, Clear and Natural" voice for CaseCurrent
const DEFAULT_VOICE_ID = "WZlYpi1yf6zJhNWXih74";

// Fallback voice ID - "Sarah" (Mature, Reassuring, Confident) - a premade voice
const FALLBACK_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

/**
 * Get fallback voice ID from environment or default
 */
export function getFallbackVoiceId(): string {
  return process.env.ELEVENLABS_FALLBACK_VOICE_ID || FALLBACK_VOICE_ID;
}

/**
 * Get TTS configuration from environment variables
 */
export function getTTSConfig(): TTSConfig | null {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("[TTS] ELEVENLABS_API_KEY not configured");
    return null;
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID_AVERY || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5";
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || "ulaw_8000";

  return {
    apiKey,
    voiceId,
    modelId,
    outputFormat,
  };
}

/**
 * Log ElevenLabs API key status at startup (without revealing the key)
 */
export function logElevenLabsKeyStatus(): void {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  console.log(JSON.stringify({
    tag: "[ELEVENLABS_KEY]",
    present: !!apiKey,
    length: apiKey ? apiKey.length : 0,
  }));
}

/**
 * Log TTS configuration (for diagnostics on call start)
 */
export function logTTSConfig(): void {
  const config = getTTSConfig();
  if (config) {
    console.log(JSON.stringify({
      event: "tts_config",
      voice_id: config.voiceId,
      fallback_voice_id: getFallbackVoiceId(),
      model_id: config.modelId,
      format: config.outputFormat,
    }));
  } else {
    console.log(JSON.stringify({
      event: "tts_config_error",
      error: "Missing ELEVENLABS_API_KEY",
    }));
  }
}

/**
 * Stream TTS audio from ElevenLabs
 * 
 * Uses the streaming endpoint to generate audio and yields chunks as they arrive.
 * Supports abort signal for barge-in interruption.
 * 
 * @param text - The text to convert to speech
 * @param opts - Options including voice ID, model ID, output format, and abort signal
 * @param onChunk - Callback for each audio chunk (raw bytes)
 */
export async function streamTTS(
  text: string,
  opts: TTSStreamOptions = {},
  onChunk: (chunk: Uint8Array) => void
): Promise<void> {
  const config = getTTSConfig();
  if (!config) {
    throw new Error("TTS not configured - missing ELEVENLABS_API_KEY");
  }

  const voiceId = opts.voiceId || config.voiceId;
  const modelId = opts.modelId || config.modelId;
  const outputFormat = opts.outputFormat || config.outputFormat;
  const responseId = opts.responseId || "unknown";

  const url = `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}/stream?output_format=${outputFormat}`;

  // Verification log for voice ID confirmation (server-only, not spoken to callers)
  console.log(`[TTS_VERIFY] Using ElevenLabs voiceId=${voiceId}`);
  console.log(`[TTS_VERIFY] Full URL: ${url}`);

  console.log(JSON.stringify({
    event: "tts_start",
    response_id: responseId,
    voice_id: voiceId,
    model_id: modelId,
    format: outputFormat,
    text_length: text.length,
    url: url,
  }));

  const requestBody = {
    text,
    model_id: modelId,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true,
    },
  };

  let totalBytes = 0;
  let chunkCount = 0;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "audio/basic",
        "Content-Type": "application/json",
        "xi-api-key": config.apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: opts.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(JSON.stringify({
        event: "tts_error",
        response_id: responseId,
        status: response.status,
        error: errorText.substring(0, 200),
      }));
      throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error("No response body from ElevenLabs");
    }

    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (value && value.length > 0) {
        chunkCount++;
        totalBytes += value.length;

        // Log every 10th chunk to avoid log spam
        if (chunkCount % 10 === 0) {
          console.log(JSON.stringify({
            event: "tts_chunk",
            response_id: responseId,
            chunk_num: chunkCount,
            bytes: value.length,
            total_bytes: totalBytes,
          }));
        }

        onChunk(value);
      }
    }

    console.log(JSON.stringify({
      event: "tts_complete",
      response_id: responseId,
      total_chunks: chunkCount,
      total_bytes: totalBytes,
    }));
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.log(JSON.stringify({
        event: "tts_aborted",
        response_id: responseId,
        chunks_sent: chunkCount,
        bytes_sent: totalBytes,
      }));
      return; // Don't re-throw abort errors
    }

    console.error(JSON.stringify({
      event: "tts_error",
      response_id: responseId,
      error: error.message,
    }));
    throw error;
  }
}

/**
 * Check if TTS is available (API key configured)
 */
export function isTTSAvailable(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

/**
 * TTS result with fallback info
 */
export interface TTSResult {
  success: boolean;
  voiceUsed: string;
  usedFallback: boolean;
  totalBytes: number;
  error?: string;
}

/**
 * Stream TTS with automatic fallback to secondary voice if primary fails
 * 
 * @param text - The text to convert to speech
 * @param opts - TTS options
 * @param onChunk - Callback for each audio chunk
 * @returns TTSResult with success/failure info
 */
/**
 * List all available voices from ElevenLabs API
 * Used for debugging and verifying voice availability
 */
export async function listVoices(): Promise<{ voices: Array<{ voice_id: string; name: string }>; error?: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { voices: [], error: "Missing ELEVENLABS_API_KEY" };
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/voices`, {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { voices: [], error: `API error ${response.status}: ${errorText.substring(0, 200)}` };
    }

    const data = await response.json() as { voices?: Array<{ voice_id: string; name: string }> };
    const voices = (data.voices || []).map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
    }));

    return { voices };
  } catch (error: any) {
    return { voices: [], error: error.message };
  }
}

export async function streamTTSWithFallback(
  text: string,
  opts: TTSStreamOptions = {},
  onChunk: (chunk: Uint8Array) => void
): Promise<TTSResult> {
  const config = getTTSConfig();
  if (!config) {
    return {
      success: false,
      voiceUsed: "none",
      usedFallback: false,
      totalBytes: 0,
      error: "TTS not configured - missing ELEVENLABS_API_KEY",
    };
  }

  const primaryVoiceId = opts.voiceId || config.voiceId;
  const fallbackVoiceId = getFallbackVoiceId();
  const responseId = opts.responseId || "unknown";

  // Try primary voice first
  try {
    let totalBytes = 0;
    await streamTTS(text, { ...opts, voiceId: primaryVoiceId }, (chunk) => {
      totalBytes += chunk.length;
      onChunk(chunk);
    });
    return {
      success: true,
      voiceUsed: primaryVoiceId,
      usedFallback: false,
      totalBytes,
    };
  } catch (primaryError: any) {
    console.error(JSON.stringify({
      event: "tts_primary_failed",
      response_id: responseId,
      voice_id: primaryVoiceId,
      error: primaryError.message,
    }));

    // Try fallback voice
    try {
      console.log(JSON.stringify({
        event: "tts_fallback_attempt",
        response_id: responseId,
        fallback_voice_id: fallbackVoiceId,
      }));

      let totalBytes = 0;
      await streamTTS(text, { ...opts, voiceId: fallbackVoiceId }, (chunk) => {
        totalBytes += chunk.length;
        onChunk(chunk);
      });
      return {
        success: true,
        voiceUsed: fallbackVoiceId,
        usedFallback: true,
        totalBytes,
      };
    } catch (fallbackError: any) {
      console.error(JSON.stringify({
        event: "tts_fallback_failed",
        response_id: responseId,
        fallback_voice_id: fallbackVoiceId,
        error: fallbackError.message,
      }));

      return {
        success: false,
        voiceUsed: fallbackVoiceId,
        usedFallback: true,
        totalBytes: 0,
        error: `Primary (${primaryVoiceId}) and fallback (${fallbackVoiceId}) both failed: ${fallbackError.message}`,
      };
    }
  }
}
