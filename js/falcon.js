/* ============================================================
   NEXVORA SYSTEMS — falcon.js
   Geometric Falcon animation controller
   The Nexvora Falcon System — 2026
   ============================================================ */

const Falcon = (function () {
  const FALCON_SVG_INLINE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none" aria-hidden="true">
    <polygon points="100,40 130,80 100,100 70,80" fill="#0D9488" opacity="0.95"/>
    <polygon points="100,100 130,80 145,120 100,130" fill="#0F2B4C" opacity="0.9"/>
    <polygon points="100,100 70,80 55,120 100,130" fill="#1E3A5F" opacity="0.85"/>
    <polygon points="100,40 120,58 100,70 80,58" fill="#14B8A6" opacity="0.9"/>
    <polygon points="100,40 108,32 100,50" fill="#C9A84C" opacity="0.95"/>
    <circle cx="108" cy="52" r="3.5" fill="#FAF8F5" opacity="0.9"/>
    <circle cx="109" cy="52" r="1.8" fill="#0F2B4C"/>
    <polygon points="70,80 55,120 30,105 45,75" fill="#0D9488" opacity="0.75"/>
    <polygon points="55,120 30,105 20,145 50,145" fill="#0F2B4C" opacity="0.65"/>
    <polygon points="45,75 30,105 18,85 35,62" fill="#14B8A6" opacity="0.6"/>
    <polygon points="130,80 145,120 170,105 155,75" fill="#0D9488" opacity="0.75"/>
    <polygon points="145,120 170,105 180,145 150,145" fill="#0F2B4C" opacity="0.65"/>
    <polygon points="155,75 170,105 182,85 165,62" fill="#14B8A6" opacity="0.6"/>
    <polygon points="100,130 55,120 75,165 100,155" fill="#0F2B4C" opacity="0.8"/>
    <polygon points="100,130 145,120 125,165 100,155" fill="#1E3A5F" opacity="0.75"/>
    <polygon points="100,155 75,165 100,180 125,165" fill="#C9A84C" opacity="0.7"/>
    <polygon points="20,145 50,145 38,162" fill="#44caa2" opacity="0.5"/>
    <polygon points="180,145 150,145 162,162" fill="#44caa2" opacity="0.5"/>
    <circle cx="100" cy="40" r="3" fill="#C9A84C" opacity="0.9"/>
    <circle cx="100" cy="130" r="3" fill="#44caa2" opacity="0.9"/>
    <circle cx="55" cy="120" r="2.5" fill="#44caa2" opacity="0.8"/>
    <circle cx="145" cy="120" r="2.5" fill="#44caa2" opacity="0.8"/>
    <circle cx="30" cy="105" r="2" fill="#63b3ed" opacity="0.7"/>
    <circle cx="170" cy="105" r="2" fill="#63b3ed" opacity="0.7"/>
  </svg>`;

  // Inject SVG into an element
  function inject(element, size) {
    if (!element) return;
    element.innerHTML = FALCON_SVG_INLINE;
    element.classList.add('falcon-icon');
    if (size) element.classList.add(size);
  }

  // Trigger wing-flap on a button
  function flap(btnElement) {
    if (!btnElement) return;
    const icon = btnElement.querySelector('.falcon-icon, .falcon-hero');
    if (!icon) return;
    icon.style.animation = 'none';
    icon.offsetHeight; // reflow
    icon.style.animation = 'falconFlapLeft 0.35s ease forwards';
    setTimeout(() => { icon.style.animation = ''; }, 400);
  }

  // Sweep falcon into a container (assessment open)
  function sweep(containerEl) {
    if (!containerEl) return;
    const el = containerEl.querySelector('.falcon-hero, .falcon-icon');
    if (!el) return;
    el.classList.remove('falcon-sweep');
    el.offsetHeight;
    el.classList.add('falcon-sweep');
    el.addEventListener('animationend', () => el.classList.remove('falcon-sweep'), { once: true });
  }

  // Put element in scanning state
  function scan(element) {
    if (!element) return;
    element.classList.add('falcon-scanning');
  }

  // Stop scanning
  function stopScan(element) {
    if (!element) return;
    element.classList.remove('falcon-scanning');
    element.classList.add('falcon-landing');
    element.addEventListener('animationend', () => element.classList.remove('falcon-landing'), { once: true });
  }

  // Landing animation
  function land(element) {
    if (!element) return;
    element.classList.remove('falcon-scanning', 'falcon-sweep');
    element.offsetHeight;
    element.classList.add('falcon-landing');
    element.addEventListener('animationend', () => element.classList.remove('falcon-landing'), { once: true });
  }

  // Init hero falcon
  function initHero() {
    const heroFalcon = document.querySelector('.falcon-hero-wrap');
    if (!heroFalcon) return;
    heroFalcon.innerHTML = `
      <div class="falcon-hero" style="width:160px;height:160px;display:block;">
        ${FALCON_SVG_INLINE}
      </div>
    `;
  }

  // Add flap to all primary buttons that don't already have a falcon icon
  function initButtons() {
    document.querySelectorAll('.btn-primary, .btn-falcon').forEach(btn => {
      btn.addEventListener('click', () => flap(btn));
    });
  }

  // Add card badges (falcon appears on hover)
  function initCardBadges() {
    document.querySelectorAll('.service-card, .step-card').forEach(card => {
      if (card.querySelector('.falcon-card-badge')) return;
      const badge = document.createElement('div');
      badge.className = 'falcon-card-badge';
      badge.innerHTML = FALCON_SVG_INLINE;
      card.style.position = 'relative';
      card.appendChild(badge);
    });
  }

  // Initialize all on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    initHero();
    initButtons();
    initCardBadges();
  });

  return { inject, flap, sweep, scan, stopScan, land, initHero, initButtons };
})();

window.Falcon = Falcon;
