/* fc-live-rail.js — slim cross-site live ticker. Mirrors the apex hub's
 * mav-rail design but compressed for top-of-page placement on every Maverick
 * subpage + sister site.
 *
 * Operator 2026-05-01: 'cross site live ticker keeping in them with the one
 * in main FreedomCore... simply copy that design.'
 *
 * Self-injects into a <div id="fc-live-rail"></div> placeholder OR appends
 * to <body> as the first child after the nav stack. Polls the public
 * /api_data/live_ledger.json (refreshed every 60s by fc-live-ledger.timer)
 * so no auth is needed on the client side.
 */
(function () {
    'use strict';

    var FEED_URL = 'https://maverick.freedomcore.io/api_data/live_ledger.json';
    var POLL_MS = 60000;
    var TICK_MS = 3500;

    var state = { rows: [], idx: 0, agg: null, last_updated: 0 };
    var els = {};
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function injectStyles() {
        if (document.getElementById('fc-live-rail-style')) return;
        var css = document.createElement('style');
        css.id = 'fc-live-rail-style';
        css.textContent = '' +
            '.fc-rail { display:flex; align-items:center; gap:14px; padding:8px 14px; background:rgba(0,0,0,0.42); border:1px solid rgba(255,215,0,0.20); border-radius:8px; font-family:"JetBrains Mono", ui-monospace, monospace; font-size:0.72rem; line-height:1.3; color:#f5f5fa; max-width:1200px; margin:10px auto 0; flex-wrap:wrap; }\n' +
            '[data-theme="light"] .fc-rail { background:rgba(238,247,255,0.92); border-color:rgba(30,127,196,0.40); color:#0a0a0f; }\n' +
            '.fc-rail__eyebrow { font-size:0.58rem; letter-spacing:0.2em; text-transform:uppercase; color:#ffd700; font-weight:800; flex-shrink:0; }\n' +
            '.fc-rail__row { display:flex; align-items:center; gap:8px; flex:1 1 220px; min-width:0; overflow:hidden; transition:opacity 0.22s ease; }\n' +
            '.fc-rail__row.fading { opacity:0; }\n' +
            '.fc-rail__sym { font-weight:700; color:#f5f5fa; }\n' +
            '[data-theme="light"] .fc-rail__sym { color:#0a0a0f; }\n' +
            '.fc-rail__reason { color:rgba(245,245,250,0.55); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n' +
            '[data-theme="light"] .fc-rail__reason { color:rgba(10,10,15,0.55); }\n' +
            '.fc-rail__pnl { font-weight:800; flex-shrink:0; }\n' +
            '.fc-rail__pnl.win { color:#22c55e; }\n' +
            '.fc-rail__pnl.loss { color:#ef4444; }\n' +
            '.fc-rail__age { color:rgba(245,245,250,0.42); font-size:0.62rem; flex-shrink:0; }\n' +
            '[data-theme="light"] .fc-rail__age { color:rgba(10,10,15,0.45); }\n' +
            '.fc-rail__agg { font-size:0.62rem; letter-spacing:0.04em; color:rgba(245,245,250,0.66); flex-shrink:0; padding-left:10px; border-left:1px solid rgba(255,215,0,0.18); }\n' +
            '[data-theme="light"] .fc-rail__agg { color:rgba(10,10,15,0.66); border-left-color:rgba(30,127,196,0.30); }\n' +
            '.fc-rail__agg .w { color:#22c55e; font-weight:700; }\n' +
            '.fc-rail__agg .l { color:#ef4444; font-weight:700; }\n' +
            '.fc-rail__cta { color:#ffd700; font-weight:800; text-decoration:none; letter-spacing:0.1em; padding:4px 10px; border:1px solid rgba(255,215,0,0.45); border-radius:5px; font-size:0.62rem; flex-shrink:0; transition:all 0.2s; }\n' +
            '.fc-rail__cta:hover { background:rgba(255,215,0,0.12); }\n' +
            '@media (max-width: 640px) { .fc-rail { font-size:0.66rem; gap:8px; padding:6px 10px; } .fc-rail__eyebrow { display:none; } .fc-rail__cta { display:none; } .fc-rail__agg { padding-left:6px; } }\n' +
            '@media (max-width: 380px) { .fc-rail__age { display:none; } .fc-rail__reason { display:none; } }';
        document.head.appendChild(css);
    }

    function ensureMount() {
        var el = document.getElementById('fc-live-rail');
        if (el) return el;
        // Auto-inject after the .nav element if no explicit mount provided
        el = document.createElement('div');
        el.id = 'fc-live-rail';
        var nav = document.querySelector('nav.nav');
        if (nav && nav.parentNode) nav.parentNode.insertBefore(el, nav.nextSibling);
        else if (document.body) document.body.insertBefore(el, document.body.firstChild);
        return el;
    }

    function relTime(ts) {
        var s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
        if (s < 60) return s + 's';
        if (s < 3600) return Math.floor(s / 60) + 'm';
        if (s < 86400) return Math.floor(s / 3600) + 'h';
        return Math.floor(s / 86400) + 'd';
    }

    function buildShell(mount) {
        mount.innerHTML = '' +
            '<div class="fc-rail" role="region" aria-label="Maverick live broker ledger">' +
                '<span class="fc-rail__eyebrow">MAVERICK · LIVE</span>' +
                '<div class="fc-rail__row" id="fc-rail-row"><span class="fc-rail__reason">connecting&hellip;</span></div>' +
                '<div class="fc-rail__agg" id="fc-rail-agg">7d &middot; &mdash;</div>' +
                '<a class="fc-rail__cta" href="https://maverick.freedomcore.io/pages/today.html">View ledger &rsaquo;</a>' +
            '</div>';
        els.row = mount.querySelector('#fc-rail-row');
        els.agg = mount.querySelector('#fc-rail-agg');
    }

    function renderRow(row) {
        if (!row) return '<span class="fc-rail__reason">no recent fills</span>';
        var pnl = (row.pnl_pct >= 0 ? '+' : '') + (row.pnl_pct || 0).toFixed(2) + '%';
        var cls = row.pnl_pct >= 0 ? 'win' : 'loss';
        var reason = (row.reason || '').replace('CHAMPION:', '');
        return '' +
            '<span class="fc-rail__sym">' + (row.symbol || '--') + '</span>' +
            '<span class="fc-rail__reason">' + reason + '</span>' +
            '<span class="fc-rail__pnl ' + cls + '">' + pnl + '</span>' +
            '<span class="fc-rail__age">' + relTime(row.ts) + '</span>';
    }

    function tick() {
        if (!state.rows.length || !els.row) return;
        var row = state.rows[state.idx % state.rows.length];
        els.row.classList.add('fading');
        setTimeout(function () {
            els.row.innerHTML = renderRow(row);
            els.row.classList.remove('fading');
        }, reduceMotion ? 0 : 220);
        state.idx++;
    }

    function renderAgg(agg) {
        if (!agg || !els.agg) return;
        var w = (agg.wins == null ? '--' : agg.wins);
        var l = (agg.losses == null ? '--' : agg.losses);
        var wr = (agg.wr_pct == null ? '--' : agg.wr_pct + '%');
        var net = (agg.net_pnl_pct != null) ? ((agg.net_pnl_pct >= 0 ? '+' : '') + agg.net_pnl_pct.toFixed(2) + '%') : '';
        els.agg.innerHTML = '7d &middot; <span class="w">' + w + 'W</span>/<span class="l">' + l + 'L</span> &middot; WR ' + wr + (net ? ' &middot; ' + net : '');
    }

    function poll() {
        fetch(FEED_URL, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                if (!data) return;
                state.rows = data.rows || [];
                state.agg = data.aggregate_7d || null;
                renderAgg(state.agg);
                tick();
            })
            .catch(function () { /* silent */ });
    }

    function start() {
        injectStyles();
        var mount = ensureMount();
        if (!mount) return;
        buildShell(mount);
        poll();
        setInterval(poll, POLL_MS);
        if (!reduceMotion) setInterval(tick, TICK_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
