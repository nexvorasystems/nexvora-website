const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';
const SITE_URL = (process.env.SITE_URL || 'https://nexvora-website.vercel.app').replace(/\/$/, '');

function ghlHeaders(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Version': GHL_VERSION
  };
}

const TOPIC_LABELS = {
  assessment: 'Understanding assessment results',
  strategy: 'Book a strategy session',
  services: 'Learn about services',
  partnership: 'Partnership inquiry',
  other: 'Other'
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GHL_API_KEY?.trim();
  const locationId = process.env.GHL_LOCATION_ID?.trim();

  if (!apiKey || !locationId) {
    console.warn('[contact] Missing GHL env vars');
    return res.json({ success: true, note: 'GHL skipped' });
  }

  const d = req.body;
  if (!d?.email) return res.status(400).json({ error: 'email required' });

  const headers = ghlHeaders(apiKey);
  const topicLabel = TOPIC_LABELS[d.topic] || d.topic || 'General Inquiry';

  try {
    // 1. Upsert contact
    const contactRes = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        locationId,
        firstName: d.firstName || '',
        lastName: d.lastName || '',
        email: d.email,
        phone: d.phone || '',
        companyName: d.company || '',
        tags: ['contact-form', 'website-lead'],
        source: 'Contact Form'
      })
    });

    if (!contactRes.ok) {
      const err = await contactRes.json().catch(() => ({}));
      console.error('[contact] Contact upsert failed:', contactRes.status, JSON.stringify(err));
      return res.status(500).json({ error: 'GHL contact creation failed' });
    }

    const contactData = await contactRes.json();
    const contactId = contactData.contact?.id;
    if (!contactId) {
      console.error('[contact] No contact ID returned');
      return res.status(500).json({ error: 'GHL did not return contact ID' });
    }

    // 2. Add note with message
    const noteBody = `=== CONTACT FORM SUBMISSION ===
Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET

Name: ${d.firstName} ${d.lastName}
Email: ${d.email}
Phone: ${d.phone || '—'}
Company: ${d.company || '—'}
Topic: ${topicLabel}

Message:
${d.message || '—'}
================================`;

    await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: noteBody })
    }).catch(e => console.warn('[contact] Note failed:', e.message));

    // 3. Create opportunity in "Contact Form" pipeline
    const pipelineRes = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`, { headers });
    if (pipelineRes.ok) {
      const pipelineData = await pipelineRes.json();
      const pipelines = pipelineData.pipelines || [];
      const pipeline = pipelines.find(p => p.name?.toLowerCase().includes('contact'));
      if (pipeline) {
        const stage = pipeline.stages?.find(s =>
          s.name?.toLowerCase().includes('new') || s.name?.toLowerCase().includes('submitted')
        ) || pipeline.stages?.[0];
        if (stage) {
          await fetch(`${GHL_BASE}/opportunities/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              locationId,
              pipelineId: pipeline.id,
              pipelineStageId: stage.id,
              contactId,
              name: `${d.company || d.firstName + ' ' + d.lastName} — ${topicLabel}`,
              status: 'open',
              source: 'Contact Form',
              monetaryValue: 0
            })
          }).catch(e => console.warn('[contact] Opportunity failed:', e.message));
        }
      } else {
        console.warn('[contact] No "Contact Form" pipeline found — opportunity skipped');
      }
    }

    // 4. Send confirmation email
    const firstName = d.firstName || 'there';
    const emailHtml = `
<div style="font-family:-apple-system,Helvetica,sans-serif;max-width:580px;margin:0 auto;padding:32px 20px;color:#1A1A2E;background:#ffffff;">
  <img src="${SITE_URL}/assets/Logo no background.png" alt="Nexvora Systems" style="height:40px;margin-bottom:28px;"/>
  <h1 style="font-size:22px;font-weight:800;margin:0 0 12px;">Thank you for contacting us, ${firstName}.</h1>
  <p style="font-size:15px;color:#4A5568;line-height:1.7;margin:0 0 16px;">We received your message and someone from our team will reach out to you as soon as possible.</p>
  <p style="font-size:15px;color:#4A5568;line-height:1.7;margin:0 0 24px;">Please check your inbox — and your spam folder just in case.</p>
  <p style="font-size:13px;color:#718096;line-height:1.6;margin:0 0 8px;">In the meantime, you can get a personalized picture of how your business is performing with our free assessment:</p>
  <a href="${SITE_URL}/assessment.html" style="display:inline-block;padding:14px 32px;background:#0D9488;color:#ffffff;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none;margin-bottom:28px;">Take the Free Assessment →</a>
  <hr style="border:none;border-top:1px solid #E2DDD5;margin:0 0 20px;"/>
  <p style="font-size:12px;color:#A0ADB8;margin:0;">© 2026 Nexvora Systems LLC · Tampa Bay, Florida · <a href="${SITE_URL}/legal/privacy.html" style="color:#A0ADB8;">Privacy Policy</a></p>
</div>`;

    const emailRes = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'Email',
        contactId,
        subject: 'We received your message — Nexvora Systems',
        html: emailHtml,
        emailFrom: 'info@nexvorasystems.us',
        emailFromName: 'Nexvora Systems'
      })
    });

    if (!emailRes.ok) {
      const err = await emailRes.json().catch(() => ({}));
      console.warn('[contact] Email send failed:', emailRes.status, JSON.stringify(err));
    } else {
      console.log('[contact] Confirmation email sent');
    }

    return res.json({ success: true, contactId });

  } catch (err) {
    console.error('[contact] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Contact submission failed', detail: err.message });
  }
};
