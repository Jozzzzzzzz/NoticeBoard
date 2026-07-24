// Applies the saved/system theme immediately (before first paint, so there's
// no flash of the wrong theme), and wires up any #theme-toggle button.
(function () {
  const KEY = 'nb_theme';

  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  apply(localStorage.getItem(KEY) || systemTheme());

  window.nbToggleTheme = function () {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY, next);
    apply(next);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', window.nbToggleTheme);
  });
})();
