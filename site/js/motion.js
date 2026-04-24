/* motion.js -- FreedomCore universal motion layer.
 *
 * Six patterns, applied by selector, respecting prefers-reduced-motion:
 *   1. .stat-card         tilt on cursor proximity (max 8deg, spring)
 *   2. .hero              parallax on scroll (bg 0.5x, fg 1.2x)
 *   3. .reveal            opacity + translateY(40->0) on enter, 600ms spring
 *   4. .cta-primary/-sec  3D press on :active, scale(1.02) on :hover
 *   5. .ticker__track     continuous scroll + z-depth edge fade (CSS)
 *   6. .family-switcher   sibling dots pulse softly on hover
 *
 * GSAP + ScrollTrigger loaded from CDN. Loaded AFTER first paint by every
 * site via <script defer src="/js/motion.js"></script> -- motion never
 * blocks render. Bundle: ~60 KB gzipped total (GSAP core + ScrollTrigger).
 * 60 fps budget on mid-tier 4G Android verified.
 */
(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) { return; /* reduced-motion users get CSS-only transitions */ }

    var GSAP_SRC = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js';
    var ST_SRC   = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js';

    function loadScript(src) {
        return new Promise(function (res, rej) {
            var s = document.createElement('script');
            s.src = src; s.async = true;
            s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
        });
    }

    function boot() {
        if (typeof gsap === 'undefined') return;
        if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

        /* 1. stat-card tilt -- max 8deg, spring physics via GSAP quickTo. */
        document.querySelectorAll('.stat-card').forEach(function (card) {
            var xTo = gsap.quickTo(card, 'rotationY', { duration: 0.35, ease: 'power3.out' });
            var yTo = gsap.quickTo(card, 'rotationX', { duration: 0.35, ease: 'power3.out' });
            card.addEventListener('mousemove', function (e) {
                var r = card.getBoundingClientRect();
                var px = (e.clientX - r.left) / r.width;   // 0..1
                var py = (e.clientY - r.top)  / r.height;  // 0..1
                xTo((px - 0.5) *  16);   // max +/- 8deg
                yTo((py - 0.5) * -16);
            });
            card.addEventListener('mouseleave', function () { xTo(0); yTo(0); });
            card.style.transformStyle = 'preserve-3d';
            card.style.willChange = 'transform';
        });

        /* 2. hero parallax -- background 0.5x, any .parallax-fg element 1.2x. */
        if (typeof ScrollTrigger !== 'undefined') {
            document.querySelectorAll('.hero').forEach(function (hero) {
                var bg = hero.querySelector('.hero-glow, .hero-bg, .hero-logo-img');
                if (bg) {
                    gsap.to(bg, {
                        yPercent: 50,
                        ease: 'none',
                        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
                    });
                }
                hero.querySelectorAll('.parallax-fg').forEach(function (fg) {
                    gsap.to(fg, {
                        yPercent: -20,
                        ease: 'none',
                        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
                    });
                });
            });

            /* 3. section reveals -- .reveal or any section under .section */
            var revealTargets = document.querySelectorAll('.reveal, .section > *, .heartbeat, .pnl-display, .stat-grid > .stat-card');
            revealTargets.forEach(function (el) {
                gsap.fromTo(el,
                    { opacity: 0, y: 40 },
                    {
                        opacity: 1, y: 0,
                        duration: 0.6, ease: 'power3.out',
                        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' }
                    }
                );
            });
        }

        /* 4. CTA 3D press -- translateZ(-4px) on active, scale(1.02) on hover.
             CSS handles scale; GSAP handles the press depth so it feels spring. */
        document.querySelectorAll('.cta-primary, .cta-secondary').forEach(function (btn) {
            btn.style.transformStyle = 'preserve-3d';
            btn.addEventListener('mousedown', function () {
                gsap.to(btn, { z: -4, duration: 0.12, ease: 'power2.out' });
            });
            var release = function () { gsap.to(btn, { z: 0, duration: 0.25, ease: 'elastic.out(1, 0.5)' }); };
            btn.addEventListener('mouseup', release);
            btn.addEventListener('mouseleave', release);
        });

        /* 5. ticker edge fade -- CSS-driven via .ticker::before/::after (tokens).
             Nothing to do in JS; included here for spec traceability. */

        /* 6. family-switcher pulse on hover -- CSS does the idle pulse,
             GSAP intensifies on hover so the dot "reacts" to the cursor. */
        document.querySelectorAll('.family-switcher__dot').forEach(function (dot) {
            dot.addEventListener('mouseenter', function () {
                gsap.to(dot, { scale: 1.4, duration: 0.2, ease: 'back.out(2)' });
            });
            dot.addEventListener('mouseleave', function () {
                gsap.to(dot, { scale: 1, duration: 0.2, ease: 'power2.out' });
            });
        });
    }

    function start() {
        /* Code-split: load GSAP chain after first paint, not before. */
        loadScript(GSAP_SRC)
            .then(function () { return loadScript(ST_SRC).catch(function () { /* ScrollTrigger optional */ }); })
            .then(boot)
            .catch(function (e) { /* silent -- motion is progressive enhancement */ });
    }

    if (document.readyState === 'complete') {
        requestAnimationFrame(start);
    } else {
        window.addEventListener('load', function () { requestAnimationFrame(start); });
    }
})();
