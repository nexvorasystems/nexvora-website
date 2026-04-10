/**
 * Nexvora Systems — Partial Assessment Lead Capture
 * Called immediately after user enters name + email in assessment.
 * Creates/upserts GHL contact + adds to "NOT FINISHED ASSESMENT" pipeline → New Lead stage.
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

  if (!apiKey || !locationId) {
    return res.json({ success: true, note: 'GHL skipped — env vars not set' });
  }

  const { name, email, phone, timezone } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const headers = ghlHeaders(apiKey);
  const nameParts = (name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Build upsert payload — include timezone if provided
  const upsertPayload = {
    locationId,
    firstName,
    lastName,
    email,
    phone: phone || '',
    tags: ['assessment-started', 'website-lead'],
    source: 'Website Assessment'
  };
  if (timezone) upsertPayload.timezone = timezone;

  try {
    // 1. Upsert contact
    const contactRes = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: 'POST',
      headers,
      body: JSON.stringify(upsertPayload)
    });

    if (!contactRes.ok) {
      console.error('[capture-lead] Contact upsert failed:', contactRes.status);
      return res.status(500).json({ error: 'GHL contact creation failed' });
    }

    const contactData = await contactRes.json();
    const contactId = contactData.contact?.id;
    if (!contactId) return res.status(500).json({ error: 'No contact ID returned' });

    // 2. Add note
    await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        body: `=== ASSESSMENT NOT FINISHED ===\nStarted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET\nName: ${name || '—'}\nEmail: ${email}\nPhone: ${phone || '—'}\nTimezone: ${timezone || '—'}\nStatus: Started assessment — did not complete.\n==============================`
      })
    });

    // Opportunity is created later via /api/create-opportunity after 30-min timer
    return res.json({ success: true, contactId });
  } catch (err) {
    console.error('[capture-lead] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
