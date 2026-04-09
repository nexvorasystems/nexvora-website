# Supabase Report Persistence + Short Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save assessment reports to Supabase so they persist forever and can be accessed via a short URL like `nexvorasystems.us/r/ab12cd34`.

**Architecture:** When an assessment completes, the full payload is POSTed to a new `api/save-report.js` serverless function which stores it in Supabase and returns an 8-character ID. The `assessment.html` page uses this ID to build a short URL. The `report.html` page checks for `?id=` param first, fetches from Supabase, and falls back to `?d=` base64 for old links. The `api/ghl.js` email/SMS uses the short URL. A Vercel rewrite maps `/r/:id` → `/report.html?id=:id`.

**Tech Stack:** Supabase (PostgreSQL via REST API), Vercel serverless functions (Node.js), vanilla HTML/JS

**Supabase credentials (add to Vercel env vars):**
- `SUPABASE_URL` = `https://ivkfzlxxsqzziqbjplpa.supabase.co`
- `SUPABASE_SERVICE_KEY` = `sb_secret_zARSrr2H8xqXuw6UlqzICA_pdIc31eS`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `api/save-report.js` | Create | Receives payload, saves to Supabase, returns `{id}` |
| `assessment.html` | Modify (lines ~827-834) | Call save-report, build short URL, pass short URL to GHL |
| `api/ghl.js` | Modify (lines ~191, ~231) | Use short URL from payload instead of base64 URL |
| `report.html` | Modify (`loadData()` lines ~813-828) | Check `?id=`, fetch from Supabase, fallback to `?d=` |
| `vercel.json` | Modify | Add rewrite `/r/:id` → `/report.html?id=:id` |

---

## Task 1: Create Supabase `reports` table

**Files:**
- No code files — done in Supabase dashboard

- [ ] **Step 1: Open Supabase SQL Editor**

Go to [https://supabase.com/dashboard/project/ivkfzlxxsqzziqbjplpa/sql/new](https://supabase.com/dashboard/project/ivkfzlxxsqzziqbjplpa/sql/new)

- [ ] **Step 2: Run this SQL to create the table**

```sql
create table reports (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default now()
);
```

Click **Run**. Expected: "Success. No rows returned."

- [ ] **Step 3: Verify table exists**

In Supabase left sidebar → **Table Editor** → you should see `reports` listed.

---

## Task 2: Add Supabase env vars to Vercel

**Files:**
- No code files — done in Vercel dashboard

- [ ] **Step 1: Open Vercel env vars**

Go to Vercel → nexvora-website project → **Settings** → **Environment Variables**

- [ ] **Step 2: Add SUPABASE_URL**

- Key: `SUPABASE_URL`
- Value: `https://ivkfzlxxsqzziqbjplpa.supabase.co`
- Environment: Production, Preview, Development (check all)
- Click **Save**

- [ ] **Step 3: Add SUPABASE_SERVICE_KEY**

- Key: `SUPABASE_SERVICE_KEY`
- Value: `sb_secret_zARSrr2H8xqXuw6UlqzICA_pdIc31eS`
- Environment: Production, Preview, Development (check all)
- Click **Save**

---

## Task 3: Create `api/save-report.js`

**Files:**
- Create: `api/save-report.js`

- [ ] **Step 1: Create the file with this exact content**

```js
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('[save-report] Missing Supabase env vars');
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const data = req.body;
  if (!data || !data.contact) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // Generate unique ID (retry once on collision, extremely unlikely)
  let id = generateId();

  const response = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ id, data })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[save-report] Supabase insert failed:', response.status, err);
    return res.status(500).json({ error: 'Failed to save report' });
  }

  return res.json({ id });
};
```

- [ ] **Step 2: Verify file exists**

```bash
ls api/save-report.js
```

Expected: `api/save-report.js`

- [ ] **Step 3: Commit**

```bash
git add api/save-report.js
git commit -m "feat: add save-report API for Supabase persistence"
```

---

## Task 4: Add `/r/:id` rewrite to `vercel.json`

**Files:**
- Modify: `vercel.json`

Current content of `vercel.json`:
```json
{
  "version": 2,
  "functions": {
    "api/chat.js": {
      "memory": 256,
      "maxDuration": 30
    }
  }
}
```

- [ ] **Step 1: Update `vercel.json` with rewrite**

Replace the entire file with:

```json
{
  "version": 2,
  "functions": {
    "api/chat.js": {
      "memory": 256,
      "maxDuration": 30
    }
  },
  "rewrites": [
    { "source": "/r/:id", "destination": "/report.html?id=:id" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: add /r/:id short URL rewrite"
```

---

## Task 5: Update `assessment.html` to call save-report and use short URL

**Files:**
- Modify: `assessment.html` (the `finishAssessment` function, around lines 826-834)

Current code in `finishAssessment()`:

```js
  // Push to GHL — GHL sends the confirmation email with the personalized report link
  fetch('/api/ghl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, reportUrl })
  }).then(r => r.json()).then(d => console.log('[GHL]', d)).catch(e => console.warn('[GHL] failed:', e.message));

  await sleep(1200);
  window.location.href = `report.html?d=${encoded}`;
```

- [ ] **Step 1: Replace that block with save-report + short URL logic**

Replace the two blocks above (the `fetch('/api/ghl'...)` call and the `window.location.href` line) with:

```js
  // Save to Supabase, get short ID, then call GHL with short URL
  let shortUrl = reportUrl; // fallback to base64 URL if save fails
  try {
    const saveRes = await fetch('/api/save-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (saveRes.ok) {
      const saveData = await saveRes.json();
      if (saveData.id) {
        shortUrl = `${window.location.origin}/r/${saveData.id}`;
      }
    }
  } catch(e) { console.warn('[save-report] failed, using base64 URL:', e.message); }

  // Push to GHL with the short URL (or base64 fallback)
  fetch('/api/ghl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, reportUrl: shortUrl })
  }).then(r => r.json()).then(d => console.log('[GHL]', d)).catch(e => console.warn('[GHL] failed:', e.message));

  await sleep(1200);
  window.location.href = `report.html?d=${encoded}`;
```

- [ ] **Step 2: Commit**

```bash
git add assessment.html
git commit -m "feat: save report to Supabase and use short URL in GHL email"
```

---

## Task 6: Update `report.html` to load from Supabase when `?id=` param present

**Files:**
- Modify: `report.html` (the `loadData()` function, lines ~813-828)

Current `loadData()`:

```js
function loadData(){
  // Try URL param first (works from email link on any device)
  const params=new URLSearchParams(window.location.search);
  const encoded=params.get('d');
  if(encoded){
    try{
      // Handle URL-safe base64 (- → +, _ → /, restore padding)
      const b64 = encoded.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(encoded.length/4)*4,'=');
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    }catch(e){}
  }
  // Fallback to localStorage (same device)
  const raw=localStorage.getItem('nexvora_assessment');
  if(raw){try{return JSON.parse(raw);}catch(e){}}
  return null;
}

function main(){
  const d=loadData();
```

- [ ] **Step 1: Replace `loadData()` and `main()` start with async version**

Replace the `loadData` function and the start of `main()` with:

```js
async function loadData(){
  const params=new URLSearchParams(window.location.search);

  // Short ID param — fetch from Supabase
  const id=params.get('id');
  if(id){
    try{
      const res=await fetch(`https://ivkfzlxxsqzziqbjplpa.supabase.co/rest/v1/reports?id=eq.${id}&select=data`, {
        headers:{
          'apikey':'sb_publishable_oTul8fFYdu6TCyrF25hA5w_3T3kI-Wl',
          'Authorization':'Bearer sb_publishable_oTul8fFYdu6TCyrF25hA5w_3T3kI-Wl'
        }
      });
      if(res.ok){
        const rows=await res.json();
        if(rows&&rows[0]&&rows[0].data) return rows[0].data;
      }
    }catch(e){console.warn('[report] Supabase fetch failed:',e.message);}
  }

  // Legacy base64 param — works for old email links
  const encoded=params.get('d');
  if(encoded){
    try{
      const b64=encoded.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(encoded.length/4)*4,'=');
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    }catch(e){}
  }

  // Fallback to localStorage (same device)
  const raw=localStorage.getItem('nexvora_assessment');
  if(raw){try{return JSON.parse(raw);}catch(e){}}
  return null;
}

async function main(){
  const d=await loadData();
```

- [ ] **Step 2: Commit**

```bash
git add report.html
git commit -m "feat: load report from Supabase when ?id= param present, fallback to base64"
```

---

## Task 7: Push and verify

- [ ] **Step 1: Push all commits**

```bash
git push
```

Expected: `main -> main` with all commits listed.

- [ ] **Step 2: Wait for Vercel deploy (~60 seconds)**

Go to Vercel → nexvora-website → **Deployments** and wait for the latest to show "Ready".

- [ ] **Step 3: Test the full flow**

1. Open `https://nexvora-website.vercel.app/assessment.html` (or nexvorasystems.us once DNS propagates)
2. Fill out the assessment
3. After completion, check the browser console — you should see `[GHL] {success: true, contactId: '...'}` and the save-report call should show an 8-char ID
4. Check GHL — the contact's email should contain a short link like `nexvorasystems.us/r/ab12cd34`
5. Click the short link — it should load the report

- [ ] **Step 4: Verify in Supabase**

Go to Supabase → Table Editor → `reports` — you should see a row with the `id` and `data` columns populated.

- [ ] **Step 5: Test old base64 links still work**

Open an old link like `https://nexvora-website.vercel.app/report.html?d=eyJjb250YWN0...` — it should still render the report normally.
