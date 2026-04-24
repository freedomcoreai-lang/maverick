/* video-banner.js — scroll-triggered banner video with audio unmute.
   CSP-safe: no inline JS, no eval, self-hosted only.

   Behaviour:
     - Autoplay muted as soon as the banner scrolls into view (browser-allowed).
     - Pause + mute when scrolled out of view (save battery, reset).
     - Floating sound button over the video — tap to unmute/mute. User
       preference persists in localStorage so audio sticks across visits.
     - playsinline so iOS doesn't hijack fullscreen.
*/
(function () {
  'use strict';
  var STORE_KEY = 'fc_video_banner_unmuted';

  function init() {
    var wrap = document.querySelector('.hero-banner[data-video="1"]');
    if (!wrap) return;
    var video = wrap.querySelector('video');
    var btn = wrap.querySelector('.video-sound-btn');
    if (!video || !btn) return;

    // Hint from last visit. Video still STARTS muted — autoplay policy requires it.
    var userUnmuted = false;
    try { userUnmuted = localStorage.getItem(STORE_KEY) === '1'; } catch (e) {}

    function updateBtn() {
      var muted = video.muted || video.volume === 0;
      btn.setAttribute('aria-pressed', muted ? 'false' : 'true');
      btn.setAttribute('aria-label', muted ? 'Unmute banner audio' : 'Mute banner audio');
      btn.classList.toggle('muted', muted);
      btn.innerHTML = muted
        ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" opacity="0.45"/><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2.2"/></svg>'
        : '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      video.muted = !video.muted;
      if (!video.muted) video.volume = 1;
      try { localStorage.setItem(STORE_KEY, video.muted ? '0' : '1'); } catch (e) {}
      // If browser paused us (rare), kick it off again on user gesture.
      if (video.paused) video.play().catch(function () {});
      updateBtn();
    });

    // IntersectionObserver — scroll-triggered play/pause.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          video.play().catch(function () { /* autoplay blocked; user must tap */ });
          // First entry after a prior unmute → honour that preference.
          if (userUnmuted && video.muted) {
            video.muted = false;
            updateBtn();
          }
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.25 });
    io.observe(wrap);

    video.addEventListener('volumechange', updateBtn);
    updateBtn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
