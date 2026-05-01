/* fc-live-rail.js — slim cross-site live ticker.
 * Card design with internal ticker window, heavily compressed.
 */
(function () {
    'use strict';
    // Do not inject on Maverick or FreedomCore Hub sites
    if (window.location.hostname.indexOf('maverick.') !== -1 || window.location.hostname === 'freedomcore.io') return;

    var FEED_URL = 'https://maverick.freedomcore.io/api_data/live_ledger.json';
    var POLL_MS = 60000;
    var TICK_MS = 3500;
    var state = { rows: [], idx: 0, agg: null };
    var els = {};
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function injectStyles() {
        if (document.getElementById('fc-live-rail-style')) return;
        var css = document.createElement('style');
        css.id = 'fc-live-rail-style';
        css.textContent = '' +
            '.fc-mini-card { width: min(1000px, 94%); margin: 0 auto; padding: 6px 12px; display: flex; align-items: center; gap: 12px; ' +
            'background: color-mix(in srgb, var(--site-accent, #888) 4%, var(--surface, rgba(20,24,34,0.85))); ' +
            'border: 1px solid color-mix(in srgb, var(--site-accent, #888) 20%, var(--border, rgba(255,255,255,0.1))); ' +
            'border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); ' +
            'font-family: "JetBrains Mono", monospace; font-size: 0.7rem; color: var(--text, #f5f5fa); z-index: 150; position: relative; } ' +
            '[data-theme="light"] .fc-mini-card { background: color-mix(in srgb, var(--site-accent, #888) 4%, var(--surface, #ffffff)); box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-color: color-mix(in srgb, var(--site-accent, #888) 25%, var(--border, #e0e0e0)); color: var(--text, #0a0a0f); } ' +
            '.fc-mini-brand { font-weight: 800; color: #ffd700; letter-spacing: 0.1em; flex-shrink: 0; } ' +
            '[data-theme="light"] .fc-mini-brand { color: #a17900; } ' +
            '.fc-mini-ticker { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.25); padding: 4px 10px; border-radius: 4px; border: 1px inset rgba(255,255,255,0.05); overflow: hidden; transition: opacity 0.3s; } ' +
            '[data-theme="light"] .fc-mini-ticker { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.05); border-style: solid; } ' +
            '.fc-mini-ticker.fading { opacity: 0; } ' +
            '.fc-mini-ticker .tag { color: #ffd700; font-weight: 800; letter-spacing: 0.05em; flex-shrink: 0; } ' +
            '[data-theme="light"] .fc-mini-ticker .tag { color: #a17900; } ' +
            '.fc-mini-ticker .sym { font-weight: 700; color: var(--text-primary, #fff); flex-shrink: 0; } ' +
            '[data-theme="light"] .fc-mini-ticker .sym { color: var(--text-primary, #000); } ' +
            '.fc-mini-ticker .reason { color: var(--text-dim, rgba(255,255,255,0.6)); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: "Inter", sans-serif; font-size: 0.75rem; } ' +
            '[data-theme="light"] .fc-mini-ticker .reason { color: rgba(10,10,15,0.6); } ' +
            '.fc-mini-ticker .pnl.win { color: #22c55e; font-weight: 700; flex-shrink: 0; } ' +
            '.fc-mini-ticker .pnl.loss { color: #ef4444; font-weight: 700; flex-shrink: 0; } ' +
            '.fc-mini-ticker .age { color: var(--text-dim, rgba(255,255,255,0.4)); font-size: 0.6rem; flex-shrink: 0; } ' +
            '.fc-mini-stats { font-size: 0.65rem; color: var(--text-dim, rgba(255,255,255,0.7)); flex-shrink: 0; white-space: nowrap; padding-left: 8px; border-left: 1px solid var(--border, rgba(255,255,255,0.1)); } ' +
            '[data-theme="light"] .fc-mini-stats { color: rgba(10,10,15,0.7); border-left-color: var(--border, #e0e0e0); } ' +
            '.fc-mini-stats .w { color: #22c55e; font-weight: 700; } ' +
            '.fc-mini-stats .l { color: #ef4444; font-weight: 700; } ' +
            '@media (max-width: 768px) { .fc-mini-card { flex-wrap: wrap; gap: 6px; padding: 6px 10px; margin: 4px auto; } .fc-mini-ticker { width: 100%; flex: none; font-size: 0.65rem; padding: 4px 6px; } .fc-mini-brand { font-size: 0.65rem; } .fc-mini-stats { font-size: 0.6rem; margin-left: auto; border: none; padding-left: 0; } }';
        document.head.appendChild(css);
    }

    function getContainer() {
        var el = document.getElementById('fc-global-ticker-container');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'fc-global-ticker-container';
        el.style.cssText = 'position:relative; z-index:150; display:flex; flex-direction:column; gap:6px; margin: 16px auto 24px;';
        
        var gridBg = document.querySelector('.grid-bg');
        if (gridBg && gridBg.nextSibling) {
            gridBg.parentNode.insertBefore(el, gridBg.nextSibling);
        } else {
            var nav = document.querySelector('nav.nav');
            if (nav && nav.nextSibling) {
                nav.parentNode.insertBefore(el, nav.nextSibling);
            } else {
                document.body.insertBefore(el, document.body.firstChild);
            }
        }
        return el;
    }

    function relTime(ts) {
        var s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
        if (s < 60) return s + 's ago';
        if (s < 3600) return Math.floor(s / 60) + 'm ago';
        if (s < 86400) return Math.floor(s / 3600) + 'h ago';
        return Math.floor(s / 86400) + 'd ago';
    }

    function buildShell() {
        var mount = document.createElement('div');
        mount.className = 'fc-mini-card';
        mount.setAttribute('role', 'region');
        mount.setAttribute('aria-label', 'Maverick live ledger');
        mount.innerHTML = '' +
            '<div class="fc-mini-brand">MAVERICK</div>' +
            '<div class="fc-mini-ticker" id="fc-mav-ticker-box" aria-live="polite">' +
                '<span style="color:var(--text-dim, rgba(255,255,255,0.4))">connecting&hellip;</span>' +
            '</div>' +
            '<div class="fc-mini-stats" id="fc-mav-stats">7D &middot; &mdash;</div>';
        
        var container = getContainer();
        container.appendChild(mount);
        
        els.ticker = mount.querySelector('#fc-mav-ticker-box');
        els.agg = mount.querySelector('#fc-mav-stats');
    }

    function renderRow(row) {
        if (!row) return '<span style="color:var(--text-dim, rgba(255,255,255,0.4))">no recent fills</span>';
        var sym = row.symbol || '--';
        var pnl = (row.pnl_pct >= 0 ? '+' : '') + (row.pnl_pct || 0).toFixed(2) + '%';
        var cls = row.pnl_pct >= 0 ? 'win' : 'loss';
        var reason = (row.reason || '').replace('CHAMPION:', '');
        return '' +
            '<span class="sym">' + sym + '</span>' +
            '<span class="pnl ' + cls + '">' + pnl + '</span>' +
            '<span class="reason">' + reason + '</span>' +
            '<span class="age">' + relTime(row.ts) + '</span>';
    }

    function tick() {
        if (!state.rows.length || !els.ticker) return;
        var row = state.rows[state.idx % state.rows.length];
        els.ticker.classList.add('fading');
        setTimeout(function () {
            els.ticker.innerHTML = renderRow(row);
            els.ticker.classList.remove('fading');
        }, reduceMotion ? 0 : 220);
        state.idx++;
    }

    function renderAgg() {
        if (!els.agg) return;
        var agg = state.agg || {};
        var wins = (agg.wins != null) ? agg.wins : '--';
        var losses = (agg.losses != null) ? agg.losses : '--';
        var wr = (agg.wr_pct != null) ? agg.wr_pct : '--';
        els.agg.innerHTML = '7D: <span class="w">' + wins + 'W</span> / <span class="l">' + losses + 'L</span> &middot; WR ' + wr + '%';
    }

    function poll() {
        fetch(FEED_URL, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                if (!data) return;
                state.rows = data.rows || [];
                state.agg = data.aggregate_7d || null;
                renderAgg();
                tick();
            })
            .catch(function () { /* silent */ });
    }

    function start() {
        injectStyles();
        buildShell();
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