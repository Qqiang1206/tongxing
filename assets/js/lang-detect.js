/**
 * Language preference: browser / localStorage → / /en/ /ru/
 */
(function () {
  var STORAGE_KEY = 'txam-lang-pref';

  function currentLang() {
    var path = location.pathname.replace(/\\/g, '/');
    if (/\/en(\/|$)/i.test(path)) return 'en';
    if (/\/ru(\/|$)/i.test(path)) return 'ru';
    return 'zh';
  }

  function pageBase() {
    var path = location.pathname.replace(/\\/g, '/');
    var parts = path.split('/').filter(Boolean);
    var last = parts[parts.length - 1] || 'index.html';
    if (!/\.html$/i.test(last)) last = 'index.html';
    // strip lang segment from consideration
    return last;
  }

  function targetUrl(lang) {
    var page = pageBase();
    var search = location.search || '';
    var hash = location.hash || '';
    if (lang === 'zh') return '/' + page + search + hash;
    return '/' + lang + '/' + page + search + hash;
  }

  function detectBrowserLang() {
    var list = navigator.languages && navigator.languages.length
      ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || '').toLowerCase();
      if (code.indexOf('zh') === 0) return 'zh';
      if (code.indexOf('ru') === 0) return 'ru';
    }
    return 'en';
  }

  // Manual language clicks: remember preference
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/\/en\//.test(href) || /(?:^|\/)en\//.test(href)) {
      try { localStorage.setItem(STORAGE_KEY, 'en'); } catch (err) {}
    } else if (/\/ru\//.test(href)) {
      try { localStorage.setItem(STORAGE_KEY, 'ru'); } catch (err) {}
    } else if (/\.html/.test(href) && !/\/(en|ru)\//.test(href) && a.textContent && /ZH|中文/.test(a.textContent.trim())) {
      try { localStorage.setItem(STORAGE_KEY, 'zh'); } catch (err) {}
    }
  }, true);

  // Auto-redirect only on first visit (no preference) from root index-like pages
  try {
    var pref = localStorage.getItem(STORAGE_KEY);
    var here = currentLang();
    if (!pref) {
      var detected = detectBrowserLang();
      if (detected !== here && (pageBase() === 'index.html' || pageBase() === '')) {
        localStorage.setItem(STORAGE_KEY, detected);
        location.replace(targetUrl(detected));
      }
    } else if (pref !== here && (pageBase() === 'index.html')) {
      // Respect saved preference on homepage only
      // location.replace(targetUrl(pref)); // disabled aggressive redirect; preference used on click
    }
  } catch (err) {}
})();
