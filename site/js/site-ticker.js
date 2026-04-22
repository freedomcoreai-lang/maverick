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

    function fetchAndRender() {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', ENDPOINT, true);
            xhr.setRequestHeader('X-API-Key', API_KEY);
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        render(data.items || []);
                    } catch (e) {
                        track.innerHTML = '<div class="ticker-item">Headlines format error.</div>';
                    }
                } else {
                    track.innerHTML = '<div class="ticker-item">Headlines connecting... (HTTP ' + xhr.status + ')</div>';
                }
            };
            xhr.send();
        } catch (e) {
            track.innerHTML = '<div class="ticker-item">Headlines offline.</div>';
        }
    }

    fetchAndRender();
    setInterval(fetchAndRender, 300000);
})();
