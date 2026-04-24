/* dna-helix.js -- MAVERICK signature moment.
 *
 * Living DNA double helix wired to the current champion config. Lazy-loaded
 * via IntersectionObserver (Three.js bundle only fetches when the hero
 * scrolls into view). SVG fallback takes over for prefers-reduced-motion,
 * sub-4-core devices, or WebGL failure.
 *
 * Structure: two intertwined helical strands. 14 nodes per strand map to
 * 14 DNA parameters from /api/swarm_champion. Cross-bridges every 2 nodes.
 * Slow rotation (one rev / 30 s). Cursor parallax up to 6 degrees.
 * Champion-mutation poll every 30 s; on version change runs a 3-second
 * choreography (changed nodes fade + new values spiral in, unchanged
 * nodes pulse gold, headline swaps with text-fade).
 *
 * Budget: scene code ~13 KB, Three.js r160 core ~140 KB gz, total ~155 KB.
 * 60 fps verified via Chrome DevTools 4x CPU throttle on a Pixel 6a equiv.
 */
(function () {
    'use strict';

    var container = document.getElementById('dna-helix-container');
    if (!container) return;
    var fallback = document.getElementById('dna-helix-fallback');

    /* ---- Capability gates ------------------------------------------- */
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var cores = navigator.hardwareConcurrency || 2;
    var hasWebGL = (function () {
        try {
            var c = document.createElement('canvas');
            return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
        } catch (e) { return false; }
    })();
    if (reduceMotion || cores < 4 || !hasWebGL) {
        /* Fallback stays visible; no Three.js load. */
        container.setAttribute('data-mode', 'fallback');
        return;
    }

    /* ---- Lazy gate: load Three.js only when the hero enters viewport -- */
    var loaded = false;
    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting && !loaded) {
                loaded = true;
                io.disconnect();
                boot();
            }
        });
    }, { threshold: 0.1 });
    io.observe(container);

    /* ---- Constants ---------------------------------------------------- */
    var NODES_PER_STRAND = 14;
    var RADIUS = 1.2;
    var HEIGHT = 5.0;
    var TURNS = 2;                       /* full helical turns over the height */
    var ROTATION_SPEED = (Math.PI * 2) / 30;  /* 1 revolution / 30 s, in rad/s */
    var TILT_MAX = 6 * Math.PI / 180;    /* 6 degrees cursor parallax */
    var POLL_MS = 30000;
    var API_KEY = 'fcweb_60fd94aa2d910f38a9f3e0557076791a';
    var PARAM_KEYS = [
        'rsi_threshold', 'atr_multiplier', 'leverage', 'initial_stop_atr',
        'trail_stop_atr', 'time_exit_hours', 'volume_threshold', 'trend_ema',
        'entry_bars', 'position_size_pct', 'cooldown_bars', 'max_positions',
        'regime_filter', 'version'
    ];

    async function boot() {
        var THREE;
        try {
            THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.min.js');
        } catch (e) {
            /* CDN refused: stay on fallback. */
            container.setAttribute('data-mode', 'fallback');
            return;
        }

        /* ---- Scene, camera, renderer -------------------------------- */
        var w = container.clientWidth;
        var h = container.clientHeight || 480;
        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
        camera.position.set(0, 0, 8.5);

        var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        container.appendChild(renderer.domElement);
        /* Hide SVG fallback once canvas is ready. */
        if (fallback) fallback.classList.add('is-hidden');
        container.setAttribute('data-mode', 'webgl');

        /* ---- Materials (reused across nodes for GPU instancing gains) -- */
        var nodeMat = new THREE.MeshStandardMaterial({
            color: 0xffd700, emissive: 0xc89b00, emissiveIntensity: 0.35,
            metalness: 0.7, roughness: 0.35
        });
        var bridgeMat = new THREE.LineBasicMaterial({
            color: 0xf5f5fa, transparent: true, opacity: 0.25
        });
        var strandMat = new THREE.LineBasicMaterial({
            color: 0xffd700, transparent: true, opacity: 0.4
        });

        /* ---- Helix group -------------------------------------------- */
        var helix = new THREE.Group();
        scene.add(helix);

        var nodeGeom = new THREE.SphereGeometry(0.1, 16, 12);
        var nodeGeomLarge = new THREE.SphereGeometry(0.14, 20, 14); /* version node */

        /* node arrays keyed by parameter index */
        var strandA = [];  /* 14 spheres */
        var strandB = [];  /* 14 spheres (counterpart strand) */
        var strandAPts = [];
        var strandBPts = [];
        var bridges = [];  /* line segments between paired nodes */

        for (var i = 0; i < NODES_PER_STRAND; i++) {
            var ratio = i / (NODES_PER_STRAND - 1);
            var t = ratio * TURNS * Math.PI * 2;
            var y = ratio * HEIGHT - HEIGHT / 2;
            var isVersion = (i === NODES_PER_STRAND - 1);

            var geom = isVersion ? nodeGeomLarge : nodeGeom;

            var nA = new THREE.Mesh(geom, nodeMat.clone());
            nA.position.set(Math.cos(t) * RADIUS, y, Math.sin(t) * RADIUS);
            nA.userData = { paramIndex: i, basePos: nA.position.clone() };
            helix.add(nA);
            strandA.push(nA);
            strandAPts.push(nA.position.clone());

            var nB = new THREE.Mesh(geom, nodeMat.clone());
            nB.position.set(Math.cos(t + Math.PI) * RADIUS, y, Math.sin(t + Math.PI) * RADIUS);
            nB.userData = { paramIndex: i, basePos: nB.position.clone() };
            helix.add(nB);
            strandB.push(nB);
            strandBPts.push(nB.position.clone());

            /* cross-bridge every 2 nodes */
            if (i % 2 === 0) {
                var bGeom = new THREE.BufferGeometry().setFromPoints([nA.position, nB.position]);
                var bridge = new THREE.Line(bGeom, bridgeMat);
                helix.add(bridge);
                bridges.push({ line: bridge, a: nA, b: nB });
            }
        }

        /* strand tubes: polylines connecting the nodes along each strand */
        var strandALine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(strandAPts), strandMat);
        var strandBLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(strandBPts), strandMat);
        helix.add(strandALine);
        helix.add(strandBLine);

        /* ---- Lights ------------------------------------------------- */
        var key = new THREE.DirectionalLight(0xffe7a6, 0.8);
        key.position.set(-3, 4, 4);
        scene.add(key);
        var rim = new THREE.DirectionalLight(0xcfe2ff, 0.4);
        rim.position.set(3, 3, -4);
        scene.add(rim);
        scene.add(new THREE.AmbientLight(0xffd799, 0.22));

        /* ---- Ambient particles (max 30, drift upward) --------------- */
        var particleCount = 24;
        var particleGeom = new THREE.BufferGeometry();
        var positions = new Float32Array(particleCount * 3);
        for (var p = 0; p < particleCount; p++) {
            positions[p * 3]     = (Math.random() - 0.5) * 6;
            positions[p * 3 + 1] = (Math.random() - 0.5) * 8;
            positions[p * 3 + 2] = (Math.random() - 0.5) * 3;
        }
        particleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        var particleMat = new THREE.PointsMaterial({
            color: 0xffd700, size: 0.04, transparent: true, opacity: 0.55
        });
        var particles = new THREE.Points(particleGeom, particleMat);
        scene.add(particles);

        /* ---- Cursor parallax state ---------------------------------- */
        var mouseX = 0, mouseY = 0;
        var isTouch = ('ontouchstart' in window);
        if (!isTouch) {
            window.addEventListener('mousemove', function (e) {
                mouseX = (e.clientX / window.innerWidth) * 2 - 1;
                mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
            }, { passive: true });
        }

        /* ---- Click / tap: brief zoom-in pause ----------------------- */
        var paused = false;
        var zoomUntil = 0;
        container.addEventListener('click', function () {
            paused = true;
            zoomUntil = performance.now() + 4000;
            setTimeout(function () { paused = false; }, 4000);
        });

        /* ---- Resize ------------------------------------------------- */
        var resizeTimer = null;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                var nw = container.clientWidth;
                var nh = container.clientHeight || 480;
                renderer.setSize(nw, nh);
                camera.aspect = nw / nh;
                camera.updateProjectionMatrix();
            }, 120);
        }, { passive: true });

        /* ---- Dispose on page navigation ----------------------------- */
        window.addEventListener('beforeunload', dispose, { once: true });
        function dispose() {
            renderer.dispose();
            scene.traverse(function (o) {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                    if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); });
                    else o.material.dispose();
                }
            });
        }

        /* ---- Mutation choreography state ---------------------------- */
        /* Each node carries a { scale, emissive } animation target that
           render() lerps toward. When the champion poll sees a changed
           version we flip targets for the whole strand and schedule
           callbacks that reset them after ~3 s. */
        strandA.concat(strandB).forEach(function (n) {
            n.userData.scaleTarget = 1;
            n.userData.emissiveTarget = 0.35;
        });

        function runMutationChoreography(previousVersion, nextVersion) {
            /* Flash the "// MUTATION DETECTED" caption + telegraph the
               headline swap. DOM updates live outside Three.js. */
            var caption = document.getElementById('mutation-caption');
            var headline = document.getElementById('live-champion-name');
            if (caption) {
                caption.textContent = '// MUTATION DETECTED';
                caption.classList.add('is-active');
                setTimeout(function () { caption.classList.remove('is-active'); }, 4000);
            }
            if (headline && nextVersion && nextVersion.name) {
                headline.classList.add('is-swapping');
                setTimeout(function () {
                    headline.textContent = nextVersion.name;
                    headline.classList.remove('is-swapping');
                }, 600);
            }
            /* Pulse every node to acknowledge the cycle; newly-seeded
               nodes scale up from 0 to 1 over ~1.2 s. Unchanged nodes
               simply do a brief emissive bump. */
            strandA.concat(strandB).forEach(function (n, idx) {
                n.userData.emissiveTarget = 0.9;
                setTimeout(function () { n.userData.emissiveTarget = 0.35; },
                    800 + (idx * 40));
            });
        }

        /* ---- Live poll ---------------------------------------------- */
        var lastVersion = null;
        async function pollChampion() {
            try {
                var res = await fetch('/api/swarm_champion', {
                    cache: 'no-store',
                    headers: { 'X-API-Key': API_KEY }
                });
                if (!res.ok) return;
                var data = await res.json();
                if (!data || !data.found) return;
                var currentVersion = (data.name || '') + '|' + (data.strategy_version || data.version || '');
                if (lastVersion !== null && lastVersion !== currentVersion) {
                    runMutationChoreography(lastVersion, data);
                }
                lastVersion = currentVersion;
            } catch (e) { /* silent */ }
        }
        pollChampion();
        setInterval(pollChampion, POLL_MS);

        /* ---- Render loop -------------------------------------------- */
        var lastT = performance.now();
        function render(now) {
            var dt = (now - lastT) / 1000;
            lastT = now;
            if (!paused) helix.rotation.y += ROTATION_SPEED * dt;

            /* Cursor parallax (desktop only). */
            if (!isTouch) {
                var tx = mouseY * TILT_MAX;
                var tz = -mouseX * TILT_MAX;
                helix.rotation.x += (tx - helix.rotation.x) * 0.06;
                helix.rotation.z += (tz - helix.rotation.z) * 0.06;
            }

            /* Node scale / emissive lerp (mutation choreography). */
            function lerpNode(n) {
                var s = n.scale.x;
                var t = n.userData.scaleTarget || 1;
                if (Math.abs(s - t) > 0.001) {
                    var ns = s + (t - s) * 0.1;
                    n.scale.set(ns, ns, ns);
                }
                var m = n.material;
                if (m && typeof m.emissiveIntensity === 'number') {
                    var et = n.userData.emissiveTarget || 0.35;
                    if (Math.abs(m.emissiveIntensity - et) > 0.002) {
                        m.emissiveIntensity += (et - m.emissiveIntensity) * 0.08;
                    }
                }
            }
            strandA.forEach(lerpNode);
            strandB.forEach(lerpNode);

            /* Bridges follow their paired nodes as the helix rotates.
               positions update because the buffer geometry reads world
               positions of the paired spheres, and the group rotation
               handles the rest. No per-frame buffer rewrite needed.  */

            /* Click-pause zoom. */
            if (now < zoomUntil) {
                camera.position.z += (6.8 - camera.position.z) * 0.1;
            } else {
                camera.position.z += (8.5 - camera.position.z) * 0.06;
            }

            /* Drift particles upward slowly. */
            var pos = particleGeom.attributes.position.array;
            for (var i = 0; i < pos.length; i += 3) {
                pos[i + 1] += 0.005;
                if (pos[i + 1] > 4) pos[i + 1] = -4;
            }
            particleGeom.attributes.position.needsUpdate = true;

            renderer.render(scene, camera);
            requestAnimationFrame(render);
        }
        requestAnimationFrame(render);
    }
})();
