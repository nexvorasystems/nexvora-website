/**
 * Nexvora Systems — Get Generated Report HTML
 * GET /api/get-generated-report?id=abc123
 * Returns the saved HTML from Supabase generated_reports table
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'Database not configured' });

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/generated_reports?id=eq.${encodeURIComponent(id)}&select=html`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const rows = await response.json();
    if (!rows?.length) return res.status(404).json({ error: 'Report not found' });
    // Return the full HTML directly
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(rows[0].html);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
