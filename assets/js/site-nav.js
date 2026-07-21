/**
 * Hydrate desktop + mobile nav labels from TXAM.loadSite(lang).nav
 * Language switcher (ZH/EN/RU) is never overwritten with page titles.
 *
 * On /en/ and /ru/ pages the "current lang" link is often a same-folder href
 * like "index.html" (no /en/ in the path) — detect by current directory + switcher order.
 */
(function (global) {
  var PAGE_KEYS = [
    { match: /(^|\/)index\.html$|^\/$/, key: 'home' },
    { match: /about\.html/, key: 'about' },
    { match: /solutions\.html/, key: 'solutions' },
    { match: /products\.html/, key: 'products' },
    { match: /news\.html/, key: 'news' },
    { match: /contact\.html/, key: 'contact' },
  ];
  var LANG_ORDER = ['zh', 'en', 'ru'];

  function currentDirLang() {
    var path = (location.pathname || '').replace(/\\/g, '/');
    if (/\/en(\/|$)/i.test(path)) return 'en';
    if (/\/ru(\/|$)/i.test(path)) return 'ru';
    return 'zh';
  }

  function hrefKey(href) {
    var h = String(href || '');
    for (var i = 0; i < PAGE_KEYS.length; i++) {
      if (PAGE_KEYS[i].match.test(h)) return PAGE_KEYS[i].key;
    }
    return null;
  }

  /** Resolve which language a switcher link points to. */
  function hrefLang(href) {
    var h = String(href || '').replace(/\\/g, '/');
    if (/(^|\/)en\//i.test(h) || /(^|\/)en\/?$/i.test(h)) return 'en';
    if (/(^|\/)ru\//i.test(h) || /(^|\/)ru\/?$/i.test(h)) return 'ru';
    // Climb to Chinese root: ../foo.html or ../../foo.html (no en/ru segment)
    if (/^\.\.\//.test(h) && !/\/(en|ru)\//i.test(h)) return 'zh';
    // Same-folder relative → language of the directory we are in
    return currentDirLang();
  }

  function isLangSwitcherWrap(wrap) {
    if (!wrap) return false;
    if ((wrap.className || '').indexOf('border-l') !== -1) return true;
    var links = wrap.querySelectorAll(':scope > a');
    if (links.length !== 3) return false;
    var hrefs = Array.prototype.map.call(links, function (a) {
      return a.getAttribute('href') || '';
    }).join(' ');
    // Typical: mixes ../ /en/ /ru/ or same-folder current lang
    return /\/en\//i.test(hrefs) || /\/ru\//i.test(hrefs) || /\.\.\//.test(hrefs);
  }

  function isLangSwitcherLink(a) {
    if (!a) return false;
    if (a.getAttribute('data-lang-switch') != null) return true;
    var t = (a.textContent || '').trim().toUpperCase();
    if (t === 'ZH' || t === 'EN' || t === 'RU') {
      if (a.parentElement && isLangSwitcherWrap(a.parentElement)) return true;
    }
    return !!(a.parentElement && isLangSwitcherWrap(a.parentElement));
  }

  function labelSwitcherGroup(links, langMap) {
    if (!links || !links.length || !langMap) return;
    // Site convention: always ZH | EN | RU in that order
    if (links.length === 3) {
      LANG_ORDER.forEach(function (code, i) {
        var a = links[i];
        if (!a) return;
        a.setAttribute('data-lang-switch', code);
        if (langMap[code]) a.textContent = langMap[code];
      });
      return;
    }
    Array.prototype.forEach.call(links, function (a) {
      var code = hrefLang(a.getAttribute('href'));
      a.setAttribute('data-lang-switch', code);
      if (langMap[code]) a.textContent = langMap[code];
    });
  }

  function applyLangLabels(langMap) {
    if (!langMap) return;
    // Desktop: border-l groups inside #navbar
    document.querySelectorAll('#navbar div').forEach(function (wrap) {
      if (!isLangSwitcherWrap(wrap)) return;
      labelSwitcherGroup(wrap.querySelectorAll(':scope > a'), langMap);
    });
    // Mobile: bottom row under #mobile-menu (parent of 3 lang links)
    document.querySelectorAll('#mobile-menu div').forEach(function (wrap) {
      if (!isLangSwitcherWrap(wrap)) return;
      labelSwitcherGroup(wrap.querySelectorAll(':scope > a'), langMap);
    });
  }

  function applyNavLabels(nav) {
    if (!nav) return;
    document.querySelectorAll('#navbar a, #mobile-menu a').forEach(function (a) {
      if (a.querySelector('img, picture, svg')) return;
      if (isLangSwitcherLink(a)) return;
      var key = hrefKey(a.getAttribute('href'));
      if (key && nav[key]) a.textContent = nav[key];
    });
  }

  async function initSiteNav(options) {
    options = options || {};
    var lang = options.lang || (global.TXAM && global.TXAM.detectLang()) || 'zh';
    if (!global.TXAM || !global.TXAM.loadSite) return;
    try {
      var site = await global.TXAM.loadSite(lang);
      applyLangLabels(site && site.lang);
      applyNavLabels(site && site.nav);
    } catch (err) {
      console.error(err);
    }
  }

  global.TXAM = global.TXAM || {};
  global.TXAM.initSiteNav = initSiteNav;

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      var lang = (global.TXAM && global.TXAM.detectLang && global.TXAM.detectLang()) || 'zh';
      initSiteNav({ lang: lang });
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
