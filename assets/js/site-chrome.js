/**
 * Shared site chrome: skip link, main landmark, navbar scroll, logo link, mobile menu a11y.
 */
(function (global) {
  var SCROLL_TICK = false;

  var SKIP_LABEL = {
    zh: '跳过导航，进入主要内容',
    en: 'Skip to main content',
    ru: 'Перейти к основному содержанию',
  };

  function detectLang() {
    return (global.TXAM && global.TXAM.detectLang && global.TXAM.detectLang()) || 'zh';
  }

  function homeHref() {
    var lang = detectLang();
    if (lang === 'en') return 'index.html';
    if (lang === 'ru') return 'index.html';
    var path = (location.pathname || '').replace(/\\/g, '/');
    if (/\/(en|ru)\//i.test(path)) return 'index.html';
    return 'index.html';
  }

  function injectSkipLink() {
    if (document.querySelector('.skip-link')) return;
    var lang = detectLang();
    var a = document.createElement('a');
    a.className = 'skip-link';
    a.href = '#main-content';
    a.textContent = SKIP_LABEL[lang] || SKIP_LABEL.zh;
    document.body.insertBefore(a, document.body.firstChild);
  }

  function ensureMainLandmark() {
    if (document.querySelector('main#main-content, main[id="main-content"]')) return;
    var nav = document.getElementById('navbar');
    var candidates = [
      document.querySelector('.detail-page'),
      document.querySelector('article'),
      document.querySelector('header:not(#navbar)'),
      document.querySelector('[data-header-placeholder] + header'),
      document.querySelector('[data-header-placeholder] + *'),
    ];
    var target = null;
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i] && candidates[i] !== nav) {
        target = candidates[i];
        break;
      }
    }
    if (!target) {
      var placeholder = document.querySelector('[data-header-placeholder]');
      if (placeholder && placeholder.nextElementSibling) target = placeholder.nextElementSibling;
    }
    if (!target) return;

    var main = document.createElement('main');
    main.id = 'main-content';
    main.tabIndex = -1;
    target.parentNode.insertBefore(main, target);
    while (target) {
      var next = target.nextElementSibling;
      if (target.id === 'mobile-menu' || target.getAttribute('data-footer-placeholder') != null) break;
      main.appendChild(target);
      if (!next || next.id === 'mobile-menu') break;
      target = next;
    }
  }

  function fixLogoLink() {
    var nav = document.getElementById('navbar');
    if (!nav) return;
    var href = homeHref();
    var logoImg = nav.querySelector('picture img, img[alt*="TXAM"], img[alt*="同兴"], img[alt*="Тунсин"]');
    if (!logoImg) return;

    logoImg.removeAttribute('onclick');
    var wrap = logoImg.closest('a');
    if (wrap) {
      wrap.setAttribute('href', href);
      return;
    }

    var parent = logoImg.parentElement;
    if (parent && parent.tagName === 'PICTURE') parent = parent.parentElement;
    if (!parent) return;

    if (parent.tagName === 'DIV') {
      var link = document.createElement('a');
      link.href = href;
      link.className = parent.className || 'flex items-center cursor-pointer relative z-50';
      link.setAttribute('aria-label', detectLang() === 'en' ? 'TXAM Home' : detectLang() === 'ru' ? 'TXAM Главная' : '同兴高科首页');
      while (parent.firstChild) link.appendChild(parent.firstChild);
      parent.parentNode.replaceChild(link, parent);
    }
  }

  function ensureMobileMenuLabel() {
    var btn = document.getElementById('mobile-menu-btn');
    if (!btn || btn.getAttribute('aria-label')) return;
    var lang = detectLang();
    var labels = {
      zh: '打开菜单',
      en: 'Open menu',
      ru: 'Открыть меню',
    };
    btn.setAttribute('aria-label', labels[lang] || labels.zh);
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'mobile-menu');
  }

  function initNavbarScroll() {
    var navbar = document.getElementById('navbar');
    if (!navbar) return;
    window.addEventListener(
      'scroll',
      function () {
        if (SCROLL_TICK) return;
        SCROLL_TICK = true;
        requestAnimationFrame(function () {
          SCROLL_TICK = false;
          if (window.scrollY > 20) navbar.classList.add('shadow-sm');
          else navbar.classList.remove('shadow-sm');
        });
      },
      { passive: true }
    );
  }

  function initSiteChrome() {
    injectSkipLink();
    ensureMainLandmark();
    fixLogoLink();
    ensureMobileMenuLabel();
    initNavbarScroll();
  }

  global.TXAM = global.TXAM || {};
  global.TXAM.initSiteChrome = initSiteChrome;

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initSiteChrome);
  }
})(typeof window !== 'undefined' ? window : globalThis);
