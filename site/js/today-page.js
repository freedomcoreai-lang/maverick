/* today-page.js — loads today's PnL, win rate, positions, trades, champion.
 * Extracted out of pages/today.html because the site CSP (script-src 'self')
 * blocks inline <script>. Called once on load + every 60s.
 */
(function() {
    'use strict';

    function fmtPct(v) {
        if (v === undefined || v === null) return '-';
        var n = Number(v);
        return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
    }

    function fmtDate(d) {
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        return days[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + months[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
    }

    function el(id, v) {
        var e = document.getElementById(id);
        if (e && v !== undefined) e.textContent = v;
        return e;
    }

    var dateEl = document.getElementById('today-date');
    if (dateEl) dateEl.textContent = fmtDate(new Date());

    // Next Saturday 17:00 BST = 16:00 UTC
    function updateCountdown() {
        var timerEl = document.getElementById('countdown-timer');
        if (!timerEl) return;
        var now = new Date();
        var target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 16, 0, 0));
        while (target.getUTCDay() !== 6 || target <= now) {
            target.setUTCDate(target.getUTCDate() + 1);
        }
        var ms = target - now;
        if (ms <= 0) { timerEl.textContent = 'FIRING'; return; }
        var d = Math.floor(ms / 86400000);
        var h = Math.floor((ms % 86400000) / 3600000);
        var m = Math.floor((ms % 3600000) / 60000);
        var s = Math.floor((ms % 60000) / 1000);
        timerEl.textContent = d + 'd ' + h + 'h ' + m + 'm ' + s + 's';
    }
    updateCountdown();
    setInterval(updateCountdown, 1000);

    function _apiHeaders() {
        return (typeof window.fcMergeHeaders === 'function')
            ? window.fcMergeHeaders()
            : {'X-API-Key': 'fcweb_60fd94aa2d910f38a9f3e0557076791a'};
    }

    function esc(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    async function loadPerformance() {
        try {
            var r = await fetch('/api_data/performance.json?_=' + Date.now(), {cache: 'no-store'});
            var d = await r.json();
            var s = d.summary_24h || {};
            var pnl = s.pnl_pct;
            var pnlEl = document.getElementById('today-pnl');
            if (pnlEl) {
                pnlEl.textContent = fmtPct(pnl);
                pnlEl.style.color = pnl == null ? 'var(--text)' : (pnl > 0 ? 'var(--green)' : pnl < 0 ? 'var(--red)' : 'var(--text)');
            }
            el('today-wr', (s.win_rate !== undefined && s.win_rate !== null ? s.win_rate.toFixed(1) + '%' : '-'));
            el('today-trades', (s.trades || 0) + ' trades today');
            el('today-open', (d.live_positions || []).length);

            // Today's trades
            var today = new Date().toISOString().slice(0, 10);
            var trades = (d.recent_trades || []).filter(function(t) { return (t.time || '').startsWith(today); });
            var list = document.getElementById('today-trades-list');
            if (list) {
                if (trades.length === 0) {
                    list.innerHTML = '<div class="empty-note">No closed trades today yet. Live positions may still be running.</div>';
                } else {
                    list.innerHTML = trades.map(function(t) {
                        var pnlCls = t.pnl_pct >= 0 ? 'pos' : 'neg';
                        var hhmm = (t.time || '').substr(11,5);
                        return '<div class="trade-row">' +
                            '<div class="trade-time">' + esc(hhmm) + '</div>' +
                            '<div><div class="trade-sym">' + esc(t.symbol || '?') + '</div><div class="trade-regime">' + esc(t.regime || '--') + ' &middot; ' + esc((t.exit_reason || '').replace(/_/g, ' ')) + '</div></div>' +
                            '<div style="color:var(--text-dim); font-size:0.68rem;">$' + (t.pnl_usd !== undefined ? t.pnl_usd.toFixed(2) : '--') + '</div>' +
                            '<div class="trade-pnl ' + pnlCls + '">' + fmtPct(t.pnl_pct) + '</div>' +
                            '</div>';
                    }).join('');
                }
            }

            // Positions
            var pos = d.live_positions || [];
            var posList = document.getElementById('today-positions-list');
            if (posList) {
                if (pos.length === 0) {
                    posList.innerHTML = '<div class="empty-note">No open positions right now.</div>';
                } else {
                    posList.innerHTML = pos.map(function(p) {
                        var dir = (p.direction || '').toLowerCase();
                        var roiCls = p.roi_pct >= 0 ? 'pos' : 'neg';
                        return '<div class="position-row">' +
                            '<div class="trade-sym">' + esc(p.symbol || '?') + '</div>' +
                            '<div class="position-dir ' + esc(dir) + '">' + esc(p.direction || '--') + '</div>' +
                            '<div class="trade-regime">' + esc(p.regime || '--') + '</div>' +
                            '<div class="position-roi ' + roiCls + '" style="color:' + (p.roi_pct >= 0 ? 'var(--green)' : 'var(--red)') + ';">' + fmtPct(p.roi_pct) + '</div>' +
                            '</div>';
                    }).join('');
                }
            }
        } catch (e) {
            var list = document.getElementById('today-trades-list');
            if (list) list.innerHTML = '<div class="empty-note">Performance feed unreachable.</div>';
        }
    }

    async function loadChampion() {
        try {
            var r = await fetch('/api/live/champion', {cache: 'no-store', headers: _apiHeaders()});
            var c = await r.json();
            el('champ-label', 'Platinum Champion · ' + (c.live_verified ? 'Live Verified' : 'Live'));
            el('champ-name', c.fighter_name || 'Unnamed Champion');
            el('champ-codename', (c.name || '') + ' v' + (c.version || '?'));
            el('champ-tagline', c.tagline || 'New species. Awaiting narrative.');
        } catch (e) {
            el('champ-name', 'Champion data unreachable');
        }
    }

    async function loadStats() {
        try {
            var r = await fetch('/api/live/stats', {cache: 'no-store', headers: _apiHeaders()});
            var s = await r.json();
            el('today-symbols', s.active_symbols || '-');
        } catch (e) {}
    }

    function refreshAll() {
        loadPerformance();
        loadChampion();
        loadStats();
    }
    refreshAll();
    setInterval(refreshAll, 60000);
})();
