/* fc-shadow-rail.js — cross-site live ticker for SHADOW.
 * Matches the FreedomCore apex hub card design but narrower/shorter.
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
            '.fc-ticker-wrap { width: min(900px, 94%); margin: 14px auto; padding: 10px 14px; display: grid; grid-template-columns: 1fr; gap: 4px; border: 1px solid color-mix(in srgb, var(--rail-accent, #ffd700) 32%, transparent); border-radius: 8px; background: linear-gradient(90deg, color-mix(in srgb, var(--rail-accent, #ffd700) 8%, transparent), transparent 50%), linear-gradient(180deg, rgba(20, 24, 34, 0.78), rgba(7, 10, 16, 0.84)); box-shadow: 0 0 24px color-mix(in srgb, var(--rail-accent, #ffd700) 12%, transparent), inset 0 0 0 1px rgba(255, 255, 255, 0.04); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color: #f5f5fa; text-align: left; position: relative; z-index: 150; font-family: "Inter", sans-serif; } ' +
            '[data-theme="light"] .fc-ticker-wrap { background: linear-gradient(90deg, color-mix(in srgb, var(--rail-accent, #b45309) 8%, transparent), transparent 50%), rgba(238,247,255,0.92); border-color: color-mix(in srgb, var(--rail-accent, #b45309) 40%, transparent); color: #0a0a0f; box-shadow: 0 4px 16px rgba(0,0,0,0.08); } ' +
            '.fc-ticker-wrap .fc-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; } ' +
            '.fc-ticker-wrap .fc-eyebrow { font-family: "JetBrains Mono", monospace; font-size: 0.58rem; letter-spacing: 0.18em; color: var(--rail-accent, #ffd700); text-transform: uppercase; font-weight: 700; } ' +
            '[data-theme="light"] .fc-ticker-wrap .fc-eyebrow { color: var(--rail-accent, #b45309); } ' +
            '.fc-ticker-wrap .fc-fresh { font-family: "JetBrains Mono", monospace; font-size: 0.55rem; letter-spacing: 0.10em; color: rgba(245,245,250,0.6); white-space: nowrap; } ' +
            '[data-theme="light"] .fc-ticker-wrap .fc-fresh { color: rgba(10,10,15,0.6); } ' +
            '.fc-ticker-wrap .fc-claim { font-size: 0.8rem; font-weight: 700; line-height: 1.3; margin: 2px 0 4px 0; } ' +
            '.fc-ticker-wrap .fc-ticker-box { min-height: 26px; padding: 6px 10px; border: 1px solid color-mix(in srgb, var(--rail-accent, #ffd700) 20%, transparent); border-radius: 6px; background: rgba(0,0,0,0.36); font-family: "JetBrains Mono", monospace; font-size: 0.72rem; letter-spacing: 0.04em; color: rgba(245,245,250,0.92); display: flex; align-items: center; overflow: hidden; transition: opacity 0.3s; } ' +
            '[data-theme="light"] .fc-ticker-wrap .fc-ticker-box { background: rgba(255,255,255,0.78); border-color: color-mix(in srgb, var(--rail-accent, #b45309) 20%, transparent); color: #0a0a0f; } ' +
            '.fc-ticker-wrap .fc-ticker-box.fading { opacity: 0; } ' +
            '.fc-ticker-wrap .fc-ticker-box .tag { color: var(--rail-accent, #ffd700); font-weight: 800; margin-right: 8px; letter-spacing: 0.10em; flex-shrink: 0; } ' +
            '[data-theme="light"] .fc-ticker-wrap .fc-ticker-box .tag { color: var(--rail-accent, #b45309); } ' +
            '.fc-ticker-wrap .fc-ticker-box .sym { font-weight: 700; margin-right: 8px; flex-shrink: 0; } ' +
            '.fc-ticker-wrap .fc-ticker-box .reason { color: rgba(245,245,250,0.55); margin-right: 10px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } ' +
            '[data-theme="light"] .fc-ticker-wrap .fc-ticker-box .reason { color: rgba(10,10,15,0.6); } ' +
            '.fc-ticker-wrap .fc-ticker-box .pnl.win { color: #22c55e; font-weight: 700; margin-right: 8px; flex-shrink: 0; } ' +
            '.fc-ticker-wrap .fc-ticker-box .pnl.loss { color: #ef4444; font-weight: 700; margin-right: 8px; flex-shrink: 0; } ' +
            '.fc-ticker-wrap .fc-ticker-box .age { color: rgba(245,245,250,0.45); white-space: nowrap; flex-shrink: 0; } ' +
            '[data-theme="light"] .fc-ticker-wrap .fc-ticker-box .age { color: rgba(10,10,15,0.45); } ' +
            '.fc-ticker-wrap .fc-agg { font-family: "JetBrains Mono", monospace; font-size: 0.58rem; letter-spacing: 0.10em; color: rgba(245,245,250,0.66); text-transform: uppercase; margin-top: 2px; } ' +
            '[data-theme="light"] .fc-ticker-wrap .fc-agg { color: rgba(10,10,15,0.66); } ' +
            '.fc-ticker-wrap .fc-agg .pos { color: #22c55e; font-weight: 700; } ' +
            '.fc-ticker-wrap .fc-agg .neg { color: #ef4444; font-weight: 700; } ' +
            '.fc-ticker-wrap .fc-cta { margin-top: 2px; justify-self: end; padding: 6px 16px; background: var(--rail-accent, #ffd700); color: #000; font-family: "Orbitron", sans-serif; font-size: 0.7rem; font-weight: 900; letter-spacing: 0.16em; text-decoration: none; text-transform: uppercase; border-radius: 6px; box-shadow: 0 0 16px color-mix(in srgb, var(--rail-accent, #ffd700) 34%, transparent); transition: transform 0.2s, box-shadow 0.2s; display: inline-block; } ' +
            '[data-theme="light"] .fc-ticker-wrap .fc-cta { color: #fff; background: var(--rail-accent, #b45309); } ' +
            '.fc-ticker-wrap .fc-cta:hover { transform: translateY(-2px); box-shadow: 0 0 24px color-mix(in srgb, var(--rail-accent, #ffd700) 58%, transparent); } ' +
            '@media (max-width: 640px) { .fc-ticker-wrap .fc-ticker-box { font-size: 0.65rem; padding: 6px 8px; } .fc-ticker-wrap { padding: 10px 12px; margin: 10px auto; } .fc-ticker-wrap .fc-cta { justify-self: stretch; text-align: center; } }';
        document.head.appendChild(css);
    }

    function getContainer() {
        var el = document.getElementById('fc-global-ticker-container');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'fc-global-ticker-container';
        // Add to body, right after grid-bg or nav if possible, else top of body
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
        mount.className = 'fc-ticker-wrap fc-shadow-wrap';
        mount.style.setProperty('--rail-accent', '#8b5cf6');
        if (document.documentElement.getAttribute('data-theme') === 'light') {
            mount.style.setProperty('--rail-accent', '#6d3bcc');
        }
        mount.setAttribute('role', 'region');
        mount.setAttribute('aria-label', 'Shadow live cohort feed');
        mount.innerHTML = '' +
            '<div class="fc-head">' +
                '<span class="fc-eyebrow">SHADOW &middot; WHALE COPY TRADER</span>' +
                '<span class="fc-fresh" id="fc-shadow-rail-fresh">updated --</span>' +
            '</div>' +
            '<div class="fc-claim">Live consensus fills from top tracked wallets.</div>' +
            '<div class="fc-ticker-box" id="fc-shadow-rail-ticker" aria-live="polite">' +
                '<span style="color:rgba(245,245,250,0.45)">connecting&hellip;</span>' +
            '</div>' +
            '<div class="fc-agg" id="fc-shadow-rail-agg">COHORT &middot; &mdash;</div>' +
            '<a class="fc-cta" href="https://shadow.freedomcore.io/">OPEN SHADOW &rarr;</a>';
        
        var container = getContainer();
        container.appendChild(mount);
        
        els.ticker = mount.querySelector('#fc-shadow-rail-ticker');
        els.agg = mount.querySelector('#fc-shadow-rail-agg');
        els.fresh = mount.querySelector('#fc-shadow-rail-fresh');
    }

    function renderRow(row) {
        if (!row) return '<span style="color:rgba(245,245,250,0.45)">awaiting cohort fire</span>';
        var sideCls = (row.side || '').toLowerCase() === 'buy' ? 'win' : 'loss';
        return '' +
            '<span class="tag">SHD</span>' +
            '<span class="sym">' + (row.symbol || '--') + '</span>' +
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
                renderAgg();
                tick();
            })
            .catch(function () { /* silent */ });
    }

    function start() {
        injectStyles();
        // Delay slightly so Maverick gets first position in container
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