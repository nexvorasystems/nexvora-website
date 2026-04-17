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

async function tavilySearch(query, maxResults = 5) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ query, max_results: maxResults, search_depth: 'advanced', include_answer: true }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined
    });
    if (!res.ok) return null;
    const json = await res.json();
    return {
      answer: json.answer || '',
      results: (json.results || []).map(r => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 400) }))
    };
  } catch (e) {
    console.warn('[tavily] Failed:', e.message);
    return null;
  }
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
<link rel="icon" href="${SITE_URL}/assets/nexvora-logo.png"/>
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
}
</style>
</head>
<body>

<div class="pub-banner">🔒 Confidential — Prepared exclusively for <strong>${data.clientName}</strong> by Nexvora Systems</div>

<nav>
  <img src="${SITE_URL}/assets/Logo no background.png" alt="Nexvora Systems" style="height:36px;" onerror="this.style.display='none'"/>
  <span class="nav-badge">Website Audit Report</span>
  <span class="nav-date">${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
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
        <img src="${SITE_URL}/assets/Logo no background.png" alt="Nexvora Systems" style="height:32px;" onerror="this.style.display='none'"/>
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
  <img src="${SITE_URL}/assets/Logo no background.png" alt="Nexvora Systems" style="height:32px;margin-bottom:10px;display:block;margin-left:auto;margin-right:auto;" onerror="this.style.display='none'"/>
  <div style="margin-bottom:4px;"><strong>Nexvora Systems LLC</strong> · nexvorasystems.us · info@nexvorasystems.us</div>
  <div>Report ID: ${data.reportId} · Prepared for ${data.clientName} · © 2026 Nexvora Systems LLC. All rights reserved.</div>
</footer>

</body>
</html>`;
}

// ── 6. Save to Supabase ───────────────────────────────────────────────────────

async function saveReport(reportId, clientEmail, html, meta) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/generated_reports`, {
      method: 'POST',
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ id: reportId, email: clientEmail, html, meta, created_at: new Date().toISOString() })
    });
  } catch (e) { console.warn('[save] Failed:', e.message); }
}

// ── 7. Assessment mode ────────────────────────────────────────────────────────

async function writeAssessmentReport(a, research) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');

  const PAIN_LABELS = {cashflow:'Cash Flow',systems:'Operational Systems','owner-dep':'Owner Dependency',team:'Team & Retention',operations:'Capacity & Operations',growth:'Growth Plateau',survival:'Business Survival',healthy:'Well-Positioned'};
  const REV_LABELS = {lt50k:'Under $50K','50k-150k':'$50K–$150K','150k-300k':'$150K–$300K','300k-500k':'$300K–$500K','500k-750k':'$500K–$750K','750k-1.5m':'$750K–$1.5M','1.5m-3m':'$1.5M–$3M',gt3m:'$3M+',unknown:'Not provided'};
  const SIZE_LABELS = {solo:'Solo owner','2-5':'2–5 people','6-15':'6–15 people','16-30':'16–30 people','30plus':'30+ people'};

  const prompt = `You are a senior business consultant at Nexvora Systems writing a personalized business health assessment report. Be direct, specific, and use the owner's REAL data — never make up facts. Reference their actual answers throughout. Use plain, confident language — no corporate fluff.

OWNER: ${a.contact?.name || 'Business Owner'}
BUSINESS: ${a.contact?.company || 'Their business'} — ${a.q1b_label || a.q1} in ${a.q2_city || ''}, ${a.q2 || ''}
YEARS IN BUSINESS: ${a.q3}
REVENUE: Last year ${a.q4_lastyear||'not provided'} / This year ${a.q4_thisyear||'not provided'} / Goal ${a.q4_goal||'not provided'}
TEAM SIZE: ${SIZE_LABELS[a.q5]||a.q5}
PRIMARY PAIN POINT DIAGNOSED: ${PAIN_LABELS[a.primaryPain]||a.primaryPain}
Pain votes breakdown: ${JSON.stringify(a.painVotes||{})}

PAIN POINT ANSWERS:
- 50% more customers tomorrow → breaks: ${a.pain1}
- End-of-day feeling: ${a.pain2}
- Vacation blocker: ${a.pain3}

OPERATIONS:
- SOPs/processes: ${(a.q6||[]).join(', ')}
- SOP scenario (2-week absence): ${a.q6_scenario||'not asked'}
- Repeat customers: ${a.q7}
- Lead follow-up system: ${a.q8}
- Lead sources: ${(a.q9||[]).join(', ')}
- Ad spend: ${a.q9_adspend ? '$'+a.q9_adspend+'/mo' : 'N/A'}
- Leads from ads: ${a.q9_leads||'not tracked'}
- Closing rate: ${a.q9_close ? a.q9_close+'%' : 'not tracked'}
- Online review rating: ${a.q10||'not provided'}
- Manual tasks: ${(a.q11||[]).join(', ')}
- Task management tool: ${a.q11b||'N/A'}
- Follow-up tracking: ${a.q11c||'N/A'}
- Team performance management: ${(a.q12||[]).join(', ')}
- Financial review frequency: ${a.q13}
- KPI dashboard: ${a.q14}

GOALS:
- 12-month: ${a.q15}
- 5-year: ${a.q15b}
- Biggest pain in their words: "${a.q_pain||'(skipped)'}"

OWNER ECONOMICS:
- Monthly salary: $${a.q16||0}
- Hours/week: ${a.q17||0}
- Work slots: ${JSON.stringify(a.q17_slots||{})}
- Team payroll: $${a.q19_total||0}/mo (${a.q19_headcount||0} people)

WHAT WE FOUND ONLINE:
Business search: ${research.business?.answer||'No data found'}
Reviews/reputation: ${research.reviews?.answer||'No data found'}
Social/LinkedIn: ${research.social?.answer||'No data found'}
Industry benchmarks: ${research.benchmarks?.answer||'No data found'}

Return ONLY valid JSON with these exact keys:

{
  "ownerFirstName": "string",
  "businessName": "string",
  "industry": "string",
  "location": "string — City, State",
  "primaryPainLabel": "string — human-readable label for their #1 pain",
  "painDiagnosis": "string — 2-3 sentences explaining exactly what pain point we diagnosed and why, using their specific answers as evidence",
  "executiveSummary": "string — 3-4 sentences: what they're doing well, their single biggest risk, and what to focus on first. Use their real data.",
  "onlinePresence": "string — what we found: reviews, social media, online reputation. Be specific about what was/wasn't found.",
  "industryBenchmark": "string — 2-3 sentences comparing their situation to real industry benchmarks for their specific business type and location. Use the research data.",
  "keyStrengths": ["string x3 — specific to their answers, not generic"],
  "criticalGaps": ["string x3 — specific problems found, each referencing their actual data"],
  "ownerEconomics": "string — analyze their hours vs salary. Calculate and show their effective hourly rate. Be direct about what this means.",
  "revenueAnalysis": "string — analyze their revenue data (last year/this year/goal). Show growth rate if calculable. Compare to industry. Direct.",
  "operationsScore": "string — 1-10 score with one sentence explanation, based on SOPs, tools, follow-up tracking",
  "marketingScore": "string — 1-10 score with one sentence, based on lead sources, closing rate, follow-up system",
  "teamScore": "string — 1-10 score with one sentence, based on team size, management, retention",
  "financialScore": "string — 1-10 score with one sentence, based on review frequency, dashboard, self-pay",
  "top3Actions": [
    {"title":"string","why":"string — 1 sentence on why this is #1 priority for THEM specifically","how":"string — 2-3 concrete first steps","impact":"string — what changes when they do this"}
  ],
  "90dayPlan": "string — specific 90-day action plan broken into 3 phases of 30 days each. Reference their actual situation.",
  "closingNote": "string — 2 sentences. Direct, personal, from Murat and Alexandr. Not generic."
}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 3500,
      response_format: { type: 'json_object' }
    })
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return JSON.parse(json.choices[0].message.content);
}

function renderAssessmentHTML(r, a, research) {
  const scoreColor = n => { const v=parseInt(n); return v>=7?'#10B981':v>=5?'#F59E0B':'#EF4444'; };
  const scoreNum   = s => parseInt((s||'').match(/\d+/)?.[0])||0;
  const PAIN_ICONS = {cashflow:'💰','owner-dep':'🔗',systems:'⚙️',team:'👥',operations:'🚀',growth:'📈',survival:'⚠️',healthy:'✅'};
  const icon = PAIN_ICONS[a.primaryPain]||'🔍';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${r.businessName} — Business Assessment | Nexvora Systems</title>
<meta name="robots" content="noindex"/>
<link rel="icon" href="${SITE_URL}/assets/nexvora-logo.png"/>
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
@media(max-width:640px){.score-grid{gap:8px;}.score-box{min-width:80px;padding:12px 10px;}.scorecard{grid-template-columns:1fr;}.intel-grid{grid-template-columns:1fr;}.phase-grid{grid-template-columns:1fr;}.hero{padding:40px 20px 32px;}.card{padding:20px;}}
</style>
</head>
<body>
<div class="banner">🔒 Confidential — Prepared for <strong>${r.ownerFirstName}</strong> by Nexvora Systems</div>
<nav>
  <img src="${SITE_URL}/assets/Logo no background.png" alt="Nexvora Systems" style="height:36px;" onerror="this.style.display='none'"/>
  <span class="nav-badge">Business Assessment Report</span>
  <span class="nav-date">${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
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
        <img src="${SITE_URL}/assets/Logo no background.png" alt="Nexvora Systems" style="height:32px;" onerror="this.style.display='none'"/>
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
      </div>
      ${research.reviews?.results?.length ? `<div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border);"><div style="font-size:11px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Sources Found</div><div style="display:flex;flex-direction:column;gap:6px;">${(research.reviews.results||[]).slice(0,3).map(r2=>`<a href="${r2.url}" target="_blank" style="font-size:12px;color:var(--dim);text-decoration:none;">→ ${r2.title}</a>`).join('')}</div></div>` : ''}
    </div>
  </div>

  <!-- SCORECARD -->
  <div class="section">
    <div class="sec-label">Business Scorecard</div>
    <div class="sec-title">4 Core Areas</div>
    <div class="scorecard">
      ${[['Operations',r.operationsScore],['Marketing & Sales',r.marketingScore],['Team & People',r.teamScore],['Financial Health',r.financialScore]].map(([label,score])=>{
        const n=scoreNum(score); return `<div class="sc-item"><div class="sc-score" style="color:${scoreColor(n)}">${n}<span style="font-size:14px;color:var(--dim);">/10</span></div><div class="sc-label">${label}</div><div class="sc-note">${score.replace(/^\d+\/\d+\s*[-–—]?\s*/,'')}</div></div>`;
      }).join('')}
    </div>
  </div>

  <!-- OWNER ECONOMICS -->
  <div class="section">
    <div class="sec-label">Owner Economics</div>
    <div class="sec-title">The Numbers Behind the Business</div>
    <div class="card"><p style="color:var(--muted);font-size:14px;line-height:1.85;">${r.ownerEconomics}</p></div>
    ${r.revenueAnalysis ? `<div class="card"><div style="font-size:11px;font-weight:800;color:var(--teal);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Revenue Analysis</div><p style="color:var(--muted);font-size:14px;line-height:1.85;">${r.revenueAnalysis}</p></div>` : ''}
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

  <!-- 90-DAY PLAN -->
  <div class="section">
    <div class="sec-label">Action Plan</div>
    <div class="sec-title">Your Next 90 Days</div>
    <div class="card"><p style="color:var(--muted);font-size:14px;line-height:1.9;white-space:pre-line;">${r['90dayPlan']}</p></div>
  </div>

  <!-- CTA -->
  <div class="cta-box">
    <h2>Let's Talk About Your Next Step</h2>
    <p>${r.closingNote || 'This report gives you the full picture. A strategy call with us takes it further — we\\'ll walk you through exactly what to do first, based on your specific numbers.'}</p>
    <a href="${SITE_URL}/contact" class="cta-btn">Book a Free Strategy Call →</a>
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
  const reportId = randomId(10);

  console.log(`[generate-report/assessment] Starting for ${company} in ${city},${state} (${reportId})`);

  // 4 Tavily searches in parallel
  const [businessRes, reviewsRes, socialRes, benchmarksRes] = await Promise.all([
    tavilySearch(`"${company}" ${city} ${state} business`),
    tavilySearch(`"${company}" ${city} reviews rating google yelp`),
    tavilySearch(`"${company}" ${city} site:linkedin.com OR site:instagram.com OR site:facebook.com`),
    tavilySearch(`${industry} small business ${city} ${state} average revenue benchmark statistics`),
  ]);

  const research = { business:businessRes, reviews:reviewsRes, social:socialRes, benchmarks:benchmarksRes };

  console.log(`[generate-report/assessment] Research done. Writing with GPT-4o…`);

  let reportData;
  try {
    reportData = await writeAssessmentReport(a, research);
  } catch (e) {
    console.error('[generate-report/assessment] GPT-4o failed:', e.message);
    return res.status(500).json({ error: 'Report generation failed', detail: e.message });
  }

  const html = renderAssessmentHTML(reportData, a, research);
  saveReport(reportId, email, html, { company, city, state, industry, primaryPain: a.primaryPain });

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
