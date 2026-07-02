/**
 * Nexvora Systems — Unified Report Saver
 *
 * POST /api/save-report  { contact, ...data }
 *   → Generates an ID, saves to reports table, returns { id }
 *   (used by assessment.html)
 *
 * POST /api/save-report  { id, contact, scores, issues, seoChecks }
 *   → Uses the provided ID, saves to reports table, returns { success, id }
 *   (replaces the old /api/save-audit endpoint, used by website-audit.html)
 *
 * Also syncs assessment responses to Notion (fire-and-forget).
 * Env vars: NOTION_TOKEN, NOTION_ASSESSMENTS_DB_ID
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB_ID = process.env.NOTION_ASSESSMENTS_DB_ID;

// ── Notion sync (fire-and-forget, assessment only) ────────────────────────────
async function syncToNotion(id, data) {
  if (!NOTION_TOKEN || !NOTION_DB_ID) return;
  const d = data || {};
  const contact = d.contact || {};
  const revYears = d.q4_years || {};
  const revLines = Object.entries(revYears).filter(([,v])=>v)
    .map(([k,v])=>({y3:'3yr ago',y2:'2yr ago',y1:'Last yr',y0:'This yr YTD',yn:'Next yr goal'}[k]||k)+': '+v)
    .join(' | ');

  // Build expense summary text
  const expLines = Object.entries(d.expense_breakdown||{}).filter(([,v])=>v!==null)
    .map(([k,v])=>`${k} ${v}%`).join(', ');

  // Owner pay summary
  const ownerPayTotal = Object.values(d.owner_pay||{}).reduce((s,v)=>s+(v.monthly||0),0);
  const ownerPayAnnual = ownerPayTotal * 12;

  // Goals
  const goals12 = Array.isArray(d.q15) ? d.q15.join(', ') : (d.q15||'');

  const properties = {
    'Name':        { title: [{ text: { content: contact.name || 'Unknown' } }] },
    'Email':       { email: contact.email || null },
    'Phone':       { phone_number: contact.phone || null },
    'Company':     { rich_text: [{ text: { content: contact.company || '' } }] },
    'Industry':    { select: { name: (d.q1b_label || d.q1 || 'Unknown').slice(0,100) } },
    'Location':    { rich_text: [{ text: { content: [d.q2_city, d.q2].filter(Boolean).join(', ') } }] },
    'Years in Biz':{ select: { name: d.q3 || 'unknown' } },
    'Revenue':     { rich_text: [{ text: { content: revLines || d.q4 || '' } }] },
    'Growth Target':{ number: d.growth_target_pct || null },
    'Primary Pain':{ select: { name: d.primaryPain || 'unknown' } },
    'Team Structure':{ select: { name: d.q5 || 'unknown' } },
    'Avg Check':   { number: d.avg_check || null },
    'Cash Flow':   { select: { name: d.cash_flow || 'unknown' } },
    'P&L':         { select: { name: d.has_pl || 'unknown' } },
    'Owner Pay Mo':{ number: ownerPayTotal || null },
    'Owner Pay Yr':{ number: ownerPayAnnual || null },
    'Pay Enough':  { select: { name: d.owner_pay_enough || 'unknown' } },
    'Hours/Week':  { number: d.q17 || null },
    'Goals 12mo':  { rich_text: [{ text: { content: goals12 } }] },
    'Goal 3yr':    { rich_text: [{ text: { content: (Array.isArray(d.goal_3yr) ? d.goal_3yr.join(', ') : d.goal_3yr) || '' } }] },
    'Goal 5yr':    { rich_text: [{ text: { content: (Array.isArray(d.q15b) ? d.q15b.join(', ') : d.q15b) || '' } }] },
    'Closing Rate':{ number: d.q9_close || null },
    'Ad Spend/mo': { number: d.q9_adspend || null },
    'Expense Split':{ rich_text: [{ text: { content: expLines } }] },
    'Materials %':  { number: d.materials_pct || null },
    'Materials Markup %': { number: d.materials_markup_pct || null },
    'Team Payroll':{ number: d.q19_total || null },
    'Team Count':  { number: d.q19_headcount || null },
    'Has Partner': { checkbox: !!(d.partner?.has) },
    'Report ID':   { rich_text: [{ text: { content: id } }] },
    'Report URL':  { url: `https://nexvorasystems.us/r/${id}` },
    'Date':        { date: { start: new Date().toISOString() } },
    'Biggest Pain':{ rich_text: [{ text: { content: (d.q_pain || '').slice(0,2000) } }] },
  };

  // Remove null email/phone (Notion rejects null for those types)
  if (!contact.email) delete properties['Email'];
  if (!contact.phone) delete properties['Phone'];

  try {
    await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DB_ID },
        properties
      }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
    });
    console.log('[notion] synced assessment', id);
  } catch (e) {
    console.warn('[notion] sync failed (non-fatal):', e.message);
  }
}

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  if (!body.contact) return res.status(400).json({ error: 'Invalid payload' });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('[save-report] Supabase not configured');
    return res.json({ success: true, id: body.id || generateId(), note: 'Supabase skipped' });
  }

  // ── Audit mode: client provides the ID ───────────────────────────────────
  if (body.id) {
    const { id, contact, scores, issues, seoChecks } = body;
    if (!contact?.email) return res.status(400).json({ error: 'contact.email required' });
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          id,
          data: { contact, scores, issues, seoChecks, savedAt: new Date().toISOString() }
        })
      });
      if (!response.ok) {
        if (response.status === 409) return res.json({ success: true, id });
        const err = await response.text();
        console.error('[save-report/audit] Supabase error:', response.status, err);
        return res.status(500).json({ error: 'Failed to save report' });
      }
      return res.json({ success: true, id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Assessment mode: server generates the ID ─────────────────────────────
  const id = generateId();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ id, data: body }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) {
      const err = await response.text();
      console.error('[save-report] Supabase insert failed:', response.status, err);
      return res.status(500).json({ error: 'Failed to save report' });
    }
    // Notion sync — fire-and-forget, never blocks the response
    syncToNotion(id, body).catch(() => {});
    return res.json({ id });
  } catch (err) {
    clearTimeout(timeout);
    return res.status(500).json({ error: err.message });
  }
};
