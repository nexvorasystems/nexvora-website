/**
 * Nexvora Systems — Assessment Draft Saver
 * Called after each question so partial answers are preserved.
 * Upserts into Supabase `assessment_drafts` table keyed by email.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://nexvorasystems.us');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.json({ success: true, note: 'Supabase skipped — env vars not set' });
  }

  const { email, name, step, data } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/assessment_drafts`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        email,
        name: name || null,
        step: step || 0,
        data: data || {},
        updated_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[save-draft] Supabase error:', response.status, err);
      return res.status(500).json({ error: 'Failed to save draft' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[save-draft] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
