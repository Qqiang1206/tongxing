/**

 * Shared helpers for detail pages: resolve assets, load data, reveal content.

 */

(function (global) {

  function inLangDir() {

    return /\/(en|ru)(\/|$)/i.test((location.pathname || '').replace(/\\/g, '/'));

  }



  function detectLang() {

    var m = (location.pathname || '').replace(/\\/g, '/').match(/\/(en|ru)(\/|$)/i);

    return m ? m[1].toLowerCase() : 'zh';

  }



  /** /assets/... or assets/... → correct relative path for current page */

  function assetUrl(url) {

    if (!url) return url;

    if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;

    var path = String(url).replace(/^\//, '');

    return (inLangDir() ? '../' : '') + path;

  }



  /** Update <img> and sibling <picture><source> so browsers don't keep stale srcset */

  function setMedia(imgOrId, url, alt) {

    var img = typeof imgOrId === 'string' ? document.getElementById(imgOrId) : imgOrId;

    if (!img || !url) return;

    var resolved = assetUrl(url);

    img.src = resolved;

    if (alt) img.alt = alt;

    var pic = img.closest && img.closest('picture');

    if (pic) {

      var source = pic.querySelector('source');

      if (source) source.setAttribute('srcset', resolved);

    }

  }



  async function fetchJson(url) {

    var res = await fetch(url);

    if (!res.ok) throw new Error('Failed to load ' + url + ' (' + res.status + ')');

    return res.json();

  }

  /**
   * Resolve API base once:
   * - Explicit window.__TXAM_API_BASE (string) wins
   * - false disables API
   * - else probe same-origin /api/v1/health (http/https only)
   */
  var apiProbePromise = null;

  async function ensureApiBase() {
    if (global.__TXAM_API_BASE === false) return '';
    if (typeof global.__TXAM_API_BASE === 'string') return global.__TXAM_API_BASE;
    if (apiProbePromise) return apiProbePromise;

    apiProbePromise = (async function () {
      try {
        if (typeof location === 'undefined' || !/^https?:$/i.test(location.protocol)) {
          global.__TXAM_API_BASE = '';
          return '';
        }
        var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = setTimeout(function () {
          if (ctrl) ctrl.abort();
        }, 800);
        var res = await fetch('/api/v1/health', {
          method: 'GET',
          credentials: 'same-origin',
          signal: ctrl ? ctrl.signal : undefined,
        });
        clearTimeout(timer);
        if (res.ok) {
          global.__TXAM_API_BASE = '/api/v1';
          return '/api/v1';
        }
      } catch (err) {
        /* static fallback */
      }
      global.__TXAM_API_BASE = '';
      return '';
    })();

    return apiProbePromise;
  }

  /**

   * Load catalog data for detail pages.

   * Uses API when available (auto-detect or window.__TXAM_API_BASE).

   * @param {'products'|'solutions'|'news'} kind

   * @param {'zh'|'en'|'ru'} lang

   */

  async function loadData(kind, lang) {
    var apiBase = await ensureApiBase();
    if (apiBase) {
      try {
        var base = String(apiBase).replace(/\/$/, '');
        return await fetchJson(base + '/' + kind + '?lang=' + encodeURIComponent(lang));
      } catch (err) {
        console.warn('[TXAM] API catalog load failed, falling back to static data', kind, err);
      }
    }

    var map = {
      products: '__TXAM_PRODUCTS_',
      solutions: '__TXAM_SOLUTIONS_',
      news: '__TXAM_NEWS_',
    };
    var key = (map[kind] || '') + String(lang).toUpperCase();
    if (global[key] && typeof global[key] === 'object') {
      return global[key];
    }
    var prefix = inLangDir() ? '../' : '';
    return fetchJson(prefix + 'data/' + kind + '/' + lang + '.json');
  }



  /**

   * Site chrome strings (nav, footer, common labels).

   * @param {'zh'|'en'|'ru'} lang

   */

  async function loadSite(lang) {
    var apiBase = await ensureApiBase();
    if (apiBase) {
      try {
        var base = String(apiBase).replace(/\/$/, '');
        return await fetchJson(base + '/site?lang=' + encodeURIComponent(lang));
      } catch (err) {
        console.warn('[TXAM] API site load failed, falling back to static data', err);
      }
    }

    var prefix = inLangDir() ? '../' : '';

    var siteKey = '__TXAM_SITE_' + String(lang).toUpperCase();
    if (global[siteKey] && typeof global[siteKey] === 'object') {
      return global[siteKey];
    }

    return fetchJson(prefix + 'data/i18n/' + lang + '.json');
  }

  var PAGE_GLOBAL_PREFIX = '__TXAM_PAGE_';

  async function loadPage(pageKey, lang) {
    var apiBase = await ensureApiBase();
    if (apiBase) {
      try {
        var base = String(apiBase).replace(/\/$/, '');
        return await fetchJson(
          base + '/pages/' + encodeURIComponent(pageKey) + '?lang=' + encodeURIComponent(lang)
        );
      } catch (err) {
        console.warn('[TXAM] API page load failed, falling back to static data', pageKey, err);
      }
    }
    var key = PAGE_GLOBAL_PREFIX + String(pageKey).toUpperCase().replace(/-/g, '_') + '_' + String(lang).toUpperCase();
    if (global[key] && typeof global[key] === 'object') {
      return global[key];
    }
    var prefix = inLangDir() ? '../' : '';
    return fetchJson(prefix + 'data/pages/' + pageKey + '/' + lang + '.json');
  }

  var SOLUTION_SLUG_TO_ID = {
    'tv-display': '31',
    refrigerator: '32',
    packaging: '33',
    washer: '34',
    capacitor: '35',
    ac: '36',
    microwave: '37',
    coffee: '38',
    tablet: '39',
    headlight: '40',
    robot: '41',
  };

  async function loadSolutionBySlug(slug, lang) {
    var apiBase = await ensureApiBase();
    if (apiBase) {
      try {
        var base = String(apiBase).replace(/\/$/, '');
        return await fetchJson(
          base + '/solutions/by-slug/' + encodeURIComponent(slug) + '?lang=' + encodeURIComponent(lang)
        );
      } catch (err) {
        console.warn('[TXAM] API solution-by-slug failed, falling back to static data', slug, err);
      }
    }
    var all = await loadData('solutions', lang);
    var id = SOLUTION_SLUG_TO_ID[slug];
    return id ? all[id] : null;
  }

  function revealFadeUps() {

    var page = document.querySelector('.detail-page');

    if (page) page.classList.add('detail-ready');

    document.querySelectorAll('.fade-up').forEach(function (el) {

      el.classList.add('visible');

    });

  }



  function bindMobileMenu() {

    var mobileBtn = document.getElementById('mobile-menu-btn');

    var mobileMenu = document.getElementById('mobile-menu');

    var menuIcon = document.getElementById('menu-icon');

    if (!mobileBtn || !mobileMenu || !menuIcon) return;

    var isMenuOpen = false;

    mobileBtn.addEventListener('click', function () {

      isMenuOpen = !isMenuOpen;

      if (isMenuOpen) {

        mobileMenu.classList.remove('menu-closed');

        mobileMenu.classList.add('menu-open');

        menuIcon.setAttribute('d', 'M6 18L18 6M6 6l12 12');

        document.body.style.overflow = 'hidden';

      } else {

        mobileMenu.classList.remove('menu-open');

        mobileMenu.classList.add('menu-closed');

        menuIcon.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');

        document.body.style.overflow = 'auto';

      }

    });

  }



  function ensureMeta(attr, key, content) {
    if (!content) return;
    var sel = attr === 'property'
      ? 'meta[property="' + key + '"]'
      : 'meta[name="' + key + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function ensureCanonical(href) {
    if (!href) return;
    var link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  /** Update document title + description / Open Graph tags for SEO. */
  function applySeo(seo) {
    seo = seo || {};
    if (seo.title) document.title = seo.title;
    if (seo.description) {
      ensureMeta('name', 'description', seo.description);
      ensureMeta('property', 'og:description', seo.description);
    }
    if (seo.title) ensureMeta('property', 'og:title', seo.title);
    if (seo.image) {
      var img = assetUrl(seo.image);
      if (img && !/^https?:\/\//i.test(img) && typeof location !== 'undefined') {
        img = location.origin + '/' + String(img).replace(/^\//, '');
      }
      ensureMeta('property', 'og:image', img);
    }
ensureMeta('property', 'og:type', seo.type || 'website');
    var canonical = seo.canonical || '';
    if (!canonical && typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
      canonical = location.origin + location.pathname + location.search;
    }
    if (canonical) {
      ensureCanonical(canonical);
      ensureMeta('property', 'og:url', canonical);
    }
  }

  global.TXAM = global.TXAM || {};

  global.TXAM.assetUrl = assetUrl;

  global.TXAM.setMedia = setMedia;

  global.TXAM.loadData = loadData;
  global.TXAM.loadSite = loadSite;
  global.TXAM.loadPage = loadPage;
  global.TXAM.loadSolutionBySlug = loadSolutionBySlug;
  global.TXAM.detectLang = detectLang;
  global.TXAM.applySeo = applySeo;

  global.TXAM.revealFadeUps = revealFadeUps;

  global.TXAM.bindMobileMenu = bindMobileMenu;

  global.TXAM.inLangDir = inLangDir;

})(typeof window !== 'undefined' ? window : globalThis);

