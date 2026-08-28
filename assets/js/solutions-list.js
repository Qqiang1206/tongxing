/**
 * Render solutions.html matrix from TXAM.loadData('solutions', lang).
 * Matches original Z-layout: odd = text left / image right;
 * even = gray band, image left / text right via order utilities.
 */
(function (global) {
  var ID_ORDER = ['31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41'];

  var ID_TO_SLUG = {
    '31': 'tv-display',
    '32': 'refrigerator',
    '33': 'packaging',
    '34': 'washer',
    '35': 'capacitor',
    '36': 'ac',
    '37': 'microwave',
    '38': 'coffee',
    '39': 'tablet',
    '40': 'headlight',
    '41': 'robot',
  };

  var STATIC_SLUGS = Object.keys(ID_TO_SLUG).map(function (id) { return ID_TO_SLUG[id]; });

  function solutionFilterKey(item) {
    return item.filterKey || item.slug || '';
  }

  function solutionHref(item, pathPrefix) {
    var slug = item.slug || ID_TO_SLUG[String(item.id)] || '';
    if (STATIC_SLUGS.indexOf(slug) !== -1) return pathPrefix + slug + '-solution.html';
    if (slug) {
      return pathPrefix + 'solutions-detail.html?slug=' + encodeURIComponent(slug);
    }
    return pathPrefix + 'solutions-detail.html?id=' + encodeURIComponent(item.id);
  }

  var UI = {
    zh: { view: '查看详情', label: 'SOLUTION', kpi: '关键指标' },
    en: { view: 'View details', label: 'SOLUTION', kpi: 'Key metric' },
    ru: { view: 'Подробнее', label: 'РЕШЕНИЕ', kpi: 'Ключевой показатель' },
  };

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildImage(cover, alt) {
    var resolved = global.TXAM.assetUrl(cover);
    var altText = escapeHtml(alt);
    var img =
      '<img loading="lazy" decoding="async" alt="' + altText + '" class="img-zoom" src="' + escapeHtml(resolved) + '">';
    if (/\.webp$/i.test(cover || '')) {
      return (
        '<picture class="media-hero-picture">' +
        '<source srcset="' + escapeHtml(resolved) + '" type="image/webp">' +
        img +
        '</picture>'
      );
    }
    return img;
  }

  function highlightItems(item) {
    var points = item.painPoints || [];
    if (points.length) {
      return points.slice(0, 2).map(function (p) {
        return { title: p.title || '', desc: p.desc || '' };
      });
    }
    var specs = item.specs || [];
    return specs.slice(0, 2).map(function (s) {
      return { title: s, desc: '' };
    });
  }

  function buildHighlightsHtml(item) {
    var highlights = highlightItems(item);
    if (!highlights.length) return '';
    return (
      '<div class="space-y-6">' +
      highlights
        .map(function (p) {
          return (
            '<div class="flex items-start">' +
            '<div class="w-6 h-6 rounded-full bg-[#1D1D1F] text-white flex items-center justify-center font-bold text-xs mt-1 mr-4 shrink-0">✓</div>' +
            '<div>' +
            '<h4 class="font-bold text-[#1D1D1F] mb-1">' +
            escapeHtml(p.title) +
            '</h4>' +
            (p.desc
              ? '<p class="text-sm text-[#86868B]">' + escapeHtml(p.desc) + '</p>'
              : '') +
            '</div></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  /**
   * v3：方案卡与新闻/产品卡同构（news-card 骨架），大小按 mosaic 节奏错落。
   */
  function buildRow(item, index, lang, pathPrefix) {
    if (item.id == null) return '';
    var mode = global.TXAM && global.TXAM.mosaicMode ? global.TXAM.mosaicMode(index) : 'std';
    var wide = mode !== 'std';
    var mos = 'tx-mos' + (mode === 'wide-h' ? ' tx-mos--wide-h' : mode === 'wide-v' ? ' tx-mos--wide-v' : '');
    var ui = UI[lang] || UI.zh;
    var num = String(index + 1).padStart(2, '0');
    var href = solutionHref(item, pathPrefix);
    var specs = item.specs || [];
    var kpi = specs[0] || '';
    var feats = specs.slice(1, wide ? 4 : 3);
    var summary = item.summary || item.desc || '';

    var featHtml = feats
      .map(function (s) {
        return '<span class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#39404C] border border-[#E7EAF0] bg-[#F7F8FA] px-3 py-1.5 rounded-full">' +
          '✓ ' + escapeHtml(s) + '</span>';
      })
      .join('');

    return (
      '<a href="' +
      escapeHtml(href) +
      '" class="news-card solution-item fade-up ' + mos + '" data-category="' +
      escapeHtml(solutionFilterKey(item)) +
      '">' +
      '<div class="img-container">' +
      buildImage(item.image, item.name) +
      (kpi
        ? '<div class="absolute top-6 left-6 bg-[#1D1D1F] text-white border border-gray-800 px-4 py-1.5 radius-sm text-xs font-bold shadow-sm mono-num">' +
          escapeHtml(kpi) +
          '</div>'
        : '') +
      '</div>' +
      '<div class="p-8 flex-grow flex flex-col justify-between bg-white group"><div>' +
      '<span class="' + (wide ? 'text-[#FF6B00]' : 'text-[#86868B]') + ' text-sm font-mono font-bold mb-4 block">' +
      escapeHtml(ui.label) +
      ' ' +
      num +
      '</span>' +
      '<h3 class="text-h3 text-[#1D1D1F] mb-3 group-hover:text-[#FF6B00] transition-colors leading-tight">' +
      escapeHtml(item.name) +
      '</h3>' +
      '<p class="text-[#86868B] ' + (wide ? 'text-base leading-[1.8] line-clamp-2 md:line-clamp-3' : 'text-sm leading-[1.6] line-clamp-2') + ' mb-4">' +
      escapeHtml(summary) +
      '</p>' +
      (featHtml ? '<div class="flex flex-wrap gap-2 mt-auto">' + featHtml + '</div>' : '') +
      '</div></div></a>'
    );
  }

  var fadeObserver = null;  var fadeObserver = null;

  function observeFadeUps() {
    if (fadeObserver) fadeObserver.disconnect();
    fadeObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('.fade-up').forEach(function (el) {
      fadeObserver.observe(el);
    });
  }

  function renderFilterButtons(categories, lang, pageFilters) {
    var bar = document.getElementById('solutions-filter-bar');
    if (!bar) return;
    var normalClass =
      'filter-btn whitespace-nowrap px-3 py-1.5 md:px-6 md:py-2.5 border border-[#E5E5EA] bg-white text-xs md:text-sm font-bold hover:border-[#1D1D1F] hover:text-[#1D1D1F]';
    var allLabel = (lang === 'en') ? 'All' : (lang === 'ru') ? 'Все' : '全部方案';
    var html = '<button type="button" id="solution-filter-all" class="' +
      normalClass + ' active text-[#1D1D1F]" data-filter="all">' +
      escapeHtml(allLabel) + '</button>';
    categories.forEach(function (cat) {
      var label = (pageFilters && pageFilters[cat]) ? pageFilters[cat] : cat;
      html += '<button type="button" class="' +
        normalClass + ' text-[#86868B]" data-filter="' +
        escapeHtml(cat) + '">' +
        escapeHtml(label) + '</button>';
    });
    bar.innerHTML = html;
  }

  function collectCategories(items) {
    var seen = {};
    var result = [];
    items.forEach(function (item) {
      var cat = solutionFilterKey(item);
      if (cat && !seen[cat]) {
        seen[cat] = true;
        result.push(cat);
      }
    });
    return result;
  }

  function bindSolutionFilters() {
    var filterBtns = document.querySelectorAll('#solutions-filter-bar .filter-btn');
    if (!filterBtns.length) return;

    function applyFilter(filterValue) {
      var targetBtn = document.querySelector('#solutions-filter-bar [data-filter="' + filterValue + '"]');
      if (!targetBtn) return;

      filterBtns.forEach(function (b) {
        b.classList.remove('active', 'bg-[#1D1D1F]', 'text-white', 'border-[#1D1D1F]');
        b.classList.add('bg-white', 'text-[#86868B]', 'border-[#E5E5EA]');
      });
      targetBtn.classList.add('active', 'bg-[#1D1D1F]', 'text-white', 'border-[#1D1D1F]');
      targetBtn.classList.remove('bg-white', 'text-[#86868B]', 'border-[#E5E5EA]');

      document.querySelectorAll('.solution-item').forEach(function (item) {
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
          var list = document.getElementById('solutions-list');
          if (list) {
            var top = list.getBoundingClientRect().top + window.pageYOffset - 220;
            window.scrollTo({ top: top, behavior: 'smooth' });
          }
        }, 100);
      });
    });
  }

  async function initSolutionsList(options) {
    options = options || {};
    var lang = options.lang || (global.TXAM && global.TXAM.detectLang()) || 'zh';
    var pathPrefix = options.pathPrefix != null ? options.pathPrefix : '';
    var root = document.getElementById('solutions-list');
    if (!root || !global.TXAM) return;

    try {
      var page = null;
      if (global.TXAM.loadPage) {
        try {
          page = await global.TXAM.loadPage('solutions', lang);
          if (page && page.seo && global.TXAM.applySeo) global.TXAM.applySeo(page.seo);
          if (page && page.hero) {
            var ht = document.getElementById('list-hero-title');
            var hl = document.getElementById('list-hero-lead');
            if (ht && page.hero.title) ht.textContent = page.hero.title;
            if (hl && page.hero.lead) hl.innerHTML = page.hero.lead;
          }
          if (page && page.pillars) {
            var pillarEls = document.querySelectorAll('[data-solution-pillar]');
            page.pillars.forEach(function (p, i) {
              var el = pillarEls[i];
              if (!el) return;
              var t = el.querySelector('[data-pillar-title]');
              var b = el.querySelector('[data-pillar-body]');
              if (t && p.title) t.textContent = p.title;
              if (b && p.body) b.textContent = p.body;
            });
          }
        } catch (_) {}
      }

      var data = await global.TXAM.loadData('solutions', lang);

      var items = Object.keys(data)
        .map(function (id) {
          return data[id];
        })
        .filter(function (row) {
          return row && row.published !== false && row.id != null;
        })
        .sort(function (a, b) {
          var sa = a.sortOrder || 0;
          var sb = b.sortOrder || 0;
          if (sa !== sb) return sa - sb;
          return (Number(a.id) || 0) - (Number(b.id) || 0);
        });

      var categories = collectCategories(items);
      renderFilterButtons(categories, lang, page && page.filters);

      root.innerHTML = items
        .map(function (item, index) {
          return buildRow(item, index, lang, pathPrefix);
        })
        .join('');

      observeFadeUps();
      bindSolutionFilters();
    } catch (err) {
      console.error(err);
    }

    if (global.TXAM.bindMobileMenu) global.TXAM.bindMobileMenu();
  }

  global.TXAM = global.TXAM || {};
  global.TXAM.initSolutionsList = initSolutionsList;
})(typeof window !== 'undefined' ? window : globalThis);
