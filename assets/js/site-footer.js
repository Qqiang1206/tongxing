/**
 * Unified footer + breadcrumb (auto-detects zh / en / ru from URL).
 */
(function (global) {
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

  function formatTagline(text, lang) {
    if (!text) return '';
    if (text.indexOf('\n') >= 0) return text.split('\n').join('<br>');
    if (lang === 'zh') {
      var zhIdx = text.indexOf('，');
      if (zhIdx > 0) return text.slice(0, zhIdx + 1) + '<br>' + text.slice(zhIdx + 1);
    }
    var idx = text.indexOf(', ');
    if (idx > 0) return text.slice(0, idx + 1) + '<br>' + text.slice(idx + 2);
    return text;
  }

  async function resolveSite(lang) {
    var key = '__TXAM_SITE_' + lang.toUpperCase();
    if (global[key] && typeof global[key] === 'object') return global[key];
    if (global.TXAM && global.TXAM.loadSite) {
      try {
        return await global.TXAM.loadSite(lang);
      } catch (e) { /* fall through */ }
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

  function renderFooter(site, prefix) {
    var footer = site.footer || {};
    var tagline = formatTagline(footer.tagline || '', site.lang || detectLang());
    var html =
      '<footer class="bg-[#111111] text-[#86868B] min-h-[300px] md:h-[300px] px-6 md:px-24 py-10 md:py-0 relative overflow-hidden flex flex-col justify-center">' +
      '<div class="absolute -top-12 -left-10 text-[15rem] font-black text-white opacity-5 tracking-tighter pointer-events-none select-none">TXAM</div>' +
      '<div class="max-w-[1600px] mx-auto relative z-10 w-full">' +
      '<div class="flex flex-col md:flex-row justify-between items-center gap-6 md:gap-4">' +
      '<h2 class="text-2xl md:text-[2.5rem] font-black text-white tracking-tighter leading-tight text-center md:text-left">' +
      tagline + '</h2>' +
      '<div><img src="' + prefix + 'assets/images/brand/wechat-service.png" alt="' +
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
    } catch (e) { /* ignore */ }

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
        pathContainer.innerHTML = '<span class="text-[#1D1D1F] font-medium">' + cleaned[0].name + '</span>';
        return;
      }
      var html = '';
      for (var i = 0; i < cleaned.length; i++) {
        var p = cleaned[i];
        var isLast = i === cleaned.length - 1;
        if (isLast) {
          html += '<span class="text-[#1D1D1F] font-medium">' + p.name + '</span>';
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

  async function boot() {
    var lang = detectLang();
    var prefix = assetPrefix();
    var site = await resolveSite(lang);
    if (!site) {
      console.warn('site-footer: missing i18n data for', lang);
      return;
    }
    site.lang = lang;
    renderFooter(site, prefix);
    initBreadcrumb(lang, site);
  }

  global.document.addEventListener('DOMContentLoaded', boot);
})(typeof window !== 'undefined' ? window : globalThis);
