# Assessment Redesign — Full Spec

## Goal

Replace the current free-form AI chat assessment with a structured 19-question flow (chips + number inputs) that produces a full-page professional report including industry benchmarks, survival statistics, owner economics calculation, area-by-area business analysis, and a complimentary strategy call offer.

---

## Overview

**What exists today:** A chat-style assessment where an AI (Nex) has a free-form conversation with the user, then generates a small card report with 9 bar scores and 3 bullet recommendations. The whole report lives inside the chat window.

**What we are building:** A structured step-by-step assessment (one question at a time, chip selectors + number inputs) followed by a full separate report page that feels like a real professional document. The report includes industry benchmarks pulled from static data, a calculation of the owner's effective hourly rate vs. their team, and a deep analysis of every underperforming area with specific reasoning and 3 fix paths each.

---

## Flow

```
Contact Info → 19 Questions → AI summary generation → Full Report Page
```

### Step 0 — Contact Info (4 fields)
Collected before any questions. Required fields gated — cannot proceed without them.

| Field | Type | Required |
|---|---|---|
| Full name | Text input | Yes |
| Email address | Email input | Yes |
| Phone number | Tel input | Yes |
| Company name | Text input | No (optional) |

### Step 1–5 — Profile Questions
Sets up benchmark data. Must be answered before diagnostic questions.

| # | Question | Input Type | Options |
|---|---|---|---|
| Q1 | What industry is your business in? | Single chip | Home Services / Construction & Contractors / Food & Beverage / Retail / Health & Wellness / Professional Services / Auto Services / Real Estate |
| Q2 | What state is your business based in? | Single chip (scrollable grid) | All 50 US states |
| Q3 | How long has your business been operating? | Single chip | Less than 1 year / 1–2 years / 3–5 years / 6–10 years / 10+ years |
| Q4 | What is your approximate annual revenue? | Single chip | Under $100K / $100K–$300K / $300K–$750K / $750K–$2M / Over $2M |
| Q5 | How many people work in your business (including you)? | Single chip | Just me / 2–5 / 6–15 / 16–30 / 30+ |

### Step 6–15 — Diagnostic Questions
Each question maps directly to one of 9 scored business areas.

| # | Area | Question | Input Type | Options |
|---|---|---|---|---|
| Q6 | Operations | Do you have documented processes for how your business runs? | Single chip | Nothing documented / Key steps only in my head / Some basic notes / Written SOPs exist / Full SOPs + trained team |
| Q7 | Customer Experience (part 1 of 2) | What percentage of your revenue comes from repeat customers? | Number input (0–100%) | Free number entry |
| Q8 | Sales | What happens after someone shows interest but doesn't buy immediately? | Single chip | Nothing — they go cold / I follow up manually sometimes / I have a set follow-up process / Automated follow-up system |
| Q9 | Marketing | How do most new customers find you? | Single chip | Word of mouth / Google search / Social media / Paid ads / Other |
| Q10 | Customer Experience | What is your average online review rating? | Single chip | No reviews yet / 1–3 stars / 3–4 stars / 4–4.5 stars / 4.5–5 stars |
| Q11 | AI & Automation | Which tasks does your team still do manually every week? | Multi-select chip | Scheduling / Invoicing / Customer follow-up / Reporting / Data entry / None — mostly automated |
| Q12 | Team & HR | How do you manage team performance? | Single chip | No formal process / Informal check-ins / Regular 1-on-1s / KPIs and tracking / Formal reviews + accountability system |
| Q13 | Financial | How often do you review your business financials? | Single chip | Rarely or never / At tax time only / Quarterly / Monthly / Weekly |
| Q14 | Reporting | Do you track key business numbers in a dashboard or regular report? | Single chip | No tracking / I check occasionally / Basic spreadsheet / Software dashboard / Real-time automated reporting |
| Q15 | Growth | What is your primary goal for the next 12 months? | Single chip | Survive and stabilize / Increase revenue / Reduce owner dependency / Build a team / Automate and scale / Exit or sell |

### Step 16–19 — Owner Economics Questions
Powers the owner hourly rate vs. team comparison.

| # | Question | Input Type | Options |
|---|---|---|---|
| Q16 | How much do you pay yourself per month? | Single chip | $0 (not paying myself) / Under $3,000 / $3,000–$5,000 / $5,000–$8,000 / $8,000–$12,000 / Over $12,000 |
| Q17 | How many hours per week do you personally work in the business? | Number input | Free number entry (validated 1–120) |
| Q18 | When do you typically work? | Multi-select chip | Regular daytime hours (8hrs/day) / Early mornings before 7am (+2 hrs/day) / Evenings after 6pm (+4 hrs/day) / Weekends (+10 hrs/weekend) |
| Q19 | What do your team members earn on average per month? | Single chip | Under $2,000 / $2,000–$3,000 / $3,000–$4,000 / $4,000–$5,000 / Over $5,000 |

---

## Scoring Logic

Each of the 9 areas receives a score 0–100 based on the answer to its diagnostic question. The scoring maps as follows (lower option = lower score):

**Operations (Q6):**
- Nothing documented → 10
- In my head → 25
- Basic notes → 50
- Written SOPs → 75
- Full SOPs + trained → 95

**Customer Experience score = average of Q7 score + Q10 score (both questions feed this one area).**

**Customer Experience — Q7 (repeat customer %):**
- 0–10% → 15
- 11–25% → 35
- 26–40% → 55
- 41–60% → 70
- 61–80% → 85
- 81–100% → 95

**Sales (Q8):**
- Nothing → 10
- Manual sometimes → 30
- Set process → 65
- Automated → 90

**Marketing (Q9):**
- Word of mouth only → 30
- Google search → 60
- Social media → 55
- Paid ads → 70
- Other → 40

**Customer Experience (Q10 — reviews):**
- No reviews → 20
- 1–3 stars → 15
- 3–4 stars → 45
- 4–4.5 stars → 70
- 4.5–5 stars → 90

**AI & Automation (Q11 — manual tasks count):**
- 5 manual tasks → 10
- 4 tasks → 25
- 3 tasks → 40
- 2 tasks → 60
- 1 task → 75
- None → 95

**Team & HR (Q12):**
- No process → 10
- Informal check-ins → 30
- Regular 1-on-1s → 55
- KPIs and tracking → 75
- Formal reviews → 95

**Financial (Q13):**
- Rarely → 10
- Tax time only → 25
- Quarterly → 50
- Monthly → 75
- Weekly → 95

**Reporting (Q14):**
- No tracking → 10
- Occasionally → 25
- Spreadsheet → 50
- Software dashboard → 75
- Real-time automated → 95

**Growth (Q15) — not scored independently, used to personalize recommendations.**

**Overall score:** Average of all 9 area scores, rounded to nearest integer.

**Score thresholds:**
- 70–100 → Strong (green) — shown with positive note, no deep analysis
- 45–69 → Needs Work (yellow) — shown with analysis and fix paths
- 0–44 → Fix First (red) — shown with urgent analysis and 3 fix paths

---

## Owner Economics Calculation

### Inputs
- `owner_monthly_pay`: mid-point value from Q16 chip selection
- `owner_weekly_hours`: number from Q17
- `time_slots`: multi-select from Q18 (used for context display, not calculation — Q17 number is the source of truth)
- `team_monthly_pay`: mid-point value from Q19

### Mid-point values
| Q16 chip | Value used |
|---|---|
| $0 | 0 |
| Under $3,000 | 1500 |
| $3,000–$5,000 | 4000 |
| $5,000–$8,000 | 6500 |
| $8,000–$12,000 | 10000 |
| Over $12,000 | 13000 |

| Q19 chip | Value used |
|---|---|
| Under $2,000 | 1500 |
| $2,000–$3,000 | 2500 |
| $3,000–$4,000 | 3500 |
| $4,000–$5,000 | 4500 |
| Over $5,000 | 5500 |

### Calculation
```
owner_monthly_hours = owner_weekly_hours × 4.33
owner_hourly_rate = owner_monthly_pay / owner_monthly_hours

team_assumed_weekly_hours = 45
team_monthly_hours = 45 × 4.33 = 194.85
team_hourly_rate = team_monthly_pay / team_monthly_hours

hourly_difference_pct = ((team_hourly_rate - owner_hourly_rate) / owner_hourly_rate) × 100
```

### Display rules
- If `owner_monthly_pay === 0`: show message "You are currently not paying yourself. Every hour you work is costing you money with no return on your own time."
- If `team_hourly_rate > owner_hourly_rate`: show "Your team earns X% more per hour than you do — with zero risk, zero liability, and no weekends."
- If `owner_hourly_rate > team_hourly_rate`: show "You earn X% more per hour than your team — but you are also carrying 100% of the risk, the liability, and the late nights. The question is whether that premium reflects what your time and risk are actually worth."
- If rates are within 10% of each other: show "You and your team earn approximately the same per hour — but you carry all the risk. Let that sink in."

Always end with: *"We are not here to tell you that you are overpaying your team or underpaying yourself. This is just the math. And this math is exactly why building the right systems is not a nice-to-have — it is the only way to change the equation."*

---

## Industry Benchmark Data

Static JSON embedded in the report page. One record per industry.

**Data points per industry:**
- `5yr_failure_rate`: % of businesses that close within 5 years
- `avg_revenue_by_size`: revenue ranges by employee count
- `avg_net_margin`: average net profit margin
- `survival_message`: motivational line for businesses past year 2/3/5

**Source basis:** US SBA data, BLS, Census Bureau industry averages (2022–2024 figures, hardcoded).

```json
{
  "home-services": {
    "5yr_failure_rate": 82,
    "avg_revenue": { "solo": 85000, "2-5": 220000, "6-15": 380000, "16-30": 750000, "30+": 1500000 },
    "avg_net_margin": 12,
    "survival_note": "Only 18% of home services businesses survive past year 5. You are in that 18%."
  },
  "construction": {
    "5yr_failure_rate": 78,
    "avg_revenue": { "solo": 120000, "2-5": 380000, "6-15": 850000, "16-30": 2200000, "30+": 5000000 },
    "avg_net_margin": 8,
    "survival_note": "Construction has one of the highest early-closure rates of any industry. You are still here."
  },
  "food-bev": {
    "5yr_failure_rate": 83,
    "avg_revenue": { "solo": 200000, "2-5": 450000, "6-15": 900000, "16-30": 1800000, "30+": 4000000 },
    "avg_net_margin": 5,
    "survival_note": "Restaurant survival past year 5 is rarer than most people think. You have done something most cannot."
  },
  "retail": {
    "5yr_failure_rate": 80,
    "avg_revenue": { "solo": 150000, "2-5": 400000, "6-15": 950000, "16-30": 2500000, "30+": 6000000 },
    "avg_net_margin": 7,
    "survival_note": "Retail closures outpace most industries. Lasting this long means you have found something that works."
  },
  "health-wellness": {
    "5yr_failure_rate": 75,
    "avg_revenue": { "solo": 95000, "2-5": 280000, "6-15": 620000, "16-30": 1400000, "30+": 3500000 },
    "avg_net_margin": 15,
    "survival_note": "Health and wellness is competitive but rewarding for those who build loyal clientele. You are proving that."
  },
  "professional-services": {
    "5yr_failure_rate": 68,
    "avg_revenue": { "solo": 180000, "2-5": 480000, "6-15": 1100000, "16-30": 2800000, "30+": 7000000 },
    "avg_net_margin": 22,
    "survival_note": "Professional services firms that survive past year 3 tend to have strong retention. You are building something lasting."
  },
  "auto": {
    "5yr_failure_rate": 76,
    "avg_revenue": { "solo": 140000, "2-5": 350000, "6-15": 780000, "16-30": 1600000, "30+": 3800000 },
    "avg_net_margin": 11,
    "survival_note": "Auto services is relationship-driven. Businesses that survive are the ones their community trusts."
  },
  "real-estate": {
    "5yr_failure_rate": 71,
    "avg_revenue": { "solo": 90000, "2-5": 320000, "6-15": 750000, "16-30": 2000000, "30+": 5500000 },
    "avg_net_margin": 18,
    "survival_note": "Most real estate businesses stall or close when the market shifts. You have adapted and kept going."
  }
}
```

---

## Report Page Structure

File: `report.html` (or `/report` route)
The assessment passes data to this page via localStorage.

### Section 1 — Header
- Nexvora logo + "Business Health Report" title
- Business name, state, industry, years, team size
- Three summary badges: Overall Score / Industry Ranking / Priority Areas count
- Dark navy gradient background

### Section 2 — Industry Benchmarks
- 3 stat boxes: 5-year failure rate, avg revenue for their size, avg net margin
- Each box has benchmark number + one-line personal comparison
- Motivational blockquote (AI-generated, 2–3 sentences)

### Section 3 — Owner Economics
- Two side-by-side cards: Owner $/hr vs Team $/hr
- Hours context (what time slots they work)
- Comparison statement (% difference)
- Closing paragraph ("this is just the math")
- Only shown if Q16–Q19 were answered

### Section 4 — Full Area Analysis
- All 9 areas listed
- Green areas: 2–3 sentence positive note only
- Yellow areas: issue + why it matters + 2 fix paths (save time, save money)
- Red areas: issue + why it matters + 3 fix paths (save time, save money, scale without owner)
- Areas sorted: red first, yellow second, green last

### Section 5 — CTA
- "Ready to change the math?" headline
- Murat/Alexandr personal review mention
- Complimentary call offer box:
  - Strikethrough $899 / 60 min
  - "Complimentary" in teal
  - Countdown timer to May 1, 2026
  - After May 1: timer disappears, shows standard $899 rate
  - Note: "If you choose to work with us, the full call value is credited toward your engagement."
- "Schedule Your Complimentary Call" primary button (links to Calendly or contact page)
- "Download PDF" secondary button (triggers browser print/save)
- "Back to Home" tertiary link

### Section 6 — Email Confirmation
- Bottom of page: "Report sent to [email] · Not seeing it? Check your spam folder."

---

## AI Usage

One API call per completed assessment. Generates 2 pieces of personalized text:

1. **Benchmark narrative** (Section 2 blockquote): 2–3 sentences referencing their specific industry, years in business, state, and team size. Motivational and grounded in the benchmark data shown.

2. **Executive summary** (shown at top of Section 4): 3–4 sentences summarizing the overall picture — what they are doing well, what the main risk areas are, and what the priority should be. Tone: direct, advisor-style, never generic.

**Fallback:** If AI call fails, both sections are replaced with template text using their data. Report still renders and delivers full value.

**Prompt structure:** System prompt includes all 19 answers, industry benchmark data for their industry, all 9 scores, and the owner economics calculation result. Max tokens: 500.

---

## Email Delivery

After report is generated:
- POST to `/api/email` with: recipient email, name, business name, report HTML (or PDF attachment)
- Email subject: "Your Nexvora Business Health Report — [Business Name]"
- Email body: brief intro + link to their report page (if hosted) or inline HTML report
- Footer note: "Check your spam folder if you don't see this within 5 minutes."

Implementation: Resend API or SendGrid (to be confirmed during implementation).

---

## PDF Download

Uses browser `window.print()` with print-optimized CSS:
- Hide nav, CTA buttons, countdown timer
- Force white background, black text on all sections
- Page breaks between major sections
- Footer with Nexvora logo and "Generated [date]"

---

## Technical Architecture

**Files to create/modify:**
- `assessment.html` — full rewrite: contact info step + 19 structured questions, replaces current AI chat flow
- `report.html` — new file: full report page, receives data from localStorage
- `api/chat.js` — modify: add report summary generation endpoint, add email endpoint
- `api/email.js` — new file: handles email delivery via Resend

**Data flow:**
1. User completes `assessment.html` → all answers stored in `localStorage` as JSON
2. On Q19 submit: call AI for summary text → store in localStorage → redirect to `report.html`
3. `report.html` reads localStorage → runs scoring logic + owner economics calculation → renders report
4. On page load: call `/api/email` to send report → show confirmation

**No server-side storage.** All data lives in localStorage and is passed to the API only for AI generation and email sending. No database required.

---

## Scheduling Integration

"Schedule Your Complimentary Call" button links to Calendly (or similar). URL to be provided by Murat/Alexandr. Placeholder: `https://calendly.com/nexvora` until confirmed.

---

## Countdown Timer Logic

```javascript
const OFFER_END = new Date('2026-05-01T00:00:00');
const now = new Date();
if (now >= OFFER_END) {
  // Hide complimentary offer, show $899 standard rate
} else {
  // Show countdown: days, hours, minutes, seconds
  // Update every second with setInterval
}
```

---

## Out of Scope

- User accounts or saved reports (no login)
- Multiple report versions or history
- CRM integration (future phase)
- Client portal (explicitly deferred)
- Automated daily blog posts (separate project)
