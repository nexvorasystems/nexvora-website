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
  const yearsMap = { 'lt1':'< 1 year','1-2':'1–2 years','3-5':'3–5 years','6-10':'6–10 years','10plus':'10+ years' };
  const sizeMap = { 'solo':'Just owner (solo)','partner':'Owner + partner','team':'Has a team','2-5':'2–5 people','6-15':'6–15 people','16-30':'16–30 people','30plus':'30+ people' };
  const docMap = { 'nothing':'Nothing documented','head':'Key steps in head','notes':'Some basic notes','sops':'Written SOPs','full-sops':'Full SOPs + trained team' };
  const channelMap = { 'referral':'Referral','google':'Google SEO','social':'Social Media','ads':'Paid Ads','email':'Email Marketing','content':'Content / Blog','events':'Events' };
  const manualMap = { 'invoicing':'Invoicing','scheduling':'Scheduling','estimates':'Estimates/quotes','follow-up':'Follow-up','payroll':'Payroll','reporting':'Reporting','ordering':'Ordering/purchasing','other':'Other' };
  const serviceMap = { 'none':'No tracking','occasional':'Occasional check-in','basic':'Basic feedback','survey':'Formal surveys','nps':'NPS + action system' };
  const reportingMap = { 'none':'No tracking','occasional':'Occasional check','spreadsheet':'Basic spreadsheet','dashboard':'Software dashboard','automated':'Real-time automated' };
  const goalMap = { 'growth':'Scale & grow revenue','profit':'Improve profitability','time':'Free up owner time','team':'Build a stronger team','systems':'Build better systems','exit':'Prepare for exit / sale' };
  const leadSourceMap = { 'referral':'Referrals','google':'Google / SEO','social':'Social Media','ads':'Paid Ads','repeat':'Repeat Customers','cold':'Cold Outreach','events':'Events / Trade Shows','other':'Other' };

  // Revenue multi-year summary
  const revYears = d.q4_years || {};
  const revParts = [
    revYears.y3 ? `3yr ago: ${revYears.y3}` : null,
    revYears.y2 ? `2yr ago: ${revYears.y2}` : null,
    revYears.y1 ? `Last yr: ${revYears.y1}` : null,
    revYears.y0 ? `This yr YTD: ${revYears.y0}` : null,
    revYears.yn ? `Next yr goal: ${revYears.yn}` : null,
  ].filter(Boolean);
  const revenueDisplay = revParts.length ? revParts.join(' | ') : (d.q4 || '—');

  // Team size + headcount
  const teamSizeLabel = sizeMap[d.q5] || d.q5 || '—';
  const headcount = d.q19_headcount ? ` (${d.q19_headcount} people)` : '';

  // Repeat customer rate
  const q7Display = d.q7 === 'yes' ? 'Yes — strong repeat business' : d.q7 === 'sometimes' ? 'Sometimes' : d.q7 === 'no' ? 'No / one-time buyers' : d.q7 || '—';

  // Marketing channels (array)
  const q9Display = Array.isArray(d.q9) ? d.q9.map(v => channelMap[v] || v).join(', ') : (channelMap[d.q9] || d.q9 || '—');

  // Process documentation (array)
  const q6Display = Array.isArray(d.q6) ? d.q6.map(v => docMap[v] || v).join(', ') : (docMap[d.q6] || d.q6 || '—');

  // Extra hours
  const q18Display = Array.isArray(d.q18) ? (d.q18.includes('regular') ? 'Regular hours only' : d.q18.map(v => ({ mornings:'Early mornings', evenings:'Evenings', weekends:'Weekends' }[v] || v)).join(', ')) : '—';

  // Manual tasks (array + other text)
  const manualArr = Array.isArray(d.q11) ? d.q11.map(v => manualMap[v] || v) : [];
  if (d.q11_other) manualArr.push(`Other: ${d.q11_other}`);
  const q11Display = manualArr.length ? manualArr.join(', ') : '—';

  // After-sale service (array)
  const q12Display = Array.isArray(d.q12) ? d.q12.map(v => serviceMap[v] || v).join(', ') : (serviceMap[d.q12] || d.q12 || '—');

  // Primary goals (array)
  const q15Display = Array.isArray(d.q15) ? d.q15.map(v => goalMap[v] || v).join(', ') : (goalMap[d.q15] || d.q15 || '—');
  const goal3yrDisplay = Array.isArray(d.goal_3yr) ? d.goal_3yr.join(', ') : (d.goal_3yr || '—');
  const goal5yrDisplay = Array.isArray(d.q15b) ? d.q15b.join(', ') : (d.q15b || '—');

  // Owner pay breakdown
  const ownerPay = d.owner_pay || {};
  const ownerPayLines = Object.values(ownerPay).map(p => {
    if (!p || !p.label) return null;
    const mo = p.monthly ? `$${Number(p.monthly).toLocaleString()}/mo` : '';
    return `${p.label}: ${mo}`;
  }).filter(Boolean);
  const ownerPayTotal = Object.values(ownerPay).reduce((s, p) => s + (p?.monthly || 0), 0);
  const ownerPayDisplay = ownerPayLines.length
    ? ownerPayLines.join(' | ') + ` (Total: $${Math.round(ownerPayTotal).toLocaleString()}/mo)`
    : '—';

  // Team payroll
  const teamPay = d.q19_total ? `$${Number(d.q19_total).toLocaleString()}/month` : '—';

  // Expense breakdown
  const expLines = Object.entries(d.expense_breakdown || {}).filter(([,v]) => v != null).map(([k,v]) => `${k} ${v}%`).join(', ');

  // Partner info
  const partnerDisplay = d.partner?.has ? `Yes — Op. Agreement: ${d.partner.opAgreement || 'not answered'}` : 'No';

  // Banking
  const bankDisplay = d.bank_personal_biz === 'yes' ? 'Separated' : d.bank_personal_biz === 'partial' ? 'Partial (mixed)' : d.bank_personal_biz === 'no' ? 'NOT separated (mixed personal+business)' : '—';
  const bankAccTypes = Array.isArray(d.bank_account_types) ? d.bank_account_types.join(', ') : '—';

  return `=== NEXVORA ASSESSMENT RESULTS ===
Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET

--- CONTACT ---
Name: ${d.contact?.name || '—'}
Email: ${d.contact?.email || '—'}
Phone: ${d.contact?.phone || '—'}
Company: ${d.contact?.company || '—'}

--- BUSINESS PROFILE ---
Industry: ${d.q1b_label || d.q1 || '—'}
Location: ${[d.q2_city, d.q2].filter(Boolean).join(', ') || '—'}
Years in Business: ${yearsMap[d.q3] || d.q3 || '—'}
Revenue (multi-year): ${revenueDisplay}
Growth Target: ${d.growth_target_pct ? `+${d.growth_target_pct}%` : '—'}
Primary Pain: ${d.primaryPain || '—'}
Team Structure: ${teamSizeLabel}${headcount}
Avg Transaction Value: ${d.avg_check ? `$${Number(d.avg_check).toLocaleString()}` : '—'}
Business Partner: ${partnerDisplay}

--- FINANCIALS ---
Cash Flow: ${d.cash_flow || '—'}
Has P&L: ${d.has_pl || '—'}
Expense Breakdown: ${expLines || '—'}

--- BANKING ---
Personal/Business Separation: ${bankDisplay}
${d.bank_personal_biz === 'yes' ? `Multi-Purpose Accounts: ${d.bank_multi_accounts === 'yes' ? 'Yes' : 'No (single account)'}` : ''}${d.bank_multi_accounts === 'yes' ? `\nAccount Types: ${bankAccTypes}` : ''}

--- OPERATIONS ---
Process Documentation: ${q6Display}
Repeat Customers: ${q7Display}
Primary Lead Source: ${leadSourceMap[d.q8] || d.q8 || '—'}
Marketing Channels: ${q9Display}
Closing Rate: ${d.q9_close ? `${d.q9_close}%` : '—'}
Monthly Ad Spend: ${d.q9_adspend ? `$${Number(d.q9_adspend).toLocaleString()}` : '—'}

--- SYSTEMS ---
Manual Tasks (no automation): ${q11Display}
After-Sale Service: ${q12Display}
Biggest Challenge: ${d.q_pain || d.q13 || '—'}
Reporting / Dashboard: ${reportingMap[d.q14] || d.q14 || '—'}
Review Monitoring: ${d.review_monitoring || '—'}
Review Requests: ${d.review_requests || '—'}
Avg Star Rating: ${d.q10 ? `${d.q10} ★` : '—'}
Primary Goals: ${q15Display}
3-Year Goal: ${goal3yrDisplay}
5-Year Goal: ${goal5yrDisplay}

--- OWNER ECONOMICS ---
Owner Pay (breakdown): ${ownerPayDisplay}
Owner Pay Enough: ${d.owner_pay_enough || '—'}
Owner Hours/Week: ${d.q17 || '—'} hrs
Extra Time: ${q18Display}
Team Payroll: ${teamPay}

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

    // Build revenue summary from multi-year object
    const revY = d.q4_years || {};
    const revSummaryParts = [
      revY.y1 ? `Last Year: ${revY.y1}` : null,
      revY.y0 ? `This Year YTD: ${revY.y0}` : null,
    ].filter(Boolean);
    const revenueLabel = revSummaryParts.join(' · ');

    // Industry for context line
    const industryLabel = d.q1b_label || d.q1 || '';

    const emailHtml = `
<div style="font-family:-apple-system,Helvetica,sans-serif;max-width:580px;margin:0 auto;padding:32px 20px;color:#1A1A2E;background:#ffffff;">
  <img src="${SITE_URL}/assets/Logo%20no%20background.png" alt="Nexvora Systems" style="height:40px;margin-bottom:28px;display:block;"/>
  <h1 style="font-size:22px;font-weight:800;margin:0 0 12px;">Your Business Health Report is ready, ${first}.</h1>
  <p style="font-size:15px;color:#4A5568;line-height:1.7;margin:0 0 8px;">Thank you for completing the Nexvora assessment for <strong>${bizLabel}</strong>${industryLabel ? ` (${industryLabel})` : ''}.</p>
  <p style="font-size:15px;color:#4A5568;line-height:1.7;margin:0 0 20px;">Your report is ready — open it to see your scores, what's working, what needs attention, and a prioritized action plan built specifically for ${bizLabel}.</p>
  <a href="${reportUrl}" style="display:inline-block;padding:14px 32px;background:#0D9488;color:#ffffff;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none;margin-bottom:28px;">View Your Report &#8594;</a>
  <p style="font-size:13px;color:#718096;line-height:1.6;margin:0 0 4px;">Murat and Alexandr personally review every assessment. If you'd like to talk through your results:</p>
  <p style="font-size:13px;margin:0 0 24px;"><a href="https://api.leadconnectorhq.com/widget/booking/bGQ7oVjEW8HdbcQYTTUF" style="color:#0D9488;font-weight:600;">Schedule a free strategy call &#8594;</a></p>
  <hr style="border:none;border-top:1px solid #E2DDD5;margin:0 0 20px;"/>
  <p style="font-size:12px;color:#A0ADB8;margin:0;">&#169; 2026 Nexvora Systems LLC &middot; Tampa Bay, Florida &middot; <a href="${SITE_URL}/legal/privacy.html" style="color:#A0ADB8;text-decoration:underline;">Privacy Policy</a></p>
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

    // 7. Create GHL profiles for business partners and send them the report
    const partners = d.partners || [];
    const partnersWithEmail = partners.filter(p => p.email);
    const createdPartners = [];

    for (const partner of partnersWithEmail) {
      try {
        const pParts = (partner.name || '').trim().split(/\s+/);
        const pFirst = pParts[0] || '';
        const pLast = pParts.slice(1).join(' ') || '';

        // Upsert partner as GHL contact
        const pRes = await fetch(`${GHL_BASE}/contacts/upsert`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            locationId,
            firstName: pFirst,
            lastName: pLast,
            email: partner.email,
            companyName: d.contact.company || '',
            state: d.q2 || '',
            tags: ['business-partner', 'assessment-complete'],
            source: 'Website Assessment — Business Partner'
          })
        });

        if (!pRes.ok) { console.warn('[GHL] Partner upsert failed:', partner.name); continue; }
        const pData = await pRes.json();
        const pId = pData.contact?.id;
        if (!pId) continue;

        createdPartners.push({ name: partner.name, email: partner.email, id: pId });

        // Add note to partner profile
        const involvementMap = { both:'Hands-on daily', specific:'Specific area', strategic:'Strategic / part-time', silent:'Silent partner' };
        const pNote = `=== BUSINESS PARTNER PROFILE ===
Created via assessment: ${new Date().toLocaleString('en-US',{timeZone:'America/New_York'})} ET

Partner: ${partner.name || '—'} | Role: ${partner.role || '—'} | Involvement: ${involvementMap[partner.involvement]||partner.involvement||'—'}

Business: ${d.contact.company || '—'} (${d.q1b_label||d.q1||'—'})
Location: ${[d.q2_city,d.q2].filter(Boolean).join(', ')||'—'}
Primary contact: ${d.contact.name||'—'} (${d.contact.email||'—'})
Report: ${reportUrl}
================================`;

        await fetch(`${GHL_BASE}/contacts/${pId}/notes`, {
          method: 'POST', headers,
          body: JSON.stringify({ body: pNote })
        }).catch(e => console.warn('[GHL] Partner note failed:', e.message));

        // Send report email to partner
        const pEmailHtml = `
<div style="font-family:-apple-system,Helvetica,sans-serif;max-width:580px;margin:0 auto;padding:32px 20px;color:#1A1A2E;background:#ffffff;">
  <img src="${SITE_URL}/assets/Logo%20no%20background.png" alt="Nexvora Systems" style="height:40px;margin-bottom:28px;display:block;"/>
  <h1 style="font-size:22px;font-weight:800;margin:0 0 12px;">Business Health Report — ${d.contact.company||d.contact.name}</h1>
  <p style="font-size:15px;color:#4A5568;line-height:1.7;margin:0 0 12px;">Hi ${pFirst}, ${d.contact.name||'your business partner'} completed a Nexvora business assessment for <strong>${d.contact.company||'your business'}</strong> and shared this report with you.</p>
  <p style="font-size:15px;color:#4A5568;line-height:1.7;margin:0 0 20px;">The report covers scores across 9 business areas, financial analysis, and a prioritized action plan. It's worth a read before your next partner conversation.</p>
  <a href="${reportUrl}" style="display:inline-block;padding:14px 32px;background:#0D9488;color:#ffffff;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none;margin-bottom:28px;">View the Report &#8594;</a>
  <hr style="border:none;border-top:1px solid #E2DDD5;margin:0 0 20px;"/>
  <p style="font-size:12px;color:#A0ADB8;margin:0;">&#169; 2026 Nexvora Systems LLC &middot; <a href="${SITE_URL}/legal/privacy.html" style="color:#A0ADB8;text-decoration:underline;">Privacy Policy</a></p>
</div>`;

        await fetch(`${GHL_BASE}/conversations/messages`, {
          method: 'POST', headers,
          body: JSON.stringify({
            type: 'Email',
            contactId: pId,
            subject: `Business Health Report — ${d.contact.company||d.contact.name}`,
            html: pEmailHtml,
            emailFrom: 'info@nexvorasystems.us',
            emailFromName: 'Nexvora Systems'
          })
        }).catch(e => console.warn('[GHL] Partner email failed:', e.message));

        console.log('[GHL] Partner profile created + email sent:', partner.name);
      } catch(e) {
        console.warn('[GHL] Partner processing error:', partner.name, e.message);
      }
    }

    // Add summary note to main lead if partners were created
    if (createdPartners.length > 0) {
      const summaryNote = `PARTNER PROFILES CREATED IN CRM:\n${createdPartners.map(p=>`• ${p.name} (${p.email})`).join('\n')}\n\nReport sent to all partners above.`;
      await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
        method: 'POST', headers,
        body: JSON.stringify({ body: summaryNote })
      }).catch(e => console.warn('[GHL] Partner summary note failed:', e.message));
    }

    return res.json({ success: true, contactId, partnersCreated: createdPartners.length });

  } catch (err) {
    console.error('[GHL] Unexpected error:', err.message);
    return res.status(500).json({ error: 'GHL integration failed', detail: err.message });
  }
};
