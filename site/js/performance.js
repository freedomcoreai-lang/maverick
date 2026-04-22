(function() {
    var API = '/api_data/performance.json';

    function fmt(n, decimals) {
        if (n === null || n === undefined || isNaN(n)) return '--';
        return (n >= 0 ? '+' : '') + Number(n).toFixed(decimals !== undefined ? decimals : 2);
    }

    function timeAgo(iso) {
        var d = new Date(iso);
        var now = new Date();
        var mins = Math.floor((now - d) / 60000);
        if (mins < 60) return mins + 'm ago';
        var hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + 'h ago';
        return Math.floor(hrs / 24) + 'd ago';
    }

    function render(data) {
        // Updated timestamp
        var updated = document.getElementById('perf-updated');
        if (updated && data.updated) {
            var d = new Date(data.updated);
            updated.textContent = 'Last updated: ' + d.toUTCString() + ' (' + timeAgo(data.updated) + ')';
        }

        // 24h summary
        renderSummary(data.summary_24h, '24h');
        // 7d summary
        renderSummary(data.summary_7d, '7d');

        // Equity curve
        renderEquity(data.equity_curve || []);

        // Live positions
        renderPositions(data.live_positions || []);

        // Recent trades
        renderTrades(data.recent_trades || []);
    }

    function renderSummary(s, suffix) {
        if (!s) return;
        var pnl = document.getElementById('pnl-' + suffix);
        if (pnl) {
            pnl.textContent = fmt(s.pnl_pct) + '%';
            pnl.className = 'perf-pnl ' + (s.pnl_pct >= 0 ? 'positive' : 'negative');
        }
        var wr = document.getElementById('wr-' + suffix);
        if (wr) wr.textContent = s.win_rate + '%';
        var trades = document.getElementById('trades-' + suffix);
        if (trades) trades.textContent = s.trades;
        var avgwin = document.getElementById('avgwin-' + suffix);
        if (avgwin) avgwin.textContent = fmt(s.avg_win) + '%';
        var avgloss = document.getElementById('avgloss-' + suffix);
        if (avgloss) avgloss.textContent = fmt(s.avg_loss) + '%';
    }

    function renderEquity(curve) {
        var container = document.getElementById('equity-chart');
        if (!container) return;
        container.innerHTML = '';

        if (curve.length === 0) {
            container.innerHTML = '<div class="empty-state">No equity data available</div>';
            return;
        }

        var maxAbs = 0;
        for (var i = 0; i < curve.length; i++) {
            var abs = Math.abs(curve[i].cumulative_pct);
            if (abs > maxAbs) maxAbs = abs;
        }
        if (maxAbs === 0) maxAbs = 1;

        for (var j = 0; j < curve.length; j++) {
            var pt = curve[j];
            var wrap = document.createElement('div');
            wrap.className = 'equity-bar-wrap';

            var val = document.createElement('div');
            val.className = 'equity-bar-val';
            val.textContent = fmt(pt.cumulative_pct) + '%';

            var bar = document.createElement('div');
            bar.className = 'equity-bar ' + (pt.cumulative_pct >= 0 ? 'positive' : 'negative');
            var h = Math.max(4, (Math.abs(pt.cumulative_pct) / maxAbs) * 140);
            bar.style.height = h + 'px';

            var label = document.createElement('div');
            label.className = 'equity-bar-label';
            var parts = pt.date.split('-');
            label.textContent = parts[1] + '/' + parts[2];

            wrap.appendChild(val);
            wrap.appendChild(bar);
            wrap.appendChild(label);
            container.appendChild(wrap);
        }
    }

    function renderPositions(positions) {
        var container = document.getElementById('live-positions');
        if (!container) return;
        container.innerHTML = '';

        if (positions.length === 0) {
            container.innerHTML = '<div class="empty-state">No open positions</div>';
            return;
        }

        for (var i = 0; i < positions.length; i++) {
            var p = positions[i];
            var card = document.createElement('div');
            card.className = 'pos-live-card';

            var left = document.createElement('div');
            left.innerHTML = '<span class="pos-live-sym">' + p.symbol + '</span>' +
                '<span class="pos-live-dir ' + (p.direction === 'LONG' ? 'long' : 'short') + '">' +
                p.direction + '</span>';

            var right = document.createElement('div');
            right.className = 'pos-live-roi';
            right.style.color = p.roi_pct >= 0 ? 'var(--green)' : 'var(--red)';
            right.textContent = fmt(p.roi_pct) + '%';

            card.appendChild(left);
            card.appendChild(right);
            container.appendChild(card);
        }
    }

    function renderTrades(trades) {
        var tbody = document.getElementById('trades-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (trades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No recent trades</td></tr>';
            return;
        }

        for (var i = trades.length - 1; i >= 0; i--) {
            var t = trades[i];
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td class="sym">' + t.symbol + '</td>' +
                '<td>' + t.regime + '</td>' +
                '<td>' + t.exit_reason + '</td>' +
                '<td class="' + (t.pnl_pct >= 0 ? 'pnl-pos' : 'pnl-neg') + '">' + fmt(t.pnl_pct) + '%</td>';
            tbody.appendChild(tr);
        }
    }

    function load() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', API + '?t=' + Date.now(), true);
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    // Also fetch live positions to override the stale static ones
                    var xhr2 = new XMLHttpRequest();
                    xhr2.open('GET', '/api/positions?t=' + Date.now(), true);
                    xhr2.onload = function() {
                        if (xhr2.status === 200) {
                            try {
                                var posData = JSON.parse(xhr2.responseText);
                                // Map live API fields to what the renderer expects
                                data.live_positions = (posData.positions || []).map(function(p) {
                                    return {
                                        symbol: (p.sym_short || p.symbol || '').replace('USDTM', ''),
                                        direction: (p.direction || '').toUpperCase(),
                                        roi_pct: parseFloat(p.roi || p.pnl_pct || 0),
                                        pnl_usd: parseFloat(p.pnl_usd || p.unrealized_pnl || 0)
                                    };
                                });
                            } catch(e) {}
                        }
                        render(data);
                    };
                    xhr2.onerror = function() { render(data); };
                    xhr2.send();
                } catch (e) {
                    console.error('Performance JSON parse error:', e);
                }
            }
        };
        xhr.onerror = function() {
            console.error('Performance fetch failed');
        };
        xhr.send();
    }

    document.addEventListener('DOMContentLoaded', load);
    setInterval(load, 30000);
})();
