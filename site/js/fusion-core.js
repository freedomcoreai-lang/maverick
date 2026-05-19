/* FreedomCore universal fusion switcher. */
(function () {
  'use strict';

  function initFusionCore(core) {
    var orbiters = core.querySelector('.fusion-orbiters');
    var fieldlines = core.querySelector('.fusion-fieldlines');
    if (!orbiters) return;

    var nodes = Array.prototype.slice.call(orbiters.querySelectorAll('.fusion-node'));
    if (!nodes.length) return;

    var rotation = 0;
    var baseSpeed = 0.0028;
    var manualMomentum = 0;
    var isDragging = false;
    var lastDragAngle = 0;
    var lastDragTime = 0;
    var velocity = 0;
    var downX = 0;
    var downY = 0;
    var downedNode = null;
    var reducedMotion = false;

    try {
      reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {}

    function placeNodes() {
      var cssRadius = parseFloat(getComputedStyle(core).getPropertyValue('--fusion-radius'));
      var radius = isFinite(cssRadius) ? cssRadius : 44;
      nodes.forEach(function (node) {
        var baseDeg = parseFloat(node.getAttribute('data-base-angle') || '0');
        var a = (baseDeg * Math.PI / 180) + rotation;
        var x = 50 + radius * Math.cos(a - Math.PI / 2);
        var y = 50 + radius * Math.sin(a - Math.PI / 2);
        node.style.left = x + '%';
        node.style.top = y + '%';
      });
      if (fieldlines) {
        fieldlines.style.setProperty('--rot', (rotation * 180 / Math.PI) + 'deg');
      }
    }

    function step() {
      if (!isDragging && !reducedMotion) {
        rotation += baseSpeed + manualMomentum;
        manualMomentum *= 0.94;
        if (Math.abs(manualMomentum) < 1e-5) manualMomentum = 0;
      }
      placeNodes();
      window.requestAnimationFrame(step);
    }

    function angleFromCentre(clientX, clientY) {
      var rect = core.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      return Math.atan2(clientY - cy, clientX - cx);
    }

    core.addEventListener('pointerdown', function (e) {
      isDragging = true;
      core.classList.add('is-dragging');
      lastDragAngle = angleFromCentre(e.clientX, e.clientY);
      lastDragTime = performance.now();
      velocity = 0;
      downX = e.clientX;
      downY = e.clientY;
      downedNode = e.target.closest ? e.target.closest('.fusion-node') : null;
      try { core.setPointerCapture(e.pointerId); } catch (_) {}
    });

    core.addEventListener('pointermove', function (e) {
      if (!isDragging) return;
      var a = angleFromCentre(e.clientX, e.clientY);
      var delta = a - lastDragAngle;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      rotation += delta;
      var now = performance.now();
      var dt = Math.max(1, now - lastDragTime);
      velocity = delta / dt;
      lastDragAngle = a;
      lastDragTime = now;
      placeNodes();
    });

    function endDrag(e) {
      if (!isDragging) return;
      isDragging = false;
      core.classList.remove('is-dragging');
      manualMomentum = velocity * 16;
      velocity = 0;
      try { core.releasePointerCapture(e.pointerId); } catch (_) {}
    }

    core.addEventListener('pointerup', endDrag);
    core.addEventListener('pointercancel', endDrag);
    core.addEventListener('pointerleave', endDrag);

    nodes.forEach(function (node) {
      node.addEventListener('click', function (e) {
        if (downedNode !== node) return;
        var dx = e.clientX - downX;
        var dy = e.clientY - downY;
        // 14px threshold (was 6px) — phone taps drift further than 6px and
        // were getting hijacked as drags, so tapping an orb showed the focus
        // scale animation but never navigated. 14px lets normal taps through.
        if (dx * dx + dy * dy > 196) e.preventDefault();
      });
    });

    placeNodes();
    if (!reducedMotion) window.requestAnimationFrame(step);
  }

  function initAll() {
    Array.prototype.slice.call(document.querySelectorAll('[data-fusion-core]')).forEach(initFusionCore);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
