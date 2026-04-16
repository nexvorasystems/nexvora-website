/* =====================================================
   Nexvora Systems — Free Website Audit Widget
   Pulsing circle button + modal + countdown + GHL CRM
   ===================================================== */
(function () {
  const FREE_UNTIL = new Date('2026-05-01T04:00:00Z'); // midnight EDT
  const PRICE = '$0.99';
  const AUDIT_PAGE = window.location.origin + '/website-audit.html';
  const API_BASE = 'https://nexvorasystems.us';
  const isFree = () => new Date() < FREE_UNTIL;

  // ── CSS ─────────────────────────────────────────────
  const css = `
  /* PULSING CIRCLE BUTTON */
  .nx-tab {
    position: fixed;
    right: 28px;
    bottom: 32px;
    z-index: 9000;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* outer ripple rings */
  .nx-tab::before,
  .nx-tab::after {
    content: '';
    position: absolute;
    border-radius: 50%;
    background: rgba(13,148,136,0.25);
    animation: nxRipple 2.4s ease-out infinite;
  }
  .nx-tab::before { width: 80px; height: 80px; animation-delay: 0s; }
  .nx-tab::after  { width: 80px; height: 80px; animation-delay: 1.2s; }
  @keyframes nxRipple {
    0%   { transform: scale(1);    opacity: .7; }
    100% { transform: scale(2.2);  opacity: 0;  }
  }
  .nx-tab-inner {
    position: relative;
    width: 80px; height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0D9488, #0f766e);
    color: #fff;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 2px;
    box-shadow: 0 8px 32px rgba(13,148,136,0.55);
    animation: nxBreath 3s ease-in-out infinite;
    transition: box-shadow .2s;
  }
  .nx-tab:hover .nx-tab-inner {
    box-shadow: 0 12px 40px rgba(13,148,136,0.75);
    animation-play-state: paused;
    transform: scale(1.08);
  }
  @keyframes nxBreath {
    0%,100% { transform: scale(1);    box-shadow: 0 8px 32px rgba(13,148,136,0.55); }
    50%      { transform: scale(1.12); box-shadow: 0 12px 44px rgba(13,148,136,0.7); }
  }
  .nx-tab-label {
    font-size: 9px; font-weight: 900; letter-spacing: 1.2px;
    text-transform: uppercase; text-align: center; line-height: 1.3;
  }
  .nx-tab-badge {
    font-size: 8px; font-weight: 900; letter-spacing: .5px;
    padding: 2px 6px; border-radius: 4px; margin-top: 2px;
  }
  .nx-tab-badge.free { background: #fff; color: #0D9488; }
  .nx-tab-badge.paid { background: rgba(255,255,255,0.2); color: #fff; }
  @keyframes nxPulse { 0%,100%{opacity:1} 50%{opacity:.65} }

  /* OVERLAY */
  .nx-overlay {
    position: fixed; inset: 0;
    background: rgba(15,43,76,0.72);
    backdrop-filter: blur(8px);
    z-index: 9100;
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    opacity: 0; pointer-events: none;
    transition: opacity .25s ease;
  }
  .nx-overlay.open { opacity: 1; pointer-events: auto; }

  /* CARD */
  .nx-card {
    background: #fff; border-radius: 20px;
    width: 100%; max-width: 500px; overflow: hidden;
    box-shadow: 0 28px 80px rgba(0,0,0,0.28);
    transform: translateY(24px) scale(0.96);
    transition: transform .3s cubic-bezier(.2,.65,.3,.9);
  }
  .nx-overlay.open .nx-card { transform: translateY(0) scale(1); }

  /* HEADER */
  .nx-head {
    background: linear-gradient(135deg, #0F2B4C 0%, #0D9488 100%);
    padding: 26px 28px 22px; color: #fff; position: relative;
  }
  .nx-close {
    position: absolute; top: 14px; right: 16px;
    background: rgba(255,255,255,0.15); border: none; color: #fff;
    width: 30px; height: 30px; border-radius: 50%; cursor: pointer;
    font-size: 18px; display: flex; align-items: center; justify-content: center;
    transition: background .2s; line-height: 1;
  }
  .nx-close:hover { background: rgba(255,255,255,0.28); }
  .nx-brand {
    display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
  }
  .nx-brand-dot {
    width: 7px; height: 7px; border-radius: 50%; background: #44CAA2;
    animation: nxPulse 2.5s ease infinite;
  }
  .nx-brand-name {
    font-size: 10px; font-weight: 800; letter-spacing: 2px;
    text-transform: uppercase; color: rgba(255,255,255,0.55);
  }
  .nx-head h2 { font-size: 21px; font-weight: 800; letter-spacing: -.4px; margin-bottom: 4px; }
  .nx-head p { font-size: 13px; color: rgba(255,255,255,0.6); }

  /* TIMER */
  .nx-timer { display: flex; gap: 8px; margin-top: 16px; }
  .nx-timer-box {
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
    border-radius: 10px; padding: 8px 11px; text-align: center; flex: 1;
  }
  .nx-timer-n { font-size: 20px; font-weight: 800; color: #44CAA2; line-height: 1; }
  .nx-timer-l { font-size: 8px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.38); margin-top: 3px; }
  .nx-free-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
  .nx-free-tag { background: #44CAA2; color: #0F2B4C; font-size: 10px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; }
  .nx-free-text { font-size: 12px; color: rgba(255,255,255,0.55); }
  .nx-free-then { font-size: 12px; color: rgba(255,255,255,0.35); }
  .nx-timer-paid {
    margin-top: 12px; background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 10px; padding: 10px 14px;
    font-size: 13px; color: rgba(255,255,255,0.7);
  }
  .nx-timer-paid strong { color: #fff; }

  /* BODY */
  .nx-body { padding: 22px 24px 26px; }
  .nx-field { margin-bottom: 14px; }
  .nx-label {
    display: block; font-size: 11px; font-weight: 700; letter-spacing: .4px;
    color: #4A5568; margin-bottom: 6px;
  }
  .nx-req { color: #0D9488; }
  .nx-input {
    width: 100%; padding: 11px 14px;
    border: 1.5px solid #E2DDD5; border-radius: 10px;
    font-size: 14px; color: #1A1A2E; background: #FAF8F5;
    outline: none; font-family: inherit;
    transition: border-color .2s, box-shadow .2s;
  }
  .nx-input:focus {
    border-color: #0D9488;
    box-shadow: 0 0 0 3px rgba(13,148,136,0.12);
    background: #fff;
  }
  .nx-input.nx-err { border-color: #EF4444; }
  .nx-err-msg { font-size: 11px; color: #EF4444; margin-top: 4px; display: none; }
  .nx-err-msg.show { display: block; }

  /* SUBMIT */
  .nx-submit {
    width: 100%; padding: 14px;
    background: #0D9488; color: #fff;
    border: none; border-radius: 12px;
    font-size: 15px; font-weight: 700; cursor: pointer;
    font-family: inherit;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: filter .2s, transform .2s;
    margin-top: 6px;
  }
  .nx-submit:hover { filter: brightness(1.1); transform: translateY(-1px); }
  .nx-submit:disabled { opacity: .6; cursor: not-allowed; transform: none; filter: none; }
  .nx-footer { text-align: center; font-size: 11px; color: #A0ADB8; margin-top: 12px; }

  /* SPINNER inside button */
  .nx-btn-spinner {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    animation: nxSpin .7s linear infinite;
    display: none;
  }
  @keyframes nxSpin { to { transform: rotate(360deg); } }

  @media(max-width:480px) {
    .nx-tab { right: 16px; bottom: 20px; }
    .nx-tab-inner { width: 68px; height: 68px; }
    .nx-tab::before,.nx-tab::after { width: 68px; height: 68px; }
    .nx-card { border-radius: 16px; }
    .nx-head { padding: 20px 20px 16px; }
    .nx-body { padding: 18px 18px 22px; }
  }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── FLOATING TAB ─────────────────────────────────────
  const tab = document.createElement('div');
  tab.className = 'nx-tab';
  tab.setAttribute('role', 'button');
  tab.setAttribute('aria-label', 'Get Free Website Audit');
  tab.innerHTML = `
    <div class="nx-tab-inner">
      <span class="nx-tab-label">Website<br>Audit</span>
      <span class="nx-tab-badge ${isFree() ? 'free' : 'paid'}">${isFree() ? 'FREE' : PRICE}</span>
    </div>`;
  document.body.appendChild(tab);

  // ── MODAL ────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'nx-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="nx-card">
      <div class="nx-head">
        <button class="nx-close" aria-label="Close">&times;</button>
        <div class="nx-brand">
          <div class="nx-brand-dot"></div>
          <span class="nx-brand-name">Nexvora Systems</span>
        </div>
        <h2>Free Website Audit</h2>
        <p>Get your performance, SEO &amp; mobile score instantly.</p>
        <div id="nxTimerBlock"></div>
      </div>
      <div class="nx-body">

        <div class="nx-field">
          <label class="nx-label" for="nxName">Full Name <span class="nx-req">*</span></label>
          <input class="nx-input" id="nxName" type="text" placeholder="Jane Smith" autocomplete="name"/>
          <div class="nx-err-msg" id="nxNameErr">Please enter your full name.</div>
        </div>

        <div class="nx-field">
          <label class="nx-label" for="nxEmail">Email Address <span class="nx-req">*</span></label>
          <input class="nx-input" id="nxEmail" type="email" placeholder="jane@yourbusiness.com" autocomplete="email"/>
          <div class="nx-err-msg" id="nxEmailErr">Please enter a valid email address.</div>
        </div>

        <div class="nx-field">
          <label class="nx-label" for="nxUrl">Website URL <span class="nx-req">*</span></label>
          <input class="nx-input" id="nxUrl" type="url" placeholder="https://yourbusiness.com" autocomplete="url"/>
          <div class="nx-err-msg" id="nxUrlErr">Please enter a valid website URL.</div>
        </div>

        <button class="nx-submit" id="nxSubmit">
          <span id="nxSubmitText">Run My Free Audit</span>
          <div class="nx-btn-spinner" id="nxSpinner"></div>
          <svg id="nxSubmitArrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
        <p class="nx-footer">Powered by Google PageSpeed Insights &mdash; results in &lt;60 seconds</p>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // ── TIMER ────────────────────────────────────────────
  function renderTimer() {
    const block = document.getElementById('nxTimerBlock');
    if (!block) return;
    const diff = FREE_UNTIL - Date.now();
    if (diff <= 0) {
      block.innerHTML = `<div class="nx-timer-paid"><strong>Website Audit &mdash; ${PRICE}</strong><br>The free period has ended. Still the best investment for your website.</div>`;
      const btn = document.getElementById('nxSubmitText');
      if (btn) btn.textContent = 'Get Audit — ' + PRICE;
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    block.innerHTML = `
      <div class="nx-timer">
        <div class="nx-timer-box"><div class="nx-timer-n">${String(d).padStart(2,'0')}</div><div class="nx-timer-l">Days</div></div>
        <div class="nx-timer-box"><div class="nx-timer-n">${String(h).padStart(2,'0')}</div><div class="nx-timer-l">Hrs</div></div>
        <div class="nx-timer-box"><div class="nx-timer-n">${String(m).padStart(2,'0')}</div><div class="nx-timer-l">Min</div></div>
        <div class="nx-timer-box"><div class="nx-timer-n">${String(s).padStart(2,'0')}</div><div class="nx-timer-l">Sec</div></div>
      </div>
      <div class="nx-free-row">
        <span class="nx-free-tag">FREE</span>
        <span class="nx-free-text">until May 1, 2026</span>
        <span class="nx-free-then">then ${PRICE}</span>
      </div>`;
  }
  renderTimer();
  setInterval(renderTimer, 1000);

  // ── OPEN / CLOSE ─────────────────────────────────────
  function openModal() {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => { document.getElementById('nxName')?.focus(); }, 320);
  }
  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  tab.addEventListener('click', openModal);
  overlay.querySelector('.nx-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Allow Enter in any field
  ['nxName','nxEmail','nxUrl'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('nxSubmit').click();
    });
  });

  // ── VALIDATE ─────────────────────────────────────────
  function validate() {
    let ok = true;

    const name = document.getElementById('nxName').value.trim();
    const nameErr = document.getElementById('nxNameErr');
    if (!name || name.length < 2) {
      document.getElementById('nxName').classList.add('nx-err');
      nameErr.classList.add('show');
      ok = false;
    } else {
      document.getElementById('nxName').classList.remove('nx-err');
      nameErr.classList.remove('show');
    }

    const email = document.getElementById('nxEmail').value.trim();
    const emailErr = document.getElementById('nxEmailErr');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      document.getElementById('nxEmail').classList.add('nx-err');
      emailErr.classList.add('show');
      ok = false;
    } else {
      document.getElementById('nxEmail').classList.remove('nx-err');
      emailErr.classList.remove('show');
    }

    let url = document.getElementById('nxUrl').value.trim();
    const urlErr = document.getElementById('nxUrlErr');
    if (url && !url.startsWith('http')) url = 'https://' + url;
    document.getElementById('nxUrl').value = url;
    try {
      if (!url) throw new Error();
      new URL(url);
      document.getElementById('nxUrl').classList.remove('nx-err');
      urlErr.classList.remove('show');
    } catch {
      document.getElementById('nxUrl').classList.add('nx-err');
      urlErr.classList.add('show');
      ok = false;
    }

    return ok ? { name, email, url } : null;
  }

  // ── SUBMIT ───────────────────────────────────────────
  document.getElementById('nxSubmit').addEventListener('click', async function () {
    const fields = validate();
    if (!fields) return;

    const { name, email, url } = fields;
    const btn = document.getElementById('nxSubmit');
    const spinner = document.getElementById('nxSpinner');
    const arrow = document.getElementById('nxSubmitArrow');
    const btnText = document.getElementById('nxSubmitText');

    btn.disabled = true;
    spinner.style.display = 'block';
    arrow.style.display = 'none';
    btnText.textContent = 'Submitting…';

    // Call GHL API to create lead (fire-and-forget style — don't block the redirect)
    const auditParams = new URLSearchParams({ url, name, email });
    const auditUrl = `${AUDIT_PAGE}?${auditParams.toString()}`;

    try {
      await fetch(`${API_BASE}/api/audit-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, websiteUrl: url, reportUrl: auditUrl }),
        // Don't wait forever — if API is slow, still redirect
        signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
      });
    } catch (err) {
      // Non-fatal — still redirect to audit page
      console.warn('[audit-widget] CRM call failed (non-fatal):', err.message);
    }

    window.location.href = auditUrl;
  });

})();
