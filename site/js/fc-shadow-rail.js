/* fc-shadow-rail.js — cross-site live ticker for SHADOW. 
 * Redesigned as a card mirroring the FreedomCore apex hub.
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
            '.fc-shadow-card { background: linear-gradient(180deg, rgba(20,24,34,0.78), rgba(7,10,16,0.84)); border: 1px solid color-mix(in srgb, #8b5cf6 32%, transparent); border-radius: 10px; padding: 14px 18px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 0 32px color-mix(in srgb, #8b5cf6 16%, transparent), inset 0 0 0 1px rgba(255,255,255,0.04); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color: #f5f5fa; font-family: "Inter", sans-serif; text-align: left; } ' +
            '[data-theme="light"] .fc-shadow-card { background: linear-gradient(180deg, rgba(245,240,255,0.92), rgba(250,248,255,0.95)); border-color: rgba(109,59,204,0.4); color: #0a0a0f; box-shadow: 0 4px 16px rgba(0,0,0,0.08); } ' +
            '.fc-shadow-card__head { display: flex; justify-content: space-between; align-items: center; gap: 12px; } ' +
            '.fc-shadow-card__eyebrow { font-family: "JetBrains Mono", monospace; font-size: 0.62rem; letter-spacing: 0.18em; color: #8b5cf6; text-transform: uppercase; font-weight: 700; } ' +
            '[data-theme="light"] .fc-shadow-card__eyebrow { color: #6d3bcc; } ' +
            '.fc-shadow-card__fresh { font-family: "JetBrains Mono", monospace; font-size: 0.55rem; letter-spacing: 0.10em; color: rgba(245,245,250,0.6); } ' +
            '[data-theme="light"] .fc-shadow-card__fresh { color: rgba(10,10,15,0.6); } ' +
            '.fc-shadow-card__ticker { min-height: 28px; padding: 8px 12px; border: 1px solid color-mix(in srgb, #8b5cf6 20%, transparent); border-radius: 6px; background: rgba(0,0,0,0.36); font-family: "JetBrains Mono", monospace; font-size: 0.78rem; letter-spacing: 0.04em; color: rgba(245,245,250,0.92); display: flex; align-items: center; overflow: hidden; transition: opacity 0.3s; } ' +
            '[data-theme="light"] .fc-shadow-card__ticker { background: rgba(255,255,255,0.78); border-color: rgba(109,59,204,0.2); color: #0a0a0f; } ' +
            '.fc-shadow-card__ticker.fading { opacity: 0; } ' +
            '.fc-shadow-card__tag { color: #8b5cf6; font-weight: 800; margin-right: 8px; letter-spacing: 0.10em; flex-shrink: 0; } ' +
            '[data-theme="light"] .fc-shadow-card__tag { color: #6d3bcc; } ' +
            '.fc-shadow-card__sym { color: #f5f5fa; font-weight: 700; margin-right: 8px; flex-shrink: 0; } ' +
            '[data-theme="light"] .fc-shadow-card__sym { color: #0a0a0f; } ' +
            '.fc-shadow-card__side.buy { color: #22c55e; font-weight: 700; margin-right: 8px; flex-shrink: 0; } ' +
            '.fc-shadow-card__side.sell { color: #ef4444; font-weight: 700; margin-right: 8px; flex-shrink: 0; } ' +
            '.fc-shadow-card__reason { color: rgba(245,245,250,0.55); margin-right: 10px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } ' +
            '[data-theme="light"] .fc-shadow-card__reason { color: rgba(10,10,15,0.6); } ' +
            '.fc-shadow-card__age { color: rgba(245,245,250,0.45); white-space: nowrap; flex-shrink: 0; } ' +
            '[data-theme="light"] .fc-shadow-card__age { color: rgba(10,10,15,0.45); } ' +
            '.fc-shadow-card__agg { font-family: "JetBrains Mono", monospace; font-size: 0.62rem; letter-spacing: 0.10em; color: rgba(245,245,250,0.66); text-transform: uppercase; } ' +
            '[data-theme="light"] .fc-shadow-card__agg { color: rgba(10,10,15,0.66); } ' +
            '.fc-shadow-card__agg .pos { color: #22c55e; font-weight: 700; } ' +
            '.fc-shadow-card__agg .neg { color: #ef4444; font-weight: 700; } ' +
            '@media (max-width: 640px) { .fc-shadow-card__ticker { font-size: 0.65rem; padding: 6px 8px; } .fc-shadow-card { padding: 10px 12px; } }';
        document.head.appendChild(css);
    }

    function ensureContainer() {
        var el = document.getElementById('fc-ticker-cards');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'fc-ticker-cards';
        el.style.cssText = 'position:relative; z-index:150; max-width:680px; width:92%; margin: 20px auto 32px; display:flex; flex-direction:column; gap:16px;';
        document.body.insertBefore(el, document.body.firstChild);
        document.body.style.paddingTop = ''; 
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
        mount.className = 'fc-shadow-card';
        mount.setAttribute('role', 'region');
        mount.setAttribute('aria-label', 'Shadow live cohort feed');
        mount.innerHTML = '' +
            '<div class="fc-shadow-card__head">' +
                '<span class="fc-shadow-card__eyebrow">SHADOW &middot; WHALE COPY TRADER</span>' +
                '<span class="fc-shadow-card__fresh" id="fc-shadow-rail-fresh">updated --</span>' +
            '</div>' +
            '<div class="fc-shadow-card__ticker" id="fc-shadow-rail-ticker" aria-live="polite">' +
                '<span style="color:rgba(245,245,250,0.45)">connecting&hellip;</span>' +
            '</div>' +
            '<div class="fc-shadow-card__agg" id="fc-shadow-rail-agg">COHORT &middot; &mdash;</div>';
        
        var container = ensureContainer();
        container.appendChild(mount);
        
        els.ticker = mount.querySelector('#fc-shadow-rail-ticker');
        els.agg = mount.querySelector('#fc-shadow-rail-agg');
        els.fresh = mount.querySelector('#fc-shadow-rail-fresh');
    }

    function renderRow(row) {
        if (!row) return '<span style="color:rgba(245,245,250,0.45)">awaiting cohort fire</span>';
        var sideCls = (row.side || '').toLowerCase() === 'buy' ? 'buy' : 'sell';
        return '' +
            '<span class="fc-shadow-card__tag">SHD</span>' +
            '<span class="fc-shadow-card__sym">' + (row.symbol || '--') + '</span>' +
            '<span class="fc-shadow-card__side ' + sideCls + '">' + (row.side || '--').toUpperCase() + '</span>' +
            '<span class="fc-shadow-card__reason">' + (row.whales || 0) + ' whales converged</span>' +
            '<span class="fc-shadow-card__age">' + relTime(row.ts) + '</span>';
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

    function renderAgg(agg) {
        if (!agg || !els.agg) return;
        var fills = (agg.fills_24h == null) ? '--' : agg.fills_24h.toLocaleString();
        var pct_life = agg.pct_lifetime;
        var net = '';
        if (pct_life != null) {
            var cls = pct_life >= 0 ? 'pos' : 'neg';
            net = ' &middot; LIFETIME <span class="' + cls + '">' + (pct_life >= 0 ? '+' : '') + pct_life.toFixed(2) + '%</span>';
        }
        els.agg.innerHTML = 'COHORT &middot; ' + fills + ' fills/24h' + net;
        
        if (els.fresh) {
            var now = new Date();
            var hours = now.getHours().toString().padStart(2, '0');
            var mins = now.getMinutes().toString().padStart(2, '0');
            els.fresh.textContent = 'updated ' + hours + ':' + mins;
        }
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
        // Wait a tick to ensure container is fully established by Maverick rail if it loaded first
        setTimeout(function () {
            buildShell();
            poll();
            setInterval(poll, POLL_MS);
            if (!reduceMotion) setInterval(tick, TICK_MS);
        }, 0);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
