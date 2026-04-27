/**
 * Nexvora Systems — Automated Website Audit Report Generator
 * POST /api/generate-report
 * Body: { url, name, email, reportId? }
 *
 * Pipeline:
 * 1. Crawl homepage — extract title, meta, H1s, CTAs, nav, images
 * 2. Tavily research — business info, reviews, competitors (parallel)
 * 3. PSI audit — Core Web Vitals, performance scores
 * 4. GPT-4o — analyzes all data, writes full structured report
 * 5. Save HTML to Supabase generated_reports table
 * 6. Return { success, reportId, reportUrl }
 *
 * Env vars needed:
 *   TAVILY_API_KEY, OPENAI_API_KEY,
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY,
 *   SITE_URL (optional, defaults to nexvorasystems.us)
 */

const SITE_URL = (process.env.SITE_URL || 'https://nexvorasystems.us').replace(/\/$/, '');
const REPORT_VERSION = 'v0.2.6.001.0420.nx01';

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomId(len = 10) {
  return Array.from({ length: len }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
}

function domainFrom(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function companyGuess(domain) {
  // ustaxiq.com → "US Tax IQ" heuristic
  return domain.split('.')[0]
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

// ── 1. Crawl homepage ─────────────────────────────────────────────────────────

async function crawlHomepage(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NexvoraAudit/1.0)' },
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
    });
    if (!res.ok) return null;
    const html = await res.text();

    const get = (pattern) => { const m = html.match(pattern); return m ? m[1]?.trim() : null; };
    const getAll = (pattern) => { const m = [...html.matchAll(pattern)]; return m.map(x => x[1]?.trim()).filter(Boolean); };

    const title       = get(/<title[^>]*>([^<]+)<\/title>/i);
    const description = get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)
                     || get(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description/i);
    const h1s         = getAll(/<h1[^>]*>([^<]+)<\/h1>/gi).slice(0, 5);
    const h2s         = getAll(/<h2[^>]*>([^<]+)<\/h2>/gi).slice(0, 10);
    const imgCount    = (html.match(/<img/gi) || []).length;
    const imgNoAlt    = (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length;
    const scriptCount = (html.match(/<script(?![^>]*type=["']application\/ld\+json["'])/gi) || []).length;
    const hasSchema   = html.includes('application/ld+json');
    const hasViewport = html.includes('name="viewport"') || html.includes("name='viewport'");
    const isHttps     = url.startsWith('https');
    const btnTexts    = getAll(/(?:href|onclick)[^>]*>[\s]*([^<]{2,30})[\s]*<\/(?:a|button)/gi)
                        .filter(t => /book|contact|call|get|start|free|schedule|buy|order|quote/i.test(t))
                        .slice(0, 5);
    const navLinks    = getAll(/<(?:nav|header)[^>]*>[\s\S]*?<a[^>]*>([^<]{2,40})<\/a>/gi).slice(0, 10);
    const pageCount   = (html.match(/href=["'][^"'#?]+\.html?["']/gi) || []).length;

    return { title, description, h1s, h2s, imgCount, imgNoAlt, scriptCount, hasSchema, hasViewport, isHttps, btnTexts, navLinks, pageCount };
  } catch (e) {
    console.warn('[crawl] Failed:', e.message);
    return null;
  }
}

// ── 2. Tavily research ────────────────────────────────────────────────────────

async function tavilySearch(query, maxResults = 7) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ query, max_results: maxResults, search_depth: 'advanced', include_answer: true }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined
    });
    if (!res.ok) return null;
    const json = await res.json();
    return {
      answer: json.answer || '',
      results: (json.results || []).map(r => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 500) }))
    };
  } catch (e) {
    console.warn('[tavily] Failed:', e.message);
    return null;
  }
}

// Filter Tavily results to remove wrong-business matches
// e.g. searching "24 25 CLEANERS" should not return "24 25 carpet" results
function filterForCompany(res, company) {
  if (!res?.results?.length) return res;
  const nameLower = company.toLowerCase();
  // Build key tokens: all words 2+ chars from company name
  const tokens = nameLower.split(/[\s\-&/]+/).filter(w => w.length >= 2);
  if (tokens.length < 2) return res; // not enough signal to filter safely
  const filtered = res.results.filter(r => {
    const text = ((r.title || '') + ' ' + (r.snippet || '') + ' ' + (r.url || '')).toLowerCase();
    // Keep if at least 2 of the company's key tokens appear in the result
    const hits = tokens.filter(t => text.includes(t)).length;
    return hits >= Math.min(2, tokens.length);
  });
  // Fallback: if filter removed everything, return up to 3 original results
  return { ...res, results: filtered.length > 0 ? filtered : res.results.slice(0, 3) };
}

// ── Data Confidence Score (pure JS — never AI-generated) ─────────────────────
function computeConfidenceScore(a, estCustomersPerMonth, mismatchExists, mismatchPct, claimedJobsPerMonth, effectiveCloseRate) {
  const issues = [];
  const verifications = [];
  let deductions = 0;

  const closeRate    = a.q9_close != null ? Number(a.q9_close) : null;
  const leadsPerMonth = Number(a.q9_leads) || 0;
  const avgCheck     = Number(a.avg_check) || 0;
  const expBreakdown = a.expense_breakdown || {};
  const missingExpCount = Object.values(expBreakdown).filter(v => v == null).length;

  // 1. Revenue vs leads×close rate mismatch — strongest signal (2 pts)
  if (mismatchExists) {
    deductions += 2;
    issues.push(`Revenue math suggests ~${estCustomersPerMonth} completed jobs/month, but your reported leads × close rate implies ~${claimedJobsPerMonth}/month — a ${mismatchPct}% discrepancy`);
    verifications.push('Track booked jobs separately from completed jobs and cancellations over the next 30 days');
    verifications.push('Clarify how you count leads — phone calls received, estimates sent, or qualified inquiries');
  }

  // 2. Unrealistically high close rate (1 pt)
  if (closeRate !== null && closeRate > 80) {
    deductions += 1;
    issues.push(`Reported close rate of ${closeRate}% is above the typical 20–60% range for most service businesses — worth verifying against actual bookings`);
    verifications.push(`Count every estimate sent vs. every job booked last month to verify your ${closeRate}% close rate`);
  }

  // 3. Close rate not tracked at all (1 pt)
  if (closeRate === null) {
    deductions += 1;
    issues.push('Close rate not tracked — growth projections use a 10% industry minimum placeholder instead of your real conversion rate');
    verifications.push('Start tracking: log every inbound inquiry and every job booked, divide weekly');
  }

  // 4. Lead volume not tracked (1 pt)
  if (!leadsPerMonth) {
    deductions += 1;
    issues.push('Monthly lead volume not provided — marketing ROI and funnel analysis cannot be calculated');
    verifications.push('Log every inbound lead (calls, forms, referrals, walk-ins) for the next 30 days');
  }

  // 5. Average transaction value missing (1 pt)
  if (!avgCheck) {
    deductions += 1;
    issues.push('Average transaction value not provided — job volume, capacity math, and revenue projections cannot be verified');
    verifications.push('Calculate it now: last month\'s total revenue ÷ number of completed jobs');
  }

  // 6. Expense breakdown mostly empty (1 pt)
  if (missingExpCount >= 3) {
    deductions += 1;
    issues.push(`${missingExpCount} out of ${Object.keys(expBreakdown).length} expense categories were not provided — true profit margin estimate may be off`);
    verifications.push('Fill in your expense breakdown: materials, marketing, software, operations, and equipment costs');
  }

  // Determine level
  let level, color, bg, border, icon;
  if (deductions === 0)      { level = 'Verified';      color = '#059669'; bg = '#D1FAE5'; border = '#6EE7B7'; icon = '✓'; }
  else if (deductions <= 2)  { level = 'Needs Review';  color = '#B45309'; bg = '#FEF3C7'; border = '#FCD34D'; icon = '⚠'; }
  else                       { level = 'Unverified';    color = '#DC2626'; bg = '#FEE2E2'; border = '#FCA5A5'; icon = '!'; }

  return { level, color, bg, border, icon, issues, verifications, deductions };
}

// ── 3. PSI via our proxy ──────────────────────────────────────────────────────

async function runPSI(siteUrl) {
  try {
    const [mobile, desktop] = await Promise.all([
      fetch(`${SITE_URL}/api/psi?url=${encodeURIComponent(siteUrl)}&strategy=mobile`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${SITE_URL}/api/psi?url=${encodeURIComponent(siteUrl)}&strategy=desktop`).then(r => r.ok ? r.json() : null).catch(() => null)
    ]);
    const extract = (lhr) => {
      if (!lhr?.lighthouseResult) return null;
      const cats = lhr.lighthouseResult.categories || {};
      const aud  = lhr.lighthouseResult.audits || {};
      const sc   = (k) => cats[k] ? Math.round(cats[k].score * 100) : null;
      const av   = (k) => aud[k]?.displayValue || null;
      return {
        perf: sc('performance'), seo: sc('seo'), acc: sc('accessibility'), bp: sc('best-practices'),
        fcp: av('first-contentful-paint'), lcp: av('largest-contentful-paint'),
        tbt: av('total-blocking-time'), cls: av('cumulative-layout-shift'),
        tti: av('interactive'), si: av('speed-index'),
        pageSize: aud['total-byte-weight']?.displayValue || null,
        requests: aud['network-requests']?.details?.items?.length || null,
        unusedJs: aud['unused-javascript']?.displayValue || null,
        unusedCss: aud['unused-css-rules']?.displayValue || null,
        imgOptimize: aud['uses-optimized-images']?.displayValue || null,
        renderBlock: aud['render-blocking-resources']?.displayValue || null,
        caching: aud['uses-long-cache-ttl']?.displayValue || null,
        https: aud['uses-https']?.score === 1,
        crawlable: aud['is-crawlable']?.score === 1,
        hasMeta: aud['meta-description']?.score === 1,
        hasTitle: aud['document-title']?.score === 1,
        imgAlt: aud['image-alt']?.score === 1,
        schema: aud['structured-data']?.score === 1,
        canonical: aud['canonical']?.score === 1,
      };
    };
    return { mobile: extract(mobile), desktop: extract(desktop) };
  } catch (e) {
    console.warn('[psi] Failed:', e.message);
    return { mobile: null, desktop: null };
  }
}

// ── 4. GPT-4o report writer ───────────────────────────────────────────────────

async function writeReport(data) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');

  const systemPrompt = `You are a senior digital marketing strategist and technical SEO expert writing a paid website audit report for a small business client.
Your reports are specific, actionable, honest, and professional. You use real data provided to you — never invent facts.
Never guarantee specific traffic or ranking outcomes. Use "Target Goal" not "Projected Result".
Write in plain, direct English. No corporate fluff. Be specific about issues and how to fix them.`;

  const userPrompt = `Write a complete website audit report for ${data.company} (${data.domain}).

## RAW DATA

### Website Crawl
${JSON.stringify(data.crawl, null, 2)}

### PSI Performance (Mobile)
${JSON.stringify(data.psi.mobile, null, 2)}

### PSI Performance (Desktop)
${JSON.stringify(data.psi.desktop, null, 2)}

### Business Research (Tavily)
**Business Overview:** ${data.research.overview?.answer || 'No data found'}
Top sources: ${data.research.overview?.results?.map(r => r.snippet).join(' | ') || 'N/A'}

**Reviews & Reputation:** ${data.research.reviews?.answer || 'No data found'}
Sources: ${data.research.reviews?.results?.map(r => r.snippet).join(' | ') || 'N/A'}

**Competitors:** ${data.research.competitors?.answer || 'No data found'}
Sources: ${data.research.competitors?.results?.map(r => r.snippet).join(' | ') || 'N/A'}

**Industry Keywords:** ${data.research.keywords?.answer || 'No data found'}

## REPORT CLIENT
Name: ${data.clientName}
Email: ${data.clientEmail}
Website: ${data.url}
Report Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

## OUTPUT FORMAT
Return a JSON object with these exact keys (all values are HTML strings, use <strong>, <ul>, <li>, <p> tags freely):

{
  "companyName": "string — confirmed company name from research",
  "industry": "string — e.g. Tax Services, HVAC, Law Firm",
  "location": "string — city, state if found",
  "founded": "string — year or 'Not found'",
  "onlineSince": "string — estimated or 'Not found'",
  "googleRating": "string — e.g. '4.2/5 (47 reviews)' or 'Not found'",
  "socialPresence": "string — brief summary of social media presence",
  "executiveSummary": "string — 3-4 sentences: what the site does well and what its biggest problems are",
  "keyStrengths": ["string", "string", "string"],
  "criticalIssues": ["string", "string", "string"],
  "technicalSEO": "string — 3-5 paragraphs on technical findings with specific details",
  "onPageSEO": "string — 2-3 paragraphs on meta tags, headings, content quality",
  "performanceSummary": "string — 2-3 paragraphs analyzing the PSI scores and CWV",
  "uiUxAnalysis": "string — 2-3 paragraphs on design, CTAs, user journey, why visitors leave",
  "contentStrategy": "string — 2-3 paragraphs on content gaps and blog/content opportunities",
  "competitorAnalysis": "string — who their main competitors are, how this site compares",
  "competitors": [{"name": "string", "url": "string", "strength": "string"}],
  "priorityActions": [
    {"priority": "Critical|High|Medium|Low", "title": "string", "desc": "string", "impact": "string"}
  ],
  "roadmapPhase1": "string — Months 1-3: Foundation fixes",
  "roadmapPhase2": "string — Months 4-6: Content & SEO",
  "roadmapPhase3": "string — Months 7-9: Conversion optimization",
  "roadmapPhase4": "string — Months 10-12: Scale & authority",
  "conclusion": "string — 2-3 sentences wrapping up with honest assessment"
}

Return ONLY the JSON object. No markdown code blocks. No extra text.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0.4,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return JSON.parse(json.choices[0].message.content);
}

// ── 5. Render HTML report ─────────────────────────────────────────────────────

function renderHTML(r, data) {
  const psi = data.psi.mobile || {};
  const psiD = data.psi.desktop || {};
  const crawl = data.crawl || {};

  const scoreColor = (n) => n >= 90 ? '#10B981' : n >= 50 ? '#F59E0B' : '#EF4444';
  const scoreBox = (label, val) => val !== null && val !== undefined
    ? `<div class="score-box"><div class="score-n" style="color:${scoreColor(val)}">${val}</div><div class="score-l">${label}</div></div>` : '';
  const pill = (text, color) => `<span class="pill" style="background:${color}20;color:${color};border:1px solid ${color}40">${text}</span>`;
  const priorityColor = { Critical: '#EF4444', High: '#F97316', Medium: '#F59E0B', Low: '#3B82F6' };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${r.companyName} — Website Audit Report | Nexvora Systems</title>
<meta name="robots" content="noindex"/>
<link rel="icon" href="${SITE_URL}/assets/logo-dark.png"/>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TY0PZHVN0L"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-TY0PZHVN0L');</script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:#FAF8F5;--bg2:#F0EDE8;--card:#fff;--navy:#0F2B4C;--teal:#0D9488;--text:#1A1A2E;--muted:#4A5568;--dim:#718096;--border:#E2DDD5;--red:#EF4444;--orange:#F97316;--yellow:#F59E0B;--green:#10B981;--blue:#3B82F6;}
html,body{font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;background:var(--bg);color:var(--text);font-size:15px;line-height:1.7;}
a{color:var(--teal);}
/* BANNER */
.pub-banner{background:var(--navy);color:rgba(255,255,255,0.7);text-align:center;font-size:12px;padding:8px 20px;letter-spacing:.5px;}
.pub-banner strong{color:#44CAA2;}
/* NAV */
nav{background:var(--navy);padding:16px 32px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:100;}
.nav-badge{background:rgba(13,148,136,0.2);border:1px solid rgba(13,148,136,0.4);color:#44CAA2;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 12px;border-radius:20px;}
.nav-date{margin-left:auto;font-size:12px;color:rgba(255,255,255,0.4);}
/* HERO */
.hero{background:linear-gradient(135deg,#0F2B4C 0%,#0D9488 100%);padding:56px 32px 48px;color:#fff;text-align:center;}
.hero-domain{font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:8px;letter-spacing:1px;text-transform:uppercase;}
.hero h1{font-size:clamp(26px,4vw,38px);font-weight:900;letter-spacing:-1px;margin-bottom:6px;}
.hero-sub{font-size:15px;color:rgba(255,255,255,0.6);margin-bottom:32px;}
.score-row{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-bottom:28px;}
.score-box{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:16px 20px;text-align:center;min-width:100px;}
.score-n{font-size:34px;font-weight:900;letter-spacing:-1px;line-height:1;}
.score-l{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-top:5px;}
.meta-row{display:flex;justify-content:center;gap:20px;flex-wrap:wrap;font-size:13px;color:rgba(255,255,255,0.5);}
.meta-row span strong{color:rgba(255,255,255,0.85);}
/* SECTIONS */
.wrap{max-width:900px;margin:0 auto;padding:48px 20px 80px;}
.section{margin-bottom:48px;}
.section-label{font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--teal);margin-bottom:6px;}
.section-title{font-size:22px;font-weight:800;color:var(--text);margin-bottom:20px;letter-spacing:-.3px;}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:28px 32px;margin-bottom:16px;}
.card-navy{background:var(--navy);border-color:transparent;color:#fff;}
.card-navy .muted{color:rgba(255,255,255,0.55);}
/* PILLS */
.pill{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;display:inline-block;margin:2px;}
/* STRENGTHS / ISSUES */
.strength-list,.issue-list{display:flex;flex-direction:column;gap:10px;}
.strength-item,.issue-item{display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-radius:10px;}
.strength-item{background:#D1FAE520;border:1px solid #10B98130;}
.issue-item{background:#FEE2E220;border:1px solid #EF444430;}
.si-icon{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;}
/* CWV GRID */
.cwv-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.cwv-box{background:var(--bg2);border-radius:10px;padding:14px;text-align:center;}
.cwv-val{font-size:20px;font-weight:800;}
.cwv-name{font-size:10px;color:var(--muted);margin-top:3px;}
/* PRIORITY TABLE */
.priority-list{display:flex;flex-direction:column;gap:10px;}
.p-item{border:1px solid var(--border);border-radius:10px;padding:14px 18px;display:flex;gap:14px;align-items:flex-start;}
.p-badge{font-size:10px;font-weight:800;padding:4px 10px;border-radius:6px;white-space:nowrap;flex-shrink:0;margin-top:2px;}
.p-title{font-size:14px;font-weight:700;color:var(--text);margin-bottom:3px;}
.p-desc{font-size:12px;color:var(--muted);}
.p-impact{font-size:11px;color:var(--teal);font-weight:600;margin-top:4px;}
/* COMPETITOR TABLE */
table{width:100%;border-collapse:collapse;font-size:13px;}
th{background:var(--bg2);padding:10px 14px;text-align:left;font-weight:700;color:var(--muted);font-size:11px;letter-spacing:.5px;text-transform:uppercase;}
td{padding:10px 14px;border-top:1px solid var(--border);}
/* ROADMAP */
.roadmap-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;}
.phase-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;}
.phase-num{font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--teal);margin-bottom:6px;}
.phase-title{font-size:15px;font-weight:800;color:var(--text);margin-bottom:10px;}
/* NEXVORA ABOUT */
.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px;}
.about-item{font-size:13px;color:rgba(255,255,255,0.65);line-height:1.7;}
.about-item strong{color:#44CAA2;display:block;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;}
/* CTA */
.cta-box{background:linear-gradient(135deg,var(--navy),var(--teal));border-radius:20px;padding:48px 36px;text-align:center;color:#fff;margin-top:48px;}
.cta-box h2{font-size:26px;font-weight:900;margin-bottom:10px;letter-spacing:-.5px;}
.cta-box p{font-size:14px;color:rgba(255,255,255,0.65);max-width:420px;margin:0 auto 24px;line-height:1.7;}
.cta-btn{display:inline-flex;align-items:center;gap:8px;padding:15px 36px;background:#fff;color:var(--teal);border-radius:12px;text-decoration:none;font-size:15px;font-weight:800;}
/* FOOTER */
footer{background:var(--navy);padding:32px;text-align:center;color:rgba(255,255,255,0.4);font-size:12px;}
footer strong{color:#44CAA2;}
@media(max-width:640px){
  .cwv-grid{grid-template-columns:repeat(2,1fr);}
  .roadmap-grid{grid-template-columns:1fr;}
  .about-grid{grid-template-columns:1fr;}
  .hero{padding:40px 20px 32px;}
  .score-row{gap:8px;}
  .score-box{min-width:80px;padding:12px 10px;}
  .score-n{font-size:26px;}
  .cta-box{padding:28px 16px;}
}
</style>
</head>
<body>

<div class="pub-banner">🔒 Confidential — Prepared exclusively for <strong>${data.clientName}</strong> by Nexvora Systems</div>

<nav>
  <a href="${SITE_URL}" target="_blank" rel="noopener" style="display:flex;align-items:center;flex-shrink:0;"><img src="${SITE_URL}/assets/logo-white.png" alt="Nexvora Systems" style="height:36px;" onerror="this.style.display='none'"/></a>
  <span class="nav-badge">Website Audit Report</span>
  <span class="nav-date">${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
  <span style="font-size:10px;color:rgba(255,255,255,0.25);font-family:monospace;letter-spacing:.5px;">${REPORT_VERSION}</span>
</nav>

<div class="hero">
  <div class="hero-domain">${data.domain}</div>
  <h1>${r.companyName}</h1>
  <div class="hero-sub">${r.industry}${r.location ? ' · ' + r.location : ''}</div>
  <div class="score-row">
    ${scoreBox('Performance<br>Mobile', psi.perf)}
    ${scoreBox('Performance<br>Desktop', psiD.perf)}
    ${scoreBox('SEO Score', psi.seo)}
    ${scoreBox('Accessibility', psi.acc)}
    ${scoreBox('Best Practices', psi.bp)}
  </div>
  <div class="meta-row">
    ${r.googleRating !== 'Not found' ? `<span>⭐ <strong>${r.googleRating}</strong></span>` : ''}
    ${r.founded !== 'Not found' ? `<span>📅 Founded <strong>${r.founded}</strong></span>` : ''}
    ${crawl.imgCount ? `<span>🖼 <strong>${crawl.imgCount}</strong> images</span>` : ''}
    ${psi.requests ? `<span>🔗 <strong>${psi.requests}</strong> HTTP requests</span>` : ''}
    ${psi.pageSize ? `<span>📦 Page size: <strong>${psi.pageSize}</strong></span>` : ''}
  </div>
</div>

<div class="wrap">

  <!-- ABOUT NEXVORA -->
  <div class="section">
    <div class="card card-navy">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <img src="${SITE_URL}/assets/logo-white.png" alt="Nexvora Systems" style="height:32px;" onerror="this.style.display='none'"/>
        <div>
          <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.4);">Prepared by</div>
          <div style="font-size:16px;font-weight:800;color:#fff;">Nexvora Systems LLC</div>
        </div>
      </div>
      <div class="about-grid">
        <div class="about-item"><strong>What We Do</strong>We help small businesses in the Tampa Bay area build faster, higher-ranking websites that convert visitors into paying customers.</div>
        <div class="about-item"><strong>Founders</strong>Murat Zhandaurov &amp; Alexandr Godonvayuk — entrepreneurs who built 24/25 Cleaners and understand real business challenges firsthand.</div>
        <div class="about-item"><strong>Contact</strong>info@nexvorasystems.us<br>nexvorasystems.us</div>
        <div class="about-item"><strong>Location</strong>Tampa Bay, Florida<br>Serving clients across the US</div>
      </div>
    </div>
  </div>

  <!-- EXECUTIVE SUMMARY -->
  <div class="section">
    <div class="section-label">Executive Summary</div>
    <div class="section-title">Overall Assessment</div>
    <div class="card">
      <p style="font-size:15px;line-height:1.8;color:var(--muted);margin-bottom:20px;">${r.executiveSummary}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:10px;letter-spacing:.5px;">✓ KEY STRENGTHS</div>
          <div class="strength-list">
            ${r.keyStrengths.map(s => `<div class="strength-item"><div class="si-icon" style="background:#D1FAE5;color:#065F46;">✓</div><div style="font-size:13px;color:var(--muted);">${s}</div></div>`).join('')}
          </div>
        </div>
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:10px;letter-spacing:.5px;">✗ CRITICAL ISSUES</div>
          <div class="issue-list">
            ${r.criticalIssues.map(i => `<div class="issue-item"><div class="si-icon" style="background:#FEE2E2;color:#991B1B;">✗</div><div style="font-size:13px;color:var(--muted);">${i}</div></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- BUSINESS INTELLIGENCE -->
  <div class="section">
    <div class="section-label">Business Intelligence</div>
    <div class="section-title">Online Presence & Reputation</div>
    <div class="card" style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;">
      <div><div style="font-size:11px;font-weight:700;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Google Rating</div><div style="font-size:20px;font-weight:800;">${r.googleRating}</div></div>
      <div><div style="font-size:11px;font-weight:700;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Industry</div><div style="font-size:20px;font-weight:800;">${r.industry}</div></div>
      <div><div style="font-size:11px;font-weight:700;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Location</div><div style="font-size:16px;font-weight:700;">${r.location || 'Not found'}</div></div>
      <div><div style="font-size:11px;font-weight:700;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Founded</div><div style="font-size:16px;font-weight:700;">${r.founded}</div></div>
      <div style="grid-column:1/-1;"><div style="font-size:11px;font-weight:700;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Social Media</div><div style="font-size:14px;color:var(--muted);">${r.socialPresence}</div></div>
    </div>
  </div>

  <!-- PERFORMANCE -->
  <div class="section">
    <div class="section-label">Technical Performance</div>
    <div class="section-title">Core Web Vitals & Page Speed</div>
    <div class="card" style="margin-bottom:16px;">
      <div class="cwv-grid">
        ${[['FCP','first-contentful-paint',psi.fcp],['LCP','largest-contentful-paint',psi.lcp],['TBT','total-blocking-time',psi.tbt],['CLS','cumulative-layout-shift',psi.cls],['TTI','interactive',psi.tti],['SI','speed-index',psi.si]].map(([label,,val]) =>
          `<div class="cwv-box"><div class="cwv-val">${val||'—'}</div><div class="cwv-name">${label}</div></div>`).join('')}
      </div>
    </div>
    <div class="card"><div style="color:var(--muted);font-size:14px;line-height:1.8;">${r.performanceSummary}</div></div>
  </div>

  <!-- TECHNICAL SEO -->
  <div class="section">
    <div class="section-label">Technical SEO</div>
    <div class="section-title">Infrastructure & Crawlability</div>
    <div class="card" style="margin-bottom:16px;">
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
        ${[
          ['HTTPS', psi.https, psi.https ? 'Secure' : 'Not secure'],
          ['Google Crawlable', psi.crawlable, psi.crawlable ? 'Yes' : 'Blocked'],
          ['Meta Description', psi.hasMeta, psi.hasMeta ? 'Present' : 'Missing'],
          ['Page Title', psi.hasTitle, psi.hasTitle ? 'Present' : 'Missing'],
          ['Image Alt Text', psi.imgAlt, psi.imgAlt ? 'All images' : 'Missing on some'],
          ['Schema Markup', crawl.hasSchema, crawl.hasSchema ? 'Found' : 'Not found'],
          ['Canonical Tag', psi.canonical, psi.canonical ? 'Present' : 'Missing'],
          ['Mobile Viewport', crawl.hasViewport, crawl.hasViewport ? 'Configured' : 'Missing'],
        ].map(([label, pass, text]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg2);border-radius:8px;">
            <span style="font-size:13px;font-weight:600;color:var(--muted);">${label}</span>
            <span style="font-size:12px;font-weight:700;color:${pass?'var(--green)':'var(--red)'};">${text}</span>
          </div>`).join('')}
      </div>
    </div>
    <div class="card"><div style="color:var(--muted);font-size:14px;line-height:1.8;">${r.technicalSEO}</div></div>
  </div>

  <!-- ON-PAGE SEO -->
  <div class="section">
    <div class="section-label">On-Page SEO</div>
    <div class="section-title">Content & Keyword Optimization</div>
    <div class="card" style="margin-bottom:16px;">
      ${crawl.h1s?.length ? `<div style="margin-bottom:14px;"><div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">H1 Tags Found</div>${crawl.h1s.map(h => `<div style="background:var(--bg2);border-radius:6px;padding:8px 12px;font-size:13px;margin-bottom:4px;">${h}</div>`).join('')}</div>` : ''}
      ${crawl.h2s?.length ? `<div><div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">H2 Tags Found (first ${crawl.h2s.length})</div>${crawl.h2s.slice(0,6).map(h => `<div style="background:var(--bg2);border-radius:6px;padding:8px 12px;font-size:13px;margin-bottom:4px;">${h}</div>`).join('')}</div>` : ''}
    </div>
    <div class="card"><div style="color:var(--muted);font-size:14px;line-height:1.8;">${r.onPageSEO}</div></div>
  </div>

  <!-- UI/UX -->
  <div class="section">
    <div class="section-label">UI/UX Analysis</div>
    <div class="section-title">Why Visitors Leave Without Converting</div>
    <div class="card"><div style="color:var(--muted);font-size:14px;line-height:1.8;">${r.uiUxAnalysis}</div></div>
  </div>

  <!-- CONTENT STRATEGY -->
  <div class="section">
    <div class="section-label">Content Strategy</div>
    <div class="section-title">Keyword & Content Opportunities</div>
    <div class="card"><div style="color:var(--muted);font-size:14px;line-height:1.8;">${r.contentStrategy}</div></div>
  </div>

  <!-- COMPETITORS -->
  <div class="section">
    <div class="section-label">Competitor Analysis</div>
    <div class="section-title">How You Stack Up</div>
    <div class="card" style="margin-bottom:16px;"><div style="color:var(--muted);font-size:14px;line-height:1.8;">${r.competitorAnalysis}</div></div>
    ${r.competitors?.length ? `<div class="card" style="padding:0;overflow:hidden;">
      <table><tr><th>Competitor</th><th>URL</th><th>Key Strength</th></tr>
      ${r.competitors.map(c => `<tr><td style="font-weight:700;">${c.name}</td><td style="color:var(--teal);font-size:12px;">${c.url}</td><td style="color:var(--muted);font-size:13px;">${c.strength}</td></tr>`).join('')}
      </table></div>` : ''}
  </div>

  <!-- PRIORITY ACTION PLAN -->
  <div class="section">
    <div class="section-label">Priority Action Plan</div>
    <div class="section-title">What to Fix First</div>
    <div class="priority-list">
      ${(r.priorityActions || []).map(a => `
        <div class="p-item">
          <span class="p-badge" style="background:${priorityColor[a.priority]}20;color:${priorityColor[a.priority]};border:1px solid ${priorityColor[a.priority]}40">${a.priority}</span>
          <div>
            <div class="p-title">${a.title}</div>
            <div class="p-desc">${a.desc}</div>
            ${a.impact ? `<div class="p-impact">→ ${a.impact}</div>` : ''}
          </div>
        </div>`).join('')}
    </div>
  </div>

  <!-- ROADMAP -->
  <div class="section">
    <div class="section-label">12-Month Roadmap</div>
    <div class="section-title">The Path Forward</div>
    <div class="roadmap-grid">
      ${[['Phase 1 · Months 1–3','Foundation Fix',r.roadmapPhase1],['Phase 2 · Months 4–6','Content Authority',r.roadmapPhase2],['Phase 3 · Months 7–9','Conversion Optimization',r.roadmapPhase3],['Phase 4 · Months 10–12','Authority & Scale',r.roadmapPhase4]].map(([num,title,body]) => `
        <div class="phase-card">
          <div class="phase-num">${num}</div>
          <div class="phase-title">${title}</div>
          <div style="font-size:13px;color:var(--muted);line-height:1.7;">${body}</div>
        </div>`).join('')}
    </div>
    <div style="margin-top:12px;padding:14px 20px;background:var(--bg2);border-radius:10px;font-size:12px;color:var(--dim);">
      ⚠️ Results depend on implementation speed, market conditions, and algorithm changes. Timeline varies by scope and industry.
    </div>
  </div>

  <!-- CONCLUSION -->
  <div class="section">
    <div class="section-label">Conclusion</div>
    <div class="card"><p style="font-size:15px;color:var(--muted);line-height:1.8;">${r.conclusion}</p></div>
  </div>

  <!-- CTA -->
  <div class="cta-box">
    <h2>Ready to Fix These Issues?</h2>
    <p>Nexvora Systems implements everything in this report. We build faster, higher-ranking websites for small businesses — with real results and no corporate fluff.</p>
    <a href="${SITE_URL}/assessment.html" class="cta-btn">Book a Free Strategy Call →</a>
    <div style="margin-top:14px;font-size:12px;color:rgba(255,255,255,0.35);">No commitment · Free 20-minute call · Tampa Bay, Florida</div>
  </div>

</div><!-- /wrap -->

<footer>
  <img src="${SITE_URL}/assets/logo-white.png" alt="Nexvora Systems" style="height:32px;margin-bottom:10px;display:block;margin-left:auto;margin-right:auto;" onerror="this.style.display='none'"/>
  <div style="margin-bottom:4px;"><strong>Nexvora Systems LLC</strong> · nexvorasystems.us · info@nexvorasystems.us</div>
  <div>Report ID: ${data.reportId} · Prepared for ${data.clientName} · © 2026 Nexvora Systems LLC. All rights reserved.</div>
</footer>

</body>
</html>`;
}

// ── 6. Save to Supabase ───────────────────────────────────────────────────────

async function saveReport(reportId, clientEmail, html, meta, assessment, upsert = false) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;
  try {
    const payload = { id: reportId, email: clientEmail, html, meta, created_at: new Date().toISOString() };
    if (assessment) payload.assessment = assessment;
    const prefer = upsert ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal';
    await fetch(`${url}/rest/v1/generated_reports`, {
      method: upsert ? 'POST' : 'POST',
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': prefer },
      body: JSON.stringify(payload)
    });
  } catch (e) { console.warn('[save] Failed:', e.message); }
}

// ── 7. Assessment mode ────────────────────────────────────────────────────────

async function writeAssessmentReport(a, research) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');

  const PAIN_LABELS = {cashflow:'Cash Flow',systems:'Operational Systems','owner-dep':'Owner Dependency',team:'Team & Retention',operations:'Capacity & Operations',growth:'Growth Plateau',survival:'Business Survival',healthy:'Well-Positioned'};
  const SIZE_LABELS = {solo:'Solo owner',partner:'Owner + business partner',team:'Owner + team'};

  // Build revenue summary from multi-year structure
  // DATA ORDER: y0=oldest year entered, y1=next, y2=most recent full year, y3=current year (partial/estimated)
  const revYears = a.q4_years || {};
  const revParsed = a.q4_parsed || {};
  const _cy = new Date().getFullYear();  // e.g. 2026
  const _cm = new Date().getMonth() + 1; // current month (1-12)
  const _monthsLeft = 12 - _cm;
  // CONVENTION: y0=current year (partial/estimated), y1=last full year, y2=2yr ago, y3=3yr ago (oldest)
  const revLines = ['y3','y2','y1','y0','yn'].filter(k=>revYears[k]).map(k=>{
    const label = {y3:`${_cy-3}`,y2:`${_cy-2}`,y1:`${_cy-1} (last full year)`,y0:`${_cy} (current year — estimated, ${_cm} months in)`,yn:`${_cy+1} (goal)`}[k]||k;
    return `${label}: $${Number(revYears[k]).toLocaleString()}`;
  });
  const revSummary = revLines.length ? revLines.join(' | ') : (a.q4||'not provided');

  // Revenue trend — y3→y2→y1 are full years; y0 is current year estimate only
  const r0=revParsed.y0, r1=revParsed.y1, r2=revParsed.y2, r3=revParsed.y3, rn=revParsed.yn;
  const revTrendLines = [];
  if (r3&&r2) { const g=Math.round((r2-r3)/r3*100); revTrendLines.push(`${g>=0?'+':''}${g}% (${_cy-3}→${_cy-2})`); }
  if (r2&&r1) { const g=Math.round((r1-r2)/r2*100); revTrendLines.push(`${g>=0?'+':''}${g}% (${_cy-2}→${_cy-1})`); }
  if (r1&&r0) { const g=Math.round((r0-r1)/r1*100); revTrendLines.push(`${g>=0?'+':''}${g}% vs last year — BUT ${_cy} is only ${_cm} months in, figure is an estimate`); }
  const revTrend = revTrendLines.length ? revTrendLines.join('; ') : (a.q4_growth!==undefined?`${a.q4_growth>=0?'+':''}${a.q4_growth}% YoY`:'N/A');
  // Current-year context for GPT
  const _curYearNote = r0 ? `IMPORTANT: The ${_cy} figure ($${r0.toLocaleString()}) is an owner estimate — it is NOT a final annual result. As of this report, ${_cy} has ${_cm} months completed and ${_monthsLeft} months remaining. Do NOT characterize ${_cy} as a confirmed decline. Frame it as a year still in progress: if the estimate holds, what needs to happen in the next ${_monthsLeft} months to match or beat ${_cy-1}? Calculate the monthly revenue needed to hit $${r1?.toLocaleString()||'last year'} by year-end.` : '';

  // Expense breakdown
  const expLines = Object.entries(a.expense_breakdown||{}).filter(([,v])=>v!==null).map(([k,v])=>`${k}: ${v}%`);
  const expSummary = expLines.length ? expLines.join(', ') : 'not provided';
  const _expBreakdownTotal = Object.entries(a.expense_breakdown||{}).filter(([,v])=>v!=null).reduce((s,[,v])=>s+Number(v),0);

  // Back-office payroll from q19_segments (non-field types) — computed here for GPT prompt scope
  // In individual mode, use pay_with_tax (includes employer payroll taxes for W2 employees)
  const _promptFieldTypes = new Set(['field','contractors','field-contractors']);
  const _backOfficeMo = Object.entries(a.q19_segments||{}).filter(([s])=>!_promptFieldTypes.has(s)).reduce((t,[,d])=>{
    const _cost = (a.salary_mode==='individual' && d.pay_with_tax!=null) ? Number(d.pay_with_tax) : Number(d.pay||0);
    return t + Number(d.count||0) * _cost;
  }, 0);

  // Owner pay — use stored label (supports custom "Other" entries)
  const ownerPayLines = Object.entries(a.owner_pay||{}).map(([k,v])=>{
    const displayName = v.label || k;
    const monthly = v.monthly || (v.frequency==='weekly' ? Math.round(Number(v.amount)*4.33) : Number(v.amount));
    return `${displayName}: $${v.amount}/${v.frequency} = $${monthly}/mo`;
  });
  const totalMonthlyOwnerPay = Object.values(a.owner_pay||{}).reduce((s,v)=>{
    const monthly = v.monthly || (v.frequency==='weekly' ? Math.round(Number(v.amount)*4.33) : Number(v.amount));
    return s + monthly;
  }, 0);
  const annualOwnerPay = (totalMonthlyOwnerPay||a.q16||0)*12;

  // Partners — multi-partner support (falls back to legacy partner_pay if no partners array)
  const _partnersArr = a.partners || (a.partner?.has && a.partner_pay ? [{
    name: 'Partner', role: a.partner.partnerRole||'', involvement: a.partner.involvement||'',
    pay: a.partner_pay, pay_total: a.partner_pay_total||0
  }] : []);
  const totalMonthlyAllPartnersPay = _partnersArr.reduce((s,p)=>s+(p.pay_total||0), 0);
  const annualAllPartnersPay = totalMonthlyAllPartnersPay * 12;
  // Legacy compat vars (used in margin math below)
  const totalMonthlyPartnerPay = totalMonthlyAllPartnersPay;
  const annualPartnerPay = annualAllPartnersPay;

  // Goals
  const goals12mo = Array.isArray(a.q15) ? a.q15.join(', ') : (a.q15||'not provided');
  const goal3yr = Array.isArray(a.goal_3yr) ? a.goal_3yr.join(', ') : (a.goal_3yr||'not provided');
  const goal5yr = Array.isArray(a.q15b) ? a.q15b.join(', ') : (a.q15b||'not provided');

  // Team detail — pay_with_tax is user-entered full cost (incl. employer taxes when applicable)
  const teamSegLines = Object.entries(a.q19_segments||{}).filter(([,v])=>v.count>0).map(([k,v])=>{
    const _cost = (a.salary_mode==='individual' && v.pay_with_tax!=null) ? v.pay_with_tax : v.pay;
    const _typeNote = v.type && v.type!=='unknown' ? ` (${v.type})` : '';
    const _fullCostNote = (a.salary_mode==='individual' && (v.type==='w2'||v.type==='mixed')) ? ' — full cost incl. employer taxes' : '';
    const _tipsNote = v.tips_per_person_mo > 0 ? ` + $${v.tips_per_person_mo}/mo tips each` : '';
    return `${k}: ${v.count} people @ $${_cost}/mo each${_typeNote}${_fullCostNote}${_tipsNote}`;
  });
  // Total tips pass-through (gross revenue → team members, not business income)
  const _totalTipsMo = Object.values(a.q19_segments||{}).reduce((s,d)=>s+(Number(d.total_tips_mo||0)),0);

  // ── Pre-computed capacity math (sent to GPT-4o so it reasons from real numbers) ──
  // Baseline priority: y0 (current year estimate) → y1 (last full year) → y2 → y3
  const annualRevEst   = r0 || r1 || r2 || r3 || 0;
  const monthlyRevEst  = annualRevEst ? Math.round(annualRevEst / 12) : 0;
  // Label which year is being used — shown in report and passed to GPT
  const _baselineYear  = r0 ? _cy : (r1 ? _cy-1 : (r2 ? _cy-2 : (r3 ? _cy-3 : null)));
  const _baselineLabel = r0 ? `${_cy} estimate (current year)` : (r1 ? `${_cy-1} (last full year)` : (r2 ? `${_cy-2}` : (r3 ? `${_cy-3}` : null)));
  const _noRevenue     = annualRevEst === 0;
  const _lowRevenue    = annualRevEst > 0 && annualRevEst < 10000;
  const _backOfficePct = (_backOfficeMo > 0 && annualRevEst > 0) ? Math.round(_backOfficeMo / (annualRevEst / 12) * 100) : 0;
  // Field/contractor cost as % of revenue — computed from q19_segments (NOT expense_breakdown.staff which may be 0)
  const _fieldMo = Object.entries(a.q19_segments||{}).filter(([s])=>_promptFieldTypes.has(s)).reduce((t,[,d])=>t+Number(d.count||0)*Number(d.pay||0),0);
  const _fieldPct = (monthlyRevEst > 0 && _fieldMo > 0) ? Math.round(_fieldMo / monthlyRevEst * 100) : (a.expense_breakdown?.staff||0);
  const avgCheck       = Number(a.avg_check) || 0;
  const estCustomersPerMonth = (monthlyRevEst && avgCheck) ? Math.round(monthlyRevEst / avgCheck) : null;
  const ownerHoursPerMonth   = Math.round((a.q17 || 0) * 4.33);
  const avgHoursPerCustomer  = (estCustomersPerMonth && ownerHoursPerMonth > 0) ? Math.round(ownerHoursPerMonth / estCustomersPerMonth * 10) / 10 : null;
  // Capacity headroom — use real data from assessment if provided, else fall back to 25%
  let capacityHeadroomCustomers = null;
  let capacityHeadroomPct = null;
  let capacitySourceNote = '';
  if (a.cap_utilization === 'full') {
    capacityHeadroomPct = 0; capacityHeadroomCustomers = 0;
    capacitySourceNote = 'Owner confirmed team is always fully booked — zero headroom without adding staff';
  } else if (a.cap_extra_jobs_week != null) {
    const _extraMo = Math.round(Number(a.cap_extra_jobs_week) * 4.33);
    capacityHeadroomCustomers = _extraMo;
    capacityHeadroomPct = estCustomersPerMonth > 0 ? Math.round(_extraMo / estCustomersPerMonth * 100) : null;
    capacitySourceNote = `Owner-reported: ${a.cap_extra_jobs_week} extra jobs/week possible = ~${_extraMo} extra customers/month`;
  } else if (a.cap_extra_clients != null && a.cap_current_clients) {
    const _total = Number(a.cap_current_clients) + Number(a.cap_extra_clients);
    capacityHeadroomPct = _total > 0 ? Math.round(Number(a.cap_extra_clients) / _total * 100) : 0;
    capacityHeadroomCustomers = Number(a.cap_extra_clients);
    capacitySourceNote = `Office-based: currently ${a.cap_current_clients} clients, can take ${a.cap_extra_clients} more (${capacityHeadroomPct}% headroom)`;
  } else if (a.cap_solo_headroom) {
    capacityHeadroomPct = a.cap_solo_headroom === 'yes' ? 30 : a.cap_solo_headroom === 'some' ? 15 : 0;
    capacityHeadroomCustomers = estCustomersPerMonth ? Math.round(estCustomersPerMonth * capacityHeadroomPct / 100) : null;
    capacitySourceNote = `Solo owner: ${a.cap_solo_headroom === 'yes' ? 'has available time' : a.cap_solo_headroom === 'some' ? 'maybe 10-20% more' : 'already at max'}`;
  } else if (estCustomersPerMonth && avgHoursPerCustomer) {
    // Fallback — 25% assumed (assessment capacity questions not answered)
    capacityHeadroomPct = 25;
    capacityHeadroomCustomers = Math.round(estCustomersPerMonth * 0.25);
    capacitySourceNote = '25% assumed (owner did not answer capacity questions)';
  }
  // Ad spend — compute CPC without intermediate rounding (fix double-rounding bug)
  const currentAdSpend   = Number(a.q9_adspend) || 0;
  // If close rate was skipped/null, use 10% industry minimum for math — never show "0%"
  const closeRateTracked = a.q9_close != null;
  const closeRate        = closeRateTracked ? Number(a.q9_close) : 10;
  const leadsPerMonth    = Number(a.q9_leads) || 0;
  const costPerLead      = (currentAdSpend && leadsPerMonth) ? +(currentAdSpend / leadsPerMonth).toFixed(2) : null;
  const costPerCustomer  = (costPerLead && closeRate) ? Math.round(costPerLead / (closeRate / 100)) : null;
  const costPerLeadDisplay = costPerLead ? Math.round(costPerLead) : null;
  const suggestedAdBudget = annualRevEst ? Math.round(annualRevEst * 0.08 / 12) : null;

  // ── DATA INTEGRITY: revenue-math vs self-reported leads/close rate ──────────
  // Revenue-based job count is the ground truth — it's derived from actual money, not estimation
  const claimedJobsPerMonth   = (leadsPerMonth && closeRateTracked) ? Math.round(leadsPerMonth * (closeRate / 100)) : null;
  const mismatchPct           = (claimedJobsPerMonth && estCustomersPerMonth)
    ? Math.round(Math.abs(claimedJobsPerMonth - estCustomersPerMonth) / Math.max(claimedJobsPerMonth, estCustomersPerMonth) * 100) : null;
  const mismatchExists        = mismatchPct !== null && mismatchPct > 20;
  // Effective close rate = what revenue math implies (more accurate than self-reported)
  const effectiveCloseRate    = (estCustomersPerMonth !== null && leadsPerMonth > 0)
    ? Math.round(estCustomersPerMonth / leadsPerMonth * 100) : null;
  // Cost per customer corrected to use revenue-based job count (not self-reported close rate)
  const costPerCustomerRevBased = (currentAdSpend && estCustomersPerMonth)
    ? Math.round(currentAdSpend / estCustomersPerMonth) : null;
  const adSpendGap       = (suggestedAdBudget !== null && currentAdSpend !== null) ? suggestedAdBudget - currentAdSpend : null;
  // Referral math: 1 referral per 5 customers/month, 50% convert — guard against 0 being falsy
  const estReferralCustomersRaw = estCustomersPerMonth ? estCustomersPerMonth / 5 * 0.5 : 0;
  const estReferralCustomers = estReferralCustomersRaw > 0 ? Math.max(1, Math.round(estReferralCustomersRaw)) : null;
  const estReferralRevenue   = (estReferralCustomers && avgCheck) ? estReferralCustomers * avgCheck : null;
  // Reactivation
  const repeatPct = a.q7 === 'yes' ? 60 : (a.q7 === 'sometimes' ? 30 : 10);
  const inactivePct = 100 - repeatPct;
  const estMonthlyReactivation = (estCustomersPerMonth && avgCheck) ? Math.round(estCustomersPerMonth * (inactivePct / 100) * 0.15 * avgCheck) : null;
  // Follow-up yield
  const improvedCloseLeads = (leadsPerMonth && closeRate) ? Math.round(leadsPerMonth * (Math.min(closeRate + 10, 95) / 100 - closeRate / 100)) : null;
  const followUpRevenue = (improvedCloseLeads && avgCheck) ? improvedCloseLeads * avgCheck : null;

  const prompt = `You are a senior business consultant at Nexvora Systems writing a personalized business health assessment report. Be direct, specific, and use the owner's REAL data — never make up facts. Reference their actual answers throughout. Use plain, confident language — no corporate fluff.

OWNER: ${a.contact?.name || 'Business Owner'}
BUSINESS: ${a.contact?.company || 'Their business'} — ${a.q1b_label || a.q1} in ${a.q2_city || ''}, ${a.q2 || ''}
YEARS IN BUSINESS: ${a.q3}
BUSINESS PARTNER: ${a.partner?.has ? `Yes — Owner role: ${a.partner.userRole||'N/A'}, Partner role: ${a.partner.partnerRole||'N/A'}, Involvement: ${a.partner.involvement||'N/A'}, Operating agreement: ${a.partner.opAgreement==='yes'?'Yes — has one':'NO — does not have one (flag this in the report as a critical risk)'}` : 'No — runs solo'}
STRUCTURE: ${SIZE_LABELS[a.q5]||a.q5}
GROWTH TARGET: ${a.growth_target_pct||'not provided'}% per year

REVENUE (MULTI-YEAR):
${revSummary}
Revenue trend: ${revTrend}
${rn?'Next year goal: $'+rn:''}
NOTE: y3=${_cy-3}, y2=${_cy-2}, y1=${_cy-1} are FULL-YEAR confirmed figures. y0=${_cy} is the current year — partial/estimated only. Repeat customer rate (q7) is a PERCENTAGE (e.g. q7=80 means 80% of revenue comes from returning customers, NOT 80 people).
${_curYearNote}
FINANCIAL BASELINE: All calculations in this report use ${_baselineLabel ? `${_baselineLabel} revenue ($${monthlyRevEst.toLocaleString()}/mo)` : 'no revenue data — skip all financial formulas'}. When writing projections or recommendations that reference monthly revenue, always state "based on ${_baselineLabel||'available'} revenue."${_lowRevenue ? ' WARNING: Revenue entered is unusually low (under $10,000/year). Financial projections may not be meaningful — note this in the report.' : ''}${_noRevenue ? ' WARNING: No revenue data provided. Do not generate financial projections or revenue-based calculations.' : ''}

PRIMARY PAIN POINT DIAGNOSED: ${PAIN_LABELS[a.primaryPain]||a.primaryPain}
Pain votes breakdown: ${JSON.stringify(a.painVotes||{})}

PAIN POINT ANSWERS:
- 50% more customers tomorrow → breaks: ${a.pain1}
- End-of-day feeling: ${a.pain2}
- Vacation blocker: ${a.pain3}

OPERATIONS:
- SOPs/processes: ${(a.q6||[]).join(', ')}
- SOP scenario (2-week absence): ${a.q6_scenario||'not asked'}
- Repeat customers: ${a.q7} | Customer split (new vs returning): ${a.customer_split||'not tracked'}
- Average transaction value: ${a.avg_check != null ? '$'+a.avg_check : 'not provided — recommend owner start tracking this'}
- Lead follow-up system: ${a.q8}
- Lead sources: ${(a.q9||[]).join(', ')||'none selected'}
- Ad spend: ${a.q9_adspend != null ? '$'+a.q9_adspend+'/mo' : '$0 — not running paid ads'}
- Leads from ads/month: ${a.q9_leads != null ? a.q9_leads : '0 — not tracked'}
- Closing rate (self-reported): ${closeRateTracked ? a.q9_close+'%' : 'NOT TRACKED — owner skipped this question. Use 10% as conservative industry minimum baseline for all calculations. NEVER write "0% closing rate" in the report — instead say closing rate is unknown, the industry standard for home services is typically 20-40%, and they must start tracking this immediately.'}
- Cost per lead: ${costPerLeadDisplay != null ? '$'+costPerLeadDisplay : (currentAdSpend > 0 ? 'not calculable — lead volume not tracked' : 'not applicable — not running paid ads')}
- Cost per customer (self-reported close rate): ${costPerCustomer != null ? '$'+costPerCustomer : (currentAdSpend > 0 ? 'not calculable — lead volume not tracked' : 'not applicable — not running paid ads')}
- Cost per customer (revenue-based — more accurate): ${costPerCustomerRevBased != null ? '$'+costPerCustomerRevBased : 'not calculable'}

DATA INTEGRITY CHECK — SHOW BOTH REPORTED AND CALCULATED METRICS:
- Revenue-based jobs/month: ${estCustomersPerMonth !== null ? estCustomersPerMonth : 'not calculable'} (= $${monthlyRevEst}/mo ÷ $${avgCheck} avg check — ground truth from actual revenue)
- Self-reported jobs/month: ${claimedJobsPerMonth !== null ? claimedJobsPerMonth : 'not calculable'} (= ${leadsPerMonth} leads × ${closeRate}% close rate)
${mismatchExists ? `⚠️ DATA MISMATCH DETECTED (${mismatchPct}% gap): Revenue math suggests ~${estCustomersPerMonth} completed jobs/month, but reported leads×close_rate implies ~${claimedJobsPerMonth} jobs/month. The revenue-based number is more reliable since it is derived from actual money collected.
Effective close rate implied by revenue: ~${effectiveCloseRate}% (not the reported ${closeRate}%).
IN THE REPORT, include this explanation in plain business language: "Based on your revenue and average transaction value, your completed job volume appears closer to ${estCustomersPerMonth} per month. If you receive ${leadsPerMonth} leads per month, your effective lead-to-job conversion appears closer to ${effectiveCloseRate}%, not the reported ${closeRate}%. This gap is worth investigating — seasonality, offline payments, or how you count leads could explain part of it. But it is also possible your close rate is lower than you think, which is an opportunity."
Frame this as an insight, not an accusation. Use the revenue-based figure (${estCustomersPerMonth} jobs/mo) for all financial calculations in the report.` : `✓ Numbers are consistent — revenue math and reported leads/close rate align within 20%. Use reported figures normally.`}
DATA CONFIDENCE LEVEL (reference this in your executive summary and any section where you discuss data reliability): ${mismatchExists ? 'Needs Review' : (!closeRateTracked || !leadsPerMonth || !avgCheck) ? 'Needs Review' : 'Verified'}. The report already displays a dedicated Data Confidence card — your narrative sections should be consistent with this level.
- Expense breakdown: ${expSummary}
- Online review rating: ${a.q10||'not provided'}
- Review monitoring: ${a.review_monitoring||'not answered'}
- Review request process: ${a.review_requests||'not answered'}
- Manual tasks: ${(a.q11||[]).join(', ')||'none selected'}${a.q11_other ? ` | Other (owner described): "${a.q11_other}"` : ''}
- Task management tool: ${a.q11b||'not answered'}
- Follow-up tracking: ${a.q11c||'not answered'}
- Team performance management: ${(a.q12||[]).join(', ')||'none'}
- Financial review frequency: ${a.q13||'not answered'}
- Cash flow status: ${a.cash_flow||'not answered'}
- Cash flow tracking method: ${a.cashflow_tracking||'not answered'}
- P&L statement: ${a.has_pl||'not answered'} | Usage: ${a.pl_usage||'not answered'}
- Bank separation (personal vs business): ${a.bank_personal_biz||'not answered'}${a.bank_personal_biz==='no'?' ← CRITICAL: mixed personal/business accounts, flag in report':''}
- Separate purpose accounts: ${a.bank_multi_accounts||'not answered'} | Account types: ${(a.bank_account_types||[]).join(', ')||'not answered'}
- Business visibility / KPI tracking: ${a.q14||'not answered'}

TEAM DETAIL:
${a.q19_solo_only ? 'SOLO OPERATOR — no employees or contractors. Do NOT generate team hiring, delegation, or payroll recommendations. Focus on owner capacity, systems, and automation instead.' : (teamSegLines.length ? teamSegLines.join('\n') : 'Solo / no team data')}
Total team payroll: $${a.q19_total||0}/mo (${a.q19_headcount||0} people)

GOALS:
- 12-month (multi-select): ${goals12mo}
- 3-year vision: ${goal3yr}
- 5-year goal: ${goal5yr}
- Biggest pain in their words: "${a.q_pain||'(skipped)'}"

OWNER ECONOMICS:
- How owner takes money: ${ownerPayLines.join(', ')||'not provided'}
- Total monthly owner compensation: $${totalMonthlyOwnerPay||a.q16||0}
- Annual owner compensation: ~$${Math.round(annualOwnerPay/1000)}K
- Is this enough for personal needs: ${a.owner_pay_enough||'not answered'}
- Hours/week worked: ${a.q17||0}
- Work slots (extra beyond 9-5): ${JSON.stringify(a.q17_slots||{})}
- Effective hourly rate (draws only, not including retained profit): ${(totalMonthlyOwnerPay>0&&a.q17>0)?'$'+Math.round(totalMonthlyOwnerPay/(a.q17*4.33))+'/hr — NOTE: this reflects explicit draws only. Do not present this as total compensation or compare directly to minimum wage without acknowledging retained business profit.':'not calculable — owner pay or hours data not provided'}
${a.partner?.has ? `
${_partnersArr.length > 0 ? `
PARTNER ECONOMICS (${_partnersArr.length} partner${_partnersArr.length>1?'s':''}):
${_partnersArr.map((p,i)=>{
  const payDesc = p.pay ? Object.entries(p.pay).map(([,v])=>`${v.label||'Pay'}: $${v.amount}/${v.frequency} ($${v.monthly}/mo)`).join(', ') : 'not provided';
  return `- Partner ${i+1}: ${p.name||'Partner'} | Role: ${p.role||'not specified'} | Involvement: ${p.involvement||'not specified'} | Pay: ${payDesc} | Monthly total: $${p.pay_total||0}`;
}).join('\n')}
- Total all partners monthly draws: $${totalMonthlyAllPartnersPay}
- Combined owner+ALL partners monthly draws: $${totalMonthlyOwnerPay+totalMonthlyAllPartnersPay}
- Combined annual draws (all owners): ~$${Math.round((annualOwnerPay+annualAllPartnersPay)/1000)}K` : '- No business partners'}` : ''}

WHAT WE FOUND ONLINE:
Business overview: ${research.business?.answer||'No data found'}
Top sources: ${(research.business?.results||[]).slice(0,3).map(r=>`${r.title}: ${r.snippet}`).join(' | ')||'none'}
Customer reviews (Google/general): ${research.reviews?.answer||'No data found'}
Yelp presence: ${research.yelp?.answer||'Not found on Yelp'}${research.yelp?.results?.length ? ' — Yelp listings: '+research.yelp.results.slice(0,2).map(r=>r.title).join(', ') : ''}
BBB listing: ${research.bbb?.answer||'Not found on BBB'}${research.bbb?.results?.length ? ' — BBB page: '+research.bbb.results[0]?.title : ''}
Social media: ${research.social?.answer||'No data found'}
Community/forums: ${research.forums?.answer||'No data found'}${research.forums?.results?.length ? ' — Sources: '+research.forums.results.slice(0,2).map(r=>r.title).join(', ') : ''}
Locations/website/service areas: ${research.locations?.answer||'No data found'}${research.locations?.results?.length ? ' — Found: '+research.locations.results.slice(0,3).map(r=>r.title+' ('+r.url+')').join(' | ') : ''}
Industry benchmarks: ${research.benchmarks?.answer||'No data found'}
NOTE: When writing onlinePresence, incorporate ALL of the above — Google reviews, Yelp rating/reviews, BBB accreditation status, social media activity, community mentions, and any additional locations or service areas found. If their website was found in locations search, mention it. Be specific about what was found vs. not found on each platform.

PRE-COMPUTED CAPACITY & GROWTH MATH (use these exact numbers — do not recalculate, NEVER write "unknown"):
- Estimated monthly revenue: ${monthlyRevEst ? '$'+monthlyRevEst.toLocaleString() : '$0 (no revenue data provided)'}
- Estimated annual revenue (for calculations): ${annualRevEst ? '$'+annualRevEst.toLocaleString() : '$0 (no revenue data provided)'}
- Avg transaction value: ${avgCheck ? '$'+avgCheck : 'not provided — in the report, flag this and tell them to start tracking it immediately'}
- Estimated customers served per month: ${estCustomersPerMonth !== null ? estCustomersPerMonth : (avgCheck ? '0' : 'not calculable — avg transaction value not provided; in the report tell the owner to track this and show them the formula: monthly revenue ÷ avg transaction = customers/month')}
- Owner hours/month: ${ownerHoursPerMonth}h
- Estimated hours per customer: ${avgHoursPerCustomer !== null ? avgHoursPerCustomer+'h' : 'not calculable — avg transaction value needed'}
- Additional customer capacity (${capacityHeadroomPct !== null ? capacityHeadroomPct+'% headroom' : 'headroom unknown'}): ${capacityHeadroomCustomers !== null ? (capacityHeadroomCustomers === 0 ? 'TEAM IS FULLY BOOKED — zero capacity without adding staff. Discuss optimization, not headroom.' : '+'+capacityHeadroomCustomers+' customers/month possible without hiring') : 'not calculable — avg transaction value needed; in the report still explain the concept and recommend the owner calculate it'}
- Capacity source: ${capacitySourceNote || 'not determined'}
- Capacity context: ${a.cap_team_based ? 'FIELD-TECH dependent business — growth requires either more field staff or optimizing current team schedules' : (a.cap_extra_clients != null ? 'OFFICE-BASED — team capacity drives growth ceiling' : 'capacity type not determined from assessment')}
- Current ad spend: $${currentAdSpend}/mo | Leads/mo: ${leadsPerMonth || 0} | Closing rate: ${closeRate || 0}%
- Cost per lead: ${costPerLead !== null ? '$'+costPerLead : (currentAdSpend > 0 ? 'not calculable — lead volume not tracked' : 'not applicable — not running paid ads')} | Cost per customer (ads): ${costPerCustomer !== null ? '$'+costPerCustomer : (currentAdSpend > 0 ? 'not calculable — lead volume not tracked' : 'not applicable — not running paid ads')}
- Industry benchmark ad budget (8% of revenue): ${suggestedAdBudget ? '$'+suggestedAdBudget+'/mo' : 'not calculable — revenue data missing'}
- Ad spend gap: ${adSpendGap > 0 ? 'underinvesting by $'+adSpendGap+'/mo vs benchmark' : (adSpendGap !== null && adSpendGap <= 0 ? 'at or above benchmark' : 'not calculable')}
- Referral program potential: ${estReferralCustomers !== null ? '~'+estReferralCustomers+' new customers/mo = $'+(estReferralRevenue||0).toLocaleString()+'/mo added revenue' : 'exact number not calculable — avg transaction value needed; still recommend a referral program and explain the concept using their industry'}
- Customer reactivation opportunity: ${estMonthlyReactivation !== null ? '~$'+estMonthlyReactivation.toLocaleString()+'/mo from re-engaging inactive customers' : 'exact number not calculable — avg transaction value needed; still recommend a re-engagement campaign and estimate conservatively'}
- Follow-up system improvement (+10pp close rate): ${improvedCloseLeads !== null ? '~'+improvedCloseLeads+' more customers/mo = $'+(followUpRevenue||0).toLocaleString()+'/mo added revenue' : 'exact number not calculable — lead tracking data needed; still strongly recommend building a follow-up system and show the math concept'}

PRE-COMPUTED MARGIN MATH (use these exact figures — do not recalculate):
- Expense breakdown categories total: ${Math.round(_expBreakdownTotal)}% of revenue (${expSummary})
- Owner monthly draws (NOT included in expense breakdown): $${totalMonthlyOwnerPay||0}/mo = ~${annualRevEst ? Math.round(totalMonthlyOwnerPay*12/annualRevEst*100) : 0}% of revenue
${a.partner?.has && totalMonthlyPartnerPay ? `- Partner monthly draws (NOT included in expense breakdown): $${totalMonthlyPartnerPay}/mo = ~${annualRevEst ? Math.round(totalMonthlyPartnerPay*12/annualRevEst*100) : 0}% of revenue` : '- Partner draws: no partner / not provided'}
- Combined owner+partner draws: $${totalMonthlyOwnerPay+totalMonthlyPartnerPay}/mo = ~${annualRevEst ? Math.round((totalMonthlyOwnerPay+totalMonthlyPartnerPay)*12/annualRevEst*100) : 0}% of revenue
- Team payroll breakdown from headcount entries:
  · Field / contractors: $${(()=>{ const f=new Set(['field','contractors','field-contractors']); return Object.entries(a.q19_segments||{}).filter(([s])=>f.has(s)).reduce((t,[,d])=>{ const _c=(a.salary_mode==='individual'&&d.pay_with_tax!=null)?Number(d.pay_with_tax):Number(d.pay||0); return t+Number(d.count||0)*_c; },0); })()}/mo (from q19_segments field types${a.salary_mode==='individual'?' — pay_with_tax used where applicable':''})
  · Back-office staff (managers, admin, sales, CS, etc.): $${_backOfficeMo}/mo = ~${_backOfficePct}% of revenue (from q19_segments non-field types)
  · q19_total (all team combined): $${a.q19_total||0}/mo
  · Tips pass-through: ${_totalTipsMo > 0 ? '$'+_totalTipsMo.toLocaleString()+'/mo of gross revenue goes directly to staff as tips — this is NOT additional business cost, but it means effective retained revenue is ~$'+(monthlyRevEst-_totalTipsMo).toLocaleString()+'/mo' : 'none reported'}
- Field labor (contractors) from q19_segments: $${_fieldMo}/mo = ${_fieldPct}% of revenue. Back-office payroll: $${_backOfficeMo}/mo = ${_backOfficePct}% of revenue.
- TRUE total staff cost = ${_fieldPct + _backOfficePct}% of revenue (field ${_fieldPct}% + back-office ${_backOfficePct}%)
- Estimated margin from expense breakdown alone: ${Math.round(100-_expBreakdownTotal)}% — NOTE: this does NOT include owner/partner draws, back-office payroll, field labor, or taxes
- COMBINED EXPENSE RATIO (overhead + field + back-office): ${Math.round(_expBreakdownTotal) + _fieldPct + _backOfficePct}% — USE THIS when stating total expenses.
- True estimated net margin (after all staff + owner+partner draws): ~${annualRevEst ? Math.max(0,Math.round(100-_expBreakdownTotal-_fieldPct-_backOfficePct-Math.round((totalMonthlyOwnerPay+totalMonthlyPartnerPay)*12/annualRevEst*100))) : Math.round(100-_expBreakdownTotal)}%
- IMPORTANT CONTEXT FOR CLEANING/CONTRACTOR BUSINESSES: Industry benchmark for field labor (contractors) = 50-65% of revenue. This is NORMAL for cleaning companies. Field labor at ${_fieldPct}% is ${_fieldPct >= 50 && _fieldPct <= 65 ? 'within' : _fieldPct < 50 ? 'below' : 'above'} that norm. Back-office at ${_backOfficePct}% is additional overhead on top.
${(a.behind_on_payroll === 'yes' || a.behind_on_payroll === 'yes-severe') ? `
PAYROLL DELAY — CRITICAL SIGNAL (this overrides all other priorities):
- Status: ${a.behind_on_payroll === 'yes-severe' ? 'SEVERE — team is usually 1+ week behind on payment' : 'MODERATE — team is sometimes a few days behind'}
- Average days late: ${a.behind_payroll_days || 'not specified'}
- Root cause: business is using future revenue to fund current payroll obligations — a compounding cycle that accelerates when revenue softens
- MANDATORY INSTRUCTIONS:
  1. Add payroll delay as the FIRST item in criticalGaps with full explanation
  2. Reference it in cashFlowAnalysis — explain the compounding risk explicitly
  3. Make it top3Actions[0] — financial stabilization before any growth
  4. Reduce financialScore by at least 2 points to reflect this risk
  5. In ownerEconomics, flag that draws may need to be temporarily reduced to restore payroll health
` : ''}
CRITICAL WRITING RULE: Never write "unknown" anywhere in the report. If data is missing, explain in 1 sentence what data would enable the calculation, then give actionable guidance anyway. A report with missing data should still be 100% useful and specific to this owner's situation.

GLOBAL SOFTWARE RULE — APPLIES TO EVERY FIELD IN THIS REPORT:
(1) NEVER mention any software brand names anywhere in the report — not as suggestions, not as examples, not as comparisons. Describe tool CATEGORIES only (e.g. "field service management platform", "CRM", "project management tool", "VoIP system", "accounting software").
(2) This business currently uses: ${a.current_software||'not provided'}. Before suggesting ANY tool category, check if they already have it covered. Do NOT suggest something they already use or an equivalent. Map each tool to its category and treat that category as covered.
(3) If they already have a tool in a category, acknowledge it is covered and focus only on uncovered gaps.

DEPTH REQUIREMENT: Every string field must be DETAILED and SPECIFIC to this owner. Minimum 3-5 sentences per narrative field. Use their real numbers everywhere. No generic advice — every sentence should reference something from their actual assessment. The goal is a report they could not get anywhere else.

Return ONLY valid JSON with these exact keys:

{
  "ownerFirstName": "string",
  "businessName": "string",
  "industry": "string",
  "location": "string — City, State",
  "primaryPainLabel": "string — human-readable label for their #1 pain",
  "painDiagnosis": "string — 4-5 sentences. Explain exactly which pain point scored highest from their votes, quote their specific answers to pain1/pain2/pain3, and connect it to what it reveals about the business right now. Make them feel seen.",
  "executiveSummary": "string — 5-6 sentences: open with one honest statement about where the business stands, name 2 specific things working well using their data, name the single biggest structural risk, and end with what must change first. Use real numbers from their assessment.",
  "onlinePresence": "string — 4-5 sentences. Detail exactly what was found online: Google rating and review count, which social platforms are active and how engaged, what their web presence looks like, and how they compare to other businesses in their city and industry. Be specific — name platforms, name gaps.",
  "industryBenchmark": "string — 4-5 sentences. Compare their revenue, team size, close rate, ad spend, and hours worked to real industry benchmarks for their specific business type. Name the benchmarks. Say where they're ahead and where they're behind. Give context for why the gaps matter.",
  "keyStrengths": ["string — specific strength #1 with their data as evidence", "string — strength #2 with evidence", "string — strength #3 with evidence"],
  "criticalGaps": ["string — gap #1 naming the exact metric or missing system and why it's costing them money", "string — gap #2 same format", "string — gap #3 same format"],
  "ownerEconomics": "string — 6-8 sentences. List every compensation type they reported (salary, distribution, etc.) and the total monthly and annual figure. Calculate effective hourly rate from their hours. Compare to market rate for their industry and business size. Say directly whether they are overpaying or underpaying themselves. Analyze the relationship between what they take home and what the business produces. Flag any structural risk (e.g. taking too much when revenue is flat, or taking too little when the business could afford more).",
  "revenueAnalysis": "string — 6-8 sentences. Walk through each revenue year they reported. Calculate and state the exact YoY % change for each period. Annualize the YTD figure and compare it to last year. Assess the trend (accelerating, flat, declining). Compare growth rate to their stated target of ${a.growth_target_pct||'N/A'}% — is the business on track? What would they need to do differently to hit that target? Give a concrete number: at their current growth rate, what will revenue be in 3 years?",
  "expenseAnalysis": "string — 5-7 sentences. For each expense category reported, name the % and say whether it is in line with, above, or below industry norms for their business type. Estimate the approximate margin based on total accounted expenses. If some categories are missing, name them and explain what the unaccounted % likely contains. Flag any single category that seems disproportionate.",
  "cashFlowAnalysis": "string — 4-5 sentences. Describe their current cash flow situation in direct terms. Assess how they track it and what risk that creates. If cash flow is tight, explain the likely cause based on their expense and revenue data. Give 2 specific steps to improve cash flow visibility within 30 days.",
  "goalsAnalysis": "string — 5-7 sentences. State their 12-month goals, 3-year vision, and 5-year goal. Assess whether the 3 timeframes are aligned with each other. Look at the gap between where they are now (current revenue, team size, hours) and where they want to be. Be direct — is the path realistic at the current growth rate, or would it require a structural shift? Name what needs to change to make the vision achievable.",
  "capacityAnalysis": {
    "currentCapacity": "string — 4-5 sentences. State exactly how many customers they are estimated to be serving per month based on revenue ÷ avg check. Show the calculation. Describe what that means for their workload given their hours. Assess whether they are near capacity or have room to grow without additional hiring.",
    "growthCapacity": "string — 4-5 sentences. Using the 25% headroom calculation, state exactly how many additional customers they could take on without hiring. Convert that to additional monthly revenue. Explain what would need to happen operationally to absorb that growth (systemization, delegation, scheduling). Give a specific first step.",
    "adSpendOpportunity": "string — 5-6 sentences. State their current ad spend and compare to the industry benchmark of 8% of revenue. Show the exact gap in $ per month. Then model the ROI: at their current closing rate and avg check, if they spent the full benchmark amount, how many additional leads would they need and how many customers would that produce? Give a specific platform recommendation for their industry.",
    "followUpPotential": "string — 4-5 sentences. State current closing rate and leads per month. Show what a 10-percentage-point improvement in close rate would produce in additional customers and revenue per month using the pre-computed number. Explain why most service businesses lose leads in follow-up. Give a 3-step follow-up sequence they can implement this week.",
    "reactivationOpportunity": "string — 4-5 sentences. Estimate the inactive customer base based on their repeat % and monthly volume. State the reactivation revenue opportunity using the pre-computed number. Give a specific re-engagement script or offer that would work for their industry. Name the tool to use (text, email, etc.).",
    "referralPotential": "string — 4-5 sentences. State the referral revenue opportunity using the pre-computed number. Explain the math clearly. Describe a referral mechanic that fits their industry (e.g. account credit, discount, gift card). IMPORTANT: Do NOT pick a specific dollar amount for the incentive — instead, state that industry best practice is to offer between 5% and 15% of the average transaction value as the referral reward, which in their case works out to a range of $[5% of avg_check] to $[15% of avg_check]. Let them decide the exact amount based on their margins. Give the word-for-word ask script they can use with happy customers."
  },
  "operationsScore": "number 1-10 based on SOPs, tools, follow-up tracking",
  "operationsScoreNote": "string — 2 sentences: why this score, and what single change would raise it by 2 points",
  "marketingScore": "number 1-10 based on lead sources, closing rate, follow-up system, review management",
  "marketingScoreNote": "string — 2 sentences: why this score, and what single change would raise it by 2 points",
  "teamScore": "number 1-10 based on team structure, management, partner involvement",
  "teamScoreNote": "string — 2 sentences: why this score, and what single change would raise it by 2 points",
  "financialScore": "number 1-10 based on review frequency, dashboard, P&L, cash flow tracking",
  "financialScoreNote": "string — 2 sentences: why this score, and what single change would raise it by 2 points",
  "top3Actions": [
    {"title":"string","why":"string — 2-3 sentences on exactly why this is priority #1 for THIS owner, citing their specific data and current situation","how":"string — 5-7 numbered concrete steps with enough detail to start today. Name specific tools, timelines, and what 'done' looks like.","impact":"string — 3-4 sentences describing exactly what changes when this is done: the metric that improves, the $ impact, the owner's experience."}
  ],
  "top3Actions_instructions": "CRITICAL PRIORITY ORDER: Choose the 3 actions that will have the highest real business impact for this owner. Always evaluate in this order — if there is a problem in a category, prioritize it: 1) FINANCIAL HEALTH first (cash flow, margins, P&L, banking), 2) OPERATIONS second (SOPs, systems, delegation, team management), 3) SALES & MARKETING third (leads, follow-up, close rate, ad spend). NEVER put 'establish an operating agreement' as a top action — it is a legal housekeeping item, not a business growth priority. Legal and partnership matters should be handled but are NOT in the top 3. Each of the 3 actions must come from a different category.",
  "growthPlan": [
    {
      "theme": "FINANCIAL",
      "items": ["string — numbered action item. Start with an assessment of the owner's current financial state based on their data. Only recommend increasing any spend (ads, hiring, etc.) AFTER confirming the financials allow it. If expenses are high, recommend finding cuts first. If cash flow is tight, recommend stabilizing before growing. Each item: specific action + why it applies to them + expected outcome. No generic advice."]
    },
    {
      "theme": "OPERATIONS",
      "items": ["string — action item specific to their SOPs, team, and tools situation"]
    },
    {
      "theme": "SALES & MARKETING",
      "items": ["string — IMPORTANT: Do NOT recommend a specific ad spend dollar amount unless you have confirmed from their financial data that they can afford it. Instead, suggest reviewing current ad spend efficiency first (cost per lead, close rate), then recommend testing budget increases incrementally. Reference their actual close rate and lead volume from the assessment."]
    },
    {
      "theme": "TEAM",
      "items": ["string — action item specific to their team size, headcount, and management gaps"]
    },
    {
      "theme": "CUSTOMER EXPERIENCE",
      "items": ["string — action item on retention, reviews, reactivation, referrals"]
    }
  ],
  "growthPlan_note": "Each theme must have 3-5 items. Minimum 15 items total across all themes. Every item must reference their real numbers and situation. No operating agreement items here.",
  "operationsDeepDive": {
    "currentState": "string — 5-6 sentences. Describe what their operations actually look like today based on their answers: which processes exist, what gets managed manually, what tools they use, how tasks are tracked. Reference their specific answers about SOPs, task tools, and follow-up tracking. Paint a clear picture of the operational maturity level.",
    "bottlenecks": ["string — bottleneck #1: name it precisely, explain why it exists based on their data, and quantify the cost in time or revenue", "string — bottleneck #2 same format", "string — bottleneck #3 same format"],
    "sopPriorities": "string — 5-6 sentences. Name the 3 most critical SOPs to build first for their specific business and industry. For each, explain why it's high-priority, what happens when it's missing, and what a basic version would contain. Give a framework for building each one in 2-3 hours.",
    "delegationOpportunity": "string — 5-6 sentences. This owner already has a team of ${Object.values(a.q19_segments||{}).reduce((s,d)=>s+Number(d.count||0),0)} staff — do NOT assume they are doing low-level tasks like scheduling or invoicing themselves. We do not know their exact daily tasks. Instead, focus on STRATEGIC delegation: what categories of decisions should the owner stop making as the business scales? What level of decision should require owner approval vs. be fully handled by their team? At their effective hourly rate ($${Math.round(((a.owner_pay?.w2?.monthly||0)+(a.owner_pay?.distribution?.monthly||0))/(a.q17||40))} per hour across ${a.q17||40} hrs/week), what types of owner involvement have the highest opportunity cost? What does a well-structured org look like at their revenue level where the owner works ON the business, not IN it?",
    "systemsScore": "string — e.g. '4/10 — has informal processes but nothing written down; team relies on owner for every decision'"
  },
  "marketingDeepDive": {
    "currentState": "string — 5-6 sentences. Describe their current marketing in full: which channels are active, what they're spending, what their funnel looks like from lead to close, how well they follow up, and what their online reputation shows. Reference their actual lead sources, ad spend, and close rate.",
    "funnelAnalysis": "string — 5-6 sentences. Map the entire funnel with their real numbers: estimated leads per month by source, conversion rate at each stage, how many become customers, and what revenue that produces. Identify the single biggest drop-off point in the funnel and explain what's causing it. Show what fixing just that one point would produce in additional revenue.",
    "topChannelRecommendations": ["string x5 — recommend exactly 5 channels. For each: (1) name the platform, (2) explain WHY it fits their specific industry, business type, and location — not generic reasons, (3) describe how to get started (first steps), (4) note what they need to test and figure out for their specific market — do NOT invent specific % metrics or guarantee outcomes. IMPORTANT: for home services / cleaning / local service businesses, always consider: Google Local Services Ads (pay-per-lead, high intent), Yelp Ads (strong for home services), Thumbtack (lead marketplace), Nextdoor (hyper-local neighborhood targeting), before suggesting generic platforms. Only include Facebook/Instagram/Email if genuinely relevant after covering the above. Never make up CTR%, conversion rates, or ROI numbers — say what to track and test instead."],
    "reviewStrategy": "string — 5-6 sentences. Assess their current review situation (rating, count, monitoring). Explain what review volume means for local search ranking in their industry. Give a specific ask script they can send by text immediately after job completion. Describe a system for asking every customer — not just happy ones. Explain what to do when they get a negative review.",
    "retentionVsAcquisition": "string — 5-6 sentences. Calculate the lifetime value of a retained customer vs the cost of acquiring a new one at their current ad spend and close rate. Show which ROI is higher and why. Based on their repeat customer % and cash flow situation, give a specific recommendation on where to put more focus right now. Name what a retention campaign would look like for their industry."
  },
  "teamAnalysis": {
    "currentStructure": "string — 5-6 sentences. Describe the team fully: headcount, estimated payroll vs revenue, how performance is managed, how the owner currently spends their time relative to the team. Reference their specific answers about team segments, performance management, and hours worked. Assess whether the current structure can support their growth goals.",
    "payrollRatio": "string — 4-5 sentences. State field labor (contractors) as % of revenue using the 'staff' expense line from the breakdown. CRITICAL: For cleaning and home services businesses with field contractors, the industry benchmark is 50-65% of revenue for labor — NOT the generic 25-35% that applies to office businesses. If their contractor cost is 50-65%, say it is IN LINE with the industry norm. Only flag as overstaffed if labor exceeds 70%+ of revenue. Separately note back-office/admin payroll if reported via team payroll data. Explain what the ratio means for margin and scalability.",
    "nextHire": "string — 6-8 sentences. CRITICAL RULES: (1) NEVER mention any software brand names — describe tool categories only (e.g. 'field service management software', 'CRM platform', 'invoicing tool'). (2) The business currently uses: ${a.current_software||'not provided'}. Do NOT suggest anything in a category they already have — check each tool they use and understand what it covers before making any recommendation. (3) Before recommending a hire, check if automation can solve the problem first — but only for gaps NOT already covered by their current stack. (4) Only recommend a human hire for roles requiring judgment, relationships, or physical presence. Based on their team of ${Object.values(a.q19_segments||{}).reduce((s,d)=>s+Number(d.count||0),0)} staff, their primary pain of '${a.primaryPain}', and their current software stack, identify the single most impactful next hire OR the single most impactful automation gap. Explain the business case: what specific problem does it solve, what does it cost vs. the cost of not solving it, and what does the owner get back.",
    "managementGaps": "string — 5-6 sentences. List the management systems they're missing based on their answers. For each gap, explain the cost: what breaks down when there's no performance review system, no scorecard, no regular check-in. Give 3 specific tools or templates to implement in the next 30 days.",
    "partnerNote": "string — if they have a partner: analyze whether roles are clearly defined, assess the involvement level, and give advice on structuring the partnership for growth. If they have no operating agreement, mention it ONCE briefly here (1 sentence) as something to address — do NOT dwell on it, do NOT repeat it elsewhere in the report, and do NOT make it a top priority action. The focus should be on how the partnership can be optimized for the business goals. If no partner, write 'Not applicable.'"
  },
  "financialHealthDeepDive": {
    "marginEstimate": "string — 5-6 sentences. Use the COMBINED EXPENSE RATIO (including back-office) when quoting total expenses — NOT just the expense_breakdown total. Use the PRE-COMPUTED MARGIN MATH provided above — do NOT re-add the expense percentages yourself. State the expense breakdown total % from the pre-computed data, note that owner draws are NOT included in that figure, and show the true estimated net margin after owner compensation. Be explicit about what is and is not included. Compare to cleaning/home services industry benchmark: net margin of 10-20% is healthy; below 10% signals pricing or cost pressure. If the expense total seems high, check whether it is because field labor (50-65%) is correctly accounted for — that is normal for contractor-based businesses, not a red flag.",
    "expenseRatioAnalysis": "string — 5-6 sentences. Go category by category: for each expense they reported, name the % and compare to industry norm. Flag anything more than 5 points outside the benchmark. Give a specific recommendation for each flagged category. For categories they didn't report, explain why tracking them matters.",
    "profitLeakage": "string — 5-6 sentences. Identify 3 specific areas where money is likely escaping based on their exact answers. For each: name the leak, explain why it's happening, estimate the monthly cost, and give the fix. Be direct — if they are underpricing, say how much they are likely leaving on the table. If they have no tax reserve, show them the math of what they could owe.",
    "financialRoadmap": "string — 6-8 sentences. Give 3 specific financial moves for the next 90 days, ordered by priority. For each move: what to do, why it matters for them specifically, and what metric will improve. Reference their current cash flow status, P&L situation, and banking setup. End with what their financial health should look like at the 90-day mark if they execute."
  },
  "automationOpportunities": [
    {"area": "string — e.g. Lead Follow-Up", "currentState": "string — describe in detail what they currently do manually, referencing their actual answers", "solution": "string — describe the automation WORKFLOW and CATEGORY of tool only (NEVER name a brand). Check current_software first — if they already have a tool covering this area, say so and describe how to USE it better. Only identify genuine gaps. Describe what the automated workflow looks like step by step.", "impact": "string — time saved per week, revenue impact if calculable, and what the owner can do with the freed time"},
    {"area": "string", "currentState": "string", "solution": "string", "impact": "string"},
    {"area": "string", "currentState": "string", "solution": "string", "impact": "string"},
    {"area": "string", "currentState": "string", "solution": "string", "impact": "string"},
    {"area": "string", "currentState": "string", "solution": "string", "impact": "string"}
  ],
  "closingNote": "string — 3-4 sentences. Personal, direct, from Murat and Alexandr. Reference this specific owner's situation — their pain point, their goal, or a specific number from their report. Not a generic 'we're here for you.' Make it feel like it was written just for them."
}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 16384,
      response_format: { type: 'json_object' }
    })
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return JSON.parse(json.choices[0].message.content);
}

// ── Call B: Deep-dive strategy (pricing, automation scenarios, SOPs, risk, competitive, 180-day) ──

async function writeAssessmentReportB(a, research, competitorRes) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return {};

  // Pre-compute math — baseline priority: y3 (current estimate) → y2 → y1 → y0
  const r0 = a.q4_parsed?.y0 || 0;
  const r1 = a.q4_parsed?.y1 || 0;
  const r2 = a.q4_parsed?.y2 || 0;
  const r3 = a.q4_parsed?.y3 || 0;
  const annualRev = r3 || r2 || r1 || r0 || 0;
  const mo = annualRev > 0 ? Math.round(annualRev / 12) : 0;
  const _bYear = new Date().getFullYear();
  const _baselineLabelB = r3 ? `${_bYear} estimate (current year)` : (r2 ? `${_bYear-1} (last full year)` : (r1 ? `${_bYear-2}` : (r0 ? `${_bYear-3}` : null)));
  const _noRevenueB = annualRev === 0;
  const _lowRevenueB = annualRev > 0 && annualRev < 10000;
  const avgCheck = Number(a.avg_check) || 0;
  const estJobs = avgCheck > 0 && mo > 0 ? Math.round(mo / avgCheck) : null; // revenue-based (ground truth)

  // Data integrity — replicate same mismatch logic as Call A
  const _leadsB       = Number(a.q9_leads) || 0;
  const _closeTrackedB = a.q9_close != null;
  const _closeRateB   = _closeTrackedB ? Number(a.q9_close) : 10;
  const _adSpendB     = Number(a.q9_adspend) || 0;
  const _claimedJobsB = (_leadsB && _closeTrackedB) ? Math.round(_leadsB * (_closeRateB / 100)) : null;
  const _mismatchPctB = (_claimedJobsB && estJobs) ? Math.round(Math.abs(_claimedJobsB - estJobs) / Math.max(_claimedJobsB, estJobs) * 100) : null;
  const _mismatchB    = _mismatchPctB !== null && _mismatchPctB > 20;
  const _effCloseB    = (estJobs !== null && _leadsB > 0) ? Math.round(estJobs / _leadsB * 100) : null;
  const _costPerCustRevB = (_adSpendB && estJobs) ? Math.round(_adSpendB / estJobs) : null;

  const expPctRaw = Object.entries(a.expense_breakdown||{}).filter(([,v])=>v!=null).reduce((s,[,v])=>s+Number(v),0) / 100;

  const fieldTypes = new Set(['field','contractors','field-contractors']);
  const backOfficeMo = Object.entries(a.q19_segments||{}).filter(([s])=>!fieldTypes.has(s)).reduce((t,[,d])=>{
    const cost = (a.salary_mode==='individual' && d.pay_with_tax!=null) ? Number(d.pay_with_tax) : Number(d.pay||0);
    return t + Number(d.count||0) * cost;
  }, 0);
  // Field/contractor costs scale with revenue — include as variable % for break-even
  const fieldMoB = Object.entries(a.q19_segments||{}).filter(([s])=>fieldTypes.has(s)).reduce((t,[,d])=>t+Number(d.count||0)*Number(d.pay||0), 0);
  const fieldPctRaw = mo > 0 ? fieldMoB / mo : 0;
  // Total variable ratio = overhead % + field % (both scale with revenue)
  const totalVarPct = expPctRaw + fieldPctRaw;

  const ownerMo = Object.values(a.owner_pay||{}).reduce((s,v)=>{
    const monthly = v.monthly || (v.frequency==='weekly' ? Math.round(Number(v.amount)*4.33) : Number(v.amount));
    return s + monthly;
  }, 0);
  const partnersArr = a.partners || (a.partner?.has && a.partner_pay ? [{pay_total: a.partner_pay_total||0}] : []);
  const partnerMo = partnersArr.reduce((s,p)=>s+(p.pay_total||0), 0);
  const allDraws = ownerMo + partnerMo;

  const monthlyNet = mo > 0 ? Math.round(mo * (1 - expPctRaw) - allDraws - backOfficeMo) : null;
  // Break-even: fixed costs (draws + back-office) ÷ contribution margin (1 - all variable %)
  // Variable costs include both overhead % AND field/contractor % (they scale with revenue)
  const breakEvenMo = totalVarPct < 1 ? Math.ceil((allDraws + backOfficeMo) / (1 - totalVarPct) / 100) * 100 : null;

  // Pricing scenarios
  const p1  = mo > 0 ? { gainMo: Math.round(mo*0.01),   gainYr: Math.round(mo*0.01*12),   newCheck: Math.round(avgCheck*1.01)  } : null;
  const p35 = mo > 0 ? { gainMo: Math.round(mo*0.035),  gainYr: Math.round(mo*0.035*12),  newCheck: Math.round(avgCheck*1.035) } : null;
  const p10_3 = mo > 0 ? {
    newCheck: Math.round(avgCheck*1.10), newJobs: estJobs ? Math.round(estJobs*0.97) : null,
    newMo: Math.round(mo*1.10*0.97), gainMo: Math.round(mo*1.10*0.97-mo), gainYr: Math.round((mo*1.10*0.97-mo)*12)
  } : null;
  const p10_5 = mo > 0 ? {
    newCheck: Math.round(avgCheck*1.10), newJobs: estJobs ? Math.round(estJobs*0.95) : null,
    newMo: Math.round(mo*1.10*0.95), gainMo: Math.round(mo*1.10*0.95-mo), gainYr: Math.round((mo*1.10*0.95-mo)*12)
  } : null;

  // 180-day projections
  const badM1  = monthlyNet;
  const badM2  = mo > 0 ? Math.round(mo*0.90*(1-expPctRaw)-allDraws-backOfficeMo) : null;
  const badM3  = mo > 0 ? Math.round(mo*0.82*(1-expPctRaw)-allDraws-backOfficeMo) : null;
  const badM46 = mo > 0 ? Math.round(mo*0.75*(1-expPctRaw)-allDraws-backOfficeMo) : null;
  const badCum6 = (badM1!=null&&badM2!=null&&badM3!=null&&badM46!=null) ? badM1+badM2+badM3+(badM46*3) : null;

  const goodM1  = monthlyNet;
  const goodM2  = mo > 0 ? Math.round(mo*1.035*(1-expPctRaw)-allDraws-backOfficeMo) : null;
  const goodM3  = mo > 0 ? Math.round(mo*1.035*1.05*(1-expPctRaw)-allDraws-backOfficeMo) : null;
  const goodM6  = mo > 0 ? Math.round(mo*1.10*1.10*(1-expPctRaw)-allDraws-backOfficeMo) : null;
  const safeDrawIncrease = (goodM6 != null && goodM6 > 2000 && ownerMo > 0) ? Math.round(ownerMo*0.10) : null;
  // Concrete net threshold for safe draw increase = good-scenario Month 3 net, rounded up to nearest $5k
  const safeNetThreshold = goodM3 != null ? Math.ceil(Math.max(goodM3, 10000) / 5000) * 5000 : null;

  const industryLabels = {'home-services':'Home Services','construction':'Construction','food-bev':'Food & Beverage','retail':'Retail','health-wellness':'Health & Wellness','professional-services':'Professional Services','auto':'Auto Services','real-estate':'Real Estate'};
  const manualTasks = (a.q11||[]).filter(v=>v!=='none').map(v=>({'scheduling':'Scheduling','invoicing':'Invoicing','follow-up':'Customer follow-up','reporting':'Reporting','data-entry':'Data entry','payroll':'Payroll processing','other':a.q11_other||'Other'}[v]||v));
  const competitorSnippets = (competitorRes?.results||[]).slice(0,7).map(r=>`• ${r.title} — ${r.snippet}`).join('\n');

  const prompt = `You are a direct, data-driven business advisor for Nexvora Systems. Generate a deep-dive strategy report for this business. Respond with ONLY valid JSON, no markdown.

BUSINESS:
- Owner: ${a.contact?.name||'Owner'} | Company: ${a.contact?.company||''}
- Industry: ${industryLabels[a.q1]||a.q1} — ${a.q1b_label||''} | Location: ${a.q2_city||''}, ${a.q2||''}
- Revenue baseline: $${mo}/mo ($${annualRev}/yr) — based on ${_baselineLabelB||'no data'}${_noRevenueB?' — NO REVENUE PROVIDED, skip all financial projections':''}${_lowRevenueB?' — REVENUE VERY LOW (<$10k/yr), note that projections may not be meaningful':''} | Avg job/check: $${avgCheck} | Est. jobs/mo: ${estJobs||'unknown'}
- Team size: ${a.q19_solo_only ? 'SOLO — no staff (confirmed by owner). Skip all team/hiring/delegation analysis.' : `${a.q19_headcount||0} people`} | Primary pain: ${a.primaryPain||''}
- Current software: ${a.current_software||'not provided'}
- Manual tasks: ${manualTasks.join(', ')||'not specified'}
- Task management: ${Array.isArray(a.q11b)?a.q11b.join(', '):a.q11b||'unknown'} | Follow-up tracking: ${a.q11c||'unknown'}
- Cash flow: ${a.cash_flow||'unknown'} | Repeat rate: ${a.q7||'unknown'}%

PRE-COMPUTED NUMBERS (use exactly — do not recalculate):
- Monthly net cash flow: ${monthlyNet!=null?'$'+monthlyNet+'/mo':'unknown'}
- Break-even revenue: ${breakEvenMo?'$'+breakEvenMo+'/mo':'unknown'}
- Owner + partner draws: $${allDraws}/mo | Back-office payroll: $${backOfficeMo}/mo
- Variable expense ratio: ${Math.round(expPctRaw*100)}% of revenue

PRICING SCENARIOS (quote these exact numbers):
+1% price increase (0% customer loss): +$${p1?.gainMo||0}/mo | +$${p1?.gainYr||0}/yr | new avg check $${p1?.newCheck||0}
+3.5% increase (0% customer loss): +$${p35?.gainMo||0}/mo | +$${p35?.gainYr||0}/yr | new avg check $${p35?.newCheck||0}
+10% increase, −3% job loss: new revenue $${p10_3?.newMo||0}/mo | gain +$${p10_3?.gainMo||0}/mo | +$${p10_3?.gainYr||0}/yr
+10% increase, −5% job loss: new revenue $${p10_5?.newMo||0}/mo | gain +$${p10_5?.gainMo||0}/mo | +$${p10_5?.gainYr||0}/yr
Note: service businesses with >65% repeat rate typically see 2−4% customer loss on a 10% price increase.

180-DAY PROJECTIONS (use these exact figures):
BAD scenario (revenue declining):
  Month 1: $${mo}/mo revenue → net $${badM1!=null?badM1:'unknown'}/mo
  Month 2 (−10%): $${Math.round(mo*0.90)}/mo revenue → net $${badM2!=null?badM2:'unknown'}/mo
  Month 3 (−18%): $${Math.round(mo*0.82)}/mo revenue → net $${badM3!=null?badM3:'unknown'}/mo
  Month 4−6 (−25%): $${Math.round(mo*0.75)}/mo revenue → net $${badM46!=null?badM46:'unknown'}/mo
  Cumulative 6-month result: $${badCum6!=null?badCum6:'unknown'}
GOOD scenario (implement recommendations):
  Month 1: $${mo}/mo, automation starts → net $${goodM1!=null?goodM1:'unknown'}/mo
  Month 2 (+3.5% price): $${Math.round(mo*1.035)}/mo → net $${goodM2!=null?goodM2:'unknown'}/mo
  Month 3 (+3.5% price + 5% volume): $${Math.round(mo*1.035*1.05)}/mo → net $${goodM3!=null?goodM3:'unknown'}/mo
  Month 4−6 (+10% price + 10% volume): $${Math.round(mo*1.10*1.10)}/mo → net $${goodM6!=null?goodM6:'unknown'}/mo
  ${safeDrawIncrease ? `Safe owner draw increase at Month 6: +$${safeDrawIncrease}/mo (10% raise)` : 'Owner draw increase not yet safe — reinvest surplus first'}

DATA INTEGRITY — USE REVENUE-BASED FIGURES FOR ALL CALCULATIONS:
- Revenue-based jobs/month (ground truth): ${estJobs !== null ? estJobs : 'not calculable'} (= $${mo}/mo ÷ $${avgCheck} avg check)
- Self-reported jobs/month: ${_claimedJobsB !== null ? _claimedJobsB : 'not calculable'} (= ${_leadsB} leads × ${_closeRateB}% close rate)
- Cost per booked customer (revenue-based): ${_costPerCustRevB !== null ? '$'+_costPerCustRevB : 'not calculable'}
${_mismatchB ? `⚠️ MISMATCH (${_mismatchPctB}%): Use revenue-based job count (${estJobs}/mo) for all calculations — it is derived from actual money. The reported close rate (${_closeRateB}%) implies ${_claimedJobsB} jobs/mo which conflicts with revenue. Effective close rate implied by revenue: ~${_effCloseB}%. Reference this in pricing and competitive sections where job volume affects the analysis.` : `✓ Revenue math and reported close rate are consistent (within 20%). Use reported figures.`}

COMPETITOR RESEARCH (industry: ${a.q1b_label||industryLabels[a.q1]||'same as this business'}):
CRITICAL RULE: Only include competitors that operate in the EXACT SAME industry and service type as ${a.contact?.company||'this business'} (${a.q1b_label||industryLabels[a.q1]||''}). If a result is from a different industry (e.g. cleaning company listed for an appliance repair business), EXCLUDE it completely. If fewer than 3 same-industry competitors are found, list only those that are confirmed matches — do not pad with unrelated businesses. If none are found, set competitors to an empty array and note "Competitor data could not be verified for this market."
${competitorSnippets||'No competitor data found — use industry knowledge for this specific service type.'}
${competitorRes?.answer||''}

GLOBAL RULE FOR THIS CALL: NEVER mention any software brand names as suggestions. The business already uses: ${a.current_software||'not provided'}. Do NOT recommend any tool in a category they already have. Describe tool categories only for any gaps.

GENERATE EXACTLY THIS JSON STRUCTURE:
{
  "softwareAnalysis": {
    "integrationMap": "5-6 sentences. Describe how their specific tools (${a.current_software||'listed tools'}) work together — or fail to. Which tools share data automatically and which are siloed? Where is data manually re-entered between systems? What is the single biggest integration gap causing the most manual work? Frame around their reported manual tasks: ${manualTasks.join(', ')||'various tasks'}.",
    "dataFlow": "4-5 sentences. Walk through what happens to data in a typical job lifecycle: booking → scheduling → job completion → invoicing → payment → follow-up → reporting. At each step, which of their tools handles it, and where does the data chain break and require manual intervention? Be specific to their stack.",
    "gaps": ["string — describe a MISSING tool category not covered by their current stack, and why it matters for their specific pain points. NEVER name a brand. Only list genuine gaps — do not list categories they already have.", "string — gap 2 same format", "string — gap 3 same format"],
    "verdict": "2-3 sentences. Overall tech stack integration maturity score (1-10) and what that means for their growth ceiling and manual work burden."
  },
  "pricingStrategy": {
    "summary": "3-4 sentences. Based on competitor research and their avg check of $${avgCheck}, assess whether they are underpriced, fairly priced, or premium. Reference specific competitor data if found. Explain why pricing is a lever worth pulling given their ${a.q7||70}% repeat rate.",
    "recommendation": "3-4 sentences. Give a specific recommendation: which scenario to implement, when, and how to announce it to existing clients. No brand names."
  },
  "automationScenarios": {
    "summary": "2-3 sentences. Given their manual tasks (${manualTasks.join(', ')||'various'}), team size of ${a.q19_headcount||0}, and current software stack, summarize the biggest automation opportunity for this specific business. No brand names.",
    "bots": [
      {
        "name": "Sales Assistant Bot",
        "category": "SALES INTELLIGENCE",
        "description": "2-3 sentences. Describe what this bot would do specifically for ${a.contact?.company||'this business'} — listen to sales calls, score call quality based on closing techniques, flag missed opportunities, and deliver per-rep coaching notes. Reference their pain of '${a.q_pain||'weak sales'}' and their ${a.q9_leads||0} monthly leads.",
        "dataUsed": "Call recordings from their VoIP system, CRM deal stages, lead source data, close rate history"
      },
      {
        "name": "Marketing Intelligence Bot",
        "category": "MARKETING",
        "description": "2-3 sentences. Describe what this bot would do for their specific marketing setup — they spend $${a.q9_adspend||0}/mo on paid ads. It would pull performance data, track cost per lead, monitor which channels convert, and send weekly recommendations on budget allocation.",
        "dataUsed": "Ad platform data, CRM lead sources, close rate by channel, monthly revenue trends"
      },
      {
        "name": "Admin Bot",
        "category": "OPERATIONS",
        "description": "2-3 sentences. Describe how this bot removes repetitive admin burden specific to their business — their team manually handles: ${manualTasks.join(', ')||'various tasks'}. The bot handles reminders, report generation, document reading, data entry, and routes tasks to the right person automatically.",
        "dataUsed": "Scheduling system, project management tool, reporting dashboards, payroll data"
      },
      {
        "name": "Customer Service Bot",
        "category": "CUSTOMER EXPERIENCE",
        "description": "2-3 sentences. Describe how this bot handles first contact for ${a.contact?.company||'this business'} — answers inbound inquiries, identifies complaints vs. requests, checks service protocols, determines proper response, creates a task for the human CSR agent with context and instructions on what to do based on policy.",
        "dataUsed": "Customer database, complaint history, service protocols and policy documents, CRM"
      },
      {
        "name": "Communication Bot",
        "category": "INTERNAL COMMUNICATIONS",
        "description": "2-3 sentences. Describe how this bot lives inside their communication channel and helps the team — they use Slack and RingCentral. It forwards messages to the right person, translates when needed, sends call reminders, routes urgent items from field to admin, and integrates with their CRM to log client communications automatically.",
        "dataUsed": "Team messaging platform, CRM contact records, call logs, scheduling system"
      },
      {
        "name": "Operations Monitor Bot",
        "category": "FIELD OPERATIONS",
        "description": "2-3 sentences. Describe how this bot tracks daily field operations for their ${a.q19_segments?.['field-contractors']?.count||27} field contractors — monitors who is online, confirms task completion, checks if SOPs were followed, flags non-compliance, and sends the operations manager a real-time status report.",
        "dataUsed": "Field service management platform, task completion logs, SOP checklists, GPS/check-in data"
      },
      {
        "name": "Company Brain Bot",
        "category": "BUSINESS INTELLIGENCE",
        "description": "2-3 sentences. Describe how this bot acts as the company's institutional memory — it analyzes all calls, chats, and reports to extract patterns, automatically suggests policy updates, builds a living knowledge base, and surfaces insights the owner hasn't seen yet. All policy changes require owner approval before taking effect.",
        "dataUsed": "All call recordings, team chats, customer feedback, performance reports, policy documents"
      }
    ]
  },
  "systemsAndSOPs": {
    "overview": "3-4 sentences. Explain why SOPs are the bottleneck at their specific stage — reference their team size (${a.q19_headcount||0} people) and what breaks down without documentation.",
    "toolCategories": [
      {"category": "string — tool category name (no brand names)", "purpose": "string — what it solves for this specific business", "priority": "High"},
      {"category": "string", "purpose": "string", "priority": "High"},
      {"category": "string", "purpose": "string", "priority": "Medium"},
      {"category": "string", "purpose": "string", "priority": "Medium"},
      {"category": "string", "purpose": "string", "priority": "Low"}
    ],
    "top3SOPs": [
      {"name": "string — SOP name", "why": "string — why this one must be built first", "covers": "string — what this SOP should document step by step"},
      {"name": "string", "why": "string", "covers": "string"},
      {"name": "string", "why": "string", "covers": "string"}
    ]
  },
  "riskRegister": [
    {"risk": "string — risk name", "likelihood": "High", "trigger": "string — specific event that causes this", "impact": "string — what happens, with dollar estimate if possible", "mitigation": "string — one concrete action to take this week"},
    {"risk": "string", "likelihood": "High", "trigger": "string", "impact": "string", "mitigation": "string"},
    {"risk": "string", "likelihood": "Medium", "trigger": "string", "impact": "string", "mitigation": "string"},
    {"risk": "string", "likelihood": "Medium", "trigger": "string", "impact": "string", "mitigation": "string"},
    {"risk": "string", "likelihood": "Low", "trigger": "string", "impact": "string", "mitigation": "string"}
  ],
  "competitiveAnalysis": {
    "overview": "3-4 sentences. Describe the competitive landscape in ${a.q2_city||'their city'} for ${industryLabels[a.q1]||'their industry'}. How competitive is it? What separates the leaders?",
    "competitors": [
      {"name": "string — business name from research", "rating": "string — e.g. 4.7★ (312 reviews)", "strengths": "string — what they do well", "gap": "string — where they are vulnerable", "pricing": "string — if found in research, otherwise: 'Get a quote — call and request pricing for a standard job'"},
      {"name": "string", "rating": "string", "strengths": "string", "gap": "string", "pricing": "string"},
      {"name": "string", "rating": "string", "strengths": "string", "gap": "string", "pricing": "string"}
    ],
    "topPerformer": {"name": "string — highest rated competitor", "rating": "string", "whatTheyDoRight": "string — 2-3 sentences on what makes them the market leader based on reviews/research"},
    "yourEdge": "3-4 sentences. Where does this specific business have a real competitive advantage or a clear opportunity to differentiate from what was found in research?"
  },
  "cashFlowProjection": {
    "currentBaseline": "2-3 sentences. Describe current monthly situation using pre-computed net of $${monthlyNet!=null?monthlyNet:'unknown'}/mo. Is it sustainable? What is the buffer?",
    "badScenario": {
      "narrative": "4-5 sentences. Describe what happens month by month if revenue declines. Use the exact pre-computed numbers. What needs to be cut and in what order — marketing first, then back-office hours, then harder decisions. Be direct about the collapse timeline.",
      "months": [
        {"month": "Month 1", "revenue": "$${mo}/mo", "net": "${badM1!=null?'$'+badM1:'-'}/mo", "action": "string — what decision is required"},
        {"month": "Month 2", "revenue": "$${Math.round(mo*0.90)}/mo (−10%)", "net": "${badM2!=null?'$'+badM2:'-'}/mo", "action": "string"},
        {"month": "Month 3", "revenue": "$${Math.round(mo*0.82)}/mo (−18%)", "net": "${badM3!=null?'$'+badM3:'-'}/mo", "action": "string"},
        {"month": "Month 4−6", "revenue": "$${Math.round(mo*0.75)}/mo (−25%)", "net": "${badM46!=null?'$'+badM46:'-'}/mo", "action": "string"}
      ]
    },
    "goodScenario": {
      "narrative": "4-5 sentences. Describe what happens month by month when recommendations are implemented. Use exact pre-computed numbers. When does surplus appear? Show how to invest it — automation tools, marketing budget, team training. End with when the owner can safely raise their draw.",
      "months": [
        {"month": "Month 1", "revenue": "$${mo}/mo", "net": "${goodM1!=null?'$'+goodM1:'-'}/mo", "action": "string — what to implement this month"},
        {"month": "Month 2", "revenue": "$${Math.round(mo*1.035)}/mo (+3.5%)", "net": "${goodM2!=null?'$'+goodM2:'-'}/mo", "action": "string"},
        {"month": "Month 3", "revenue": "$${Math.round(mo*1.035*1.05)}/mo (+price+volume)", "net": "${goodM3!=null?'$'+goodM3:'-'}/mo", "action": "string"},
        {"month": "Month 4−6", "revenue": "$${Math.round(mo*1.10*1.10)}/mo (+10%+10%)", "net": "${goodM6!=null?'$'+goodM6:'-'}/mo", "action": "string"}
      ]
    },
    "ownerDrawTimeline": "3-4 sentences. Specifically when and under what conditions can the owner safely increase their draw. Give a concrete milestone — 'When monthly net exceeds ${safeNetThreshold?'$'+safeNetThreshold.toLocaleString():'the Month 3 good-scenario level'} for 2 consecutive months, it is safe to increase the draw by ${safeDrawIncrease?'$'+safeDrawIncrease:'10%'}.' Reference the good scenario Month 4-6 numbers. Do not invent a different dollar threshold — use the one provided."
  }
}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 16000,
        response_format: { type: 'json_object' }
      })
    });
    if (!res.ok) { console.error('[Call B] OpenAI error:', res.status); return {}; }
    const json = await res.json();
    return JSON.parse(json.choices[0].message.content);
  } catch (e) {
    console.error('[Call B] Failed:', e.message);
    return {};
  }
}

function renderAssessmentHTML(r, a, research, rB = {}) {
  const scoreColor = n => { const v=parseInt(n); return v>=7?'#10B981':v>=5?'#F59E0B':'#EF4444'; };
  const scoreNum   = s => { if (typeof s === 'number') return s; return parseInt((s||'').match(/\d+/)?.[0])||0; };
  const scoreNote  = (score, note) => note || (typeof score === 'string' ? score.replace(/^\d+\/\d+\s*[-–—]?\s*/,'') : '');
  const PAIN_ICONS = {cashflow:'💰','owner-dep':'🔗',systems:'⚙️',team:'👥',operations:'🚀',growth:'📈',survival:'⚠️',healthy:'✅'};
  const icon = PAIN_ICONS[a.primaryPain]||'🔍';

  // Revenue trend data for HTML display — y0=current year (partial/estimated), y3=oldest
  const revYearsA = a.q4_years || {};
  const revParsedA = a.q4_parsed || {};
  const _thisYear = new Date().getFullYear();
  const _thisMonth = new Date().getMonth() + 1;
  const _revKeyOrder = ['y3','y2','y1','y0','yn']; // oldest → newest (y0=current, y3=oldest)
  const revDisplayRows = _revKeyOrder.filter(k => revYearsA[k]).map(k => {
    const v = revYearsA[k];
    const label = {
      y3: `${_thisYear - 3}`,
      y2: `${_thisYear - 2}`,
      y1: `${_thisYear - 1} (Last Full Year)`,
      y0: `${_thisYear} (Current — est. ${_thisMonth} mo in)`,
      yn: `${_thisYear + 1} (Goal)`
    }[k] || k;
    const parsed = revParsedA[k];
    // Use raw parsed value — users enter full-year amounts, do NOT annualize
    const parsedForBadge = parsed;
    return {label, raw: v, parsed, parsedForBadge};
  });

  // ── Data Confidence Score (computed here so HTML is always accurate) ─────────
  const _csAnnualRev  = a.q4_parsed?.y3 || a.q4_parsed?.y2 || a.q4_parsed?.y1 || a.q4_parsed?.y0 || 0;
  const _csMo         = _csAnnualRev > 0 ? Math.round(_csAnnualRev / 12) : 0;
  const _csAvgCheck   = Number(a.avg_check) || 0;
  const _csEstJobs    = (_csMo && _csAvgCheck) ? Math.round(_csMo / _csAvgCheck) : null;
  const _csLeads      = Number(a.q9_leads) || 0;
  const _csCloseTracked = a.q9_close != null;
  const _csClose      = _csCloseTracked ? Number(a.q9_close) : 10;
  const _csClaimed    = (_csLeads && _csCloseTracked) ? Math.round(_csLeads * (_csClose / 100)) : null;
  const _csMismatchPct = (_csClaimed && _csEstJobs)
    ? Math.round(Math.abs(_csClaimed - _csEstJobs) / Math.max(_csClaimed, _csEstJobs) * 100) : null;
  const _csMismatch   = _csMismatchPct !== null && _csMismatchPct > 20;
  const _csEffClose   = (_csEstJobs !== null && _csLeads > 0) ? Math.round(_csEstJobs / _csLeads * 100) : null;
  const cs = computeConfidenceScore(a, _csEstJobs, _csMismatch, _csMismatchPct, _csClaimed, _csEffClose);

  // Expense chart data
  const expBreakdown = a.expense_breakdown || {};
  const expKnown = Object.entries(expBreakdown).filter(([,v])=>v!==null);
  const expTotal = expKnown.reduce((s,[,v])=>s+v,0);

  // Back-office payroll from q19_segments — non-field staff (managers, admin, sales, CS, etc.)
  // This is separate from expense_breakdown.staff which typically covers field contractors
  const _fieldSegTypes = new Set(['field','contractors','field-contractors']);
  const _backOfficeSegs = Object.entries(a.q19_segments||{}).filter(([seg])=>!_fieldSegTypes.has(seg));
  // In individual mode, use pay_with_tax (employer taxes included for W2 staff)
  const _backOfficeMo = _backOfficeSegs.reduce((s,[,d])=>{
    const _cost = (a.salary_mode==='individual' && d.pay_with_tax!=null) ? Number(d.pay_with_tax) : Number(d.pay||0);
    return s + Number(d.count||0) * _cost;
  }, 0);
  const _renderAnnualRev = (a.q4_parsed?.y0 || a.q4_parsed?.y1 || 0);
  const _renderMonthlyRev = _renderAnnualRev > 0 ? Math.round(_renderAnnualRev / 12) : 0;
  const _backOfficePct = (_backOfficeMo > 0 && _renderMonthlyRev > 0)
    ? Math.round(_backOfficeMo / _renderMonthlyRev * 100) : 0;
  // Show back-office bar whenever payroll is meaningful (≥1%) — no longer requires expense_breakdown.staff
  const _showBackOfficeBar = _backOfficePct >= 1;
  // Also compute field/contractor pct for the "Where Revenue Goes" bar
  const _fieldMoBar = Object.entries(a.q19_segments||{}).filter(([s])=>_fieldSegTypes.has(s)).reduce((t,[,d])=>t+Number(d.count||0)*Number(d.pay||0),0);
  const _fieldPctBar = (_fieldMoBar>0&&_renderMonthlyRev>0)?Math.round(_fieldMoBar/_renderMonthlyRev*100):0;
  const expTotalWithBO = expTotal + (_showBackOfficeBar ? _backOfficePct : 0) + (_fieldPctBar >= 1 ? _fieldPctBar : 0);
  // Tips pass-through (gross revenue → staff, not additional business cost)
  const _totalTipsMo = Object.values(a.q19_segments||{}).reduce((s,d)=>s+(Number(d.total_tips_mo||0)),0);

  // Partners — multi-partner support in HTML render
  const _renderPartnersArr = a.partners || (a.partner?.has && a.partner_pay ? [{
    name: 'Partner', role: a.partner.partnerRole||'', involvement: a.partner.involvement||'',
    pay: a.partner_pay, pay_total: a.partner_pay_total||0
  }] : []);
  const totalMonthlyPartnerPay = _renderPartnersArr.reduce((s,p)=>s+(p.pay_total||0), 0);
  const partnerHtml = a.partner?.has
    ? `<div class="intel-item"><div class="il">Business Partner${_renderPartnersArr.length>1?'s':''}</div><div class="iv">${_renderPartnersArr.length>0 ? _renderPartnersArr.map(p=>p.name+(p.role?' ('+p.role+')':'')).join(', ') : [a.partner.userRole,a.partner.partnerRole].filter(Boolean).join(' / ')}</div></div>`
    : '';
  // Banking warning cards
  const bankingMixedWarning = (a.bank_personal_biz === 'no' || a.bank_personal_biz === 'partial') ? `
  <div style="background:#FEE2E2;border:1px solid #EF4444;border-left:4px solid #EF4444;border-radius:12px;padding:20px 24px;display:flex;gap:16px;align-items:flex-start;margin-bottom:14px;">
    <div style="font-size:24px;flex-shrink:0;">🚨</div>
    <div>
      <div style="font-size:13px;font-weight:800;color:#991B1B;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px;">Personal & Business Funds Are Mixed — Fix This First</div>
      <p style="font-size:13px;color:#7F1D1D;line-height:1.75;margin:0;">Mixing personal and business money makes it nearly impossible to know your real profit, complicates taxes, and exposes your personal assets to business liability. Open a dedicated business checking account immediately — it takes 20 minutes and protects everything you've built. This is step one before any growth strategy.</p>
    </div>
  </div>` : '';

  const bankingMultiAccountNote = (a.bank_personal_biz === 'yes' && a.bank_multi_accounts === 'no') ? `
  <div style="background:#FEF3C7;border:1px solid #F59E0B;border-left:4px solid #F59E0B;border-radius:12px;padding:20px 24px;display:flex;gap:16px;align-items:flex-start;margin-bottom:14px;">
    <div style="font-size:24px;flex-shrink:0;">💡</div>
    <div>
      <div style="font-size:13px;font-weight:800;color:#92400E;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px;">Consider Separating Your Business Accounts by Purpose</div>
      <p style="font-size:13px;color:#78350F;line-height:1.75;margin:0;">Running everything through one business account works — but separating at minimum a <strong>tax reserve account</strong> (set aside 25–30% of revenue as you earn it) can prevent a painful surprise at year-end. As you grow, dedicated accounts for payroll and operations make cash flow much easier to read and manage.</p>
    </div>
  </div>` : '';

  const bankingStrongNote = (a.bank_multi_accounts === 'yes') ? `
  <div style="background:#D1FAE5;border:1px solid #10B981;border-left:4px solid #10B981;border-radius:12px;padding:16px 24px;display:flex;gap:16px;align-items:flex-start;margin-bottom:14px;">
    <div style="font-size:24px;flex-shrink:0;">✅</div>
    <div>
      <div style="font-size:13px;font-weight:800;color:#065F46;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px;">Strong Banking Structure</div>
      <p style="font-size:13px;color:#064E3B;line-height:1.75;margin:0;">Having separate accounts for ${(a.bank_account_types||[]).map(v=>({'operations':'operations','taxes':'taxes','payroll':'payroll','marketing':'marketing','reserve':'emergency reserve'}[v]||v)).join(', ')} shows real financial discipline. This gives you clear visibility into cash flow and protects you at tax time.</p>
    </div>
  </div>` : '';

  // Operating agreement note is handled once inside partnerNote (GPT-generated) — no separate banner

  // Goals display
  const goals12mo = Array.isArray(a.q15) ? a.q15.join(', ') : (a.q15||'');
  const goal3yr = Array.isArray(a.goal_3yr) ? a.goal_3yr.join(', ') : (a.goal_3yr||'');
  const goal5yr = Array.isArray(a.q15b) ? a.q15b.join(', ') : (a.q15b||'');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${r.businessName} — Business Assessment | Nexvora Systems</title>
<meta name="robots" content="noindex"/>
<link rel="icon" href="${SITE_URL}/assets/logo-dark.png"/>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TY0PZHVN0L"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-TY0PZHVN0L');</script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:#FAF8F5;--bg2:#F0EDE8;--card:#fff;--navy:#0F2B4C;--teal:#0D9488;--text:#1A1A2E;--muted:#4A5568;--dim:#718096;--border:#E2DDD5;--red:#EF4444;--orange:#F97316;--yellow:#F59E0B;--green:#10B981;}
html,body{font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;background:var(--bg);color:var(--text);font-size:15px;line-height:1.7;}
a{color:var(--teal);}
.banner{background:var(--navy);color:rgba(255,255,255,0.6);text-align:center;font-size:12px;padding:8px 20px;letter-spacing:.5px;}
.banner strong{color:#44CAA2;}
nav{background:var(--navy);padding:16px 32px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:100;}
.nav-badge{background:rgba(13,148,136,0.2);border:1px solid rgba(13,148,136,0.4);color:#44CAA2;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 12px;border-radius:20px;}
.nav-date{margin-left:auto;font-size:12px;color:rgba(255,255,255,0.4);}
.hero{background:linear-gradient(135deg,#0F2B4C 0%,#0D9488 100%);padding:56px 32px 48px;color:#fff;text-align:center;}
.hero-label{font-size:12px;color:rgba(255,255,255,0.5);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;}
.hero h1{font-size:clamp(24px,4vw,36px);font-weight:900;letter-spacing:-1px;margin-bottom:6px;}
.hero-sub{font-size:15px;color:rgba(255,255,255,0.6);margin-bottom:32px;}
.pain-pill{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:100px;padding:10px 20px;font-size:14px;font-weight:700;margin-bottom:28px;}
.score-grid{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;}
.score-box{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:16px 20px;text-align:center;min-width:110px;}
.score-n{font-size:32px;font-weight:900;line-height:1;}
.score-l{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-top:5px;}
.wrap{max-width:900px;margin:0 auto;padding:48px 20px 80px;}
.section{margin-bottom:48px;}
.sec-label{font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--teal);margin-bottom:6px;}
.sec-title{font-size:22px;font-weight:800;color:var(--text);margin-bottom:20px;letter-spacing:-.3px;}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:28px 32px;margin-bottom:16px;}
.card-navy{background:var(--navy);border-color:transparent;color:#fff;}
.card-teal{background:linear-gradient(135deg,var(--navy),var(--teal));border-color:transparent;color:#fff;}
.gap-item{border-left:3px solid var(--red);padding:12px 16px;background:#FEE2E210;border-radius:0 8px 8px 0;margin-bottom:10px;}
.strength-item{border-left:3px solid var(--green);padding:12px 16px;background:#D1FAE510;border-radius:0 8px 8px 0;margin-bottom:10px;}
.action-card{border:1px solid var(--border);border-radius:12px;padding:20px 24px;margin-bottom:14px;}
.action-num{width:28px;height:28px;background:var(--teal);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;}
.scorecard{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}
.sc-item{background:var(--bg2);border-radius:12px;padding:16px 20px;}
.sc-score{font-size:28px;font-weight:900;line-height:1;}
.sc-label{font-size:11px;color:var(--muted);margin-top:3px;}
.sc-note{font-size:12px;color:var(--dim);margin-top:6px;line-height:1.5;}
.intel-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}
.intel-item .il{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--teal);margin-bottom:4px;}
.intel-item .iv{font-size:14px;color:var(--muted);line-height:1.6;}
.phase-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.phase{background:var(--bg2);border-radius:12px;padding:18px;}
.phase-tag{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--teal);margin-bottom:6px;}
.cta-box{background:linear-gradient(135deg,var(--navy),var(--teal));border-radius:20px;padding:48px 36px;text-align:center;color:#fff;margin-top:48px;}
.cta-box h2{font-size:26px;font-weight:900;margin-bottom:10px;}
.cta-box p{font-size:14px;color:rgba(255,255,255,0.65);max-width:440px;margin:0 auto 24px;line-height:1.7;}
.cta-btn{display:inline-flex;align-items:center;gap:8px;padding:15px 36px;background:#fff;color:var(--teal);border-radius:12px;text-decoration:none;font-size:15px;font-weight:800;}
footer{background:var(--navy);padding:32px;text-align:center;color:rgba(255,255,255,0.4);font-size:12px;}
footer strong{color:#44CAA2;}
/* SIDEBAR */
.sidebar{position:fixed;left:0;top:0;height:100vh;width:300px;background:#fff;border-right:1px solid var(--border);z-index:200;display:flex;flex-direction:column;transform:translateX(-300px);transition:transform .3s ease;box-shadow:4px 0 20px rgba(0,0,0,0.08);}
.sidebar.open{transform:translateX(0);}
.sb-header{background:var(--navy);padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.sb-header-title{font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#44CAA2;}
.sb-close{background:none;border:none;color:rgba(255,255,255,0.6);font-size:20px;cursor:pointer;padding:4px;line-height:1;}
.sb-body{overflow-y:auto;flex:1;padding:16px;}
.sb-section{margin-bottom:20px;}
.sb-section-title{font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--teal);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);}
.sb-qa{margin-bottom:10px;}
.sb-q{font-size:10px;font-weight:700;color:var(--dim);letter-spacing:.3px;margin-bottom:2px;}
.sb-a{font-size:12px;color:var(--text);line-height:1.5;}
.sb-toggle{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:201;background:var(--navy);color:#44CAA2;border:none;border-radius:0 8px 8px 0;padding:12px 10px;cursor:pointer;font-size:16px;box-shadow:2px 0 8px rgba(0,0,0,0.15);transition:left .3s ease;}
.sidebar.open~.sb-toggle,.sb-toggle.shifted{left:300px;}
body.sb-open .wrap{margin-left:0;}
@media(max-width:640px){.score-grid{gap:8px;}.score-box{min-width:80px;padding:12px 10px;}.scorecard{grid-template-columns:1fr;}.intel-grid{grid-template-columns:1fr;}.phase-grid{grid-template-columns:1fr;}.hero{padding:40px 20px 32px;}.card{padding:20px;}.sidebar{width:85vw;transform:translateX(-85vw);}.sidebar.open~.sb-toggle,.sb-toggle.shifted{left:85vw;}.cta-box{padding:28px 16px;}[style*="grid-template-columns:1fr 1fr"]{grid-template-columns:1fr !important;}[style*="grid-template-columns: 1fr 1fr"]{grid-template-columns:1fr !important;}}
</style>
</head>
<body>

<!-- Q&A SIDEBAR -->
<div class="sidebar" id="qaSidebar">
  <div class="sb-header">
    <span class="sb-header-title">Assessment Answers</span>
    <button class="sb-close" onclick="toggleSidebar()">✕</button>
  </div>
  <div class="sb-body">

    <div class="sb-section">
      <div class="sb-section-title">Business Info</div>
      <div class="sb-qa"><div class="sb-q">Business Type</div><div class="sb-a">${a.q1b_label||a.q1||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Location</div><div class="sb-a">${[a.q2_city,a.q2].filter(Boolean).join(', ')||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Years in Business</div><div class="sb-a">${a.q3||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Team Structure</div><div class="sb-a">${a.q5||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Business Partner</div><div class="sb-a">${a.partner?.has ? `Yes — ${[a.partner.userRole,a.partner.partnerRole].filter(Boolean).join(' / ')}` : 'No'}</div></div>
      <div class="sb-qa"><div class="sb-q">Growth Target</div><div class="sb-a">${a.growth_target_pct ? a.growth_target_pct+'% / year' : '—'}</div></div>
    </div>

    <div class="sb-section">
      <div class="sb-section-title">Revenue</div>
      ${['y3','y2','y1','y0','yn'].filter(k=>(a.q4_years||{})[k]).map(k=>{
        const cy=new Date().getFullYear();
        const lbl={y3:cy-3,y2:cy-2,y1:(cy-1)+' (last yr)',y0:cy+' (est.)',yn:(cy+1)+' goal'}[k]||k;
        return `<div class="sb-qa"><div class="sb-q">${lbl}</div><div class="sb-a">$${Number(a.q4_years[k]).toLocaleString()}</div></div>`;
      }).join('')}
    </div>

    <div class="sb-section">
      <div class="sb-section-title">Pain Points</div>
      <div class="sb-qa"><div class="sb-q">If 50% more customers tomorrow, what breaks?</div><div class="sb-a">${a.pain1||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">End of day feeling</div><div class="sb-a">${Array.isArray(a.pain2)?a.pain2.join(', '):(a.pain2||'—')}</div></div>
      <div class="sb-qa"><div class="sb-q">Vacation blocker</div><div class="sb-a">${Array.isArray(a.pain3)?a.pain3.join(', '):(a.pain3||'—')}</div></div>
      <div class="sb-qa"><div class="sb-q">Biggest pain (own words)</div><div class="sb-a">${a.q_pain||'—'}</div></div>
    </div>

    <div class="sb-section">
      <div class="sb-section-title">Operations</div>
      <div class="sb-qa"><div class="sb-q">SOPs / Processes</div><div class="sb-a">${(a.q6||[]).join(', ')||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Repeat Customer Rate</div><div class="sb-a">${a.q7 != null ? a.q7+'%' : '—'}</div></div>
      <div class="sb-qa"><div class="sb-q">New vs Returning Split</div><div class="sb-a">${a.customer_split||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Lead Follow-Up System</div><div class="sb-a">${a.q8||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Avg Transaction Value</div><div class="sb-a">${a.avg_check ? '$'+Number(a.avg_check).toLocaleString() : '—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Manual Tasks</div><div class="sb-a">${(a.q11||[]).join(', ')||'—'}${a.q11_other?' | '+a.q11_other:''}</div></div>
      <div class="sb-qa"><div class="sb-q">Task Management Tool</div><div class="sb-a">${a.q11b||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Follow-Up Tracking</div><div class="sb-a">${a.q11c||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Team Performance Mgmt</div><div class="sb-a">${(a.q12||[]).join(', ')||'—'}</div></div>
    </div>

    <div class="sb-section">
      <div class="sb-section-title">Marketing</div>
      <div class="sb-qa"><div class="sb-q">Lead Sources</div><div class="sb-a">${(a.q9||[]).join(', ')||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Monthly Ad Spend</div><div class="sb-a">${a.q9_adspend != null ? '$'+Number(a.q9_adspend).toLocaleString() : '—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Leads / Month</div><div class="sb-a">${a.q9_leads != null ? a.q9_leads : '—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Closing Rate</div><div class="sb-a">${a.q9_close != null ? a.q9_close+'%' : 'Not tracked'}</div></div>
      <div class="sb-qa"><div class="sb-q">Online Reviews Rating</div><div class="sb-a">${a.q10||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Review Monitoring</div><div class="sb-a">${a.review_monitoring||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Review Requests</div><div class="sb-a">${a.review_requests||'—'}</div></div>
    </div>

    <div class="sb-section">
      <div class="sb-section-title">Team & Payroll</div>
      <div class="sb-qa"><div class="sb-q">Total Headcount</div><div class="sb-a">${a.q19_headcount||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Total Payroll / Month</div><div class="sb-a">${a.q19_total ? '$'+Number(a.q19_total).toLocaleString() : '—'}</div></div>
      ${Object.entries(a.q19_segments||{}).map(([role,v])=>{
        const _dispCost = (a.salary_mode==='individual' && v.pay_with_tax!=null) ? v.pay_with_tax : v.pay;
        const _typeTag = v.type && v.type!=='unknown' ? ` · ${v.type==='w2'?'W2':v.type==='contractor'?'1099':'mixed'}` : '';
        const _fullCostTag = (a.salary_mode==='individual' && (v.type==='w2'||v.type==='mixed')) ? ' (full cost)' : '';
        const _tipsTag = v.tips_per_person_mo > 0 ? ` + $${v.tips_per_person_mo}/mo tips` : '';
        return `<div class="sb-qa"><div class="sb-q">${role} (${v.count} people${_typeTag})</div><div class="sb-a">$${_dispCost}/mo each${_fullCostTag}${_tipsTag}</div></div>`;
      }).join('')}
      ${_totalTipsMo > 0 ? `<div class="sb-qa"><div class="sb-q">Tips Pass-Through</div><div class="sb-a">$${_totalTipsMo.toLocaleString()}/mo → staff</div></div>` : ''}
    </div>

    <div class="sb-section">
      <div class="sb-section-title">Financial</div>
      <div class="sb-qa"><div class="sb-q">Financial Review Frequency</div><div class="sb-a">${a.q13||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Business Visibility / KPIs</div><div class="sb-a">${a.q14||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Cash Flow Status</div><div class="sb-a">${a.cash_flow||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Cash Flow Tracking</div><div class="sb-a">${a.cashflow_tracking||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">P&L Statement</div><div class="sb-a">${a.has_pl||'—'} ${a.pl_usage?'('+a.pl_usage+')':''}</div></div>
      <div class="sb-qa"><div class="sb-q">Business Banking</div><div class="sb-a">${a.bank_personal_biz||'—'}</div></div>
      <div class="sb-qa"><div class="sb-q">Separate Accounts</div><div class="sb-a">${a.bank_multi_accounts||'—'}${a.bank_account_types?.length?' ('+a.bank_account_types.join(', ')+')':''}</div></div>
      ${Object.entries(a.expense_breakdown||{}).filter(([,v])=>v!=null).map(([cat,pct])=>`<div class="sb-qa"><div class="sb-q">Expense: ${cat}</div><div class="sb-a">${pct}%</div></div>`).join('')}
    </div>

    <div class="sb-section">
      <div class="sb-section-title">Owner & Goals</div>
      ${Object.entries(a.owner_pay||{}).map(([,v])=>`<div class="sb-qa"><div class="sb-q">Owner — ${v.label||'Pay'}</div><div class="sb-a">$${v.amount}/${v.frequency} ($${v.monthly}/mo)</div></div>`).join('')}
      <div class="sb-qa"><div class="sb-q">Owner Pay Enough?</div><div class="sb-a">${a.owner_pay_enough||'—'}</div></div>
      ${_renderPartnersArr.map((p,i)=>{
        const payRows = p.pay ? Object.entries(p.pay).map(([,v])=>`<div class="sb-qa"><div class="sb-q">${p.name||'Partner '+(i+1)} — ${v.label||'Pay'}</div><div class="sb-a">$${v.amount}/${v.frequency} ($${v.monthly}/mo)</div></div>`).join('') : '';
        const totalRow = p.pay_total > 0 ? `<div class="sb-qa"><div class="sb-q">${p.name||'Partner '+(i+1)} Total/mo</div><div class="sb-a">$${p.pay_total.toLocaleString()}</div></div>` : '';
        return payRows + totalRow;
      }).join('')}
      <div class="sb-qa"><div class="sb-q">Hours / Week</div><div class="sb-a">${a.q17||'—'}h/wk${a.q17_slots&&Object.keys(a.q17_slots).length?' ('+Object.entries(a.q17_slots).map(([k,v])=>k+': '+v+'h').join(', ')+')':''}</div></div>
      <div class="sb-qa"><div class="sb-q">12-Month Goals</div><div class="sb-a">${Array.isArray(a.q15)?a.q15.join(', '):(a.q15||'—')}</div></div>
      <div class="sb-qa"><div class="sb-q">3-Year Vision</div><div class="sb-a">${Array.isArray(a.goal_3yr)?a.goal_3yr.join(', '):(a.goal_3yr||'—')}</div></div>
      <div class="sb-qa"><div class="sb-q">5-Year Goal</div><div class="sb-a">${Array.isArray(a.q15b)?a.q15b.join(', '):(a.q15b||'—')}</div></div>
    </div>

  </div>
</div>
<button class="sb-toggle" id="sbToggle" onclick="toggleSidebar()" title="Show Assessment Answers">📋</button>
<script>
function toggleSidebar(){
  var sb=document.getElementById('qaSidebar');
  var btn=document.getElementById('sbToggle');
  sb.classList.toggle('open');
  btn.classList.toggle('shifted');
  btn.textContent=sb.classList.contains('open')?'✕':'📋';
}
</script>

<div class="banner">🔒 Confidential — Prepared for <strong>${r.ownerFirstName}</strong> by Nexvora Systems</div>
<nav>
  <a href="${SITE_URL}" target="_blank" rel="noopener" style="display:flex;align-items:center;flex-shrink:0;"><img src="${SITE_URL}/assets/logo-white.png" alt="Nexvora Systems" style="height:36px;" onerror="this.style.display='none'"/></a>
  <span class="nav-badge">Business Assessment Report</span>
  <span class="nav-date">${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
  <span style="font-size:10px;color:rgba(255,255,255,0.25);font-family:monospace;letter-spacing:.5px;">${REPORT_VERSION}</span>
</nav>

<div class="hero">
  <div class="hero-label">Free Business Assessment — Nexvora Systems</div>
  <h1>${r.ownerFirstName}'s Business Report</h1>
  <div class="hero-sub">${r.businessName} · ${r.location}</div>
  <div class="pain-pill">${icon} Primary Issue Diagnosed: ${r.primaryPainLabel}</div>
  <div class="score-grid">
    <div class="score-box"><div class="score-n" style="color:${scoreColor(scoreNum(r.operationsScore))}">${scoreNum(r.operationsScore)}<span style="font-size:16px;">/10</span></div><div class="score-l">Operations</div></div>
    <div class="score-box"><div class="score-n" style="color:${scoreColor(scoreNum(r.marketingScore))}">${scoreNum(r.marketingScore)}<span style="font-size:16px;">/10</span></div><div class="score-l">Marketing</div></div>
    <div class="score-box"><div class="score-n" style="color:${scoreColor(scoreNum(r.teamScore))}">${scoreNum(r.teamScore)}<span style="font-size:16px;">/10</span></div><div class="score-l">Team</div></div>
    <div class="score-box"><div class="score-n" style="color:${scoreColor(scoreNum(r.financialScore))}">${scoreNum(r.financialScore)}<span style="font-size:16px;">/10</span></div><div class="score-l">Financial</div></div>
  </div>
</div>

<div class="wrap">

  <!-- NEXVORA INTRO -->
  <div class="section">
    <div class="card card-navy">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <img src="${SITE_URL}/assets/logo-white.png" alt="Nexvora Systems" style="height:32px;" onerror="this.style.display='none'"/>
        <div>
          <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.4);">Prepared by</div>
          <div style="font-size:16px;font-weight:800;color:#fff;">Murat & Alexandr — Nexvora Systems</div>
        </div>
      </div>
      <p style="font-size:14px;color:rgba(255,255,255,0.65);line-height:1.75;">We read every assessment personally. This report is built from your specific answers, cross-referenced with industry data and what we found about your business online. Our goal is to give you a clear picture of where you actually stand — and what to do first.</p>
    </div>
  </div>

  <!-- PAIN POINT DIAGNOSIS -->
  <div class="section">
    <div class="sec-label">Pain Point Diagnosis</div>
    <div class="sec-title">What We Found</div>
    <div class="card" style="border-left:4px solid var(--teal);">
      <div style="font-size:28px;margin-bottom:10px;">${icon}</div>
      <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:12px;">${r.primaryPainLabel}</div>
      <p style="color:var(--muted);font-size:14px;line-height:1.8;">${r.painDiagnosis}</p>
    </div>
  </div>

  <!-- EXECUTIVE SUMMARY -->
  <div class="section">
    <div class="sec-label">Executive Summary</div>
    <div class="sec-title">The Full Picture</div>
    <div class="card">
      <p style="font-size:15px;color:var(--muted);line-height:1.85;margin-bottom:24px;">${r.executiveSummary}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <div style="font-size:11px;font-weight:800;color:var(--green);letter-spacing:.5px;margin-bottom:10px;">WHAT'S WORKING</div>
          ${(r.keyStrengths||[]).map(s=>`<div class="strength-item"><div style="font-size:13px;color:var(--muted);">${s}</div></div>`).join('')}
        </div>
        <div>
          <div style="font-size:11px;font-weight:800;color:var(--red);letter-spacing:.5px;margin-bottom:10px;">CRITICAL GAPS</div>
          ${(r.criticalGaps||[]).map(g=>`<div class="gap-item"><div style="font-size:13px;color:var(--muted);">${g}</div></div>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- WHAT WE FOUND ONLINE -->
  <div class="section">
    <div class="sec-label">Business Intelligence</div>
    <div class="sec-title">What We Found Online</div>
    <div class="card">
      <div class="intel-grid">
        <div class="intel-item"><div class="il">Online Presence & Reviews</div><div class="iv">${r.onlinePresence}</div></div>
        <div class="intel-item"><div class="il">Industry Benchmark</div><div class="iv">${r.industryBenchmark}</div></div>
        ${partnerHtml}
        ${a.avg_check ? `<div class="intel-item"><div class="il">Avg Transaction Value</div><div class="iv">$${Number(a.avg_check).toLocaleString()}</div></div>` : ''}
        ${a.q9_close && a.q9_adspend && a.q9_leads ? `<div class="intel-item"><div class="il">Cost Per Customer (Ads)</div><div class="iv">$${Math.round((a.q9_adspend/a.q9_leads)/(a.q9_close/100)).toLocaleString()}</div></div>` : ''}
      </div>
      ${(()=>{
        // Collect all unique sources across all research channels
        const _allSources = [
          ...(research.business?.results||[]).slice(0,2),
          ...(research.reviews?.results||[]).slice(0,2),
          ...(research.yelp?.results||[]).slice(0,2),
          ...(research.bbb?.results||[]).slice(0,1),
          ...(research.social?.results||[]).slice(0,1),
          ...(research.forums?.results||[]).slice(0,2),
          ...(research.locations?.results||[]).slice(0,2),
        ].filter((r2,i,arr)=>r2.url && arr.findIndex(x=>x.url===r2.url)===i); // dedupe by URL
        if (!_allSources.length) return '';
        // Group by platform type for display
        const _platformLabel = url => {
          if (/yelp\.com/i.test(url)) return '⭐ Yelp';
          if (/bbb\.org/i.test(url)) return '🏛 BBB';
          if (/facebook\.com/i.test(url)) return '📘 Facebook';
          if (/instagram\.com/i.test(url)) return '📸 Instagram';
          if (/linkedin\.com/i.test(url)) return '💼 LinkedIn';
          if (/reddit\.com/i.test(url)) return '💬 Reddit';
          if (/nextdoor\.com/i.test(url)) return '🏘 Nextdoor';
          if (/google\./i.test(url)) return '🔍 Google';
          return '🌐 Web';
        };
        return `<div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border);">
          <div style="font-size:11px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Sources Found</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${_allSources.map(r2=>`<a href="${r2.url}" target="_blank" style="font-size:12px;color:var(--dim);text-decoration:none;display:flex;gap:8px;align-items:baseline;">
              <span style="font-size:10px;color:var(--teal);min-width:80px;font-weight:600;">${_platformLabel(r2.url)}</span>
              <span>→ ${r2.title}</span>
            </a>`).join('')}
          </div>
        </div>`;
      })()}
    </div>
  </div>

  <!-- REVENUE TREND -->
  ${revDisplayRows.length > 0 ? `
  <div class="section">
    <div class="sec-label">Revenue History</div>
    <div class="sec-title">Year-Over-Year Trend</div>
    <div class="card">
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${revDisplayRows.map((row,i)=>{
          const prev = revDisplayRows[i-1];
          let badge = '';
          const isYTD = row.label.includes('YTD');
          // For YTD rows, show annualized projection so the YoY badge makes sense
          const fmtN = n => n>=1000000?(n/1000000).toFixed(1)+'M':n>=1000?Math.round(n/1000)+'K':String(n);
          const annualNote = (isYTD && row.parsedForBadge && row.parsedForBadge !== row.parsed)
            ? `<span style="font-size:11px;color:var(--dim);font-weight:400;margin-left:6px;">(≈$${fmtN(row.parsedForBadge)}/yr projected)</span>` : '';
          if (prev?.parsedForBadge && row.parsedForBadge) {
            const g = Math.round((row.parsedForBadge - prev.parsedForBadge)/prev.parsedForBadge*100);
            const col = g>0?'var(--green)':'var(--red)';
            badge = `<span style="font-size:12px;font-weight:700;color:${col};margin-left:8px;">${g>0?'+':''}${g}% vs prior year</span>`;
          }
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg2);border-radius:8px;">
            <span style="font-size:13px;font-weight:600;color:var(--muted);">${row.label}</span>
            <span style="font-size:15px;font-weight:800;color:var(--text);">${row.raw}${annualNote}${badge}</span>
          </div>`;
        }).join('')}
      </div>
      <p style="margin-top:16px;font-size:13px;color:var(--muted);line-height:1.7;">${r.revenueAnalysis||''}</p>
    </div>
  </div>` : ''}

  <!-- EXPENSE BREAKDOWN -->
  ${expKnown.length > 0 ? `
  <div class="section">
    <div class="sec-label">Expense Breakdown</div>
    <div class="sec-title">Where Revenue Goes</div>
    <div class="card">
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
        ${expKnown.map(([cat,pct])=>{
          const label = {operations:'Operations & Overhead',staff:'Staff & Payroll',software:'Software & Tools',loans:'Loans & Debt',marketing:'Marketing & Ads',equipment:'Equipment & Vehicles',other:'Other'}[cat]||cat;
          // For staff: combine field contractors + back-office into one bar
          const displayPct = (cat==='staff' && _showBackOfficeBar) ? pct + _backOfficePct : pct;
          const sublabelText = (cat==='staff' && _showBackOfficeBar) ? `${pct}% field + ${_backOfficePct}% back-office` : '';
          return `<div style="display:flex;align-items:center;gap:12px;">
            <div style="min-width:160px;flex-shrink:0;">
              <div style="font-size:12px;color:var(--muted);">${label}</div>
              ${sublabelText ? `<div style="font-size:10px;color:var(--dim);margin-top:1px;">(${sublabelText})</div>` : ''}
            </div>
            <div style="flex:1;height:8px;background:var(--bg2);border-radius:99px;overflow:hidden;"><div style="height:100%;background:var(--teal);border-radius:99px;width:${Math.min(displayPct,100)}%;"></div></div>
            <span style="font-size:13px;font-weight:700;color:var(--text);min-width:36px;text-align:right;">${displayPct}%</span>
          </div>`;
        }).join('')}
        ${_fieldPctBar >= 1 ? `<div style="display:flex;align-items:center;gap:12px;">
          <div style="min-width:160px;flex-shrink:0;"><div style="font-size:12px;color:var(--muted);">Field / Contractors</div></div>
          <div style="flex:1;height:8px;background:var(--bg2);border-radius:99px;overflow:hidden;"><div style="height:100%;background:var(--teal);border-radius:99px;width:${Math.min(_fieldPctBar,100)}%;"></div></div>
          <span style="font-size:13px;font-weight:700;color:var(--text);min-width:36px;text-align:right;">${_fieldPctBar}%</span>
        </div>` : ''}
        ${_showBackOfficeBar ? `<div style="display:flex;align-items:center;gap:12px;">
          <div style="min-width:160px;flex-shrink:0;"><div style="font-size:12px;color:var(--muted);">Back-Office Staff</div></div>
          <div style="flex:1;height:8px;background:var(--bg2);border-radius:99px;overflow:hidden;"><div style="height:100%;background:var(--teal);border-radius:99px;width:${Math.min(_backOfficePct,100)}%;"></div></div>
          <span style="font-size:13px;font-weight:700;color:var(--text);min-width:36px;text-align:right;">${_backOfficePct}%</span>
        </div>` : ''}
        ${(()=>{
          // Owner & partner draws bar
          const _ownerDrawsMo = Object.values(a.owner_pay||{}).reduce((s,v)=>s+(v.monthly||(v.frequency==='weekly'?Math.round(Number(v.amount)*4.33):Number(v.amount))),0);
          const _partnerDrawsMo = (a.partners||[]).reduce((s,p)=>s+(p.pay_total||0),0);
          const _totalDrawsMo = _ownerDrawsMo + _partnerDrawsMo;
          const _drawsPct = (_totalDrawsMo>0 && _renderMonthlyRev>0) ? Math.round(_totalDrawsMo/_renderMonthlyRev*100) : 0;
          if (_drawsPct < 1) return '';
          const _drawsLabel = _partnerDrawsMo > 0 ? `owner + partner draws` : `owner draws`;
          return `<div style="display:flex;align-items:center;gap:12px;">
            <div style="min-width:160px;flex-shrink:0;">
              <div style="font-size:12px;color:var(--muted);">Owner Draws</div>
              <div style="font-size:10px;color:var(--dim);margin-top:1px;">(${_drawsLabel})</div>
            </div>
            <div style="flex:1;height:8px;background:var(--bg2);border-radius:99px;overflow:hidden;"><div style="height:100%;background:#F59E0B;border-radius:99px;width:${Math.min(_drawsPct,100)}%;"></div></div>
            <span style="font-size:13px;font-weight:700;color:var(--text);min-width:36px;text-align:right;">${_drawsPct}%</span>
          </div>`;
        })()}
        ${(()=>{
          const _ownerDrawsMo2 = Object.values(a.owner_pay||{}).reduce((s,v)=>s+(v.monthly||(v.frequency==='weekly'?Math.round(Number(v.amount)*4.33):Number(v.amount))),0);
          const _partnerDrawsMo2 = (a.partners||[]).reduce((s,p)=>s+(p.pay_total||0),0);
          const _drawsPct2 = ((_ownerDrawsMo2+_partnerDrawsMo2)>0 && _renderMonthlyRev>0) ? Math.round((_ownerDrawsMo2+_partnerDrawsMo2)/_renderMonthlyRev*100) : 0;
          const _grandTotal = expTotalWithBO + _drawsPct2;
          return _grandTotal>0 ? `<div style="margin-top:6px;font-size:12px;color:var(--dim);">Total accounted for: ${Math.round(_grandTotal)}% (incl. owner draws)${_grandTotal<100?' · '+(100-Math.round(_grandTotal))+'% unaccounted':''}</div>` : '';
        })()}
      </div>
      ${r.expenseAnalysis ? `<p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.expenseAnalysis}</p>` : ''}
    </div>
  </div>` : ''}

  <!-- GOALS -->
  <div class="section">
    <div class="sec-label">Goals & Vision</div>
    <div class="sec-title">Where You're Headed</div>
    <div class="card">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
        ${goals12mo ? `<div style="background:var(--bg2);border-radius:10px;padding:14px;"><div style="font-size:10px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">12-Month Goals</div><div style="font-size:13px;color:var(--muted);">${goals12mo}</div></div>` : ''}
        ${goal3yr ? `<div style="background:var(--bg2);border-radius:10px;padding:14px;"><div style="font-size:10px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">3-Year Vision</div><div style="font-size:13px;color:var(--muted);">${goal3yr}</div></div>` : ''}
        ${goal5yr ? `<div style="background:var(--bg2);border-radius:10px;padding:14px;"><div style="font-size:10px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">5-Year Goal</div><div style="font-size:13px;color:var(--muted);">${goal5yr}</div></div>` : ''}
      </div>
      ${r.goalsAnalysis ? `<p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.goalsAnalysis}</p>` : ''}
    </div>
  </div>

  <!-- CAPACITY & GROWTH OPPORTUNITIES -->
  ${r.capacityAnalysis ? `
  <div class="section">
    <div class="sec-label">Growth Capacity</div>
    <div class="sec-title">What You Can Do With What You Have</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      ${r.capacityAnalysis.currentCapacity ? `<div class="card" style="margin-bottom:0;border-left:3px solid var(--teal);">
        <div style="font-size:10px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Current Capacity</div>
        <p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.capacityAnalysis.currentCapacity}</p>
      </div>` : ''}
      ${r.capacityAnalysis.growthCapacity ? `<div class="card" style="margin-bottom:0;border-left:3px solid var(--green);">
        <div style="font-size:10px;font-weight:800;color:var(--green);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Room to Grow (No Hiring)</div>
        <p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.capacityAnalysis.growthCapacity}</p>
      </div>` : ''}
      ${r.capacityAnalysis.adSpendOpportunity ? `<div class="card" style="margin-bottom:0;border-left:3px solid var(--yellow);">
        <div style="font-size:10px;font-weight:800;color:var(--yellow);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Ad Investment Opportunity</div>
        <p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.capacityAnalysis.adSpendOpportunity}</p>
      </div>` : ''}
      ${r.capacityAnalysis.followUpPotential ? `<div class="card" style="margin-bottom:0;border-left:3px solid var(--teal);">
        <div style="font-size:10px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Follow-Up System Yield</div>
        <p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.capacityAnalysis.followUpPotential}</p>
      </div>` : ''}
      ${r.capacityAnalysis.reactivationOpportunity ? `<div class="card" style="margin-bottom:0;border-left:3px solid var(--orange);">
        <div style="font-size:10px;font-weight:800;color:var(--orange);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Reactivate Old Customers</div>
        <p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.capacityAnalysis.reactivationOpportunity}</p>
      </div>` : ''}
      ${r.capacityAnalysis.referralPotential ? `<div class="card" style="margin-bottom:0;border-left:3px solid var(--green);">
        <div style="font-size:10px;font-weight:800;color:var(--green);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Referral Program Potential</div>
        <p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.capacityAnalysis.referralPotential}</p>
      </div>` : ''}
    </div>
  </div>` : ''}

  <!-- SCORECARD -->
  <div class="section">
    <div class="sec-label">Business Scorecard</div>
    <div class="sec-title">4 Core Areas</div>
    <div class="scorecard">
      ${[['Operations',r.operationsScore,r.operationsScoreNote],['Marketing & Sales',r.marketingScore,r.marketingScoreNote],['Team & People',r.teamScore,r.teamScoreNote],['Financial Health',r.financialScore,r.financialScoreNote]].map(([label,score,note])=>{
        const n=scoreNum(score);
        return `<div class="sc-item"><div class="sc-score" style="color:${scoreColor(n)}">${n}<span style="font-size:14px;color:var(--dim);">/10</span></div><div class="sc-label">${label}</div><div class="sc-note">${scoreNote(score,note)}</div></div>`;
      }).join('')}
    </div>
  </div>

  <!-- OWNER ECONOMICS -->
  <div class="section">
    <div class="sec-label">Owner Economics</div>
    <div class="sec-title">The Numbers Behind the Business</div>
    <div class="card"><p style="color:var(--muted);font-size:14px;line-height:1.85;">${r.ownerEconomics}</p></div>
    ${r.cashFlowAnalysis ? `<div class="card"><div style="font-size:11px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Cash Flow</div><p style="color:var(--muted);font-size:14px;line-height:1.85;">${r.cashFlowAnalysis}</p></div>` : ''}
    ${bankingMixedWarning}${bankingMultiAccountNote}${bankingStrongNote}

    <!-- CASH FLOW CALCULATOR (pre-computed, not GPT) -->
    ${(()=>{
      const _parsed = a.q4_parsed || {};
      const _annRev = _parsed.y0 || _parsed.y1 || _parsed.y2 || 0;
      const _mo = _annRev ? Math.round(_annRev / 12) : 0;
      if (!_mo) return '';
      // Compute owner & partner pay locally (same logic as outer function)
      const _ownerAmt = Object.values(a.owner_pay||{}).reduce((s,v)=>{
        const m = v.monthly || (v.frequency==='weekly' ? Math.round(Number(v.amount)*4.33) : Number(v.amount));
        return s + m;
      }, 0);
      const _partnersLocal = a.partners || (a.partner?.has && a.partner_pay ? [{pay:a.partner_pay, pay_total:a.partner_pay_total||0, name:'Partner'}] : []);

      // Build expense rows strictly from what the user answered — no injected estimates
      const _expLabels = {operations:'Operations & Overhead',staff:'Staff & Payroll',software:'Software & Tools',loans:'Loans & Debt Payments',marketing:'Marketing & Ads',equipment:'Equipment & Vehicles',other:'Other'};
      const _expRows = Object.entries(a.expense_breakdown||{})
        .filter(([,v])=>v!=null)
        .map(([cat,pct])=>({
          cat,
          label: _expLabels[cat]||cat,
          amt: Math.round(_mo*pct/100),
          note: `${pct}%`
        }));
      // Merge back-office payroll (from q19_segments) into the staff row
      // Team payroll — always add from q19_segments regardless of expense_breakdown.staff
      const _localFieldTypes = new Set(['field','contractors','field-contractors']);
      const _fieldMoLocal = Object.entries(a.q19_segments||{})
        .filter(([s])=>_localFieldTypes.has(s))
        .reduce((t,[,d])=>t+Number(d.count||0)*Number(d.pay||0), 0);
      const _boMoLocal = Object.entries(a.q19_segments||{})
        .filter(([s])=>!_localFieldTypes.has(s))
        .reduce((t,[,d])=>t+Number(d.count||0)*Number(d.pay||0), 0);
      if (_fieldMoLocal > 0) {
        _expRows.push({ cat:'field-staff', label:'Field / Contractors', amt:_fieldMoLocal, note:`${_mo>0?Math.round(_fieldMoLocal/_mo*100):0}%` });
      }
      if (_boMoLocal > 0) {
        _expRows.push({ cat:'back-office', label:'Back-Office Staff', amt:_boMoLocal, note:`${_mo>0?Math.round(_boMoLocal/_mo*100):0}%` });
      }
      const _totalExpAmt = _expRows.reduce((s,r)=>s+r.amt,0);
      const _partnerAmt = _partnersLocal.reduce((s,p)=>s+(p.pay_total||0),0);
      const _allDraws = _ownerAmt + _partnerAmt;
      const _net = _mo - _totalExpAmt - _allDraws;
      const _netColor = _net >= 0 ? 'var(--green)' : 'var(--red)';
      const _netLabel = _net >= 0 ? 'Net Cash Remaining' : 'Cash Shortfall';
      const fmt = n => (n<0?'-$':'$')+Math.abs(n).toLocaleString();

      return `<div class="card">
        <div style="font-size:11px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;">Monthly Cash Flow Breakdown</div>
        <div style="display:flex;flex-direction:column;gap:0;">
          <!-- Revenue row -->
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
            <span style="font-size:13px;font-weight:700;color:var(--text);">Gross Monthly Revenue</span>
            <span style="font-size:14px;font-weight:800;color:var(--green);">+${fmt(_mo)}</span>
          </div>
          <!-- Expense rows -->
          ${_expRows.map(row=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0 8px 12px;border-bottom:1px solid var(--border);opacity:.85;">
            <span style="font-size:12px;color:var(--muted);">${row.label} <span style="color:var(--dim);font-size:11px;">(${row.note||''})</span></span>
            <span style="font-size:13px;font-weight:600;color:var(--red);">-${fmt(row.amt)}</span>
          </div>`).join('')}
          <!-- Subtotal operating -->
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:2px solid var(--border);background:var(--bg2);padding:10px 8px;border-radius:6px;margin:4px 0;">
            <span style="font-size:12px;font-weight:700;color:var(--text);">Operating Subtotal</span>
            <span style="font-size:13px;font-weight:700;color:${_mo-_totalExpAmt>=0?'var(--teal)':'var(--red)'};">${fmt(_mo-_totalExpAmt)}</span>
          </div>
          <!-- Owner draws -->
          ${_ownerAmt > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0 8px 12px;border-bottom:1px solid var(--border);opacity:.85;">
            <span style="font-size:12px;color:var(--muted);">Owner Draws / Salary</span>
            <span style="font-size:13px;font-weight:600;color:var(--orange);">-${fmt(_ownerAmt)}</span>
          </div>` : ''}
          <!-- Partner draws -->
          ${_partnersLocal.map(p=>p.pay_total>0?`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0 8px 12px;border-bottom:1px solid var(--border);opacity:.85;">
            <span style="font-size:12px;color:var(--muted);">2nd Owner Draws / Salary</span>
            <span style="font-size:13px;font-weight:600;color:var(--orange);">-${fmt(p.pay_total)}</span>
          </div>`:'').join('')}
          <!-- Net -->
          <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 8px;background:${_net>=0?'#D1FAE5':'#FEE2E2'};border-radius:8px;margin-top:6px;">
            <span style="font-size:13px;font-weight:800;color:${_netColor};">${_netLabel}</span>
            <span style="font-size:16px;font-weight:900;color:${_netColor};">${fmt(_net)}/mo</span>
          </div>
          ${(()=>{
            if (_net >= 0) {
              return `<p style="font-size:12px;color:var(--muted);margin-top:10px;line-height:1.6;">This is your estimated monthly surplus before taxes and untracked expenses. Set aside 25–30% of this for taxes.</p>`;
            }
            // Break-even calculation:
            // Fixed costs (draws + back-office) ÷ contribution margin = break-even revenue
            // Variable costs include: expense_breakdown % + field/contractor % (both scale with revenue)
            const _expPctRaw = Object.entries(a.expense_breakdown||{}).filter(([,v])=>v!=null).reduce((s,[,v])=>s+Number(v),0) / 100;
            const _fieldVarPct = _mo > 0 ? _fieldMoLocal / _mo : 0;
            const _totalVarPct = _expPctRaw + _fieldVarPct;
            const _contribMargin = Math.max(1 - _totalVarPct, 0.01); // contribution margin
            // Back-office payroll is a fixed cost (headcount-based, not revenue-scaled) — must be included
            const _fixedDraws = _allDraws + _backOfficeMo;
            const _breakEvenMo = _totalVarPct < 1 ? Math.ceil(_fixedDraws / _contribMargin / 100) * 100 : null;
            const _breakEvenYr = _breakEvenMo ? _breakEvenMo * 12 : null;
            const _gapMo = _breakEvenMo ? _breakEvenMo - _mo : null;
            // Payroll delay critical block (only when behind_on_payroll is flagged)
            const _isBehind = a.behind_on_payroll === 'yes' || a.behind_on_payroll === 'yes-severe';
            const _isSevere = a.behind_on_payroll === 'yes-severe';
            const _payrollBlock = _isBehind ? `<div style="background:#FEF2F2;border:1px solid #EF4444;border-left:4px solid #DC2626;border-radius:8px;padding:14px 16px;margin-top:12px;">
              <div style="font-size:11px;font-weight:800;color:#DC2626;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;">🚨 Critical Risk — Payroll Delays Detected</div>
              <p style="font-size:13px;color:#7F1D1D;line-height:1.75;margin:0 0 10px;">You reported ${_isSevere ? 'consistently paying your team <strong>a week or more late</strong>' : 'sometimes paying your team <strong>a few days late</strong>'}${a.behind_payroll_days ? ' — averaging <strong>' + a.behind_payroll_days + ' days</strong> past the pay date' : ''}. This means you are <strong>using next month's revenue to fund this month's operations</strong>. As long as revenue holds, the gap is hidden. If it dips, the gap compounds faster than you can recover.</p>
              ${a.behind_payroll_days ? `<div style="background:#fff;border:1px solid #FCA5A5;border-radius:8px;padding:10px 14px;margin-bottom:10px;">
                <div style="font-size:11px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">📊 What This Means In Numbers</div>
                <div style="display:flex;flex-direction:column;gap:4px;">
                  <div style="display:flex;justify-content:space-between;font-size:12px;color:#7F1D1D;padding:3px 0;">
                    <span>Monthly revenue</span><span style="font-weight:700;">$${fmt(_mo)}/mo</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:12px;color:#7F1D1D;padding:3px 0;border-bottom:1px solid #FEE2E2;">
                    <span>Revenue per day (÷ 30 days)</span><span style="font-weight:700;">$${fmt(Math.round(_mo/30))}/day</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;">
                    <span style="color:#991B1B;font-weight:600;">Your team is owed right now (${a.behind_payroll_days} days × $${fmt(Math.round(_mo/30))}/day)</span>
                    <span style="font-weight:800;color:#DC2626;">~$${fmt(Math.round(_mo/30 * a.behind_payroll_days))}</span>
                  </div>
                </div>
                <p style="font-size:11px;color:#991B1B;margin:8px 0 0;line-height:1.55;">⚠️ If your customers pay you a few days late, your actual delay compounds — because you can only pay your team when cash hits your account, not when invoices are due.</p>
              </div>` : ''}
              <div style="background:#fff;border:1px solid #FCA5A5;border-radius:8px;padding:10px 14px;margin-bottom:10px;">
                <div style="font-size:11px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">What Happens If Revenue Drops:</div>
                <div style="display:flex;flex-direction:column;gap:0;">
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:6px 0;border-bottom:1px solid #FEE2E2;">
                    <span style="color:#7F1D1D;">Today — ${fmt(_mo)}/mo revenue</span>
                    <span style="font-weight:700;color:#DC2626;">${fmt(_net)}/mo shortfall</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:6px 0;border-bottom:1px solid #FEE2E2;">
                    <span style="color:#7F1D1D;">−10% revenue → ${fmt(Math.round(_mo*0.9))}/mo</span>
                    <span style="font-weight:700;color:#DC2626;">${fmt(Math.round(_mo*0.9*(1-_expPctRaw)-_allDraws-_backOfficeMo))}/mo shortfall</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:6px 0;">
                    <span style="color:#7F1D1D;">−20% revenue → ${fmt(Math.round(_mo*0.8))}/mo</span>
                    <span style="font-weight:700;color:#DC2626;">${fmt(Math.round(_mo*0.8*(1-_expPctRaw)-_allDraws-_backOfficeMo))}/mo shortfall</span>
                  </div>
                </div>
              </div>
              <p style="font-size:12px;color:#991B1B;margin:0;line-height:1.6;">⚡ <strong>Resolve this before any growth initiative.</strong> Late payroll erodes team trust irreversibly, creates wage-and-hour legal exposure, and signals a structural cash flow problem — not a timing issue. See Priority Action #1 in your report.</p>
            </div>` : '';
            return _payrollBlock + `<div style="background:#FEF3C7;border:1px solid #F59E0B;border-left:4px solid #F59E0B;border-radius:8px;padding:14px 16px;margin-top:12px;">
              <div style="font-size:11px;font-weight:800;color:#92400E;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;">⚠️ Attention — Negative Cash Flow Detected</div>
              <p style="font-size:13px;color:#78350F;line-height:1.75;margin:0 0 10px;">Based on the numbers you provided, your current expenses and owner draws exceed monthly revenue by <strong>${fmt(Math.abs(_net))}/mo</strong>. To break even or stay positive, you have two paths:</p>
              ${_breakEvenMo ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
                <div style="background:#fff;border:1px solid #F59E0B;border-radius:8px;padding:10px 16px;flex:1;min-width:160px;">
                  <div style="font-size:10px;font-weight:700;color:#92400E;letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px;">Path 1 — Grow Revenue</div>
                  <div style="font-size:18px;font-weight:900;color:#92400E;">${fmt(_breakEvenMo)}<span style="font-size:11px;font-weight:500;">/mo</span></div>
                  <div style="font-size:11px;color:#78350F;">${fmt(_breakEvenYr)}/yr needed to break even</div>
                  <div style="font-size:11px;color:#78350F;margin-top:2px;">+${fmt(_gapMo)} more than current revenue</div>
                </div>
                <div style="background:#fff;border:1px solid #F59E0B;border-radius:8px;padding:10px 16px;flex:1;min-width:160px;">
                  <div style="font-size:10px;font-weight:700;color:#92400E;letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px;">Path 2 — Reduce Expenses / Draws</div>
                  <div style="font-size:18px;font-weight:900;color:#92400E;">${fmt(Math.abs(_net))}<span style="font-size:11px;font-weight:500;">/mo</span></div>
                  <div style="font-size:11px;color:#78350F;">needs to come out of costs or draws</div>
                  <div style="font-size:11px;color:#78350F;margin-top:2px;">${fmt(Math.abs(_net)*12)}/yr in savings required</div>
                </div>
              </div>` : ''}
              <p style="font-size:11px;color:#92400E;margin:0;line-height:1.6;">Formula: Break-even = (owner draws + back-office payroll) ÷ contribution margin = (${fmt(_allDraws)} + ${fmt(_backOfficeMo)}) ÷ ${Math.round(_contribMargin*100)}% = ${fmt(_fixedDraws)} ÷ ${Math.round(_contribMargin*100)}% = ${_breakEvenMo?fmt(_breakEvenMo)+'/mo':'not calculable'} &nbsp;|&nbsp; Variable costs: ${Math.round(_expPctRaw*100)}% overhead + ${Math.round(_fieldVarPct*100)}% field = ${Math.round(_totalVarPct*100)}% total</p>
            </div>`;
          })()}
        </div>
      </div>`;
    })()}
  </div>

  <!-- OPERATIONS DEEP DIVE -->
  ${r.operationsDeepDive ? `
  <div class="section">
    <div class="sec-label">Operations Analysis</div>
    <div class="sec-title">How Your Business Actually Runs</div>
    <div class="card" style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-size:11px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;">Current State</div>
        ${r.operationsDeepDive.systemsScore ? `<span style="font-size:12px;font-weight:700;color:var(--muted);background:var(--bg2);padding:4px 12px;border-radius:20px;">Score: ${r.operationsDeepDive.systemsScore}</span>` : ''}
      </div>
      <p style="font-size:14px;color:var(--muted);line-height:1.8;">${r.operationsDeepDive.currentState||''}</p>
    </div>
    ${r.operationsDeepDive.bottlenecks?.length ? `
    <div class="card" style="margin-bottom:14px;">
      <div style="font-size:11px;font-weight:800;color:var(--red);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Top Bottlenecks</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${r.operationsDeepDive.bottlenecks.map(b=>`<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 14px;background:#FEE2E210;border:1px solid #EF444430;border-radius:8px;"><span style="color:var(--red);font-size:16px;flex-shrink:0;">⚡</span><span style="font-size:13px;color:var(--muted);">${b}</span></div>`).join('')}
      </div>
    </div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      ${r.operationsDeepDive.sopPriorities ? `<div class="card" style="margin-bottom:0;border-left:3px solid var(--teal);"><div style="font-size:10px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">SOP Priorities</div><p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.operationsDeepDive.sopPriorities}</p></div>` : ''}
      ${r.operationsDeepDive.delegationOpportunity ? `<div class="card" style="margin-bottom:0;border-left:3px solid var(--green);"><div style="font-size:10px;font-weight:800;color:var(--green);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Strategic Focus</div><p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.operationsDeepDive.delegationOpportunity}</p></div>` : ''}
    </div>
  </div>` : ''}

  <!-- MARKETING DEEP DIVE -->
  ${r.marketingDeepDive ? `
  <div class="section">
    <div class="sec-label">Marketing Analysis</div>
    <div class="sec-title">Your Lead Engine — What's Working & What's Missing</div>
    <div class="card" style="margin-bottom:14px;">
      <div style="font-size:11px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Current Marketing State</div>
      <p style="font-size:14px;color:var(--muted);line-height:1.8;">${r.marketingDeepDive.currentState||''}</p>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <div style="font-size:11px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Funnel Analysis</div>
      <p style="font-size:14px;color:var(--muted);line-height:1.8;">${r.marketingDeepDive.funnelAnalysis||''}</p>
    </div>
    ${r.marketingDeepDive.topChannelRecommendations?.length ? `
    <div class="card" style="margin-bottom:14px;">
      <div style="font-size:11px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Top Channel Recommendations</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${r.marketingDeepDive.topChannelRecommendations.map((ch,i)=>`<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 14px;background:#D1FAE510;border:1px solid #10B98130;border-radius:8px;"><span style="font-size:13px;font-weight:800;color:var(--teal);flex-shrink:0;">#${i+1}</span><span style="font-size:13px;color:var(--muted);">${ch}</span></div>`).join('')}
      </div>
    </div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      ${r.marketingDeepDive.reviewStrategy ? `<div class="card" style="margin-bottom:0;border-left:3px solid var(--yellow);"><div style="font-size:10px;font-weight:800;color:var(--yellow);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Review Growth Strategy</div><p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.marketingDeepDive.reviewStrategy}</p></div>` : ''}
      ${r.marketingDeepDive.retentionVsAcquisition ? `<div class="card" style="margin-bottom:0;border-left:3px solid var(--orange);"><div style="font-size:10px;font-weight:800;color:var(--orange);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Retention vs Acquisition</div><p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.marketingDeepDive.retentionVsAcquisition}</p></div>` : ''}
    </div>
  </div>` : ''}

  <!-- TEAM ANALYSIS -->
  ${r.teamAnalysis ? `
  <div class="section">
    <div class="sec-label">Team Analysis</div>
    <div class="sec-title">People, Payroll & Structure</div>
    <div class="card" style="margin-bottom:14px;">
      <p style="font-size:14px;color:var(--muted);line-height:1.8;">${r.teamAnalysis.currentStructure||''}</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      ${r.teamAnalysis.payrollRatio ? `<div class="card" style="margin-bottom:0;border-left:3px solid var(--teal);"><div style="font-size:10px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Payroll / Revenue Ratio</div><p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.teamAnalysis.payrollRatio}</p></div>` : ''}
      ${r.teamAnalysis.nextHire ? `<div class="card" style="margin-bottom:0;border-left:3px solid var(--green);"><div style="font-size:10px;font-weight:800;color:var(--green);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Next Hire Recommendation</div><p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.teamAnalysis.nextHire}</p></div>` : ''}
      ${r.teamAnalysis.managementGaps ? `<div class="card" style="margin-bottom:0;border-left:3px solid var(--red);"><div style="font-size:10px;font-weight:800;color:var(--red);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Management Gaps</div><p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.teamAnalysis.managementGaps}</p></div>` : ''}
      ${r.teamAnalysis.partnerNote && r.teamAnalysis.partnerNote !== 'Not applicable — solo operator.' ? `<div class="card" style="margin-bottom:0;border-left:3px solid var(--yellow);"><div style="font-size:10px;font-weight:800;color:var(--yellow);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Partnership Analysis</div><p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.teamAnalysis.partnerNote}</p></div>` : ''}
    </div>
  </div>` : ''}

  <!-- FINANCIAL HEALTH DEEP DIVE -->
  ${r.financialHealthDeepDive ? `
  <div class="section">
    <div class="sec-label">Financial Health</div>
    <div class="sec-title">Margins, Ratios & Where the Money Goes</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
      ${(()=>{
        // Deterministic margin breakdown — not GPT text
        const _mo = _renderMonthlyRev;
        const _ownerDrawsPct = (_mo > 0 && (a.q16||0) > 0) ? Math.round(Object.values(a.owner_pay||{}).reduce((s,v)=>s+(v.monthly||(v.frequency==='weekly'?Math.round(Number(v.amount)*4.33):Number(v.amount))),0) / _mo * 100) : 0;
        const _partnerDrawsPct = (_mo > 0) ? Math.round((a.partners||[]).reduce((s,p)=>s+(p.pay_total||0),0) / _mo * 100) : 0;
        const _fieldPctM = _fieldPctBar;
        const _boPctM = _backOfficePct;
        const _overheadPct = expTotal;
        const _netPct = Math.max(0, 100 - _fieldPctM - _boPctM - _overheadPct - _ownerDrawsPct - _partnerDrawsPct);
        const _rows = [
          {label:'Field / Contractors', pct:_fieldPctM, color:'#0D9488', amt:Math.round(_mo*_fieldPctM/100)},
          {label:'Back-Office Staff', pct:_boPctM, color:'#0284C7', amt:_backOfficeMo},
          {label:'Overhead (ops, marketing, software, loans)', pct:_overheadPct, color:'#7C3AED', amt:Math.round(_mo*_overheadPct/100)},
          {label:'Owner Draws / Salary', pct:_ownerDrawsPct, color:'#B45309', amt:Math.round(_mo*_ownerDrawsPct/100)},
          ...(_partnerDrawsPct > 0 ? [{label:'Partner Draws / Salary', pct:_partnerDrawsPct, color:'#92400E', amt:Math.round(_mo*_partnerDrawsPct/100)}] : []),
        ];
        const _totalPct = _fieldPctM + _boPctM + _overheadPct + _ownerDrawsPct + _partnerDrawsPct;
        return `<div class="card" style="margin-bottom:0;border-left:3px solid var(--teal);">
          <div style="font-size:10px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Where Every Dollar Goes</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${_rows.map(row=>`
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span style="font-size:12px;color:var(--muted);">${row.label}</span>
                <span style="font-size:12px;font-weight:700;color:var(--text);">${row.pct}% &nbsp;<span style="font-weight:400;color:var(--muted);">($${row.amt.toLocaleString()}/mo)</span></span>
              </div>
              <div style="height:6px;background:var(--bg2);border-radius:99px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(row.pct,100)}%;background:${row.color};border-radius:99px;"></div>
              </div>
            </div>`).join('')}
            <div style="border-top:1px solid var(--border);margin-top:4px;padding-top:8px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;font-weight:800;color:var(--text);">Total Costs</span>
              <span style="font-size:14px;font-weight:900;color:${_totalPct>=100?'#DC2626':'#16A34A'};">${_totalPct}%</span>
            </div>
            <div style="background:${_netPct>5?'#D1FAE5':_netPct>0?'#FEF3C7':'#FEE2E2'};border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:13px;font-weight:800;color:${_netPct>5?'#065F46':_netPct>0?'#92400E':'#991B1B'};">Net Margin Left for Business</span>
              <span style="font-size:16px;font-weight:900;color:${_netPct>5?'#059669':_netPct>0?'#B45309':'#DC2626'};">${_netPct}%</span>
            </div>
            ${_netPct === 0 ? `<p style="font-size:11px;color:var(--muted);margin:4px 0 0;line-height:1.5;">Every dollar coming in is already spoken for. To build a buffer, either grow revenue or reduce one of the cost categories above.</p>` : ''}
          </div>
        </div>`;
      })()}
      ${r.financialHealthDeepDive.expenseRatioAnalysis ? `<div class="card" style="margin-bottom:0;border-left:3px solid var(--yellow);"><div style="font-size:10px;font-weight:800;color:var(--yellow);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Expense Benchmarks</div><p style="font-size:13px;color:var(--muted);line-height:1.7;">${r.financialHealthDeepDive.expenseRatioAnalysis}</p></div>` : ''}
    </div>
    ${r.financialHealthDeepDive.profitLeakage ? `<div class="card" style="margin-bottom:14px;background:#FEF3C7;border:1px solid #F59E0B;border-left:4px solid #F59E0B;"><div style="font-size:11px;font-weight:800;color:#92400E;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">⚠️ Profit Leakage — Where Money May Be Escaping</div><p style="font-size:13px;color:#78350F;line-height:1.75;">${r.financialHealthDeepDive.profitLeakage}</p></div>` : ''}
    ${r.financialHealthDeepDive.financialRoadmap ? `<div class="card"><div style="font-size:11px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Next 90 Days — Financial Priorities</div><p style="font-size:13px;color:var(--muted);line-height:1.8;">${r.financialHealthDeepDive.financialRoadmap}</p></div>` : ''}
  </div>` : ''}

  <!-- AUTOMATION OPPORTUNITIES -->
  ${r.automationOpportunities?.length ? `
  <div class="section">
    <div class="sec-label">Automation Opportunities</div>
    <div class="sec-title">What You Can Stop Doing Manually</div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${r.automationOpportunities.map(op=>`
      <div class="card" style="margin-bottom:0;">
        <div style="display:flex;gap:16px;align-items:flex-start;">
          <div style="background:var(--navy);color:#44CAA2;border-radius:10px;padding:10px 14px;font-size:18px;flex-shrink:0;">⚙️</div>
          <div style="flex:1;">
            <div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:8px;">${op.area}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;font-size:12px;">
              <div><div style="font-size:10px;font-weight:800;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Current (Manual)</div><span style="color:var(--muted);">${op.currentState}</span></div>
              <div><div style="font-size:10px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Solution</div><span style="color:var(--text);font-weight:600;">${op.solution}</span></div>
              <div><div style="font-size:10px;font-weight:800;color:var(--green);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Impact</div><span style="color:var(--green);font-weight:600;">${op.impact}</span></div>
            </div>
          </div>
        </div>
      </div>`).join('')}
    </div>
  </div>` : ''}

  <!-- DATA CONFIDENCE SCORE -->
  <div class="section">
    <div class="sec-label">Data Confidence</div>
    <div class="sec-title">How Reliable Is This Report?</div>
    <div class="card" style="border-left:4px solid ${cs.border};background:${cs.bg};padding:24px 28px;">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:${cs.issues.length ? '20px' : '0'};">
        <div style="width:48px;height:48px;border-radius:50%;background:${cs.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="font-size:22px;color:white;font-weight:900;line-height:1;">${cs.icon}</span>
        </div>
        <div>
          <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${cs.color};margin-bottom:3px;">Data Confidence</div>
          <div style="font-size:22px;font-weight:900;color:${cs.color};line-height:1;">${cs.level}</div>
        </div>
        ${cs.level === 'Verified' ? `<div style="margin-left:auto;font-size:13px;color:#059669;font-weight:600;line-height:1.6;">All key metrics are consistent and internally verified.<br>This report can be used directly for planning.</div>` : ''}
      </div>
      ${cs.issues.length ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#374151;margin-bottom:10px;">Why This Score</div>
        <div style="display:flex;flex-direction:column;gap:9px;">
          ${cs.issues.map(issue => `<div style="display:flex;gap:10px;align-items:flex-start;">
            <span style="width:18px;height:18px;border-radius:50%;background:${cs.color};color:white;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">${cs.icon}</span>
            <span style="font-size:13px;color:#374151;line-height:1.7;">${issue}</span>
          </div>`).join('')}
        </div>
      </div>
      <div style="border-top:1px solid rgba(0,0,0,0.10);padding-top:16px;">
        <div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#374151;margin-bottom:10px;">Verify Before Making Decisions</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${cs.verifications.map((v,i) => `<div style="display:flex;gap:10px;align-items:flex-start;">
            <span style="min-width:22px;height:22px;border-radius:6px;background:white;border:1px solid ${cs.border};color:${cs.color};font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</span>
            <span style="font-size:13px;color:#374151;line-height:1.7;">${v}</span>
          </div>`).join('')}
        </div>
      </div>` : ''}
    </div>
  </div>

  <!-- TOP 3 ACTIONS -->
  <div class="section">
    <div class="sec-label">Priority Actions</div>
    <div class="sec-title">What To Do First</div>
    ${(r.top3Actions||[]).map((act,i)=>`
    <div class="action-card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div class="action-num">${i+1}</div>
        <div style="font-size:17px;font-weight:800;color:var(--text);">${act.title}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:13px;color:var(--muted);">
        <div><div style="font-size:10px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">WHY THIS FIRST</div>${act.why}</div>
        <div><div style="font-size:10px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">IMPACT</div>${act.impact}</div>
      </div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);font-size:13px;color:var(--muted);"><span style="font-weight:700;color:var(--text);">How: </span>${act.how}</div>
    </div>`).join('')}
  </div>

  <!-- GROWTH PLAN -->
  <div class="section">
    <div class="sec-label">Growth Plan</div>
    <div class="sec-title">What You Can Do</div>
    ${Array.isArray(r.growthPlan) ? r.growthPlan.map(section => `
    <div class="card" style="margin-bottom:16px;">
      <div style="font-size:11px;font-weight:800;color:var(--teal);letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border);">${section.theme}</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${(section.items||[]).map((item,i) => `
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <span style="font-size:13px;font-weight:800;color:var(--navy);background:var(--bg2);border-radius:6px;padding:2px 8px;flex-shrink:0;min-width:28px;text-align:center;">${i+1}</span>
          <span style="font-size:13px;color:var(--muted);line-height:1.7;">${item}</span>
        </div>`).join('')}
      </div>
    </div>`).join('') : `<div class="card"><p style="color:var(--muted);font-size:14px;line-height:1.9;">${r.growthPlan}</p></div>`}
  </div>

  ${rB.softwareAnalysis ? `
  <!-- TECHNOLOGY AUDIT -->
  <div class="section">
    <div class="section-label">TECHNOLOGY</div><div class="section-title">Technology Audit</div>
    ${rB.softwareAnalysis.currentStack?.length ? `<div class="card"><h3 style="font-size:15px;font-weight:700;color:var(--navy);margin:0 0 14px;">Current Software Stack</h3><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">${rB.softwareAnalysis.currentStack.map(s=>`<span style="background:var(--bg2);border-radius:20px;padding:5px 14px;font-size:13px;color:var(--navy);font-weight:600;">${s}</span>`).join('')}</div></div>` : ''}
    ${rB.softwareAnalysis.integrationMap ? `<div class="card"><h3 style="font-size:15px;font-weight:700;color:var(--navy);margin:0 0 10px;">How Your Tools Work Together</h3><p style="font-size:13px;color:var(--muted);line-height:1.8;margin:0;">${rB.softwareAnalysis.integrationMap}</p></div>` : ''}
    ${rB.softwareAnalysis.dataFlow ? `<div class="card"><h3 style="font-size:15px;font-weight:700;color:var(--navy);margin:0 0 10px;">Data Flow: Where It Breaks Down</h3><p style="font-size:13px;color:var(--muted);line-height:1.8;margin:0;">${rB.softwareAnalysis.dataFlow}</p></div>` : ''}
    ${rB.softwareAnalysis.gaps?.length ? `<div class="card"><h3 style="font-size:15px;font-weight:700;color:var(--navy);margin:0 0 14px;">Identified Gaps</h3><div style="display:flex;flex-direction:column;gap:10px;">${rB.softwareAnalysis.gaps.map(g=>`<div style="display:flex;gap:12px;align-items:flex-start;"><span style="width:6px;height:6px;border-radius:50%;background:#fb8c00;flex-shrink:0;margin-top:7px;"></span><span style="font-size:13px;color:var(--muted);line-height:1.7;">${g}</span></div>`).join('')}</div></div>` : ''}
    ${rB.softwareAnalysis.verdict ? `<div class="card" style="background:var(--bg2);"><p style="font-size:13px;color:var(--navy);font-weight:600;line-height:1.8;margin:0;">${rB.softwareAnalysis.verdict}</p></div>` : ''}
  </div>` : ''}

  ${rB.pricingStrategy ? `
  <!-- PRICING STRATEGY -->
  <div class="section">
    <div class="section-label">PRICING</div><div class="section-title">Pricing Strategy</div>
    ${rB._noRevenue ? `<div class="card" style="border-left:4px solid #f59e0b;"><p style="font-size:14px;color:#92400e;font-weight:600;margin:0;">⚠️ No revenue data was provided. Financial projections cannot be calculated. Please complete the revenue section of the assessment to unlock pricing analysis.</p></div>` : ''}
    ${rB._lowRevenue ? `<div class="card" style="border-left:4px solid #f59e0b;"><p style="font-size:14px;color:#92400e;font-weight:600;margin:0;">⚠️ Revenue entered is under $10,000/year. The projections below are based on this figure but may not reflect a typical business operation at this scale.</p></div>` : ''}
    ${rB.pricingStrategy.summary ? `<div class="card"><p style="font-size:14px;color:var(--muted);line-height:1.8;margin:0;">${rB.pricingStrategy.summary}</p></div>` : ''}
    ${rB.pricingStrategy.scenarios?.length ? `<div class="card"><h3 style="font-size:15px;font-weight:700;color:var(--navy);margin:0 0 6px;">Scenario Comparison</h3>${rB.pricingStrategy.baselineNote ? `<p style="font-size:12px;color:var(--muted);margin:0 0 14px;">📊 ${rB.pricingStrategy.baselineNote}</p>` : ''}<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:var(--bg2);">${['Scenario','New Avg Check','Est. Revenue/Mo','Est. Revenue/Yr','Net Change/Mo','Net Change/Yr'].map(h=>`<th style="padding:10px 12px;text-align:left;font-weight:700;color:var(--navy);white-space:nowrap;">${h}</th>`).join('')}</tr></thead><tbody>${rB.pricingStrategy.scenarios.map((sc,i)=>`<tr style="border-top:1px solid var(--border);background:${i%2?'var(--bg2)':'white'};">${[sc.label,sc.newCheck,sc.revMo,sc.revYr,sc.netChangeMo,sc.netChangeYr].map((v,ci)=>`<td style="padding:10px 12px;color:${ci>=4?(v&&v.startsWith('+'))?'#2e7d32':'#c62828':'var(--muted)'};font-weight:${ci>=4?'700':'400'};">${v||'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>` : ''}
    ${rB.pricingStrategy.recommendation ? `<div class="card" style="border-left:3px solid var(--green);"><p style="font-size:14px;color:var(--navy);font-weight:600;line-height:1.8;margin:0;">📌 ${rB.pricingStrategy.recommendation}</p></div>` : ''}
  </div>` : ''}

  ${rB.automationScenarios ? `
  <!-- AUTOMATION BOTS -->
  <div class="section">
    <div class="section-label">AUTOMATION</div>
    <div class="section-title">AI Bot Opportunities</div>
    ${rB.automationScenarios.summary ? `<div class="card"><p style="font-size:14px;color:var(--muted);line-height:1.8;margin:0;">${rB.automationScenarios.summary}</p></div>` : ''}
    ${rB.automationScenarios.bots?.length ? rB.automationScenarios.bots.map(bot=>`<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:10px;"><div><div class="section-label" style="margin-bottom:4px;">${bot.category||''}</div><h3 style="font-size:15px;font-weight:700;color:var(--navy);margin:0;">${bot.name}</h3></div></div><p style="font-size:13px;color:var(--muted);line-height:1.8;margin:0 0 10px;">${bot.description}</p>${bot.dataUsed ? `<p style="font-size:12px;color:var(--muted);line-height:1.7;margin:0;border-top:1px solid var(--border);padding-top:10px;"><strong style="color:var(--navy);">Data it uses: </strong>${bot.dataUsed}</p>` : ''}</div>`).join('') : ''}
  </div>` : ''}

  ${rB.systemsAndSOPs ? `
  <!-- SOPs & SYSTEMS -->
  <div class="section">
    <div class="section-label">SYSTEMS</div>
    <div class="section-title">SOPs &amp; Systems Roadmap</div>
    ${rB.systemsAndSOPs.overview ? `<div class="card"><p style="font-size:14px;color:var(--muted);line-height:1.8;margin:0;">${rB.systemsAndSOPs.overview}</p></div>` : ''}
    ${rB.systemsAndSOPs.top3SOPs?.length ? `<div class="card"><h3 style="font-size:15px;font-weight:700;color:var(--navy);margin:0 0 14px;">Priority SOPs to Build First</h3><div style="display:flex;flex-direction:column;gap:14px;">${rB.systemsAndSOPs.top3SOPs.map((sop,i)=>`<div style="display:flex;gap:12px;align-items:flex-start;"><span style="font-size:13px;font-weight:800;color:var(--navy);background:var(--bg2);border-radius:6px;padding:2px 10px;flex-shrink:0;min-width:28px;text-align:center;">${i+1}</span><div><strong style="font-size:13px;color:var(--navy);">${sop.name||sop}</strong>${sop.why ? `<p style="font-size:13px;color:var(--muted);line-height:1.7;margin:4px 0 0;">${sop.why}</p>` : ''}</div></div>`).join('')}</div></div>` : ''}
    ${rB.systemsAndSOPs.toolCategories?.length ? `<div class="card"><h3 style="font-size:15px;font-weight:700;color:var(--navy);margin:0 0 14px;">Tool Categories to Consider</h3><div style="display:flex;flex-wrap:wrap;gap:8px;">${rB.systemsAndSOPs.toolCategories.map(t=>`<span style="background:var(--bg2);border-radius:20px;padding:5px 14px;font-size:13px;color:var(--navy);font-weight:600;">${(typeof t==='object'?t.category:t)||t}</span>`).join('')}</div></div>` : ''}
  </div>` : ''}

  ${rB.riskRegister?.length ? `
  <!-- RISK REGISTER -->
  <div class="section">
    <div class="section-label">RISK MANAGEMENT</div>
    <div class="section-title">Risk Register</div>
    <div class="card"><div style="display:flex;flex-direction:column;gap:18px;">${rB.riskRegister.map(risk=>{ const lvl=risk.likelihood||risk.severity||'Medium'; const color=lvl==='High'?'#e53935':lvl==='Medium'?'#fb8c00':'#43a047'; const bg=lvl==='High'?'#ffebee':lvl==='Medium'?'#fff3e0':'#e8f5e9'; const tc=lvl==='High'?'#c62828':lvl==='Medium'?'#e65100':'#2e7d32'; return `<div style="border-left:4px solid ${color};padding-left:16px;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;"><strong style="font-size:14px;color:var(--navy);">${risk.risk||risk.name||''}</strong><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;background:${bg};color:${tc};">${lvl}</span></div>${risk.trigger ? `<p style="font-size:13px;color:var(--muted);line-height:1.7;margin:0 0 6px;"><strong style="color:var(--navy);">Trigger: </strong>${risk.trigger}</p>` : ''}${(risk.impact||risk.description) ? `<p style="font-size:13px;color:var(--muted);line-height:1.7;margin:0 0 6px;">${risk.impact||risk.description}</p>` : ''}<p style="font-size:13px;color:var(--muted);line-height:1.7;margin:0;"><strong style="color:var(--navy);">Action: </strong>${risk.mitigation||''}</p></div>`; }).join('')}</div></div>
  </div>` : ''}

  ${rB.competitiveAnalysis ? `
  <!-- COMPETITIVE ANALYSIS -->
  <div class="section">
    <div class="section-label">MARKET INTELLIGENCE</div>
    <div class="section-title">Competitive Landscape</div>
    ${(rB.competitiveAnalysis.overview||rB.competitiveAnalysis.summary) ? `<div class="card"><p style="font-size:14px;color:var(--muted);line-height:1.8;margin:0;">${rB.competitiveAnalysis.overview||rB.competitiveAnalysis.summary}</p></div>` : ''}
    ${rB.competitiveAnalysis.competitors?.length ? `<div class="card"><h3 style="font-size:15px;font-weight:700;color:var(--navy);margin:0 0 14px;">Key Competitors</h3><div style="display:flex;flex-direction:column;gap:16px;">${rB.competitiveAnalysis.competitors.map(c=>`<div style="border:1px solid var(--border);border-radius:10px;padding:16px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:10px;"><strong style="font-size:14px;color:var(--navy);">${c.name||''}</strong>${c.rating ? `<span style="font-size:12px;color:var(--muted);font-weight:600;">${c.rating}</span>` : ''}</div>${c.strengths ? `<p style="font-size:13px;color:var(--muted);line-height:1.7;margin:0 0 6px;"><strong style="color:var(--navy);">Strengths: </strong>${c.strengths}</p>` : ''}${c.gap ? `<p style="font-size:13px;color:var(--muted);line-height:1.7;margin:0 0 6px;"><strong style="color:var(--navy);">Vulnerability: </strong>${c.gap}</p>` : ''}${c.pricing ? `<p style="font-size:12px;color:var(--muted);line-height:1.6;margin:0;border-top:1px solid var(--border);padding-top:8px;">${c.pricing}</p>` : ''}</div>`).join('')}</div></div>` : ''}
    ${(rB.competitiveAnalysis.yourEdge||rB.competitiveAnalysis.topPerformer) ? `<div class="card" style="border-left:3px solid var(--green);"><h3 style="font-size:14px;font-weight:700;color:var(--navy);margin:0 0 8px;">Your Competitive Edge</h3><p style="font-size:13px;color:var(--muted);line-height:1.8;margin:0;">${rB.competitiveAnalysis.yourEdge||''}</p></div>` : ''}
  </div>` : ''}

  ${rB.cashFlowProjection ? `
  <!-- 180-DAY PROJECTION -->
  <div class="section">
    <div class="section-label">FINANCIAL OUTLOOK</div>
    <div class="section-title">180-Day Cash Flow Projection</div>
    ${rB.cashFlowProjection.currentBaseline ? `<div class="card"><p style="font-size:14px;color:var(--muted);line-height:1.8;margin:0;">${rB.cashFlowProjection.currentBaseline}</p></div>` : ''}
    ${rB.cashFlowProjection.badScenario ? `<div class="card" style="border-left:3px solid #e53935;"><h3 style="font-size:15px;font-weight:700;color:#c62828;margin:0 0 10px;">If Nothing Changes — Declining Scenario</h3>${rB.cashFlowProjection.badScenario.narrative ? `<p style="font-size:13px;color:var(--muted);line-height:1.8;margin:0 0 14px;">${rB.cashFlowProjection.badScenario.narrative}</p>` : ''}${rB.cashFlowProjection.badScenario.months?.length ? `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#ffebee;">${['Period','Revenue','Net Cash Flow','Decision Required'].map(h=>`<th style="padding:8px 10px;text-align:left;font-weight:700;color:#c62828;white-space:nowrap;">${h}</th>`).join('')}</tr></thead><tbody>${rB.cashFlowProjection.badScenario.months.map((m,i)=>`<tr style="border-top:1px solid var(--border);background:${i%2?'#fff8f8':'white'};">${[m.month,m.revenue,m.net,m.action].map(v=>`<td style="padding:8px 10px;color:var(--muted);">${v||'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}</div>` : ''}
    ${rB.cashFlowProjection.goodScenario ? `<div class="card" style="border-left:3px solid var(--green);"><h3 style="font-size:15px;font-weight:700;color:#2e7d32;margin:0 0 10px;">If Recommendations Are Implemented — Growth Scenario</h3>${rB.cashFlowProjection.goodScenario.narrative ? `<p style="font-size:13px;color:var(--muted);line-height:1.8;margin:0 0 14px;">${rB.cashFlowProjection.goodScenario.narrative}</p>` : ''}${rB.cashFlowProjection.goodScenario.months?.length ? `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#e8f5e9;">${['Period','Revenue','Net Cash Flow','Action This Month'].map(h=>`<th style="padding:8px 10px;text-align:left;font-weight:700;color:#2e7d32;white-space:nowrap;">${h}</th>`).join('')}</tr></thead><tbody>${rB.cashFlowProjection.goodScenario.months.map((m,i)=>`<tr style="border-top:1px solid var(--border);background:${i%2?'#f9fdf9':'white'};">${[m.month,m.revenue,m.net,m.action].map(v=>`<td style="padding:8px 10px;color:var(--muted);">${v||'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}</div>` : ''}
    ${rB.cashFlowProjection.ownerDrawTimeline ? `<div class="card"><p style="font-size:14px;color:var(--navy);font-weight:600;line-height:1.8;margin:0;">${rB.cashFlowProjection.ownerDrawTimeline}</p></div>` : ''}
  </div>` : ''}

  <!-- CTA -->
  <div class="cta-box">
    <div style="display:inline-block;background:rgba(255,87,87,0.25);border:1px solid rgba(255,120,120,0.5);border-radius:20px;padding:5px 14px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#FFB3B3;margin-bottom:16px;">🔥 Free Until May 1st — Then $899/session</div>
    <h2>Book Your Free Strategy Call</h2>
    <p>${r.closingNote || "This report gives you the full picture. A strategy call with us takes it further \u2014 we'll walk you through exactly what to do first, based on your specific numbers."}</p>

    <!-- Countdown timer -->
    <div id="cta-countdown" style="display:flex;justify-content:center;gap:8px;margin:0 auto 24px;max-width:300px;flex-wrap:wrap;">
      <div style="background:rgba(255,255,255,0.12);border-radius:12px;padding:10px 10px;min-width:62px;text-align:center;">
        <div id="cd-days" style="font-size:26px;font-weight:900;color:#fff;line-height:1;">--</div>
        <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-top:4px;">Days</div>
      </div>
      <div style="background:rgba(255,255,255,0.12);border-radius:12px;padding:10px 10px;min-width:62px;text-align:center;">
        <div id="cd-hours" style="font-size:26px;font-weight:900;color:#fff;line-height:1;">--</div>
        <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-top:4px;">Hours</div>
      </div>
      <div style="background:rgba(255,255,255,0.12);border-radius:12px;padding:10px 10px;min-width:62px;text-align:center;">
        <div id="cd-mins" style="font-size:26px;font-weight:900;color:#fff;line-height:1;">--</div>
        <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-top:4px;">Mins</div>
      </div>
      <div style="background:rgba(255,255,255,0.12);border-radius:12px;padding:10px 10px;min-width:62px;text-align:center;">
        <div id="cd-secs" style="font-size:26px;font-weight:900;color:#fff;line-height:1;">--</div>
        <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-top:4px;">Secs</div>
      </div>
    </div>
    <script>
    (function(){
      var deadline = new Date('2026-05-01T00:00:00').getTime();
      function tick(){
        var now = Date.now(), diff = deadline - now;
        if(diff <= 0){
          document.getElementById('cta-countdown').innerHTML = '<p style="color:#FFB3B3;font-weight:700;font-size:14px;">Free call period has ended. Book at $899/session.</p>';
          return;
        }
        var d=Math.floor(diff/86400000), h=Math.floor((diff%86400000)/3600000), m=Math.floor((diff%3600000)/60000), s=Math.floor((diff%60000)/1000);
        document.getElementById('cd-days').textContent=d;
        document.getElementById('cd-hours').textContent=h<10?'0'+h:h;
        document.getElementById('cd-mins').textContent=m<10?'0'+m:m;
        document.getElementById('cd-secs').textContent=s<10?'0'+s:s;
      }
      tick(); setInterval(tick,1000);
    })();
    </script>

    <a href="https://api.leadconnectorhq.com/widget/booking/bGQ7oVjEW8HdbcQYTTUF" class="cta-btn">📅 Book My Free Strategy Call →</a>
    <p style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:14px;margin-bottom:0;">No obligation. 60 minutes. Real answers based on your numbers. After May 1st: $899/session.</p>
  </div>

</div>

<footer>
  <div style="margin-bottom:4px;"><strong>Nexvora Systems LLC</strong> · nexvorasystems.us · info@nexvorasystems.us · Tampa Bay, FL</div>
  <div>Confidential — Prepared for ${r.ownerFirstName} · © 2026 Nexvora Systems LLC. All rights reserved.</div>
</footer>

</body>
</html>`;
}

async function handleAssessmentReport(req, res) {
  const a = req.body.assessment || {};
  const email    = a.contact?.email || '';
  const name     = a.contact?.name  || 'Business Owner';
  const company  = a.contact?.company || name;
  const city     = a.q2_city || '';
  const state    = a.q2 || '';
  const industry = a.q1b_label || a.q1 || '';
  const isRegen  = !!req.body.reportId;
  const reportId = req.body.reportId || randomId(10);

  console.log(`[generate-report/assessment] Starting for ${company} in ${city},${state} (${reportId})`);

  // Derive specific industry type for more targeted searches
  // IMPORTANT: never assume sub-type (e.g. home-services ≠ cleaning — could be appliance repair, HVAC, etc.)
  const _industryTypeMap = {
    'home-services': 'home services',
    'construction': 'construction contractor',
    'food-bev': 'restaurant food beverage',
    'retail': 'retail store',
    'health-wellness': 'health wellness',
    'professional-services': 'professional services',
    'auto': 'auto repair automotive',
    'real-estate': 'real estate'
  };
  // Use q1b_label (specific sub-industry) if it's specific enough; skip vague "Other X" labels
  const _q1bLabel = (a.q1b_label || '').trim();
  const _q1bIsVague = !_q1bLabel || /^other/i.test(_q1bLabel);
  // Primary industry type: specific label wins, then category map, then raw industry
  const _industryType = (!_q1bIsVague ? _q1bLabel : null) || _industryTypeMap[a.q1] || industry || 'business';
  // For competitor search: when sub-industry is vague, include company name so AI can infer exact type
  const _competitorSearchType = _q1bIsVague && company ? `${company} ${_industryType}` : _industryType;

  // 8 Tavily searches in parallel — targeted, specific, filtered
  const [businessRes, reviewsRes, yelpRes, bbbRes, socialRes, forumsRes, locationsRes, benchmarksRes, competitorRes] = await Promise.all([
    tavilySearch(`"${company}" ${city} ${state} ${_industryType}`, 7),
    tavilySearch(`"${company}" ${city} customer reviews rating`, 7),
    tavilySearch(`"${company}" ${city} site:yelp.com`, 5),
    tavilySearch(`"${company}" ${city} ${state} site:bbb.org`, 5),
    tavilySearch(`"${company}" site:facebook.com OR site:instagram.com OR site:linkedin.com`, 5),
    tavilySearch(`"${company}" ${city} site:reddit.com OR site:nextdoor.com community`, 5),
    tavilySearch(`"${company}" ${state} address locations "service area" OR "we serve" OR "serving" OR website`, 6),
    tavilySearch(`${_industryType} ${city} ${state} small business revenue profit margin benchmark average`, 5),
    tavilySearch(`${_competitorSearchType} competitors top rated ${city} ${state} reviews pricing`, 7),
  ]);

  // Filter results to remove wrong-business matches (e.g. "24 25 carpet" when searching "24 25 cleaners")
  const research = {
    business:   filterForCompany(businessRes,  company),
    reviews:    filterForCompany(reviewsRes,   company),
    yelp:       filterForCompany(yelpRes,      company),
    bbb:        filterForCompany(bbbRes,       company),
    social:     filterForCompany(socialRes,    company),
    forums:     filterForCompany(forumsRes,    company),
    locations:  locationsRes, // skip company filter — location/service-area pages often use abbreviated names
    benchmarks: benchmarksRes, // no company filter — this is industry-level data
  };

  console.log(`[generate-report/assessment] Research done. Writing with GPT-4o (2 parallel calls)…`);

  let reportData, reportDataB;
  try {
    [reportData, reportDataB] = await Promise.all([
      writeAssessmentReport(a, research),
      writeAssessmentReportB(a, research, competitorRes).catch(e => {
        console.error('[generate-report/assessment] Call B failed (non-fatal):', e.message);
        return {};
      })
    ]);
  } catch (e) {
    console.error('[generate-report/assessment] GPT-4o Call A failed:', e.message);
    return res.status(500).json({ error: 'Report generation failed', detail: e.message });
  }

  // Normalize Call B — fix arrays, pre-populate deterministic fields from assessment data
  const _rB = reportDataB || {};
  const _toArr = v => Array.isArray(v) ? v : (typeof v === 'string' && v.trim() ? v.split(/,\s*/).filter(Boolean) : []);

  // SOFTWARE AUDIT — always use actual tool names from assessment, never GPT-generated text as tags
  if (!_rB.softwareAnalysis) _rB.softwareAnalysis = {};
  _rB.softwareAnalysis.currentStack = a.current_software
    ? a.current_software.split(/,\s*/).map(s => s.trim()).filter(Boolean)
    : [];
  _rB.softwareAnalysis.gaps = _toArr(_rB.softwareAnalysis.gaps);

  // PRICING SCENARIOS — always built from pre-computed math, never from GPT text
  // Baseline priority: y0 (current year) → y1 (last full year) → y2 → y3
  const _pRevAnnual = a.q4_parsed?.y0 || a.q4_parsed?.y1 || a.q4_parsed?.y2 || a.q4_parsed?.y3 || 0;
  const _pMo = _pRevAnnual > 0 ? Math.round(_pRevAnnual / 12) : 0;
  const _pBaseYear = new Date().getFullYear();
  const _pBaseLabel = a.q4_parsed?.y0 ? `${_pBaseYear} estimate` : (a.q4_parsed?.y1 ? `${_pBaseYear-1} (last full year)` : (a.q4_parsed?.y2 ? `${_pBaseYear-2}` : (a.q4_parsed?.y3 ? `${_pBaseYear-3}` : null)));
  const _pAvg = Number(a.avg_check||0);
  const _pJobs = _pAvg > 0 && _pMo > 0 ? Math.round(_pMo/_pAvg) : 0;
  const _fmt = n => n >= 0 ? '+$'+Math.abs(n).toLocaleString() : '−$'+Math.abs(n).toLocaleString();
  const _fmtMo = n => '$'+Math.round(n).toLocaleString()+'/mo';
  if (!_rB.pricingStrategy) _rB.pricingStrategy = {};
  _rB.pricingStrategy.scenarios = [
    {
      label: '+1% Price Increase (0% customer loss)',
      priceAdj: '+1%',
      newCheck: '$'+Math.round(_pAvg*1.01),
      revMo: _fmtMo(_pMo*1.01),
      revYr: '$'+Math.round(_pMo*1.01*12).toLocaleString()+'/yr',
      netChangeMo: _fmt(Math.round(_pMo*1.01-_pMo)),
      netChangeYr: _fmt(Math.round((_pMo*1.01-_pMo)*12)),
    },
    {
      label: '+3.5% Price Increase (0% customer loss)',
      priceAdj: '+3.5%',
      newCheck: '$'+Math.round(_pAvg*1.035),
      revMo: _fmtMo(_pMo*1.035),
      revYr: '$'+Math.round(_pMo*1.035*12).toLocaleString()+'/yr',
      netChangeMo: _fmt(Math.round(_pMo*1.035-_pMo)),
      netChangeYr: _fmt(Math.round((_pMo*1.035-_pMo)*12)),
    },
    {
      label: '+10% Price, −3% Job Loss (moderate churn)',
      priceAdj: '+10% / −3% jobs',
      newCheck: '$'+Math.round(_pAvg*1.10),
      revMo: _fmtMo(_pMo*1.10*0.97),
      revYr: '$'+Math.round(_pMo*1.10*0.97*12).toLocaleString()+'/yr',
      netChangeMo: _fmt(Math.round(_pMo*1.10*0.97-_pMo)),
      netChangeYr: _fmt(Math.round((_pMo*1.10*0.97-_pMo)*12)),
    },
    {
      label: '+10% Price, −5% Job Loss (worst case)',
      priceAdj: '+10% / −5% jobs',
      newCheck: '$'+Math.round(_pAvg*1.10),
      revMo: _fmtMo(_pMo*1.10*0.95),
      revYr: '$'+Math.round(_pMo*1.10*0.95*12).toLocaleString()+'/yr',
      netChangeMo: _fmt(Math.round(_pMo*1.10*0.95-_pMo)),
      netChangeYr: _fmt(Math.round((_pMo*1.10*0.95-_pMo)*12)),
    },
  ];

  // Store baseline label and revenue flags so HTML renderer can reference them
  _rB.pricingStrategy.baselineNote = _pBaseLabel && _pMo > 0 ? `Based on ${_pBaseLabel} revenue ($${_pMo.toLocaleString()}/mo)` : '';
  _rB._noRevenue  = _pRevAnnual === 0;
  _rB._lowRevenue = _pRevAnnual > 0 && _pRevAnnual < 10000;

  if (_rB.automationScenarios) _rB.automationScenarios.scenarios = _toArr(_rB.automationScenarios.scenarios);
  if (_rB.systemsAndSOPs) {
    _rB.systemsAndSOPs.prioritySops    = _toArr(_rB.systemsAndSOPs.prioritySops);
    _rB.systemsAndSOPs.toolCategories  = _toArr(_rB.systemsAndSOPs.toolCategories);
  }
  if (!Array.isArray(_rB.riskRegister)) _rB.riskRegister = _toArr(_rB.riskRegister);
  if (_rB.competitiveAnalysis) {
    _rB.competitiveAnalysis.competitors    = _toArr(_rB.competitiveAnalysis.competitors);
    _rB.competitiveAnalysis.differentiators = _toArr(_rB.competitiveAnalysis.differentiators);
  }
  if (_rB.cashFlowProjection) _rB.cashFlowProjection.scenarios = _toArr(_rB.cashFlowProjection.scenarios);

  const html = renderAssessmentHTML(reportData, a, research, _rB);
  await saveReport(reportId, email, html, { company, city, state, industry, primaryPain: a.primaryPain }, a, isRegen);

  console.log(`[generate-report/assessment] Done. Report ID: ${reportId}`);
  return res.json({ success: true, reportId, reportUrl: `${SITE_URL}/r/${reportId}` });
}

// ── Main handler ──────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Route to assessment handler
  if (req.body?.mode === 'assessment') return handleAssessmentReport(req, res);

  const { url, name, email, reportId: existingId } = req.body || {};

  if (!url) return res.status(400).json({ error: 'url required' });
  if (!email) return res.status(400).json({ error: 'email required' });
  if (!name) return res.status(400).json({ error: 'name required' });

  let parsedUrl;
  try { parsedUrl = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url); }
  catch { return res.status(400).json({ error: 'Invalid URL' }); }

  const reportId = existingId || randomId(10);
  const domain   = domainFrom(parsedUrl.href);
  const company  = companyGuess(domain);

  console.log(`[generate-report] Starting for ${domain} (${reportId})`);

  // Run all research in parallel
  const [crawl, psi, overviewRes, reviewsRes, competitorsRes, keywordsRes] = await Promise.all([
    crawlHomepage(parsedUrl.href),
    runPSI(parsedUrl.href),
    tavilySearch(`${company} ${domain} company overview what do they do location`),
    tavilySearch(`"${domain}" OR "${company}" reviews rating google yelp reputation`),
    tavilySearch(`${company} competitors similar companies ${domain.split('.').pop()} industry`),
    tavilySearch(`${company} industry SEO keywords ranking opportunities`),
  ]);

  console.log(`[generate-report] Research complete. Writing report with GPT-4o...`);

  const data = {
    url: parsedUrl.href, domain, company,
    clientName: name, clientEmail: email, reportId,
    crawl, psi,
    research: { overview: overviewRes, reviews: reviewsRes, competitors: competitorsRes, keywords: keywordsRes }
  };

  let reportData;
  try {
    reportData = await writeReport(data);
  } catch (e) {
    console.error('[generate-report] GPT-4o failed:', e.message);
    return res.status(500).json({ error: 'Report generation failed', detail: e.message });
  }

  const html = renderHTML(reportData, data);

  // Save to Supabase (non-blocking)
  saveReport(reportId, email, html, { domain, company: reportData.companyName, scores: psi.mobile });

  console.log(`[generate-report] Done. Report ID: ${reportId}`);
  return res.json({ success: true, reportId, reportUrl: `${SITE_URL}/r/${reportId}` });
};
