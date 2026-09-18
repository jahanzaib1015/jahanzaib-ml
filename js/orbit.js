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
    var R = radius(stage);
    var angle = 0;            // ring rotation, degrees [0,360)
    var vel = 0;              // current angular velocity, deg/sec
    var AUTO = 16;            // cruise velocity (one full orbit ~22.5s)
    var running = false;
    var last = 0;
    var front = -1;

    function layout() {
      R = radius(stage);
      var i, a, cosA, depth;
      for (i = 0; i < N; i++) {
        a = norm(angle + i * STEP);
        cosA = Math.cos(a * Math.PI / 180);
        depth = (cosA + 1) / 2;                 // 1 at front, 0 at back
        cards[i].style.transform =
          'translate(-50%,-50%) rotateY(' + a.toFixed(3) + 'deg) translateZ(' + R + 'px)';
        cards[i].style.opacity = (0.32 + 0.68 * depth).toFixed(3);
        cards[i].style.zIndex = String(Math.round(1000 + cosA * 500));
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
      vel += (AUTO - vel) * Math.min(1, dt * 2.2);   // smooth ramp toward cruise speed
      angle += vel * dt;
      if (angle >= 360) angle -= 360; else if (angle < 0) angle += 360;
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
      front: function () { return front; }
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
