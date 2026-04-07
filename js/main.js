/* ============================================================
   NEXVORA SYSTEMS — main.js
   Navigation, mobile menu, shared utilities
   ============================================================ */

// ── Nav scroll effect ──
(function () {
  const nav = document.getElementById('mainNav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// ── Mobile hamburger ──
(function () {
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    hamburger.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      hamburger.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
})();

// ── Smooth anchor scroll ──
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
  });
});

// ── Shared utilities ──
const Nexvora = {
  save(key, val) {
    try { localStorage.setItem('nx_' + key, JSON.stringify(val)); } catch (e) {}
  },
  load(key) {
    try { return JSON.parse(localStorage.getItem('nx_' + key)); } catch (e) { return null; }
  },
  formatPhone(input) {
    let v = input.value.replace(/\D/g, '').substring(0, 10);
    if (v.length >= 6)      v = '(' + v.slice(0,3) + ') ' + v.slice(3,6) + '-' + v.slice(6);
    else if (v.length >= 3) v = '(' + v.slice(0,3) + ') ' + v.slice(3);
    input.value = v;
  },
  countUp(el, target, ms = 1100) {
    const start    = performance.now();
    const isDecimal = !Number.isInteger(target);
    const decimals  = isDecimal ? (String(target).split('.')[1] || '').length : 0;
    const tick  = now => {
      const p = Math.min((now - start) / ms, 1);
      const e = 1 - Math.pow(1 - p, 3);
      const val = e * target;
      el.textContent = decimals ? val.toFixed(decimals) : Math.round(val);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },
  escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
};

window.Nexvora = Nexvora;
