/* ============================================================
   js/orbit.js — interactive orbital "core competencies" carousel
   ------------------------------------------------------------
   Renders the AI/ML skill cards into a 3D orbit and revolves them
   around an empty hub. Auto-rotates continuously; hovering pauses
   and straightens the focused card flat/front-facing for reading;
   prev/next buttons, dots and touch swipe step one card at a time.
   Purely additive, self-contained, theme-aware (uses --orbit-accent).
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
  var STEP = 360 / N;

  // normalize an angle to [-180, 180]
  function norm(a) { return ((a + 180) % 360 + 360) % 360 - 180; }

  // orbit radius scales with the stage width so it fits mobile -> desktop
  function radius(stage) {
    var w = stage.clientWidth || 800;
    return Math.max(120, Math.min(300, Math.round(w * 0.30)));
  }

  function build(root) {
    var stage = root.querySelector('[data-orbit-stage]');
    var ring = root.querySelector('[data-orbit-ring]');
    var dotsWrap = root.querySelector('[data-orbit-dots]');
    if (!stage || !ring) return null;

    var cards = SKILLS.map(function (s, i) {
      var c = document.createElement('article');
      c.className = 'orbit-card';
      c.setAttribute('data-index', String(i));
      c.innerHTML =
        '<div class="orbit-badge">' + s.badge + '</div>' +
        '<h3>' + s.title + '</h3>' +
        '<p>' + s.text + '</p>';
      ring.appendChild(c);
      return c;
    });

    var dots = [];
    if (dotsWrap) {
      dots = SKILLS.map(function (_, i) {
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'orbit-dot';
        d.setAttribute('data-dot', String(i));
        d.setAttribute('aria-label', 'Show skill ' + (i + 1) + ' of ' + N);
        dotsWrap.appendChild(d);
        return d;
      });
    }

    // ---- orbital engine: continuous curved revolution around the empty hub ----
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var R = radius(stage);
    var angle = 0;            // ring rotation, degrees [0,360)
    var vel = 0;              // current angular velocity, deg/sec
    var AUTO = reduce ? 0 : 16;   // cruise velocity (one full orbit ~22.5s); 0 under reduced-motion
    var running = false;
    var last = 0;
    var front = -1;

    // curve-to-straight state
    var flatten = [];         // per-card flatten factor 0 (curved) .. 1 (flat/front)
    var hoverIdx = -1;        // card currently under the pointer
    var paused = false;       // hover-pause engaged
    var LIFT = 46;            // px the focused card floats toward the viewer
    for (var fi = 0; fi < N; fi++) flatten.push(0);

    // manual navigation state (one-card eased tweens + idle auto-resume)
    var tween = { active: false, from: 0, to: 0, t: 0, dur: 0.6 };
    var idle = 0;             // seconds parked on a landed card before auto-resume
    var RESUME_DELAY = 4;     // s
    function norm360(v) { return ((v % 360) + 360) % 360; }
    function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

    function stopped() { return tween.active || Math.abs(vel) < 0.6; }
    function focusIdx() {
      if (hoverIdx >= 0) return hoverIdx;
      return stopped() ? front : -1;
    }

    function layout() {
      R = radius(stage);
      var focus = focusIdx();
      var i, a, F, cosA, depth, flat, scale, op;
      for (i = 0; i < N; i++) {
        a = norm(angle + i * STEP);
        F = flatten[i];
        cosA = Math.cos(a * Math.PI / 180);
        depth = (cosA + 1) / 2;                 // 1 at front, 0 at back
        // curved radial placement, billboarded flat by F so a focused card faces
        // the camera while staying at its orbital position; lift + scale to pop.
        flat = ' rotateY(' + (-F * a).toFixed(3) + 'deg) translateZ(' + (F * LIFT).toFixed(1) + 'px)';
        scale = F > 0.001 ? ' scale(' + (1 + 0.07 * F).toFixed(3) + ')' : '';
        cards[i].style.transform =
          'translate(-50%,-50%) rotateY(' + a.toFixed(3) + 'deg) translateZ(' + R + 'px)' + flat + scale;
        op = (0.32 + 0.68 * depth) + (1 - (0.32 + 0.68 * depth)) * F;  // brighten toward 1 as it flattens
        cards[i].style.opacity = op.toFixed(3);
        cards[i].style.zIndex = String(Math.round(1000 + cosA * 500 + F * 600));
        cards[i].classList.toggle('is-focus', i === focus && F > 0.5);
      }
      var f = 0, best = -2;
      for (i = 0; i < N; i++) {
        var c = Math.cos(norm(angle + i * STEP) * Math.PI / 180);
        if (c > best) { best = c; f = i; }
      }
      if (f !== front) {
        front = f;
        for (i = 0; i < dots.length; i++) dots[i].classList.toggle('is-active', i === front);
      }
    }

    // Advance the simulation by dt seconds. Kept separate from rAF so it can be
    // driven deterministically (tests) and paused/resumed without side effects.
    function step(dt) {
      if (tween.active) {
        tween.t = Math.min(1, tween.t + dt / tween.dur);
        angle = norm360(tween.from + (tween.to - tween.from) * easeInOut(tween.t));
        if (tween.t >= 1) { tween.active = false; idle = 0; }
      } else {
        var targetVel = paused ? 0 : AUTO;
        vel += (targetVel - vel) * Math.min(1, dt * 2.2);   // smooth ramp / smooth resume
        angle = norm360(angle + vel * dt);
        if (paused && hoverIdx < 0 && !reduce) {             // parked after a manual step
          idle += dt;
          if (idle > RESUME_DELAY) { paused = false; idle = 0; }
        }
      }
      var focus = focusIdx(), k = Math.min(1, dt * 7);       // curve<->straight easing
      for (var i = 0; i < N; i++) {
        var t = (i === focus) ? 1 : 0;
        flatten[i] += (t - flatten[i]) * k;
        if (flatten[i] < 0.001) flatten[i] = 0;
      }
      layout();
    }

    // ---- manual navigation: one-card eased tweens that park the orbit to read ----
    function go(delta) {
      tween.active = true;
      tween.from = angle;
      tween.to = angle + delta;
      tween.t = 0;
      tween.dur = reduce ? 0.001 : 0.6;
      paused = true; vel = 0; idle = 0;
      layout();
    }
    function landIndex(target, preferDir) {
      var desired = norm360(-target * STEP);
      var d = norm(desired - angle);
      if (preferDir < 0 && d > 0) d -= 360;   // next: rotate the "forward" way
      if (preferDir > 0 && d < 0) d += 360;   // prev: rotate the "backward" way
      go(d);
    }
    function next() { landIndex((front + 1 + N) % N, -1); }
    function prev() { landIndex((front - 1 + N) % N, 1); }
    function goToIndex(i) { landIndex(((i % N) + N) % N, 0); }

    function frame(now) {
      if (!running) return;
      var dt = last ? Math.min(64, now - last) / 1000 : 0;
      last = now;
      if (dt > 0) step(dt);
      requestAnimationFrame(frame);
    }

    function start() { if (!running) { running = true; last = 0; requestAnimationFrame(frame); } }
    function stop() { running = false; }

    // hover-to-pause (mouse only): cursor over a card stops the orbit instantly and
    // straightens that card flat for reading; leaving resumes the curved flow smoothly.
    // Touch never fires mouseenter/leave, so taps can't leave the orbit stuck paused.
    function pauseOn(i) {
      return function () { hoverIdx = i; paused = true; vel = 0; layout(); };
    }
    function pauseOff() {
      hoverIdx = -1; paused = false; idle = 0;
      if (!running) layout();   // keep flatten easing while off-screen/manual
      else start();
    }
    cards.forEach(function (c, i) {
      c.addEventListener('mouseenter', pauseOn(i));
      c.addEventListener('mouseleave', pauseOff);
    });

    // ---- manual controls: prev/next buttons, dots, click-to-front, touch swipe ----
    var prevBtn = root.querySelector('[data-orbit-prev]');
    var nextBtn = root.querySelector('[data-orbit-next]');
    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);
    dots.forEach(function (d, i) { d.addEventListener('click', function () { goToIndex(i); }); });
    cards.forEach(function (c, i) { c.addEventListener('click', function () { goToIndex(i); }); });

    var tx = 0, ty = 0, tracking = false;
    stage.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0]; tx = t.clientX; ty = t.clientY; tracking = true;
    }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (!tracking) return; tracking = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - tx, dy = t.clientY - ty;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); }
    }, { passive: true });

    layout();
    window.addEventListener('resize', layout);

    // Only spin while the carousel is actually on-screen (perf + no off-screen work).
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        for (var e = 0; e < entries.length; e++) {
          if (entries[e].isIntersecting) start(); else stop();
        }
      }, { threshold: 0.05 });
      io.observe(stage);
    } else {
      start();
    }

    var api = {
      root: root, stage: stage, ring: ring, cards: cards, dots: dots,
      get angle() { return angle; },
      set angle(v) { angle = ((v % 360) + 360) % 360; layout(); },
      step: step, layout: layout, start: start, stop: stop,
      isRunning: function () { return running; },
      front: function () { return front; },
      flatten: flatten,
      hover: function (i) { if (i >= 0) pauseOn(i)(); else pauseOff(); },
      isPaused: function () { return paused; },
      focus: focusIdx,
      next: next, prev: prev, goToIndex: goToIndex,
      tweening: function () { return tween.active; }
    };
    return api;
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
