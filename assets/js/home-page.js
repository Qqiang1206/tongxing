/**
 * Hydrate index.html from home page copy + solution/news home-slot flags.
 * Slots: solutions.homeSlot = hero|category ; news.homeFeatured = true
 */
(function (global) {
  /* v3 「光感单色」只在 <html data-ui="v3"> 的页面启用新组件标记；
   * 其余语言镜像（en/ru 首页）保持旧模板输出，确保零回归。 */
  var V3 = typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-ui') === 'v3';

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function assetUrl(url) {
    return global.TXAM && global.TXAM.assetUrl ? global.TXAM.assetUrl(url) : url;
  }

  function catalogItems(map) {
    if (!map) return [];
    return Object.keys(map).map(function (id) { return map[id]; }).filter(Boolean);
  }

  function isPublished(item) {
    return !item || item.published !== false;
  }

  function solutionHref(sol) {
    // 统一走 TXAM.solutionHref：没有静态落地页的 slug 回落到统一模板，避免 404
    if (global.TXAM && global.TXAM.solutionHref) return global.TXAM.solutionHref(sol, '');
    if (sol && sol.slug) return sol.slug + '-solution.html';
    if (sol && sol.id) return 'solutions-detail.html?id=' + encodeURIComponent(sol.id);
    return 'solutions.html';
  }

  function renderStatItem(stat) {
    if (!V3) {
      var emphasis = stat.emphasis || '';
      var wrapClass = 'text-center md:text-left';
      var unitClass = 'text-3xl ml-1 text-gray-400';
      var labelClass = 'text-xs font-bold text-[#667084] tracking-widest uppercase';

      if (emphasis === 'border') {
        wrapClass += ' border-l-0 md:border-l-2 md:border-[#E7EAF0] md:pl-8';
      } else if (emphasis === 'accent') {
        wrapClass = 'pl-6 border-l-4 border-[#FF6B00]';
        unitClass = 'text-3xl ml-1';
        labelClass = 'text-xs font-bold text-[#14161B] tracking-widest uppercase';
      }

      var unitHtmlLegacy = stat.unit
        ? '<span class="' + unitClass + '">' + escapeHtml(stat.unit) + '</span>'
        : '';

      return (
        '<div class="' + wrapClass + '">' +
          '<div class="text-[3.5rem] md:text-[4.5rem] font-black text-[#14161B] mono-num leading-none mb-2">' +
            escapeHtml(stat.value) + unitHtmlLegacy +
          '</div>' +
          '<p class="' + labelClass + '">' + escapeHtml(stat.label) + '</p>' +
        '</div>'
      );
    }

    var unitHtml = stat.unit
      ? '<span>' + escapeHtml(stat.unit) + '</span>'
      : '';

    return (
      '<div class="v3-stat">' +
        '<div class="v3-stat__num mono-num">' + escapeHtml(stat.value) + unitHtml + '</div>' +
        '<p class="v3-stat__label">' + escapeHtml(stat.label) + '</p>' +
      '</div>'
    );
  }

  function renderStatsGrid(container, stats) {
    if (!container || !stats || !stats.length) return;
    container.innerHTML = stats.map(renderStatItem).join('');
  }

  function buildCardImage(image, alt, legacyZoom) {
    var resolved = assetUrl(image);
    var altEsc = escapeHtml(alt || '');
    if (/\.webp$/i.test(image || '')) {
      return (
        '<picture><source srcset="' + resolved + '" type="image/webp">' +
        '<img loading="lazy" decoding="async" src="' + resolved + '" alt="' + altEsc + '"' +
        (legacyZoom ? ' class="w-full h-full object-cover img-zoom"' : '') + '></picture>'
      );
    }
    return '<img loading="lazy" decoding="async" src="' + resolved + '" alt="' + altEsc + '"' +
      (legacyZoom ? ' class="w-full h-full object-cover img-zoom"' : '') + '>';
  }

  function solutionToCategoryCard(sol) {
    var specs = sol.specs || [];
    return {
      eyebrow: specs[0] || sol.category || '',
      title: sol.name || '',
      summary: sol.summary || '',
      tags: specs.slice(0, 3),
      href: solutionHref(sol),
      image: sol.image || '',
      imageAlt: sol.name || '',
    };
  }

  function resolveUnitCard(section) {
    if (section && section.unitCard) return section.unitCard;
    if (section && section.cards && section.cards.length) {
      var found = section.cards.filter(function (c) {
        return /products\.html/i.test(c.href || '');
      })[0];
      if (found) return found;
    }
    return null;
  }

  function renderProductsSection(section, categorySolutions) {
    if (!section) return;

    var titleEl = document.getElementById('home-products-title');
    var subEl = document.getElementById('home-products-subtitle');
    var grid = document.getElementById('home-products-grid');
    if (titleEl) titleEl.textContent = section.title || '';
    if (subEl) subEl.textContent = section.subtitle || '';
    if (!grid) return;

    var cards = (categorySolutions || []).map(solutionToCategoryCard);
    var unit = resolveUnitCard(section);
    if (unit) cards.push(unit);

    // Legacy fallback: full cards array if no slot-driven solutions yet
    if (!cards.length && section.cards && section.cards.length) {
      cards = section.cards;
    }

    grid.innerHTML = cards.map(function (card) {
      if (!V3) {
        var legacyTags = (card.tags || []).map(function (tag) {
          return '<span class="inline-block bg-gray-50 text-[#14161B] font-medium text-xs px-3 py-1 radius-sm border border-gray-200">' +
            escapeHtml(tag) + '</span>';
        }).join('');
        var legacyTagsHtml = legacyTags
          ? '<div class="flex flex-wrap gap-2 mb-6">' + legacyTags + '</div>'
          : '';

        return (
          '<a href="' + escapeHtml(card.href) + '" class="apple-card p-8 flex flex-col group bg-white no-underline overflow-hidden hover:border-[#FF6B00] transition-all duration-500">' +
            '<h3 class="text-h3 font-bold text-[#14161B] mb-4">' + escapeHtml(card.title) + '</h3>' +
            '<p class="text-[#667084] text-sm leading-relaxed mb-6 flex-grow">' + escapeHtml(card.summary) + '</p>' +
            legacyTagsHtml +
            '<div class="w-full h-48 radius-sm overflow-hidden border border-[#E7EAF0]">' +
              buildCardImage(card.image, card.imageAlt || card.title, true) +
            '</div>' +
          '</a>'
        );
      }

      var tags = (card.tags || []).map(function (tag) {
        return '<span class="v3-card__tag">' + escapeHtml(tag) + '</span>';
      }).join('');

      return (
        '<a href="' + escapeHtml(card.href) + '" class="v3-card">' +
          '<div class="v3-card__media">' +
            buildCardImage(card.image, card.imageAlt || card.title) +
            '<span class="v3-card__go" aria-hidden="true">' +
              '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8h11M9 3.5 13.5 8 9 12.5"/></svg>' +
            '</span>' +
          '</div>' +
          '<div class="v3-card__body">' +
            (card.eyebrow ? '<span class="v3-card__model mono-num uppercase">' + escapeHtml(card.eyebrow) + '</span>' : '') +
            '<h3 class="v3-card__title">' + escapeHtml(card.title) + '</h3>' +
            '<p class="v3-card__desc">' + escapeHtml(card.summary) + '</p>' +
            (tags ? '<div class="v3-card__tags">' + tags + '</div>' : '') +
          '</div>' +
        '</a>'
      );
    }).join('');
  }

  function renderServiceSection(section) {
    if (!section) return;

    var titleEl = document.getElementById('home-service-title');
    var subEl = document.getElementById('home-service-subtitle');
    var flow = document.getElementById('home-service-flow');
    if (titleEl) titleEl.textContent = section.title || '';
    if (subEl) subEl.textContent = section.subtitle || '';
    if (!flow || !section.steps) return;

    flow.innerHTML = section.steps.map(function (step) {
      var style = step.badgeStyle || 'mid';
      var badgeClass = 'service-flow__badge service-flow__badge--' + style + ' mono-num';
      var items = (step.items || []).map(function (line) {
        return '<li>' + escapeHtml(line) + '</li>';
      }).join('');

      return (
        '<div class="service-flow__step">' +
          '<div class="' + badgeClass + '">' + escapeHtml(step.badge) + '</div>' +
          '<h3 class="text-h3 text-[#14161B] mb-4">' + escapeHtml(step.title) + '</h3>' +
          '<ul class="service-flow__detail">' + items + '</ul>' +
        '</div>'
      );
    }).join('');
  }

  function excerptFromHtml(html, maxLen) {
    maxLen = maxLen || 80;
    var text = String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
  }

  function renderNewsSection(section, featuredNews) {
    if (!section) return;

    var titleEl = document.getElementById('home-news-title');
    var missionTitle = document.getElementById('home-news-mission-title');
    var missionBody = document.getElementById('home-news-mission-body');
    var cta = document.getElementById('home-news-cta');
    var list = document.getElementById('home-news-list');

    if (titleEl) titleEl.textContent = section.title || '';
    if (missionTitle) missionTitle.textContent = section.missionTitle || '';
    if (missionBody) missionBody.textContent = section.missionBody || '';
    if (cta && section.cta) {
      var ctaLabel = cta.querySelector('.v3-btn__label');
      if (ctaLabel) ctaLabel.textContent = section.cta.label || '';
      else cta.textContent = section.cta.label || '';
      cta.setAttribute('href', section.cta.href || 'news.html');
    }
    if (!list) return;

    var items = featuredNews || [];
    // Legacy: featured [{id, summary}] + full news map passed as second arg historically
    if (!items.length && section.featured && section.featured.length && arguments[2]) {
      var newsMap = arguments[2];
      items = section.featured.map(function (entry) {
        var item = newsMap[entry.id] || newsMap[String(entry.id)];
        if (!item) return null;
        return Object.assign({}, item, { _homeSummary: entry.summary || item.summary || '' });
      }).filter(Boolean);
    }

    list.innerHTML = items.map(function (item, index) {
      var featured = index === 0;
      var summary = item._homeSummary || item.summary || excerptFromHtml(item.contentHtml, 72);
      var href = global.TXAM.catalogDetailHref ? global.TXAM.catalogDetailHref('news', item, '') : 'news-detail.html?id=' + encodeURIComponent(item.id);

      if (!V3) {
        var catClassLegacy = featured
          ? 'text-xs font-bold text-[#FF6B00] mb-3 tracking-widest uppercase'
          : 'text-xs font-bold text-[#667084] mb-3 tracking-widest uppercase';
        return (
          '<a href="' + href + '" class="group py-8 border-b border-[#E7EAF0] flex flex-col md:flex-row md:items-center justify-between hover:px-6 hover:bg-white transition-all duration-300 rounded-lg">' +
            '<div class="flex flex-col">' +
              '<span class="' + catClassLegacy + '">' + escapeHtml(item.category) + '</span>' +
              '<h3 class="text-h3 text-[#14161B] group-hover:text-[#FF6B00] transition-colors mb-2">' + escapeHtml(item.title) + '</h3>' +
              (summary ? '<p class="text-sm text-[#667084]">' + escapeHtml(summary) + '</p>' : '') +
            '</div>' +
            '<span class="text-sm font-bold text-[#667084] mt-4 md:mt-0">' + escapeHtml(item.date) + '</span>' +
          '</a>'
        );
      }

      var catClass = featured
        ? 'text-xs font-bold text-[#FF6B00] tracking-widest uppercase'
        : 'text-xs font-bold text-[#9AA1AE] tracking-widest uppercase';

      return (
        '<a href="' + href +
        '" class="group py-7 border-b border-[#E7EAF0] flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-300 hover:bg-white/70 rounded-lg px-2 -mx-2">' +
          '<div class="flex flex-col min-w-0 pr-4">' +
            '<span class="' + catClass + ' mb-2">' + escapeHtml(item.category) + '</span>' +
            '<h3 class="text-lg font-extrabold tracking-tight text-[#14161B] group-hover:text-[#FF6B00] transition-colors mb-1">' + escapeHtml(item.title) + '</h3>' +
            (summary ? '<p class="text-sm text-[#667084] leading-relaxed">' + escapeHtml(summary) + '</p>' : '') +
          '</div>' +
          '<span class="text-sm font-semibold text-[#9AA1AE] shrink-0 mono-num">' + escapeHtml(item.date) + '</span>' +
        '</a>'
      );
    }).join('');
  }

  function renderFeaturedHero(page, heroSol) {
    var feat = page.featured || {};
    var link = document.getElementById('home-featured-link');
    var eyebrow = document.getElementById('home-featured-eyebrow');
    var fTitle = document.getElementById('home-featured-title');
    var fSub = document.getElementById('home-featured-subtitle');
    var fCta = document.getElementById('home-featured-cta');
    var img = document.getElementById('home-featured-image');

    if (heroSol) {
      var href = solutionHref(heroSol);
      if (link) link.setAttribute('href', href);
      if (eyebrow) eyebrow.textContent = feat.eyebrow || '';
      if (fTitle) fTitle.textContent = heroSol.name || '';
      if (fSub) {
        fSub.textContent = feat.subtitle ||
          ((heroSol.specs || []).slice(0, 2).join(' | ')) ||
          (heroSol.summary || '');
      }
      if (fCta) fCta.textContent = feat.cta || '';
      if (img && heroSol.image && global.TXAM) {
        global.TXAM.setMedia(img, heroSol.image, heroSol.name || '');
      }
      return;
    }

    // Legacy full featured object
    if (link && feat.href) link.setAttribute('href', feat.href);
    if (eyebrow) eyebrow.textContent = feat.eyebrow || '';
    if (fTitle) fTitle.textContent = feat.title || '';
    if (fSub) fSub.textContent = feat.subtitle || '';
    if (fCta) fCta.textContent = feat.cta || '';
    if (img && feat.image && global.TXAM) {
      global.TXAM.setMedia(img, feat.image, feat.imageAlt || feat.title || '');
    }
  }

  function renderHome(page, solutionsMap, newsMap) {
    if (page.seo) {
      if (global.TXAM.applySeo) {
        global.TXAM.applySeo(page.seo);
      } else if (page.seo.title) {
        document.title = page.seo.title;
      }
    }

    var hero = page.hero || {};
    var titleEl = document.getElementById('home-hero-title');
    var leadEl = document.getElementById('home-hero-lead');
    if (titleEl) titleEl.textContent = hero.title || '';
    if (leadEl) leadEl.textContent = hero.lead || '';

    var primary = document.getElementById('home-cta-primary');
    var secondary = document.getElementById('home-cta-secondary');
    if (primary && hero.primaryCta) {
      var labelEl = primary.querySelector('.v3-btn__label');
      if (labelEl) labelEl.textContent = hero.primaryCta.label;
      else primary.textContent = hero.primaryCta.label;
      primary.setAttribute('href', hero.primaryCta.href);
    }
    if (secondary && hero.secondaryCta) {
      var labelEl2 = secondary.querySelector('.v3-btn__label');
      if (labelEl2) labelEl2.textContent = hero.secondaryCta.label;
      else secondary.textContent = hero.secondaryCta.label;
      secondary.setAttribute('href', hero.secondaryCta.href);
    }

    var solutions = catalogItems(solutionsMap).filter(isPublished);
    var heroSol = solutions.filter(function (s) { return s.homeSlot === 'hero'; })[0] || null;
    var categorySols = solutions.filter(function (s) { return s.homeSlot === 'category'; }).slice(0, 2);

    renderFeaturedHero(page, heroSol);

    var about = page.aboutSection || {};
    var aboutTitle = document.getElementById('home-about-title');
    var aboutBody = document.getElementById('home-about-body');
    if (aboutTitle) aboutTitle.textContent = about.title || '';
    if (aboutBody) aboutBody.innerHTML = about.bodyHtml || '';

    renderStatsGrid(document.getElementById('home-stats-grid'), about.stats);
    renderProductsSection(page.productsSection, categorySols);
    renderServiceSection(page.serviceSection);

    // 收尾 CTA 的宣言沿用 Hero 标题，保持首尾呼应
    var finalTitle = document.getElementById('home-final-title');
    if (finalTitle && hero.title) finalTitle.textContent = hero.title;

    // 企业动态：优先首页精选，不足 3 条时用最新发布补齐
    var publishedNews = catalogItems(newsMap).filter(isPublished);
    var featuredNews = publishedNews.filter(function (n) { return !!n.homeFeatured; });
    if (featuredNews.length < 3) {
      var picked = {};
      featuredNews.forEach(function (n) { picked[String(n.id)] = true; });
      publishedNews
        .slice()
        .sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); })
        .forEach(function (n) {
          if (featuredNews.length >= 3 || picked[String(n.id)]) return;
          picked[String(n.id)] = true;
          featuredNews.push(n);
        });
    }
    featuredNews = featuredNews.slice(0, 3);
    renderNewsSection(page.newsSection, featuredNews, newsMap);
  }

  async function initHomePage(options) {
    options = options || {};
    var lang = options.lang || (global.TXAM && global.TXAM.detectLang()) || 'zh';
    if (!global.TXAM || !global.TXAM.loadPage) return;

    try {
      if (global.TXAM.loadHome) {
        var bundle = await global.TXAM.loadHome(lang);
        if (bundle && bundle.page) {
          renderHome(bundle.page, bundle.solutions, bundle.news);
          return;
        }
      }

      var loaded = await Promise.all([
        global.TXAM.loadPage('home', lang),
        global.TXAM.loadData ? global.TXAM.loadData('solutions', lang) : Promise.resolve(null),
        global.TXAM.loadData ? global.TXAM.loadData('news', lang) : Promise.resolve(null),
      ]);
      var page = loaded[0];
      var solutionsMap = loaded[1];
      var newsMap = loaded[2];
      if (page) renderHome(page, solutionsMap, newsMap);
    } catch (err) {
      console.error(err);
    }
  }

  global.TXAM = global.TXAM || {};
  global.TXAM.initHomePage = initHomePage;
})(typeof window !== 'undefined' ? window : globalThis);
