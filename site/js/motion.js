/* motion.js — universal motion layer placeholder.
 *
 * Sister sites (shadow / arena / quantum) reference this file via <script src="/js/motion.js" defer>.
 * The original GSAP/ScrollTrigger build is not on this VPS, so this shim
 * just no-ops to silence the 404s and lets the existing CSS-based
 * smooth-scroll (`html { scroll-behavior: smooth }` in style.css) carry
 * the experience.
 *
 * If a richer motion layer is wanted later, replace this stub with the
 * full GSAP build — every consumer page already loads /js/motion.js so
 * the upgrade is one file swap, no HTML changes.
 */
(function () {
  'use strict';
  // Native CSS smooth-scroll is already applied via tokens.css/style.css.
  // We expose a tiny helper for any consumer that wants a smooth jump
  // without depending on jQuery / GSAP, matching the call sites in
  // /js/app.js (target.scrollIntoView, window.scrollTo).
  window.fcMotion = {
    scrollTo(selectorOrEl, opts) {
      const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start', ...opts });
    },
    toTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  };
})();
