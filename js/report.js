/* ============================================================
   NEXVORA SYSTEMS — report.js
   8-slide report wizard + conclusion slide
   ============================================================ */

// ── Departments ──
const DEPARTMENTS = [
  { key: 'finance',          name: 'Finance & Revenue',     icon: '💰' },
  { key: 'operations',       name: 'Operations & Processes', icon: '🔧' },
  { key: 'sales',            name: 'Sales & Follow-Up',     icon: '📞' },
  { key: 'marketing',        name: 'Marketing',             icon: '📢' },
  { key: 'customer_service', name: 'Customer Service',      icon: '⭐' },
  { key: 'hr',               name: 'HR & People',           icon: '👥' },
  { key: 'it_automation',    name: 'IT & Automation',       icon: '⚡' },
  { key: 'reporting',        name: 'Reporting & Data',      icon: '📊' }
];

// ── Score helpers ──
function getBadgeClass(score) {
  if (score < 40) return 'critical';
  if (score < 65) return 'warning';
  return 'good';
}

function getBadgeLabel(score) {
  if (score < 40) return 'Critical';
  if (score < 65) return 'Needs Improvement';
  return 'Strong';
}

function getBarClass(score) {
  return getBadgeClass(score);
}

// ── Loss data per dimension ──
function getLossData(dim, score) {
  const isCritical = score < 40;

  const map = {
    finance: {
      critical: {
        amount: '$2,800',
        unit: 'month',
        label: 'untracked financial loss',
        items: [
          'Unreconciled expenses eroding net profit',
          'No visibility into which services are most profitable',
          'Tax-season surprises due to no monthly close process'
        ]
      },
      warning: {
        amount: '$1,200',
        unit: 'month',
        label: 'estimated untracked loss',
        items: [
          'Partial expense tracking leaving gaps in margin data',
          'Delayed invoicing costing cash-flow timing',
          'No automated reconciliation between bank and books'
        ]
      }
    },
    operations: {
      critical: {
        amount: '15',
        unit: 'hrs/week',
        label: 'owner time on tasks that could be delegated',
        items: [
          'Key processes exist only in the owner\'s head',
          'Team unable to resolve issues without escalation',
          'No documented workflows for onboarding or fulfillment'
        ]
      },
      warning: {
        amount: '8',
        unit: 'hrs/week',
        label: 'owner time that could be recaptured',
        items: [
          'Some processes documented but inconsistently followed',
          'Team partially autonomous — but decision bottlenecks remain',
          'No version-controlled SOP library'
        ]
      }
    },
    sales: {
      critical: {
        amount: '$4,200',
        unit: 'month',
        label: 'in unconverted leads',
        items: [
          'No structured follow-up sequence after first contact',
          'Lead response time exceeds industry conversion window',
          'No CRM tracking what stage each prospect is in'
        ]
      },
      warning: {
        amount: '$1,800',
        unit: 'month',
        label: 'in missed conversion revenue',
        items: [
          'Follow-up is manual and inconsistent across the team',
          'No automated reminders for stale leads',
          'Proposal-to-close tracking is informal'
        ]
      }
    },
    marketing: {
      critical: {
        amount: '$1,600',
        unit: 'month',
        label: 'in wasted marketing spend',
        items: [
          'Budget spread across channels with no attribution tracking',
          'No A/B testing or performance benchmarks per channel',
          'Marketing and sales teams not sharing lead quality data'
        ]
      },
      warning: {
        amount: '$800',
        unit: 'month',
        label: 'in estimated wasted spend',
        items: [
          'Some channels tracked but ROI not calculated per dollar',
          'Content calendar exists but performance reviewed infrequently',
          'Retargeting and email nurture not fully utilized'
        ]
      }
    },
    customer_service: {
      critical: {
        amount: '22%',
        unit: 'annual',
        label: 'estimated customer churn rate',
        items: [
          'No formal complaint resolution process or escalation path',
          'Customer satisfaction not measured or tracked',
          'Repeat issues not flagged for root-cause analysis'
        ]
      },
      warning: {
        amount: '12%',
        unit: 'annual',
        label: 'estimated customer churn rate',
        items: [
          'Satisfaction surveys sent but results not acted on systematically',
          'Some complaint handling documented, gaps remain',
          'No proactive check-in process for key accounts'
        ]
      }
    },
    hr: {
      critical: {
        amount: '40%',
        unit: '',
        label: 'estimated productivity gap from unclear roles',
        items: [
          'No org chart or defined ownership per function',
          'Hiring is reactive with no documented interview process',
          'Onboarding relies on tribal knowledge, not documented steps'
        ]
      },
      warning: {
        amount: '20%',
        unit: '',
        label: 'estimated productivity gap',
        items: [
          'Role definitions exist but overlap causes friction',
          'Hiring process partially documented — inconsistent application',
          'No 30/60/90-day ramp plan for new hires'
        ]
      }
    },
    it_automation: {
      critical: {
        amount: '$3,200',
        unit: 'month',
        label: 'in manual labor costs that could be automated',
        items: [
          'Invoicing, scheduling, or follow-up handled entirely by hand',
          'No integration between key software tools (double-entry)',
          'Review requests and re-engagement campaigns not automated'
        ]
      },
      warning: {
        amount: '$1,400',
        unit: 'month',
        label: 'in automatable manual costs',
        items: [
          'Some automation in place but key workflows still manual',
          'Tools are not integrated — staff copy data between systems',
          'Automated follow-up exists but not optimized for conversion'
        ]
      }
    },
    reporting: {
      critical: {
        amount: '8',
        unit: 'hrs/week',
        label: 'spent on manual reporting that could be automated',
        items: [
          'No live dashboard — reports built manually from raw data',
          'KPIs not defined or inconsistently measured across the team',
          'Decisions made on lagging data or gut feel'
        ]
      },
      warning: {
        amount: '4',
        unit: 'hrs/week',
        label: 'spent on manual reporting',
        items: [
          'Some reporting automated but key metrics still pulled manually',
          'Dashboard exists but not reviewed on a consistent cadence',
          'Multiple sources of truth create conflicting report versions'
        ]
      }
    }
  };

  const dimData = map[dim];
  if (!dimData) {
    return { amount: 'N/A', unit: '', label: 'data unavailable', items: [] };
  }
  return isCritical ? dimData.critical : dimData.warning;
}

// ── Analysis text per dimension ──
function getAnalysisText(dim, score, lead) {
  const company = lead && lead.company ? escapeHtmlReport(lead.company) : 'your business';
  const city    = lead && lead.city    ? escapeHtmlReport(lead.city)    : 'your area';

  const map = {
    finance: {
      critical: `Based on what you've shared, ${company} is operating without reliable visibility into its margins. For businesses at this stage in ${city}, that typically means profit leaks go undetected for months — often discovered only when cash flow tightens unexpectedly. Without a consistent monthly close and expense categorization system, there is no reliable baseline to make pricing or investment decisions from.`,
      warning:  `${company} has some financial tracking in place, but gaps in expense categorization or margin review create blind spots. In competitive markets like ${city}, even a 5–10% margin variance left unmonitored can compound into a significant annual loss. The current setup is functional but not giving you the decision-grade data you need.`,
      good:     `${company} shows solid financial hygiene — expenses are tracked, margins are understood, and there's a clear picture of where revenue comes from. In ${city}'s market environment, that puts you ahead of most businesses at this size. The opportunity now is turning that visibility into forward-looking forecasting, not just historical reporting.`
    },
    operations: {
      critical: `The picture that emerges for ${company} is one where the owner is the operating system. In ${city} and markets like it, this is the single most common reason businesses plateau — the ceiling isn't market size, it's the hours in the founder's day. When processes aren't documented, every new hire starts from zero and every absence creates a service gap.`,
      warning:  `${company} has some structure, but it's fragile. Key processes exist in people's heads more than on paper, which means your team's performance is personality-dependent rather than system-dependent. In ${city}, businesses that document their top workflows reduce onboarding time by 50% and cut owner involvement in daily decisions significantly.`,
      good:     `${company} has built real operational structure. Your team can function with reasonable independence and key processes are documented well enough to be repeatable. For a business in ${city}, that level of operational clarity is a genuine competitive advantage when it comes to scaling, hiring, or eventually stepping back.`
    },
    sales: {
      critical: `The data suggests ${company} is losing a meaningful percentage of leads not to competitors, but to slow or absent follow-up. In ${city}'s market, buyers are comparing multiple options simultaneously — the business that responds fastest and most consistently wins, regardless of price. Without a defined pipeline and follow-up cadence, revenue is being left on the table every week.`,
      warning:  `${company} has a working sales process, but it relies too heavily on individual effort rather than a documented system. In ${city}, inconsistent follow-up — even when the initial contact is strong — results in leads going cold that would have converted with the right sequence. The gap isn't the product or the pitch, it's the structure around it.`,
      good:     `${company} demonstrates a functional and reasonably consistent sales process. You know how customers come in and what happens from first contact to close. For ${city}'s competitive landscape, that clarity is valuable — and the opportunity ahead is systematizing the parts that still depend on individual judgment.`
    },
    marketing: {
      critical: `Based on what you've described, ${company} is investing in marketing without clear attribution data to justify where each dollar goes. In ${city}, businesses that can't identify their best-performing channel end up spreading budget across activities that produce very different results. The cost isn't just wasted spend — it's the opportunity cost of not doubling down on what actually works.`,
      warning:  `${company} is generating leads from marketing, but the measurement layer isn't tight enough to know which channels are earning their investment. In ${city}'s environment, that ambiguity means some spend is working hard and some isn't — and right now they look identical on the surface. Tightening attribution by even one or two channels would change the picture quickly.`,
      good:     `${company} has a clear enough handle on its marketing channels to make directional decisions. You know roughly what's working and what isn't, which puts you ahead of most businesses in ${city} at this stage. The opportunity is shifting from "roughly working" to precisely measured — with the ability to scale the top channel confidently.`
    },
    customer_service: {
      critical: `The pattern at ${company} suggests customer issues are being resolved reactively, without a system for tracking satisfaction or identifying repeat problems. In ${city}, word-of-mouth is a primary growth driver for most local businesses — which means unresolved complaints don't stay private. A business losing customers at this rate is paying acquisition costs twice to stand still.`,
      warning:  `${company} handles complaints when they arise, but there's no consistent system for capturing satisfaction data or preventing issues from recurring. In ${city}'s market, customers who have a good recovery experience after a problem are actually more loyal than those who never had an issue — but only when the recovery is fast and structured.`,
      good:     `${company} has established reliable processes for handling customer issues and tracking satisfaction. That's a genuine differentiator in ${city}'s market, where most businesses are still operating on gut feel about how happy their customers are. The data you're capturing now is the foundation for building retention programs that compound over time.`
    },
    hr: {
      critical: `The structure at ${company} right now is creating invisible drag on performance. When roles aren't clearly defined, people default to the tasks they're comfortable with rather than the tasks the business needs — and accountability becomes nearly impossible to enforce. In ${city}'s labor market, unclear expectations are also one of the top reasons strong employees quietly start looking elsewhere.`,
      warning:  `${company} has role definitions in place, but overlapping responsibilities or informal authority structures are creating friction. In ${city}, this typically manifests as tasks falling through the cracks between departments or decisions getting delayed because it's unclear who owns them. The org chart might exist on paper but not in daily behavior.`,
      good:     `${company} has done the foundational work of defining roles and building a recognizable hiring process. In ${city}'s competitive hiring environment, that structure is a real advantage — candidates can see clear expectations and a professional onboarding experience, which improves quality of hire and early retention.`
    },
    it_automation: {
      critical: `The technology picture at ${company} reflects a business where software is being used to record information, not to run processes. In ${city} and markets like it, every task that requires a human to manually trigger, copy, or remind is a task that will eventually get dropped, delayed, or done inconsistently. The cost isn't just labor time — it's the compounding effect of processes that can't scale.`,
      warning:  `${company} uses software but the tools aren't fully connected, which means staff are bridging gaps manually. In ${city}, this is extremely common — businesses adopt tools over time for specific needs without a strategy for how they communicate with each other. The result is parallel data entry, version conflicts, and automation that handles only part of a workflow.`,
      good:     `${company} has a reasonably integrated tech stack for its current scale. You're using automation where it matters most, and your team isn't spending significant time on tasks that should be handled by software. In ${city}'s competitive environment, that efficiency advantage translates directly into faster service delivery and lower overhead per transaction.`
    },
    reporting: {
      critical: `At ${company}, business decisions are currently being made without a reliable, consistent data layer. In ${city}'s market, the businesses that grow fastest aren't necessarily the ones with the most data — they're the ones who look at the right 4 or 5 numbers every week without exception. Right now, getting those numbers requires manual effort, which means they get pulled inconsistently or not at all.`,
      warning:  `${company} has some reporting in place but it's not yet the kind of live, actionable visibility that drives fast decisions. In ${city}, businesses that rely on end-of-month reports are always making decisions about last month — not what's happening right now. The gap between data collected and data acted on is where most of the value gets lost.`,
      good:     `${company} has a working reporting cadence and knows which numbers matter. In ${city}'s environment, that puts you in a strong position to make faster, more confident decisions than competitors who are still guessing. The next step is moving from periodic reviews to near-real-time dashboards that flag issues before they become problems.`
    }
  };

  const dimData = map[dim];
  if (!dimData) return `${company} shows activity in this area. A deeper review would help identify specific opportunities for improvement.`;

  if (score < 40) return dimData.critical;
  if (score < 65) return dimData.warning;
  return dimData.good;
}

function escapeHtmlReport(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Wizard state ──
let wizardCurrentSlide = 0;
const TOTAL_SLIDES     = 9; // 8 departments + 1 conclusion

// ── Init report wizard ──
window.initReportWizard = function () {
  const rd   = window.reportData;
  const lead = window.assessmentState ? window.assessmentState.lead : null;

  if (!rd) return;

  // Clear previous build
  const dotsEl  = document.getElementById('wizardDots');
  const bodyEl  = document.getElementById('wizardBody');
  if (dotsEl)  dotsEl.innerHTML  = '';
  if (bodyEl)  bodyEl.innerHTML  = '';

  buildWizardDots();
  buildSlides(rd, lead);
  buildConclusionSlide(rd, lead);
  bindWizardNav();
  bindWizardBodyEvents();
  goToSlide(0);
};

// ── Build dots ──
function buildWizardDots() {
  const dotsEl = document.getElementById('wizardDots');
  if (!dotsEl) return;

  for (let i = 0; i < TOTAL_SLIDES; i++) {
    const dot = document.createElement('div');
    dot.classList.add('wizard-dot');
    dot.setAttribute('data-index', i);
    dot.addEventListener('click', () => goToSlide(i));
    dotsEl.appendChild(dot);
  }
}

// ── Build department slides ──
function buildSlides(rd, lead) {
  const bodyEl = document.getElementById('wizardBody');
  if (!bodyEl) return;

  DEPARTMENTS.forEach((dept, i) => {
    const score      = rd.scores[dept.key] !== undefined ? rd.scores[dept.key] : 50;
    const badgeClass = getBadgeClass(score);
    const badgeLabel = getBadgeLabel(score);
    const barClass   = getBarClass(score);
    const lossData   = getLossData(dept.key, score);
    const analysis   = getAnalysisText(dept.key, score, lead);
    const tip        = window.FOLLOWUP_TIPS ? window.FOLLOWUP_TIPS[dept.key] : null;

    const slide = document.createElement('div');
    slide.classList.add('slide');
    slide.id = `slide${i}`;

    // Build loss items HTML
    const lossItemsHtml = lossData.items.map(item =>
      `<li>${escapeHtmlReport(item)}</li>`
    ).join('');

    // Loss chip label
    const lossChipText = lossData.unit
      ? `${lossData.amount}/${lossData.unit}`
      : lossData.amount;

    // Followup bubble HTML
    const followupHtml = tip
      ? `<div class="followup-bubble" id="followup${i}">
           <div class="followup-title">${escapeHtmlReport(tip.title)}</div>
           <div class="followup-text">${escapeHtmlReport(tip.text)}</div>
         </div>`
      : `<div class="followup-bubble" id="followup${i}"></div>`;

    slide.innerHTML = `
      <div class="slide-badge-row">
        <span class="badge badge-${badgeClass}">${escapeHtmlReport(badgeLabel)}</span>
      </div>

      <h2 class="slide-title">${dept.icon} ${escapeHtmlReport(dept.name)}</h2>

      <div class="score-bar-row">
        <div class="score-bar-track">
          <div
            class="score-bar-fill ${barClass}"
            id="bar${i}"
            style="--target-width: ${score}%; width: 0%;"
          ></div>
        </div>
        <div class="loss-chip badge-${badgeClass}">${escapeHtmlReport(lossChipText)}</div>
      </div>

      <p class="slide-analysis">${escapeHtmlReport(analysis)}</p>

      <div class="loss-box ${badgeClass}">
        <div class="loss-box-title">${escapeHtmlReport(lossData.label)}</div>
        <ul class="loss-box-list">${lossItemsHtml}</ul>
      </div>

      <div class="agreement-chat" id="agree${i}">
        <div class="agreement-msg">
          <div class="agreement-avatar">N</div>
          <div class="agreement-bubble">
            <p>Does this reflect what you're experiencing at your business?</p>
            <div class="agreement-btns">
              <button class="btn-agree"    data-slide="${i}">Yes, that's accurate</button>
              <button class="btn-disagree" data-slide="${i}">Not quite</button>
              <button class="btn-skip"     data-slide="${i}">Skip</button>
            </div>
            <div class="objection-input-wrap" id="objInput${i}" style="display:none;">
              <textarea
                class="objection-input"
                id="objText${i}"
                placeholder="Tell us what's different for your business..."
                rows="3"
              ></textarea>
              <button class="btn-obj-submit" data-objsubmit="${i}">Submit</button>
            </div>
          </div>
        </div>
      </div>

      ${followupHtml}
    `;

    bodyEl.appendChild(slide);
  });
}

// ── Build conclusion slide ──
function buildConclusionSlide(rd, lead) {
  const bodyEl = document.getElementById('wizardBody');
  if (!bodyEl) return;

  const company = lead && lead.company ? escapeHtmlReport(lead.company) : 'your business';
  const email   = lead && lead.email   ? escapeHtmlReport(lead.email)   : '';
  const phone   = lead && lead.phone   ? escapeHtmlReport(lead.phone)   : '';

  const vals    = Object.values(rd.scores || {});
  const avgScore = vals.length
    ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    : 0;

  const avgClass = avgScore < 40 ? 'low' : avgScore < 65 ? 'mid' : 'high';

  const critical = vals.filter(s => s < 40).length;
  const warning  = vals.filter(s => s >= 40 && s < 65).length;
  const good     = vals.filter(s => s >= 65).length;

  let gap = '';
  if (avgScore < 40) {
    gap = `There are ${critical} critical area${critical !== 1 ? 's' : ''} requiring immediate action.`;
  } else if (avgScore < 65) {
    gap = `${warning} area${warning !== 1 ? 's' : ''} present meaningful improvement opportunity.`;
  } else {
    gap = `${good} area${good !== 1 ? 's' : ''} are performing well — build on that foundation.`;
  }

  let summaryText = '';
  if (avgScore < 40) {
    summaryText = `The assessment reveals that ${company} has foundational gaps across multiple business functions that are actively limiting revenue and scalability. These are not minor inefficiencies — they are structural issues that compound month over month. Addressing them in the right sequence can unlock significant performance gains without requiring additional headcount or marketing spend.`;
  } else if (avgScore < 65) {
    summaryText = `${company} is a business with real momentum that is losing performance to systems and process gaps rather than market conditions. The fundamentals are in place — the opportunity is to make them reliable and repeatable. Closing these gaps translates directly into recaptured revenue, reduced owner dependency, and a stronger platform for growth.`;
  } else {
    summaryText = `${company} shows strong operational maturity across most functions. The assessment identified specific areas where existing strengths can be compounded — particularly in converting good processes into scalable systems. Businesses at this stage typically see the highest ROI from optimization and integration work, not wholesale rebuilds.`;
  }

  // Build tip cards from disagreed objections
  const objections = (window.assessmentState && window.assessmentState.objections) || [];
  const disagreed  = objections.filter(o => o.agreed === false && o.text);

  let tipCardsHtml = '';
  if (disagreed.length > 0) {
    const cards = disagreed.map(o => `
      <div class="tip-card">
        <div class="tip-card-label">Your note on ${escapeHtmlReport(o.dimension || 'this area')}:</div>
        <div class="tip-card-text">${escapeHtmlReport(o.text)}</div>
      </div>
    `).join('');
    tipCardsHtml = `
      <div class="tips-section">
        <h4 class="tips-section-title">Your Feedback</h4>
        ${cards}
      </div>
    `;
  }

  const contactInfo = (email || phone) ? `
    <div class="conclusion-confirm">
      ${email ? `<div class="conclusion-contact"><span>📧</span> ${email}</div>` : ''}
      ${phone ? `<div class="conclusion-contact"><span>📞</span> ${phone}</div>` : ''}
    </div>
  ` : '';

  const slide = document.createElement('div');
  slide.classList.add('slide', 'slide-conclusion');
  slide.id = 'slide8';

  slide.innerHTML = `
    <div class="conclusion-wrap">
      <div class="conclusion-score">
        <div class="conclusion-score-number ${avgClass}">${avgScore}</div>
        <div class="conclusion-score-label">Overall Score</div>
        <div class="conclusion-gap">${escapeHtmlReport(gap)}</div>
      </div>

      <p class="conclusion-summary">${escapeHtmlReport(summaryText)}</p>

      ${tipCardsHtml}

      <div class="conclusion-cta">
        <h3 class="conclusion-cta-title">Ready to close these gaps?</h3>
        <p class="conclusion-cta-body">Our team will review your results and put together a prioritized action plan tailored to ${company}.</p>
        <div class="conclusion-cta-btns">
          <a href="contact.html" class="btn btn-primary">Talk to a Consultant</a>
          <button class="btn btn-secondary" id="downloadPdfBtn">Download PDF Report</button>
        </div>
        ${contactInfo}
      </div>
    </div>
  `;

  bodyEl.appendChild(slide);

  // PDF button handler
  const pdfBtn = slide.querySelector('#downloadPdfBtn');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      if (typeof window.print === 'function') window.print();
    });
  }
}

// ── Go to slide ──
function goToSlide(index) {
  if (index < 0 || index >= TOTAL_SLIDES) return;
  wizardCurrentSlide = index;

  const rd   = window.reportData;
  const lead = window.assessmentState ? window.assessmentState.lead : null;

  // Show/hide slides
  document.querySelectorAll('#wizardBody .slide').forEach((sl, i) => {
    sl.classList.toggle('active', i === index);
  });

  // Update dots
  document.querySelectorAll('#wizardDots .wizard-dot').forEach((dot, i) => {
    dot.classList.remove('active', 'done');
    if (i < index)       dot.classList.add('done');
    else if (i === index) dot.classList.add('active');
  });

  // Counter
  const counter = document.getElementById('wizardCounter');
  if (counter) counter.textContent = `${index + 1} / ${TOTAL_SLIDES}`;

  // Score chip
  const scoreChip = document.getElementById('wizardScoreChip');
  if (scoreChip) {
    if (index < DEPARTMENTS.length && rd) {
      const dept  = DEPARTMENTS[index];
      const score = rd.scores[dept.key] !== undefined ? rd.scores[dept.key] : 0;
      scoreChip.textContent = `${dept.icon} ${score}`;
      scoreChip.className   = `wizard-score-chip badge-${getBadgeClass(score)}`;
    } else {
      scoreChip.textContent = '';
    }
  }

  // Back button visibility
  const backBtn = document.getElementById('wizardBack');
  if (backBtn) backBtn.classList.toggle('visible', index > 0);

  // Next button text
  const nextBtn = document.getElementById('wizardNext');
  if (nextBtn) {
    nextBtn.textContent = (index === TOTAL_SLIDES - 1) ? 'Finish ✓' : 'Next →';
  }

  // Animate score bar after 200ms
  setTimeout(() => {
    const bar = document.getElementById(`bar${index}`);
    if (bar) {
      const targetWidth = bar.style.getPropertyValue('--target-width') ||
                          getComputedStyle(bar).getPropertyValue('--target-width');
      bar.style.width = targetWidth || '0%';
    }
  }, 200);

  // Show agreement chat after 800ms (only for department slides)
  if (index < DEPARTMENTS.length) {
    setTimeout(() => {
      const agree = document.getElementById(`agree${index}`);
      if (agree) agree.classList.add('visible');
    }, 800);
  }

  // Scroll to top
  const bodyEl = document.getElementById('wizardBody');
  if (bodyEl) bodyEl.scrollTop = 0;
}

// ── Nav buttons ──
function bindWizardNav() {
  const nextBtn  = document.getElementById('wizardNext');
  const backBtn  = document.getElementById('wizardBack');
  const arrowBtn = document.getElementById('wizardArrow');

  if (nextBtn) {
    nextBtn.removeEventListener('click', onNextClick);
    nextBtn.addEventListener('click', onNextClick);
  }

  if (backBtn) {
    backBtn.removeEventListener('click', onBackClick);
    backBtn.addEventListener('click', onBackClick);
  }

  if (arrowBtn) {
    arrowBtn.removeEventListener('click', onNextClick);
    arrowBtn.addEventListener('click', onNextClick);
  }
}

function onNextClick() {
  if (wizardCurrentSlide === TOTAL_SLIDES - 1) {
    // Finish — close overlay
    const overlay = document.getElementById('assessmentOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  } else {
    goToSlide(wizardCurrentSlide + 1);
  }
}

function onBackClick() {
  if (wizardCurrentSlide > 0) goToSlide(wizardCurrentSlide - 1);
}

// ── Event delegation for agreement buttons ──
function bindWizardBodyEvents() {
  const bodyEl = document.getElementById('wizardBody');
  if (!bodyEl) return;

  bodyEl.removeEventListener('click', handleWizardBodyClick);
  bodyEl.addEventListener('click', handleWizardBodyClick);
}

function handleWizardBodyClick(e) {
  const target = e.target;

  // Agree
  if (target.classList.contains('btn-agree')) {
    const i = parseInt(target.getAttribute('data-slide'), 10);
    recordAgreement(i, true, null);
    disableAgreementBtns(i);
    return;
  }

  // Disagree — show text input
  if (target.classList.contains('btn-disagree')) {
    const i       = parseInt(target.getAttribute('data-slide'), 10);
    const objWrap = document.getElementById(`objInput${i}`);
    if (objWrap) objWrap.style.display = 'block';
    return;
  }

  // Skip
  if (target.classList.contains('btn-skip')) {
    const i = parseInt(target.getAttribute('data-slide'), 10);
    recordAgreement(i, null, null);
    disableAgreementBtns(i);
    return;
  }

  // Objection submit
  if (target.hasAttribute('data-objsubmit')) {
    const i    = parseInt(target.getAttribute('data-objsubmit'), 10);
    const text = document.getElementById(`objText${i}`);
    const val  = text ? text.value.trim() : '';

    recordAgreement(i, false, val);
    disableAgreementBtns(i);

    // Show followup tip if budget allows
    if (window.assessmentState && window.assessmentState.followupsUsed < 2) {
      setTimeout(() => {
        const followup = document.getElementById(`followup${i}`);
        if (followup) followup.classList.add('visible');
        if (window.assessmentState) window.assessmentState.followupsUsed++;
      }, 8000);
    }
    return;
  }
}

// ── Record agreement ──
function recordAgreement(slideIndex, agreed, text) {
  const dept = DEPARTMENTS[slideIndex];
  const entry = {
    slideIndex: slideIndex,
    dimension:  dept ? dept.key : null,
    agreed:     agreed,
    text:       text || null,
    timestamp:  Date.now()
  };

  if (window.assessmentState) {
    if (!Array.isArray(window.assessmentState.objections)) {
      window.assessmentState.objections = [];
    }
    window.assessmentState.objections.push(entry);
  }

  Nexvora.save('objections', window.assessmentState ? window.assessmentState.objections : [entry]);
}

// ── Disable agreement buttons ──
function disableAgreementBtns(i) {
  document.querySelectorAll(`[data-slide="${i}"]`).forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.4';
  });
}
