/* ============================================================
   js/projects.js — data-driven project renderer
   ------------------------------------------------------------
   Single source of truth: data/projects.json (committed, fetched
   on load). An owner-only localStorage overlay (written by the
   hidden admin panel) can add / edit / pin / delete projects for
   local preview; "Export" in the panel produces a new JSON file to
   publish for everyone.

   Renders into mount points that already exist in the markup:
     projects.html -> #projects-mount (full feature-cards, alternating
                      plain / section-alt sections, + skill-groups)
                      #projects-count ("Log: NN entries")
     index.html    -> #featured-project-mount (top project, full card)
                      #other-projects-mount   (rest, compact proj-rows)

   Output markup is intentionally identical to the previous hardcoded
   HTML so card styling, typography, the CSS terminal simulation and
   both themes match exactly. All timing/order is priority-driven:
   pinned first, then higher priority, then original order.
   ============================================================ */
(function () {
  'use strict';

  var DATA_URL = 'data/projects.json';
  var STORE_KEY = 'mja-projects-overlay';

  // ---- small helpers -------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Long-form copy fields are trusted owner-authored HTML (may contain <em>).
  function raw(s) { return String(s == null ? '' : s); }
  function pad2(n) { return String(n).padStart(2, '0'); }

  function sortByPriority(list) {
    return list
      .map(function (p, i) { return { p: p, i: i }; })
      .sort(function (a, b) {
        var ap = a.p.pinned ? 1 : 0, bp = b.p.pinned ? 1 : 0;
        if (ap !== bp) return bp - ap;                       // pinned float to top
        var ar = typeof a.p.priority === 'number' ? a.p.priority : 0;
        var br = typeof b.p.priority === 'number' ? b.p.priority : 0;
        if (br !== ar) return br - ar;                        // higher priority first
        return a.i - b.i;                                     // stable fallback
      })
      .map(function (o) { return o.p; });
  }

  // ---- terminal "device" simulation ---------------------------------
  function deviceHead(d, name) {
    if (d.logo) {
      var badge = d.badge ? '<span class="live-badge">' + esc(d.badge) + '</span>' : '';
      return '<div class="device-head">' +
               '<div class="device-brand">' +
                 '<img src="' + esc(d.logo) + '" alt="' + esc(name) + ' Logo" class="device-logo">' +
                 '<span>' + esc(d.brandText) + '</span>' +
               '</div>' + badge +
             '</div>';
    }
    var right = d.headRight ? '<span>' + esc(d.headRight) + '</span>' : '';
    return '<div class="device-head"><span>' + esc(d.brandText) + '</span>' + right + '</div>';
  }

  function deviceFrame(d) {
    var sweep = d.sweep ? '<div class="scan-sweep"></div>' : '';
    var log = (d.log || []).map(function (l) {
      return '<span><i>' + esc(l.tag) + '</i>' + esc(l.text) + '</span>';
    }).join('');
    return '<div class="frame">' + sweep +
             '<div class="scan-log">' + log + '</div>' +
             '<div class="reticle"></div>' +
             '<div class="result-line">' + esc(d.resultText) + '<span class="val">' + esc(d.resultVal) + '</span></div>' +
           '</div>';
  }

  function device(p) {
    var d = p.device || {};
    return '<div class="device">' + deviceHead(d, p.name) + deviceFrame(d) + '</div>';
  }

  // ---- shared copy blocks -------------------------------------------
  function tagRow(tags) {
    if (!tags || !tags.length) return '';
    return '<div class="tag-row">' + tags.map(function (t) {
      return '<span class="tag' + (isCoreTag(t) ? ' tag--core' : '') + '">' + esc(t) + '</span>';
    }).join('') + '</div>';
  }

  // Core engineering pillars (C++ / OOP / DSA, plus Java & C) get a glowing badge.
  function isCoreTag(t) {
    var s = String(t == null ? '' : t).toLowerCase().trim();
    if (s === 'c' || s === 'c++' || s === 'cpp' || s === 'java') return true;
    if (s.indexOf('oop') === 0 || s.indexOf('object-oriented') === 0) return true;
    if (s.indexOf('dsa') === 0 || s.indexOf('data structure') === 0 || s.indexOf('algorithm') === 0) return true;
    return false;
  }

  function linksBlock(links) {
    if (!links || !links.length) return '';
    var a = links.map(function (l) {
      var cls = 'btn ' + (l.style === 'primary' ? 'btn-primary' : 'btn-ghost');
      var ext = /^https?:/i.test(l.url || '');
      var attrs = ext ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + esc(l.url) + '"' + attrs + ' class="' + cls + '">' + esc(l.label) + '</a>';
    }).join('');
    return '<div class="feature-links">' + a + '</div>';
  }

  function identityBlock(logo, name, label, title) {
    if (logo) {
      return '<div class="project-header-identity">' +
               '<img src="' + esc(logo) + '" alt="' + esc(name) + ' Logo" class="project-header-logo">' +
               '<div>' +
                 '<span class="mono-label" style="margin-bottom:4px;">' + esc(label) + '</span>' +
                 '<h3 style="margin-bottom:0;">' + esc(title) + '</h3>' +
               '</div>' +
             '</div>';
    }
    return '<span class="mono-label">' + esc(label) + '</span><h3>' + esc(title) + '</h3>';
  }

  // ---- projects.html: full feature-card sections ---------------------
  function featureCardProjects(p) {
    var copy = '<div class="feature-copy">' +
      identityBlock(p.headerLogo, p.name, p.indexLabel, p.name) +
      '<p>' + raw(p.description) + '</p>' +
      tagRow(p.tags) + linksBlock(p.links) +
    '</div>';
    return '<div class="feature-card reveal">' + device(p) + copy + '</div>';
  }

  function skillGroups(p) {
    if (!p.skillGroups || !p.skillGroups.length) return '';
    var groups = p.skillGroups.map(function (g) {
      var items = (g.items || []).map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('');
      return '<div class="skill-group reveal"><span class="mono-label">' + esc(g.label) +
             '</span><ul style="margin-top:12px;">' + items + '</ul></div>';
    }).join('');
    return '<div class="skill-groups" style="margin-top:70px;">' + groups + '</div>';
  }

  function projectsSection(p, i) {
    var alt = (i % 2 === 1) ? ' class="section-alt"' : '';
    return '<section' + alt + '><div class="wrap">' + featureCardProjects(p) + skillGroups(p) + '</div></section>';
  }

  // ---- index.html: featured card + compact rows ----------------------
  function featuredBlock(p) {
    var flinks = p.featuredLinks ||
      (p.links || []).concat([{ label: 'Full Breakdown', url: 'projects.html', style: 'ghost' }]);
    var copy = '<div class="feature-copy">' +
      identityBlock(p.headerLogo, p.name, p.featuredLabel || '', p.featuredTitle || p.name) +
      '<p>' + raw(p.featuredDescription || p.description) + '</p>' +
      tagRow(p.tags) + linksBlock(flinks) +
    '</div>';
    return '<span class="mono-label reveal">Featured build</span>' +
      '<h2 class="section-title reveal" style="margin-top:14px;">' + esc(p.name) + '</h2>' +
      '<p class="section-sub reveal">' + esc(p.featuredTagline || '') + '</p>' +
      '<div class="feature-card reveal">' + device(p) + copy + '</div>';
  }

  function projRow(p, n) {
    var links = p.rowLinks || p.links || [];
    var linksHtml = links.map(function (l) {
      var cls = 'btn ' + (l.style === 'primary' ? 'btn-primary' : 'btn-ghost');
      var ext = /^https?:/i.test(l.url || '');
      var attrs = ext ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + esc(l.url) + '"' + attrs + ' class="' + cls + '">' + esc(l.label) + '</a>';
    }).join('');
    return '<div class="proj-row">' +
      '<span class="proj-index">' + pad2(n) + '</span>' +
      '<div><h4>' + esc(p.name) + '</h4><p>' + raw(p.short || p.description) + '</p></div>' +
      '<div class="proj-links">' + linksHtml + '</div>' +
    '</div>';
  }

  // ---- reveal wiring (reuses main.js when present) --------------------
  function initReveals(root) {
    if (typeof window.__initReveals === 'function') { window.__initReveals(root); return; }
    root.querySelectorAll('.reveal').forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; });
  }

  // ---- render ---------------------------------------------------------
  function render(list) {
    var sorted = sortByPriority(list || []);

    var pm = document.getElementById('projects-mount');
    if (pm) {
      pm.innerHTML = sorted.map(projectsSection).join('');
      var cnt = document.getElementById('projects-count');
      if (cnt) cnt.textContent = 'Log: ' + pad2(sorted.length) + ' entries';
      initReveals(pm);
    }

    var fm = document.getElementById('featured-project-mount');
    if (fm) {
      if (sorted.length) { fm.innerHTML = featuredBlock(sorted[0]); initReveals(fm); }
      else { fm.innerHTML = ''; }
    }

    var om = document.getElementById('other-projects-mount');
    if (om) {
      var rest = sorted.slice(1);
      om.innerHTML = rest.map(function (p, i) { return projRow(p, i + 1); }).join('');
      var sec = om.closest('section');
      if (sec) sec.style.display = rest.length ? '' : 'none';
      initReveals(om);
    }

    // content heights changed after injection — recompute scroll triggers
    try { if (window.ScrollTrigger) window.ScrollTrigger.refresh(); } catch (e) {}
  }

  // ---- data access (base file + owner overlay) ------------------------
  function getOverlay() {
    try { var s = localStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : null; }
    catch (e) { return null; }
  }
  function currentList() {
    var o = getOverlay();
    if (o && Array.isArray(o.projects)) return o.projects;
    return (window.__projectsBase && Array.isArray(window.__projectsBase.projects))
      ? window.__projectsBase.projects : [];
  }

  // Public API consumed by the hidden admin panel (js/admin.js).
  window.__projectsAPI = {
    dataUrl: DATA_URL,
    storeKey: STORE_KEY,
    render: render,
    refresh: function () { render(currentList()); },
    currentList: currentList,
    getOverlay: getOverlay,
    saveOverlay: function (obj) { try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch (e) {} },
    clearOverlay: function () { try { localStorage.removeItem(STORE_KEY); } catch (e) {} },
    sortPreview: sortByPriority
  };

  // ---- hidden admin bootstrap -----------------------------------------
  // admin.js is NEVER referenced in the public HTML. It is injected at runtime
  // either when the secret URL parameter ?mja-admin is present, OR when one of
  // the alternative hidden triggers fires (Ctrl+Shift+A, or a rapid 5-click on
  // the footer copyright). SECURITY: these triggers only reveal the SAME
  // password-gated modal — admin.js still requires the master password and a
  // trigger never unlocks the console. A normal visitor never requests it.
  var adminState = { injected: false, api: null };

  function ensureAdmin(onReady) {
    if (adminState.api) { if (onReady) onReady(adminState.api); return; }
    if (window.__mjaAdmin) { adminState.api = window.__mjaAdmin; if (onReady) onReady(adminState.api); return; }
    if (!adminState.injected) {
      adminState.injected = true;
      var s = document.createElement('script');
      s.src = 'js/admin.js';
      s.onload = function () { adminState.api = window.__mjaAdmin || null; if (onReady) onReady(adminState.api); };
      s.onerror = function () { adminState.injected = false; };
      document.body.appendChild(s);
    } else if (onReady) {
      // script already added but its API isn't defined yet — wait briefly
      var tries = 0;
      (function poll() {
        if (window.__mjaAdmin) { adminState.api = window.__mjaAdmin; onReady(adminState.api); }
        else if (++tries < 40) setTimeout(poll, 50);
      })();
    }
  }

  // Reveal the auth modal from a hidden trigger. First injection auto-shows the
  // lock screen; later triggers ask the already-loaded console to re-open.
  function openAdminViaTrigger() {
    ensureAdmin(function (api) { if (api && api.openAuth) api.openAuth(); });
  }

  function maybeBootAdmin() {
    try {
      if (new URLSearchParams(location.search).has('mja-admin')) ensureAdmin(null);
    } catch (e) {}
  }

  // ---- alternative hidden triggers ------------------------------------
  function installAdminTriggers() {
    // (1) Global keyboard shortcut: Ctrl + Shift + A
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a' || e.code === 'KeyA')) {
        e.preventDefault();
        openAdminViaTrigger();
      }
    });

    // (2) Rapid multi-click: 5 clicks within a short window on the footer
    //     copyright. The footer copyright is static text, so this never
    //     interferes with navigation (the logo is a live link, so it is not
    //     used here to avoid hijacking normal home-link clicks).
    var CLICKS_NEEDED = 5, WINDOW_MS = 1200, clicks = 0, clickTimer = null;
    function bump() {
      clicks++;
      clearTimeout(clickTimer);
      if (clicks >= CLICKS_NEEDED) { clicks = 0; openAdminViaTrigger(); return; }
      clickTimer = setTimeout(function () { clicks = 0; }, WINDOW_MS);
    }
    Array.prototype.forEach.call(document.querySelectorAll('.f-left'), function (node) {
      node.addEventListener('click', bump);
    });
  }

  // ---- init -----------------------------------------------------------
  function init() {
    installAdminTriggers();
    fetch(DATA_URL, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (base) {
        window.__projectsBase = base;
        render(currentList());
        maybeBootAdmin();
      })
      .catch(function (err) {
        // Leave the (empty) mounts untouched rather than fabricate content.
        console.warn('[projects] could not load ' + DATA_URL + ':', err);
        maybeBootAdmin();
      });
  }

  init();
})();
