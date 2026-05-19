/* FreedomCore hub theme toggle. theme-init.js has already painted the
   correct mode from localStorage. This wires the button and icon. */
(function () {
  var KEY = 'freedomcore-theme';
  var btn = document.getElementById('theme-btn');
  if (!btn) return;

  function paint() {
    var t = document.documentElement.getAttribute('data-theme') || 'dark';
    btn.innerHTML = t === 'light' ? '&#9728;' : '&#9790;';
  }

  btn.addEventListener('click', function () {
    var html = document.documentElement;
    var next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (_) {}
    paint();
  });

  paint();
})();
