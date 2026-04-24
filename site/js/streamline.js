(function() {
    'use strict';

    // Page guard: only run on the Streamline dashboard
    if (!document.getElementById('symbols-grid')) return;

    // ── State ────────────────────────────────────────────────
    var symbolDataCache = [];
    var activeTab = 'symbols';

    // ── Helpers ──────────────────────────────────────────────

    function el(id) {
        return document.getElementById(id);
    }

    function cleanSymbol(s) {
        if (!s) return '';
        s = s.replace(/USDTM$/i, '').replace(/USDT$/i, '');
        if (s === 'XBT') return 'BTC';
        return s;
    }

    function tvSymbol(s) {
        if (!s) return 'BTCUSDT';
        var base = s.replace(/M$/, '');
        base = base.replace(/^XBT/, 'BTC');
        if (!/USDT$/i.test(base)) base = base.replace(/USD$/, 'USDT');
        return base;
    }

    function fmtPrice(v) {
        var n = parseFloat(v);
        if (isNaN(n)) return '--';
        if (n >= 1000) return n.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
        if (n >= 100) return n.toFixed(2);
        if (n >= 1) return n.toFixed(4);
        if (n >= 0.01) return n.toFixed(6);
        return n.toFixed(8);
    }

    function fmtPct(v) {
        var n = parseFloat(v);
        if (isNaN(n)) return '--';
        return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
    }

    function fmtPnl(v) {
        var n = parseFloat(v);
        if (isNaN(n)) return '--';
        return (n >= 0 ? '+' : '') + n.toFixed(2);
    }

    function safeFetch(url) {
        return fetch(url, { headers: FC_API_HEADERS || {} })
            .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .catch(function() { return null; });
    }

    function confluenceDots(n, max) {
        var filled = parseInt(n) || 0;
        var total = parseInt(max) || 8;
        if (filled > total) filled = total;
        var html = '';
        for (var i = 0; i < total; i++) {
            if (i < filled) {
                html += '<span class="conf-dot filled"></span>';
            } else {
                html += '<span class="conf-dot empty"></span>';
            }
        }
        return html;
    }

    function eqFmt(v) {
        if (isNaN(v) || v === null || v === undefined) return '--';
        return v.toFixed(1) + '%';
    }

    function eqClass(v) {
        if (isNaN(v) || v === null || v === undefined) return '';
        if (v <= 1.0) return ' eq-hot';    // very close to equilibrium
        if (v <= 3.0) return ' eq-warm';   // near equilibrium
        return ' eq-far';                   // far from equilibrium
    }

    function dirClass(dir) {
        if (!dir) return '';
        var d = dir.toLowerCase();
        if (d === 'long' || d === 'bull' || d === 'bullish' || d === 'up') return 'long';
        if (d === 'short' || d === 'bear' || d === 'bearish' || d === 'down') return 'short';
        return '';
    }

    function modeClass(mode) {
        if (!mode) return 'neutral';
        var m = mode.toLowerCase();
        if (m === 'bull' || m === 'bullish') return 'bull';
        if (m === 'bear' || m === 'bearish') return 'bear';
        if (m === 'breakout') return 'breakout';
        return 'neutral';
    }

    // ── Tab Switching ────────────────────────────────────────

    // Sort state per section — each section has its own pill-group
    var sortMode = { symbols: 'desc', movers: 'desc', volume: 'desc' };
    // Pill definitions per section. Each pill: { mode, label }
    var sortPills = {
        symbols: [
            { mode: 'desc',  label: 'ADX ▼' },
            { mode: 'asc',   label: 'ADX ▲' },
            { mode: 'alpha', label: 'A→Z' }
        ],
        movers: [
            { mode: 'desc',    label: 'Biggest Gain ▲' },
            { mode: 'asc',     label: 'Biggest Loss ▼' },
            { mode: 'winners', label: 'Winners only' },
            { mode: 'losers',  label: 'Losers only' },
            { mode: 'alpha',   label: 'A→Z' }
        ],
        volume: [
            { mode: 'desc',  label: 'High Vol ▼' },
            { mode: 'asc',   label: 'Low Vol ▲' },
            { mode: 'alpha', label: 'A→Z' }
        ]
    };

    var tabContainer = document.querySelector('.sl-tabs');
    if (tabContainer) {
        tabContainer.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-tab]');
            if (!btn) return;

            var tab = btn.getAttribute('data-tab');
            if (tab === activeTab) return;
            activeTab = tab;

            // Update active button
            var allBtns = tabContainer.querySelectorAll('[data-tab]');
            for (var i = 0; i < allBtns.length; i++) {
                allBtns[i].classList.remove('active');
            }
            btn.classList.add('active');

            // Show matching section, hide others
            var sections = ['symbols', 'squeeze', 'movers', 'volume'];
            for (var j = 0; j < sections.length; j++) {
                var sec = el('section-' + sections[j]);
                if (sec) {
                    if (sections[j] === tab) {
                        sec.classList.add('active');
                        sec.style.display = 'block';
                    } else {
                        sec.classList.remove('active');
                        sec.style.display = 'none';
                    }
                }
            }
            // Re-render the activated tab so it never shows blank
            if (tab === 'movers') renderMovers();
            else if (tab === 'volume') renderVolume();
            else if (tab === 'symbols') renderSymbolsFromCache();
        });
    }

    // Build a pill-group filter row and append it under the section header.
    function injectSortControl(sectionId, key) {
        var sec = el('section-' + sectionId);
        if (!sec) return;
        var hdr = sec.querySelector('.sl-section-header');
        if (!hdr || sec.querySelector('.sl-sort-pills')) return;
        var pills = sortPills[key] || [];
        var group = document.createElement('div');
        group.className = 'sl-sort-pills';
        group.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 4px;padding:0;width:100%;';
        pills.forEach(function(p) {
            var btn = document.createElement('button');
            btn.className = 'sl-sort-pill' + (sortMode[key] === p.mode ? ' active' : '');
            btn.setAttribute('data-mode', p.mode);
            btn.style.cssText = 'padding:5px 12px;font-size:0.62rem;font-weight:700;border:1px solid var(--bb-border, var(--border));background:transparent;color:var(--bb-text-dim, var(--text-dim));border-radius:14px;cursor:pointer;font-family:inherit;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;transition:all 0.15s;';
            if (sortMode[key] === p.mode) {
                btn.style.borderColor = 'var(--bb-green)';
                btn.style.color = 'var(--bb-green)';
                btn.style.background = 'rgba(0,230,118,0.08)';
            }
            btn.textContent = p.label;
            btn.addEventListener('click', function() {
                sortMode[key] = p.mode;
                var sibs = group.querySelectorAll('.sl-sort-pill');
                for (var i = 0; i < sibs.length; i++) {
                    var isActive = sibs[i].getAttribute('data-mode') === p.mode;
                    sibs[i].classList.toggle('active', isActive);
                    sibs[i].style.borderColor = isActive ? 'var(--bb-green)' : 'var(--bb-border, var(--border))';
                    sibs[i].style.color = isActive ? 'var(--bb-green)' : 'var(--bb-text-dim, var(--text-dim))';
                    sibs[i].style.background = isActive ? 'rgba(0,230,118,0.08)' : 'transparent';
                }
                if (key === 'movers') renderMovers();
                else if (key === 'volume') renderVolume();
                else if (key === 'symbols') renderSymbolsFromCache();
            });
            group.appendChild(btn);
        });
        // Insert on its own row after the header, not jammed next to the title
        if (hdr.nextSibling) {
            sec.insertBefore(group, hdr.nextSibling);
        } else {
            sec.appendChild(group);
        }
    }
    setTimeout(function() {
        injectSortControl('symbols', 'symbols');
        injectSortControl('movers', 'movers');
        injectSortControl('volume', 'volume');
    }, 100);

    // Re-render symbols grid from cached data using the current sort mode.
    function renderSymbolsFromCache() {
        if (!symbolDataCache || !symbolDataCache.length) return;
        renderSymbolsGrid(symbolDataCache);
    }

    // ── Symbol Detail Overlay ────────────────────────────────

    var overlay = el('symbol-detail-overlay');

    function openSymbolOverlay(symbol) {
        if (!overlay) return;

        // Find symbol data from cache
        var data = null;
        for (var i = 0; i < symbolDataCache.length; i++) {
            if (symbolDataCache[i].symbol === symbol) {
                data = symbolDataCache[i];
                break;
            }
        }
        if (!data) return;

        var tv = tvSymbol(symbol);
        var clean = cleanSymbol(symbol);
        var tvTheme = (document.documentElement.getAttribute('data-theme') === 'light') ? 'light' : 'dark';
        var iframeSrc = 'https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=KUCOIN:' +
            tv + '.P&interval=15&theme=' + tvTheme + '&style=1&locale=en&hide_top_toolbar=0&hide_legend=0&allow_symbol_change=0';

        var html = '';

        // Close button
        html += '<button class="overlay-close" id="overlay-close-btn">&times;</button>';

        // TradingView iframe (background)
        html += '<iframe class="overlay-chart" src="' + iframeSrc + '" frameborder="0" allowtransparency="true" scrolling="no" allowfullscreen></iframe>';

        // Data panel (right side)
        html += '<div class="overlay-panel">';
        html += '<div class="overlay-panel-inner">';

        // Header
        html += '<div class="op-header">';
        html += '<div class="op-symbol">' + clean + '</div>';
        html += '<div class="op-price">' + fmtPrice(data.close) + '</div>';
        var mc = modeClass(data.mode);
        html += '<div class="op-mode op-mode-' + mc + '">' + (data.mode || 'N/A').toUpperCase();
        if (data.mode_reason) html += ' <span class="op-mode-reason">' + data.mode_reason + '</span>';
        html += '</div>';
        html += '</div>';

        // Confluence breakdown
        html += '<div class="op-section">';
        html += '<div class="op-section-title">CONFLUENCE ' + (data.confluence || 0) + '/8</div>';
        html += '<div class="op-dots">' + confluenceDots(data.confluence, 8) + '</div>';
        if (data.confluence_breakdown && data.confluence_breakdown.length > 0) {
            html += '<div class="op-badges">';
            for (var c = 0; c < data.confluence_breakdown.length; c++) {
                var cb = data.confluence_breakdown[c];
                var pass = cb.passes ? 'pass' : 'fail';
                html += '<div class="op-badge ' + pass + '">';
                html += '<span class="op-badge-name">' + (cb.name || '') + '</span>';
                if (cb.value !== undefined && cb.value !== null) {
                    html += '<span class="op-badge-val">' + cb.value + '</span>';
                }
                if (cb.target !== undefined && cb.target !== null) {
                    html += '<span class="op-badge-target">/ ' + cb.target + '</span>';
                }
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div>';

        // ADX & DI
        html += '<div class="op-section">';
        html += '<div class="op-section-title">TREND STRENGTH</div>';
        html += '<div class="op-grid">';
        html += opRow('ADX 15m', data.adx_15m);
        html += opRow('ADX 4h', data.adx_4h);
        html += opRow('ADX 8h', data.adx_8h);
        html += opRow('DI+ 15m', data.plus_di);
        html += opRow('DI- 15m', data.minus_di);
        html += opRow('DI+ 4h', data.plus_di_4h);
        html += opRow('DI- 4h', data.minus_di_4h);
        html += opRow('DI Spread', data.di_spread);
        html += opRow('DI Confirms', data.di_confirms);
        html += '</div>';
        html += '</div>';

        // Sweep Info
        if (data.sweep_type || data.sweep_level) {
            html += '<div class="op-section">';
            html += '<div class="op-section-title">SWEEP INTEL</div>';
            html += '<div class="op-grid">';
            html += opRow('Type', data.sweep_type);
            html += opRow('Level', data.sweep_level);
            html += opRow('Direction', data.sweep_direction);
            html += opRow('Strength', data.sweep_strength);
            html += '</div>';
            html += '</div>';
        }

        // Structure Levels
        html += '<div class="op-section">';
        html += '<div class="op-section-title">STRUCTURE LEVELS</div>';
        html += '<div class="op-grid">';
        html += opRowDist('PDH', data.pdh, data.dist_pdh);
        html += opRowDist('PDL', data.pdl, data.dist_pdl);
        html += opRowDist('PWH', data.pwh, data.dist_pwh);
        html += opRowDist('PWL', data.pwl, data.dist_pwl);
        html += opRowDist('PMH', data.pmh, data.dist_pmh);
        html += opRowDist('PML', data.pml, data.dist_pml);
        html += opRow('Daily 50', data.daily_50);
        html += opRow('Weekly 50', data.weekly_50);
        html += opRow('Monthly 50', data.monthly_50);
        html += '</div>';
        html += '</div>';

        // Swing Levels
        html += '<div class="op-section">';
        html += '<div class="op-section-title">EQUILIBRIUM</div>';
        html += '<div class="op-grid">';
        html += opRowEq('10h EQ', data.swing_10h_50);
        html += opRowEq('24h EQ', data.swing_24h_50);
        html += opRowEq('7d EQ', data.swing_7d_50);
        html += opRowEq('30d EQ', data.swing_30d_50);
        html += '</div>';
        html += '</div>';

        // Swing Levels
        html += '<div class="op-section">';
        html += '<div class="op-section-title">SWING LEVELS</div>';
        html += '<div class="op-grid">';
        html += opRow('10h Support', data.swing_10h_s);
        html += opRow('10h Resist', data.swing_10h_r);
        html += opRow('24h Support', data.swing_24h_s);
        html += opRow('24h Resist', data.swing_24h_r);
        html += opRow('7d Support', data.swing_7d_s);
        html += opRow('7d Resist', data.swing_7d_r);
        html += '</div>';
        html += '</div>';

        // Oscillators
        html += '<div class="op-section">';
        html += '<div class="op-section-title">OSCILLATORS</div>';
        html += '<div class="op-grid">';
        html += opRow('RSI', data.rsi);
        html += opRow('Stoch K', data.stoch_k);
        html += opRow('Chop', data.chop);
        html += opRow('ATR %', data.atr_pct);
        html += opRow('P20', data.p20);
        html += '</div>';
        html += '</div>';

        // Zone Info
        html += '<div class="op-section">';
        html += '<div class="op-section-title">ZONES</div>';
        html += '<div class="op-grid">';
        html += opRow('In Support', data.in_support_zone ? 'YES' : 'NO');
        html += opRow('In Resistance', data.in_resistance_zone ? 'YES' : 'NO');
        html += opRow('Tier', data.tier);
        html += opRow('Stars', data.stars);
        if (data.blocked_by) html += opRow('Blocked By', data.blocked_by);
        html += '</div>';
        html += '</div>';

        html += '</div>'; // .overlay-panel-inner
        html += '</div>'; // .overlay-panel

        overlay.innerHTML = html;
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function opRowEq(label, value) {
        var v = parseFloat(value);
        if (isNaN(v)) return '<div class="op-row"><span class="op-lbl">' + label + '</span><span class="op-val">--</span></div>';
        var cls = v <= 1.0 ? 'eq-hot' : v <= 3.0 ? 'eq-warm' : 'eq-far';
        return '<div class="op-row"><span class="op-lbl">' + label + '</span><span class="op-val ' + cls + '">' + v.toFixed(1) + '%</span></div>';
    }

    function opRow(label, value) {
        var v = value;
        if (v === undefined || v === null || v === '') v = '--';
        else if (typeof v === 'number') v = v % 1 !== 0 ? parseFloat(v).toFixed(2) : v;
        return '<div class="op-row"><span class="op-lbl">' + label + '</span><span class="op-val">' + v + '</span></div>';
    }

    function opRowDist(label, price, dist) {
        var p = price !== undefined && price !== null ? fmtPrice(price) : '--';
        var d = dist !== undefined && dist !== null ? ' (' + fmtPct(dist) + ')' : '';
        return '<div class="op-row"><span class="op-lbl">' + label + '</span><span class="op-val">' + p + '<span class="op-dist">' + d + '</span></span></div>';
    }

    function closeOverlay() {
        if (!overlay) return;
        overlay.classList.remove('open');
        overlay.innerHTML = '';
        document.body.style.overflow = '';
    }

    // Overlay close handlers
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            // Close if clicking the close button or the overlay background (not the panel)
            if (e.target.id === 'overlay-close-btn' || e.target === overlay) {
                closeOverlay();
            }
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeOverlay();
    });

    // ── Symbol Grid Click Handler (event delegation) ─────────

    // Wire click-to-open-detail on every symbol container:
    // Symbols grid (cards), Market Movers list, Volume Leaders list,
    // Squeeze list, and the Fishing/Explosions lists.
    ['symbols-grid', 'movers-display', 'volume-display',
     'squeeze-list', 'fishing-list', 'explosions-list'].forEach(function(containerId) {
        var container = el(containerId);
        if (!container) return;
        container.style.cursor = '';
        container.addEventListener('click', function(e) {
            var row = e.target.closest('[data-symbol]');
            if (!row) return;
            var symbol = row.getAttribute('data-symbol');
            if (symbol) openSymbolOverlay(symbol);
        });
    });

    // ── Renderers ────────────────────────────────────────────

    function renderSymbolsGrid(data) {
        var grid = el('symbols-grid');
        if (!grid) return;
        if (!data || !Array.isArray(data) || data.length === 0) {
            grid.innerHTML = '<div class="sl-empty">Connecting...</div>';
            return;
        }

        // Cache for overlay use
        symbolDataCache = data;

        // Sort: alphabetical, or by ADX 4h desc/asc
        var sorted = data.slice().sort(function(a, b) {
            if (sortMode.symbols === 'alpha') {
                return cleanSymbol(a.symbol).localeCompare(cleanSymbol(b.symbol));
            }
            var av = parseFloat(a.adx_4h) || 0;
            var bv = parseFloat(b.adx_4h) || 0;
            return sortMode.symbols === 'asc' ? av - bv : bv - av;
        });

        var html = '';
        for (var i = 0; i < sorted.length; i++) {
            var s = sorted[i];
            var clean = cleanSymbol(s.symbol);
            var mc = modeClass(s.mode);
            var conf = parseInt(s.confluence) || 0;
            var adx = parseFloat(s.adx_4h) || 0;
            var price = fmtPrice(s.close);

            // Equilibrium distances
            var eq10h = parseFloat(s.swing_10h_50);
            var eq24h = parseFloat(s.swing_24h_50);
            var eq7d = parseFloat(s.swing_7d_50);

            html += '<div class="sym-card sym-' + mc + '" data-symbol="' + (s.symbol || '') + '">';
            html += '<div class="sym-card-name">' + clean + '</div>';
            html += '<div class="sym-card-price">' + price + '</div>';
            html += '<div class="sym-card-meta">';
            html += '<span class="sym-card-adx">ADX ' + adx.toFixed(0) + '</span>';
            html += '<span class="sym-card-conf">' + confluenceDots(conf, 8) + '</span>';
            html += '</div>';
            html += '<div class="sym-card-eq">';
            html += '<span class="eq-label">EQ</span>';
            html += '<span class="eq-val' + eqClass(eq10h) + '">10h ' + eqFmt(eq10h) + '</span>';
            html += '<span class="eq-val' + eqClass(eq24h) + '">24h ' + eqFmt(eq24h) + '</span>';
            html += '<span class="eq-val' + eqClass(eq7d) + '">7d ' + eqFmt(eq7d) + '</span>';
            html += '</div>';
            if (s.mode) {
                html += '<div class="sym-card-mode sym-mode-' + mc + '">' + s.mode.toUpperCase() + '</div>';
            }
            html += '</div>';
        }
        grid.innerHTML = html;

        // Update tab count
        var countEl = el('tab-count-symbols');
        if (countEl) countEl.textContent = sorted.length;
    }

    function renderSignals(data) {
        var container = el('signals-table');
        if (!container) return;
        if (!data || !data.signals || data.signals.length === 0) {
            container.innerHTML = '<div class="sl-empty">No active signals. The system is watching.</div>';
            var countEl = el('tab-count-signals');
            if (countEl) countEl.textContent = '0';
            return;
        }

        var signals = data.signals;
        var html = '';

        for (var i = 0; i < signals.length; i++) {
            var sig = signals[i];
            var mode = sig.mode || '';
            var dc = mode.indexOf('bull') >= 0 ? 'bull' : mode.indexOf('bear') >= 0 ? 'bear' : 'neutral';
            var dir = mode.toUpperCase() || 'N/A';
            var conf = parseInt(sig.confluence) || 0;

            html += '<div class="sig-row" data-sig-index="' + i + '">';
            html += '<div class="sig-row-main">';
            html += '<span class="sig-sym sig-' + dc + '">' + cleanSymbol(sig.symbol) + '</span>';
            html += '<span class="sig-dir-pill sig-pill-' + dc + '">' + dir + '</span>';
            html += '<span class="sig-price">' + fmtPrice(sig.close) + '</span>';
            html += '<span class="sig-type">' + (sig.tier || sig.stars || '--') + '</span>';
            html += '<span class="sig-conf-dots">' + confluenceDots(conf, 8) + '</span>';
            if (sig.adx_15m) html += '<span class="sig-meta-item">ADX ' + parseFloat(sig.adx_15m).toFixed(0) + '</span>';
            if (sig.atr_pct) html += '<span class="sig-meta-item">ATR ' + parseFloat(sig.atr_pct).toFixed(2) + '%</span>';
            if (sig.chop) html += '<span class="sig-meta-item">CHOP ' + parseFloat(sig.chop).toFixed(0) + '</span>';
            html += '</div>';

            // Detail panel (hidden by default, toggled on click)
            if (sig.confluence_breakdown && sig.confluence_breakdown.length > 0) {
                html += '<div class="sig-detail" id="sig-detail-' + i + '">';
                html += '<div class="sig-badges">';
                for (var j = 0; j < sig.confluence_breakdown.length; j++) {
                    var b = sig.confluence_breakdown[j];
                    var pass = b.passes ? 'pass' : 'fail';
                    html += '<span class="conf-badge ' + pass + '">' + (b.name || '') + '</span>';
                }
                html += '</div>';
                html += '</div>';
            }

            html += '</div>';
        }
        container.innerHTML = html;

        var countEl = el('tab-count-signals');
        if (countEl) countEl.textContent = signals.length;
    }

    // Signal row click handler (event delegation)
    var signalsTable = el('signals-table');
    if (signalsTable) {
        signalsTable.addEventListener('click', function(e) {
            var row = e.target.closest('.sig-row');
            if (!row) return;
            var idx = row.getAttribute('data-sig-index');
            var detail = el('sig-detail-' + idx);
            if (detail) {
                detail.classList.toggle('open');
            }
        });
    }

    function renderSqueeze(data) {
        var container = el('squeeze-display');
        if (!container) return;
        if (!data || !data.squeeze_states) {
            container.innerHTML = '<div class="sl-empty">Connecting...</div>';
            return;
        }

        var states = data.squeeze_states;
        var firedSyms = {};
        if (data.recent_fires) {
            for (var f = 0; f < data.recent_fires.length; f++) {
                var sym = data.recent_fires[f].symbol || data.recent_fires[f];
                firedSyms[sym] = true;
            }
        }

        // Sort: squeeze_on first (by duration desc), then fired, then idle
        var sorted = states.slice().sort(function(a, b) {
            var aInSq = a.squeeze_on ? 2 : (a.squeeze_fire ? 1.5 : (firedSyms[a.symbol] ? 1 : 0));
            var bInSq = b.squeeze_on ? 2 : (b.squeeze_fire ? 1.5 : (firedSyms[b.symbol] ? 1 : 0));
            if (aInSq !== bInSq) return bInSq - aInSq;
            return (parseInt(b.duration) || 0) - (parseInt(a.duration) || 0);
        });

        // Show squeezing, fired, or top 20
        var filtered = sorted.filter(function(s) {
            return s.squeeze_on || s.squeeze_fire || firedSyms[s.symbol];
        });
        if (filtered.length === 0) filtered = sorted.slice(0, 20);

        var maxBars = 1;
        for (var m = 0; m < filtered.length; m++) {
            var bars = parseInt(filtered[m].duration) || 0;
            if (bars > maxBars) maxBars = bars;
        }

        var html = '';
        for (var i = 0; i < filtered.length; i++) {
            var s = filtered[i];
            var inSq = s.squeeze_on;
            var fired = s.squeeze_fire || firedSyms[s.symbol];
            var cls = inSq ? 'in-squeeze' : (fired ? 'fired' : 'no-squeeze');
            var barsVal = parseInt(s.duration) || 0;
            var ratio = parseFloat(s.compression) || 0;
            var barWidth = Math.min(100, Math.max(5, (barsVal / maxBars * 100)));
            var mom = parseFloat(s.momentum) || 0;
            var momColor = mom > 0 ? 'var(--green)' : mom < 0 ? 'var(--neg)' : 'var(--text-dim)';
            var barColor = inSq ? 'linear-gradient(90deg, #ffab00, #ff6d00)' : fired ? 'linear-gradient(90deg, #00e676, #00c853)' : 'rgba(255,255,255,0.15)';

            html += '<div class="squeeze-card ' + cls + '">';
            html += '<div class="sq-sym">' + cleanSymbol(s.symbol) + '</div>';
            html += '<div class="squeeze-bar"><div class="squeeze-bar-fill" style="width:' + barWidth + '%;background:' + barColor + '"></div></div>';
            html += '<div class="sq-info">';
            html += '<span class="sq-bars">' + barsVal + ' bars</span>';
            if (ratio) html += '<span class="sq-ratio">CR ' + ratio.toFixed(2) + '</span>';
            html += '</div>';
            if (mom !== 0) {
                html += '<div class="sq-slope" style="color:' + momColor + '">' + (mom > 0 ? '+' : '') + mom.toFixed(3) + '</div>';
            }
            html += '<div class="sq-status">' + (inSq ? 'SQUEEZING' : fired ? 'FIRED' : 'IDLE') + '</div>';
            html += '</div>';
        }
        container.innerHTML = html;

        var countEl = el('tab-count-squeeze');
        if (countEl) {
            var activeCount = filtered.filter(function(s) { return s.squeeze_on; }).length;
            countEl.textContent = activeCount;
        }
    }

    function renderExplosions(data) {
        var container = el('explosions-display');
        if (!container) return;
        if (!data || !data.explosions || data.explosions.length === 0) {
            container.innerHTML = '<div class="sl-empty">No recent explosions detected.</div>';
            var countEl = el('tab-count-explosions');
            if (countEl) countEl.textContent = '0';
            return;
        }

        var explosions = data.explosions;
        var html = '';

        for (var i = 0; i < explosions.length; i++) {
            var ex = explosions[i];
            var pct = parseFloat(ex.pct_change) || 0;
            var dc = dirClass(ex.direction);
            var isUp = dc === 'long' || (dc !== 'short' && pct >= 0);
            var cls = isUp ? 'up' : 'down';
            var arrow = isUp ? '\u2191' : '\u2193';

            html += '<div class="explosion-card ' + cls + '">';
            html += '<span class="ex-dir">' + arrow + '</span>';
            html += '<span class="ex-sym">' + cleanSymbol(ex.symbol) + '</span>';
            html += '<span class="ex-pct">' + fmtPct(pct) + '</span>';
            if (ex.tier) html += '<span class="ex-tier">' + ex.tier + '</span>';
            if (ex.kc_break_pct) html += '<span class="ex-kc">KC ' + fmtPct(ex.kc_break_pct) + '</span>';
            if (ex.time_ago) html += '<span class="ex-time">' + ex.time_ago + '</span>';
            html += '</div>';
        }
        container.innerHTML = html;

        var countEl = el('tab-count-explosions');
        if (countEl) countEl.textContent = explosions.length;
    }

    function renderFishing(data) {
        var container = el('fishing-display');
        if (!container) return;
        if (!data || !data.lines || data.lines.length === 0) {
            container.innerHTML = '<div class="sl-empty">No active fishing lines.</div>';
            var countEl = el('tab-count-fishing');
            if (countEl) countEl.textContent = '0';
            return;
        }

        var lines = data.lines;
        var html = '';

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var dc = dirClass(line.direction);
            var dir = (line.direction || '').toUpperCase();

            html += '<div class="fish-card fish-' + dc + '">';
            html += '<div class="fish-header">';
            html += '<span class="fish-sym">' + cleanSymbol(line.symbol) + '</span>';
            html += '<span class="fish-dir fish-pill-' + dc + '">' + dir + '</span>';
            if (line.status) html += '<span class="fish-status">' + line.status + '</span>';
            html += '</div>';
            html += '<div class="fish-prices">';
            html += '<div class="fish-price-item"><span class="fish-lbl">Entry</span><span class="fish-val">' + fmtPrice(line.price || line.entry_price) + '</span></div>';
            html += '<div class="fish-price-item"><span class="fish-lbl">Stop</span><span class="fish-val fish-stop">' + fmtPrice(line.stop_price) + '</span></div>';
            html += '<div class="fish-price-item"><span class="fish-lbl">Target</span><span class="fish-val fish-target">' + fmtPrice(line.target_price) + '</span></div>';
            html += '</div>';
            if (line.dangle_time || line.start_time) {
                html += '<div class="fish-time">';
                if (line.dangle_time) html += '<span>Dangling: ' + line.dangle_time + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }
        container.innerHTML = html;

        var countEl = el('tab-count-fishing');
        if (countEl) countEl.textContent = lines.length;
    }

    function renderStats(data) {
        if (!data) return;

        // Summary cards
        var summaryEl = el('stats-summary');
        if (summaryEl) {
            var html = '';
            html += statCard(data.total_trades, 'Total Trades', 'blue');
            html += statCard((parseFloat(data.win_rate) || 0).toFixed(1) + '%', 'Win Rate', parseFloat(data.win_rate) >= 50 ? '' : 'red');
            html += statCard(fmtPct(data.avg_win), 'Avg Win', '');
            html += statCard(fmtPct(data.avg_loss), 'Avg Loss', 'red');
            html += statCard(fmtPct(data.best_trade), 'Best Trade', '');
            summaryEl.innerHTML = html;
        }

        // By symbol
        var symGrid = el('stats-symbols');
        if (symGrid && data.by_symbol) {
            var syms = Object.keys(data.by_symbol);
            syms.sort(function(a, b) {
                return (data.by_symbol[b].total || 0) - (data.by_symbol[a].total || 0);
            });

            var html2 = '';
            for (var i = 0; i < syms.length; i++) {
                var sym = syms[i];
                var d = data.by_symbol[sym];
                var wins = d.wins || 0;
                var losses = d.losses || 0;
                var total = d.total || (wins + losses) || 1;
                var winPct = (wins / total * 100).toFixed(0);
                var lossPct = 100 - parseInt(winPct);
                var pnl = parseFloat(d.pnl) || 0;

                html2 += '<div class="sym-perf-card">';
                html2 += '<div class="sp-sym">' + cleanSymbol(sym) + '</div>';
                html2 += '<div class="sp-bar"><div class="sp-bar-win" style="width:' + winPct + '%"></div><div class="sp-bar-loss" style="width:' + lossPct + '%"></div></div>';
                html2 += '<div class="sp-row">';
                html2 += '<span class="lbl">' + wins + 'W / ' + losses + 'L</span>';
                html2 += '<span class="val ' + (pnl >= 0 ? 'green' : 'red') + '">' + fmtPnl(pnl) + '</span>';
                html2 += '</div>';
                html2 += '</div>';
            }
            symGrid.innerHTML = html2;
        }

        // By exit reason
        var exitGrid = el('stats-exits');
        if (exitGrid && data.by_exit_reason) {
            var reasons = Object.keys(data.by_exit_reason);
            var maxCount = 1;
            for (var r = 0; r < reasons.length; r++) {
                var cnt = data.by_exit_reason[reasons[r]].count || 0;
                if (cnt > maxCount) maxCount = cnt;
            }

            reasons.sort(function(a, b) {
                return (data.by_exit_reason[b].count || 0) - (data.by_exit_reason[a].count || 0);
            });

            var html3 = '';
            for (var e = 0; e < reasons.length; e++) {
                var reason = reasons[e];
                var rd = data.by_exit_reason[reason];
                var barW = ((rd.count || 0) / maxCount * 100).toFixed(0);
                var avgPnl = parseFloat(rd.avg_pnl_pct) || 0;
                var totalPnl = parseFloat(rd.pnl) || 0;

                html3 += '<div class="exit-row">';
                html3 += '<div class="exit-header">';
                html3 += '<span class="exit-reason">' + reason + '</span>';
                html3 += '<span class="exit-count">' + (rd.count || 0) + ' trades</span>';
                html3 += '</div>';
                html3 += '<div class="exit-bar-wrap"><div class="exit-bar-fill" style="width:' + barW + '%"></div></div>';
                html3 += '<div class="exit-meta">';
                html3 += '<span>Avg: ' + fmtPct(avgPnl) + '</span>';
                html3 += '<span>Total: ' + fmtPnl(totalPnl) + '</span>';
                html3 += '</div>';
                html3 += '</div>';
            }
            exitGrid.innerHTML = html3;
        }
    }

    function statCard(value, label, colorClass) {
        return '<div class="sl-summary-card">' +
            '<div class="sl-summary-val' + (colorClass ? ' ' + colorClass : '') + '">' + (value !== undefined && value !== null ? value : '--') + '</div>' +
            '<div class="sl-summary-lbl">' + label + '</div>' +
            '</div>';
    }

    function renderHealthStrip(data) {
        var strip = el('health-strip');
        if (!strip) return;
        if (!data) {
            strip.innerHTML = '<span class="hs-item hs-connecting">Connecting...</span>';
            return;
        }

        var db = data.db_integrity || {};
        var sq = data.squeeze_status || {};

        var fresh = parseInt(db.features_fresh) || 0;
        var total = parseInt(db.total_symbols) || 88;
        var freshCls = fresh >= 80 ? 'hs-ok' : fresh >= 50 ? 'hs-warn' : 'hs-err';
        var ohlcvFresh = db.ohlcv_fresh;
        var disconnects = parseInt(db.disconnects) || 0;
        var activeSq = parseInt(sq.active_squeezes) || 0;
        var sqFires = parseInt(sq.squeeze_fires) || 0;

        var html = '';
        html += '<span class="hs-item ' + freshCls + '">Features: ' + fresh + '/' + total + '</span>';
        if (ohlcvFresh !== undefined) {
            html += '<span class="hs-item ' + (ohlcvFresh ? 'hs-ok' : 'hs-err') + '">OHLCV: ' + (ohlcvFresh ? 'Fresh' : 'Stale') + '</span>';
        }
        html += '<span class="hs-item ' + (disconnects === 0 ? 'hs-ok' : 'hs-err') + '">DC: ' + disconnects + '</span>';
        html += '<span class="hs-item hs-info">SQ: ' + activeSq + '</span>';
        html += '<span class="hs-item hs-info">Fires: ' + sqFires + '</span>';
        html += '<span class="hs-item hs-status">' + (data.status || 'OK') + '</span>';

        strip.innerHTML = html;

        // Update header stats from health data
        var dbSizeEl = el('header-db-size');
        if (dbSizeEl) dbSizeEl.textContent = total;

        var dataAgeEl = el('header-data-age');
        if (dataAgeEl) {
            var now = new Date();
            dataAgeEl.textContent = now.getHours().toString().padStart(2, '0') + ':' +
                now.getMinutes().toString().padStart(2, '0') + ':' +
                now.getSeconds().toString().padStart(2, '0');
        }
    }

    function renderKingTrend(data) {
        // King trend can update a banner element if present
        var box = el('king-trend-display');
        if (!box || !data) return;
        var trend = (data.trend || '').toUpperCase();
        var color = data.color || 'var(--text)';

        box.innerHTML =
            '<span class="king-label">TREND</span>' +
            '<span class="king-direction" style="color:' + color + '">' + trend + '</span>';
    }

    // ── Header Signal Count ──────────────────────────────────

    function updateHeaderSignalCount(data) {
        var countEl = el('header-sig-count');
        if (!countEl || !data || !data.signals) return;
        countEl.textContent = data.signals.length;
    }

    // ── Fetch Groups ─────────────────────────────────────────

    function fetchFast() {
        safeFetch('/api/all_symbols').then(function(data) {
            if (data && data.symbols) renderSymbolsGrid(data.symbols);
            else renderSymbolsGrid(data);
            renderMovers();
            renderVolume();
            if (data) {
                var dbEl = el('header-db-size');
                if (dbEl) dbEl.textContent = '1.3GB';
                var ageEl = el('header-data-age');
                if (ageEl) {
                    var now = new Date();
                    ageEl.textContent = now.getHours().toString().padStart(2,'0') + ':' +
                        now.getMinutes().toString().padStart(2,'0') + ':' +
                        now.getSeconds().toString().padStart(2,'0');
                }
            }
        });
        safeFetch('/api/signals').then(updateHeaderSignalCount);
        safeFetch('/api/live_monitor').then(renderHealthStrip);
    }

    function fetchMedium() {
        safeFetch('/api/squeeze').then(renderSqueeze);
        safeFetch('/api/king_trend').then(renderKingTrend);
    }

    // ── Init ─────────────────────────────────────────────────

    // Render movers and volume tabs from cached symbol data
    function renderMovers() {
        var container = el('movers-display');
        if (!container) return;
        if (!symbolDataCache || !symbolDataCache.length) {
            container.innerHTML = '<div style="padding:20px;color:var(--text-dim);text-align:center;">Waiting for symbol data...</div>';
            return;
        }

        var mode = sortMode.movers;
        var pool = symbolDataCache.slice();
        if (mode === 'winners') {
            pool = pool.filter(function(s) { return (parseFloat(s.pct_change) || 0) > 0; });
        } else if (mode === 'losers') {
            pool = pool.filter(function(s) { return (parseFloat(s.pct_change) || 0) < 0; });
        }
        var sorted = pool.sort(function(a, b) {
            if (mode === 'alpha') {
                return cleanSymbol(a.symbol).localeCompare(cleanSymbol(b.symbol));
            }
            var av = parseFloat(a.pct_change) || 0;
            var bv = parseFloat(b.pct_change) || 0;
            // Gainers-first (desc/winners) → high → low; Losers-first (asc/losers) → low → high
            return (mode === 'asc' || mode === 'losers') ? av - bv : bv - av;
        });

        var html = '';
        for (var i = 0; i < Math.min(sorted.length, 40); i++) {
            var s = sorted[i];
            var pct = parseFloat(s.pct_change) || 0;
            var cls = pct >= 0 ? 'recently-fired' : 'active-squeeze';
            var arrow = pct >= 0 ? '&#9650;' : '&#9660;';
            var adx = parseFloat(s.adx_4h) || 0;
            html += '<div class="squeeze-item ' + cls + '" data-symbol="' + (s.symbol || '') + '">';
            html += '<span class="squeeze-symbol">' + cleanSymbol(s.symbol) + '</span>';
            html += '<span style="font-family:JetBrains Mono,monospace;font-size:0.75rem;font-weight:700;color:' + (pct >= 0 ? 'var(--green)' : 'var(--neg)') + ';">' + arrow + ' ' + pct.toFixed(2) + '%</span>';
            html += '<span style="font-size:0.6rem;color:var(--text-dim);margin-left:8px;">ADX ' + adx.toFixed(0) + '</span>';
            html += '<span style="font-size:0.6rem;color:var(--text-dim);margin-left:8px;">' + fmtPrice(s.close) + '</span>';
            html += '</div>';
        }
        container.innerHTML = html || '<div style="padding:20px;color:var(--text-dim);text-align:center;">No data</div>';
    }

    function renderVolume() {
        var container = el('volume-display');
        if (!container) return;
        if (!symbolDataCache || !symbolDataCache.length) {
            container.innerHTML = '<div style="padding:20px;color:var(--text-dim);text-align:center;">Waiting for symbol data...</div>';
            return;
        }

        var sorted = symbolDataCache.slice().sort(function(a, b) {
            if (sortMode.volume === 'alpha') {
                return cleanSymbol(a.symbol).localeCompare(cleanSymbol(b.symbol));
            }
            var av = parseFloat(a.volume_ratio) || 0;
            var bv = parseFloat(b.volume_ratio) || 0;
            return sortMode.volume === 'asc' ? av - bv : bv - av;
        });

        var html = '';
        for (var i = 0; i < Math.min(sorted.length, 40); i++) {
            var s = sorted[i];
            var vr = parseFloat(s.volume_ratio) || 0;
            var pct = parseFloat(s.pct_change) || 0;
            var cls = vr > 2.0 ? 'recently-fired' : (vr > 1.0 ? 'active-squeeze' : '');
            html += '<div class="squeeze-item ' + cls + '" data-symbol="' + (s.symbol || '') + '">';
            html += '<span class="squeeze-symbol">' + cleanSymbol(s.symbol) + '</span>';
            html += '<span style="font-family:JetBrains Mono,monospace;font-size:0.75rem;font-weight:700;color:' + (vr > 1.5 ? 'var(--green)' : 'var(--text-dim)') + ';">' + vr.toFixed(2) + 'x</span>';
            html += '<span style="font-size:0.6rem;color:' + (pct >= 0 ? 'var(--green)' : 'var(--neg)') + ';margin-left:8px;">' + (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%</span>';
            html += '<span style="font-size:0.6rem;color:var(--text-dim);margin-left:8px;">' + fmtPrice(s.close) + '</span>';
            html += '</div>';
        }
        container.innerHTML = html || '<div style="padding:20px;color:var(--text-dim);text-align:center;">No data</div>';
    }

    // Set initial tab visibility
    var sections = ['symbols', 'squeeze', 'movers', 'volume'];
    for (var i = 0; i < sections.length; i++) {
        var sec = el('section-' + sections[i]);
        if (sec) {
            if (sections[i] === 'symbols') {
                sec.classList.add('active');
                sec.style.display = 'block';
            } else {
                sec.classList.remove('active');
                sec.style.display = 'none';
            }
        }
    }

    // Initial data load
    fetchFast();
    fetchMedium();

    // Render movers/volume after first data load (slight delay for data to arrive)
    setTimeout(function() { renderMovers(); renderVolume(); }, 3000);

    // Auto-refresh timers
    setInterval(fetchFast, 15000);     // 15s: symbols, health
    setInterval(fetchMedium, 30000);   // 30s: squeeze, king_trend

})();
