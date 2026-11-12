import { firebaseConfig } from './_firebase.js';
// Vercel serverless function: AI drafting for Bizvora.
// Set ANTHROPIC_API_KEY (required) and ANTHROPIC_MODEL (recommended) in Vercel → Project → Settings → Environment Variables.
const MAX_PROMPT = 60000;
const MAX_IMAGES = 3;

export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (req.method === 'GET') return res.status(200).json({ enabled: Boolean(key) });
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!key) return res.status(503).json({ error: 'AI is not configured on this deployment.' });

  // When accounts are configured, only signed-in users may use AI.
  const fb = firebaseConfig();
  if (fb && fb.apiKey) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in to use AI drafting.' });
    try {
      const u = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(fb.apiKey)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: auth.slice(7) })
      });
      if (!u.ok) return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    } catch (e) { return res.status(502).json({ error: 'Could not verify your session.' }); }
  }

  const { prompt, images = [] } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT) return res.status(400).json({ error: 'Invalid prompt.' });
  const okTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const imgs = (Array.isArray(images) ? images : []).slice(0, MAX_IMAGES).filter(i => i && okTypes.includes(i.mediaType) && typeof i.data === 'string');

  const content = [
    ...imgs.map(i => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType, data: i.data } })),
    { type: 'text', text: prompt }
  ];
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5', max_tokens: 2000, messages: [{ role: 'user', content }] })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j && j.error && j.error.message) || 'AI request failed.' });
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach the AI service.' });
  }
}
