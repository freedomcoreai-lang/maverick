/* signals-page.js — Champion Signals cockpit driver.
 *
 * Drives five live surfaces:
 *   1. Hunt hero        — /api/hunt/state         (60s)
 *   2. Trinity monitors — /api/live/arms          (5s)
 *   3. Hunt feed        — /api/live/hunt_feed     (10s)
 *   4. Pressure radar   — /api/hunt/pressure      (60s)
 *   5. Archive          — /api/champion_signals   (30s)
 *
 * No fake data. Every empty / stale state renders an em-dash. The page must
 * stay alive even when the cascade has not fired in days.
 *
 * Architecture rules (per council):
 *   - Pollster factory shares one ETag map + one rate limiter
 *   - Visibility-aware: paused tabs never poll
 *   - DOM updates use class swaps, never innerHTML on monitor frames
 *   - Mobile-first; only essentials render under 720px
 */
(function () {
    'use strict';

    /* ────────────────────────────────────────────────────────────────────
       0 · Boot guard + auth headers (preserves owner-bypass behaviour)
       ──────────────────────────────────────────────────────────────────── */
    const FC_API_KEY = (typeof FC_API_HEADERS === 'object' && FC_API_HEADERS['X-API-Key'])
        || 'fcweb_60fd94aa2d910f38a9f3e0557076791a';

    const apiFetch = (u, o) => {
        o = Object.assign({ credentials: 'same-origin' }, o || {});
        o.headers = (typeof window.fcMergeHeaders === 'function')
            ? window.fcMergeHeaders(o.headers)
            : Object.assign({ 'X-API-Key': FC_API_KEY }, o.headers || {});
        return fetch(u, o);
    };

    const $ = (id) => document.getElementById(id);
    const feedEl = $('champ-signal-feed');
    if (!feedEl) return; /* not on signals page */

    /* ────────────────────────────────────────────────────────────────────
       1 · Helpers
       ──────────────────────────────────────────────────────────────────── */
    function esc(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function fmtNum(v, dp) {
        if (v === undefined || v === null || v === 999 || Number.isNaN(v)) return '—';
        const n = Number(v);
        if (!isFinite(n)) return '—';
        return n.toFixed(dp === undefined ? 2 : dp);
    }
    function fmtInt(v) {
        if (v === undefined || v === null || Number.isNaN(v)) return '—';
        const n = Number(v);
        if (!isFinite(n)) return '—';
        return n.toLocaleString('en-US');
    }
    function fmtPrice(v) {
        if (v === undefined || v === null || !v) return '—';
        const n = Number(v);
        if (n >= 1000) return n.toFixed(2);
        if (n >= 1)    return n.toFixed(4);
        return n.toFixed(6);
    }
    function ago(ts) {
        if (!ts) return '—';
        const diff = Math.floor(Date.now() / 1000) - Number(ts);
        if (diff < 60)    return diff + 's ago';
        if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    }
    function setText(el, v) {
        if (!el) return;
        const t = (v === null || v === undefined || v === '') ? '—' : String(v);
        if (el.textContent !== t) el.textContent = t;
    }

    /* ────────────────────────────────────────────────────────────────────
       2 · Pollster factory
       Each pollster owns a URL, an interval, an onData handler, plus a
       shared visibility gate. Pages can spin up many; they share rate
       limits via the browser's HTTP cache + ETag short-circuit on the
       server.
       ──────────────────────────────────────────────────────────────────── */
    function makePollster(url, interval, onData, opts) {
        opts = opts || {};
        let timer = null;
        let lastEtag = null;
        let backoff = 0;
        let stopped = false;

        async function tick() {
            if (document.hidden) return;
            try {
                const headers = lastEtag ? { 'If-None-Match': lastEtag } : {};
                const r = await apiFetch(url, { headers });
                if (r.status === 304) { backoff = 0; return; }
                if (r.status === 403) {
                    if (opts.onForbidden) opts.onForbidden();
                    return;
                }
                if (!r.ok) throw new Error('http ' + r.status);
                const e = r.headers.get('ETag');
                if (e) lastEtag = e;
                const data = await r.json();
                onData(data);
                backoff = 0;
            } catch (e) {
                backoff = Math.min((backoff || 1) * 2, 60_000);
            }
        }
        function loop() {
            if (stopped) return;
            tick().finally(() => {
                const next = backoff || (interval + Math.random() * 750);
                timer = setTimeout(loop, next);
            });
        }
        loop();
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !stopped) {
                clearTimeout(timer);
                loop();
            }
        });
        return {
            stop() { stopped = true; if (timer) clearTimeout(timer); },
            kick() { clearTimeout(timer); loop(); }
        };
    }

    /* ────────────────────────────────────────────────────────────────────
       3 · Hunt hero (/api/hunt/state) + strike alert
       ──────────────────────────────────────────────────────────────────── */
    const STRIKE_HEADLINES = [
        'The cascade has fired.',
        'Strike confirmed. The hunt landed.',
        'Capital is moving.',
        'A medalist just struck.',
        'The pattern broke. The cascade caught it.',
    ];

    function pickStrikeHeadline(strike) {
        // Deterministic pick keyed on the strike id so it stays stable per fire.
        const seed = (strike && (strike.ts_unix || 0)) % STRIKE_HEADLINES.length;
        return STRIKE_HEADLINES[seed];
    }

    function renderStrikeAlert(strike, secondsAgo) {
        const banner = $('strike-alert');
        if (!banner) return;
        const FRESH_WINDOW = 4 * 60 * 60;  // 4 hours
        if (!strike || secondsAgo === null || secondsAgo === undefined || secondsAgo > FRESH_WINDOW) {
            banner.hidden = true;
            return;
        }
        banner.hidden = false;
        setText($('strike-headline'), pickStrikeHeadline(strike));

        const dir   = (strike.direction === 'long' ? 'BULL' : 'BEAR');
        const sym   = strike.symbol || '—';
        const tag   = (strike.strategy_name || 'CASCADE').toUpperCase();
        const px    = (strike.entry_price ? '@ ' + fmtPrice(strike.entry_price) : '');
        const when  = secondsAgo < 60      ? 'just now'
                    : secondsAgo < 3600    ? Math.floor(secondsAgo / 60) + 'm ago'
                    :                        Math.floor(secondsAgo / 3600) + 'h ago';
        setText($('strike-meta'),
            `${dir} · ${sym} ${px} · ${tag} · ${when}`);
    }

    function renderHunt(state) {
        if (!state) return;
        const last = state.last_strike_seconds_ago;
        let hours = '—';
        if (last !== null && last !== undefined) {
            hours = Math.floor(last / 3600);
        }
        setText($('hunt-hours'), hours);
        setText($('hunt-bars'), fmtInt(state.bars_evaluated));

        setText($('pulse-symbols'), state.symbols_in_universe || '—');
        setText($('pulse-champs'),  state.champions_active   || '—');

        if (state.last_scan_seconds_ago !== null && state.last_scan_seconds_ago !== undefined) {
            const s = state.last_scan_seconds_ago;
            let t;
            if (s < 60)        t = s + 's';
            else if (s < 3600) t = Math.floor(s / 60) + 'm';
            else if (s < 86400)t = Math.floor(s / 3600) + 'h';
            else               t = Math.floor(s / 86400) + 'd';
            setText($('pulse-scan'), t);
        }
        if (state.last_scan_iso) {
            setText($('pulse-scan-iso'), state.last_scan_iso.replace('T', ' ').slice(0, 16) + ' UTC');
        }
        if (last !== null && last !== undefined) {
            setText($('pulse-discipline'), Math.floor(last / 86400));
        }

        renderStrikeAlert(state.last_strike, last);
        setRecentStrike(state.last_strike, last);
    }

    /* ────────────────────────────────────────────────────────────────────
       4 · Trinity monitors (/api/live/arms)
       ──────────────────────────────────────────────────────────────────── */
    /* Tracks which medalist (if any) recently fired so its monitor can wear
       the cinematic STRIKE state. Updated every time renderHunt runs. */
    const STRATEGY_TAG = {
        'FVG_CE_DISPLACEMENT_THRUST':  'SILVER',
        'POC_DISPLACEMENT_LAMINAR':    'GOLD',
        'SOVEREIGN_POC_REVERSION_MU':  'PLATINUM',
    };
    let recentStrike = null;
    const RECENT_STRIKE_WINDOW = 30 * 60;  // 30 minutes wears STRIKE state

    function setRecentStrike(strike, secondsAgo) {
        if (strike && secondsAgo !== null && secondsAgo !== undefined && secondsAgo <= RECENT_STRIKE_WINDOW) {
            recentStrike = {
                tag: STRATEGY_TAG[strike.strategy_name] || null,
                ago: secondsAgo,
            };
        } else {
            recentStrike = null;
        }
    }

    function stateFromCounts(passed, total, armed, triggered, tag) {
        if (recentStrike && recentStrike.tag === tag) return 'STRIKE';
        if (triggered) return 'TRIGGERED';
        if (armed)     return 'ARMED';
        if (total > 0 && passed / total >= 0.5) return 'FORMING';
        return 'DORMANT';
    }

    function renderMonitor(monitorEl, m) {
        if (!monitorEl || !m) return;
        const setField = (sel, val) => {
            const f = monitorEl.querySelector('[data-field="' + sel + '"]');
            if (!f) return;
            setText(f, val);
            return f;
        };
        setField('name', m.strategy);
        if (m.thesis) setField('thesis', m.thesis);
        const stateName = stateFromCounts(
            m.gates_passed_max || 0,
            m.gates_total || 0,
            !!m.armed_count,
            !!m.triggered_count,
            m.tag
        );
        const stateEl = monitorEl.querySelector('[data-field="state"]');
        if (stateEl) {
            stateEl.setAttribute('data-state', stateName);
            stateEl.textContent = stateName;
        }
        /* LEDs */
        const ledRow = monitorEl.querySelector('[data-field="leds"]');
        if (ledRow && m.gate_summary) {
            const html = m.gate_summary.map(g =>
                '<span class="led ' + (g.pass ? 'led--pass' : 'led--fail') + '" title="' + esc(g.detail || '') + '">' +
                esc(g.label) +
                '</span>'
            ).join('');
            if (ledRow.dataset.cache !== html) {
                ledRow.innerHTML = html;
                ledRow.dataset.cache = html;
            }
        }
        /* Threat board */
        const tb = monitorEl.querySelector('[data-field="threats"]');
        if (tb) {
            const rows = (m.threats || []).slice(0, 5);
            if (!rows.length) {
                tb.innerHTML = '<div class="board-empty">No symbols within striking distance.</div>';
            } else {
                tb.innerHTML = rows.map(t => {
                    const pct = Math.round((t.passed / Math.max(1, t.total)) * 100);
                    const st  = (t.state || (pct >= 100 ? 'ARMED' : pct >= 60 ? 'FORMING' : 'DORMANT'));
                    return '<div class="board-row" data-state="' + esc(st) + '" style="--fill:' + pct + '%">' +
                        '<span class="board-sym">' + esc(t.symbol) + '</span>' +
                        '<span class="board-bar"><span class="board-bar-fill"></span></span>' +
                        '<span class="board-pct">' + t.passed + '/' + t.total + '</span>' +
                        '</div>';
                }).join('');
            }
        }
    }

    function renderArms(payload) {
        if (!payload || !payload.medalists) return;
        const map = {};
        payload.medalists.forEach(m => { map[m.tag] = m; });
        document.querySelectorAll('.monitor').forEach(el => {
            const tag = el.getAttribute('data-tag');
            if (map[tag]) renderMonitor(el, map[tag]);
        });
    }

    /* ────────────────────────────────────────────────────────────────────
       5 · Hunt feed (/api/live/hunt_feed)
       ──────────────────────────────────────────────────────────────────── */
    const seenLines = { SILVER: new Set(), GOLD: new Set(), PLATINUM: new Set() };

    function appendTerminalLines(tag, lines) {
        const monitor = document.querySelector('.monitor[data-tag="' + tag + '"]');
        if (!monitor) return;
        const term = monitor.querySelector('[data-field="term"]');
        if (!term) return;

        const seen = seenLines[tag] || (seenLines[tag] = new Set());
        const fresh = (lines || []).filter(l => !seen.has(l.id));
        if (!fresh.length && term.children.length > 0) return;

        const out = [];
        fresh.forEach(l => {
            seen.add(l.id);
            const cls = l.kind === 'strike'  ? 'term--strike'  :
                        l.kind === 'armed'   ? 'term--armed'   :
                        l.kind === 'forming' ? 'term--forming' : 'term--reject';
            out.push(
                '<div class="term-line ' + cls + '">' +
                    '<span class="term-tag">[' + esc(l.ts || '') + ']</span> ' +
                    esc(l.text || '') +
                '</div>'
            );
        });
        if (out.length) {
            term.insertAdjacentHTML('afterbegin', out.join(''));
            while (term.children.length > 12) term.removeChild(term.lastChild);
        }
        if (seen.size > 200) {
            const arr = Array.from(seen);
            seenLines[tag] = new Set(arr.slice(arr.length - 100));
        }
    }

    function renderHuntFeed(payload) {
        if (!payload || !payload.feeds) return;
        ['SILVER', 'GOLD', 'PLATINUM'].forEach(tag => {
            if (payload.feeds[tag]) appendTerminalLines(tag, payload.feeds[tag]);
        });
    }

    /* ────────────────────────────────────────────────────────────────────
       6 · Pressure radar (/api/hunt/pressure)
       ──────────────────────────────────────────────────────────────────── */
    function renderPressure(payload) {
        const body = $('pressure-body');
        if (!body) return;
        const rows = (payload && payload.rows) || [];
        if (!rows.length) {
            body.innerHTML = '<div class="board-empty">No symbol passing more than half the cascade gates.</div>';
            return;
        }
        const maxPass = Math.max(1, ...rows.map(r => r.cascade_score || 0));
        body.innerHTML = rows.slice(0, 24).map(r => {
            const pct = Math.round((r.cascade_score / maxPass) * 100);
            return '<div class="pressure-row" style="--fill:' + pct + '%">' +
                '<span class="p-sym">' + esc(r.symbol) + '</span>' +
                '<span class="p-bar"><span class="p-fill"></span></span>' +
                '<span class="p-pct">' + r.cascade_score + '</span>' +
                '</div>';
        }).join('');
    }

    /* ────────────────────────────────────────────────────────────────────
       7 · Archive (/api/champion_signals) — preserve legacy expand-row UX
       ──────────────────────────────────────────────────────────────────── */
    let allSignals = [];
    let currentFilter = 'all';
    const expandedIds = new Set();

    function dirStyle(dir) {
        return dir === 'long'
            ? { cls: 'cs-dir-long',  label: 'BULL' }
            : { cls: 'cs-dir-short', label: 'BEAR' };
    }
    function statusStyle(st) {
        if (st === 'filled') return { color: 'var(--accent-cyan)', label: 'FILLED · LIVE' };
        if (st === 'closed') return { color: 'var(--text-muted)',  label: 'CLOSED' };
        return { color: 'var(--accent-gold)', label: 'FIRED' };
    }

    function renderStats(signals) {
        const n = signals.length;
        const longs  = signals.filter(s => s.direction === 'long').length;
        const shorts = signals.filter(s => s.direction === 'short').length;
        const open   = signals.filter(s => s.status === 'filled' || s.status === 'signal').length;
        const closed = signals.filter(s => s.status === 'closed');
        const wins   = closed.filter(s => (s.pnl_usd || 0) > 0).length;
        const wr     = closed.length ? (wins / closed.length * 100).toFixed(1) + '%' : '—';
        const totPnl = closed.reduce((a, s) => a + (s.pnl_usd || 0), 0);
        const pnlTxt = closed.length
            ? (totPnl >= 0 ? '+$' : '-$') + Math.abs(totPnl).toFixed(2)
            : '—';

        setText($('sig-total'), n || '—');
        setText($('sig-long'),  longs || '—');
        setText($('sig-short'), shorts || '—');
        setText($('sig-live'),  open || '—');
        setText($('sig-wr'),    wr);
        const tp = $('sig-totpnl');
        if (tp) {
            tp.textContent = pnlTxt;
            tp.classList.remove('stat-green', 'stat-red');
            if (closed.length) tp.classList.add(totPnl >= 0 ? 'stat-green' : 'stat-red');
        }
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
            '<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 8px;background:rgba(245,245,250,0.03);border-radius:5px;font-family:\'JetBrains Mono\',monospace;font-size:0.68rem;">' +
                '<span style="color:var(--text-muted);">' + esc(k) + '</span>' +
                '<span style="color:var(--accent-cyan);font-weight:700;">' + esc(dna[k]) + '</span>' +
            '</div>'
        ).join('');
        return (
            '<div style="margin-top:16px;">' +
                '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.62rem;letter-spacing:2px;color:var(--accent-cyan);text-transform:uppercase;margin-bottom:8px;">DNA snapshot at signal time · ' + Object.keys(dna).length + ' knobs</div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px;">' + rows + '</div>' +
            '</div>'
        );
    }

    function indicatorsBlock(bar, s) {
        const picks = [
            ['ADX',     bar.adx_14, 1, 'Trend strength · <20 rng · >25 trnd'],
            ['Chop',    bar.chop_14, 1, 'Range index · <40 trnd · >60 chop'],
            ['RSI',     bar.rsi_14, 1, '<30 oversold · >70 overbought'],
            ['ATR',     s.atr || bar.atr_14, 5, 'Volatility unit'],
            ['Close',   bar.close, 0, 'Price at signal'],
            ['Volume',  bar.volume, 0, 'Bar volume'],
            ['+DI',     bar.plus_di, 1, 'Bull pressure'],
            ['-DI',     bar.minus_di, 1, 'Bear pressure'],
            ['Stoch K', bar.stoch_k, 1, '<20 OS · >80 OB'],
            ['ADX 4h',  bar.adx_4h, 1, 'Multi-TF context'],
        ];
        const rows = picks.filter(p => p[1] !== undefined && p[1] !== null && p[1] !== '').map(p =>
            '<div style="padding:8px 10px;background:rgba(245,245,250,0.03);border:1px solid var(--border);border-radius:6px;">' +
                '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.58rem;color:var(--text-muted);letter-spacing:1.5px;text-transform:uppercase;">' + esc(p[0]) + '</div>' +
                '<div style="font-size:0.9rem;color:var(--text-primary);font-weight:700;margin-top:2px;">' + (p[2] === 0 ? fmtPrice(p[1]) : fmtNum(p[1], p[2])) + '</div>' +
                '<div style="font-size:0.6rem;color:var(--text-muted);margin-top:2px;">' + esc(p[3]) + '</div>' +
            '</div>'
        ).join('');
        return (
            '<div style="margin-top:16px;">' +
                '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.62rem;letter-spacing:2px;color:var(--accent-cyan);text-transform:uppercase;margin-bottom:8px;">Indicator stack at signal time</div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;">' + rows + '</div>' +
            '</div>'
        );
    }

    function outcomeBlock(s) {
        if (s.status !== 'closed') return '';
        const win = (s.pnl_usd || 0) >= 0;
        const colorVar = win ? '#4ecdc4' : '#ef4444';
        return (
            '<div style="margin-top:16px;padding:12px 14px;background:rgba(245,245,250,0.03);border-left:3px solid ' + colorVar + ';border-radius:6px;">' +
                '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.62rem;letter-spacing:2px;color:' + colorVar + ';text-transform:uppercase;margin-bottom:6px;">Outcome</div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;font-size:0.8rem;">' +
                    '<div><span style="color:var(--text-muted);">Exit Price</span><br><b style="color:var(--text-primary);">' + fmtPrice(s.exit_price) + '</b></div>' +
                    '<div><span style="color:var(--text-muted);">Exit Reason</span><br><b style="color:var(--text-primary);">' + esc(s.exit_reason || '—') + '</b></div>' +
                    '<div><span style="color:var(--text-muted);">PnL USD</span><br><b style="color:' + colorVar + ';">$' + fmtNum(s.pnl_usd, 2) + '</b></div>' +
                    '<div><span style="color:var(--text-muted);">PnL %</span><br><b style="color:' + colorVar + ';">' + fmtNum(s.pnl_pct, 2) + '%</b></div>' +
                '</div>' +
            '</div>'
        );
    }

    function explainLabel(label, direction) {
        const dir = direction === 'long' ? 'long' : 'short';
        if (!label) return 'Champion emitted a ' + dir + ' entry signal.';
        const LU = String(label).toUpperCase();
        if (LU.indexOf('POC_REVERSION') >= 0)
            return 'Mean-reversion fade away from the daily Point-of-Control. Champion saw price stretch more than 1.95 ATR from the high-volume node in an anti-persistent regime — fading back toward the equilibrium.';
        if (LU.indexOf('POC_DISPLACEMENT') >= 0 || LU.indexOf('LAMINAR') >= 0)
            return 'POC breakout with displacement and bull volume delta. Price cleared the daily POC by a clean ATR margin, with a displacement candle and persistent +VDA.';
        if (LU.indexOf('FVG_CE') >= 0 || LU.indexOf('FVG') >= 0)
            return 'Institutional defense of a Fair Value Gap midpoint. Price returned to the consequential equilibrium of an unfilled FVG and held with displacement against weekly VWAP context.';
        if (LU.indexOf('VAL_FLOW') >= 0)
            return 'Value-area-low flow acceleration. Price piercing the lower volume profile band with delta confirming continuation.';
        if (LU.indexOf('SQUEEZE') >= 0 || LU.indexOf('IGNITION') >= 0)
            return 'Compression release in the direction the champion expected. Entered on the first bar of expansion.';
        if (LU.indexOf('OB') >= 0 || LU.indexOf('ORDERBLOCK') >= 0)
            return 'Order-block reclaim. Price re-entered the candle where institutions originally loaded, triggering the ' + dir + ' setup.';
        return 'Champion\'s ' + dir + ' trigger "' + label + '" fired. Indicator stack and DNA snapshot below show the exact gate state at fire time.';
    }

    function tvTickerFor(sym) {
        if (!sym) return 'BTCUSDT.P';
        let s = String(sym).toUpperCase().trim();
        if (s === 'XBT') s = 'BTC';
        s = s.replace(/^XBT/, 'BTC');
        s = s.replace(/USDTM$/, 'USDT');
        s = s.replace(/USDT\.P$/, 'USDT');
        if (!/USDT$/.test(s)) s = s + 'USDT';
        return s + '.P';
    }
    function openChartOverlay(sym) {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const tvSym = encodeURIComponent('KUCOIN:' + tvTickerFor(sym));
        const src = 'https://s.tradingview.com/widgetembed/?frameElementId=tv_signal_chart' +
            '&symbol=' + tvSym +
            '&interval=15&hidesidetoolbar=1&symboledit=0&saveimage=0' +
            '&toolbarbg=' + (isLight ? 'ffffff' : '0a0a0f') +
            '&theme=' + (isLight ? 'light' : 'dark') +
            '&style=1&timezone=Etc%2FUTC&withdateranges=1&showvolume=true';
        const wrap = document.createElement('div');
        wrap.id = 'sig-chart-overlay';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:1000;background:#0a0a0f;display:flex;flex-direction:column;align-items:stretch;';
        wrap.innerHTML =
            '<div style="flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#06090f;border-bottom:1px solid rgba(245,245,250,0.08);">' +
                '<span style="font-family:\'JetBrains Mono\',monospace;font-size:0.62rem;letter-spacing:2px;text-transform:uppercase;color:var(--accent-gold);">Champion Chart · ' + esc(sym) + '</span>' +
                '<button id="sig-chart-close" aria-label="Close chart" type="button" style="background:rgba(0,0,0,0.85);border:1px solid #ef4444;border-radius:50%;color:#fff;font-size:1.1rem;line-height:1;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">&times;</button>' +
            '</div>' +
            '<iframe src="' + src + '" style="flex:1;width:100%;border:none;background:#0a0a0f;" allowfullscreen></iframe>';
        document.body.appendChild(wrap);
        document.body.style.overflow = 'hidden';
        function close() {
            const el = $('sig-chart-overlay');
            if (el) el.remove();
            document.body.style.overflow = '';
            document.removeEventListener('keydown', keyHandler);
        }
        function keyHandler(e) { if (e.key === 'Escape') close(); }
        wrap.addEventListener('click', e => {
            if (e.target.id === 'sig-chart-close' || e.target === wrap) close();
        });
        document.addEventListener('keydown', keyHandler);
    }
    window.fcOpenSignalChart = openChartOverlay;

    function renderRow(s) {
        const ds = dirStyle(s.direction);
        const ss = statusStyle(s.status);
        const isOpen = expandedIds.has(s.id);
        let html =
            '<div class="champ-sig' + (isOpen ? ' is-open' : '') + '" data-sig-id="' + s.id + '">' +
                '<div class="champ-sig-head" data-toggle-id="' + s.id + '">' +
                    '<div class="cs-ago">' + ago(s.ts_unix) + '</div>' +
                    '<div class="cs-body">' +
                        '<div class="cs-body-top">' +
                            '<span class="cs-dir ' + ds.cls + '">' + ds.label + '</span>' +
                            '<span class="cs-symbol">' + esc(s.symbol || '') + '</span>' +
                            '<span class="cs-label">' + esc(s.signal_label || '') + '</span>' +
                        '</div>' +
                        '<div class="cs-meta">' +
                            'entry ' + fmtPrice(s.entry_price) +
                            (s.stop_price ? '  ·  stop ' + fmtPrice(s.stop_price) : '') +
                            (s.leverage ? '  ·  ' + s.leverage + 'x' : '') +
                        '</div>' +
                    '</div>' +
                    '<div class="cs-status" style="color:' + ss.color + ';">' + ss.label + '</div>' +
                    '<div class="cs-toggle">' + (isOpen ? '▲ HIDE' : '▼ OPEN') + '</div>' +
                '</div>';

        if (isOpen) {
            const reason = explainLabel(s.signal_label, s.direction);
            const sym = (s.symbol || '').toUpperCase();
            html += '<div class="champ-sig-body" data-close-id="' + s.id + '">' +
                '<div style="margin-top:14px;padding:12px 14px;background:rgba(62,168,245,0.05);border-left:3px solid var(--accent-cyan);border-radius:6px;">' +
                    '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.62rem;letter-spacing:2px;color:var(--accent-cyan);text-transform:uppercase;margin-bottom:6px;">Why this fired</div>' +
                    '<div style="color:var(--text-primary);font-size:0.88rem;line-height:1.65;">' + esc(reason) + '</div>' +
                '</div>' +
                '<div style="margin-top:14px;">' +
                    '<button class="champ-sig-chart-btn" data-chart-sym="' + esc(sym) + '" ' +
                    'style="width:100%; padding:12px 14px; background:rgba(78,205,196,0.08); border:1px solid #4ecdc4; border-radius:8px; cursor:pointer; color:var(--text-primary); font-family:\'JetBrains Mono\',monospace; font-size:0.72rem; letter-spacing:1px; text-transform:uppercase; font-weight:700; text-align:center;">' +
                        'View ' + esc(sym) + ' chart' +
                    '</button>' +
                '</div>' +
                indicatorsBlock(s.bar || {}, s) +
                dnaBlock(s.dna || {}) +
                outcomeBlock(s) +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">' +
                    '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.58rem;color:var(--text-muted);letter-spacing:1px;">fired ' + esc(s.ts_iso || '') + ' · id ' + s.id + '</div>' +
                    '<button class="champ-sig-close" data-close-id="' + s.id + '" style="background:transparent;border:1px solid var(--border);color:var(--text-muted);font-family:\'JetBrains Mono\',monospace;font-size:0.6rem;letter-spacing:1.5px;padding:6px 12px;border-radius:6px;cursor:pointer;text-transform:uppercase;">✕ Close</button>' +
                '</div>' +
            '</div>';
        }
        html += '</div>';
        return html;
    }

    function renderArchive() {
        const filtered = allSignals.filter(signalMatchesFilter);
        if (!filtered.length) {
            feedEl.innerHTML =
                '<div class="board-empty" style="padding:32px 20px;">' +
                'No confirmed strikes match this filter. The cascade only fires when every gate aligns.' +
                '</div>';
            return;
        }
        feedEl.innerHTML = filtered.map(renderRow).join('');
    }

    /* ────────────────────────────────────────────────────────────────────
       8 · Wire archive interactions
       ──────────────────────────────────────────────────────────────────── */
    document.querySelectorAll('[data-sigfilter]').forEach(el => {
        el.addEventListener('click', () => {
            currentFilter = el.dataset.sigfilter;
            document.querySelectorAll('[data-sigfilter]').forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            renderArchive();
        });
    });

    feedEl.addEventListener('click', e => {
        const chartBtn = e.target.closest('.champ-sig-chart-btn');
        if (chartBtn) {
            e.preventDefault(); e.stopPropagation();
            const sym = chartBtn.getAttribute('data-chart-sym');
            if (sym) openChartOverlay(sym);
            return;
        }
        const closeBtn = e.target.closest('.champ-sig-close');
        if (closeBtn) {
            const cid = parseInt(closeBtn.getAttribute('data-close-id'), 10);
            expandedIds.delete(cid);
            renderArchive();
            return;
        }
        const head = e.target.closest('.champ-sig-head');
        if (!head) return;
        const id = parseInt(head.getAttribute('data-toggle-id'), 10);
        if (expandedIds.has(id)) expandedIds.delete(id); else expandedIds.add(id);
        renderArchive();
    });

    /* ────────────────────────────────────────────────────────────────────
       9 · Boot pollsters
       ──────────────────────────────────────────────────────────────────── */
    makePollster('/api/hunt/state',     60_000, renderHunt);
    makePollster('/api/hunt/pressure',  60_000, renderPressure);
    makePollster('/api/live/arms',       5_000, renderArms);
    makePollster('/api/live/hunt_feed', 10_000, renderHuntFeed);

    makePollster('/api/champion_signals?limit=100&since_cascade=true', 30_000, (d) => {
        allSignals = (d && d.signals) || [];
        renderStats(allSignals);
        renderArchive();
    }, {
        onForbidden: () => {
            feedEl.innerHTML =
                '<div class="board-empty" style="padding:60px 30px;">' +
                '<div style="font-family:\'JetBrains Mono\',monospace;color:var(--accent-gold);letter-spacing:3px;font-size:0.72rem;text-transform:uppercase;margin-bottom:16px;">Signal Tier Required</div>' +
                '<h3 style="color:var(--text-primary);font-size:1.4rem;font-weight:800;margin-bottom:14px;">Trade alongside MAVERICK</h3>' +
                '<p style="color:var(--text-muted);max-width:500px;margin:0 auto 24px;line-height:1.7;">Real-time confirmed-strike archive, full DNA snapshots and live outcome tracking are reserved for Signal tier. Connect your Base wallet and hold 10,000 $MAV, or subscribe $99/mo.</p>' +
                '<a href="/pages/access.html" style="display:inline-block;padding:14px 28px;background:var(--accent-cyan);color:#0a0a0f;font-family:\'JetBrains Mono\',monospace;font-weight:700;letter-spacing:2px;font-size:0.75rem;text-transform:uppercase;text-decoration:none;border-radius:10px;">Unlock access &rarr;</a>' +
                '</div>';
        }
    });
})();
