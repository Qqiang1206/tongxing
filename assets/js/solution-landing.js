/**
 * Hydrate *-solution.html landing pages from solutions API / JSON by slug.
 */
(function (global) {
  var SLUG_TO_ID = {
    'tv-display': '31',
    refrigerator: '32',
    packaging: '33',
    washer: '34',
    capacitor: '35',
    ac: '36',
    microwave: '37',
    coffee: '38',
    tablet: '39',
    headlight: '40',
    robot: '41',
  };

  var ID_TO_SLUG = {};
  Object.keys(SLUG_TO_ID).forEach(function (slug) {
    ID_TO_SLUG[SLUG_TO_ID[slug]] = slug;
  });

  function slugFromPath() {
    var path = (location.pathname || '').replace(/\\/g, '/');
    var m = path.match(/\/([a-z0-9-]+)-solution\.html$/i);
    return m ? m[1].toLowerCase() : null;
  }

  function renderPainPoints(container, points) {
    if (!container || !points) return;
    container.innerHTML = points.map(function (p) {
      return '<div class="apple-card p-8">' +
        '<div class="w-12 h-12 bg-[#FF6B00]/10 radius-sm flex items-center justify-center mb-4">' +
        '<svg class="w-6 h-6 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
        '</div>' +
        '<h4 class="font-bold text-[#1D1D1F] mb-2">' + p.title + '</h4>' +
        '<p class="text-sm text-[#86868B]">' + p.desc + '</p></div>';
    }).join('');
  }

  function renderProcess(container, steps) {
    if (!container || !steps) return;
    container.innerHTML = steps.map(function (p) {
      return '<div class="apple-card p-6 text-center">' +
        '<div class="w-16 h-16 bg-[#FF6B00] rounded-full flex items-center justify-center mx-auto mb-4">' +
        '<span class="text-white font-black text-xl mono-num">' + p.step + '</span></div>' +
        '<h4 class="font-bold text-[#1D1D1F] mb-2">' + p.title + '</h4>' +
        '<p class="text-sm text-[#86868B]">' + p.desc + '</p></div>';
    }).join('');
  }

  function renderSolution(data, allData, slug) {
    var titleEl = document.querySelector('.detail-title');
    if (titleEl) titleEl.textContent = data.name;

    var leadEl = document.querySelector('.detail-lead');
    if (leadEl) leadEl.textContent = data.summary || data.desc || '';

    var heroImg = document.querySelector('.detail-hero-grid img');
    if (heroImg && data.image) global.TXAM.setMedia(heroImg, data.image, data.name);

    var specsContainer = document.querySelector('.detail-specs');
    if (specsContainer) {
      specsContainer.innerHTML = (data.specs || [])
        .map(function (spec) {
          return '<span class="spec-tag">' + spec + '</span>';
        })
        .join('');
    }

    var sidebar = document.querySelector('.detail-sidebar');
    var featuresEl = sidebar ? sidebar.querySelector('p') : null;
    if (featuresEl) featuresEl.textContent = data.summary || data.desc || '';

    renderPainPoints(
      document.getElementById('solution-pain-points-grid') || document.getElementById('pain-points'),
      data.painPoints
    );
    renderProcess(
      document.getElementById('solution-process-grid') || document.getElementById('process-steps'),
      data.process
    );

    var detailEl = document.querySelector('.detail-prose') || document.getElementById('solution-detail');
    if (detailEl) detailEl.innerHTML = data.contentHtml || data.detail || '';

    var relatedContainer = document.getElementById('related-solutions') ||
      document.querySelector('.specs-grid');
    if (relatedContainer && allData) {
      var currentId = String(data.id);
      var picks = Object.keys(allData)
        .filter(function (id) { return id !== currentId; })
        .sort(function () { return Math.random() - 0.5; })
        .slice(0, 3);

      relatedContainer.innerHTML = picks.map(function (id) {
        var item = allData[id];
        var itemSlug = item.slug || ID_TO_SLUG[id] || id;
        return (
          '<a href="' + itemSlug + '-solution.html" class="apple-card block p-6 group">' +
          '<div class="w-full h-40 radius-sm overflow-hidden bg-gray-100 mb-4">' +
          '<img loading="lazy" src="' + global.TXAM.assetUrl(item.image) + '" alt="' + item.name + '" class="img-zoom w-full h-full object-cover">' +
          '</div>' +
          '<h4 class="font-bold text-[#1D1D1F] mb-2 group-hover:text-[#FF6B00] transition-colors">' + item.name + '</h4>' +
          '<p class="text-sm text-[#86868B] line-clamp-2">' + (item.summary || item.desc || '') + '</p></a>'
        );
      }).join('');
    }

    if (global.TXAM.applySeo) {
      global.TXAM.applySeo({
        title: data.name + ' | TXAM',
        description: data.summary || data.desc || '',
        image: data.image,
        type: 'article',
      });
    } else {
      document.title = data.name + ' | TXAM';
    }
  }

  async function loadSolutionBySlug(slug, lang) {
    if (global.TXAM.loadSolutionBySlug) {
      return global.TXAM.loadSolutionBySlug(slug, lang);
    }
    var all = await global.TXAM.loadData('solutions', lang);
    var id = SLUG_TO_ID[slug];
    return id ? all[id] : null;
  }

  async function initSolutionLanding(options) {
    options = options || {};
    var lang = options.lang || (global.TXAM && global.TXAM.detectLang()) || 'zh';
    var slug = options.slug || slugFromPath();
    if (!slug || !global.TXAM) return;

    try {
      var allData = await global.TXAM.loadData('solutions', lang);
      var data = await loadSolutionBySlug(slug, lang);
      if (!data) {
        console.error('Solution not found for slug:', slug);
        return;
      }
      if (!data.slug) data.slug = slug;
      renderSolution(data, allData, slug);
    } catch (err) {
      console.error(err);
    }

    global.TXAM.revealFadeUps();
    global.TXAM.bindMobileMenu();
  }

  global.TXAM = global.TXAM || {};
  global.TXAM.initSolutionLanding = initSolutionLanding;
  global.TXAM.slugFromPath = slugFromPath;
})(typeof window !== 'undefined' ? window : globalThis);
