# Assessment V2 — Deep Diagnostic Upgrade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Nexvora assessment with 8 deeper diagnostic improvements — richer questions, social proof messaging, branching follow-ups, and a smarter report that gives each business owner a truly personalized strategy.

**Architecture:** All changes live in two files — `assessment.html` (question flow) and `report.html` (scoring + rendering). New data fields added to the `A` object in assessment are passed through `localStorage` and the URL `?d=` param to the report. No new files needed.

**Tech Stack:** Vanilla JS, HTML/CSS. No framework. No build step.

---

## Files Modified

| File | What Changes |
|---|---|
| `assessment.html` | 8 question flow changes: new questions, branching, social proof messages |
| `report.html` | New/updated render sections: ads ROI, team segments, 5-yr strategy, green-area AI roadmap |

---

## Task 1: Industry Sub-Type Question (after Q1)

**What:** After selecting industry (Q1), ask "What type of business specifically?" with options tailored to the chosen industry. Stored as `A.q1b`.

**Files:** `assessment.html` lines ~352–367

- [ ] After `A.q1` is set, add a branching sub-type question:

```javascript
// Sub-type options per industry
const SUB_TYPES = {
  'home-services': [
    {label:'Cleaning',value:'cleaning'},{label:'Landscaping',value:'landscaping'},
    {label:'Plumbing',value:'plumbing'},{label:'HVAC',value:'hvac'},
    {label:'Roofing',value:'roofing'},{label:'Pest Control',value:'pest-control'},
    {label:'Pool Service',value:'pool'},{label:'Painting',value:'painting'},
    {label:'Electrical',value:'electrical'},{label:'Other',value:'other'},
  ],
  'construction': [
    {label:'General Contractor',value:'general'},{label:'Remodeling',value:'remodeling'},
    {label:'Concrete',value:'concrete'},{label:'Flooring',value:'flooring'},
    {label:'Fencing',value:'fencing'},{label:'Other',value:'other'},
  ],
  'food-bev': [
    {label:'Restaurant',value:'restaurant'},{label:'Café / Coffee',value:'cafe'},
    {label:'Catering',value:'catering'},{label:'Food Truck',value:'food-truck'},
    {label:'Bar',value:'bar'},{label:'Other',value:'other'},
  ],
  'retail': [
    {label:'Clothing',value:'clothing'},{label:'Furniture',value:'furniture'},
    {label:'Electronics',value:'electronics'},{label:'Specialty Store',value:'specialty'},
    {label:'Online Retail',value:'online'},{label:'Other',value:'other'},
  ],
  'health-wellness': [
    {label:'Medical Office',value:'medical'},{label:'Dental',value:'dental'},
    {label:'Chiropractic',value:'chiro'},{label:'Gym / Fitness',value:'gym'},
    {label:'Spa / Massage',value:'spa'},{label:'Mental Health',value:'mental'},
    {label:'Other',value:'other'},
  ],
  'professional-services': [
    {label:'Law Firm',value:'law'},{label:'Accounting / CPA',value:'accounting'},
    {label:'Marketing Agency',value:'agency'},{label:'Consulting',value:'consulting'},
    {label:'IT Services',value:'it'},{label:'Insurance',value:'insurance'},
    {label:'Other',value:'other'},
  ],
  'auto': [
    {label:'Auto Repair',value:'repair'},{label:'Detailing',value:'detailing'},
    {label:'Towing',value:'towing'},{label:'Dealership',value:'dealership'},
    {label:'Other',value:'other'},
  ],
  'real-estate': [
    {label:'Property Management',value:'property-mgmt'},{label:'Real Estate Agent',value:'agent'},
    {label:'Investor / Flipping',value:'investor'},{label:'Short-Term Rentals',value:'str'},
    {label:'Other',value:'other'},
  ],
};

const subTypes = SUB_TYPES[A.q1] || [{label:'Other',value:'other'}];
await speak("What type of business specifically?", 500);
A.q1b = await askChips(subTypes);
addBubble(subTypes.find(s=>s.value===A.q1b)?.label || A.q1b, 'user');
```

- [ ] Add `q1b` to the payload object in `finishAssessment()`:
```javascript
const payload = { contact: A.contact, q1:A.q1, q1b:A.q1b, /* ...rest stays same */ };
```

- [ ] In `report.html` `renderHeader()`, update the sub-header line to show sub-type:
```javascript
// Add after industryLabel is set (~line 336):
const subTypeLabel = d.q1b ? d.q1b.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : '';
// In the html string, change:
// ${esc(industryLabel)}
// to:
// ${subTypeLabel ? esc(subTypeLabel) + ' (' + esc(industryLabel) + ')' : esc(industryLabel)}
```

- [ ] Commit:
```bash
git add assessment.html report.html
git commit -m "feat: add industry sub-type question (q1b)"
```

---

## Task 2: Repeat Customer Social Proof Messaging

**What:** After Q7 answer, show a social proof message:
- If they track it (number): "That's impressive — only 23% of small business owners track their repeat rate."
- If they don't track it: "No worries — 71% of owners have never tracked this either. Here's why it matters..."

**Files:** `assessment.html` lines ~423–446

- [ ] Replace the current Q7 branching block with:

```javascript
setProgress(11);
await speak("Do you have repeat customers — people who come back to use your business more than once?", 700);
const q7HasRepeat = await askChips([
  {label:'Yes', value:'yes'},
  {label:'No', value:'no'},
]);
addBubble(q7HasRepeat === 'yes' ? 'Yes' : 'No', 'user');

if (q7HasRepeat === 'no') {
  A.q7 = 'none';
  await speak("Got it. Most one-time service businesses still have opportunities for referrals and reviews — we'll cover that in your report.", 700);
} else {
  await speak("Do you know approximately what percentage of your customers come back?", 600);
  const q7KnowRate = await askChips([
    {label:"Yes, I track it", value:'yes'},
    {label:"Not sure / I don't track it", value:'no'},
  ]);
  addBubble(q7KnowRate === 'yes' ? "Yes, I track it" : "Don't track it", 'user');
  if (q7KnowRate === 'yes') {
    await speak("What percentage of your customers return for repeat business?", 600);
    A.q7 = await askNumber('%', 1, 100);
    addBubble(A.q7 + '%', 'user');
    // Social proof
    if (A.q7 >= 40) {
      await speak(`${A.q7}% — that's strong. Only about 23% of small business owners actively track their repeat rate. The fact that you know this number puts you ahead.`, 800);
    } else {
      await speak(`${A.q7}% repeat rate. The average for your industry is 35–45%. Your report will show you exactly how to close that gap.`, 800);
    }
  } else {
    A.q7 = 'dont-know';
    await speak("No worries — 71% of small business owners have never measured this either. We'll show you what it's likely costing you and how to start tracking it in under an hour.", 900);
  }
}
```

- [ ] In `report.html`, update `scoreQ7` section inside `renderAreaAnalysis` to add a dedicated repeat-rate insight block when `d.q7` is a number:
```javascript
// Inside renderAreaAnalysis, after the customer_experience section renders:
// Add this insight if q7 is a tracked number:
if (typeof d.q7 === 'number') {
  const pct = d.q7;
  const avg = 38; // industry average
  const tracking_pct = 23; // % of owners who track this
  const insight = pct >= avg
    ? `Your ${pct}% repeat rate is above the industry average of ${avg}%. You're in the top 35% of business owners who track this metric — and in the top ${tracking_pct}% who track it at all.`
    : `Your ${pct}% repeat rate is below the industry average of ${avg}%. A 10-point improvement in repeat rate typically adds 15–25% to annual revenue without spending a dollar on new leads.`;
  // Render as a highlight box inside the section
}
```

- [ ] Commit:
```bash
git add assessment.html report.html
git commit -m "feat: add social proof messaging for repeat customer rate (q7)"
```

---

## Task 3: Paid Ads Follow-Up Questions (Q9 branch)

**What:** If user selects "Paid ads" in Q9 (how customers find you), ask:
1. Monthly ad spend
2. Do you know how many leads you get? → if yes, how many per month

Then in the report: calculate cost-per-lead, flag if unknown, show ROI analysis.

**Files:** `assessment.html` lines ~459–467 (after Q9), `report.html` scoring section

- [ ] After Q9 `askMultiChips`, add:

```javascript
// Paid ads follow-up — only if paid-ads selected
A.q9_adspend = null;
A.q9_leads = null;
if (A.q9.includes('paid-ads')) {
  await speak("You mentioned paid ads. How much do you spend on ads per month approximately?", 700);
  A.q9_adspend = await askNumber('$/month', 0, 100000);
  addBubble('$' + Number(A.q9_adspend).toLocaleString() + '/month', 'user');

  await speak("Do you know how many leads those ads generate per month?", 600);
  const knowLeads = await askChips([
    {label:"Yes, I track it", value:'yes'},
    {label:"Not sure", value:'no'},
  ]);
  if (knowLeads === 'yes') {
    await speak("Approximately how many leads per month?", 500);
    A.q9_leads = await askNumber('leads/month', 1, 10000);
    addBubble(A.q9_leads + ' leads/month', 'user');
  } else {
    A.q9_leads = null;
    await speak("That's okay — most business owners don't track this. We'll flag it in your report because it's one of the highest-leverage things you can measure.", 800);
  }
}
```

- [ ] Add `q9_adspend` and `q9_leads` to the `payload` object in `finishAssessment()`.

- [ ] In `report.html`, add a paid ads ROI block inside `renderAreaAnalysis` for marketing section:

```javascript
// In renderAreaAnalysis, after marketing section:
if (d.q9 && d.q9.includes('paid-ads') && d.q9_adspend) {
  const spend = d.q9_adspend;
  const leads = d.q9_leads;
  const cpl = leads ? Math.round(spend / leads) : null;
  const cplText = cpl ? `$${cpl} cost per lead` : 'Cost per lead: unknown (not tracking)';
  const roiNote = cpl
    ? (cpl < 50 ? 'Excellent — under $50/lead is strong for local services.' : cpl < 150 ? 'Average range. Optimizing your landing page and offer can cut this by 20–40%.' : 'High cost per lead. Your ads may be targeting too broadly or your landing page needs work.')
    : 'Not tracking leads from paid ads is a significant blind spot. You may be spending money on ads that are not converting at all.';
  // Render as a callout box: spend, leads, CPL, ROI note
}
```

- [ ] Commit:
```bash
git add assessment.html report.html
git commit -m "feat: paid ads follow-up questions (q9_adspend, q9_leads) + ROI block in report"
```

---

## Task 4: Manual Tasks — Deeper Follow-Up (Q11 Branch)

**What:** Current Q11 asks which tasks are manual. Add follow-up: "Do you have a task management system?" + "How do you track follow-ups with customers?" — deeper data for the AI & Automation section of the report.

**Files:** `assessment.html` lines ~481–490

- [ ] After Q11 `askMultiChips`, add:

```javascript
// Task management follow-up (skip if they said 'none — mostly automated')
A.q11b = null; // task management tool
A.q11c = null; // follow-up tracking method

if (!A.q11.includes('none')) {
  await speak("Do you use any tool to manage tasks and track what your team is working on?", 600);
  A.q11b = await askChips([
    {label:'No — we handle it verbally',value:'verbal'},
    {label:'Text/WhatsApp group',value:'chat'},
    {label:'Spreadsheet or notes',value:'spreadsheet'},
    {label:'Project management tool (Trello, Asana, etc.)',value:'pm-tool'},
    {label:'Industry-specific software',value:'industry-software'},
  ]);
  addBubble({'verbal':'Verbal only','chat':'Text/WhatsApp','spreadsheet':'Spreadsheet','pm-tool':'Project management tool','industry-software':'Industry software'}[A.q11b], 'user');

  await speak("How do you track customer follow-ups — making sure no one falls through the cracks?", 600);
  A.q11c = await askChips([
    {label:'We don\'t — people slip through',value:'none'},
    {label:'I remember them myself',value:'memory'},
    {label:'Sticky notes or whiteboard',value:'physical'},
    {label:'Spreadsheet or calendar',value:'spreadsheet'},
    {label:'CRM or automated system',value:'crm'},
  ]);
  addBubble({'none':'Nothing in place','memory':'I remember them','physical':'Physical notes','spreadsheet':'Spreadsheet/calendar','crm':'CRM / automated'}[A.q11c], 'user');
}
```

- [ ] Add `q11b` and `q11c` to the `payload` object.

- [ ] In `report.html`, update the `ai_automation` section in `AREA_META` and `renderAreaAnalysis` to reference `q11b`/`q11c`:

```javascript
// When rendering ai_automation area:
// If q11b === 'verbal' or q11b === 'chat': flag as high-priority
// If q11c === 'none' or q11c === 'memory': add specific follow-up system recommendation
// Add concrete cost estimate: "At [team size], verbal task management costs ~X hrs/week"
```

- [ ] Commit:
```bash
git add assessment.html report.html
git commit -m "feat: manual task follow-up questions (q11b task mgmt, q11c follow-up tracking)"
```

---

## Task 5: Team Performance — Multi-Select (Q12 Upgrade)

**What:** Change Q12 from single-select to multi-select so owners can reflect reality more accurately (e.g., "informal check-ins" AND "KPIs" can both be true). Report shows gap analysis.

**Files:** `assessment.html` lines ~492–501, `report.html` team_hr section

- [ ] Replace Q12 `askChips` with `askMultiChips`:

```javascript
setProgress(16);
await speak("How do you currently manage team performance? Select all that apply.", 700);
A.q12 = await askMultiChips([
  {label:'No formal process',value:'none'},
  {label:'Informal check-ins',value:'informal'},
  {label:'Regular 1-on-1 meetings',value:'one-on-ones'},
  {label:'KPIs and performance tracking',value:'kpis'},
  {label:'Written job scorecards / accountability system',value:'formal'},
  {label:'Performance reviews (quarterly or annual)',value:'reviews'},
], 1);
const q12Labels = {'none':'No formal process','informal':'Informal check-ins','one-on-ones':'Regular 1-on-1s','kpis':'KPIs and tracking','formal':'Written scorecards','reviews':'Formal reviews'};
addBubble(A.q12.map(v=>q12Labels[v]||v).join(', '), 'user');
```

- [ ] Update `scoreQ12` in `report.html` — currently scores single value, must handle array:

```javascript
function scoreQ12(val) {
  const arr = Array.isArray(val) ? val : [val];
  if (arr.includes('none')) return 5;
  let score = 0;
  if (arr.includes('informal')) score += 20;
  if (arr.includes('one-on-ones')) score += 20;
  if (arr.includes('kpis')) score += 25;
  if (arr.includes('formal')) score += 20;
  if (arr.includes('reviews')) score += 15;
  return Math.min(score, 100);
}
```

- [ ] In `renderAreaAnalysis` team_hr section, add specific gap text based on what IS vs IS NOT selected:

```javascript
// What they have vs what's missing
const hasKPIs = arr.includes('kpis');
const hasOneOnOnes = arr.includes('one-on-ones');
const hasFormal = arr.includes('formal');
const gapLines = [];
if (!hasKPIs) gapLines.push('No KPI tracking — your team has no measurable targets');
if (!hasOneOnOnes) gapLines.push('No regular 1-on-1s — problems surface only when they become crises');
if (!hasFormal) gapLines.push('No written accountability system — expectations live in people\'s heads');
// Render gap lines as bullet list in the section
```

- [ ] Commit:
```bash
git add assessment.html report.html
git commit -m "feat: upgrade q12 team performance to multi-select + gap analysis in report"
```

---

## Task 6: 5-Year Goal Question (after Q15)

**What:** After the 12-month goal (Q15), ask "What is your goal for the next 5 years?" Stored as `A.q15b`. Report creates a dual-horizon strategy section comparing short vs long-term alignment.

**Files:** `assessment.html` lines ~526–535, `report.html` new render section

- [ ] After Q15 `askChips`, add:

```javascript
setProgress(20);
await speak("And thinking bigger — what's your goal for the next 5 years?", 700);
A.q15b = await askChips([
  {label:'Keep running and growing steadily',value:'steady'},
  {label:'Build a larger company (team, locations)',value:'scale'},
  {label:'Remove myself — run without me day-to-day',value:'remove-self'},
  {label:'Sell the business',value:'exit'},
  {label:'Pass it to family',value:'legacy'},
  {label:'Not sure yet',value:'unsure'},
]);
addBubble({'steady':'Grow steadily','scale':'Build a larger company','remove-self':'Remove myself from daily ops','exit':'Sell the business','legacy':'Pass to family','unsure':'Not sure yet'}[A.q15b], 'user');
```

- [ ] Add `q15b` to the `payload` object.

- [ ] Add a new render function `renderStrategySection(d)` in `report.html`:

```javascript
function renderStrategySection(d) {
  const goal12 = d.q15;
  const goal5 = d.q15b;
  if (!goal5) return;

  // Alignment matrix: what does achieving q15 require to get to q15b?
  const strategies = {
    // [12mo_goal]_[5yr_goal]
    'exit': {
      headline: 'Exit Strategy: Your 12-month and 5-year goals are aligned',
      body: 'Preparing to sell requires the same work as scaling — documented processes, clean financials, a team that runs without you, and predictable revenue. Every improvement you make now directly increases your business\'s sale price.',
      priority: 'Document everything. Buyers pay 2–4x more for businesses with clean SOPs, financial history, and owner-independent operations.'
    },
    'remove-self_exit': {
      headline: 'Path to Exit: Removing yourself first is the right sequence',
      body: 'You cannot sell a business where you are the business. Removing owner-dependency in the next 12 months is exactly the right first step toward a 5-year exit.',
      priority: 'Focus first on: (1) documenting your knowledge, (2) building a management layer, (3) making financials readable to a buyer.'
    },
    // ... more combos
  };

  const key = `${goal12}_${goal5}`;
  const fallback = {
    headline: `12-Month vs 5-Year: Making Both Work Together`,
    body: `Your 12-month goal (${goal12.replace(/-/g,' ')}) and 5-year goal (${goal5.replace(/-/g,' ')}) require building the same foundation: systems, team accountability, and financial clarity. The work you do this year compounds toward the larger goal.`,
    priority: 'Build systems first. Whether you plan to scale, sell, or step back — every one of those outcomes requires a business that runs without depending on your personal involvement.'
  };

  const s = strategies[key] || strategies[goal5] || fallback;
  const html = `
    <h2 style="font-size:18px;font-weight:800;margin-bottom:12px;">Your Growth Strategy</h2>
    <div style="background:#0F2B4C;border-radius:12px;padding:24px 28px;color:#fff;margin-bottom:16px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#0D9488;margin-bottom:8px;">12 MONTHS → 5 YEARS</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:10px;">${esc(s.headline)}</div>
      <p style="font-size:14px;color:rgba(255,255,255,0.75);line-height:1.7;margin-bottom:12px;">${esc(s.body)}</p>
      <div style="border-top:1px solid rgba(255,255,255,0.15);padding-top:12px;font-size:13px;color:#0D9488;font-weight:600;">Priority: ${esc(s.priority)}</div>
    </div>`;
  renderSection(html);
}
```

- [ ] Call `renderStrategySection(d)` in `main()` after `renderCTA(d)`.

- [ ] Commit:
```bash
git add assessment.html report.html
git commit -m "feat: add 5-year goal question (q15b) + dual-horizon strategy section in report"
```

---

## Task 7: Team Earnings by Segment (Q19 Upgrade)

**What:** Before asking average team pay, first ask what types of workers they have (back office, field techs, contractors, VAs). Then ask per-segment monthly pay. Report shows full math: owner pay + per segment totals + blended average.

**Files:** `assessment.html` lines ~584–587, `report.html` owner econ section

- [ ] Replace the single Q19 question with a branching segment flow:

```javascript
setProgress(23);
// First ask team composition (skip if solo)
A.q19_segments = {};
A.q19 = 0; // total blended avg (computed)

if (A.q5 !== 'solo') {
  await speak("What types of workers make up your team? Select all that apply.", 700);
  const teamTypes = await askMultiChips([
    {label:'Back office / admin',value:'admin'},
    {label:'Field technicians / service workers',value:'field'},
    {label:'Sales staff',value:'sales'},
    {label:'Contractors / 1099',value:'contractors'},
    {label:'Virtual assistants (VAs)',value:'va'},
    {label:'Managers',value:'managers'},
  ], 1);
  addBubble(teamTypes.map(v=>({admin:'Admin',field:'Field workers',sales:'Sales',contractors:'Contractors',va:'VAs',managers:'Managers'}[v]||v)).join(', '), 'user');

  const segLabels = {admin:'back office/admin',field:'field workers',sales:'sales staff',contractors:'contractors (1099)',va:'virtual assistants',managers:'managers'};
  let totalPay = 0;
  let totalWorkers = 0;

  for (const seg of teamTypes) {
    await speak(`How many ${segLabels[seg]} do you have?`, 500);
    const count = await askNumber('people', 1, 500);
    addBubble(count + ' people', 'user');

    await speak(`What does each ${segLabels[seg]} earn on average per month?`, 500);
    const pay = await askNumber('$/month each', 0, 30000);
    addBubble('$' + Number(pay).toLocaleString() + '/month each', 'user');

    A.q19_segments[seg] = { count, pay };
    totalPay += count * pay;
    totalWorkers += count;
  }

  A.q19 = totalWorkers > 0 ? Math.round(totalPay / totalWorkers) : 0;
  A.q19_total = totalPay; // total monthly payroll
  A.q19_headcount = totalWorkers;
} else {
  A.q19_segments = {};
  A.q19_total = 0;
  A.q19_headcount = 0;
}
```

- [ ] Add `q19_segments`, `q19_total`, `q19_headcount` to the `payload` object.

- [ ] In `report.html` `renderOwnerEcon()`, replace the simple team pay row with a full segment breakdown:

```javascript
// Current: shows single "Team payroll" row
// New: show per-segment table + totals

const segments = d.q19_segments || {};
const segNames = {admin:'Back Office / Admin',field:'Field Workers',sales:'Sales',contractors:'Contractors (1099)',va:'Virtual Assistants',managers:'Managers'};
const segRows = Object.entries(segments).map(([seg, {count, pay}]) => {
  const total = count * pay;
  return `<tr>
    <td style="padding:8px 12px;">${segNames[seg]||seg}</td>
    <td style="padding:8px 12px;text-align:center;">${count}</td>
    <td style="padding:8px 12px;text-align:right;">$${pay.toLocaleString()}/mo each</td>
    <td style="padding:8px 12px;text-align:right;font-weight:700;">$${total.toLocaleString()}/mo</td>
  </tr>`;
}).join('');

// Add totals row: owner + all team
const ownerPay = d.q16 || 0;
const teamTotal = d.q19_total || 0;
const grandTotal = ownerPay + teamTotal;
```

- [ ] Commit:
```bash
git add assessment.html report.html
git commit -m "feat: team earnings by segment (q19_segments) + full payroll math in report"
```

---

## Task 8: Green Areas — AI Roadmap Section

**What:** For areas scoring ≥ 70 (green/healthy), instead of just praise, add a section: "You're doing well here — here's how to protect it and use AI to stay ahead."

**Files:** `report.html` `renderAreaAnalysis()` function

- [ ] In `renderAreaAnalysis()`, for each area where `score >= 70`, replace/augment the current green rendering with:

```javascript
// Current green areas just show a green bar with "Good" label
// Add: AI roadmap sub-section below the area card

const AI_NEXT_STEPS = {
  operations: 'Your processes are documented — the next step is making them self-improving. AI can flag when a process step is taking longer than usual, surface training gaps automatically, and suggest updates based on customer feedback patterns.',
  customer_experience: 'Strong retention is your competitive moat. AI can make it stronger: automated review requests at the right moment, predictive churn detection (who's at risk of not returning), and personalized re-engagement sequences.',
  sales: 'Your follow-up system is working. AI can multiply it: predictive lead scoring (which leads are most likely to close), automated proposal follow-ups, and a CRM that surfaces the right leads at the right time without manual triage.',
  marketing: 'You have multiple lead channels. AI can optimize spend across them: automated A/B testing, campaign performance dashboards, and tools that show you exactly which channel is producing your best customers (not just most leads).',
  ai_automation: 'You\'re ahead of 80% of small businesses on automation. The next level is predictive automation — systems that don\'t just react but anticipate: inventory, staffing, scheduling based on demand forecasting.',
  team_hr: 'You have accountability systems in place. AI can enhance them: performance trend detection (who\'s improving, who\'s declining before it becomes a problem), automated pulse surveys, and onboarding systems that adapt to each new hire.',
  financial: 'Monthly financial reviews give you a strong foundation. AI can make it real-time: automated alerts when margins drop below target, cash flow forecasting, and profitability analysis by job/service type automatically.',
  reporting: 'You have data visibility. AI can transform it: natural language queries ("what was my best month last year and why?"), anomaly detection, and automated weekly summaries sent to your phone every Monday morning.',
  growth: 'Your scaling foundation is solid. AI can accelerate expansion: market analysis for new locations, automated competitor monitoring, and demand forecasting that tells you when you\'re ready to hire before you feel the pain.',
};

if (score >= 70) {
  const aiNote = AI_NEXT_STEPS[areaKey] || '';
  // Render a teal-bordered "Next Level" box below the area card:
  html += `
    <div style="border:1px solid #0D9488;border-radius:10px;padding:16px 20px;margin-top:12px;background:rgba(13,148,136,0.04);">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#0D9488;margin-bottom:8px;">NEXT LEVEL — STAY AHEAD WITH AI</div>
      <p style="font-size:14px;color:#4A5568;line-height:1.7;margin:0;">${aiNote}</p>
    </div>`;
}
```

- [ ] Commit:
```bash
git add report.html
git commit -m "feat: green area AI roadmap boxes in report for areas scoring 70+"
```

---

## Self-Review

**Spec coverage check:**
- [x] Task 1 — Industry sub-type (q1b) ✓
- [x] Task 2 — Repeat customer social proof ✓
- [x] Task 3 — Paid ads follow-up + ROI ✓
- [x] Task 4 — Manual tasks deeper follow-up (q11b, q11c) ✓
- [x] Task 5 — Team performance multi-select ✓
- [x] Task 6 — 5-year goal + dual strategy section ✓
- [x] Task 7 — Team segments + payroll math ✓
- [x] Task 8 — Green areas AI roadmap ✓

**Payload fields added:**
`q1b`, `q9_adspend`, `q9_leads`, `q11b`, `q11c`, `q15b`, `q19_segments`, `q19_total`, `q19_headcount`

**Backward compatibility:** All new fields are optional in the report — if null/undefined, those sections simply don't render. Old assessments in localStorage still load correctly.
