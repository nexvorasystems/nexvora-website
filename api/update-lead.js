/**
 * Nexvora Systems — Update GHL Contact + optionally save assessment draft
 * Uses /contacts/upsert (same as capture-lead) — matched by email.
 * Called after phone and company name are collected in assessment.
 * Also handles draft saving when `step` + `data` fields are provided.
 */

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function ghlHeaders(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Version': GHL_VERSION
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://nexvorasystems.us');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GHL_API_KEY?.trim();
  const locationId = process.env.GHL_LOCATION_ID?.trim();
  if (!apiKey || !locationId) return res.json({ success: true, note: 'GHL skipped — env vars not set' });

  const { email, phone, company, name, step, data } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });

  // Save assessment draft to Supabase (fire-and-forget, merged from save-draft endpoint)
  if (step !== undefined && data && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    fetch(`${SUPABASE_URL}/rest/v1/assessment_drafts`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ email, name: name || null, step, data, updated_at: new Date().toISOString() })
    }).catch(e => console.warn('[update-lead] draft save failed:', e.message));
  }

  // GHL contact update — skip if nothing to update
  if (!phone && !company) return res.json({ success: true, note: 'draft saved, no GHL fields to update' });
  if (!apiKey || !locationId) return res.json({ success: true, note: 'GHL skipped — env vars not set' });

  // Build upsert payload — GHL finds existing contact by email and patches it
  const payload = { locationId, email };
  if (phone) payload.phone = phone;
  if (company) payload.companyName = company;

  try {
    const r = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: 'POST',
      headers: ghlHeaders(apiKey),
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const body = await r.text();
      console.error('[update-lead] GHL upsert failed:', r.status, body);
      return res.status(500).json({ error: 'GHL update failed', status: r.status });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[update-lead] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
