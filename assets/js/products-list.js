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
    '整线交付': 'optical',
    '软件控制': 'transfer',
  };

  var CATEGORY_FALLBACK_EN = {
    'Single Machines': 'single',
    'Dispensing': 'dispensing',
    'Optical Assembly': 'optical',
    'Flip Detection': 'flip',
    'Logistics & Warehousing': 'logistics',
    'Packaging': 'packaging',
    'Robot Integration': 'robot',
    'Production Lines': 'single',
    'Software & Control': 'single',
    '点胶装配': 'dispensing',
    '后段包装': 'packaging',
    '机器人集成': 'robot',
  };

  function filterKey(item, lang) {
    if (lang === 'zh') {
      return item.filterKey || CATEGORY_FALLBACK_ZH[item.category] || 'optical';
    }
    return item.filterKeyEn || CATEGORY_FALLBACK_EN[item.category] || 'single';
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
        '<img loading="lazy" src="' + escapeHtml(resolved) + '" alt="' + altText + '" class="img-zoom"></picture>'
      );
    }
    return '<img loading="lazy" src="' + escapeHtml(resolved) + '" alt="' + altText + '" class="img-zoom">';
  }

  function buildCard(item, lang, detailPrefix) {
    var catKey = filterKey(item, lang);
    var cover = item.image || '';
    var specs = (item.specs || []).slice(0, 2);
    var specHtml = specs
      .map(function (s) {
        return '<span class="bg-gray-50 border border-gray-200 text-[#1D1D1F] text-xs px-3 py-1 rounded-md font-medium">' +
          escapeHtml(s) + '</span>';
      })
      .join('');

    return (
      '<a href="' + detailPrefix + 'product-detail.html?id=' + escapeHtml(item.id) + '" ' +
      'class="product-card product-item fade-up" data-category="' + catKey + '">' +
      '<div class="img-container">' + buildProductImage(cover, item.name) + '</div>' +
      '<div class="p-8 flex-grow flex flex-col">' +
      '<div class="text-[#FF6B00] font-bold text-xs tracking-widest mb-2 font-mono uppercase">' +
      escapeHtml(item.model) + '</div>' +
      '<h3 class="text-h3 text-[#1D1D1F] mb-3 tracking-tight">' + escapeHtml(item.name) + '</h3>' +
      '<p class="text-[#86868B] text-sm leading-[1.6] mb-6 flex-grow">' + escapeHtml(item.summary || '') + '</p>' +
      '<div class="flex flex-wrap gap-2 mt-auto">' + specHtml + '</div>' +
      '</div></a>'
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
    if (page.filters) {
      Object.keys(page.filters).forEach(function (key) {
        var btn = document.querySelector('.filter-btn[data-filter="' + key + '"]');
        if (btn) btn.textContent = page.filters[key];
      });
    }
  }

  function bindFilters() {
    var filterBtns = document.querySelectorAll('.filter-btn');

    function applyFilter(filterValue) {
      var targetBtn = document.querySelector('[data-filter="' + filterValue + '"]');
      if (!targetBtn) return;

      filterBtns.forEach(function (b) {
        b.classList.remove('active', 'bg-[#1D1D1F]', 'text-white', 'border-[#1D1D1F]');
        b.classList.add('bg-white', 'text-[#86868B]', 'border-[#E5E5EA]');
      });
      targetBtn.classList.add('active', 'bg-[#1D1D1F]', 'text-white', 'border-[#1D1D1F]');
      targetBtn.classList.remove('bg-white', 'text-[#86868B]', 'border-[#E5E5EA]');

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
        .map(function (item) { return buildCard(item, lang, detailPrefix); })
        .join('');

      observeFadeUps();
      bindFilters();
    } catch (err) {
      console.error(err);
    }

    global.TXAM.bindMobileMenu();
  }

  global.TXAM = global.TXAM || {};
  global.TXAM.initProductsList = initProductsList;
})(typeof window !== 'undefined' ? window : globalThis);
