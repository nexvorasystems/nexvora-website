/**
 * Nexvora Systems — Website Audit Widget Lead Capture
 * Called by assets/js/audit-widget.js when a visitor requests a free website audit.
 * Creates/upserts GHL contact + tags 'website-audit-widget' + adds a note with the
 * submitted website URL and report link.
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

  const { name, email, websiteUrl, reportUrl, reportId } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  if (!apiKey || !locationId) {
    console.warn('[audit-lead] Missing GHL_API_KEY or GHL_LOCATION_ID — skipping');
    return res.json({ success: true, note: 'GHL skipped — env vars not set' });
  }

  const headers = ghlHeaders(apiKey);
  const nameParts = (name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  try {
    // 1. Upsert contact — GHL finds existing contact by email and patches it
    const contactRes = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        locationId,
        firstName,
        lastName,
        email,
        website: websiteUrl || '',
        tags: ['website-audit-widget', 'website-lead'],
        source: 'Website Audit Widget'
      })
    });

    if (!contactRes.ok) {
      const err = await contactRes.json().catch(() => ({}));
      console.error('[audit-lead] Contact upsert failed:', contactRes.status, JSON.stringify(err));
      return res.status(500).json({ error: 'GHL contact creation failed' });
    }

    const contactData = await contactRes.json();
    const contactId = contactData.contact?.id;
    if (!contactId) {
      console.error('[audit-lead] No contact ID returned:', JSON.stringify(contactData));
      return res.status(500).json({ error: 'No contact ID returned' });
    }

    // 2. Add note with submitted audit data
    const noteRes = await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        body: `=== FREE WEBSITE AUDIT REQUESTED ===\nSubmitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET\nName: ${name || '—'}\nEmail: ${email}\nWebsite: ${websiteUrl || '—'}\nReport ID: ${reportId || '—'}\nReport URL: ${reportUrl || '—'}\n====================================`
      })
    });
    if (!noteRes.ok) {
      const err = await noteRes.json().catch(() => ({}));
      console.error('[audit-lead] Note creation failed:', noteRes.status, JSON.stringify(err));
      // Non-fatal — contact was created, lead is captured
    }

    return res.json({ success: true, contactId });
  } catch (err) {
    console.error('[audit-lead] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
