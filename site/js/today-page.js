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
            : {'X-API-Key': 'fcweb_RETIRED_KEY_ROTATED_20260514'};
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
                        var pnlPos = (t.pnl_pct || 0) >= 0;
                        var cls = pnlPos ? 'pos' : 'neg';
                        var hhmm = (t.time || '').substr(11,5);
                        var pnlUsd = (t.pnl_usd !== undefined && t.pnl_usd !== null)
                            ? (pnlPos ? '+$' : '-$') + Math.abs(Number(t.pnl_usd)).toFixed(2)
                            : '--';
                        var meta = esc(t.regime || '--') + ' · ' + esc((t.exit_reason || '').replace(/_/g, ' '));
                        return '<div class="trade-row ' + cls + '">' +
                            '<div class="tr-body">' +
                                '<span class="tr-time">' + esc(hhmm) + '</span>' +
                                '<span class="tr-sym">' + esc(t.symbol || '?') + '</span>' +
                            '</div>' +
                            '<div class="tr-pnl ' + cls + '">' + pnlUsd + '</div>' +
                            '<div class="tr-meta">' + meta + '</div>' +
                            '<div class="tr-pct ' + cls + '">' + fmtPct(t.pnl_pct) + '</div>' +
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
                        var dirLabel = (p.direction || '--').toUpperCase();
                        var roiCls = (p.roi_pct || 0) >= 0 ? 'pos' : 'neg';
                        return '<div class="position-row ' + esc(dir) + '">' +
                            '<div class="pr-body">' +
                                '<span class="pr-sym">' + esc(p.symbol || '?') + '</span>' +
                                '<span class="pr-dir ' + esc(dir) + '">' + esc(dirLabel) + '</span>' +
                            '</div>' +
                            '<div class="pr-roi ' + roiCls + '">' + fmtPct(p.roi_pct) + '</div>' +
                            '<div class="pr-meta">' + esc(p.regime || '--') + '</div>' +
                        '</div>';
                    }).join('');
                }
            }
        } catch (e) {
            var list = document.getElementById('today-trades-list');
            if (list) list.innerHTML = '<div class="empty-note">Performance feed unreachable.</div>';
        }
    }

    function _fmtAge(secs) {
        if (secs == null) return '—';
        var s = Number(secs);
        if (s < 3600)  return Math.floor(s / 60) + 'm ago';
        if (s < 86400) return Math.floor(s / 3600) + 'h ago';
        return Math.floor(s / 86400) + 'd ago';
    }
    async function loadChampion() {
        try {
            var r = await fetch('/api/live/champion', {cache: 'no-store', headers: _apiHeaders()});
            var c = await r.json();
            var verified = c.live_verified ? 'Live verified' : 'Live';
            el('champ-label', 'Trinity Cascade · ' + verified);
            el('champ-name', c.fighter_name || 'Unnamed Champion');
            el('champ-codename', (c.name || '') + ' v' + (c.version || '?'));
            el('champ-tagline', c.tagline || 'New species. Awaiting narrative.');
            // Meta strip
            var meta = document.getElementById('champ-meta');
            if (meta) meta.hidden = false;
            el('champ-score', c.score != null ? Number(c.score).toLocaleString('en-US') : '—');
            el('champ-crown', _fmtAge(c.crown_age_secs));
            el('champ-prev',  c.previous_strategy || '—');
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
