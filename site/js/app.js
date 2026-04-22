/* FreedomCore Modular JS - v2.0 */

// ===== API CONFIG =====
var FC_API_HEADERS = { 'X-API-Key': 'fcweb_60fd94aa2d910f38a9f3e0557076791a' };
function fcFetch(url) {
    return fetch(url, { headers: FC_API_HEADERS });
}

// ===== THEME TOGGLE =====
function toggleTheme() {
    const html = document.documentElement;
    const btn = document.getElementById('theme-btn');
    if (html.getAttribute('data-theme') === 'dark') {
        html.setAttribute('data-theme', 'light');
        btn.innerHTML = '&#9788;';
        localStorage.setItem('fc-theme', 'light');
    } else {
        html.setAttribute('data-theme', 'dark');
        btn.innerHTML = '&#9790;';
        localStorage.setItem('fc-theme', 'dark');
    }
    // Sync TradingView iframes with new theme
    var newTheme = html.getAttribute('data-theme');
    document.querySelectorAll('.tv-chart-wrap iframe').forEach(function(iframe) {
        var src = iframe.src;
        src = src.replace(/theme=(dark|light)/, 'theme=' + newTheme);
        src = src.replace(/toolbarbg=[0-9a-fA-F]+/, 'toolbarbg=' + (newTheme === 'light' ? 'ffffff' : '0b0b0f'));
        iframe.src = src;
    });
}
(function() {
    var saved = localStorage.getItem('fc-theme');
    var theme = 'dark';
    if (saved) {
        theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        theme = 'light';
    }
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        var btn = document.getElementById('theme-btn');
        if (btn) btn.innerHTML = '&#9788;';
    }
})();

// ===== GATING SYSTEM =====
const GATES = {
    positions: false,
    swarm: false,
};
function applyGates() {
    Object.keys(GATES).forEach(key => {
        const el = document.getElementById(key + '-gate');
        if (el) {
            if (GATES[key]) el.classList.add('locked');
            else el.classList.remove('locked');
        }
    });
}
applyGates();

// ===== LIVE STATUS =====
async function fetchStatus() {
    try {
        const res = await fcFetch('/api/health');
        const d = await res.json();
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        const setColor = (id, color) => { const el = document.getElementById(id); if (el) el.style.color = color; };
        set('stat-status', d.overall === 'ok' ? 'ONLINE' : 'DEGRADED');
        setColor('stat-status', d.overall === 'ok' ? 'var(--green)' : 'var(--red)');
        set('stat-positions', d.maverick?.positions || 0);
        set('stat-symbols', d.streamline?.symbols_count || '--');
        set('stat-db', d.database?.size_mb?.toFixed(0) || '--');
        set('stat-uptime', d.maverick?.uptime || '--');
        set('stat-freshness', (d.database?.freshness_mins || '--') + 'm');
    } catch(e) {
        const el = document.getElementById('stat-status');
        if (el) { el.textContent = 'OFFLINE'; el.style.color = 'var(--red)'; }
    }
}
fetchStatus();
setInterval(fetchStatus, 30000);

// ===== LIVE POSITIONS =====
function formatPrice(p) {
    if (!p || p === 0) return '$0';
    if (p >= 1000) return '$' + p.toFixed(2);
    if (p >= 1) return '$' + p.toFixed(4);
    return '$' + p.toFixed(6);
}

function getRegimeLabel(r) {
    if (!r) return '--';
    if (r.includes('TREND') || r.includes('MOMENTUM')) return 'TREND';
    if (r.includes('TRAP') || r.includes('KINETIC')) return 'TRAP';
    if (r.includes('CHOP') || r.includes('CYCLIC')) return 'CHOP';
    if (r.includes('GENESIS')) return 'GENESIS';
    return r.split('_')[0];
}


// Track known position symbols to detect changes
let knownPositionKeys = '';

async function fetchPositions() {
    if (GATES.positions) return;
    const container = document.getElementById('positions-content');
    if (!container) return;
    try {
        const res = await fcFetch('/api/positions');
        const d = await res.json();
        // Always update status bar position count from live data
        const posCountEl = document.getElementById('stat-positions');
        if (posCountEl) posCountEl.textContent = d.positions ? d.positions.length : 0;

        if (!d.positions || d.positions.length === 0) {
            container.innerHTML = '<div class="pos-empty">No open positions</div>';
            knownPositionKeys = '';
            return;
        }
        // Update total PnL header (show as portfolio %)
        const pnlEl = document.getElementById('pos-total-pnl');
        if (pnlEl) {
            const roiPct = d.total_roi_pct || 0;
            pnlEl.textContent = (roiPct >= 0 ? '+' : '') + roiPct.toFixed(2) + '% portfolio';
            pnlEl.className = 'pos-summary-value ' + (roiPct >= 0 ? 'positive' : 'negative');
        }

        // Check if positions changed (new/closed) - only rebuild DOM if so
        const newKeys = d.positions.map(p => (p.sym_short || p.symbol || '')).sort().join(',');
        if (newKeys === knownPositionKeys) {
            // Same positions - just update values in-place (no DOM rebuild)
            updatePositionValues(d);
            return;
        }
        knownPositionKeys = newKeys;

        let html = '';
        d.positions.forEach(p => {
            const pnl = p.pnl_usd || p.unrealized_pnl || 0;
            const pnlPct = p.pnl_pct || p.roi || 0;
            const pnlClass = pnl >= 0 ? 'positive' : 'negative';
            const sideClass = (p.direction || p.side || '').toLowerCase();
            const sym = (p.sym_short || p.symbol || '').replace('USDTM', '');
            const regime = getRegimeLabel(p.regime);
            const entry = p.entry || p.entry_price || 0;
            const current = p.current || p.mark_price || 0;
            const leverage = p.leverage || '5';
            const margin = p.margin || 0;
            const stopLoss = p.stop_loss || 0;
            const beActive = p.be_active || false;
            const trailActive = p.trailing_active || false;
            const momentumActive = p.momentum_active || false;
            const atr = p.atr || 0;
            const maxRaw = p.max_raw_pct || 0;
            const entryTime = p.entry_time ? new Date(p.entry_time * 1000).toLocaleString() : '--';
            const liqPrice = p.liq_price || 0;

            // 3-layer status
            const stopStatus = stopLoss > 0 ? 'PROTECTING' : 'PENDING';
            const beStatus = beActive ? 'SECURED' : 'PENDING';
            const trailStatus = trailActive ? 'ACTIVE' : (momentumActive ? 'ARMING' : 'WAITING');
            const trailColor = trailActive ? 'var(--green)' : (momentumActive ? 'var(--amber)' : 'var(--text-dim)');

            html += `<div class="pos-card ${sideClass}" data-expand data-sym="${sym}">
                <div class="pos-card-header">
                    <div class="pos-symbol">${sideClass === 'long' ? '&#9650;' : '&#9660;'} ${sym}</div>
                    <div class="pos-regime">${regime}</div>
                </div>
                <div class="pos-summary">
                    <div class="pos-summary-item">
                        <div class="pos-summary-label">PNL</div>
                        <div class="pos-summary-value ${pnlClass}" data-field="pnl">${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%</div>
                    </div>
                    <div class="pos-summary-item">
                        <div class="pos-summary-label">ROI</div>
                        <div class="pos-summary-value ${pnlClass}" data-field="roi">${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%</div>
                    </div>
                    <div class="pos-summary-item">
                        <div class="pos-summary-label">ENTRY</div>
                        <div class="pos-summary-value">${formatPrice(entry)}</div>
                    </div>
                    <div class="pos-summary-item">
                        <div class="pos-summary-label">LVG</div>
                        <div class="pos-summary-value">${parseFloat(leverage).toFixed(1)}x</div>
                    </div>
                </div>
                <div class="pos-detail">
                    <div class="pos-layers">
                        <div class="pos-layer">
                            <div class="pos-layer-title stop">HARD STOP</div>
                            <div style="color:var(--text)" data-field="stop">${formatPrice(stopLoss)}</div>
                            <div style="color:var(--text-dim);font-size:0.55rem;margin-top:4px">${stopStatus}</div>
                        </div>
                        <div class="pos-layer">
                            <div class="pos-layer-title be">BREAK-EVEN</div>
                            <div style="color:var(--text)">${beActive ? 'LOCKED' : 'PENDING'}</div>
                            <div style="color:var(--text-dim);font-size:0.55rem;margin-top:4px">${beStatus}</div>
                        </div>
                        <div class="pos-layer">
                            <div class="pos-layer-title trail">TRAIL STOP</div>
                            <div style="color:${trailColor}">${trailStatus}</div>
                            <div style="color:var(--text-dim);font-size:0.55rem;margin-top:4px">${p.trail_dist ? p.trail_dist.toFixed(2) + ' ATR' : '--'}</div>
                        </div>
                    </div>
                    <div class="pos-telemetry">
                        <div class="pos-telem-item">Mark: <span data-field="mark">${formatPrice(current)}</span></div>
                        <div class="pos-telem-item">Margin: <span>${((margin / (p.equity || 1)) * 100).toFixed(1)}%</span></div>
                        <div class="pos-telem-item">Liq: <span>${formatPrice(liqPrice)}</span></div>
                        <div class="pos-telem-item">Peak: <span data-field="peak">+${maxRaw.toFixed(1)}%</span></div>
                        <div class="pos-telem-item">ATR: <span>${atr.toFixed(6)}</span></div>
                        <div class="pos-telem-item">Entry: <span>${entryTime}</span></div>
                    </div>
                    <div class="tv-chart-wrap" data-noexpand>
                        <button class="tv-fullscreen-btn" data-noexpand data-sym="${sym}" title="Fullscreen chart">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
                        </button>
                        <iframe src="https://www.tradingview.com/widgetembed/?frameElementId=tv_${sym}&symbol=KUCOIN:${sym}USDT&interval=15&hidesidetoolbar=1&symboledit=0&saveimage=1&toolbarbg=${document.documentElement.getAttribute('data-theme') === 'light' ? 'ffffff' : '0b0b0f'}&studies=[]&theme=${document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'}&style=1&timezone=Etc%2FUTC&withdateranges=0&showpopupbutton=0&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&showvolume=true"
                            style="width:100%;height:280px;border:none;border-radius:8px;margin-top:12px;"
                            allowtransparency="true" frameborder="0"
                            loading="lazy" id="tv-${sym}" data-noexpand></iframe>
                    </div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch(e) {
        container.innerHTML = '<div class="pos-empty">Connection error</div>';
    }
}

// Live update PnL/mark/peak values without rebuilding DOM (no flicker, preserves TradingView)
function updatePositionValues(d) {
    d.positions.forEach(function(p) {
        var sym = (p.sym_short || p.symbol || '').replace('USDTM', '');
        var card = document.querySelector('.pos-card[data-sym="' + sym + '"]');
        if (!card) return;

        var pnl = p.pnl_usd || p.unrealized_pnl || 0;
        var pnlPct = p.pnl_pct || p.roi || 0;
        var current = p.current || p.mark_price || 0;
        var maxRaw = p.max_raw_pct || 0;
        var pnlClass = pnl >= 0 ? 'positive' : 'negative';

        var pnlEl = card.querySelector('[data-field="pnl"]');
        if (pnlEl) {
            pnlEl.textContent = (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(2) + '%';
            pnlEl.className = 'pos-summary-value ' + pnlClass;
        }
        var roiEl = card.querySelector('[data-field="roi"]');
        if (roiEl) {
            roiEl.textContent = (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '%';
            roiEl.className = 'pos-summary-value ' + pnlClass;
        }
        var markEl = card.querySelector('[data-field="mark"]');
        if (markEl) markEl.textContent = formatPrice(current);
        var peakEl = card.querySelector('[data-field="peak"]');
        if (peakEl) peakEl.textContent = '+' + maxRaw.toFixed(1) + '%';
        var stopEl = card.querySelector('[data-field="stop"]');
        if (stopEl) stopEl.textContent = formatPrice(p.stop_loss || 0);
    });
}

fetchPositions();
setInterval(fetchPositions, 1000);

// ===== COUNTDOWN UTILITY =====
var homeSchedules = {
    swarm:    { type: 'weekly', day: 0, h: 17, m: 15 },
    sentinel: { type: 'recurring', times: [[5,0],[11,0],[17,0],[23,0]] },
    shadow:   { type: 'recurring', times: [[4,50],[10,50],[16,50],[22,50]] },
    twitter:  { type: 'daily', times: [[7,30]] },
    watchdog: { type: 'recurring', times: [[5,5],[11,5],[17,5],[23,5]] },
    flagship: { type: 'daily', times: [[7,30]] },
    snapshot: { type: 'daily', times: [[18,0]] },
    digest:   { type: 'weekly', day: 0, h: 16, m: 15 }
};
function getNextRunMs(key) {
    var s = homeSchedules[key];
    if (!s) return null;
    var now = Date.now();
    if (s.type === 'weekly') {
        var t = new Date();
        t.setUTCHours(s.h, s.m, 0, 0);
        var daysUntil = (s.day - t.getUTCDay() + 7) % 7;
        if (daysUntil === 0 && t.getTime() <= now) daysUntil = 7;
        t.setUTCDate(t.getUTCDate() + daysUntil);
        return t.getTime() - now;
    }
    var best = Infinity;
    for (var i = 0; i < s.times.length; i++) {
        var c = new Date();
        c.setUTCHours(s.times[i][0], s.times[i][1], 0, 0);
        if (c.getTime() <= now) c.setUTCDate(c.getUTCDate() + 1);
        var diff = c.getTime() - now;
        if (diff < best) best = diff;
    }
    return best;
}
function fmtCountdown(ms) {
    if (!ms) return '';
    var ts = Math.floor(ms / 1000);
    var d = Math.floor(ts / 86400);
    var h = Math.floor((ts % 86400) / 3600);
    var m = Math.floor((ts % 3600) / 60);
    var s = ts % 60;
    if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
    if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
    return m + 'm ' + s + 's';
}
// Homepage swarm tab countdowns
function updateHomeCountdowns() {
    ['swarm','sentinel','shadow','twitter'].forEach(function(key) {
        var tab = document.getElementById('tab-' + key);
        if (!tab) return;
        var cd = tab.querySelector('.home-countdown');
        var ms = getNextRunMs(key);
        if (ms === null) return;
        if (!cd) {
            cd = document.createElement('div');
            cd.className = 'home-countdown';
            cd.style.cssText = 'font-size:0.5rem;opacity:0.9;margin-top:2px;letter-spacing:0.5px;font-weight:400;color:var(--accent);';
            tab.style.display = 'flex';
            tab.style.flexDirection = 'column';
            tab.style.alignItems = 'center';
            tab.appendChild(cd);
        }
        cd.textContent = fmtCountdown(ms);
    });
}
if (document.getElementById('tab-swarm')) {
    updateHomeCountdowns();
    setInterval(updateHomeCountdowns, 1000);
}
// Intelligence chain countdowns
function updateChainCountdowns() {
    document.querySelectorAll('.chain-countdown').forEach(function(el) {
        var key = el.getAttribute('data-schedule');
        var ms = getNextRunMs(key);
        if (ms !== null) {
            el.textContent = '  NEXT: ' + fmtCountdown(ms);
            el.style.cssText = 'font-size:0.55rem;color:var(--accent);opacity:0.9;letter-spacing:0.5px;';
        }
    });
}
if (document.querySelector('.chain-countdown')) {
    updateChainCountdowns();
    setInterval(updateChainCountdowns, 1000);
}

// ===== LIVE SWARM FEED =====
let currentAgent = 'swarm';
const agentColors = { swarm: '#00e676', sentinel: '#ffd600', shadow: '#b388ff', twitter: '#3ea8f5' };
const agentBg = { swarm: 'rgba(0,230,118,0.04)', sentinel: 'rgba(255,214,0,0.04)', shadow: 'rgba(179,136,255,0.04)', twitter: 'rgba(62,168,245,0.04)' };
const agentBorder = { swarm: 'rgba(0,230,118,0.12)', sentinel: 'rgba(255,214,0,0.12)', shadow: 'rgba(179,136,255,0.12)', twitter: 'rgba(62,168,245,0.12)' };

function switchSwarmTab(agent) {
    currentAgent = agent;
    var color = agentColors[agent] || '#00e676';
    document.querySelectorAll('.swarm-tab').forEach(t => t.classList.remove('active'));
    const tab = document.getElementById('tab-' + agent);
    if (tab) tab.classList.add('active');
    const body = document.getElementById('swarm-feed');
    if (body) {
        body.innerHTML = '<div style="color:' + color + ';padding:20px;">Loading ' + agent + ' feed...</div>';
    }
    const title = document.getElementById('swarm-title');
    if (title) {
        title.textContent = agent.toUpperCase() + ' AGENT. LIVE FEED';
        title.style.color = color;
    }
    fetchSwarm();
}

async function fetchSwarm() {
    if (GATES.swarm) return;
    const feed = document.getElementById('swarm-feed');
    if (!feed) return;
    const color = agentColors[currentAgent] || '#00e676';
    const bg = agentBg[currentAgent] || 'rgba(0,230,118,0.04)';
    const border = agentBorder[currentAgent] || 'rgba(0,230,118,0.12)';
    try {
        const res = await fcFetch('/api/swarm_logs?agent=' + currentAgent);
        const d = await res.json();
        var blocks = [];
        if (d.logs && d.logs.length > 50) {
            blocks = d.logs.split('\n\n').filter(function(b){return b.trim().length > 10;}).reverse();
        } else if (d.entries && d.entries.length > 0) {
            blocks = d.entries.reverse().map(function(e){return e.content || e;});
        }
        if (blocks.length > 0) {
            var html = '';
            blocks.forEach(function(block) {
                var tsMatch = block.match(/\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2})/);
                var ts = tsMatch ? tsMatch[1].replace('T',' ') : '';
                html += '<div style="padding:12px 14px;margin-bottom:8px;background:' + bg + ';border:1px solid ' + border + ';border-radius:8px;border-left:3px solid ' + color + ';">';
                if (ts) html += '<div style="font-size:0.55rem;color:' + color + ';letter-spacing:1px;margin-bottom:8px;opacity:0.8;">' + ts + '</div>';
                html += (typeof formatAgentText === 'function') ? formatAgentText(block) : '<div style="font-size:0.65rem;color:var(--text-dim);line-height:1.7;white-space:pre-wrap;">' + block.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
                html += '</div>';
            });
            feed.innerHTML = html;
            var counter = document.getElementById('swarm-line-count');
            if (counter) counter.textContent = currentAgent.toUpperCase() + ' \u00b7 ' + blocks.length + ' entries';
        } else {
            feed.innerHTML = '<div style="color:var(--text-dim);padding:20px;">No ' + currentAgent + ' data available yet.</div>';
        }
    } catch(e) {
        feed.innerHTML = '<div style="color:var(--text-dim);padding:20px;">Feed unavailable. Check connection.</div>';
    }
}
fetchSwarm();
setInterval(fetchSwarm, 60000);

// ===== SCROLL REVEAL =====
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// Smooth scroll - only for internal anchors, not external links
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
        const href = a.getAttribute('href');
        if (href && href.length > 1) {
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });
});

// ===== MOBILE MENU =====
function toggleMobileMenu() {
    document.getElementById('mobile-menu').classList.toggle('open');
}
function closeMobileMenu() {
    document.getElementById('mobile-menu').classList.remove('open');
}

// ===== EVENT LISTENERS (replaces inline onclick) =====
document.addEventListener('DOMContentLoaded', function() {
    // Nav logo expand
    var logoImg = document.getElementById('nav-logo-img');
    if (logoImg) logoImg.addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('logo-expand').classList.toggle('open');
    });

    // Logo expand overlay close
    var logoExpand = document.getElementById('logo-expand');
    if (logoExpand) logoExpand.addEventListener('click', function() {
        this.classList.remove('open');
    });

    // Hamburger menu
    var hamburger = document.querySelector('.nav-hamburger');
    if (hamburger) hamburger.addEventListener('click', toggleMobileMenu);

    // SSL badge popup
    var sslBadge = document.querySelector('.ssl-badge');
    if (sslBadge) sslBadge.addEventListener('click', function() {
        document.getElementById('ssl-popup').classList.toggle('open');
    });

    // SSL popup close on outside click
    document.addEventListener('click', function(e) {
        var popup = document.getElementById('ssl-popup');
        var badge = document.querySelector('.ssl-badge');
        if (popup && popup.classList.contains('open') && !popup.contains(e.target) && badge && !badge.contains(e.target)) {
            popup.classList.remove('open');
        }
    });

    // === IMMERSIVE TERMINAL MANAGER ===
    const overlay = document.getElementById('terminal-overlay');
    const overlayContent = document.getElementById('terminal-overlay-content');
    const overlayTitle = document.getElementById('terminal-overlay-title');
    const closeBtn = document.getElementById('terminal-close');

    function openTerminal(agent) {
        if (!overlay) return;
        const sourceBody = document.getElementById('swarm-page-feed-' + agent);
        if (!sourceBody) return;

        overlayTitle.textContent = 'MAVERICK AGENT TERMINAL // ' + agent.toUpperCase();
        overlayContent.innerHTML = sourceBody.innerHTML;
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Live refresh: every 10s, re-fetch the source from the API, then mirror to overlay.
        // Without this the fullscreen view stays frozen on the snapshot taken at open time.
        overlay._syncInterval = setInterval(async () => {
            if (typeof window.fetchSwarmPageFeed === 'function') {
                try { await window.fetchSwarmPageFeed(agent); } catch(e) {}
            }
            overlayContent.innerHTML = sourceBody.innerHTML;
        }, 10000);
    }

    function closeTerminal() {
        if (!overlay) return;
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        if (overlay._syncInterval) clearInterval(overlay._syncInterval);
    }

    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.fullscreen-trigger');
        if (btn) {
            // Find the parent panel to know which agent we're looking at
            const panel = btn.closest('.agent-panel');
            if (panel) {
                const agent = panel.id.replace('swarm-panel-', '');
                openTerminal(agent);
            }
        }
    });

    if (closeBtn) closeBtn.onclick = closeTerminal;
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeTerminal();
    });

    // Theme button
    var themeBtn = document.getElementById('theme-btn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Mobile dropdown links - close menu on click
    var mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) {
        mobileMenu.querySelectorAll('a').forEach(function(a) {
            a.addEventListener('click', closeMobileMenu);
        });
    }

    // Swarm tabs
    document.querySelectorAll('.swarm-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            var agent = this.id.replace('tab-', '');
            switchSwarmTab(agent);
        });
    });

    // Position card expand (event delegation)
    var posContent = document.getElementById('positions-content');
    if (posContent) posContent.addEventListener('click', function(e) {
        if (e.target.closest('[data-noexpand]')) return;
        var card = e.target.closest('.pos-card');
        if (card) card.classList.toggle('expanded');
    });

    // TradingView fullscreen - opens chart in a full-viewport overlay on body
    function closeTvFullscreen() {
        var overlay = document.getElementById('tv-fs-overlay');
        if (overlay) {
            overlay.remove();
            document.body.style.overflow = '';
        }
    }

    document.addEventListener('click', function(e) {
        var btn = e.target.closest('.tv-fullscreen-btn');
        if (!btn) return;
        e.stopPropagation();
        e.preventDefault();
        var wrap = btn.closest('.tv-chart-wrap');
        if (!wrap) return;
        var iframe = wrap.querySelector('iframe');
        if (!iframe) return;

        // Create fullscreen overlay on body with a fresh iframe
        var overlay = document.createElement('div');
        overlay.id = 'tv-fs-overlay';
        overlay.className = 'tv-fullscreen-overlay';

        var closeBtn = document.createElement('button');
        closeBtn.className = 'tv-fullscreen-close';
        closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        closeBtn.onclick = closeTvFullscreen;

        var fsIframe = document.createElement('iframe');
        fsIframe.src = iframe.src;
        fsIframe.allowFullscreen = true;
        fsIframe.setAttribute('allowtransparency', 'true');
        fsIframe.setAttribute('frameborder', '0');

        overlay.appendChild(closeBtn);
        overlay.appendChild(fsIframe);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
    });

    // Close fullscreen on Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeTvFullscreen();
    });

    // Back to top link
    var backToTop = document.querySelector('.back-to-top');
    if (backToTop) backToTop.addEventListener('click', function(e) {
        e.preventDefault();
        window.scrollTo({top: 0, behavior: 'smooth'});
    });

    // === STREAMLINE PAGE: card expand handled by inline script on streamline.html ===

    // === SIGNALS PAGE: filter buttons ===
    document.querySelectorAll('.filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var filter = this.getAttribute('data-filter');
            document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            if (filter === 'all') { renderSignals(allSignals); return; }
            if (filter === 'long' || filter === 'short') {
                renderSignals(allSignals.filter(function(s) { return (s.direction || '').toLowerCase().includes(filter); }));
            } else {
                renderSignals(allSignals.filter(function(s) { return (s.engine || s.route || '').toLowerCase().includes(filter); }));
            }
        });
    });
});

// ===== LLM PAGE: Swarm Evolution Feed =====
(function() {
    var feed = document.getElementById('llm-swarm-feed');
    if (!feed) return;
    async function fetchSwarmEvolution() {
        try {
            var res = await fcFetch('/api/swarm_logs?agent=swarm');
            var d = await res.json();
            if (d.logs && d.logs.length > 50) {
                var lines = d.logs.split('\n\n').slice(-80).reverse();
                feed.textContent = lines.join('\n\n');
            } else {
                feed.textContent = 'Swarm evolution data loading...';
            }
        } catch(e) {
            feed.textContent = 'Feed unavailable \u2014 check connection';
        }
    }
    fetchSwarmEvolution();
    setInterval(fetchSwarmEvolution, 30000);
})();

// ===== NEWS PAGE: Sentinel Feeds =====
function fetchSentinelFeed(agent, containerId, maxEntries) {
    var feed = document.getElementById(containerId);
    if (!feed) return;
    (async function() {
        try {
            var res = await fcFetch('/api/swarm_logs?agent=' + agent);
            var d = await res.json();
            if (d.logs && d.logs.length > 50) {
                var blocks = d.logs.split('\n\n').filter(function(b) { return b.trim().length > 10; });
                var entries = blocks.slice(-maxEntries).reverse();
                var html = '';
                entries.forEach(function(block) {
                    var tsMatch = block.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
                    var ts = tsMatch ? tsMatch[1] : '';
                    html += '<div class="sentinel-card"><div class="sentinel-header"><div class="sentinel-badge">' + agent.toUpperCase() + '</div><div class="sentinel-time">' + ts + '</div></div><div class="sentinel-body">' + block + '</div></div>';
                });
                feed.innerHTML = html;
            } else {
                feed.innerHTML = '<div class="pos-empty">No ' + agent + ' data available yet.</div>';
            }
        } catch(err) {
            feed.innerHTML = '<div class="pos-empty">Feed connecting...</div>';
        }
    })();
}
// ===== SWARM LOG FORMATTER (world-class terminal rendering) =====
// Groups consecutive lines by timestamp into a single event card.
// Strips the redundant "[ts] 🧬 " prefix from each line (the card header has it once).
// Detects + colors event types: errors (red), score tables (mono+green), gen markers (accent),
// thesis blocks (preserved spaced paragraph format), regular log (dim).
function renderSwarmLog(rawLog, badgeColor) {
    function escapeHtml(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // 1. Parse: split into lines, attach the most-recent timestamp to each, then group.
    var rawLines = rawLog.split('\n');
    var tsRe = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s*🧬?\s*(.*)$/;
    var events = [];          // [{ts, lines: [str, ...]}]
    var currentTs = null;
    var currentLines = [];

    for (var i = 0; i < rawLines.length; i++) {
        var line = rawLines[i];
        var m = line.match(tsRe);
        if (m) {
            // New timestamped line - flush previous event if same-second window broken
            if (currentTs !== null && m[1] !== currentTs) {
                events.push({ts: currentTs, lines: currentLines});
                currentLines = [];
            }
            currentTs = m[1];
            if (m[2]) currentLines.push(m[2]);
        } else if (currentTs !== null) {
            // Continuation line (multi-line thesis, indented data) - append to current event
            currentLines.push(line);
        }
    }
    if (currentTs !== null) events.push({ts: currentTs, lines: currentLines});

    // 2. Reverse so newest events appear first
    events.reverse();

    // 3. Render each event as a single card with smart line typing
    var html = '';
    events.forEach(function(ev) {
        // Strip pure-divider lines (=========) and empty lines
        var bodyLines = ev.lines.filter(function(l) {
            var t = l.trim();
            if (!t) return false;
            if (/^={5,}$/.test(t)) return false;
            return true;
        });
        if (bodyLines.length === 0) return;

        // Detect dominant event type for the card border
        var fullText = bodyLines.join(' ');
        var isError = /failed|error|abort|exception|traceback/i.test(fullText);
        var isScore = /TOTAL:\s*\d+\s*trades|SCORE:|✅ Gen \d+ Score/.test(fullText);
        var isGen   = /^Evolution Gen \d+/.test(bodyLines[0]) || /CHAMPION BAR TO BEAT|NEW CHAMPION CROWNED|🏆/.test(fullText);
        var isThesis = /💡 \[Thesis\]:|STRATEGY_SUMMARY/.test(fullText);

        var border = badgeColor;
        if (isError) border = '#ef4444';
        else if (isGen || isThesis) border = 'var(--amber)';
        else if (isScore) border = 'var(--green)';

        html += '<div class="sentinel-card" style="border-left-color:' + border + ';margin-bottom:12px;">';
        html += '<div class="sentinel-header">';
        html += '<div class="sentinel-badge" style="color:' + border + ';border-color:' + border + ';">SWARM</div>';
        html += '<div class="sentinel-time">' + ev.ts + '</div>';
        html += '</div>';

        // 4. Render body - preserve structure but format intelligently
        html += '<div class="sentinel-body" style="padding:0;">';
        for (var j = 0; j < bodyLines.length; j++) {
            var l = bodyLines[j];
            var safe = escapeHtml(l);
            var lineStyle = '';

            // Score table rows: "LPP:BullIgnite_HA18 | 1 | 100.0% | $   277.57"
            if (/\|\s*\d+\s*\|\s*[\d.]+%\s*\|/.test(l)) {
                lineStyle = 'font-family:JetBrains Mono,monospace;font-size:0.7rem;color:var(--text);padding:3px 16px;background:rgba(78,205,196,0.04);';
            }
            // TOTAL summary line
            else if (/TOTAL:|SCORE:/.test(l)) {
                lineStyle = 'font-family:JetBrains Mono,monospace;font-size:0.78rem;font-weight:700;color:var(--green);padding:8px 16px;border-top:1px solid var(--border);margin-top:4px;';
            }
            // Section headers in thesis (numbered points like "1. 🔥 THE PIVOT ANCHOR ENGINE")
            else if (/^\d+\.\s+[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(l)) {
                lineStyle = 'font-family:JetBrains Mono,monospace;font-size:0.85rem;font-weight:700;color:var(--accent);padding:14px 16px 6px;letter-spacing:0.5px;';
            }
            // Status icons (📡, 🔬, 📊, 🧠 etc) at start
            else if (/^[📡🔬📊🧠📈🏟️👑📋⏸️▶️🛂🛡️🏆📜🧬]/u.test(l.trim())) {
                lineStyle = 'font-family:JetBrains Mono,monospace;font-size:0.72rem;color:var(--text-dim);padding:4px 16px;';
            }
            // Errors / warnings
            else if (/⚠️|failed|error|abort|exception/i.test(l)) {
                lineStyle = 'font-family:JetBrains Mono,monospace;font-size:0.72rem;color:#ef4444;padding:6px 16px;background:rgba(239,68,68,0.06);';
            }
            // Default body line - readable narrative
            else {
                lineStyle = 'font-size:0.78rem;color:var(--text);line-height:1.7;padding:6px 16px;';
            }
            html += '<div style="' + lineStyle + ';white-space:pre-wrap;word-wrap:break-word;">' + safe + '</div>';
        }
        html += '</div>';  // body
        html += '</div>';  // card
    });

    return html;
}

(function() {
    // Format raw agent text into readable, sectioned HTML
    function formatAgentText(raw) {
        // Strip timestamps, emoji prefixes, and em/en dashes (Rob's mandate: no dashes)
        var clean = raw.replace(/\[\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}[:\d]*\]/g, '').replace(/📡 |👁️ |🧬 |🥷 /g, '');
        clean = clean.replace(/-/g, ',').replace(/-/g, ',');
        var lines = clean.split('\n');
        var html = '';
        var inSection = false;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line || line === '='.repeat(line.length) && line.length > 5) continue;

            // Section headers: [1] REGIME STATUS, [2] MARKET BREADTH, etc. or lines in ALL CAPS > 15 chars
            var sectionMatch = line.match(/^\[(\d+)\]\s*(.+)/);
            var isHeader = sectionMatch || (line === line.toUpperCase() && line.length > 10 && line.length < 60 && !line.match(/^\d/) && line.indexOf(':') === -1);

            if (sectionMatch || isHeader) {
                if (inSection) html += '</div>';
                var title = sectionMatch ? sectionMatch[2] : line;
                html += '<div style="margin-top:16px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border);">';
                html += '<span style="font-family:JetBrains Mono,monospace;font-size:0.65rem;font-weight:700;color:var(--accent);letter-spacing:2px;text-transform:uppercase;">' + title + '</span>';
                html += '</div><div style="margin-bottom:12px;">';
                inSection = true;
                continue;
            }

            // Key-value lines (ADX: 22.5, Win Rate: 45%, etc.)
            var kvMatch = line.match(/^([A-Za-z][A-Za-z0-9 _/]+):\s*(.+)/);
            if (kvMatch && kvMatch[1].length < 30) {
                html += '<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:0.7rem;">';
                html += '<span style="color:var(--text-dim);">' + kvMatch[1] + '</span>';
                var val = kvMatch[2];
                var valColor = 'var(--text)';
                if (val.match(/^\+/) || val.match(/bullish|HEALTHY|green|up/i)) valColor = 'var(--green)';
                if (val.match(/^-/) || val.match(/bearish|CRITICAL|red|down/i)) valColor = 'var(--red)';
                html += '<span style="color:' + valColor + ';font-family:JetBrains Mono,monospace;font-weight:600;">' + val + '</span>';
                html += '</div>';
                continue;
            }

            // Bullet points
            if (line.match(/^[-•*]\s/)) {
                html += '<div style="padding:3px 0 3px 12px;font-size:0.7rem;color:var(--text-dim);line-height:1.6;border-left:2px solid var(--border);">' + line.substring(2) + '</div>';
                continue;
            }

            // Regular paragraph text
            html += '<p style="font-size:0.72rem;color:var(--text-dim);line-height:1.7;margin:6px 0;">' + line + '</p>';
        }
        if (inSection) html += '</div>';
        return html;
    }

    // Single scrollable sentinel card (news page)
    function loadSentinelSingle() {
        var el = document.getElementById('sentinel-single');
        if (!el) return;
        (async function() {
            try {
                var res = await fcFetch('/api/swarm_logs?agent=flagship');
                var d = await res.json();
                if (d.logs && d.logs.length > 100) {
                    el.innerHTML = formatAgentText(d.logs);
                }
            } catch(e) {
                el.innerHTML = '<div class="pos-empty">Sentinel connecting...</div>';
            }
        })();
    }
    loadSentinelSingle();

    // Legacy feeds (sentinel-feed for swarm terminal page, shadow for news page)
    if (document.getElementById('sentinel-feed')) fetchSentinelFeed('sentinel', 'sentinel-feed', 4);
    fetchSentinelFeed('shadow', 'shadow-feed', 2);
    setInterval(function() {
        loadSentinelSingle();
        if (document.getElementById('sentinel-feed')) fetchSentinelFeed('sentinel', 'sentinel-feed', 4);
        fetchSentinelFeed('shadow', 'shadow-feed', 2);
    }, 60000);
})();

// ===== NEWS PAGE: Global Headlines =====
(function() {
    var colorMap = { accent: 'var(--accent)', amber: 'var(--amber)', red: 'var(--red)', green: 'var(--green)' };
    function timeAgo(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        var now = new Date();
        var mins = Math.floor((now - d) / 60000);
        if (isNaN(mins) || mins < 0) return '';
        if (mins < 60) return mins + 'm ago';
        var hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + 'h ago';
        return Math.floor(hrs / 24) + 'd ago';
    }
    async function fetchHeadlines() {
        var grid = document.getElementById('headlines-grid');
        var ticker = document.getElementById('ticker-track');
        if (!grid && !ticker) return;
        try {
            var res = await fcFetch('/api/news');
            var data = await res.json();
            var items = data.items || [];

            if (grid) {
                if (items.length === 0) {
                    grid.innerHTML = '<div class="pos-empty">Headlines loading...</div>';
                } else {
                    var html = '';
                    items.forEach(function(item) {
                        var c = colorMap[item.color] || 'var(--text-dim)';
                        html += '<a href="' + (item.link || '#') + '" target="_blank" rel="noopener" style="text-decoration:none;display:block;padding:14px 16px;background:var(--card);border:1px solid var(--border);border-radius:8px;border-left:3px solid ' + c + ';transition:all 0.2s;">';
                        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
                        html += '<span style="font-family:JetBrains Mono,monospace;font-size:0.55rem;color:' + c + ';letter-spacing:1px;text-transform:uppercase;">' + (item.icon || '') + ' ' + (item.source || '') + '</span>';
                        html += '<span style="font-family:JetBrains Mono,monospace;font-size:0.5rem;color:var(--text-dim);">' + timeAgo(item.date) + '</span>';
                        html += '</div>';
                        var cleanTitle = (item.title || '').replace(/-/g, ',').replace(/-/g, ',');
                        var cleanDesc = (item.desc || '').replace(/-/g, ',').replace(/-/g, ',');
                        html += '<div style="font-size:0.85rem;color:var(--text);font-weight:600;line-height:1.4;margin-bottom:4px;">' + cleanTitle + '</div>';
                        if (item.desc) html += '<div style="font-size:0.7rem;color:var(--text-dim);line-height:1.4;">' + cleanDesc + '</div>';
                        html += '</a>';
                    });
                    grid.innerHTML = html;
                }
            }

            if (ticker) {
                if (items.length === 0) {
                    ticker.innerHTML = '<div class="ticker-item">Headlines loading…</div>';
                } else {
                    var tickerHtml = '';
                    var renderTickerItem = function(item) {
                        var cls = 'crypto';
                        if (item.source && item.source.indexOf('BBC') !== -1) cls = 'world';
                        var t = (item.title || '').replace(/-/g, ',').replace(/-/g, ',');
                        return '<div class="ticker-item ' + cls + '"><span class="ticker-source">' + (item.source || '') + '</span><a href="' + (item.link || '#') + '" target="_blank" rel="noopener">' + t + '</a></div>';
                    };
                    items.forEach(function(item) { tickerHtml += renderTickerItem(item); });
                    items.forEach(function(item) { tickerHtml += renderTickerItem(item); });
                    ticker.innerHTML = tickerHtml;
                }
            }
        } catch(e) {
            if (grid) grid.innerHTML = '<div class="pos-empty">Headlines connecting...</div>';
            if (ticker) ticker.innerHTML = '<div class="ticker-item">Connecting…</div>';
        }
    }
    if (document.getElementById('headlines-grid') || document.getElementById('ticker-track')) {
        fetchHeadlines();
        setInterval(fetchHeadlines, 300000);
    }
})();

// ===== SIGNALS PAGE: Signal Feed =====
var allSignals = [];

function renderSignals(signals) {
    var feed = document.getElementById('signal-feed');
    if (!feed) return;
    function fmtNum(v, dp) { if (v === undefined || v === null || v === 999) return '--'; return Number(v).toFixed(dp === undefined ? 2 : dp); }
    function fmtPct(v) { if (v === undefined || v === null || v === 999) return '--'; return (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%'; }
    function bullBearColor(v, bullLow) { if (v === undefined || v === null) return ''; return bullLow ? (v < 30 ? 'var(--green)' : v > 70 ? 'var(--red)' : 'var(--text)') : ''; }

    var rows = signals.slice(0, 50).map(function(s, idx) {
        var sym = (s.sym_short || (s.symbol || '').replace('USDTM', ''));
        var mode = (s.mode || '').toLowerCase();
        var dirClass = mode.indexOf('bull') >= 0 ? 'long' : 'short';
        var dirLabel = mode.indexOf('bull') >= 0 ? 'LONG' : mode.indexOf('bear') >= 0 ? 'SHORT' : mode.toUpperCase();
        var tier = s.tier || '--';
        var conf = s.confluence || 0;
        var reason = s.mode_reason || '--';
        var duration = s.duration_mins ? Math.round(s.duration_mins) + 'm' : '--';

        var dots = '';
        for (var d = 0; d < 8; d++) {
            dots += d < conf ? '<span style="color:var(--green)">&#9679;</span>' : '<span style="color:var(--border)">&#9679;</span>';
        }

        var detail = '<div class="sig-expand" id="sig-expand-' + idx + '" style="display:none">';

        // --- NARRATIVE ---
        var narrative = '';
        if (s.sweep_type || s.sweep_level) {
            narrative = 'Price swept the <b>' + (s.sweep_level || '?') + '</b> ' + (s.sweep_strength ? '(' + s.sweep_strength + ' liquidity)' : '') +
                ' with a <b>' + (s.sweep_type || '?') + '</b> grab ' +
                (s.sweep_direction ? 'pulling ' + s.sweep_direction.toLowerCase() + ' side liquidity. ' : '. ') +
                'Mode: <b>' + (s.mode || '--') + '</b>. ' +
                'Reason fired: <b>' + reason + '</b>.';
        } else {
            narrative = 'Signal fired on <b>' + reason + '</b>. Mode <b>' + (s.mode || '--') + '</b>.';
        }
        detail += '<div style="padding:8px 10px; margin-bottom:10px; background:var(--card); border-left:3px solid ' + (dirClass === 'long' ? 'var(--green)' : 'var(--red)') + '; border-radius:6px; color:var(--text); font-size:0.72rem; line-height:1.6; font-family:Inter,sans-serif;">' + narrative + '</div>';

        // --- CONFLUENCE BREAKDOWN ---
        if (s.confluence_breakdown && s.confluence_breakdown.length > 0) {
            detail += '<div class="sig-expand-title">Confluence Breakdown &middot; ' + conf + '/8 passing</div>';
            detail += '<div class="sig-expand-grid">';
            for (var c = 0; c < s.confluence_breakdown.length; c++) {
                var cb = s.confluence_breakdown[c];
                var passClass = cb.passes ? 'sig-check-pass' : 'sig-check-fail';
                var icon = cb.passes ? '&#10003;' : '&#10007;';
                detail += '<div class="sig-check ' + passClass + '">';
                detail += '<span class="sig-check-icon">' + icon + '</span>';
                detail += '<span class="sig-check-name">' + (cb.name || '') + '</span>';
                detail += '<span class="sig-check-val">' + (cb.value !== undefined ? cb.value : '--') + '</span>';
                if (cb.target) detail += '<span class="sig-check-target">' + cb.target + '</span>';
                detail += '</div>';
            }
            detail += '</div>';
        }

        // --- MULTI-TIMEFRAME TREND STACK ---
        detail += '<div class="sig-expand-title" style="margin-top:12px;">Multi-Timeframe Trend Stack</div>';
        detail += '<div class="sig-expand-grid">';
        var stack = [
            ['ADX 15m', s.adx_15m, 25, '>25 trending'],
            ['ADX 4h', s.adx_4h, 25, '>25 trending'],
            ['ADX 8h', s.adx_8h, 25, '>25 trending'],
            ['Chop', s.chop, 50, '<40 trending / >60 ranging'],
            ['RSI', s.rsi, 50, '<30 OS / >70 OB'],
            ['Stoch K', s.stoch_k, 50, '<20 OS / >80 OB'],
            ['ATR %', s.atr_pct, null, 'Volatility'],
            ['DI Spread', s.di_spread, null, '+DI vs -DI']
        ];
        for (var k = 0; k < stack.length; k++) {
            var row = stack[k];
            if (row[1] === undefined || row[1] === null) continue;
            detail += '<div class="sig-check" style="background:rgba(255,255,255,0.02); border-color:var(--border);">';
            detail += '<span class="sig-check-name">' + row[0] + '</span>';
            detail += '<span class="sig-check-val">' + fmtNum(row[1], 1) + '</span>';
            detail += '<span class="sig-check-target">' + row[3] + '</span>';
            detail += '</div>';
        }
        detail += '</div>';

        // --- KEY LEVELS MAP ---
        detail += '<div class="sig-expand-title" style="margin-top:12px;">Key Level Map &middot; distance from price</div>';
        detail += '<div class="sig-expand-grid">';
        var levels = [
            ['Prev Day High', s.dist_pdh],
            ['Prev Day Low', s.dist_pdl],
            ['Prev Week High', s.dist_pwh],
            ['Prev Week Low', s.dist_pwl],
            ['Prev Month High', s.dist_pmh],
            ['Prev Month Low', s.dist_pml],
            ['Daily 50 EMA', s.dist_d50],
            ['Weekly 50 EMA', s.dist_w50],
            ['Monthly 50 EMA', s.dist_m50]
        ];
        for (var L = 0; L < levels.length; L++) {
            if (levels[L][1] === undefined || levels[L][1] === null) continue;
            detail += '<div class="sig-check" style="background:rgba(255,255,255,0.02); border-color:var(--border);">';
            detail += '<span class="sig-check-name">' + levels[L][0] + '</span>';
            detail += '<span class="sig-check-val">' + fmtPct(levels[L][1]) + '</span>';
            detail += '</div>';
        }
        detail += '</div>';

        // --- SWING ZONES ---
        detail += '<div class="sig-expand-title" style="margin-top:12px;">Swing Zones &middot; support / resistance</div>';
        detail += '<div class="sig-expand-grid">';
        var swings = [
            ['10h S/R', s.swing_10h_s, s.swing_10h_r],
            ['24h S/R', s.swing_24h_s, s.swing_24h_r],
            ['7d S/R',  s.swing_7d_s,  s.swing_7d_r],
            ['30d S/R', s.swing_30d_s, s.swing_30d_r]
        ];
        for (var w = 0; w < swings.length; w++) {
            var sw = swings[w];
            if ((sw[1] === undefined || sw[1] === 999) && (sw[2] === undefined || sw[2] === 999)) continue;
            detail += '<div class="sig-check" style="background:rgba(255,255,255,0.02); border-color:var(--border);">';
            detail += '<span class="sig-check-name">' + sw[0] + '</span>';
            detail += '<span class="sig-check-val">-' + fmtNum(sw[1], 1) + '% / +' + fmtNum(sw[2], 1) + '%</span>';
            detail += '</div>';
        }
        detail += '</div>';

        // --- META ROW ---
        detail += '<div class="sig-expand-stats">';
        detail += '<span>Tier: ' + tier + '</span>';
        if (s.close) detail += '<span>Price: ' + s.close + '</span>';
        if (s.is_trend_rider) detail += '<span style="color:var(--green);">Trend Rider</span>';
        if (s.above_d50 !== undefined) detail += '<span>' + (s.above_d50 ? '&#9650; D50' : '&#9660; D50') + '</span>';
        if (s.above_w50 !== undefined) detail += '<span>' + (s.above_w50 ? '&#9650; W50' : '&#9660; W50') + '</span>';
        if (s.above_m50 !== undefined) detail += '<span>' + (s.above_m50 ? '&#9650; M50' : '&#9660; M50') + '</span>';
        if (s.stars !== undefined) detail += '<span>&#9733; ' + s.stars + '</span>';
        detail += '</div>';

        detail += '</div>';

        return '<div class="signal-card-wrap" data-sig-idx="' + idx + '">' +
            '<div class="signal-row" data-dir="' + dirClass + '">' +
            '<div class="signal-time">' + duration + '</div>' +
            '<div class="signal-sym">' + sym + '</div>' +
            '<div class="signal-dir ' + dirClass + '">' + dirLabel + '</div>' +
            '<div class="signal-reason">' + reason + '</div>' +
            '<div class="signal-engine">' + dots + ' ' + conf + '/8</div>' +
            '<div class="signal-status active">' + tier + '</div></div>' +
            detail + '</div>';
    }).join('');
    feed.innerHTML = rows || '<div class="pos-empty">No signals match filter</div>';

    // Click handler for expanding signal detail
    feed.addEventListener('click', function(e) {
        var wrap = e.target.closest('.signal-card-wrap');
        if (!wrap) return;
        var idx = wrap.getAttribute('data-sig-idx');
        var expand = document.getElementById('sig-expand-' + idx);
        if (expand) {
            expand.style.display = expand.style.display === 'none' ? 'block' : 'none';
        }
    });
}

(function() {
    var feed = document.getElementById('signal-feed');
    if (!feed) return;
    async function fetchSignals() {
        try {
            var res = await fcFetch('/api/signals');
            if (res.status === 403) {
                feed.innerHTML =
                    '<div style="padding:60px 30px; text-align:center; background:var(--card); border:1px dashed var(--border); border-radius:14px;">' +
                    '<div style="font-family:\'JetBrains Mono\',monospace; color:#ffd700; letter-spacing:3px; font-size:0.72rem; text-transform:uppercase; margin-bottom:16px;">🔒 Signal Tier Required</div>' +
                    '<h3 style="color:var(--text); font-size:1.4rem; font-weight:800; margin-bottom:14px;">Trade alongside MAVERICK</h3>' +
                    '<p style="color:var(--text-dim); max-width:500px; margin:0 auto 24px; line-height:1.7;">Real-time trade signals, entry/exit/trail alerts, and engine-specific filtering are reserved for Signal tier. Connect your Base wallet and hold 10,000 $MAV (pre-launch Observer grace is free).</p>' +
                    '<a href="/pages/access.html" style="display:inline-block; padding:14px 28px; background:var(--accent); color:#000; font-family:\'JetBrains Mono\',monospace; font-weight:700; letter-spacing:2px; font-size:0.75rem; text-transform:uppercase; text-decoration:none; border-radius:10px;">Unlock access &rarr;</a>' +
                    '</div>';
                var el = function(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
                el('sig-total', '🔒'); el('sig-fired', '🔒'); el('sig-rejected', '🔒'); el('sig-symbols', '🔒');
                return;
            }
            var d = await res.json();
            if (d.signals && d.signals.length > 0) {
                allSignals = d.signals;
                renderSignals(allSignals);
                var today = new Date().toISOString().split('T')[0];
                var todaySignals = allSignals.filter(function(s) { return (s.time || '').toString().startsWith(today); });
                var el = function(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
                el('sig-total', allSignals.length);
                el('sig-fired', allSignals.length);
                el('sig-rejected', 0);
                var syms = new Set(allSignals.map(function(s) { return s.symbol; }));
                el('sig-symbols', syms.size);
            } else {
                feed.innerHTML = '<div class="pos-empty">No signals available yet. The engine generates signals during active market hours.</div>';
            }
        } catch(e) {
            feed.innerHTML = '<div class="pos-empty">Signal feed connecting...</div>';
        }
    }
    fetchSignals();
    setInterval(fetchSignals, 15000);
})();

// ===== SWARM PAGE: Multi-Agent Feed Hub =====
(function() {
    var swarmTabs = document.getElementById('swarm-tabs');
    if (!swarmTabs) return;

    var swarmAgents = ['swarm', 'sentinel', 'shadow', 'flagship', 'watchdog', 'forensics', 'digest', 'traffic'];
    var activeSwarmAgent = 'swarm';

    var agentBadgeColors = {
        swarm: 'var(--green)',
        sentinel: 'var(--amber)',
        shadow: 'var(--purple)',
        flagship: 'var(--blue)',
        watchdog: 'var(--red)',
        forensics: 'var(--red)',
        digest: '#00e5ff',
        traffic: '#ff6b6b'
    };

    // Map agent names to API agent params
    var agentApiMap = {
        swarm: 'swarm',
        sentinel: 'sentinel',
        shadow: 'shadow',
        flagship: 'twitter',
        watchdog: 'watchdog',
        forensics: 'forensics',
        digest: 'digest',
        traffic: 'traffic'
    };

    // Agent schedules in UTC hours:minutes - used for countdown timers
    var agentSchedules = {
        swarm:     { type: 'weekly', day: 0, hours: [17, 15] },         // Sunday 17:15
        sentinel:  { type: 'recurring', times: [[5,0],[11,0],[17,0],[23,0]] },
        shadow:    { type: 'recurring', times: [[4,50],[10,50],[16,50],[22,50]] },
        flagship:  { type: 'daily', times: [[7,30]] },
        watchdog:  { type: 'recurring', times: [[5,5],[11,5],[17,5],[23,5]] },
        forensics: { type: 'recurring', times: [[5,0],[11,0],[17,0],[23,0]] },
        digest:    { type: 'weekly', day: 0, hours: [16, 15] },         // Sunday 16:15
        traffic:   { type: 'none' }
    };

    function getNextRun(agent) {
        var sched = agentSchedules[agent];
        if (!sched || sched.type === 'none') return null;
        var now = new Date();
        var utcNow = now.getTime();

        if (sched.type === 'weekly') {
            // Next occurrence of this weekday at this time
            var target = new Date(now);
            target.setUTCHours(sched.hours[0], sched.hours[1], 0, 0);
            var currentDay = now.getUTCDay();
            var daysUntil = (sched.day - currentDay + 7) % 7;
            if (daysUntil === 0 && target.getTime() <= utcNow) daysUntil = 7;
            target.setUTCDate(target.getUTCDate() + daysUntil);
            return target.getTime() - utcNow;
        }

        // Recurring or daily
        var candidates = [];
        for (var i = 0; i < sched.times.length; i++) {
            var t = new Date(now);
            t.setUTCHours(sched.times[i][0], sched.times[i][1], 0, 0);
            if (t.getTime() <= utcNow) t.setUTCDate(t.getUTCDate() + 1);
            candidates.push(t.getTime() - utcNow);
        }
        return Math.min.apply(null, candidates);
    }

    function formatCountdown(ms) {
        if (ms === null) return '';
        var totalSecs = Math.floor(ms / 1000);
        var d = Math.floor(totalSecs / 86400);
        var h = Math.floor((totalSecs % 86400) / 3600);
        var m = Math.floor((totalSecs % 3600) / 60);
        var s = totalSecs % 60;
        if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
        if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
        return m + 'm ' + s + 's';
    }

    function updateCountdowns() {
        swarmTabs.querySelectorAll('[data-agent]').forEach(function(btn) {
            var agent = btn.getAttribute('data-agent');
            var cd = btn.querySelector('.agent-countdown');
            var ms = getNextRun(agent);
            if (ms === null) {
                if (cd) cd.remove();
                return;
            }
            if (!cd) {
                cd = document.createElement('span');
                cd.className = 'agent-countdown';
                btn.appendChild(cd);
            }
            cd.textContent = formatCountdown(ms);
        });
    }
    updateCountdowns();
    setInterval(updateCountdowns, 1000);

    function switchSwarmPageTab(agent) {
        activeSwarmAgent = agent;
        // Update tab button active states
        swarmTabs.querySelectorAll('[data-agent]').forEach(function(btn) {
            if (btn.getAttribute('data-agent') === agent) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        // Show matching panel, hide others
        swarmAgents.forEach(function(a) {
            var panel = document.getElementById('swarm-panel-' + a);
            if (panel) {
                if (a === agent) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            }
        });
        // Load feed if not already populated
        fetchSwarmPageFeed(agent);
    }

    function fetchSwarmPageFeed(agent) {
        var feedEl = document.getElementById('swarm-page-feed-' + agent);
        if (!feedEl) return;
        var apiAgent = agentApiMap[agent] || agent;
        (async function() {
            try {
                // Traffic monitor uses its own endpoint
                if (agent === 'traffic') {
                    var tres = await fcFetch('/api/traffic');
                    var td = await tres.json();
                    if (td.error) { feedEl.innerHTML = '<div class="pos-empty">Traffic monitor offline.</div>'; return; }
                    var tc = '#ff6b6b';
                    var th = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">';
                    th += '<span style="padding:6px 12px;background:rgba(255,107,107,0.08);border:1px solid rgba(255,107,107,0.3);border-radius:4px;font-size:0.65rem;font-family:\'JetBrains Mono\',monospace;color:' + tc + ';">LIVE NOW: ' + td.live + '</span>';
                    th += '<span style="padding:6px 12px;background:rgba(0,230,118,0.08);border:1px solid rgba(0,230,118,0.2);border-radius:4px;font-size:0.65rem;font-family:\'JetBrains Mono\',monospace;color:var(--green);">TODAY: ' + td.today.hits + ' hits / ' + td.today.unique + ' unique</span>';
                    th += '<span style="padding:6px 12px;background:rgba(62,168,245,0.08);border:1px solid rgba(62,168,245,0.2);border-radius:4px;font-size:0.65rem;font-family:\'JetBrains Mono\',monospace;color:var(--accent);">7D: ' + td.last_7d.hits + ' / ' + td.last_7d.unique + ' unique</span>';
                    th += '<span style="padding:6px 12px;background:rgba(255,214,0,0.08);border:1px solid rgba(255,214,0,0.2);border-radius:4px;font-size:0.65rem;font-family:\'JetBrains Mono\',monospace;color:var(--amber);">30D: ' + td.last_30d.hits + ' / ' + td.last_30d.unique + ' unique</span>';
                    th += '<span style="padding:6px 12px;background:rgba(200,200,200,0.08);border:1px solid rgba(200,200,200,0.2);border-radius:4px;font-size:0.65rem;font-family:\'JetBrains Mono\',monospace;color:var(--text-dim);">ALL TIME: ' + td.all_time.hits + ' / ' + td.all_time.unique + ' unique</span>';
                    th += '</div>';
                    // Devices
                    var devTotal = (td.devices.mobile + td.devices.desktop) || 1;
                    th += '<div style="color:' + tc + ';font-family:\'JetBrains Mono\',monospace;font-size:0.65rem;font-weight:700;letter-spacing:1px;margin-bottom:8px;">DEVICES (7D)</div>';
                    th += '<div style="display:flex;gap:12px;margin-bottom:20px;">';
                    th += '<div style="flex:1;padding:12px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-align:center;"><div style="font-size:1.2rem;font-weight:700;color:var(--accent);font-family:\'JetBrains Mono\',monospace;">' + Math.round(td.devices.mobile/devTotal*100) + '%</div><div style="font-size:0.55rem;color:var(--text-dim);font-family:\'JetBrains Mono\',monospace;letter-spacing:1px;">MOBILE</div></div>';
                    th += '<div style="flex:1;padding:12px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-align:center;"><div style="font-size:1.2rem;font-weight:700;color:var(--green);font-family:\'JetBrains Mono\',monospace;">' + Math.round(td.devices.desktop/devTotal*100) + '%</div><div style="font-size:0.55rem;color:var(--text-dim);font-family:\'JetBrains Mono\',monospace;letter-spacing:1px;">DESKTOP</div></div>';
                    th += '</div>';
                    // Daily chart
                    if (td.daily && td.daily.length > 0) {
                        var maxH = Math.max.apply(null, td.daily.map(function(x){return x.hits;})) || 1;
                        th += '<div style="color:' + tc + ';font-family:\'JetBrains Mono\',monospace;font-size:0.65rem;font-weight:700;letter-spacing:1px;margin-bottom:8px;">DAILY TRAFFIC (14D)</div>';
                        th += '<div style="display:flex;align-items:flex-end;gap:4px;height:120px;margin-bottom:20px;">';
                        td.daily.forEach(function(day) {
                            var pct = Math.max(4, (day.hits / maxH) * 100);
                            th += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;">';
                            th += '<div style="font-size:0.5rem;color:var(--text-dim);font-family:\'JetBrains Mono\',monospace;margin-bottom:2px;">' + day.hits + '</div>';
                            th += '<div style="width:100%;height:' + pct + '%;background:linear-gradient(180deg,' + tc + ',rgba(255,107,107,0.3));border-radius:3px 3px 0 0;min-height:4px;"></div>';
                            th += '<div style="font-size:0.45rem;color:var(--text-dim);font-family:\'JetBrains Mono\',monospace;margin-top:4px;">' + day.date.slice(5) + '</div>';
                            th += '</div>';
                        });
                        th += '</div>';
                    }
                    // Top pages
                    if (td.top_pages && td.top_pages.length > 0) {
                        th += '<div style="color:' + tc + ';font-family:\'JetBrains Mono\',monospace;font-size:0.65rem;font-weight:700;letter-spacing:1px;margin-bottom:8px;">TOP PAGES (7D)</div>';
                        td.top_pages.forEach(function(p) {
                            th += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-family:\'JetBrains Mono\',monospace;font-size:0.6rem;">';
                            th += '<span style="color:var(--text);">' + p.page + '</span>';
                            th += '<span style="color:var(--text-dim);">' + p.hits + ' hits / ' + p.unique + ' unique</span>';
                            th += '</div>';
                        });
                        th += '<div style="margin-bottom:20px;"></div>';
                    }
                    // Top referrers
                    if (td.top_referrers && td.top_referrers.length > 0) {
                        th += '<div style="color:' + tc + ';font-family:\'JetBrains Mono\',monospace;font-size:0.65rem;font-weight:700;letter-spacing:1px;margin-bottom:8px;">TOP REFERRERS (7D)</div>';
                        td.top_referrers.forEach(function(r) {
                            th += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-family:\'JetBrains Mono\',monospace;font-size:0.6rem;">';
                            th += '<span style="color:var(--accent);">' + r.domain + '</span>';
                            th += '<span style="color:var(--text-dim);">' + r.hits + ' hits</span>';
                            th += '</div>';
                        });
                    }
                    feedEl.innerHTML = th;
                    return;
                }
                // Crime Scene Forensics
                if (agent === 'forensics') {
                    var fres = await fcFetch('/api/forensics');
                    var fd = await fres.json();
                    if (fd.scenes && fd.scenes.length > 0) {
                        var fh = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">';
                        fh += '<span style="padding:6px 12px;background:rgba(255,60,60,0.08);border:1px solid rgba(255,60,60,0.3);border-radius:4px;font-size:0.65rem;font-family:\'JetBrains Mono\',monospace;color:#ff3c3c;">LOSSES ANALYSED: ' + fd.total_losses + '</span>';
                        fh += '<span style="padding:6px 12px;background:rgba(0,230,118,0.08);border:1px solid rgba(0,230,118,0.3);border-radius:4px;font-size:0.65rem;font-family:\'JetBrains Mono\',monospace;color:var(--green);">WINS ANALYSED: ' + fd.total_wins + '</span>';
                        fh += '<span style="padding:6px 12px;background:rgba(200,200,200,0.08);border:1px solid rgba(200,200,200,0.2);border-radius:4px;font-size:0.65rem;font-family:\'JetBrains Mono\',monospace;color:var(--text-dim);">PHYSICS FIELDS: ' + fd.physics_fields + '</span>';
                        fh += '</div>';
                        fd.scenes.forEach(function(s) {
                            var isLoss = s.outcome === 'LOSS';
                            var borderColor = isLoss ? '#ff3c3c' : 'var(--green)';
                            var badge = isLoss ? '💀 LOSS' : '✅ WIN';
                            var badgeBg = isLoss ? 'rgba(255,60,60,0.1)' : 'rgba(0,230,118,0.1)';
                            var badgeBorder = isLoss ? 'rgba(255,60,60,0.3)' : 'rgba(0,230,118,0.3)';
                            fh += '<div class="sentinel-card" style="border-left-color:' + borderColor + ';margin-bottom:12px;">';
                            fh += '<div class="sentinel-header" style="flex-wrap:wrap;gap:6px;">';
                            fh += '<span style="padding:3px 8px;background:' + badgeBg + ';border:1px solid ' + badgeBorder + ';border-radius:3px;font-size:0.6rem;font-family:\'JetBrains Mono\',monospace;color:' + borderColor + ';">' + badge + '</span>';
                            fh += '<span style="font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;font-weight:700;color:var(--text);">' + s.symbol.replace('USDTM','') + '</span>';
                            fh += '<span style="font-family:\'JetBrains Mono\',monospace;font-size:0.6rem;color:' + borderColor + ';">' + s.pnl_pct.toFixed(2) + '%</span>';
                            fh += '<span style="font-family:\'JetBrains Mono\',monospace;font-size:0.55rem;color:var(--text-dim);">' + s.direction.toUpperCase() + ' / ' + s.regime + '</span>';
                            fh += '<span style="font-family:\'JetBrains Mono\',monospace;font-size:0.55rem;color:var(--text-dim);">' + s.timestamp.slice(0,16) + '</span>';
                            fh += '</div>';
                            if (isLoss && s.reason) {
                                fh += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.6rem;color:#ff3c3c;margin:6px 0;">KILL: ' + s.reason + ' | Duration: ' + Math.round(s.duration_secs/60) + 'min</div>';
                            }
                            // Physics grid
                            var p = s.physics;
                            var keys = Object.keys(p);
                            if (keys.length > 0) {
                                fh += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:4px;margin-top:8px;">';
                                keys.forEach(function(k) {
                                    var v = p[k];
                                    var display = (typeof v === 'number') ? v.toFixed(4) : String(v);
                                    if (display.length > 10) display = parseFloat(display).toFixed(4);
                                    var label = k.replace(/_/g,' ').toUpperCase();
                                    fh += '<div style="padding:4px 6px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:3px;font-family:\'JetBrains Mono\',monospace;">';
                                    fh += '<div style="font-size:0.45rem;color:var(--text-dim);letter-spacing:0.5px;">' + label + '</div>';
                                    fh += '<div style="font-size:0.6rem;color:var(--text);font-weight:600;">' + display + '</div>';
                                    fh += '</div>';
                                });
                                fh += '</div>';
                            }
                            fh += '</div>';
                        });
                        feedEl.innerHTML = fh;
                    } else {
                        feedEl.innerHTML = '<div class="pos-empty">No forensic data available yet.</div>';
                    }
                    return;
                }
                // Weekly digest uses its own endpoint
                if (agent === 'digest') {
                    var dres = await fcFetch('/api/weekly_digest');
                    var dd = await dres.json();
                    if (dd.digest && dd.digest.length > 50) {
                        var meta = dd.meta || {};
                        var metaHtml = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">';
                        var genDate = meta.generated ? new Date(meta.generated) : null;
                        var genStr = genDate ? genDate.toLocaleDateString('en-GB', {weekday:'short',day:'numeric',month:'short',year:'numeric'}) + ' at ' + genDate.toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'}) : 'N/A';
                        metaHtml += '<span style="padding:4px 10px;background:var(--blue-dim);border:1px solid var(--border);border-radius:4px;font-size:0.6rem;font-family:\'JetBrains Mono\',monospace;color:var(--accent);">GENERATED: ' + genStr + '</span>';
                        metaHtml += '<span style="padding:4px 10px;background:var(--green-dim);border:1px solid var(--border);border-radius:4px;font-size:0.6rem;font-family:\'JetBrains Mono\',monospace;color:var(--green);">BROADCASTS: ' + (meta.broadcast_count || 'N/A') + '</span>';
                        metaHtml += '<span style="padding:4px 10px;background:var(--blue-dim);border:1px solid var(--border);border-radius:4px;font-size:0.6rem;font-family:\'JetBrains Mono\',monospace;color:var(--accent);">TRADES: ' + (meta.total_trades || 0) + ' (' + (meta.total_wins || 0) + 'W/' + (meta.total_losses || 0) + 'L)</span>';
                        metaHtml += '<span style="padding:4px 10px;background:rgba(255,214,0,0.06);border:1px solid var(--border);border-radius:4px;font-size:0.6rem;font-family:\'JetBrains Mono\',monospace;color:var(--amber);">NET EQUITY PNL: ' + (meta.net_pnl || 0).toFixed(4) + '%</span>';
                        if (meta.generation_time_secs) {
                            var gm = Math.floor(meta.generation_time_secs / 60);
                            var gs = Math.round(meta.generation_time_secs % 60);
                            metaHtml += '<span style="padding:4px 10px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:4px;font-size:0.6rem;font-family:\'JetBrains Mono\',monospace;color:var(--text-dim);">GENERATED IN: ' + gm + 'm ' + gs + 's</span>';
                        }
                        metaHtml += '</div>';
                        // Split digest into sections by markdown headers
                        var sections = dd.digest.split(/^(#+\s.*$)/gm);
                        var bodyHtml = '';
                        for (var si = 0; si < sections.length; si++) {
                            var sec = sections[si].trim();
                            if (!sec) continue;
                            if (sec.match(/^#+\s/)) {
                                bodyHtml += '<div style="color:var(--accent);font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;font-weight:700;letter-spacing:1px;margin-top:16px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border);">' + sec.replace(/^#+\s*/, '') + '</div>';
                            } else {
                                bodyHtml += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.6rem;color:var(--text-dim);line-height:1.7;white-space:pre-wrap;margin-bottom:12px;">' + sec + '</div>';
                            }
                        }
                        feedEl.innerHTML = metaHtml + bodyHtml;
                    } else {
                        feedEl.innerHTML = '<div class="pos-empty">No weekly digest generated yet. First digest runs Sunday 16:15 UTC.</div>';
                    }
                    return;
                }
                var res = await fcFetch('/api/swarm_logs?agent=' + apiAgent);
                var d = await res.json();
                if (d.logs && d.logs.length > 50) {
                    var html;
                    if (agent === 'swarm') {
                        html = renderSwarmLog(d.logs, agentBadgeColors[agent] || 'var(--accent)');
                    } else {
                        var blocks = d.logs.split('\n\n').filter(function(b) { return b.trim().length > 10; });
                        var entries = blocks.reverse();
                        html = '';
                        entries.forEach(function(block) {
                            var tsMatch = block.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
                            var ts = tsMatch ? tsMatch[1] : '';
                            var badgeColor = agentBadgeColors[agent] || 'var(--accent)';
                            html += '<div class="sentinel-card" style="border-left-color:' + badgeColor + ';">';
                            html += '<div class="sentinel-header">';
                            html += '<div class="sentinel-badge" style="color:' + badgeColor + ';border-color:' + badgeColor + ';">' + agent.toUpperCase() + '</div>';
                            html += '<div class="sentinel-time">' + ts + '</div>';
                            html += '</div>';
                            html += '<div class="sentinel-body">' + block + '</div>';
                            html += '</div>';
                        });
                    }
                    feedEl.innerHTML = html;
                } else if (d.entries && d.entries.length > 0) {
                    var lines = d.entries.reverse();
                    var html2 = '';
                    lines.forEach(function(entry) {
                        var content = entry.content || entry;
                        var tsMatch2 = content.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
                        var ts2 = tsMatch2 ? tsMatch2[1] : '';
                        var badgeColor2 = agentBadgeColors[agent] || 'var(--accent)';
                        html2 += '<div class="sentinel-card" style="border-left-color:' + badgeColor2 + ';">';
                        html2 += '<div class="sentinel-header">';
                        html2 += '<div class="sentinel-badge" style="color:' + badgeColor2 + ';border-color:' + badgeColor2 + ';">' + agent.toUpperCase() + '</div>';
                        html2 += '<div class="sentinel-time">' + ts2 + '</div>';
                        html2 += '</div>';
                        html2 += '<div class="sentinel-body">' + content + '</div>';
                        html2 += '</div>';
                    });
                    feedEl.innerHTML = html2;
                } else {
                    feedEl.innerHTML = '<div class="pos-empty">No ' + agent + ' data available yet.</div>';
                }
            } catch(err) {
                feedEl.innerHTML = '<div class="pos-empty">' + agent.toUpperCase() + ' feed connecting...</div>';
            }
        })();
    }

    // Bind tab buttons
    swarmTabs.querySelectorAll('[data-agent]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            switchSwarmPageTab(this.getAttribute('data-agent'));
        });
    });

    // Load default tab
    switchSwarmPageTab(activeSwarmAgent);

    // Auto-refresh active feed every 60s
    setInterval(function() {
        fetchSwarmPageFeed(activeSwarmAgent);
    }, 60000);

    // Expose so openTerminal (in a separate scope) can trigger a fresh pull
    // when the fullscreen terminal is open. Without this, fullscreen shows stale data
    // until the user closes and re-opens.
    window.fetchSwarmPageFeed = fetchSwarmPageFeed;
})();

// ===== SWARM EVOLUTION MODULE (homepage) =====
(function(){
    var lastChampGen = 0;
    var champLoaded = false;
    var champDetailOpen = false;

    function getNextSwarmTime(){
        var now = new Date();
        var day = now.getUTCDay();
        var daysUntil = (6 - day + 7) % 7;
        if (daysUntil === 0 && now.getUTCHours() >= 16) daysUntil = 7;
        var next = new Date(now);
        next.setUTCDate(now.getUTCDate() + daysUntil);
        next.setUTCHours(16, 0, 0, 0);
        return next;
    }

    function formatCountdown(ms){
        if (ms <= 0) return 'IMMINENT';
        var s = Math.floor(ms / 1000);
        var d = Math.floor(s / 86400); s %= 86400;
        var h = Math.floor(s / 3600); s %= 3600;
        var m = Math.floor(s / 60); s %= 60;
        var parts = [];
        if (d > 0) parts.push(d + 'd');
        parts.push(h + 'h');
        parts.push(m + 'm');
        parts.push(s + 's');
        return parts.join(' ');
    }

    // Wire up champion toggle
    function initToggle(){
        var toggle = document.getElementById('sh-champ-toggle');
        if (!toggle || toggle._bound) return;
        toggle._bound = true;
        toggle.addEventListener('click', function(e){
            e.preventDefault();
            e.stopPropagation();
            var detail = document.getElementById('sh-champ-detail');
            var arrow = document.getElementById('sh-champ-arrow');
            if (!detail) return;
            champDetailOpen = !champDetailOpen;
            detail.style.display = champDetailOpen ? 'block' : 'none';
            if (arrow) arrow.style.transform = champDetailOpen ? 'rotate(180deg)' : 'rotate(0deg)';
        });
    }

    function pollSwarm(){
        var b = document.getElementById('swarm-hero-banner');
        if (!b) return;
        fcFetch('/api/swarm_status').then(function(r){ return r.json(); }).then(function(d){
            var dot = document.getElementById('sh-dot');
            var lbl = document.getElementById('sh-label');
            var det = document.getElementById('sh-detail');
            var bar = document.getElementById('sh-bar');
            b.style.display = 'block';
            if (d.running) {
                var isMega = d.mode === 'MEGA HUNT' || (d.phase || '').indexOf('MEGA') >= 0;
                var megaCol = 'var(--champion)';
                var liveCol = 'var(--green, #10b981)';
                dot.style.background = isMega ? megaCol : liveCol;
                dot.style.boxShadow = '0 0 12px ' + (isMega ? megaCol : liveCol);
                dot.style.animation = 'pulse-dot 1.5s infinite';
                lbl.style.color = isMega ? megaCol : liveCol;
                lbl.textContent = isMega ? '🔥 MEGA HUNT LIVE · 1000-GEN' : 'SWARM EVOLVING LIVE';
                det.style.color = isMega ? megaCol : liveCol;
                det.textContent = 'Gen ' + d.gen + '/' + d.total + (isMega ? ' · Hunting champion-beater' : ' ' + (d.phase || '') + (d.focus ? ' | ' + d.focus : ''));
                bar.style.width = (d.total > 0 ? (d.gen / d.total * 100) : 0) + '%';
                bar.style.background = isMega
                    ? 'linear-gradient(90deg, var(--champion), var(--accent), var(--champion))'
                    : 'linear-gradient(90deg, var(--green, #10b981), var(--accent, #3ea8f5))';
                if (d.champion_score > 0 && d.champion_gen !== lastChampGen) {
                    lastChampGen = d.champion_gen;
                    fetchChampion();
                }
            } else {
                dot.style.background = 'var(--text-muted, #6b7280)';
                dot.style.boxShadow = 'none';
                dot.style.animation = 'none';
                lbl.style.color = 'var(--text, #e5e7eb)';
                lbl.textContent = 'SWARM DORMANT';
                det.style.color = 'var(--text-muted, #9ca3af)';
                var nextRun = getNextSwarmTime();
                var remaining = nextRun.getTime() - Date.now();
                det.textContent = 'Next evolution: ' + formatCountdown(remaining);
                bar.style.width = '0%';
                if (!champLoaded) {
                    champLoaded = true;
                    fetchChampion();
                }
            }
            initToggle();
        }).catch(function(){});
    }

    function fetchChampion(){
        fcFetch('/api/swarm_champion').then(function(r){ return r.json(); }).then(function(c){
            if (!c.found) return;
            var el = document.getElementById('sh-champion');
            if (!el) return;
            el.style.display = 'block';
            document.getElementById('sh-champ-name').textContent = (c.name || 'Gen ' + c.gen).substring(0, 50);
            document.getElementById('sh-champ-score').textContent = 'Score: ' + (c.score ? c.score.toFixed(0) : '--');

            // Build the full champion detail panel
            var detail = document.getElementById('sh-champ-detail');
            if (!detail) return;
            var html = '';

            // Performance stats as a grid
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">';
            if (c.trades) html += '<div style="background:var(--bg2,#0a0f18);border:1px solid var(--border);border-radius:6px;padding:10px 12px;text-align:center;"><div style="font-size:1.1rem;font-weight:800;color:var(--green,#4ecdc4);">' + c.trades + '</div><div style="font-size:0.55rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim,#5a6a82);margin-top:2px;">Trades Executed</div></div>';
            if (c.win_rate) html += '<div style="background:var(--bg2,#0a0f18);border:1px solid var(--border);border-radius:6px;padding:10px 12px;text-align:center;"><div style="font-size:1.1rem;font-weight:800;color:var(--blue,#3ea8f5);">' + c.win_rate.toFixed(1) + '%</div><div style="font-size:0.55rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim,#5a6a82);margin-top:2px;">Win Rate</div></div>';
            if (c.payoff_ratio) html += '<div style="background:var(--bg2,#0a0f18);border:1px solid var(--border);border-radius:6px;padding:10px 12px;text-align:center;"><div style="font-size:1.1rem;font-weight:800;color:var(--amber,#f5a623);">' + c.payoff_ratio.toFixed(2) + 'x</div><div style="font-size:0.55rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim,#5a6a82);margin-top:2px;">Payoff Ratio</div></div>';
            if (c.total_return_pct !== undefined) html += '<div style="background:var(--bg2,#0a0f18);border:1px solid var(--border);border-radius:6px;padding:10px 12px;text-align:center;"><div style="font-size:1.1rem;font-weight:800;color:' + ((c.total_return_pct || 0) >= 0 ? 'var(--green,#4ecdc4)' : 'var(--red,#ef4444)') + ';">' + ((c.total_return_pct || 0) >= 0 ? '+' : '') + (c.total_return_pct || 0).toFixed(1) + '%</div><div style="font-size:0.55rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim,#5a6a82);margin-top:2px;">Net Return</div></div>';
            html += '</div>';

            // Active engines
            if (c.engine_names && c.engine_names.length) {
                html += '<div style="margin-bottom:16px;"><div style="font-size:0.6rem;font-weight:700;color:var(--text,#e4e8f0);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Active Trading Engines</div>';
                html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
                c.engine_names.forEach(function(e){
                    var col = e === 'Trend' ? 'var(--green,#4ecdc4)' : e === 'Trap' ? 'var(--amber,#f5a623)' : e === 'Chop' ? 'var(--blue,#3ea8f5)' : 'var(--purple,#8b5cf6)';
                    html += '<span style="font-size:0.6rem;font-weight:700;color:' + col + ';background:color-mix(in srgb,' + col + ' 12%,transparent);padding:4px 12px;border-radius:5px;border:1px solid color-mix(in srgb,' + col + ' 25%,transparent);">' + e.toUpperCase() + ' ENGINE</span>';
                });
                html += '</div></div>';
            }

            // Summary paragraphs (human-readable marketing copy)
            if (c.summary && c.summary.length) {
                html += '<div style="margin-bottom:16px;"><div style="font-size:0.6rem;font-weight:700;color:var(--text,#e4e8f0);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">What This Strategy Does</div>';
                c.summary.forEach(function(p){
                    html += '<p style="font-size:0.68rem;line-height:1.8;color:var(--text,#e4e8f0);margin-bottom:10px;opacity:0.9;">' + p + '</p>';
                });
                html += '</div>';
            }

            // Techniques (high-level strategic patterns the LLM wove together)
            if (c.techniques && c.techniques.length) {
                html += '<div style="margin-bottom:16px;"><div style="font-size:0.6rem;font-weight:700;color:var(--text,#e4e8f0);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">' + c.techniques.length + ' Strategic Techniques</div>';
                html += '<div style="display:flex;flex-direction:column;gap:6px;">';
                c.techniques.forEach(function(t){
                    var desc = (c.technique_details && c.technique_details[t]) ? c.technique_details[t] : '';
                    html += '<div style="background:var(--bg2,#0a0f18);border:1px solid var(--border);border-radius:6px;padding:8px 12px;">';
                    html += '<div style="font-size:0.62rem;font-weight:700;color:var(--accent,#3ea8f5);">' + t + '</div>';
                    if (desc) html += '<div style="font-size:0.58rem;color:var(--text,#e4e8f0);opacity:0.75;margin-top:3px;line-height:1.6;">' + desc + '</div>';
                    html += '</div>';
                });
                html += '</div></div>';
            }

            // Full Indicator Stack (every feature this champion pulls per bar)
            if (c.feature_panel && c.feature_panel.length) {
                var stackId = 'champ-stack-' + Math.random().toString(36).slice(2,8);
                html += '<div style="margin-bottom:16px;">';
                html += '<div onclick="var x=document.getElementById(\'' + stackId + '\'); var a=document.getElementById(\'' + stackId + '-arrow\'); var open=x.style.display!==\'none\'; x.style.display=open?\'none\':\'flex\'; a.style.transform=open?\'rotate(0deg)\':\'rotate(180deg)\';" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:0.6rem;font-weight:700;color:var(--text,#e4e8f0);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;padding:8px 0;border-top:1px dashed var(--border);">';
                html += '<span>Full Indicator Stack &middot; ' + c.feature_panel.length + ' Features Feeding Every Decision</span>';
                html += '<span id="' + stackId + '-arrow" style="opacity:0.5;font-size:0.65rem;transition:transform 0.3s;">&#9660;</span>';
                html += '</div>';
                html += '<div id="' + stackId + '" style="display:none;flex-direction:column;gap:5px;max-height:360px;overflow-y:auto;padding-right:6px;">';
                c.feature_panel.forEach(function(f){
                    html += '<div style="background:var(--bg2,#0a0f18);border:1px solid var(--border);border-left:2px solid var(--green,#4ecdc4);border-radius:5px;padding:7px 11px;">';
                    html += '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;">';
                    html += '<span style="font-size:0.6rem;font-weight:700;color:var(--text,#e4e8f0);">' + f.label + '</span>';
                    html += '<code style="font-size:0.52rem;color:var(--text-dim,#5a6a82);font-family:\'JetBrains Mono\',monospace;">' + f.feature + '</code>';
                    html += '</div>';
                    if (f.description) html += '<div style="font-size:0.55rem;color:var(--text,#e4e8f0);opacity:0.7;margin-top:2px;line-height:1.55;">' + f.description + '</div>';
                    html += '</div>';
                });
                html += '</div></div>';
            }

            // Generation info
            html += '<div style="display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid var(--border,rgba(255,255,255,0.06));">';
            html += '<span style="font-size:0.55rem;color:var(--text-dim,#5a6a82);letter-spacing:0.5px;">Generation ' + c.gen + ' of 60 | Evolved by LLM Swarm</span>';
            html += '<a href="/pages/swarm.html" style="font-size:0.55rem;font-weight:700;color:var(--accent,#3ea8f5);text-decoration:none;letter-spacing:0.5px;">VIEW SWARM TERMINALS &rarr;</a>';
            html += '</div>';

            detail.innerHTML = html;
            initToggle();
        }).catch(function(){});
    }

    function tickCountdown(){
        var lbl = document.getElementById('sh-label');
        if (!lbl || lbl.textContent !== 'SWARM DORMANT') return;
        var det = document.getElementById('sh-detail');
        if (!det) return;
        var nextRun = getNextSwarmTime();
        var remaining = nextRun.getTime() - Date.now();
        det.textContent = 'Next evolution: ' + formatCountdown(remaining);
    }

    setInterval(pollSwarm, 10000);
    setInterval(tickCountdown, 1000);
    setTimeout(pollSwarm, 1500);
})();
