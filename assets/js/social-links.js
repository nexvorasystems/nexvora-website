/* =====================================================
   Nexvora Systems — Animated Social Links Footer Widget
   Hover over a name → icon floats up above it
   ===================================================== */
(function () {
  const socials = [
    {
      name: 'Instagram',
      url: 'https://www.instagram.com/nexvorasystems',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png'
    },
    {
      name: 'LinkedIn',
      url: 'https://www.linkedin.com/company/nexvora-systems',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png'
    },
    {
      name: 'Facebook',
      url: 'https://www.facebook.com/nexvorasystems',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg'
    }
  ];

  const css = `
  .nxs-social-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 24px 0 8px;
    border-top: 1px solid rgba(255,255,255,0.08);
    margin-bottom: 0;
  }
  .nxs-social-item {
    position: relative;
    padding: 10px 22px;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
    transition: opacity .2s;
  }
  .nxs-social-row:hover .nxs-social-item {
    opacity: 0.45;
  }
  .nxs-social-row:hover .nxs-social-item:hover {
    opacity: 1;
  }
  .nxs-social-name {
    font-size: 17px;
    font-weight: 700;
    color: rgba(250,248,245,0.75);
    letter-spacing: -.2px;
    display: block;
    transition: color .2s;
  }
  .nxs-social-item:hover .nxs-social-name {
    color: #fff;
  }
  .nxs-social-icon {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%) translateY(10px) rotate(var(--rot));
    width: 52px;
    height: 52px;
    object-fit: contain;
    border-radius: 12px;
    opacity: 0;
    filter: blur(3px);
    pointer-events: none;
    transition: opacity .22s ease, transform .22s ease, filter .22s ease;
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  .nxs-social-item:hover .nxs-social-icon {
    opacity: 1;
    transform: translateX(-50%) translateY(-8px) rotate(var(--rot));
    filter: blur(0px);
  }
  @media (max-width: 480px) {
    .nxs-social-item { padding: 10px 14px; }
    .nxs-social-name { font-size: 15px; }
    .nxs-social-icon { width: 40px; height: 40px; }
  }
  `;

  function buildHTML() {
    const rots = [-8, 4, -5];
    return socials.map((s, i) => `
      <a href="${s.url}" class="nxs-social-item" target="_blank" rel="noopener" style="--rot:${rots[i]}deg">
        <img class="nxs-social-icon" src="${s.icon}" alt="${s.name}" loading="lazy"/>
        <span class="nxs-social-name">${s.name}</span>
      </a>
    `).join('');
  }

  function inject() {
    // Find footer-bottom and insert social row just before it
    const footerBottom = document.querySelector('.footer-bottom');
    if (!footerBottom || document.querySelector('.nxs-social-row')) return;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const row = document.createElement('div');
    row.className = 'nxs-social-row';
    row.innerHTML = buildHTML();
    footerBottom.parentNode.insertBefore(row, footerBottom);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
