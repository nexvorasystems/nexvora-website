# Nexvora Systems — Client Audit Reports

## What This Folder Is

This is the client audit report system for Nexvora Systems. Every audit we sell gets its own permanent branded HTML page hosted at:

`nexvorasystems.us/reports/{client-slug}-{year}-{number}`

Example: `nexvorasystems.us/reports/ustaxiq-2026-001`

The URL rewrite rule in `vercel.json` maps clean URLs → `.html` files automatically.

---

## Report Naming Convention

```
{clientname}-{year}-{number}.html

Examples:
  ustaxiq-2026-001.html
  2425cleaners-2026-002.html
  nexvora-client-2026-003.html
```

- `clientname` — lowercase, no spaces, use hyphens
- `year` — 4-digit year
- `number` — 3-digit sequential number (001, 002, 003...)

---

## How to Create a New Report

### Step 1 — Research the Website (Run 3 parallel agents)

**Agent 1 — Full page crawl:**
Fetch every page of the website using WebFetch. Extract:
- All page URLs (from sitemap.xml)
- Title tags, meta descriptions (or absence of them)
- H1, H2, H3 headings
- CTAs (buttons, forms)
- Images (count, alt text presence)
- Navigation structure
- Footer content
- robots.txt
- Blog article count and topics

**Agent 2 — Technical SEO audit:**
Use the `seo-technical` subagent. Check:
- CMS platform, plugins, theme
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Render-blocking scripts (count scripts without defer/async)
- Core Web Vitals signals (lazy loading, image dimensions, font-display)
- Sitemap quality (utility/test pages indexed?)
- Schema markup (LocalBusiness, FAQ, OG tags)
- HTTPS, redirects, canonical tags
- Cloudflare/CDN caching status

**Agent 3 — Competitor + content research:**
Use the `web-search-agent` subagent. Research:
- Who are the top competitors in this niche?
- What keywords does this industry rank for?
- What blog topics rank well in this niche?
- What do top converting websites in this space do for UX/CTA?
- Why do customers leave this type of website?
- What is the market positioning opportunity?

### Step 2 — Build the Report HTML

Copy the structure from `ustaxiq-2026-001.html` as the template. Replace all content.

**Required sections (in order):**
1. Head — GA4 tag, meta/OG tags, noindex, favicon
2. Public notice banner (fixed, above nav)
3. Nav — Nexvora logo + "Audit Report" badge + report date
4. Hero — client site URL, score pills, report metadata
5. About Nexvora Systems — company info block (navy background)
6. Executive Summary — issue counts, strengths, critical problems
7. Technical SEO — infrastructure table, Core Web Vitals, indexability
8. On-Page SEO — meta tags, schema, internal linking
9. Page-by-Page Analysis — every major page individually
10. UI/UX & Why Customers Leave — visitor journey, CTA analysis
11. Content Strategy — blog topics, keyword opportunities
12. Competitor Analysis — direct competitors + positioning table
13. 12-Month Roadmap — 4 phases (Foundation → Content → CRO → Scale)
14. Priority Action Plan — all issues sorted Critical/High/Medium/Low
15. Conclusion — softened targets (no guarantees), download button
16. Footer — Nexvora logo, nexvorasystems.us, email, report ID
17. Email Gate — fullscreen overlay with email authentication

### Step 3 — Email Gate Setup

The gate is at the bottom of the HTML file in the `<!-- EMAIL GATE -->` block.

**ALLOWED emails object:**
```js
const ALLOWED = {
  'info@nexvorasystems.us': 'Nexvora Systems',   // always keep this
  'client@theirdomain.com': 'Client Name'          // add client email here
};
```

- `info@nexvorasystems.us` is ALWAYS included (our internal access)
- Add client email when ready to share with them
- Name shown in welcome bar after login: "✓ Welcome, [Name]"
- Auth stored in sessionStorage (survives page refresh, not tab close)

### Step 4 — Deploy

```bash
cd /Users/muratzhandaurov/Desktop/PRJOECTS/Nexvora/nexvora-wesbite/nexvora-website
vercel --prod
```

No git commit needed. Vercel CLI deploys directly from local files.

---

## Report Content Rules

### What to ALWAYS include
- Real data from actual website crawl (not invented)
- Specific issue counts (exact numbers from audit)
- Specific technical findings (CMS version, plugin names, exact script counts)
- Competitor names with real URLs
- Page-by-page analysis of every major page

### What to NEVER include
- Guaranteed results or specific traffic promises (e.g., "5× traffic")
- Specific percentage improvements as promises
- Language like "you will rank #1" or "guaranteed results"
- Assumptions about the client without evidence (e.g., don't assume languages spoken)
- Specific salary/revenue numbers

### How to frame projections
- Always say "Target Goals" not "Projected Results"
- Always add: "Results depend on implementation speed, market conditions, and algorithm changes. Timeline varies."
- Use "Target: X" not "Will achieve X"
- Say "Significantly higher" not "5× more"

### Tone
- Professional, direct, honest
- Specific — name exact files, plugins, URLs with issues
- Actionable — every issue has a clear fix
- Not salesy — this is an audit, not a pitch deck

---

## Nexvora Systems Branding

**Colors:**
- Navy: `#0F2B4C`
- Teal: `#0D9488`
- Background: `#FAF8F5`
- Text: `#1A1A2E`
- Muted: `#4A5568`
- Border: `#E2DDD5`

**Logo:** `https://nexvorasystems.us/assets/nexvora-logo.png`
- Always use absolute URL (not relative) so it works locally and on Vercel
- Always add `onerror="this.style.display='none'"` so broken image doesn't show

**Footer always shows:**
- Nexvora Systems logo
- nexvorasystems.us
- info@nexvorasystems.us
- Report ID + Audit Date + © Nexvora Systems LLC

**GA4 tag:** `G-TY0PZHVN0L` — add to every new report page

---

## Existing Reports

| Report ID | Client | URL | Status |
|-----------|--------|-----|--------|
| UST-2026-001 | U.S. Tax IQ (ustaxiq.com) | /reports/ustaxiq-2026-001 | Live |

---

## Adding Client Email Access

When client is ready to receive the report:

1. Open the report HTML file
2. Find `const ALLOWED = {`
3. Add their email + name:
   ```js
   'alexey@ustaxiq.com': 'Alexey Manasuev'
   ```
4. Redeploy: `vercel --prod`
5. Send client the link: `nexvorasystems.us/reports/ustaxiq-2026-001`

---

## Score System

Use these categories and severity levels consistently:

| Severity | Color | When to use |
|----------|-------|-------------|
| Critical | Red | Blocks rankings, security vulnerability, major conversion killer |
| High | Orange | Significant SEO/UX impact, fix within 30 days |
| Medium | Yellow | Optimization opportunity, fix within 90 days |
| Low | Blue | Nice to have, backlog |
| Pass | Green | Working correctly, a strength |

**Scoring categories (with weights):**
- Technical SEO (22%)
- Content Quality (23%)
- On-Page SEO (20%)
- Schema / Structured Data (10%)
- Performance / Core Web Vitals (10%)
- AI Search Readiness (10%)
- Images (5%)

---

## Roadmap Structure (Always 4 Phases)

| Phase | Name | Focus |
|-------|------|-------|
| 1 — Months 1–3 | Foundation Fix | Stop the Bleeding — critical technical fixes |
| 2 — Months 4–6 | Content Authority | Own the Keywords — content + on-page SEO |
| 3 — Months 7–9 | Conversion Optimization | Turn Traffic Into Clients — CRO |
| 4 — Months 10–12 | Authority & Scale | Dominate the Niche — backlinks, video, expansion |

Always end roadmap section with "Target Goals" table (not "Projected Results").
Always include disclaimer about results depending on market conditions.
