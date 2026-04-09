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

**Service rotation by day of week:**
- Mon: AI & Automation
- Tue: Operations
- Wed: Reporting & Analytics
- Thu: Sales Systems (author: Alexandr Godovanyuk)
- Fri: Marketing
- Sat: Financial Efficiency
- Sun: Operations

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

## Scripts
- `scripts/generate-post.js` — Daily blog post generator
- `scripts/generate-news-post.js` — Tue/Sat AI news roundup
- `scripts/fix-all-posts.js` — One-time bulk fix script (add images, fix FAQ CSS, remove metadata leaks)

## GitHub Actions
- `.github/workflows/daily-post.yml` — 6:00 AM PST daily, generates 1-2 posts
- `.github/workflows/news-roundup.yml` — 6:30 AM PST Tue+Sat, generates news roundup
