/**

 * Render news.html grid from TXAM.loadData('news', lang).

 */

(function (global) {

  var CATEGORY_KEY_BY_NAME = {};

  function categoryKey(itemOrCategory) {

    // Prefer server-side categoryKey (language-neutral key from news.category_key)
    if (itemOrCategory && typeof itemOrCategory === 'object' && itemOrCategory.categoryKey) {
      return itemOrCategory.categoryKey;
    }

    var category = typeof itemOrCategory === 'string' ? itemOrCategory
      : (itemOrCategory && itemOrCategory.category) || '';

    if (!category) return 'company';

    var mapped = CATEGORY_KEY_BY_NAME[String(category).trim().toLowerCase()];

    if (mapped) return mapped;

    if (/行业|industry|洞察|insight|аналитик|отрасл/i.test(category)) return 'industry';

    if (/项目|project|故事|story|проект/i.test(category)) return 'project';

    return 'company';

  }



  function stripHtml(html) {

    var el = document.createElement('div');

    el.innerHTML = html || '';

    return (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();

  }



  function parseDate(value) {
    return String(value || '').replace(/\./g, '-');
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildCoverMedia(cover, title) {
    var resolved = global.TXAM.assetUrl(cover);
    var alt = escapeHtml(title);
    if (/\.webp$/i.test(cover)) {
      return (
        '<picture><source srcset="' + escapeHtml(resolved) + '" type="image/webp">' +
        '<img loading="lazy" decoding="async" src="' + escapeHtml(resolved) + '" alt="' + alt + '" class="img-zoom"></picture>'
      );
    }
    return '<img loading="lazy" decoding="async" src="' + escapeHtml(resolved) + '" alt="' + alt + '" class="img-zoom">';
  }

  function buildCard(item, index, detailPrefix) {
    var catKey = categoryKey(item);

    var badgeClass = 'bg-white/95 backdrop-blur-md text-[#14161B] border border-[#E7EAF0]';

    var imgHeight = '';

    var padding = 'p-8';

    var titleClass = 'text-h3 text-[#14161B] mb-3 group-hover:text-[#FF6B00] transition-colors leading-tight';

    var dateClass = 'text-[#667084] text-sm font-mono mb-4 block';

    var excerptClass = 'text-[#667084] text-sm leading-[1.6] line-clamp-3';

    var spanClass = 'tx-mos';

    var cover = item.cover || '';

    var excerpt = item.excerpt || stripHtml(item.contentHtml || item.content || item.summary || '');

    if (excerpt.length > 160) excerpt = excerpt.slice(0, 157) + '…';



    return (

      '<a href="' + (global.TXAM.catalogDetailHref ? global.TXAM.catalogDetailHref('news', item, detailPrefix) : detailPrefix + 'news-detail.html?id=' + escapeHtml(item.id)) + '" ' +

      'class="news-card news-item fade-up ' + spanClass + '" data-category="' + catKey + '">' +

      '<div class="img-container ' + imgHeight + '">' +
      buildCoverMedia(cover, item.title) +

      '<div class="absolute top-6 left-6 ' + badgeClass + ' px-4 py-1.5 radius-sm text-xs font-bold shadow-sm">' +

      escapeHtml(item.category) +

      '</div></div>' +

      '<div class="' + padding + ' flex-grow flex flex-col justify-between bg-white group"><div>' +

      '<span class="' + dateClass + '">' + escapeHtml(item.date) + '</span>' +

      '<h3 class="' + titleClass + '">' + escapeHtml(item.title) + '</h3>' +

      '<p class="' + excerptClass + '">' + escapeHtml(excerpt) + '</p>' +

      '</div></div></a>'

    );

  }



  // Render filter tabs from page.filters, but hide any category tab that has
  // no visible news item in `items`. "all" always shows. Runs after items load
  // so it reflects the real news distribution (unpublishing a news item does
  // NOT rebuild the static filters JSON).
  function renderNewsFilters(page, items) {
    if (!page || !page.filters) return;
    var current = document.querySelector('.filter-btn');
    var filterRoot = current && current.parentElement;
    if (!filterRoot) return;

    var counts = {};
    (items || []).forEach(function (item) {
      var key = categoryKey(item);
      counts[key] = (counts[key] || 0) + 1;
    });

    var normalClass = 'filter-btn whitespace-nowrap px-3 py-1.5 md:px-8 md:py-2.5 border border-[#E7EAF0] bg-white text-xs md:text-sm font-bold hover:border-[#14161B] hover:text-[#14161B]';
    filterRoot.innerHTML = Object.keys(page.filters)
      .filter(function (key) { return key === 'all' || counts[key] > 0; })
      .map(function (key) {
        var active = key === 'all';
        return '<button class="' + normalClass + (active ? ' active text-[#14161B]' : ' text-[#667084]') +
          '" data-filter="' + escapeHtml(key) + '">' + escapeHtml(page.filters[key]) + '</button>';
      }).join('');
  }

  function bindFilters() {

    var filterBtns = document.querySelectorAll('.filter-btn');

    var newsItems = document.querySelectorAll('.news-item');

    if (!filterBtns.length) return;



    filterBtns.forEach(function (btn) {

      btn.addEventListener('click', function () {

        filterBtns.forEach(function (b) {

          b.classList.remove('active', 'bg-[#14161B]', 'text-white', 'border-[#14161B]');

          b.classList.add('bg-white', 'text-[#667084]', 'border-[#E7EAF0]');

        });

        btn.classList.add('active', 'bg-[#14161B]', 'text-white', 'border-[#14161B]');

        btn.classList.remove('bg-white', 'text-[#667084]', 'border-[#E7EAF0]');



        var filterValue = btn.getAttribute('data-filter');

        newsItems.forEach(function (item) {

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



        setTimeout(function () {

          var newsGrid = document.getElementById('news-grid');

          if (newsGrid) {

            var top = newsGrid.getBoundingClientRect().top + window.pageYOffset - 220;

            window.scrollTo({ top: top, behavior: 'smooth' });

          }

        }, 100);

      });

    });

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



  async function initNewsList(options) {

    options = options || {};

    var lang = options.lang || (global.TXAM && global.TXAM.detectLang()) || 'zh';

    var detailPrefix = options.detailPrefix != null ? options.detailPrefix : (global.TXAM.inLangDir() ? '' : '');

    var grid = document.getElementById('news-grid');

    if (!grid || !global.TXAM) return;



    try {

      if (global.TXAM.loadPage) {
        try {
          var page = await global.TXAM.loadPage('news', lang);
          if (page && page.seo && global.TXAM.applySeo) global.TXAM.applySeo(page.seo);
          if (page && page.hero) {
            var ht = document.getElementById('list-hero-title');
            var hl = document.getElementById('list-hero-lead');
            if (ht && page.hero.title) ht.textContent = page.hero.title;
            if (hl && page.hero.lead) hl.innerHTML = page.hero.lead;
          }
          if (page && page.filters) {
            // Build name→key map up front so categoryKey() (used by buildCard
            // and renderNewsFilters) resolves correctly. Tab rendering is done
            // later by renderNewsFilters() after items load, so empty
            // categories don't show a dead tab.
            CATEGORY_KEY_BY_NAME = {};
            Object.keys(page.filters).forEach(function (key) {
              CATEGORY_KEY_BY_NAME[String(page.filters[key] || '').trim().toLowerCase()] = key;
            });
          }
        } catch (_) {}
      }

      var data = await global.TXAM.loadData('news', lang);

      var items = Object.keys(data)

        .map(function (id) { return data[id]; })

        .filter(function (row) { return row && row.published !== false; })

        .sort(function (a, b) {

          return parseDate(b.date).localeCompare(parseDate(a.date));

        });



      grid.innerHTML = items

        .map(function (item, index) {

          return buildCard(item, index, detailPrefix);

        })

        .join('');



      observeFadeUps();

      renderNewsFilters(page, items);

      bindFilters();

    } catch (err) {

      console.error(err);

    }



    global.TXAM.bindMobileMenu();

  }



  global.TXAM = global.TXAM || {};

  global.TXAM.initNewsList = initNewsList;

})(typeof window !== 'undefined' ? window : globalThis);

