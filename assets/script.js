document.getElementById('year').textContent = new Date().getFullYear();

// Theme toggle
const toggle = document.getElementById('themeToggle');
const root = document.documentElement;
const stored = localStorage.getItem('theme');
if (stored) root.setAttribute('data-theme', stored);

toggle.addEventListener('click', () => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const current = root.getAttribute('data-theme') || (prefersDark ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});

// Experience tabs
const tabs = document.getElementById('expTabs');
if (tabs) {
  const btns = tabs.querySelectorAll('.tab-btn');
  const panels = tabs.querySelectorAll('.tab-panel');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const i = btn.dataset.tab;
      btns.forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-selected', 'false'); });
      panels.forEach(p => p.classList.remove('is-active'));
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      tabs.querySelector(`.tab-panel[data-panel="${i}"]`).classList.add('is-active');
    });
  });
}
