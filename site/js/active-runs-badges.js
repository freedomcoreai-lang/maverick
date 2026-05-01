/* active-runs-badges.js — flip swarm-terminal tabs into "RUNNING NOW" state
 * whenever something is actively in chamber. Polls /api_data/active_runs.json
 * (refreshed every 30s by the fc-active-runs systemd timer).
 *
 * Operator 2026-05-01: 'if anything runs, it needs to be shown as running
 * inside the swarm terminal sections'. This is the consumer side.
 *
 * Tab match key is the data-agent attribute on .swarm-feed-tab buttons.
 * The producer maps tasks to tabs via TAB_FOR_TASK in the probe script.
 */
(function () {
    'use strict';

    var FEED_URL = '/api_data/active_runs.json';
    var POLL_MS = 30000;

    function fmtElapsed(sec) {
        if (sec == null || sec < 0) return 'in chamber';
        if (sec < 90) return 'live · ' + sec + 's in';
        var m = Math.floor(sec / 60);
        if (m < 60) return 'live · ' + m + 'm in';
        var h = Math.floor(m / 60);
        var mm = m % 60;
        return 'live · ' + h + 'h' + (mm ? ' ' + mm + 'm' : '') + ' in';
    }

    function applyBadges(payload) {
        var active = (payload && payload.active_runs) ? payload.active_runs : [];
        var byTab = {};
        active.forEach(function (run) {
            if (!run || !run.tab) return;
            byTab[run.tab] = run;
        });

        // Reset every tab back to its declared (countdown / static) state
        document.querySelectorAll('.swarm-feed-tab').forEach(function (btn) {
            btn.classList.remove('is-running');
            btn.removeAttribute('data-running');
        });

        // Stamp the matched tabs
        Object.keys(byTab).forEach(function (tab) {
            var run = byTab[tab];
            var btn = document.querySelector('.swarm-feed-tab[data-agent="' + tab + '"]');
            if (!btn) return;
            btn.classList.add('is-running');
            btn.setAttribute('data-running', '1');

            // Replace timer text with the live state. Keep the .agent-countdown
            // class but blank the text — let the existing countdown renderer
            // skip when [data-running] is set.
            var timer = btn.querySelector('.swarm-feed-tab__timer');
            if (timer) {
                timer.textContent = fmtElapsed(run.elapsed_sec) +
                    (run.rounds_label ? ' · ' + run.rounds_label : '');
            }
            var name = btn.querySelector('.swarm-feed-tab__name');
            if (name && !name.dataset.origText) name.dataset.origText = name.textContent;
            // Add a discrete pulse dot
            if (!btn.querySelector('.fc-running-dot')) {
                var dot = document.createElement('span');
                dot.className = 'fc-running-dot';
                btn.insertBefore(dot, btn.firstChild);
            }
        });

        // Tabs that are NOT running — if we previously injected a dot, clear it
        document.querySelectorAll('.swarm-feed-tab:not([data-running]) .fc-running-dot').forEach(function (n) {
            n.remove();
        });
    }

    function applyPanelStates(payload) {
        // The panel header has <span class="swarm-feed-panel__state" data-state="live">.
        // When something is running, paint the matched panel's state pill green.
        var active = (payload && payload.active_runs) ? payload.active_runs : [];
        var runningTabs = {};
        active.forEach(function (run) { if (run && run.tab) runningTabs[run.tab] = run; });

        document.querySelectorAll('.swarm-feed-panel').forEach(function (panel) {
            var tab = panel.getAttribute('data-agent');
            var state = panel.querySelector('.swarm-feed-panel__state');
            if (!state) return;
            if (runningTabs[tab]) {
                state.setAttribute('data-state', 'live');
                state.title = (runningTabs[tab].title || 'Active') + ' · ' +
                    fmtElapsed(runningTabs[tab].elapsed_sec);
            }
        });
    }

    function poll() {
        fetch(FEED_URL, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (payload) {
                if (!payload) return;
                applyBadges(payload);
                applyPanelStates(payload);
            })
            .catch(function () { /* silent */ });
    }

    // Inject minimal CSS for the running indicator. Doesn't depend on any
    // existing class — defensive injection so it works on any page.
    var css = document.createElement('style');
    css.textContent = '' +
        '.swarm-feed-tab.is-running { box-shadow: 0 0 0 1px rgba(34,197,94,0.45) inset, 0 0 18px rgba(34,197,94,0.18); }\n' +
        '.swarm-feed-tab.is-running .swarm-feed-tab__name { color: #22c55e; }\n' +
        '.swarm-feed-tab.is-running .swarm-feed-tab__timer { color: #22c55e; font-weight: 700; }\n' +
        '.fc-running-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e; margin-right: 7px; animation: fc-running-pulse 1.6s ease-in-out infinite; vertical-align: middle; }\n' +
        '@keyframes fc-running-pulse { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: 0.55; transform: scale(0.8);} }\n';
    document.head.appendChild(css);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', poll);
    } else { poll(); }
    setInterval(poll, POLL_MS);

    // Also expose for the council page
    window.fcActiveRuns = { poll: poll };
})();
