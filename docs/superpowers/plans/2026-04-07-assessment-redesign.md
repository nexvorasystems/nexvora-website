# Assessment Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current AI-chat assessment with a structured 19-question flow and a full-page professional report with industry benchmarks, owner economics calculation, and a complimentary call offer.

**Architecture:** `assessment.html` collects contact info + 19 structured questions (chips/numbers), stores everything in `localStorage`, calls `api/chat.js` once for AI summary text, then redirects to `report.html`. `report.html` reads localStorage, runs all scoring/calculations client-side, renders the 6-section report, calls `api/email.js` to send the report by email.

**Tech Stack:** Vanilla HTML5/CSS3/JS, Vercel serverless functions (Node.js), OpenAI gpt-4o-mini, Resend email API.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `assessment.html` | Full rewrite | Contact info + 19 questions + AI call + redirect |
| `report.html` | Create new | Read localStorage + score + render 6-section report |
| `api/chat.js` | Keep as-is | OpenAI proxy — no changes needed |
| `api/email.js` | Create new | Send report email via Resend |

**Design system constants** (use everywhere):
```
--bg: #FAF8F5
--bg-surface: #F0EDE8
--bg-card: #FFFFFF
--text: #1A1A2E
--muted: #4A5568
--dim: #718096
--border: #E2DDD5
--teal: #0D9488
--teal-lt: rgba(13,148,136,0.1)
--navy: #0F2B4C
--nav-h: 76px
```

**localStorage key:** `nexvora_assessment` — one JSON object with all answers + AI text.

**Data schema** stored in localStorage:
```json
{
  "contact": { "name": "John Smith", "email": "j@co.com", "phone": "555-1234", "company": "Clean Pro" },
  "q1": "home-services",
  "q2": "FL",
  "q3": "3-5",
  "q4": "300k-750k",
  "q5": "6-15",
  "q6": "basic-notes",
  "q7": 65,
  "q8": "nothing",
  "q9": "word-of-mouth",
  "q10": "4-4.5",
  "q11": ["scheduling", "invoicing", "reporting"],
  "q12": "informal",
  "q13": "tax-only",
  "q14": "no-tracking",
  "q15": "increase-revenue",
  "q16": "3k-5k",
  "q17": 65,
  "q18": ["daytime", "evenings", "weekends"],
  "q19": "2k-3k",
  "ai_benchmark": "You have operated...",
  "ai_summary": "Based on your answers..."
}
```

---

## Task 1: assessment.html — Shell, CSS, Nav, Progress Bar

**Files:**
- Modify: `assessment.html` (full rewrite)

- [ ] **Step 1: Write the full HTML shell with inline CSS**

Replace the entire contents of `assessment.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta name="description" content="Free Business Assessment — Nexvora Systems. Get your personalized business health report in under 10 minutes."/>
<title>Free Business Assessment — Nexvora Systems</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:#FAF8F5;--bg-surface:#F0EDE8;--bg-card:#FFFFFF;--text:#1A1A2E;--muted:#4A5568;--dim:#718096;--border:#E2DDD5;--teal:#0D9488;--teal-lt:rgba(13,148,136,0.1);--navy:#0F2B4C;--red:#EF4444;--nav-h:76px;}
html,body{font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;background:var(--bg);color:var(--text);height:100%;overflow:hidden;}
nav{position:fixed;top:0;left:0;right:0;z-index:200;height:var(--nav-h);display:flex;align-items:center;background:rgba(250,248,245,0.96);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);padding:0 28px;gap:20px;}
.prog-wrap{flex:1;display:flex;align-items:center;gap:12px;max-width:400px;margin:0 auto;}
.prog-label{font-size:11px;color:var(--dim);white-space:nowrap;min-width:100px;}
.prog-bar{flex:1;height:5px;background:var(--border);border-radius:99px;overflow:hidden;}
.prog-fill{height:100%;background:var(--teal);border-radius:99px;transition:width .6s ease;width:0%;}
.nav-back{font-size:13px;color:var(--muted);text-decoration:none;display:flex;align-items:center;gap:5px;white-space:nowrap;transition:color .15s;}
.nav-back:hover{color:var(--teal);}
.chat-wrap{position:fixed;top:var(--nav-h);left:0;right:0;bottom:0;display:flex;flex-direction:column;}
.chat-scroll{flex:1;overflow-y:auto;padding:32px 16px 20px;scroll-behavior:smooth;}
.chat-inner{max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:16px;}
.brow{display:flex;align-items:flex-end;gap:10px;}
.brow.bot{justify-content:flex-start;}
.brow.user{justify-content:flex-end;}
.avatar{width:34px;height:34px;min-width:34px;border-radius:50%;background:linear-gradient(135deg,#0F2B4C,#0D9488);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;}
.bbl{max-width:84%;padding:13px 17px;border-radius:18px;font-size:15px;line-height:1.65;}
.bbl.bot{background:var(--bg-card);border:1px solid var(--border);border-bottom-left-radius:4px;color:var(--text);}
.bbl.user{background:var(--teal);color:#fff;border-bottom-right-radius:4px;}
.typing-dots{display:flex;gap:5px;align-items:center;padding:4px 2px;}
.typing-dots span{width:7px;height:7px;border-radius:50%;background:var(--dim);animation:td 1.4s ease-in-out infinite;}
.typing-dots span:nth-child(2){animation-delay:.2s;}
.typing-dots span:nth-child(3){animation-delay:.4s;}
@keyframes td{0%,60%,100%{transform:translateY(0);opacity:.35;}30%{transform:translateY(-7px);opacity:1;}}
.chat-input-area{border-top:1px solid var(--border);background:var(--bg-card);padding:16px;flex-shrink:0;}
.input-inner{max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:10px;}
.input-row{display:flex;gap:10px;align-items:flex-end;}
.chat-input{flex:1;padding:13px 16px;border:1.5px solid var(--border);border-radius:12px;font-size:15px;color:var(--text);background:var(--bg);font-family:inherit;outline:none;transition:border-color .15s;-webkit-appearance:none;}
.chat-input:focus{border-color:var(--teal);box-shadow:0 0 0 3px var(--teal-lt);}
.chat-input.err{border-color:var(--red);}
.send-btn{width:44px;height:44px;min-width:44px;border-radius:11px;background:var(--teal);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .18s;}
.send-btn:hover{filter:brightness(1.1);}
.send-btn:disabled{opacity:.35;cursor:not-allowed;}
.err-msg{font-size:12px;color:var(--red);display:none;}
.err-msg.show{display:block;}
.chips{display:flex;flex-wrap:wrap;gap:9px;padding-top:4px;}
.chip{padding:10px 18px;border-radius:99px;border:1.5px solid var(--border);background:var(--bg-card);font-size:14px;color:var(--muted);font-weight:500;cursor:pointer;transition:all .15s;user-select:none;}
.chip:hover{border-color:var(--teal);color:var(--teal);background:var(--teal-lt);}
.chip.on{border-color:var(--teal);background:var(--teal);color:#fff;}
.multi-confirm{margin-top:8px;}
.multi-confirm button{padding:10px 22px;background:var(--teal);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;transition:all .18s;}
.multi-confirm button:disabled{opacity:.35;cursor:not-allowed;}
.states-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(68px,1fr));gap:7px;max-height:220px;overflow-y:auto;padding:4px 0 8px;}
.state-chip{padding:8px 4px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-card);font-size:12px;font-weight:600;color:var(--muted);cursor:pointer;transition:all .15s;text-align:center;user-select:none;}
.state-chip:hover{border-color:var(--teal);color:var(--teal);background:var(--teal-lt);}
.state-chip.on{border-color:var(--teal);background:var(--teal);color:#fff;}
.num-wrap{display:flex;align-items:center;gap:12px;}
.num-input{width:120px;padding:12px 16px;border:1.5px solid var(--border);border-radius:12px;font-size:18px;font-weight:700;color:var(--text);background:var(--bg);font-family:inherit;outline:none;text-align:center;-webkit-appearance:none;-moz-appearance:textfield;}
.num-input:focus{border-color:var(--teal);box-shadow:0 0 0 3px var(--teal-lt);}
.num-unit{font-size:14px;color:var(--muted);}
@media(max-width:600px){nav{padding:0 16px;}.prog-label{display:none;}.bbl{font-size:14px;max-width:90%;}.chat-input-area{padding:12px 14px;}}
</style>
</head>
<body>
<nav>
  <a href="index.html"><img src="assets/Logo no background.png" alt="Nexvora Systems" style="height:44px;width:auto;display:block;"/></a>
  <div class="prog-wrap">
    <span class="prog-label" id="progLabel">Getting started</span>
    <div class="prog-bar"><div class="prog-fill" id="progFill"></div></div>
  </div>
  <a href="index.html" class="nav-back">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    Back
  </a>
</nav>
<div class="chat-wrap">
  <div class="chat-scroll" id="chatScroll">
    <div class="chat-inner" id="chatInner"></div>
  </div>
  <div class="chat-input-area" id="inputArea" style="display:none;">
    <div class="input-inner" id="inputInner"></div>
  </div>
</div>
<script>
/* ── GLOBALS ─────────────────────────────────────────── */
const A = {}; // all answers
const TOTAL_STEPS = 23; // 4 contact + 19 questions
let currentStep = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── PROGRESS ────────────────────────────────────────── */
function setProgress(step, label) {
  currentStep = step;
  const pct = Math.min((step / TOTAL_STEPS) * 100, 99);
  document.getElementById('progFill').style.width = pct + '%';
  if (label) document.getElementById('progLabel').textContent = label;
}

/* ── SCROLL ──────────────────────────────────────────── */
function scrollBottom() {
  const el = document.getElementById('chatScroll');
  el.scrollTop = el.scrollHeight;
}
function scrollToLast() {
  const el = document.getElementById('chatScroll');
  const bots = el.querySelectorAll('.brow.bot');
  if (bots.length) el.scrollTo({ top: Math.max(0, bots[bots.length-1].offsetTop - 28), behavior: 'smooth' });
}

/* ── BUBBLE ──────────────────────────────────────────── */
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function addBubble(text, type, isHtml=false) {
  const inner = document.getElementById('chatInner');
  const row = document.createElement('div');
  row.className = `brow ${type}`;
  const content = isHtml ? text : esc(text);
  if (type === 'bot') row.innerHTML = `<div class="avatar">NX</div><div class="bbl bot">${content}</div>`;
  else row.innerHTML = `<div class="bbl user">${content}</div>`;
  inner.appendChild(row);
  scrollBottom();
  return row;
}

/* ── TYPING ──────────────────────────────────────────── */
let typingEl = null;
function showTyping() {
  if (typingEl) return;
  const inner = document.getElementById('chatInner');
  typingEl = document.createElement('div');
  typingEl.className = 'brow bot';
  typingEl.innerHTML = `<div class="avatar">NX</div><div class="bbl bot"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  inner.appendChild(typingEl);
  scrollBottom();
}
function hideTyping() { if (typingEl) { typingEl.remove(); typingEl = null; } }

async function speak(text, delay=800, isHtml=false) {
  showTyping();
  await sleep(delay);
  hideTyping();
  addBubble(text, 'bot', isHtml);
}

/* ── INPUT CLEAR ─────────────────────────────────────── */
function clearInput() {
  document.getElementById('inputInner').innerHTML = '';
  document.getElementById('inputArea').style.display = 'none';
}

/* ── TEXT INPUT ──────────────────────────────────────── */
function askText(placeholder, validate, type='text') {
  return new Promise(resolve => {
    const area = document.getElementById('inputArea');
    const inner = document.getElementById('inputInner');
    inner.innerHTML = `
      <div class="input-row">
        <input class="chat-input" id="ci" type="${type}" placeholder="${placeholder}" autocomplete="off"/>
        <button class="send-btn" id="csend" disabled>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      <div class="err-msg" id="cerr"></div>`;
    area.style.display = '';
    const inp = document.getElementById('ci');
    const btn = document.getElementById('csend');
    const err = document.getElementById('cerr');
    inp.addEventListener('input', () => { btn.disabled = !inp.value.trim(); inp.classList.remove('err'); err.classList.remove('show'); });
    const submit = () => {
      const val = inp.value.trim();
      if (!val) return;
      if (validate) { const e = validate(val); if (e) { inp.classList.add('err'); err.textContent = e; err.classList.add('show'); return; } }
      clearInput(); resolve(val);
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    btn.addEventListener('click', submit);
    setTimeout(() => { inp.focus(); scrollToLast(); }, 80);
  });
}

/* ── NUMBER INPUT ────────────────────────────────────── */
function askNumber(unit, min, max) {
  return new Promise(resolve => {
    const area = document.getElementById('inputArea');
    const inner = document.getElementById('inputInner');
    inner.innerHTML = `
      <div class="input-row">
        <div class="num-wrap">
          <input class="num-input" id="ni" type="number" min="${min}" max="${max}" placeholder="0"/>
          <span class="num-unit">${unit}</span>
        </div>
        <button class="send-btn" id="nsend" disabled>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      <div class="err-msg" id="nerr"></div>`;
    area.style.display = '';
    const inp = document.getElementById('ni');
    const btn = document.getElementById('nsend');
    const err = document.getElementById('nerr');
    inp.addEventListener('input', () => { btn.disabled = inp.value === '' || isNaN(Number(inp.value)); inp.classList.remove('err'); err.classList.remove('show'); });
    const submit = () => {
      const val = Number(inp.value);
      if (isNaN(val)) return;
      if (val < min || val > max) { inp.classList.add('err'); err.textContent = `Please enter a value between ${min} and ${max}`; err.classList.add('show'); return; }
      clearInput(); resolve(val);
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    btn.addEventListener('click', submit);
    setTimeout(() => { inp.focus(); scrollToLast(); }, 80);
  });
}

/* ── SINGLE CHIP ─────────────────────────────────────── */
function askChips(options) {
  return new Promise(resolve => {
    const area = document.getElementById('inputArea');
    const inner = document.getElementById('inputInner');
    const wrap = document.createElement('div');
    wrap.className = 'chips';
    options.forEach(o => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = o.label;
      chip.onclick = () => { clearInput(); resolve(o.value); };
      wrap.appendChild(chip);
    });
    inner.innerHTML = '';
    inner.appendChild(wrap);
    area.style.display = '';
    setTimeout(() => scrollToLast(), 80);
  });
}

/* ── MULTI CHIP ──────────────────────────────────────── */
function askMultiChips(options, minSelect=1) {
  return new Promise(resolve => {
    const area = document.getElementById('inputArea');
    const inner = document.getElementById('inputInner');
    const wrap = document.createElement('div');
    wrap.className = 'chips';
    const selected = new Set();
    options.forEach(o => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = o.label;
      chip.onclick = () => {
        if (selected.has(o.value)) { selected.delete(o.value); chip.classList.remove('on'); }
        else { selected.add(o.value); chip.classList.add('on'); }
        confirmBtn.disabled = selected.size < minSelect;
      };
      wrap.appendChild(chip);
    });
    const confirmDiv = document.createElement('div');
    confirmDiv.className = 'multi-confirm';
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Confirm →';
    confirmBtn.disabled = true;
    confirmBtn.onclick = () => { clearInput(); resolve([...selected]); };
    confirmDiv.appendChild(confirmBtn);
    inner.innerHTML = '';
    inner.appendChild(wrap);
    inner.appendChild(confirmDiv);
    area.style.display = '';
    setTimeout(() => scrollToLast(), 80);
  });
}

/* ── STATE GRID ──────────────────────────────────────── */
function askState() {
  const states = [
    {label:'AL',value:'AL'},{label:'AK',value:'AK'},{label:'AZ',value:'AZ'},{label:'AR',value:'AR'},{label:'CA',value:'CA'},{label:'CO',value:'CO'},{label:'CT',value:'CT'},{label:'DE',value:'DE'},{label:'FL',value:'FL'},{label:'GA',value:'GA'},{label:'HI',value:'HI'},{label:'ID',value:'ID'},{label:'IL',value:'IL'},{label:'IN',value:'IN'},{label:'IA',value:'IA'},{label:'KS',value:'KS'},{label:'KY',value:'KY'},{label:'LA',value:'LA'},{label:'ME',value:'ME'},{label:'MD',value:'MD'},{label:'MA',value:'MA'},{label:'MI',value:'MI'},{label:'MN',value:'MN'},{label:'MS',value:'MS'},{label:'MO',value:'MO'},{label:'MT',value:'MT'},{label:'NE',value:'NE'},{label:'NV',value:'NV'},{label:'NH',value:'NH'},{label:'NJ',value:'NJ'},{label:'NM',value:'NM'},{label:'NY',value:'NY'},{label:'NC',value:'NC'},{label:'ND',value:'ND'},{label:'OH',value:'OH'},{label:'OK',value:'OK'},{label:'OR',value:'OR'},{label:'PA',value:'PA'},{label:'RI',value:'RI'},{label:'SC',value:'SC'},{label:'SD',value:'SD'},{label:'TN',value:'TN'},{label:'TX',value:'TX'},{label:'UT',value:'UT'},{label:'VT',value:'VT'},{label:'VA',value:'VA'},{label:'WA',value:'WA'},{label:'WV',value:'WV'},{label:'WI',value:'WI'},{label:'WY',value:'WY'}
  ];
  return new Promise(resolve => {
    const area = document.getElementById('inputArea');
    const inner = document.getElementById('inputInner');
    const grid = document.createElement('div');
    grid.className = 'states-grid';
    states.forEach(s => {
      const chip = document.createElement('div');
      chip.className = 'state-chip';
      chip.textContent = s.label;
      chip.onclick = () => { clearInput(); resolve(s.value); };
      grid.appendChild(chip);
    });
    inner.innerHTML = '';
    inner.appendChild(grid);
    area.style.display = '';
    setTimeout(() => scrollToLast(), 80);
  });
}

/* ── MAIN FLOW ───────────────────────────────────────── */
async function main() {
  setProgress(0, 'Getting started');
  await sleep(400);
  await speak("Hi, I'm Nex — your Nexvora advisor. I'll ask you a few questions about your business and put together a personalized report. It takes about 5 minutes.", 900);
  await sleep(200);
  await speak("Let's start with some contact info so we can send you the report.", 700);

  /* ── CONTACT INFO ── */
  await sleep(300);
  await speak("What's your full name?", 600);
  setProgress(1, 'Contact info');
  const name = await askText("Your full name", v => v.trim().length >= 2 ? null : "Please enter your full name");
  addBubble(name, 'user');
  A.contact = { name };
  const first = name.split(' ')[0];

  setProgress(2);
  await speak(`Great to meet you, ${first}! What email should we send your report to?`, 700);
  const email = await askText("your@email.com", v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : "Please enter a valid email", 'email');
  addBubble(email, 'user');
  A.contact.email = email;

  setProgress(3);
  await speak("Your phone number?", 600);
  const phone = await askText("+1 (555) 000-0000", v => v.replace(/\D/g,'').length >= 7 ? null : "Please enter a valid phone number", 'tel');
  addBubble(phone, 'user');
  A.contact.phone = phone;

  setProgress(4);
  await speak("And your company name? (optional — type 'skip' if you prefer)", 600);
  const company = await askText("Company name or 'skip'", null);
  addBubble(company.toLowerCase() === 'skip' ? '(skipped)' : company, 'user');
  A.contact.company = company.toLowerCase() === 'skip' ? '' : company;

  /* ── PROFILE QUESTIONS ── */
  setProgress(5, 'About your business');
  await speak(`Thanks, ${first}. Now a few questions about your business.`, 800);
  await sleep(200);

  await speak("Which industry is your business in?", 600);
  A.q1 = await askChips([
    {label:'Home Services',value:'home-services'},
    {label:'Construction & Contractors',value:'construction'},
    {label:'Food & Beverage',value:'food-bev'},
    {label:'Retail',value:'retail'},
    {label:'Health & Wellness',value:'health-wellness'},
    {label:'Professional Services',value:'professional-services'},
    {label:'Auto Services',value:'auto'},
    {label:'Real Estate',value:'real-estate'},
  ]);
  addBubble({
    'home-services':'Home Services','construction':'Construction & Contractors','food-bev':'Food & Beverage',
    'retail':'Retail','health-wellness':'Health & Wellness','professional-services':'Professional Services',
    'auto':'Auto Services','real-estate':'Real Estate'
  }[A.q1], 'user');

  setProgress(6);
  await speak("What state is your business based in?", 600);
  A.q2 = await askState();
  addBubble(A.q2, 'user');

  setProgress(7);
  await speak("How long has your business been operating?", 600);
  A.q3 = await askChips([
    {label:'Less than 1 year',value:'lt1'},
    {label:'1–2 years',value:'1-2'},
    {label:'3–5 years',value:'3-5'},
    {label:'6–10 years',value:'6-10'},
    {label:'10+ years',value:'10plus'},
  ]);
  addBubble({'lt1':'Less than 1 year','1-2':'1–2 years','3-5':'3–5 years','6-10':'6–10 years','10plus':'10+ years'}[A.q3], 'user');

  setProgress(8);
  await speak("What is your approximate annual revenue?", 600);
  A.q4 = await askChips([
    {label:'Under $100K',value:'lt100k'},
    {label:'$100K–$300K',value:'100k-300k'},
    {label:'$300K–$750K',value:'300k-750k'},
    {label:'$750K–$2M',value:'750k-2m'},
    {label:'Over $2M',value:'gt2m'},
  ]);
  addBubble({'lt100k':'Under $100K','100k-300k':'$100K–$300K','300k-750k':'$300K–$750K','750k-2m':'$750K–$2M','gt2m':'Over $2M'}[A.q4], 'user');

  setProgress(9);
  await speak("How many people work in your business, including you?", 600);
  A.q5 = await askChips([
    {label:'Just me',value:'solo'},
    {label:'2–5 people',value:'2-5'},
    {label:'6–15 people',value:'6-15'},
    {label:'16–30 people',value:'16-30'},
    {label:'30+ people',value:'30plus'},
  ]);
  addBubble({'solo':'Just me','2-5':'2–5 people','6-15':'6–15 people','16-30':'16–30 people','30plus':'30+ people'}[A.q5], 'user');

  /* ── DIAGNOSTIC QUESTIONS ── */
  setProgress(10, 'Business health');
  await speak("Now let's look at how your business actually runs. There are no right or wrong answers — just be honest.", 900);

  await speak("Do you have documented processes for how your business runs?", 700);
  A.q6 = await askChips([
    {label:'Nothing documented',value:'nothing'},
    {label:'Key steps in my head',value:'head'},
    {label:'Some basic notes',value:'notes'},
    {label:'Written SOPs exist',value:'sops'},
    {label:'Full SOPs + trained team',value:'full-sops'},
  ]);
  addBubble({'nothing':'Nothing documented','head':'Key steps in my head','notes':'Some basic notes','sops':'Written SOPs exist','full-sops':'Full SOPs + trained team'}[A.q6], 'user');

  setProgress(11);
  await speak("What percentage of your revenue comes from repeat customers?", 700);
  A.q7 = await askNumber('%', 0, 100);
  addBubble(A.q7 + '%', 'user');

  setProgress(12);
  await speak("What happens after someone shows interest but doesn't buy immediately?", 700);
  A.q8 = await askChips([
    {label:"Nothing — they go cold",value:'nothing'},
    {label:'I follow up manually sometimes',value:'manual'},
    {label:'I have a set follow-up process',value:'process'},
    {label:'Automated follow-up system',value:'automated'},
  ]);
  addBubble({'nothing':'Nothing — they go cold','manual':'I follow up manually sometimes','process':'I have a set follow-up process','automated':'Automated follow-up system'}[A.q8], 'user');

  setProgress(13);
  await speak("How do most new customers find you?", 700);
  A.q9 = await askChips([
    {label:'Word of mouth',value:'word-of-mouth'},
    {label:'Google search',value:'google'},
    {label:'Social media',value:'social'},
    {label:'Paid ads',value:'paid-ads'},
    {label:'Other',value:'other'},
  ]);
  addBubble({'word-of-mouth':'Word of mouth','google':'Google search','social':'Social media','paid-ads':'Paid ads','other':'Other'}[A.q9], 'user');

  setProgress(14);
  await speak("What is your average online review rating?", 700);
  A.q10 = await askChips([
    {label:'No reviews yet',value:'no-reviews'},
    {label:'1–3 stars',value:'1-3'},
    {label:'3–4 stars',value:'3-4'},
    {label:'4–4.5 stars',value:'4-4.5'},
    {label:'4.5–5 stars',value:'4.5-5'},
  ]);
  addBubble({'no-reviews':'No reviews yet','1-3':'1–3 stars','3-4':'3–4 stars','4-4.5':'4–4.5 stars','4.5-5':'4.5–5 stars'}[A.q10], 'user');

  setProgress(15);
  await speak("Which tasks does your team still do manually every week? Select all that apply.", 700);
  A.q11 = await askMultiChips([
    {label:'Scheduling',value:'scheduling'},
    {label:'Invoicing',value:'invoicing'},
    {label:'Customer follow-up',value:'follow-up'},
    {label:'Reporting',value:'reporting'},
    {label:'Data entry',value:'data-entry'},
    {label:'None — mostly automated',value:'none'},
  ], 1);
  addBubble(A.q11.includes('none') ? 'Mostly automated' : A.q11.join(', '), 'user');

  setProgress(16);
  await speak("How do you currently manage team performance?", 700);
  A.q12 = await askChips([
    {label:'No formal process',value:'none'},
    {label:'Informal check-ins',value:'informal'},
    {label:'Regular 1-on-1s',value:'one-on-ones'},
    {label:'KPIs and tracking',value:'kpis'},
    {label:'Formal reviews + accountability system',value:'formal'},
  ]);
  addBubble({'none':'No formal process','informal':'Informal check-ins','one-on-ones':'Regular 1-on-1s','kpis':'KPIs and tracking','formal':'Formal reviews + accountability system'}[A.q12], 'user');

  setProgress(17);
  await speak("How often do you review your business financials?", 700);
  A.q13 = await askChips([
    {label:'Rarely or never',value:'rarely'},
    {label:'At tax time only',value:'tax-time'},
    {label:'Quarterly',value:'quarterly'},
    {label:'Monthly',value:'monthly'},
    {label:'Weekly',value:'weekly'},
  ]);
  addBubble({'rarely':'Rarely or never','tax-time':'At tax time only','quarterly':'Quarterly','monthly':'Monthly','weekly':'Weekly'}[A.q13], 'user');

  setProgress(18);
  await speak("Do you track key business numbers in a dashboard or regular report?", 700);
  A.q14 = await askChips([
    {label:'No tracking',value:'none'},
    {label:'I check occasionally',value:'occasional'},
    {label:'Basic spreadsheet',value:'spreadsheet'},
    {label:'Software dashboard',value:'dashboard'},
    {label:'Real-time automated reporting',value:'automated'},
  ]);
  addBubble({'none':'No tracking','occasional':'I check occasionally','spreadsheet':'Basic spreadsheet','dashboard':'Software dashboard','automated':'Real-time automated reporting'}[A.q14], 'user');

  setProgress(19);
  await speak("What is your primary goal for the next 12 months?", 700);
  A.q15 = await askChips([
    {label:'Survive and stabilize',value:'survive'},
    {label:'Increase revenue',value:'revenue'},
    {label:'Reduce owner dependency',value:'owner-dep'},
    {label:'Build a team',value:'team'},
    {label:'Automate and scale',value:'automate'},
    {label:'Exit or sell',value:'exit'},
  ]);
  addBubble({'survive':'Survive and stabilize','revenue':'Increase revenue','owner-dep':'Reduce owner dependency','team':'Build a team','automate':'Automate and scale','exit':'Exit or sell'}[A.q15], 'user');

  /* ── OWNER ECONOMICS ── */
  setProgress(20, 'Owner economics');
  await speak(`Last section, ${first}. These questions help us calculate something most business owners have never seen about their own business.`, 900);

  await speak("How much do you pay yourself per month?", 700);
  A.q16 = await askChips([
    {label:"$0 — not paying myself",value:'0'},
    {label:'Under $3,000',value:'lt3k'},
    {label:'$3,000–$5,000',value:'3k-5k'},
    {label:'$5,000–$8,000',value:'5k-8k'},
    {label:'$8,000–$12,000',value:'8k-12k'},
    {label:'Over $12,000',value:'gt12k'},
  ]);
  addBubble({'0':'$0 — not paying myself','lt3k':'Under $3,000','3k-5k':'$3,000–$5,000','5k-8k':'$5,000–$8,000','8k-12k':'$8,000–$12,000','gt12k':'Over $12,000'}[A.q16], 'user');

  setProgress(21);
  await speak("How many hours per week do you personally work in the business?", 700);
  A.q17 = await askNumber('hrs/week', 1, 120);
  addBubble(A.q17 + ' hours/week', 'user');

  setProgress(22);
  await speak("When do you typically work? Select all that apply.", 700);
  A.q18 = await askMultiChips([
    {label:'Regular daytime hours',value:'daytime'},
    {label:'Early mornings (before 7am)',value:'mornings'},
    {label:'Evenings (after 6pm)',value:'evenings'},
    {label:'Weekends',value:'weekends'},
  ], 1);
  addBubble(A.q18.join(', '), 'user');

  setProgress(23);
  await speak("What do your team members earn on average per month?", 700);
  A.q19 = await askChips([
    {label:'Under $2,000',value:'lt2k'},
    {label:'$2,000–$3,000',value:'2k-3k'},
    {label:'$3,000–$4,000',value:'3k-4k'},
    {label:'$4,000–$5,000',value:'4k-5k'},
    {label:'Over $5,000',value:'gt5k'},
  ]);
  addBubble({'lt2k':'Under $2,000','2k-3k':'$2,000–$3,000','3k-4k':'$3,000–$4,000','4k-5k':'$4,000–$5,000','gt5k':'Over $5,000'}[A.q19], 'user');

  /* ── FINISH ── */
  await finishAssessment();
}

/* ── FINISH + AI CALL ────────────────────────────────── */
async function finishAssessment() {
  clearInput();
  setProgress(23, 'Building your report');
  await speak(`Perfect, ${A.contact.name.split(' ')[0]}. I have everything I need. Give me a moment to put your report together.`, 900);
  showTyping();
  await sleep(500);

  // Build AI prompt
  const industryLabels = {'home-services':'Home Services','construction':'Construction','food-bev':'Food & Beverage','retail':'Retail','health-wellness':'Health & Wellness','professional-services':'Professional Services','auto':'Auto Services','real-estate':'Real Estate'};
  const yearsLabels = {'lt1':'less than 1 year','1-2':'1–2 years','3-5':'3–5 years','6-10':'6–10 years','10plus':'over 10 years'};
  const sizeLabels = {'solo':'just yourself','2-5':'2–5 people','6-15':'6–15 people','16-30':'16–30 people','30plus':'30+ people'};

  const systemPrompt = `You are a direct, experienced business advisor writing for Nexvora Systems. Generate TWO short pieces of text for a business assessment report. Respond with ONLY valid JSON, no markdown.

Business profile:
- Owner: ${A.contact.name}
- Industry: ${industryLabels[A.q1] || A.q1}
- State: ${A.q2}
- Years operating: ${yearsLabels[A.q3] || A.q3}
- Annual revenue: ${A.q4}
- Team size: ${sizeLabels[A.q5] || A.q5}
- Repeat customer %: ${A.q7}%
- Goal: ${A.q15}

JSON format:
{
  "benchmark_narrative": "2-3 sentence motivational paragraph about what surviving this long in their industry means. Reference their specific industry, state, and years. Direct and real, not fluffy.",
  "executive_summary": "3-4 sentence summary of their business situation — what they are doing well, their biggest risk area, and what the single most important priority is right now. Use their actual data. No generic advice."
}`;

  let aiResult = { benchmark_narrative: '', executive_summary: '' };
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: systemPrompt }], max_tokens: 400 })
    });
    const data = await res.json();
    const match = (data.reply || '').match(/\{[\s\S]*\}/);
    if (match) aiResult = JSON.parse(match[0]);
  } catch(e) { console.error('AI error:', e); }

  hideTyping();

  // Store everything
  const payload = { contact: A.contact, q1:A.q1, q2:A.q2, q3:A.q3, q4:A.q4, q5:A.q5, q6:A.q6, q7:A.q7, q8:A.q8, q9:A.q9, q10:A.q10, q11:A.q11, q12:A.q12, q13:A.q13, q14:A.q14, q15:A.q15, q16:A.q16, q17:A.q17, q18:A.q18, q19:A.q19, ai_benchmark: aiResult.benchmark_narrative, ai_summary: aiResult.executive_summary };
  localStorage.setItem('nexvora_assessment', JSON.stringify(payload));

  document.getElementById('progFill').style.width = '100%';
  document.getElementById('progLabel').textContent = 'Complete';
  addBubble(`Your report is ready, ${A.contact.name.split(' ')[0]}! Taking you there now...`, 'bot');
  await sleep(1200);
  window.location.href = 'report.html';
}

main();
</script>
</body>
</html>
```

- [ ] **Step 2: Open `assessment.html` in browser and verify**

Open file directly in browser (or via `vercel dev` at `http://localhost:3000/assessment.html`).
Check:
- Nav shows logo + progress bar + Back link
- "Hi, I'm Nex" message appears after ~1s
- Name input appears, accepts text, Enter key works
- Email validates format (rejects `foo`, accepts `foo@bar.com`)
- Phone validates (rejects 3 digits, accepts 10 digits)
- Company accepts 'skip'
- Q1 shows 8 industry chips, clicking one advances
- Q2 shows 50-state grid, clicking one advances
- Q3–Q5 show chip sets, each advances
- Q6–Q15 diagnostic chips all advance
- Q7, Q17 show number input with unit label
- Q11, Q18 show multi-select with Confirm button
- Progress bar fills as questions advance
- After Q19: typing indicator appears, then "Your report is ready" message

- [ ] **Step 3: Commit**

```bash
cd "/Users/muratzhandaurov/Desktop/PRJOECTS/Nexvora/nexvora-wesbite/nexvora-website"
git add assessment.html
git commit -m "feat: rewrite assessment.html with 19-question structured flow"
```

---

## Task 2: report.html — Shell, CSS, Scoring Engine, Benchmark Data

**Files:**
- Create: `report.html`

- [ ] **Step 1: Create report.html with full CSS and scoring/benchmark logic**

Create `report.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta name="description" content="Your Nexvora Business Health Report — personalized assessment results."/>
<title>Your Business Health Report — Nexvora Systems</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:#FAF8F5;--bg-surface:#F0EDE8;--bg-card:#FFFFFF;--text:#1A1A2E;--muted:#4A5568;--dim:#718096;--border:#E2DDD5;--teal:#0D9488;--teal-lt:rgba(13,148,136,0.1);--navy:#0F2B4C;--green:#10B981;--yellow:#F59E0B;--red:#EF4444;--nav-h:76px;}
html,body{font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;background:var(--bg);color:var(--text);}
nav{position:fixed;top:0;left:0;right:0;z-index:200;height:var(--nav-h);display:flex;align-items:center;background:rgba(250,248,245,0.96);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);padding:0 28px;gap:20px;}
.nav-back{font-size:13px;color:var(--muted);text-decoration:none;display:flex;align-items:center;gap:5px;white-space:nowrap;transition:color .15s;margin-left:auto;}
.nav-back:hover{color:var(--teal);}
.report-wrap{padding:calc(var(--nav-h) + 48px) 24px 80px;max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:28px;}
/* ── SECTION CARDS ── */
.section-card{background:var(--bg-card);border:1px solid var(--border);border-radius:16px;overflow:hidden;}
.section-label{font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--teal);margin-bottom:14px;}
.section-body{padding:28px 32px;}
/* ── HEADER SECTION ── */
.report-header{background:linear-gradient(135deg,#0F2B4C 0%,#0D9488 100%);padding:32px;color:#fff;}
.report-header-top{font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:8px;}
.report-header h1{font-size:clamp(20px,3vw,26px);font-weight:800;margin-bottom:6px;}
.report-header .sub{font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:24px;}
.badges{display:flex;gap:12px;flex-wrap:wrap;}
.badge-box{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:14px 20px;text-align:center;min-width:110px;}
.badge-box .n{font-size:28px;font-weight:800;color:#44CAA2;letter-spacing:-1px;}
.badge-box .l{font-size:11px;color:rgba(255,255,255,0.55);margin-top:3px;}
/* ── BENCHMARKS ── */
.bench-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px;}
.bench-box{background:var(--bg-surface);border-radius:12px;padding:18px;text-align:center;}
.bench-n{font-size:26px;font-weight:800;color:var(--teal);letter-spacing:-1px;}
.bench-sub{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5;}
.bench-compare{font-size:12px;font-weight:700;color:var(--text);margin-top:10px;padding-top:10px;border-top:1px solid var(--border);}
.blockquote{border-left:3px solid var(--teal);padding:14px 18px;background:var(--teal-lt);border-radius:0 10px 10px 0;font-size:14px;font-style:italic;color:var(--navy);line-height:1.7;}
/* ── OWNER ECON ── */
.econ-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;}
.econ-card{border-radius:12px;padding:20px;text-align:center;}
.econ-card.owner{background:#FEF2F2;}
.econ-card.team{background:#F0FDF4;}
.econ-role{font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;}
.econ-card.owner .econ-role{color:var(--red);}
.econ-card.team .econ-role{color:var(--green);}
.econ-rate{font-size:34px;font-weight:800;color:var(--text);}
.econ-rate span{font-size:15px;font-weight:500;color:var(--muted);}
.econ-detail{font-size:12px;color:var(--muted);margin-top:6px;line-height:1.5;}
.econ-callout{background:#FFF7ED;border-left:3px solid var(--yellow);border-radius:0 10px 10px 0;padding:14px 18px;margin-bottom:14px;font-size:14px;color:var(--text);line-height:1.7;}
.econ-callout strong{color:#B45309;}
.econ-note{background:var(--bg-surface);border-radius:10px;padding:14px 18px;font-size:13px;color:var(--muted);line-height:1.7;font-style:italic;}
/* ── AREA ANALYSIS ── */
.exec-summary{background:var(--teal-lt);border-radius:10px;padding:16px 18px;font-size:14px;color:var(--navy);line-height:1.7;margin-bottom:24px;border-left:3px solid var(--teal);}
.area-block{border-radius:14px;padding:22px;margin-bottom:14px;}
.area-block.green{background:#F0FDF4;border:1px solid #A7F3D0;}
.area-block.yellow{background:#FFFDF0;border:1px solid #FDE68A;}
.area-block.red{background:#FFFAFA;border:1px solid #FECACA;}
.area-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.area-name{font-size:15px;font-weight:800;color:var(--text);}
.area-score-tag{padding:5px 13px;border-radius:99px;font-size:12px;font-weight:700;}
.area-score-tag.green{background:#D1FAE5;color:#059669;}
.area-score-tag.yellow{background:#FEF3C7;color:#D97706;}
.area-score-tag.red{background:#FEE2E2;color:#DC2626;}
.area-bar-wrap{height:7px;background:rgba(0,0,0,0.06);border-radius:99px;overflow:hidden;margin-bottom:16px;}
.area-bar{height:100%;border-radius:99px;transition:width 1.2s ease;}
.area-bar.green{background:var(--green);}
.area-bar.yellow{background:var(--yellow);}
.area-bar.red{background:var(--red);}
.area-issue-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
.area-block.red .area-issue-label{color:var(--red);}
.area-block.yellow .area-issue-label{color:#D97706;}
.area-text{font-size:13px;color:var(--muted);line-height:1.75;margin-bottom:14px;}
.area-green-text{font-size:13px;color:#4A5568;line-height:1.75;}
.fix-paths{display:flex;flex-direction:column;gap:8px;margin-top:10px;}
.fix-path{background:var(--bg-surface);border-radius:8px;padding:11px 14px;font-size:13px;color:var(--muted);line-height:1.6;}
.fix-path strong{color:var(--text);}
/* ── CTA ── */
.cta-section{background:var(--navy);border-radius:16px;padding:36px 32px;color:#fff;text-align:center;}
.cta-section h2{font-size:20px;font-weight:800;margin-bottom:8px;}
.cta-section h2 strong{color:#44CAA2;}
.cta-section .cta-sub{font-size:14px;color:rgba(255,255,255,0.6);margin-bottom:24px;}
.offer-box{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:24px;margin-bottom:20px;}
.offer-tag{font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#44CAA2;margin-bottom:10px;}
.offer-prices{display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:8px;}
.offer-old{font-size:16px;color:rgba(255,255,255,0.35);text-decoration:line-through;}
.offer-new{font-size:32px;font-weight:800;color:#44CAA2;}
.offer-note{font-size:12px;color:rgba(255,255,255,0.45);margin-bottom:6px;line-height:1.6;}
.countdown{font-size:13px;font-weight:700;color:rgba(255,255,255,0.7);margin-bottom:18px;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;}
.cd-unit{background:rgba(255,255,255,0.1);border-radius:7px;padding:6px 10px;text-align:center;min-width:52px;}
.cd-n{font-size:18px;font-weight:800;color:#fff;}
.cd-l{font-size:10px;color:rgba(255,255,255,0.5);}
.cta-btn-primary{display:inline-block;padding:15px 32px;background:var(--teal);color:#fff;font-weight:700;font-size:15px;border-radius:11px;text-decoration:none;transition:all .18s;border:none;cursor:pointer;}
.cta-btn-primary:hover{filter:brightness(1.1);transform:translateY(-1px);}
.cta-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px;}
.cta-btn-secondary{padding:11px 22px;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.8);font-size:13px;font-weight:600;border-radius:9px;text-decoration:none;border:none;cursor:pointer;transition:all .15s;}
.cta-btn-secondary:hover{background:rgba(255,255,255,0.14);}
.email-confirm{text-align:center;margin-top:18px;font-size:12px;color:rgba(255,255,255,0.35);}
/* ── FOOTER ── */
footer{background:var(--navy);color:#FAF8F5;padding:48px 28px 28px;margin-top:0;}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:36px;margin-bottom:40px;}
.footer-brand p{font-size:13px;margin-top:10px;color:rgba(250,248,245,0.5);}
.footer-col-title{font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:rgba(250,248,245,0.3);margin-bottom:12px;}
.footer-links{display:flex;flex-direction:column;gap:8px;}
.footer-links a{font-size:13px;color:rgba(250,248,245,0.5);text-decoration:none;}
.footer-links a:hover{color:#FAF8F5;}
.footer-bottom{border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:rgba(250,248,245,0.35);flex-wrap:wrap;gap:10px;}
/* ── PRINT ── */
@media print{nav,.cta-section,.countdown,footer{display:none!important;}.report-wrap{padding-top:20px;}.section-card,.area-block{break-inside:avoid;}.report-header{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
@media(max-width:700px){.bench-grid{grid-template-columns:1fr;}.econ-grid{grid-template-columns:1fr;}.section-body{padding:20px;}.report-header{padding:22px;}.badges{gap:8px;}.badge-box{min-width:90px;padding:12px 14px;}.footer-grid{grid-template-columns:1fr;gap:22px;}footer{padding:32px 20px 20px;}.report-wrap{padding-left:16px;padding-right:16px;}}
</style>
</head>
<body>
<nav>
  <a href="index.html"><img src="assets/Logo no background.png" alt="Nexvora Systems" style="height:44px;width:auto;display:block;"/></a>
  <a href="index.html" class="nav-back">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    Back to Home
  </a>
</nav>

<div class="report-wrap" id="reportWrap">
  <!-- rendered by JS -->
</div>

<footer>
  <div class="footer-grid">
    <div class="footer-brand">
      <a href="index.html"><img src="assets/Logo no background.png" alt="Nexvora Systems" style="height:38px;width:auto;display:block;margin-bottom:10px;"/></a>
      <p>Operational clarity for small businesses across Florida and all 50 states.</p>
    </div>
    <div>
      <p class="footer-col-title">Company</p>
      <div class="footer-links">
        <a href="about.html">About</a>
        <a href="services.html">Services</a>
        <a href="blog.html">Insights</a>
        <a href="contact.html">Contact</a>
      </div>
    </div>
    <div>
      <p class="footer-col-title">Services</p>
      <div class="footer-links">
        <a href="services/operations.html">Operations</a>
        <a href="services/ai-automation.html">AI & Automation</a>
        <a href="services/sales-systems.html">Sales Systems</a>
        <a href="services/growth-scaling.html">Growth & Scaling</a>
      </div>
    </div>
    <div>
      <p class="footer-col-title">Contact</p>
      <div class="footer-links">
        <a href="mailto:info@nexvorasystems.us">info@nexvorasystems.us</a>
        <a href="assessment.html">Free Assessment</a>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2025 Nexvora Systems LLC. All rights reserved.</span>
    <span style="display:flex;gap:16px;flex-wrap:wrap;">
      <a href="legal/terms.html" style="color:inherit;text-decoration:none;">Terms</a>
      <a href="legal/privacy.html" style="color:inherit;text-decoration:none;">Privacy</a>
    </span>
  </div>
</footer>

<script>
/* ═══════════════════════════════════════════════════════
   SCORING ENGINE
═══════════════════════════════════════════════════════ */
function scoreQ6(v){return{nothing:10,head:25,notes:50,sops:75,'full-sops':95}[v]||50;}
function scoreQ7(n){n=parseInt(n);if(n<=10)return 15;if(n<=25)return 35;if(n<=40)return 55;if(n<=60)return 70;if(n<=80)return 85;return 95;}
function scoreQ8(v){return{nothing:10,manual:30,process:65,automated:90}[v]||40;}
function scoreQ9(v){return{'word-of-mouth':30,google:60,social:55,'paid-ads':70,other:40}[v]||40;}
function scoreQ10(v){return{'no-reviews':20,'1-3':15,'3-4':45,'4-4.5':70,'4.5-5':90}[v]||40;}
function scoreQ11(arr){if(!arr||!arr.length)return 50;if(arr.includes('none'))return 95;const count=arr.length;return{1:75,2:60,3:40,4:25,5:10}[count]||10;}
function scoreQ12(v){return{none:10,informal:30,'one-on-ones':55,kpis:75,formal:95}[v]||40;}
function scoreQ13(v){return{rarely:10,'tax-time':25,quarterly:50,monthly:75,weekly:95}[v]||40;}
function scoreQ14(v){return{none:10,occasional:25,spreadsheet:50,dashboard:75,automated:95}[v]||40;}

function computeScores(d){
  const s7=scoreQ7(d.q7), s10=scoreQ10(d.q10);
  return {
    operations: scoreQ6(d.q6),
    customer_experience: Math.round((s7+s10)/2),
    sales: scoreQ8(d.q8),
    marketing: scoreQ9(d.q9),
    ai_automation: scoreQ11(d.q11),
    team_hr: scoreQ12(d.q12),
    financial: scoreQ13(d.q13),
    reporting: scoreQ14(d.q14),
    growth: 60 // baseline — Q15 is context only
  };
}

function overallScore(scores){
  const vals=Object.values(scores);
  return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
}

function scoreColor(n){return n>=70?'green':n>=45?'yellow':'red';}
function scoreLabel(n){return n>=70?'Strong':n>=45?'Needs Work':'Fix First';}

/* ═══════════════════════════════════════════════════════
   OWNER ECONOMICS
═══════════════════════════════════════════════════════ */
const PAY_MAP={'0':0,'lt3k':1500,'3k-5k':4000,'5k-8k':6500,'8k-12k':10000,'gt12k':13000};
const TEAM_MAP={'lt2k':1500,'2k-3k':2500,'3k-4k':3500,'4k-5k':4500,'gt5k':5500};

function computeOwnerEcon(d){
  const ownerPay=PAY_MAP[d.q16]??0;
  const weeklyHrs=parseFloat(d.q17)||40;
  const monthlyHrs=weeklyHrs*4.33;
  const ownerRate=ownerPay>0?(ownerPay/monthlyHrs):0;
  const teamPay=TEAM_MAP[d.q19]??2500;
  const teamRate=teamPay/(45*4.33);
  const diffPct=ownerRate>0?Math.round(((teamRate-ownerRate)/ownerRate)*100):null;
  return{ownerPay,weeklyHrs,monthlyHrs:Math.round(monthlyHrs),ownerRate:Math.round(ownerRate*100)/100,teamPay,teamRate:Math.round(teamRate*100)/100,diffPct};
}

/* ═══════════════════════════════════════════════════════
   BENCHMARK DATA
═══════════════════════════════════════════════════════ */
const BENCHMARKS={
  'home-services':{label:'Home Services',fail5yr:82,revenue:{'solo':85000,'2-5':220000,'6-15':380000,'16-30':750000,'30plus':1500000},margin:12,survival_note:'Only 18% of home services businesses survive past year 5. You are in that 18%.'},
  'construction':{label:'Construction',fail5yr:78,revenue:{'solo':120000,'2-5':380000,'6-15':850000,'16-30':2200000,'30plus':5000000},margin:8,survival_note:'Construction has one of the highest early-closure rates of any industry. You are still here.'},
  'food-bev':{label:'Food & Beverage',fail5yr:83,revenue:{'solo':200000,'2-5':450000,'6-15':900000,'16-30':1800000,'30plus':4000000},margin:5,survival_note:'Restaurant survival past year 5 is rarer than most people think. You have done something most cannot.'},
  'retail':{label:'Retail',fail5yr:80,revenue:{'solo':150000,'2-5':400000,'6-15':950000,'16-30':2500000,'30plus':6000000},margin:7,survival_note:'Retail closures outpace most industries. Lasting this long means you have found something that works.'},
  'health-wellness':{label:'Health & Wellness',fail5yr:75,revenue:{'solo':95000,'2-5':280000,'6-15':620000,'16-30':1400000,'30plus':3500000},margin:15,survival_note:'Health and wellness is competitive but rewarding for those who build loyal clientele. You are proving that.'},
  'professional-services':{label:'Professional Services',fail5yr:68,revenue:{'solo':180000,'2-5':480000,'6-15':1100000,'16-30':2800000,'30plus':7000000},margin:22,survival_note:'Professional services firms that survive past year 3 tend to have strong retention. You are building something lasting.'},
  'auto':{label:'Auto Services',fail5yr:76,revenue:{'solo':140000,'2-5':350000,'6-15':780000,'16-30':1600000,'30plus':3800000},margin:11,survival_note:'Auto services is relationship-driven. Businesses that survive are the ones their community trusts.'},
  'real-estate':{label:'Real Estate',fail5yr:71,revenue:{'solo':90000,'2-5':320000,'6-15':750000,'16-30':2000000,'30plus':5500000},margin:18,survival_note:'Most real estate businesses stall or close when the market shifts. You have adapted and kept going.'}
};

const SIZE_KEY={'solo':'solo','2-5':'2-5','6-15':'6-15','16-30':'16-30','30plus':'30plus'};

function fmt(n){if(n>=1000000)return'$'+(n/1000000).toFixed(1)+'M';if(n>=1000)return'$'+(n/1000).toFixed(0)+'K';return'$'+n;}

/* ═══════════════════════════════════════════════════════
   AREA CONTENT (issues, fix paths)
═══════════════════════════════════════════════════════ */
const AREA_META={
  operations:{label:'Operations',
    issue:'Your processes are not fully documented. When things go wrong, the fix depends on whoever was there — usually you. As you grow, this becomes the ceiling.',
    why:'Businesses without documented processes spend 30–40% more time solving the same problems over and over. Every new team member takes longer to train. Every time you step away, quality slips.',
    paths:{time:'Document your top 3 most-repeated processes. Once written, a new hire can follow them without asking you every step.',money:'Documented processes reduce rework and training time — both are direct cost savings. Businesses with SOPs typically cut onboarding time by half.',scale:'You cannot clone yourself. But you can write down what you know. That is how you scale without being personally involved in everything.'}},
  customer_experience:{label:'Customer Experience',
    issue:'Your repeat customer rate and online reviews suggest the customer experience is not creating the kind of loyalty that drives referrals and repeat business.',
    why:'A 5% increase in customer retention can increase profits by 25–95%. Most businesses spend more on acquisition than retention — and it costs 5–7x more to get a new customer than to keep an existing one.',
    paths:{time:'Set up a 2-touch follow-up after every job — a check-in call at day 7 and a review request at day 14. Both can be automated.',money:'Existing customers buy more, refer more, and complain less. Every dollar spent on retention delivers more than the same dollar spent on new leads.',scale:'A retention system runs whether or not you are personally involved. Set it up once. It compounds every month.'}},
  sales:{label:'Sales Systems',
    issue:'You have no consistent follow-up process when leads do not convert immediately. When someone asks for a quote and goes quiet, they are likely gone forever.',
    why:'Home services businesses lose 25–40% of potential revenue to unconverted leads. At your revenue range, that can be $50K–$150K per year sitting in a leaking bucket. Every lead you paid to generate that goes cold is money spent twice.',
    paths:{time:'A 3-message automated follow-up sequence (day 1, day 3, day 7) runs without you touching it. Set it up once.',money:'Recovering 20% of cold leads means spending less on new lead generation. Your cost per customer drops immediately.',scale:'Right now follow-up depends on you remembering. A system does it whether you are in the office, on a job, or asleep.'}},
  marketing:{label:'Marketing',
    issue:'Your marketing is almost entirely word-of-mouth with no owned channel. This means your revenue depends on factors you cannot control.',
    why:'Referral businesses plateau. When growth depends entirely on word-of-mouth, you cannot predict or control it. Adding even one owned channel — Google Business, a monthly email, a consistent social presence — creates a baseline you can build on.',
    paths:{time:'Claim and fully optimize your Google Business Profile. It takes 2 hours and has the highest ROI of any free marketing action in local services.',money:'Paid ads are scalable in a way that word-of-mouth is not. A $500/month campaign that generates even 3 new customers per month often pays back 3–5x.',scale:'Building a marketing system means the business can grow without you personally telling everyone about it.'}},
  ai_automation:{label:'AI & Automation',
    issue:'Your team is spending significant time every week on manual tasks that could be automated — scheduling, invoicing, reporting, follow-up.',
    why:'At your team size, manual tasks can easily cost 10–20 hours per week across the team. That is 40–80 hours per month of paid time going into work that software can do for pennies.',
    paths:{time:'Automating one recurring task — even just scheduling or invoicing — can save 5–8 hours per week immediately.',money:'Labor is your biggest cost. Automating repetitive work means your team spends their hours on what actually requires human judgment.',scale:'Manual processes break when you grow. Automated processes scale. The difference between a $500K business and a $2M business is usually automation.'}},
  team_hr:{label:'Team & HR',
    issue:'You have no formal system for tracking or improving team performance. This means you only find out about problems when they are already affecting customers.',
    why:"Without accountability systems, your best people eventually leave because there's no growth path, and your worst people stay because there's no consequence. This is one of the most common reasons small businesses stall at 6–15 employees.",
    paths:{time:'A 15-minute weekly check-in per team member is the minimum investment. It catches problems before they become customer complaints.',money:'High turnover costs 1.5–2x the annual salary of the person who left. Keeping good people is significantly cheaper than replacing them.',scale:'You cannot manage a growing team the same way you managed 3 people. Building accountability systems now prevents a management crisis later.'}},
  financial:{label:'Financial Efficiency',
    issue:'You review financials at tax time only. For 11 months of the year, you are flying blind. Unprofitable jobs, cost creep, and cash flow gaps go undetected until they become serious problems.',
    why:'Businesses that review financials monthly catch margin problems 4x faster. At your revenue level, a 2% margin improvement is worth thousands of dollars per month. You cannot improve what you are not measuring.',
    paths:{time:'A 30-minute monthly financial review habit — revenue, expenses, margin, cash position — is the single highest-leverage time investment you can make.',money:'Some jobs look profitable but are not once you factor in real time and overhead. Monthly reviews show you which ones to stop taking.',scale:'Investors, banks, and future buyers of your business all look at financial history. Clean monthly records now mean options later.'}},
  reporting:{label:'Reporting & Analytics',
    issue:'You have no real-time visibility into how your business is performing. You are making decisions based on gut feel and memory rather than data.',
    why:'Businesses with operational dashboards respond to problems 60% faster than those without. Without a reporting system, you discover problems when customers complain or when the bank account is empty — both of which are too late.',
    paths:{time:'A simple weekly dashboard — revenue, jobs completed, response time, review score — can be built in a spreadsheet in one afternoon.',money:'Identifying one underperforming area per month and fixing it compounds over time. You cannot do this without data.',scale:'At 15+ employees, you cannot know what everyone is doing by walking around. Data gives you scale without being everywhere at once.'}},
  growth:{label:'Growth & Scaling',
    issue:'You have a growth goal but the systems needed to support that growth are not fully in place. Growing without the right infrastructure creates chaos rather than results.',
    why:"Most businesses that try to scale without fixing their operations first end up making less money at higher revenue — because costs and problems scale faster than profit. The owners who successfully grow are the ones who built the foundation first.",
    paths:{time:"Identify the single biggest operational bottleneck in your business today. Fix that first before adding marketing spend or team members.",money:"Scaling an inefficient business amplifies losses. Scaling an efficient one amplifies profit. The same growth investment delivers very different results.",scale:"The goal is a business that runs without you in the daily operations. That requires documented processes, clear accountability, and systems that don't depend on your personal involvement."}}
};

/* ═══════════════════════════════════════════════════════
   RENDER HELPERS
═══════════════════════════════════════════════════════ */
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function renderSection(html){
  const div=document.createElement('div');
  div.className='section-card';
  div.innerHTML=html;
  document.getElementById('reportWrap').appendChild(div);
  return div;
}

/* ═══════════════════════════════════════════════════════
   SECTION 1: HEADER
═══════════════════════════════════════════════════════ */
function renderHeader(d,scores){
  const overall=overallScore(scores);
  const priorityCount=Object.values(scores).filter(s=>s<45).length;
  const benchmark=BENCHMARKS[d.q1]||BENCHMARKS['professional-services'];
  const sizeKey=SIZE_KEY[d.q5]||'solo';
  const avgRev=benchmark.revenue[sizeKey]||benchmark.revenue['solo'];
  const industryLabel=benchmark.label;
  const yearsLabel={'lt1':'under 1 year','1-2':'1–2 years','3-5':'3–5 years','6-10':'6–10 years','10plus':'10+ years'}[d.q3]||d.q3;
  const sizeLabel={'solo':'just yourself','2-5':'2–5 people','6-15':'6–15 people','16-30':'16–30 people','30plus':'30+ people'}[d.q5]||d.q5;
  const topPct=100-overall;
  const bizName=d.contact.company||d.contact.name+"'s Business";
  const html=`
    <div class="report-header">
      <div class="report-header-top">NEXVORA SYSTEMS · BUSINESS HEALTH REPORT</div>
      <h1>Business Health Report</h1>
      <div class="sub">${esc(bizName)} · ${esc(d.q2)} · ${esc(industryLabel)} · ${esc(yearsLabel)} · ${esc(sizeLabel)}</div>
      <div class="badges">
        <div class="badge-box"><div class="n">${overall}</div><div class="l">Overall Score</div></div>
        <div class="badge-box"><div class="n">Top ${topPct}%</div><div class="l">vs ${esc(industryLabel)} avg</div></div>
        <div class="badge-box"><div class="n">${priorityCount}</div><div class="l">Priority area${priorityCount!==1?'s':''} to fix</div></div>
        <div class="badge-box"><div class="n">${fmt(avgRev)}</div><div class="l">Industry avg revenue, your size</div></div>
      </div>
    </div>`;
  renderSection(html);
}

/* ═══════════════════════════════════════════════════════
   SECTION 2: BENCHMARKS
═══════════════════════════════════════════════════════ */
function renderBenchmarks(d,aiText){
  const b=BENCHMARKS[d.q1]||BENCHMARKS['professional-services'];
  const sizeKey=SIZE_KEY[d.q5]||'solo';
  const avgRev=b.revenue[sizeKey]||b.revenue['solo'];
  const survivalPct=100-b.fail5yr;
  const revLabel={'lt100k':'Under $100K','100k-300k':'$100K–$300K','300k-750k':'$300K–$750K','750k-2m':'$750K–$2M','gt2m':'Over $2M'}[d.q4]||'';
  const narrative=aiText||b.survival_note;
  const html=`
    <div class="section-body">
      <div class="section-label">Industry Benchmarks — ${esc(b.label)} · ${esc(d.q2)}</div>
      <div class="bench-grid">
        <div class="bench-box">
          <div class="bench-n">${b.fail5yr}%</div>
          <div class="bench-sub">of ${esc(b.label)} businesses close within 5 years</div>
          <div class="bench-compare">You are in the ${survivalPct}% that made it.</div>
        </div>
        <div class="bench-box">
          <div class="bench-n">${fmt(avgRev)}</div>
          <div class="bench-sub">avg annual revenue for your industry and team size</div>
          <div class="bench-compare">Your range: ${esc(revLabel)}</div>
        </div>
        <div class="bench-box">
          <div class="bench-n">${b.margin}%</div>
          <div class="bench-sub">avg net profit margin in ${esc(b.label)}</div>
          <div class="bench-compare">Most owners don't track this monthly.</div>
        </div>
      </div>
      <div class="blockquote">${esc(narrative)}</div>
    </div>`;
  renderSection(html);
}

/* ═══════════════════════════════════════════════════════
   SECTION 3: OWNER ECONOMICS
═══════════════════════════════════════════════════════ */
function renderOwnerEcon(d,econ){
  const timeSlots={'daytime':'Regular daytime hours','mornings':'Early mornings','evenings':'Evenings','weekends':'Weekends'};
  const workWhen=(d.q18||[]).map(s=>timeSlots[s]||s).join(', ');
  let comparisonHtml='';
  if(econ.ownerPay===0){
    comparisonHtml=`<div class="econ-callout"><strong>You are not paying yourself.</strong> Every hour you work is costing you money with no return on your own time. This is the most urgent number in your business to change.</div>`;
  } else if(econ.diffPct!==null){
    if(econ.diffPct>0){
      comparisonHtml=`<div class="econ-callout"><strong>Your team member earns ${econ.diffPct}% more per hour than you do.</strong> They work ~45 hours a week. You work ${econ.weeklyHrs}. They go home on time. You worked this weekend. They have zero business risk, zero liability, and no 3am panic about payroll. <strong>The math does not lie.</strong></div>`;
    } else if(econ.diffPct<-10){
      comparisonHtml=`<div class="econ-callout"><strong>You earn ${Math.abs(econ.diffPct)}% more per hour than your team — but you carry 100% of the risk, the liability, and the late nights.</strong> The question is whether that premium reflects what your time and risk are actually worth.</div>`;
    } else {
      comparisonHtml=`<div class="econ-callout"><strong>You and your team earn approximately the same per hour — but you carry all the risk. Let that sink in.</strong> Your team members have no liability, no payroll stress, and a guaranteed paycheck. You do not.</div>`;
    }
  }
  const ownerRateDisplay=econ.ownerPay===0?'$0.00':('$'+econ.ownerRate.toFixed(2));
  const html=`
    <div class="section-body">
      <div class="section-label">Owner Economics · The Real Math</div>
      <div class="econ-grid">
        <div class="econ-card owner">
          <div class="econ-role">You (Owner)</div>
          <div class="econ-rate">${ownerRateDisplay}<span>/hr</span></div>
          <div class="econ-detail">${econ.weeklyHrs} hrs/week · $${(econ.ownerPay||0).toLocaleString()}/month<br/>${esc(workWhen)}</div>
        </div>
        <div class="econ-card team">
          <div class="econ-role">Your Team</div>
          <div class="econ-rate">$${econ.teamRate.toFixed(2)}<span>/hr</span></div>
          <div class="econ-detail">~45 hrs/week · $${econ.teamPay.toLocaleString()}/month<br/>Regular hours only</div>
        </div>
      </div>
      ${comparisonHtml}
      <div class="econ-note">We are not here to tell you that you are overpaying your team or underpaying yourself. This is just the math. And this math is exactly why building the right systems is not a nice-to-have — it is the only way to change the equation.</div>
    </div>`;
  renderSection(html);
}

/* ═══════════════════════════════════════════════════════
   SECTION 4: FULL AREA ANALYSIS
═══════════════════════════════════════════════════════ */
function renderAreaAnalysis(d,scores,aiSummary){
  const areaOrder=Object.entries(scores).sort((a,b)=>a[1]-b[1]);
  let areasHtml='';
  areaOrder.forEach(([key,score])=>{
    const color=scoreColor(score);
    const label=scoreLabel(score);
    const meta=AREA_META[key];
    if(!meta)return;
    if(color==='green'){
      areasHtml+=`<div class="area-block green">
        <div class="area-header"><div class="area-name">${esc(meta.label)}</div><div class="area-score-tag green">${score} · ${label}</div></div>
        <div class="area-bar-wrap"><div class="area-bar green" style="width:${score}%"></div></div>
        <div class="area-green-text">This area is working well. Your systems here are above average — protect this advantage as you grow and make sure new team members are trained to the same standard.</div>
      </div>`;
    } else {
      const paths=meta.paths||{};
      const pathKeys=color==='red'?['time','money','scale']:['time','money'];
      const pathLabels={time:'Save time',money:'Save money',scale:'Scale without you'};
      const pathsHtml=pathKeys.map(k=>`<div class="fix-path"><strong>${pathLabels[k]}:</strong> ${esc(paths[k]||'')}</div>`).join('');
      areasHtml+=`<div class="area-block ${color}">
        <div class="area-header"><div class="area-name">${esc(meta.label)}</div><div class="area-score-tag ${color}">${score} · ${label}</div></div>
        <div class="area-bar-wrap"><div class="area-bar ${color}" style="width:${score}%"></div></div>
        <div class="area-issue-label">The issue</div>
        <div class="area-text">${esc(meta.issue)}</div>
        <div class="area-issue-label" style="margin-top:4px;">Why it matters</div>
        <div class="area-text">${esc(meta.why)}</div>
        <div class="area-issue-label" style="margin-top:4px;">How to fix it</div>
        <div class="fix-paths">${pathsHtml}</div>
      </div>`;
    }
  });
  const summaryBlock=aiSummary?`<div class="exec-summary">${esc(aiSummary)}</div>`:'';
  const html=`<div class="section-body">
    <div class="section-label">Full Business Analysis — All 9 Areas</div>
    ${summaryBlock}
    ${areasHtml}
  </div>`;
  renderSection(html);
}

/* ═══════════════════════════════════════════════════════
   SECTION 5: CTA + COUNTDOWN
═══════════════════════════════════════════════════════ */
function renderCTA(d){
  const first=d.contact.name.split(' ')[0];
  const OFFER_END=new Date('2026-05-01T00:00:00');
  const now=new Date();
  const offerActive=now<OFFER_END;
  let offerHtml='';
  if(offerActive){
    offerHtml=`
      <div class="offer-box">
        <div class="offer-tag">Limited Time — Assessment Completers Only</div>
        <div class="offer-prices">
          <div class="offer-old">$899 / 60 min</div>
          <div class="offer-new">Complimentary</div>
        </div>
        <div class="offer-note">Standard strategy call rate is $899. Complete your assessment today and schedule at no cost.<br/>If you choose to work with us, the full call value is credited toward your engagement.</div>
        <div class="countdown" id="countdown"></div>
      </div>`;
  } else {
    offerHtml=`
      <div class="offer-box">
        <div class="offer-tag">Strategy Call</div>
        <div class="offer-prices"><div class="offer-new" style="color:#44CAA2;font-size:24px;">$899 / 60 min</div></div>
        <div class="offer-note">60-minute strategy session with Murat or Alexandr. If you choose to work with us, this call fee is credited toward your engagement.</div>
      </div>`;
  }
  const html=`<div class="cta-section">
    <h2>Ready to change<br><strong>the math?</strong></h2>
    <div class="cta-sub">Murat or Alexandr will personally review this report with you and show you exactly where to start, ${esc(first)}.</div>
    ${offerHtml}
    <a href="contact.html" class="cta-btn-primary">Schedule Your ${offerActive?'Complimentary':'Strategy'} Call</a>
    <div class="cta-actions">
      <button class="cta-btn-secondary" onclick="window.print()">Download PDF</button>
      <a href="index.html" class="cta-btn-secondary">Back to Home</a>
    </div>
    <div class="email-confirm" id="emailConfirm">Report sent to ${esc(d.contact.email)} · Not seeing it? Check your spam folder.</div>
  </div>`;
  const wrapper=document.createElement('div');
  wrapper.innerHTML=html;
  document.getElementById('reportWrap').appendChild(wrapper.firstElementChild);
  if(offerActive) startCountdown();
}

function startCountdown(){
  const OFFER_END=new Date('2026-05-01T00:00:00');
  function update(){
    const el=document.getElementById('countdown');
    if(!el)return;
    const diff=OFFER_END-new Date();
    if(diff<=0){el.innerHTML='<span style="color:#44CAA2;font-size:14px;">Offer has ended</span>';return;}
    const d=Math.floor(diff/86400000);
    const h=Math.floor((diff%86400000)/3600000);
    const m=Math.floor((diff%3600000)/60000);
    const s=Math.floor((diff%60000)/1000);
    el.innerHTML=`<span style="font-size:12px;color:rgba(255,255,255,0.5);margin-right:4px;">Offer ends in</span>
      <div class="cd-unit"><div class="cd-n">${d}</div><div class="cd-l">days</div></div>
      <div class="cd-unit"><div class="cd-n">${String(h).padStart(2,'0')}</div><div class="cd-l">hrs</div></div>
      <div class="cd-unit"><div class="cd-n">${String(m).padStart(2,'0')}</div><div class="cd-l">min</div></div>
      <div class="cd-unit"><div class="cd-n">${String(s).padStart(2,'0')}</div><div class="cd-l">sec</div></div>`;
  }
  update();
  setInterval(update, 1000);
}

/* ═══════════════════════════════════════════════════════
   SEND EMAIL
═══════════════════════════════════════════════════════ */
async function sendEmail(d){
  try{
    await fetch('/api/email',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({to:d.contact.email,name:d.contact.name,bizName:d.contact.company||d.contact.name+"'s Business"})
    });
  }catch(e){console.warn('Email send failed:',e);}
}

/* ═══════════════════════════════════════════════════════
   MAIN RENDER
═══════════════════════════════════════════════════════ */
function main(){
  const raw=localStorage.getItem('nexvora_assessment');
  if(!raw){
    document.getElementById('reportWrap').innerHTML=`
      <div style="text-align:center;padding:80px 20px;">
        <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">No assessment found</h2>
        <p style="color:#718096;margin-bottom:24px;">Please complete the assessment first to see your report.</p>
        <a href="assessment.html" style="padding:12px 28px;background:#0D9488;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">Start Assessment</a>
      </div>`;
    return;
  }
  const d=JSON.parse(raw);
  const scores=computeScores(d);
  const econ=computeOwnerEcon(d);

  renderHeader(d,scores);
  renderBenchmarks(d,d.ai_benchmark||'');
  renderOwnerEcon(d,econ);
  renderAreaAnalysis(d,scores,d.ai_summary||'');
  renderCTA(d);

  // Animate bars after short delay
  setTimeout(()=>{
    document.querySelectorAll('.area-bar,.rc-bar').forEach(bar=>{
      const w=bar.style.width;
      bar.style.width='0';
      setTimeout(()=>bar.style.width=w,100);
    });
  },300);

  // Send email
  sendEmail(d);
}

main();
</script>
</body>
</html>
```

- [ ] **Step 2: Test report.html with mock data in localStorage**

Open browser console on any page and run:
```javascript
localStorage.setItem('nexvora_assessment', JSON.stringify({
  contact:{name:'John Smith',email:'john@test.com',phone:'555-1234',company:'Clean Pro Services'},
  q1:'home-services',q2:'FL',q3:'3-5',q4:'300k-750k',q5:'6-15',
  q6:'notes',q7:45,q8:'nothing',q9:'word-of-mouth',q10:'4-4.5',
  q11:['scheduling','invoicing','reporting'],q12:'informal',q13:'tax-time',q14:'none',q15:'revenue',
  q16:'3k-5k',q17:65,q18:['daytime','evenings','weekends'],q19:'2k-3k',
  ai_benchmark:'You have operated a home services business in Florida for 3–5 years. Only 18% of businesses in your industry make it this far. That is not luck — that is execution.',
  ai_summary:'Your operations foundation is solid, but your sales follow-up gap and lack of reporting are costing you significant revenue every month. The single highest-priority fix right now is building a lead follow-up system.'
}));
```

Then open `report.html`. Verify:
- Header section renders with correct data, badges, overall score
- Benchmark section shows correct industry stats for Home Services
- Owner economics section shows correct hourly rate calculation (65hrs × 4.33 = 281hrs/month, $4000/281 = $14.23/hr)
- Team rate = $2500/194.85 = $12.83/hr → owner earns more
- All 9 area analysis blocks render — red first, yellow second, green last
- Score bars have color coding (red/yellow/green)
- CTA section shows countdown timer (if before May 1 2026)
- Countdown ticks every second
- "Download PDF" button triggers print dialog
- "Back to Home" returns to index.html
- Email confirm shows correct email address

- [ ] **Step 3: Commit**

```bash
git add report.html
git commit -m "feat: create report.html with scoring, benchmarks, owner economics, full analysis"
```

---

## Task 3: api/email.js — Email Endpoint

**Files:**
- Create: `api/email.js`

- [ ] **Step 1: Create the email API endpoint**

Create `api/email.js`:

```javascript
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, name, bizName } = req.body;
  if (!to || !name) return res.status(400).json({ error: 'to and name required' });

  const first = name.split(' ')[0];
  const reportUrl = `https://nexvorasystems.us/report.html`;

  // If Resend API key is set, use it. Otherwise log and return success.
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Nexvora Systems <info@nexvorasystems.us>',
          to: [to],
          subject: `Your Nexvora Business Health Report — ${bizName || name}`,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;color:#1A1A2E;">
              <img src="https://nexvorasystems.us/assets/Logo no background.png" alt="Nexvora Systems" style="height:44px;margin-bottom:24px;"/>
              <h1 style="font-size:22px;font-weight:800;margin-bottom:8px;">Your Business Health Report is ready, ${first}.</h1>
              <p style="font-size:15px;color:#4A5568;line-height:1.7;margin-bottom:20px;">Thank you for completing the Nexvora assessment. Your personalized report — including industry benchmarks, owner economics, and a full analysis of every area of your business — is ready to view.</p>
              <a href="${reportUrl}" style="display:inline-block;padding:14px 28px;background:#0D9488;color:#fff;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none;">View Your Report</a>
              <p style="font-size:13px;color:#718096;margin-top:24px;line-height:1.6;">Murat and Alexandr personally review every assessment. If you'd like to talk through your results, reply to this email or visit <a href="https://nexvorasystems.us/contact.html" style="color:#0D9488;">nexvorasystems.us/contact</a>.</p>
              <hr style="border:none;border-top:1px solid #E2DDD5;margin:24px 0;"/>
              <p style="font-size:12px;color:#A0ADB8;">© 2025 Nexvora Systems LLC · Tampa Bay, Florida · <a href="https://nexvorasystems.us/legal/privacy.html" style="color:#A0ADB8;">Privacy Policy</a></p>
            </div>
          `
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('Resend error:', err);
        return res.status(500).json({ error: 'Email failed to send' });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error('Email error:', error.message);
      return res.status(500).json({ error: 'Email failed to send' });
    }
  }

  // No Resend key — log and return success (email silently skipped)
  console.log(`[EMAIL SKIPPED — no RESEND_API_KEY] To: ${to}, Name: ${name}, Biz: ${bizName}`);
  return res.json({ success: true, note: 'Email skipped — no API key configured' });
};
```

- [ ] **Step 2: Test the endpoint**

Start `vercel dev` and run:
```bash
curl -X POST http://localhost:3000/api/email \
  -H "Content-Type: application/json" \
  -d '{"to":"test@test.com","name":"John Smith","bizName":"Clean Pro"}'
```
Expected response: `{"success":true,"note":"Email skipped — no API key configured"}` (if no RESEND_API_KEY set)

- [ ] **Step 3: Commit**

```bash
git add api/email.js
git commit -m "feat: add email API endpoint with Resend integration"
```

---

## Task 4: Final QA + Deploy

**Files:**
- No new files — verification only

- [ ] **Step 1: Full end-to-end test**

Run `vercel dev` locally. Open `http://localhost:3000/assessment.html`.

Complete the full flow:
1. Enter name, email, phone, company
2. Answer all 19 questions using chips and number inputs
3. Verify progress bar increments on each answer
4. Verify "Building your report" message appears after Q19
5. Wait for redirect to `report.html`
6. Verify all 6 sections render correctly
7. Verify scores are color-coded correctly
8. Verify countdown timer ticks
9. Click "Download PDF" → print dialog opens
10. Click "Back to Home" → goes to index.html
11. Click "Schedule Your Complimentary Call" → goes to contact.html

- [ ] **Step 2: Test no-data redirect**

Clear localStorage (`localStorage.removeItem('nexvora_assessment')`) and navigate directly to `report.html`.
Expected: "No assessment found" message with a link back to assessment.html.

- [ ] **Step 3: Test mobile layout**

Open Chrome DevTools → toggle device toolbar → iPhone 12 Pro (390px wide).
Check:
- Assessment chips wrap correctly and are tappable
- State grid is scrollable
- Number inputs are usable on mobile
- Report sections stack correctly
- Benchmark grid becomes single column
- Owner economics cards stack vertically
- CTA section text and buttons are readable

- [ ] **Step 4: Deploy**

```bash
cd "/Users/muratzhandaurov/Desktop/PRJOECTS/Nexvora/nexvora-wesbite/nexvora-website"
vercel --prod
```

Expected output includes: `Production: https://nexvora-website.vercel.app`

- [ ] **Step 5: Verify on production**

Open `https://nexvora-website.vercel.app/assessment.html` in browser.
Complete the full flow on production. Verify report page renders correctly.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete assessment redesign with 19-question flow, full report page, and email API"
```
