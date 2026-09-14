/**
 * Unified footer + breadcrumb (auto-detects zh / en / ru from URL).
 */
(function (global) {
  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(text) {
    return escapeHtml(text).replace(/'/g, '&#39;');
  }

  var ADDRESS_LABELS = {
    zh: { shenzhen: '深圳总部工厂', huizhou: '惠州智能制造基地' },
    en: { shenzhen: 'Shenzhen HQ', huizhou: 'Huizhou Base' },
    ru: { shenzhen: 'Шэньчжэнь (штаб)', huizhou: 'Хуэйчжоу (база)' },
  };

  /* 页脚界面固定文案（非内容，不进后台；新增语言时在此补一组即可） */
  var UI_LABELS = {
    zh: {
      quickLinks: '快速链接',
      contactUs: '联系我们',
      wechat: '微信咨询',
      qrCaption: '扫码添加微信客服',
      backToTop: '回到顶部',
      contactHref: 'contact.html',
    },
    en: {
      quickLinks: 'Quick links',
      contactUs: 'Contact us',
      wechat: 'WeChat',
      qrCaption: 'Scan to add us on WeChat',
      backToTop: 'Back to top',
      contactHref: 'contact.html',
    },
    ru: {
      quickLinks: 'Быстрые ссылки',
      contactUs: 'Связаться с нами',
      wechat: 'WeChat',
      qrCaption: 'Отсканируйте, чтобы добавить в WeChat',
      backToTop: 'Наверх',
      contactHref: 'contact.html',
    },
  };

  var ARROW_SVG =
    '<svg class="v3-btn__arrow" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M2 8h11M9 3.5 13.5 8 9 12.5"/></svg>';

  function detectLang() {
    var pathNorm = (location.pathname || '').replace(/\\/g, '/');
    var currentPage = pathNorm.split('/').pop() || 'index.html';
    if (/\/en(\/|$)/i.test(pathNorm) || currentPage.endsWith('-en.html')) return 'en';
    if (/\/ru(\/|$)/i.test(pathNorm) || currentPage.endsWith('-ru.html')) return 'ru';
    return 'zh';
  }

  function assetPrefix() {
    return /\/(en|ru)(\/|$)/i.test((location.pathname || '').replace(/\\/g, '/')) ? '../' : '';
  }

  /**
   * 标语排版：后台写 \n 或 <br> 才换行，其余交给浏览器自然折行。
   * （旧实现按「，/ , 」强制断行，俄文等长句会被切得莫名其妙。）
   */
  function formatTagline(text) {
    if (!text) return '';
    if (text.indexOf('\n') >= 0) return escapeHtml(text).split('\n').join('<br>');
    return escapeHtml(text);
  }

  async function resolveSite(lang) {
    var key = '__TXAM_SITE_' + lang.toUpperCase();
    if (global[key] && typeof global[key] === 'object') return global[key];
    if (global.TXAM && global.TXAM.loadSite) {
      try {
        return await global.TXAM.loadSite(lang);
      } catch (e) { /* API unavailable, fall through to static data */ }
    }
    return null;
  }

  function navPageNames(nav) {
    return {
      'index.html': nav.home,
      'about.html': nav.about,
      'solutions.html': nav.solutions,
      'products.html': nav.products,
      'news.html': nav.news,
      'contact.html': nav.contact,
    };
  }

  function setCtaButtonText(btn, text) {
    for (var i = 0; i < btn.childNodes.length; i++) {
      var n = btn.childNodes[i];
      if (n.nodeType === 3 && n.nodeValue.trim()) {
        n.nodeValue = text;
        return;
      }
    }
    btn.insertBefore(global.document.createTextNode(text), btn.firstChild);
  }

  /**
   * 注入的 CTA 带 .fade-up（起始 opacity:0），必须手动登记揭示。
   * 页面统一的揭示器只在 DOMContentLoaded 时扫一遍 .fade-up，而本区块是在
   * 之后的异步 boot 里插进来的，谁也观察不到它 —— 结果整段 CTA 变成页脚
   * 上方一条什么都没有的空白带。
   */
  function revealInjected(sec) {
    if (global.TXAM && typeof global.TXAM.revealFadeUps === 'function') {
      global.TXAM.revealFadeUps(sec);
      return;
    }
    // 没加载 data-loader 时的兜底：直接判定为已揭示，宁可无动画也不能空白
    var el = sec.querySelector('.fade-up');
    if (el) el.classList.add('visible');
  }

  /**
   * 收尾 CTA：首页已静态内联 .v3-final（首屏直出），此处只同步文案；
   * 其余页面按需注入同一区块，全站转化位统一，不在页脚内重复。
   * 文案取自 site_settings.common（中文为源，en/ru 由翻译链路镜像）。
   */
  function syncClosingCta(site) {
    if (global.document.documentElement.getAttribute('data-ui') !== 'v3') return;
    var common = site.common || {};
    var title = common.finalCtaTitle || '';
    var sub = common.finalCtaSub || '';
    var btnText = common.finalCtaButton || '';
    if (!title && !sub && !btnText) return;

    var lang = site.lang || detectLang();
    var ui = UI_LABELS[lang] || UI_LABELS.zh;
    var sec = global.document.querySelector('.v3-final');

    if (!sec) {
      var ph = global.document.querySelector('[data-footer-placeholder]');
      if (!ph) return;
      sec = global.document.createElement('section');
      sec.className = 'v3-final v3-section bg-white text-center';
      sec.innerHTML =
        '<div class="v3-final__aura" aria-hidden="true"></div>' +
        '<div class="v3-shell relative fade-up">' +
        '<h2 class="text-h1 text-gradient mx-auto">' + escapeHtml(title) + '</h2>' +
        '<p class="mt-6 text-body-lg text-[#667084] max-w-2xl mx-auto">' + escapeHtml(sub) + '</p>' +
        '<div class="mt-11"><a href="' + ui.contactHref + '" class="v3-btn v3-btn--primary text-base">' +
        escapeHtml(btnText) + ARROW_SVG + '</a></div>' +
        '</div>';
      ph.parentNode.insertBefore(sec, ph);
      revealInjected(sec);
      return;
    }

    var h2 = sec.querySelector('h2');
    if (h2 && title) h2.textContent = title;
    var p = sec.querySelector('p');
    if (p && sub) p.textContent = sub;
    var btn = sec.querySelector('.v3-btn');
    if (btn && btnText) setCtaButtonText(btn, btnText);
  }

  function bindBackToTop() {
    global.document.querySelectorAll('[data-scroll-top]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        try {
          global.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) {
          global.scrollTo(0, 0);
        }
      });
    });
  }

  function renderFooter(site, prefix) {
    var footer = site.footer || {};
    var lang = site.lang || detectLang();
    var tagline = formatTagline(footer.tagline || '');

    /* v3 「光感单色」浅色页脚 — only where <html data-ui="v3"> */
    if (global.document.documentElement.getAttribute('data-ui') === 'v3') {
      var ui = UI_LABELS[lang] || UI_LABELS.zh;
      var nav = site.nav || {};
      var quickLinks = [
        { href: 'about.html', name: nav.about },
        { href: 'solutions.html', name: nav.solutions },
        { href: 'products.html', name: nav.products },
        { href: 'news.html', name: nav.news },
        { href: 'contact.html', name: nav.contact },
      ].filter(function (l) { return l.name; });

      var linkList = '';
      for (var i = 0; i < quickLinks.length; i++) {
        linkList += '<a href="' + quickLinks[i].href + '">' + escapeHtml(quickLinks[i].name) + '</a>';
      }

      var contactList = '';
      if (footer.phone) {
        contactList +=
          '<a href="tel:' + escapeAttr(String(footer.phone).replace(/[^+\d]/g, '')) + '">' +
          escapeHtml(footer.phone) + '</a>';
      }
      if (footer.email) {
        contactList +=
          '<a href="mailto:' + escapeAttr(footer.email) + '">' + escapeHtml(footer.email) + '</a>';
      }

      var labels = ADDRESS_LABELS[lang] || ADDRESS_LABELS.zh;
      var addrItems = '';
      if (footer.addressShenzhen) {
        addrItems +=
          '<div class="txf__addr-block"><span class="txf__addr-label">' + escapeHtml(labels.shenzhen) + '</span>' +
          '<span class="txf__addr-text">' + escapeHtml(footer.addressShenzhen) + '</span></div>';
      }
      if (footer.addressHuizhou) {
        addrItems +=
          '<div class="txf__addr-block"><span class="txf__addr-label">' + escapeHtml(labels.huizhou) + '</span>' +
          '<span class="txf__addr-text">' + escapeHtml(footer.addressHuizhou) + '</span></div>';
      }

      var html =
        '<footer class="txf">' +
        '<div class="txf__watermark" aria-hidden="true">TXAM</div>' +
        '<div class="v3-shell relative z-10">' +
        '<div class="txf__grid">' +
        '<div class="txf__col">' +
        '<a href="index.html" class="txf__brand"><img src="' + prefix + 'assets/images/brand/logo.png" alt="" class="txf__logo"></a>' +
        '<p class="txf__tagline">' + tagline + '</p>' +
        '</div>' +
        '<div class="txf__col">' +
        '<h3 class="txf__col-title">' + escapeHtml(ui.quickLinks) + '</h3>' +
        '<nav class="txf__list">' + linkList + '</nav>' +
        '</div>' +
        '<div class="txf__col">' +
        '<h3 class="txf__col-title">' + escapeHtml(ui.contactUs) + '</h3>' +
        '<div class="txf__list">' + contactList + '</div>' +
        addrItems +
        '</div>' +
        '<div class="txf__col">' +
        '<h3 class="txf__col-title">' + escapeHtml(ui.wechat) + '</h3>' +
        '<figure class="txf__qr-fig">' +
        '<img src="' + prefix + (footer.wechatImage || 'assets/images/brand/wechat-service.png') + '" alt="' + escapeAttr(footer.wechatAlt || ui.wechat) + '" class="txf__qr">' +
        '<figcaption class="txf__qr-cap">' + escapeHtml(ui.qrCaption) + '</figcaption>' +
        '</figure>' +
        '</div>' +
        '</div>' +
        '<div class="txf__bottom">' +
        '<p>' + escapeHtml(footer.copyright || '') + '</p>' +
        '<div class="txf__bottom-right">' +
        '<a href="' + escapeAttr(footer.icpUrl || 'https://beian.miit.gov.cn/') + '" target="_blank" rel="noopener">' + escapeHtml(footer.icp || '') + '</a>' +
        '<button type="button" class="txf__totop" data-scroll-top>' + escapeHtml(ui.backToTop) + '</button>' +
        '</div>' +
        '</div></div></footer>';

      global.document.querySelectorAll('[data-footer-placeholder]').forEach(function (el) {
        el.outerHTML = html;
      });
      bindBackToTop();
      return;
    }

    var html =
      '<footer class="bg-[#111111] text-[#667084] min-h-[300px] md:h-[300px] px-6 md:px-24 py-10 md:py-0 relative overflow-hidden flex flex-col justify-center">' +
      '<div class="absolute -top-12 -left-10 text-[15rem] font-black text-white opacity-5 tracking-tighter pointer-events-none select-none">TXAM</div>' +
      '<div class="max-w-[1600px] mx-auto relative z-10 w-full">' +
      '<div class="flex flex-col md:flex-row justify-between items-center gap-6 md:gap-4">' +
      '<h2 class="text-2xl md:text-[2.5rem] font-black text-white tracking-tighter leading-tight text-center md:text-left">' +
      tagline + '</h2>' +
      '<div><img src="' + prefix + (footer.wechatImage || 'assets/images/brand/wechat-service.png') + '" alt="' +
      (footer.wechatAlt || 'WeChat') + '" class="max-h-[140px] md:max-h-[200px] w-auto rounded-lg object-cover"></div>' +
      '</div></div>' +
      '<div class="relative z-10 mt-8 md:mt-0 md:absolute md:bottom-[25px] md:left-6 md:right-6 lg:left-24 lg:right-24 max-w-[1600px] md:mx-auto flex flex-col sm:flex-row flex-wrap items-center justify-center md:justify-start text-center md:text-left text-sm font-light tracking-wide text-[#666] gap-2 md:gap-4">' +
      '<p>' + (footer.copyright || '') + '</p>' +
      '<span class="hidden sm:inline">|</span>' +
      '<a href="' + (footer.icpUrl || 'https://beian.miit.gov.cn/') + '" target="_blank" rel="noopener" class="hover:text-white transition-colors">' +
      (footer.icp || '') + '</a></div></footer>';

    global.document.querySelectorAll('[data-footer-placeholder]').forEach(function (el) {
      el.outerHTML = html;
    });
  }

  function initBreadcrumb(lang, site) {
    var nav = site.nav || {};
    var pageNames = navPageNames(nav);
    var indexPage = 'index.html';
    var pathNorm = (location.pathname || '').replace(/\\/g, '/');
    var currentPage = pathNorm.split('/').pop() || 'index.html';
    var pathContainer = global.document.querySelector('[data-breadcrumb]');
    if (!pathContainer) return;

    // Drop legacy visit-history crumbs that caused cross-section inheritance
    try {
      sessionStorage.removeItem('txam-nav-history-' + lang);
      sessionStorage.removeItem('txam-nav-history');
    } catch (e) { /* sessionStorage unavailable or blocked */ }

    function currentTitle() {
      return (global.document.body.dataset.breadcrumbName) ||
        (function () {
          var h1 = global.document.querySelector('h1');
          return h1 ? h1.textContent.trim() : '';
        })() ||
        pageNames[currentPage] ||
        currentPage;
    }

    function findParentPage() {
      var declared = global.document.body.dataset.breadcrumbParent;
      if (declared && pageNames[declared]) return declared;
      var m = currentPage.match(/^product-detail(-[a-z]{2})?\.html$/);
      if (m) {
        var listPage = 'products' + (m[1] || '') + '.html';
        if (pageNames[listPage]) return listPage;
      }
      m = currentPage.match(/^news-detail(-[a-z]{2})?\.html$/);
      if (m) {
        listPage = 'news' + (m[1] || '') + '.html';
        if (pageNames[listPage]) return listPage;
      }
      m = currentPage.match(/^solutions-detail(-[a-z]{2})?\.html$/);
      if (m) {
        listPage = 'solutions' + (m[1] || '') + '.html';
        if (pageNames[listPage]) return listPage;
      }
      m = currentPage.match(/^.+?-solution(-[a-z]{2})?\.html$/);
      if (m) {
        listPage = 'solutions' + (m[1] || '') + '.html';
        if (pageNames[listPage]) return listPage;
      }
      return null;
    }

    // Structural crumbs only: Home › Section › Current (never stack visit history)
    var crumbs = [{ page: indexPage, name: pageNames[indexPage] || nav.home || 'Home' }];
    var parentPage = findParentPage();
    if (parentPage && parentPage !== indexPage && parentPage !== currentPage) {
      crumbs.push({ page: parentPage, name: pageNames[parentPage] });
    } else if (pageNames[currentPage] && currentPage !== indexPage) {
      // Top-level section pages: Home › Section (section is current)
    }

    function render(name) {
      var items = crumbs.slice();
      if (currentPage !== indexPage) {
        items = items.filter(function (c) { return c.page !== currentPage; });
        items.push({ page: currentPage, name: name || currentTitle() });
      }
      // Deduplicate consecutive same page
      var cleaned = [];
      items.forEach(function (c) {
        if (!cleaned.length || cleaned[cleaned.length - 1].page !== c.page) cleaned.push(c);
      });
      // Home alone on homepage
      if (cleaned.length === 1 && cleaned[0].page === indexPage && currentPage === indexPage) {
        pathContainer.innerHTML = '<span class="text-[#14161B] font-medium">' + cleaned[0].name + '</span>';
        return;
      }
      var html = '';
      for (var i = 0; i < cleaned.length; i++) {
        var p = cleaned[i];
        var isLast = i === cleaned.length - 1;
        if (isLast) {
          html += '<span class="text-[#14161B] font-medium">' + p.name + '</span>';
        } else {
          html += '<a href="' + p.page + '" class="hover:text-[#FF6B00] transition-colors">' +
            p.name + '</a><span class="mx-2 text-[#C7C7CC]">›</span>';
        }
      }
      pathContainer.innerHTML = html;
    }

    render(currentTitle());

    // Detail pages hydrate titles async — refresh crumb label when h1 settles
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      var next = currentTitle();
      if (next && next !== currentPage) {
        render(next);
        if (tries >= 8) clearInterval(timer);
      }
      if (tries >= 20) clearInterval(timer);
    }, 200);
  }

  function loadAnalytics() {
    if (document.querySelector('script[data-txam-analytics]')) return;
    var s = document.createElement('script');
    s.src = assetPrefix() + 'assets/js/analytics.js';
    s.defer = true;
    s.setAttribute('data-txam-analytics', '1');
    document.head.appendChild(s);
  }

  async function boot() {
    loadAnalytics();
    var lang = detectLang();
    var prefix = assetPrefix();
    var site = await resolveSite(lang);
    if (!site) {
      console.warn('site-footer: missing i18n data for', lang);
      return;
    }
    site.lang = lang;
    syncClosingCta(site);
    renderFooter(site, prefix);
    initBreadcrumb(lang, site);
  }

  global.document.addEventListener('DOMContentLoaded', boot);
})(typeof window !== 'undefined' ? window : globalThis);
