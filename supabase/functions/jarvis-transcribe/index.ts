// Jarvis Transcription Edge Function
// Accepts audio blob via multipart/form-data, returns Whisper transcription via Groq

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set.');
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

    // Forward to Groq Whisper
    const groqForm = new FormData();
    // Rename with explicit extension so Groq detects the codec correctly
    groqForm.append('file', audioField, 'recording.webm');
    groqForm.append('model', 'whisper-large-v3-turbo');
    groqForm.append('response_format', 'json');
    groqForm.append('language', 'en');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqApiKey}` },
      body: groqForm,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq Whisper API error (${groqRes.status}): ${errText}`);
    }

    const result = await groqRes.json() as { text: string };

    return new Response(
      JSON.stringify({ text: result.text?.trim() ?? '' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[jarvis-transcribe] Error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
