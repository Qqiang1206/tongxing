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

  function escapeAttr(text) {
    return escapeHtml(text).replace(/'/g, '&#39;');
  }

  /* 该地址是否配了坐标——没配就不上图（后台坐标留空即不上图） */
  function hasLngLat(loc) {
    if (!loc || !loc.lnglat || loc.lnglat.length < 2) return false;
    return isFinite(Number(loc.lnglat[0])) && isFinite(Number(loc.lnglat[1]));
  }

  function iconHoverClass(hover) {
    if (hover === 'whatsapp') {
      return 'group-hover:bg-[#25D366] group-hover:border-[#25D366]';
    }
    return 'group-hover:bg-[#14161B] group-hover:border-[#14161B]';
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
        '<h3 class="text-xl font-bold text-[#667084] mb-2">' + escapeHtml(ch.title) + '</h3>' +
        '<p class="text-2xl md:text-3xl font-black text-[#14161B] tracking-tight ' +
        valueHoverClass(ch.hover) + ' transition-colors">' + escapeHtml(ch.value) + '</p>' +
        '<p class="text-sm text-[#667084] mt-2">' + escapeHtml(ch.hint) + '</p></div>' +
        '<div class="mt-6 md:mt-0 text-[#14161B] font-bold text-sm bg-gray-50 px-4 py-2 radius-sm border border-gray-200 group-hover:bg-[#14161B] group-hover:text-white transition-colors">' +
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
      '<h3 class="text-xl font-bold text-[#667084] mb-2">' + escapeHtml(ch.title) + '</h3>' +
      '<p class="text-2xl font-black text-[#14161B] mono-num tracking-tight ' +
      valueHoverClass(ch.hover) + ' transition-colors">' + escapeHtml(ch.value) + '</p>' +
      '<p class="text-sm text-[#667084] mt-2">' + escapeHtml(ch.hint) + '</p></div></a>'
    );
  }

  function buildLocation(loc, index, focusLabel, mappable) {
    var badge = loc.badge
      ? '<span class="ml-3 bg-[#FF6B00]/10 text-xs px-2 py-1 rounded text-[#FF6B00] font-bold">' +
        escapeHtml(loc.badge) + '</span>'
      : '';
    var hr = index > 0 ? '<hr class="border-[#E7EAF0] mb-10">' : '';
    var wrapClass = index === 0 ? 'mb-10' : '';
    var dot =
      '<span class="block w-3 h-3 rounded-full border-2 border-white shadow-sm" style="background:' +
      escapeHtml(loc.dotColor || '#14161B') + '"></span>';
    /* 有坐标时圆点变为按钮：点它把地图定位到该基地并与标记呼应 */
    var dotBlock = mappable
      ? '<button type="button" class="loc-focus mr-3 shrink-0 rounded-full cursor-pointer ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/50" ' +
        'data-loc-index="' + index + '" title="' + escapeAttr(focusLabel || loc.name || '') + '" ' +
        'aria-label="' + escapeAttr([focusLabel, loc.name].filter(Boolean).join(' ')) + '">' +
        dot + '</button>'
      : '<span class="mr-3 shrink-0">' + dot + '</span>';

    return (
      hr +
      '<div class="' + wrapClass + '">' +
      '<div class="flex items-center mb-4">' +
      dotBlock +
      '<h3 class="text-h3 font-bold text-[#14161B]">' + escapeHtml(loc.name) + '</h3>' +
      badge + '</div>' +
      '<p class="text-[#667084] text-sm leading-[1.8] mb-4">' + escapeHtml(loc.address) + '</p>' +
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
      var focusLabel = (page.map && page.map.focusLabel) || '';
      locations.innerHTML = page.locations.map(function (loc, i) {
        return buildLocation(loc, i, focusLabel, hasLngLat(loc));
      }).join('');
    }

    initAmap(page);
  }

  var pendingMapPage = null;

  /* 与左侧卡片同色的圆点图标 */
  function dotIcon(color, size) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
      '<circle cx="12" cy="12" r="10" fill="' + color + '" stroke="#FFFFFF" stroke-width="2"/></svg>';
    return new AMap.Icon({
      size: new AMap.Size(size, size),
      imageSize: new AMap.Size(size, size),
      image: 'data:image/svg+xml,' + encodeURIComponent(svg),
    });
  }

  function infoHtml(loc) {
    return '<div style="min-width:180px;max-width:260px;padding:2px 4px">' +
      '<strong style="display:block;font-size:14px;color:#14161B;margin-bottom:6px">' +
      escapeHtml(loc.name || '') + '</strong>' +
      '<p style="margin:0;font-size:12px;line-height:1.7;color:#667084">' +
      escapeHtml(loc.address || '') + '</p></div>';
  }

  var FIT_PAD = 48; /* 标记距可视区边缘的最小留白 */

  /* 左侧（窄屏为上方）卡片浮层占掉的宽度/高度 */
  function visibleInsets(el) {
    var inset = { left: 0, top: 0 };
    var overlay = el.parentNode && el.parentNode.querySelector('.map-overlay');
    if (!overlay) return inset;
    var o = overlay.getBoundingClientRect();
    var c = el.getBoundingClientRect();
    if (window.innerWidth >= 768) inset.left = Math.max(0, Math.round(o.right - c.left) + 24);
    else inset.top = Math.max(0, Math.round(o.bottom - c.top) + 16);
    return inset;
  }

  function markerBBox(map, entries) {
    var pts = entries.map(function (e) { return map.lngLatToContainer(e.marker.getPosition()); });
    var xs = pts.map(function (p) { return p.x; });
    var ys = pts.map(function (p) { return p.y; });
    var minX = Math.min.apply(null, xs);
    var maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys);
    var maxY = Math.max.apply(null, ys);
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
  }

  /*
   * 把两块基地都放进「可视区」（画布减去卡片浮层）并居中。
   * setFitView 只按整个画布算，所以跨城（深惠）时会有一个点被浮层压住、
   * 甚至被推出画布——这里按可视区再校验一次，不够就逐级缩一级。
   * 只依赖投影换算与 setCenter，不依赖 panBy 的方向语义；重复调用幂等。
   */
  function adjustView(map, entries, el) {
    if (entries.length < 2) return;
    var ins = visibleInsets(el);
    var availW = el.clientWidth - ins.left - FIT_PAD * 2;
    var availH = el.clientHeight - ins.top - FIT_PAD * 2;
    for (var i = 0; i < 4; i++) {
      var box = markerBBox(map, entries);
      if ((box.w <= availW && box.h <= availH) || map.getZoom() <= 3) break;
      map.setZoom(map.getZoom() - 1, true);
    }
    var b = markerBBox(map, entries);
    var dx = ins.left + (el.clientWidth - ins.left) / 2 - b.cx;
    var dy = ins.top + (el.clientHeight - ins.top) / 2 - b.cy;
    if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) return;
    map.setCenter(map.containerToLngLat(
      new AMap.Pixel(el.clientWidth / 2 - dx, el.clientHeight / 2 - dy)
    ));
  }

  function fitLocations(map, entries, el) {
    if (!entries.length) return;
    if (entries.length === 1) {
      map.setZoomAndCenter(Math.max(map.getZoom(), 15), entries[0].marker.getPosition());
      return;
    }
    /* immediately=true：动画没结束就量投影会量到旧位置 */
    map.setFitView(entries.map(function (e) { return e.marker; }), true, [72, 72, 72, 72], 15);
    adjustView(map, entries, el);
    /* 首次布局/字体未就绪时再校一次（幂等） */
    setTimeout(function () { adjustView(map, entries, el); }, 300);
  }

  /* 点左侧卡片上的圆点 → 地图定位到该基地并弹出信息窗 */
  function bindLocationFocus(map, entries) {
    var byIndex = {};
    entries.forEach(function (e) { byIndex[e.index] = e; });
    Array.prototype.forEach.call(
      document.querySelectorAll('#contact-locations .loc-focus'),
      function (btn) {
        btn.addEventListener('click', function () {
          var entry = byIndex[Number(btn.getAttribute('data-loc-index'))];
          if (!entry) return;
          map.setZoomAndCenter(16, entry.marker.getPosition());
          if (entry.info) entry.info.open(map, entry.marker.getPosition());
        });
      }
    );
  }

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
        mapStyle: 'amap://styles/whitesmoke',
        features: ['bg', 'road', 'building'],
      });

      var entries = [];
      (page.locations || []).forEach(function (loc, i) {
        if (!hasLngLat(loc)) return;
        var marker = new AMap.Marker({
          position: [Number(loc.lnglat[0]), Number(loc.lnglat[1])],
          map: map,
          zIndex: 110 + i,
          offset: new AMap.Pixel(-11, -11),
          icon: dotIcon(loc.dotColor || (i === 0 ? '#14161B' : '#FF6B00'), 22),
        });
        var info = new AMap.InfoWindow({ content: infoHtml(loc), offset: new AMap.Pixel(0, -14) });
        marker.on('click', function () { info.open(map, marker.getPosition()); });
        entries.push({ index: i, marker: marker, info: info });
      });

      /* 一个坐标都没配时，退回原来「在 map.center 打一个点」的行为 */
      if (!entries.length) {
        entries.push({
          index: -1,
          info: null,
          marker: new AMap.Marker({
            position: center,
            map: map,
            offset: new AMap.Pixel(-12, -12),
            icon: dotIcon('#FF6B00', 24),
          }),
        });
      }

      fitLocations(map, entries, el);
      bindLocationFocus(map, entries);
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
    if (global.TXAM && global.TXAM.revealFadeUps) {
      global.TXAM.revealFadeUps();
    }
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
