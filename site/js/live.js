/* live.js -- MAVERICK /live page polling client.
 *
 * First paint is server-rendered via the /live Flask route (values baked
 * into HTML). After DOMContentLoaded we take over with a 5 s poll loop
 * that refreshes the DOM nodes in place. No full re-renders, no flash.
 *
 * Spec: 5 s polling (not WebSocket -- simpler surface, scales fine for
 * current traffic). WebSocket is a later optimization.
 */
(function () {
    'use strict';

    var POLL_MS = 5000;
    var API_KEY = 'fcweb_60fd94aa2d910f38a9f3e0557076791a';

    function fc(url) {
        if (typeof fcFetch === 'function') {
            return fcFetch(url, { cache: 'no-store' });
        }
        return fetch(url, { cache: 'no-store', headers: { 'X-API-Key': API_KEY } });
    }

    function setText(id, v) {
        var el = document.getElementById(id);
        if (el && v !== undefined && v !== null && v !== '') el.textContent = v;
    }

    function setPnlValue(id, pnl) {
        var el = document.getElementById(id);
        if (!el || pnl === undefined || pnl === null) return;
        var n = Number(pnl);
        if (Number.isNaN(n)) return;
        el.textContent = (n >= 0 ? '+' : '') + n.toFixed(2) + ' USD';
        el.classList.remove('pnl-display__value--up', 'pnl-display__value--down');
        el.classList.add(n >= 0 ? 'pnl-display__value--up' : 'pnl-display__value--down');
    }

    function humanUptime(secs) {
        if (!secs || secs < 0) return '--';
        var d = Math.floor(secs / 86400);
        var h = Math.floor((secs % 86400) / 3600);
        var m = Math.floor((secs % 3600) / 60);
        if (d) return d + 'd ' + h + 'h ' + m + 'm';
        if (h) return h + 'h ' + m + 'm';
        return m + 'm';
    }

    async function pollChampion() {
        try {
            var r = await fc('/api/live/champion');
            if (!r.ok) return;
            var d = await r.json();
            if (d.name) setText('live-champion-name', d.name.replace(/_/g, ' '));
            if (d.version) setText('live-champion-version', d.version);
            if (typeof d.crown_age_secs === 'number') setText('live-champion-uptime', humanUptime(d.crown_age_secs));
        } catch (e) { /* silent */ }
    }

    async function pollPositions() {
        try {
            var r = await fc('/api/live/positions');
            if (!r.ok) return;
            var d = await r.json();
            var grid = document.getElementById('positions-grid');
            if (!grid || !Array.isArray(d.positions)) return;
            var existing = {};
            Array.prototype.forEach.call(grid.querySelectorAll('[data-symbol]'), function (el) {
                existing[el.getAttribute('data-symbol')] = el;
            });
            d.positions.forEach(function (p) {
                var sym = (p.symbol || '').replace('USDTM', '');
                var card = existing[sym] || existing[p.symbol];
                if (!card) return;  // skip unknowns; full re-render would flash
                var pnl = card.querySelector('[data-field="pnl_pct"]');
                var price = card.querySelector('[data-field="price"]');
                var pnlPct = Number(p.pnl_pct);
                if (pnl && !Number.isNaN(pnlPct)) {
                    pnl.textContent = (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(2) + '%';
                    pnl.classList.remove('pos-pnl--up', 'pos-pnl--down');
                    pnl.classList.add(pnlPct >= 0 ? 'pos-pnl--up' : 'pos-pnl--down');
                }
                if (price && p.current_price) {
                    price.textContent = Number(p.current_price).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
                }
            });
        } catch (e) { /* silent */ }
    }

    async function pollStats() {
        try {
            var r = await fc('/api/live/stats');
            if (!r.ok) return;
            var d = await r.json();
            if (typeof d.pnl_today === 'number') setPnlValue('pnl-today', d.pnl_today);
            if (typeof d.pnl_week  === 'number') setPnlValue('pnl-week',  d.pnl_week);
        } catch (e) { /* silent */ }
    }

    async function pollSwarm() {
        try {
            var r = await fc('/api/swarm_status');
            if (!r.ok) return;
            var d = await r.json();
            if (typeof d.gen === 'number') setText('swarm-gen', '#' + d.gen);
            if (d.phase) setText('swarm-phase', d.phase);
            var total = d.total || 50;
            var pct = total > 0 ? Math.min(100, Math.round(d.gen * 100 / total)) : 0;
            setText('swarm-progress-pct', pct + '%');
            var fill = document.getElementById('swarm-progress-fill');
            if (fill) fill.style.width = pct + '%';
            var remain = total - (d.gen || 0);
            setText('swarm-countdown', remain > 0 ? remain + ' gens' : 'queued');
        } catch (e) { /* silent */ }
    }

    function tick() {
        pollChampion();
        pollPositions();
        pollStats();
        pollSwarm();
    }

    function hydrateServerValues() {
        /* server-rendered data-attributes -> CSS properties on first paint */
        var fill = document.getElementById('swarm-progress-fill');
        if (fill) {
            var pct = parseInt(fill.getAttribute('data-progress') || '0', 10);
            fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
        }
    }

    function boot() {
        hydrateServerValues();
        tick();
        setInterval(tick, POLL_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
