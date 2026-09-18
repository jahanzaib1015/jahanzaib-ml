/* ============================================================
   js/resume.js — shared, dynamic resume state (static-site safe)
   ------------------------------------------------------------
   The hidden owner console (?mja-admin) can upload a PDF resume.
   Because this is a server-less static site, an upload is stored
   in ONE localStorage key ('mja-resume') so a new upload atomically
   REPLACES the previous one (old version is overwritten, never
   accumulated). That copy drives instant local preview of every
   "Resume" button in this browser.

   To publish a resume for ALL visitors, the owner uses the console's
   "Export resume.pdf" and commits the file to the canonical path
   assets/resume.pdf — the same export-then-replace flow used for
   data/projects.json. Nav buttons resolve to whichever source is
   active (local override first, else the published file) and stay
   HIDDEN until a resume actually exists, so there are never dead links.
   ============================================================ */
(function () {
  'use strict';

  var STORE_KEY = 'mja-resume';
  var PUBLISHED_PATH = 'assets/resume.pdf';
  // Keep the base64 data URL (~+33% over raw) comfortably inside the ~5MB
  // per-origin localStorage budget shared with the projects overlay + theme.
  var MAX_BYTES = 2 * 1024 * 1024;

  // ---- storage helpers -------------------------------------------------
  function readStore() {
    try { var s = localStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : null; }
    catch (e) { return null; }
  }
  function writeStore(obj) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); return true; }
    catch (e) { return false; }
  }
  function clearStore() { try { localStorage.removeItem(STORE_KEY); } catch (e) {} }

  // ---- formatting ------------------------------------------------------
  function fmtSize(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }
  function fmtDate(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleString(); } catch (e) { return String(ts); }
  }

  // ---- published-file probe -------------------------------------------
  // HEAD is cheap (no body). Fall back to a 1-byte ranged GET if the host
  // rejects HEAD (405/501) so a real published file is never missed.
  var publishedCache = null;   // { exists:Boolean, size:Number|null }
  function getProbe() {
    return fetch(PUBLISHED_PATH, { method: 'GET', cache: 'no-store', headers: { Range: 'bytes=0-0' } })
      .then(function (r) { return { exists: !!r.ok, size: null }; })
      .catch(function () { return { exists: false, size: null }; });
  }
  function checkPublished() {
    return fetch(PUBLISHED_PATH, { method: 'HEAD', cache: 'no-store' })
      .then(function (r) {
        if (r.ok) { var len = r.headers.get('content-length'); return { exists: true, size: len ? Number(len) : null }; }
        if (r.status === 405 || r.status === 501) return getProbe();
        return { exists: false, size: null };
      })
      .catch(getProbe);
  }

  // ---- active-resume resolution ---------------------------------------
  // Local override (this browser) wins; otherwise the published file.
  function getActive() {
    var local = readStore();
    if (local && local.dataUrl) {
      return {
        source: 'local', name: local.name || 'resume.pdf', size: local.size == null ? null : local.size,
        updatedAt: local.updatedAt || null, url: local.dataUrl
      };
    }
    if (publishedCache && publishedCache.exists) {
      return {
        source: 'published', name: PUBLISHED_PATH.split('/').pop(), size: publishedCache.size,
        updatedAt: null, url: PUBLISHED_PATH
      };
    }
    return { source: 'none', name: '', size: null, updatedAt: null, url: '' };
  }

  function statusText(a) {
    a = a || getActive();
    if (a.source === 'local') {
      return 'Uploaded (this browser): ' + a.name +
        (a.size != null ? ' — ' + fmtSize(a.size) : '') +
        (a.updatedAt ? ' — updated ' + fmtDate(a.updatedAt) : '');
    }
    if (a.source === 'published') {
      return 'Published: ' + PUBLISHED_PATH + (a.size != null ? ' — ' + fmtSize(a.size) : '');
    }
    return 'No resume active yet — upload a PDF below, or publish ' + PUBLISHED_PATH + '.';
  }

  // ---- upload (auto-replaces any previous resume) ----------------------
  function setFromFile(file) {
    if (!file) return Promise.reject(new Error('No file selected.'));
    var isPdf = (file.type === 'application/pdf') || /\.pdf$/i.test(file.name || '');
    if (!isPdf) return Promise.reject(new Error('Only PDF files are allowed.'));
    if (file.size > MAX_BYTES) {
      return Promise.reject(new Error('PDF is too large (' + fmtSize(file.size) + '). Keep it under ' + fmtSize(MAX_BYTES) + ' so it fits in browser storage.'));
    }
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var obj = {
          name: file.name || 'resume.pdf', size: file.size,
          type: file.type || 'application/pdf', updatedAt: Date.now(),
          dataUrl: String(fr.result)
        };
        if (!writeStore(obj)) { reject(new Error('Could not save to browser storage (it may be full).')); return; }
        refreshButtons();
        resolve(getActive());
      };
      fr.onerror = function () { reject(new Error('Could not read the file.')); };
      fr.readAsDataURL(file);
    });
  }

  // ---- download the active resume (used by "Export resume.pdf") --------
  function downloadActive() {
    var a = getActive();
    if (a.source === 'none') return false;
    var el = document.createElement('a');
    el.href = a.url;
    el.download = a.name || 'resume.pdf';
    document.body.appendChild(el); el.click(); document.body.removeChild(el);
    return true;
  }

  // ---- wire every nav button + status hook to the active resume --------
  function refreshButtons() {
    var a = getActive();
    var nodes = document.querySelectorAll('[data-resume-button]');
    Array.prototype.forEach.call(nodes, function (el) {
      if (a.source === 'none') { el.hidden = true; el.removeAttribute('href'); el.removeAttribute('download'); return; }
      el.hidden = false;
      el.setAttribute('href', a.url);
      el.setAttribute('download', a.name || 'resume.pdf');
      el.setAttribute('rel', 'noopener');
      el.setAttribute('aria-label', 'Download resume (' + a.name + ')');
      el.setAttribute('title', 'Download resume — ' + a.name + (a.updatedAt ? ' (updated ' + fmtDate(a.updatedAt) + ')' : ''));
    });
    var st = document.querySelectorAll('[data-resume-status]');
    Array.prototype.forEach.call(st, function (el) { el.textContent = statusText(a); });
  }

  // Re-probe the published file, then refresh all buttons/status.
  function refresh() {
    return checkPublished().then(function (info) { publishedCache = info; refreshButtons(); return getActive(); });
  }

  window.__resume = {
    storeKey: STORE_KEY,
    publishedPath: PUBLISHED_PATH,
    maxBytes: MAX_BYTES,
    getActive: getActive,
    getLocal: readStore,
    setFromFile: setFromFile,
    clear: function () { clearStore(); refreshButtons(); },
    downloadActive: downloadActive,
    refreshButtons: refreshButtons,
    refresh: refresh,
    checkPublished: function () { return checkPublished().then(function (i) { publishedCache = i; return i; }); },
    fmtSize: fmtSize,
    fmtDate: fmtDate,
    statusText: statusText
  };

  // Cross-tab sync: an upload/clear in one tab updates nav buttons in others.
  window.addEventListener('storage', function (e) { if (!e.key || e.key === STORE_KEY) refreshButtons(); });

  function boot() { refresh(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
