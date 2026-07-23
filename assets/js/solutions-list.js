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

  function solutionHref(item, pathPrefix) {
    var slug = item.slug || ID_TO_SLUG[String(item.id)] || '';
    if (STATIC_SLUGS.indexOf(slug) !== -1) return pathPrefix + slug + '-solution.html';
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
      '<img loading="lazy" alt="' + altText + '" class="img-zoom" src="' + escapeHtml(resolved) + '">';
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

  function buildTextBlock(item, index, lang, pathPrefix) {
    var ui = UI[lang] || UI.zh;
    var href = solutionHref(item, pathPrefix);
    var num = String(index + 1).padStart(2, '0');
    var odd = index % 2 === 0;
    var textOrder = odd ? '' : ' order-1 lg:order-2';

    return (
      '<div class="lg:w-5/12' +
      textOrder +
      '">' +
      '<div class="text-[#FF6B00] font-bold text-xs tracking-widest mb-6 font-mono uppercase">' +
      escapeHtml(ui.label) +
      ' ' +
      num +
      '</div>' +
      '<h2 class="text-h2 text-[#1D1D1F] tracking-tighter mb-6 leading-tight">' +
      escapeHtml(item.name) +
      '</h2>' +
      '<p class="text-body-lg text-[#86868B] leading-relaxed mb-6">' +
      escapeHtml(item.summary || item.desc || '') +
      '</p>' +
      buildHighlightsHtml(item) +
      '<a href="' +
      escapeHtml(href) +
      '" class="inline-flex items-center gap-2 px-6 py-3 bg-[#FF6B00] text-white font-bold radius-sm hover:bg-[#E55F00] transition-all duration-300 mt-8">' +
      escapeHtml(ui.view) +
      '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>' +
      '</a></div>'
    );
  }

  function buildMediaBlock(item, index, lang) {
    var ui = UI[lang] || UI.zh;
    var odd = index % 2 === 0;
    var mediaOrder = odd ? '' : ' order-2 lg:order-1';
    var mediaBg = odd ? 'bg-gray-100' : 'bg-white';
    var kpiPos = odd ? 'bottom-6 right-6' : 'bottom-6 left-6';
    var firstSpec = (item.specs && item.specs[0]) || '';
    var kpi =
      firstSpec
        ? '<div class="absolute ' +
          kpiPos +
          ' bg-white/90 backdrop-blur-md px-6 py-3 radius-lg shadow-lg border border-gray-200">' +
          '<p class="text-xs text-[#86868B] font-bold tracking-widest mb-1">' +
          escapeHtml(ui.kpi) +
          '</p>' +
          '<p class="text-[#FF6B00] font-black text-2xl mono-num">' +
          escapeHtml(firstSpec) +
          '</p></div>'
        : '';

    return (
      '<div class="lg:w-7/12 w-full media-h-solution ' +
      mediaBg +
      ' media-hero relative' +
      mediaOrder +
      '">' +
      buildImage(item.image, item.name) +
      kpi +
      '</div>'
    );
  }

  function buildRow(item, index, lang, pathPrefix) {
    if (item.id == null) return '';
    var odd = index % 2 === 0;
    var wrapClass = odd
      ? 'w-full border-t border-[#E5E5EA] py-32'
      : 'w-full bg-[#F5F5F7] py-32 border-y border-[#E5E5EA]';

    var text = buildTextBlock(item, index, lang, pathPrefix);
    var media = buildMediaBlock(item, index, lang);
    var inner = odd ? text + media : media + text;

    return (
      '<div class="' +
      wrapClass +
      '">' +
      '<div class="max-w-[1400px] mx-auto px-6 md:px-24 flex flex-col lg:flex-row items-center justify-between gap-16 group fade-up">' +
      inner +
      '</div></div>'
    );
  }

  function observeFadeUps() {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('.fade-up').forEach(function (el) {
      observer.observe(el);
    });
  }

  async function initSolutionsList(options) {
    options = options || {};
    var lang = options.lang || (global.TXAM && global.TXAM.detectLang()) || 'zh';
    var pathPrefix = options.pathPrefix != null ? options.pathPrefix : '';
    var root = document.getElementById('solutions-list');
    if (!root || !global.TXAM) return;

    try {
      if (global.TXAM.loadPage) {
        try {
          var page = await global.TXAM.loadPage('solutions', lang);
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

      root.innerHTML = items
        .map(function (item, index) {
          return buildRow(item, index, lang, pathPrefix);
        })
        .join('');

      observeFadeUps();
    } catch (err) {
      console.error(err);
    }

    if (global.TXAM.bindMobileMenu) global.TXAM.bindMobileMenu();
  }

  global.TXAM = global.TXAM || {};
  global.TXAM.initSolutionsList = initSolutionsList;
})(typeof window !== 'undefined' ? window : globalThis);
