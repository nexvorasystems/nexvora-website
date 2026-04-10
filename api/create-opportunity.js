/**
 * Nexvora Systems — Create GHL Opportunity when assessment is not finished.
 * Triggered immediately when user closes/leaves the page (via sendBeacon),
 * or after 30-min timer as a fallback.
 * Places contact in "NOT FINISHED ASSESMENT" pipeline → "New Lead" stage.
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

  let { contactId, name, email } = req.body || {};
  if (!contactId && !email) return res.status(400).json({ error: 'contactId or email required' });

  const headers = ghlHeaders(apiKey);

  // If no contactId, look up contact by email
  if (!contactId && email) {
    try {
      const searchRes = await fetch(
        `${GHL_BASE}/contacts/?locationId=${locationId}&email=${encodeURIComponent(email)}`,
        { headers }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        contactId = searchData.contacts?.[0]?.id;
      }
    } catch (e) {
      console.warn('[create-opportunity] email lookup failed:', e.message);
    }
  }

  if (!contactId) {
    console.error('[create-opportunity] could not resolve contactId for email:', email);
    return res.status(400).json({ error: 'Could not find contact' });
  }

  const displayName = (name || email || 'Unknown').split(' ')[0];

  try {
    // Find "NOT FINISHED ASSESMENT" pipeline
    const pipeRes = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`, { headers });
    if (!pipeRes.ok) return res.status(500).json({ error: 'Failed to fetch pipelines' });

    const pipeData = await pipeRes.json();
    const pipelines = pipeData.pipelines || [];

    const targetPipeline = pipelines.find(p => {
      const n = p.name.toLowerCase();
      return n.includes('not finished') || n.includes('assesment') || n.includes('incomplete');
    }) || pipelines[0];

    if (!targetPipeline) return res.status(500).json({ error: 'No pipeline found' });

    const newLeadStage = targetPipeline.stages?.find(s =>
      s.name.toLowerCase().includes('new lead') ||
      s.name.toLowerCase().includes('new') ||
      s.name.toLowerCase().includes('lead')
    ) || targetPipeline.stages?.[0];

    if (!newLeadStage) return res.status(500).json({ error: 'No stage found' });

    // Create the opportunity
    const oppRes = await fetch(`${GHL_BASE}/opportunities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pipelineId: targetPipeline.id,
        locationId,
        name: `${displayName} — Assessment Not Finished`,
        pipelineStageId: newLeadStage.id,
        status: 'open',
        contactId,
        source: 'Website Assessment'
      })
    });

    if (!oppRes.ok) {
      const body = await oppRes.text();
      console.error('[create-opportunity] GHL failed:', oppRes.status, body);
      return res.status(500).json({ error: 'Failed to create opportunity' });
    }

    // Add a note
    await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        body: `=== LEFT ASSESSMENT WITHOUT FINISHING ===\nTime: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET\nStatus: User left or closed the page before completing the assessment.\n=========================================`
      })
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('[create-opportunity] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
