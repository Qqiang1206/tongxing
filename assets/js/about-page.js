/**
 * Hydrate about.html from TXAM.loadPage('about', lang).
 */
(function (global) {
  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderStatsGrid(container, statsBlock) {
    if (!container || !statsBlock || !statsBlock.items || !statsBlock.items.length) return;

    container.innerHTML = statsBlock.items.map(function (stat) {
      var emphasis = stat.emphasis || '';
      var wrapClass = '';
      var unitClass = 'text-3xl ml-1 text-gray-300';
      var labelClass = 'text-xs font-bold text-[#86868B] tracking-widest uppercase';

      if (emphasis === 'accent') {
        wrapClass = 'pl-6 border-l-4 border-[#FF6B00]';
        unitClass = 'text-3xl ml-1';
        labelClass = 'text-xs font-bold text-[#1D1D1F] tracking-widest uppercase';
      }

      var unitHtml = stat.unit
        ? '<span class="' + unitClass + '">' + escapeHtml(stat.unit) + '</span>'
        : '';

      return (
        '<div class="' + wrapClass + '">' +
          '<div class="text-[3.5rem] md:text-[4.5rem] font-black text-[#1D1D1F] mono-num leading-none mb-2">' +
            escapeHtml(stat.value) + unitHtml +
          '</div>' +
          '<p class="' + labelClass + '">' + escapeHtml(stat.label) + '</p>' +
        '</div>'
      );
    }).join('');
  }

  /**
   * v3：CMS 轮播图直接作为"关于我们"页的满屏背景（多图交叉淡化）。
   * 图源来自后台 carousel.slides —— 后台换图即换背景。
   * 页面静态内嵌的两张图仅作无 JS 兜底；渲染器在首绘前同步替换。
   */
  function renderCarousel(carousel) {
    if (!carousel || !carousel.slides || !carousel.slides.length) return;

    var media = document.querySelector('.v3-hero--about .v3-hero__media');
    if (!media) return;

    var assetUrl = global.TXAM && global.TXAM.assetUrl ? global.TXAM.assetUrl : function (u) { return u; };

    media.classList.add('tx-cross-js');
    media.innerHTML = carousel.slides.map(function (slide, i) {
      var attrs = 'src="' + escapeHtml(assetUrl(slide.image)) + '" alt=""';
      attrs += i === 0 ? ' fetchpriority="high"' : ' loading="lazy"';
      return '<img ' + attrs + '>';
    }).join('');

    var imgs = media.querySelectorAll('img');
    if (imgs.length < 2) return; // 单图：静态呈现

    // 背景轮播始终运行（站点所有者选择：装饰性淡化不受系统动效偏好限制）
    var current = 0;
    imgs[0].classList.add('is-tx-active');
    global.setInterval(function () {
      imgs[current].classList.remove('is-tx-active');
      current = (current + 1) % imgs.length;
      imgs[current].classList.add('is-tx-active');
    }, 8000);
  }

  function dotClass(accent, mobile) {
    var base = mobile ? 'w-4 h-4' : 'w-5 h-5';
    return accent
      ? base + ' bg-[#FF6B00] rounded-full border-4 border-[#F5F5F7] shadow-md shadow-orange-500/30'
      : base + ' bg-[#1D1D1F] rounded-full border-4 border-[#F5F5F7] shadow-md';
  }

  function renderCulture(culture) {
    if (!culture) return;

    var headline = document.getElementById('about-culture-headline');
    var grid = document.getElementById('about-culture-pillars');
    if (headline) headline.innerHTML = culture.headlineHtml || '';
    if (!grid || !culture.pillars) return;

    grid.innerHTML = culture.pillars.map(function (pillar) {
      return (
        '<div class="bg-white/5 p-10 radius-lg border border-white/10 hover:border-[#FF6B00]/50 transition-colors">' +
          '<h3 class="text-[#FF6B00] font-black text-h3 mb-6 tracking-widest uppercase">' + escapeHtml(pillar.title || '') + '</h3>' +
          '<p class="text-gray-300 text-body-lg leading-relaxed font-light">' + (pillar.bodyHtml || '') + '</p>' +
        '</div>'
      );
    }).join('');
  }

  function renderTimeline(timeline) {
    if (!timeline) return;

    var titleEl = document.getElementById('about-timeline-title');
    var subEl = document.getElementById('about-timeline-subtitle');
    var desktop = document.getElementById('about-timeline-desktop');
    var mobile = document.getElementById('about-timeline-mobile');

    if (titleEl) titleEl.textContent = timeline.title || '';
    if (subEl) subEl.textContent = timeline.subtitle || '';
    if (!timeline.events || !timeline.events.length) return;

    if (desktop) {
      desktop.innerHTML = timeline.events.map(function (ev, i) {
        var isLast = i === timeline.events.length - 1;
        var mb = isLast ? '' : ' mb-16';
        var yearClass = ev.yearAccent
          ? 'text-h2 text-[#FF6B00] mb-3 mono-num'
          : 'text-h2 text-[#1D1D1F] mb-3 mono-num';
        var body = '';
        if (ev.leadHtml) {
          body += '<p class="text-[#1D1D1F] font-bold text-sm leading-relaxed mb-2">' + ev.leadHtml + '</p>';
        }
        if (ev.bodyHtml) {
          body += '<p class="text-[#86868B] text-sm leading-relaxed">' + ev.bodyHtml + '</p>';
        }
        var content = '<h3 class="' + yearClass + '">' + escapeHtml(ev.year) + '</h3>' + body;

        if (ev.side === 'left') {
          return (
            '<div class="flex items-center justify-between w-full' + mb + '">' +
              '<div class="w-5/12 text-right pr-10">' + content + '</div>' +
              '<div class="w-2/12 flex justify-center relative z-10"><div class="' + dotClass(ev.accent) + '"></div></div>' +
              '<div class="w-5/12"></div>' +
            '</div>'
          );
        }
        return (
          '<div class="flex items-center justify-between w-full' + mb + '">' +
            '<div class="w-5/12"></div>' +
            '<div class="w-2/12 flex justify-center relative z-10"><div class="' + dotClass(ev.accent) + '"></div></div>' +
            '<div class="w-5/12 pl-10">' + content + '</div>' +
          '</div>'
        );
      }).join('');
    }

    if (mobile) {
      mobile.innerHTML = timeline.events.map(function (ev, i) {
        var isLast = i === timeline.events.length - 1;
        var mb = isLast ? '' : ' mb-10';
        var yearClass = ev.yearAccent
          ? 'text-3xl font-black text-[#FF6B00] mb-2 mono-num'
          : 'text-3xl font-black text-[#1D1D1F] mb-2 mono-num';
        var text = ev.mobileBody || ev.bodyHtml || '';
        return (
          '<div class="' + mb + ' ml-8 relative">' +
            '<div class="absolute -left-[41px] top-1 ' + dotClass(ev.accent, true) + '"></div>' +
            '<h3 class="' + yearClass + '">' + escapeHtml(ev.year) + '</h3>' +
            '<p class="text-[#86868B] text-sm leading-relaxed">' + text + '</p>' +
          '</div>'
        );
      }).join('');
    }
  }

  function renderCredentials(credentials) {
    if (!credentials) return;
    var titleEl = document.getElementById('about-credentials-title');
    var subEl = document.getElementById('about-credentials-subtitle');
    var root = document.getElementById('about-credentials-groups');
    if (titleEl) titleEl.textContent = credentials.title || '';
    if (subEl) subEl.textContent = credentials.subtitle || '';
    if (!root || !credentials.groups) return;

    var assetUrl = global.TXAM && global.TXAM.assetUrl ? global.TXAM.assetUrl : function (u) { return u; };

    root.innerHTML = credentials.groups.map(function (group, gi) {
      var isLast = gi === credentials.groups.length - 1;
      var wrapClass = isLast ? '' : 'mb-24';
      var items = group.items || [];

      if (group.layout === 'marquee') {
        var cards = items.map(function (item) {
          var src = escapeHtml(assetUrl(item.image));
          var alt = escapeHtml(item.imageAlt || group.title || '');
          var media = /\.webp$/i.test(item.image)
            ? '<picture><source srcset="' + src + '" type="image/webp"><img loading="lazy" decoding="async" src="' + src + '" alt="' + alt + '" class="w-full h-full object-contain"></picture>'
            : '<img loading="lazy" decoding="async" src="' + src + '" alt="' + alt + '" class="w-full h-full object-contain">';
          return (
            '<div class="patent-card apple-card p-4 flex flex-col items-center">' +
              '<div class="patent-card__media">' + media + '</div>' +
            '</div>'
          );
        }).join('');
        return (
          '<div class="' + wrapClass + '">' +
            '<h3 class="text-h3 text-[#1D1D1F] mb-8 border-l-4 border-[#FF6B00] pl-4">' + escapeHtml(group.title || '') + '</h3>' +
            '<div class="patent-marquee" style="--marquee-duration: ' + escapeHtml(group.marqueeDuration || '40s') + '">' +
              '<div class="patent-marquee__track" data-patent-marquee>' + cards + '</div>' +
            '</div>' +
          '</div>'
        );
      }

      var grid = items.map(function (item) {
        var src = escapeHtml(assetUrl(item.image));
        var alt = escapeHtml(item.imageAlt || group.title || '');
        var media = /\.webp$/i.test(item.image)
          ? '<picture><source srcset="' + src + '" type="image/webp"><img loading="lazy" decoding="async" src="' + src + '" alt="' + alt + '" class="w-full h-full object-contain"></picture>'
          : '<img loading="lazy" decoding="async" src="' + src + '" alt="' + alt + '" class="w-full h-full object-contain">';
        return (
          '<div class="apple-card p-3 flex flex-col items-center">' +
            '<div class="w-full bg-white radius-sm overflow-hidden">' + media + '</div>' +
          '</div>'
        );
      }).join('');

      return (
        '<div class="' + wrapClass + '">' +
          '<h3 class="text-h3 text-[#1D1D1F] mb-8 border-l-4 border-[#FF6B00] pl-4">' + escapeHtml(group.title || '') + '</h3>' +
          '<div class="grid grid-cols-2 md:grid-cols-4 gap-6">' + grid + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderClients(clients) {
    if (!clients) return;
    var titleEl = document.getElementById('about-clients-title');
    var subEl = document.getElementById('about-clients-subtitle');
    var grid = document.getElementById('client-logos-grid');
    if (titleEl) titleEl.textContent = clients.title || '';
    if (subEl) subEl.textContent = clients.subtitle || '';
    if (!grid || !clients.items || !clients.items.length) return;

    var assetUrl = global.TXAM && global.TXAM.assetUrl ? global.TXAM.assetUrl : function (u) { return u; };

    grid.innerHTML = clients.items.map(function (item) {
      var src = escapeHtml(assetUrl(item.image));
      var alt = escapeHtml(item.imageAlt || '');
      return (
        '<div class="client-card h-28 bg-white border border-[#E5E5EA] radius-lg flex items-center justify-center p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">' +
          '<img loading="lazy" decoding="async" src="' + src + '" alt="' + alt + '" class="max-h-full max-w-full client-logo" onerror="this.parentElement.style.display=\'none\'">' +
        '</div>'
      );
    }).join('');
  }

  async function initAboutPage(options) {
    options = options || {};
    var lang = options.lang || (global.TXAM && global.TXAM.detectLang()) || 'zh';
    if (!global.TXAM || !global.TXAM.loadPage) return;

    try {
      var page = await global.TXAM.loadPage('about', lang);
      if (!page) return;

      if (page.seo) {
        if (global.TXAM.applySeo) {
          global.TXAM.applySeo(page.seo);
        } else if (page.seo.title) {
          document.title = page.seo.title;
        }
      }

      var titleEl = document.getElementById('about-hero-title');
      var leadEl = document.getElementById('about-hero-lead');
      if (titleEl && page.hero) titleEl.textContent = page.hero.title || '';
      if (leadEl && page.hero) leadEl.innerHTML = page.hero.leadHtml || page.hero.lead || '';

      renderCarousel(page.carousel);
      renderStatsGrid(document.getElementById('about-stats-grid'), page.stats);
      renderCulture(page.culture);
      renderTimeline(page.timeline);
      renderCredentials(page.credentials);
      renderClients(page.clients);

      if (global.TXAM.initFactoryCarousel) {
        global.TXAM.initFactoryCarousel();
      }
      if (global.TXAM.initPatentMarquee) {
        global.TXAM.initPatentMarquee();
      }
      if (global.TXAM.revealFadeUps) {
        global.TXAM.revealFadeUps();
      } else {
        document.querySelectorAll('.fade-up').forEach(function (el) {
          el.classList.add('visible');
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  global.TXAM = global.TXAM || {};
  global.TXAM.initAboutPage = initAboutPage;
})(typeof window !== 'undefined' ? window : globalThis);
