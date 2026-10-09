/* EN | ES | FR switch. Swaps rendered English text for window.I18N_<LANG> (exact
   match on whitespace-collapsed text), then I18N_<LANG>_RX patterns, then each " · " part.
   Anything untranslated stays English. A MutationObserver covers text the other
   scripts render later (Now/Next, weather, offline status). */
(function () {
  'use strict';
  var KEY = 'disney2026.lang', ATTRS = ['aria-label', 'title', 'alt', 'placeholder'];
  var LANGS = {en: 'en', es: 'es-MX', fr: 'fr'};   // button code -> html lang
  var orig = new WeakMap(), attrOrig = new WeakMap(), lang = 'en', obs;

  function T(s) {
    var k = s.replace(/\s+/g, ' ').trim(), U = lang.toUpperCase();
    var DICT = window['I18N_' + U] || {}, RX = window['I18N_' + U + '_RX'] || [];
    if (!k) return null;
    if (DICT.hasOwnProperty(k)) return DICT[k];
    for (var i = 0; i < RX.length; i++) if (RX[i][0].test(k)) return k.replace(RX[i][0], RX[i][1]);
    if (k.indexOf(' · ') > 0) {
      var parts = k.split(' · '), hit = false;
      parts = parts.map(function (p) { var t = T(p); if (t !== null) hit = true; return t === null ? p : t; });
      if (hit) return parts.join(' · ');
    }
    return null;
  }
  window.i18nT = function (s) { var t = T(s); return t === null ? s : t; };

  // Other scripts copy rendered text (Now/Next re-reads headings every minute), so a node
  // can start life already translated. rev maps the language being left back to English.
  var rev = {};
  function english(s) {
    var k = s.replace(/\s+/g, ' ').trim();
    return rev.hasOwnProperty(k) ? s.match(/^\s*/)[0] + rev[k] + s.match(/\s*$/)[0] : s;
  }

  function textNode(n) {
    var p = n.parentNode;
    if (!p || /^(SCRIPT|STYLE|NOSCRIPT|CODE)$/.test(p.nodeName)) return;
    var src = orig.has(n) ? orig.get(n) : english(n.data);
    var t = lang === 'en' ? null : T(src);
    if (t === null) {                       // English, or no translation in this language
      orig.delete(n);
      if (n.data !== src) n.data = src;
      return;
    }
    orig.set(n, src);
    var out = src.match(/^\s*/)[0] + t + src.match(/\s*$/)[0];
    if (n.data !== out) n.data = out;
  }

  function element(el) {
    var saved = attrOrig.get(el) || {};
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var src = saved[a] || el.getAttribute(a), t = lang === 'en' ? null : T(src);
      if (t === null) {
        if (saved[a]) { el.setAttribute(a, src); delete saved[a]; }
        return;
      }
      saved[a] = src; attrOrig.set(el, saved);
      if (el.getAttribute(a) !== t) el.setAttribute(a, t);
    });
  }

  function walk(root) {
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1) return;
    element(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) n.nodeType === 3 ? textNode(n) : element(n);
  }

  var titleEn = document.title;
  function apply(next) {
    var d = window['I18N_' + lang.toUpperCase()] || {};
    rev = {};
    Object.keys(d).forEach(function (k) { if (d[k] !== k) rev[d[k]] = k; });
    lang = next;
    walk(document.body);
    obs.takeRecords();   // drop the records our own writes just queued
    document.title = lang === 'en' ? titleEn : window.i18nT(titleEn);
    document.documentElement.lang = LANGS[lang];
    document.querySelectorAll('.lang-sw button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
  }

  obs = new MutationObserver(function (list) {
    if (lang === 'en') return;
    list.forEach(function (m) {
      if (m.type === 'characterData') {
        orig.delete(m.target); textNode(m.target);   // a script rewrote it: new English source
      } else if (m.type === 'attributes') {
        var s = attrOrig.get(m.target); if (s) delete s[m.attributeName]; element(m.target);
      } else m.addedNodes.forEach(walk);
    });
    obs.takeRecords();
  });
  obs.observe(document.body, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS});

  var NATIVE = {en: 'English', es: 'Español', fr: 'Français'};   // each in its own language: never translated
  var sw = document.createElement('div');
  sw.className = 'lang-sw';
  sw.setAttribute('role', 'group');
  sw.setAttribute('aria-label', 'Language / Idioma / Langue');
  sw.innerHTML = Object.keys(LANGS).map(function (c) {
    return '<button type="button" data-lang="' + c + '" aria-pressed="' + (c === 'en') + '"><span>' + c.toUpperCase() + '</span><small>' + NATIVE[c] + '</small></button>';
  }).join('');
  sw.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-lang]');
    if (!b) return;
    try { localStorage.setItem(KEY, b.dataset.lang); } catch (err) { /* private mode: choice lasts this visit */ }
    apply(b.dataset.lang);
  });
  (document.getElementById('tcard') || document.body).appendChild(sw);

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (err) { /* storage blocked */ }
  var first = LANGS[saved] ? saved : (navigator.language || 'en').slice(0, 2).toLowerCase();
  // Wait until the DOMContentLoaded builders (day bar) have copied the English labels.
  if (LANGS[first] && first !== 'en') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { apply(first); });
    else apply(first);
  }
})();
