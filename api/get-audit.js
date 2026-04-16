/**
 * Nexvora Systems — Get Website Audit by ID + Email Verification
 * GET /api/get-audit?id=abc12345&email=user@example.com
 * Returns audit data only if email matches saved contact
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://nexvorasystems.us');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id, email } = req.query;

  if (!id || !email) {
    return res.status(400).json({ error: 'id and email required' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/reports?id=eq.${encodeURIComponent(id)}&select=id,data`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      return res.status(500).json({ error: 'Database error' });
    }

    const rows = await response.json();
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const row = rows[0];
    const savedEmail = row.data?.contact?.email || '';

    // Email verification — case-insensitive
    if (savedEmail.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return res.status(403).json({ error: 'Email does not match this report' });
    }

    return res.json({ success: true, id: row.id, data: row.data });

  } catch (err) {
    console.error('[get-audit] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
