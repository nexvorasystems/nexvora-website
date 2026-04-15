/* =====================================================
   Nexvora Systems — Free Website Audit Widget
   Floating tab + modal + countdown timer
   ===================================================== */
(function () {
  // ── CONFIG ──────────────────────────────────────────
  const FREE_UNTIL = new Date('2026-05-01T04:00:00Z'); // midnight EDT
  const PRICE = '$0.99';
  const AUDIT_PAGE = window.location.origin + '/website-audit.html';
  const isFree = () => new Date() < FREE_UNTIL;

  // ── INJECT CSS ───────────────────────────────────────
  const css = `
  /* FLOATING TAB */
  .nx-audit-tab {
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    z-index: 9000;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    user-select: none;
  }
  .nx-audit-tab-inner {
    background: #0D9488;
    color: #fff;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
    padding: 20px 10px;
    border-radius: 12px 0 0 12px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    box-shadow: -4px 0 24px rgba(13,148,136,0.35);
    transition: background .2s, box-shadow .2s;
    position: relative;
  }
  .nx-audit-tab-inner:hover {
    background: #0f766e;
    box-shadow: -6px 0 32px rgba(13,148,136,0.5);
  }
  .nx-audit-free-badge {
    background: #fff;
    color: #0D9488;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 1px;
    padding: 3px 6px;
    border-radius: 4px;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    animation: nx-pulse-badge 2.5s ease infinite;
  }
  .nx-audit-paid-badge {
    background: rgba(255,255,255,0.2);
    color: #fff;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.5px;
    padding: 3px 6px;
    border-radius: 4px;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
  }
  @keyframes nx-pulse-badge {
    0%,100% { opacity: 1; transform: rotate(180deg) scale(1); }
    50% { opacity: 0.7; transform: rotate(180deg) scale(1.08); }
  }

  /* MODAL OVERLAY */
  .nx-audit-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15,43,76,0.7);
    backdrop-filter: blur(6px);
    z-index: 9100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    opacity: 0;
    pointer-events: none;
    transition: opacity .25s ease;
  }
  .nx-audit-overlay.open {
    opacity: 1;
    pointer-events: auto;
  }

  /* MODAL CARD */
  .nx-audit-card {
    background: #fff;
    border-radius: 20px;
    width: 100%;
    max-width: 480px;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(0,0,0,0.25);
    transform: translateY(20px) scale(0.97);
    transition: transform .3s cubic-bezier(.2,.65,.3,.9);
  }
  .nx-audit-overlay.open .nx-audit-card {
    transform: translateY(0) scale(1);
  }

  /* MODAL HEADER */
  .nx-audit-head {
    background: linear-gradient(135deg, #0F2B4C 0%, #0D9488 100%);
    padding: 28px 28px 20px;
    color: #fff;
    position: relative;
  }
  .nx-audit-close {
    position: absolute;
    top: 14px;
    right: 16px;
    background: rgba(255,255,255,0.15);
    border: none;
    color: #fff;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background .2s;
  }
  .nx-audit-close:hover { background: rgba(255,255,255,0.25); }
  .nx-audit-logo-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .nx-audit-logo-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #44CAA2;
    animation: nx-pulse-badge 2.5s ease infinite;
  }
  .nx-audit-logo-name {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.6);
  }
  .nx-audit-head h2 {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
    margin-bottom: 4px;
  }
  .nx-audit-head p {
    font-size: 13px;
    color: rgba(255,255,255,0.65);
  }

  /* TIMER */
  .nx-audit-timer-wrap {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .nx-audit-timer-box {
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 10px;
    padding: 8px 12px;
    text-align: center;
    min-width: 52px;
  }
  .nx-audit-timer-n {
    font-size: 20px;
    font-weight: 800;
    color: #44CAA2;
    letter-spacing: -0.5px;
    line-height: 1;
  }
  .nx-audit-timer-l {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.4);
    margin-top: 3px;
  }
  .nx-audit-timer-paid {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 13px;
    color: rgba(255,255,255,0.7);
  }
  .nx-audit-timer-paid strong { color: #fff; }

  /* FREE LABEL */
  .nx-audit-free-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
  }
  .nx-audit-free-tag {
    background: #44CAA2;
    color: #0F2B4C;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 6px;
  }
  .nx-audit-free-text {
    font-size: 12px;
    color: rgba(255,255,255,0.55);
  }
  .nx-audit-free-price {
    font-size: 12px;
    color: rgba(255,255,255,0.4);
  }
  .nx-audit-free-price s { color: rgba(255,255,255,0.3); }

  /* BODY */
  .nx-audit-body {
    padding: 24px 28px 28px;
  }
  .nx-audit-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #4A5568;
    margin-bottom: 6px;
  }
  .nx-audit-input {
    width: 100%;
    padding: 12px 14px;
    border: 1.5px solid #E2DDD5;
    border-radius: 10px;
    font-size: 14px;
    color: #1A1A2E;
    background: #FAF8F5;
    outline: none;
    transition: border-color .2s, box-shadow .2s;
    font-family: inherit;
    margin-bottom: 14px;
  }
  .nx-audit-input:focus {
    border-color: #0D9488;
    box-shadow: 0 0 0 3px rgba(13,148,136,0.12);
    background: #fff;
  }
  .nx-audit-submit {
    width: 100%;
    padding: 14px;
    background: #0D9488;
    color: #fff;
    border: none;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: filter .2s, transform .2s;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .nx-audit-submit:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }
  .nx-audit-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  .nx-audit-footer-note {
    text-align: center;
    font-size: 11px;
    color: #718096;
    margin-top: 12px;
  }

  /* ERROR STATE */
  .nx-audit-error {
    color: #EF4444;
    font-size: 12px;
    margin-top: -8px;
    margin-bottom: 10px;
    display: none;
  }
  .nx-audit-error.show { display: block; }

  @media(max-width:480px) {
    .nx-audit-tab-inner { padding: 16px 8px; font-size: 10px; }
    .nx-audit-card { border-radius: 16px; }
    .nx-audit-head { padding: 20px 20px 16px; }
    .nx-audit-body { padding: 20px; }
  }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── BUILD TAB ────────────────────────────────────────
  const tab = document.createElement('div');
  tab.className = 'nx-audit-tab';
  tab.setAttribute('aria-label', 'Get Free Website Audit');
  tab.innerHTML = `
    <div class="nx-audit-tab-inner">
      <span class="${isFree() ? 'nx-audit-free-badge' : 'nx-audit-paid-badge'}">${isFree() ? 'FREE' : PRICE}</span>
      <span>Website</span>
      <span>Audit</span>
    </div>
  `;
  document.body.appendChild(tab);

  // ── BUILD MODAL ───────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'nx-audit-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="nx-audit-card">
      <div class="nx-audit-head">
        <button class="nx-audit-close" aria-label="Close">&times;</button>
        <div class="nx-audit-logo-row">
          <div class="nx-audit-logo-dot"></div>
          <span class="nx-audit-logo-name">Nexvora Systems</span>
        </div>
        <h2>Free Website Audit</h2>
        <p>See exactly how your website performs on speed, SEO, and mobile.</p>
        <div id="nxTimerBlock"></div>
      </div>
      <div class="nx-audit-body">
        <label class="nx-audit-label">Your website URL</label>
        <input class="nx-audit-input" id="nxAuditUrl" type="url" placeholder="https://yourbusiness.com" autocomplete="url"/>
        <div class="nx-audit-error" id="nxAuditErr">Please enter a valid website URL (include https://)</div>
        <label class="nx-audit-label">Your email <span style="color:#718096;font-weight:500;">(optional — to receive the report)</span></label>
        <input class="nx-audit-input" id="nxAuditEmail" type="email" placeholder="you@yourbusiness.com" autocomplete="email"/>
        <button class="nx-audit-submit" id="nxAuditSubmit">
          Run My Free Audit
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
        <p class="nx-audit-footer-note">Powered by Google PageSpeed Insights &mdash; results in under 60 seconds</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // ── TIMER LOGIC ──────────────────────────────────────
  function renderTimer() {
    const block = document.getElementById('nxTimerBlock');
    if (!block) return;
    const now = new Date();
    const diff = FREE_UNTIL - now;

    if (diff <= 0) {
      // Paid state
      block.innerHTML = `
        <div class="nx-audit-timer-paid">
          <strong>Website Audit — ${PRICE}</strong><br>
          The free period has ended. Still the best ${PRICE} you'll spend on your business.
        </div>`;
      const btn = document.getElementById('nxAuditSubmit');
      if (btn) btn.textContent = 'Get My Audit — ' + PRICE;
      return;
    }

    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    block.innerHTML = `
      <div class="nx-audit-timer-wrap">
        <div class="nx-audit-timer-box"><div class="nx-audit-timer-n">${String(d).padStart(2,'0')}</div><div class="nx-audit-timer-l">Days</div></div>
        <div class="nx-audit-timer-box"><div class="nx-audit-timer-n">${String(h).padStart(2,'0')}</div><div class="nx-audit-timer-l">Hours</div></div>
        <div class="nx-audit-timer-box"><div class="nx-audit-timer-n">${String(m).padStart(2,'0')}</div><div class="nx-audit-timer-l">Mins</div></div>
        <div class="nx-audit-timer-box"><div class="nx-audit-timer-n">${String(s).padStart(2,'0')}</div><div class="nx-audit-timer-l">Secs</div></div>
      </div>
      <div class="nx-audit-free-row">
        <span class="nx-audit-free-tag">FREE</span>
        <span class="nx-audit-free-text">until May 1, 2026</span>
        <span class="nx-audit-free-price">then <s>${PRICE}</s></span>
      </div>`;
  }

  renderTimer();
  const timerInterval = setInterval(renderTimer, 1000);

  // ── OPEN / CLOSE ─────────────────────────────────────
  function openModal() {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => { const inp = document.getElementById('nxAuditUrl'); if (inp) inp.focus(); }, 300);
  }
  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  tab.addEventListener('click', openModal);
  overlay.querySelector('.nx-audit-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  // ── SUBMIT ───────────────────────────────────────────
  document.getElementById('nxAuditSubmit').addEventListener('click', function () {
    const urlInput = document.getElementById('nxAuditUrl');
    const emailInput = document.getElementById('nxAuditEmail');
    const errEl = document.getElementById('nxAuditErr');
    const btn = document.getElementById('nxAuditSubmit');

    let url = urlInput.value.trim();
    const email = emailInput.value.trim();

    // Auto-add https://
    if (url && !url.startsWith('http')) url = 'https://' + url;

    errEl.classList.remove('show');

    // Validate URL
    try {
      new URL(url);
    } catch {
      errEl.textContent = 'Please enter a valid website URL (e.g. https://yourbusiness.com)';
      errEl.classList.add('show');
      urlInput.focus();
      return;
    }

    // Navigate to audit page
    btn.disabled = true;
    btn.textContent = 'Running audit…';

    const params = new URLSearchParams({ url: url });
    if (email) params.set('email', email);

    window.location.href = AUDIT_PAGE + '?' + params.toString();
  });

  // Allow Enter key in inputs
  ['nxAuditUrl', 'nxAuditEmail'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') document.getElementById('nxAuditSubmit').click();
    });
  });

})();
