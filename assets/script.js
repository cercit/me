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
    window.setTimeout(hideLoader, 1900);
  }
  if (reduceMotion) { hideLoader(); } else { window.setTimeout(hideLoader, 1900); }

  /* ---------- Logo click: replay loader + scroll to top ---------- */
  var logoBtn = document.getElementById('logoBtn');
  if (logoBtn) {
    logoBtn.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      if (!reduceMotion) playLoader();
    });
  }

  /* ---------- Nav: scrolled state + hide on scroll down ---------- */
  var header = document.getElementById('header');
  var lastY = window.scrollY;
  var ticking = false;
  function onScroll() {
    var y = window.scrollY;
    if (header) {
      header.classList.toggle('scrolled', y > 50);
      if (y > 150 && y > lastY) { header.classList.add('nav-hidden'); }
      else { header.classList.remove('nav-hidden'); }
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

  /* ---------- Hamburger / mobile menu ---------- */
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
    // Escape closes + returns focus to hamburger
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && hamburger.classList.contains('open')) {
        setMenu(false);
        hamburger.focus();
      }
    });
    // Outside click closes
    document.addEventListener('click', function (e) {
      if (!hamburger.classList.contains('open')) return;
      if (!mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
        setMenu(false);
      }
    });
  }

  /* ---------- Experience tabs ---------- */
  var tabs = document.getElementById('expTabs');
  if (tabs) {
    var btns = Array.prototype.slice.call(tabs.querySelectorAll('.tab-btn'));
    var highlight = document.getElementById('tabHighlight');
    var isMobile = function () { return window.matchMedia('(max-width: 768px)').matches; };

    function moveHighlight(i) {
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
    }
    function activate(i, focusTab) {
      btns.forEach(function (b, idx) {
        var on = idx === i;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
        b.setAttribute('tabindex', on ? '0' : '-1');
      });
      var panels = tabs.querySelectorAll('.tab-panel');
      panels.forEach(function (p) {
        var on = p.dataset.panel === String(i);
        p.classList.toggle('is-active', on);
        if (on) { p.removeAttribute('hidden'); } else { p.setAttribute('hidden', ''); }
      });
      moveHighlight(i);
      if (focusTab && btns[i]) btns[i].focus();
    }
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
    var revealEls = document.querySelectorAll('.section, .featured, .project-card, .plan-item');
    revealEls.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          // clear inline transform so CSS :hover rules apply again
          entry.target.style.transform = '';
          // drop the reveal transition so hover lifts stay snappy
          window.setTimeout(function (el) { return function () { el.style.transition = ''; }; }(entry.target), 650);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });

    // Failsafe: if the observer never fires (edge cases / non-compositing tabs),
    // force-reveal anything still hidden so content can never get stuck invisible.
    window.setTimeout(function () {
      revealEls.forEach(function (el) {
        if (el.style.opacity === '0') {
          el.style.opacity = '1';
          el.style.transform = '';
          el.style.transition = '';
        }
      });
    }, 2500);
  }
})();
