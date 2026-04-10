/**
 * Nexvora Systems — Partial Assessment Lead Capture
 * Called immediately after user enters name + email in assessment.
 * Creates/upserts GHL contact + adds to "Incomplete Assessment" pipeline.
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

  const { name, email, phone } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const headers = ghlHeaders(apiKey);
  const nameParts = (name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  try {
    // 1. Upsert contact with "assessment-started" tag
    const contactRes = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        locationId,
        firstName,
        lastName,
        email,
        phone: phone || '',
        tags: ['assessment-started', 'website-lead'],
        source: 'Website Assessment'
      })
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
        body: `=== INCOMPLETE ASSESSMENT ===\nStarted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET\nName: ${name || '—'}\nEmail: ${email}\nPhone: ${phone || '—'}\nStatus: Started assessment but did not complete.\n===========================`
      })
    });

    // 3. Find "Incomplete Assessment" pipeline and add opportunity
    // Get all pipelines
    const pipeRes = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`, {
      headers
    });

    if (pipeRes.ok) {
      const pipeData = await pipeRes.json();
      const pipelines = pipeData.pipelines || [];

      // Find pipeline named "Assessment" or create opportunity in first available
      const assessPipeline = pipelines.find(p =>
        p.name.toLowerCase().includes('assessment')
      ) || pipelines[0];

      if (assessPipeline) {
        // Find "Incomplete" stage or use first stage
        const incompleteStage = assessPipeline.stages?.find(s =>
          s.name.toLowerCase().includes('incomplete') ||
          s.name.toLowerCase().includes('started') ||
          s.name.toLowerCase().includes('new')
        ) || assessPipeline.stages?.[0];

        if (incompleteStage) {
          await fetch(`${GHL_BASE}/opportunities`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              pipelineId: assessPipeline.id,
              locationId,
              name: `${firstName || email} — Incomplete Assessment`,
              pipelineStageId: incompleteStage.id,
              status: 'open',
              contactId,
              source: 'Website Assessment'
            })
          });
        }
      }
    }

    return res.json({ success: true, contactId });
  } catch (err) {
    console.error('[capture-lead] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
