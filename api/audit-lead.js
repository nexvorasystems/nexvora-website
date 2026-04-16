/**
 * Nexvora Systems — Website Audit Lead Handler
 * Called when someone submits the website audit widget.
 * 1. Upserts contact in GHL (matches existing by email)
 * 2. Adds to "Website Audit" pipeline → "New Lead" stage
 * 3. Adds a note with website URL + audit report link
 * 4. Optionally sends a follow-up email via GHL
 */

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';
const SITE_URL = (process.env.SITE_URL || 'https://nexvorasystems.us').replace(/\/$/, '');

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
    console.warn('[audit-lead] Missing GHL env vars — skipping CRM');
    return res.json({ success: true, note: 'GHL skipped — env vars not set' });
  }

  const { name, email, websiteUrl, reportUrl, reportId } = req.body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Full name required' });
  }

  const headers = ghlHeaders(apiKey);
  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const auditReportUrl = reportId
    ? `${SITE_URL}/audit/${reportId}`
    : reportUrl || `${SITE_URL}/website-audit.html?url=${encodeURIComponent(websiteUrl || '')}`;

  try {
    // 1. Upsert contact (matches existing by email)
    const contactRes = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        locationId,
        firstName,
        lastName,
        email,
        tags: ['website-audit', 'website-lead'],
        source: 'Website Audit Tool',
        website: websiteUrl || ''
      })
    });

    if (!contactRes.ok) {
      const err = await contactRes.json().catch(() => ({}));
      console.error('[audit-lead] Contact upsert failed:', contactRes.status, JSON.stringify(err));
      return res.status(500).json({ error: 'CRM contact creation failed', detail: err });
    }

    const contactData = await contactRes.json();
    const contactId = contactData.contact?.id;
    if (!contactId) {
      console.error('[audit-lead] No contact ID:', JSON.stringify(contactData));
      return res.status(500).json({ error: 'No contact ID returned from CRM' });
    }

    const isNew = contactData.contact?.dateAdded
      ? (Date.now() - new Date(contactData.contact.dateAdded).getTime() < 10000)
      : false;

    // 2. Add note with website URL + audit link
    const noteBody = `=== WEBSITE AUDIT REQUEST ===
Date: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET

Name: ${name}
Email: ${email}
Website Audited: ${websiteUrl || '(not provided)'}

Audit Report: ${auditReportUrl}

Status: Audit submitted via website widget
Contact: ${isNew ? 'NEW contact created' : 'Existing contact matched'}
==============================`;

    await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: noteBody })
    });

    // 3. Find "Website Audit" pipeline and add opportunity
    const pipelineRes = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`, { headers });
    let pipelineId = null;
    let stageId = null;

    if (pipelineRes.ok) {
      const pipelineData = await pipelineRes.json();
      const pipelines = pipelineData.pipelines || [];

      // Match "Website Audit" pipeline
      const auditPipeline = pipelines.find(p =>
        p.name?.toLowerCase().includes('audit')
      ) || pipelines.find(p =>
        p.name?.toLowerCase().includes('website')
      );

      if (auditPipeline) {
        pipelineId = auditPipeline.id;
        // Find "New Lead" stage or first stage
        const newLeadStage = auditPipeline.stages?.find(s =>
          s.name?.toLowerCase().includes('new') || s.name?.toLowerCase().includes('lead')
        );
        stageId = newLeadStage?.id || auditPipeline.stages?.[0]?.id;
      } else {
        console.warn('[audit-lead] No "Website Audit" pipeline found');
      }
    }

    if (pipelineId && stageId) {
      const oppRes = await fetch(`${GHL_BASE}/opportunities/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          locationId,
          pipelineId,
          pipelineStageId: stageId,
          contactId,
          name: `${name} — Website Audit (${websiteUrl ? new URL(websiteUrl).hostname : 'unknown'})`,
          status: 'open',
          source: 'Website Audit Tool',
          monetaryValue: 0
        })
      });
      if (!oppRes.ok) {
        const err = await oppRes.json().catch(() => ({}));
        console.warn('[audit-lead] Opportunity creation failed:', oppRes.status, JSON.stringify(err));
      }
    }

    // 4. Send follow-up email via GHL
    const emailHtml = `
<div style="font-family:-apple-system,Helvetica,sans-serif;max-width:580px;margin:0 auto;padding:32px 20px;color:#1A1A2E;background:#ffffff;">
  <img src="${SITE_URL}/assets/Logo no background.png" alt="Nexvora Systems" style="height:40px;margin-bottom:28px;"/>
  <h1 style="font-size:22px;font-weight:800;margin:0 0 12px;">Your Website Audit is ready, ${firstName || name}.</h1>
  <p style="font-size:15px;color:#4A5568;line-height:1.7;margin:0 0 16px;">We ran a full performance, SEO, and mobile audit on <strong>${websiteUrl || 'your website'}</strong>.</p>
  <p style="font-size:15px;color:#4A5568;line-height:1.7;margin:0 0 24px;">Your report includes your performance score, Core Web Vitals, SEO health check, and the top issues to fix first.</p>
  <a href="${auditReportUrl}" style="display:inline-block;padding:14px 32px;background:#0D9488;color:#ffffff;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none;margin-bottom:28px;">View Your Audit Report →</a>
  <p style="font-size:13px;color:#718096;line-height:1.6;margin:0 0 4px;">Want us to fix the issues and turn your site into a lead-generating machine?</p>
  <p style="font-size:13px;margin:0 0 24px;"><a href="https://nexvorasystems.us/assessment.html" style="color:#0D9488;font-weight:600;">Get a free business assessment →</a></p>
  <hr style="border:none;border-top:1px solid #E2DDD5;margin:0 0 20px;"/>
  <p style="font-size:12px;color:#A0ADB8;margin:0;">© 2026 Nexvora Systems LLC · Tampa Bay, Florida · <a href="${SITE_URL}/legal/privacy.html" style="color:#A0ADB8;">Privacy Policy</a></p>
</div>`;

    const emailRes = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'Email',
        contactId,
        subject: `Your Website Audit Report — ${websiteUrl ? new URL(websiteUrl).hostname : 'Nexvora Systems'}`,
        html: emailHtml,
        emailFrom: 'info@nexvorasystems.us',
        emailFromName: 'Nexvora Systems'
      })
    });
    if (!emailRes.ok) {
      const err = await emailRes.json().catch(() => ({}));
      console.warn('[audit-lead] Email send failed:', emailRes.status, JSON.stringify(err));
    }

    return res.json({ success: true, contactId });

  } catch (err) {
    console.error('[audit-lead] Unexpected error:', err.message);
    return res.status(500).json({ error: 'CRM integration failed', detail: err.message });
  }
};
