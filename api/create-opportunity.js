/**
 * Nexvora Systems — Create GHL Opportunity after 30-min timer
 * Called from client-side timer when assessment is not completed within 30 minutes.
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

  const { contactId, name, email } = req.body || {};
  if (!contactId) return res.status(400).json({ error: 'contactId required' });

  const headers = ghlHeaders(apiKey);
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
      console.error('[create-opportunity] GHL failed:', oppRes.status);
      return res.status(500).json({ error: 'Failed to create opportunity' });
    }

    // Add a note about the 30-min timeout
    await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        body: `=== ASSESSMENT NOT COMPLETED — 30 MIN TIMER ===\nTime: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET\nStatus: 30 minutes elapsed. User did not complete the assessment.\n===============================================`
      })
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('[create-opportunity] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
