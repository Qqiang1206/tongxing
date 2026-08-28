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

  /**
   * Mobile menu toggle (open/close, icon swap, scroll lock, close on link tap / Esc).
   * Bound here so every page gets it; index.html injects the header later via
   * header.js, so a MutationObserver re-tries until the button exists.
   */
  function initMobileMenu() {
    var btn = document.getElementById('mobile-menu-btn');
    var menu = document.getElementById('mobile-menu');
    var icon = document.getElementById('menu-icon');
    if (!btn || !menu || btn.getAttribute('data-chrome-bound') != null) return;
    btn.setAttribute('data-chrome-bound', '1');

    function open() {
      btn.setAttribute('aria-expanded', 'true');
      menu.classList.remove('menu-closed');
      menu.classList.add('menu-open');
      if (icon) icon.setAttribute('d', 'M6 18L18 6M6 6l12 12');
      document.body.style.overflow = 'hidden';
    }

    function close() {
      btn.setAttribute('aria-expanded', 'false');
      menu.classList.remove('menu-open');
      menu.classList.add('menu-closed');
      if (icon) icon.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
      document.body.style.overflow = '';
    }

    btn.addEventListener('click', function () {
      if (btn.getAttribute('aria-expanded') === 'true') close();
      else open();
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', close);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') close();
    });
  }

  function initNavbarScroll() {
    var navbar = document.getElementById('navbar');
    if (!navbar) return;
    var v3 = document.documentElement.getAttribute('data-ui') === 'v3';
    window.addEventListener(
      'scroll',
      function () {
        if (SCROLL_TICK) return;
        SCROLL_TICK = true;
        requestAnimationFrame(function () {
          SCROLL_TICK = false;
          if (window.scrollY > 20) {
            navbar.classList.add('shadow-sm');
            if (v3) navbar.classList.add('is-scrolled');
          } else {
            navbar.classList.remove('shadow-sm');
            if (v3) navbar.classList.remove('is-scrolled');
          }
        });
      },
      { passive: true }
    );
  }

  /**
   * Reveal-on-scroll for .fade-up blocks. Lives here (not header.js) since the
   * nav is now statically inlined and header.js is no longer included.
   */
  /**
   * v3 列表页章节式 hero 视频（与首页同源素材）：静音自动播放。
   */
  function initSectionHeroVideo() {
    var video = document.querySelector('.v3-hero--section video, .v3-hero--about video');
    if (!video) return;
    video.muted = true;
    var p = video.play();
    if (p && p.catch) p.catch(function () { /* autoplay blocked: poster remains */ });
  }

  function initRevealObserver() {
    var els = document.querySelectorAll('.fade-up');
    if (!els.length) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    Array.prototype.forEach.call(els, function (el) {
      if (el.classList.contains('visible')) return;
      observer.observe(el);
    });
  }

  function initSiteChrome() {
    injectSkipLink();
    ensureMainLandmark();
    fixLogoLink();
    ensureMobileMenuLabel();
    initNavbarScroll();
    initMobileMenu();
    initSectionHeroVideo();
    initRevealObserver();
    if (!document.getElementById('mobile-menu-btn')) {
      var observer = new MutationObserver(function () {
        if (!document.getElementById('mobile-menu-btn')) return;
        initMobileMenu();
        observer.disconnect();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  global.TXAM = global.TXAM || {};
  global.TXAM.initSiteChrome = initSiteChrome;

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initSiteChrome);
  }
})(typeof window !== 'undefined' ? window : globalThis);
