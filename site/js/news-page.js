/* news-page.js — replaces the dead "Loading headlines" scroll inside the
 * Market News page with tabbed article cards. Each source gets its own
 * tab; each article is a card with title, paragraph snippet, source
 * badge, time ago, and an outbound "Read article →" link.
 *
 * Kept CSP-safe (script-src 'self', no inline handlers). Delegated
 * click listener on the tab row handles active-state swapping.
 */
(function () {
    'use strict';

    const FC_API_KEY = (typeof FC_API_HEADERS === 'object' && FC_API_HEADERS['X-API-Key'])
        || 'fcweb_60fd94aa2d910f38a9f3e0557076791a';

    function apiFetch(u, o) {
        o = Object.assign({ credentials: 'same-origin' }, o || {});
        o.headers = (typeof window.fcMergeHeaders === 'function')
            ? window.fcMergeHeaders(o.headers)
            : Object.assign({ 'X-API-Key': FC_API_KEY }, o.headers || {});
        return fetch(u, o);
    }

    const tabsEl = document.getElementById('news-tabs');
    const gridEl = document.getElementById('news-articles');
    if (!tabsEl || !gridEl) return;

    let allItems = [];
    let currentSource = 'all';

    function esc(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function timeAgo(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const mins = Math.floor((now - d) / 60000);
        if (isNaN(mins) || mins < 0) return '';
        if (mins < 60) return mins + 'm ago';
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + 'h ago';
        return Math.floor(hrs / 24) + 'd ago';
    }

    function sourceSlug(name) {
        return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    // Colour accent per source — keeps the look distinct without being gaudy
    const sourceAccent = {
        'coindesk':         '#f5a623',
        'cointelegraph':    '#3ea8f5',
        'decrypt':          '#b967ff',
        'bitcoin-magazine': '#f7931a'
    };

    function buildTabs(sources) {
        let html = '<button class="news-tab active" data-src="all" type="button">All <span class="news-tab-count">' + allItems.length + '</span></button>';
        sources.forEach(function (s) {
            const slug = sourceSlug(s);
            const count = allItems.filter(function (it) { return sourceSlug(it.source) === slug; }).length;
            html += '<button class="news-tab" data-src="' + esc(slug) + '" type="button">' + esc(s) + ' <span class="news-tab-count">' + count + '</span></button>';
        });
        tabsEl.innerHTML = html;
    }

    function renderArticles() {
        const filtered = currentSource === 'all'
            ? allItems
            : allItems.filter(function (it) { return sourceSlug(it.source) === currentSource; });

        if (!filtered.length) {
            gridEl.innerHTML = '<div class="news-empty">No articles from this source right now. Check back in a few minutes.</div>';
            return;
        }

        gridEl.innerHTML = filtered.map(function (item) {
            const accent = sourceAccent[sourceSlug(item.source)] || 'var(--accent)';
            const title = (item.title || '').replace(/[—–]/g, ',');
            const desc  = (item.desc  || '').replace(/[—–]/g, ',');
            const snippet = desc ? (desc.length > 260 ? desc.slice(0, 260).trim() + '…' : desc)
                                 : 'Tap to read the full article on ' + (item.source || 'source') + '.';
            return '<a class="news-article" href="' + esc(item.link || '#') + '" target="_blank" rel="noopener noreferrer"' +
                   ' style="border-left-color:' + accent + ';">' +
                '<div class="news-article-head">' +
                    '<span class="news-article-source" style="color:' + accent + ';border-color:' + accent + ';">' + esc(item.source || 'Source') + '</span>' +
                    '<span class="news-article-time">' + esc(timeAgo(item.date)) + '</span>' +
                '</div>' +
                '<div class="news-article-title">' + esc(title) + '</div>' +
                '<div class="news-article-snippet">' + esc(snippet) + '</div>' +
                '<div class="news-article-footer">Read on ' + esc(item.source || 'source') + ' →</div>' +
            '</a>';
        }).join('');
    }

    // Delegated tab click — CSP-safe
    tabsEl.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-src]');
        if (!btn) return;
        currentSource = btn.getAttribute('data-src');
        const tabs = tabsEl.querySelectorAll('.news-tab');
        for (let i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i] === btn);
        renderArticles();
    });

    async function load() {
        try {
            const r = await apiFetch('/api/news');
            const d = await r.json();
            allItems = Array.isArray(d.items) ? d.items : [];

            const seen = [];
            const ordered = ['CoinDesk', 'CoinTelegraph', 'Decrypt', 'Bitcoin Magazine'];
            allItems.forEach(function (it) {
                const s = it.source || 'Source';
                if (seen.indexOf(s) === -1) seen.push(s);
            });
            const sourcesInOrder = ordered.filter(function (s) { return seen.indexOf(s) !== -1; })
                .concat(seen.filter(function (s) { return ordered.indexOf(s) === -1; }));

            buildTabs(sourcesInOrder);
            renderArticles();
        } catch (e) {
            gridEl.innerHTML = '<div class="news-empty">News feed unreachable. Retrying shortly.</div>';
        }
    }

    load();
    setInterval(load, 300000); // 5 min
})();
