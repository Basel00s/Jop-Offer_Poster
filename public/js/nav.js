(function () {
  const icons = {
    dashboard:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    accounts:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"/></svg>',
    offers:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
    groups:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3.3 2.7-5 6-5"/><path d="M14 19c0-2.5 1.8-4 4-4"/></svg>',
    candidates:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>',
  };

  const pages = [
    { href: 'dashboard.html', label: 'Dashboard', icon: icons.dashboard },
    { href: 'accounts.html', label: 'Accounts', icon: icons.accounts },
    { href: 'offers.html', label: 'Offers', icon: icons.offers },
    { href: 'groups.html', label: 'Groups', icon: icons.groups },
    { href: 'candidates.html', label: 'Candidates', icon: icons.candidates },
  ];

  const current = window.location.pathname.split('/').pop() || 'dashboard.html';
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;

  const brandWrap = topbar.querySelector('.brand-wrap');
  const legacyTitle = topbar.querySelector('h1');

  const brand = document.createElement('a');
  brand.className = 'brand';
  brand.href = 'dashboard.html';
  brand.innerHTML = `
    <img class="brand-logo" src="img/logo.svg" width="40" height="40" alt="">
    <span class="brand-text">
      <span class="brand-name">Job Poster</span>
      <span class="brand-tagline">Recruitment automation</span>
    </span>`;

  if (brandWrap) {
    brandWrap.appendChild(brand);
  } else if (legacyTitle) {
    legacyTitle.replaceWith(brand);
  } else {
    topbar.prepend(brand);
  }

  const nav = document.createElement('nav');
  nav.className = 'site-nav';
  nav.setAttribute('aria-label', 'Main navigation');
  nav.innerHTML = pages
    .map((page, index) => {
      const isActive =
        current === page.href ||
        (current === 'index.html' && page.href === 'dashboard.html');
      const activeClass = isActive ? ' active' : '';
      return `<a class="nav-link${activeClass}" href="${page.href}" style="--nav-i:${index}">
        <span class="nav-icon">${page.icon}</span>
        <span class="nav-label">${page.label}</span>
      </a>`;
    })
    .join('');

  topbar.appendChild(nav);
})();
