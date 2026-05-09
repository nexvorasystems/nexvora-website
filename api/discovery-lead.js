/**
 * Nexvora Systems — Discovery Call Lead Capture
 * POST /api/discovery-lead
 *
 * action: 'capture' — name + email only (called immediately, partial lead)
 * action: 'submit'  — full form, routes to correct GHL pipeline
 *
 * Qualification:
 *   Disqualified: revenue 0-100k OR 100k-250k AND investment = not_ready
 *   Qualified: everything else
 */

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

const REVENUE_LABELS = {
  '0-100k':    '$0 – $100K',
  '100k-250k': '$100K – $250K',
  '250k-500k': '$250K – $500K',
  '500k-1mil': '$500K – $1M',
  '1mil+':     '$1M+'
};

const INVESTMENT_LABELS = {
  'not_ready':  'Not ready to invest',
  'up_to_1k':   'Up to $1,000',
  '1k_2500':    '$1,000 – $2,500',
  '2500_5000':  '$2,500 – $5,000',
  '5000_plus':  '$5,000+'
};

function ghlHeaders(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Version': GHL_VERSION
  };
}

function isQualified(revenue, investment) {
  if (investment !== 'not_ready') return true;
  return revenue !== '0-100k' && revenue !== '100k-250k';
}

function splitName(full) {
  const parts = (full || '').trim().split(/\s+/);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://nexvorasystems.us');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GHL_API_KEY?.trim();
  const locationId = process.env.GHL_LOCATION_ID?.trim();
  if (!apiKey || !locationId) return res.json({ success: true, note: 'GHL skipped' });

  const body = req.body || {};
  const action = body.action;
  const headers = ghlHeaders(apiKey);

  // ─── CAPTURE: name + email only ──────────────────────────────────────────────
  if (action === 'capture') {
    const { name, email } = body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const { firstName, lastName } = splitName(name);
    try {
      const r = await fetch(`${GHL_BASE}/contacts/upsert`, {
        method: 'POST', headers,
        body: JSON.stringify({
          locationId, firstName, lastName, email,
          tags: ['discovery-started', 'website-lead'],
          source: 'Discovery Call Form'
        })
      });
      if (!r.ok) return res.status(500).json({ error: 'Contact creation failed' });

      const data = await r.json();
      const contactId = data.contact?.id;
      if (!contactId) return res.status(500).json({ error: 'No contact ID returned' });

      await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
        method: 'POST', headers,
        body: JSON.stringify({
          body: `=== DISCOVERY FORM STARTED ===\nStarted: ${new Date().toLocaleString('en-US',{timeZone:'America/New_York'})} ET\nName: ${name||'—'}\nEmail: ${email}\nStatus: Started — did not complete.\n==============================`
        })
      }).catch(() => {});

      return res.json({ success: true, contactId });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ─── SUBMIT: full form ────────────────────────────────────────────────────────
  if (action === 'submit') {
    const { name, email, phone, company, industry, revenue, investment } = body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const qualified = isQualified(revenue, investment);
    const { firstName, lastName } = splitName(name);

    try {
      // 1. Upsert contact with full info
      const upsertRes = await fetch(`${GHL_BASE}/contacts/upsert`, {
        method: 'POST', headers,
        body: JSON.stringify({
          locationId, firstName, lastName, email,
          phone: phone || '',
          companyName: company || '',
          tags: qualified
            ? ['discovery-qualified', 'website-lead']
            : ['discovery-disqualified', 'not-ready', 'website-lead'],
          source: 'Discovery Call Form'
        })
      });

      if (!upsertRes.ok) return res.status(500).json({ error: 'Contact upsert failed' });
      const contactData = await upsertRes.json();
      const contactId = contactData.contact?.id || body.contactId;
      if (!contactId) return res.status(500).json({ error: 'No contact ID' });

      // 2. Add detailed note
      await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
        method: 'POST', headers,
        body: JSON.stringify({
          body: `=== DISCOVERY FORM SUBMITTED ===
Submitted: ${new Date().toLocaleString('en-US',{timeZone:'America/New_York'})} ET
Qualified: ${qualified ? 'YES — Discovery Call offered' : 'NO — Not Ready pipeline'}

--- CONTACT ---
Name: ${name||'—'}
Email: ${email}
Phone: ${phone||'—'}
Company: ${company||'—'}

--- BUSINESS ---
Industry: ${industry||'—'}
Annual Revenue: ${REVENUE_LABELS[revenue]||revenue||'—'}
Investment Readiness: ${INVESTMENT_LABELS[investment]||investment||'—'}
================================`
        })
      }).catch(() => {});

      // 3. Find correct pipeline and first stage
      const plRes = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`, { headers });
      let pipelineId = null, stageId = null;

      if (plRes.ok) {
        const plData = await plRes.json();
        const pipelines = plData.pipelines || [];
        const target = qualified
          ? pipelines.find(p => p.name?.toLowerCase().includes('discovery'))
          : pipelines.find(p => p.name?.toLowerCase().includes('not ready'));

        if (target) {
          pipelineId = target.id;
          stageId = target.stages?.[0]?.id;
        }
      }

      // 4. Create opportunity
      if (pipelineId && stageId) {
        const label = company || name || 'Unknown';
        await fetch(`${GHL_BASE}/opportunities/`, {
          method: 'POST', headers,
          body: JSON.stringify({
            locationId, pipelineId, pipelineStageId: stageId, contactId,
            name: qualified ? `${label} — Discovery Call` : `${label} — Not Ready`,
            status: 'open',
            source: 'Discovery Call Form',
            monetaryValue: 0
          })
        }).catch(() => {});
      }

      return res.json({ success: true, contactId, qualified });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
};
