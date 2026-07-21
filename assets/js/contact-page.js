/**
 * Hydrate contact.html from TXAM.loadPage('contact', lang).
 */
(function (global) {
  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function iconHoverClass(hover) {
    if (hover === 'whatsapp') {
      return 'group-hover:bg-[#25D366] group-hover:border-[#25D366]';
    }
    return 'group-hover:bg-[#1D1D1F] group-hover:border-[#1D1D1F]';
  }

  function valueHoverClass(hover) {
    if (hover === 'whatsapp') return 'group-hover:text-[#25D366]';
    return 'group-hover:text-[#FF6B00]';
  }

  function buildChannel(ch) {
    var col = ch.colSpan === 2 ? ' lg:col-span-2' : '';
    var target = ch.target === '_blank' ? ' target="_blank" rel="noopener"' : '';

    if (ch.type === 'email' && ch.cta) {
      return (
        '<a href="' + escapeHtml(ch.href) + '"' + target +
        ' class="apple-card p-10 flex flex-col justify-between min-h-[280px] group cursor-pointer' + col + '">' +
        '<div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-3xl mb-8 ' +
        iconHoverClass(ch.hover) + ' transition-colors border border-gray-200">' +
        '<span class="group-hover:scale-110 transition-transform">' + ch.icon + '</span></div>' +
        '<div class="flex flex-col md:flex-row md:items-end justify-between">' +
        '<div><div class="text-[#FF6B00] font-bold text-xs tracking-widest mb-2 uppercase">' +
        escapeHtml(ch.eyebrow) + '</div>' +
        '<h3 class="text-xl font-bold text-[#86868B] mb-2">' + escapeHtml(ch.title) + '</h3>' +
        '<p class="text-2xl md:text-3xl font-black text-[#1D1D1F] tracking-tight ' +
        valueHoverClass(ch.hover) + ' transition-colors">' + escapeHtml(ch.value) + '</p>' +
        '<p class="text-sm text-[#86868B] mt-2">' + escapeHtml(ch.hint) + '</p></div>' +
        '<div class="mt-6 md:mt-0 text-[#1D1D1F] font-bold text-sm bg-gray-50 px-4 py-2 radius-sm border border-gray-200 group-hover:bg-[#1D1D1F] group-hover:text-white transition-colors">' +
        escapeHtml(ch.cta) + '</div></div></a>'
      );
    }

    return (
      '<a href="' + escapeHtml(ch.href) + '"' + target +
      ' class="apple-card p-10 flex flex-col justify-between min-h-[280px] group cursor-pointer' + col + '">' +
      '<div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-3xl mb-8 ' +
      iconHoverClass(ch.hover) + ' transition-colors border border-gray-200">' +
      '<span class="group-hover:scale-110 transition-transform">' + ch.icon + '</span></div>' +
      '<div><div class="text-[#FF6B00] font-bold text-xs tracking-widest mb-2 uppercase">' +
      escapeHtml(ch.eyebrow) + '</div>' +
      '<h3 class="text-xl font-bold text-[#86868B] mb-2">' + escapeHtml(ch.title) + '</h3>' +
      '<p class="text-2xl font-black text-[#1D1D1F] mono-num tracking-tight ' +
      valueHoverClass(ch.hover) + ' transition-colors">' + escapeHtml(ch.value) + '</p>' +
      '<p class="text-sm text-[#86868B] mt-2">' + escapeHtml(ch.hint) + '</p></div></a>'
    );
  }

  function buildLocation(loc, index) {
    var badge = loc.badge
      ? '<span class="ml-3 bg-[#FF6B00]/10 text-xs px-2 py-1 rounded text-[#FF6B00] font-bold">' +
        escapeHtml(loc.badge) + '</span>'
      : '';
    var hr = index > 0 ? '<hr class="border-[#E5E5EA] mb-10">' : '';
    var wrapClass = index === 0 ? 'mb-10' : '';

    return (
      hr +
      '<div class="' + wrapClass + '">' +
      '<div class="flex items-center mb-4">' +
      '<span class="w-3 h-3 rounded-full border-2 border-white shadow-sm mr-3" style="background:' +
      escapeHtml(loc.dotColor || '#1D1D1F') + '"></span>' +
      '<h3 class="text-h3 font-bold text-[#1D1D1F]">' + escapeHtml(loc.name) + '</h3>' +
      badge + '</div>' +
      '<p class="text-[#86868B] text-sm leading-[1.8] mb-4">' + escapeHtml(loc.address) + '</p>' +
      '<a href="' + escapeHtml(loc.navUrl) + '" target="_blank" rel="noopener" class="text-[#FF6B00] text-sm font-bold hover:text-orange-600 transition-colors flex items-center">' +
      escapeHtml(loc.navLabel) + ' <span class="ml-1">↗</span></a></div>'
    );
  }

  function renderPage(page) {
    var heroTitle = document.getElementById('contact-hero-title');
    var heroLead = document.getElementById('contact-hero-lead');
    if (heroTitle && page.hero) heroTitle.textContent = page.hero.title || '';
    if (heroLead && page.hero) {
      var lead = page.hero.lead || '';
      heroLead.innerHTML = lead.replace(/\n/g, '<br class="hidden md:block">');
    }

    if (page.seo) {
      if (global.TXAM.applySeo) {
        global.TXAM.applySeo(page.seo);
      } else if (page.seo.title) {
        document.title = page.seo.title;
      }
    }

    var channels = document.getElementById('contact-channels');
    if (channels && page.channels) {
      channels.innerHTML = page.channels.map(buildChannel).join('');
    }

    var mapTitle = document.getElementById('contact-map-title');
    if (mapTitle && page.map) mapTitle.textContent = page.map.title || '';

    var locations = document.getElementById('contact-locations');
    if (locations && page.locations) {
      locations.innerHTML = page.locations.map(buildLocation).join('');
    }

    initAmap(page);
  }

  var pendingMapPage = null;

  function initAmap(page) {
    pendingMapPage = page || pendingMapPage;
    if (typeof AMap === 'undefined') return;
    var el = document.getElementById('amap-container');
    if (!el || el.getAttribute('data-map-ready')) return;
    page = pendingMapPage || page;
    if (!page) return;
    var center = (page.map && page.map.center) || [114.316297, 22.726056];
    var zoom = (page.map && page.map.zoom) || 14;
    try {
      var map = new AMap.Map('amap-container', {
        zoom: zoom,
        center: center,
        viewMode: '2D',
      });
      var dot = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#FF6B00"/></svg>'
      );
      new AMap.Marker({
        position: center,
        map: map,
        offset: new AMap.Pixel(-12, -12),
        icon: new AMap.Icon({
          size: new AMap.Size(24, 24),
          image: dot,
          imageSize: new AMap.Size(24, 24),
        }),
      });
      el.setAttribute('data-map-ready', '1');
    } catch (err) {
      console.error(err);
    }
  }

  async function initContactPage(options) {
    options = options || {};
    if (typeof document !== 'undefined' && document.body) {
      document.body.setAttribute('data-contact-inited', '1');
    }
    var lang = options.lang || (global.TXAM && global.TXAM.detectLang()) || 'zh';
    if (!global.TXAM || !global.TXAM.loadPage) return;

    try {
      var page = await global.TXAM.loadPage('contact', lang);
      if (page) renderPage(page);
    } catch (err) {
      console.error(err);
    }

    if (global.TXAM.bindMobileMenu) global.TXAM.bindMobileMenu();
    document.querySelectorAll('.fade-up').forEach(function (el) {
      el.classList.add('visible');
    });
    window.addEventListener('load', function () { initAmap(pendingMapPage); });
    // AMap may already be ready
    initAmap(pendingMapPage);
  }

  global.TXAM = global.TXAM || {};
  global.TXAM.initContactPage = initContactPage;

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      // Fallback if page forgot to call init (keeps fade-up content visible)
      if (!document.body.getAttribute('data-contact-inited')) {
        var lang = (global.TXAM.detectLang && global.TXAM.detectLang()) || 'zh';
        initContactPage({ lang: lang }).then(function () {
          document.body.setAttribute('data-contact-inited', '1');
        });
      }
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
