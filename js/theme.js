/* ============================================================
   NEXVORA SYSTEMS — theme.js
   Universal theme engine — works on ALL pages
   7 themes: cream | space | apple-light | apple-dark | carbon | forest | titanium
   ============================================================ */

(function () {
  const THEMES = {
    cream:       { label: 'Cream',    tip: 'Cream Intelligence' },
    space:       { label: 'Space',    tip: 'Midnight Space' },
    'apple-light':{ label: '☀',      tip: 'Apple Light' },
    'apple-dark': { label: '●',      tip: 'Apple Dark' },
    carbon:      { label: 'C',       tip: 'Falcon Carbon' },
    forest:      { label: 'F',       tip: 'Forest Sovereign' },
    titanium:    { label: 'Ti',      tip: 'Falcon Titanium' },
  };

  const DEFAULT_THEME = 'cream';
  const STORAGE_KEY   = 'nx_theme';

  // Apply theme immediately (before paint) to avoid flash
  const saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
  applyTheme(saved);

  // Build and inject switcher UI after DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    injectSwitcher();
  });

  function applyTheme(name) {
    if (!THEMES[name]) name = DEFAULT_THEME;
    document.documentElement.setAttribute('data-theme', name);
    localStorage.setItem(STORAGE_KEY, name);

    // Update active button if switcher exists
    document.querySelectorAll('.theme-btn-v2').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.t === name);
    });
  }

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
  }

  function injectSwitcher() {
    // Don't inject if already exists or if assessment overlay is open
    if (document.querySelector('.theme-switcher-v2')) return;

    const switcher = document.createElement('div');
    switcher.className = 'theme-switcher-v2';
    switcher.innerHTML = `
      <span class="theme-switcher-v2-label">Theme</span>
      <div class="theme-btns-v2">
        ${Object.entries(THEMES).map(([key, val]) => `
          <button class="theme-btn-v2 ${getTheme() === key ? 'active' : ''}" data-t="${key}" title="${val.tip}" aria-label="${val.tip}">
            <span class="theme-btn-v2-inner" data-t="${key}"></span>
            <span class="theme-btn-v2-tip">${val.tip}</span>
          </button>
        `).join('')}
      </div>
    `;

    document.body.appendChild(switcher);

    switcher.querySelectorAll('.theme-btn-v2').forEach(btn => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.t));
    });
  }

  // Expose globally
  window.NexvoraTheme = { apply: applyTheme, get: getTheme, themes: THEMES };
})();
