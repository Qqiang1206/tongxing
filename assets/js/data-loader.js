/**

 * Shared helpers for detail pages: resolve assets, load data, reveal content.

 */

(function (global) {

  // Static-first: by default the front-end reads data/*.js globals (with
  // data/*.json fallback), NOT the runtime API. Set window.__TXAM_API_BASE
  // to a URL string on a page to opt that page into API/DB mode.
  if (typeof global.__TXAM_API_BASE === 'undefined') global.__TXAM_API_BASE = false;

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



  var jsonRequestCache = Object.create(null);

  function fetchJson(url) {
    if (jsonRequestCache[url]) return jsonRequestCache[url];
    var request = fetch(url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load ' + url + ' (' + res.status + ')');
        return res.json();
      })
      .catch(function (err) {
        delete jsonRequestCache[url];
        throw err;
      });
    jsonRequestCache[url] = request;
    return request;
  }

  /**
   * Public pages are static-data first. API mode is only used when
   * window.__TXAM_API_BASE is explicitly set to a URL string.
   */
  async function ensureApiBase() {
    if (global.__TXAM_API_BASE === false) return '';
    if (typeof global.__TXAM_API_BASE === 'string') return global.__TXAM_API_BASE;
    return '';
  }
  /**

   * Load catalog data for detail pages.

   * Uses API only when window.__TXAM_API_BASE is explicitly set; otherwise static data.

   * @param {'products'|'solutions'|'news'} kind

   * @param {'zh'|'en'|'ru'} lang

   */

  async function loadData(kind, lang) {
    var map = {
      products: '__TXAM_PRODUCTS_',
      solutions: '__TXAM_SOLUTIONS_',
      news: '__TXAM_NEWS_',
    };
    var key = (map[kind] || '') + String(lang).toUpperCase();
    if (global[key] && typeof global[key] === 'object') {
      return global[key];
    }

    var apiBase = await ensureApiBase();
    if (apiBase) {
      try {
        var base = String(apiBase).replace(/\/$/, '');
        return await fetchJson(base + '/' + kind + '?lang=' + encodeURIComponent(lang));
      } catch (err) {
        console.warn('[TXAM] API catalog load failed, falling back to static data', kind, err);
      }
    }

    var prefix = inLangDir() ? '../' : '';
    return fetchJson(prefix + 'data/' + kind + '/' + lang + '.json');
  }

  /**
   * Load one catalog item with full detail fields (contentHtml, painPoints, etc.).
   * List pages should use loadData(); detail/landing pages use this for the active item.
   */
  async function loadCatalogItem(kind, id, lang) {
    if (!kind || id == null || id === '') return null;
    lang = lang || detectLang();

    var apiBase = await ensureApiBase();
    if (apiBase) {
      try {
        var base = String(apiBase).replace(/\/$/, '');
        return await fetchJson(
          base + '/' + kind + '/' + encodeURIComponent(String(id)) + '?lang=' + encodeURIComponent(lang)
        );
      } catch (err) {
        console.warn('[TXAM] API item load failed, falling back to static item', kind, id, err);
      }
    }

    var prefix = inLangDir() ? '../' : '';
    try {
      return await fetchJson(
        prefix + 'data/' + kind + '/items/' + lang + '/' + encodeURIComponent(String(id)) + '.json'
      );
    } catch (err) {
      var catalog = await loadData(kind, lang);
      return catalog && catalog[String(id)] ? catalog[String(id)] : null;
    }
  }


  /**

   * Site chrome strings (nav, footer, common labels).

   * @param {'zh'|'en'|'ru'} lang

   */

  async function loadSite(lang) {
    var siteKey = '__TXAM_SITE_' + String(lang).toUpperCase();
    if (global[siteKey] && typeof global[siteKey] === 'object') {
      return global[siteKey];
    }

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
    return fetchJson(prefix + 'data/i18n/' + lang + '.json');
  }
  var PAGE_GLOBAL_PREFIX = '__TXAM_PAGE_';

  async function loadPage(pageKey, lang) {
    var key = PAGE_GLOBAL_PREFIX + String(pageKey).toUpperCase().replace(/-/g, '_') + '_' + String(lang).toUpperCase();
    if (global[key] && typeof global[key] === 'object') {
      return global[key];
    }

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

    var prefix = inLangDir() ? '../' : '';
    return fetchJson(prefix + 'data/pages/' + pageKey + '/' + lang + '.json');
  }

  /**
   * Homepage aggregate (API mode): page + slotted solutions/news in one request.
   * Returns null when API is disabled so callers can fall back to parallel loads.
   */
  async function loadHome(lang) {
    var apiBase = await ensureApiBase();
    if (!apiBase) return null;
    try {
      var base = String(apiBase).replace(/\/$/, '');
      return await fetchJson(base + '/home?lang=' + encodeURIComponent(lang));
    } catch (err) {
      console.warn('[TXAM] API home load failed, falling back to parallel loads', err);
      return null;
    }
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
    var id = SOLUTION_SLUG_TO_ID[slug];
    if (!id) return null;
    var item = await loadCatalogItem('solutions', id, lang);
    if (item) return item;
    var all = await loadData('solutions', lang);
    return all ? all[id] || null : null;
  }

  async function resolveCatalogId(kind, lang, params) {
    params = params || new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
    var id = params.get('id');
    if (id) return id;
    var slug = params.get('slug');
    if (!slug) return null;
    var data = await loadData(kind, lang);
    if (!data) return null;
    for (var key of Object.keys(data)) {
      if (data[key] && data[key].slug === slug) return key;
    }
    return null;
  }

  function catalogDetailHref(kind, item, prefix) {
    prefix = prefix || '';
    var page = kind === 'news' ? 'news-detail.html' : 'product-detail.html';
    if (item && item.slug) {
      return prefix + page + '?slug=' + encodeURIComponent(item.slug);
    }
    return prefix + page + '?id=' + encodeURIComponent(item && item.id ? item.id : '');
  }

  function isCatalogPublished(item) {
    return !item || item.published !== false;
  }

  function catalogListHref(kind) {
    var prefix = inLangDir() ? '../' : '';
    var pages = {
      products: 'products.html',
      news: 'news.html',
      solutions: 'solutions.html',
    };
    return prefix + (pages[kind] || 'index.html');
  }

  /** Redirect to list page when item is unpublished (zh published flag is source of truth). */
  function guardPublishedCatalogItem(item, kind) {
    if (isCatalogPublished(item)) return item;
    if (typeof location !== 'undefined') {
      location.replace(catalogListHref(kind));
    }
    return null;
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Fisher–Yates partial shuffle for related-item picks. */
  function pickRandomKeys(keys, count, exclude) {
    var pool = keys.filter(function (k) { return k !== exclude; }).slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, count);
  }
  function revealFadeUps() {
    // Use IntersectionObserver for scroll-triggered fade-in
    if (typeof IntersectionObserver !== 'undefined') {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      document.querySelectorAll('.fade-up').forEach(function (el) {
        observer.observe(el);
      });
    } else {
      // Fallback for older browsers
      document.querySelectorAll('.fade-up').forEach(function (el) {
        el.classList.add('visible');
      });
    }

  }



  function bindMobileMenu() {

    var mobileBtn = document.getElementById('mobile-menu-btn');

    var mobileMenu = document.getElementById('mobile-menu');

    var menuIcon = document.getElementById('menu-icon');

    if (!mobileBtn || !mobileMenu || !menuIcon) return;

    var isMenuOpen = false;

    mobileBtn.addEventListener('click', function () {

      isMenuOpen = !isMenuOpen;
      mobileBtn.setAttribute('aria-expanded', isMenuOpen ? 'true' : 'false');

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
  global.TXAM.loadCatalogItem = loadCatalogItem;
  global.TXAM.loadSite = loadSite;
  global.TXAM.loadPage = loadPage;
  global.TXAM.loadHome = loadHome;
  global.TXAM.loadSolutionBySlug = loadSolutionBySlug;
  global.TXAM.resolveCatalogId = resolveCatalogId;
  global.TXAM.catalogDetailHref = catalogDetailHref;
  global.TXAM.isCatalogPublished = isCatalogPublished;
  global.TXAM.catalogListHref = catalogListHref;
  global.TXAM.guardPublishedCatalogItem = guardPublishedCatalogItem;
  global.TXAM.escapeHtml = escapeHtml;
  global.TXAM.pickRandomKeys = pickRandomKeys;
  global.TXAM.detectLang = detectLang;
  global.TXAM.applySeo = applySeo;

  global.TXAM.revealFadeUps = revealFadeUps;

  global.TXAM.bindMobileMenu = bindMobileMenu;

  global.TXAM.inLangDir = inLangDir;

})(typeof window !== 'undefined' ? window : globalThis);

