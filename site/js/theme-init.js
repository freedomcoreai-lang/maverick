/* theme-init.js - runs synchronously in <head> BEFORE any rendering.
   Reads localStorage and sets data-theme on <html> so the page paints in the
   correct mode immediately. Without this, the page renders dark first
   (because <html data-theme="dark"> is hardcoded), then app.js loads at the
   bottom of the body and flips to light, causing a black flash in light mode. */
(function() {
    try {
        var saved = localStorage.getItem('fc-theme');
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
        // localStorage blocked or unavailable - leave the hardcoded data-theme alone.
    }
})();
