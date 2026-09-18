/* ============================================================
   js/orbit.js — interactive 3D curved "core competencies" carousel
   ------------------------------------------------------------
   The five AI/ML skill cards revolve on a circular orbit around an
   empty hub. Each card is built from SLICES vertical strips laid on a
   mini-cylinder, so while revolving it reads as a curved/bent arch.
   The card nearest the centre focus (or under the cursor) eases its
   bend to zero and billboards flat, front-facing and elevated, for
   crisp undistorted reading; it re-curves as it travels away.
   Navigation is pure drag / touch-swipe with momentum + inertia —
   there are no buttons or dots. Theme-aware via --orbit-accent.
   Loaded on index.html + about.html only.
   ============================================================ */
(function () {
  'use strict';

  // Single source of truth for the orbiting cards (core AI/ML pillars).
  var SKILLS = [
    { badge: 'AI / ML', title: 'Artificial Intelligence &amp; Machine Learning', text: 'Predictive modeling, statistical learning, training pipelines, and intelligent system architecture.' },
    { badge: 'DL',      title: 'Deep Learning &amp; Neural Networks',            text: 'Multi-layer perceptrons, CNNs, model optimization, loss functions, and tensor computations.' },
    { badge: 'CV',      title: 'Computer Vision',                                text: 'Image processing, feature extraction, object detection, and visual data perception pipelines.' },
    { badge: 'DATA',    title: 'Data Preprocessing &amp; Python',                text: 'Pandas / NumPy pipelines, cleaning and feature engineering, plus SQL-backed data wrangling.' },
    { badge: 'EVAL',    title: 'Model Evaluation / Data Structures',             text: 'Precision, recall, F1 and ROC-AUC scoring with SHAP explainability, on solid DSA foundations.' }
  ];

  var N = SKILLS.length;
  var STEP = 360 / N;        // angular slot per card
  var SLICES = 9;            // vertical strips per card (the cylindrical bend)
  var C = (SLICES - 1) / 2;  // centre strip index
  var BEND_MAX = 58;         // total arc (deg) of a fully-curved card
  var FLAT_FRAC = 0.42;      // fraction of the orbit (from centre) that stays flat-ish
  var GAP = 18;              // px gap guaranteed between neighbouring cards
  var LIFT = 54;             // px the focused card floats toward the viewer
  var AUTO = 16;             // cruise angular velocity, deg/sec (~22.5s per orbit)
  var RESUME_DELAY = 3.2;    // s parked on a tapped card before auto-resume

  function norm(a) { return ((a + 180) % 360 + 360) % 360 - 180; }   // -> [-180,180]
  function norm360(v) { return ((v % 360) + 360) % 360; }            // -> [0,360)
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Card width fits the whole ring inside the stage; the orbit radius then
  // derives from that width so adjacent cards always keep a real gap.
  //   ring half-extent  ~ 0.951*R + 0.155*w  <= stageWidth/2
  //   no-overlap chord  ->  R >= 0.851*(w + GAP)
  function metrics(stage) {
    var sw = stage.clientWidth || 800;
    var wFit = (sw / 2 - 0.809 * GAP) / 0.964;
    var w = Math.round(clamp(wFit, 140, 258));
    var R = Math.round(Math.max(120, 0.851 * (w + GAP)));
    return { w: w, R: R };
  }

  function faceHTML(s) {
    return '<div class="orbit-badge">' + s.badge + '</div>' +
           '<h3>' + s.title + '</h3>' +
           '<p>' + s.text + '</p>';
  }

  function build(root) {
    var stage = root.querySelector('[data-orbit-stage]');
    var ring = root.querySelector('[data-orbit-ring]');
    if (!stage || !ring) return null;

    var cards = [], bends = [], slices = [], faces = [];
    SKILLS.forEach(function (s, i) {
      var card = document.createElement('article');
      card.className = 'orbit-card';
      card.setAttribute('data-index', String(i));
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', s.title.replace(/&amp;/g, '&'));

      var bend = document.createElement('div');
      bend.className = 'orbit-bend';
      bend.setAttribute('aria-hidden', 'true');

      var sl = [], fc = [];
      for (var k = 0; k < SLICES; k++) {
        var slice = document.createElement('div');
        slice.className = 'orbit-slice';
        var face = document.createElement('div');
        face.className = 'orbit-face';
        face.innerHTML = faceHTML(s);
        slice.appendChild(face);
        bend.appendChild(slice);
        sl.push(slice); fc.push(face);
      }
      card.appendChild(bend);
      ring.appendChild(card);

      cards.push(card); bends.push(bend); slices.push(sl); faces.push(fc);
    });

    // ---- state ----
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var m = metrics(stage);
    var W = m.w, R = m.R, SW = W / SLICES, H = 200, STAGE_H = 0;
    var angle = 0, vel = 0, lastVel = 0;
    var running = false, last = 0, front = -1;
    var foc = []; for (var f0 = 0; f0 < N; f0++) foc.push(0);   // per-card flatness 0..1
    var hoverIdx = -1, paused = false, idle = 0;
    var tween = { active: false, from: 0, to: 0, t: 0, dur: 0.6 };
    var dragging = false, dragId = null, lastX = 0, lastT = 0, moved = 0;

    // Set every card's width / slice geometry, then measure the tallest content
    // so all cards share one clip-free height. Runs on build + resize.
    function sizeAll() {
      m = metrics(stage); W = m.w; R = m.R; SW = W / SLICES;
      var i, k;
      for (i = 0; i < N; i++) {
        cards[i].style.width = W + 'px';
        for (k = 0; k < SLICES; k++) {
          slices[i][k].style.width = SW + 'px';
          slices[i][k].style.marginLeft = (-SW / 2) + 'px';
          faces[i][k].style.width = W + 'px';
          faces[i][k].style.left = (-(k * SW)) + 'px';
          faces[i][k].style.height = 'auto';
        }
      }
      var maxH = 0;
      for (i = 0; i < N; i++) {
        var h = faces[i][0].offsetHeight;
        if (h > maxH) maxH = h;
      }
      H = Math.max(Math.round(maxH), 180);
      for (i = 0; i < N; i++) {
        cards[i].style.height = H + 'px';
        for (k = 0; k < SLICES; k++) faces[i][k].style.height = H + 'px';
      }
      // Grow the stage so the fully-focused front card fits at its worst-case
      // perspective-magnified height. At dead center a card is pushed forward by
      // translateZ(R) (orbit) + translateZ(LIFT) (focus) and scaled by 1.08, so its
      // projected height is H * P/(P-(R+LIFT)) * 1.08. Never shrink below the CSS clamp.
      stage.style.height = '';
      var cssH = parseFloat(getComputedStyle(stage).height) || 340;
      var P = parseFloat(getComputedStyle(stage).perspective) || 1200;
      var fwd = R + LIFT;
      var mag = (P > fwd) ? (P / (P - fwd)) : 2;
      var projH = Math.ceil(H * mag * 1.08) + 16;
      STAGE_H = Math.max(cssH, Math.min(projH, 720));
      stage.style.height = STAGE_H + 'px';
      layout();
    }

    function focusTarget(i, a) {
      if (i === hoverIdx) return 1;
      return clamp(1 - (Math.abs(a) / 180) / FLAT_FRAC, 0, 1);
    }

    function layout() {
      var i, k, a, F, b, cosA, depth, op;
      for (i = 0; i < N; i++) {
        a = norm(angle + i * STEP);
        F = foc[i]; b = 1 - F;
        cosA = Math.cos(a * Math.PI / 180);
        depth = (cosA + 1) / 2;

        // orbit placement + billboard flat by F + lift/scale for the focused card
        cards[i].style.transform =
          'translate(-50%,-50%) rotateY(' + a.toFixed(3) + 'deg) translateZ(' + R + 'px)' +
          ' rotateY(' + (-F * a).toFixed(3) + 'deg) translateZ(' + (F * LIFT).toFixed(1) + 'px)' +
          (F > 0.001 ? ' scale(' + (1 + 0.08 * F).toFixed(3) + ')' : '');
        op = (0.34 + 0.66 * depth); op += (1 - op) * F;
        cards[i].style.opacity = op.toFixed(3);
        cards[i].style.zIndex = String(Math.round(1000 + cosA * 500 + F * 600));
        cards[i].classList.toggle('is-focus', F > 0.6);

        // cylindrical bend of the card surface (flat tiling when b ~ 0)
        if (b < 0.002) {
          bends[i].style.transform = 'none';
          for (k = 0; k < SLICES; k++) slices[i][k].style.transform = 'translateX(' + ((k - C) * SW).toFixed(2) + 'px)';
        } else {
          var ts = (b * BEND_MAX) / SLICES;                  // per-slice arc, deg
          var Rc = (SW / 2) / Math.tan((ts * Math.PI / 180) / 2);
          bends[i].style.transform = 'translateZ(' + (-Rc).toFixed(2) + 'px)';
          for (k = 0; k < SLICES; k++) {
            var phi = (k - C) * ts;
            slices[i][k].style.transform = 'rotateY(' + phi.toFixed(3) + 'deg) translateZ(' + Rc.toFixed(2) + 'px)';
          }
        }
      }
      // front card = the one closest to the viewer
      var fI = 0, best = -2;
      for (i = 0; i < N; i++) {
        var cc = Math.cos(norm(angle + i * STEP) * Math.PI / 180);
        if (cc > best) { best = cc; fI = i; }
      }
      front = fI;
    }

    function goToIndex(idx) {
      var target = ((idx % N) + N) % N;
      var desired = norm360(-target * STEP);
      var d = norm(desired - angle);
      tween.active = true; tween.from = angle; tween.to = angle + d;
      tween.t = 0; tween.dur = reduce ? 0.001 : 0.55;
      paused = true; vel = 0; idle = 0;
    }

    function step(dt) {
      if (dragging) {
        // angle is driven directly by the pointer; carry a smoothed velocity
        vel = vel * 0.5 + lastVel * 0.5;
      } else if (tween.active) {
        tween.t = Math.min(1, tween.t + dt / tween.dur);
        var e = tween.t < 0.5 ? 4 * tween.t * tween.t * tween.t : 1 - Math.pow(-2 * tween.t + 2, 3) / 2;
        angle = norm360(tween.from + (tween.to - tween.from) * e);
        if (tween.t >= 1) { tween.active = false; idle = 0; }
      } else {
        var target = (paused || reduce) ? 0 : AUTO;
        // fast stop when parked/hovered, slow momentum blend back to cruise
        var rate = (target === 0) ? 12 : 0.9;
        vel += (target - vel) * Math.min(1, dt * rate);
        angle = norm360(angle + vel * dt);
        if (paused && hoverIdx < 0 && !reduce) {
          idle += dt;
          if (idle > RESUME_DELAY) { paused = false; idle = 0; }
        }
      }
      // ease each card's flatness toward its target (curve <-> straight)
      var k = Math.min(1, dt * 9);
      for (var i = 0; i < N; i++) {
        var tf = focusTarget(i, norm(angle + i * STEP));
        foc[i] += (tf - foc[i]) * k;
        if (foc[i] < 0.001) foc[i] = 0; else if (foc[i] > 0.999) foc[i] = 1;
      }
      layout();
    }

    function frame(now) {
      if (!running) return;
      var dt = last ? Math.min(64, now - last) / 1000 : 0;
      last = now;
      if (dt > 0) step(dt);
      requestAnimationFrame(frame);
    }
    function start() { if (!running) { running = true; last = 0; requestAnimationFrame(frame); } }
    function stop() { running = false; }

    // ---- hover-to-pause (mouse): freeze + straighten the card under the cursor ----
    function hoverOn(i) { return function () { if (dragging) return; hoverIdx = i; paused = true; idle = 0; if (!running) layout(); }; }
    function hoverOff() { if (dragging) return; hoverIdx = -1; paused = false; idle = 0; if (!running) layout(); }
    cards.forEach(function (c, i) {
      c.addEventListener('mouseenter', hoverOn(i));
      c.addEventListener('mouseleave', hoverOff);
    });

    // ---- drag / touch-swipe with inertia (unified Pointer Events) ----
    function degPerPx() { return (180 / Math.PI) / Math.max(70, R); }
    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true; dragId = e.pointerId;
      lastX = e.clientX; lastT = performance.now(); moved = 0;
      vel = 0; lastVel = 0; tween.active = false; hoverIdx = -1; paused = true;
      stage.classList.add('is-dragging');
      if (stage.setPointerCapture) { try { stage.setPointerCapture(e.pointerId); } catch (_) {} }
      start();
      if (e.cancelable) e.preventDefault();
    });
    stage.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== dragId) return;
      var now = performance.now();
      var dt = Math.max(8, now - lastT) / 1000;
      var dx = e.clientX - lastX; moved += Math.abs(dx);
      var dA = dx * degPerPx();
      angle = norm360(angle + dA);
      lastVel = dA / dt;
      lastX = e.clientX; lastT = now;
      layout();
      if (e.cancelable) e.preventDefault();
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-dragging');
      if (dragId != null && stage.releasePointerCapture) { try { stage.releasePointerCapture(dragId); } catch (_) {} }
      dragId = null;
      if (moved < 6 && e && e.target && e.target.closest) {
        var cardEl = e.target.closest('.orbit-card');
        if (cardEl) { goToIndex(+cardEl.getAttribute('data-index')); return; }
      }
      // release with momentum: keep the flung velocity, step() decays it to cruise
      vel = clamp(lastVel, -520, 520);
      paused = false; idle = 0;
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('pointerleave', function (e) { if (dragging) endDrag(e); });
    stage.addEventListener('dragstart', function (e) { e.preventDefault(); });

    window.addEventListener('resize', sizeAll);
    sizeAll();

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        for (var x = 0; x < entries.length; x++) { if (entries[x].isIntersecting) start(); else stop(); }
      }, { threshold: 0.05 });
      io.observe(stage);
    } else { start(); }

    return {
      root: root, stage: stage, ring: ring, cards: cards, slices: slices, bends: bends, faces: faces,
      get angle() { return angle; },
      set angle(v) { angle = norm360(v); layout(); },
      step: step, layout: layout, sizeAll: sizeAll, start: start, stop: stop,
      isRunning: function () { return running; },
      front: function () { return front; },
      foc: foc,
      metrics: function () { return { w: W, R: R, H: H, SW: SW, slices: SLICES, stageH: STAGE_H }; },
      hover: function (i) { if (i >= 0) hoverOn(i)(); else hoverOff(); },
      isPaused: function () { return paused; },
      goToIndex: goToIndex,
      dragBy: function (px) { angle = norm360(angle + px * degPerPx()); layout(); },
      fling: function (v) { vel = v; lastVel = v; paused = false; tween.active = false; },
      tweening: function () { return tween.active; }
    };
  }

  window.__orbit = [];

  function boot() {
    var roots = document.querySelectorAll('[data-orbit]');
    Array.prototype.forEach.call(roots, function (r) {
      var inst = build(r);
      if (inst) window.__orbit.push(inst);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
