/**
 * Shared helpers for detail pages: resolve assets, load data, reveal content.
 */
(function (global) {
  function inLangDir() {
    return /\/(en|ru)(\/|$)/i.test((location.pathname || '').replace(/\\/g, '/'));
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

  /**
   * Prefer window.__TXAM_* globals (from data/*.js), else fetch JSON.
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
    var base = inLangDir() ? '../' : '';
    var url = base + 'data/' + kind + '/' + lang + '.json';
    var res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load ' + url + ' (' + res.status + ')');
    return res.json();
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

  global.TXAM = global.TXAM || {};
  global.TXAM.assetUrl = assetUrl;
  global.TXAM.setMedia = setMedia;
  global.TXAM.loadData = loadData;
  global.TXAM.revealFadeUps = revealFadeUps;
  global.TXAM.bindMobileMenu = bindMobileMenu;
  global.TXAM.inLangDir = inLangDir;
})(typeof window !== 'undefined' ? window : globalThis);
