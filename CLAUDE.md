# Nexvora Website — Claude Context

## Project Overview
Nexvora Systems LLC — Florida-based business consulting company (Tampa Bay).
Website: nexvorasystems.us (hosted on Vercel, repo: nexvorasystems/nexvora-website)
Stack: Vanilla HTML/CSS/JS, Vercel serverless functions (Node.js), Supabase, GHL (GoHighLevel)

---

## Architecture

### Pages
- `index.html` — Homepage
- `assessment.html` — Business Health Assessment (multi-step quiz, 18+ questions)
- `report.html` — Personalized report page (loads from Supabase by `?id=` or base64 `?d=`)
- `contact.html` — Contact form
- `blog.html` — Blog index (cards auto-injected at `<!-- POSTS_START -->`)
- `posts/` — Individual blog post HTML files
- `legal/privacy.html` — Privacy policy
- `services.html` — Main services page (4 flagship service cards, 2-col grid)
- `services/operations-business-systems.html` — Service 01: Operations & Business Systems
- `services/ai-automation.html` — Service 02: AI & Automation
- `services/marketing-leads.html` — Service 03: Marketing & Lead Generation
- `services/web-design.html` — Service 04: Web Design & Digital Presence

### API (Vercel serverless functions)
- `api/ghl.js` — Assessment submission: upserts GHL contact, adds note, creates opportunity, sends email + SMS
- `api/contact.js` — Contact form: upserts GHL contact, adds note, creates opportunity, sends confirmation email
- `api/save-report.js` — Saves assessment payload to Supabase `reports` table, returns 8-char ID
- `api/chat.js` — AI chat (256MB, 30s max duration)

### Short URLs
- `/r/:id` → `/report.html?id=:id` (via Vercel rewrite in `vercel.json`)
- Report loads from Supabase by ID, falls back to base64 `?d=` for old links

---

## Environment Variables (Vercel)
- `GHL_API_KEY` — GoHighLevel API key
- `GHL_LOCATION_ID` — GHL location ID
- `SITE_URL` — https://nexvorasystems.us
- `SUPABASE_URL` — https://ivkfzlxxsqzziqbjplpa.supabase.co
- `SUPABASE_SERVICE_KEY` — Supabase service role key (server-side only)
- `OPENAI_API_KEY` — OpenAI API key (also in GitHub repo secrets for Actions)

---

## Blog Auto-Generation System

### Daily Posts — `scripts/generate-post.js`
Runs via GitHub Actions (`.github/workflows/daily-post.yml`) every day at **6:00 AM PST** (14:00 UTC).

**Service rotation by day of week (mapped to 4 flagship services):**
- Mon: AI & Automation
- Tue: Operations & Business Systems
- Wed: AI & Automation
- Thu: Operations & Business Systems (author: Alexandr Godovanyuk)
- Fri: Marketing & Lead Generation
- Sat: Web Design & Digital Presence
- Sun: Operations & Business Systems

**Note:** Old service names (Reporting & Analytics, Sales Systems, Financial Efficiency, Customer Experience, Growth & Scaling, Team & HR) are replaced. The 4 flagship services are: Operations & Business Systems, AI & Automation, Marketing & Lead Generation, Web Design & Digital Presence.

**Mon/Wed/Fri:** Also generates a bonus AI & Automation post.

**Model:** `gpt-4o-mini` for text, `dall-e-3` for hero images (1792×1024, standard quality).

**Authorship:**
- Sales Systems posts → Alexandr Godovanyuk
- All other posts → Murat Zhandaurov

**Image diversity rotation:** Cycles through 8 combos (white/Asian/Black/Latino × male/female) by day of month. Neutral professional business casual only — no religious symbols, no political symbols, no identifiable group markers. ~50/50 male/female across posts.

**Output:** Post saved to `posts/{slug}.html`, image saved to `assets/blog/{slug}.jpg`, `blog.html` updated.

**GitHub Actions commits:** `posts/`, `blog.html`, `assets/blog/`

---

### AI News Roundup — `scripts/generate-news-post.js`
Runs via GitHub Actions (`.github/workflows/news-roundup.yml`) every **Tuesday and Saturday at 6:30 AM PST** (14:30 UTC).

**Date ranges:**
- Tuesday: covers Sunday + Monday + Tuesday news
- Saturday: covers Wednesday + Thursday + Friday + Saturday news

**RSS sources (no API keys needed):**
- TechCrunch AI: `https://techcrunch.com/category/artificial-intelligence/feed/`
- VentureBeat AI: `https://venturebeat.com/category/ai/feed/`
- The Verge AI: `https://www.theverge.com/rss/ai-artificial-intelligence/index.xml`

**Flow:** Fetch feeds → filter by date → top 10 to GPT-4o-mini → business-focused roundup for FL small business owners → DALL-E 3 image → save post → update blog.html.

**Author:** Always Murat Zhandaurov. Category tag: `AI News`.

---

## GHL Integration
- API: `https://services.leadconnectorhq.com` (version: 2021-07-28)
- Assessment pipeline: "Assessment" pipeline → "Submitted" or first stage
- Contact form pipeline: "Contact Form" pipeline → "New" or first stage
- Email from: `info@nexvorasystems.us` / "Nexvora Systems"
- SMS: requires A2P registration in GHL (Settings → Phone Numbers)

## Supabase
- Project: `ivkfzlxxsqzziqbjplpa`
- Table: `reports` (columns: `id text PK`, `data jsonb`, `created_at timestamptz`)
- Public read key used client-side in `report.html` for fetching by ID

---

## Blog Post HTML Structure
Each post in `posts/` is self-contained HTML with:
- Nav with logo + "Back to Insights" link
- Post meta: tag (service), date, read time
- H1 title
- Author avatar + name
- DALL-E hero image (`<img src="../assets/blog/{slug}.jpg">`)
- Post body (markdown converted to HTML)
- FAQ section: each Q&A in `.faq-item` card with `.faq-q` / `.faq-a`
- CTA block (navy, links to `../assessment.html`)

**FAQ format in prompts:**
```
**Q:** Question text here?
**A:** Answer text here.
```
Regex in `buildHTML` converts this to `.faq-item` divs (single-line match only — avoids greedy capture).

---

## Key Rules & Decisions

### Images
- All images: neutral professional business casual only
- NO religious symbols, NO political content, NO revealing clothing
- 50/50 male/female balance across posts
- Equal ethnic diversity: white / Asian / Black / Latino (~25% each)
- DALL-E prompt includes: `"no religious symbols, no political symbols, no text on screen"`

### Content
- Never show raw metadata (Title:, Slug:, Meta Title:) in post body — `buildHTML` strips everything before first `## `
- SEO block (10 SEO keywords, social media excerpt, etc.) stripped from body
- Assessment CTA links filtered from body (template has its own CTA block)

### Authors
- Murat Zhandaurov — all topics except Sales Systems
- Alexandr Godovanyuk — Sales Systems only

### DNS / Hosting
- Domain: nexvorasystems.us (Hostinger nameservers → ns1/ns2.vercel-dns.com)
- Vercel project: nexvora-website

### Google Analytics — ALWAYS ADD TO NEW PAGES
- GA4 Measurement ID: `G-TY0PZHVN0L`
- Every new HTML page must include this tag immediately after `<meta charset="UTF-8"/>`:
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TY0PZHVN0L"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-TY0PZHVN0L');
</script>
```
- Blog post templates already have it baked in (generate-post.js, generate-news-post.js)

---

---

## Assessment System (`assessment.html`)

### Flow Overview
Multi-step conversational quiz (~28 steps). Key field saved to `A.*` object, sent to `/api/generate-report` on completion.

### Solo vs Team Gating (`_isSolo = A.q5 === 'solo'`)
When owner selects solo in Q5, the following questions are **skipped or rephrased**:

| Question | Solo behavior |
|----------|--------------|
| Q11 text | "What do **you** handle manually?" (not "your team") |
| Q11 payroll chip | Shows "Contractor payments" instead of "Payroll processing" |
| Q11b text | "Track **your own** tasks?" (not "your team's") |
| Q12 team performance | **Skipped entirely** (`A.q12 = null`) |
| Behind on payroll | **Skipped** — only shown for non-solo when `_cfNet < 0` |
| Team salary questions | **Skipped** — replaced with solo contractor gate |

### Solo Contractor Gate (added after team block)
Solo owners get asked: "Do you hire contractors or part-time help?"
- **Yes** → simplified: count + avg pay → stored in `A.q19_segments['contractors']`
- **No** → `A.q19_solo_only = true` set, all team sections skipped

### Revenue Question
Multi-year entry: y0 (oldest, 3 years ago) → y1 → y2 (last full year) → y3 (current year estimate).
Stored as `A.q4_years` (strings) and `A.q4_parsed` (numbers).

### `_isSolo` scope
Defined at Q11 section, valid for all subsequent questions in the same `runAssessment()` function.

---

## Report Generation (`api/generate-report.js`)

### Architecture
Two parallel GPT-4o calls (Promise.all):
- **Call A** (`writeAssessmentReport`) — executive summary, growth opportunities, owner health, financials, capacity, marketing
- **Call B** (`writeAssessmentReportB`) — 7 deep sections: Technology Audit, Pricing Strategy, AI Bot Opportunities, SOPs & Systems Roadmap, Risk Register, Competitive Landscape, 180-Day Cash Flow Projection

### Revenue Baseline Priority (ALL THREE LOCATIONS must match)
```
y3 (current year estimate) → y2 (last full year) → y1 → y0 → 0
```
- Call A: `annualRevEst = r3 || r2 || r1 || r0 || 0` (line ~691)
- Call B: `annualRev = r3 || r2 || r1 || r0 || 0` (line ~1021)
- Normalization: `_pRevAnnual = y3 || y2 || y1 || y0 || 0` (line ~2257)

Baseline label shown in pricing table: "Based on 2026 estimate ($100k/mo)" or "Based on 2025 (last full year)".

### Year Mapping
- y0 = `_cy - 3` = 2023 (oldest)
- y1 = `_cy - 2` = 2024
- y2 = `_cy - 1` = 2025 (last full year)
- y3 = `_cy` = 2026 (current, partial/estimated — do NOT call it a confirmed decline)

### Key Formulas
```
monthlyRevEst    = annualRevEst / 12
expPctRaw        = sum(expense_breakdown values) / 100
  → expense_breakdown.staff = FIELD CONTRACTORS ONLY (not back-office)
backOfficeMo     = sum(non-field segments × count × pay_with_tax)
  → field types excluded: ['field','contractors','field-contractors']
allDraws         = ownerMo + partnerMo
monthlyNet       = mo × (1 - expPctRaw) - allDraws - backOfficeMo
breakEvenMo      = ceil((allDraws + backOfficeMo) / (1 - expPctRaw) / 100) × 100
estCustomers     = monthlyRevEst / avgCheck
costPerLead      = adSpend / leadsPerMonth
closeRate        = q9_close ?? 10  (default 10% if not tracked)
costPerCustomer  = costPerLead / (closeRate / 100)
suggestedAdBudget = annualRevEst × 0.08 / 12
```

### Pricing Scenarios (normalization block)
All built from pre-computed math — NEVER from GPT text. Use direct revenue multiplication (no double-rounding):
- +1%: `_pMo × 1.01`
- +3.5%: `_pMo × 1.035`
- +10% / −3% jobs: `_pMo × 1.10 × 0.97`  ← use this, not `Math.round(jobs×0.97)×price×1.10`
- +10% / −5% jobs: `_pMo × 1.10 × 0.95`

### Revenue Guards
- `_noRevenue = annualRevEst === 0` → skip all financial formulas, show warning
- `_lowRevenue = annualRevEst > 0 && annualRevEst < 10000` → show accuracy warning

### Solo Flag in Report
`A.q19_solo_only = true` → both Call A and Call B prompts told:
- "SOLO OPERATOR — no employees or contractors. Skip team/hiring/delegation recommendations."

### No-Brand Rule
NEVER suggest brand names in report. Never suggest tools the client already uses (check `current_software`). Both Call A and Call B prompts enforce this.

### Section Headers (CSS)
All section headers use: `<div class="section-label">CATEGORY</div><div class="section-title">Title</div>`
Never use emoji as section headers.

### pay_with_tax
User enters FULL cost including employer taxes — never auto-add 10% or any multiplier. `pay_with_tax` = exactly what user typed.

---

## Supabase Tables

### `generated_reports`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | 8-char random ID |
| `email` | text | client email |
| `html` | text | full rendered HTML |
| `meta` | jsonb | `{company, city, state, industry, primaryPain}` |
| `assessment` | jsonb | **full assessment answers** (added Apr 2026) — use this to re-run reports, never manually recreate |
| `created_at` | timestamptz | |

### Report URL
`nexvorasystems.us/r/{id}` → email-gated (user enters email to unlock)

---

## Scripts
- `scripts/generate-post.js` — Daily blog post generator
- `scripts/generate-news-post.js` — Tue/Sat AI news roundup
- `scripts/fix-all-posts.js` — One-time bulk fix script (add images, fix FAQ CSS, remove metadata leaks)

## GitHub Actions
- `.github/workflows/daily-post.yml` — 6:00 AM PST daily, generates 1-2 posts
- `.github/workflows/news-roundup.yml` — 6:30 AM PST Tue+Sat, generates news roundup
