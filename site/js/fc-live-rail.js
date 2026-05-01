/* fc-live-rail.js — cross-site live ticker. 
 * Redesigned as a card mirroring the FreedomCore apex hub.
 */
(function () {
    'use strict';
    var FEED_URL = 'https://maverick.freedomcore.io/api_data/live_ledger.json';
    var POLL_MS = 60000;
    var TICK_MS = 3500;
    var state = { rows: [], idx: 0, summary_24h: null, last_updated: 0 };
    var els = {};
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function injectStyles() {
        if (document.getElementById('fc-live-rail-style')) return;
        var css = document.createElement('style');
        css.id = 'fc-live-rail-style';
        css.textContent = '' +
            '.fc-mav-card { background: linear-gradient(180deg, rgba(20,24,34,0.78), rgba(7,10,16,0.84)); border: 1px solid color-mix(in srgb, #ffd700 32%, transparent); border-radius: 10px; padding: 14px 18px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 0 32px color-mix(in srgb, #ffd700 16%, transparent), inset 0 0 0 1px rgba(255,255,255,0.04); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color: #f5f5fa; font-family: "Inter", sans-serif; text-align: left; } ' +
            '[data-theme="light"] .fc-mav-card { background: linear-gradient(180deg, rgba(238,247,255,0.92), rgba(248,250,255,0.95)); border-color: rgba(200,140,20,0.4); color: #0a0a0f; box-shadow: 0 4px 16px rgba(0,0,0,0.08); } ' +
            '.fc-mav-card__head { display: flex; justify-content: space-between; align-items: center; gap: 12px; } ' +
            '.fc-mav-card__eyebrow { font-family: "JetBrains Mono", monospace; font-size: 0.62rem; letter-spacing: 0.18em; color: #ffd700; text-transform: uppercase; font-weight: 700; } ' +
            '[data-theme="light"] .fc-mav-card__eyebrow { color: #b45309; } ' +
            '.fc-mav-card__fresh { font-family: "JetBrains Mono", monospace; font-size: 0.55rem; letter-spacing: 0.10em; color: rgba(245,245,250,0.6); } ' +
            '[data-theme="light"] .fc-mav-card__fresh { color: rgba(10,10,15,0.6); } ' +
            '.fc-mav-card__ticker { min-height: 28px; padding: 8px 12px; border: 1px solid color-mix(in srgb, #ffd700 20%, transparent); border-radius: 6px; background: rgba(0,0,0,0.36); font-family: "JetBrains Mono", monospace; font-size: 0.78rem; letter-spacing: 0.04em; color: rgba(245,245,250,0.92); display: flex; align-items: center; overflow: hidden; transition: opacity 0.3s; } ' +
            '[data-theme="light"] .fc-mav-card__ticker { background: rgba(255,255,255,0.78); border-color: rgba(200,140,20,0.2); color: #0a0a0f; } ' +
            '.fc-mav-card__ticker.fading { opacity: 0; } ' +
            '.fc-mav-card__tag { color: #ffd700; font-weight: 800; margin-right: 8px; letter-spacing: 0.10em; flex-shrink: 0; } ' +
            '[data-theme="light"] .fc-mav-card__tag { color: #b45309; } ' +
            '.fc-mav-card__sym { color: #f5f5fa; font-weight: 700; margin-right: 8px; flex-shrink: 0; } ' +
            '[data-theme="light"] .fc-mav-card__sym { color: #0a0a0f; } ' +
            '.fc-mav-card__reason { color: rgba(245,245,250,0.55); margin-right: 10px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } ' +
            '[data-theme="light"] .fc-mav-card__reason { color: rgba(10,10,15,0.6); } ' +
            '.fc-mav-card__pnl.win { color: #22c55e; font-weight: 700; margin-right: 8px; flex-shrink: 0; } ' +
            '.fc-mav-card__pnl.loss { color: #ef4444; font-weight: 700; margin-right: 8px; flex-shrink: 0; } ' +
            '.fc-mav-card__age { color: rgba(245,245,250,0.45); white-space: nowrap; flex-shrink: 0; } ' +
            '[data-theme="light"] .fc-mav-card__age { color: rgba(10,10,15,0.45); } ' +
            '.fc-mav-card__agg { font-family: "JetBrains Mono", monospace; font-size: 0.62rem; letter-spacing: 0.10em; color: rgba(245,245,250,0.66); text-transform: uppercase; } ' +
            '[data-theme="light"] .fc-mav-card__agg { color: rgba(10,10,15,0.66); } ' +
            '.fc-mav-card__agg .w { color: #22c55e; font-weight: 700; } ' +
            '.fc-mav-card__agg .l { color: #ef4444; font-weight: 700; } ' +
            '@media (max-width: 640px) { .fc-mav-card__ticker { font-size: 0.65rem; padding: 6px 8px; } .fc-mav-card { padding: 10px 12px; } }';
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
        mount.className = 'fc-mav-card';
        mount.setAttribute('role', 'region');
        mount.setAttribute('aria-label', 'Maverick live broker ledger');
        mount.innerHTML = '' +
            '<div class="fc-mav-card__head">' +
                '<span class="fc-mav-card__eyebrow">MAVERICK &middot; AUTONOMOUS AI TRADER</span>' +
                '<span class="fc-mav-card__fresh" id="fc-mav-rail-fresh">updated --</span>' +
            '</div>' +
            '<div class="fc-mav-card__ticker" id="fc-mav-rail-ticker" aria-live="polite">' +
                '<span style="color:rgba(245,245,250,0.45)">connecting&hellip;</span>' +
            '</div>' +
            '<div class="fc-mav-card__agg" id="fc-mav-rail-agg">TODAY &middot; &mdash;</div>';
        
        var container = ensureContainer();
        container.appendChild(mount);
        
        els.ticker = mount.querySelector('#fc-mav-rail-ticker');
        els.agg = mount.querySelector('#fc-mav-rail-agg');
        els.fresh = mount.querySelector('#fc-mav-rail-fresh');
    }

    function renderRow(row) {
        if (!row) return '<span style="color:rgba(245,245,250,0.45)">no recent fills</span>';
        var tag = (row.tag || 'MAVERICK').toUpperCase();
        var sym = row.symbol || '--';
        var pnl = (row.pnl_pct >= 0 ? '+' : '') + (row.pnl_pct || 0).toFixed(2) + '%';
        var cls = row.pnl_pct >= 0 ? 'win' : 'loss';
        var reason = (row.reason || '').replace('CHAMPION:', '');
        return '' +
            '<span class="fc-mav-card__tag">' + tag + '</span>' +
            '<span class="fc-mav-card__sym">' + sym + '</span>' +
            '<span class="fc-mav-card__reason">' + reason + '</span>' +
            '<span class="fc-mav-card__pnl ' + cls + '">' + pnl + '</span>' +
            '<span class="fc-mav-card__age">' + relTime(row.ts) + '</span>';
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
        var s = state.summary_24h;
        if (!s || s.trades == null) {
            els.agg.innerHTML = 'TODAY &middot; awaiting close';
            return;
        }
        var trades = s.trades;
        var wr     = (s.win_rate != null) ? s.win_rate.toFixed(1) + '%' : '--';
        var pnl    = s.pnl_pct;
        var pnlStr = (pnl >= 0 ? '+' : '') + (pnl == null ? '0.00' : pnl.toFixed(2)) + '%';
        var pnlCls = pnl >= 0 ? 'w' : 'l';
        els.agg.innerHTML = 'TODAY &middot; ' + trades + ' trades &middot; ' + wr + ' WR &middot; <span class="' + pnlCls + '">' + pnlStr + '</span>';
        
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
                state.summary_24h = data.summary_24h || null;
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
