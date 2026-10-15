(() => {
  'use strict';

  const emailAddress = 'samsm@outlook.in';
  const themeStorageKey = 'sameer-portfolio-theme';

  function initTheme() {
    const root = document.documentElement;
    const buttons = [...document.querySelectorAll('[data-theme-toggle]')];
    const themeColor = document.querySelector('meta[name="theme-color"]');
    let theme = root.dataset.theme === 'dark' ? 'dark' : 'light';

    try {
      const savedTheme = window.localStorage.getItem(themeStorageKey);
      if (savedTheme === 'light' || savedTheme === 'dark') theme = savedTheme;
    } catch (_) {
      // The theme still works when browser storage is unavailable.
    }

    function applyTheme(nextTheme, persist = false) {
      theme = nextTheme;
      root.dataset.theme = theme;
      if (themeColor) themeColor.content = theme === 'dark' ? '#0a0a0f' : '#f6f7fa';
      const next = theme === 'light' ? 'dark' : 'light';
      const label = `Switch to ${next} theme`;

      buttons.forEach((button) => {
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.dataset.nextTheme = next;
        const textLabel = button.querySelector('[data-theme-label]');
        if (textLabel) textLabel.textContent = label;
      });

      if (persist) {
        try {
          window.localStorage.setItem(themeStorageKey, theme);
        } catch (_) {
          // A blocked storage setting should not block the control.
        }
      }
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        applyTheme(theme === 'light' ? 'dark' : 'light', true);
      });
    });

    // No saved choice: keep following the device setting live
    const deviceLight = window.matchMedia('(prefers-color-scheme: light)');
    deviceLight.addEventListener('change', (event) => {
      let saved = null;
      try { saved = window.localStorage.getItem(themeStorageKey); } catch (_) {}
      if (saved !== 'light' && saved !== 'dark') applyTheme(event.matches ? 'light' : 'dark');
    });

    window.addEventListener('storage', (event) => {
      if (event.key !== themeStorageKey) return;
      if (event.newValue === 'light' || event.newValue === 'dark') {
        applyTheme(event.newValue);
      }
    });

    applyTheme(theme);
  }

  function initMenu() {
    const dialog = document.getElementById('menuDialog');
    const toggle = document.getElementById('menuToggle');
    const closeButton = document.getElementById('menuClose');
    if (!dialog || !toggle) return;

    const supportsModal = typeof dialog.showModal === 'function';
    const desktop = window.matchMedia('(min-width: 901px)');
    let focusDestination = null;
    let restoreTrigger = true;

    function isOpen() {
      return dialog.hasAttribute('open');
    }

    function focusElement(element) {
      if (!element || !element.isConnected) return;
      const needsTabIndex = !element.hasAttribute('tabindex') && !element.matches(
        'a[href], button, input, select, textarea, summary, [contenteditable="true"]'
      );

      if (needsTabIndex) {
        element.setAttribute('tabindex', '-1');
        element.addEventListener('blur', () => {
          element.removeAttribute('tabindex');
        }, { once: true });
      }

      element.focus({ preventScroll: true });
    }

    function cleanUp() {
      document.body.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    function finishClose() {
      cleanUp();
      const destination = focusDestination;
      const shouldRestore = restoreTrigger;
      focusDestination = null;
      restoreTrigger = true;

      window.requestAnimationFrame(() => {
        if (isOpen()) return;
        if (destination) {
          focusElement(destination);
        } else if (shouldRestore && toggle.getClientRects().length) {
          toggle.focus({ preventScroll: true });
        }
      });
    }

    function closeMenu({ destination = null, restore = true } = {}) {
      focusDestination = destination;
      restoreTrigger = restore;
      cleanUp();
      if (!isOpen()) return;

      if (supportsModal) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
        finishClose();
      }
    }

    function openMenu() {
      if (isOpen() || desktop.matches) return;
      focusDestination = null;
      restoreTrigger = true;

      if (supportsModal) {
        dialog.showModal();
        document.body.classList.add('menu-open');
      } else {
        dialog.setAttribute('open', '');
        dialog.setAttribute('aria-modal', 'false');
        // Older browsers use a navigation disclosure without locking the page.
      }

      toggle.setAttribute('aria-expanded', 'true');
      if (closeButton) closeButton.focus({ preventScroll: true });
    }

    function getLinkDestination(link, event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
      if (link.target && link.target !== '_self') return null;

      try {
        const url = new URL(link.href, window.location.href);
        if (url.origin !== window.location.origin || url.pathname !== window.location.pathname
          || url.search !== window.location.search || !url.hash) return null;
        return document.getElementById(decodeURIComponent(url.hash.slice(1)));
      } catch (_) {
        return null;
      }
    }

    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      if (isOpen()) closeMenu();
      else openMenu();
    });
    if (closeButton) closeButton.addEventListener('click', () => closeMenu());

    dialog.addEventListener('close', finishClose);
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab' || !supportsModal || !isOpen()) return;

      const focusable = [...dialog.querySelectorAll(
        'a[href], area[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable="true"]'
      )].filter((element) => (
        !element.matches(':disabled')
        && element.tabIndex >= 0
        && element.getClientRects().length > 0
        && window.getComputedStyle(element).visibility !== 'hidden'
        && !element.closest('[hidden], [inert], [aria-hidden="true"]')
      ));

      if (!focusable.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      const outsideControls = !focusable.includes(current);

      if ((event.shiftKey && (current === first || outsideControls))
        || (!event.shiftKey && (current === last || outsideControls))) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      }
    });

    dialog.addEventListener('click', (event) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (link && dialog.contains(link)) {
        closeMenu({ destination: getLinkDestination(link, event) });
        return;
      }

      if (event.target !== dialog || !supportsModal) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right
        || event.clientY < bounds.top || event.clientY > bounds.bottom) closeMenu();
    });

    if (!supportsModal) {
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isOpen()) closeMenu();
      });
    }

    function handleResize(event) {
      if (event.matches) closeMenu({ restore: false });
    }

    if (typeof desktop.addEventListener === 'function') {
      desktop.addEventListener('change', handleResize);
    } else {
      desktop.addListener(handleResize);
    }
  }

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function initWorkFilters() {
    const controls = document.querySelector('[data-filters]');
    const searchInput = document.getElementById('workSearch');
    const buttons = [...document.querySelectorAll('[data-filter]')];
    const cards = [...document.querySelectorAll('[data-project-card]')];
    const count = document.getElementById('projectCount');
    const noResults = document.getElementById('noResults');
    const clearButton = document.getElementById('clearFilters');
    if (!controls || !cards.length) return;

    let activeFilter = 'all';
    const searchableCards = cards.map((card) => ({
      element: card,
      categories: normalize(card.dataset.category).split(/[\s,]+/),
      text: normalize(card.dataset.search || card.textContent)
    }));

    function update() {
      const terms = normalize(searchInput ? searchInput.value : '').split(/\s+/).filter(Boolean);
      let visibleCount = 0;

      searchableCards.forEach((card) => {
        const matchesCategory = activeFilter === 'all' || card.categories.includes(activeFilter);
        const matchesSearch = terms.every((term) => card.text.includes(term));
        const visible = matchesCategory && matchesSearch;
        card.element.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      buttons.forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.filter === activeFilter));
      });

      if (count) count.textContent = `${visibleCount} ${visibleCount === 1 ? 'project' : 'projects'}`;
      if (noResults) noResults.hidden = visibleCount !== 0;
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        activeFilter = normalize(button.dataset.filter) || 'all';
        update();
      });
    });
    if (searchInput) searchInput.addEventListener('input', update);

    if (clearButton) {
      clearButton.addEventListener('click', () => {
        activeFilter = 'all';
        if (searchInput) searchInput.value = '';
        update();
        if (searchInput) searchInput.focus();
      });
    }

    update();
    controls.hidden = false;
  }

  function initCopyEmail() {
    const buttons = [...document.querySelectorAll('[data-copy-email]')];
    const statusTimers = new WeakMap();

    function showStatus(status, message) {
      if (!status) return;
      window.clearTimeout(statusTimers.get(status));
      status.textContent = message;
      statusTimers.set(status, window.setTimeout(() => {
        status.textContent = '';
      }, 6500));
    }

    buttons.forEach((button) => {
      button.addEventListener('click', async () => {
        const status = button.parentElement.querySelector('[data-copy-status]')
          || document.querySelector('[data-copy-status]');

        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
          showStatus(status, `Copy unavailable here. Email: ${emailAddress}.`);
          return;
        }

        try {
          await navigator.clipboard.writeText(emailAddress);
          showStatus(status, 'Email copied.');
        } catch (_) {
          showStatus(status, `Copy failed. Email: ${emailAddress}.`);
        }
      });
    });
  }

  function initReveal() {
    const motionOk = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    if (!motionOk || !('IntersectionObserver' in window)) return;

    const targets = [...document.querySelectorAll([
      '.selected-work .section-heading', '.selected-work .project-card',
      '.about-preview', '.career-section .section-heading', '.career-grid article',
      '.about-section', '.approach-section', '.offscreen', '.education',
      '.work-grid .project-card', '.case-facts', '.case-section', '.next-project',
      '.contact-top'
    ].join(','))];
    if (!targets.length) return;

    targets.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', `${(i % 4) * 70}ms`);
    });

    // The class is only needed while the element fades in. Removing it
    // afterwards leaves hover and filter styles to the normal rules.
    function settle(el) {
      el.classList.remove('reveal', 'is-visible');
      el.style.removeProperty('--reveal-delay');
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        observer.unobserve(el);
        el.classList.add('is-visible');
        window.setTimeout(() => settle(el), 1200);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    targets.forEach((el) => observer.observe(el));

    // Safety net: if the observer never fires, nothing stays hidden.
    window.setTimeout(() => {
      targets.forEach((el) => { observer.unobserve(el); settle(el); });
    }, 4000);
  }

  function initImageReveal() {
    if (!window.matchMedia('(hover: none)').matches) return;
    let shown = null;
    document.querySelectorAll('main img').forEach((img) => {
      img.addEventListener('click', (event) => {
        // First tap shows the picture; a second tap follows any link around it
        if (img !== shown && img.closest('a')) event.preventDefault();
        if (shown && shown !== img) shown.classList.remove('img-reveal');
        img.classList.toggle('img-reveal', img !== shown);
        shown = img === shown ? null : img;
      });
    });
  }

  function init() {
    initImageReveal();
    initTheme();
    initReveal();
    initMenu();
    initWorkFilters();
    initCopyEmail();
    document.documentElement.classList.add('enhanced');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
