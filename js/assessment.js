/* ============================================================
   NEXVORA SYSTEMS — assessment.js
   15-question conversational business assessment engine
   ============================================================ */

// ── Questions ──
const QUESTIONS = [
  {
    id: 'q1',
    dimension: 'finance',
    text: "Tell me about your revenue — roughly how much does your business bring in per month, and do you have a clear picture of your profit margins?"
  },
  {
    id: 'q2',
    dimension: 'finance',
    text: "How do you currently track your expenses? Do you use software, or is it more manual?"
  },
  {
    id: 'q3',
    dimension: 'operations',
    text: "Walk me through a typical day — what does your team do without you directing them, and what requires your personal attention?"
  },
  {
    id: 'q4',
    dimension: 'operations',
    text: "Do you have documented processes or SOPs, or does most knowledge live in people's heads?"
  },
  {
    id: 'q5',
    dimension: 'sales',
    text: "How do customers find you, and what happens from first contact to becoming a paying client?"
  },
  {
    id: 'q6',
    dimension: 'sales',
    text: "How do you handle customer follow-ups after a sale or inquiry? Who does it, how often, what tools?"
  },
  {
    id: 'q7',
    dimension: 'marketing',
    text: "What marketing are you currently doing, and which channels bring in the most customers?"
  },
  {
    id: 'q8',
    dimension: 'customer_service',
    text: "How do you handle customer complaints, and how do you track satisfaction?"
  },
  {
    id: 'q9',
    dimension: 'hr',
    text: "How many employees do you have and what are their roles? Is there a clear org chart?"
  },
  {
    id: 'q10',
    dimension: 'hr',
    text: "What does your hiring process look like when you need someone new?"
  },
  {
    id: 'q11',
    dimension: 'it_automation',
    text: "What software does your business use day-to-day — scheduling, invoicing, communication, project management?"
  },
  {
    id: 'q12',
    dimension: 'it_automation',
    text: "Are there tasks your team does repeatedly that feel like they should be automated?"
  },
  {
    id: 'q13',
    dimension: 'reporting',
    text: "What numbers do you look at regularly to understand business performance? How do you get that information?"
  },
  {
    id: 'q14',
    dimension: 'structure',
    text: "If you stepped away for two weeks with no contact, what would break down? What would keep running?"
  },
  {
    id: 'q15',
    dimension: 'structure',
    text: "What's the single biggest challenge in your business right now — the thing keeping you up at night?"
  }
];

// ── Follow-up Tips ──
const FOLLOWUP_TIPS = {
  finance: {
    title: "On financial visibility",
    text: "Businesses that review profit margins weekly are 3x more likely to catch costly inefficiencies before they compound. Most owners only realize the damage during tax season."
  },
  operations: {
    title: "On operational dependency",
    text: "When the owner is the system, scaling becomes the owner's personal limit. Companies that document their top 10 processes first see the fastest team independence."
  },
  sales: {
    title: "On follow-up timing",
    text: "Leads contacted within 5 minutes convert at 4x the rate of leads contacted the next day. The response window is smaller than most owners think."
  },
  marketing: {
    title: "On marketing ROI",
    text: "Most small businesses spend on 4–6 channels but get 80% of results from 1–2. Knowing which ones saves thousands in wasted spend."
  },
  customer_service: {
    title: "On customer retention",
    text: "Acquiring a new customer costs 5x more than retaining an existing one. Most businesses invest heavily in acquisition and almost nothing in retention systems."
  },
  hr: {
    title: "On team structure",
    text: "Unclear roles are the #1 reason good employees underperform. When people know exactly what they own, productivity increases without adding headcount."
  },
  it_automation: {
    title: "On automation ROI",
    text: "Scheduling tools handle dispatch well — but 90% of businesses miss automated invoicing, client re-engagement, and review requests. The tool is only as good as how it's configured."
  },
  reporting: {
    title: "On decision data",
    text: "Owners who track 5 or fewer core KPIs make faster, better decisions than those tracking 20+. The goal is signal, not volume."
  },
  structure: {
    title: "On business resilience",
    text: "If everything breaks when you leave, that's not a team problem. It's a systems problem. And systems are solvable."
  }
};

// ── State ──
const state = {
  lead: null,
  currentQ: 0,
  answers: {},
  objections: [],
  followupsUsed: 0
};

// ── Helpers ──
function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scrollChat() {
  const msgs = document.getElementById('chatMessages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

// ── Overlay open / close ──
(function initOverlay() {
  const startBtn = document.getElementById('startAssessmentBtn');
  const overlay  = document.getElementById('assessmentOverlay');
  const closeBtn = document.getElementById('assessmentClose');

  if (startBtn && overlay) {
    startBtn.addEventListener('click', () => {
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      showPhase('phase1');
    });
  }

  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', () => {
      const confirmed = confirm('Are you sure you want to exit the assessment? Your progress will be lost.');
      if (confirmed) {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        resetAssessment();
      }
    });
  }
})();

function resetAssessment() {
  state.lead       = null;
  state.currentQ   = 0;
  state.answers    = {};
  state.objections = [];
  state.followupsUsed = 0;

  const msgs = document.getElementById('chatMessages');
  if (msgs) msgs.innerHTML = '';

  const form = document.getElementById('captureForm');
  if (form) form.reset();

  showPhase('phase1');
}

// ── Phase management ──
function showPhase(id) {
  document.querySelectorAll('.phase').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

// ── Phase 1: Lead capture ──
(function initLeadCapture() {
  const form = document.getElementById('captureForm');
  if (!form) return;

  const phoneInput = document.getElementById('capturePhone');
  if (phoneInput) {
    phoneInput.addEventListener('input', () => Nexvora.formatPhone(phoneInput));
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const err = form.querySelector('.form-error');

    const name    = document.getElementById('captureName');
    const company = document.getElementById('captureCompany');
    const email   = document.getElementById('captureEmail');
    const phone   = document.getElementById('capturePhone');
    const city    = document.getElementById('captureCity');
    const st      = document.getElementById('captureState');

    const fields  = [name, company, email, phone, city, st];
    let valid     = true;

    fields.forEach(f => {
      if (!f || !f.value.trim()) valid = false;
    });

    if (email) {
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRx.test(email.value.trim())) valid = false;
    }

    if (!valid) {
      if (err) err.classList.add('visible');
      return;
    }

    if (err) err.classList.remove('visible');

    state.lead = {
      name:    name.value.trim(),
      company: company.value.trim(),
      email:   email.value.trim(),
      phone:   phone.value.trim(),
      city:    city.value.trim(),
      state:   st.value.trim()
    };

    Nexvora.save('lead', state.lead);
    startChat();
  });
})();

// ── Conversational acknowledgments ──
// Respond naturally to each answer before asking next question

const ACKNOWLEDGMENTS = {
  finance: {
    positive: [
      "Good — having that financial visibility puts you ahead of most businesses we work with.",
      "That's a solid foundation. Knowing your margins week to week is actually rare.",
      "Great, that level of clarity makes it much easier to identify where the real leaks are.",
    ],
    negative: [
      "Understood — that's actually one of the most common gaps we find. The good news is it's very fixable.",
      "That's more common than you'd think. Most business owners are flying on feel rather than data.",
      "Got it. This is exactly where we usually find the first recoverable dollars.",
    ],
    neutral: [
      "Appreciated. Even rough numbers help us calibrate the picture for you.",
      "Thanks for that context — it gives us something to work with.",
    ],
  },
  operations: {
    positive: [
      "That's impressive — a team that runs without constant direction is one of the biggest assets a business can have.",
      "Documented processes are a competitive advantage most owners underestimate. Good.",
      "That kind of system independence is rare. It means you can scale without just adding chaos.",
    ],
    negative: [
      "I hear you — that dependency on one person is one of the most common bottlenecks we see.",
      "That's honest, and it's something we can address. Knowledge trapped in people's heads is a real liability.",
      "Understood. When the owner is the system, every vacation becomes a risk.",
    ],
    neutral: [
      "That makes sense — most businesses are somewhere in between. Let's dig a bit deeper.",
      "Got it. The details here matter, so I appreciate you sharing what's actually going on.",
    ],
  },
  sales: {
    positive: [
      "A CRM with consistent follow-up is a real revenue multiplier — that's a strong position.",
      "That kind of systematic approach to the pipeline is exactly what separates growing businesses from stagnant ones.",
      "Good — a defined path from lead to client means fewer deals fall through the cracks.",
    ],
    negative: [
      "That's one of the highest-impact areas we work on. Inconsistent follow-up alone can account for 20–30% lost revenue.",
      "Totally understandable — most businesses grow on referrals until they don't, and by then the pipeline gap is obvious.",
      "Word of mouth is a great start, but it's unpredictable. That's something we can systematize.",
    ],
    neutral: [
      "Makes sense. The sales pipeline is often where the biggest recoverable dollars hide.",
      "Thanks for the honest picture — it helps me understand exactly where you're starting from.",
    ],
  },
  marketing: {
    positive: [
      "Knowing which channels drive results — and cutting the rest — is a discipline most businesses never develop.",
      "Measured marketing is genuinely rare. That's a strong foundation.",
      "Good. When you can tie spend to outcomes, you can scale what works.",
    ],
    negative: [
      "That's a very common place to over-spend and under-measure. There's usually a clear winner hiding in there.",
      "Understood. Scattered marketing spend without attribution is one of the fastest ways to drain margin.",
      "Honest answer — and that honesty is what makes an assessment actually useful.",
    ],
    neutral: [
      "Appreciate that. Marketing ROI is one of the first places we look for recoverable budget.",
      "Got it — let's keep going, this is useful context.",
    ],
  },
  customer_service: {
    positive: [
      "Proactive retention is genuinely rare — most businesses only notice churn after it happens.",
      "Systematic satisfaction tracking separates businesses that retain customers from those that constantly chase new ones.",
      "Good. A customer who feels heard is worth four new ones on average.",
    ],
    negative: [
      "That's very common. Retention systems are usually the last thing businesses formalize — and often the most valuable.",
      "Understood. Most service gaps are invisible until a customer quietly leaves and you never know why.",
      "Got it. This is one of the highest-ROI areas to systematize.",
    ],
    neutral: [
      "Makes sense — let's keep moving. Every detail helps.",
      "Appreciated. Customer experience is often where the hidden revenue lives.",
    ],
  },
  hr: {
    positive: [
      "Clear roles and structured onboarding are force multipliers — they let good people perform at their best.",
      "Having an org chart people actually follow is more valuable than most owners realize.",
      "That kind of structural clarity means less firefighting and more consistent execution.",
    ],
    negative: [
      "Unclear ownership is the silent killer of most growing teams. It's very fixable, but it compounds fast.",
      "That's honest — 'everyone does everything' usually means some things don't get done well by anyone.",
      "Understood. Team structure is one of the fastest levers we pull.",
    ],
    neutral: [
      "Got it — team dynamics have a real financial cost when they're not working. Let's keep going.",
      "Appreciate you sharing that. It helps me calibrate what we're working with.",
    ],
  },
  it_automation: {
    positive: [
      "Integrated tools that talk to each other save more time than most businesses realize — good position.",
      "Automation maturity is a real competitive edge. That's worth protecting and expanding.",
      "Good — tech that actually supports the workflow is a multiplier, not just overhead.",
    ],
    negative: [
      "Disconnected tools are one of the most common hidden costs — the manual workarounds add up fast.",
      "That's the norm for growing businesses. Spreadsheets work until they don't, and then they really don't.",
      "Understood. There's usually 5–10 hours per week recoverable just from basic automation improvements.",
    ],
    neutral: [
      "Makes sense — technology fit is highly specific to how you operate. Let's keep going.",
      "Got it. Tech stack details help us pinpoint where the friction is.",
    ],
  },
  reporting: {
    positive: [
      "Real-time visibility on the right numbers is genuinely uncommon. That's a decision-making advantage.",
      "Fewer metrics, looked at regularly, is actually the right approach. Most businesses drown in data they never act on.",
      "Good — when you know your numbers, you can trust your instincts.",
    ],
    negative: [
      "Making decisions by gut feel is common, but it means you can't tell which problems are real until they're big.",
      "Quarterly reports are a rear-view mirror. We usually help businesses move to weekly leading indicators.",
      "Understood — visibility is often the first thing we fix because everything else depends on it.",
    ],
    neutral: [
      "Appreciate that. Reporting gaps are often invisible until a decision goes wrong.",
      "Got it — let's keep moving.",
    ],
  },
  structure: {
    positive: [
      "Business resilience is something most owners only test during a crisis. Sounds like you've built well.",
      "Systems that run without you present are the difference between owning a business and being trapped by one.",
      "That's a strong position — it means your value isn't tied to your personal bandwidth.",
    ],
    negative: [
      "That's the most honest answer you can give — and it's exactly what we help fix.",
      "When the answer is 'everything would break,' it's not a people problem — it's a systems problem.",
      "Understood. This is usually where the highest-value work happens.",
    ],
    neutral: [
      "That's a revealing question — most businesses have a mix. Appreciate the honest reflection.",
      "Got it — this helps us understand where the real fragility lives.",
    ],
  },
};

// Detect positive/negative signal in answer
function classifyAnswer(text, dimension) {
  if (!text || !DIMENSION_KEYWORDS[dimension]) return 'neutral';
  const lower = text.toLowerCase();
  const kw = DIMENSION_KEYWORDS[dimension];
  let pos = 0, neg = 0;
  kw.positive.forEach(w => { if (lower.includes(w)) pos++; });
  kw.negative.forEach(w => { if (lower.includes(w)) neg++; });
  if (pos > neg + 1) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

// Pick a random item from array
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate natural acknowledgment before next question
function getAcknowledgment(answer, dimension) {
  const words = answer.trim().split(/\s+/).length;
  const sentiment = classifyAnswer(answer, dimension);

  // Long detailed answers get a specific thank-you first
  let prefix = '';
  if (words >= 55) {
    prefix = `Thank you for that detailed answer — that level of context is exactly what helps us give you a more accurate picture. `;
  } else if (words >= 30) {
    prefix = `Appreciate the detail. `;
  }

  const pool = ACKNOWLEDGMENTS[dimension]?.[sentiment] || ACKNOWLEDGMENTS[dimension]?.neutral || [];
  const base  = pool.length ? pick(pool) : "Got it — that's helpful context.";
  return prefix + base;
}

// ── Chat engine ──
function startChat() {
  showPhase('phase2');
  state.currentQ = 0;
  // Warm greeting using the lead's first name
  const firstName = state.lead ? state.lead.name.split(' ')[0] : '';
  const greeting = firstName
    ? `Hi ${firstName} — I'm going to ask you ${QUESTIONS.length} questions about how your business operates right now. Be as honest as you like; there are no wrong answers. Ready? Let's start.`
    : `I'm going to ask you ${QUESTIONS.length} questions about how your business operates right now. Be as honest as you like — there are no wrong answers. Let's start.`;

  setTimeout(() => {
    addAIMessage(greeting);
    setTimeout(() => askQuestion(0), 1400);
  }, 600);
}

function updateProgress(qIndex) {
  const total    = QUESTIONS.length;
  const pct      = Math.round((qIndex / total) * 100);
  const textEl   = document.getElementById('chatProgressText');
  const barEl    = document.getElementById('progressBarFill');
  const pctEl    = document.getElementById('progressPct');

  if (textEl) textEl.textContent = `Question ${qIndex + 1} of ${total}`;
  if (barEl)  barEl.style.width  = pct + '%';
  if (pctEl)  pctEl.textContent  = pct + '%';
}

function showTyping() {
  const msgs  = document.getElementById('chatMessages');
  if (!msgs) return null;

  const wrap  = document.createElement('div');
  wrap.classList.add('msg', 'typing-indicator-wrap');

  const indicator = document.createElement('div');
  indicator.classList.add('typing-indicator');
  indicator.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';

  wrap.appendChild(indicator);
  msgs.appendChild(wrap);
  scrollChat();
  return wrap;
}

function askQuestion(index) {
  if (index >= QUESTIONS.length) {
    finishChat();
    return;
  }

  updateProgress(index);

  const typingEl = showTyping();

  setTimeout(() => {
    if (typingEl) typingEl.remove();
    addAIMessage(QUESTIONS[index].text);
  }, 900);
}

function addAIMessage(text) {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return;

  const msg = document.createElement('div');
  msg.classList.add('msg');

  const avatar = document.createElement('div');
  avatar.classList.add('msg-avatar');
  avatar.textContent = 'N';

  const bubble = document.createElement('div');
  bubble.classList.add('msg-bubble');
  bubble.textContent = text;

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  msgs.appendChild(msg);
  scrollChat();
}

function addUserMessage(text) {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return;

  const initials = state.lead
    ? state.lead.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  const msg = document.createElement('div');
  msg.classList.add('msg', 'user');

  const avatar = document.createElement('div');
  avatar.classList.add('msg-avatar');
  avatar.textContent = initials;

  const bubble = document.createElement('div');
  bubble.classList.add('msg-bubble');
  bubble.textContent = text;

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  msgs.appendChild(msg);
  scrollChat();
}

function submitAnswer() {
  const input = document.getElementById('chatInput');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  // Disable input while AI responds
  input.disabled = true;
  const sendBtn = document.getElementById('chatSend');
  if (sendBtn) sendBtn.disabled = true;

  addUserMessage(text);

  const q = QUESTIONS[state.currentQ];
  const dimension = q ? q.dimension : 'structure';
  if (q) {
    state.answers[q.id] = { dimension: q.dimension, text };
  }

  input.value = '';
  input.style.height = 'auto';

  const nextQ = state.currentQ + 1;
  state.currentQ = nextQ;

  // Show acknowledgment then next question
  const ack = getAcknowledgment(text, dimension);
  const typingDelay = 700;
  const ackDelay = typingDelay + 400;
  const nextDelay = ackDelay + ack.length * 18; // reading time proportional to length

  setTimeout(() => {
    const typingEl = showTyping();
    setTimeout(() => {
      if (typingEl) typingEl.remove();
      addAIMessage(ack);

      // Re-enable input
      input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      input.focus();

      setTimeout(() => askQuestion(nextQ), 600);
    }, ackDelay - typingDelay);
  }, typingDelay);
}

// ── Chat input controls ──
(function initChatInput() {
  const sendBtn = document.getElementById('chatSend');
  const input   = document.getElementById('chatInput');

  if (sendBtn) {
    sendBtn.addEventListener('click', submitAnswer);
  }

  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitAnswer();
      }
    });

    input.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  }
})();

// ── Finish chat ──
function finishChat() {
  const input   = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSend');

  if (input)   { input.disabled = true; input.placeholder = 'Assessment complete'; }
  if (sendBtn) sendBtn.disabled = true;

  const barEl  = document.getElementById('progressBarFill');
  const pctEl  = document.getElementById('progressPct');
  const textEl = document.getElementById('chatProgressText');
  if (barEl)  barEl.style.width  = '100%';
  if (pctEl)  pctEl.textContent  = '100%';
  if (textEl) textEl.textContent = `Question ${QUESTIONS.length} of ${QUESTIONS.length}`;

  showPhase('phase3');
  runAnalysis();
}

// ── Analysis animation ──
function runAnalysis() {
  const items    = document.querySelectorAll('#analysisChecklist .checklist-item');
  const delays   = [1200, 2800, 4600, 7000];

  items.forEach((item, i) => {
    setTimeout(() => item.classList.add('active'), delays[i] || delays[delays.length - 1]);
  });

  setTimeout(() => {
    items.forEach(item => item.classList.add('active'));
    computeReport();
    showPhase('phase4');
    animateRevealCounters();
  }, 9000);
}

// ── Keyword-weighted scoring ──
// Each dimension has positive keywords (boost score) and negative keywords (lower score)
const DIMENSION_KEYWORDS = {
  finance: {
    positive: ['software', 'tracked', 'quickbooks', 'xero', 'clear', 'margins', 'dashboard', 'weekly', 'monthly', 'reports', 'bookkeeper', 'accountant', 'profitable', 'automated'],
    negative: ['manual', 'excel', 'spreadsheet', "don't know", 'unclear', 'no idea', 'guess', 'approximate', 'behind', 'never', 'sometimes'],
  },
  operations: {
    positive: ['sop', 'documented', 'process', 'system', 'runs itself', 'team handles', 'delegated', 'automated', 'checklist', 'playbook', 'trained', 'independent'],
    negative: ['me', 'i do', 'myself', 'manual', 'in my head', "in people's heads", 'no process', 'chaotic', 'depends on me', 'constantly', 'firefighting'],
  },
  sales: {
    positive: ['crm', 'pipeline', 'follow-up', 'automated', 'system', 'referrals', 'consistent', 'tracked', 'funnel', 'conversion', 'outreach', 'nurture'],
    negative: ['word of mouth', 'no system', 'forget', 'inconsistent', 'manual', 'hope', 'whenever', 'rarely', 'sometimes', 'lose track'],
  },
  marketing: {
    positive: ['google', 'facebook', 'ads', 'seo', 'email', 'content', 'social', 'tracked', 'roi', 'analytics', 'strategy', 'consistent', 'agency'],
    negative: ['nothing', 'not much', 'word of mouth', 'no budget', 'randomly', 'not sure', 'whatever', 'same as always'],
  },
  customer_service: {
    positive: ['survey', 'nps', 'reviews', 'crm', 'ticketing', 'tracked', 'follow-up', 'dedicated', 'sla', 'resolved', 'process', 'system'],
    negative: ['manually', 'no system', 'ad hoc', 'email', 'phone call', 'no tracking', 'not sure', 'rarely', 'complaints'],
  },
  hr: {
    positive: ['org chart', 'clear roles', 'job descriptions', 'onboarding', 'handbook', 'structured', 'hris', 'defined', 'regular reviews', 'training'],
    negative: ['no org chart', 'unclear', 'everyone does everything', 'chaos', 'no process', 'whoever', 'figure it out'],
  },
  it_automation: {
    positive: ['zapier', 'make', 'integrated', 'automated', 'connected', 'api', 'crm', 'erp', 'software', 'digital', 'ai', 'tools', 'workflow'],
    negative: ['manual', 'excel', 'spreadsheet', 'email', 'paper', 'disconnected', 'no', 'nothing', 'phone'],
  },
  reporting: {
    positive: ['dashboard', 'weekly', 'daily', 'kpi', 'metrics', 'data', 'analytics', 'report', 'tableau', 'power bi', 'real-time', 'automated'],
    negative: ['gut', 'feeling', 'not sure', 'occasionally', 'manual', 'spreadsheet', 'rarely', 'quarterly', 'no'],
  },
  structure: {
    positive: ['team handles', 'documented', 'process', 'would keep running', 'redundancy', 'delegate', 'sop', 'systems', 'operations continue'],
    negative: ['break down', 'fall apart', 'need me', 'stop', 'chaos', 'nobody knows', 'only i know', 'everything would stop'],
  },
};

function scoreAnswer(answerText, dimension) {
  if (!answerText || !DIMENSION_KEYWORDS[dimension]) return 50;

  const lower = answerText.toLowerCase();
  const kw = DIMENSION_KEYWORDS[dimension];

  let positiveHits = 0;
  let negativeHits = 0;

  kw.positive.forEach(word => { if (lower.includes(word)) positiveHits++; });
  kw.negative.forEach(word => { if (lower.includes(word)) negativeHits++; });

  // Base score 35–65 range, shifted by keyword hits
  // Each positive hit = +8, each negative hit = -9 (negatives slightly stronger signal)
  const answerLength = Math.min(answerText.trim().split(/\s+/).length, 80);
  const lengthBonus  = Math.floor(answerLength / 20) * 3; // longer answers = slightly more mature

  const raw = 50 + (positiveHits * 8) - (negativeHits * 9) + lengthBonus;
  // Clamp 18–90 to avoid extremes
  return Math.min(90, Math.max(18, Math.round(raw)));
}

// ── Compute report (keyword-weighted, not random) ──
// OLD_APRIL5: Previous version used Math.random() — replaced with keyword scoring
function computeReport() {
  const dimensions = ['finance', 'operations', 'sales', 'marketing', 'customer_service', 'hr', 'it_automation', 'reporting', 'structure'];
  const scores = {};

  dimensions.forEach(dim => {
    // Find all answers for this dimension and average their scores
    const dimAnswers = Object.values(state.answers).filter(a => a.dimension === dim);
    if (dimAnswers.length === 0) {
      scores[dim] = 45; // neutral default if no answer for this dimension
    } else {
      const total = dimAnswers.reduce((sum, a) => sum + scoreAnswer(a.text, dim), 0);
      scores[dim] = Math.round(total / dimAnswers.length);
    }
  });

  window.reportData = {
    scores:     scores,
    objections: state.objections,
    lead:       state.lead,
  };

  Nexvora.save('reportData', window.reportData);
  sendLeadToGHL();
}

// ── GHL Webhook — send assessment results ──
const GHL_WEBHOOK_URL = 'REPLACE_WITH_YOUR_GHL_WEBHOOK';

async function sendLeadToGHL() {
  if (!state.lead || GHL_WEBHOOK_URL === 'REPLACE_WITH_YOUR_GHL_WEBHOOK') return;

  const scores = window.reportData ? window.reportData.scores : {};
  const vals   = Object.values(scores);
  const avg    = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  const critical = vals.filter(s => s < 40).length;

  const payload = {
    // Contact fields
    first_name:    state.lead.name.split(' ')[0] || state.lead.name,
    last_name:     state.lead.name.split(' ').slice(1).join(' ') || '',
    email:         state.lead.email,
    phone:         state.lead.phone,
    company_name:  state.lead.company,
    city:          state.lead.city,
    state:         state.lead.state,
    // Assessment results
    source:        'nexvora_assessment',
    overall_score: avg,
    critical_areas: critical,
    scores_json:   JSON.stringify(scores),
    timestamp:     new Date().toISOString(),
  };

  try {
    await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('GHL webhook delivery failed:', e);
  }
}

// ── Animate reveal counters ──
function animateRevealCounters() {
  const scores    = window.reportData ? window.reportData.scores : {};
  const vals      = Object.values(scores);

  let critical = 0;
  let warning  = 0;
  let good     = 0;

  vals.forEach(s => {
    if (s < 40)       critical++;
    else if (s < 65)  warning++;
    else              good++;
  });

  const subtext = document.getElementById('revealSubtext');
  if (subtext) {
    let msg = '';
    if (critical > 0) {
      msg += `<strong>${critical} area${critical > 1 ? 's' : ''}</strong> need${critical === 1 ? 's' : ''} immediate attention. `;
    }
    if (warning > 0) {
      msg += `<strong>${warning} area${warning > 1 ? 's' : ''}</strong> ${warning === 1 ? 'has' : 'have'} room for improvement. `;
    }
    if (good > 0) {
      msg += `<strong>${good} area${good > 1 ? 's' : ''}</strong> ${good === 1 ? 'is' : 'are'} performing well.`;
    }
    subtext.innerHTML = msg;
  }

  const counters = [
    { id: 'revealCritical', val: critical, delay: 200 },
    { id: 'revealWarning',  val: warning,  delay: 500 },
    { id: 'revealGood',     val: good,     delay: 800 }
  ];

  counters.forEach(({ id, val, delay }) => {
    setTimeout(() => {
      const wrap = document.getElementById(id);
      if (!wrap) return;
      wrap.classList.add('visible');
      const numEl = wrap.querySelector('.reveal-count-number, .counter-number, [data-counter]');
      if (numEl) Nexvora.countUp(numEl, val);
    }, delay);
  });

  // Also handle generic .reveal-counter elements
  document.querySelectorAll('.reveal-counter').forEach((el, i) => {
    setTimeout(() => el.classList.add('visible'), 200 + i * 300);
  });
}

// ── Show report button ──
(function initShowReport() {
  const btn = document.getElementById('showReportBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    showPhase('phase5');
    if (typeof window.initReportWizard === 'function') {
      window.initReportWizard();
    }
  });
})();

// ── Exports ──
window.assessmentState  = state;
window.FOLLOWUP_TIPS    = FOLLOWUP_TIPS;
window.showPhase        = showPhase;
