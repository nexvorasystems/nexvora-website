/**
 * Nexvora Systems — Save Website Audit Results
 * POST { id, contact: {name, email, url}, scores, issues }
 * Saves to Supabase reports table, returns { id }
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://nexvorasystems.us');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, contact, scores, issues, seoChecks } = req.body || {};

  if (!id || !contact?.email) {
    return res.status(400).json({ error: 'id and contact.email required' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('[save-audit] Supabase not configured');
    return res.json({ success: true, id, note: 'Supabase skipped' });
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        id,
        data: { contact, scores, issues, seoChecks, savedAt: new Date().toISOString() }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      // If duplicate ID (already saved), that's fine
      if (response.status === 409) return res.json({ success: true, id });
      console.error('[save-audit] Supabase error:', response.status, err);
      return res.status(500).json({ error: 'Failed to save report' });
    }

    return res.json({ success: true, id });
  } catch (err) {
    console.error('[save-audit] Unexpected error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
