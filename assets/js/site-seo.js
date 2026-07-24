/**
 * Inject hreflang alternates and canonical when missing (static multilingual site).
 */
(function (global) {
  var SITE = 'https://www.sztxgk.com';

  function detectLang() {
    if (global.TXAM && global.TXAM.detectLang) return global.TXAM.detectLang();
    var m = (location.pathname || '').replace(/\\/g, '/').match(/\/(en|ru)(\/|$)/i);
    return m ? m[1].toLowerCase() : 'zh';
  }

  function pageFile() {
    var path = (location.pathname || '').replace(/\\/g, '/');
    var m = path.match(/\/(en|ru)\/(.+)$/i);
    if (m) return m[2];
    var base = path.split('/').pop() || 'index.html';
    return base || 'index.html';
  }

  function urlForLang(lang, file) {
    if (lang === 'zh') return SITE + '/' + file;
    return SITE + '/' + lang + '/' + file;
  }

  function ensureLink(rel, attrs) {
    var sel = Object.keys(attrs)
      .map(function (k) {
        return '[' + k + '="' + String(attrs[k]).replace(/"/g, '\\"') + '"]';
      })
      .join('');
    if (document.querySelector('link[rel="' + rel + '"]' + sel)) return;
    var el = document.createElement('link');
    el.setAttribute('rel', rel);
    Object.keys(attrs).forEach(function (k) {
      el.setAttribute(k, attrs[k]);
    });
    document.head.appendChild(el);
  }

  function injectMultilingualSeo() {
    if (!/^https?:$/.test(location.protocol)) return;
    var file = pageFile();
    var cur = detectLang();
    var qs = location.search || '';

    var langs = [
      { lang: 'zh', hreflang: 'zh-CN' },
      { lang: 'en', hreflang: 'en-US' },
      { lang: 'ru', hreflang: 'ru-RU' },
    ];
    langs.forEach(function (row) {
      ensureLink('alternate', { hreflang: row.hreflang, href: urlForLang(row.lang, file) + qs });
    });
    ensureLink('alternate', { hreflang: 'x-default', href: urlForLang('zh', file) + qs });

    if (!document.querySelector('link[rel="canonical"]')) {
      ensureLink('canonical', { href: urlForLang(cur, file) + qs });
    }
    if (!document.querySelector('meta[property="og:url"]')) {
      var og = document.createElement('meta');
      og.setAttribute('property', 'og:url');
      og.setAttribute('content', urlForLang(cur, file) + qs);
      document.head.appendChild(og);
    }
  }

  function injectHomeJsonLd() {
    var file = pageFile();
    if (file !== 'index.html') return;
    if (document.querySelector('script[type="application/ld+json"][data-txam-org]')) return;
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-txam-org', '1');
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: '广东同兴高科智能装备有限公司',
      alternateName: 'TXAM',
      url: SITE + '/',
      logo: SITE + '/assets/images/brand/logo.png',
      description: '非标自动化、智能制造及工业机器人集成配套的高端装备供应商',
    });
    document.head.appendChild(script);
  }

  function initSiteSeo() {
    injectMultilingualSeo();
    injectHomeJsonLd();
  }

  global.TXAM = global.TXAM || {};
  global.TXAM.initSiteSeo = initSiteSeo;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteSeo);
  } else {
    initSiteSeo();
  }
})(typeof window !== 'undefined' ? window : globalThis);
