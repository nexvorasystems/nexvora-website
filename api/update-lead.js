/**
 * Nexvora Systems — Update GHL Contact + optionally save assessment draft
 * Uses /contacts/upsert (same as capture-lead) — matched by email.
 * Called after phone and company name are collected in assessment.
 * Also handles draft saving when `step` + `data` fields are provided.
 *
 * Honest error reporting:
 * - If ALL attempted save steps fail → 500 { success: false, error }
 * - If SOME steps fail → 200 { success: true, warnings: [...] }
 * - Callers (assessment.html) are fire-and-forget and only rely on `success`.
 */

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

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

  const { email, phone, company, name, step, data } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });

  const attempted = []; // steps we actually tried
  const failures = [];  // steps that failed
  const warnings = [];  // human-readable failure/skip notes

  // ── Step 1: Save assessment draft to Supabase (merged from save-draft endpoint)
  const wantsDraftSave = step !== undefined && data;
  if (wantsDraftSave) {
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      attempted.push('draft');
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/assessment_drafts`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({ email, name: name || null, step, data, updated_at: new Date().toISOString() })
        });
        if (!r.ok) {
          const body = await r.text().catch(() => '');
          console.error('[update-lead] draft save failed:', r.status, body);
          failures.push('draft');
          warnings.push(`Supabase draft save failed (${r.status})`);
        }
      } catch (e) {
        console.error('[update-lead] draft save failed:', e.message);
        failures.push('draft');
        warnings.push('Supabase draft save failed: ' + e.message);
      }
    } else {
      warnings.push('Supabase draft save skipped — env vars not set');
    }
  }

  // ── Step 2: GHL contact update — skip if nothing to update
  const wantsGhlUpdate = Boolean(phone || company);
  if (wantsGhlUpdate) {
    if (apiKey && locationId) {
      attempted.push('ghl');

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
          const body = await r.text().catch(() => '');
          console.error('[update-lead] GHL upsert failed:', r.status, body);
          failures.push('ghl');
          warnings.push(`GHL update failed (${r.status})`);
        }
      } catch (err) {
        console.error('[update-lead] GHL upsert error:', err.message);
        failures.push('ghl');
        warnings.push('GHL update failed: ' + err.message);
      }
    } else {
      warnings.push('GHL update skipped — env vars not set');
    }
  }

  // ── Result: honest status based on what was attempted
  if (attempted.length > 0 && failures.length === attempted.length) {
    // Every save step we tried failed
    return res.status(500).json({ success: false, error: warnings.join('; ') || 'All save steps failed' });
  }

  const response = { success: true };
  if (warnings.length > 0) response.warnings = warnings;
  if (attempted.length === 0) response.note = 'nothing to save';
  return res.json(response);
};
