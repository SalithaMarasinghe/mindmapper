// Jarvis Text-to-Speech Edge Function
// Supports a 3-Tier Zero-Cost / Low-Cost Cascade:
// 1. Groq Free Tier (GROQ_API_KEY) — 100% Free, $0.00 spent
// 2. Groq Paid Tier (GROQ_PAID_API_KEY) — Overflow cushion, ONLY engages if daily free quota (100 req/day) is reached
// 3. Google Cloud TTS (GOOGLE_TTS_API_KEY) — Optional fallback
// 4. Browser TTS — Client automatically engages patched browser speech if all cloud providers fail

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TtsRequest {
  text?: string;
  voice?: string;
  languageCode?: string;
  speakingRate?: number;
  pitch?: number;
}

// Safely convert Uint8Array to base64 without call-stack overflow
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000; // 32KB chunks
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

// Split text into chunks that respect Groq's 200 character limit
function splitIntoChunks(text: string, maxLen = 190): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return [trimmed];

  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).trim().length <= maxLen) {
      currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (sentence.length <= maxLen) {
        currentChunk = sentence;
      } else {
        const words = sentence.split(' ');
        currentChunk = '';
        for (const word of words) {
          if ((currentChunk + ' ' + word).trim().length <= maxLen) {
            currentChunk = currentChunk ? `${currentChunk} ${word}` : word;
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = word;
          }
        }
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  // Synthesize up to 10 chunks (~1900 chars) for fluid, comprehensive conversational answers
  return chunks.slice(0, 10);
}

// Concatenate and repair PCM WAV buffers into a standard compliant WAV
function concatenateWavBuffers(buffers: Uint8Array[]): Uint8Array {
  if (buffers.length === 0) return new Uint8Array(0);

  const pcmSlices: Uint8Array[] = [];
  let totalDataLength = 0;
  let headerTemplateEnd = 44;

  for (let bIndex = 0; bIndex < buffers.length; bIndex++) {
    const buf = buffers[bIndex];
    let offset = 12;
    while (offset < buf.length - 8) {
      const subchunkId = String.fromCharCode(
        buf[offset],
        buf[offset + 1],
        buf[offset + 2],
        buf[offset + 3]
      );
      let subchunkSize =
        (buf[offset + 4] & 0xff) |
        ((buf[offset + 5] & 0xff) << 8) |
        ((buf[offset + 6] & 0xff) << 16) |
        ((buf[offset + 7] & 0xff) << 24);

      // Handle placeholder 0xFFFFFFFF size from streaming encoders like Lavf/FFmpeg
      if (subchunkSize === 0xffffffff || subchunkSize < 0 || offset + 8 + subchunkSize > buf.length) {
        subchunkSize = buf.length - (offset + 8);
      }

      if (subchunkId === 'data') {
        if (bIndex === 0) {
          headerTemplateEnd = offset + 8;
        }
        const dataBytes = buf.subarray(offset + 8, offset + 8 + subchunkSize);
        pcmSlices.push(dataBytes);
        totalDataLength += dataBytes.length;
        break;
      }
      offset += 8 + subchunkSize;
    }
  }

  if (pcmSlices.length === 0) return buffers[0];

  const result = new Uint8Array(headerTemplateEnd + totalDataLength);
  result.set(buffers[0].subarray(0, headerTemplateEnd), 0);

  // Update RIFF total size: total file size - 8
  const riffSize = result.length - 8;
  result[4] = riffSize & 0xff;
  result[5] = (riffSize >> 8) & 0xff;
  result[6] = (riffSize >> 16) & 0xff;
  result[7] = (riffSize >> 24) & 0xff;

  // Update data subchunk size
  result[headerTemplateEnd - 4] = totalDataLength & 0xff;
  result[headerTemplateEnd - 3] = (totalDataLength >> 8) & 0xff;
  result[headerTemplateEnd - 2] = (totalDataLength >> 16) & 0xff;
  result[headerTemplateEnd - 1] = (totalDataLength >> 24) & 0xff;

  // Copy audio sample slices
  let curOffset = headerTemplateEnd;
  for (const slice of pcmSlices) {
    result.set(slice, curOffset);
    curOffset += slice.length;
  }

  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const groqKey = Deno.env.get('GROQ_API_KEY');
    const groqPaidKey = Deno.env.get('GROQ_PAID_API_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_TTS_API_KEY');

    if (!groqKey && !groqPaidKey && !googleApiKey) {
      return new Response(
        JSON.stringify({
          error: 'No TTS API keys configured (GROQ_API_KEY, GROQ_PAID_API_KEY, or GOOGLE_TTS_API_KEY).',
          code: 'MISSING_API_KEY',
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body = (await req.json()) as TtsRequest;
    const text = body.text?.trim();

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Missing or empty "text" parameter in request body.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ── Build Priority-Ordered Groq Providers ──────────────────────────────
    // Tier 1: Free Groq API Key (0$ spend)
    // Tier 2: Paid Groq API Key (Overflow cushion, only activates if Free hits 429 or quota limit)
    const groqProviders: Array<{ label: string; key: string }> = [];
    if (groqKey) {
      groqProviders.push({ label: 'Groq-Free', key: groqKey });
    }
    if (groqPaidKey && groqPaidKey !== groqKey) {
      groqProviders.push({ label: 'Groq-Paid-Cushion', key: groqPaidKey });
    }

    const debugErrors: string[] = [];
    const voice = body.voice && ['daniel', 'austin', 'troy', 'autumn', 'diana', 'hannah'].includes(body.voice)
      ? body.voice
      : 'daniel';

    const chunks = splitIntoChunks(text, 190);

    // Try Groq tiers sequentially
    for (const provider of groqProviders) {
      try {
        const wavBuffers: Uint8Array[] = [];
        let success = true;

        for (const chunk of chunks) {
          const groqRes = await fetch('https://api.groq.com/openai/v1/audio/speech', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${provider.key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'canopylabs/orpheus-v1-english',
              input: chunk,
              voice,
              response_format: 'wav',
            }),
          });

          if (!groqRes.ok) {
            const errText = await groqRes.text();
            const errMsg = `${provider.label} failed (${groqRes.status}): ${errText}`;
            console.warn(`[jarvis-tts] ${errMsg}`);
            debugErrors.push(errMsg);
            success = false;
            break;
          }

          const buf = new Uint8Array(await groqRes.arrayBuffer());
          wavBuffers.push(buf);
        }

        if (success && wavBuffers.length > 0) {
          const combinedWav = concatenateWavBuffers(wavBuffers);
          const base64Audio = uint8ArrayToBase64(combinedWav);

          return new Response(
            JSON.stringify({
              audioContent: base64Audio,
              format: 'wav',
              provider: provider.label,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      } catch (err: unknown) {
        const errMsg = `${provider.label} exception: ${err instanceof Error ? err.message : String(err)}`;
        console.warn(`[jarvis-tts] ${errMsg}`);
        debugErrors.push(errMsg);
      }
    }

    // ── Tier 3: Google Cloud TTS (Neural2) Fallback ──────────────────────────
    if (googleApiKey) {
      try {
        const voiceName = body.voice || 'en-GB-Neural2-B';
        const languageCode = body.languageCode || (voiceName.startsWith('en-US') ? 'en-US' : 'en-GB');
        const speakingRate = typeof body.speakingRate === 'number' ? body.speakingRate : 1.0;
        const pitch = typeof body.pitch === 'number' ? body.pitch : -0.5;

        const googlePayload = {
          input: { text },
          voice: {
            languageCode,
            name: voiceName,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate,
            pitch,
          },
        };

        const googleRes = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(googlePayload),
          }
        );

        if (googleRes.ok) {
          const data = (await googleRes.json()) as { audioContent?: string };
          if (data.audioContent) {
            return new Response(
              JSON.stringify({
                audioContent: data.audioContent,
                format: 'mp3',
                provider: 'Google-Neural2',
              }),
              {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        }
      } catch (err: unknown) {
        console.warn('[jarvis-tts] Google Cloud fallback error:', err);
      }
    }

    // If all cloud providers failed or are rate limited, return 503 so client falls back to patched browser voice
    return new Response(
      JSON.stringify({
        error: 'All cloud TTS providers exhausted or unavailable. Falling back to local browser speech.',
        code: 'ALL_PROVIDERS_EXHAUSTED',
        details: debugErrors,
      }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[jarvis-tts] Fatal Error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
