/**
 * Render products.html grid from TXAM.loadData('products') + loadPage('products').
 * Uses showInList / sortOrder / filterKey from API (CMS-managed).
 */
(function (global) {
  var CATEGORY_FALLBACK_ZH = {
    '光学元件组装': 'optical',
    '点胶装配': 'dispensing',
    '翻转检测': 'flip',
    '锁付组装': 'screw',
    '搬运移载': 'transfer',
    '后段包装': 'packaging',
    '机器人集成': 'robot',
    '整线交付': 'line',
  };

  // filterKey is a language-neutral category identifier (optical/dispensing/...)
  // and is correct across zh/en/ru. filterKeyEn is unreliable in the DB, so we
  // always use filterKey regardless of language, matching the admin back-office.
  function filterKey(item, lang) {
    return item.filterKey || CATEGORY_FALLBACK_ZH[item.category] || 'optical';
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildProductImage(cover, alt) {
    var resolved = global.TXAM.assetUrl(cover);
    var altText = escapeHtml(alt);
    if (/\.webp$/i.test(cover)) {
      return (
        '<picture><source srcset="' + escapeHtml(resolved) + '" type="image/webp">' +
        '<img loading="lazy" decoding="async" src="' + escapeHtml(resolved) + '" alt="' + altText + '" class="img-zoom"></picture>'
      );
    }
    return '<img loading="lazy" decoding="async" src="' + escapeHtml(resolved) + '" alt="' + altText + '" class="img-zoom">';
  }

  function buildCard(item, index, lang, detailPrefix) {
    var mos = 'tx-mos';
    var catKey = filterKey(item, lang);
    var cover = item.image || '';
    var specs = (item.specs || []).slice(0, 2);
    var specHtml = specs
      .map(function (s) {
        return '<span class="border border-[#E7EAF0] bg-[#F7F8FA] text-[#39404C] text-xs px-3 py-1.5 rounded-full font-semibold">' +
          escapeHtml(s) + '</span>';
      })
      .join('');

    var badge = item.category
      ? '<div class="absolute top-6 left-6 bg-white/95 backdrop-blur-md text-[#14161B] border border-[#E7EAF0] px-4 py-1.5 radius-sm text-xs font-bold shadow-sm">' +
        escapeHtml(item.category) + '</div>'
      : '';
    var summary = item.summary || '';

    return (
      '<a href="' + (global.TXAM.catalogDetailHref ? global.TXAM.catalogDetailHref('products', item, detailPrefix) : detailPrefix + 'product-detail.html?id=' + escapeHtml(item.id)) + '" ' +
      'class="news-card product-item fade-up ' + mos + '" data-category="' + catKey + '">' +
      '<div class="img-container">' + buildProductImage(cover, item.name) + badge + '</div>' +
      '<div class="p-8 flex-grow flex flex-col justify-between bg-white group"><div>' +
      '<span class="text-[#667084] text-sm font-mono font-bold mb-4 block">' +
      escapeHtml(item.model) + '</span>' +
      '<h3 class="text-h3 text-[#14161B] mb-3 group-hover:text-[#FF6B00] transition-colors leading-tight">' + escapeHtml(item.name) + '</h3>' +
      '<p class="text-[#667084] text-sm leading-[1.6] line-clamp-2 mb-4">' + escapeHtml(summary) + '</p>' +
      (specHtml ? '<div class="flex flex-wrap gap-2 mt-auto">' + specHtml + '</div>' : '') +
      '</div></div></a>'
    );
  }

  function hydratePageMeta(page) {
    if (!page) return;
    if (page.seo && global.TXAM.applySeo) global.TXAM.applySeo(page.seo);
    if (page.hero) {
      var title = document.getElementById('list-hero-title') || document.querySelector('[data-list-hero-title]');
      var lead = document.getElementById('list-hero-lead') || document.querySelector('[data-list-hero-lead]');
      if (title && page.hero.title) title.textContent = page.hero.title;
      if (lead && page.hero.lead) lead.innerHTML = page.hero.lead;
    }
  }

  // Render filter tabs from page.filters, but hide any category tab that has
  // no visible product in `items`. "all" always shows. This runs after items
  // load so it reflects the real product distribution (e.g. after a product
  // is unpublished in the back office, which does NOT rebuild the static
  // filters JSON).
  function renderFilters(page, items) {
    if (!page || !page.filters) return;
    var root = document.getElementById('product-filters') || (document.querySelector('.filter-btn') || {}).parentElement || null;
    if (!root) return;

    var counts = {};
    (items || []).forEach(function (item) {
      var key = filterKey(item);
      counts[key] = (counts[key] || 0) + 1;
    });

    var normalClass = 'filter-btn whitespace-nowrap px-3 py-1.5 md:px-6 md:py-2.5 border border-[#E7EAF0] bg-white text-xs md:text-sm font-bold hover:border-[#14161B] hover:text-[#14161B]';
    root.innerHTML = Object.keys(page.filters)
      .filter(function (key) { return key === 'all' || counts[key] > 0; })
      .map(function (key) {
        var active = key === 'all';
        return '<button id="filter-' + escapeHtml(key) + '" class="' + normalClass +
          (active ? ' active text-[#14161B]' : ' text-[#667084]') + '" data-filter="' + escapeHtml(key) + '">' +
          escapeHtml(page.filters[key]) + '</button>';
      }).join('');
  }
  function bindFilters() {
    var filterBtns = document.querySelectorAll('.filter-btn');

    function applyFilter(filterValue) {
      var targetBtn = document.querySelector('[data-filter="' + filterValue + '"]');
      if (!targetBtn) return;

      filterBtns.forEach(function (b) {
        b.classList.remove('active', 'bg-[#14161B]', 'text-white', 'border-[#14161B]');
        b.classList.add('bg-white', 'text-[#667084]', 'border-[#E7EAF0]');
      });
      targetBtn.classList.add('active', 'bg-[#14161B]', 'text-white', 'border-[#14161B]');
      targetBtn.classList.remove('bg-white', 'text-[#667084]', 'border-[#E7EAF0]');

      document.querySelectorAll('.product-item').forEach(function (item) {
        var match = filterValue === 'all' || item.getAttribute('data-category') === filterValue;
        if (match) {
          item.classList.remove('hidden-item');
          item.style.display = '';
          item.style.opacity = '1';
          item.style.transform = '';
        } else {
          item.classList.add('hidden-item');
          item.style.display = 'none';
          item.style.opacity = '';
          item.style.transform = '';
        }
      });
    }

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyFilter(btn.getAttribute('data-filter'));
        setTimeout(function () {
          var grid = document.getElementById('product-grid');
          if (grid) {
            var top = grid.getBoundingClientRect().top + window.pageYOffset - 220;
            window.scrollTo({ top: top, behavior: 'smooth' });
          }
        }, 100);
      });
    });

    if (window.location.hash) {
      applyFilter(window.location.hash.substring(1));
    }
  }

  function observeFadeUps() {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-up').forEach(function (el) {
      observer.observe(el);
    });
  }

  async function initProductsList(options) {
    options = options || {};
    var lang = options.lang || (global.TXAM && global.TXAM.detectLang()) || 'zh';
    var detailPrefix = options.detailPrefix != null ? options.detailPrefix : '';
    var grid = document.getElementById('product-grid');
    if (!grid || !global.TXAM) return;

    try {
      var page = null;
      if (global.TXAM.loadPage) {
        try { page = await global.TXAM.loadPage('products', lang); } catch (_) {}
      }
      hydratePageMeta(page);

      var data = await global.TXAM.loadData('products', lang);
      var items = Object.keys(data)
        .map(function (id) { return data[id]; })
        .filter(function (row) {
          return row && row.published !== false && row.showInList !== false;
        })
        .sort(function (a, b) {
          return (a.sortOrder || 0) - (b.sortOrder || 0) ||
            (Number(a.id) || 0) - (Number(b.id) || 0);
        });

      grid.innerHTML = items
        .map(function (item, i) { return buildCard(item, i, lang, detailPrefix); })
        .join('');

      observeFadeUps();
      renderFilters(page, items);
      bindFilters();
    } catch (err) {
      console.error(err);
    }

    global.TXAM.bindMobileMenu();
  }

  global.TXAM = global.TXAM || {};
  global.TXAM.initProductsList = initProductsList;
})(typeof window !== 'undefined' ? window : globalThis);
