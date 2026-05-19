/* Maverick live rail. Polls the public-safe broker-exit JSON every 60s and
   rotates recent strategy exits through #mav-rail-ticker. */
(function () {
  var tickerEl = document.getElementById('mav-rail-ticker');
  var aggEl = document.getElementById('mav-rail-agg');
  var freshEl = document.getElementById('mav-rail-fresh');
  if (!tickerEl) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rows = [];
  var idx = 0;

  function relTime(ts) {
    var s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  function renderRow(row) {
    if (!row) return '<span class="mav-rail__loading">no recent fills</span>';
    var tag = (row.tag || 'MAVERICK').toUpperCase();
    var sym = row.symbol || '--';
    var reason = (row.reason || '--').replace('CHAMPION:', '');
    var pnl = (row.pnl_pct >= 0 ? '+' : '') + (row.pnl_pct == null ? '0.00' : row.pnl_pct.toFixed(2)) + '%';
    var cls = row.pnl_pct >= 0 ? 'win' : 'loss';
    return '<span class="tag ' + tag + '">' + tag + '</span>'
      + '<span class="sym">' + sym + '</span>'
      + '<span class="reason">' + reason + '</span>'
      + '<span class="pnl ' + cls + '">' + pnl + '</span>'
      + '<span class="age">' + relTime(row.ts) + '</span>';
  }

  function tick() {
    if (!rows.length) {
      tickerEl.innerHTML = renderRow(null);
      return;
    }
    var row = rows[idx % rows.length];
    tickerEl.classList.add('fading');
    setTimeout(function () {
      tickerEl.innerHTML = renderRow(row);
      tickerEl.classList.remove('fading');
    }, reduce ? 0 : 220);
    idx++;
  }

  function poll() {
    fetch('https://maverick.freedomcore.io/api_data/live_ledger.json?_=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (data) {
        rows = data.rows || [];
        var visibleWins = rows.filter(function (r) { return Number(r.pnl_pct || 0) >= 0; }).length;
        var visibleLosses = rows.filter(function (r) { return Number(r.pnl_pct || 0) < 0; }).length;
        var cascadeTs = data.cascade_active_since || 0;
        var cascadeHHMM = cascadeTs
          ? new Date(cascadeTs * 1000).toUTCString().slice(17, 22) + ' UTC'
          : '--';
        aggEl.innerHTML = 'visible tape &middot; '
          + '<span class="agg-w">' + visibleWins + ' winners</span> / '
          + '<span class="agg-l">' + visibleLosses + ' losers</span> &middot; '
          + 'since ' + cascadeHHMM;
        var now = new Date();
        freshEl.textContent = 'updated ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        tick();
      })
      .catch(function () { /* keep last good */ });
  }

  poll();
  setInterval(poll, 60000);
  if (!reduce) setInterval(tick, 3500);
})();
