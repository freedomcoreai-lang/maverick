/* fc-shadow-rail.js — slim cross-site live ticker for SHADOW.
 * Card design with internal ticker window, heavily compressed.
 */
(function () {
    'use strict';
    // Do not inject on Maverick or FreedomCore Hub sites
    if (window.location.hostname.indexOf('maverick.') !== -1 || window.location.hostname === 'freedomcore.io') return;

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
            '.fc-mini-card { width: min(1000px, 94%); margin: 0 auto; padding: 6px 12px; display: flex; align-items: center; gap: 12px; ' +
            'background: color-mix(in srgb, var(--site-accent, #888) 4%, var(--surface, rgba(20,24,34,0.85))); ' +
            'border: 1px solid color-mix(in srgb, var(--site-accent, #888) 20%, var(--border, rgba(255,255,255,0.1))); ' +
            'border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); ' +
            'font-family: "JetBrains Mono", monospace; font-size: 0.7rem; color: var(--text, #f5f5fa); z-index: 150; position: relative; } ' +
            '[data-theme="light"] .fc-mini-card { background: color-mix(in srgb, var(--site-accent, #888) 4%, var(--surface, #ffffff)); box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-color: color-mix(in srgb, var(--site-accent, #888) 25%, var(--border, #e0e0e0)); color: var(--text, #0a0a0f); } ' +
            '.fc-mini-brand.shadow { font-weight: 800; color: #8b5cf6; letter-spacing: 0.1em; flex-shrink: 0; } ' +
            '[data-theme="light"] .fc-mini-brand.shadow { color: #6d3bcc; } ' +
            '.fc-mini-ticker { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.25); padding: 4px 10px; border-radius: 4px; border: 1px inset rgba(255,255,255,0.05); overflow: hidden; transition: opacity 0.3s; } ' +
            '[data-theme="light"] .fc-mini-ticker { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.05); border-style: solid; } ' +
            '.fc-mini-ticker.fading { opacity: 0; } ' +
            '.fc-mini-ticker .sym { font-weight: 700; color: var(--text-primary, #fff); flex-shrink: 0; } ' +
            '[data-theme="light"] .fc-mini-ticker .sym { color: var(--text-primary, #000); } ' +
            '.fc-mini-ticker .reason { color: var(--text-dim, rgba(255,255,255,0.6)); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: "Inter", sans-serif; font-size: 0.75rem; } ' +
            '[data-theme="light"] .fc-mini-ticker .reason { color: rgba(10,10,15,0.6); } ' +
            '.fc-mini-ticker .pnl.win { color: #22c55e; font-weight: 700; flex-shrink: 0; } ' +
            '.fc-mini-ticker .pnl.loss { color: #ef4444; font-weight: 700; flex-shrink: 0; } ' +
            '.fc-mini-ticker .age { color: var(--text-dim, rgba(255,255,255,0.4)); font-size: 0.6rem; flex-shrink: 0; } ' +
            '.fc-mini-stats { font-size: 0.65rem; color: var(--text-dim, rgba(255,255,255,0.7)); flex-shrink: 0; white-space: nowrap; padding-left: 8px; border-left: 1px solid var(--border, rgba(255,255,255,0.1)); } ' +
            '[data-theme="light"] .fc-mini-stats { color: rgba(10,10,15,0.7); border-left-color: var(--border, #e0e0e0); } ' +
            '.fc-mini-stats .pos { color: #22c55e; font-weight: 700; } ' +
            '.fc-mini-stats .neg { color: #ef4444; font-weight: 700; } ' +
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
        mount.setAttribute('aria-label', 'Shadow live whales feed');
        mount.innerHTML = '' +
            '<div class="fc-mini-brand shadow">SHADOW&nbsp;&nbsp;</div>' +
            '<div class="fc-mini-ticker" id="fc-shd-ticker-box" aria-live="polite">' +
                '<span style="color:var(--text-dim, rgba(255,255,255,0.4))">connecting&hellip;</span>' +
            '</div>' +
            '<div class="fc-mini-stats" id="fc-shd-stats">24H &middot; &mdash;</div>';
        
        var container = getContainer();
        container.appendChild(mount);
        
        els.ticker = mount.querySelector('#fc-shd-ticker-box');
        els.agg = mount.querySelector('#fc-shd-stats');
    }

    function renderRow(row) {
        if (!row) return '<span style="color:var(--text-dim, rgba(255,255,255,0.4))">awaiting whale signal</span>';
        var sym = row.symbol || '--';
        var sideCls = (row.side || '').toLowerCase() === 'buy' ? 'win' : 'loss';
        return '' +
            '<span class="sym">' + sym + '</span>' +
            '<span class="pnl ' + sideCls + '">' + (row.side || '--').toUpperCase() + '</span>' +
            '<span class="reason">' + (row.whales || 0) + ' whales converged</span>' +
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
        var fills = (agg.fills_24h == null) ? '--' : agg.fills_24h.toLocaleString();
        var pct_life = agg.pct_lifetime;
        var net = '';
        if (pct_life != null) {
            var cls = pct_life >= 0 ? 'pos' : 'neg';
            net = ' &middot; LIFE <span class="' + cls + '">' + (pct_life >= 0 ? '+' : '') + pct_life.toFixed(1) + '%</span>';
        }
        els.agg.innerHTML = '24H: ' + fills + ' fills' + net;
    }

    function poll() {
        fetch(FEED_URL, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                if (!data) return;
                state.rows = data.rows || [];
                state.agg = data.aggregate_today || null;
                renderAgg();
                tick();
            })
            .catch(function () { /* silent */ });
    }

    function start() {
        injectStyles();
        // Slight delay so Maverick gets the top slot if both load
        setTimeout(function() {
            buildShell();
            poll();
            setInterval(poll, POLL_MS);
            if (!reduceMotion) setInterval(tick, TICK_MS);
        }, 50);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();