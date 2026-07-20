/**
 * Auto language: browser language → zh / en / ru
 * - First visit: detect navigator.language and jump to matching page
 * - Manual 中/EN/RU click: remember preference (localStorage)
 * - Later visits: prefer saved choice over browser language
 */
(function () {
  var STORAGE_KEY = 'txam-lang-pref';

  function getPageName() {
    var path = location.pathname || '';
    var name = path.split('/').pop() || '';
    if (!name || name.indexOf('.') === -1) return 'index.html';
    return name;
  }

  function parsePage(name) {
    var m = name.match(/^(.*)-(en|ru)\.html$/i);
    if (m) return { base: m[1], lang: m[2].toLowerCase() };
    if (/\.html$/i.test(name)) return { base: name.replace(/\.html$/i, ''), lang: 'zh' };
    return { base: 'index', lang: 'zh' };
  }

  function buildPage(base, lang) {
    if (lang === 'zh') return base + '.html';
    return base + '-' + lang + '.html';
  }

  function detectBrowserLang() {
    var list = [];
    if (navigator.languages && navigator.languages.length) {
      list = navigator.languages;
    } else if (navigator.language) {
      list = [navigator.language];
    }
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || '').toLowerCase();
      if (code.indexOf('zh') === 0) return 'zh';
      if (code.indexOf('ru') === 0) return 'ru';
    }
    for (var j = 0; j < list.length; j++) {
      var c = String(list[j] || '').toLowerCase();
      if (c.indexOf('en') === 0) return 'en';
    }
    return 'en';
  }

  function getPref() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setPref(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}
  }

  function langFromHref(href) {
    if (!href) return null;
    // ignore external / anchors / javascript
    if (/^(https?:|mailto:|tel:|#|javascript:)/i.test(href)) {
      if (/^https?:/i.test(href) && href.indexOf(location.host) === -1) return null;
    }
    var file = href.split('?')[0].split('#')[0].split('/').pop() || '';
    if (!/\.html$/i.test(file)) return null;
    return parsePage(file).lang;
  }

  // Remember manual language switch
  document.addEventListener(
    'click',
    function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var lang = langFromHref(a.getAttribute('href'));
      if (lang) setPref(lang);
    },
    true
  );

  // Skip auto-redirect for local file:// previews (FTP deploy still works on http/https)
  if (location.protocol === 'file:') return;

  var page = getPageName();
  var parsed = parsePage(page);
  var currentLang = parsed.lang;
  var pref = getPref();

  if (!pref) {
    pref = detectBrowserLang();
    setPref(pref);
  }

  if (pref && pref !== currentLang) {
    var target = buildPage(parsed.base, pref);
    // Keep query string (e.g. news-detail.html?id=4)
    var qs = location.search || '';
    var hash = location.hash || '';
    if (target !== page) {
      location.replace(target + qs + hash);
    }
  }
})();
