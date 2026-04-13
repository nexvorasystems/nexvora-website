const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';
// Use env var once domain is pointed to Vercel; falls back to Vercel URL
const SITE_URL = (process.env.SITE_URL || 'https://nexvora-website.vercel.app').replace(/\/$/, '');

function ghlHeaders(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Version': GHL_VERSION
  };
}

function formatNote(d) {
  const industryMap = { 'home-services':'Home Services','construction':'Construction','food-bev':'Food & Beverage','retail':'Retail','health-wellness':'Health & Wellness','professional-services':'Professional Services','auto':'Auto Services','real-estate':'Real Estate' };
  const yearsMap = { 'lt1':'< 1 year','1-2':'1–2 years','3-5':'3–5 years','6-10':'6–10 years','10plus':'10+ years' };
  const sizeMap = { 'solo':'Just owner','2-5':'2–5 people','6-15':'6–15 people','16-30':'16–30 people','30plus':'30+ people' };
  const revenueMap = { 'under100k':'Under $100K','100-250k':'$100K–$250K','250-500k':'$250K–$500K','500k-1m':'$500K–$1M','1m-3m':'$1M–$3M','3m-10m':'$3M–$10M','10mplus':'$10M+' };
  const docMap = { 'nothing':'Nothing documented','head':'Key steps in head','notes':'Some basic notes','sops':'Written SOPs','full-sops':'Full SOPs + trained team' };
  const leadSourceMap = { 'referral':'Referrals','google':'Google / SEO','social':'Social Media','ads':'Paid Ads','repeat':'Repeat Customers','cold':'Cold Outreach','events':'Events / Trade Shows','other':'Other' };
  const channelMap = { 'referral':'Referral','google':'Google SEO','social':'Social Media','ads':'Paid Ads','email':'Email Marketing','content':'Content / Blog','events':'Events' };
  const crmMap = { 'none':'No CRM','spreadsheet':'Spreadsheet','basic':'Basic CRM (light use)','active':'Active CRM','full':'Fully utilized CRM+automation' };
  const serviceMap = { 'none':'No tracking','occasional':'Occasional check-in','basic':'Basic feedback','survey':'Formal surveys','nps':'NPS + action system' };
  const reportingMap = { 'none':'No tracking','occasional':'Occasional check','spreadsheet':'Basic spreadsheet','dashboard':'Software dashboard','automated':'Real-time automated' };
  const goalMap = { 'growth':'Scale & grow revenue','profit':'Improve profitability','time':'Free up owner time','team':'Build a stronger team','systems':'Build better systems','exit':'Prepare for exit / sale' };

  const q7Display = d.q7 === 'none' ? 'No repeat customers' : d.q7 === 'dont-know' ? 'Has repeat customers, rate unknown' : `${d.q7}% return rate`;
  const q9Display = Array.isArray(d.q9) ? d.q9.map(v => channelMap[v] || v).join(', ') : (channelMap[d.q9] || d.q9 || '—');
  const q6Display = Array.isArray(d.q6) ? d.q6.map(v => docMap[v] || v).join(', ') : (docMap[d.q6] || d.q6 || '—');
  const q18Display = Array.isArray(d.q18) ? (d.q18.includes('regular') ? 'Regular business hours only' : d.q18.map(v => ({ mornings:'Early mornings', evenings:'Evenings', weekends:'Weekends' }[v] || v)).join(', ')) : '—';

  const ownerPay = typeof d.q16 === 'number' ? `$${d.q16.toLocaleString()}/month` : d.q16 || '—';
  const teamPay = typeof d.q19 === 'number' ? `$${d.q19.toLocaleString()}/month` : d.q19 || '—';

  return `=== NEXVORA ASSESSMENT RESULTS ===
Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET

--- CONTACT ---
Name: ${d.contact?.name || '—'}
Email: ${d.contact?.email || '—'}
Phone: ${d.contact?.phone || '—'}
Company: ${d.contact?.company || '—'}

--- BUSINESS PROFILE ---
Industry: ${industryMap[d.q1] || d.q1 || '—'}
State: ${d.q2 || '—'}
Years in Business: ${yearsMap[d.q3] || d.q3 || '—'}
Annual Revenue: ${revenueMap[d.q4] || d.q4 || '—'}
Team Size: ${sizeMap[d.q5] || d.q5 || '—'}

--- OPERATIONS ---
Process Documentation: ${q6Display}
Repeat Customer Rate: ${q7Display}
Primary Lead Source: ${industryMap[d.q8] || d.q8 || '—'}
Marketing Channels: ${q9Display}

--- SYSTEMS ---
CRM / Sales Tracking: ${crmMap[d.q10] || d.q10 || '—'}
Customer Follow-Up: ${d.q11 || '—'}
After-Sale Service: ${serviceMap[d.q12] || d.q12 || '—'}
Biggest Challenge: ${d.q13 || '—'}
Reporting: ${reportingMap[d.q14] || d.q14 || '—'}
Primary Goal: ${goalMap[d.q15] || d.q15 || '—'}

--- OWNER ECONOMICS ---
Owner Pay: ${ownerPay}
Owner Hours/Week (total): ${d.q17 || '—'} hrs
  - Regular weekday hours: ${d.q17_regular || 40} hrs
  - Extra time: ${q18Display}
Team Payroll: ${teamPay}

--- AI SUMMARY ---
${d.ai_summary || '(not generated)'}

--- BENCHMARK NARRATIVE ---
${d.ai_benchmark || '(not generated)'}
===================================`;
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
    console.warn('[GHL] Missing GHL_API_KEY or GHL_LOCATION_ID — skipping');
    return res.json({ success: true, note: 'GHL skipped — env vars not set' });
  }

  const d = req.body;
  if (!d?.contact?.email) return res.status(400).json({ error: 'contact.email required' });

  const headers = ghlHeaders(apiKey);
  const nameParts = (d.contact.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  try {
    // 1. Upsert contact
    const contactRes = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        locationId,
        firstName,
        lastName,
        email: d.contact.email,
        phone: d.contact.phone || '',
        companyName: d.contact.company || '',
        state: d.q2 || '',
        tags: ['assessment-complete', 'website-lead'],
        source: 'Website Assessment'
      })
    });

    if (!contactRes.ok) {
      const err = await contactRes.json().catch(() => ({}));
      console.error('[GHL] Contact upsert failed:', contactRes.status, JSON.stringify(err));
      return res.status(500).json({ error: 'GHL contact creation failed', detail: err });
    }

    const contactData = await contactRes.json();
    const contactId = contactData.contact?.id;
    if (!contactId) {
      console.error('[GHL] No contact ID returned:', JSON.stringify(contactData));
      return res.status(500).json({ error: 'GHL did not return contact ID' });
    }

    // 2. Add note with full assessment
    const noteRes = await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: formatNote(d) })
    });
    if (!noteRes.ok) {
      const err = await noteRes.json().catch(() => ({}));
      console.warn('[GHL] Note creation failed:', noteRes.status, JSON.stringify(err));
      // Non-fatal — continue to opportunity creation
    }

    // 3. Get pipeline ID + stage ID for "Assessment" / "Assessment Submitted"
    const pipelineRes = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`, { headers });
    let pipelineId = null;
    let stageId = null;

    if (pipelineRes.ok) {
      const pipelineData = await pipelineRes.json();
      const pipelines = pipelineData.pipelines || [];
      const assessmentPipeline = pipelines.find(p => p.name?.toLowerCase().includes('assessment'));
      if (assessmentPipeline) {
        pipelineId = assessmentPipeline.id;
        const submittedStage = assessmentPipeline.stages?.find(s =>
          s.name?.toLowerCase().includes('submitted') || s.name?.toLowerCase().includes('new')
        );
        stageId = submittedStage?.id || assessmentPipeline.stages?.[0]?.id;
      }
    }

    // 4. Create opportunity
    if (pipelineId && stageId) {
      const companyLabel = d.contact.company || d.contact.name || 'Unknown';
      const oppRes = await fetch(`${GHL_BASE}/opportunities/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          locationId,
          pipelineId,
          pipelineStageId: stageId,
          contactId,
          name: `${companyLabel} — Assessment`,
          status: 'open',
          source: 'Website Assessment',
          monetaryValue: 0
        })
      });
      if (!oppRes.ok) {
        const err = await oppRes.json().catch(() => ({}));
        console.warn('[GHL] Opportunity creation failed:', oppRes.status, JSON.stringify(err));
        // Non-fatal
      }
    } else {
      console.warn('[GHL] Could not find Assessment pipeline — opportunity not created');
    }

    // 5. Send email via GHL Conversations API
    const reportUrl = d.reportUrl || `${SITE_URL}/report.html`;
    const first = firstName || d.contact.name || 'there';
    const bizLabel = d.contact.company || d.contact.name || 'your business';
    const revenueMap = { 'under100k':'Under $100K','100-250k':'$100K–$250K','250-500k':'$250K–$500K','500k-1m':'$500K–$1M','1m-3m':'$1M–$3M','3m-10m':'$3M–$10M','10mplus':'$10M+' };
    const revenueLabel = revenueMap[d.q4] || '';

    const emailHtml = `
<div style="font-family:-apple-system,Helvetica,sans-serif;max-width:580px;margin:0 auto;padding:32px 20px;color:#1A1A2E;background:#ffffff;">
  <img src="${SITE_URL}/assets/Logo no background.png" alt="Nexvora Systems" style="height:40px;margin-bottom:28px;"/>
  <h1 style="font-size:22px;font-weight:800;margin:0 0 12px;">Your Business Health Report is ready, ${first}.</h1>
  <p style="font-size:15px;color:#4A5568;line-height:1.7;margin:0 0 8px;">Thank you for completing the Nexvora assessment for <strong>${bizLabel}</strong>.</p>
  ${revenueLabel ? `<p style="font-size:15px;color:#4A5568;line-height:1.7;margin:0 0 20px;">Your personalized report includes an owner economics breakdown, area-by-area scoring, and a prioritized action plan based on your ${revenueLabel} business profile.</p>` : ''}
  <a href="${reportUrl}" style="display:inline-block;padding:14px 32px;background:#0D9488;color:#ffffff;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none;margin-bottom:28px;">View Your Report →</a>
  <p style="font-size:13px;color:#718096;line-height:1.6;margin:0 0 4px;">Murat and Alexandr personally review every assessment. If you'd like to talk through your results:</p>
  <p style="font-size:13px;margin:0 0 24px;"><a href="https://api.leadconnectorhq.com/widget/booking/bGQ7oVjEW8HdbcQYTTUF" style="color:#0D9488;font-weight:600;">Schedule a free strategy call →</a></p>
  <hr style="border:none;border-top:1px solid #E2DDD5;margin:0 0 20px;"/>
  <p style="font-size:12px;color:#A0ADB8;margin:0;">© 2026 Nexvora Systems LLC · Tampa Bay, Florida · <a href="${SITE_URL}/legal/privacy.html" style="color:#A0ADB8;">Privacy Policy</a></p>
</div>`;

    const emailRes = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'Email',
        contactId,
        subject: `Your Nexvora Business Report — ${bizLabel}`,
        html: emailHtml,
        emailFrom: 'info@nexvorasystems.us',
        emailFromName: 'Nexvora Systems'
      })
    });
    if (!emailRes.ok) {
      const err = await emailRes.json().catch(() => ({}));
      console.warn('[GHL] Email send failed:', emailRes.status, JSON.stringify(err));
    } else {
      console.log('[GHL] Email sent successfully');
    }

    // 6. Send SMS via GHL (only if phone number provided)
    if (d.contact.phone) {
      const smsReportUrl = reportUrl; // same URL as email — includes report ID or base64 data
      const smsBody = `Hi ${first}! Your Nexvora Business Health Report is ready. View it here: ${smsReportUrl}\n\nQuestions? Book a free strategy call: https://api.leadconnectorhq.com/widget/booking/bGQ7oVjEW8HdbcQYTTUF`;
      const smsRes = await fetch(`${GHL_BASE}/conversations/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'SMS',
          contactId,
          message: smsBody
        })
      });
      if (!smsRes.ok) {
        const err = await smsRes.json().catch(() => ({}));
        console.warn('[GHL] SMS send failed:', smsRes.status, JSON.stringify(err));
      } else {
        console.log('[GHL] SMS sent successfully');
      }
    }

    return res.json({ success: true, contactId });

  } catch (err) {
    console.error('[GHL] Unexpected error:', err.message);
    return res.status(500).json({ error: 'GHL integration failed', detail: err.message });
  }
};
