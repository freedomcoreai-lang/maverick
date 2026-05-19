(function () {
  'use strict';

  var MAV_URL = location.hostname.indexOf('maverick.') !== -1
    ? '/api_data/live_ledger.json'
    : 'https://maverick.freedomcore.io/api_data/live_ledger.json';
  var SHADOW_URL = location.hostname.indexOf('maverick.') !== -1
    ? '/api_data/shadow_ledger.json'
    : 'https://maverick.freedomcore.io/api_data/shadow_ledger.json';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function fmtPct(v) {
    var n = Number(v);
    if (!isFinite(n)) return '--';
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  }

  function fmtMoney(v) {
    var n = Number(v);
    if (!isFinite(n)) return '--';
    return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2);
  }

  function fmtPrice(v) {
    var n = Number(v);
    if (!isFinite(n)) return '--';
    return (n >= 1 ? n.toFixed(4) : n.toFixed(6)).replace(/0+$/, '').replace(/\.$/, '');
  }

  function injectStyles() {
    if (document.getElementById('fc-proof-panels-style')) return;
    var style = document.createElement('style');
    style.id = 'fc-proof-panels-style';
    style.textContent = [
      '.proof-panels{position:relative;z-index:2;box-sizing:border-box;width:100%;max-width:1180px;margin:40px auto;padding:0 24px;overflow:hidden}',
      '.proof-panels__head{display:flex;justify-content:space-between;gap:16px;align-items:end;flex-wrap:wrap;margin-bottom:18px}',
      '.proof-panels__eyebrow{font-family:var(--mono,"JetBrains Mono",monospace);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent,#7dd3fc);margin:0 0 8px}',
      '.proof-panels h2{font-family:var(--sans,"Inter",sans-serif);font-size:clamp(26px,4vw,46px);line-height:1.02;margin:0;color:var(--text,#f8fbff);overflow-wrap:anywhere}',
      '.proof-panels__copy{max-width:620px;color:var(--muted,var(--text-dim,#9aa8ba));line-height:1.65;margin:0;overflow-wrap:anywhere}',
      '.proof-panels__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}',
      '.proof-system{border:1px solid color-mix(in srgb,var(--proof-accent,#7dd3fc) 38%,var(--border,rgba(255,255,255,.14)));border-radius:18px;background:linear-gradient(145deg,color-mix(in srgb,var(--proof-accent,#7dd3fc) 10%,transparent),color-mix(in srgb,var(--panel,#0c1422) 94%,transparent));box-shadow:0 24px 70px rgba(0,0,0,.26);overflow:hidden}',
      '.proof-system__head{padding:18px;border-bottom:1px solid var(--border,rgba(255,255,255,.12));display:flex;justify-content:space-between;gap:12px;align-items:center}',
      '.proof-system__name{font-family:var(--mono,"JetBrains Mono",monospace);font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--proof-accent,#7dd3fc);font-weight:900}',
      '.proof-system__lock{font-family:var(--mono,"JetBrains Mono",monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted,#9aa8ba);border:1px solid var(--border,rgba(255,255,255,.14));border-radius:999px;padding:5px 8px;white-space:nowrap}',
      '.proof-system__body{display:grid;grid-template-columns:1fr 1fr;gap:0}',
      '.proof-side{padding:16px;min-width:0}',
      '.proof-side+ .proof-side{border-left:1px solid var(--border,rgba(255,255,255,.12))}',
      '.proof-side h3{font-family:var(--mono,"JetBrains Mono",monospace);font-size:11px;letter-spacing:.16em;text-transform:uppercase;margin:0 0 12px;color:var(--muted,#9aa8ba)}',
      '.proof-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--border,rgba(255,255,255,.12)) 65%,transparent)}',
      '.proof-row:last-child{border-bottom:0}',
      '.proof-row__main{min-width:0}',
      '.proof-row__title{display:block;font-weight:900;color:var(--text,#f8fbff);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.proof-row__meta{display:block;margin-top:3px;font-family:var(--mono,"JetBrains Mono",monospace);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#9aa8ba);overflow-wrap:anywhere}',
      '.proof-row__hint{display:block;margin-top:5px;font-family:var(--mono,"JetBrains Mono",monospace);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--proof-accent,#7dd3fc)}',
      '.proof-row__pct{font-family:var(--mono,"JetBrains Mono",monospace);font-size:18px;font-weight:900}',
      '.proof-row__pct.win{color:var(--green,#22c55e)}',
      '.proof-row__pct.loss{color:var(--danger,var(--red,#ef4444))}',
      '.proof-detail{border-bottom:1px solid color-mix(in srgb,var(--border,rgba(255,255,255,.12)) 65%,transparent)}',
      '.proof-detail:last-child{border-bottom:0}',
      '.proof-detail>.proof-row{border-bottom:0;list-style:none;cursor:pointer;border-radius:10px;margin:0 -8px;padding:10px 8px}',
      '.proof-detail>.proof-row::-webkit-details-marker{display:none}',
      '.proof-detail>.proof-row:hover,.proof-detail[open]>.proof-row{background:color-mix(in srgb,var(--proof-accent,#7dd3fc) 10%,transparent)}',
      '.proof-detail__panel{padding:2px 0 12px;margin:0 0 8px;border-top:1px solid color-mix(in srgb,var(--proof-accent,#7dd3fc) 24%,transparent)}',
      '.proof-detail__title{display:block;margin:10px 0 4px;font-family:var(--mono,"JetBrains Mono",monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--proof-accent,#7dd3fc)}',
      '.proof-detail__empty{margin:10px 0 0;color:var(--muted,#9aa8ba);font-size:12px}',
      '.proof-trade{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--border,rgba(255,255,255,.12)) 48%,transparent)}',
      '.proof-trade:last-child{border-bottom:0}',
      '.proof-trade__main{min-width:0}',
      '.proof-trade__main b{display:block;color:var(--text,#f8fbff);font-size:13px;overflow-wrap:anywhere}',
      '.proof-trade__main small{display:block;margin-top:4px;color:var(--muted,#9aa8ba);font-size:11px;line-height:1.35;overflow-wrap:anywhere}',
      '.proof-trade__result{font-family:var(--mono,"JetBrains Mono",monospace);font-size:13px;font-weight:900;text-align:right;white-space:nowrap}',
      '.proof-trade__result.win{color:var(--green,#22c55e)}',
      '.proof-trade__result.loss{color:var(--danger,var(--red,#ef4444))}',
      '.proof-trade__result small{display:block;margin-top:4px;color:var(--muted,#9aa8ba);font-size:10px;font-weight:700}',
      '.proof-system__cta{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 18px;border-top:1px solid var(--border,rgba(255,255,255,.12));color:var(--muted,#9aa8ba);font-size:13px;line-height:1.45;min-width:0;overflow:hidden}',
      '.proof-system__cta span{display:block;min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere;word-break:break-word}',
      '.proof-system__cta a{color:var(--proof-accent,#7dd3fc);font-family:var(--mono,"JetBrains Mono",monospace);font-size:11px;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;font-weight:900;white-space:nowrap}',
      '.proof--mav{--proof-accent:var(--gold,#ffd700)}',
      '.proof--shadow{--proof-accent:var(--violet,#8b5cf6)}',
      '@media(max-width:720px){.proof-panels{max-width:calc(100vw - 32px);padding:0;margin:30px 16px}.proof-panels__head{display:block}.proof-panels h2,.proof-panels__copy{max-width:min(340px,calc(100vw - 32px))}.proof-system__head{align-items:flex-start;flex-direction:column}.proof-system__lock{white-space:normal}.proof-system__body{grid-template-columns:1fr}.proof-side+ .proof-side{border-left:0;border-top:1px solid var(--border,rgba(255,255,255,.12))}.proof-system__cta{align-items:flex-start;flex-direction:column}.proof-row{grid-template-columns:1fr}.proof-row__pct{font-size:16px;justify-self:start}.proof-trade{grid-template-columns:1fr}.proof-trade__result{text-align:left}}'
    ].join('');
    document.head.appendChild(style);
  }

  function maverickRow(row, type) {
    return '<div class="proof-row">'
      + '<span class="proof-row__main">'
      + '<span class="proof-row__title">' + esc(row.symbol || 'MAV') + '</span>'
      + '<span class="proof-row__meta">engine locked · ' + esc(row.exit_reason || 'closed') + '</span>'
      + '</span>'
      + '<span class="proof-row__pct ' + (type === 'winner' ? 'win' : 'loss') + '">' + fmtPct(row.pnl_pct) + '</span>'
      + '</div>';
  }

  function shadowRow(row, type) {
    var wr = Number(row.trades) ? Math.round((Number(row.wins || 0) / Number(row.trades || 1)) * 100) + '% WR' : 'tracked';
    return '<details class="proof-detail">'
      + '<summary class="proof-row">'
      + '<span class="proof-row__main">'
      + '<span class="proof-row__title">' + esc(row.wallet_label || 'LOCKED WALLET') + '</span>'
      + '<span class="proof-row__meta">wallet hidden · ' + esc(row.trades || 0) + ' copied · ' + esc(wr) + '</span>'
      + '<span class="proof-row__hint">tap for copied trades</span>'
      + '</span>'
      + '<span class="proof-row__pct ' + (type === 'winner' ? 'win' : 'loss') + '">' + fmtPct(row.return_pct) + '</span>'
      + '</summary>'
      + shadowBreakdown(row, type)
      + '</details>';
  }

  function shadowBreakdown(row, type) {
    var trades = Array.isArray(row.trade_breakdown) ? row.trade_breakdown.slice(0, 6) : [];
    if (!trades.length) {
      return '<div class="proof-detail__panel"><p class="proof-detail__empty">No copied trade rows exported for this locked wallet yet.</p></div>';
    }
    return '<div class="proof-detail__panel">'
      + '<span class="proof-detail__title">Copied trade breakdown</span>'
      + trades.map(function (trade) {
        var pct = Number(trade.return_pct);
        var resultClass = isFinite(pct) && pct < 0 ? 'loss' : 'win';
        var prices = fmtPrice(trade.entry_price) + ' entry / ' + fmtPrice(trade.exit_price) + ' exit';
        return '<div class="proof-trade">'
          + '<span class="proof-trade__main">'
          + '<b>' + esc(trade.trade_label || 'COPY') + ' · ' + esc(trade.symbol || 'UNKNOWN') + ' ' + esc(trade.direction || '') + '</b>'
          + '<small>' + esc(trade.entry_utc || 'entry pending') + ' / ' + esc(trade.exit_utc || 'exit pending') + '</small>'
          + '<small>' + esc(prices) + '</small>'
          + '<small>' + esc(trade.exit_reason || 'copied close') + '</small>'
          + '</span>'
          + '<span class="proof-trade__result ' + resultClass + '">' + fmtPct(trade.return_pct) + '<small>' + fmtMoney(trade.pnl_usd) + '</small></span>'
          + '</div>';
      }).join('')
      + '</div>';
  }

  function renderSystem(name, data) {
    var isShadow = name === 'shadow';
    var proof = (data && data.proof_board) || {};
    var winners = proof.winners || [];
    var losers = proof.losers || [];
    var rows = function (list, type) {
      if (!list.length) return '<div class="proof-row"><span class="proof-row__main"><span class="proof-row__title">Awaiting proof</span><span class="proof-row__meta">No rows exported yet</span></span><span class="proof-row__pct">--</span></div>';
      return list.slice(0, 3).map(function (r) { return isShadow ? shadowRow(r, type) : maverickRow(r, type); }).join('');
    };
    return '<article class="proof-system proof--' + (isShadow ? 'shadow' : 'mav') + '">'
      + '<header class="proof-system__head"><span class="proof-system__name">' + (isShadow ? 'SHADOW' : 'MAVERICK') + '</span><span class="proof-system__lock">' + (isShadow ? 'wallets locked' : 'engine locked') + '</span></header>'
      + '<div class="proof-system__body">'
      + '<div class="proof-side"><h3>Biggest winners</h3>' + rows(winners, 'winner') + '</div>'
      + '<div class="proof-side"><h3>Biggest losers</h3>' + rows(losers, 'loser') + '</div>'
      + '</div>'
      + '<footer class="proof-system__cta"><span>' + esc(proof.lock_copy || (isShadow ? 'Subscribe to reveal the wallet source behind each result.' : 'Subscribe to reveal the champion or trend engine behind each result.')) + '</span><a href="https://freedomcore.io/pages/access.html">Unlock proof</a></footer>'
      + '</article>';
  }

  function renderMount(mount, mav, shadow) {
    var mode = mount.getAttribute('data-proof-system') || 'both';
    var title = mount.getAttribute('data-proof-title') || 'Biggest winners and losers';
    var copy = mount.getAttribute('data-proof-copy') || 'Public proof shows the result. Paid access unlocks the wallet, champion, cohort and DNA trail behind it.';
    var body = '';
    if (mode === 'maverick' || mode === 'both') body += renderSystem('maverick', mav);
    if (mode === 'shadow' || mode === 'both') body += renderSystem('shadow', shadow);
    mount.innerHTML = '<div class="proof-panels__head"><div><p class="proof-panels__eyebrow">Proof board</p><h2>' + esc(title) + '</h2></div><p class="proof-panels__copy">' + esc(copy) + '</p></div><div class="proof-panels__grid">' + body + '</div>';
  }

  function init() {
    var mounts = Array.prototype.slice.call(document.querySelectorAll('.proof-panels[data-proof-system]'));
    if (!mounts.length) return;
    injectStyles();
    Promise.all([
      fetch(MAV_URL, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
      fetch(SHADOW_URL, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
    ]).then(function (pair) {
      mounts.forEach(function (mount) { renderMount(mount, pair[0], pair[1]); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
