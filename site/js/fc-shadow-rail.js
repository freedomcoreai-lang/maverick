/* fc-shadow-rail.js — slim cross-site live ticker for SHADOW. Mirrors the
 * Maverick rail design but in violet, sourced from cohort consensus
 * activity (last 5 quorum fires) + equity stats. Mounts below the Maverick
 * rail (or at the topbar bottom if loaded alone) and stays anchored to the
 * viewport during scroll.
 *
 * Operator 2026-05-01: 'we need to be able to see how Shadow's performing
 * as well as Maverick across the whole fucking system because they are all
 * interlinked.'
 */
(function () {
    'use strict';

    var FEED_URL = 'https://maverick.freedomcore.io/api_data/shadow_ledger.json';
    var POLL_MS = 60000;
    var TICK_MS = 3500;

    var state = { rows: [], idx: 0, agg: null };
    var els = {};
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function injectStyles() {
        if (document.getElementById('fc-shadow-rail-style')) return;
        var css = document.createElement('style');
        css.id = 'fc-shadow-rail-style';
        css.textContent = '' +
            '.fc-shadow-mount { position:fixed; left:0; right:0; z-index:198; }\n' +
            '.fc-shadow-rail { display:flex; align-items:center; gap:14px; padding:8px 14px; background:rgba(6,10,16,0.94); border-bottom:1px solid rgba(139,92,246,0.30); border-top:1px solid rgba(139,92,246,0.18); font-family:"JetBrains Mono", ui-monospace, monospace; font-size:0.72rem; line-height:1.3; color:#f5f5fa; flex-wrap:nowrap; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); box-shadow:0 6px 18px rgba(0,0,0,0.32); }\n' +
            '[data-theme="light"] .fc-shadow-rail { background:rgba(248,250,255,0.96); border-bottom-color:rgba(109,59,204,0.40); border-top-color:rgba(109,59,204,0.22); color:#0a0a0f; }\n' +
            '.fc-shadow-rail .eyebrow { font-size:0.58rem; letter-spacing:0.2em; text-transform:uppercase; color:#8b5cf6; font-weight:800; flex-shrink:0; }\n' +
            '[data-theme="light"] .fc-shadow-rail .eyebrow { color:#6d3bcc; }\n' +
            '.fc-shadow-rail .row { display:flex; align-items:center; gap:8px; flex:1 1 220px; min-width:0; overflow:hidden; transition:opacity 0.22s ease; }\n' +
            '.fc-shadow-rail .row.fading { opacity:0; }\n' +
            '.fc-shadow-rail .sym { font-weight:700; color:#f5f5fa; }\n' +
            '[data-theme="light"] .fc-shadow-rail .sym { color:#0a0a0f; }\n' +
            '.fc-shadow-rail .side.buy { color:#22c55e; font-weight:700; }\n' +
            '.fc-shadow-rail .side.sell { color:#ef4444; font-weight:700; }\n' +
            '.fc-shadow-rail .whales { color:#8b5cf6; font-weight:700; }\n' +
            '[data-theme="light"] .fc-shadow-rail .whales { color:#6d3bcc; }\n' +
            '.fc-shadow-rail .age { color:rgba(245,245,250,0.42); font-size:0.62rem; flex-shrink:0; }\n' +
            '[data-theme="light"] .fc-shadow-rail .age { color:rgba(10,10,15,0.45); }\n' +
            '.fc-shadow-rail .agg { font-size:0.62rem; letter-spacing:0.04em; color:rgba(245,245,250,0.66); flex-shrink:0; padding-left:10px; border-left:1px solid rgba(139,92,246,0.18); }\n' +
            '[data-theme="light"] .fc-shadow-rail .agg { color:rgba(10,10,15,0.66); border-left-color:rgba(109,59,204,0.30); }\n' +
            '.fc-shadow-rail .agg .pos { color:#22c55e; font-weight:700; }\n' +
            '.fc-shadow-rail .agg .neg { color:#ef4444; font-weight:700; }\n' +
            '.fc-shadow-rail .cta { color:#8b5cf6; font-weight:800; text-decoration:none; letter-spacing:0.1em; padding:4px 10px; border:1px solid rgba(139,92,246,0.45); border-radius:5px; font-size:0.62rem; flex-shrink:0; transition:all 0.2s; }\n' +
            '.fc-shadow-rail .cta:hover { background:rgba(139,92,246,0.12); }\n' +
            '@media (max-width: 640px) { .fc-shadow-rail { font-size:0.66rem; gap:8px; padding:6px 10px; } .fc-shadow-rail .eyebrow { display:none; } .fc-shadow-rail .cta { display:none; } .fc-shadow-rail .agg { padding-left:6px; } }\n' +
            '@media (max-width: 380px) { .fc-shadow-rail .age { display:none; } }';
        document.head.appendChild(css);
    }

    function ensureMount() {
        var el = document.getElementById('fc-shadow-rail');
        if (el) {
            el.classList.add('fc-shadow-mount');
            return el;
        }
        el = document.createElement('div');
        el.id = 'fc-shadow-rail';
        el.className = 'fc-shadow-mount';
        document.body.insertBefore(el, document.body.firstChild);
        return el;
    }

    function anchorBelowMaverick(mount) {
        // The Maverick rail mounts first and reserves its slot via body
        // padding-top. We mount BELOW it: top = current body padding-top
        // (which already accounts for Maverick rail height), and we then
        // add another 36px of body padding for ourselves.
        if (document.body.dataset.fcShadowMounted) return;
        var current = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
        var railH = window.innerWidth <= 480 ? 32 : 36;
        // Maverick rail occupies the bottom railH of the current padding;
        // we anchor right under it (top = current_padding - 0 = current).
        // No: Maverick rail top = original_topbar (current - railH).
        // Maverick rail bottom = current. So Shadow goes at current.
        mount.style.top = current + 'px';
        document.body.style.paddingTop = (current + railH) + 'px';
        document.body.dataset.fcShadowMounted = '1';
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
            '<div class="fc-shadow-rail" role="region" aria-label="Shadow live cohort feed">' +
                '<span class="eyebrow">SHADOW &middot; LIVE</span>' +
                '<div class="row" id="fc-shadow-row"><span class="age">connecting&hellip;</span></div>' +
                '<div class="agg" id="fc-shadow-agg">cohort &middot; &mdash;</div>' +
                '<a class="cta" href="https://shadow.freedomcore.io/">Open SHADOW &rsaquo;</a>' +
            '</div>';
        els.row = mount.querySelector('#fc-shadow-row');
        els.agg = mount.querySelector('#fc-shadow-agg');
    }

    function renderRow(row) {
        if (!row) return '<span class="age">awaiting cohort fire</span>';
        var sideCls = (row.side || '').toLowerCase() === 'buy' ? 'buy' : 'sell';
        return '' +
            '<span class="sym">' + (row.symbol || '--') + '</span>' +
            '<span class="side ' + sideCls + '">' + (row.side || '--').toUpperCase() + '</span>' +
            '<span class="whales">' + (row.whales || 0) + ' whales</span>' +
            '<span class="age">' + relTime(row.ts) + '</span>';
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
        var fills = (agg.fills_24h == null) ? '--' : agg.fills_24h.toLocaleString();
        var pct24 = agg.pct_24h;
        var net = '';
        if (pct24 != null) {
            var cls = pct24 >= 0 ? 'pos' : 'neg';
            net = ' &middot; <span class="' + cls + '">' + (pct24 >= 0 ? '+' : '') + pct24.toFixed(2) + '%</span>';
        }
        els.agg.innerHTML = 'COHORT &middot; ' + fills + ' fills/24h' + net;
    }

    function poll() {
        fetch(FEED_URL, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                if (!data) return;
                state.rows = data.rows || [];
                state.agg = data.aggregate_today || null;
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
        // Wait for fc-live-rail.js to mount first, then anchor below it.
        // Defer one tick so the Maverick rail sets its body padding adjustment first.
        setTimeout(function () {
            anchorBelowMaverick(mount);
        }, 0);
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
