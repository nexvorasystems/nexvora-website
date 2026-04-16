/**
 * Nexvora Systems — Unified Report Getter
 *
 * GET /api/get-generated-report?id=abc123
 *   → Returns saved HTML from generated_reports table (AI reports at /r/:id)
 *
 * GET /api/get-generated-report?mode=audit&id=abc123&email=user@example.com
 *   → Returns JSON audit data from reports table (website audit, email-gated)
 *   (replaces the old /api/get-audit endpoint)
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'Database not configured' });

  const { id, mode, email } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  // ── Audit mode (replaces /api/get-audit) ─────────────────────────────────
  if (mode === 'audit') {
    if (!email) return res.status(400).json({ error: 'id and email required' });
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/reports?id=eq.${encodeURIComponent(id)}&select=id,data`,
        { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
      );
      if (!response.ok) return res.status(500).json({ error: 'Database error' });
      const rows = await response.json();
      if (!rows?.length) return res.status(404).json({ error: 'Report not found' });
      const row = rows[0];
      const savedEmail = row.data?.contact?.email || '';
      if (savedEmail.toLowerCase().trim() !== email.toLowerCase().trim())
        return res.status(403).json({ error: 'Email does not match this report' });
      return res.json({ success: true, id: row.id, data: row.data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── AI generated report (default) ────────────────────────────────────────
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/generated_reports?id=eq.${encodeURIComponent(id)}&select=html`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const rows = await response.json();
    if (!rows?.length) return res.status(404).json({ error: 'Report not found' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(rows[0].html);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
