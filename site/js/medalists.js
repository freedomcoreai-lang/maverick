/* medalists.js - fetches /api/swarm_medalists, renders the podium, handles detail modal.
   Auto-refreshes every 60s so a newly crowned champion shows up automatically. */
(function() {
    var grid = document.getElementById('medal-grid');
    var modal = document.getElementById('medal-modal');
    var modalContent = document.getElementById('medal-modal-content');
    var modalClose = document.getElementById('medal-modal-close');
    var liveMeta = document.getElementById('medal-live-meta');
    if (!grid || !modal) return;

    var lastData = null;

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function timeAgo(ts) {
        if (!ts) return 'unknown';
        var now = Math.floor(Date.now() / 1000);
        var diff = now - ts;
        if (diff < 60) return diff + 's ago';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    }

    function formatUsd(v) {
        var n = Number(v || 0);
        return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }

    function renderCard(m) {
        var biasClass = (m.btc_bias || '').toLowerCase();
        var taglineHtml = m.tagline ? '<div class="medal-tagline">' + escapeHtml(m.tagline) + '</div>' : '';
        return (
            '<div class="medal-card ' + escapeHtml(m.medal) + '" data-rank="' + m.rank + '">' +
                '<div class="medal-emoji">' + escapeHtml(m.emoji) + '</div>' +
                '<div class="medal-label">' + escapeHtml(m.label) + '</div>' +
                '<div class="medal-display-name">' + escapeHtml(m.display_name) + '</div>' +
                '<div class="medal-codename">' + escapeHtml(m.codename) + ' · v' + escapeHtml(m.version) + ' · crowned ' + timeAgo(m.crowned_ts) + '</div>' +
                taglineHtml +
                '<div class="medal-score-row">' +
                    '<span class="medal-score-label">6-day score</span>' +
                    '<span class="medal-score-value">' + Number(m.score).toLocaleString() + '</span>' +
                '</div>' +
                '<div class="medal-meta">' +
                    '<span class="medal-meta-tag ' + biasClass + '">' + escapeHtml(m.btc_bias) + '</span>' +
                    '<span class="medal-meta-tag">' + escapeHtml(m.macro_regime) + '</span>' +
                    '<span class="medal-meta-tag">' + (m.required_features.length || 0) + ' features</span>' +
                '</div>' +
                '<div class="medal-cta">Open full breakdown</div>' +
            '</div>'
        );
    }

    function renderModal(m) {
        var thesisHtml = '';
        if (m.thesis) {
            // Preserve the spaced paragraph format the LLM is now mandated to write
            thesisHtml = escapeHtml(m.thesis);
        } else {
            thesisHtml = 'No strategy summary recorded for this champion.';
        }

        var featuresHtml;
        if (m.required_features && m.required_features.length) {
            featuresHtml = m.required_features.map(function(f) {
                return '<span class="medal-feature-pill">' + escapeHtml(f) + '</span>';
            }).join('');
        } else {
            featuresHtml = '<span class="medal-feature-pill empty">No Streamline columns required - uses cached precomputes only</span>';
        }

        var dnaHtml = '';
        if (m.dna && Object.keys(m.dna).length) {
            var rows = Object.keys(m.dna).map(function(k) {
                return '<div class="medal-dna-row"><span class="medal-dna-key">' + escapeHtml(k) + '</span><span class="medal-dna-val">' + escapeHtml(m.dna[k]) + '</span></div>';
            }).join('');
            dnaHtml = '<div class="medal-dna-grid">' + rows + '</div>';
        } else {
            dnaHtml = '<div class="medal-empty-state" style="padding:24px;">DNA dictionary not parseable from source.</div>';
        }

        var preFilterHtml = m.pre_filter_logic ? '<pre class="medal-code-block">' + escapeHtml(m.pre_filter_logic) + '</pre>' : '<div class="medal-empty-state" style="padding:24px;">No pre_filter logic captured.</div>';
        var entryHtml = m.entry_logic ? '<pre class="medal-code-block">' + escapeHtml(m.entry_logic) + '</pre>' : '<div class="medal-empty-state" style="padding:24px;">No signal_entry logic captured.</div>';
        var exitHtml = m.exit_logic ? '<pre class="medal-code-block">' + escapeHtml(m.exit_logic) + '</pre>' : '<div class="medal-empty-state" style="padding:24px;">No manage_position logic captured - champion uses default 4.5 ATR stop / 8 ATR target.</div>';

        var taglineHtml = m.tagline ? '<div class="medal-modal-tagline">"' + escapeHtml(m.tagline) + '"</div>' : '';
        var originHtml = m.origin_story ? '<div class="medal-section"><div class="medal-section-title">⚔️ Origin Story</div><div class="medal-origin-story">' + escapeHtml(m.origin_story) + '</div></div>' : '';
        var perfHtml = '';
        if (m.trades != null || m.wr_pct != null || m.pnl_usd != null) {
            perfHtml =
                '<div class="medal-modal-stats">' +
                    '<div class="medal-stat"><div class="medal-stat-label">Evaluation Trades</div><div class="medal-stat-value">' + (m.trades != null ? escapeHtml(m.trades) : '—') + '</div></div>' +
                    '<div class="medal-stat"><div class="medal-stat-label">Win Rate</div><div class="medal-stat-value">' + (m.wr_pct != null ? escapeHtml(Number(m.wr_pct).toFixed(1) + '%') : '—') + '</div></div>' +
                    '<div class="medal-stat"><div class="medal-stat-label">Backtest PnL</div><div class="medal-stat-value">' + (m.pnl_usd != null ? escapeHtml(formatUsd(m.pnl_usd)) : '—') + '</div></div>' +
                    '<div class="medal-stat"><div class="medal-stat-label">Walk Forward</div><div class="medal-stat-value">' + (m.walk_forward_ok === true ? 'PASS' : m.walk_forward_ok === false ? 'FAIL' : '—') + '</div></div>' +
                '</div>';
        }

        return (
            '<div class="medal-modal-header ' + escapeHtml(m.medal) + '">' +
                '<div class="medal-modal-emoji">' + escapeHtml(m.emoji) + '</div>' +
                '<div class="medal-modal-rank">' + escapeHtml(m.label) + '</div>' +
                '<div class="medal-modal-title">' + escapeHtml(m.display_name) + '</div>' +
                '<div class="medal-modal-version">' + escapeHtml(m.codename) + ' · version ' + escapeHtml(m.version) + '</div>' +
                taglineHtml +
            '</div>' +

            '<div class="medal-modal-stats">' +
                '<div class="medal-stat"><div class="medal-stat-label">6-day Score</div><div class="medal-stat-value" style="color:var(--green);">' + Number(m.score).toLocaleString() + '</div></div>' +
                '<div class="medal-stat"><div class="medal-stat-label">Macro Regime</div><div class="medal-stat-value">' + escapeHtml(m.macro_regime) + '</div></div>' +
                '<div class="medal-stat"><div class="medal-stat-label">BTC Bias</div><div class="medal-stat-value">' + escapeHtml(m.btc_bias) + '</div></div>' +
                '<div class="medal-stat"><div class="medal-stat-label">Crowned</div><div class="medal-stat-value">' + timeAgo(m.crowned_ts) + '</div></div>' +
            '</div>' +

            perfHtml +

            originHtml +

            '<div class="medal-section">' +
                '<div class="medal-section-title">🧠 Hypothesis (Strategy Author Notes)</div>' +
                '<div class="medal-thesis-full">' + thesisHtml + '</div>' +
            '</div>' +

            '<div class="medal-section">' +
                '<div class="medal-section-title">🔥 Entry Logic - How It Triggers</div>' +
                entryHtml +
            '</div>' +

            '<div class="medal-section">' +
                '<div class="medal-section-title">🛡️ Pre-Filter - What It Refuses To Trade</div>' +
                preFilterHtml +
            '</div>' +

            '<div class="medal-section">' +
                '<div class="medal-section-title">⚡ Exit & Position Management</div>' +
                exitHtml +
            '</div>' +

            '<div class="medal-section">' +
                '<div class="medal-section-title">🧠 Senior Agent Protocol (Karpathy-Standard)</div>' +
                '<div class="medal-protocol-grid">' +
                    '<div class="medal-protocol-card">' +
                        '<div class="medal-protocol-title">1. Think Before Coding</div>' +
                        '<div class="medal-protocol-desc">Explicit reasoning over silent assumptions. Every strike is preceded by a cognitive deliberation pass to surface ambiguity.</div>' +
                    '</div>' +
                    '<div class="medal-protocol-card">' +
                        '<div class="medal-protocol-title">2. Simplicity First</div>' +
                        '<div class="medal-protocol-desc">Anti-overengineering bias. Prefer 100 lines of simple logic over complex abstractions. Zero speculative features.</div>' +
                    '</div>' +
                    '<div class="medal-protocol-card">' +
                        '<div class="medal-protocol-title">3. Surgical Changes</div>' +
                        '<div class="medal-protocol-desc">Operational precision. Edits only the necessary state; no drive-by refactoring of unrelated market context.</div>' +
                    '</div>' +
                    '<div class="medal-protocol-card">' +
                        '<div class="medal-protocol-title">4. Goal-Driven Execution</div>' +
                        '<div class="medal-protocol-desc">Verification autonomy. Success is defined by declarative criteria and independently verified via test-first loops.</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div class="medal-section">' +
                '<div class="medal-section-title">🧬 DNA Parameters</div>' +
                dnaHtml +
            '</div>' +

            '<div class="medal-section">' +
                '<div class="medal-section-title">📊 Streamline Features Used</div>' +
                '<div class="medal-feature-grid">' + featuresHtml + '</div>' +
            '</div>'
        );
    }

    function openDetail(rank) {
        if (!lastData || !lastData.medalists) return;
        var m = lastData.medalists.find(function(x) { return x.rank === rank; });
        if (!m) return;
        modalContent.innerHTML = renderModal(m);
        modal.scrollTop = 0;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeDetail() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    grid.addEventListener('click', function(e) {
        var card = e.target.closest('.medal-card');
        if (!card) return;
        var rank = parseInt(card.getAttribute('data-rank'), 10);
        openDetail(rank);
    });
    if (modalClose) modalClose.addEventListener('click', closeDetail);
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeDetail();
    });

    async function fetchMedalists() {
        try {
            var res = await (typeof fcFetch === 'function' ? fcFetch('/api/swarm_medalists') : fetch('/api/swarm_medalists'));
            var d = await res.json();
            lastData = d;
            if (!d.medalists || d.medalists.length === 0) {
                grid.innerHTML = '<div class="medal-empty-state"><h2>No champions in the Hall of Fame yet.</h2><p>The swarm has not crowned a champion. Check back after the next 48-hour evolution cycle.</p></div>';
                if (liveMeta) liveMeta.textContent = 'Hall of Fame empty';
                return;
            }
            grid.innerHTML = d.medalists.map(renderCard).join('');
            if (liveMeta) {
                liveMeta.textContent = d.medalists.length + ' medalists shown · ' + (d.total_in_hof || d.medalists.length) + ' total in Hall of Fame · auto-refresh 60s';
            }
        } catch (e) {
            grid.innerHTML = '<div class="medal-empty-state"><h2>Hall of Fame unavailable.</h2><p>Could not reach the swarm API. Check your connection and refresh.</p></div>';
            if (liveMeta) liveMeta.textContent = 'Connection error - retrying';
        }
    }

    fetchMedalists();
    setInterval(fetchMedalists, 60000);
})();
