/**
 * Nexvora Systems — Unified Report Saver
 *
 * POST /api/save-report  { contact, ...data }
 *   → Generates an ID, saves to reports table, returns { id }
 *   (used by assessment.html)
 *
 * POST /api/save-report  { id, contact, scores, issues, seoChecks }
 *   → Uses the provided ID, saves to reports table, returns { success, id }
 *   (replaces the old /api/save-audit endpoint, used by website-audit.html)
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  if (!body.contact) return res.status(400).json({ error: 'Invalid payload' });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('[save-report] Supabase not configured');
    return res.json({ success: true, id: body.id || generateId(), note: 'Supabase skipped' });
  }

  // ── Audit mode: client provides the ID ───────────────────────────────────
  if (body.id) {
    const { id, contact, scores, issues, seoChecks } = body;
    if (!contact?.email) return res.status(400).json({ error: 'contact.email required' });
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
        if (response.status === 409) return res.json({ success: true, id });
        const err = await response.text();
        console.error('[save-report/audit] Supabase error:', response.status, err);
        return res.status(500).json({ error: 'Failed to save report' });
      }
      return res.json({ success: true, id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Assessment mode: server generates the ID ─────────────────────────────
  const id = generateId();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ id, data: body }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) {
      const err = await response.text();
      console.error('[save-report] Supabase insert failed:', response.status, err);
      return res.status(500).json({ error: 'Failed to save report' });
    }
    return res.json({ id });
  } catch (err) {
    clearTimeout(timeout);
    return res.status(500).json({ error: err.message });
  }
};
