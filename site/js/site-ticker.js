/* site-ticker.js - self-contained global news ticker that appears on every page.
 * Attaches nothing, polls /api/news every 5 min, populates #ticker-track.
 * Independent of app.js so sub-page issues can't break it.
 */
(function () {
    'use strict';
    var track = document.getElementById('ticker-track');
    if (!track) return;

    var API_KEY = 'fcweb_60fd94aa2d910f38a9f3e0557076791a';
    var ENDPOINT = '/api/news';

    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function render(items) {
        if (!items || !items.length) {
            track.innerHTML = '<div class="ticker-item">No headlines right now.</div>';
            return;
        }
        var itemHtml = function (item) {
            var cls = 'crypto';
            if (item.source && item.source.indexOf('BBC') !== -1) cls = 'world';
            return (
                '<div class="ticker-item ' + cls + '">' +
                '<span class="ticker-source">' + esc(item.source || '') + '</span>' +
                '<a href="' + esc(item.link || '#') + '" target="_blank" rel="noopener">' +
                esc(item.title || '') +
                '</a>' +
                '</div>'
            );
        };
        // Duplicate for seamless infinite loop
        var html = '';
        items.forEach(function (i) { html += itemHtml(i); });
        items.forEach(function (i) { html += itemHtml(i); });
        track.innerHTML = html;
    }

    /* Hide the whole ticker bar rather than leaving it stuck on
       "Headlines connecting..." when /api/news isn't routed on a given
       subdomain (QUANTUM, SHADOW, ARENA share this ticker but only
       MAVERICK proxies /api/news). Fixes the "hanging connecting
       indicator" phone-verification bug. */
    function hideTicker() {
        var bar = document.getElementById('site-ticker');
        if (bar) bar.style.display = 'none';
    }

    function fetchAndRender() {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', ENDPOINT, true);
            xhr.setRequestHeader('X-API-Key', API_KEY);
            xhr.timeout = 5000;
            xhr.ontimeout = hideTicker;
            xhr.onerror = hideTicker;
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        if (!data || !data.items || !data.items.length) { hideTicker(); return; }
                        render(data.items);
                    } catch (e) {
                        hideTicker();
                    }
                } else {
                    hideTicker();
                }
            };
            xhr.send();
        } catch (e) {
            hideTicker();
        }
    }

    fetchAndRender();
    setInterval(fetchAndRender, 300000);
})();
