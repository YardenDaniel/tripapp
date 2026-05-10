// Supabase Edge Function — proxies chat messages to the Anthropic Claude API
// so the API key stays on the server and never reaches the browser bundle.
//
// Deploy via Supabase Dashboard → Edge Functions → Create new function "chat"
// → paste this file's contents → Deploy.
//
// Required secret (set in Dashboard → Edge Functions → chat → Secrets):
//   ANTHROPIC_API_KEY = sk-ant-...
//
// Auth: Supabase verifies the caller's JWT automatically (default behavior),
// so unauthenticated requests are rejected before this code runs.

const CLAUDE_MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 1024;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY secret is not set on this function' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "prompt" in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text();
      return new Response(
        JSON.stringify({ error: `Claude API error: ${errBody}` }),
        { status: claudeRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await claudeRes.json();
    const text = result.content?.[0]?.text || '';

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
