/* Mockup runtime: theme (?tema=malam), icons (<i data-i="calendar-days">), status bar fill. */
(function () {
  var q = new URLSearchParams(location.search);
  var tema = q.get('tema') === 'malam' ? 'malam' : 'terang';
  document.documentElement.dataset.tema = tema;
  function icons(root) {
    (root || document).querySelectorAll('i[data-i]').forEach(function (el) {
      if (el.firstChild) return;
      var body = (window.RK_ICONS || {})[el.dataset.i];
      if (!body) { el.title = 'ikon tidak ada: ' + el.dataset.i; el.style.outline = '1px solid red'; return; }
      if (el.dataset.s) el.style.setProperty('--s', el.dataset.s + 'px');
      el.innerHTML = '<svg viewBox="0 0 24 24">' + body + '</svg>';
    });
  }
  function chrome() {
    document.querySelectorAll('.phone').forEach(function (p) {
      if (!p.querySelector('.sb')) {
        var sb = document.createElement('div');
        sb.className = 'sb';
        sb.innerHTML = '<span>' + (p.dataset.jam || '08.05') + '</span><span class="r"><i data-i="wifi"></i><i data-i="signal"></i><i data-i="battery-full"></i></span>';
        p.prepend(sb);
      }
      if (p.dataset.gestur !== 'tidak' && !p.querySelector('.gesture')) {
        var g = document.createElement('div'); g.className = 'gesture'; p.append(g);
      }
    });
  }
  function ready() { chrome(); icons(); document.documentElement.dataset.siap = '1'; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
