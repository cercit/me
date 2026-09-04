(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Loader ---------- */
  var loader = document.getElementById('loader');
  function hideLoader() { if (loader) loader.classList.add('hidden'); }
  function playLoader() {
    if (!loader) return;
    loader.classList.remove('hidden');
    loader.classList.add('replay');
    void loader.offsetWidth;
    loader.classList.remove('replay');
    window.setTimeout(hideLoader, 900);
  }
  if (reduceMotion) {
    hideLoader();
    document.body.classList.add('loaded');
  } else {
    window.setTimeout(function () {
      hideLoader();
      document.body.classList.add('loaded');
    }, 900);
  }

  /* ---------- Logo: replay loader + scroll to top ---------- */
  var logoBtn = document.getElementById('logoBtn');
  if (logoBtn) {
    logoBtn.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------- Theme ---------- */
  // No stored choice means no data-theme attribute, which leaves the CSS
  // prefers-color-scheme block in charge and lets the page follow the OS live.
  var root = document.documentElement;
  var prefersLight = window.matchMedia('(prefers-color-scheme: light)');
  var themeBtns = document.querySelectorAll('.theme-toggle');

  function activeTheme() {
    return root.getAttribute('data-theme') || (prefersLight.matches ? 'light' : 'dark');
  }
  function syncThemeLabel() {
    var next = activeTheme() === 'dark' ? 'light' : 'dark';
    themeBtns.forEach(function (b) {
      b.setAttribute('aria-label', 'Switch to ' + next + ' theme');
      b.setAttribute('title', 'Switch to ' + next + ' theme');
    });
  }
  themeBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var next = activeTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      syncThemeLabel();
    });
  });
  // Keep the label honest if the OS flips while the page is open and the
  // visitor has not overridden it.
  if (typeof prefersLight.addEventListener === 'function') {
    prefersLight.addEventListener('change', syncThemeLabel);
  }
  syncThemeLabel();

  /* ---------- Nav state: always visible, condenses once scrolled ---------- */
  var header = document.getElementById('header');
  var sentinel = document.getElementById('navSentinel');
  if (header && sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      header.classList.toggle('scrolled', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);
  }

  /* ---------- Mobile menu ---------- */
  var hamburger = document.getElementById('hamburger');
  var mobileMenu = document.getElementById('mobileMenu');
  function setMenu(open) {
    if (!hamburger || !mobileMenu) return;
    hamburger.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    mobileMenu.classList.toggle('open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('menu-open', open);
    if (open) {
      var firstLink = mobileMenu.querySelector('a');
      if (firstLink) firstLink.focus();
    }
  }
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function () {
      setMenu(!hamburger.classList.contains('open'));
    });
    mobileMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && hamburger.classList.contains('open')) {
        setMenu(false);
        hamburger.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (!hamburger.classList.contains('open')) return;
      if (!mobileMenu.contains(e.target) && !hamburger.contains(e.target)) setMenu(false);
    });
  }

  /* ---------- Experience tabs ---------- */
  var tabs = document.getElementById('expTabs');
  if (tabs) {
    var btns = Array.prototype.slice.call(tabs.querySelectorAll('.tab-btn'));
    var highlight = document.getElementById('tabHighlight');
    var isMobile = function () { return window.matchMedia('(max-width: 860px)').matches; };

    var moveHighlight = function (i) {
      if (!highlight || !btns[i]) return;
      var btn = btns[i];
      if (isMobile()) {
        highlight.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
        highlight.style.width = btn.offsetWidth + 'px';
        highlight.style.height = '2px';
      } else {
        highlight.style.transform = 'translateY(' + btn.offsetTop + 'px)';
        highlight.style.height = btn.offsetHeight + 'px';
        highlight.style.width = '2px';
      }
    };
    var activate = function (i, focusTab) {
      btns.forEach(function (b, idx) {
        var on = idx === i;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
        b.setAttribute('tabindex', on ? '0' : '-1');
      });
      tabs.querySelectorAll('.tab-panel').forEach(function (p) {
        var on = p.dataset.panel === String(i);
        p.classList.toggle('is-active', on);
        if (on) { p.removeAttribute('hidden'); } else { p.setAttribute('hidden', ''); }
      });
      moveHighlight(i);
      if (focusTab && btns[i]) btns[i].focus();
    };
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () { activate(parseInt(btn.dataset.tab, 10), false); });
      btn.addEventListener('keydown', function (e) {
        var i = parseInt(btn.dataset.tab, 10);
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % btns.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + btns.length) % btns.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = btns.length - 1;
        if (next !== null) { e.preventDefault(); activate(next, true); }
      });
    });
    moveHighlight(0);
    window.addEventListener('resize', function () {
      var active = tabs.querySelector('.tab-btn.is-active');
      if (active) moveHighlight(parseInt(active.dataset.tab, 10));
    });
  }

  /* ---------- Scroll reveal ---------- */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var revealEls = document.querySelectorAll(
      '.section-heading, .about-grid, .plan, .tabs, .featured, .work-bottom, .contact > *, .route-stop'
    );
    revealEls.forEach(function (el, i) {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', (i % 6) * 60 + 'ms');
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });

    // Failsafe: never leave content invisible if the observer misfires
    window.setTimeout(function () {
      revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    }, 2600);
  }

  /* ---------- Word-by-word headline reveal ---------- */
  if (!reduceMotion) {
    var heroName = document.querySelector('.hero-name');
    if (heroName) {
      var text = heroName.textContent;
      var words = text.split(/\s+/);
      heroName.innerHTML = '';
      words.forEach(function (w, i) {
        var span = document.createElement('span');
        span.className = 'word-reveal';
        span.textContent = w;
        span.style.transitionDelay = (i * 80 + 100) + 'ms';
        heroName.appendChild(span);
        if (i < words.length - 1) heroName.appendChild(document.createTextNode(' '));
      });
      window.setTimeout(function () {
        heroName.querySelectorAll('.word-reveal').forEach(function (s) { s.classList.add('is-visible'); });
      }, 150);
    }
  }
})();
