/* ============================================================
   js/admin.js — HIDDEN, owner-only project console
   ------------------------------------------------------------
   PRIVACY MODEL (read this):
   • This file is NEVER referenced in the public HTML. It is
     injected at runtime by js/projects.js ONLY when the secret
     URL parameter ?mja-admin is present, so a normal visitor or
     recruiter never even requests it and never sees any control.
   • Even with the URL parameter, the console stays locked behind
     a master password (SHA-256 compared in-browser).
   • HONEST LIMITATION: this is a static site with no server, so
     this is *obscurity + a client-side gate*, NOT cryptographic
     security — anyone who reads this source can find the default
     hash, and browser-side auth can always be bypassed by a
     determined person. It is fine for hiding project management
     from casual visitors; it is NOT a substitute for real
     server-side auth. Change the default password below.

   PASSWORD RECOVERY: the owner can set a *recovery seed* (stored
   only as a SHA-256 hash in localStorage). From the lock screen,
   "Forgot password?" verifies that seed and allows a new master
   password — no DevTools needed. If no seed was ever set, the
   modal documents the localStorage fallback (delete the
   mja-admin-passhash key → password resets to the built-in
   default). Recovery lives ONLY behind the secret ?mja-admin URL
   and still requires the seed, so public visitors can neither see
   nor trigger it. Closing the console (✕ / Esc / Close) strips
   ?mja-admin from the address bar via history.replaceState.

   Edits are stored in a localStorage overlay for instant local
   preview. "Export projects.json" downloads the merged file — you
   replace data/projects.json with it to publish for all visitors.
   ============================================================ */
(function () {
  'use strict';

  var API = window.__projectsAPI;
  if (!API) return;

  var DEFAULT_PASS_HASH = '1938d18f8adceb3a2edccb9d24b74f7e30e00ed6c8490e61062a870b32c42a8a';
  var PASS_KEY = 'mja-admin-passhash';
  var RECOVERY_KEY = 'mja-admin-recovery';   // SHA-256 of the owner's recovery seed
  var UNLOCK_KEY = 'mja-admin-unlocked';

  var working = clone(API.currentList());   // live editable copy
  var root = null;
  var activeModal = null;                    // top-most themed dialog (password / recovery)

  function countPinned() {
    var n = 0;
    for (var i = 0; i < working.length; i++) { if (working[i].pinned) n++; }
    return n;
  }
  // same order the public pages use: pinned first, then higher priority, then original index
  function sortedView() { return API.sortPreview(working); }

  // ---- utils ---------------------------------------------------------
  function clone(o) { return JSON.parse(JSON.stringify(o == null ? null : o)); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); }
    if (html != null) n.innerHTML = html;
    return n;
  }
  function sha256(str) {
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error('crypto.subtle unavailable (needs https or localhost)'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
      .then(function (buf) { return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''); });
  }
  function slug(s) {
    return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || ('project-' + Date.now().toString(36));
  }
  function getStored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function setStored(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  // list-field encoders (textarea <-> array)
  function tagsToStr(a) { return (a || []).join(', '); }
  function strToTags(s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  function linksToStr(a) { return (a || []).map(function (l) { return [l.label, l.url, l.style || 'ghost'].join(' | '); }).join('\n'); }
  function strToLinks(s) {
    return String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean).map(function (line) {
      var p = line.split('|').map(function (x) { return x.trim(); });
      return { label: p[0] || 'Link', url: p[1] || '#', style: p[2] === 'primary' ? 'primary' : 'ghost' };
    });
  }
  function logToStr(a) { return (a || []).map(function (l) { return [l.tag, l.text].join(' | '); }).join('\n'); }
  function strToLog(s) {
    return String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean).map(function (line) {
      var i = line.indexOf('|');
      return i < 0 ? { tag: '', text: line } : { tag: line.slice(0, i).trim(), text: line.slice(i + 1).trim() };
    });
  }
  function groupsToStr(a) { return (a || []).map(function (g) { return g.label + ' :: ' + (g.items || []).join(' ; '); }).join('\n'); }
  function strToGroups(s) {
    return String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean).map(function (line) {
      var i = line.indexOf('::');
      var label = i < 0 ? line : line.slice(0, i).trim();
      var items = i < 0 ? [] : line.slice(i + 2).split(';').map(function (x) { return x.trim(); }).filter(Boolean);
      return { label: label, items: items };
    });
  }

  // ---- persistence ---------------------------------------------------
  function persist() {
    API.saveOverlay({ version: 1, projects: working });
    API.refresh();               // live preview on the page behind the panel
    renderList();
  }
  // ▲/▼: step this project's priority by exactly ±1 (▲ = +1, ▼ = −1) and re-render live.
  function stepPriority(p, delta) {
    p.priority = (Number(p.priority) || 0) + delta;
    persist();
  }
  function exportJson() {
    var payload = { version: 1, projects: working };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: 'projects.json' });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('projects.json downloaded — replace data/projects.json to publish.');
  }
  function resetToPublished() {
    if (!confirm('Discard all local admin changes and reload the published data/projects.json?')) return;
    API.clearOverlay();
    working = clone((window.__projectsBase && window.__projectsBase.projects) || []);
    API.refresh(); renderList();
    toast('Reset to published data.');
  }

  // ---- styles (self-contained, off the public stylesheet) ------------
  function injectStyles() {
    if (document.getElementById('mjadmin-style')) return;
    var css = ''
      + '.mjadmin-root{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;'
      + 'background:rgba(2,4,8,.72);backdrop-filter:blur(6px);font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#dfe7ee;}'
      + '.mjadmin-panel{width:min(940px,94vw);max-height:90vh;overflow:auto;background:#0b0f16;border:1px solid rgba(20,232,200,.28);'
      + 'border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.03) inset;}'
      + '.mjadmin-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.08);position:sticky;top:0;background:#0b0f16;z-index:2;}'
      + '.mjadmin-head h2{margin:0;font-size:14px;letter-spacing:.14em;color:#14e8c8;text-transform:uppercase;}'
      + '.mjadmin-head .sp{flex:1;}'
      + '.mjadmin-body{padding:16px 18px;}'
      + '.mjadmin-note{font-size:11.5px;color:#9aa7b2;background:rgba(255,196,0,.07);border:1px solid rgba(255,196,0,.28);'
      + 'border-radius:8px;padding:8px 10px;margin:0 0 14px;}'
      + '.mjadmin-btn{cursor:pointer;border:1px solid rgba(20,232,200,.4);background:rgba(20,232,200,.1);color:#c8fff4;'
      + 'border-radius:8px;padding:7px 12px;font:inherit;font-size:12.5px;letter-spacing:.03em;}'
      + '.mjadmin-btn:hover{background:rgba(20,232,200,.2);}'
      + '.mjadmin-btn.ghost{border-color:rgba(255,255,255,.18);background:transparent;color:#cdd6de;}'
      + '.mjadmin-btn.danger{border-color:rgba(255,80,80,.45);background:rgba(255,60,60,.12);color:#ffd6d6;}'
      + '.mjadmin-btn.x{padding:4px 9px;line-height:1;}'
      + '.mjadmin-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(255,255,255,.08);'
      + 'border-radius:10px;margin-bottom:8px;background:rgba(255,255,255,.02);}'
      + '.mjadmin-row .nm{font-weight:600;color:#eaf2f6;}'
      + '.mjadmin-row .id{font-size:11px;color:#7f8b95;}'
      + '.mjadmin-row .sp{flex:1;}'
      + '.mjadmin-pin{display:flex;align-items:center;gap:6px;font-size:12px;color:#9fe8da;}'
      + '.mjadmin-prio{width:64px;background:#0e141c;border:1px solid rgba(255,255,255,.14);color:#dfe7ee;border-radius:6px;padding:4px 6px;font:inherit;}'
      + 'label.mjadmin-f{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8fa0ad;margin:12px 0 4px;}'
      + '.mjadmin-in,.mjadmin-ta{width:100%;box-sizing:border-box;background:#0e141c;border:1px solid rgba(255,255,255,.14);'
      + 'color:#e8eef3;border-radius:8px;padding:8px 10px;font:inherit;font-size:13px;}'
      + '.mjadmin-ta{min-height:64px;resize:vertical;white-space:pre;}'
      + '.mjadmin-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;}'
      + '.mjadmin-chk{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:#cdd6de;}'
      + '.mjadmin-lock{width:min(420px,92vw);}'
      + '.mjadmin-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#0e1a18;color:#c8fff4;'
      + 'border:1px solid rgba(20,232,200,.4);border-radius:10px;padding:10px 16px;font-size:12.5px;z-index:100000;box-shadow:0 10px 40px rgba(0,0,0,.5);}'
      + '.mjadmin-hint{font-size:11px;color:#7f8b95;margin:4px 0 0;}'
      + '.mjadmin-legend{font-size:11.5px;color:#9aa7b2;background:rgba(20,232,200,.06);border:1px solid rgba(20,232,200,.22);'
      + 'border-radius:8px;padding:8px 10px;margin:0 0 8px;line-height:1.55;}'
      + '.mjadmin-legend b{color:#c8fff4;}'
      + '.mjadmin-pinstatus{font-size:11.5px;color:#9fe8da;margin:0 0 10px;letter-spacing:.03em;}'
      + '.mjadmin-modal-root{z-index:100001;}'
      + '.mjadmin-modal{width:min(470px,92vw);}'
      + '.mjadmin-link{margin-top:14px;background:none;border:none;color:#7fd8ff;cursor:pointer;font:inherit;font-size:11.5px;text-decoration:underline;padding:0;}'
      + '.mjadmin-link:hover{color:#c8fff4;}'
      + '.mjadmin-seed{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:15px;letter-spacing:.06em;color:#c8fff4;'
      + 'background:#0e1a18;border:1px solid rgba(20,232,200,.4);border-radius:8px;padding:12px 14px;margin-top:10px;word-break:break-all;user-select:all;}'
      + '@media(max-width:720px){.mjadmin-grid{grid-template-columns:1fr;}}';
    document.head.appendChild(el('style', { id: 'mjadmin-style' }, css));
  }

  var toastTimer = null;
  function toast(msg) {
    var t = el('div', { class: 'mjadmin-toast' });
    t.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 3200);
  }

  // ---- URL clean-up ---------------------------------------------------
  // Strip the secret ?mja-admin parameter so closing the console restores the
  // clean, shareable portfolio URL (no reload — history.replaceState only).
  function cleanUrl() {
    try {
      var u = new URL(location.href);
      if (!u.searchParams.has('mja-admin')) return;
      u.searchParams.delete('mja-admin');
      var qs = u.searchParams.toString();
      history.replaceState(null, '', u.pathname + (qs ? '?' + qs : '') + u.hash);
    } catch (e) {}
  }

  // ---- themed modal helper (password / recovery dialogs) --------------
  function buildModal(title) {
    var overlay = el('div', { class: 'mjadmin-root mjadmin-modal-root' });
    var panel = el('div', { class: 'mjadmin-panel mjadmin-modal' });
    var head = el('div', { class: 'mjadmin-head' });
    head.appendChild(el('h2', {}, title));
    head.appendChild(el('div', { class: 'sp' }));
    var x = el('button', { class: 'mjadmin-btn ghost x' }, '✕');
    head.appendChild(x);
    var body = el('div', { class: 'mjadmin-body' });
    panel.appendChild(head); panel.appendChild(body); overlay.appendChild(panel);
    function close() { overlay.remove(); if (activeModal === api) activeModal = null; }
    x.addEventListener('click', close);
    var api = {
      body: body,
      close: close,
      open: function (focusEl) {
        document.body.appendChild(overlay);
        activeModal = api;
        if (focusEl) setTimeout(function () { focusEl.focus(); }, 40);
      }
    };
    return api;
  }

  // ---- lock screen ---------------------------------------------------
  function buildLock() {
    root = el('div', { class: 'mjadmin-root' });
    var panel = el('div', { class: 'mjadmin-panel mjadmin-lock' });
    var head = el('div', { class: 'mjadmin-head' }, '<h2>Owner Console</h2><div class="sp"></div>');
    var headX = el('button', { class: 'mjadmin-btn ghost x' }, '✕');
    head.appendChild(headX);
    panel.appendChild(head);
    var body = el('div', { class: 'mjadmin-body' });
    body.appendChild(el('p', { class: 'mjadmin-note' },
      'Client-side gate on a static site: this hides project management from visitors, but it is <b>not</b> true security. Anyone reading the JS can bypass it.'));
    body.appendChild(el('label', { class: 'mjadmin-f' }, 'Master password'));
    var pass = el('input', { class: 'mjadmin-in', type: 'password', id: 'mjadmin-pass', autocomplete: 'off' });
    body.appendChild(pass);
    var err = el('p', { class: 'mjadmin-hint', style: 'color:#ff9a9a;min-height:16px;' }, '');
    body.appendChild(err);
    var row = el('div', { style: 'display:flex;gap:8px;margin-top:14px;' });
    var unlock = el('button', { class: 'mjadmin-btn' }, 'Unlock');
    var cancel = el('button', { class: 'mjadmin-btn ghost' }, 'Close');
    row.appendChild(unlock); row.appendChild(cancel);
    body.appendChild(row);
    // Recovery is reachable only here — i.e. only through the secret ?mja-admin
    // URL — so a public visitor browsing the portfolio never sees this control.
    var recLink = el('button', { class: 'mjadmin-link' }, 'Forgot password? Use recovery seed');
    recLink.addEventListener('click', openRecoveryModal);
    body.appendChild(recLink);
    panel.appendChild(body);
    root.appendChild(panel);
    document.body.appendChild(root);
    setTimeout(function () { pass.focus(); }, 40);

    function attempt() {
      var v = pass.value;
      err.textContent = '';
      sha256(v).then(function (h) {
        var expected = getStored(PASS_KEY) || DEFAULT_PASS_HASH;
        if (h === expected) {
          try { sessionStorage.setItem(UNLOCK_KEY, '1'); } catch (e) {}
          openConsole();
        } else { err.textContent = 'Incorrect password.'; pass.value = ''; pass.focus(); }
      }).catch(function (e) { err.textContent = String(e.message || e); });
    }
    unlock.addEventListener('click', attempt);
    pass.addEventListener('keydown', function (e) { if (e.key === 'Enter') attempt(); });
    cancel.addEventListener('click', closeConsole);
    headX.addEventListener('click', closeConsole);
  }

  function destroy() { if (root) { root.remove(); root = null; } }
  function closeConsole() { destroy(); cleanUrl(); }

  // ---- console -------------------------------------------------------
  function openConsole() {
    destroy();
    root = el('div', { class: 'mjadmin-root' });
    var panel = el('div', { class: 'mjadmin-panel' });

    var head = el('div', { class: 'mjadmin-head' });
    head.appendChild(el('h2', {}, 'Project Console'));
    head.appendChild(el('div', { class: 'sp' }));
    var bAdd = el('button', { class: 'mjadmin-btn' }, '+ Add project');
    var bExp = el('button', { class: 'mjadmin-btn ghost' }, 'Export projects.json');
    var bRst = el('button', { class: 'mjadmin-btn ghost' }, 'Reset');
    var bPass = el('button', { class: 'mjadmin-btn ghost' }, 'Password');
    var bX = el('button', { class: 'mjadmin-btn ghost x' }, '✕');
    [bAdd, bExp, bRst, bPass, bX].forEach(function (b) { head.appendChild(b); });
    panel.appendChild(head);

    var body = el('div', { class: 'mjadmin-body' });
    body.appendChild(el('p', { class: 'mjadmin-note' },
      'Changes preview live on this page (localStorage only). To publish for all visitors, <b>Export projects.json</b> and replace <code>data/projects.json</code>.'));
    body.appendChild(el('div', { class: 'mjadmin-legend' },
      '<b>How ordering works:</b> 📌 pinned projects float to the very top; within a group <b>higher priority wins</b> '
      + '(e.g. <b>100</b> ranks above <b>50</b>). Use <b>▲</b> to add <b>+1</b> and <b>▼</b> to subtract <b>−1</b> from a '
      + 'project\'s priority — the list and the public pages re-order instantly, no reload needed — or type a number directly. '
      + 'Pinning is unlimited.'));
    var pinStatus = el('div', { class: 'mjadmin-pinstatus' }, '');
    body.appendChild(pinStatus);
    var listWrap = el('div', { id: 'mjadmin-list' });
    body.appendChild(listWrap);
    var editorWrap = el('div', { id: 'mjadmin-editor' });
    body.appendChild(editorWrap);
    panel.appendChild(body);
    root.appendChild(panel);
    document.body.appendChild(root);

    bX.addEventListener('click', closeConsole);
    bExp.addEventListener('click', exportJson);
    bRst.addEventListener('click', resetToPublished);
    bAdd.addEventListener('click', function () { openEditor(newProject(), true); });
    bPass.addEventListener('click', openPasswordModal);

    renderList();

    function renderList() {
      listWrap.innerHTML = '';
      var pinnedN = countPinned();
      pinStatus.textContent = '📌 Pinned: ' + pinnedN + (pinnedN === 1 ? ' project' : ' projects');
      pinStatus.className = 'mjadmin-pinstatus';
      if (!working.length) { listWrap.appendChild(el('p', { class: 'mjadmin-hint' }, 'No projects yet — click “+ Add project”.')); return; }
      var s = sortedView();
      s.forEach(function (p, i) {
        var row = el('div', { class: 'mjadmin-row' });
        var up = el('button', { class: 'mjadmin-btn ghost x', title: 'Raise priority (+1)' }, '▲');
        var dn = el('button', { class: 'mjadmin-btn ghost x', title: 'Lower priority (−1)' }, '▼');
        var meta = el('div', {}, '<div class="nm">' + escapeHtml(p.name || '(untitled)') + (p.pinned ? ' 📌' : '') + '</div><div class="id">' + escapeHtml(p.id || '') + '</div>');
        var sp = el('div', { class: 'sp' });
        var pin = el('label', { class: 'mjadmin-pin' });
        var pinBox = el('input', { type: 'checkbox' }); pinBox.checked = !!p.pinned;
        pin.appendChild(pinBox); pin.appendChild(document.createTextNode('Pin to top'));
        var prio = el('input', { class: 'mjadmin-prio', type: 'number', value: String(p.priority == null ? 0 : p.priority), title: 'Priority — higher floats to the top' });
        var ed = el('button', { class: 'mjadmin-btn ghost' }, 'Edit');
        var del = el('button', { class: 'mjadmin-btn danger' }, 'Delete');
        row.appendChild(up); row.appendChild(dn); row.appendChild(meta); row.appendChild(sp);
        row.appendChild(pin); row.appendChild(prio); row.appendChild(ed); row.appendChild(del);
        listWrap.appendChild(row);

        pinBox.addEventListener('change', function () { p.pinned = pinBox.checked; persist(); });
        prio.addEventListener('change', function () { p.priority = Number(prio.value) || 0; persist(); });
        up.addEventListener('click', function () { stepPriority(p, 1); });
        dn.addEventListener('click', function () { stepPriority(p, -1); });
        ed.addEventListener('click', function () { openEditor(p, false); });
        del.addEventListener('click', function () {
          if (!confirm('Delete “' + (p.name || p.id) + '”? (local preview only until you Export)')) return;
          working = working.filter(function (x) { return x !== p; }); persist();
        });
      });
    }
    // expose for persist()
    renderListRef = renderList;

    // ---- editor ----
    function openEditor(p, isNew) {
      var draft = clone(p);
      editorWrap.innerHTML = '';
      var box = el('div', { style: 'border:1px solid rgba(20,232,200,.25);border-radius:12px;padding:6px 14px 16px;margin-top:16px;background:rgba(20,232,200,.03);' });
      box.appendChild(el('h3', { style: 'margin:10px 0 0;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#14e8c8;' }, isNew ? 'New project' : 'Edit — ' + escapeHtml(p.name || '')));

      function field(labelText, value, isTa, onInput) {
        box.appendChild(el('label', { class: 'mjadmin-f' }, labelText));
        var inp = isTa ? el('textarea', { class: 'mjadmin-ta' }) : el('input', { class: 'mjadmin-in', type: 'text' });
        inp.value = value == null ? '' : value;
        inp.addEventListener('input', function () { onInput(inp.value); });
        box.appendChild(inp);
        return inp;
      }
      function chk(labelText, checked, onCh) {
        var l = el('label', { class: 'mjadmin-chk', style: 'margin-top:12px;' });
        var c = el('input', { type: 'checkbox' }); c.checked = !!checked;
        c.addEventListener('change', function () { onCh(c.checked); });
        l.appendChild(c); l.appendChild(document.createTextNode(' ' + labelText));
        box.appendChild(l);
      }

      var g = el('div', { class: 'mjadmin-grid' }); box.appendChild(g);
      function gridField(labelText, value, onInput) {
        var w = el('div');
        w.appendChild(el('label', { class: 'mjadmin-f' }, labelText));
        var inp = el('input', { class: 'mjadmin-in', type: 'text' }); inp.value = value == null ? '' : value;
        inp.addEventListener('input', function () { onInput(inp.value); });
        w.appendChild(inp); g.appendChild(w);
      }

      gridField('Name', draft.name, function (v) { draft.name = v; if (isNew && !idTouched) draft.id = slug(v); });
      gridField('ID (slug)', draft.id, function (v) { idTouched = true; draft.id = slug(v); });
      var idTouched = false;
      gridField('Projects-page label', draft.indexLabel, function (v) { draft.indexLabel = v; });
      gridField('Header logo path (optional)', draft.headerLogo, function (v) { draft.headerLogo = v || null; });
      gridField('Priority (number)', String(draft.priority == null ? 0 : draft.priority), function (v) { draft.priority = Number(v) || 0; });
      chk('Pin to top', draft.pinned, function (v) { draft.pinned = v; });

      field('Description (projects page — HTML allowed, e.g. &lt;em&gt;)', draft.description, true, function (v) { draft.description = v; });
      field('Short description (Home “Other work” row)', draft.short, true, function (v) { draft.short = v; });

      box.appendChild(el('label', { class: 'mjadmin-f' }, 'Featured (Home top card)'));
      gridField('Featured label', draft.featuredLabel, function (v) { draft.featuredLabel = v; });
      gridField('Featured title', draft.featuredTitle, function (v) { draft.featuredTitle = v; });
      field('Featured tagline (section subtitle)', draft.featuredTagline, true, function (v) { draft.featuredTagline = v; });
      field('Featured description', draft.featuredDescription, true, function (v) { draft.featuredDescription = v; });

      field('Tags (comma separated)', tagsToStr(draft.tags), false, function (v) { draft.tags = strToTags(v); });

      box.appendChild(el('label', { class: 'mjadmin-f' }, 'Terminal simulation (device)'));
      var d = draft.device = draft.device || {};
      gridField('Brand text', d.brandText, function (v) { d.brandText = v; });
      gridField('Device logo path (optional → brand layout)', d.logo, function (v) { d.logo = v || null; });
      gridField('Badge (e.g. LIVE, optional)', d.badge, function (v) { d.badge = v || null; });
      gridField('Head right text (plain layout, e.g. CLI)', d.headRight, function (v) { d.headRight = v || null; });
      chk('Scan sweep animation', d.sweep, function (v) { d.sweep = v; });
      field('Log lines — one per line:  [tag] | text', logToStr(d.log), true, function (v) { d.log = strToLog(v); });
      gridField('Result text (before value)', d.resultText, function (v) { d.resultText = v; });
      gridField('Result value (highlighted)', d.resultVal, function (v) { d.resultVal = v; });

      box.appendChild(el('label', { class: 'mjadmin-f' }, 'Links'));
      field('Projects-page links — one per line:  label | url | style(primary/ghost)', linksToStr(draft.links), true, function (v) { draft.links = strToLinks(v); });
      field('Home featured links (blank = projects links + Full Breakdown)', linksToStr(draft.featuredLinks), true, function (v) { var a = strToLinks(v); draft.featuredLinks = a.length ? a : null; });
      field('Home row links (compact)', linksToStr(draft.rowLinks), true, function (v) { draft.rowLinks = strToLinks(v); });

      field('Skill groups — one per line:  Label :: item ; item ; item', groupsToStr(draft.skillGroups), true, function (v) { draft.skillGroups = strToGroups(v); });

      var actions = el('div', { style: 'display:flex;gap:8px;margin-top:16px;' });
      var save = el('button', { class: 'mjadmin-btn' }, isNew ? 'Add project' : 'Save changes');
      var cancelE = el('button', { class: 'mjadmin-btn ghost' }, 'Cancel');
      actions.appendChild(save); actions.appendChild(cancelE); box.appendChild(actions);
      editorWrap.appendChild(box);
      editorWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });

      cancelE.addEventListener('click', function () { editorWrap.innerHTML = ''; });
      save.addEventListener('click', function () {
        if (!draft.name || !draft.name.trim()) { alert('Name is required.'); return; }
        if (!draft.id) draft.id = slug(draft.name);
        var dup = working.some(function (x) { return x.id === draft.id && x !== p; });
        if (dup) { alert('ID “' + draft.id + '” already exists. Choose a different name/id.'); return; }
        if (isNew) working.push(draft);
        else { var ix = working.indexOf(p); if (ix >= 0) working[ix] = draft; }
        editorWrap.innerHTML = '';
        persist();
        toast(isNew ? 'Project added (local preview).' : 'Changes saved (local preview).');
      });
    }
  }

  var renderListRef = null;
  function renderList() { if (renderListRef) renderListRef(); }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function newProject() {
    return {
      id: '', name: '', pinned: false, priority: 0,
      indexLabel: '00 — New project', headerLogo: null,
      description: '', featuredLabel: 'New build', featuredTitle: '', featuredTagline: '', featuredDescription: '',
      short: '', tags: [],
      device: { logo: null, brandText: 'NEW_PROJECT', badge: null, headRight: null, sweep: false, log: [{ tag: '[init]', text: 'project bootstrapped' }], resultText: 'STATUS: ', resultVal: '' },
      links: [], featuredLinks: null, rowLinks: [], skillGroups: []
    };
  }

  // ---- password change (themed modal) --------------------------------
  // Owner-only: reachable from the console header, which itself sits behind the
  // master-password lock. Lets the owner set a new password AND a recovery seed.
  function openPasswordModal() {
    var m = buildModal('Master Password');
    var body = m.body;
    body.appendChild(el('p', { class: 'mjadmin-note' },
      'Set a new master password and (recommended) a <b>recovery seed</b>. The seed lets you reset the password later '
      + 'straight from the lock screen — no DevTools needed. It is shown <b>only once</b>, so store it somewhere safe.'));
    body.appendChild(el('p', { class: 'mjadmin-hint', style: 'margin-bottom:6px;' },
      getStored(RECOVERY_KEY) ? 'Recovery seed: already set on this browser.' : 'Recovery seed: not set — recovery falls back to the documented localStorage reset.'));

    body.appendChild(el('label', { class: 'mjadmin-f' }, 'New master password'));
    var np = el('input', { class: 'mjadmin-in', type: 'password', autocomplete: 'new-password' }); body.appendChild(np);
    body.appendChild(el('label', { class: 'mjadmin-f' }, 'Repeat new master password'));
    var np2 = el('input', { class: 'mjadmin-in', type: 'password', autocomplete: 'new-password' }); body.appendChild(np2);
    body.appendChild(el('label', { class: 'mjadmin-f' }, 'Recovery seed (optional — blank keeps the current one)'));
    var rs = el('input', { class: 'mjadmin-in', type: 'text', autocomplete: 'off' }); body.appendChild(rs);
    var err = el('p', { class: 'mjadmin-hint', style: 'color:#ff9a9a;min-height:16px;' }, ''); body.appendChild(err);

    var row = el('div', { style: 'display:flex;gap:8px;margin-top:14px;' });
    var save = el('button', { class: 'mjadmin-btn' }, 'Save');
    var cancel = el('button', { class: 'mjadmin-btn ghost' }, 'Cancel');
    row.appendChild(save); row.appendChild(cancel); body.appendChild(row);
    cancel.addEventListener('click', m.close);

    save.addEventListener('click', function () {
      err.textContent = '';
      var a = np.value, seed = rs.value.trim();
      if (!a && !seed) { err.textContent = 'Enter a new password and/or a recovery seed.'; return; }
      if (a && a.length < 8) { err.textContent = 'Password must be at least 8 characters.'; return; }
      if (a && a !== np2.value) { err.textContent = 'Passwords do not match.'; return; }
      if (seed && seed.length < 8) { err.textContent = 'Recovery seed must be at least 8 characters.'; return; }
      var jobs = [];
      if (a) jobs.push(sha256(a).then(function (h) { setStored(PASS_KEY, h); }));
      if (seed) jobs.push(sha256(seed).then(function (h) { setStored(RECOVERY_KEY, h); }));
      Promise.all(jobs).then(function () {
        toast(a && seed ? 'Password + recovery seed updated.' : (a ? 'Master password updated.' : 'Recovery seed set.'));
        if (seed) revealSeed(m, seed); else m.close();
      }).catch(function (e) { err.textContent = String(e.message || e); });
    });
    m.open(np);
  }

  // One-time themed reveal of the recovery seed so the owner can copy it down.
  function revealSeed(m, seed) {
    var body = m.body;
    body.innerHTML = '';
    body.appendChild(el('p', { class: 'mjadmin-note' },
      'Recovery seed saved. <b>Write it down now</b> — it is never shown again.'));
    body.appendChild(el('div', { class: 'mjadmin-seed' }, escapeHtml(seed)));
    var row = el('div', { style: 'display:flex;gap:8px;margin-top:16px;' });
    var copy = el('button', { class: 'mjadmin-btn ghost' }, 'Copy');
    var done = el('button', { class: 'mjadmin-btn' }, 'Done');
    row.appendChild(copy); row.appendChild(done); body.appendChild(row);
    copy.addEventListener('click', function () {
      try { navigator.clipboard.writeText(seed); toast('Recovery seed copied to clipboard.'); }
      catch (e) { toast('Copy unavailable — select the seed and copy manually.'); }
    });
    done.addEventListener('click', m.close);
  }

  // ---- password recovery (themed modal, gated by the recovery seed) ----
  // Reached from the lock screen "Forgot password?" link, which only exists
  // behind the secret ?mja-admin URL. Reset requires the correct recovery seed,
  // so a visitor who guesses the URL still cannot reset without the seed.
  function openRecoveryModal() {
    var m = buildModal('Password Recovery');
    var body = m.body;
    body.appendChild(el('p', { class: 'mjadmin-note' },
      'Recovery is gated by your <b>recovery seed</b>. This panel is reachable only through the secret '
      + '<code>?mja-admin</code> URL, so public visitors browsing the portfolio never see it.'));

    if (!getStored(RECOVERY_KEY)) {
      body.appendChild(el('p', { class: 'mjadmin-hint', style: 'line-height:1.7;' },
        'No recovery seed is set on this browser. <b>Fallback reset:</b> open DevTools → Application → Local Storage → '
        + 'delete the <code>mja-admin-passhash</code> key → reload. The master password returns to the built-in default. '
        + '(An honest limitation of a static, server-less site — see the note at the top of js/admin.js.)'));
      var back = el('button', { class: 'mjadmin-btn ghost', style: 'margin-top:16px;' }, 'Back');
      back.addEventListener('click', m.close);
      body.appendChild(back);
      m.open();
      return;
    }

    body.appendChild(el('label', { class: 'mjadmin-f' }, 'Recovery seed'));
    var seedIn = el('input', { class: 'mjadmin-in', type: 'password', autocomplete: 'off' }); body.appendChild(seedIn);
    body.appendChild(el('label', { class: 'mjadmin-f' }, 'New master password'));
    var np = el('input', { class: 'mjadmin-in', type: 'password', autocomplete: 'new-password' }); body.appendChild(np);
    body.appendChild(el('label', { class: 'mjadmin-f' }, 'Repeat new master password'));
    var np2 = el('input', { class: 'mjadmin-in', type: 'password', autocomplete: 'new-password' }); body.appendChild(np2);
    var err = el('p', { class: 'mjadmin-hint', style: 'color:#ff9a9a;min-height:16px;' }, ''); body.appendChild(err);
    var row = el('div', { style: 'display:flex;gap:8px;margin-top:14px;' });
    var reset = el('button', { class: 'mjadmin-btn' }, 'Verify & reset');
    var cancel = el('button', { class: 'mjadmin-btn ghost' }, 'Cancel');
    row.appendChild(reset); row.appendChild(cancel); body.appendChild(row);
    cancel.addEventListener('click', m.close);

    reset.addEventListener('click', function () {
      err.textContent = '';
      var seed = seedIn.value.trim(), a = np.value;
      if (!seed) { err.textContent = 'Enter your recovery seed.'; return; }
      if (a.length < 8) { err.textContent = 'New password must be at least 8 characters.'; return; }
      if (a !== np2.value) { err.textContent = 'Passwords do not match.'; return; }
      sha256(seed).then(function (hs) {
        if (hs !== getStored(RECOVERY_KEY)) { err.textContent = 'Recovery seed incorrect.'; seedIn.value = ''; seedIn.focus(); return; }
        return sha256(a).then(function (h) {
          setStored(PASS_KEY, h);
          m.close();
          toast('Master password reset via recovery seed. Unlock with your new password.');
        });
      }).catch(function (e) { err.textContent = String(e.message || e); });
    });
    m.open(seedIn);
  }

  // ---- boot ----------------------------------------------------------
  injectStyles();
  function boot() {
    var unlocked = false;
    try { unlocked = sessionStorage.getItem(UNLOCK_KEY) === '1'; } catch (e) {}
    if (unlocked) openConsole(); else buildLock();
  }
  boot();

  // Public hook for the alternative hidden triggers (Ctrl+Shift+A and the
  // rapid 5-click on the footer copyright, both wired in js/projects.js).
  // SECURITY: openAuth() ONLY reveals the existing password-gated UI. It never
  // sets the unlock flag and never calls openConsole() directly — the master
  // password is still required exactly as with the ?mja-admin route. If a
  // session was already authenticated (unlock flag set earlier THIS session),
  // boot() reopens the console, which is not a bypass.
  window.__mjaAdmin = {
    openAuth: function () {
      if (root || activeModal) return;   // something is already open — no-op
      boot();
    },
    isOpen: function () { return !!(root || activeModal); }
  };

  // Esc closes the top-most dialog, else the whole console (and cleans the URL)
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (activeModal) { activeModal.close(); return; }
    if (root) closeConsole();
  });
})();
