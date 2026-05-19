/* FREEDOMCORE FUSION CORE — interactive drag-to-spin behaviour.
   Lifted verbatim from the inline <script> on /var/www/freedomcore-hub/index.html
   (the canonical hub implementation). One file, copied to every site's /js/.
   Looks for #fc-core / #fc-orbiters / #fc-fieldlines on the page. */
(function () {
  const wrap       = document.getElementById('fc-core');
  const orbiters   = document.getElementById('fc-orbiters');
  const fieldlines = document.getElementById('fc-fieldlines');
  if (!wrap || !orbiters) return;
  const nodes = Array.from(orbiters.querySelectorAll('.core-node'));

  let rotation = 0;
  const baseSpeed = 0.0028;
  let manualMomentum = 0;
  let isDragging = false;
  let lastDragAngle = 0;
  let lastDragTime  = 0;
  let velocity = 0;
  let downX = 0, downY = 0;
  let downedNode = null;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function placeNodes() {
    const radius = 44;
    nodes.forEach(node => {
      const baseDeg = parseFloat(node.dataset.baseAngle || '0');
      const a = (baseDeg * Math.PI / 180) + rotation;
      const x = 50 + radius * Math.cos(a - Math.PI / 2);
      const y = 50 + radius * Math.sin(a - Math.PI / 2);
      node.style.left = x + '%';
      node.style.top  = y + '%';
    });
    if (fieldlines) {
      fieldlines.style.transform = 'rotate(' + (rotation * 180 / Math.PI) + 'deg)';
    }
  }

  function step() {
    if (!isDragging && !reducedMotion) {
      rotation += baseSpeed + manualMomentum;
      manualMomentum *= 0.94;
      if (Math.abs(manualMomentum) < 1e-5) manualMomentum = 0;
    }
    placeNodes();
    requestAnimationFrame(step);
  }

  placeNodes();
  if (!reducedMotion) requestAnimationFrame(step);

  function angleFromCentre(clientX, clientY) {
    const rect = wrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx);
  }

  wrap.addEventListener('pointerdown', (e) => {
    isDragging = true;
    wrap.classList.add('is-dragging');
    lastDragAngle = angleFromCentre(e.clientX, e.clientY);
    lastDragTime  = performance.now();
    velocity = 0;
    downX = e.clientX; downY = e.clientY;
    downedNode = e.target.closest('.core-node');
    try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
  });

  wrap.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const a = angleFromCentre(e.clientX, e.clientY);
    let delta = a - lastDragAngle;
    while (delta > Math.PI)  delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    rotation += delta;
    const now = performance.now();
    const dt = Math.max(1, now - lastDragTime);
    velocity = delta / dt;
    lastDragAngle = a;
    lastDragTime  = now;
  });

  function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    wrap.classList.remove('is-dragging');
    manualMomentum = velocity * 16;
    velocity = 0;
    try { wrap.releasePointerCapture(e.pointerId); } catch (_) {}
  }

  wrap.addEventListener('pointerup', endDrag);
  wrap.addEventListener('pointercancel', endDrag);
  wrap.addEventListener('pointerleave', endDrag);

  nodes.forEach(node => {
    node.addEventListener('click', (e) => {
      if (downedNode !== node) return;
      const dx = e.clientX - downX, dy = e.clientY - downY;
      // 14px threshold — phone taps drift further than 6px.
      if (dx * dx + dy * dy > 196) e.preventDefault();
    });
  });
})();
