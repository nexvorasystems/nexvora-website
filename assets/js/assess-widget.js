/* =====================================================
   Nexvora Systems — Free Assessment Pill Widget
   Same pill design as audit widget, no timer/modal.
   Click navigates directly to /assessment.html.
   ===================================================== */
(function () {
  const ASSESS_URL = window.location.origin + '/assessment.html';

  // ── CSS ─────────────────────────────────────────────
  const css = `
  .nxa-tab {
    position: fixed;
    right: 24px;
    bottom: 32px;
    z-index: 9000;
    cursor: pointer;
    user-select: none;
    text-decoration: none;
  }

  .nxa-tab-inner {
    position: relative;
    background: #0D9488;
    color: #fff;
    border-radius: 100px;
    padding: 11px 16px 11px 11px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 6px 28px rgba(13,148,136,0.5), 0 2px 8px rgba(0,0,0,0.12);
    white-space: nowrap;
    animation: nxaBreath 3s ease-in-out infinite;
    isolation: isolate;
  }
  .nxa-tab-inner::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 100px;
    background: rgba(13,148,136,0.45);
    z-index: -1;
    animation: nxaPillRipple 2.4s ease-out infinite;
  }
  .nxa-tab-inner::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 100px;
    background: rgba(13,148,136,0.25);
    z-index: -1;
    animation: nxaPillRipple 2.4s ease-out infinite;
    animation-delay: 1.2s;
  }
  @keyframes nxaPillRipple {
    0%   { transform: scale(1);    opacity: 1; }
    100% { transform: scale(1.35); opacity: 0; }
  }
  @keyframes nxaBreath {
    0%,100% { transform: scale(1);    box-shadow: 0 6px 28px rgba(13,148,136,0.5); }
    50%      { transform: scale(1.06); box-shadow: 0 10px 36px rgba(13,148,136,0.65); }
  }
  .nxa-tab:hover .nxa-tab-inner {
    background: #0f766e;
    animation-play-state: paused;
    transform: scale(1.04) translateY(-2px);
    box-shadow: 0 12px 40px rgba(13,148,136,0.7);
  }
  .nxa-tab:hover .nxa-tab-inner::before,
  .nxa-tab:hover .nxa-tab-inner::after { animation-play-state: paused; opacity: 0; }

  .nxa-tab-icon {
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(255,255,255,0.18);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .nxa-tab-icon svg { width: 18px; height: 18px; }

  .nxa-tab-text { display: flex; flex-direction: column; gap: 3px; }
  .nxa-tab-title {
    font-size: 13px; font-weight: 800; letter-spacing: -.2px;
    color: #fff; line-height: 1;
  }
  .nxa-tab-sub {
    font-size: 10px; font-weight: 500;
    color: rgba(255,255,255,0.65); line-height: 1;
  }

  .nxa-tab-badge {
    font-size: 10px; font-weight: 900; letter-spacing: .6px;
    text-transform: uppercase; padding: 5px 10px; border-radius: 8px;
    flex-shrink: 0; line-height: 1;
    background: rgba(255,255,255,0.2);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.35);
  }

  @media (max-width: 480px) {
    .nxa-tab { right: 14px; bottom: 20px; }
    .nxa-tab-title { font-size: 12px; }
    .nxa-tab-sub { display: none; }
  }

  /* Center footer legal links so fixed pill button never overlaps them */
  .footer-bottom {
    flex-direction: column !important;
    align-items: center !important;
    gap: 10px !important;
    text-align: center !important;
    justify-content: center !important;
    padding-right: 0 !important;
  }
  /* The inner div holding the 4 legal links — wrap them centered */
  .footer-bottom > div {
    display: flex !important;
    flex-wrap: wrap !important;
    justify-content: center !important;
    gap: 16px 24px !important;
    max-width: 480px !important;
  }
  `;

  // ── HTML ─────────────────────────────────────────────
  const html = `
  <a href="${ASSESS_URL}" class="nxa-tab" title="Free Business Assessment">
    <div class="nxa-tab-inner">
      <div class="nxa-tab-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <line x1="9" y1="12" x2="15" y2="12"/>
          <line x1="9" y1="16" x2="13" y2="16"/>
        </svg>
      </div>
      <div class="nxa-tab-text">
        <span class="nxa-tab-title">Free Assessment</span>
        <span class="nxa-tab-sub">10-min · instant report</span>
      </div>
      <span class="nxa-tab-badge">FREE</span>
    </div>
  </a>
  `;

  // ── Inject ───────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.innerHTML = html.trim();
  document.body.appendChild(wrap.firstElementChild);
})();
