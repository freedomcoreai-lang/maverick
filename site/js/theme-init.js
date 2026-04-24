/* theme-init.js — runs synchronously in <head> BEFORE any rendering.
   Reads the unified localStorage key and sets data-theme on <html> so the
   page paints in the correct mode immediately. Without this, the page
   renders dark first (because <html data-theme="dark"> is hardcoded), then
   app.js flips to light, causing a black flash in light mode.

   Key migration (2026-04-24):
     - canonical key is 'freedomcore-theme'
     - legacy keys 'fc-theme' (MAVERICK) and 'shadow-theme' (SHADOW) are
       read once on load, migrated, then deleted. */
(function() {
    try {
        var KEY = 'freedomcore-theme';
        var LEGACY = ['fc-theme', 'shadow-theme'];
        var saved = localStorage.getItem(KEY);

        // One-time migration from legacy keys — highest-priority legacy wins.
        if (!saved) {
            for (var i = 0; i < LEGACY.length; i++) {
                var legacyVal = localStorage.getItem(LEGACY[i]);
                if (legacyVal === 'light' || legacyVal === 'dark') {
                    saved = legacyVal;
                    localStorage.setItem(KEY, saved);
                    break;
                }
            }
            // Purge every legacy key regardless, so we never migrate twice.
            for (var j = 0; j < LEGACY.length; j++) {
                localStorage.removeItem(LEGACY[j]);
            }
        }

        var theme;
        if (saved === 'light' || saved === 'dark') {
            theme = saved;
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            theme = 'light';
        } else {
            theme = 'dark';
        }
        document.documentElement.setAttribute('data-theme', theme);
    } catch(e) {
        // localStorage blocked or unavailable — leave the hardcoded data-theme alone.
    }
})();
