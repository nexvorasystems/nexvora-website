const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('[save-report] Missing Supabase env vars');
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const data = req.body;
  if (!data || !data.contact) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const id = generateId();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ id, data }),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeout);
    console.error('[save-report] Fetch failed:', err.message);
    return res.status(500).json({ error: 'Failed to save report' });
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const err = await response.text();
    console.error('[save-report] Supabase insert failed:', response.status, err);
    return res.status(500).json({ error: 'Failed to save report' });
  }

  return res.json({ id });
};
