/* signals-page.js - world-class Signal Feed that reflects the live champion.
 * Loads /api/champion_signals and renders rich rows + click-to-expand breakdown
 * covering reasoning, indicators, DNA snapshot, and live position state.
 */
(function () {
    'use strict';

    const FC_API_KEY = (typeof FC_API_HEADERS === 'object' && FC_API_HEADERS['X-API-Key'])
        || 'fcweb_60fd94aa2d910f38a9f3e0557076791a';
    // Prefer mav-wallet's header merger (attaches X-Owner-Key from localStorage
    // automatically so owner-bypass works regardless of script load order).
    const apiFetch = (u, o) => {
        o = Object.assign({ credentials: 'same-origin' }, o || {});
        o.headers = (typeof window.fcMergeHeaders === 'function')
            ? window.fcMergeHeaders(o.headers)
            : Object.assign({ 'X-API-Key': FC_API_KEY }, o.headers || {});
        return fetch(u, o);
    };

    const feedEl = document.getElementById('champ-signal-feed');
    const headEl = document.getElementById('champ-head');
    const statsEl = document.getElementById('champ-stats');
    const filterEls = document.querySelectorAll('[data-sigfilter]');
    if (!feedEl) return;

    let currentFilter = 'all';
    let allSignals = [];
    let expandedIds = new Set();

    function esc(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function fmtNum(v, dp) {
        if (v === undefined || v === null || v === 999 || Number.isNaN(v)) return '-';
        const n = Number(v);
        if (!isFinite(n)) return '-';
        return n.toFixed(dp === undefined ? 2 : dp);
    }
    function fmtPrice(v) {
        if (v === undefined || v === null || !v) return '-';
        const n = Number(v);
        if (n >= 1000) return n.toFixed(2);
        if (n >= 1)    return n.toFixed(4);
        return n.toFixed(6);
    }
    function ago(ts) {
        if (!ts) return '-';
        const diff = Math.floor(Date.now() / 1000) - ts;
        if (diff < 60)    return diff + 's ago';
        if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    }
    function dirStyle(dir) {
        return dir === 'long'
            ? { color: 'var(--green)', bg: 'rgba(78,205,196,0.10)', label: 'BULL' }
            : { color: 'var(--neg)',   bg: 'rgba(239,68,68,0.10)', label: 'BEAR' };
    }
    function statusStyle(st) {
        if (st === 'filled') return { color: '#3ea8f5', label: 'FILLED · LIVE' };
        if (st === 'closed') return { color: '#8a9fb4', label: 'CLOSED' };
        return { color: '#f5a623', label: 'FIRED' };
    }

    function renderHeader(champ) {
        if (!headEl) return;
        const thesis = champ.thesis ? champ.thesis.split('\n\n')[0].slice(0, 260) + (champ.thesis.length > 260 ? '…' : '') : '';
        headEl.innerHTML =
            '<div style="font-family:\'JetBrains Mono\',monospace; font-size:0.62rem; color:#ffd700; letter-spacing:2.5px; text-transform:uppercase; margin-bottom:6px;">LIVE CHAMPION EMITTING SIGNALS</div>' +
            '<div style="font-size:1.5rem; font-weight:800; color:var(--text); line-height:1.2;">' + esc(champ.name || 'unknown') + ' <span style="font-family:\'JetBrains Mono\',monospace; color:var(--accent); font-size:0.8rem; font-weight:500;">v' + esc(champ.version || '?') + '</span></div>' +
            (thesis ? '<div style="color:var(--text-dim); font-size:0.85rem; line-height:1.6; margin-top:10px;">' + esc(thesis) + '</div>' : '');
    }

    function renderStats(signals) {
        if (!statsEl) return;
        const n = signals.length;
        const longs  = signals.filter(s => s.direction === 'long').length;
        const shorts = signals.filter(s => s.direction === 'short').length;
        const open   = signals.filter(s => s.status === 'filled' || s.status === 'signal').length;
        const closed = signals.filter(s => s.status === 'closed');
        const wins   = closed.filter(s => (s.pnl_usd || 0) > 0).length;
        const wr     = closed.length ? (wins / closed.length * 100).toFixed(1) + '%' : '-';
        const totPnl = closed.reduce((a, s) => a + (s.pnl_usd || 0), 0);
        const pnlTxt = closed.length
            ? (totPnl >= 0 ? '+$' : '-$') + Math.abs(totPnl).toFixed(2)
            : '-';
        const setTxt = (id, v, col) => { const el = document.getElementById(id); if (el) { el.textContent = v; if (col) el.style.color = col; } };
        setTxt('sig-total',  n);
        setTxt('sig-long',   longs);
        setTxt('sig-short',  shorts);
        setTxt('sig-live',   open);
        setTxt('sig-wr',     wr);
        setTxt('sig-totpnl', pnlTxt, totPnl >= 0 ? 'var(--green)' : 'var(--neg)');
    }

    function signalMatchesFilter(s) {
        switch (currentFilter) {
            case 'long':    return s.direction === 'long';
            case 'short':   return s.direction === 'short';
            case 'live':    return s.status === 'filled' || s.status === 'signal';
            case 'closed':  return s.status === 'closed';
            case 'winners': return s.status === 'closed' && (s.pnl_usd || 0) > 0;
            case 'losers':  return s.status === 'closed' && (s.pnl_usd || 0) < 0;
            default:        return true;
        }
    }

    function dnaBlock(dna) {
        if (!dna || !Object.keys(dna).length) return '';
        const rows = Object.keys(dna).sort().map(k =>
            '<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 8px;background:rgba(255,255,255,0.02);border-radius:5px;font-family:\'JetBrains Mono\',monospace;font-size:0.68rem;">' +
                '<span style="color:var(--text-dim);">' + esc(k) + '</span>' +
                '<span style="color:var(--accent);font-weight:700;">' + esc(dna[k]) + '</span>' +
            '</div>'
        ).join('');
        return (
            '<div style="margin-top:16px;">' +
                '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.62rem;letter-spacing:2px;color:var(--green);text-transform:uppercase;margin-bottom:8px;">🧬 DNA Snapshot at signal time · ' + Object.keys(dna).length + ' knobs</div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px;">' + rows + '</div>' +
            '</div>'
        );
    }

    // Normalise a raw symbol (e.g. "BTC", "BTCUSDTM", "XBTUSDT") into a
    // KuCoin TradingView perp ticker: "BTCUSDT.P". Champion emits bare bases.
    function tvTickerFor(sym) {
        if (!sym) return 'BTCUSDT.P';
        var s = String(sym).toUpperCase().trim();
        if (s === 'XBT') s = 'BTC';
        s = s.replace(/^XBT/, 'BTC');
        s = s.replace(/USDTM$/, 'USDT');   // KuCoin futures → spot-like
        s = s.replace(/USDT\.P$/, 'USDT'); // already perp — rebuild below
        if (!/USDT$/.test(s)) s = s + 'USDT';
        return s + '.P';
    }

    // Opens a modal overlay containing the embedded TradingView widget
    // for the given symbol. Theme-aware so it matches the site's day/night mode.
    function openChartOverlay(sym) {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const ticker = tvTickerFor(sym);
        const tvSym = encodeURIComponent('KUCOIN:' + ticker);
        const src = 'https://s.tradingview.com/widgetembed/?frameElementId=tv_signal_chart' +
            '&symbol=' + tvSym +
            '&interval=15&hidesidetoolbar=1&symboledit=0&saveimage=0' +
            '&toolbarbg=' + (isLight ? 'ffffff' : '0a0f18') +
            '&theme=' + (isLight ? 'light' : 'dark') +
            '&style=1&timezone=Etc%2FUTC&withdateranges=1&showvolume=true';
        const wrap = document.createElement('div');
        wrap.id = 'sig-chart-overlay';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:1000;background:#0a0f18;display:flex;flex-direction:column;align-items:stretch;';
        // Header bar lives ABOVE the iframe so the close button never sits on
        // the price axis or any chart value. Iframe takes whatever height
        // remains via flex:1.
        wrap.innerHTML =
            '<div style="flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;' +
                 'padding:10px 14px;background:#06090f;border-bottom:1px solid rgba(255,255,255,0.08);">' +
                '<span style="font-family:\'JetBrains Mono\',monospace;font-size:0.62rem;letter-spacing:2px;' +
                       'text-transform:uppercase;color:var(--gold);">Champion Chart · ' + esc(sym) + '</span>' +
                '<button id="sig-chart-close" aria-label="Close chart" type="button" ' +
                        'style="background:rgba(0,0,0,0.85);border:1px solid #ff1744;border-radius:50%;' +
                        'color:#fff;font-size:1.1rem;line-height:1;width:32px;height:32px;cursor:pointer;' +
                        'display:flex;align-items:center;justify-content:center;flex-shrink:0;">&times;</button>' +
            '</div>' +
            '<iframe src="' + src + '" style="flex:1;width:100%;border:none;background:#0a0f18;" allowfullscreen></iframe>';
        document.body.appendChild(wrap);
        document.body.style.overflow = 'hidden';
        function closeChart() {
            const el = document.getElementById('sig-chart-overlay');
            if (el) el.remove();
            document.body.style.overflow = '';
            document.removeEventListener('keydown', escHandler);
        }
        function escHandler(e) { if (e.key === 'Escape') closeChart(); }
        wrap.addEventListener('click', function(e) {
            if (e.target.id === 'sig-chart-close' || e.target === wrap) closeChart();
        });
        document.addEventListener('keydown', escHandler);
    }
    // Expose to inline onclick handlers
    window.fcOpenSignalChart = openChartOverlay;

    function indicatorsBlock(bar, s) {
        const picks = [
            ['ADX',       bar.adx_14, 1, 'Trend strength · <20 rng · >25 trnd'],
            ['Chop',      bar.chop_14, 1, 'Range index · <40 trnd · >60 chop'],
            ['RSI',       bar.rsi_14, 1, '<30 oversold · >70 overbought'],
            ['ATR',       s.atr || bar.atr_14, 5, 'Volatility unit'],
            ['Close',     bar.close, 0, 'Price at signal'],
            ['Volume',    bar.volume, 0, 'Bar volume'],
            ['+DI',       bar.plus_di, 1, 'Bull pressure'],
            ['-DI',       bar.minus_di, 1, 'Bear pressure'],
            ['Stoch K',   bar.stoch_k, 1, '<20 OS · >80 OB'],
            ['ADX 1h',    bar.adx_1h, 1, 'Higher TF trend'],
            ['ADX 4h',    bar.adx_4h, 1, 'Multi-TF context'],
        ];
        const rows = picks.filter(p => p[1] !== undefined && p[1] !== null && p[1] !== '').map(p =>
            '<div style="padding:8px 10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:6px;">' +
                '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.58rem;color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;">' + esc(p[0]) + '</div>' +
                '<div style="font-size:0.9rem;color:var(--text);font-weight:700;margin-top:2px;">' + (p[2] === 0 ? fmtPrice(p[1]) : fmtNum(p[1], p[2])) + '</div>' +
                '<div style="font-size:0.6rem;color:var(--text-dim);margin-top:2px;">' + esc(p[3]) + '</div>' +
            '</div>'
        ).join('');
        return (
            '<div style="margin-top:16px;">' +
                '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.62rem;letter-spacing:2px;color:var(--accent);text-transform:uppercase;margin-bottom:8px;">📊 Indicator stack at signal time</div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;">' + rows + '</div>' +
            '</div>'
        );
    }

    function outcomeBlock(s) {
        if (s.status === 'closed') {
            const pnlCls = (s.pnl_usd || 0) >= 0 ? 'var(--green)' : 'var(--neg)';
            return (
                '<div style="margin-top:16px;padding:12px 14px;background:rgba(255,255,255,0.02);border-left:3px solid ' + pnlCls + ';border-radius:6px;">' +
                    '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.62rem;letter-spacing:2px;color:' + pnlCls + ';text-transform:uppercase;margin-bottom:6px;">🏁 Outcome</div>' +
                    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;font-size:0.8rem;">' +
                        '<div><span style="color:var(--text-dim);">Exit Price</span><br><b style="color:var(--text);">' + fmtPrice(s.exit_price) + '</b></div>' +
                        '<div><span style="color:var(--text-dim);">Exit Reason</span><br><b style="color:var(--text);">' + esc(s.exit_reason || '-') + '</b></div>' +
                        '<div><span style="color:var(--text-dim);">PnL USD</span><br><b style="color:' + pnlCls + ';">$' + fmtNum(s.pnl_usd, 2) + '</b></div>' +
                        '<div><span style="color:var(--text-dim);">PnL %</span><br><b style="color:' + pnlCls + ';">' + fmtNum(s.pnl_pct, 2) + '%</b></div>' +
                    '</div>' +
                '</div>'
            );
        }
        return '';
    }

    function renderRow(s) {
        const ds = dirStyle(s.direction);
        const ss = statusStyle(s.status);
        const isOpen = expandedIds.has(s.id);

        // Header row: the ONLY clickable target for toggling. Expanded content
        // below is click-inert so users can interact with the breakdown without
        // accidentally closing the card.
        let html =
            '<div class="champ-sig' + (isOpen ? ' is-open' : '') + '" data-sig-id="' + s.id + '">' +
                '<div class="champ-sig-head" data-toggle-id="' + s.id + '">' +
                    '<div class="cs-ago">' + ago(s.ts_unix) + '</div>' +
                    '<div class="cs-body">' +
                        '<div class="cs-body-top">' +
                            '<span class="cs-dir" style="color:' + ds.color + ';background:' + ds.bg + ';">' + ds.label + '</span>' +
                            '<span class="cs-symbol">' + esc(s.symbol || '') + '</span>' +
                            '<span class="cs-label">' + esc(s.signal_label || '') + '</span>' +
                        '</div>' +
                        '<div class="cs-meta">' +
                            'entry ' + fmtPrice(s.entry_price) + (s.stop_price ? '  ·  stop ' + fmtPrice(s.stop_price) : '') + (s.leverage ? '  ·  ' + s.leverage + 'x' : '') +
                        '</div>' +
                    '</div>' +
                    '<div class="cs-status" style="color:' + ss.color + ';">' + ss.label + '</div>' +
                    '<div class="cs-toggle">' + (isOpen ? '▲ HIDE' : '▼ OPEN') + '</div>' +
                '</div>';

        if (isOpen) {
            const reasonExplain = explainLabel(s.signal_label, s.direction);
            const sym = (s.symbol || '').toUpperCase();

            // Inert expanded panel - does NOT bubble clicks to the toggle.
            html += '<div class="champ-sig-body" data-close-id="' + s.id + '" style="padding:0 16px 16px 16px;border-top:1px solid var(--border);">' +
                '<div style="margin-top:14px;padding:12px 14px;background:rgba(62,168,245,0.05);border-left:3px solid var(--accent);border-radius:6px;">' +
                    '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.62rem;letter-spacing:2px;color:var(--accent);text-transform:uppercase;margin-bottom:6px;">🎯 Why this fired</div>' +
                    '<div style="color:var(--text);font-size:0.88rem;line-height:1.65;">' + esc(reasonExplain) + '</div>' +
                '</div>' +
                // Embedded chart trigger — CSP-safe via data-chart-sym attribute
                // (inline onclick is blocked by our script-src 'self' policy).
                '<div style="margin-top:14px;">' +
                    '<button class="champ-sig-chart-btn" data-chart-sym="' + esc(sym) + '" ' +
                    'style="width:100%; padding:12px 14px; background:linear-gradient(135deg,rgba(78,205,196,0.12),rgba(62,168,245,0.08)); border:1px solid var(--green); border-radius:8px; cursor:pointer; color:var(--text); font-family:\'JetBrains Mono\',monospace; font-size:0.72rem; letter-spacing:1px; text-transform:uppercase; font-weight:700; text-align:center;">' +
                        '📈 View ' + esc(sym) + ' chart' +
                    '</button>' +
                '</div>' +
                indicatorsBlock(s.bar || {}, s) +
                dnaBlock(s.dna || {}) +
                outcomeBlock(s) +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">' +
                    '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.58rem;color:var(--text-dim);letter-spacing:1px;">fired ' + esc(s.ts_iso || '') + ' · id ' + s.id + '</div>' +
                    '<button class="champ-sig-close" data-close-id="' + s.id + '" style="background:transparent;border:1px solid var(--border);color:var(--text-dim);font-family:\'JetBrains Mono\',monospace;font-size:0.6rem;letter-spacing:1.5px;padding:6px 12px;border-radius:6px;cursor:pointer;text-transform:uppercase;">✕ Close</button>' +
                '</div>' +
            '</div>';
        }

        html += '</div>';
        return html;
    }

    // Human-language interpretation of the champion's signal label
    function explainLabel(label, direction) {
        const dir = direction === 'long' ? 'long' : 'short';
        if (!label) return 'Champion emitted a ' + dir + ' entry signal.';
        const L = String(label);
        const LU = L.toUpperCase();
        if (LU.indexOf('RANGEREV') >= 0)
            return 'Mean-reversion fade in a ranging regime. Champion saw price punch through a 50-bar ' + (dir === 'long' ? 'low' : 'high') + ' with RSI confirming exhaustion - fading back toward the mean.';
        if (LU.indexOf('TRENDMOMENTUM') >= 0)
            return 'Momentum breakout in a trending regime. Price cleared the 50-bar ' + (dir === 'long' ? 'high' : 'low') + ' with volume above 1.5× the 20-bar average - institutional confirmation of direction.';
        if (LU.indexOf('BOS') >= 0)
            return 'Break of Structure fire. The champion identified a structural ' + (dir === 'long' ? 'higher-high' : 'lower-low') + ' and entered on the first retest.';
        if (LU.indexOf('OTE') >= 0 || LU.indexOf('FIB') >= 0)
            return 'Optimal Trade Entry zone (61.8-78.6% retracement). Champion waited for price to reload at the institutional golden pocket.';
        if (LU.indexOf('SWEEP') >= 0)
            return 'Liquidity sweep. Price raided a known resting-order level and reversed. The champion enters the reversal.';
        if (LU.indexOf('OB') >= 0 || LU.indexOf('ORDERBLOCK') >= 0)
            return 'Order-block reclaim. Price re-entered the candle where institutions originally loaded, triggering the champion\'s ' + dir + ' setup.';
        if (LU.indexOf('SQUEEZE') >= 0 || LU.indexOf('IGNITION') >= 0)
            return 'Squeeze/ignition fire. Compression released in the direction the champion expected - entered on the first bar of expansion.';
        if (LU.indexOf('HARMONIC') >= 0 || LU.indexOf('GARTLEY') >= 0 || LU.indexOf('BAT') >= 0)
            return 'Harmonic pattern completion. Champion identified a geometric reversal zone and entered on the D-point.';
        // Generic fallback
        return 'Champion\'s ' + dir + ' trigger "' + L + '" fired. Expand the indicator stack and DNA snapshot below to inspect the exact conditions.';
    }

    function render() {
        const filtered = allSignals.filter(signalMatchesFilter);
        if (filtered.length === 0) {
            feedEl.innerHTML =
                '<div style="padding:40px 20px;text-align:center;color:var(--text-dim);background:var(--card);border:1px dashed var(--border);border-radius:12px;">' +
                'No signals match that filter. Champion fires when its entry conditions align with live market state - could be seconds away, could be hours.' +
                '</div>';
        } else {
            feedEl.innerHTML = filtered.map(renderRow).join('');
        }
    }

    async function load() {
        try {
            const r = await apiFetch('/api/champion_signals?limit=100');
            if (r.status === 403) {
                feedEl.innerHTML =
                    '<div style="padding:60px 30px;text-align:center;background:var(--card);border:1px dashed var(--border);border-radius:14px;">' +
                    '<div style="font-family:\'JetBrains Mono\',monospace;color:#ffd700;letter-spacing:3px;font-size:0.72rem;text-transform:uppercase;margin-bottom:16px;">🔒 Signal Tier Required</div>' +
                    '<h3 style="color:var(--text);font-size:1.4rem;font-weight:800;margin-bottom:14px;">Trade alongside MAVERICK</h3>' +
                    '<p style="color:var(--text-dim);max-width:500px;margin:0 auto 24px;line-height:1.7;">Real-time champion signals, full DNA snapshots, and live outcome tracking are reserved for Signal tier. Connect your Base wallet and hold 10,000 $MAV, or subscribe $99/mo.</p>' +
                    '<a href="/pages/access.html" style="display:inline-block;padding:14px 28px;background:var(--accent);color:#000;font-family:\'JetBrains Mono\',monospace;font-weight:700;letter-spacing:2px;font-size:0.75rem;text-transform:uppercase;text-decoration:none;border-radius:10px;">Unlock access &rarr;</a>' +
                    '</div>';
                return;
            }
            const d = await r.json();
            renderHeader(d.champion || {});
            allSignals = d.signals || [];
            renderStats(allSignals);
            render();
        } catch (e) {
            feedEl.innerHTML = '<div style="padding:30px;color:var(--text-dim);text-align:center;">Signal feed connecting…</div>';
        }
    }

    // Filter chip clicks
    filterEls.forEach(el => {
        el.addEventListener('click', () => {
            currentFilter = el.dataset.sigfilter;
            filterEls.forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            render();
        });
    });

    // Only the header row OPENS a card. Clicks inside the expanded body do NOT
    // close the card (fixes the "clunky double-click / auto-close" issue).
    // The explicit ✕ Close button closes. Re-clicking the header also closes.
    feedEl.addEventListener('click', (e) => {
        // Chart button fires TradingView overlay. Stop propagation so it
        // doesn't bubble to the header toggle below.
        const chartBtn = e.target.closest('.champ-sig-chart-btn');
        if (chartBtn) {
            e.preventDefault();
            e.stopPropagation();
            const sym = chartBtn.getAttribute('data-chart-sym');
            if (sym) openChartOverlay(sym);
            return;
        }
        // Explicit close button wins next
        const closeBtn = e.target.closest('.champ-sig-close');
        if (closeBtn) {
            const cid = parseInt(closeBtn.getAttribute('data-close-id'), 10);
            expandedIds.delete(cid);
            render();
            return;
        }
        // Toggle only when tapping the header strip
        const head = e.target.closest('.champ-sig-head');
        if (!head) return;
        const id = parseInt(head.getAttribute('data-toggle-id'), 10);
        if (expandedIds.has(id)) expandedIds.delete(id);
        else expandedIds.add(id);
        render();
    });

    load();
    setInterval(load, 15000);
})();
