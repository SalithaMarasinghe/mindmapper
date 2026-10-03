// Jarvis Transcription Edge Function
// Accepts audio blob via multipart/form-data, returns Whisper transcription via Groq

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-latency-debug',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const isVoiceInputDisabled =
    Deno.env.get('FLAG_ENABLE_VOICE_INPUT') === 'false' ||
    req.headers.get('x-disable-voice-input') === 'true' ||
    url.searchParams.get('disable_voice_input') === 'true';

  if (isVoiceInputDisabled) {
    return new Response(
      JSON.stringify({
        disabled: true,
        text: '',
        message: 'Transcription is disabled (FLAG_ENABLE_VOICE_INPUT is false).',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const isLatencyDebug =
    Deno.env.get('FLAG_LATENCY_DEBUG') === 'true' ||
    req.headers.get('x-latency-debug') === 'true' ||
    url.searchParams.get('latency_debug') === 'true';
  const tTotalStart = isLatencyDebug ? performance.now() : 0;

  interface ServerTimingItem {
    name: string;
    dur: number;
    desc?: string;
  }
  const timingItems: ServerTimingItem[] = [];
  function addTiming(name: string, dur: number, desc?: string) {
    if (!isLatencyDebug) return;
    timingItems.push({ name, dur: Number(dur.toFixed(1)), desc });
  }
  function formatServerTiming(items: ServerTimingItem[]): string {
    return items
      .map((item) => {
        let entry = `${item.name};dur=${item.dur}`;
        if (item.desc) {
          const cleanDesc = item.desc.replace(/["\\]/g, '');
          entry += `;desc="${cleanDesc}"`;
        }
        return entry;
      })
      .join(', ');
  }

  try {
    const groqKey1 = Deno.env.get('GROQ_API_KEY');
    const groqKey2 = Deno.env.get('GROQ_API_KEY_2');
    const groqKey3 = Deno.env.get('GROQ_API_KEY_3');
    const groqPaidKey = Deno.env.get('GROQ_PAID_API_KEY');

    const providers: Array<{ label: string; key: string }> = [];
    if (groqKey1) providers.push({ label: 'Groq-Free-1', key: groqKey1 });
    if (groqKey2 && groqKey2 !== groqKey1) providers.push({ label: 'Groq-Free-2', key: groqKey2 });
    if (groqKey3 && groqKey3 !== groqKey1 && groqKey3 !== groqKey2) providers.push({ label: 'Groq-Free-3', key: groqKey3 });
    if (groqPaidKey && !providers.some((p) => p.key === groqPaidKey)) {
      providers.push({ label: 'Groq-Paid-Cushion', key: groqPaidKey });
    }

    if (providers.length === 0) {
      throw new Error('No Groq API keys configured (GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3, or GROQ_PAID_API_KEY).');
    }

    // Parse incoming multipart form — expects field named "audio"
    const form = await req.formData();
    const audioField = form.get('audio');

    if (!audioField || !(audioField instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'Missing "audio" file field in multipart form.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const audioBytes = await (audioField as File).arrayBuffer();
    const fileName = (audioField as File).name || 'recording.webm';
    const fileType = (audioField as File).type || 'audio/webm';

    let rawText = '';
    let success = false;
    const providerErrors: string[] = [];

    // Cascade: Groq Free 1 -> Groq Free 2 -> Groq Free 3 -> Groq Paid Cushion
    for (const provider of providers) {
      try {
        const groqForm = new FormData();
        const fileBlob = new Blob([audioBytes], { type: fileType });
        groqForm.append('file', fileBlob, fileName);
        groqForm.append('model', 'whisper-large-v3-turbo');
        groqForm.append('response_format', 'json');
        groqForm.append('language', 'en');
        groqForm.append('temperature', '0.0');
        groqForm.append('prompt', 'Voice command for Jarvis AI assistant.');

        const tGroqStart = isLatencyDebug ? performance.now() : 0;
        const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${provider.key}` },
          body: groqForm,
        });
        if (isLatencyDebug) {
          addTiming(`stt_${provider.label}`, performance.now() - tGroqStart);
        }

        if (!groqRes.ok) {
          const errText = await groqRes.text();
          const errMsg = `${provider.label} error (${groqRes.status}): ${errText}`;
          console.warn(`[jarvis-transcribe] ${errMsg}`);
          providerErrors.push(errMsg);
          continue;
        }

        const result = (await groqRes.json()) as { text: string };
        rawText = result.text?.trim() ?? '';
        success = true;
        break;
      } catch (err: unknown) {
        const errMsg = `${provider.label} exception: ${err instanceof Error ? err.message : String(err)}`;
        console.warn(`[jarvis-transcribe] ${errMsg}`);
        providerErrors.push(errMsg);
      }
    }

    if (!success) {
      throw new Error(`All transcription providers failed: ${providerErrors.join(' | ')}`);
    }

    // Filter out notorious Whisper silence/cutoff hallucinations (e.g. "Thank you.", "Thanks for watching.")
    const cleanLower = rawText.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const isHallucination =
      !cleanLower ||
      cleanLower === 'thank you' ||
      cleanLower === 'thank you very much' ||
      cleanLower === 'thanks for watching' ||
      cleanLower === 'thanks for listening' ||
      cleanLower === 'thank you for watching' ||
      cleanLower === 'thank you for your time' ||
      cleanLower === 'you' ||
      cleanLower === 'bye' ||
      cleanLower === 'bye bye' ||
      cleanLower === 'goodbye' ||
      cleanLower === 'so' ||
      cleanLower === 'okay' ||
      cleanLower === 'ok' ||
      cleanLower.startsWith('subtitles by') ||
      cleanLower.includes('amara org');

    if (isHallucination) {
      console.log(`[jarvis-transcribe] Filtered Whisper silence hallucination: "${rawText}"`);
      rawText = '';
    }

    const resHeaders: Record<string, string> = { ...corsHeaders, 'Content-Type': 'application/json' };
    if (isLatencyDebug) {
      addTiming('stt_total', performance.now() - tTotalStart);
      resHeaders['Access-Control-Expose-Headers'] = 'Server-Timing';
      resHeaders['Server-Timing'] = formatServerTiming(timingItems);
    }

    return new Response(
      JSON.stringify({ text: rawText }),
      { status: 200, headers: resHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[jarvis-transcribe] Error:', message);
    const errHeaders: Record<string, string> = { ...corsHeaders, 'Content-Type': 'application/json' };
    if (isLatencyDebug && tTotalStart) {
      addTiming('stt_total', performance.now() - tTotalStart);
      errHeaders['Access-Control-Expose-Headers'] = 'Server-Timing';
      errHeaders['Server-Timing'] = formatServerTiming(timingItems);
    }
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: errHeaders }
    );
  }
});
