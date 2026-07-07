// Serverless Claude proxy for Task OS (Vercel).
// Lets signed-in users run the AI features without their own API key.
//
// Setup:
//   1. In Vercel → Project → Settings → Environment Variables, add:
//        ANTHROPIC_API_KEY = sk-ant-...              (required)
//        SUPABASE_URL      = https://xxxx.supabase.co (optional, gates to signed-in users)
//        SUPABASE_ANON_KEY = eyJhbGci...              (optional, needed if SUPABASE_URL is set)
//   2. Deploy. The endpoint is https://<your-app>.vercel.app/api/claude
//   3. Paste that URL into APP_CONFIG.aiProxy in index.html.
//
// Note: this is a minimal proxy. For production add per-user rate limiting
// (e.g. Upstash) so a single account can't run up your Anthropic bill.

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' }); return; }

  // Optional: require a valid Supabase session so only your users can call the proxy.
  if (process.env.SUPABASE_URL) {
    const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!tok) { res.status(401).json({ error: 'Sign in required' }); return; }
    try {
      const u = await fetch(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/auth/v1/user', {
        headers: { apikey: process.env.SUPABASE_ANON_KEY || '', Authorization: 'Bearer ' + tok },
      });
      if (!u.ok) { res.status(401).json({ error: 'Invalid session' }); return; }
    } catch (e) { res.status(401).json({ error: 'Auth check failed' }); return; }
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const prompt = String(body.prompt || '').slice(0, 20000);
  const max_tokens = Math.min(parseInt(body.max_tokens) || 1000, 2000);
  if (!prompt) { res.status(400).json({ error: 'Missing prompt' }); return; }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) });
  }
}
