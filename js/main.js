// ============================================
// JAHANZAIB AZHAR — PORTFOLIO CORE JAVASCRIPT
// Main interactions: intro, hero reveal, 360 rotation, 3D tilt
// ============================================

// ===== global theme: dark / venom =====
window.__venomMode = () => document.documentElement.getAttribute('data-theme') === 'venom';
(function(){
  const root = document.documentElement;
  const KEY = 'mja-theme';
  const btn = document.getElementById('theme-toggle');
  const icon = document.querySelector('link[rel="icon"]');
  const apply = (mode, animate) => {
    if (animate){
      root.classList.add('theme-anim');
      setTimeout(() => root.classList.remove('theme-anim'), 260);
    }
    root.setAttribute('data-theme', mode);
    if (btn) btn.setAttribute('aria-pressed', String(mode === 'venom'));
    if (icon) icon.setAttribute('href', mode === 'venom' ? 'favicon-venom.svg' : 'favicon.svg');
  };
  // Cinematic DNA gene-splice overlay: a glowing holographic double helix that
  // MERGES on load/refresh and on every theme switch. Carries its own mode class
  // so the Spider-Man splice and the Venom symbiote fusion never mix, and
  // self-removes in ~1.9s. Non-blocking (pointer-events:none).
  let scanEl = null, scanTimers = [], helixRaf = 0;
  const GLYPHS = '#$%&/<>[]{}=+*~';
  function typeReadout(el, text, venom, intro){
    if (!el) return;
    let i = 0;
    const delay = intro ? (venom ? 20 : 16) : (venom ? 9 : 7);
    const step = () => {
      i++;
      let out = text.slice(0, i);
      for (let j = i; j < text.length; j++) out += text[j] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = out;
      if (i < text.length) scanTimers.push(setTimeout(step, delay));
      else el.textContent = text;
    };
    step();
  }
  // Double-helix merge: two strands converge from apart into an intertwined helix
  // with a fusion flash. p = 0..1 life progress. Venom = corrupted, jagged,
  // symbiote-veined, red glow; dark = clean holographic cyan.
  function drawHelix(c, w, h, p, venom, now){
    const cx = w / 2, cy = h / 2;
    const m = Math.min(1, p / 0.6);
    const me = m * m * (3 - 2 * m);                 // smoothstep merge
    const fade = p < 0.8 ? 1 : Math.max(0, 1 - (p - 0.8) / 0.2);
    const amp = h * 0.15 * me;                       // helix amplitude grows as it fuses
    const sep = h * 0.30 * (1 - me);                 // two sources start apart, converge to 0
    const span = Math.min(w * 0.9, 1080);
    const x0 = cx - span / 2;
    const freq = (Math.PI * 2 * 3.2) / span;
    const phase = now * 0.0026;                      // continuous twist
    const steps = Math.max(64, Math.floor(span / 6));
    const dx = span / steps;
    const fp = (p - 0.54) / 0.18;                    // fusion-flash window
    const flash = (fp >= 0 && fp <= 1) ? Math.sin(fp * Math.PI) : 0;
    const pts = [];
    for (let i = 0; i <= steps; i++){
      const x = x0 + i * dx, th = x * freq + phase, s = Math.sin(th);
      const noise = venom ? (Math.sin(th * 5.3 + now * 0.011) * 0.6 + Math.sin(th * 11.7 - now * 0.014) * 0.4) * amp * 0.12 : 0;
      pts.push({ x, y1: cy - sep + amp * s + noise, y2: cy + sep - amp * s - noise, s });
    }
    c.save();
    c.lineCap = 'round';
    if (me > 0.04){                                  // base-pair rungs
      for (let i = 0; i <= steps; i += 3){
        const P = pts[i], t = (P.s + 1) / 2;
        c.globalAlpha = fade * (0.16 + 0.5 * me) * (0.35 + 0.65 * t);
        c.strokeStyle = venom ? 'rgba(255,68,56,0.85)' : (i % 6 === 0 ? 'rgba(255,120,190,0.9)' : 'rgba(120,235,255,0.9)');
        c.lineWidth = venom ? 1.7 : 1.4;
        c.beginPath(); c.moveTo(P.x, P.y1); c.lineTo(P.x, P.y2); c.stroke();
      }
    }
    const strand = (getY, color, glow, lw) => {
      c.globalAlpha = fade * 0.96;
      c.strokeStyle = color; c.shadowColor = glow; c.shadowBlur = 18; c.lineWidth = lw;
      c.beginPath();
      for (let i = 0; i <= steps; i++){ const y = getY(pts[i]); if (i === 0) c.moveTo(pts[i].x, y); else c.lineTo(pts[i].x, y); }
      c.stroke();
      c.shadowBlur = 0;
    };
    if (venom){
      strand(P => P.y1, 'rgba(8,8,10,0.96)', 'rgba(255,68,56,0.9)', 3.4);
      strand(P => P.y2, 'rgba(8,8,10,0.96)', 'rgba(230,36,41,0.85)', 3.4);
      c.globalAlpha = fade * 0.5; c.strokeStyle = 'rgba(232,244,238,0.5)'; c.lineWidth = 0.8;
      c.beginPath(); for (let i = 0; i <= steps; i++){ const P = pts[i]; if (i === 0) c.moveTo(P.x, P.y1); else c.lineTo(P.x, P.y1); } c.stroke();
      c.beginPath(); for (let i = 0; i <= steps; i++){ const P = pts[i]; if (i === 0) c.moveTo(P.x, P.y2); else c.lineTo(P.x, P.y2); } c.stroke();
      c.globalAlpha = fade * 0.4; c.strokeStyle = 'rgba(255,68,56,0.5)'; c.lineWidth = 1; // symbiote veins
      for (let i = 4; i <= steps; i += 14){
        const P = pts[i], dir = (i % 28 === 4) ? -1 : 1;
        c.beginPath(); c.moveTo(P.x, P.y1);
        c.quadraticCurveTo(P.x + 10, P.y1 + dir * 14, P.x + 4, P.y1 + dir * 26);
        c.stroke();
      }
    } else {
      strand(P => P.y1, 'rgba(160,248,255,0.96)', 'rgba(20,232,200,0.9)', 3);
      strand(P => P.y2, 'rgba(120,200,255,0.92)', 'rgba(80,160,255,0.85)', 3);
    }
    if (flash > 0.01){                               // fusion flash + shockwave ring
      const fc = venom ? '255,68,56' : '160,248,255';
      const R = h * 0.05 + flash * h * 0.42;
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, 'rgba(' + fc + ',' + (0.45 * flash).toFixed(3) + ')');
      g.addColorStop(0.45, 'rgba(' + fc + ',' + (0.16 * flash).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + fc + ',0)');
      c.globalAlpha = fade; c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      c.globalAlpha = fade * flash * 0.65; c.strokeStyle = 'rgba(' + fc + ',0.85)'; c.lineWidth = 2;
      c.beginPath(); c.arc(cx, cy, h * 0.05 + fp * h * 0.5, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }
  function startHelix(ov, venom, life){
    const cv = ov.querySelector('.dna-helix');
    if (!cv) return;
    const c = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const t0 = performance.now(), LIFE = life || 1880;
    const w = ov.clientWidth || window.innerWidth, h = ov.clientHeight || window.innerHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tick = (now) => {
      const e = now - t0;
      c.clearRect(0, 0, w, h);
      drawHelix(c, w, h, Math.min(1, e / LIFE), venom, now);
      if (e < LIFE) helixRaf = requestAnimationFrame(tick);
    };
    helixRaf = requestAnimationFrame(tick);
  }
  function runDnaScan(nextMode, opts){
    opts = opts || {};
    if (scanEl){ scanEl.remove(); scanEl = null; }
    scanTimers.forEach(clearTimeout); scanTimers = [];
    if (helixRaf){ cancelAnimationFrame(helixRaf); helixRaf = 0; }

    const venom = nextMode === 'venom';
    const intro = !!opts.intro;
    // Held long enough to comfortably read the spliced text before it fades out.
    const LIFE = intro ? 3000 : 2200;      // total on-screen time (load intro / theme toggle)
    const OUT  = intro ? 2300 : 1600;      // when the overlay starts fading out
    const ov = document.createElement('div');
    ov.id = 'dna-scan';
    ov.className = 'dna-scan dna-scan--' + nextMode + (intro ? ' dna-scan--intro' : '');
    ov.setAttribute('aria-hidden', 'true');
    ov.style.setProperty('--dna-life', LIFE + 'ms');   // HUD CSS animations scale to the hold time
    const readout = venom ? 'JAHANZAIB + VENOM SYMBIOTE SPLICED' : 'JAHANZAIB + SPIDER DNA SPLICED';
    const sub = venom ? 'AI/ML ENGINEER // SYMBIOTE MATCH' : 'AI/ML ENGINEER // ARACHNID MATCH';
    ov.innerHTML =
      '<div class="dna-veil"></div>' +
      '<div class="dna-grid"></div>' +
      '<div class="dna-sweep"></div>' +
      '<canvas class="dna-helix"></canvas>' +
      '<div class="dna-hud"><div class="dna-frame">' +
        '<div class="dna-readout"></div>' +
        '<div class="dna-bar"></div>' +
        '<div class="dna-sub">' + sub + '</div>' +
      '</div></div>';
    document.body.appendChild(ov);
    scanEl = ov;
    void ov.offsetWidth;                 // reflow so the entry animations run
    ov.classList.add('is-active');
    typeReadout(ov.querySelector('.dna-readout'), readout, venom, intro);
    startHelix(ov, venom, LIFE);
    scanTimers.push(setTimeout(() => ov.classList.add('is-out'), OUT));
    scanTimers.push(setTimeout(() => {
      if (scanEl === ov){ ov.remove(); scanEl = null; }
      if (helixRaf){ cancelAnimationFrame(helixRaf); helixRaf = 0; }
    }, LIFE));
    return { life: LIFE, out: OUT };
  }
  window.__dnaScan = runDnaScan;         // exposed for verification harnesses

  apply(localStorage.getItem(KEY) === 'venom' ? 'venom' : 'dark', false);
  if (btn) btn.addEventListener('click', () => {
    const next = window.__venomMode() ? 'dark' : 'venom';
    localStorage.setItem(KEY, next);
    runDnaScan(next);
    apply(next, true);
  });
})();

// ===== cinematic DNA-merge load intro (first load / hard refresh only) =====
(function(){
  const intro = document.getElementById('scan-intro');
  const mode = window.__venomMode() ? 'venom' : 'dark';
  // The gene-splice intro fires ONLY on the very first load of a session or on a
  // hard refresh — never on internal nav clicks. sessionStorage survives reloads
  // within a tab, so pair the "already initialized" flag with the navigation type
  // to tell a genuine reload ('reload') apart from an in-site link ('navigate').
  const INIT_KEY = 'mja-dna-intro-done';
  let navType = 'navigate';
  try { const n = performance.getEntriesByType('navigation')[0]; if (n && n.type) navType = n.type; } catch (e) {}
  let firstLoad = true;
  try { firstLoad = sessionStorage.getItem(INIT_KEY) === null; } catch (e) {}
  const isReload = navType === 'reload';

  if (firstLoad || isReload){
    try { sessionStorage.setItem(INIT_KEY, '1'); } catch (e) {}
    // Fire the gene-splice DNA merge above the opaque paint-cover.
    const t = window.__dnaScan ? window.__dnaScan(mode, { intro: true }) : null;
    const out = (t && t.out) || 2300;
    if (intro){
      // #scan-intro is just the solid cover hiding initial paint; fade it out in
      // sync with the DNA overlay (is-out at `out`ms) to reveal the page.
      setTimeout(() => {
        intro.style.transition = 'opacity 0.48s ease';
        intro.style.opacity = '0';
        setTimeout(() => intro.remove(), 520);
      }, out);
    }
  } else if (intro){
    // Internal navigation: instant and clean — drop the paint-cover, no DNA animation.
    intro.remove();
  }
})();

// ===== nav toggle (mobile) =====
(function(){
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('header.nav');
  if(!toggle || !nav) return;
  toggle.addEventListener('click', () => nav.classList.toggle('open'));
})();

// ===== scroll reveal =====
// Exposed as window.__initReveals(root) so dynamically-rendered content (the
// data-driven project cards) can be animated after injection. Elements are
// tagged data-reveal-init so re-running never double-animates static content.
window.__initReveals = function(root){
  const scope = root || document;
  const targets = Array.from(scope.querySelectorAll('.reveal')).filter(el => !el.dataset.revealInit);
  if(!targets.length) return;
  targets.forEach(el => { el.dataset.revealInit = '1'; });
  if(window.gsap && window.ScrollTrigger){
    gsap.registerPlugin(ScrollTrigger);
    targets.forEach((el, idx) => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
        delay: (idx % 3) * 0.06,
        scrollTrigger: { trigger: el, start: 'top 88%' }
      });
    });
  } else {
    targets.forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
  }
};
window.addEventListener('DOMContentLoaded', () => { window.__initReveals(document); });

// ===== skill proficiency bars: fill on reveal (tiered, theme-reactive) =====
(function(){
  const groups = document.querySelectorAll('.skill-group');
  if(!groups.length) return;
  const fill = (g) => g.classList.add('bars-on');
  if(!('IntersectionObserver' in window)){ groups.forEach(fill); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => { if(en.isIntersecting){ fill(en.target); io.unobserve(en.target); } });
  }, { threshold: 0.25 });
  groups.forEach(g => io.observe(g));
  setTimeout(() => groups.forEach(fill), 3000);   // failsafe: never leave bars empty
})();

// ===== contact form -> mailto =====
(function(){
  const form = document.querySelector('.msg-form');
  if(!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.querySelector('#name').value.trim();
    const email = form.querySelector('#email').value.trim();
    const msg = form.querySelector('#message').value.trim();
    const subject = encodeURIComponent(`Portfolio contact — ${name || 'no name given'}`);
    const body = encodeURIComponent(`${msg}\n\n—\nFrom: ${name}\nReply to: ${email}`);
    window.location.href = `mailto:muhammadjahanzaibazhar@gmail.com?subject=${subject}&body=${body}`;
  });
})();

// ===== HERO PHOTO CONTROLLER: CURSOR REVEAL & 360° ROTATION =====
(function(){
  const photoCard = document.querySelector('.photo-card');
  const faceFront = document.querySelector('.photo-card .face-front');
  if(!photoCard || !faceFront) return;

  let isHovered = false;
  let rotationTimer = null;
  const ROTATION_PAUSE_MS = 18000; // 18 seconds pause between rotations (15-20s range)
  const INITIAL_DELAY_MS = 12000;  // Initial 12s so user sees default stable photo first

  // ----- 1. CURSOR SPOTLIGHT REVEAL (original Spider-man.png over the face) -----
  function updateSpotlight(clientX, clientY) {
    const rect = faceFront.getBoundingClientRect();
    photoCard.style.setProperty('--reveal-x', `${clientX - rect.left}px`);
    photoCard.style.setProperty('--reveal-y', `${clientY - rect.top}px`);
    if (!photoCard.classList.contains('is-revealing')) {
      photoCard.classList.add('is-revealing');
    }
  }

  function clearSpotlight() {
    photoCard.classList.remove('is-revealing');
  }

  // Mouse listeners on front face
  faceFront.addEventListener('mouseenter', (e) => {
    isHovered = true;
    updateSpotlight(e.clientX, e.clientY);
  });

  faceFront.addEventListener('mousemove', (e) => {
    updateSpotlight(e.clientX, e.clientY);
  });

  faceFront.addEventListener('mouseleave', () => {
    isHovered = false;
    clearSpotlight();
    // Resume rotation schedule if needed
    if (!rotationTimer && !photoCard.classList.contains('is-rotating')) {
      scheduleRotation(ROTATION_PAUSE_MS);
    }
  });

  // Touch support for mobile devices
  faceFront.addEventListener('touchstart', (e) => {
    isHovered = true;
    if (e.touches && e.touches[0]) {
      updateSpotlight(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  faceFront.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      updateSpotlight(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  faceFront.addEventListener('touchend', () => {
    isHovered = false;
    clearSpotlight();
    if (!rotationTimer && !photoCard.classList.contains('is-rotating')) {
      scheduleRotation(ROTATION_PAUSE_MS);
    }
  });

  // ----- 2. CONTROLLED 360° ROTATION ANIMATION -----
  function scheduleRotation(delayMs) {
    clearTimeout(rotationTimer);
    rotationTimer = setTimeout(() => {
      // Don't rotate while user is hovering/revealing
      if (isHovered) {
        scheduleRotation(4000);
        return;
      }
      photoCard.classList.add('is-rotating');
      rotationTimer = null;
    }, delayMs);
  }

  // Listen for rotation completion
  photoCard.addEventListener('animationend', (e) => {
    if (e.animationName === 'card-rotate-360') {
      photoCard.classList.remove('is-rotating');
      // Enforce the 15-20 second pause before the next rotation starts
      scheduleRotation(ROTATION_PAUSE_MS);
    }
  });

  // Start the initial rotation schedule after user has viewed the stable photo
  scheduleRotation(INITIAL_DELAY_MS);
})();

// ===== 3D TILT EFFECT FOR SKILL CARDS =====
(function(){
  const cards = document.querySelectorAll('.tilt-card');
  if(!cards.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduceMotion) return;

  cards.forEach(card => {
    const glare = card.querySelector('.tilt-glare');

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Subtle tilt: max 6 degrees
      const rotX = -((y - centerY) / centerY) * 6;
      const rotY = ((x - centerX) / centerX) * 6;

      card.style.transform = `perspective(900px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`;

      if (glare) {
        card.style.setProperty('--glare-x', `${x}px`);
        card.style.setProperty('--glare-y', `${y}px`);
      }
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
  });
})();

// ===== cinematic layer: skyline ambience, themed background traveller, power pulse =====
(function(){
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const cv = document.createElement('canvas');
  cv.id = 'cinema-canvas';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');

  let W = 0, H = 0, DPR = 1;
  let sky = null, skyH = 0, vign = null;

  function mulberry(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function buildSky(){
    skyH = Math.round(H * 0.26);
    sky = document.createElement('canvas');
    sky.width = Math.max(2, Math.round(W * 0.6));
    sky.height = skyH;
    const g = sky.getContext('2d');
    const rnd = mulberry(20260915);
    for (let band = 0; band < 2; band++){
      const col = band ? '#0a0d14' : '#070910';
      const base = band ? skyH : skyH * 0.72;
      let x = -20;
      g.fillStyle = col;
      while (x < sky.width + 20){
        const bw = 26 + rnd() * 64;
        const bh = (band ? 0.35 : 0.20) * skyH + rnd() * (band ? 0.55 : 0.40) * skyH;
        g.fillRect(x, base - bh, bw, bh + 4);
        if (rnd() < 0.30){                                   // antenna
          g.fillRect(x + bw * 0.5, base - bh - 10 - rnd() * 16, 1.5, 26);
        }
        x += bw + 6 + rnd() * 26;
      }
    }
    const rg = g.createLinearGradient(0, 0, 0, skyH);       // fade into the page bg
    rg.addColorStop(0, 'rgba(5,6,10,1)');
    rg.addColorStop(0.45, 'rgba(5,6,10,0.35)');
    rg.addColorStop(1, 'rgba(5,6,10,0)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = rg;
    g.fillRect(0, 0, sky.width, skyH * 0.55);
    g.globalCompositeOperation = 'source-over';
  }

  const motes = [];
  function buildMotes(){
    motes.length = 0;
    const rnd = mulberry(777);
    for (let i = 0; i < 26; i++){
      motes.push({ x: rnd(), y: rnd(), z: 0.25 + rnd() * 0.75, r: 0.6 + rnd() * 1.4 });
    }
  }

  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildSky();
    buildMotes();
    vign = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.34, W / 2, H / 2, Math.max(W, H) * 0.74);
    vign.addColorStop(0, 'rgba(140,0,16,0)');
    vign.addColorStop(1, 'rgba(140,0,16,1)');
  }
  resize();
  window.addEventListener('resize', resize);

  // themed background travellers: exactly one sprite per theme, never both at once
  const sprites = { dark: null, venom: null };
  (function(){
    const d = new Image();
    d.src = 'assets/images/spider-building.png';
    d.onload = () => { sprites.dark = d; };
    const v = new Image();
    v.src = 'assets/images/jumping-venom.png';
    v.onload = () => { sprites.venom = v; };
  })();
  const themeSprite = () => window.__venomMode() ? (sprites.venom || sprites.dark) : sprites.dark;
  const travelAlpha = () => window.__venomMode() ? 0.9 : 0.8;
  const ease = (t) => t * t * (3 - 2 * t);
  function drawSprite(img, cx, cy, hgt, sx, sy, rot){
    sx = sx === undefined ? 1 : sx;
    sy = sy === undefined ? 1 : sy;
    rot = rot || 0;
    const wid = hgt * img.width / img.height;
    const dw = wid * sx, dh = hgt * sy;
    ctx.save();
    ctx.translate(cx, cy);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }
  // organic black symbiote tendril from (x1,y1) to (x2,y2); faint alien-white rim reads on near-black
  function symbioteStrand(x1, y1, x2, y2, seed, thick){
    const segs = 9;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i <= segs; i++){
      const tt = i / segs;
      const bx = x1 + dx * tt, by = y1 + dy * tt;
      const wob = Math.sin(tt * Math.PI * 2.2 + seed) * thick * 2.4 * (1 - tt * 0.35);
      ctx.lineTo(bx + px * wob, by + py * wob);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.92)';
    ctx.lineWidth = thick;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(232,244,238,0.22)';
    ctx.lineWidth = Math.max(0.6, thick * 0.34);
    ctx.stroke();
    ctx.restore();
  }

  // ----- timeline -----
  const T = { travel: 6500, pulse: 19000 };
  let travel = null, pulse = null;
  const rnd = (a, b) => a + Math.random() * (b - a);
  let lastNow = 0;
  // When an external sequencer owns the timing (strict 15s stagger across all
  // characters), it fires each traversal itself and the self-timer stands down.
  let manualTravel = false;
  window.__cineTravelOnce = function(){ travel = { t0: performance.now() }; };
  window.__cineSetManual = function(v){ manualTravel = !!v; };

  function frame(override){
    if (window.__cineStop && typeof override !== 'number') return;
    const now = (typeof override === 'number') ? override : performance.now();
    const dt = Math.min(now - lastNow, 100);
    lastNow = now;
    ctx.clearRect(0, 0, W, H);

    // far layer: parallax skyline + drifting motes
    const sink = Math.min(window.scrollY * 0.06, 120);
    if (sky) ctx.drawImage(sky, 0, H - skyH + sink);
    if (sky) ctx.drawImage(sky, -sky.width, H - skyH + sink);
    if (sky) ctx.drawImage(sky, sky.width, H - skyH + sink);
    for (const m of motes){
      m.y -= (0.00002 + 0.00005 * m.z) * dt;
      m.x -= 0.00001 * m.z * dt;
      if (m.y < -0.02){ m.y = 1.02; m.x = Math.random(); }
      if (m.x < -0.02) m.x = 1.02;
      ctx.globalAlpha = 0.05 + 0.09 * m.z;
      ctx.fillStyle = m.z > 0.7 ? 'rgba(255,90,100,1)' : 'rgba(210,220,235,1)';
      ctx.beginPath();
      ctx.arc(m.x * W, (m.y * H + sink * m.z * 0.4) % H, m.r * m.z, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Background traveller: ONE cinematic web-swing that enters from OFF-SCREEN, arcs
    // across the viewport on a realistic pendulum trajectory (a hero swinging between
    // buildings), and exits OFF-SCREEN on the far side. Because the swing's slow apexes
    // now happen beyond the screen edges, there is no static on-screen hang or fade-in.
    // The web runs taut from the hero's hand to a fixed anchor far off-screen above.
    // Direction is theme-locked: Spider-Man right→left, Venom left→right.
    if (!manualTravel && !travel && now >= T.travel) travel = { t0: now };
    if (travel){
      const venom = window.__venomMode();
      const dir = venom ? 1 : -1;                        // +1 left→right (Venom), -1 right→left (Spider-Man)
      const sp = themeSprite();
      const margin = Math.max(160, W * 0.12);            // arc endpoints land fully off-screen
      const thMax = 0.60;                                // swing amplitude (radians)
      const L     = (W / 2 + margin) / Math.sin(thMax);  // web length so the sweep reaches past both edges
      const midY  = 0.50 * H;                            // arc's low point sits at mid-height
      const Ay    = midY - L;                            // web anchor, far off-screen above
      const Ax    = W * 0.5;                             // anchor centred → web fans through the middle
      const DU    = 2200;                                // one cinematic off-screen→off-screen pass
      const e = now - travel.t0;
      if (e < DU && sp){
        const tau = e / DU;                                   // 0..1 across the single swing
        const th = -dir * thMax * Math.cos(Math.PI * tau);    // pendulum SHM: swift mid, slow (off-screen) ends
        const x = Ax + L * Math.sin(th);
        const y = Ay + L * Math.cos(th);
        const baseH = Math.min(H * 0.10, 104);                // small, subtle, never blocks text
        const depth = 1 + 0.06 * Math.cos(th);
        const hgt = baseH * depth;
        ctx.globalAlpha = travelAlpha();                      // off-screen at both ends → no fade needed
        const gx = x, gy = y - hgt * 0.42;                    // grip near the sprite's top (the hand)
        if (venom){
          symbioteStrand(gx, gy, Ax, Ay, th * 3, 2.6);        // Venom keeps its black symbiote tendril
        } else {
          ctx.save();                                          // Spider-Man: pure-white glowing web line
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 2.0;
          ctx.shadowColor = 'rgba(255,255,255,0.95)';
          ctx.shadowBlur = 16;
          ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(Ax, Ay); ctx.stroke();
          ctx.shadowBlur = 0;                                  // crisp #ffffff core over the glow
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.0;
          ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(Ax, Ay); ctx.stroke();
          ctx.restore();
        }
        drawSprite(sp, x, y, hgt, 1, 1, th * 0.5);            // lean into the swing
        ctx.globalAlpha = 1;
      } else if (e >= DU){
        travel = null;
        if (!manualTravel) T.travel = now + rnd(15000, 20000);   // legacy self-timer cadence
      }
    }

    // theme power pulse: vignette bloom only, no character art
    if (!pulse && now >= T.pulse) pulse = { t0: now };
    if (pulse){
      const e = now - pulse.t0, UP = 900, HOLD = 3000, DOWN = 800;
      let k;
      if (e < UP) k = ease(e / UP);
      else if (e < UP + HOLD) k = 1;
      else if (e < UP + HOLD + DOWN) k = 1 - ease((e - UP - HOLD) / DOWN);
      else { pulse = null; T.pulse = now + rnd(46000, 58000); k = 0; }
      if (pulse){
        const t = now / 1000;
        ctx.globalAlpha = 0.20 * k * (0.8 + 0.2 * Math.sin(t * 5));
        ctx.fillStyle = vign;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    }

    if (/[?&]cinedbg=1/.test(location.search)) {
      window.__cineDraw = frame;
      window.__cineReset = function(){ travel = null; pulse = null; T.travel = 6500; T.pulse = 19000; lastNow = 0; };
      window.__cineState = { now: now, travel: !!travel, pulse: !!pulse, W: W, H: H };
    }
    requestAnimationFrame(frame);
  }
  if (/[?&]cinedbg=1/.test(location.search)) {
    window.__cineDraw = frame;
    window.__cineReset = function(){ travel = null; pulse = null; T.travel = 6500; T.pulse = 19000; lastNow = 0; };
    window.__cineSprites = sprites;
  }
  requestAnimationFrame(frame);
})();

// ===== cinematic sequencer: one performer at a time, strict 15s gap =====
// Owns ALL timing across the canvas web-swing traveller AND the DOM actors so
// nothing ever triggers at once — each appearance finishes and departs before
// the next starts after a fixed gap. Actors are one-shot .is-on appearances;
// the traveller is fired manually (__cineTravelOnce) with the cinema self-timer
// stood down (__cineSetManual(true)).
(function(){
  const PAGE = { '': 'index', 'index.html': 'index', 'about.html': 'about', 'projects.html': 'projects', 'contact.html': 'contact' };
  const page = () => { const b = location.pathname.split('/').pop(); return PAGE[b] || 'index'; };
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const GAP = 15000;          // strict gap between performers
  const TRAVEL_MS = 2200;     // canvas web-shot traversal duration (+ margin)
  // [id, duration ms] — each entry is a single one-shot appearance
  const CAST = {
    dark:  { index:    [['fly', 6000], ['hang', 7000]],
             about:    [['fly', 6000]],
             projects: [['fly', 6000], ['hang', 7000]],
             contact:  [['fly', 6000], ['hang', 7000]] },
    venom: { index:    [['vensp', 7000], ['corner', 7000]],
             about:    [['mc', 7000],    ['corner', 7000]],
             projects: [['vensp', 7000], ['corner', 7000]],
             contact:  [['mc', 7000],    ['corner', 7000]] }
  };
  const SRC = {
    hang:   'assets/images/hang-spider.png',
    fly:    'assets/images/fly-spider.png',
    vensp:  'assets/images/ven-spider.png',
    mc:     'assets/images/mc venome.png',
    corner: 'assets/images/ven-in corner.png'
  };
  let layer = null, elems = [], performers = [], timers = [], idx = 0;
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const wait = (ms, fn) => { timers.push(setTimeout(fn, ms)); };

  function runSlot(){
    if (!performers.length) return;
    const p = performers[idx % performers.length]; idx++;
    if (p.kind === 'travel'){
      if (typeof window.__cineTravelOnce === 'function') window.__cineTravelOnce();
      wait(TRAVEL_MS + GAP, runSlot);
    } else {
      p.el.classList.add('is-on');
      wait(p.dur, () => { p.el.classList.remove('is-on'); wait(GAP, runSlot); });
    }
  }

  function build(){
    clearTimers();
    elems.forEach(e => e.classList.remove('is-on'));
    const theme = window.__venomMode() ? 'venom' : 'dark';
    const cast = CAST[theme][page()] || [];
    if (!layer){
      layer = document.createElement('div');
      layer.id = 'actor-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
    }
    layer.innerHTML = '';
    elems = []; performers = []; idx = 0;
    if (typeof window.__cineSetManual === 'function') window.__cineSetManual(true);
    if (!reduce && typeof window.__cineTravelOnce === 'function') performers.push({ kind: 'travel' });
    for (const [id, dur] of cast){
      const wrap = document.createElement('div');
      wrap.className = 'actor actor--' + id;
      const img = document.createElement('img');
      img.src = SRC[id];
      img.alt = '';
      img.draggable = false;
      img.decoding = 'async';
      wrap.style.setProperty('--dur', (dur / 1000) + 's');
      wrap.appendChild(img);
      layer.appendChild(wrap);
      elems.push(wrap);
      performers.push({ kind: 'actor', el: wrap, dur: dur });
    }
    if (reduce || !performers.length) return;
    wait(1200, runSlot);
  }
  build();
  new MutationObserver(build).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();

// ============================================
// R2/R3: THEME POWER EFFECTS (webs vs. tendrils)
// One canvas, one rAF. In Spider-Man mode it draws
// glossy metallic web-lines fired from clicks and
// scroll bursts; in Venom mode it draws organic black
// symbiote tendrils that crawl and pulse around the
// borders. The mode branch is exclusive, so a web can
// never render in Venom and a tendril never in dark.
// ============================================
(function(){
  const cv = document.createElement('canvas');
  cv.id = 'power-fx';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  if (!ctx) return;

  let W = 0, H = 0, DPR = 1;
  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (window.__venomMode()) seedTendrils();
  }

  const webs = [];       // dark-mode shots
  const tendrils = [];   // venom-mode border growths

  // --- Spider-Man: a burst of web spokes from a point ---
  function shootWeb(x, y){
    if (window.__venomMode()) return;              // strict isolation
    const spokes = 5 + (Math.random() * 3 | 0);
    const base = Math.random() * Math.PI * 2;
    for (let i = 0; i < spokes; i++){
      const ang = base + (Math.PI * 2 / spokes) * i + (Math.random() - 0.5) * 0.5;
      const len = Math.min(W, H) * (0.22 + Math.random() * 0.42);
      webs.push({ x, y, ang, len, born: performance.now(), life: 460 + Math.random() * 240 });
    }
    if (webs.length > 220) webs.splice(0, webs.length - 220);
  }

  // --- Venom: seed tendrils anchored to the four borders ---
  function seedTendrils(){
    tendrils.length = 0;
    if (!window.__venomMode()) return;             // strict isolation
    const n = Math.max(7, Math.round((W + H) / 200));
    for (let i = 0; i < n; i++){
      const edge = i % 4;                          // 0 top, 1 right, 2 bottom, 3 left
      const p = Math.random();
      let x, y;
      if (edge === 0){ x = p * W; y = 0; }
      else if (edge === 1){ x = W; y = p * H; }
      else if (edge === 2){ x = p * W; y = H; }
      else { x = 0; y = p * H; }
      tendrils.push({
        x, y, edge,
        phase: Math.random() * Math.PI * 2,
        len: 54 + Math.random() * 120,
        speed: 0.5 + Math.random() * 0.85
      });
    }
  }

  function drawWebs(now){
    ctx.lineCap = 'round';
    for (let i = webs.length - 1; i >= 0; i--){
      const w = webs[i];
      const k = (now - w.born) / w.life;
      if (k >= 1){ webs.splice(i, 1); continue; }
      const grow = Math.min(1, k * 2.4);           // fast shoot-out
      const ex = w.x + Math.cos(w.ang) * w.len * grow;
      const ey = w.y + Math.sin(w.ang) * w.len * grow;
      const a = (1 - k) * 0.8;
      const g = ctx.createLinearGradient(w.x, w.y, ex, ey);
      g.addColorStop(0, 'rgba(238,246,255,' + a + ')');
      g.addColorStop(0.45, 'rgba(190,214,244,' + (a * 0.85) + ')');
      g.addColorStop(1, 'rgba(120,150,195,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(200,225,255,' + (a * 0.55) + ')';
      ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(ex, ey); ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  function drawTendrils(now){
    const t = now * 0.001;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const td of tendrils){
      const inwardY = td.edge === 0 ? 1 : td.edge === 2 ? -1 : 0;
      const inwardX = td.edge === 3 ? 1 : td.edge === 1 ? -1 : 0;
      const surge = 0.55 + 0.45 * Math.sin(t * td.speed * 2.1 + td.phase);
      const segs = 14;
      ctx.beginPath();
      ctx.moveTo(td.x, td.y);
      for (let s = 1; s <= segs; s++){
        const f = s / segs;
        const wig = Math.sin(t * td.speed * 3.2 + td.phase + f * 6.5) * 16 * f;
        const nx = td.x + inwardX * td.len * f * surge + (inwardX ? 0 : wig);
        const ny = td.y + inwardY * td.len * f * surge + (inwardY ? 0 : wig);
        ctx.lineTo(nx, ny);
      }
      // black organic body, then a faint alien-white rim so it reads on black
      ctx.strokeStyle = 'rgba(0,0,0,' + (0.6 * surge + 0.15) + ')';
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(232,244,238,' + (0.16 * surge) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // click → web burst (Spider-Man) ; scroll bursts → edge web (Spider-Man)
  document.addEventListener('click', (e) => shootWeb(e.clientX, e.clientY), { passive: true });
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    if (window.__venomMode()) return;              // tendrils own the venom borders
    const now = performance.now();
    if (now - lastScroll < 150) return;
    lastScroll = now;
    const edge = Math.random() * 4 | 0;
    let x, y;
    if (edge === 0){ x = Math.random() * W; y = 0; }
    else if (edge === 1){ x = W; y = Math.random() * H; }
    else if (edge === 2){ x = Math.random() * W; y = H; }
    else { x = 0; y = Math.random() * H; }
    shootWeb(x, y);
  }, { passive: true });

  let themeWas = window.__venomMode();
  function frame(now){
    const venom = window.__venomMode();
    if (venom !== themeWas){                        // on swap, purge the other mode's FX
      themeWas = venom;
      if (venom){ webs.length = 0; seedTendrils(); }
      else { tendrils.length = 0; }
    }
    ctx.clearRect(0, 0, W, H);
    if (venom) drawTendrils(now); else drawWebs(now);
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);

  window.__powerFx = { shootWeb, seedTendrils, webs, tendrils, canvas: cv };
})();
