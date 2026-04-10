/**
 * Nexvora Systems — Update GHL Contact with phone + company
 * Uses /contacts/upsert (same as capture-lead) — matched by email.
 * Called after phone and company name are collected in assessment.
 */

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

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

  const { email, phone, company } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  if (!phone && !company) return res.json({ success: true, note: 'nothing to update' });

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
