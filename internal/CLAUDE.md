# Nexvora — Internal Sales Tools

## What This Folder Is

This folder contains internal Nexvora tools — NOT deployed publicly. These are for internal use: sales prep, client intelligence, proposal building.

---

## client-report-template.html — The Master Template

This is the reusable framework for every new client Nexvora wants to pursue.

**Password:** `Nexvora2026!`

### How to Create a New Client Report

1. **Copy the template:**
   ```
   cp internal/client-report-template.html internal/[clientslug]-intelligence.html
   ```
   Example: `cp internal/client-report-template.html internal/dentalclinic-intelligence.html`

2. **Run research** — spawn 2-3 parallel agents:
   - Agent 1: Web crawl of their website (all pages, services, about, team)
   - Agent 2: Google/LinkedIn/social research on the owner
   - Agent 3: Competitor research in their niche

3. **Fill all [PLACEHOLDERS]** — use Ctrl+F in the HTML file to find every one.
   All placeholders are in `[CAPS_BRACKETS]` format.

4. **Follow the <!-- INSTRUCTION --> comments** — each section has guidance on where to find the data and what to write.

5. **Delete instruction comments** before storing the final version.

6. **Save finished report** in the client's own folder:
   ```
   /Desktop/PRJOECTS/[CLIENTNAME]/[clientslug]-intelligence.html
   ```

---

## Placeholder Reference

| Placeholder | What to fill | Where to find |
|-------------|-------------|----------------|
| `[CLIENT_NAME]` | Full name | LinkedIn, website bio |
| `[CLIENT_TITLE]` | Job title | LinkedIn, website |
| `[CLIENT_COMPANY]` | Company name | Website |
| `[CLIENT_INDUSTRY]` | Industry type | Their services page |
| `[CLIENT_LOCATION]` | City, Province/State | Google Maps, website |
| `[CLIENT_WEBSITE]` | Domain | —  |
| `[CLIENT_EMAIL]` | Work email | Website contact, LinkedIn |
| `[CLIENT_PHONE]` | Work phone | Website contact |
| `[REPORT_DATE]` | Today's date | — |
| `[YEARS_EXPERIENCE]` | Years in field | LinkedIn, bio |
| `[COMPANY_SIZE]` | Employees | LinkedIn, ZoomInfo |
| `[REVIEW_COUNT]` | Google review count | Google Maps |
| `[REVIEW_RATING]` | Star rating | Google Maps |
| `[FOUNDED_YEAR]` | Year founded | LinkedIn, BBB, website footer |
| `[PLATFORM]` | Website platform | BuiltWith.com, Wappalyzer |
| `[CRM_TOOL]` | Their CRM | Job listings, Zoho/HubSpot case studies |
| `[CONTRACT_VALUE_LOW]` | Low estimate | Calculate from service menu |
| `[CONTRACT_VALUE_HIGH]` | High estimate | Calculate from service menu |
| `[PHASE1_PRICE]` | First pitch price | Based on quick-win services |
| `[PHASE2_PRICE]` | Phase 2 price | Based on full build |

---

## Research Agents to Run (Template)

### Agent 1 — Website Crawl
```
Fetch every page of [WEBSITE]. Extract:
- All page URLs from sitemap.xml
- Title tags, meta descriptions (or absence)
- H1, H2 headings on each page
- CTAs (buttons, forms)
- Images (count, alt text presence)
- Blog post count and topics
- robots.txt
- Contact info, team members
- Platform/CMS (check page source or BuiltWith)
```

### Agent 2 — Owner Research
```
Research [OWNER NAME] and [COMPANY NAME] publicly. Find:
- Full bio, credentials, education
- Career history (LinkedIn, press releases)
- Social media: LinkedIn, Twitter, Instagram, Facebook, YouTube
- Podcast/speaking appearances
- Published articles or interviews
- Hobbies mentioned in any bio or interview
- Memberships, awards, associations
- Reviews of them personally on Google/BBB
- Reddit or forum mentions of them or their company
- Any quotes or opinions they've expressed publicly
Note confidence level (100%/90%/80%/50%) for each finding.
```

### Agent 3 — Competitor Research
```
Research the top competitors of [COMPANY] in [INDUSTRY] and [LOCATION].
Find:
- Who are the top 5 competitors?
- What keywords does the industry rank for?
- What do top websites in this space do for UX/CTAs?
- Where does [WEBSITE] rank vs competitors?
- What are clients searching for that [WEBSITE] doesn't address?
```

---

## Services Menu (Standard Nexvora Pricing)

Use these as starting points — adjust per client complexity:

| Service | Price Range |
|---------|------------|
| WordPress/Platform SEO Fix (critical issues) | $1,500–$3,000 |
| CRM Integration (website → CRM) | $800–$2,000 |
| Knowledge Base V1 (structured Q&A) | $2,000–$4,000 |
| Client Intake Assessment System | $4,000–$7,000 |
| Life/Work Automation Package | $3,000–$6,000 |
| Internal Team AI Bot | $3,000–$5,000 |
| Content System (monthly retainer) | $1,500/mo |
| Public AI Chatbot + Paid Funnel | $8,000–$14,000 |
| Full Website Rebuild (Next.js) | $8,000–$15,000 |
| Monthly SEO Retainer | $1,000–$2,000/mo |

---

## Existing Client Reports

| Client | Folder | Intelligence Report | Status |
|--------|--------|--------------------|---------| 
| U.S. Tax IQ (Alexey Manasuev) | /PRJOECTS/USTAXIQ/ | alexey-manasuev-intelligence.html | Complete |

---

## Rules for Every Report

- Only use public information
- Rate every data point with a confidence level (100%/90%/80%/50%)
- Always include "How to Pitch" and "Never Do This" sections
- Always include a full service menu with prices
- Always calculate total contract value potential
- Password: always `Nexvora2026!`
- Never share with the client — internal only
