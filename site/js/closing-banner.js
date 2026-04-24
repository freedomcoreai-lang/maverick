/* closing-banner.js — Injects the MAVERICK video closing-banner block above
   the footer on every page that loads this script. Single source of truth;
   update here and it changes site-wide.

   Usage: add <script src="/js/closing-banner.js" defer></script> before </body>
   on any page that should get the banner. A <footer> element is required —
   the banner is inserted just before it.
*/
(function () {
  'use strict';

  function buildBanner() {
    var section = document.createElement('section');
    section.className = 'closing-banner';
    section.setAttribute('data-component', 'closing-banner');
    section.style.cssText = 'padding:70px 24px 50px; position:relative; z-index:2;';
    section.innerHTML =
      '<div style="max-width:900px; margin:0 auto; text-align:center;">' +
        '<div style="font-family:\'JetBrains Mono\',monospace; font-size:0.65rem; color:var(--green); letter-spacing:3px; text-transform:uppercase; margin-bottom:12px;">// One AI. Real capital. Live.</div>' +
        '<h2 style="font-size:clamp(1.6rem, 4vw, 2.4rem); font-weight:800; letter-spacing:-1px; margin-bottom:16px; line-height:1.1;">The experiment in motion.</h2>' +
        '<p style="font-size:0.95rem; line-height:1.7; color:var(--text-dim); max-width:640px; margin:0 auto 30px;">' +
          'No staged renders, no stock footage. Every move you see &mdash; your move. The AI self-audits, rewrites, fires. You hold the seat.' +
        '</p>' +
        '<div class="hero-banner" data-video="1" style="position:relative; border-radius:16px; overflow:hidden; border:1px solid var(--border); box-shadow:0 4px 60px rgba(62,168,245,0.10);">' +
          '<video src="/img/grok-banner.mp4" poster="/img/maverick-banner.jpg" preload="metadata" muted loop playsinline webkit-playsinline style="width:100%;height:auto;display:block;" aria-label="FreedomCore animated banner"></video>' +
          '<button type="button" class="video-sound-btn" aria-label="Unmute banner audio" aria-pressed="false" style="position:absolute;bottom:14px;right:14px;width:40px;height:40px;border-radius:50%;background:rgba(10,15,24,0.78);color:#4ecdc4;border:1px solid rgba(78,205,196,0.5);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;box-shadow:0 2px 14px rgba(0,0,0,0.3);z-index:3;"></button>' +
        '</div>' +
        '<div style="display:flex; gap:14px; justify-content:center; margin-top:28px; flex-wrap:wrap;">' +
          '<a href="/pages/access.html" class="btn-primary">Watch it live &rarr;</a>' +
          '<a href="/pages/architecture.html" class="btn-outline">How it works</a>' +
        '</div>' +
      '</div>';
    return section;
  }

  function init() {
    // Don't duplicate if already present (e.g., index.html inlines it)
    if (document.querySelector('[data-component="closing-banner"]')) return;
    // Also don't duplicate if a <section> with a video at /img/grok-banner.mp4 already exists
    if (document.querySelector('video[src*="grok-banner.mp4"]')) return;

    var footer = document.querySelector('footer.footer, footer');
    if (!footer) {
      document.body.appendChild(buildBanner());
    } else {
      footer.parentNode.insertBefore(buildBanner(), footer);
    }

    // video-banner.js already handles scroll-trigger + sound-toggle for any
    // .hero-banner[data-video="1"] element, so we rely on that being loaded
    // on the same page. If missing, the video still works via <video autoplay muted>.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
