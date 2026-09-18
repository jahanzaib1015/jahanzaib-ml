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

    // Static placement at ring angle 0 — continuous rotation is layered on later.
    function renderStatic() {
      var R = radius(stage);
      for (var i = 0; i < N; i++) {
        var a = norm(i * STEP);
        var cosA = Math.cos(a * Math.PI / 180);
        var depth = (cosA + 1) / 2;
        cards[i].style.transform =
          'translate(-50%,-50%) rotateY(' + a.toFixed(3) + 'deg) translateZ(' + R + 'px)';
        cards[i].style.opacity = (0.35 + 0.65 * depth).toFixed(3);
        cards[i].style.zIndex = String(Math.round(1000 + cosA * 500));
      }
      for (var j = 0; j < dots.length; j++) dots[j].classList.toggle('is-active', j === 0);
    }
    renderStatic();
    window.addEventListener('resize', renderStatic);

    return { root: root, stage: stage, ring: ring, cards: cards, dots: dots };
  }

  function boot() {
    var roots = document.querySelectorAll('[data-orbit]');
    Array.prototype.forEach.call(roots, function (r) { build(r); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
